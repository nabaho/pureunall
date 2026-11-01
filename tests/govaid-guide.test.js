/* 정부지원금 — 연간 안내 자료(대표 지시 2026-11-01 「매년 고용노동부·정부부처·지자체 지원금 안내 자료도 자동으로 검토하고 가지고 오게」 → 「추천대로」)
   ① 서버가 공고 이름으로 «묶음 자료»를 표시(guide) ② 화면 «📰 새 공고 → 📘 연간 안내 자료» ③ 이 PC 매월 작업이 읽고 guideDone 을 남긴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../js/pu-govaid-view.js');

const N = {
  A: { id: 'A', nm: '2026년 중소기업 지원사업 통합공고', guide: '통합공고', openDt: '2026-01-02' },
  B: { id: 'B', nm: '고용장려금 지원제도 안내', guide: '지원 안내', openDt: '2026-03-10', decision: 'ignore' },
  C: { id: 'C', nm: '어느 사업 모집', openDt: '2026-02-01' },
  D: { id: 'D', nm: '2025년 수출지원 통합공고', guide: '통합공고', openDt: '2025-01-02', closeDt: '2025-12-31' },
};

test('📘 연간 안내 자료 보기 — guide 표시가 있는 것만, 처리(관계없음)한 것도 보인다(안내 자료는 읽을 거리)', () => {
  const ids = V.noticeRows(N, [], { view: 'guide', today: '2026-11-01' }).map((r) => r.n.id);
  assert.deepEqual(ids.sort(), ['A', 'B', 'D']);
  const open = V.noticeRows(N, [], { view: 'guide', openOnly: true, today: '2026-11-01' }).map((r) => r.n.id);
  assert.equal(open.indexOf('D'), -1, '접수 끝난 지난해 자료는 «접수 중만»에서 빠진다');
});

test('다른 보기에는 영향 없음 — 처리 안 한 공고 전체는 그대로', () => {
  const ids = V.noticeRows(N, [], { view: 'all', today: '2026-11-01' }).map((r) => r.n.id).sort();
  assert.deepEqual(ids, ['A', 'C', 'D']);
});

test('화면 — 새 공고 보기에 «연간 안내 자료»가 있고, 이 PC 가 읽은 결과(guideDone)를 보여 준다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pu-govaid.html'), 'utf8');
  assert.match(src, /<option value="guide">[^<]*연간 안내 자료/);
  assert.match(src, /guideDone/);
});

/* ── 이 PC 매월 작업(scripts/govaid-refresh/guide-lib.js) ── */
const G = require('../scripts/govaid-refresh/guide-lib.js');
const NOW = 1790000000000;

test('읽을 것 — 표시 있고 아직 안 읽은 것만, 새것 먼저, 한 번에 몇 건까지만(남은 것은 다음 달)', () => {
  const ns = { MOEL_GUIDE_2026: { id: 'MOEL_GUIDE_2026', guide: '지원 안내', guideDone: { at: 1 } } };
  for (let i = 0; i < 9; i++) ns['g' + i] = { id: 'g' + i, nm: '통합공고 ' + i, guide: '통합공고', openDt: '2026-01-0' + (i + 1) };
  ns.done = { id: 'done', guide: '통합공고', guideDone: { at: 1 }, openDt: '2026-09-09' };
  ns.plain = { id: 'plain', nm: '낱개 공고', openDt: '2026-09-09' };
  const p = G.pickGuides(ns, 2026);
  assert.equal(p.length, G.MAX_PER_RUN);
  assert.equal(p[0].id, 'g8', '새것 먼저');
  assert.ok(p.every((x) => x.kind === 'read' && x.id !== 'done' && x.id !== 'plain'));
});

