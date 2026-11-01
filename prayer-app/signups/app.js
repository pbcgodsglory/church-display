(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const api=window.PBC_SIGNUPS;
  let events=[],current=null,pending=null,busy=false;
  function text(id,value){$(id).textContent=value;$(id).hidden=!value;}
  function deadline(value){return value?'Sign up by '+new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Chicago'}).format(new Date(value))+' Central time':'';}
  function status(message,type){$('form-status').textContent=message;$('form-status').className=type||'';}
  function showList(){
    if(busy)return;
    current=null;pending=null;$('signup').hidden=true;$('event-list').hidden=false;
    history.replaceState(null,'',location.pathname);$('list-heading').setAttribute('tabindex','-1');$('list-heading').focus();
  }
  function choose(id){
    current=events.find(event=>event.id===id);
    if(!current)return;
    pending=null;$('signup-form').reset();$('signup-form').hidden=false;$('signup-fields').disabled=false;$('submit').disabled=false;$('submit').textContent='Sign me up';$('back-after-success').hidden=true;status('');
    text('event-title',current.title);text('event-when',current.when);text('event-where',current.where);text('event-details',current.details);text('event-deadline',deadline(current.deadline));text('event-contact',current.contact?'Questions? '+current.contact:'');
    $('number-field').hidden=!current.numberLabel;$('number').required=!!current.numberLabel;text('number-label',current.numberLabel?current.numberLabel+' (required)':'');
    $('item-field').hidden=!current.itemLabel;text('item-label',current.itemLabel?current.itemLabel+' (optional)':'');
    $('event-list').hidden=true;$('signup').hidden=false;history.replaceState(null,'','?event='+encodeURIComponent(id));$('event-title').focus();
  }
  function render(){
    $('events').replaceChildren();
    events.forEach(event=>{
      const card=document.createElement('article');card.className='card';
      const heading=document.createElement('h3');heading.textContent=event.title;card.append(heading);
      [event.when,event.where,event.details,deadline(event.deadline)].filter(Boolean).forEach(value=>{const p=document.createElement('p');p.textContent=value;p.className='prewrap';card.append(p);});
      const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='Sign up';button.setAttribute('aria-label','Sign up for '+event.title);button.addEventListener('click',()=>choose(event.id));card.append(button);$('events').append(card);
    });
    $('load-status').textContent=events.length?'':'There are no open sign-ups right now. Please check back soon.';
  }
  async function load(){
    $('reload').hidden=true;$('load-status').textContent='Loading current sign-ups…';
    try{
      events=await api.events();
      if(!events.every(e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&typeof e.numberLabel==='string'&&typeof e.itemLabel==='string'))throw Error('Unable to load sign-ups.');
      render();const id=new URLSearchParams(location.search).get('event');
      if(id){if(events.some(e=>e.id===id))choose(id);else $('load-status').textContent='This sign-up is closed or unavailable. Other open sign-ups are listed below.';}
    }catch(error){$('load-status').textContent='We could not load current sign-ups. Please check your connection and try again.';$('events').replaceChildren();$('reload').hidden=false;}
  }
  $('reload').addEventListener('click',load);$('all-events').addEventListener('click',showList);$('back-after-success').addEventListener('click',()=>{showList();load();});
  $('signup-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!current||!$('signup-form').reportValidity())return;
    if(!pending){
      pending={signupId:crypto.randomUUID(),eventId:current.id,name:$('name').value.trim(),contact:$('contact').value.trim(),number:$('number').value,item:$('item').value.trim(),notes:$('notes').value.trim(),website:$('website').value};
      if(!pending.name||!pending.contact){pending=null;status('Please enter your name and phone or email.','error');return;}
    }
    busy=true;$('signup-fields').disabled=true;$('submit').disabled=true;$('all-events').disabled=true;status('Sending your sign-up…');
    try{
      await api.submit(pending);status("You're signed up! Your response has been received by the church.",'success');$('signup-form').hidden=true;$('back-after-success').hidden=false;pending=null;
    }catch(error){status(error.message,'error');$('submit').textContent='Try again';}
    finally{busy=false;$('submit').disabled=false;$('all-events').disabled=false;}
  });
  load();
})();
