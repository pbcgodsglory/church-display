(function(){
  'use strict';
  const section=document.getElementById('app-announcements');
  const list=document.getElementById('app-announcement-list');
  if(!section||!list)return;
  const endpoint='https://script.google.com/macros/s/AKfycbzfHH1FZClKHemKs3p_dbiFEIMJBu58_DgFVf5LSjF9vGsVLwvEfPbBqJ2ZCGonKTW0/exec';
  let running=false;
  async function refresh(){
    if(running||document.hidden)return;
    running=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const url=new URL(endpoint);url.searchParams.set('hubApi','announcements');url.searchParams.set('_',String(Date.now()));
      const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Unavailable');
      const data=await response.json();
      if(!data||data.ok!==true||!Array.isArray(data.announcements))throw Error('Unavailable');
      const notices=data.announcements.filter(n=>n&&typeof n.title==='string'&&typeof n.message==='string'&&n.title.trim()&&n.message.trim()).slice(0,3);
      list.replaceChildren();
      notices.forEach(notice=>{
        const article=document.createElement('article'),title=document.createElement('h3'),message=document.createElement('p');
        title.textContent=notice.title;message.textContent=notice.message;
        article.append(title,message);list.append(article);
      });
      section.hidden=notices.length===0;
    }catch(error){
      // Do not show stale or expired notices when the current list cannot be verified.
      section.hidden=true;list.replaceChildren();
    }finally{clearTimeout(timer);running=false;}
  }
  refresh();
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(refresh,60000);
})();
