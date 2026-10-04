/* 취업규칙(새) 「우리 문안 고르기」 — 순수 모듈 검사. 이름은 가짜만.
   ★ 못 박는 것은 규칙이다(값·개수가 아니다):
     ① 지금 글과 «같은 글» 덩어리는 후보가 아니다
     ② recent  : ★최종본이 있는 덩어리 가운데 ★최종본 날짜가 가장 늦은 것(없으면 덩어리 마지막 날짜)
     ③ similar : 규모 띠·업태가 같은 «다른 회사» 수가 가장 많은 것 — 지금 회사가 쓴 것은 세지 않는다 · 둘 중 하나라도 모르면 없음
     ④ most    : 쓴 곳(회사 수)이 가장 많은 것
     ⑤ 세 갈래는 서로 다른 덩어리, 차례는 recent → similar → most, 빈 갈래는 빠진다
     ⑥ warnsOf 는 규모를 받아 판정한다(규모가 모자라면 적용 안 되는 기준은 안 걸린다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules-v2/lib-recommend.js');
const T = require('../js/rules-v2/lib-topics.js');
const V = require('../js/rules-v2/view-topics.js');
const CR = require('../js/pu-rules-criteria.js');

const DAY = 864e5;
const day = (n) => Date.UTC(2026, 0, 1) + n * DAY;

/* 규모·업태가 다른 회사들 */
const CO = {
  c0: { id: 'c0', name: '가나상사', employmentInsuredCount: 23, bizType: '제조업' },   // 지금 회사
  c1: { id: 'c1', name: '나다물산', employmentInsuredCount: 12, bizType: '제조업' },   // 같은 띠·같은 업태
  c2: { id: 'c2', name: '다라기계', employmentInsuredCount: 15, bizType: '제조업' },   // 같은 띠·같은 업태
  c3: { id: 'c3', name: '라마전자', employmentInsuredCount: 3, bizType: '도소매업' },
  c4: { id: 'c4', name: '마바식품', employmentInsuredCount: 50, bizType: '제조업' },   // 띠가 다름
  c5: { id: 'c5', name: '바사건설', employmentInsuredCount: 12, bizType: '건설업' },   // 업태가 다름
};
const NAME = (id) => (CO[id] ? CO[id].name : '');
const bodyOf = (co, n) => '제20조(연차유급휴가) ① ' + co + '는 1년간 80퍼센트 이상 출근한 사원에게 ' + n + '일의 유급휴가를 준다.';

/* member 한 줄 — 본문의 일수(n)가 «글»을 가른다 */
function mem(id, n, d, fin, docId) {
  return { docId: docId || ('doc-' + id + '-' + n + '-' + d), companyId: id, companyName: NAME(id), final: !!fin, date: day(d),
    label: '제20조', title: '연차유급휴가', body: bodyOf(NAME(id) || '무명', n) };
}
/* 덩어리는 손으로 짓지 않고 groupVariants 로, 곳 수는 view 의 places 로 */
function groups(entries) {
  return T.groupVariants(entries).map((g) => { g.places = V.places(g.members); return g; });
}
const bodyDays = (g) => (g.members[0].body.match(/(\d+)일/) || [])[1];
const keyOfDays = (n) => T.normKey(bodyOf('나다물산', n), '나다물산');
const ctx = (o) => Object.assign({ curBody: bodyOf('가나상사', 15), curCoName: '가나상사', companyId: 'c0', band: '10~29인', bizType: '제조업', coById: CO }, o || {});
const whyOf = (r) => r.map((x) => x.why);

/* 한 벌 — A(13일): c1★ 100 · c3 50 / B(14일): c2·c4·c5 비최종 300~320 / C(16일): c3★ 200 / X(15일, 지금 글): c0·c1 */
function base() {
  return groups([
    mem('c1', 13, 100, true), mem('c3', 13, 50),
    mem('c2', 14, 300), mem('c4', 14, 310), mem('c5', 14, 320),
    mem('c3', 16, 200, true),
    mem('c0', 15, 400, true), mem('c1', 15, 410),
  ]);
}

