/* 접수 상태(사업종료·일부 마감·접수 중) 조사 결과를 govaid/programs/{id}.closure 에 넣는다 — 매월 정기 조사(B).
   node scripts/govaid-refresh/load-close.js <결과폴더> [--go]     (폴더 안의 close-*.json 전부, 모양은 BRIEF-close.md)
   넣는 것: 종료·일부 마감(확신도 높음·중간, 근거 주소 있음) · 접수 중(근거 주소 있음)
   넣지 않는 것: 모름 · 확신도 낮은 종료·일부 마감(낮은 확신으로 «종료»를 넣으면 신청 가능한 사업이 후보에서 빠진다) ·
                 사람이 표시한 접수 상태(by 가 AI_BY 가 아님) · 지금과 같은 상태
   ⚠ 쓰기 직전 서버를 다시 읽어 revision 이 바뀐 사업이 있으면 멈춘다(종료코드 2). 쓴 뒤 다시 읽어 맞춰 본다. */
'use strict';
const fs = require('fs'), path = require('path');
const { M, W, AI_BY, ACTOR, get, update, cut, sources } = require('./common.js');
const dir = process.argv[2], GO = process.argv.includes('--go'), NOW = Date.now();
if (!dir) { console.log('쓰는 법: node load-close.js <결과폴더> [--go]'); process.exit(1); }
const live = get('/govaid/programs') || {};
const plan = {}, stat = { closed: 0, partial: 0, open: 0, same: 0, skipUnknown: 0, skipLow: 0, skipNoSrc: 0, skipHuman: 0 }, skipped = [], bad = [];
/* 조사 결과는 배열 파일만 — 이 스크립트가 남기는 close-plan.json(쓸 계획)은 건너뛴다 */
const rows = fs.readdirSync(dir).filter((f) => /^close-.*\.json$/.test(f) && !/-plan\.json$/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(Array.isArray).reduce((m, x) => m.concat(x), []);
rows.forEach((r) => {
  const prev = live[r.id];
  if (!prev || prev._deleted) { bad.push(r.id + ': 운영에 없음'); return; }
  if (r.state === 'unknown') { stat.skipUnknown++; return; }
  if (['open', 'closed', 'partial'].indexOf(r.state) < 0) { bad.push(r.id + ': 상태 ' + r.state); return; }
  const srcs = sources(r.sources, true);
  if (!srcs.length) { stat.skipNoSrc++; skipped.push(prev.name + '(근거 없음)'); return; }
  if (r.state !== 'open' && r.confidence === 'low') { stat.skipLow++; skipped.push(prev.name + '(확신 낮음 ' + r.state + ')'); return; }
  const cur = prev.closure || {};
  if (cur.by && AI_BY.indexOf(cur.by) < 0) { stat.skipHuman++; skipped.push(prev.name + '(사람이 표시함)'); return; }
  const at = /^\d{4}-\d{2}-\d{2}$/.test(r.closedAt || '') ? r.closedAt : '';
  const closure = { state: r.state, reason: r.state === 'open' ? '' : cut(r.reason, 20), closedAt: r.state === 'open' ? '' : at, note: cut(r.note, 300),
    sources: srcs, confidence: r.confidence || '', checkedAt: NOW, by: ACTOR };
  if (cur.state === closure.state && (cur.reason || '') === closure.reason && (cur.closedAt || '') === closure.closedAt) { stat.same++; return; }
  if (closure.state !== 'open' && !M.closureOf({ closure }).label) { bad.push(r.id + ': 까닭 ' + r.reason); return; }
  const p = W.prepareRecord(Object.assign({}, prev, { closure }), { entityType: 'SupportProgram', previous: prev, expectedRevision: prev.revision, now: NOW, actor: ACTOR });
  if (!p.ok) { bad.push(r.id + ': 관문 ' + p.issues.map((i) => i.code).join(',')); return; }
  plan[r.id] = p.value; stat[r.state]++;
});
console.log(JSON.stringify(stat), '· 쓸 레코드', Object.keys(plan).length, '· 문제', bad.length);
if (skipped.length) console.log('  넣지 않음:', skipped.join(' / '));
if (bad.length) { bad.forEach((b) => console.log('  ✗', b)); process.exit(3); }
const file = path.join(dir, 'close-plan.json');
fs.writeFileSync(file, JSON.stringify(plan, null, 1));
if (!GO || !Object.keys(plan).length) { console.log(GO ? '쓸 것이 없습니다' : '마른 돌리기 — 쓰려면 --go'); process.exit(0); }
const again = get('/govaid/programs') || {};
const moved = Object.keys(plan).filter((k) => (live[k] || {}).revision !== (again[k] || {}).revision);
if (moved.length) { console.log('✗ 그사이 바뀐 사업 — 멈춥니다:', moved.join(',')); process.exit(2); }
update('/govaid/programs', file);
const after = get('/govaid/programs') || {};
const ok = Object.keys(plan).filter((k) => after[k] && after[k].revision === plan[k].revision && after[k].closure && after[k].closure.state === plan[k].closure.state).length;
console.log('다시 읽음: 쓴', Object.keys(plan).length, '중 맞음', ok);
process.exit(ok === Object.keys(plan).length ? 0 : 1);
