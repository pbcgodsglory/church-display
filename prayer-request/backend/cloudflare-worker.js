// Providence Prayer Request submission proxy — deploy as a Cloudflare Worker.
// Configure secrets in Worker Settings (never store secrets on GitHub):
// GOOGLE_SCRIPT_URL, APP_SHARED_SECRET, TURNSTILE_SECRET_KEY.
// The only allowed website origin is Providence's GitHub Pages domain.
const ALLOWED_ORIGIN = 'https://pbcgodsglory.github.io';
function respond(body, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'vary': 'Origin',
      'cache-control': 'no-store'
    }
  });
}
function trim(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, {status:403});
      return new Response(null, {status:204,headers:{
        'access-control-allow-origin':ALLOWED_ORIGIN,
        'access-control-allow-methods':'POST, OPTIONS',
        'access-control-allow-headers':'content-type',
        'access-control-max-age':'86400',
        'vary':'Origin'
      }});
    }
    if (request.method !== 'POST') return respond({error:'Method not allowed'},405);
    if (origin !== ALLOWED_ORIGIN) return respond({error:'Origin not allowed'},403);
    if (!env.GOOGLE_SCRIPT_URL || !env.APP_SHARED_SECRET || !env.TURNSTILE_SECRET_KEY) {
      return respond({error:'Service not configured'},503);
    }
    if (Number(request.headers.get('content-length') || 0) > 12000) return respond({error:'Request too large'},413);
    let p;
    try { p = await request.json(); } catch { return respond({error:'Invalid request'},400); }
    if (!p || typeof p !== 'object' || Array.isArray(p)) return respond({error:'Invalid request'},400);
    if (p.website) return respond({ok:true}); // Honeypot for unsophisticated bots.
    const submittedBy=trim(p.submittedBy,120);
    const prayerFor=trim(p.prayerFor,80);
    const forWhom=trim(p.forWhom,120);
    const prayerRequest=trim(p.prayerRequest,4000);
    const unspoken=p.unspoken===true;
    const bulletin=p.bulletin===true;
    if (!prayerFor || (!unspoken && !prayerRequest)) {
      return respond({error:'Please fill in the required fields.'},400);
    }
    if (p.prayerRequest && p.prayerRequest.length > 4000) return respond({error:'Please shorten the request.'},400);
    if (!p.turnstileToken || typeof p.turnstileToken !== 'string') return respond({error:'Please complete the security check.'},400);
    let validation;
    try {
      const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',
        body:new URLSearchParams({
          secret:env.TURNSTILE_SECRET_KEY,
          response:p.turnstileToken,
          remoteip:request.headers.get('CF-Connecting-IP') || ''
        })
      });
      validation=await check.json();
    } catch { return respond({error:'Security verification unavailable. Try again.'},503); }
    if (!validation.success) return respond({error:'Security check expired. Please retry.'},403);
    try {
      const upstream=await fetch(env.GOOGLE_SCRIPT_URL,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          auth:env.APP_SHARED_SECRET,
          submittedBy, prayerFor, forWhom, prayerRequest, unspoken, bulletin
        }),
        redirect:'follow'
      });
      if (!upstream.ok) return respond({error:'Unable to save the request. Please try again.'},502);
      const result=await upstream.json();
      if (!result || result.ok !== true) return respond({error:'Unable to save the request. Please try again.'},502);
      return respond({ok:true});
    } catch {
      return respond({error:'Could not confirm that your request was saved. Please contact the church before submitting again.'},502);
    }
  }
};
