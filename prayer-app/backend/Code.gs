/**
 * Providence Baptist Church — Prayer Request Web App & Tracker
 *
 * INSTALLATION (from the church Prayer Request Tracker sheet):
 * 1. Extensions > Apps Script. Replace Code.gs with this file.
 * 2. Add an HTML file named Index; paste the included Index.html.
 * 3. Save, select setupPrayerRequestAutomation, click Run, authorize once.
 * 4. Deploy > New deployment > Web app. Execute as Me; access Anyone.
 *
 * The sheet remains PRIVATE. The public web app accepts requests; it does not
 * return prayer requests or sheet contents. Admin functions are sheet-side.
 *
 * HOW ARCHIVING WORKS:
 *  - Requests column L (Completed?): checking TRUE moves the request to
 *    Archived Requests, storing the archive date in column M.
 *  - Archived Requests column L: unchecking FALSE restores the request to
 *    Requests, resets review status to New, and clears its archive date.
 *  - A daily trigger permanently deletes archive rows 7 full days after
 *    they were archived. Those deleted entries cannot be restored here.
 *  - Manual Entry B9: checking TRUE saves one new request to Requests.
 */

const PRAYER_SPREADSHEET_ID = '1O6KRr18tJTpkfcnCKiASGZohkHs2xy5_Dcm_Y4-aW7s';
const PRAYER_SHEET_NAME = 'Requests';
const ARCHIVED_SHEET_NAME = 'Archived Requests';
const MANUAL_SHEET_NAME = 'Manual Entry';
const ARCHIVE_AFTER_DAYS = 7;
const PRAYER_HEADERS = [
  'Submitted At', 'Submission ID', 'Submitted By', 'Prayer For',
  'For Whom', 'Prayer Request', 'Unspoken', 'OK for Bulletin',
  'Review Status', 'Admin Notes', 'Bulletin Wording',
  'Completed?', 'Archived At'
];

// Column positions are 1-based; keep in sync with the spreadsheet.
const COMPLETED_COLUMN = 12; // L
const ARCHIVED_AT_COLUMN = 13; // M

function doGet(e) {
  if (e && e.parameter && e.parameter.hubApi) return hubApi_(e.parameter);
  if (e && e.parameter && e.parameter.page === 'hub') return hubPage_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Prayer Request | Providence Baptist Church')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Public entrypoint for the church website. Never returns sheet contents. */
function submitPrayerRequests(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Please complete the prayer request form.');
  }
  // Honeypot: legitimate visitors never interact with this hidden field.
  if (payload.website) {
    throw new Error('Unable to submit this request.');
  }

  const submittedBy = validatedText_(payload.submittedBy, 100, 'Your name');
  if (!Array.isArray(payload.requests) ||
      payload.requests.length < 1 || payload.requests.length > 25) {
    throw new Error('Please enter between 1 and 25 prayer requests.');
  }

  const submissionId = Utilities.getUuid();
  const now = new Date();
  const entries = payload.requests.map(function(request, index) {
    if (!request || typeof request !== 'object') {
      throw new Error('Please check prayer request ' + (index + 1) + '.');
    }
    const forWhom = request.forWhom;
    if (forWhom !== 'self' && forWhom !== 'other') {
      throw new Error('Choose who needs prayer for request ' + (index + 1) + '.');
    }
    const prayerFor = forWhom === 'self'
      ? submittedBy
      : validatedText_(request.prayerFor, 120,
          'Name for prayer request ' + (index + 1));
    const unspoken = request.unspoken === true;
    const details = unspoken ? 'Unspoken'
      : validatedText_(request.details, 2000, 'Prayer request ' + (index + 1));

    return makeRow_(now, submissionId, submittedBy, prayerFor,
      forWhom === 'self' ? 'Myself' : 'Someone else', details,
      unspoken, request.bulletinConsent === true);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = getChurchSpreadsheet_();
    if (!spreadsheet) throw new Error('The form is not connected to the church sheet.');
    const sheet = mustGetSheet_(spreadsheet, PRAYER_SHEET_NAME);
    assertHeaders_(sheet);
    appendRows_(sheet, entries);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return {success: true, count: entries.length};
}

/**
 * Handles admin edits ONLY inside the private Google Sheet.
 * A checkbox click triggers this; a web-form submission will not.
 */
function onEdit(e) {
  hubHandleEdit_(e);
  if (!e || !e.range || e.range.getNumRows() !== 1 ||
      e.range.getNumColumns() !== 1) return;

  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const column = range.getColumn();
  if (row < 2) return;

  let operation = '';
  const name = sheet.getName();
  if (name === PRAYER_SHEET_NAME && column === COMPLETED_COLUMN &&
      range.getValue() === true) operation = 'archive';
  if (name === ARCHIVED_SHEET_NAME && column === COMPLETED_COLUMN &&
      range.getValue() === false) operation = 'restore';
  if (name === MANUAL_SHEET_NAME && row === 9 && column === 2 &&
      range.getValue() === true) operation = 'manual';
  if (!operation) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Another request is processing. Please retry this checkbox.',
      'Prayer requests', 8);
    range.setValue(operation === 'restore');
    return;
  }
  try {
    const spreadsheet = e.source || SpreadsheetApp.getActiveSpreadsheet();
    if (operation === 'archive') archiveRow_(spreadsheet, row);
    else if (operation === 'restore') restoreRow_(spreadsheet, row);
    else saveManualRequest_(spreadsheet);
  } catch (error) {
    // Leave the item visible for manual correction instead of silently losing it.
    if (operation === 'manual') sheet.getRange('B9').setValue(false);
    else if (operation === 'archive') sheet.getRange(row, COMPLETED_COLUMN).setValue(false);
    else if (operation === 'restore') sheet.getRange(row, COMPLETED_COLUMN).setValue(true);
    SpreadsheetApp.getActiveSpreadsheet().toast(error.message || String(error),
      'Prayer request not saved', 10);
    console.error(error);
  } finally {
    lock.releaseLock();
  }
}

