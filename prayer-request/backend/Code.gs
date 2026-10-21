/**
 * Providence Baptist Church — receive prayer requests from the Cloudflare Worker.
 * Keep this code in a NEW, separate Apps Script project. Do not replace the church's
 * existing spreadsheet automation (approval, bulletin, archive, manual entry).
 *
 * Project Settings > Script properties:
 *   APP_SHARED_SECRET = same long random string saved as the Worker secret.
 *
 * Deploy > New deployment > Web app:
 *   Execute as: Me (the church Google account)
 *   Who has access: Anyone
 *
 * The public browser never loads this web app. Only the Worker sends requests here.
 */
const PBC_SPREADSHEET_ID = '1O6KRr18tJTpkfcnCKiASGZohkHs2xy5_Dcm_Y4-aW7s';
function doPost(e) {
  const json = data => ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ok:false});
    const p = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('APP_SHARED_SECRET');
    if (!expected || p.auth !== expected) return json({ok:false});
    const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0,max) : '';
    const submittedBy = clean(p.submittedBy,120);
    const prayerFor = clean(p.prayerFor,80);
    const forWhom = clean(p.forWhom,120);
    const prayerRequest = clean(p.prayerRequest,4000);
    const unspoken = p.unspoken === true;
    const bulletin = p.bulletin === true;
    const requestId = clean(p.requestId,60);
    if (!prayerFor || (!unspoken && !prayerRequest) || !/^[a-f0-9-]{36}$/i.test(requestId)) {
      return json({ok:false});
    }
    // Preserve spreadsheet values as literal text, not formulas supplied by visitors.
    const safe = v => /^[=+@\-\t\r]/.test(v) ? "'" + v : v;
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = SpreadsheetApp.openById(PBC_SPREADSHEET_ID).getSheetByName('Requests');
      if (!sheet) return json({ok:false});
      const n = sheet.getLastRow();
      if (n > 1) {
        const finder = sheet.getRange(2,2,n-1,1).createTextFinder(requestId).matchEntireCell(true).findNext();
        if (finder) return json({ok:true}); // Idempotent retry.
      }
      sheet.appendRow([
        new Date(), requestId, safe(submittedBy), safe(prayerFor), safe(forWhom),
        safe(unspoken ? 'Unspoken' : prayerRequest),
        unspoken ? 'Yes' : 'No', bulletin ? 'Yes' : 'No',
        'New', '', '', false, ''
      ]);
      SpreadsheetApp.flush();
      return json({ok:true});
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // No visitor-provided prayer content is logged.
    console.error('Prayer submission failed: ' + String(err).slice(0,120));
    return json({ok:false});
  }
}
