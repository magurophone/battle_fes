const fs = require('fs');
const path = String.raw`C:\Users\iimy\.claude\projects\C--Users-iimy-desktop\23e87044-47b6-4f06-ac3a-3d514a06b335.jsonl`;
const data = fs.readFileSync(path, 'utf8');
const lines = data.split('\n');
console.log('lines:', lines.length);
const re = /カウントダウン|countdown|タイマー|残り時間/i;
let count = 0;
lines.forEach((l, i) => {
  if (!l) return;
  if (!re.test(l)) return;
  count++;
  if (count > 5) return;
  try {
    const obj = JSON.parse(l);
    const txt = JSON.stringify(obj.message?.content || obj);
    const idx = txt.search(re);
    console.log('=== line', i+1, 'role=' + (obj.message?.role||obj.type||'?'), '===');
    console.log(txt.slice(Math.max(0,idx-300), idx+800));
    console.log();
  } catch(e) { console.log('parse fail line', i+1, e.message); }
});
console.log('total matches:', count);
