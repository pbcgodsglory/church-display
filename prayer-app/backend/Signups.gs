// Reusable sign-ups. Public reads contain event descriptions, availability and UUID receipts only.
const SIGNUP_SPREADSHEET_ID_ = 'REPLACE_WITH_PRIVATE_SIGNUP_SPREADSHEET_ID';
function signupSpreadsheet_() {
  const active=SpreadsheetApp.getActiveSpreadsheet();
  return active&&active.getId()===SIGNUP_SPREADSHEET_ID_?active:SpreadsheetApp.openById(SIGNUP_SPREADSHEET_ID_);
}
const SIGNUP_EVENT_HEADERS_ = ['Event ID','Event name','Sign-up type','When','Where','Details','Sign up by','Open?','Number label','Item or role label','Questions or contact','Sign-up link','Sign-ups received'];
const SIGNUP_HEADERS_ = ['Received At','Signup ID','Event ID','Event','Name','Phone or email','Number','Item or role','Notes','Status','Admin notes','Sign-up type','Partner name','Boat number','Selections JSON','Payment status','Amount paid','Payment date'];
const SIGNUP_OPTION_HEADERS_ = ['Option ID','Event ID','Event','Item or job','Number needed','Shift or details','Reserved','Remaining'];
const SIGNUP_TYPES_ = ['General registration','Items needed','Volunteer jobs','Fishing tournament'];
const SIGNUP_ID_PATTERN_ = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function signupSheet_(name, headers) {
  const sheet=mustGetSheet_(signupSpreadsheet_(),name);
  if(sheet.getRange(1,1,1,headers.length).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('The sign-up columns need attention.');
  return sheet;
}
function signupRows_(name,headers) {const s=signupSheet_(name,headers);return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,headers.length).getValues();}
function signupPublicEvents_(rows,now) {
  const seen=new Set(),duplicates=new Set();rows.forEach(r=>{const id=String(r[0]);if(seen.has(id))duplicates.add(id);seen.add(id);});
  return rows.filter(r=>r[7]===true&&SIGNUP_ID_PATTERN_.test(String(r[0]))&&String(r[1]).trim()&&!duplicates.has(String(r[0]))&&
    (!r[2]||SIGNUP_TYPES_.includes(r[2]))&&((r[6]===''||r[6]===null||r[6]===undefined)||(r[6] instanceof Date&&!isNaN(r[6].getTime())&&r[6].getTime()>now.getTime())))
    .map(r=>({id:String(r[0]),title:String(r[1]),type:r[2]||SIGNUP_TYPES_[0],when:String(r[3]||''),where:String(r[4]||''),details:String(r[5]||''),
      deadline:r[6] instanceof Date?r[6].toISOString():'',numberLabel:String(r[8]||'').trim(),itemLabel:String(r[9]||'').trim(),contact:String(r[10]||'')}));
}
function signupSelections_(raw) {if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list))throw Error('Invalid saved selections');return list;}
function signupOptions_(eventId,optionRows,responses) {
  const used={},seen=new Set();
  responses.filter(r=>r[2]===eventId&&!['Cancelled','Test'].includes(r[9])).forEach(r=>signupSelections_(r[14]).forEach(s=>{
    if(!SIGNUP_ID_PATTERN_.test(String(s.id))||!Number.isInteger(s.quantity)||s.quantity<1)throw Error('Invalid saved selection');
    used[s.id]=(used[s.id]||0)+s.quantity;
  }));
  return optionRows.filter(r=>r[1]===eventId&&String(r[3]).trim()).map(r=>{
    const id=String(r[0]),needed=Number(r[4]);
    if(!SIGNUP_ID_PATTERN_.test(id)||seen.has(id)||!Number.isInteger(needed)||needed<1||needed>10000)throw Error('Check item or job setup');
    seen.add(id);return {id,label:String(r[3]),details:String(r[5]||''),needed,remaining:Math.max(0,needed-(used[id]||0))};
  });
}
function signupEvents_() {
  const events=signupPublicEvents_(signupRows_('Sign Up Events',SIGNUP_EVENT_HEADERS_),new Date());
  if(events.some(e=>['Items needed','Volunteer jobs'].includes(e.type))) {
    const options=signupRows_('Sign Up Options',SIGNUP_OPTION_HEADERS_),responses=signupRows_('Event Signups',SIGNUP_HEADERS_);
    events.forEach(e=>{if(['Items needed','Volunteer jobs'].includes(e.type)){try{e.options=signupOptions_(e.id,options,responses);}catch(error){e.options=[];}}});
  }
  return events;
}
function signupReceipt_(id) {
  if(!SIGNUP_ID_PATTERN_.test(String(id||'')))return {received:false};
  const s=signupSheet_('Event Signups',SIGNUP_HEADERS_);
  const match=s.getLastRow()>1?s.getRange(2,2,s.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext():null;
  if(match){const boat=s.getRange(match.getRow(),14).getValue();return boat?{received:true,boatNumber:Number(boat)}:{received:true};}
  const error=CacheService.getScriptCache().get('signup-error:'+id);
  return error?{received:false,error}:{received:false};
}
function signupReceived_(id){return signupReceipt_(id).received;}
function signupApi_(params) {
  let result;try {
    if(params.signupApi==='events')result={ok:true,events:signupEvents_()};
    else if(params.signupApi==='receipt')result=Object.assign({ok:true},signupReceipt_(params.signupId));
    else result={ok:false};
  }catch(error){result={ok:false};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function signupFail_(message){const error=Error(message);error.signupMessage=true;throw error;}
function signupOptionalText_(v,max,label){return v===''||v===undefined||v===null?'':validatedText_(v,max,label);}
function signupValidated_(p,event) {
  const value={name:validatedText_(p.name,100,'Your name'),contact:validatedText_(p.contact,160,'Phone or email'),notes:signupOptionalText_(p.notes,1000,'Notes'),number:'',item:'',partner:'',selections:[]};
  if(event.type==='General registration') {
    if(event.numberLabel){value.number=Number(p.number);if(!/^\d{1,4}$/.test(String(p.number||''))||value.number<1||value.number>1000)signupFail_('Enter a whole number from 1 to 1000.');}
    if(event.itemLabel)value.item=signupOptionalText_(p.item,300,event.itemLabel);
  } else if(event.type==='Fishing tournament') {
    value.partner=validatedText_(p.partner,100,'Partner name');value.number=2;
  } else {
    if(!Array.isArray(p.selections)||!p.selections.length||p.selections.length>100)signupFail_('Choose at least one available item or job.');
    const seen=new Set(),descriptions=[];
    p.selections.forEach(s=>{
      if(!s||seen.has(s.id)||!Number.isInteger(s.quantity)||s.quantity<1||s.quantity>10000)signupFail_('Check your selected quantities.');
      const option=(event.options||[]).find(o=>o.id===s.id);
      if(!option||s.quantity>option.remaining)signupFail_('Availability has changed. Refresh the choices and select an available quantity.');
      if(event.type==='Volunteer jobs'&&s.quantity!==1)signupFail_('Select one opening per job for each volunteer.');
      seen.add(s.id);value.selections.push({id:s.id,quantity:s.quantity});descriptions.push(option.label+(option.details?' ('+option.details+')':'')+' × '+s.quantity);
    });
    value.item=descriptions.join('\n');value.number=value.selections.reduce((sum,s)=>sum+s.quantity,0);
  }
  return value;
}
function submitEventSignup(payload) {
  if(!payload||typeof payload!=='object'||payload.website||!SIGNUP_ID_PATTERN_.test(String(payload.signupId||''))||!SIGNUP_ID_PATTERN_.test(String(payload.eventId||'')))throw Error('Please reload the sign-up page.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const receipt=signupReceipt_(payload.signupId);if(receipt.received)return Object.assign({success:true},receipt);
    const event=signupEvents_().find(e=>e.id===payload.eventId);if(!event)signupFail_('This sign-up is closed. Please contact the church.');
    const value=signupValidated_(payload,event),sheet=signupSheet_('Event Signups',SIGNUP_HEADERS_);
    // Never reuse a boat number, even for cancelled registrations. The lock serializes simultaneous submissions.
    const boat=event.type==='Fishing tournament'?signupRows_('Event Signups',SIGNUP_HEADERS_).filter(r=>r[2]===event.id).reduce((max,r)=>Math.max(max,Number(r[13])||0),0)+1:'';
    sheet.appendRow([new Date(),payload.signupId,event.id,sheetSafe_(event.title),sheetSafe_(value.name),sheetSafe_(value.contact),value.number,
      sheetSafe_(value.item),sheetSafe_(value.notes),'Received','',event.type,sheetSafe_(value.partner),boat,JSON.stringify(value.selections),boat?'Unpaid':'','','']);
    SpreadsheetApp.flush();CacheService.getScriptCache().remove('signup-error:'+payload.signupId);
    return boat?{success:true,boatNumber:boat}:{success:true};
  }catch(error){
    CacheService.getScriptCache().put('signup-error:'+payload.signupId,error.signupMessage?error.message:'Please check your entries or contact the church.',21600);throw error;
  }finally{lock.releaseLock();}
}
function signupOptionFormulas_(sheet,row) {
  // JSON is written by this server with stable key order; cancelled/test responses release their quantities.
  sheet.getRange(row,7).setFormula('=IF(A'+row+'="","",SUM(ARRAYFORMULA(IF((\'Event Signups\'!$C$2:$C=B'+row+')*(\'Event Signups\'!$J$2:$J<>"Cancelled")*(\'Event Signups\'!$J$2:$J<>"Test"),IFERROR(VALUE(REGEXEXTRACT(\'Event Signups\'!$O$2:$O,CHAR(34)&A'+row+'&CHAR(34)&","&CHAR(34)&"quantity"&CHAR(34)&":([0-9]+)")),0),0))))');
  sheet.getRange(row,8).setFormula('=IF(OR(A'+row+'="",E'+row+'=""),"",MAX(0,E'+row+'-G'+row+'))');
}
function signupHandleEdit_(e) {
  if(!e||!e.range||(e.source&&e.source.getId()!==SIGNUP_SPREADSHEET_ID_)||!['Sign Up Events','Sign Up Options'].includes(e.range.getSheet().getName())||e.range.getLastRow()<2)return;
  const sheet=e.range.getSheet(),lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
  try {
    const first=Math.max(2,e.range.getRow()),last=Math.min(e.range.getLastRow(),sheet.getMaxRows());
    if(sheet.getName()==='Sign Up Events') {
      const all=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),3).getValues();
      for(let row=first;row<=last;row++) {
        const r=sheet.getRange(row,1,1,3).getValues()[0];if(!String(r[1]).trim())continue;let id=String(r[0]);
        if(!SIGNUP_ID_PATTERN_.test(id)||all.some((v,i)=>i+2!==row&&String(v[0])===id)){id=Utilities.getUuid();sheet.getRange(row,1).setValue(id);all[row-2]=[id,r[1],r[2]];}
        if(!r[2])sheet.getRange(row,3).setValue(SIGNUP_TYPES_[0]);
        sheet.getRange(row,12).setValue('https://pbcgodsglory.github.io/church-display/prayer-app/signups/?event='+id);
        sheet.getRange(row,13).setFormula('=COUNTIF(\'Event Signups\'!C2:C,A'+row+')');
        const options=signupSheet_('Sign Up Options',SIGNUP_OPTION_HEADERS_);
        if(options.getLastRow()>1)options.getRange(2,2,options.getLastRow()-1,1).getValues().forEach((v,i)=>{if(v[0]===id)options.getRange(i+2,3).setValue(r[1]);});
      }
    } else {
      const events=signupRows_('Sign Up Events',SIGNUP_EVENT_HEADERS_),all=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),1).getValues();
      const changedEvent=e.range.getColumn()<=3&&e.range.getLastColumn()>=3;
      for(let row=first;row<=last;row++) {
        const r=sheet.getRange(row,1,1,6).getValues()[0];
        if(changedEvent||!r[1]){const matches=events.filter(v=>v[1]===r[2]);sheet.getRange(row,2).setValue(matches.length===1?matches[0][0]:'');}
        if(!String(r[3]).trim())continue;let id=String(r[0]);
        if(!SIGNUP_ID_PATTERN_.test(id)||all.some((v,i)=>i+2!==row&&String(v[0])===id)){id=Utilities.getUuid();sheet.getRange(row,1).setValue(id);all[row-2]=[id];}
        signupOptionFormulas_(sheet,row);
      }
    }
  }finally{lock.releaseLock();}
}
