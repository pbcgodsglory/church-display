const {readFileSync}=require('node:fs');
const vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ctx={Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>crypto.createHash('sha256').update(v).digest(),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url')},validatedText_:(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid');return v.trim()},sheetSafe_:v=>/^[=+\-@]/.test(v)?"'"+v:v,PRAYER_SHEET_NAME:'Requests',assertHeaders_:()=>{}};
vm.createContext(ctx);vm.runInContext(readFileSync(__dirname+'/Hub.gs','utf8'),ctx);
const row=['date','id','PRIVATE SUBMITTER','Person','Someone else','Original','No','Yes','Approved','','Approved wording',false,''];
let result=ctx.hubPublicRows_([row]);assert.equal(result.length,1);assert.deepEqual(Object.keys(result[0]),['id','name','text']);assert.equal(result[0].text,'Approved wording');assert(!JSON.stringify(result).includes('PRIVATE'));
for(const [index,value] of [[7,'No'],[7,''],[8,'Remove'],[8,'Answered'],[8,'Rejected'],[11,true],[12,'archived']]){const r=[...row];r[index]=value;assert.equal(ctx.hubPublicRows_([r]).length,0);}
const newRequest=[...row];newRequest[8]='New';assert.equal(ctx.hubPublicRows_([newRequest]).length,1);
const unspoken=[...row];unspoken[6]='Yes';assert.equal(ctx.hubPublicRows_([unspoken])[0].text,'Unspoken');
const writes=[];const queue={getRange:()=>({getValues:()=>[[new Date(),'change',ctx.hubReference_(row),'Person','Remove','Reviewer','Reason','Approved','']],setValue:v=>writes.push(['result',v])})};
const sheet={getLastRow:()=>2,getRange:(r,c)=>({getValues:()=>[row],setValue:v=>writes.push([c,v])})};ctx.mustGetSheet_=()=>sheet;
ctx.hubApplyChange_({},queue,2);assert.equal(writes[0][0],9);assert.equal(writes[0][1],'Remove');
writes.length=0;row[7]='No';assert.throws(()=>ctx.hubApplyChange_({},queue,2));assert.equal(writes.length,0);row[7]='Yes';
queue.getRange=()=>({getValues:()=>[[new Date(),'change','', 'Person','Remove','Reviewer','Reason','Approved','']]});assert.throws(()=>ctx.hubApplyChange_({},queue,2));assert.equal(writes.length,0);
assert.throws(()=>ctx.submitHubChange({website:'bot'}));
// Approving revised wording updates the actual reason, not just bulletin wording.
let edited,applied;const updateRow=[...row];updateRow[5]='Unspoken';updateRow[6]='Yes';updateRow[8]='New';updateRow[9]='Keep this admin note';
let action='Update',review='Pending',wording='Revised prayer reason';
const updateQueue={getRange:()=>({getValues:()=>[[new Date(),'change',ctx.hubReference_(updateRow),'Person',action,'Reviewer',wording,review,'']],setValue:v=>{applied=v;}})};
const updateSheet={getLastRow:()=>2,getRange:(r,c,n,w)=>{
 if(r===2&&c===1)return {getValues:()=>[updateRow]};
 assert.equal(c,6);assert.equal(w,6);
 return {getValues:()=>[updateRow.slice(5,11)],getFormulas:()=>[['','','','','=\"Keep this admin note\"','']],setValues:v=>{edited=v[0];}};
}};ctx.mustGetSheet_=()=>updateSheet;
ctx.hubApplyChange_({},updateQueue,2);assert.equal(edited,undefined);assert.equal(applied,undefined);
review='Rejected';ctx.hubApplyChange_({},updateQueue,2);assert.equal(edited,undefined);
review='Approved';ctx.hubApplyChange_({},updateQueue,2);
assert.equal(edited[0],wording);assert.equal(edited[1],'No');assert.equal(edited[2],'Yes');assert.equal(edited[3],'New');assert.equal(edited[4],'=\"Keep this admin note\"');assert.equal(edited[5],wording);assert.match(applied,/^Applied /);
const publicUpdated=[...updateRow];publicUpdated.splice(5,6,...edited);assert.equal(ctx.hubPublicRows_([publicUpdated])[0].text,wording);
wording='Unspoken';ctx.hubApplyChange_({},updateQueue,2);assert.equal(edited[1],'Yes');assert.equal(edited[0],'Unspoken');
wording='=SUM(1,2)';ctx.hubApplyChange_({},updateQueue,2);assert.equal(edited[0],"'=SUM(1,2)");assert.equal(edited[5],edited[0]);
console.log('PASS: only approved updates change reason and bulletin wording together; unspoken stays consistent; consent/status/notes/formulas preserved.');
console.log('PASS: public-field allowlist, bulletin consent and active/archive gates, New requests appear automatically, unspoken masking, reviewed removal, private/manual-target rejection, honeypot.');
