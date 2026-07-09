# College Bus Tracking — Project Reference

A single-document reference to the entire project as it stands. Written for someone who wants to understand or modify any part of the codebase without a re-onboarding pass.

**Repo root:** `bus/` (monorepo)

---

## 1. Executive summary

A multi-tenant college bus tracking system. One admin per college; each college owns buses, drivers, and students. Drivers stream their live location while on trip; students see their bus (and any other live bus in their college) on a map; admins manage the fleet and can watch every active trip on a live map dashboard.

**Three surfaces:**

| Surface | Path | Stack | Audience |
|---|---|---|---|
| Backend API | `bus/api` | Express + Mongoose (MongoDB), TypeScript | serves the other two |
| Admin website | `bus/bus-website` | Next.js 16 App Router + React 19 | college admins |
| Mobile app | `bus/mobile` | Expo SDK 54 + React Native 0.81, TypeScript | admin **and** driver **and** student — role decided by login |

**Real-time tracking is HTTP-poll based**, not WebSockets. The driver POSTs their `lat/lng` on every GPS tick; students and admins poll a bus-location endpoint every 5–8 seconds.

**Authentication is OTP-only.** No passwords anywhere. Every role has its own `/api/*-auth/{request-otp,verify-otp}` flow. OTPs are 4 digits, 5-minute TTL, and are currently `console.log`-ed on the server (no SMS gateway wired yet).

---

## 2. Repository layout

```
bus/
├── api/                  # Express + MongoDB backend
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── middleware/auth.ts
│   │   ├── models/       # Admin, Bus, College, Counter, Driver, Student
│   │   ├── routes/       # auth, driverAuth, studentAuth, driverTrip,
│   │   │                 # colleges, collegeBuses, collegeDrivers, collegeStudents
│   │   └── scripts/migrateStops.ts
│   ├── package.json      # cors, dotenv, express, jsonwebtoken, mongoose
│   └── tsconfig.json     # ES2022, NodeNext, strict
│
├── bus-website/          # Next.js 16 admin portal
│   ├── app/
│   │   ├── (admin)/      # every logged-in page nests under AdminShell
│   │   │   ├── dashboard/
│   │   │   ├── colleges/
│   │   │   ├── buses/{new, bulk, [busId]/{, route/{, bulk}}}
│   │   │   ├── drivers/{new, bulk, [driverId]/edit}
│   │   │   ├── students/{new, bulk, [studentId]/edit}
│   │   │   ├── assign-drivers/{, bulk}
│   │   │   ├── assign-students/{, bulk}
│   │   │   ├── track-drivers/
│   │   │   └── profile/
│   │   ├── login/, register/, payment/
│   │   ├── layout.tsx    # RootLayout → Providers
│   │   ├── page.tsx      # redirects based on auth
│   │   └── globals.css   # custom design system, no Tailwind
│   ├── components/
│   │   ├── AdminShell.tsx           # sidebar + topbar + logout modal + guard
│   │   ├── Providers.tsx            # AuthProvider + CollegeProvider
│   │   ├── OtpLoginForm.tsx
│   │   ├── CollegeForm, DriverForm, StudentForm
│   │   ├── StopMap.tsx              # Leaflet: place/drag stops
│   │   ├── DriverTrackingMap.tsx    # Leaflet: live driver markers
│   │   ├── NoCollege.tsx
│   │   └── icons.tsx                # inline SVG (Lucide-style)
│   ├── lib/
│   │   ├── api/{client, auth, colleges, collegeBuses, collegeDrivers, collegeStudents}.ts
│   │   ├── auth/{AuthContext, tokenStore}.ts
│   │   └── college/CollegeContext.tsx
│   └── next.config.ts    # turbopack root
│
├── mobile/               # Expo React Native app for all three roles
│   ├── App.tsx
│   ├── index.ts
│   ├── app.json          # Expo config, Google Maps API keys, permissions
│   ├── src/
│   │   ├── api/          # 9 modules mirroring the backend
│   │   ├── auth/         # AuthContext, OtpLoginForm, tokenStore
│   │   ├── college/CollegeContext.tsx
│   │   ├── navigation/   # RootNavigator (role-based) + types
│   │   ├── screens/      # 25+ screens
│   │   └── theme/ThemeContext.tsx
│   └── android/          # Expo prebuild output
│
└── docs/
    ├── route-disruption-scenario.md
    └── PROJECT_REFERENCE.md          # this file
```

