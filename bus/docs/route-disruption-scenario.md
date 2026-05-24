# Handling a Route Disruption (Construction / Road Block)

This document explains, end to end, what happens when a stop on a bus route
becomes temporarily unusable — for example, road work near a stop — and how the
admin handles it so students are informed and redirected to the nearest open
stop. It uses one worked example throughout.

---

## 1. The problem

A bus route is an **ordered list of named stops**. Sometimes one stop becomes
unusable for a while (construction, flooding, a closed road). The admin (the
college principal / transport staff) needs to:

1. Take that stop out of service **temporarily** — without losing track of which
   students normally board there.
2. **Tell** the affected students what happened and where to go instead.
3. Put it back when the work is done, with **zero manual re-assignment**.

The naïve approach — just deleting the stop from the route — fails all three:
it silently un-assigns every student at that stop, tells them nothing, and
forces the admin to re-assign everyone by hand afterwards.

## 2. The mental model: *suspend*, don't delete

Instead of removing the stop, the admin **suspends** it. The stop stays on the
route; students stay assigned to it; it is simply flagged as temporarily closed.
The admin also writes a short **notice** (a banner) explaining the change.

The system then:

- Keeps every student's assignment intact.
- Shows the notice to students and the driver, live.
- For each student whose own stop is suspended, computes and shows the
  **nearest still-open stop** on the same route.
- Restores everything the moment the admin un-suspends the stop.

## 3. What a "route" is now (the data)

Each bus stores its route as a name plus a list of **stop objects**, and a
free-text notice:

```
Bus {
  route:  "North City Loop"                 // route name
  notice: ""                                // disruption banner (empty when normal)
  stops: [
    { name: "College Gate",   lat, lng, suspended: false },
    { name: "Anna Nagar",     lat, lng, suspended: false },
    ...
  ]
}
```

- `name` is the **stable key**. A student references a stop by its name
  (`Student.stop = "Anna Nagar"`), so a stop's identity never changes.
- `lat` / `lng` are optional map coordinates (set by dropping a pin on the map
  in the web admin). They power the map view and the "nearest stop" maths.
- `suspended` is the temporary-closed flag.

> Code: `api/src/models/Bus.ts`

---

## 4. Worked example

### The setup

**Green Valley College**, **Bus 21**, route **"North City Loop"** with 6 stops
(in travel order). Coordinates have been placed on the map by the admin:

| # | Stop            | Coordinates           | Status |
|---|-----------------|-----------------------|--------|
| 1 | College Gate    | 13.0700, 80.2350      | open   |
| 2 | **Anna Nagar**  | 13.0850, 80.2101      | open   |
| 3 | Shanthi Colony  | 13.0826, 80.2070      | open   |
| 4 | Thirumangalam   | 13.0680, 80.1950      | open   |
| 5 | Koyambedu       | 13.0700, 80.1900      | open   |
| 6 | CMBT Terminus   | 13.0694, 80.1948      | open   |

**Priya** (roll 21CS045) is assigned to **Bus 21**, stop **Anna Nagar**.

### The event

On the morning of **May 24**, the road at **Anna Nagar** is dug up for drainage
work for a week. Priya cannot be picked up there.

### What the admin does (≈ 30 seconds, on the web admin)

1. Opens **Buses → Bus 21 → Edit route**.
2. Clicks **Suspend** on the "Anna Nagar" row. (It greys out and shows a
   *Suspended* tag — it is **not** removed.)
3. Types a **Notice**:
   > *"Anna Nagar stop closed May 24–31 for road work. Please board at Shanthi
   > Colony instead."*
4. Clicks **Save route**.

That's it. No student is touched in the database — Priya is **still** assigned
to Bus 21 / Anna Nagar.

> Code: `bus-website/app/(admin)/buses/[busId]/route/page.tsx`,
> `api/src/routes/collegeBuses.ts` (`PUT /:busId/route`)

### What the system computes

Anna Nagar is now `suspended: true`. For Priya (whose stop is suspended), the
app finds the **nearest open stop** using the straight-line (haversine)
distance from Anna Nagar to every non-suspended stop that has coordinates:

| Open stop       | Distance from Anna Nagar |
|-----------------|--------------------------|
| **Shanthi Colony** | **≈ 430 m**  ← nearest |
| College Gate    | ≈ 3.2 km                 |
| Thirumangalam   | ≈ 2.5 km                 |
| Koyambedu       | ≈ 2.7 km                 |
| CMBT Terminus   | ≈ 2.4 km                 |

→ The suggested alternate is **Shanthi Colony (≈ 430 m away)** — which happens to
match what the admin wrote in the notice.

> Code: `nearestActiveStop()` in
> `mobile/src/screens/StudentDashboardScreen.tsx`

### What Priya sees (within ~5 seconds, no re-login)

