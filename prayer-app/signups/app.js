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
  function renderChoices(saved){
    $('choices').replaceChildren();
    (current.options||[]).forEach(option=>{
      const row=document.createElement('div');row.className='choice';
      const label=document.createElement('label');label.htmlFor='choice-'+option.id;label.textContent=option.label;
      const detail=document.createElement('p');detail.className='hint';detail.textContent=[option.details,option.remaining+' of '+option.needed+' remaining'].filter(Boolean).join(' · ');
      const input=document.createElement('input');input.id='choice-'+option.id;input.dataset.option=option.id;input.disabled=option.remaining===0;
      if(current.type==='Volunteer jobs'){input.type='checkbox';input.checked=option.remaining>0&&!!saved?.[option.id];label.prepend(input);row.append(label,detail);}
      else {input.type='number';input.min='0';input.max=String(option.remaining);input.step='1';input.inputMode='numeric';input.value=String(Math.min(saved?.[option.id]||0,option.remaining));input.setAttribute('aria-label','Quantity for '+option.label);row.append(label,detail,input);}
      $('choices').append(row);
    });
    if(!(current.options||[]).length){const p=document.createElement('p');p.textContent='No items or jobs are available yet. Please contact the organizer.';$('choices').append(p);}
  }
  function choose(id){
    current=events.find(event=>event.id===id);
    if(!current)return;
    pending=null;$('signup-form').reset();$('signup-form').hidden=false;$('signup-fields').disabled=false;$('submit').disabled=false;$('submit').textContent='Sign me up';$('back-after-success').hidden=true;status('');
    text('event-title',current.title);text('event-when',current.when);text('event-where',current.where);text('event-details',current.details);text('event-deadline',deadline(current.deadline));text('event-contact',current.contact?'Questions? '+current.contact:'');
    const general=!current.type||current.type==='General registration',fishing=current.type==='Fishing tournament',choices=['Items needed','Volunteer jobs'].includes(current.type);
    $('partner-field').hidden=!fishing;$('partner').required=fishing;$('choices-field').hidden=!choices;
    text('choices-heading',current.type==='Volunteer jobs'?'Choose your jobs':'Choose what you can bring');text('choices-hint',current.type==='Volunteer jobs'?'Select one or more jobs. Each selection reserves one opening.':'Enter a quantity for each item you can bring. You can choose multiple items.');renderChoices();
    $('number-field').hidden=!general||!current.numberLabel;$('number').required=general&&!!current.numberLabel;text('number-label',current.numberLabel?current.numberLabel+' (required)':'');
    $('item-field').hidden=!general||!current.itemLabel;text('item-label',current.itemLabel?current.itemLabel+' (optional)':'');
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
  $('refresh-choices').addEventListener('click',async()=>{
    if(busy||!current)return;
    const saved={};$('choices').querySelectorAll('input').forEach(input=>saved[input.dataset.option]=input.type==='checkbox'?(input.checked?1:0):Number(input.value));
    $('refresh-choices').disabled=true;
    try{events=await api.events();const fresh=events.find(e=>e.id===current.id);if(!fresh)throw Error('This sign-up is closed. Please contact the church.');current=fresh;pending=null;renderChoices(saved);status('Availability refreshed. Check your choices before submitting.');}
    catch(error){status(error.message,'error');}finally{$('refresh-choices').disabled=false;}
  });
  $('reload').addEventListener('click',load);$('all-events').addEventListener('click',showList);$('back-after-success').addEventListener('click',()=>{showList();load();});
  $('signup-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!current||!$('signup-form').reportValidity())return;
    if(!pending){
      pending={signupId:crypto.randomUUID(),eventId:current.id,name:$('name').value.trim(),contact:$('contact').value.trim(),number:$('number').value,item:$('item').value.trim(),notes:$('notes').value.trim(),partner:$('partner').value.trim(),selections:Array.from($('choices').querySelectorAll('input')).filter(input=>!input.disabled).map(input=>({id:input.dataset.option,quantity:input.type==='checkbox'?(input.checked?1:0):Number(input.value)})).filter(s=>s.quantity>0),website:$('website').value};
      if(!pending.name||!pending.contact){pending=null;status('Please enter your name and phone or email.','error');return;}
    }
    if(['Items needed','Volunteer jobs'].includes(current.type)&&!pending.selections.length){pending=null;status('Choose at least one available item or job.','error');return;}
    busy=true;$('signup-fields').disabled=true;$('submit').disabled=true;$('all-events').disabled=true;status('Sending your sign-up…');
    try{
      const receipt=await api.submit(pending);status(receipt.boatNumber?"You're registered! Your boat number is "+receipt.boatNumber+". Payment is tracked separately by the organizer.":"You're signed up! Your response has been received by the church.",'success');$('signup-form').hidden=true;$('back-after-success').hidden=false;pending=null;
    }catch(error){status(error.message,'error');$('submit').textContent='Try again';if(error.rejected){pending=null;$('signup-fields').disabled=false;}}
    finally{busy=false;$('submit').disabled=false;$('all-events').disabled=false;}
  });
  load();
})();