---

## 3. Backend (`bus/api`)

### 3.1 Bootstrap

`src/index.ts` — the entire wiring:

```ts
dotenv/config → express() → cors() → express.json()
→ GET /health
→ /api/auth               → routes/auth
→ /api/driver-auth        → routes/driverAuth
→ /api/student-auth       → routes/studentAuth
→ /api/driver/trip        → routes/driverTrip
→ /api/colleges                             → routes/colleges
→ /api/colleges/:collegeId/buses            → routes/collegeBuses
→ /api/colleges/:collegeId/drivers          → routes/collegeDrivers
→ /api/colleges/:collegeId/students         → routes/collegeStudents
→ global error handler (JSON, status from err.status or 500)
→ connectDB(process.env.MONGODB_URI) → app.listen(PORT)
```

**Required env:**
- `MONGODB_URI` (default `mongodb://localhost:27017/bus`)
- `PORT` (default `4000`)
- `JWT_SECRET` (required — app throws at first sign/verify without it)

**Scripts:** `dev` (`tsx watch`), `build` (`tsc`), `start` (`node dist/index.js`).

### 3.2 Data model

Every model uses Mongoose `timestamps: true`.

**`Admin`** (`models/Admin.ts`)
```
adminId       String, unique, formatted AD001, AD002… via Counter
name          String, required, trimmed
gender        enum "male"|"female"|"other"
dob           Date
mobile        String, unique, trimmed
email         String, unique, trimmed, lowercased
otp           String | null       (4-digit)
otpExpiresAt  Date | null         (now + 5min)
```

**`College`** (`models/College.ts`)
```
admin         ObjectId → Admin, required, indexed
name, address, code   Strings (code uppercased)
busCount, driverCount Numbers (planned counts)
Unique (admin, code)
```

**`Counter`** (`models/Counter.ts`)
Atomic auto-increment: `{ _id: seqName, seq: Number }`. Helper `nextSequence(name)` uses `findByIdAndUpdate($inc, upsert)` — race-safe.

**`Bus`** (`models/Bus.ts`)
```
college       ObjectId → College, required, indexed
busNumber     String, required (unique per (college, busNumber))
plateNumber   String, unique globally, uppercased
capacity      Number ≥ 1
driver        ObjectId → Driver, nullable — PARTIAL unique index enforcing
              one-driver-per-bus (only when driver is ObjectId)
route         String (free text — no schema)
stops         [ { name, lat|null, lng|null, suspended: Boolean } ]  — embedded
notice        String (disruption banner shown to students + drivers)
```

Stops embedded — `name` is the stable key `Student.stop` references. Suspended stops stay on the route; only removed stops trigger the cascade below.

**`Driver`** (`models/Driver.ts`)
```
college         ObjectId → College, indexed
name, dob, gender, address    standard
licenceNumber   String, unique, uppercased
aadharNumber    String, unique, regex /^\d{12}$/
mobile          String, unique
otp/otpExpiresAt
tripActive      Boolean, default false
currentLocation { lat, lng, updatedAt } | null       — NOT cleared on trip stop
```

**`Student`** (`models/Student.ts`)
```
college       ObjectId → College, indexed
name, rollNumber, gender, dob, address, mobile
bus           ObjectId → Bus | null, indexed
stop          String | null (must match one of bus.stops[].name)
otp/otpExpiresAt
Unique (college, rollNumber)
```

**Relationship shape:** Admin 1–N College 1–N {Bus, Driver, Student}; Bus 1–1 Driver (nullable); Student N–1 Bus (nullable); `Student.stop` references `Bus.stops[].name`.

### 3.3 Authentication (three parallel OTP flows)

Each role uses the same pattern:
- `POST /request-otp { mobile }` → generates 4-digit OTP, stores + 5min expiry, `console.log`s it (dev shortcut)
- `POST /verify-otp { mobile, otp }` → validates, clears OTP fields, returns `{ token, <role-record> }`

Role-specific JWT payloads:
- **Admin:** `{ adminId, sub }` (no `role` claim — presence of `adminId` implies admin)
- **Driver:** `{ role: "driver", sub }`
- **Student:** `{ role: "student", sub }`

All tokens are 7-day TTL, signed with `JWT_SECRET`.