test('고용노동부 «고용장려금 지원제도 안내»는 올해 것을 못 찾았으면 «찾기» 한 건이 맨 앞에 — 찾았으면 안 나온다', () => {
  assert.equal(G.pickGuides({}, 2027)[0].id, 'MOEL_GUIDE_2027');
  assert.equal(G.pickGuides({}, 2027)[0].kind, 'search');
  assert.equal(G.pickGuides({ MOEL_GUIDE_2027: { id: 'MOEL_GUIDE_2027', guide: '지원 안내', guideDone: { at: 1, error: '아직 안 나옴' } } }, 2027)[0].kind, 'search', '못 찾았던 것은 다시 찾는다');
  assert.equal(G.pickGuides({ MOEL_GUIDE_2027: { id: 'MOEL_GUIDE_2027', guide: '지원 안내', guideDone: { at: 1 } } }, 2027).length, 0);
});

test('읽은 표시 — 공고에 guideDone(찾은 사업·새 초안·이미 있음), 못 읽었으면 까닭', () => {
  const up = G.doneUpdates([{ id: 'g1', found: 40, note: '고용·인력 12건만 골라 봄' }, { id: 'g2', error: '첨부를 열 수 없음' }],
    { g1: { created: 3, known: 9 } }, { g1: { id: 'g1' }, g2: { id: 'g2' } }, NOW, 2026);
  assert.deepEqual(Object.keys(up).sort(), ['notices/g1/guideDone', 'notices/g2/guideDone']);
  assert.equal(up['notices/g1/guideDone'].created, 3);
  assert.equal(up['notices/g1/guideDone'].known, 9);
  assert.equal(up['notices/g1/guideDone'].found, 40);
  assert.equal(up['notices/g2/guideDone'].error, '첨부를 열 수 없음');
});

test('고용24 안내 — 찾았을 때만 공고 자리를 새로 만들고(https 주소), 못 찾았으면 아무것도 안 쓴다 · 모르는 id 는 무시', () => {
  const found = G.doneUpdates([{ id: 'MOEL_GUIDE_2026', found: 25, url: 'https://www.work24.go.kr/x', nm: '2026년 고용장려금 지원제도 안내' }], {}, {}, NOW, 2026);
  const rec = found['notices/MOEL_GUIDE_2026'];
  assert.ok(rec);
  assert.equal(rec.guide, '지원 안내');
  assert.equal(rec.src, '고용24');
  assert.equal(rec.guideDone.found, 25);
  assert.deepEqual(G.doneUpdates([{ id: 'MOEL_GUIDE_2026', error: '아직 안 나옴' }], {}, {}, NOW, 2026), {});
  assert.deepEqual(G.doneUpdates([{ id: 'MOEL_GUIDE_2026', url: 'http://x' }], {}, {}, NOW, 2026), {});
  assert.deepEqual(G.doneUpdates([{ id: 'nope', found: 1 }, { id: 'a/b' }], {}, {}, NOW, 2026), {});
});

test('서버 덜어내기 — 이 PC 가 읽은 안내 자료(guideDone)는 오래돼도 지우지 않는다', () => {
  const S = require('../functions/govaid-notice-watch.js');
  const old = NOW - (S.KEEP_DAYS + 5) * 86400000;
  const r = S.plan({ rows: [], programs: [], existing: { a: { id: 'a', seenAt: old }, b: { id: 'b', seenAt: old, guideDone: { at: 1 } } }, today: '2026-11-01', nowMs: NOW });
  assert.equal(r.updates['notices/a'], null);
  assert.equal('notices/b' in r.updates, false);
});

test('지역 자료는 고객사 지역(충남)만 읽는다 — 전국 자료는 늘 읽는다', () => {
  const ns = { MOEL_GUIDE_2026: { id: 'MOEL_GUIDE_2026', guide: '지원 안내', guideDone: { at: 1 } },
    nat: { id: 'nat', guide: '통합공고', area: { sido: [], sgg: [] } },
    cn: { id: 'cn', guide: '통합공고', area: { sido: ['충남'], sgg: ['아산시'] } },
    gg: { id: 'gg', guide: '통합공고', area: { sido: ['경기'], sgg: [] } } };
  assert.deepEqual(G.pickGuides(ns, 2026).map((x) => x.id).sort(), ['cn', 'nat']);
});