test('덩어리는 groupVariants 로 지은 것 — 글(일수)이 다르면 갈린다', () => {
  const gs = base();
  assert.ok(gs.length >= 4);
  assert.ok(gs.some((g) => g.key === keyOfDays(15)), '지금 글과 같은 덩어리가 있다');
});

test('① 지금 글과 같은 덩어리는 어느 갈래에도 나오지 않는다', () => {
  const gs = base();
  const r = R.pick(gs, ctx());
  assert.ok(r.length >= 1);
  r.forEach((x) => assert.notEqual(x.group.key, keyOfDays(15)));
  // 지금 글이 «가장 최근 ★최종본»이던 덩어리라면 그것은 빠지고 다음이 recent 가 된다
  const r2 = R.pick(gs, ctx({ curBody: bodyOf('가나상사', 16) }));
  r2.forEach((x) => assert.notEqual(x.group.key, keyOfDays(16)));
  assert.ok(r2.length >= 1);
});

test('① 회사 이름·호칭이 달라도 «같은 글»로 본다 (normKey 와 같은 잣대)', () => {
  const gs = base();
  // 지금 글: 다른 회사 이름·「근로자」 호칭이라도 X 와 같은 글
  const cur = '제20조(연차유급휴가) ① 다라기계는 1년간 80퍼센트 이상 출근한 근로자에게 15일의 유급휴가를 준다.';
  const r = R.pick(gs, ctx({ curBody: cur, curCoName: '다라기계' }));
  assert.ok(r.length >= 1);
  r.forEach((x) => assert.notEqual(x.group.key, keyOfDays(15)));
});

test('② recent — ★최종본이 있는 덩어리 가운데 ★최종본 날짜가 가장 늦은 것, rep 은 그 ★최종본', () => {
  const r = R.pick(base(), ctx());
  const rec = r.find((x) => x.why === 'recent');
  assert.ok(rec);
  assert.equal(bodyDays(rec.group), '16');            // C(★ 200)가 A(★ 100)보다 늦다 — 비최종 B(320)가 더 늦어도 ★ 있는 쪽이 먼저
  assert.equal(rec.rep.final, true);
  assert.equal(rec.rep.companyId, 'c3');
  assert.equal(rec.rep.date, day(200));
});

test('② recent — ★최종본이 하나도 없으면 덩어리 마지막 날짜가 가장 큰 것', () => {
  const gs = groups([mem('c1', 13, 100), mem('c3', 13, 120), mem('c2', 14, 300), mem('c4', 14, 250), mem('c3', 16, 200)]);
  const r = R.pick(gs, ctx());
  const rec = r.find((x) => x.why === 'recent');
  assert.equal(bodyDays(rec.group), '14');
  assert.equal(rec.rep.date, day(300));               // 그 날짜의 member
});

test('② recent — 덩어리 안에 ★ 와 비최종이 섞여도 rep 은 ★최종본', () => {
  const gs = groups([mem('c1', 13, 100, true), mem('c3', 13, 900)]);
  const rec = R.pick(gs, ctx()).find((x) => x.why === 'recent');
  assert.equal(rec.rep.final, true);
  assert.equal(rec.rep.companyId, 'c1');
});

test('③ similar — 규모 띠·업태가 같은 «다른 회사»가 쓴 덩어리, 회사 목록이 붙는다', () => {
  const r = R.pick(base(), ctx());
  const sim = r.find((x) => x.why === 'similar');
  assert.ok(sim);
  assert.ok(Array.isArray(sim.similar) && sim.similar.length >= 1);
  sim.similar.forEach((c) => {
    assert.ok(c.companyId && c.companyName);
    assert.notEqual(c.companyId, 'c0');
    assert.equal(CO[c.companyId].bizType, '제조업');
  });
  // 그 회사들의 member 가 rep
  assert.ok(sim.similar.some((c) => c.companyId === sim.rep.companyId));
  // recent·most 에는 similar 칸이 없다
  r.filter((x) => x.why !== 'similar').forEach((x) => assert.equal(x.similar, undefined));
});

