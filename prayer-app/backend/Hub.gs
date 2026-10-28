// Additive hub extension. Keep existing submission/archive functions unchanged.
const HUB_CHANGE_HEADERS_ = ['Received At','Change ID','Prayer Reference','Prayer For','Action','Requested By','Details','Review Status','Result'];

// Anonymous data transport for the church-hosted page. Never returns private rows.
function hubApi_(p) {
  let result;
  try {
    if (p.hubApi === 'list') result = {ok:true,prayers:getHubPrayers()};
    else if (p.hubApi === 'announcements') result = {ok:true,announcements:getAppAnnouncements_()};
    else if (p.hubApi === 'receipt' && /^[a-f0-9-]{36}$/i.test(p.changeId || '')) {
      const queue = hubQueue_(getChurchSpreadsheet_());
      const found = queue.getLastRow()>1 && !!queue.getRange(2,2,queue.getLastRow()-1,1)
        .createTextFinder(p.changeId).matchEntireCell(true).findNext();
      result = {ok:true,received:found};
    } else result = {ok:false};
  } catch(error) { result = {ok:false}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function hubPage_() {
  return HtmlService.createHtmlOutputFromFile('HubPage').setTitle('PBC Prayer List & Changes')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function hubReference_(row) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify([String(row[0]),row[1],row[3],row[5]]))).replace(/=+$/,'');
}

function hubPublicRows_(rows) {
  return rows.filter(r => r[1] && r[7] === 'Yes' && !['Answered','Remove','Rejected'].includes(r[8]) && r[11] !== true && !r[12])
    .map(r => ({id:hubReference_(r),name:String(r[3]),text:r[6] === 'Yes' ? 'Unspoken' : String(r[10] || r[5])}));
}

// Public API returns active, bulletin-permitted entries; no separate approval is required.
function getHubPrayers() {
  const sheet = mustGetSheet_(getChurchSpreadsheet_(), PRAYER_SHEET_NAME);
  assertHeaders_(sheet);
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,13).getValues();
  return hubPublicRows_(rows);
}

function hubQueue_(ss) {
  const sheet = mustGetSheet_(ss,'Change Requests');
  if (sheet.getRange(1,1,1,9).getDisplayValues()[0].join('|') !== HUB_CHANGE_HEADERS_.join('|'))
    throw new Error('The change-request queue needs administrator attention.');
  return sheet;
}

function submitHubChange(p) {
  if (!p || p.website) throw new Error('Unable to submit this request.');
  const name = validatedText_(p.requestedBy,100,'Your name');
  const details = validatedText_(p.details,2000,'Update or reason');
  if (!['Update','Remove'].includes(p.action)) throw new Error('Choose update or removal.');
  if (!/^[a-f0-9-]{36}$/i.test(p.changeId || '')) throw new Error('Please reload and try again.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = getChurchSpreadsheet_(), queue = hubQueue_(ss);
    if (queue.getLastRow()>1 && queue.getRange(2,2,queue.getLastRow()-1,1).createTextFinder(p.changeId).matchEntireCell(true).findNext())
      return {success:true};
    let targetName = '';
    if (p.reference) {
      const matches = getHubPrayers().filter(r=>r.id === p.reference);
      if (matches.length !== 1) throw new Error('This prayer has changed. Reload the list or choose Other request.');
      targetName = matches[0].name;
    } else targetName = validatedText_(p.prayerFor,120,'Person needing prayer');
    queue.appendRow([new Date(),p.changeId,p.reference || '',sheetSafe_(targetName),p.action,sheetSafe_(name),sheetSafe_(details),'Pending','']);
    SpreadsheetApp.flush();
    return {success:true};
  } finally { lock.releaseLock(); }
}

function hubApplyChange_(ss, queue, row) {
  const change = queue.getRange(row,1,1,9).getValues()[0];
  if (change[7] !== 'Approved' || String(change[8]).startsWith('Applied ')) return;
  if (!change[2]) throw new Error('Other request: locate and review the prayer in Requests manually, then mark this queue item Resolved.');
  const sheet = mustGetSheet_(ss,PRAYER_SHEET_NAME); assertHeaders_(sheet);
  const rows = sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),13).getValues();
  const matches = rows.map((data,i)=>({data,row:i+2})).filter(x=>hubReference_(x.data) === change[2]);
  if (matches.length !== 1 || hubPublicRows_([matches[0].data]).length !== 1)
    throw new Error('Prayer is no longer uniquely active and bulletin-permitted. Review it manually in Requests.');
  const target = matches[0];
  if (change[4] === 'Remove') sheet.getRange(target.row,9).setValue('Remove');
  else if (change[4] === 'Update') {
    const wording = validatedText_(String(change[6]),2000,'Approved wording');
    // Write the reason, unspoken flag, and bulletin wording together. Preserve
    // consent, review status, admin notes, and any formulas in those cells.
    const fields = sheet.getRange(target.row,6,1,6);
    const current = fields.getValues()[0], formulas = fields.getFormulas()[0];
    const revised = current.map((value,index)=>formulas[index] || value);
    revised[0] = sheetSafe_(wording);
    revised[1] = /^unspoken$/i.test(wording) ? 'Yes' : 'No';
    revised[5] = sheetSafe_(wording);
    fields.setValues([revised]);
  } else throw new Error('Unknown action.');
  queue.getRange(row,9).setValue('Applied ' + new Date().toISOString());
}

function hubHandleEdit_(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== 'Change Requests') return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1 || e.range.getRow()<2 || e.range.getColumn()!==8 || e.range.getValue()!=='Approved') return;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) { e.range.setValue('Pending'); return; }
  try { hubApplyChange_(e.source,e.range.getSheet(),e.range.getRow()); }
  catch(err) { e.range.setValue('Needs review'); e.range.getSheet().getRange(e.range.getRow(),9).setValue(String(err.message)); }
  finally { lock.releaseLock(); }
}

// Run once from the private editor. Trailing underscore hides setup from web clients.
function setupPrayerHub_() {
  const ss = getChurchSpreadsheet_();
  let queue = ss.getSheetByName('Change Requests');
  if (!queue) {
    queue = ss.insertSheet('Change Requests');
    queue.getRange(1,1,1,9).setValues([HUB_CHANGE_HEADERS_]);
    queue.setFrozenRows(1);
    queue.getRange('H2:H1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Pending','Approved','Rejected','Needs review','Resolved'],true).setAllowInvalid(false).build());
    queue.getRange('A1:I1').setFontWeight('bold').setBackground('#e9edff');
    queue.getRange('G2:G1000').setWrap(true);
    queue.setColumnWidth(7,380); queue.setColumnWidth(9,380);
  }
  hubQueue_(ss);
}
