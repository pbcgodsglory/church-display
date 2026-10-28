// Public app notices are managed in a separate tab; all other tracker tabs stay private.
const APP_ANNOUNCEMENT_HEADERS_ = ['Title','Message','Show in App?','Start Date','End Date'];

function announcementDay_(value,timeZone) {
  if (value === '' || value === null || value === undefined) return '';
  if (value instanceof Date && !isNaN(value.getTime()))
    return Utilities.formatDate(value,timeZone,'yyyy-MM-dd');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + 'T00:00:00Z');
    if (!isNaN(date.getTime()) && date.toISOString().slice(0,10) === value) return value;
  }
  return null; // Invalid dates never accidentally publish a notice.
}

function activeAppAnnouncements_(rows,today,timeZone) {
  const notices = [];
  for (const row of rows) {
    if (row[2] !== true) continue;
    const title = typeof row[0] === 'string' ? row[0].trim() : '';
    const message = typeof row[1] === 'string' ? row[1].trim() : '';
    if (!title || !message || title.length>120 || message.length>2000) continue;
    const start = announcementDay_(row[3],timeZone), end = announcementDay_(row[4],timeZone);
    if (start === null || end === null || (start && end && start>end)) continue;
    if ((start && today<start) || (end && today>end)) continue;
    notices.push({title,message}); // Explicit public allowlist only.
    if (notices.length === 3) break; // Sheet order is display priority.
  }
  return notices;
}

function getAppAnnouncements_() {
  const ss = getChurchSpreadsheet_(), sheet = ss.getSheetByName('App Announcements');
  if (!sheet) return [];
  if (sheet.getRange(1,1,1,5).getDisplayValues()[0].join('|') !== APP_ANNOUNCEMENT_HEADERS_.join('|'))
    throw new Error('The app announcement columns have changed.');
  if (sheet.getLastRow()<2) return [];
  const timeZone = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(),timeZone,'yyyy-MM-dd');
  return activeAppAnnouncements_(sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues(),today,timeZone);
}
