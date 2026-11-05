(function(){
  'use strict';
  const params=new URLSearchParams(location.search),mode=params.get('mode')==='results'?'results':'pre',eventId=params.get('event')||'',demo=params.get('demo')==='1';
  const endpoint='https://script.google.com/macros/s/AKfycbzfHH1FZClKHemKs3p_dbiFEIMJBu58_DgFVf5LSjF9vGsVLwvEfPbBqJ2ZCGonKTW0/exec';
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let lastGood=null,lastKey='',scrollHeight=0,offset=0,lastFrame=0,paused=false,controlTimer,pageTime=0;
  $('mode-label').textContent=mode==='pre'?'Boat assignments':'Tournament results';$('pause').hidden=mode==='results';$('demo').hidden=!demo;
  const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  function names(team,small=false){const n=el('div',small?'result-name':'team-names',team.name);n.append(el('div',small?'result-partner':'partner',(small?'Boat '+team.boatNumber+' · ':'')+team.partner));return n;}
  function empty(title,body){$('pre').hidden=true;$('results').hidden=true;$('empty').hidden=false;$('empty-title').textContent=title;$('empty-text').textContent=body;scrollHeight=0;lastKey='';}
  function roster(teams){
    const track=$('roster-track');track.replaceChildren();offset=0;pageTime=0;
    const list=el('div','roster-list');
    teams.forEach(team=>{const row=el('div','roster-row'),boat=el('div','boat-number');boat.append(el('small','','#'),document.createTextNode(String(team.boatNumber)));row.append(boat,names(team));list.append(row);});
    track.append(list);scrollHeight=list.getBoundingClientRect().height;
    if(scrollHeight>$('roster-window').clientHeight){const duplicate=list.cloneNode(true);duplicate.setAttribute('aria-hidden','true');track.append(duplicate);}else scrollHeight=0;
    track.style.transform='translateY(0)';
  }
  function results(data){
    const list=$('standings');list.replaceChildren();const count=Math.max(10,data.standings.length);list.style.setProperty('--rows',count);
    // All teams tied in a top-ten place remain on the same static screen.
    list.style.fontSize=data.standings.length>10?'clamp(11px,'+(14.5/data.standings.length).toFixed(3)+'vw,27px)':'';
    data.standings.forEach(team=>{const row=el('div','result-row');row.append(el('div','place',String(team.place)),names(team,true),el('div','weight',team.weight.toFixed(2)));list.append(row);});
    const winners=$('big-fish-winners');winners.replaceChildren();
    $('big-fish-weight').replaceChildren(document.createTextNode(data.bigFishWinners.length?data.bigFishWinners[0].bigFish.toFixed(2):'—'),el('small','','lb'));
    if(!data.bigFishWinners.length)winners.append(el('p','big-winner','Awaiting weigh-in'));
    data.bigFishWinners.forEach(team=>{const n=el('div','big-winner');n.append(el('span','boat','Boat '+team.boatNumber),document.createTextNode(team.name),el('div','partner',team.partner));winners.append(n);});
  }
  function render(data){
    if(!data.published){lastGood=null;$('title').textContent='Fishing Tournament';$('summary').textContent='';$('event-meta').textContent='';$('message').textContent='';empty('The display is not live yet',mode==='pre'?'Boat assignments will appear here when the organizer publishes them.':'Results will appear here when the organizer publishes them.');return;}
    lastGood=data;$('title').textContent=data.title;$('event-meta').textContent=[data.when,data.where].filter(Boolean).join(' · ');document.title=data.title+' — '+(mode==='pre'?'Boat assignments':'Results');
    $('summary').textContent=mode==='pre'?'Teams registered: '+data.teamCount:data.label+' · '+data.weighedCount+' teams in results · '+data.teamCount+' registered';
    $('message').textContent=data.message||(mode==='pre'?'Find your team. Know your boat number.':'Thank you to every team who fished with us.');
    const rows=mode==='pre'?data.teams:data.standings;
    if(!rows.length){empty(mode==='pre'?'The roster is ready':'Awaiting weigh-in',mode==='pre'?'Registered teams and their boat numbers will appear here.':'Results appear after a team’s final weight is entered and marked weighed.');return;}
    $('empty').hidden=true;$('pre').hidden=mode!=='pre';$('results').hidden=mode!=='results';
    const key=JSON.stringify(mode==='pre'?data.teams:[data.standings,data.bigFishWinners]);if(key!==lastKey){lastKey=key;if(mode==='pre')roster(data.teams);else results(data);}
  }
  function freshness(stale=false){$('freshness').classList.toggle('stale',stale);const time=lastGood?new Date(lastGood.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';$('freshness').textContent=demo?'Sample data · preview only':stale?(lastGood?'Connection lost · last update '+time:'Unable to connect · retrying…'):'Auto-updating'+(time?' · '+time:'');}
  async function refresh(){
    try{
      let data;
      if(demo)data=sample();else{
        if(!/^[a-f0-9-]{36}$/i.test(eventId)){empty('Choose a tournament display','Open the pre-tournament or results TV link supplied by your organizer.');$('freshness').textContent='';return;}
        const url=new URL(endpoint);url.search=new URLSearchParams({signupApi:'tournament',event:eventId,mode,_:String(Date.now())});
        const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Network');data=await response.json();if(data.ok!==true)throw Error('Display unavailable');
      }
      render(data);freshness();
    }catch(error){if(!lastGood)empty('The display is reconnecting','Please wait. The screen will update automatically.');freshness(true);}
    finally{setTimeout(refresh,15000);}
  }
  function frame(now){
    const dt=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;
    if(scrollHeight&&!paused&&!document.hidden){
      if(reduced.matches){pageTime+=dt;if(pageTime>=8000){offset+=Math.max(100,$('roster-window').clientHeight-80);if(offset>=scrollHeight)offset=0;pageTime=0;}}
      else offset=(offset+dt*.027)%scrollHeight;
      $('roster-track').style.transform='translateY(-'+offset+'px)';
    }
    requestAnimationFrame(frame);
  }
  $('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume scrolling':'Pause scrolling';});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(error){$('fullscreen').textContent='Use your browser’s full screen';}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
  function controls(){document.body.classList.add('show-controls');clearTimeout(controlTimer);controlTimer=setTimeout(()=>document.body.classList.remove('show-controls'),2500);}
  document.addEventListener('pointermove',controls);document.addEventListener('keydown',controls);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(lastGood&&mode==='pre'&&lastGood.teams.length)roster(lastGood.teams);},150);});
  function sample(){
    const pairs=[['Sample Angler A','Sample Partner A'],['Sample Angler B','Sample Partner B'],['Sample Angler C','Sample Partner C'],['Sample Angler D','Sample Partner D'],['Sample Angler E','Sample Partner E'],['Sample Angler F','Sample Partner F'],['Sample Angler G','Sample Partner G'],['Sample Angler H','Sample Partner H'],['Sample Angler I','Sample Partner I'],['Sample Angler J','Sample Partner J'],['Sample Angler K','Sample Partner K'],['Sample Angler L','Sample Partner L']];
    const teams=pairs.map((p,i)=>({boatNumber:i+1,name:p[0],partner:p[1]})),standings=teams.slice(0,10).map((t,i)=>Object.assign({},t,{place:i+1,weight:Math.round((22.86-i*.73)*100)/100,bigFish:i===2?6.42:4.7-i*.12}));
    return {ok:true,published:true,title:'PBC Bass Tournament',when:'Tournament day',where:'Boat launch',message:'SAMPLE PREVIEW — these are not tournament registrations or results.',updatedAt:new Date().toISOString(),label:'Preliminary',teamCount:teams.length,weighedCount:12,teams,standings,bigFishWinners:[standings[2]]};
  }
  refresh();requestAnimationFrame(frame);controls();
})();
