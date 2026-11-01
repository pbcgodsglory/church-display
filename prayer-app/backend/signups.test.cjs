const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const id='bd691d9e-763d-42d3-81fc-a645d9986189',sid='d2699ab2-778a-40ce-bd8d-a699544962b7',oid='ab691d9e-763d-42d3-81fc-a645d9986189';
const tables={},cache=new Map();let held=false,released=0;
function sheet(headers,data){return {getLastRow:()=>data.length+1,appendRow:r=>{assert(held,'write is protected by lock');data.push(r)},getRange(row,col,height=1,width=1){return {
 getDisplayValues:()=>row===1?[headers]:data.slice(row-2,row-2+height).map(r=>r.slice(col-1,col-1+width)),
 getValues:()=>data.slice(row-2,row-2+height).map(r=>r.slice(col-1,col-1+width)),getValue:()=>data[row-2]?.[col-1]||'',
 createTextFinder(value){return {matchEntireCell(){return this},findNext(){const i=data.findIndex(r=>r[col-1]===value);return i<0?null:{getRow:()=>i+2}}}}
};}};}
const ctx={Date,Set,LockService:{getScriptLock:()=>({waitLock(){assert(!held);held=true},releaseLock(){held=false;released++}})},SpreadsheetApp:{flush(){}},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},getChurchSpreadsheet_:()=>({}),mustGetSheet_:(s,n)=>tables[n],
 validatedText_:(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw Error(label);return v.trim()},sheetSafe_:v=>/^[=+\-@]/.test(v)?"'"+v:v,ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Signups.gs','utf8'),ctx);
const headers=vm.runInContext('[SIGNUP_EVENT_HEADERS_,SIGNUP_HEADERS_,SIGNUP_OPTION_HEADERS_]',ctx);
const eventRows=[],rows=[],options=[];['Sign Up Events','Event Signups','Sign Up Options'].forEach((n,i)=>tables[n]=sheet(headers[i],[eventRows,rows,options][i]));
const event=(changes={})=>Object.assign([id,'Church meal','General registration','Sunday','Hall','Bring a dish','',true,'Number attending','Dish','Office','PRIVATE LINK','PRIVATE COUNT'],changes);
const now=new Date('2026-11-01T17:00:00Z');
assert.equal(ctx.signupPublicEvents_([event(),event({0:'invalid'}),event({0:oid,7:false}),event({0:sid,6:new Date('2026-11-01T16:59:00Z')})],now).length,1);
assert.equal(ctx.signupPublicEvents_([event(),event()],now).length,0);
assert.equal(ctx.signupPublicEvents_([event({6:'bad date'})],now).length,0);
assert(!JSON.stringify(ctx.signupPublicEvents_([event()],now)).includes('PRIVATE'));
eventRows.push(event());const payload={signupId:sid,eventId:id,name:'=TEST NAME',contact:'test@example.invalid',number:'2',item:'+Dish',notes:'@Note',website:''};
ctx.submitEventSignup(payload);assert.equal(rows[0][4],"'=TEST NAME");assert.equal(rows[0][7],"'+Dish");assert.equal(rows[0][8],"'@Note");ctx.submitEventSignup(payload);assert.equal(rows.length,1);
assert.deepEqual(ctx.signupApi_({signupApi:'receipt',signupId:sid}),{ok:true,received:true});
assert.throws(()=>ctx.submitEventSignup({...payload,signupId:oid,number:'1.5'}));
assert.throws(()=>ctx.submitEventSignup({...payload,signupId:oid,website:'spam'}));
eventRows[0][2]='Items needed';options.push([oid,id,'Church meal','Desserts',3,'One dessert serves 8','','']);
const p2={...payload,signupId:'e2699ab2-778a-40ce-bd8d-a699544962b7',selections:[{id:oid,quantity:2}]};ctx.submitEventSignup(p2);
assert.equal(ctx.signupEvents_()[0].options[0].remaining,1);
assert.throws(()=>ctx.submitEventSignup({...p2,signupId:'f2699ab2-778a-40ce-bd8d-a699544962b7'}),/Availability/,'a stale second request cannot overbook');
assert.equal(rows.length,2);assert(ctx.signupReceipt_('f2699ab2-778a-40ce-bd8d-a699544962b7').error.includes('Availability'));
rows[1][9]='Cancelled';assert.equal(ctx.signupEvents_()[0].options[0].remaining,3,'cancelled response releases stock');
eventRows[0][2]='Volunteer jobs';assert.throws(()=>ctx.submitEventSignup({...p2,signupId:'f2699ab2-778a-40ce-bd8d-a699544962b7'}),/one opening/);
ctx.submitEventSignup({...p2,signupId:'f2699ab2-778a-40ce-bd8d-a699544962b7',selections:[{id:oid,quantity:1}]});
const publicJson=JSON.stringify(ctx.signupEvents_());assert(!publicJson.includes('test@example')&&!publicJson.includes('TEST NAME')&&!publicJson.includes('Unpaid'));
eventRows[0][2]='Fishing tournament';
const fishing={...payload,signupId:'12699ab2-778a-40ce-bd8d-a699544962b7',partner:'@Partner'};assert.equal(ctx.submitEventSignup(fishing).boatNumber,1);assert.equal(rows.at(-1)[12],"'@Partner");assert.equal(rows.at(-1)[15],'Unpaid');
rows.at(-1)[9]='Cancelled';assert.equal(ctx.submitEventSignup({...fishing,signupId:'22699ab2-778a-40ce-bd8d-a699544962b7'}).boatNumber,2,'cancelled boat number is never reassigned');
assert.equal(ctx.submitEventSignup(fishing).boatNumber,1,'retry returns original boat');
const receipt=ctx.signupApi_({signupApi:'receipt',signupId:fishing.signupId});assert.deepEqual(receipt,{ok:true,received:true,boatNumber:1});
assert.throws(()=>ctx.submitEventSignup({...fishing,signupId:'32699ab2-778a-40ce-bd8d-a699544962b7',partner:''}));
eventRows[0][7]=false;assert.throws(()=>ctx.submitEventSignup({...fishing,signupId:'32699ab2-778a-40ce-bd8d-a699544962b7'}),/closed/);
assert(!held);assert(released>=10);console.log('PASS: four types, private fields, capacity checks, cancellations, validation, boat sequence, idempotence, safe receipts and locks.');
