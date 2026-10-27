const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function test(received){
 const calls=[],window={};
 const fetch=async(url,options)=>{calls.push({url:String(url),options});return options.method==='POST'?{type:'opaque'}:{ok:true,json:async()=>String(url).includes('hubApi=list')?{ok:true,prayers:[]}:{ok:true,received}};};
 vm.runInNewContext(fs.readFileSync(__dirname+'/transport.js','utf8'),{window,fetch,URL,URLSearchParams,AbortSignal,setTimeout:f=>f(),Date,Promise});
 assert.deepEqual(Array.from(await window.PBC_HUB_API.list()),[]);
 const submission=window.PBC_HUB_API.submit({changeId:'abcdef01-1234-1234-1234-123456789012'});
 if(received)assert.equal((await submission).success,true);else await assert.rejects(submission,/could not confirm receipt/);
 assert(calls.every(c=>c.options.credentials==='omit'));
 assert(calls.filter(c=>!c.options.method).every(c=>c.options.cache==='no-store'));
 assert(calls.some(c=>c.url.includes('hubApi=receipt')));
}
(async()=>{await test(true);await test(false);console.log('PASS: all requests omit Google cookies, list is not cached, submissions require a confirmed receipt.');})();
