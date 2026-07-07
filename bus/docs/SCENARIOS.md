# College Bus Tracking — Scenario Coverage

A single document listing every user scenario the system handles today (positive) and every failure mode / edge case (negative), with status markers you can use for QA, testing, and hardening decisions.

**Companion doc:** `PROJECT_REFERENCE.md` — for architecture, data model, and endpoint map.

**Status legend:**
- ✅ handled cleanly, works as intended
- ⚠️ partial: works but has subtle behaviour worth understanding
- ❌ not handled: gap that could affect real users
- 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM — severity when unhandled

---

# Part I — Positive scenarios (happy paths)

Everything below is implemented end-to-end and works today.

## 1. Admin

### 1.1 Onboarding & account

| Scenario | Where |
|---|---|
| Sign up as admin (name, gender, DOB, mobile, email) | Website `/register` + `/payment`; mobile `RegisterScreen` + `PaymentScreen` |
| Get an auto-generated admin ID (`AD001`, `AD002`…) | Server via `Counter.nextSequence("adminId")` — race-safe |
| Log in with OTP (4-digit, 5-min TTL) | Website `/login`, mobile `LoginScreen` |
| Stay logged in across reloads / app restarts | localStorage (web) + SecureStore (mobile) |
| Edit own profile with dirty-state tracking + Discard + auto-dismissing success | Website `/profile` (redesigned) |
| Logout with confirmation | Website AdminShell modal (Escape to cancel); mobile Alert confirm |

### 1.2 College management

| Scenario | Where |
|---|---|
| Create college (name, code, address, planned counts) | Website `/colleges/new`, mobile `AddCollegeScreen` |
| Edit college | Website `/colleges/[id]/edit`, mobile `EditCollegeScreen` |
| Manage many colleges under one admin | Sidebar / profile-tab college selector; persists in `bus.selectedCollegeId` |
| See actual counts, not stored counts | Dashboard runs parallel `countDocuments` → `actualBusCount / actualDriverCount / actualStudentCount` |
| Recover legacy colleges (no admin set) | `POST /claim-orphans` — "Recover legacy" button |

### 1.3 Fleet — buses

| Scenario | Where |
|---|---|
| Add a bus (busNumber, plate, capacity) | Website `/buses/new`, mobile `AddBusesScreen` |
| Bulk import buses via Excel/CSV | Website `/buses/bulk` — dropzone + per-row status + result panel |
| Download Excel template | Every bulk page |
| View bus detail (driver + route + students) | Website `/buses/[busId]`, mobile `BusDetailScreen` |
| Reassign a driver already on another bus | Server clears the old bus's `driver` first (satisfies partial unique index) |
| Unassign a driver | Chip row / bulk empty-driver rows |

### 1.4 Routes

| Scenario | Where |
|---|---|
| Type a free-text route name | `/buses/[busId]/route` |
| Add stops by name, dedup'd by name | Enter or Add button |
| Click Leaflet map to drop a pin for the selected stop | `StopMap.tsx` → `placeSelected` |
| Drag markers to adjust lat/lng | Marker `dragend` → `onMove` — coords rounded to 6 decimals |
| Reorder stops (↑↓) | `moveStop` |
| Suspend a stop (assignments preserved) | `toggleSuspend` |
| Resume a suspended stop | Same toggle |
| Remove a stop — affected students automatically unassigned | Cascade in `PUT /buses/:busId/route` |
| Post a disruption notice (banner shown to students + drivers) | Notice field on route editor |
| **Bulk import a whole route from Excel** | `/buses/[busId]/route/bulk` — stopName, lat, lng, suspended |

### 1.5 Drivers & students

