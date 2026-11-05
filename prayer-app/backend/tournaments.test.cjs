const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const eventId='733bac20-e04d-4f27-98ee-6f677cd98d09',otherEvent='733bac20-e04d-4f27-98ee-6f677cd98d08';
let sequence=0,held=false,failNextAppend=false;const cache=new Map(),uuid=()=>`${String(++sequence).padStart(8,'0')}-1111-4111-8111-111111111111`;
function table(name){const data=[];return {data,getName:()=>name,getLastRow:()=>data.length,getRange(row,col,height=1,width=1){return {
 getRow:()=>row,getLastRow:()=>row+height-1,getColumn:()=>col,getLastColumn:()=>col+width-1,getSheet:()=>this,
 getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>data[row-1+i]?.[col-1+j]??'')),
 getDisplayValues(){return this.getValues().map(r=>r.map(String));},getValue:()=>data[row-1]?.[col-1]??'',
 setValues(rows){assert(held,'all mirror mutations hold the same server lock');rows.forEach((r,i)=>r.forEach((v,j)=>{data[row-1+i]??=[];data[row-1+i][col-1+j]=v;}));return this;},
 setValue(v){return this.setValues([[v]]);},createTextFinder(v){return {matchEntireCell(){return this;},findNext(){const i=data.findIndex(r=>r[col-1]===v);return i<0?null:{getRow:()=>i+1};}}}
 };},appendRow(r){assert(held);if(failNextAppend){failNextAppend=false;throw Error('Temporary append failure');}data.push(r);}};}
