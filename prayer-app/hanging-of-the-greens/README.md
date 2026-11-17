# Hanging of the Greens — first draft

This adds a church-link entry in `prayer-app/index.html` and a mobile accordion at `prayer-app/hanging-of-the-greens/`. Reader mode uses a native modal dialog, large adjustable text (22–44 px), Previous/Next, keyboard Escape, and focus restoration. Names, passages and cues are rendered as text, never HTML.

## Editable master and Excel copy

The editable master is [Hanging of the Greens — Readings](https://docs.google.com/spreadsheets/d/1-SbizKHUYtgFZz-L6CDAOy2ucwC7_Z4hAE3ewDVD9zk/edit). PBC owns it. It is in **PBC App / Announcements**, along with a separate Excel copy. Edit the Google Sheet's `Readings` tab: A1:E14, headers **Order, Title, Reader, Reading, Stage Instructions**. Keep exactly 13 rows with unique Order values 1–13. Reader cells start blank. Keep paragraphs separated by blank lines. The Excel copy is a snapshot and does not sync to the app.

The original [Reading Passages document](https://docs.google.com/document/d/14AeBERMtAsgLj6SBkrr7WRtoG5fgmcFrrtHz_GRsLgA/edit) is unchanged. All nonblank source paragraphs are preserved, with only surrounding whitespace and excess blank lines normalized. The 13 titles retain the source spelling, including **Commision & Blessing**. Existing Bart/Jimmy Swafford/Congregation labels remain in the spoken text; the new Reader column is a separate assignment field. Review those names for this year's service.

Seven decorating, music, or scripture cues are separated into Stage Instructions. The Advent scripture instruction **Read Romans 15:13** originally occurs before its final sentence; the page labels that timing separately. The source does not supply the verse text. Other source wording, scripture references, and historical claims have not been rewritten or corrected.

## Preview and connection status

`config.js` starts with `draft: true` and no endpoint. It displays the clearly labeled `draft.json` snapshot. **Google Sheet edits do not appear until the endpoint is deployed and configured.** Once an endpoint is configured, errors never silently fall back to the draft snapshot. Refresh retains an already displayed reading with an explicit stale warning. No service-worker cache covers this section.

## Enable the live, read-only connection

1. While signed in as **pbcgodsglory@gmail.com**, open the prepared, Sheet-bound [PBC — Hanging of the Greens (read only) project](https://script.google.com/home/projects/1KtJRt2pL0tIHDFlhFbi9eWtKtwbOWK9CHzCOtZO-mZxKBF7ynXu10VCr/edit). It is separate from the prayer app's script and deployment.
2. `backend/Code.gs` and `backend/appsscript.json` are already saved there. The only OAuth scope is `spreadsheets.readonly`. Google authorization still covers reading spreadsheets on the account; code pins access to this dedicated spreadsheet and tab. The user approved the public read-only feed on November 17, 2026. Deployment now awaits Google's **Authorize access** step in the prepared project. The owner must complete that permission prompt; the connection is not live yet.
3. Authorize the project as the PBC owner, then create a Web app deployment: **Execute as Me**, access **Anyone**. The public output consists only of the five service fields. Leave the Google Sheet private; grant edit access individually only to intended editors. There are no browser credentials and no write API. Anyone who can view the app can view the readings, reader names and stage cues, so keep private notes elsewhere.
4. Copy the deployment's `/exec` URL into `config.js` as `endpoint`, and set `draft: false`. No token or secret belongs in this file. Do not use an editor or `/dev` URL.
5. From the preview's actual origin, verify it loads 13 sections, change a Reader cell in Sheets and press **Refresh readings** to confirm the update, then restore the test assignment. Also test a failed request: the page must show its unavailable/stale message. Apps Script Content Service follows a redirect; allow that redirect in any hosting proxy. If the hosting origin cannot read the response due to CORS, put a GET-only server proxy in front of the fixed deployment and adjust the endpoint allowlist in `app.js` to that exact HTTPS origin/path. Never use `no-cors` or JSONP as a substitute for verified data.
6. After the preview is approved and the real connection passes, merge the draft branch to `main` for the existing GitHub Pages deployment. The cache version bump lets installed PBC apps pick up the new home entry. Reopen or refresh the installed app.

Google's [Web Apps guide](https://developers.google.com/apps-script/guides/web), [Content Service guide](https://developers.google.com/apps-script/guides/content), and [OAuth scopes guide](https://developers.google.com/apps-script/concepts/scopes) describe deployment and authorization.

## Checks

Run `node --test prayer-app/hanging-of-the-greens/backend/readings.test.cjs` from the repository root. All five tests pass: fixed read target, all 13 rows, sorting, Reader/Reading updates, invalid content, rejection of POST writes, and read-only scope. The draft content was reconciled field-for-field against the Google Sheet, and all 72 nonblank source paragraphs were reconciled against the extracted document. Chrome verification confirmed all 13 rendered titles, passages and cues match the source rows; the phone-width page had no horizontal overflow. Accordion opening/closing, reader text sizing, Next navigation, Escape and focus return were verified. Live endpoint authorization and Sheet-to-app refresh require step 5 above.

