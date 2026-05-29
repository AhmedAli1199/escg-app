# ESCG Web App — Claude Code Handoff Document

## What This Is
A Next.js 14 web app for Eastern Suburbs Cleaning Group (ESCG) replacing a WhatsApp bot built in n8n. 7 cleaners, ~27 sites in Sydney. Airtable as backend. Deployed on Vercel.

## What's Built (Phase 1 — DONE)
- Full project scaffold: Next.js 14 App Router, TypeScript, Tailwind CSS
- `lib/airtable.ts` — all Airtable API calls, field IDs, types
- `lib/auth.ts` — JWT session via cookies (jose library)
- `lib/push.ts` — Web Push notifications via web-push
- `lib/cloudinary.ts` — photo upload helper
- All API routes: auth, shifts, checkin, checkout, photos, complete, incidents, push, manager/dashboard, manager/logs
- Login page (cleaner by phone, manager by password)
- Cleaner home page (full shift flow: sign in → photo → active → sign out → photos → complete)
- Manager dashboard page (site grid with live status)
- PWA manifest + service worker for push notifications
- Shared UI component library

## What's NOT Built Yet (Phase 2 — YOUR JOB)
These pages need to be created following the same patterns as existing pages:

### 1. `app/cleaner/schedule/page.tsx`
Shows upcoming 7 days of shifts. Data from `/api/shifts` (the `schedule` array in response).
Group by day. Show site name, time window, status badge (upcoming/today/complete).
Weekend shifts show "Flexible — any time this weekend". Overnight shifts show "18:00 → 06:00 (overnight)".
Use same layout as home page (StatusBar + header + content scroll + TabBar).

### 2. `app/cleaner/history/page.tsx`  
Shows past shift logs. Fetch from `/api/manager/logs` filtered by current cleaner's name.
Group by week. Show site, date, sign in/out times, duration, status badge.
Calculate duration using `calcDuration(signIn, signOut)` from `lib/airtable.ts`.

### 3. `app/cleaner/profile/page.tsx`
Shows cleaner stats. Fetch from `/api/shifts`.
Stats: shifts this week, hours this week, on-time rate, incidents this month.
Settings: notification toggle, sign out button.
On sign out: call `DELETE /api/auth` then redirect to `/login`.

### 4. `app/cleaner/report/page.tsx`
Report issue form. Fields: description (textarea), photo (optional), severity (standard/urgent).
On submit: POST to `/api/incidents` with `{ cleanerId, shiftLogId, siteName, description, photoUrl, currentState }`.
On success: show confirmation and go back.

### 5. `app/cleaner/help/page.tsx`
Simple page: confirm "Send help request?" with manager contact.
On confirm: POST to `/api/incidents` with type "help".

### 6. `app/manager/logs/page.tsx`
Filterable shift log table. Fetch from `/api/manager/logs`.
Filters: cleaner name, status, date. Search by site name.
CSV export button. Pagination (20 per page).

### 7. `app/manager/alerts/page.tsx`
Incidents and no-shows. Fetch from `/api/incidents` and `/api/manager/dashboard`.
Two sections: "Unresolved" and "Activity feed".
Mark resolved button on each incident.

### 8. `app/manager/cleaners/page.tsx`
Team list. Data from `/api/manager/dashboard` (cleanerSummaries array).
Each cleaner: name, today's status, shifts this week, hours this week, last active.

## Airtable Schema

### Base ID: `appVrqVSQ7V2laVBA`

### Tables
```
Cleaners:    tblGT6gkwbsQzEH6H
Assignments: tblRaY2TWDqFF2AAj
Shift Logs:  tbleCJR1s6P0m1uOE
Incidents:   tblp2THjEA7Zy5pXq
```

### Important Field Names (used in Airtable API as strings)
**Shift Logs:**
- `Cleaner State` — single select: Menu Sent, Awaiting Signin Photo, Active, Collecting End Photos, Awaiting End Photo 1/2/3, Complete, Unavailable, No Show, Incident Open, Incident Only, Selecting Site
- `Date` — stored as `dd/MM/yyyy` string (NOT ISO format)
- `Sign In Time` / `Sign Out Time` — stored as `HH:mm` strings
- `End Photo URLs` — long text, newline-separated list of Cloudinary URLs
- `Sign In Photo` — single URL string
- `No Show Alert Sent` — checkbox
- `Reminder Sent` — checkbox
- `Pending Assignments` — long text, JSON array for multi-site selection
- `Previous State` — text, stores state before Incident Open
- `Phone (from Cleaner)` — lookup field
- `Name (from Cleaner)` — lookup field
- `Site (from Assignment)` — lookup field

