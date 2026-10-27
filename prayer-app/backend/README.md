# Prayer hub integration

The working `/prayer-form/` HTML and `submitPrayerRequests` / `doPost` handlers are unchanged.
The public hub is hosted at `/prayer-app/prayers/` on the church website. Browsers contact the existing Apps Script endpoint with credentials omitted, avoiding Google multi-account navigation problems. The default Apps Script route still serves the original form; its older `?page=hub` UI remains compatible but is no longer linked from the home screen.

## Files in the existing bound Apps Script project

- `Hub.gs`: additive public-list and change-queue functions.
- `HubPage.html`: list and change-request page; uses `google.script.run` for confirmed submissions.
- `Code.gs`: current existing automation with only two hooks: `doGet(e)` routes `page=hub`, and `onEdit(e)` invokes `hubHandleEdit_(e)`.
- `doGet(e)` also serves `hubApi=list` and `hubApi=receipt`; `doPost(e)` routes only `hubPayload` to the existing change-request handler. Original prayer-form payloads keep their existing handling.
- `../prayers/transport.js`: anonymous background GET/POST requests. An opaque POST response is never treated as success; an unguessable change-ID receipt must confirm delivery. Receipt responses contain only a boolean, never requester names or details.

The live spreadsheet stays private. Never publish the entire sheet, Requests tab, or Bulletin Ready tab. Bulletin Ready includes New requests and submitter information; the public API reads Requests and independently requires `OK for Bulletin = Yes`, an active status (not Answered, Remove or Rejected), not completed, and no archive date. It returns only an opaque reference, the person needing prayer, and bulletin wording (or original prayer text). Unspoken always displays as Unspoken. No prayer data is saved in GitHub or the service-worker cache.

## Church review

1. New prayers still arrive in Requests with Review Status New. At the user’s direction, OK for Bulletin = Yes automatically includes active prayers online without a separate approval step. Private requests never appear.
2. Visitor changes enter Change Requests with status Pending. Review the person, action, requester and Details before approving. For an Update, Details becomes both Prayer Request (column F) and Bulletin Wording (column K); edit it first if needed. Unspoken (column G) becomes Yes only when the approved wording is Unspoken, otherwise No.
3. Set Change Requests column H to Approved in the Google Sheets UI. The existing simple onEdit trigger applies the reviewed change. Remove sets the original prayer's status to Remove. Update writes the reason, unspoken flag, and bulletin wording together while preserving consent, review status, admin notes and formulas. The result column records Applied with a timestamp.
4. Rejected does nothing. Other/unlisted prayers, stale targets, and ambiguous duplicates become Needs review. Locate these in Requests manually and mark the queue item Resolved when finished. The visitor cannot approve anything.
5. Completed/archive behavior remains the existing automation. Restoring an archived prayer resets it to New; it returns online automatically if OK for Bulletin is Yes.

Only single-cell UI approvals trigger processing; connector/API edits and bulk pasted approval ranges do not. This deliberately avoids accidentally approving a batch. Public updates do not modify the list until reviewed. Multiple prayers in one submission are distinguished by a fingerprint of the original row; identical duplicate rows require manual review.

## Deployment and rollback

Save the files, preserve the existing deployment URL and access settings, and publish a new version of the existing web app. Do not create a replacement form deployment or replace Index.html. The previous deployment was version 5. Rollback by selecting that version in Manage deployments; roll back the matching GitHub hub commit as well.

The private Change Requests tab has columns: Received At, Change ID, Prayer Reference, Prayer For, Action, Requested By, Details, Review Status, Result. `setupPrayerHub_` documents optional sheet setup; the tab was created through Sheets tools during installation. A synthetic test row is retained as Resolved for an audit trail and contains no real prayer information.

## Validation

Run `node prayer-app/backend/hub.test.cjs`. This checks the public field allowlist, consent/completion/archive filtering and automatic inclusion of New bulletin-permitted requests, unspoken masking, reviewed removals, and stale/private/manual-target rejection. Browser verification also covers confirmed queue receipt and the manual-target approval guard. Existing form content and submission endpoint are compared against the original repository blob before publishing.
