(function () {
  'use strict';
  const config = window.GREENS_CONFIG || {};
  const list = document.getElementById('readings');
  const status = document.getElementById('status');
  const dialog = document.getElementById('reader');
  const refresh = document.getElementById('refresh');
  const expand = document.getElementById('expand');
  let sections = [], selected = 0, opener, textSize = 28;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function validate(payload) {
    if (!payload || payload.ok !== true || !Array.isArray(payload.sections) || payload.sections.length !== 13) throw new Error('Expected 13 readings.');
    const orders = new Set();
    const result = payload.sections.map(r => {
      if (!r || !Number.isInteger(r.order) || r.order < 1 || r.order > 13 || orders.has(r.order)) throw new Error('Invalid order.');
      orders.add(r.order);
      for (const k of ['title','reader','reading','stageInstructions']) if (typeof r[k] !== 'string') throw new Error('Invalid reading.');
      if (!r.title.trim() || !r.reading.trim()) throw new Error('Empty reading.');
      return r;
    });
    return result.sort((a,b) => a.order-b.order);
  }
  function passage(target, text) {
    target.replaceChildren();
    text.split(/\n\s*\n/).forEach(paragraph => {
      const p = element('p');
      const speaker = paragraph.match(/^([^:\n]{1,45}:)(\s*[\s\S]*)$/);
      if (speaker) p.append(element('span',speaker[1],'speaker'),document.createTextNode(speaker[2]));
      else p.textContent = paragraph;
      target.append(p);
    });
  }
  function cues(target, row) {
    target.replaceChildren();
    target.hidden = !row.stageInstructions.trim();
    if (target.hidden) return;
    target.append(element('h2','Stage / music cues · not spoken text'));
    // The source places this cue before the Advent reading's final sentence.
    // Keep its wording intact, and provide timing separately.
    if (row.stageInstructions.includes('Read Romans 15:13')) target.append(element('p','Scripture cue: read Romans 15:13 before “Tonight, we will light the first candle”. Verse text is not included in the source.','cue-position'));
    target.append(element('p',row.stageInstructions));
  }
  function setExpansionLabel() {
    const all = list.children.length > 0 && Array.from(list.children).every(d=>d.open);
    expand.textContent = all ? 'Collapse all' : 'Expand all';
    expand.setAttribute('aria-expanded',String(all));
  }
  function render() {
    list.replaceChildren();
    sections.forEach((row,index) => {
      const details = element('details'); details.id = 'reading-'+row.order;
      const summary = element('summary');
      const heading = element('span',row.title,'section-title');
      heading.append(element('span',row.reader ? 'Reader: '+row.reader : 'Reader: to be assigned','assignment'));
      summary.append(element('span',String(row.order).padStart(2,'0'),'number'),heading);
      const body = element('div',undefined,'section-body');
      const button = element('button','Reader mode'); button.type='button';
      button.setAttribute('aria-label','Reader mode: '+row.title);
      button.addEventListener('click',()=>openReader(index,button));
      const spoken = element('div',undefined,'spoken'); passage(spoken,row.reading);
      const aside = element('aside',undefined,'cues'); cues(aside,row);
      body.append(button,spoken,aside); details.append(summary,body);
      details.addEventListener('toggle',setExpansionLabel); list.append(details);
    });
    setExpansionLabel();
    const hash = location.hash.match(/^#reading-(\d+)$/);
    if(hash) { const section = document.getElementById('reading-'+Number(hash[1])); if(section) section.open=true; }
  }
  function showReader(index) {
    selected=index; const row=sections[index];
    document.getElementById('reader-order').textContent='Reading '+row.order+' of '+sections.length;
    const title=document.getElementById('reader-title'); title.textContent=row.title;
    document.getElementById('reader-name').textContent=row.reader ? 'Reader: '+row.reader : 'Reader: to be assigned';
    passage(document.getElementById('reader-reading'),row.reading);
    cues(document.getElementById('reader-cues'),row);
    document.getElementById('previous').disabled=index===0;
    document.getElementById('next').disabled=index===sections.length-1;
    dialog.scrollTop=0;
    title.focus({preventScroll:true});
  }
  function openReader(index,button) {
    opener=button; document.body.classList.add('reading'); dialog.showModal(); showReader(index);
  }
  function resize(delta) {
    textSize=Math.max(22,Math.min(44,textSize+delta));
    dialog.style.setProperty('--reader-size',textSize+'px');
    document.getElementById('smaller').disabled=textSize===22;
    document.getElementById('larger').disabled=textSize===44;
  }
  async function load() {
    refresh.disabled=true; expand.disabled=!sections.length;
    status.textContent='Loading readings…';
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try {
      if (!config.endpoint && config.draft !== true) throw new Error('Connection not configured.');
      if (config.endpoint && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint)) throw new Error('Invalid endpoint.');
      // No credentials, tokens, POST, or edit links travel to the visitor.
      const response=await fetch(config.endpoint || './draft.json',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error('Readings unavailable.');
      const next=validate(await response.json());
      sections=next; render(); expand.disabled=false;
      status.textContent=config.endpoint ? '13 readings · Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : 'Draft preview · 13 readings · Sheet updates are not connected yet.';
    } catch (error) {
      status.textContent=sections.length ? 'Could not refresh. Previously loaded readings are still shown; they may be out of date.' : 'Readings are unavailable. Please try Refresh readings or contact the church.';
    } finally {clearTimeout(timer); refresh.disabled=false;}
  }
  refresh.addEventListener('click',load);
  expand.addEventListener('click',()=>{const all=Array.from(list.children).every(d=>d.open);Array.from(list.children).forEach(d=>d.open=!all);setExpansionLabel();});
  document.getElementById('close-reader').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.classList.remove('reading');opener?.focus();});
  document.getElementById('previous').addEventListener('click',()=>{if(selected>0)showReader(selected-1);});
  document.getElementById('next').addEventListener('click',()=>{if(selected<sections.length-1)showReader(selected+1);});
  document.getElementById('smaller').addEventListener('click',()=>resize(-2));
  document.getElementById('larger').addEventListener('click',()=>resize(2));
  load();
})();