| Scenario | Where |
|---|---|
| Create driver (unique licence + Aadhar regex + mobile) | Website `/drivers/new`, mobile `AddDriversScreen` |
| Bulk import drivers | Website `/drivers/bulk` (500 cap) |
| Create student, optionally assign bus + stop in one shot | Both platforms |
| Bulk import students | 500 cap; bus assignment is a separate step |
| Assign each student to a bus + stop with capacity enforcement | Website `/assign-students` with live occupancy hints |
| Bulk student → bus assignments | Website `/assign-students/bulk` (1000 cap) |
| Reassign a student to a different bus | Capacity math excludes the student's current row |
| Stop-must-be-on-route validation | `hasStop(bus, name)` server-side + client dropdown |
| Unassign a student | Sending `busId: null` or empty |

### 1.6 Live fleet visibility

| Scenario | Where |
|---|---|
| See every driver whose trip is currently active | Website `/track-drivers` — polls 8 s |
| Live map, pulsing marker per active bus | `DriverTrackingMap.tsx` — markers reused across polls, no rebuild |
| "Follow all" auto-fits map bounds | Toggle in header |
| Click marker/row to focus one bus — auto-turns off follow | Sync via `selectedId` |
| Last-fix age updates every second locally | `Ago` component tick |
| "No fix" state — trip started but no coord yet | Server includes them; map skips |

## 2. Driver (mobile only)

| Scenario | Where |
|---|---|
| Log in with OTP | mobile `LoginScreen(role: driver)` |
| See own assigned bus (number, plate, route, stops, notice) | `DriverDashboardScreen` on mount |
| Grant foreground location permission | `Location.requestForegroundPermissionsAsync()` |
| Start Trip → `tripActive: true` | `driverTripApi.start()` |
| Instant first location push | `getCurrentPositionAsync` + POST `/trip/location` |
| Continuous location stream every 5 s / 10 m | `watchPositionAsync({ accuracy: High, timeInterval: 5000, distanceInterval: 10 })` |
| Never send overlapping POSTs on a slow network | `sendingRef` gate |
| Recover from transient network failures without stopping the tracker | try/catch around each POST |
| Stop Trip → watcher removed, `tripActive: false` | `driverTripApi.stop()` |
| See own details + licence + Aadhar (masked `•••• •••• 1234`) | Redesigned Profile tab |
| Toggle dark mode | Persisted in SecureStore `bus.theme` |
| Sign out | Outlined danger button + Alert confirm |

## 3. Student (mobile only)

### 3.1 "Where is my bus?"

| Scenario | Where |
|---|---|
| Log in with OTP | mobile `LoginScreen(role: student)` |
| See assigned bus, route, all stops, notice | `StudentDashboardScreen` Home tab |
| Bus location updates every 5 s | Polling `studentAuthApi.busLocation()` |
| Smooth marker animation (no teleport) | `requestAnimationFrame` interpolation, cubic easing over ~1 s |
| Camera follows the bus | `mapRef.current.animateToRegion` |
| Manual recentre pill | 🚌 button top-right |
| Live/Idle/Waiting status banner | Overlay on the map |
| Route notice from admin | Yellow notice card |
| See own boarding stop | "Your Stop" card |
| **Suspended stop → nearest-open-stop suggestion** | Haversine if coords present; else next-in-route fallback |
| All stops with numbers + suspended state | "All Stops" section |
| Newly assigned bus appears without app restart | `useFocusEffect` → `refreshSession()` |

### 3.2 Track other bus

| Scenario | Where |
|---|---|
| From Home, tap **Track other bus** card | Just under the bus card |
| See list of every currently-on-trip bus in the college | `TrackOtherBusesScreen` |
| Pull-to-refresh + 5 s auto-polling | `RefreshControl` + `setInterval` |
| Tap any bus → live map | `TrackOtherBusMap` |
| Route polyline + stop markers + moving bus marker | Google Maps `PROVIDER_GOOGLE` |
| **Driver ends trip mid-view → friendly "Trip ended" screen with Back** | Server drops item on next poll |
| "No fix" for a driver who started but has no coord yet | Pill in list; skipped on map |

### 3.3 Profile

