/* 정부지원금 4단계 — 연계(대표 2026-11-01 시안 → 「추천대로」)
   ① 검토 칸에 진행(work·told·result)을 얹는다 — 사람의 결정(decision)·사유는 건드리지 않는다
   ② «신청 대행»만 업무관리 할 일 한 줄 — 같은 회사×사업은 언제나 같은 id(두 번 눌러도 한 줄)
   ③ 넘긴 일 표 — 마감 가까운 것이 위, 업무관리에서 끝내면 «끝남»
   ④ 안내문 — ★ 사업에만 «대행» 한 줄, 금액·근로자 이름 없음 */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/pu-ontology-write.js');
const R = require('../js/pu-govaid-records.js');
const V = require('../js/pu-govaid-view.js');

const NOW = 1790000000000;
const CO = { key: 'co_c1', kind: 'co', id: 'c1', name: '가나다정밀(주)' };
const PR = { key: 'pr_p9', kind: 'pr', id: 'p9', name: '예비상사' };

test('업무관리 한 줄의 id 는 회사×사업에서 고정 — 파이어베이스 금지 글자는 바꾼다', () => {
  assert.equal(R.workKey('co_c1', 'gp-r12'), R.workKey('co_c1', 'gp-r12'));
  assert.notEqual(R.workKey('co_c1', 'gp-r12'), R.workKey('co_c2', 'gp-r12'));
  assert.notEqual(R.workKey('co_c1', 'gp-r12'), R.workKey('co_c1', 'gp-r13'));
  assert.doesNotMatch(R.workKey('co_a.b', 'G24_1/2#3'), /[.#$\[\]\/]/);
  assert.match(R.workKey('co_c1', 'gp-r12'), /^GA-/);
});

test('업무관리 한 줄 — 구분 «지원», 진행중, 담당·마감·업체 번호, 어디서 왔는지(src govaid)', () => {
  const w = R.workItem({ subject: CO, target: { id: 'gp-r12', name: '워라밸일자리 장려금', short: '워라밸' },
    mgr: { sid: 'P-001', name: '김담당' }, due: '2026-11-30', note: '대상자 2명 확인', year: 2026, today: '2026-11-01', nowIso: '2026-11-01T00:00:00.000Z' });
  assert.equal(w.id, R.workKey('co_c1', 'gp-r12'));
  assert.equal(w.cat, '지원');
  assert.equal(w.status, '진행중');
  assert.equal(w.company, '가나다정밀(주)');
  assert.equal(w.co_id, 'c1', '업체관리 번호로 잇는다');
  assert.equal(w.companyId, 'c1');
  assert.deepEqual(w.mgr_main, { sid: 'P-001', name: '김담당' });
  assert.deepEqual(w.mgr_subs, []);
  assert.equal(w.due, '2026-11-30');
  assert.equal(w.start, '2026-11-01');
  assert.equal(w.src, 'govaid');
  assert.deepEqual(w.ga, { key: 'co_c1', pid: 'gp-r12' });
  assert.match(w.title, /워라밸일자리 장려금/);
  assert.match(w.title, /신청 대행/);
  assert.match(w.brief, /대상자 2명 확인/);
  assert.equal(w.pe_nomgr, undefined);
});

test('업무관리 한 줄 — 담당이 없으면 «담당 미지정» 표시, 예비 고객은 업체 번호 없음', () => {
  const w = R.workItem({ subject: PR, target: { id: 'gp-r12', name: '어느 사업' }, mgr: null, due: '', year: 2026, today: '2026-11-01', nowIso: 'x' });
  assert.deepEqual(w.mgr_main, { sid: '', name: '' });
  assert.equal(w.pe_nomgr, true);
  assert.equal(w.co_id, '');
  assert.equal(w.companyId, undefined, '예비 고객에는 업체 관계 열쇠를 만들지 않는다');
  assert.equal(w.due, '');
});

test('업무관리 한 줄이 강제 관문(Task)을 통과한다', () => {
  const w = R.workItem({ subject: CO, target: { id: 'gp-r12', name: '어느 사업' }, mgr: { sid: 'P-001', name: '김담당' }, year: 2026, today: '2026-11-01', nowIso: 'x' });
  const p = W.prepareRecord(w, { entityType: 'Task', now: NOW, actor: 'A-001', expectedRevision: -1 });
  assert.equal(p.ok, true, JSON.stringify(p.issues));
});

test('검토 칸에 진행을 얹는다 — 찬 자리(null)에서도 id·대상 칸을 갖고, 결정·사유는 그대로', () => {
  const fresh = R.reviewPatched(null, CO, 'gp-r12', { told: { how: '메일', at: NOW } }, 'A-001', NOW);
  assert.equal(fresh.id, 'co_c1__gp-r12');
  assert.equal(fresh.entityType, 'EligibilityReview');
  assert.equal(fresh.subjectKey, 'co_c1');
  assert.equal(fresh.programId, 'gp-r12');
  assert.equal(fresh.companyId, 'c1');
  assert.equal(fresh.told.how, '메일');
  assert.equal(fresh.told.by, 'A-001');
  const prev = { id: 'co_c1__gp-r12', decision: 'yes', reason: '대상자 있음', by: 'P-002', at: 5, told: { how: '카톡', at: 1, by: 'x' } };
  const out = R.reviewPatched(prev, CO, 'gp-r12', { work: { id: 'GA-1', due: '2026-11-30', mgr: 'P-001' } }, 'A-001', NOW);
  assert.equal(out.decision, 'yes');
  assert.equal(out.reason, '대상자 있음');
  assert.equal(out.by, 'P-002', '검토한 사람은 그대로');
  assert.equal(out.told.how, '카톡', '다른 진행 칸은 그대로');
  assert.equal(out.work.id, 'GA-1');
  assert.equal(out.work.by, 'A-001');
  assert.equal(out.work.at, NOW);
});

test('검토 칸 — 예비 고객은 sourceKind·sourceId, 결과 «지우기»는 칸을 비운다, 공고 대상이면 targetKind', () => {
  const a = R.reviewPatched(null, PR, 'G24_77', { result: { v: 'selected' } }, 'A-001', NOW, { targetKind: 'notice' });
  assert.equal(a.sourceKind, 'govaidProspect');
  assert.equal(a.sourceId, 'p9');
  assert.equal(a.companyId, undefined);
  assert.equal(a.targetKind, 'notice');
  assert.equal(a.result.v, 'selected');
  const named = R.reviewPatched(null, PR, 'G24_77', { told: { how: '전화' } }, 'A', NOW, { targetKind: 'notice', targetName: '어느 공고' });
  assert.equal(named.targetName, '어느 공고', '공고 함을 안 읽어도 넘긴 일 표에 이름이 보이게');
  const b = R.reviewPatched(a, PR, 'G24_77', { result: null }, 'A-001', NOW);
  assert.equal(b.result, null);
  assert.throws(() => R.reviewPatched(null, CO, 'gp-1', { result: { v: '금액 300만원' } }, 'A', NOW), /결과/);
  assert.throws(() => R.reviewPatched(null, CO, 'gp-1', { told: { how: '팩스' } }, 'A', NOW), /안내/);
});

test('검토 칸 레코드가 강제 관문(EligibilityReview)을 통과한다', () => {
  const r = R.reviewPatched(null, CO, 'gp-r12', { work: { id: 'GA-1', due: '', mgr: '' } }, 'A-001', NOW);
  const p = W.prepareRecord(r, { entityType: 'EligibilityReview', now: NOW, actor: 'A-001' });
  assert.equal(p.ok, true, JSON.stringify(p.issues));
});

/* ── 넘긴 일 표 ── */
const PROFILES = [
  { key: 'co_c1', kind: 'co', id: 'c1', name: '가나다정밀(주)', aliases: ['pr_old'] },
  { key: 'co_c2', kind: 'co', id: 'c2', name: '라마바물산', aliases: [] },
];
const TARGETS = { 'gp-1': { id: 'gp-1', name: '청년일자리도약장려금', star: { on: true } }, 'gp-2': { id: 'gp-2', name: '정규직 전환 지원' }, 'gp-3': { id: 'gp-3', name: '기숙사 임차료' } };
const tOf = (id) => TARGETS[id] || null;

test('넘긴 일 표 — 진행 없는 검토는 빠지고, 마감 가까운 것이 위·마감 모름은 아래', () => {
  const reviews = {
    co_c1: { 'gp-1': { decision: 'yes', work: { id: 'W1', due: '2026-11-10' } },
             'gp-3': { decision: 'yes', told: { how: '메일', at: NOW } },
             'gp-2': { decision: 'yes' } },
    co_c2: { 'gp-2': { decision: 'yes', work: { id: 'W2', due: '' } } },
  };
  const rows = V.handoffRows(reviews, PROFILES, tOf, { W1: { state: '', status: '진행중' }, W2: { status: '진행중' } });
  assert.equal(rows.length, 3, '진행 없는 gp-2(가나다) 는 빠진다');
  assert.equal(rows[0].target.id, 'gp-1', '마감 있는 것이 먼저');
  assert.equal(rows[rows.length - 1].due, '', '마감 모름은 아래');
  assert.equal(rows.find((r) => r.target.id === 'gp-3').stage, 'notify');
  assert.equal(rows.find((r) => r.target.id === 'gp-1').stage, 'open');
});

test('넘긴 일 표 — 업무관리에서 끝내면(state done) 끝남, 결과를 적어도 끝남, 업무관리에서 사라진 줄은 표시', () => {
  const reviews = { co_c1: { 'gp-1': { work: { id: 'W1', due: '2026-11-10' } }, 'gp-2': { work: { id: 'W9' } } },
                    co_c2: { 'gp-1': { told: { how: '전화', at: NOW }, result: { v: 'rejected' } } } };
  const rows = V.handoffRows(reviews, PROFILES, tOf, { W1: { state: 'done', status: '진행중' } });
  const by = (pid, k) => rows.find((r) => r.target.id === pid && r.pf.key === k);
  assert.equal(by('gp-1', 'co_c1').stage, 'done');
  assert.equal(by('gp-1', 'co_c2').stage, 'done');
  assert.equal(by('gp-2', 'co_c1').gone, true, '업무관리에 없는 id');
  assert.equal(by('gp-2', 'co_c1').stage, 'open');
  const unread = V.handoffRows(reviews, PROFILES, tOf, null);
  assert.equal(unread.find((r) => r.target.id === 'gp-2' && r.pf.key === 'co_c1').gone, false, '업무관리를 아직 못 읽었으면 «없음»이라 하지 않는다');
});

test('넘긴 일 표 — 예비 고객 때 남긴 검토도 업체 줄로(aliases), 모르는 회사·지운 검토·모르는 사업은 빠진다', () => {
  const reviews = { pr_old: { 'gp-1': { work: { id: 'W1' } } }, co_zz: { 'gp-1': { work: { id: 'W3' } } },
                    co_c2: { 'gp-1': { _deleted: true, work: { id: 'W4' } }, 'gp-404': { work: { id: 'W5' } } } };
  const rows = V.handoffRows(reviews, PROFILES, tOf, {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pf.key, 'co_c1');
});

/* ── 안내문 ── */
test('안내문 — ★ 사업에만 «대행» 한 줄, 마감·준비 서류, 끝에 «기관 심사» 한 줄', () => {
  const t = V.letterFor('가나다정밀(주)', [
    { name: '청년일자리도약장려금', agency: '고용노동부', due: '2026-11-10', docs: ['근로계약서', '임금대장'], star: true },
    { name: '기숙사 임차료', agency: '아산시', due: '', docs: [], star: false },
  ]);
  assert.match(t, /^가나다정밀\(주\)/);
  assert.match(t, /1\. 청년일자리도약장려금 \(고용노동부\) — 접수 마감 11\/10/);
  assert.match(t, /근로계약서, 임금대장/);
  assert.equal((t.match(/대행해 드릴 수 있습니다/g) || []).length, 1, '★ 사업에만');
  assert.match(t, /2\. 기숙사 임차료 \(아산시\)\n/, '마감 모르면 마감 글자를 붙이지 않는다');
  assert.match(t, /기관 심사/);
  assert.doesNotMatch(t, /원\b|만원/, '금액은 넣지 않는다');
});

test('안내문 — 사업이 없으면 빈 글', () => {
  assert.equal(V.letterFor('가나다', []), '');
});
