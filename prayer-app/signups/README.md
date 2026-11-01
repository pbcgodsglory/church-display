# Reusable church sign-ups

Manage the private Prayer Request Tracker workbook:

- **Sign Up Events**: copy a closed template, use a unique event name, choose **Sign-up type** in column C, enter date/location/details, then check **Open?**. Blank type defaults to General registration for compatibility.
- **Sign Up Options**: choose an event in column C, enter each item/job, required whole-number quantity, and optional shift/details. IDs, Reserved, and Remaining fill automatically on Sheets UI edits. Copying an event does not copy options: copy/reassign its option rows too.
- **Event Signups**: private responses. Filter Event for one event. Includes partner, boat number, Payment status, Amount paid, and Payment date. Payments are recorded manually, not processed online.
- **Sign Up Help**: operating instructions.

Types: General registration (existing optional number/text labels), Items needed (multiple items and quantities), Volunteer jobs (one opening per chosen job per response), Fishing tournament (required partner, sequential boats).

The server rechecks open/deadline status and remaining capacity under a script lock before appending a single response. Cancelled/Test responses release item/job quantities. Boat numbers start at 1 per event and never reuse cancelled numbers. Retry UUIDs prevent duplicate writes and retain the original boat. A receipt exposes only acceptance, safe validation errors, and the UUID owner's boat number. Names, contacts, partners, notes, payment data and internal selection JSON are never public.

Do not delete responses or change IDs, boat numbers, Selections JSON, event type, or option associations after accepting real responses. Close events and copy them for new occurrences. Use unique event names so option dropdowns map unambiguously. Avoid moving columns or changing headers. IDs and formulas are populated by onEdit for UI edits, not connector/API writes.

Backend source: Code.gs + Signups.gs. Public frontend: index.html, app.js, transport.js, styles.css. Deploy a new version of the existing Apps Script web app after backend changes; preserve its endpoint and access settings. Availability never relies on client-side limits alone.

Run backend/signups.test.cjs and signups/transport.test.cjs plus existing prayer/hub regression tests. Test events must stay closed except during a bounded verification, and synthetic responses must be marked Test afterward.
