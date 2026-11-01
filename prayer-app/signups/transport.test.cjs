const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function test(receipt){
 const calls=[],window={};let posted=false;
 const fetch=async(url,options)=>{calls.push({url:String(url),options});if(options.method==='POST'){posted=true;return {type:'opaque'}}return {ok:true,json:async()=>String(url).includes('signupApi=events')?{ok:true,events:[]}:{ok:true,received:receipt==='already'||(receipt===true&&posted)}};};
 vm.runInNewContext(fs.readFileSync(__dirname+'/transport.js','utf8'),{window,fetch,URL,URLSearchParams,AbortSignal,setTimeout:f=>f(),Date,Promise});
 assert.equal((await window.PBC_SIGNUPS.events()).length,0);
 const submission=window.PBC_SIGNUPS.submit({signupId:'d2699ab2-778a-40ce-bd8d-a699544962b7'});
 if(receipt)assert.equal((await submission).success,true);else await assert.rejects(submission,/could not confirm/);
 if(receipt==='already')assert(!posted,'confirmed retry does not POST again');
 assert(calls.every(c=>c.options.credentials==='omit'));
 assert(calls.filter(c=>!c.options.method).every(c=>c.options.cache==='no-store'));
}
(async()=>{await test(true);await test(false);await test('already');console.log('PASS: confirmed receipts required, retry before resend, no Google cookies or cached responses.');})();