| Scenario | Where |
|---|---|
| Own details (name, roll, mobile, address) | Redesigned Profile tab |
| Own bus + boarding stop (when assigned) | "Your bus" section |
| Toggle dark mode | Same persistence as driver |
| Sign out | Outlined danger button |

## 4. System-wide operational positives

| Scenario | Where enforced |
|---|---|
| Multi-tenant isolation (one admin's data hidden from others' colleges — for the routes that DO check auth) | `find` queries scoped by `collegeId` / token's `sub` |
| One driver per bus, atomic | Partial unique Mongoose index on `Bus.driver` |
| Global uniqueness | `plateNumber`, `licenceNumber`, `aadharNumber`, `driver.mobile`, `student.mobile`, `admin.mobile`, `admin.email` |
| Per-college uniqueness | `(college, busNumber)`, `(college, rollNumber)`, `(admin, code)` |
| Auto-generated admin IDs, race-free | `Counter.nextSequence()` via `findByIdAndUpdate($inc, upsert)` |
| Suspension is temporary — assignments survive | `hasStop()` treats suspended as valid targets |
| Removal cascades cleanly | `Student.updateMany({ bus, stop: { $nin: keptNames } }, { $set: { stop: null } })` |
| Capacity check on create AND reassign | `countDocuments` with `_id: { $ne: studentId }` |
| Bulk endpoints return actionable results | `{ created/applied, failed: [{ row, ..., error }] }` |
| Latest driver location is single source of truth | Every polling client re-fetches from `Driver.currentLocation` |
| Dark mode instant switching without remount | `useMemo(makeStyles(colors), [colors])` |
| Route data survives page reload / cold start | Everything persisted in Mongo |
| Session survives cold app start | SecureStore + localStorage + `ready` gate |

---

# Part II — Negative scenarios (failure modes & gaps)

## 5. Authentication & session

| # | Scenario | Status | What happens |
|---|---|---|---|
| 1 | Missing / malformed bearer header | ✅ | 401 "Missing bearer token" |
| 2 | Invalid or tampered JWT | ✅ | 401 "Invalid or expired token" |
| 3 | Wrong role token used on wrong endpoint | ✅ | 401 "Not a driver token" / etc. |
| 4 | `JWT_SECRET` missing at runtime | ✅ | Throws; caught by error handler |
| 5 | **JWT expired mid-session (7-day TTL)** | ❌ | Next call 401s. No auto-refresh. User must manually log out + relogin. Can strike a driver mid-trip. |
| 6 | **JWT stolen / needs revocation** | ❌ | Impossible until natural expiry. Stateless design has no revocation list. |
| 7 | User record deleted/renamed after token issued | ✅ | 404 on fetch (moot — no delete endpoint) |
| 8 | SecureStore / localStorage read fails on boot | ⚠️ | Treats as no session → back to login. No error UI. |
| 9 | Two browser tabs, logout in one | ⚠️ | Other tab keeps stale in-memory token; next action 401s |
| 10 | Duplicate session across devices | ✅ | Both work independently — stateless token |

## 6. OTP flow

| # | Scenario | Status | What happens |
|---|---|---|---|
| 11 | OTP requested for unknown mobile | ✅ | 404 "No X registered with this mobile" |
| 12 | Verify without a request | ✅ | 400 "Request an OTP first" |
| 13 | Wrong OTP | ✅ | 400 "Invalid OTP" |
| 14 | Expired OTP (>5 min) | ✅ | Fields cleared, 400 "OTP expired" |
| 15 | **OTP delivery — there is none** | ❌ 🟠 | `console.log`ed on server; real users can't receive it |
| 16 | **OTP brute-force on `/verify-otp`** | ❌ 🔴 | 4-digit code, 10 000 combos, no rate limit, no lockout |
| 17 | **OTP request spam on `/request-otp`** | ❌ 🔴 | No throttling; overwrites previous OTP; unlimited requests |
| 18 | **OTPs visible in server logs** | ❌ 🟠 | Log-shipping/crash reports leak login codes |
| 19 | No lockout after N failed attempts | ❌ 🟠 | Enables sustained brute force |

