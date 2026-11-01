const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const id='bd691d9e-763d-42d3-81fc-a645d9986189',signupId='d2699ab2-778a-40ce-bd8d-a699544962b7';
const rows=[],eventRows=[];
const eventHeaders=['Event ID','Event name','When','Where','Details','Sign up by','Open?','Number label','Item or role label','Questions or contact','Sign-up link','Sign-ups received'];
const signupHeaders=['Received At','Signup ID','Event ID','Event','Name','Phone or email','Number','Item or role','Notes','Status','Admin notes'];
function sheet(headers,data){return {getLastRow:()=>data.length+1,appendRow:r=>data.push(r),getRange(row,col,height,width){return {
 getDisplayValues:()=>[headers],getValues:()=>data.slice(row-2,row-2+height),
 createTextFinder(value){return {matchEntireCell(){return this},findNext(){return data.some(r=>r[col-1]===value)?{}:null}}}
};}};}
let released=0;
const ss={getSheetByName:name=>name==='Sign Up Events'?sheet(eventHeaders,eventRows):sheet(signupHeaders,rows)};
const ctx={Date,Set,LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++}})},SpreadsheetApp:{flush(){}},
 getChurchSpreadsheet_:()=>ss,mustGetSheet_:(s,n)=>s.getSheetByName(n),
 validatedText_:(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw Error(label);return v.trim()},
 sheetSafe_:v=>/^[=+\-@]/.test(v)?"'"+v:v,
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Signups.gs','utf8'),ctx);
const event=(changes={})=>Object.assign([id,'Church meal','Sunday after service','Fellowship hall','Bring a dish','',true,'Number attending','Dish to bring','Church office','PRIVATE LINK','PRIVATE COUNT'],changes);
const now=new Date('2026-11-01T17:00:00Z');
const publicEvents=ctx.signupPublicEvents_([event(),event({0:'ad691d9e-763d-42d3-81fc-a645d9986189',6:false}),event({0:'cd691d9e-763d-42d3-81fc-a645d9986189',5:new Date('2026-11-01T16:59:00Z')}),event({0:'dd691d9e-763d-42d3-81fc-a645d9986189',5:'bad date'})],now);
assert.equal(publicEvents.length,1);
assert.deepEqual(Object.keys(publicEvents[0]),['id','title','when','where','details','deadline','numberLabel','itemLabel','contact']);
assert(!JSON.stringify(publicEvents).includes('PRIVATE'));
assert.equal(ctx.signupPublicEvents_([event(),event()],now).length,0,'duplicate event IDs fail closed');
assert.equal(ctx.signupPublicEvents_([event({6:'TRUE'})],now).length,0,'publishing requires checkbox boolean');
eventRows.push(event());
const payload={signupId,eventId:id,name:'=TEST NAME',contact:'test@example.invalid',number:'2',item:'+Dish',notes:'@Note',website:''};
assert.equal(ctx.submitEventSignup(payload).success,true);assert.equal(rows.length,1);assert.equal(rows[0][4],"'=TEST NAME");assert.equal(rows[0][7],"'+Dish");assert.equal(rows[0][8],"'@Note");
ctx.submitEventSignup(payload);assert.equal(rows.length,1,'retry must not append twice');
assert.deepEqual(ctx.signupApi_({signupApi:'receipt',signupId}),{ok:true,received:true});
assert.equal(ctx.signupApi_({signupApi:'receipt',signupId:'invalid'}).received,false);
assert.throws(()=>ctx.submitEventSignup({...payload,signupId:'e2699ab2-778a-40ce-bd8d-a699544962b7',number:'1.5'}));
assert.throws(()=>ctx.submitEventSignup({...payload,signupId:'e2699ab2-778a-40ce-bd8d-a699544962b7',website:'spam'}));
eventRows[0][6]=false;
assert.throws(()=>ctx.submitEventSignup({...payload,signupId:'e2699ab2-778a-40ce-bd8d-a699544962b7'}),/closed/);
assert.equal(rows.length,1);assert(released>=4,'locks released on success and failure');
console.log('PASS: open/deadline rules, public allowlist, duplicate IDs, validation, formula protection, receipts, idempotence and lock cleanup.');