test('③ similar — 서로 다른 회사 수로 센다(같은 회사의 여러 판은 한 곳), 많은 쪽이 이긴다', () => {
  // P(13일): c1 의 판 셋 → 한 곳 / Q(14일): c1·c2 두 곳 / R(16일): 띠가 다른 c3 이 가장 최근에 써서 recent 를 가져간다
  const gs = groups([mem('c1', 13, 10), mem('c1', 13, 20), mem('c1', 13, 30),
    mem('c1', 14, 40), mem('c2', 14, 50), mem('c3', 16, 900)]);
  const sim = R.pick(gs, ctx()).find((x) => x.why === 'similar');
  assert.ok(sim);
  assert.equal(bodyDays(sim.group), '14');
  assert.equal(sim.similar.length, 2);
});

test('③ similar — 같은 곳 수면 ★최종본 → 마지막 날짜', () => {
  const gs = groups([mem('c1', 13, 10), mem('c2', 14, 500), mem('c2', 16, 50, true)]);
  // recent 가 ★ 있는 16일을 가져가니, 남은 13·14 는 한 곳씩 — 비최종끼리 날짜가 늦은 14 가 이긴다
  const sim = R.pick(gs, ctx()).find((x) => x.why === 'similar');
  assert.equal(bodyDays(sim.group), '14');
  // ★ 가 있으면 날짜가 더 이르더라도 ★ 쪽이 이긴다
  const gs2 = groups([mem('c1', 13, 10, true), mem('c2', 14, 500), mem('c4', 16, 600, true), mem('c1', 18, 700)]);
  // recent = 18? (★ 없음) → ★ 있는 13·16 중 최종일 늦은 16. 남은 13(★)·14·18 중 같은 띠 한 곳씩 → ★ 있는 13
  const sim2 = R.pick(gs2, ctx()).find((x) => x.why === 'similar');
  assert.equal(bodyDays(sim2.group), '13');
});

test('③ similar — 규모 띠와 업태가 «둘 다» 같아야 센다(띠만·업태만 같으면 안 된다)', () => {
  // c4 는 업태만 같고 띠가 다르다 / c5 는 띠만 같고 업태가 다르다
  const gs = groups([mem('c4', 13, 10), mem('c5', 14, 20), mem('c3', 16, 30)]);
  assert.equal(R.pick(gs, ctx()).find((x) => x.why === 'similar'), undefined);
});

test('③ similar — 지금 회사가 쓴 덩어리는 규모·업태가 같아도 셈에서 빠진다', () => {
  // D(13일): 지금 회사(c0)만 씀, 오래됨 / B(14일): c2 가 씀, 최근 → recent 는 B, 남은 D 는 지금 회사 것뿐이라 similar 가 없다
  const gs = groups([mem('c0', 13, 10), mem('c2', 14, 300)]);
  const r = R.pick(gs, ctx({ curBody: bodyOf('가나상사', 15) }));
  assert.deepEqual(whyOf(r).includes('similar'), false);
  r.forEach((x) => { if (x.why === 'similar') assert.notEqual(x.rep.companyId, 'c0'); });
});

test('③ similar — 규모 모름(band:\'\') 이면 similar 만 없고 recent·most 는 그대로', () => {
  const gs = base();
  const r = R.pick(gs, ctx({ band: '' }));
  assert.ok(!whyOf(r).includes('similar'));
  assert.ok(whyOf(r).includes('recent'));
  assert.ok(whyOf(r).includes('most'));
  const withBand = R.pick(gs, ctx());
  assert.equal(r.find((x) => x.why === 'recent').group, withBand.find((x) => x.why === 'recent').group);
});

test('③ similar — 업태 모름(bizType:\'\') 이어도 similar 만 없다', () => {
  const r = R.pick(base(), ctx({ bizType: '' }));
  assert.ok(!whyOf(r).includes('similar'));
  assert.ok(whyOf(r).includes('recent') && whyOf(r).includes('most'));
});