## 7. Input validation

| # | Scenario | Status | What happens |
|---|---|---|---|
| 20 | Required field missing | ✅ | 400 "field is required" |
| 21 | ObjectId param malformed | ✅ | 400 "Invalid id" |
| 22 | Gender not in enum | ✅ | 400 |
| 23 | Aadhar not 12 digits | ✅ | Mongoose regex → 400 |
| 24 | Capacity < 1 or non-numeric | ✅ | 400 "capacity must be ≥ 1" |
| 25 | Stop not on bus's route | ✅ | 400 "Stop is not on this bus's route" |
| 26 | Bus at capacity, new assignment | ✅ | 409 "Bus is full (N seats)" |
| 27 | **Mobile number in any format** ("wat", 3-digit, alphabetic) | ❌ 🟡 | Saved. Login impossible thereafter. |
| 28 | **Email not really an email** | ⚠️ | Client `type=email` catches obvious cases; backend accepts anything |
| 29 | **DOB in the future / year 1800** | ❌ 🟡 | Accepted as-is |
| 30 | **Free-text fields (route, notice, address) — no length cap** | ❌ 🟡 | Could DoS with megabyte payloads (up to Express default 100 KB body limit) |
| 31 | **License / bus number format** | ❌ 🟡 | Any string accepted |
| 32 | Duplicate mobile / email / plate / licence / aadhar | ✅ | Mongo 11000 → 409 |
| 33 | Bus assignment with empty busId | ✅ | Treated as unassign |

## 8. Data integrity & race conditions

| # | Scenario | Status | What happens |
|---|---|---|---|
| 34 | Two admins register with same mobile simultaneously | ✅ | Second → 409 |
| 35 | Reassign a driver already on another bus | ✅ | Handler clears old bus's `driver` first |
| 36 | **Two admins claim same orphan college via `/claim-orphans`** | ❌ 🟡 | `updateMany` non-atomic per doc → last-write-wins |
| 37 | **Concurrent `PUT /route` on same bus** | ❌ 🟡 | Last-write-wins. No `updatedAt` conflict detection |
| 38 | **Concurrent student→bus assignments squeeze past capacity** | ⚠️ | Rare over-capacity by ±1 in bursty writes |
| 39 | Cascade from stop removal → students unassigned | ✅ | `updateMany` with `$nin` |
| 40 | Suspending a stop does NOT clear assignments | ✅ | By design |
| 41 | **Bus reassigned mid-trip** — driver's `currentLocation` continues on the new bus | ⚠️ | Silent behaviour. Old bus's students suddenly see a different bus's location. |
| 42 | **Nothing is ever deleted** | ⚠️ | Prevents dangling refs (good) but data accumulates forever (bad) |
| 43 | Stop rename | ✅ | Not possible via UI |
| 44 | Bulk create with duplicate keys within the file | ✅ | Per-row error |

## 9. Live location tracking

