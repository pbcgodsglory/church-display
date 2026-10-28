const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function element(){return {children:[],hidden:true,textContent:'',append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},set innerHTML(v){throw Error('Unsafe HTML rendering')}};}
async function run(data,ok=true){
 const section=element(),list=element(),calls=[];
 const doc={hidden:false,getElementById:id=>id==='app-announcements'?section:list,createElement:element,addEventListener(){}};
 const fetch=async(url,options)=>{calls.push(options);return {ok,json:async()=>data}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/announcements.js','utf8'),{document:doc,window:{addEventListener(){}},fetch,AbortController,URL,Date,setTimeout,clearTimeout,setInterval(){}});
 await new Promise(setImmediate);
 return {section,list,calls};
}
(async()=>{
 const malicious='<img src=x onerror=alert(1)>';
 let r=await run({ok:true,announcements:[{title:malicious,message:'Line one\nLine two'},...Array.from({length:3},(_,i)=>({title:String(i),message:'Notice'}))]});
 assert.equal(r.section.hidden,false);assert.equal(r.list.children.length,3);assert.equal(r.list.children[0].children[0].textContent,malicious);
 assert.equal(r.calls[0].credentials,'omit');assert.equal(r.calls[0].cache,'no-store');
 r=await run({ok:true,announcements:[]});assert.equal(r.section.hidden,true);
 r=await run({ok:false});assert.equal(r.section.hidden,true);assert.equal(r.list.children.length,0);
 r=await run({},false);assert.equal(r.section.hidden,true);
 console.log('PASS: safe text rendering, three-notice limit, cookie-free uncached request, and hidden empty/unavailable section.');
})();
