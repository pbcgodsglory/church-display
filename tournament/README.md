# Fishing tournament management and TV displays

The private **PBC Fishing Tournament Manager** workbook is a native copy of the old Bass Tournament workbook. **Previous Results** preserves the original tab and its formulas. **Teams**, **Tournament Setup**, and **Read Me** provide the new workflow. Old results never enter a new event's roster or scoring.

Create a uniquely named Fishing tournament in the separate sign-up workbook. The existing closed **PBC Bass Tournament** event is ready for its date, location and registration deadline. Open it when registration should begin. New fishing events appear in Tournament Setup automatically, with both TV switches off.

Online registrations populate Teams. For a walk-in, choose an event in a genuinely empty Teams row and enter the angler and partner. Leave the boat number and generated identifiers alone. The same web project's ScriptLock assigns online and manual boats, including when public registration is closed. Numbers are never reused. A private edit trigger responds to manual entries; a minute trigger repairs interrupted mirrors and catches missed edit events. Walk-ins retain their UUID and reserved boat after a partial save. Do not delete registered rows or copy rows with IDs; use Cancelled or Test instead.

Enter the final decimal-pound weight after penalties, plus eligible big-fish weight, with at most two decimal places. Check Weighed? after checking the entries. Blank big fish counts as zero; a weighed 0.00 total is valid. Disqualified teams do not receive any awards. Cancelled/Test teams do not appear on either display. Scoring sorts final weight, then big fish. Exact ties share competition places (1, 2, 2, 4). All teams with a place of ten or better appear, including ties. Largest eligible big fish wins; exact big-fish ties display all winners. Place and Entry check in Teams refresh automatically.

Use Teams for fishing name, partner, registration status and payment edits; the edit trigger mirrors those fields back to the accepted sign-up record. Payment fields record status, amount and date without collecting payment. Contact is optional. Keep workbook headers and generated columns intact.

The TV pages use `?event=<public event UUID>&mode=pre` and `?event=<public event UUID>&mode=results`. Links are supplied in Tournament Setup. Each has a separate checkbox; online registration's Open? checkbox does not control the TV. Pre-tournament scrolls an overflowing boat list continuously, with pause and full-screen controls. Reduced-motion users see timed pages. Results remain on one static screen. Both refresh approximately every fifteen seconds, preserve the last successful view on a connection failure, and clearly label it stale. A successful unpublished response clears the display. Contact, payment, private notes, internal identifiers and unrelated event data are never included in the TV response.

Preview layouts with `?demo=1&mode=pre` and `?demo=1&mode=results`; these are visibly marked sample data and do not write registrations.

## Private backend configuration

Keep the real IDs out of the public repository. Set the placeholders in Signups.gs and Tournaments.gs only inside the private Apps Script projects. Install `tournamentRefresh_` as a one-minute time trigger and `tournamentEdit_` as an on-edit trigger for the private tournament workbook **in the web backend project**, so both share the online submission lock. `setupTournamentAutomation_` installs them idempotently. A temporary editor-only public wrapper may invoke this private setup function; remove it before deployment. Do not install a competing allocator in a different script project.

Deploy a new version of the existing web app without changing its endpoint or access settings. Keep the sign-up workbook's bound helper source in sync; it does not get tournament triggers. Google Sheets API writes do not fire UI edit triggers; allow the minute reconciliation for a connector-seeded walk-in.

Run `node prayer-app/backend/signups.test.cjs`, `node prayer-app/backend/tournaments.test.cjs`, the existing prayer/hub regression tests, and browser verification of both displays. The tournament test covers shared allocation, partial-save recovery, privacy, separate publishing switches, scoring, ties, disqualification, cancellation, and closed-event walk-ins. Live test events must be closed, their TV switches disabled, and all synthetic entries marked Test after verification.
