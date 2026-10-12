/* 운영 사전(govaid/programs)을 조사 담당에게 나눠 줄 묶음 파일로 꺼낸다 — 읽기만.
   node scripts/govaid-refresh/export.js <결과폴더> [묶음수=4]
   → <결과폴더>/programs-live.json(전체) · group-g1.json … (고용노동부 먼저 반씩, 나머지 반씩) */
'use strict';
const fs = require('fs'), path = require('path');
const { V, get } = require('./common.js');
const dir = process.argv[2], n = Number(process.argv[3]) || 4;
if (!dir) { console.log('쓰는 법: node export.js <결과폴더> [묶음수]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const all = V.programs(get('/govaid/programs')).map((p) => ({ id: p.id, name: p.name, agency: p.agency || '', status: p.status,
  url: (p.source || {}).url || '', summary: String(p.summary || '').slice(0, 200), closure: p.closure ? p.closure.state : '' }));
fs.writeFileSync(path.join(dir, 'programs-live.json'), JSON.stringify(all, null, 1));
const moel = all.filter((p) => V.ministryOf(p.agency) === '고용노동부'), rest = all.filter((p) => V.ministryOf(p.agency) !== '고용노동부');
const half = Math.ceil(n / 2), groups = [];
[[moel, half], [rest, n - half]].forEach(([arr, k]) => { const size = Math.ceil(arr.length / Math.max(k, 1)); for (let i = 0; i < k; i++) groups.push(arr.slice(i * size, (i + 1) * size)); });
groups.filter((g) => g.length).forEach((g, i) => fs.writeFileSync(path.join(dir, 'group-g' + (i + 1) + '.json'), JSON.stringify(g, null, 1)));
console.log('사업', all.length, '· 묶음', groups.filter((g) => g.length).map((g) => g.length).join('/'));
