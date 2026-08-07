# Bolt prompt — marketing website for the college bus tracking product

Copy everything below the line into Bolt.

---

Build a polished, production-ready **marketing + legal website** for an existing product called **BusTrack — a live college bus tracking platform**. This is a static informational site only: **no backend, no database, no authentication, no forms that submit anywhere**. It exists to explain the product, and to host the Privacy Policy and Terms of Service URLs required by the Google Play Store.

## Tech

- Next.js (App Router) + TypeScript + Tailwind CSS.
- Fully static, SEO-friendly: proper `<title>`, meta description, and Open Graph tags per page; semantic HTML (`header`, `main`, `section`, `footer`); one `h1` per page.
- Mobile-first responsive (360px → 1440px+). Accessible: WCAG AA contrast, keyboard-navigable nav, `alt` text, visible focus rings, `prefers-reduced-motion` respected.
- **No stock photos of people and no external image URLs.** Use inline SVG illustrations, CSS gradients, and simple line icons (Lucide) only. Draw the product concepts yourself: a bus pin on a map, a route line with stop dots, a phone frame with a live map inside, a dashboard wireframe.
- Subtle motion only: fade/slide-in on scroll, a gently animated bus marker moving along a dashed route path in the hero. Nothing heavy.

## Brand

Match the existing product design system exactly:

```
--bg-page      #ebe4d5   warm cream page background
--surface      #ffffff   cards / rounded shell
--surface-muted#faf6ec
--text         #1a1d29   near-black ink
--text-soft    #4b5563
--text-muted   #6b7280
--border       #ece6d6
--accent       #ff8a5b   coral (primary CTA)
--accent-hover #f4733e
--accent-soft  #fff0e8
--hero-from    #dcd3f4   lavender gradient start
--hero-to      #c4b3ec   lavender gradient end
--hero-ink     #2d1f47
--success      #10b981
--warning      #f59e0b
--danger       #ef4444
accent-alt     #f5b700   amber — the mobile app's brand accent, use sparingly
```

Feel: warm, calm, editorial. Generous whitespace, large rounded corners (16–24px), soft shadows, no harsh borders. Headings in a modern geometric sans (Plus Jakarta Sans or Inter), body in the same family at comfortable line-height. Pastel stat tiles (soft yellow `#fde68a`, purple `#a89af0`, pink `#f6a6c8`, blue `#a8d6e0`) for numbers/highlights. Light mode only.

Logo: a simple wordmark "BusTrack" with a rounded square mark containing a bus glyph in coral.

## Site structure

Shared sticky header (wordmark left; links Home / How It Works / Roles / Privacy / Terms; a coral "Contact us" button right; hamburger drawer on mobile) and a shared footer (wordmark + one-line description, column of page links, column of legal links, support email and phone, copyright line).

Pages: `/` (Home), `/how-it-works`, `/roles`, `/privacy-policy`, `/terms-of-service`.

---

## WHAT THE PRODUCT ACTUALLY IS (use these facts — do not invent features)

BusTrack is a multi-tenant college bus tracking platform. A college administrator manages their fleet from a web dashboard; drivers stream their live GPS location from a mobile app while on a trip; students watch their bus move on a map in the same mobile app and get push notifications about it.

**Three surfaces**
1. **Admin web dashboard** — for college administrators (browser).
2. **Mobile app (Android & iOS)** — one app, three logins: admin, driver, student. The app decides what you see based on who signs in.
3. **Backend service** — the API that ties them together.

**Four roles**
- **Super Admin** (the platform owner) — oversees every registered college admin and college on the platform, and publishes a product-wide announcement banner that all users see when they open the app.
- **College Admin** — registers the college, adds buses, drivers and students, draws routes and stops, assigns drivers to buses and students to buses/stops, and watches every active trip live on one map.
- **Driver** — signs in on the mobile app, sees the bus assigned to them and its route, taps **Start trip** to begin sharing location, taps **Stop trip** to end it.
- **Student** — signs in on the mobile app, sees their assigned bus and boarding stop, watches the bus live on a map, can also track any other bus from their college that is currently running, and receives notifications.

**Sign-in**: passwordless. Admins, drivers and students sign in with their mobile number and a 4-digit OTP. No passwords to remember or lose.