**Middleware:**
- `middleware/auth.ts` `requireAuth` — admin-only (checks `sub` valid ObjectId).
- Local `requireDriver` inside `driverTrip.ts` — checks `role === "driver"`.
- Local `requireStudent` inside `studentAuth.ts` — checks `role === "student"`.
- **No middleware on `/api/colleges/:collegeId/{buses,drivers,students}`** — known gap; see 3.6.

### 3.4 Full endpoint map

**Admin auth (`/api/auth`)**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | public | creates `Admin`; adminId via Counter |
| POST | `/request-otp` | public | |
| POST | `/verify-otp` | public | issues admin JWT |
| PUT | `/me` | admin | all 5 fields required; mobile/email unique excluding self |

**Driver auth (`/api/driver-auth`)** — request-otp, verify-otp only.

**Student auth (`/api/student-auth`)**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/request-otp` | public | |
| POST | `/verify-otp` | public | returns `{ token, student }` with populated bus |
| GET | `/me` | student | returns own record with populated bus |
| GET | `/bus-location` | student | `{ bus, tripActive, currentLocation }` — student's own bus |
| GET | `/live-buses` | student | **New.** All buses in the student's college whose driver is `tripActive` — same shape as admin `/buses/live` but stripped of mobile/licenceNumber |

**Driver trip (`/api/driver/trip`, all `requireDriver`)**
| Method | Path | Notes |
|---|---|---|
| GET | `/status` | returns assigned bus (if any) + `tripActive` + `currentLocation` |
| POST | `/start` | flips `tripActive: true` |
| POST | `/stop` | flips `tripActive: false` — leaves `currentLocation` intact |
| POST | `/location` `{lat, lng}` | writes `currentLocation` **only if `tripActive`** |

**Colleges (`/api/colleges`, `requireAuth`)**
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list; also returns `actualBusCount / actualDriverCount / actualStudentCount` from parallel `countDocuments` |
| POST | `/` | create |
| PUT | `/:collegeId` | update |
| POST | `/claim-orphans` | claims colleges with null `admin` — race-prone (no lock) |

**College sub-routes (unauthenticated — see 3.6)**

`/api/colleges/:collegeId/buses`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list buses, driver populated |
| GET | `/live` | **New.** All buses whose driver is `tripActive` — returns `[{ bus, driver }]` with location |
| POST | `/` | single create |
| POST | `/bulk` | up to 500 rows, per-row `{ created, failed }` |
| POST | `/driver-assignments` | bulk pair; clears prior bus if reassigning |
| PUT | `/:busId/route` `{route, stops, notice?}` | normalizes stops (string→object, dedup by name), **cascades `Student.stop = null` only for REMOVED stops (suspended stops preserve assignments)** |
| PUT | `/:busId/driver` `{driverId}` | assign/unassign; handles 11000 → "already assigned to another bus" |

`/api/colleges/:collegeId/drivers` — GET, POST, PUT `/:id`, POST `/bulk` (500 cap).

`/api/colleges/:collegeId/students`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | with populated bus |
| POST | `/` | optional busId+stop; capacity check + stop-must-be-on-route |
| PUT | `/:studentId` | full update; re-validates capacity and stop |
| POST | `/bulk` | 500 cap |
| POST | `/bus-assignments` | 1000 cap; caches bus lookups per call |
| PUT | `/:studentId/bus` `{busId, stop?}` | capacity check excludes self; `null`/`""` unassigns |

### 3.5 Business rules worth remembering

- **Uniqueness constraints:** admin.mobile, admin.email; driver.licenceNumber, driver.aadharNumber, driver.mobile; student.mobile; `(college, rollNumber)`; `(college, busNumber)`; plateNumber; the partial `(driver, when ObjectId)` on Bus.
- **Stop validity:** `hasStop(bus, name)` = "name exists in `bus.stops[]`". Suspended stops still count valid. Only stop *removal* nulls out affected `Student.stop`.
- **Capacity:** `StudentModel.countDocuments({ bus })` compared to `bus.capacity`. When editing an existing student, capacity math excludes them (`{ _id: { $ne: studentId } }`).
- **Bulk endpoints are partial-success by design:** each returns `{ created/applied, failed }`. Row-level errors are per-row (`{ row, ...identifiers, error }`). No transactions.
- **`Counter.nextSequence(name)`** is the atomic auto-increment (used for `adminId` = `AD001`).

### 3.6 Known quirks + fragility

- **`/api/colleges/:collegeId/*` sub-routes are NOT auth-checked.** Anyone with a `collegeId` can read/write buses/drivers/students. Deliberate for now, needs `requireAdmin` before production.
- **OTPs `console.log`-ed** in `auth.ts`, `driverAuth.ts`, `studentAuth.ts` (`[ROLE OTP] name mobile -> otp`). No SMS gateway.
- **No rate limiting** on `/request-otp`.
- **`Driver.currentLocation` is not cleared on trip stop** — last position lingers. Intentional (students see "last seen here") but easy to forget.
- **Location updates rejected unless `tripActive: true`** — the write-side gate lives in `POST /trip/location`.
- **Reassigning a driver requires clearing the old bus first** to satisfy the partial unique index; `PUT /buses/:id/driver` and `POST /driver-assignments` do this. Don't break it in new code paths.
- **`orphan claim` race** — `POST /claim-orphans` doesn't lock, so two admins could grab the same college.
- **No soft deletes.** Nothing is ever removed; data accumulates.

---

## 4. Website (`bus/bus-website`)

### 4.1 Tech + bootstrap

Next.js 16.2.6 + React 19.2.4 + TypeScript, App Router, Turbopack. Pure CSS design system (no Tailwind). Leaflet 1.9.4 for maps, `xlsx` for bulk upload parsing.

`app/layout.tsx` → `<Providers>` (client) → `<AuthProvider>` → `<CollegeProvider>` → children.

`app/page.tsx` is a redirector: `useAuth()` → `/login` or `/dashboard`.

All admin pages live under `app/(admin)/` whose `layout.tsx` wraps them in `<AdminShell>` (sidebar + topbar + logout-confirm modal + `!token → /login` guard).

### 4.2 Auth flow

- `components/OtpLoginForm.tsx` — 2-step: mobile → 4-digit OTP with animated boxes.
- `lib/auth/tokenStore.ts` — localStorage keys `bus.authToken`, `bus.authSession`. An in-memory `currentToken` variable is what `apiFetch` actually reads (avoids threading token through every call).
- `lib/auth/AuthContext.tsx` — exposes `register`, `requestOtp`, `verifyOtp`, `updateAdmin`, `logout`. On mount reads persisted state then flips `ready: true`.
- Logout is gated by a confirmation modal in `AdminShell.tsx:222`.

### 4.3 API layer

`lib/api/client.ts`:
```
apiFetch<T>(path, init) →
  fetch(baseUrl + path, { headers: JSON + Bearer if token, ...init })
  non-2xx → try extract body.error → throw ApiError(status, message)
  204 → undefined
```
- `baseUrl` from `NEXT_PUBLIC_API_URL` (defaults `http://localhost:4000`).

Per-resource modules mirror the backend: `auth`, `colleges`, `collegeBuses`, `collegeDrivers`, `collegeStudents`. Recent adds:
- `collegeBusesApi.live(collegeId)` → `LiveBusItem[]` (used by `/track-drivers`).

### 4.4 Global state

- **`AuthContext`** — `{ ready, token, session: { role: "admin", admin } }`.
- **`CollegeContext`** — `{ colleges, selected, selectedId, loading, error, refresh, selectCollege }`. Selected ID persists in localStorage `bus.selectedCollegeId`. Auto-fetches when token changes.
- No request cache. Every page fetches on mount.

### 4.5 Routes / pages

| Route | Purpose |
|---|---|
| `/login`, `/register`, `/payment` | Public OTP flow (payment is a stub) |
| `/dashboard` | Greeting + 4 stat tiles + 7 quick-action tiles (**Track drivers** prepended to grid) |
| `/colleges`, `/colleges/new`, `/colleges/[id]/edit` | CRUD + "Recover legacy" (`claimOrphans`) |
| `/buses`, `/buses/new`, `/buses/bulk` | List, create, bulk XLSX |
| `/buses/[busId]` | Detail: driver chips, route summary, students table |
| `/buses/[busId]/route` | Route editor: form + Leaflet map + stops list. Save calls `setRoute`. **"Import from Excel" button** links to bulk-route page |
| `/buses/[busId]/route/bulk` | **New.** XLSX import of a single bus's route (stopName, lat, lng, suspended) |
| `/drivers`, `/drivers/new`, `/drivers/[driverId]/edit`, `/drivers/bulk` | Driver CRUD |
| `/students`, `/students/new`, `/students/[studentId]/edit`, `/students/bulk` | Student CRUD |
| `/assign-drivers`, `/assign-drivers/bulk` | Per-bus dropdowns; disables already-assigned drivers |
| `/assign-students`, `/assign-students/bulk` | Per-student bus+stop; live occupancy hints |
| `/track-drivers` | **New.** Live map + list of every driver whose trip is active; polls every 8s |
| `/profile` | **Redesigned.** Two-column identity + form with dirty tracking, sticky action bar, auto-dismissing success |

### 4.6 Key components

**`StopMap.tsx`** — Leaflet map for the route editor. Two effects:
1. Init once (OSM tiles, click handler, layerGroup). Callbacks kept fresh via refs so the persistent click handler never goes stale.
2. Redraw markers + polyline on every `[stops, selectedIndex]` change. Fit-to-bounds only once (guarded by `fittedRef`).

**`DriverTrackingMap.tsx`** — Leaflet map for `/track-drivers`. Different pattern from StopMap:
- Reuses markers across polls via a `Map<busId, L.Marker>` (setLatLng + setIcon, no destroy/recreate). Smooth visually.
- Pulse-halo divIcon, bus number etched on the pin.
- `followAll` prop refits bounds every update; auto-off when the admin selects a specific bus.

**`AdminShell.tsx`** — the app shell. Sidebar (brand, quick-create, main nav, college selector) + topbar (title, date, logout, admin avatar link to `/profile`) + logout confirm modal.

### 4.7 Design system

Custom CSS in `app/globals.css`. Palette: warm cream (`--bg-page: #ebe4d5`), coral accent (`--accent: #ff8a5b`). Utility classes:
- `.card`, `.field`, `.field-control`, `.field-label`, `.form-grid`
- `.chip`, `.chip-active`, `.chip-row`
- `.pill`, `.pill-plain`, `.pill-accent`, `.pill-success`, `.pill-warning`, `.pill-danger`
- `.alert`, `.alert-error`, `.alert-success`, `.alert-warning`, `.alert-info`
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-quiet`, `.btn-danger`
- `.page-header`, `.page-header-info`, `.page-title`, `.page-subtitle`, `.page-actions`
- `.stat-grid`, `.stat-tile`, `.stat-tile-{yellow,purple,pink,blue}`
- `.action-grid`, `.action-tile`, `.action-tile-icon`, `.action-tile-body`
- `.dropzone`, `.otp-row`, `.otp-box`, `.modal-overlay`, `.modal`, `.spinner`

Icons: inline SVG in `components/icons.tsx` (Lucide-style, 18px stroke 2). Available: Dashboard, Building, Bus, Badge, Users, Logout, Plus, Search, ArrowLeft, ArrowUp, ArrowDown, Check, Map, Route, Upload, Download, FileSpreadsheet, X.

### 4.8 XLSX bulk-upload pattern

Reused across `/buses/bulk`, `/drivers/bulk`, `/students/bulk`, both assign-bulk pages, and the new `/buses/[busId]/route/bulk`. Same shape everywhere:

1. Dropzone → `parseFile()`.
2. `XLSX.read(arrayBuffer)` → first sheet → `sheet_to_json`.
3. Header normalization: lowercase + trim, match against `HEADER_ALIASES` (case-insensitive; e.g. `"Bus No"` → `busNumber`). First-occurrence wins.
4. Per-row `ParsedRow` with `error: string | null`.
5. Preview table with per-row status pill.
6. Submit valid rows (invalid skipped silently). Server returns `{ created/applied, failed }`, rendered as a two-column result.
7. Template download uses `XLSX.utils.json_to_sheet + writeFile`.

---

## 5. Mobile (`bus/mobile`)

### 5.1 Tech + bootstrap

- Expo SDK ~54, React Native 0.81, React 19, TypeScript strict.
- Navigation: `@react-navigation/native` + native-stack. Tabs are hand-rolled inside dashboards (no tabs library).
- Maps: `react-native-maps` with `PROVIDER_GOOGLE` on both platforms. API key in `app.json` (hardcoded — restrict by SHA-1 + bundle ID in Google Cloud console).
- Location: `expo-location` (foreground only — no `expo-task-manager`).
- Storage: `expo-secure-store` for token, session, and theme.

`index.ts` → `registerRootComponent(App)`.

`App.tsx`:
```
SafeAreaProvider
  └─ ThemeProvider
      └─ AuthProvider
          └─ ThemedRoot (StatusBar + RootNavigator)
```

Order matters: AuthProvider does async SecureStore reads on mount; ThemedRoot's `useTheme()` requires ThemeProvider above.

### 5.2 Theme (`src/theme/ThemeContext.tsx`)

- `mode: "light" | "dark"`, persisted at `bus.theme`.
- Two palette constants (`LIGHT`, `DARK`), ~17 tokens each. Accent (`#f5b700`) is the same in both — it's the brand.
- Every screen does `const styles = useMemo(() => makeStyles(colors), [colors])`. Live switching without remount.

### 5.3 Auth (`src/auth/`)

`AuthContext.tsx` exposes a discriminated union session:
```ts
type Session =
  | { role: "admin";   admin:   Admin   }
  | { role: "driver";  driver:  Driver  }
  | { role: "student"; student: Student };
```

Methods: `register`, `adminRequest/VerifyOtp`, `driverRequest/VerifyOtp`, `studentRequest/VerifyOtp`, `updateAdmin`, `refreshSession` (student-only — no-ops for other roles; refetches student on focus), `logout`.

**Token in two places:**
- Disk: SecureStore `bus.authToken` + `bus.authSession`.
- Memory: `src/auth/tokenStore.ts` module variable, so `apiFetch` (`src/api/client.ts`) can inject `Authorization: Bearer …` without threading the token.

`OtpLoginForm.tsx` — reusable; `LoginScreen` passes role-specific `requestOtp`/`verifyOtp` handlers as props.

### 5.4 API layer (`src/api/`)

`client.ts` — same shape as the website's: baseUrl from `EXPO_PUBLIC_API_URL` (defaults `http://localhost:4000`; `.env` sets `http://192.168.1.19:4000`); Bearer from `tokenStore`; typed `ApiError`.

Per-resource modules:
- `auth.ts` — admin register/OTP/updateMe
- `driverAuth.ts` — driver OTP
- `studentAuth.ts` — student OTP, `me`, `busLocation`, `liveBuses` (**new**)
- `driverTrip.ts` — `status`, `start`, `stop`, `sendLocation(lat, lng)`
- `colleges.ts` — CRUD + `claimOrphans`
- `collegeBuses.ts` — list, create, `assignDriver`, `setRoute` (**subset of the website's — no bulk here**)
- `collegeDrivers.ts` — list, create, update
- `collegeStudents.ts` — list, create, update, `assignBus`

### 5.5 Navigation (`src/navigation/`)

`RootNavigator.tsx` swaps the whole stack based on `session.role`:
```
!ready                           → <ActivityIndicator />
!token || !session               → AuthStack:    Login, Register, Payment
session.role === "admin"         → CollegeProvider + AppStack (~15 CRUD screens)
session.role === "driver"        → DriverStack:  DriverDashboard
session.role === "student"       → StudentStack: StudentDashboard, TrackOtherBuses, TrackOtherBusMap
```

Role switch is a clean reset — no back-navigation across roles.

`types.ts` — every stack's `ParamList` typed. Notable:
- `AppStack.SetBusRoute: { collegeId, bus: Bus }` — the bus is passed as a param, not fetched.
- `StudentStack.TrackOtherBusMap: { busId, busNumber }`.

### 5.6 Screens

**Auth (logged-out)**
- **`LoginScreen`** — role cards → `OtpLoginForm` with role-bound handlers.
- **`RegisterScreen`** — admin signup form; passes data forward to `PaymentScreen`.
- **`PaymentScreen`** — stub $90 activation. Calls `authApi.register()` only on "pay".

**Admin (AppStack)**
- **`MainScreen`** — dashboard + profile in two hand-rolled tabs. Home: greeting, stats, 8-button action grid. Profile: dark mode toggle, college list with active badge, recover-legacy, logout.
- Straight-CRUD forms/lists for colleges, buses, drivers, students; assign-drivers and assign-students flows.
- All list screens refetch on `useFocusEffect` — returning from an edit reflects changes.

**Driver — `DriverDashboardScreen.tsx`**

Home tab flow:
1. `driverTripApi.status()` on mount populates bus + `tripActive` + `currentLocation`.
2. **Start Trip:** `Location.requestForegroundPermissionsAsync` → `driverTripApi.start()` → `getCurrentPositionAsync` → first `/trip/location` POST (non-fatal on failure) → `watchPositionAsync({ accuracy: High, timeInterval: 5000, distanceInterval: 10 })`.
3. Each callback POSTs `{lat, lng}`. `sendingRef` prevents overlapping requests.
4. **Stop Trip** removes the watcher and POSTs `/trip/stop`.

**Foreground only** — no background tracking. If the phone locks or a call arrives, the watcher pauses.

Profile tab (**redesigned**): 88 px avatar hero, `[Driver] [Licence …]` pills, sections *Personal details*, *Documents* (Aadhar masked to last 4: `•••• •••• 1234`), *Contact*, *Appearance*, outlined Sign out button.

**Student — `StudentDashboardScreen.tsx`**

Home tab: bus card, notice, **Track other bus** card (new), live map, "Your Stop" (with suspended-stop nearest-alternative suggestion via Haversine), All Stops list.

- Polls `studentAuthApi.busLocation()` every 5s.
- Bus marker only rendered when `tripActive && currentLocation`.
- Smooth marker animation: interpolates old → new coords over ~1s with cubic easing via `requestAnimationFrame`; camera follows with `animateToRegion`.
- **`refreshSession()`** on focus so newly assigned bus appears without restart.

Nearest-open-stop helper (`nearestActiveStop`): only triggers if the student's own stop is suspended; Haversine when both coords available, else fallback to next stop in route order.

Profile tab (**redesigned**): identical layout family to the driver's. Includes a "Your bus" section when assigned (bus + boarding stop). No Aadhar (students don't have one on the schema).

**Student — `TrackOtherBusesScreen.tsx` (new)**

- Lists live buses via `studentAuthApi.liveBuses()`.
- Polls every 5s; pull-to-refresh.
- Rows: bus number, driver name, route, "Live"/"No fix" pill, updated-seconds-ago.
- Tap a row → navigate to `TrackOtherBusMap`.

**Student — `TrackOtherBusMapScreen.tsx` (new)**

- Google Map (`PROVIDER_GOOGLE`) with route polyline, stop markers (gray = suspended), animated `🚌` marker with halo.
- Auto-pans camera on every location update via `animateToRegion` (800 ms transition — no interpolation, kept simple).
- "Live · updated Xs ago" banner at the top; notice card at bottom.
- If the driver stops the trip mid-view: switches to a "This trip just ended" screen with a Back button.

### 5.7 Location tracking end-to-end

```
Driver phone                          Backend                        Student / Admin
─────────────────────────────────────────────────────────────────────────────────
Start Trip     ─── /trip/start ────→  Driver.tripActive = true
GPS 5s / 10m   ─── /trip/location ─→  Driver.currentLocation
                                                                    ─── /bus-location or /live-buses
                                                                    ← polls every 5–8s → marker moves
Stop Trip      ─── /trip/stop ─────→  Driver.tripActive = false
                                     (currentLocation kept as-is)
```

**Client polling intervals:**
- Website `/track-drivers`: 8s
- Mobile student dashboard (own bus): 5s
- Mobile "Track other bus" list + map: 5s each

**Driver client push:** on the earlier of 5s elapsed **or** 10m moved.

### 5.8 Environment

`.env` (mobile): `EXPO_PUBLIC_API_URL=http://192.168.1.19:4000` — must be a network-reachable host from the phone. `localhost` won't work on a real device.

`app.json`:
- `expo.name` = "Bus", `expo.slug` = "bus"
- Android package: `com.anonymous.bus` (Expo default)
- iOS bundleIdentifier: unset (uses slug)
- Google Maps API key on both platforms (`AIzaSy…kfrs`) — hardcoded, restrict in Cloud Console
- Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- Plugins: `expo-asset`, `expo-secure-store`, `expo-location` (with `WhenInUse` permission text), `@react-native-community/datetimepicker`

### 5.9 Fragility on mobile

- **JWT has no refresh path.** 7-day TTL, expires silently → next call 401s → user stuck until manual logout + relogin.
- **Foreground-only location** — driver phone lock = frozen bus for students.
- **Student polling silently swallows errors** — outage looks identical to "bus is idle". The "updated Xs ago" label is the only staleness indicator.
- **Google Maps API key exposed in `app.json`.** Restrict by SHA-1 + bundle ID.
- **OTPs via server console** — mobile OTP form literally tells the user "check the API server terminal".
- **No list pagination.** ViewBusesScreen and friends fetch the entire college.

---

## 6. Cross-cutting patterns

### 6.1 Multi-role architecture

- The **API** treats admin, driver, and student as separate JWT identities, each with its own auth router. There's zero cross-role permission logic — the middleware just checks the `role` claim.
- The **mobile app** is one binary that swaps stacks based on role.
- The **website** is admin-only. Drivers and students don't have a web UI at all.

### 6.2 Real-time tracking pattern

There are two live-tracking surfaces, both powered by the same server-side aggregation:

1. **Admin (website `/track-drivers`)** — `GET /api/colleges/:collegeId/buses/live`
2. **Student (mobile `Track other bus`)** — `GET /api/student-auth/live-buses`

The endpoint pattern:
```
DriverModel.find({ college, tripActive: true }).select("name currentLocation …").lean()
  → collect ids
BusModel.find({ college, driver: { $in: ids } }).select("busNumber plateNumber route stops notice driver").lean()
  → Map<driverId, driver>
Return [{ bus, driver }]
```

Student endpoint scopes college from the JWT; admin endpoint accepts collegeId in the path.

### 6.3 XLSX bulk upload

- Website has bulk import for: buses, drivers, students, driver→bus assignments, student→bus assignments, and **per-bus route stops** (new).
- Same client-side pattern everywhere: header aliases + first-occurrence-wins + per-row validation + preview + submit valid rows + `{ created/applied, failed }` result.
- Backend caps: 500 rows for most, 1000 for `students/bus-assignments`.
- No transactions — partial success is the design.

### 6.4 Notification triggers (currently not wired)

FCM integration was built once and reverted. If it comes back, the natural triggers are already known:
- Trip start/stop → all students on that bus
- Bus notice changed → all students on that bus
- Stop suspended/resumed/removed → students of that stop only
- Student bus assignment changed → that student only

None of these ship today.

### 6.5 Recent additions (chronological)

1. **Route disruption & stop suspension** (pre-existing before this reference).
2. **Track drivers** page on the website — `/track-drivers` + `DriverTrackingMap` + `/buses/live` backend.
3. **Bulk route upload** — `/buses/[busId]/route/bulk` + `Import from Excel` button on the route editor.
4. **Track other bus** on mobile student — list + map screens + `/student-auth/live-buses` backend.
5. **Profile redesign** — website `/profile` + mobile student & driver profile tabs. Big hero avatars, sectioned info rows, dedicated Sign out button, Aadhar masked to last 4.

---

## 7. Auto-memory

Two files under `~/.claude/projects/…/memory/` persist across sessions:
- `project_overview.md` — the monorepo layout summary.
- `api_quirks.md` — the seven backend surprises (un-auth'd sub-routes, console OTPs, partial unique driver index, stop suspension semantics, no bulk transactions, atomic Counter, `currentLocation` not cleared on stop, tripActive-gated location writes).

If you tell me to forget something, it's these files I'll edit.

---

## 8. Blind spots

Files I know via the Explore agent but haven't read line-by-line:
- The mobile admin CRUD screens (`AddCollege`, `EditCollege`, `EditAdmin`, `AddBuses`, `ViewBuses`, `BusDetail`, `SetBusRoute` on mobile, all Driver/Student equivalents, `AssignDriversToBus`, `AssignStudentsToBus`, `SelectDriverForBus`, `SelectStudentsForBus`, `RegisterScreen`, `PaymentScreen`).
- `bus/mobile/android/` native Java/Kotlin files beyond the package-name rename.
- `bus/mobile/assets/` images.
- `bus/docs/route-disruption-scenario.md` — never opened.

Everything else in this document I have read directly.

---

## 9. Quick reference

**Local run (all three):**
```bash
# backend
cd bus/api && npm install && npm run dev            # → http://localhost:4000

# website
cd bus/bus-website && npm install && npm run dev    # → http://localhost:3000

# mobile
cd bus/mobile && npm install && npm start           # scan QR with Expo Go
```

**Test a live-tracking loop end-to-end:**
```bash
# start a driver's trip
curl -X POST http://localhost:4000/api/driver/trip/start \
     -H "Authorization: Bearer $DRIVER_TOKEN"

# push a coordinate
curl -X POST http://localhost:4000/api/driver/trip/location \
     -H "Authorization: Bearer $DRIVER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"lat":13.0827,"lng":80.2707}'

# stop
curl -X POST http://localhost:4000/api/driver/trip/stop \
     -H "Authorization: Bearer $DRIVER_TOKEN"
```

Admin sees this on `/track-drivers`; assigned student sees it on the mobile dashboard; any other student sees it via **Track other bus**.