const tables=Object.fromEntries(['Teams','Tournament Setup','Sign Up Events','Event Signups','Sign Up Options'].map(n=>[n,table(n)]));
const signupBook={getId:()=> 'test-signups',getSheetByName:n=>tables[n]},tournamentBook={getId:()=> 'test-tournament',getSheetByName:n=>tables[n]};
const ctx={Date,Set,Map,console,Utilities:{getUuid:uuid},SpreadsheetApp:{getActiveSpreadsheet:()=>null,openById:id=>{assert(['test-signups','test-tournament'].includes(id));return id==='test-signups'?signupBook:tournamentBook;},flush(){}},
 LockService:{getScriptLock:()=>({waitLock(){assert(!held);held=true;},tryLock(){assert(!held);held=true;return true;},releaseLock(){assert(held);held=false;}})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},mustGetSheet_:(b,n)=>b.getSheetByName(n),
 validatedText_:(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw Error(label);return v.trim();},sheetSafe_:v=>/^[=+\-@]/.test(v)?"'"+v:v,
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
vm.createContext(ctx);for(const f of ['Signups.gs','Tournaments.gs'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8').replace('REPLACE_WITH_PRIVATE_SIGNUP_SPREADSHEET_ID','test-signups').replace('REPLACE_WITH_PRIVATE_TOURNAMENT_SPREADSHEET_ID','test-tournament'),ctx);
const headers=vm.runInContext('[TOURNAMENT_TEAM_HEADERS_,TOURNAMENT_SETUP_HEADERS_,SIGNUP_EVENT_HEADERS_,SIGNUP_HEADERS_,SIGNUP_OPTION_HEADERS_]',ctx);
Object.keys(tables).forEach((n,i)=>tables[n].data.push(Array.from(headers[i])));
// Native checkbox validation seeds FALSE in otherwise empty rows.
for(let i=0;i<100;i++)tables['Tournament Setup'].data.push(['',false,false]);
const event=[eventId,'Tournament','Fishing tournament','Saturday','Lake','Details','',true,'','','','',''];tables['Sign Up Events'].data.push(event);
const walkin=Array(20).fill('');Object.assign(walkin,{0:'Tournament',2:'Walk-in Angler',3:'Walk-in Partner',11:'PRIVATE CONTACT',12:'PRIVATE NOTE'});tables.Teams.data.push(walkin);
const online={signupId:uuid(),eventId,name:'Online Angler',partner:'Online Partner',contact:'PRIVATE ONLINE CONTACT',website:''};
assert.equal(ctx.submitEventSignup(online).boatNumber,2,'complete queued walk-in is accepted before the new online submission');
assert.equal(tables.Teams.data[1][1],1);assert.equal(tables.Teams.data[2][1],2);assert.equal(tables['Event Signups'].data.length,3);
ctx.submitEventSignup(online);ctx.tournamentRefresh_();assert.equal(tables.Teams.data.length,3,'retries and reconciliation do not duplicate a team');
assert.equal(JSON.stringify(ctx.tournamentPublic_(eventId,'pre')),JSON.stringify({ok:true,published:false}));
const setup=tables['Tournament Setup'].data[1];setup[1]=true;
let pre=ctx.tournamentPublic_(eventId,'pre');assert.equal(pre.teams.length,2);assert.equal(pre.teams[0].boatNumber,1);
assert(!JSON.stringify(pre).includes('PRIVATE'));assert(!JSON.stringify(pre).includes('Unpaid'));assert(!JSON.stringify(pre).includes('entryId'));
assert.equal(JSON.stringify(ctx.tournamentPublic_(eventId,'results')),JSON.stringify({ok:true,published:false}),'two publishing switches are independent');
setup[2]=true;const a=tables.Teams.data[1],b=tables.Teams.data[2];a[4]=12.33;a[5]=3.44;a[6]=true;b[4]=12.33;b[5]=3.45;b[6]=true;
ctx.tournamentRefresh_();
let heldResult=ctx.tournamentPublic_(eventId,'results');
assert.equal(heldResult.standings.length,0);assert.equal(heldResult.bigFishWinners.length,0);assert.equal(heldResult.weighedCount,0);
assert.equal(ctx.tournamentPublic_(eventId,'pre').teams.length,2,'unpaid weighed teams keep their boat assignments on the pre-tournament list');
assert.match(a[18],/UNPAID/);assert.equal(a[19],'');assert.match(b[18],/UNPAID/);
a[8]='Paid';ctx.tournamentEdit_({source:tournamentBook,range:tables.Teams.getRange(2,9)});
heldResult=ctx.tournamentPublic_(eventId,'results');assert.equal(heldResult.standings.length,1);assert.equal(heldResult.standings[0].boatNumber,1);assert.equal(heldResult.standings[0].place,1);assert.equal(heldResult.bigFishWinners[0].boatNumber,1);
assert.equal(a[18],'Ready');assert.equal(a[19],1);assert.equal(tables['Event Signups'].data[1][15],'Paid');
b[6]=false;ctx.tournamentRefresh_();assert.equal(b[18],'Ready','unpaid entries are flagged only after weighing in');
b[6]=true;b[8]='';ctx.tournamentRefresh_();assert.match(b[18],/UNPAID/,'blank status is treated as unpaid');
for(const status of ['Partial','Waived','Refunded']){b[8]=status;assert.equal(ctx.tournamentPublic_(eventId,'results').standings.length,2,'other payment statuses retain their behavior');}
b[8]='Paid';ctx.tournamentEdit_({source:tournamentBook,range:tables.Teams.getRange(3,9)});
assert.equal(b[18],'Ready');assert.equal(b[19],1);assert.equal(a[19],2,'places recalculate when payment clears');
assert.equal(a[4],12.33);assert.equal(b[4],12.33);assert.equal(a[1],1);assert.equal(b[1],2,'payment changes preserve weights and boats');
assert(!/PRIVATE|Unpaid|payment|entryId/.test(JSON.stringify(ctx.tournamentPublic_(eventId,'results'))),'public results do not disclose payment or private fields');
let result=ctx.tournamentPublic_(eventId,'results');assert.equal(result.standings[0].boatNumber,2);assert.equal(result.standings[0].place,1);assert.equal(result.standings[1].place,2);assert.equal(result.bigFishWinners[0].boatNumber,2);
a[5]=3.45;result=ctx.tournamentPublic_(eventId,'results');assert.deepEqual(Array.from(result.standings,t=>t.place),[1,1]);assert.equal(result.bigFishWinners.length,2);
a[7]=true;assert.equal(ctx.tournamentPublic_(eventId,'results').standings.length,1,'DQ suppresses total and big-fish awards');a[7]=false;
a[4]=12.333;assert.equal(ctx.tournamentPublic_(eventId,'results').standings.length,1,'invalid precision excluded');a[4]=0;a[5]='';assert.equal(ctx.tournamentPublic_(eventId,'results').standings.length,2,'explicit weighed zero is valid');
a[6]=false;assert.equal(ctx.tournamentPublic_(eventId,'results').standings.length,1,'unweighed rows excluded');a[6]=true;
tables['Event Signups'].data[1][9]='Cancelled';assert.equal(ctx.tournamentPublic_(eventId,'pre').teams.length,1,'cancelled source suppressed without waiting for mirror');
tables['Event Signups'].data[1][9]='Confirmed';a[13]='Cancelled';ctx.tournamentEdit_({source:tournamentBook,range:tables.Teams.getRange(2,14)});assert.equal(tables['Event Signups'].data[1][9],'Cancelled');
assert.equal(ctx.submitEventSignup({...online,signupId:uuid()}).boatNumber,3,'cancelled boat is not reused');
event[7]=false;const morning=Array(20).fill('');Object.assign(morning,{0:'Tournament',2:'Later Walk-in',3:'Later Partner'});tables.Teams.data.push(morning);
ctx.tournamentRefresh_();assert.equal(morning[1],4,'walk-ins work after online registration closes');
const row=Array(20).fill('');Object.assign(row,{0:'Tournament',2:'Recovery Angler',3:'Recovery Partner'});tables.Teams.data.push(row);
failNextAppend=true;assert.throws(()=>ctx.tournamentRefresh_(),/Temporary append/);const reserved=row[1],reservedId=row[14];assert.equal(reserved,5);
ctx.tournamentRefresh_();ctx.tournamentRefresh_();assert.equal(row[14],reservedId);assert.equal(row[1],reserved);assert.equal(tables['Event Signups'].data.filter(r=>r[1]===reservedId).length,1,'partial manual save recovers with original ID and boat');
const lastIndex=tables.Teams.data.indexOf(row);row[2]='Corrected Angler';row[8]='Paid';row[9]=120;row[10]=new Date();ctx.tournamentEdit_({source:tournamentBook,range:tables.Teams.getRange(lastIndex+1,3,1,9)});
const original=tables['Event Signups'].data.find(r=>r[1]===reservedId);assert.equal(original[4],'Corrected Angler');assert.equal(original[15],'Paid');assert.equal(original[16],120);
const dup=[...row];tables.Teams.data.push(dup);assert.throws(()=>ctx.tournamentPublic_(eventId,'pre'),/Duplicate/);tables.Teams.data.pop();
tables['Sign Up Events'].data.push([otherEvent,'Second Tournament','Fishing tournament','','','','',true]);assert.equal(ctx.submitEventSignup({...online,eventId:otherEvent,signupId:uuid()}).boatNumber,1,'new events restart the sequence');
assert.equal(ctx.tournamentPublic_(eventId,'other').ok,false);assert.equal(ctx.tournamentPublic_('bad','pre').ok,false);
assert(!held);console.log('PASS: shared manual/online boat sequence, retries, interrupted saves, closed-event walk-ins, private fields, independent TV publication, decimal scoring, tie breaks, shared places, shared big fish, DQ, cancellations and payment edits.');