| # | Scenario | Status | What happens |
|---|---|---|---|
| 45 | Driver denies location permission at Start Trip | ✅ | Alert shown, trip start bails |
| 46 | **Driver revokes permission mid-trip** | ⚠️ | `watchPositionAsync` starts failing silently on iOS; no re-grant prompt |
| 47 | **Driver backgrounds the app** | ❌ 🟠 | Foreground-only watcher pauses. Students see frozen bus, no warning. |
| 48 | **Driver phone loses network** | ⚠️ | POSTs throw + swallowed; watcher stays alive; when net returns only *current* sample sent — intermediate samples lost (no queue) |
| 49 | **Driver phone crashes / battery dies** | ❌ 🟠 | Server keeps `tripActive: true` + stale `currentLocation` forever. No heartbeat / auto-stop. |
| 50 | POST /location without `tripActive` | ✅ | 400 "Trip is not active" |
| 51 | POST /location with non-numeric coords | ✅ | 400 |
| 52 | POST /location while already sending | ✅ | `sendingRef` gate |
| 53 | Student polls with no assigned bus | ✅ | `{ bus: null, tripActive: false, currentLocation: null }` |
| 54 | Bus has no driver | ✅ | `tripActive: false`, `currentLocation: null` |
| 55 | **`Driver.currentLocation` never cleared on trip stop** | ⚠️ | Consumer must check `tripActive` first, else shows yesterday's position |
| 56 | **Student polling silently swallows errors** | ⚠️ | Outage looks identical to "bus is idle". Only clue: stale "updated Xs ago" |
| 57 | Track-drivers / track-other-bus polling silently swallows errors | ⚠️ | Same |
| 58 | Long-hung fetch never completes | ❌ 🟡 | `inFlightRef` blocks new fetches indefinitely — page appears frozen |
| 59 | Track-other-bus: driver stops trip while viewing map | ✅ | Detects missing item → "Trip ended" screen |
| 60 | Recentre button after manual pan | ✅ | Follow toggle / recentre pill in both UIs |

## 10. Bulk operations

| # | Scenario | Status | What happens |
|---|---|---|---|
| 61 | Row-level error (missing field, invalid data) | ✅ | `failed[]` with `{ row, ..., error }` |
| 62 | Row-level duplicate (Mongo 11000) | ✅ | Captured per row |
| 63 | Rows > cap (500 or 1000) | ✅ | 400 upfront |
| 64 | Non-array body | ✅ | 400 "must be an array" |
| 65 | Empty XLSX file | ✅ | "The first sheet is empty" |
| 66 | Malformed XLSX | ✅ | "Could not read the file: …" |
| 67 | Missing required column | ✅ | Detailed error listing found columns |
| 68 | **Alias collision — sheet has both "Bus" and "busNumber"** | ⚠️ | First-occurrence wins, second silently dropped |
| 69 | **Server crashes mid-loop during bulk import** | ❌ 🟡 | Earlier rows persisted; later lost. No transaction. |
| 70 | Duplicate stop names within a route XLSX | ✅ | Client: "duplicate stop name in file" |
| 71 | User navigates away during upload | ⚠️ | Server keeps processing; partial success sits in DB |

## 11. Multi-tenant / authorization

| # | Scenario | Status | What happens |
|---|---|---|---|
| 72 | Admin A calls `GET /api/colleges` | ✅ | Filtered by `{ admin: sub }` |
| 73 | **Admin A calls `PUT /api/colleges/:B_college_id`** | ⚠️ 🟠 | Route doesn't verify `admin: sub`. Any admin can edit any college whose id they know. |
| 74 | **`/api/colleges/:cid/{buses,drivers,students}` sub-routes UN-AUTHENTICATED** | ❌ 🔴 | Anyone with a `collegeId` can read + create + assign. Data leak + tamper vector. |
| 75 | Driver token on student endpoint | ✅ | 401 "Not a student token" |
| 76 | Student `/live-buses` — cross-college attempt | ✅ | Server derives college from `student.college`, not input |
| 77 | Admin's `PUT /me` targeting different admin | ✅ | Always modifies requester (sub) |
| 78 | Student sees another student's data | ✅ | No student-facing list endpoint |

## 12. Website UI edge cases

