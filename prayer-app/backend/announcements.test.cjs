const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx={Date,Utilities:{formatDate:(date,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Announcements.gs','utf8'),ctx);
const day='2026-10-28',tz='America/Chicago';
const notice=(title,show=true,start='',end='')=>[title,'Church reminder',show,start,end,'PRIVATE EXTRA FIELD'];
const result=ctx.activeAppAnnouncements_([
 notice('Hidden',false),notice('Not yet',true,'2026-10-29'),notice('Expired',true,'','2026-10-27'),
 notice('Invalid date',true,'2026-02-30'),notice('Reversed',true,'2026-11-01','2026-10-01'),
 notice('First',true,day,day),notice('Second'),notice('Third'),notice('Fourth')
],day,tz);
assert.deepEqual(Array.from(result,n=>n.title),['First','Second','Third']);
assert.deepEqual(Object.keys(result[0]),['title','message']);assert(!JSON.stringify(result).includes('PRIVATE'));
assert.equal(ctx.activeAppAnnouncements_([notice('Not boolean','TRUE')],day,tz).length,0);
assert.equal(ctx.activeAppAnnouncements_([['','Missing title',true,'','']],day,tz).length,0);
assert.equal(ctx.activeAppAnnouncements_([notice('x'.repeat(121))],day,tz).length,0);
assert.equal(ctx.announcementDay_(new Date('2026-10-29T03:00:00Z'),tz),day);
assert.equal(ctx.activeAppAnnouncements_([notice('Ends today',true,'',day)],'2026-10-29',tz).length,0);
console.log('PASS: explicit publishing only, inclusive date range in church timezone, invalid-date exclusion, top-three row priority, public fields only.');