**Feature list (real, shipped)**
- Live GPS tracking — the driver's app sends a position roughly every 5 seconds or every 10 metres moved; students and admins see the marker update every few seconds with smooth animation.
- Admin live map showing *all* buses currently on the road at once, with driver name, bus number and last-updated time; tap one to follow it.
- Student "Track another bus" — see every bus from your college that is live right now, not just your own.
- Route builder — draw a route by placing stops on a map, name each stop, reorder them; students are assigned to a specific boarding stop on that route.
- Stop suspension — temporarily suspend a stop (roadworks, flooding, a closed street) without deleting it. The stop stays on the route marked as suspended, student assignments are preserved, and affected students are notified. If a student's own stop is suspended, the app suggests the nearest still-active stop.
- Route notices — the admin can attach a short disruption notice to a bus; it appears on the students' and driver's screens.
- Seat capacity enforcement — a bus cannot be over-assigned beyond its capacity.
- One driver per bus, enforced automatically; reassigning a driver frees their previous bus.
- Bulk Excel import — upload spreadsheets to create buses, drivers and students in bulk, to assign drivers to buses and students to buses, and to import a whole route's stops. Downloadable templates, a per-row preview showing exactly which rows are valid, and a per-row success/failure report after import.
- Push notifications with a custom bus ringtone, sent for: bus started its trip, bus finished its trip, **"bus arriving soon"** (fired automatically when the bus reaches the stop immediately before the student's own stop, so they get ready to board), route notice posted, a stop suspended / resumed / removed, and being assigned to or removed from a bus.
- Admin dashboard with live counts of colleges, buses, drivers and students, plus quick actions.
- Multi-college support — one admin account can manage more than one college, switching between them.

**Explicit non-features — never claim these**: there is no parent/guardian login, no attendance or boarding scan, no fee collection or ticketing, no fuel/maintenance/expense tracking, no driver behaviour or speed scoring, no SOS/panic button, no ETA prediction based on traffic, and no offline maps.

**Honest limits worth stating plainly on the site** (put these in a small "Good to know" block on How It Works, and reflect them in the legal pages):
- Location is shared **only** while a driver has an active trip running, and stops the moment they end it.
- Tracking accuracy depends on the driver's phone GPS and mobile signal; positions are approximate and can lag or pause in tunnels, basements or poor coverage.
- The service is a convenience tool and must not be relied on for emergencies or safety-critical decisions.

---

## PAGE: Home (`/`)

1. **Hero** — lavender gradient panel, rounded. H1: "Know exactly where the college bus is." Sub: one sentence — live bus tracking for colleges, with a dashboard for admins and a mobile app for drivers and students. Two buttons: coral "See how it works" → `/how-it-works`, outlined "Explore the roles" → `/roles`. To the right, an illustrated phone showing a map with a route line, stop dots and an animated bus marker.
2. **Trust strip** — four pastel stat tiles: "Live location every ~5 seconds", "4 roles, one platform", "OTP sign-in — no passwords", "Bulk setup from Excel".
3. **The problem** — a short empathetic block: students wait at stops with no idea if the bus is five minutes away or already gone; admins have no view of the fleet; a suspended stop or a diverted route is communicated by word of mouth. Three small cards, no fear-mongering.
4. **What BusTrack does** — a 6-card feature grid with icons, each a short heading plus two lines: Live tracking, Route & stop builder, Smart notifications, Bulk Excel setup, Fleet dashboard, Stop suspension & notices.
5. **Built for the whole campus** — three columns (Admin / Driver / Student) each with an icon, a one-line role summary and 3 bullets. Link to `/roles`.
6. **How it works, in four steps** — condensed horizontal timeline: Admin sets up → Driver starts the trip → Students watch live → Everyone gets notified. Link to `/how-it-works`.
7. **Notifications showcase** — a phone-frame mock displaying three stacked notification cards using the real copy:
   - "Bus has started — Bus 12A is on the route. Track its live location."
   - "Bus arriving soon — Your bus is near Gandhi Road — one stop before Anna Nagar. Get ready to board."
   - "Anna Nagar suspended — Your boarding stop is suspended today. The nearest active stop is shown in the app."
8. **Pricing** — one simple card: **one-time activation fee of ₹90 per college admin account**, then included: unlimited colleges, buses and drivers; live driver location for students; routes, stops and seat assignments; email and phone support. Make the amount and currency easy to edit in one place in the code.
9. **Privacy up front** — a short reassurance band: location is shared only during an active trip, data is used only to run the service, and it is never sold. Links to `/privacy-policy`.
10. **Contact / CTA** — coral panel with support email **canyaman6701@gmail.com** and phone **+91 93605 55572** as `mailto:` and `tel:` links. No contact form.

## PAGE: How It Works (`/how-it-works`)

Explain the flow end to end, in plain language, for a non-technical college administrator.

- **Section 1 — Set up your college.** Admin registers with name, mobile, email, date of birth and gender, verifies by OTP, and adds their college (name, code, address). Buses are added with bus number, plate number and seat capacity. Drivers are added with name, mobile, licence number and ID details. Students are added with name, roll number, mobile and address. Anything can be typed in one by one, or uploaded in bulk from an Excel sheet with a downloadable template, a validation preview and a per-row result report.
- **Section 2 — Draw the route.** Place stops on a map in travel order, name each one, adjust positions by dragging. Assign one driver to each bus. Assign each student to a bus and to a specific boarding stop — the system blocks assignments that would exceed the bus's seat capacity, and blocks stops that are not on that bus's route.
- **Section 3 — The driver starts the trip.** The driver signs in on the mobile app with mobile + OTP, sees their bus and route, and taps Start trip. The app asks for location permission and then shares the bus position roughly every 5 seconds or every 10 metres of movement. Tapping Stop trip ends sharing immediately.
- **Section 4 — Students watch it live.** The student app shows their bus moving along the route with all stops marked and their own boarding stop highlighted. They can also open "Track another bus" to see any bus from their college that is currently running.
- **Section 5 — The admin watches the whole fleet.** One live map on the web dashboard showing every bus on the road right now, with driver name, bus number, route and how many seconds ago each position updated. Follow all buses at once or lock onto one.
- **Section 6 — Everyone stays informed.** Explain each notification: trip started, trip finished, bus arriving soon (triggered when the bus reaches the stop before yours), route notice posted, stop suspended / resumed / removed, and bus assignment changed. Mention the custom ringtone.
- **Section 7 — When the route changes.** A short scenario: a stop floods, the admin suspends it and posts a notice; affected students are notified, their assignments are kept, and the app points each one to the nearest active stop. When the road reopens, the admin resumes the stop and everyone is notified again.
- **"Good to know"** — the three honest limits listed above, in a muted bordered box.
- Use numbered step cards with a connecting vertical line on desktop; each step gets its own small SVG illustration.

## PAGE: Roles (`/roles`)

Four detailed role cards, each with an icon, a one-line summary, "What they can do" bullets, "How they sign in", and "What they see first".

- **Super Admin** — the platform owner. Signs in with email and password on a separate console. Reviews every registered college admin and college on the platform, removes accounts that should no longer have access, and publishes the product-wide announcement banner shown to all users when they open the app.
- **College Admin** — signs in on the web dashboard (or the mobile app) with mobile + OTP. Manages one or more colleges, buses, drivers, students, routes and stops; assigns drivers to buses and students to buses and stops; posts route notices; suspends and resumes stops; imports data from Excel; watches all active trips on a live map. Lands on a dashboard with fleet counts and quick actions.
- **Driver** — signs in on the mobile app with mobile + OTP. Sees the bus assigned to them, its route and stops, and any notice; starts and stops the trip; shares location only while a trip is active; manages a simple profile with light/dark mode. Lands on the trip screen.
- **Student** — signs in on the mobile app with mobile + OTP. Sees their assigned bus and boarding stop, the full stop list, the live map, and any route notice; tracks other live buses from their college; receives arrival and disruption notifications; gets a nearest-active-stop suggestion if their own stop is suspended. Lands on the live bus screen.

Below the cards, add a **comparison table**: rows = capabilities (Manage colleges, Manage buses/drivers/students, Draw routes & stops, Assign drivers & students, Bulk Excel import, Post route notices, Suspend stops, Start/stop a trip, Share live location, View own bus live, View all live buses, Receive notifications, Publish platform banner, Manage admin accounts); columns = Super Admin / Admin / Driver / Student; cells = check, dash, or a short qualifier ("own bus only", "own college only"). Table must scroll horizontally inside its own container on mobile — the page body must never scroll sideways.

## PAGE: Privacy Policy (`/privacy-policy`)

A real, readable policy — not lorem ipsum. Clean legal-document layout: max-width ~72ch, numbered sections, a sticky table-of-contents sidebar on desktop, "Last updated: 2 August 2026" at the top, and a plain-English one-line summary under each section heading.

Cover, accurately to this product:

1. **Who we are and scope** — placeholders `[Company Legal Name]`, `[Registered Address]`, `[Country/State]` clearly marked for the owner to fill in. Covers the website, the web dashboard and the mobile app.
2. **Information we collect**, split by role:
   - *College admins*: name, mobile number, email address, date of birth, gender.
   - *Drivers*: name, mobile number, date of birth, gender, address, driving licence number, government ID number, and **precise GPS location while a trip is active**.
   - *Students*: name, roll number, mobile number, date of birth, gender, address, assigned bus and boarding stop.
   - *All app users*: a device push-notification token, and basic technical/diagnostic data.
   - Note that student and driver records are normally entered by the college, not by the individual.
3. **Location data — the important one.** State explicitly: collected only from a **driver's** device, only while that driver has started a trip, in the foreground; sharing stops when the trip is stopped or the app is closed; the last recorded position may remain visible as a "last seen" marker; it is shared only with the driver's own college — its administrator and the students of that college; students' own locations are never collected.
4. **How we use information** — to authenticate by OTP, to show buses on a map, to send trip and disruption notifications, to run and support the service. No advertising, no profiling.
5. **Push notifications** — what triggers them, and that they can be turned off in device settings (which disables arrival alerts).
6. **Legal basis / consent**, phrased for India's DPDP Act with a GDPR-style nod.
7. **Sharing and disclosure** — we do not sell personal data. Shared only with: the user's own college, service providers (cloud hosting, Google Maps for map display, Firebase Cloud Messaging for push delivery), and where required by law.
8. **Data retention** — kept while the account and college are active; deletion on request via the contact below.
9. **Security** — encrypted transport, restricted access, ID numbers masked in the app to their last four digits; plus an honest "no system is perfectly secure" line.
10. **Your rights** — access, correction, deletion, withdrawal of consent, complaint; how to exercise them, and that college-managed records may need to go through the college.
11. **Children and student data** — records are provided by the college; a parent or guardian of a minor may contact us or the college to review or remove them.
12. **Third-party services** — Google Maps and Firebase, each with a link to its own privacy policy.
13. **Changes to this policy** and how users will be told.
14. **Contact** — canyaman6701@gmail.com, +91 93605 55572, plus the address placeholder.

Also add a short, prominent **Account & data deletion** block near the top (Play Store expects a reachable deletion route): email the support address from your registered mobile or email, we respond within 30 days.

## PAGE: Terms of Service (`/terms-of-service`)

Same layout and typography as the privacy page, same "Last updated" date and placeholders. Sections:

1. Acceptance of terms.
2. Definitions — Platform, College, Admin, Driver, Student, Super Admin, Trip.
3. Eligibility and accounts — the college is responsible for the accuracy of the driver and student records it enters and for having a lawful basis to enter them; the college must inform its drivers and students that the service is in use.
4. **OTP and account security** — the mobile number is the account key; keep the SIM and device secure; tell us if a number changes hands.
5. **Acceptable use** — no interference with tracking, no fake or spoofed locations, no scraping, no using the service to harass or surveil an individual outside the legitimate operation of a college bus service, no sharing another person's location outside the platform.
6. **Driver responsibilities** — never operate the app while driving; start or stop a trip only when safely stationary; the driver must obey all traffic laws, which always take precedence over the app.
7. **Service accuracy disclaimer** — positions are approximate and depend on GPS and network; delays, gaps and outages will happen; **do not rely on the service for emergencies or safety-critical decisions**; timings are indicative, not a guarantee of arrival.
8. **Fees** — a one-time activation fee per admin account; state the amount as a placeholder tied to the same editable constant as the home page; taxes; refund terms marked `[to be confirmed]`.
9. **Availability, maintenance and changes** — provided "as is"; features may change; planned downtime.
10. **Intellectual property.**
11. **Suspension and termination** — including removal by the Super Admin for misuse or non-payment, and what happens to data afterwards.
12. **Limitation of liability** and **indemnity**, in plain language, with a clear cap placeholder.
13. **Third-party services** — Google Maps and Firebase are governed by their own terms.
14. **Governing law and jurisdiction** — `[State]`, India, with dispute resolution.
15. **Changes to these terms.**
16. **Contact** — same support details.

Add a clearly styled note at the very top of both legal pages: *"This is a template prepared for the product and is not legal advice — have it reviewed by a qualified lawyer before publishing."*

---

## Quality bar

- Every page must look finished and intentional — no placeholder gray boxes, no "Lorem ipsum", no dead links. Every internal link must resolve to a real page.
- Write all body copy in clear, confident, jargon-free English aimed at a college administrator and a student's parent. Short sentences. No exclamation marks. No invented statistics, customer counts, testimonials, awards, or logos.
- Keep the two legal pages typographically calm: no cards, no gradients, just excellent text hierarchy.
- Tables and any wide content scroll inside their own container; the page body never scrolls horizontally.
- Put the support email, phone, pricing amount, "last updated" date, and company-name placeholders in a single shared config file so they can be changed in one place.