| # | Scenario | Status | What happens |
|---|---|---|---|
| 79 | **Route editor: navigate away with unsaved edits** | ❌ 🟡 | Silent loss. No `beforeunload` guard. |
| 80 | Profile: navigate away with unsaved edits | ❌ 🟡 | Same. Discard button available intentionally. |
| 81 | Bulk upload: close browser mid-import | ⚠️ | Server keeps going; partial state |
| 82 | Session expires while page is open | ⚠️ | Next mutation → error banner; no auto-redirect |
| 83 | **Track-drivers with 500 live buses** | ❌ 🟡 | 500 markers every 8 s; browser lag. No clustering. |
| 84 | Route editor with 100+ stops | ⚠️ | No pagination; scaling concern |
| 85 | Empty college (no buses/drivers/students) | ✅ | Dashboard zeros; `Math.max(count, 1)` guards divide-by-zero |
| 86 | Duplicate tabs, edit same college | ⚠️ | Last-write-wins; no cross-tab sync |
| 87 | Save on profile with no changes | ✅ | Save button disabled (dirty guard) |
| 88 | Very long email/name overflowing pill | ⚠️ | `word-break: break-all` on profile; other places may truncate awkwardly |
| 89 | Slow network hides in-flight state | ✅ | Spinners on submit buttons |

## 13. Mobile UI edge cases

| # | Scenario | Status | What happens |
|---|---|---|---|
| 90 | User rotates device | ✅ | RN + SafeAreaProvider handle it |
| 91 | **App language ≠ English** | ❌ 🟡 | No i18n. All strings hardcoded English. |
| 92 | Bus route with 30+ stops | ⚠️ | ScrollView, not FlatList — frame drops possible |
| 93 | User's system clock wrong (off by hours) | ⚠️ | "Xs ago" reads weird. `Math.max(0, ...)` prevents negatives. |
| 94 | Track-other-bus map with no coordinate yet | ✅ | "Waiting for driver's first location…" card |
| 95 | Student's bus unassigned while viewing dashboard | ⚠️ | Refresh clears map; no smooth transition |
| 96 | Location permission denied | ✅ | Alert shown |
| 97 | User has to go to Settings to grant location | ❌ 🟡 | No "Open Settings" deep link |
| 98 | Dark mode toggle spammed | ⚠️ | SecureStore races; harmless |
| 99 | **Missing `EXPO_PUBLIC_API_URL` on a real device** | ❌ 🟡 | Falls back to `localhost`; every request fails silently on physical phone |
| 100 | Backend down when opening app | ⚠️ | Login screen fine; OTP request fails with alert |
| 101 | Rapid back-navigation during in-flight fetch | ⚠️ | `cancelled` flag used in some screens, not universally |

## 14. Security

| # | Scenario | Severity | Notes |
|---|---|---|---|
| 102 | **Un-authenticated `/api/colleges/:cid/*` sub-routes** | 🔴 CRITICAL | Data leak + tamper vector |
| 103 | **No OTP rate limiting → brute force** | 🔴 CRITICAL | 4-digit code, 5-min window, unlimited attempts |
| 104 | **OTPs printed to server console** | 🟠 HIGH | Leaks via log-shipping |
| 105 | **Aadhar stored + returned in plaintext** | 🟠 HIGH | Sensitive national ID. UI masks to last 4, but list endpoints return full |
| 106 | **Google Maps API key hardcoded in `app.json`** | 🟠 HIGH | Visible in APK; must be restricted by SHA-1 + bundle ID in Cloud Console |
| 107 | **CORS allows all origins** | 🟡 MED | Fine for dev; whitelist in prod |
| 108 | JWTs cannot be revoked before natural expiry | 🟡 MED | Stolen token good for up to 7 days |
| 109 | Passwords: N/A | ✅ | OTP-only design side-steps password concerns |
| 110 | XSS via user-supplied strings | ✅ | React auto-escapes; safe unless `dangerouslySetInnerHTML` gets added |
| 111 | CSRF | ✅ | Bearer tokens in headers, not cookies |
| 112 | HTTPS not enforced | 🟡 MED | Deploy behind TLS proxy in prod |
| 113 | JWT_SECRET commit risk | ✅ | `.env` gitignored per Expo/Node defaults |
| 114 | No account lockout after N failed OTPs | 🟠 HIGH | Enables sustained brute force |
| 115 | No structured audit log of admin mutations | 🟡 MED | Can't answer "who unassigned this student?" |

## 15. Missing production infrastructure