test('③ similar — 회사 자료(coById)에 없는 회사·미확정 문서는 세지 않는다', () => {
  const noId = Object.assign(mem('c1', 13, 10), { companyId: '', companyName: '' });
  const gone = Object.assign(mem('c1', 14, 20), { companyId: 'cX', companyName: '지운업체' });
  const gs = groups([noId, gone, mem('c3', 16, 30)]);
  assert.equal(R.pick(gs, ctx()).find((x) => x.why === 'similar'), undefined);
});

test('④ most — 쓴 곳(회사 수)이 가장 많은 것, rep 은 members[0]', () => {
  const r = R.pick(base(), ctx());
  const most = r.find((x) => x.why === 'most');
  assert.ok(most);
  // recent=C(16)·similar=A(★ 있는 쪽) 가 빠진 뒤 남은 것은 B(14일, 세 곳)
  assert.equal(bodyDays(most.group), '14');
  assert.equal(most.rep, most.group.members[0]);
  // 겹침 없이 가장 많은 곳 — 다른 후보보다 크거나 같다
  const others = base().filter((g) => g.key !== keyOfDays(15) && !r.some((x) => x.why !== 'most' && x.group.key === g.key));
  others.forEach((g) => assert.ok(most.group.places >= g.places));
});

test('④ most — 회사 수로 센다(문서 수가 아니다)', () => {
  // P: 한 회사의 판 넷(문서 4개, 한 곳) / Q: 두 회사(문서 2개, 두 곳) — 밴드를 모르게 해 recent·most 만 본다
  const gs = groups([mem('c3', 13, 10), mem('c3', 13, 20), mem('c3', 13, 30), mem('c3', 13, 40),
    mem('c1', 14, 5), mem('c2', 14, 6)]);
  const r = R.pick(gs, ctx({ band: '' }));
  // recent 가 P(마지막 날짜 40) 를 가져가므로 most 는 남은 Q — 순서를 뒤집어 most 가 정말 «곳»으로 가르는지 본다
  const gs2 = groups([mem('c3', 13, 100), mem('c3', 13, 90), mem('c3', 13, 80), mem('c3', 13, 70),
    mem('c1', 14, 5), mem('c2', 14, 6), mem('c4', 16, 200)]);
  const r2 = R.pick(gs2, ctx({ band: '' }));
  assert.equal(r2.find((x) => x.why === 'recent').group.places, 1);          // 16일(c4, 200)이 최근
  const most = r2.find((x) => x.why === 'most');
  assert.equal(most.group.places, 2);                                         // 문서가 많은 13일이 아니라 두 곳이 쓴 14일
  assert.ok(r.length >= 1);
});

test('④ most — 곳이 같으면 ★최종본 → 마지막 날짜', () => {
  const gs = groups([mem('c1', 13, 10, true), mem('c2', 14, 500), mem('c3', 16, 100)]);
  // recent 는 ★ 있는 13 → 남은 14·16 은 한 곳씩, ★ 없음 → 마지막 날짜가 늦은 14
  const most = R.pick(gs, ctx({ band: '' })).find((x) => x.why === 'most');
  assert.equal(bodyDays(most.group), '14');
});

test('⑤ 차례는 recent → similar → most, 세 갈래는 서로 다른 덩어리', () => {
  const r = R.pick(base(), ctx());
  assert.deepEqual(whyOf(r), ['recent', 'similar', 'most']);
  assert.equal(new Set(r.map((x) => x.group.key)).size, r.length);
  assert.equal(new Set(r.map((x) => x.group)).size, r.length);
});

test('⑤ 덩어리가 둘뿐이면 결과는 둘 이하이고 겹치지 않는다', () => {
  const gs = groups([mem('c1', 13, 100, true), mem('c2', 14, 300)]);
  const r = R.pick(gs, ctx());
  assert.ok(r.length <= 2);
  assert.equal(new Set(r.map((x) => x.group)).size, r.length);
  assert.equal(r.length, 2);
  // 한 덩어리뿐이면 하나
  const r1 = R.pick(groups([mem('c1', 13, 100, true)]), ctx());
  assert.equal(r1.length, 1);
  assert.equal(r1[0].why, 'recent');
});

