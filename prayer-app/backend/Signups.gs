// Reusable event sign-ups. Only event descriptions and boolean receipts are public.
const SIGNUP_EVENT_HEADERS_ = ['Event ID','Event name','When','Where','Details','Sign up by','Open?','Number label','Item or role label','Questions or contact','Sign-up link','Sign-ups received'];
const SIGNUP_HEADERS_ = ['Received At','Signup ID','Event ID','Event','Name','Phone or email','Number','Item or role','Notes','Status','Admin notes'];
const SIGNUP_ID_PATTERN_ = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function signupSheet_(name, headers) {
  const sheet = mustGetSheet_(getChurchSpreadsheet_(),name);
  if (sheet.getRange(1,1,1,headers.length).getDisplayValues()[0].join('|') !== headers.join('|'))
    throw new Error('The sign-up columns need attention. Please contact the church.');
  return sheet;
}

function signupPublicEvents_(rows, now) {
  const seen = new Set(), duplicates = new Set();
  rows.forEach(r=>{const id=String(r[0]);if(seen.has(id))duplicates.add(id);seen.add(id);});
  return rows.filter(r=>{
    if (r[6] !== true || !SIGNUP_ID_PATTERN_.test(String(r[0])) || !String(r[1]).trim() || duplicates.has(String(r[0]))) return false;
    if (r[5] !== '' && r[5] !== null && r[5] !== undefined) {
      if (!(r[5] instanceof Date) || isNaN(r[5].getTime()) || r[5].getTime() <= now.getTime()) return false;
    }
    return true;
  }).map(r=>({id:String(r[0]),title:String(r[1]),when:String(r[2] || ''),where:String(r[3] || ''),details:String(r[4] || ''),
    deadline:r[5] instanceof Date ? r[5].toISOString() : '',numberLabel:String(r[7] || '').trim(),itemLabel:String(r[8] || '').trim(),contact:String(r[9] || '')}));
}

function signupEvents_() {
  const sheet=signupSheet_('Sign Up Events',SIGNUP_EVENT_HEADERS_);
  return signupPublicEvents_(sheet.getLastRow()<2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues(),new Date());
}

function signupReceived_(id) {
  if (!SIGNUP_ID_PATTERN_.test(String(id || ''))) return false;
  const sheet=signupSheet_('Event Signups',SIGNUP_HEADERS_);
  return sheet.getLastRow()>1 && !!sheet.getRange(2,2,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
}

function signupApi_(params) {
  let result;
  try {
    if(params.signupApi==='events') result={ok:true,events:signupEvents_()};
    else if(params.signupApi==='receipt') result={ok:true,received:signupReceived_(params.signupId)};
    else result={ok:false};
  } catch(error) { result={ok:false}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function signupOptionalText_(value,max,label) {
  if(value==='' || value===undefined || value===null) return '';
  return validatedText_(value,max,label);
}

function signupValidated_(payload,event) {
  const name=validatedText_(payload.name,100,'Your name');
  const contact=validatedText_(payload.contact,160,'Phone or email');
  const notes=signupOptionalText_(payload.notes,1000,'Notes');
  let number='',item='';
  if(event.numberLabel) {
    if(!/^\d{1,4}$/.test(String(payload.number || ''))) throw new Error('Enter a whole number from 1 to 1000.');
    number=Number(payload.number);
    if(number<1 || number>1000) throw new Error('Enter a whole number from 1 to 1000.');
  }
  if(event.itemLabel) item=signupOptionalText_(payload.item,300,event.itemLabel);
  return {name,contact,notes,number,item};
}

function submitEventSignup(payload) {
  if(!payload || typeof payload!=='object' || payload.website || !SIGNUP_ID_PATTERN_.test(String(payload.signupId || '')) || !SIGNUP_ID_PATTERN_.test(String(payload.eventId || '')))
    throw new Error('Please reload the sign-up page and try again.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    // Repeated attempts with the same unguessable ID never create duplicate rows.
    if(signupReceived_(payload.signupId)) return {success:true};
    const event=signupEvents_().find(e=>e.id===payload.eventId);
    if(!event) throw new Error('This sign-up is closed. Please contact the church.');
    const value=signupValidated_(payload,event);
    const sheet=signupSheet_('Event Signups',SIGNUP_HEADERS_);
    sheet.appendRow([new Date(),payload.signupId,event.id,sheetSafe_(event.title),sheetSafe_(value.name),sheetSafe_(value.contact),value.number,
      sheetSafe_(value.item),sheetSafe_(value.notes),'Received','']);
    SpreadsheetApp.flush();
    return {success:true};
  } finally {lock.releaseLock();}
}

// IDs and links are maintained for each new event or duplicated template row.
function signupHandleEdit_(e) {
  if(!e || !e.range || e.range.getSheet().getName()!=='Sign Up Events' || e.range.getLastRow()<2) return;
  const sheet=e.range.getSheet(),lock=LockService.getScriptLock();
  if(!lock.tryLock(5000)) return;
  try {
    const first=Math.max(2,e.range.getRow()),last=Math.min(e.range.getLastRow(),sheet.getMaxRows());
    const all=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),2).getValues();
    for(let row=first;row<=last;row++) {
      const values=sheet.getRange(row,1,1,2).getValues()[0];
      if(!String(values[1]).trim()) continue;
      let id=String(values[0]);
      if(!SIGNUP_ID_PATTERN_.test(id) || all.some((r,i)=>i+2!==row && String(r[0])===id)) {
        id=Utilities.getUuid();sheet.getRange(row,1).setValue(id);all[row-2]=[id,values[1]];
      }
      sheet.getRange(row,11).setValue('https://pbcgodsglory.github.io/church-display/prayer-app/signups/?event='+id);
      sheet.getRange(row,12).setFormula('=COUNTIF(\'Event Signups\'!C2:C,A'+row+')');
    }
  } finally {lock.releaseLock();}
}
