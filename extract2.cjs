const fs = require('fs');
const path = String.raw`C:\Users\iimy\.claude\projects\C--Users-iimy-desktop-----\a031090f-46ad-4c67-9484-d7e853680ca7.jsonl`;
const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
const buckets = {};
let user_msgs_with_kd = [];
lines.forEach((l, i) => {
  if (!/カウントダウン|countdown/i.test(l)) return;
  try {
    const obj = JSON.parse(l);
    const role = obj.message?.role || obj.type || '?';
    const txt = JSON.stringify(obj.message?.content || obj);
    // Extract surrounding context for each match
    let pos = 0;
    while ((pos = txt.toLowerCase().indexOf('カウントダウン', pos)) !== -1 || (pos = txt.toLowerCase().indexOf('countdown', pos)) !== -1) {
      const before = txt.slice(Math.max(0, pos - 80), pos);
      const after = txt.slice(pos, pos + 200);
      const ctx = (before + after).replace(/\\n/g, ' ').replace(/\s+/g, ' ').slice(0, 250);
      const key = ctx.slice(0, 60);
      buckets[key] = (buckets[key] || 0) + 1;
      pos += 1;
    }
    if (role === 'user' && /カウントダウン/.test(txt)) {
      user_msgs_with_kd.push({ line: i+1, ts: obj.timestamp, txt: txt.slice(0, 400) });
    }
  } catch(e) {}
});
console.log('--- USER messages mentioning カウントダウン ---');
user_msgs_with_kd.forEach(m => {
  console.log(`L${m.line} ${m.ts}`);
  console.log('  ', m.txt.replace(/\\n/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
});
console.log('\n--- Top context buckets ---');
Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([k,v])=>console.log(v+'x | '+k));
