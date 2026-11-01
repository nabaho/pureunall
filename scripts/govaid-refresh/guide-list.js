/* 연간 안내 자료 — 이번 달에 읽을 것을 꺼낸다(읽기만). 매월 1일 예약 작업이 부른다.
   node scripts/govaid-refresh/guide-list.js <결과폴더>
   → <결과폴더>/guides.json  [{id, kind:'read'|'search', nm, url, org, openDt, guide}]  (한 번에 guide-lib.MAX_PER_RUN 건까지)
   → <결과폴더>/programs-live.json  (사전 이름 — 조사 담당이 «이미 있는 사업»을 가를 때 본다)
   읽을 것이 없으면 guides.json 이 빈 배열 — 조사 담당을 부르지 않는다 */
'use strict';
const fs = require('fs'), path = require('path');
const { V, get } = require('./common.js');
const G = require('./guide-lib.js');
const dir = process.argv[2];
if (!dir) { console.log('쓰는 법: node guide-list.js <결과폴더>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const year = Number(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4));
const todo = G.pickGuides(get('/govaid/notices') || {}, year);
fs.writeFileSync(path.join(dir, 'guides.json'), JSON.stringify(todo, null, 1));
const live = V.programs(get('/govaid/programs')).map((p) => ({ id: p.id, name: p.name, agency: p.agency || '' }));
fs.writeFileSync(path.join(dir, 'programs-live.json'), JSON.stringify(live, null, 1));
console.log('이번 달 읽을 안내 자료', todo.length, '건' + (todo.length ? ' — ' + todo.map((x) => x.nm.slice(0, 30)).join(' / ') : ''), '· 사전', live.length);
