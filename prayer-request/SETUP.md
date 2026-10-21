# Providence Prayer Request — staged public form

The new page lives at https://pbcgodsglory.github.io/church-display/prayer-request/.
It is intentionally **preview-only** until configured. The existing QR code and
Google Apps Script public form are untouched.

## Architecture

Visitor's Safari/Chrome/Samsung browser -> GitHub Pages form -> Cloudflare Worker
(Turnstile verification) -> separate Google Apps Script POST receiver ->
**existing** Prayer Requests spreadsheet, `Requests` tab.

Visitors never open a Google Apps Script page or sign in to Google.
The existing scripts for approval, bulletin, archiving, and manual entry stay as-is.

## One-time deployment (Providence church Google account)

1. Go to https://script.google.com/ and create a **new** standalone project,
   e.g. `PBC Prayer Public Submission Receiver`. Do **not** overwrite the
   existing spreadsheet's bound Apps Script project.
2. Paste [backend/Code.gs](backend/Code.gs) into its Code.gs editor.
3. In **Project Settings -> Script properties**, create
   `APP_SHARED_SECRET` with a freshly generated long random value (at
   least 32 characters). Keep the value private. This same value is saved
   as a Worker secret in step 7.
4. Select **Deploy -> New deployment -> Web app**, execute as **Me**,
   access **Anyone** (not "Anyone with Google account"), and authorize
   with `pbcgodsglory@gmail.com`. Copy the final `/exec` URL; do not use
   `/dev`. Only give this URL to the Worker configuration, not to visitors.
   The receiver writes to the existing spreadsheet ID encoded in Code.gs.
5. Log into https://dash.cloudflare.com/ (a free plan is sufficient).
   Open **Turnstile** and create a widget allowing hostname
   `pbcgodsglory.github.io`. Copy the **public site key** and
   **private secret key** separately.
6. Create a **Cloudflare Worker** (Workers & Pages -> Create -> Worker)
   and paste [backend/cloudflare-worker.js](backend/cloudflare-worker.js).
   Deploy the Worker and copy its HTTPS `workers.dev` URL.
7. In the Worker's **Settings -> Variables and Secrets**, add these as
   **secrets**, not plain text variables:
   - `GOOGLE_SCRIPT_URL` = the deployed Apps Script `/exec` URL from step 4.
   - `APP_SHARED_SECRET` = the same value from step 3.
   - `TURNSTILE_SECRET_KEY` = Turnstile's **private secret key**.
   Save/deploy updated secrets. Never commit secrets to GitHub.
8. Edit [config.js](config.js) on GitHub, setting:
   - `endpoint` to your Worker's `https://…workers.dev/` URL.
   - `turnstileSiteKey` to Turnstile's **public site key**.
   These two values are public by design; they are not passwords.
9. Open the staged page in Safari (regular mode), Chrome (signed into Google),
   and Samsung Internet. Test with a request marked `TEST — please delete`
   and **leave bulletin sharing unchecked**. Ensure it appears once in the
   **Requests** tab with status `New` and `OK for Bulletin = No`.
   Verify that private requests do not appear in **Bulletin Ready**.
   Remove the test entry when finished.

## Before switching

- The **original QR code points straight to the old Apps Script URL**.
  It is not automatically changed by this new website. After the test
  succeeds, regenerate the QR for the new GitHub Pages address and
  update the slide/flyer/printed QR images.
- Update the existing `prayer-app/index.html` home-screen shortcut
  button to open the new form, and consider its `manifest.webmanifest`
  `start_url` if you want the home-screen icon to open it directly.
- Don't remove the existing Apps Script project; it still runs approval,
  bulletin and archive workflows. The old public form can remain available
  until all posted QR codes have been replaced.

## Privacy & reliability notes

- The form doesn't save entered prayers to browser storage.
- The Worker checks Cloudflare Turnstile tokens before forwarding requests,
  and the Google receiver checks a secret only the Worker knows.
- Requests are written to the pre-existing private Google Sheet; the
  GitHub repository contains only the page and source code, **not prayers**.
- The receiver deduplicates submissions using a request UUID.
- Errors are shown instead of claiming a submission was saved when Google
  doesn't confirm success.
- A static GitHub Pages site by itself cannot securely save private
  entries into Google Sheets. The Worker and separate Apps Script receiver
  are required.
