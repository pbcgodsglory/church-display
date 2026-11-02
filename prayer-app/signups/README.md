# Reusable church sign-ups

Manage the private **PBC Event & Volunteer Sign-ups** workbook:

The prayer-request workbook is separate. Signups.gs pins all public sign-up reads and writes to SIGNUP_SPREADSHEET_ID_, even when the web app runs from the prayer project. A copy of the existing bound script provides onEdit IDs, links, and formulas inside this new workbook; it needs no public deployment. Keep its Signups.gs in sync with the web app source. Configure SIGNUP_SPREADSHEET_ID_ with the private workbook ID in both private Apps Script projects before saving/deploying; the public repository intentionally contains a placeholder rather than the private workbook ID or link.

- **Sign Up Events**: copy a closed template, use a unique event name, choose **Sign-up type** in column C, enter date/location/details, then check **Open?**. Blank type defaults to General registration for compatibility.
- **Sign Up Options**: choose an event in column C, enter each item/job, required whole-number quantity, and optional shift/details. IDs, Reserved, and Remaining fill automatically on Sheets UI edits. Copying an event does not copy options: copy/reassign its option rows too.
- **Event Signups**: private responses. Filter Event for one event. Includes partner, boat number, Payment status, Amount paid, and Payment date. Payments are recorded manually, not processed online.
- **Sign Up Help**: operating instructions.

Phone or email is optional for every sign-up type; names remain required.

Types: General registration (existing optional number/text labels), Items needed (multiple items and quantities), Volunteer jobs (one opening per chosen job per response), Fishing tournament (required partner, sequential boats).

The server rechecks open/deadline status and remaining capacity under a script lock before appending a single response. Cancelled/Test responses release item/job quantities. Boat numbers start at 1 per event and never reuse cancelled numbers. Retry UUIDs prevent duplicate writes and retain the original boat. A receipt exposes only acceptance, safe validation errors, and the UUID owner's boat number. Separate tournament TV publishing switches can expose fishing names, partners, boat numbers and results for a chosen event. Contacts, private notes, payment data and internal selection JSON remain private.

Fishing registrations also fill the private tournament manager. Use its **Teams** tab for morning-of walk-ins, weigh-in and payment updates, and **Tournament Setup** for the two independent TV publishing switches and links. See [tournament instructions](../../tournament/README.md). This works when online sign-up is closed. A copied event gets a new roster and starts at boat 1.

Do not delete responses or change IDs, boat numbers, Selections JSON, event type, or option associations after accepting real responses. Close events and copy them for new occurrences. Use unique event names so option dropdowns map unambiguously. Avoid moving columns or changing headers. IDs and formulas are populated by onEdit for UI edits, not connector/API writes.

Backend source: Code.gs + Signups.gs + Tournaments.gs. Public frontend: index.html, app.js, transport.js, styles.css. Deploy a new version of the existing Apps Script web app after backend changes; preserve its endpoint and access settings. Availability never relies on client-side limits alone.

Run backend/signups.test.cjs and signups/transport.test.cjs plus existing prayer/hub regression tests. Test events must stay closed except during a bounded verification, and synthetic responses must be marked Test afterward.
