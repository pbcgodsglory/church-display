# Reusable church sign-ups

The PBC app links to `/prayer-app/signups/`. The existing Apps Script deployment
handles public event descriptions and submissions. Contact details and responses
stay in the private Prayer Request Tracker, in separate sign-up tabs.

## Start another sign-up

1. In **Sign Up Events**, add a row or duplicate an existing row.
2. Change **Event name**, **When**, **Where**, and **Details**.
3. Optionally set **Sign up by** to a date and time in Central time.
4. Enter **Number label** (for example, Number attending) to show a required
   quantity question, or leave it blank to hide that question.
5. Enter **Item or role label** (for example, Dish to bring or Volunteer role)
   to show an optional short-answer question, or leave it blank to hide it.
6. Check **Open?** to list it in the app. Uncheck to close it.

The sheet's edit trigger creates a unique Event ID and direct Sign-up link.
Keep each event's ID unchanged after people start signing up. Duplicate rows
receive their own IDs. Multiple events can be open at once. Editing through an
API does not invoke the edit trigger; supply an ID and link explicitly in that case.

Read names, contact information, quantities, items and notes in **Event Signups**.
Use its filter to select an event. Responses are never listed publicly. Mark
cancelled entries in Status; the received count includes all received submissions.
There are no automatic capacity limits or payment collection.

## Implementation and validation

`Signups.gs` is additive. `Code.gs` has only three hooks: GET routes `signupApi`,
POST routes `signupPayload`, and sheet edits route `signupHandleEdit_`. Existing
prayer and announcement routes remain unchanged. Preserve the live deployment URL.

All new backend functions except the validated submission entrypoint end in `_`.
Only checked, uniquely identified, unexpired events appear. Invalid deadlines
and duplicate IDs fail closed. Responses require a confirmed receipt: an opaque
no-cors POST is never presented as success. Retries use the same UUID. No signup
responses are written to local storage, GitHub or the service-worker cache.

Run `node prayer-app/backend/signups.test.cjs` and
`node prayer-app/signups/transport.test.cjs`, plus the existing church app tests.