test('⑥ 덩어리가 없거나 모두 지금 글이면 빈 배열', () => {
  assert.deepEqual(R.pick([], ctx()), []);
  assert.deepEqual(R.pick(null, ctx()), []);
  assert.deepEqual(R.pick(undefined, ctx()), []);
  const only = groups([mem('c1', 15, 100, true), mem('c2', 15, 200)]);
  assert.deepEqual(R.pick(only, ctx()), []);
});

test('LABELS — 세 갈래 이름', () => {
  assert.deepEqual(Object.keys(R.LABELS).sort(), ['most', 'recent', 'similar']);
  Object.keys(R.LABELS).forEach((k) => assert.ok(R.LABELS[k]));
});

test('입력 덩어리·회사 자료를 고치지 않는다(읽기만)', () => {
  const gs = base(), co = JSON.parse(JSON.stringify(CO));
  const before = JSON.stringify(gs);
  R.pick(gs, ctx({ coById: co }));
  assert.equal(JSON.stringify(gs), before);
  assert.deepEqual(co, CO);
});

/* ── warnsOf — 규모를 받아 판정한다 ──
   기준은 RULES 에서 «찾는다»(번호·문구를 박지 않는다): 규모 조건이 있고(scope 가 «전체» 가 아님),
   값비교 칸이 「라벨:단위>=N / <=N」 꼴인 것 — 조 제목은 그 기준의 낱말, 본문은 한도에 못 미치게 짓는다. */
const RANK = { '5인미만': 0, '5인이상': 1, '10인이상': 2, '30인이상': 3 };
function sizeRuleDoc() {
  const out = [];
  CR.RULES.filter((r) => r.scope !== '전체' && r.type === '값비교' && (!r.condition || r.condition === '공통') && !r.effective).forEach((r) => {
    const m = String(r.check || '').split(';')[0].match(/^([^:;]+):([^:;<>=]+)(<=|>=)(\d+)/);
    if (!m) return;
    const n = +m[4], bad = m[3] === '>=' ? n - 1 : n + 1;
    const kw = r.keywords[0];
    const body = '제1조(' + kw + ') ' + kw + '에 관하여 ' + m[1] + ' 근로자에게 ' + bad + m[2] + '을 준다.';
    out.push({ rule: r, g: { members: [{ label: '제1조', title: kw, body }] } });
  });
  return out;
}
const MM = { criteria: CR, today: '2026-10-04' };

test('⑥ warnsOf 는 export 되고, 규모가 모자라면 적용 안 되는 기준은 걸리지 않는다', () => {
  assert.equal(typeof V.warnsOf, 'function');
  const cases = sizeRuleDoc();
  assert.ok(cases.length >= 1, 'RULES 에서 규모 조건이 있는 값비교 기준을 못 찾았다');
  let proved = 0;
  cases.forEach(({ rule, g }) => {
    const min = RANK[rule.scope];
    if (!(min >= 1)) return;
    const atMin = V.warnsOf(g, MM, rule.scope).filter((f) => f.rule.id === rule.id);
    if (!atMin.length) return;                         // 이 지어낸 글로는 안 걸리는 기준은 건너뛴다
    const below = Object.keys(RANK).filter((s) => RANK[s] < min);
    below.forEach((s) => assert.equal(V.warnsOf(g, MM, s).filter((f) => f.rule.id === rule.id).length, 0, rule.id + ' 은 ' + s + ' 에서 안 걸려야 한다'));
    proved++;
  });
  assert.ok(proved >= 1, '규모에 따라 갈리는 판정을 하나도 증명하지 못했다');
});

test('⑥ warnsOf — 규모를 안 주면 지금처럼 10인이상으로 판정한다(📚 는 그대로)', () => {
  const seen = [];
  const fake = { evaluate: (arts, size) => { seen.push(size); return []; }, expandKw: (k) => k };
  const g = { members: [{ label: '제1조', title: '가', body: '제1조(가) 나' }] };
  V.warnsOf(g, { criteria: fake, today: '2026-10-04' });
  V.warnsOf(g, { criteria: fake, today: '2026-10-04' }, '5인미만');
  assert.equal(seen[0], '10인이상');
  assert.equal(seen[1], '5인미만');
});