The student app polls the bus every 5 seconds, so the change appears almost
immediately:

- A ⚠️ **notice banner** at the top: *"Anna Nagar stop closed May 24–31 …"*
- Her **stop card** changes from "You board at **Anna Nagar**" to
  **"Stop temporarily closed — Anna Nagar"** (struck through), followed by:
  **"Nearest open stop: Shanthi Colony · 430 m away"**.
- On the **map**: the route line and stop pins are drawn — Anna Nagar's pin is
  **grey** (suspended), Shanthi Colony is **red** (open), and the live 🚌 moves
  along when the driver is on a trip.
- In the **All Stops** list, Anna Nagar shows as `Anna Nagar (closed)`.

> Code: `mobile/src/screens/StudentDashboardScreen.tsx`,
> served live by `GET /api/student-auth/bus-location`
> (`api/src/routes/studentAuth.ts`)

### What the driver sees

On the **Driver dashboard**, the same ⚠️ notice banner appears, so the driver
knows not to turn into Anna Nagar and to expect those students at Shanthi
Colony.

> Code: `mobile/src/screens/DriverDashboardScreen.tsx`,
> served by `GET /api/driver/trip/status` (`api/src/routes/driverTrip.ts`)

### When the work is finished (May 31)

The admin opens **Edit route**, clicks **Resume** on Anna Nagar, clears the
notice, and saves. Because Priya was never un-assigned:

- Her stop card instantly returns to "You board at **Anna Nagar**".
- The banner disappears; Anna Nagar's pin turns red again.
- **No re-assignment work** was needed for Priya or anyone else at that stop.

---

## 5. The lifecycle at a glance

```
NORMAL ──(admin suspends stop + writes notice)──▶ DISRUPTED ──(admin resumes)──▶ NORMAL
  │                                                   │
  │  students board normally                          │  students keep their assignment,
  │                                                   │  see the notice + nearest open stop,
  │                                                   │  driver sees the notice
```

Everything in the DISRUPTED state is an **overlay** — nothing about who is
assigned where actually changes, which is why returning to NORMAL is free.

---

## 6. How specific cases are handled

| Situation | Behaviour |
|---|---|
| **Suspend a stop** | Stop stays on the route; all students keep their assignment; it's flagged closed. |
| **Remove a stop entirely** | *Different from suspend.* Students at a removed stop are un-assigned (their stop is cleared) — this is the only case that drops assignments. |
| **Student's own stop is suspended** | They see the notice + the nearest open stop. Students at *other* stops are unaffected. |
| **Stops have coordinates** | Nearest open stop = smallest straight-line (haversine) distance. |
| **Stops have no coordinates** (e.g. legacy routes) | Falls back to the **next open stop in route order**; the map simply doesn't draw pins for un-placed stops. |
| **No open stops left** | The app shows "check the notice above" instead of a suggestion (the admin's free-text notice is the source of truth). |
| **Assigning a student to a suspended stop** | Still allowed — suspension is temporary, so the stop remains a valid assignment target. |
| **Capacity** | Unchanged — assignment still respects the bus's seat capacity. |
| **Delivery speed** | The student app re-reads the bus every 5 seconds, so notice/suspension changes appear without logging out. |

---

## 7. Where it lives in the code

| Layer | Files |
|---|---|
| Data model | `api/src/models/Bus.ts` (stop objects + `notice`) |
| Save route / suspend / cascade rules | `api/src/routes/collegeBuses.ts` (`PUT /:busId/route`) |
| Stop validation by name | `api/src/routes/collegeStudents.ts` |
| Live data to student / driver | `api/src/routes/studentAuth.ts`, `api/src/routes/driverTrip.ts` |
| Admin route editor (map, suspend, notice) | `bus-website/app/(admin)/buses/[busId]/route/page.tsx`, `bus-website/components/StopMap.tsx` |
| Student view (map, banner, nearest stop) | `mobile/src/screens/StudentDashboardScreen.tsx` |
| Driver notice banner | `mobile/src/screens/DriverDashboardScreen.tsx` |
| Mobile route editor (preserves coordinates) | `mobile/src/screens/SetBusRouteScreen.tsx` |
| One-time data migration (string stops → objects) | `api/src/scripts/migrateStops.ts` |

---

## 8. Current limitations (good to know)

- **Notifications are in-app only.** Students see the notice/redirect when they
  open the app (or while it's open, via the 5s poll). There is no push
  notification or SMS yet — so a student who never opens the app that day won't
  be alerted. (Push/SMS were scoped out for this version.)
- **Coordinates are placed on the web admin** (drag a pin on the map). The
  mobile route editor can suspend stops and edit the notice and preserves
  coordinates, but doesn't place pins yet.
- **"Nearest" is straight-line distance**, not road/driving distance, and is
  only as good as the coordinates the admin places.