**Assignments:**
- `Weekend Shift` — checkbox (renamed from "Anytime")
- `Window Start` / `Window End` — text `HH:mm`
- `Last Triggered Date` — date field (for fortnightly frequency check)
- `Frequency` — single select: Weekly, Fortnightly, Monthly, Adhoc
- `Days` — multiple select: Mon, Tue, Wed, Thu, Fri, Sat, Sun

### Date Format Warning
Shift Logs use `dd/MM/yyyy` format. The function `getSydneyDateFormatted()` in `lib/airtable.ts` returns this format. Do NOT use ISO format for Shift Log date comparisons.

## Business Rules

### Frequency Logic
- Weekly: fires every matching day
- Fortnightly: fires if `Last Triggered Date` is empty OR ≥13 days ago
- Monthly: fires only on days 1-7 of the month (first weekend rule)
- Adhoc: never auto-fires

### Overnight Shifts
Shift window End time < Start time (e.g. 19:00→07:30). Before 8am, also search yesterday's assignments.
Example shifts: Greenwood Gladesville (18:00→06:00), 74-76 Campbell St (20:00→06:00), Delight Dental (19:00→07:30).

### Weekend Shifts
Weekend Shift checkbox = true. Alert manager only at 8pm Sunday. Cleaner can sign in anytime Sat or Sun.
Example shifts: AMBS, Bayside Animal Hospital, Institution of Surveyors NSW.

### State Machine
```
NO_LOG → Menu Sent → Awaiting Signin Photo → Active → Collecting End Photos → Complete
                  ↘ Unavailable
                  ↘ Incident Open (can happen from any state, restores to previous after)
NO_LOG → Selecting Site (when multiple assignments same day) → Menu Sent
No Show (set by late alert workflow in n8n, not from app)
```

### Photo Submission
End-of-shift photos: cleaner sends multiple, each stored as URL in `End Photo URLs` field (newline-separated). Shift only Complete after cleaner taps "Complete" button — never auto-completed from photos.

## Environment Variables Needed
```
AIRTABLE_TOKEN=          # Airtable Personal Access Token
AIRTABLE_BASE_ID=appVrqVSQ7V2laVBA
MANAGER_PASSWORD=        # Manager login password
JWT_SECRET=              # Random 32+ char string
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # Run: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:your@email.com
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=escg_photos
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Setup Steps
```bash
cd escg-app
npm install
cp .env.local.example .env.local
# Fill in .env.local values
npx web-push generate-vapid-keys   # paste output into .env.local
npm run dev
```

## Cloudinary Setup
1. Create free account at cloudinary.com
2. Go to Settings → Upload → Add upload preset
3. Name it `escg_photos`, set to "Unsigned"
4. Note your Cloud Name from dashboard

## Vercel Deployment
```bash
npm install -g vercel
vercel
# Follow prompts, add env vars in Vercel dashboard
```

## Known Issues / TODOs
1. `lib/airtable.ts` — field IDs prefixed with `fld` are placeholders for fields that weren't confirmed. Verify these against Airtable API response in Shift Logs table: `LOG_ASSIGNMENT`, `LOG_CLEANER`, `LOG_DATE`, `LOG_STATE` etc. The actual field IDs need to be confirmed by running the app and checking error responses, OR by calling the Airtable API schema endpoint.

2. Push subscriptions in `lib/push.ts` are stored in-memory. On Vercel serverless, this resets between invocations. **Fix:** Replace with Vercel KV store (`@vercel/kv`) or add a `Push Subscriptions` table in Airtable with columns: userId (text), endpoint (text), keys (long text JSON).

3. The `app/api/shifts/route.ts` schedule endpoint fetches all assignments without day filter for the 7-day schedule. This works but is slow. Optimise by batching day queries.

4. No icon images in `/public/` — add `icon-192.png` and `icon-512.png` for PWA installation. Quick option: use a solid blue square with white broom emoji as SVG, convert to PNG.

5. `app/cleaner/help/page.tsx` doesn't exist yet — the help button on the active shift screen links to it. Create it.

## Cleaners List (for reference)
Jhakash, Tony, Harris, Acis, Sovit, Nishan, Manny

## Manager Contact
Manager: Tory Papa. Receives all push notifications. Push subscription stored under userId 'manager'.

## n8n Integration Note
The n8n WhatsApp workflows still exist and are separate. This web app is a parallel system — both write to the same Airtable base. No conflicts as long as the shift log Date format matches. The n8n late alert workflow (runs every 15 mins) still handles no-show detection and sends alerts via the existing mechanism.