| # | Scenario | Status |
|---|---|---|
| 116 | Delete / soft-delete anywhere | ❌ |
| 117 | Pagination on list endpoints | ❌ |
| 118 | Search on backend (client filters in memory) | ❌ |
| 119 | Rate limiting at any layer | ❌ |
| 120 | Structured logging (JSON, correlation IDs) | ❌ |
| 121 | Metrics / monitoring | ❌ |
| 122 | Error tracking (Sentry, etc.) | ❌ |
| 123 | Health check that actually checks DB | ⚠️ `/health` returns static ok |
| 124 | Graceful shutdown / SIGTERM handling | ❌ |
| 125 | Background jobs (e.g., auto-stop stale trips) | ❌ |
| 126 | Notification / SMS / email delivery | ❌ |
| 127 | File uploads (profile pics, licence photos) | ❌ |
| 128 | i18n / RTL support | ❌ |
| 129 | Formal accessibility pass | ⚠️ Some `aria-*` attrs, no audit |
| 130 | CI/CD | ❌ |
| 131 | Automated tests | ❌ |
| 132 | Versioned migration system | ⚠️ One-off stops migration script |
| 133 | API versioning (`/v1/`) | ❌ |
| 134 | Backup / restore procedure | ❌ |

---

# Part III — Coverage summary

**Positive scenario counts (implemented and working):**

| Area | Count |
|---|---|
| Admin onboarding & account | 6 |
| College management | 5 |
| Buses & routes | 16 |
| Drivers & students | 9 |
| Live fleet visibility (admin) | 6 |
| Driver dashboard + trip | 12 |
| Student — own bus + tracking | 12 |
| Student — Track other bus | 7 |
| Student — profile | 4 |
| System-wide operational | 13 |
| **Total** | **~90 flows** |

**Negative scenario status (out of 134 tracked):**

| Status | Count | Percentage |
|---|---|---|
| ✅ Handled | 58 | 43 % |
| ⚠️ Partial | 32 | 24 % |
| ❌ Not handled | 44 | 33 % |

**Severity breakdown of unhandled/partial:**
- 🔴 CRITICAL: 3
- 🟠 HIGH: 8
- 🟡 MEDIUM: 15
- No severity attached (mostly gaps in production infra): rest

---

# Part IV — Prioritized fix list

If you want to close the highest-impact gaps in order, here's a starter roadmap:

1. **Auth all college sub-routes** (#74). One `router.use(requireAdmin)` line. Massive risk reduction.
2. **OTP rate limiting + lockout** (#16, #17, #114). Simple in-memory or Redis counter (e.g. 5 failed attempts → 15-min lockout).
3. **Wire real OTP delivery** (#15). Twilio / MSG91 / AWS SNS.
4. **Verify `PUT /api/colleges/:id` scopes by admin** (#73). Add `admin: sub` to the find query.
5. **Auto-stop stale trips** (#49). Background job: "if `tripActive` and `currentLocation.updatedAt` > 10 min ago, set `tripActive: false`".
6. **Unsaved-changes guard** on route editor + profile (#79, #80). `beforeunload` on web, `useBeforeRemove` on RN.
7. **Refresh token flow** or shorter JWT + refresh endpoint (#5).
8. **Restrict Google Maps API key** in Cloud Console (#106). No code change, ops change.
9. **Mask Aadhar in API responses** too (#105). Or gate its exposure behind an explicit admin action.
10. **Simple rate limit middleware** at the API root (#119). `express-rate-limit` — 5 min per IP.
11. **Basic structured logging** (#120). Replace `console.log` with `pino` or `winston` and stop logging OTPs.
12. **CI + smoke tests** (#130, #131). Even one Playwright happy-path test per role catches regressions.

The rest are polish. Fix in priority order and this project stops being "works if everyone's nice" and becomes "works in production."

---

*Last updated: alongside `PROJECT_REFERENCE.md` (this repo state includes: FCM revert, bulk route upload, Track drivers on website, Track other bus on mobile, redesigned profile pages).*