function archiveRow_(spreadsheet, sourceRow) {
  const requests = mustGetSheet_(spreadsheet, PRAYER_SHEET_NAME);
  const archive = mustGetSheet_(spreadsheet, ARCHIVED_SHEET_NAME);
  assertHeaders_(requests);
  assertHeaders_(archive);

  if (sourceRow > requests.getLastRow()) return;
  const data = requests.getRange(sourceRow, 1, 1, PRAYER_HEADERS.length)
    .getValues()[0];
  if (data[COMPLETED_COLUMN - 1] !== true) return;
  data[ARCHIVED_AT_COLUMN - 1] = new Date();

  appendRows_(archive, [data]); // Copy FIRST; remove source only after success.
  requests.deleteRow(sourceRow);
  spreadsheet.toast('Prayer request moved to Archived Requests.',
    'Archived', 5);
}

function restoreRow_(spreadsheet, sourceRow) {
  const archive = mustGetSheet_(spreadsheet, ARCHIVED_SHEET_NAME);
  const requests = mustGetSheet_(spreadsheet, PRAYER_SHEET_NAME);
  assertHeaders_(archive);
  assertHeaders_(requests);

  if (sourceRow > archive.getLastRow()) return;
  const data = archive.getRange(sourceRow, 1, 1, PRAYER_HEADERS.length)
    .getValues()[0];
  if (data[COMPLETED_COLUMN - 1] !== false) return;
  data[COMPLETED_COLUMN - 1] = false;
  data[ARCHIVED_AT_COLUMN - 1] = '';
  data[8] = 'New'; // Require fresh approval before returning to bulletin.

  appendRows_(requests, [data]); // Copy FIRST; remove archive row only after success.
  archive.deleteRow(sourceRow);
  spreadsheet.toast('Restored to Requests. Review status is New.',
    'Request restored', 6);
}

function saveManualRequest_(spreadsheet) {
  const form = mustGetSheet_(spreadsheet, MANUAL_SHEET_NAME);
  const requests = mustGetSheet_(spreadsheet, PRAYER_SHEET_NAME);
  assertHeaders_(requests);
  const values = form.getRange('B3:B9').getValues().map(function(row) {
    return row[0];
  });
  const submittedBy = validatedText_(String(values[0] || ''), 100, 'Requested By');
  const forWhom = values[2];
  if (forWhom !== 'Myself' && forWhom !== 'Someone else') {
    throw new Error('Please select Myself or Someone else.');
  }
  const prayerFor = forWhom === 'Myself' ? submittedBy
    : validatedText_(String(values[1] || ''), 120, 'Prayer For');
  const unspoken = values[4] === true;
  const details = unspoken ? 'Unspoken'
    : validatedText_(String(values[3] || ''), 2000, 'Prayer Request');
  const consent = values[5] === true;

  appendRows_(requests, [makeRow_(new Date(), Utilities.getUuid(),
    submittedBy, prayerFor, forWhom, details, unspoken, consent)]);

  // Clear ONLY after the request has been saved; preserve input validation.
  form.getRange('B3:B4').clearContent();
  form.getRange('B5').setValue('Myself');
  form.getRange('B6').clearContent();
  form.getRange('B7:B9').setValues([[false], [false], [false]]);
  spreadsheet.toast('Manual request saved to Requests for review.',
    'Request added', 6);
}

/**
 * RUN THIS ONCE in Extensions > Apps Script while signed in as the church
 * account. The daily cleanup schedule is created on that account.
 */
