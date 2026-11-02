// Configure only inside the private Apps Script projects. Never commit the real workbook ID.
const TOURNAMENT_SPREADSHEET_ID_ = 'REPLACE_WITH_PRIVATE_TOURNAMENT_SPREADSHEET_ID';
const TOURNAMENT_TEAM_HEADERS_ = ['Event','Boat number','Name','Partner name','Final weight (lb)','Big fish (lb)','Weighed?','Disqualified?','Payment status','Amount paid','Payment date','Phone or email','Private notes','Registration status','Entry ID','Event ID','Received at','Source','Entry check','Place'];
const TOURNAMENT_SETUP_HEADERS_ = ['Event','Pre-tournament TV on?','Results TV on?','Results label','TV message','Pre-tournament TV link','Results TV link','Event ID','Sign-up link','When','Where','Setup check'];
function tournamentBook_(){return SpreadsheetApp.openById(TOURNAMENT_SPREADSHEET_ID_);}
function tournamentSheet_(book,name,headers){
  const s=mustGetSheet_(book,name);
  if(s.getRange(1,1,1,headers.length).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('Check the tournament columns.');
  return s;
}
function tournamentRows_(s,width){return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,width).getValues():[];}
function tournamentEvents_(){
  const rows=signupRows_('Sign Up Events',SIGNUP_EVENT_HEADERS_),seen=new Set(),duplicates=new Set();
  rows.forEach(r=>{if(seen.has(r[0]))duplicates.add(r[0]);seen.add(r[0]);});
  return rows.filter(r=>SIGNUP_ID_PATTERN_.test(String(r[0]))&&r[2]==='Fishing tournament'&&String(r[1]).trim()&&!duplicates.has(r[0]));
}
function tournamentWeight_(v){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>999.99||Math.abs(v*100-Math.round(v*100))>0.000001)return null;
  return Math.round(v*100);
}
function tournamentStandings_(rows,eventId){
  const teams=rows.filter(r=>r[15]===eventId&&SIGNUP_ID_PATTERN_.test(String(r[14]))&&Number.isInteger(r[1])&&r[1]>0&&String(r[2]).trim()&&String(r[3]).trim()&&!['Cancelled','Test'].includes(r[13]));
  const seenIds=new Set(),seenBoats=new Set();
  // Ambiguous identifiers must be corrected privately before publishing.
  teams.forEach(r=>{if(seenIds.has(r[14])||seenBoats.has(r[1]))throw Error('Duplicate tournament entry or boat');seenIds.add(r[14]);seenBoats.add(r[1]);});
  const roster=teams.map(r=>({boatNumber:r[1],name:String(r[2]),partner:String(r[3])})).sort((a,b)=>a.boatNumber-b.boatNumber);
  const weighed=teams.filter(r=>r[6]===true&&r[7]!==true&&tournamentWeight_(r[4])!==null&&(r[5]===''||tournamentWeight_(r[5])!==null))
    .map(r=>({entryId:r[14],boatNumber:r[1],name:String(r[2]),partner:String(r[3]),weight:tournamentWeight_(r[4]),bigFish:r[5]===''?0:tournamentWeight_(r[5])}))
    .sort((a,b)=>b.weight-a.weight||b.bigFish-a.bigFish||a.boatNumber-b.boatNumber);
  let place=0;
  weighed.forEach((t,i)=>{if(!i||t.weight!==weighed[i-1].weight||t.bigFish!==weighed[i-1].bigFish)place=i+1;t.place=place;});
  const maxBig=weighed.reduce((m,t)=>Math.max(m,t.bigFish),0);
  return {roster,weighed,bigFishWinners:maxBig>0?weighed.filter(t=>t.bigFish===maxBig):[]};
}
function tournamentPublic_(eventId,mode){
  if(!SIGNUP_ID_PATTERN_.test(String(eventId||''))||!['pre','results'].includes(mode))return {ok:false};
  const book=tournamentBook_(),setup=tournamentRows_(tournamentSheet_(book,'Tournament Setup',TOURNAMENT_SETUP_HEADERS_),12);
  const match=setup.filter(r=>r[7]===eventId);
  if(match.length!==1||match[0][mode==='pre'?1:2]!==true)return {ok:true,published:false};
  const event=tournamentEvents_().find(e=>e[0]===eventId);if(!event)return {ok:true,published:false};
  const s=match[0],rows=tournamentRows_(tournamentSheet_(book,'Teams',TOURNAMENT_TEAM_HEADERS_),20);
  // A cancelled/test response is suppressed even if the private mirror has not refreshed yet.
  const blocked=new Set(signupRows_('Event Signups',SIGNUP_HEADERS_).filter(r=>r[2]===eventId&&['Cancelled','Test'].includes(r[9])).map(r=>r[1]));
  const standings=tournamentStandings_(rows.filter(r=>!blocked.has(r[14])),eventId);
  const base={ok:true,published:true,title:String(event[1]),when:String(event[3]||''),where:String(event[4]||''),message:String(s[4]||''),updatedAt:new Date().toISOString(),teamCount:standings.roster.length};
  const safe=t=>({boatNumber:t.boatNumber,name:t.name,partner:t.partner,weight:t.weight/100,bigFish:t.bigFish/100,place:t.place});
  return mode==='pre'?Object.assign(base,{teams:standings.roster}):Object.assign(base,{label:s[3]==='Final'?'Final':'Preliminary',weighedCount:standings.weighed.length,standings:standings.weighed.filter(t=>t.place<=10).map(safe),bigFishWinners:standings.bigFishWinners.map(safe)});
}
function tournamentEventSetup_(book,events){
  const setup=tournamentSheet_(book,'Tournament Setup',TOURNAMENT_SETUP_HEADERS_),rows=tournamentRows_(setup,12);
  events.filter(e=>!/^TEST\s*-/i.test(String(e[1]))).forEach(e=>{
    const found=rows.map((r,i)=>r[7]===e[0]?i:-1).filter(i=>i>=0);if(found.length>1)throw Error('Duplicate tournament setup');
    let index=found[0];
    if(index===undefined){index=rows.findIndex(r=>!r[0]&&!r[7]);if(index<0)index=rows.length;const id=String(e[0]),base='https://pbcgodsglory.github.io/church-display/tournament/';
      rows[index]=[e[1],false,false,'Preliminary','',base+'?event='+id+'&mode=pre',base+'?event='+id+'&mode=results',id,'https://pbcgodsglory.github.io/church-display/prayer-app/signups/?event='+id,String(e[3]||''),String(e[4]||''),'Ready'];
      setup.getRange(index+2,1,1,12).setValues([rows[index].map(v=>typeof v==='string'?sheetSafe_(v):v)]);
    }else{
      setup.getRange(index+2,1).setValue(sheetSafe_(e[1]));
      setup.getRange(index+2,10,1,3).setValues([[sheetSafe_(String(e[3]||'')),sheetSafe_(String(e[4]||'')),'Ready']]);
    }
  });
}
// Call only while holding this web project's ScriptLock. Online registrations and walk-ins share it.
function tournamentReconcile_(){
  const book=tournamentBook_(),events=tournamentEvents_(),teams=tournamentSheet_(book,'Teams',TOURNAMENT_TEAM_HEADERS_),responses=signupSheet_('Event Signups',SIGNUP_HEADERS_);
  tournamentEventSetup_(book,events);
  const rows=tournamentRows_(teams,20),signupRows=tournamentRows_(responses,18),known=new Map();
  rows.forEach((r,i)=>{if(r[14]){if(known.has(r[14]))throw Error('Duplicate tournament entry ID');known.set(r[14],i);}});
  signupRows.filter(r=>r[11]==='Fishing tournament'&&r[9]!=='Test'&&!known.has(r[1])).forEach(r=>{
    const row=[r[3],r[13],r[4],r[12],'','',false,false,r[15]||'Unpaid',r[16],r[17],r[5],r[8],r[9],r[1],r[2],r[0],'Online','',''];
    // Fill the next genuinely blank row; validation does not reserve rows.
    let index=rows.findIndex(v=>!v[0]&&!v[2]&&!v[14]);if(index<0)index=rows.length;
    rows[index]=row;known.set(r[1],index);teams.getRange(index+2,1,1,20).setValues([row.map(v=>typeof v==='string'?sheetSafe_(v):v)]);
  });
  const maxBoat={};signupRows.forEach(r=>{if(r[11]==='Fishing tournament')maxBoat[r[2]]=Math.max(maxBoat[r[2]]||0,Number(r[13])||0);});
  rows.forEach(r=>{if(r[15])maxBoat[r[15]]=Math.max(maxBoat[r[15]]||0,Number(r[1])||0);});
  // Repair an interrupted manual save with its original UUID and reserved boat, never a fresh registration.
  const registered=new Set(signupRows.map(r=>r[1]));
  rows.filter(r=>r[17]==='Morning entry'&&SIGNUP_ID_PATTERN_.test(String(r[14]))&&!registered.has(r[14])).forEach(r=>{
    responses.appendRow(tournamentManualResponse_(r));registered.add(r[14]);
  });
  rows.forEach((r,index)=>{
    if(r[14]||(!r[0]&&!r[2]&&!r[3]))return;
    const matches=events.filter(e=>e[1]===r[0]);
    let check=matches.length===1?'':'Choose a unique fishing event in column A.';
    if(!check&&(!String(r[2]).trim()||!String(r[3]).trim()))check='Enter both names to assign a boat.';
    if(check){teams.getRange(index+2,19).setValue(check);return;}
    // Validate all manual text; never convert sheet formulas into executable formula strings.
    let name,partner;try{name=validatedText_(String(r[2]),100,'Name');partner=validatedText_(String(r[3]),100,'Partner name');}
    catch(error){teams.getRange(index+2,19).setValue('Use names of 1 to 100 characters.');return;}
    const event=matches[0],id=Utilities.getUuid(),boat=(maxBoat[event[0]]||0)+1,received=new Date();
    const status=['Received','Confirmed','Cancelled','Test'].includes(r[13])?r[13]:'Confirmed';
    r[2]=name;r[3]=partner;
    r[1]=boat;r[8]=r[8]||'Unpaid';r[13]=status;r[14]=id;r[15]=event[0];r[16]=received;r[17]='Morning entry';r[18]='Ready';
    teams.getRange(index+2,1,1,20).setValues([r.map(v=>typeof v==='string'?sheetSafe_(v):v)]);
    SpreadsheetApp.flush();responses.appendRow(tournamentManualResponse_(r));
    maxBoat[event[0]]=boat;known.set(id,index);signupRows.push([received,id,event[0],'',name,'','','','',status,'','Fishing tournament',partner,boat]);
  });
  // Rankings and checks use exactly the same cents-of-a-pound calculation as the TV.
  const places=new Map();events.forEach(e=>tournamentStandings_(rows,e[0]).weighed.forEach(t=>places.set(t.entryId,t.place)));
  rows.forEach((r,index)=>{if(!r[14])return;
    const event=events.find(e=>e[0]===r[15]);
    let check=!event?'Event ID needs attention.':!String(r[2]).trim()||!String(r[3]).trim()?'Both names are required.':!Number.isInteger(r[1])||r[1]<1?'Boat number needs attention.':r[6]===true&&(tournamentWeight_(r[4])===null||(r[5]!==''&&tournamentWeight_(r[5])===null))?'Enter weights as nonnegative decimal pounds, at most 2 decimals.':'Ready';
    if(event&&r[0]!==event[1])teams.getRange(index+2,1).setValue(sheetSafe_(String(event[1])));
    teams.getRange(index+2,19,1,2).setValues([[check,places.get(r[14])||'']]);
  });
  SpreadsheetApp.flush();
}
function tournamentManualResponse_(r){return [r[16],r[14],r[15],sheetSafe_(String(r[0])),sheetSafe_(String(r[2])),sheetSafe_(String(r[11]||'')),2,'',sheetSafe_(String(r[12]||'')),r[13],'Morning-of entry','Fishing tournament',sheetSafe_(String(r[3])),r[1],'[]',r[8]||'Unpaid',r[9],r[10]];}
function tournamentRefresh_(){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return;try{tournamentReconcile_();}finally{lock.releaseLock();}}
function tournamentEdit_(e){
  if(!e||!e.range||e.source.getId()!==TOURNAMENT_SPREADSHEET_ID_||e.range.getSheet().getName()!=='Teams'||e.range.getLastRow()<2)return;
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const sheet=e.range.getSheet(),first=Math.max(2,e.range.getRow()),last=e.range.getLastRow();
    const responses=signupSheet_('Event Signups',SIGNUP_HEADERS_),sourceRows=tournamentRows_(responses,18);
    for(let row=first;row<=last;row++){
      const r=sheet.getRange(row,1,1,20).getValues()[0];if(!r[14])continue;
      const i=sourceRows.findIndex(v=>v[1]===r[14]);if(i<0)continue;
      const original=sourceRows[i];
      // Restore generated identifiers/boats if an organizer accidentally edits them.
      sheet.getRange(row,2).setValue(original[13]);sheet.getRange(row,16).setValue(original[2]);
      if(!String(r[2]).trim()||!String(r[3]).trim()){sheet.getRange(row,19).setValue('Both names are required.');continue;}
      responses.getRange(i+2,5,1,2).setValues([[sheetSafe_(validatedText_(String(r[2]),100,'Name')),sheetSafe_(String(r[11]||''))]]);
      responses.getRange(i+2,13).setValue(sheetSafe_(validatedText_(String(r[3]),100,'Partner name')));
      if(['Received','Confirmed','Cancelled','Test'].includes(r[13]))responses.getRange(i+2,10).setValue(r[13]);
      responses.getRange(i+2,16,1,3).setValues([[r[8],r[9],r[10]]]);
    }
    tournamentReconcile_();
  }finally{lock.releaseLock();}
}
// Run privately once from the editor, then retain only the underscore-private functions in the deployment.
function setupTournamentAutomation_(){
  const triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(t=>t.getHandlerFunction()==='tournamentRefresh_'))ScriptApp.newTrigger('tournamentRefresh_').timeBased().everyMinutes(1).create();
  if(!triggers.some(t=>t.getHandlerFunction()==='tournamentEdit_'&&t.getTriggerSourceId()===TOURNAMENT_SPREADSHEET_ID_))ScriptApp.newTrigger('tournamentEdit_').forSpreadsheet(TOURNAMENT_SPREADSHEET_ID_).onEdit().create();
  tournamentRefresh_();
}