function setupPrayerRequestAutomation() {
  const spreadsheet = getChurchSpreadsheet_();
  if (!spreadsheet) throw new Error('Open the script from the church Google Sheet.');
  [PRAYER_SHEET_NAME, ARCHIVED_SHEET_NAME, MANUAL_SHEET_NAME].forEach(function(name) {
    mustGetSheet_(spreadsheet, name);
  });
  assertHeaders_(mustGetSheet_(spreadsheet, PRAYER_SHEET_NAME));
  assertHeaders_(mustGetSheet_(spreadsheet, ARCHIVED_SHEET_NAME));
  const name = 'runDailyArchiveCleanup_';
  const alreadyInstalled = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === name;
  });
  if (!alreadyInstalled) {
    ScriptApp.newTrigger(name).timeBased().everyDays(1).atHour(2).create();
  }
  spreadsheet.toast(alreadyInstalled
      ? 'The daily archive cleanup is already active.'
      : 'Daily archive cleanup installed successfully.',
    'Prayer Requests', 8);
}

/** Invoked daily by Apps Script. Names ending _ are hidden from web clients. */
function runDailyArchiveCleanup_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = getChurchSpreadsheet_();
    const archive = mustGetSheet_(spreadsheet, ARCHIVED_SHEET_NAME);
    assertHeaders_(archive);
    const last = archive.getLastRow();
    if (last < 2) return;
    const cutoffMs = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const dates = archive.getRange(2, ARCHIVED_AT_COLUMN,
      last - 1, 1).getValues();
    // Delete bottom-up so row numbers cannot drift during deletion.
    for (let i = dates.length - 1; i >= 0; i--) {
      const archivedAt = dates[i][0];
      if (archivedAt instanceof Date && !isNaN(archivedAt.getTime()) &&
          archivedAt.getTime() <= cutoffMs) {
        archive.deleteRow(i + 2);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// Use the bound sheet when possible. Scheduled runs may have no active UI.
function getChurchSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PRAYER_SPREADSHEET_ID);
}

// Internal helpers are not callable from the public form.
function appendRows_(sheet, entries) {
  if (!entries || !entries.length) return;

  // Preformatted checkbox columns can make getLastRow() report hundreds of
  // apparently occupied rows, even though no prayer requests are in them.
  // Use column A (the required submission timestamp) to find free space.
  const last = sheet.getLastRow();
  let first = 2;
  if (last >= 2) {
    const timestamps = sheet.getRange(2, 1, last - 1, 1).getValues();
    let freeRun = 0;
    let found = false;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i][0] === '' || timestamps[i][0] === null) {
        freeRun++;
        if (freeRun === entries.length) {
          first = i + 3 - entries.length;
          found = true;
          break;
        }
      } else {
        freeRun = 0;
      }
    }
    if (!found) first = last + 1;
  }

  const neededLastRow = first + entries.length - 1;
  if (neededLastRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(),
      neededLastRow - sheet.getMaxRows());
  }
  sheet.getRange(first, COMPLETED_COLUMN, entries.length, 1)
    .insertCheckboxes();
  sheet.getRange(first, 1, entries.length, PRAYER_HEADERS.length)
    .setValues(entries);
}

function mustGetSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet tab: ' + sheetName);
  return sheet;
}

function assertHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, PRAYER_HEADERS.length)
    .getDisplayValues()[0];
  if (actual.join('|') !== PRAYER_HEADERS.join('|')) {
    throw new Error('The ' + sheet.getName() + ' columns have changed. ' +
      'Please contact the church administrator.');
  }
}

function makeRow_(date, submissionId, submittedBy, prayerFor,
    forWhom, details, unspoken, forBulletin) {
  return [date, submissionId, sheetSafe_(submittedBy), sheetSafe_(prayerFor),
    forWhom, sheetSafe_(details), unspoken ? 'Yes' : 'No',
    forBulletin ? 'Yes' : 'No', 'New', '', '', false, ''];
}

function validatedText_(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error(field + ' is required.');
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (!cleaned) throw new Error(field + ' is required.');
  if (cleaned.length > maxLength) {
    throw new Error(field + ' is too long (maximum ' + maxLength + ' characters).');
  }
  return cleaned;
}

// Prevent malicious/freeform names and notes becoming spreadsheet formulas.
function sheetSafe_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

/**
 * TEST-ONLY ADDITION TO EXISTING Code.gs
 *
 * Paste this function at the end of the church's existing Code.gs; do not
 * replace or delete any of the working functions.
 * Redeploy the existing Apps Script web app as a NEW VERSION (same deployment
 * URL) with Execute as: Me and access: Anyone.
 * Existing submitPrayerRequests(payload) continues enforcing validation,
 * appending rows, and respecting bulletin flags.
 *
 * Note: GitHub Pages fetch with mode:no-cors cannot inspect the Apps Script
 * response. Only the new row in Requests verifies delivery.
 */
function doPost(e) {
  try {
    if (e && e.parameter && e.parameter.hubPayload) {
      return ContentService.createTextOutput(JSON.stringify(submitHubChange(JSON.parse(e.parameter.hubPayload))))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (!e || !e.parameter || !e.parameter.payload) {
      throw new Error('Missing prayer request data.');
    }
    var data = JSON.parse(e.parameter.payload);
    var result = submitPrayerRequests(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: String(error && error.message || error)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
