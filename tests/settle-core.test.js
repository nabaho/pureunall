/* 컨설팅정산 계산 모듈(js/pu-settle-core.js) — 안내 파일 읽기·지급월 pool 정산·송금·문구 (2026-10-31)
   설계 docs/superpowers/specs/2026-10-31-consult-settle-design.md §5
   ★ 자료는 모두 지어낸 것이다(공개 저장소). 금액은 원천징수·요율 식이 낸 «규칙 값»이라 그대로 박는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-settle-core.js');

const T_RECV = Date.UTC(2026, 9, 31, 3, 0, 0); // 2026-10-31 12:00 KST

/* 비용지급 안내 엑셀과 같은 배치 — 5행 머리, 6행 지급월 이름, 7행부터 줄(0부터 세면 4·5·6) */
function makeGrid(lines) {
  const W = 24, row = () => new Array(W).fill(null);
  const g = [row(), row(), row(), row(), row(), row()];
  g[4][1] = 'no.'; g[4][2] = '컨설턴트'; g[4][3] = '기업명'; g[4][14] = 'B등급 지급단가'; g[4][20] = '지급월'; g[4][23] = '지급 \n총액';
  g[5][14] = '합계\n(부가세 포함)'; g[5][15] = '합계\n(부가세 제외, 세전)';
  g[5][20] = '7월'; g[5][21] = '9월 (10/2 지급)'; g[5][22] = '10월';
  lines.forEach((l, i) => {
    const r = row();
    r[1] = i + 1; r[2] = l.name; r[3] = l.company; r[15] = l.total;
    if (l.m7 != null) r[20] = l.m7;
    if (l.m9 != null) r[21] = l.m9;
    if (l.m10 != null) r[22] = l.m10;
    g.push(r);
  });
  return g;
}
const MERGES = [{ s: { r: 4, c: 14 }, e: { r: 4, c: 15 } }, { s: { r: 4, c: 20 }, e: { r: 4, c: 22 } }];
const LINES = [
  { name: '홍길동', company: '가나상사', total: 5136363.636363636, m10: 2568181.818181818 },
  { name: '김가나', company: '가나상사', total: 1954545.4545454544, m10: 977272.7272727272 },
  { name: '홍길동', company: '다라산업', total: 5136363.636363636, m9: 2568181.818181818 },
  { name: '이다라', company: '다라산업', total: 1954545.4545454544, m9: 977272.7272727272 },
  { name: '박빈칸', company: '다라산업', total: 0 },
  { name: '홍길동', company: '마바상사', total: 4000000, m7: 2000000 },
  { name: '김가나', company: '마바상사', total: 2000000, m9: 1000000 }
];
function notice() {
  const n = C.parseNotice(makeGrid(LINES), MERGES, { fileName: '비용지급 안내_시험(~10월).xlsx', receivedAt: T_RECV });
  assert.equal(n.ok, true, n.error);
  return n;
}
const RULE = { typeCode: 'cons-test', title: '테스트사업', mode: 'pool', leadSid: 'T-LEAD', rates: { 'T-A': 25, 'T-B': 30 }, siteRates: {} };
function ctx(over) {
  const base = {
    companyLinks: {}, personLinks: {}, actuals: {}, adjusts: [],
    names: { 'T-LEAD': '홍길동', 'T-A': '김가나', 'T-B': '이다라', 'T-C': '박빈칸' }
  };
  base.companyLinks[C.linkKey('가나상사')] = { consultingId: 'C-1', companyId: 'CO-1' };
  base.companyLinks[C.linkKey('다라산업')] = { consultingId: 'C-2', companyId: 'CO-2' };
  base.companyLinks[C.linkKey('마바상사')] = { consultingId: 'C-3', companyId: 'CO-3' };
  [['홍길동', 'T-LEAD'], ['김가나', 'T-A'], ['이다라', 'T-B'], ['박빈칸', 'T-C']].forEach(([n, s]) => { base.personLinks[C.linkKey(n)] = s; });
  return Object.assign(base, over || {});
}
function site(res, company) { const s = res.sites.find((x) => x.company === company); assert.ok(s, '사업장 없음: ' + company); return s; }
function mem(s, sid) { const m = s.members.find((x) => x.sid === sid); assert.ok(m, '사람 없음: ' + sid); return m; }

test('원천징수는 소득세·지방소득세 모두 10원 아래를 버린다', () => {
  assert.deepEqual(C.withholding(2568182), { inc: 77040, loc: 7700, total: 84740 });
  assert.deepEqual(C.withholding(977273), { inc: 29310, loc: 2930, total: 32240 });
  assert.deepEqual(C.withholding(0), { inc: 0, loc: 0, total: 0 });
});

test('원 단위 반올림 — 숫자·쉼표 글자, 못 읽으면 0', () => {
  assert.equal(C.won(2568181.818181818), 2568182);
  assert.equal(C.won(2272727.2727272725), 2272727);
  assert.equal(C.won('977,272.73'), 977273);
  assert.equal(C.won('—'), 0);
  assert.equal(C.won(null), 0);
});

test('linkKey — 공백·특수 공백을 고르고 RTDB 금지 글자를 바꾼다', () => {
  assert.equal(C.linkKey('  (주)가나  상사 '), C.linkKey('(주)가나 상사'));
  assert.doesNotMatch(C.linkKey('a.b#c$d[e]f/g'), /[.#$[\]/]/);
});

test('지급월 열쇠 — 이름 앞의 N월, 받은 달보다 크면 전년', () => {
  assert.equal(C.monthKeyOf('9월 (10/2 지급)', T_RECV).key, '2026-09');
  assert.equal(C.monthKeyOf('10월', T_RECV).key, '2026-10');
  assert.equal(C.monthKeyOf('12월', T_RECV).key, '2025-12');
  assert.equal(C.monthKeyOf('합계', T_RECV), null);
});

test('안내 파일 읽기 — 지급월 병합 칸, 합계(세전), 금액 있는 달만', () => {
  const n = notice();
  assert.deepEqual(n.months.map((m) => m.key), ['2026-07', '2026-09', '2026-10']);
  assert.equal(n.months[1].label, '9월 (10/2 지급)');
  assert.equal(n.rows.length, 7);
  const r = n.rows[1];
  assert.equal(r.name, '김가나');
  assert.equal(r.company, '가나상사');
  assert.equal(r.totalPre, 1954545);
  assert.deepEqual(r.amounts, { '2026-10': 977273 });
  assert.deepEqual(n.rows[4].amounts, {});
});

test('시트가 A1 이 아닌 칸(B5)에서 시작해도 병합 칸 자리를 맞춘다 — SheetJS 는 grid 를 잘라 주고 merges 는 A1 기준', () => {
  const g = makeGrid(LINES).slice(4).map((r) => r.slice(1)); // B5 부터 편 것
  const n = C.parseNotice(g, MERGES, { receivedAt: T_RECV, ref: 'B5:X13' });
  assert.equal(n.ok, true, n.error);
  assert.deepEqual(n.months.map((m) => m.key), ['2026-07', '2026-09', '2026-10']);
  assert.equal(n.rows[0].totalPre, 5136364);
});

test('읽지 못하는 파일은 ok:false 와 까닭', () => {
  const a = C.parseNotice([['가', '나'], ['다', '라']], [], { receivedAt: T_RECV });
  assert.equal(a.ok, false);
  assert.ok(a.error);
  const g = makeGrid(LINES); g[4][20] = null; // 지급월 칸이 없다
  assert.equal(C.parseNotice(g, [], { receivedAt: T_RECV }).ok, false);
});

test('pool — 1차분 사업장 하나: 담당이 주관에게 돌려준다', () => {
  const res = C.settleMonth(notice(), '2026-10', RULE, ctx());
  assert.equal(res.sites.length, 1);
  const s = site(res, '가나상사');
  assert.equal(s.consultingId, 'C-1');
  assert.equal(s.round, 1);
  assert.equal(s.totalNet, 3428475);
  const a = mem(s, 'T-A'), l = mem(s, 'T-LEAD');
  assert.equal(a.role, 'staff');
  assert.equal(a.net, 945033);
  assert.equal(a.share, 857118);
  assert.equal(a.diff, -87915);
  assert.equal(a.settle, -87915);
  assert.equal(a.final, 857118);
  assert.equal(l.role, 'lead');
  assert.equal(l.net, 2483442);
  assert.equal(l.settle, 87915);
  assert.equal(l.final, 2571357);
  assert.deepEqual(s.issues, []);
});

test('pool — 30% 담당은 주관에게서 더 받는다, 명단 밖(합계 0) 줄은 빠진다', () => {
  const res = C.settleMonth(notice(), '2026-09', RULE, ctx());
  const s = site(res, '다라산업');
  assert.equal(s.members.length, 2);
  assert.equal(mem(s, 'T-B').share, 1028542);
  assert.equal(mem(s, 'T-B').settle, 83509);
  assert.equal(mem(s, 'T-LEAD').final, 2399933);
});

test('주관·담당이 다른 달에 입금돼도 두 달 합 = 한 번에 정산한 값', () => {
  const n = notice();
  const jul = site(C.settleMonth(n, '2026-07', RULE, ctx()), '마바상사');
  const sep = site(C.settleMonth(n, '2026-09', RULE, ctx()), '마바상사');
  assert.equal(jul.round, 1);
  assert.equal(sep.round, 2);
  assert.equal(mem(jul, 'T-A').pre, 0);          // 그 달 0원이어도 명단이면 넣는다
  assert.equal(mem(jul, 'T-A').settle, 483500);   // 주관 → 담당
  assert.equal(mem(sep, 'T-LEAD').pre, 0);
  assert.equal(mem(sep, 'T-A').settle, -725250);  // 담당 → 주관
  const sumFinal = mem(jul, 'T-A').final + mem(sep, 'T-A').final;
  const once = Math.floor((1934000 + 967000) * 2500 / 10000);
  assert.ok(Math.abs(sumFinal - once) <= 10, sumFinal + ' vs ' + once);
});

test('사업장별 예외 요율이 사람별 요율보다 먼저다', () => {
  const rule = Object.assign({}, RULE, { siteRates: { 'C-2': { 'T-B': 25 } } });
  const s = site(C.settleMonth(notice(), '2026-09', rule, ctx()), '다라산업');
  assert.equal(mem(s, 'T-B').rate, 25);
  assert.equal(mem(s, 'T-B').share, 857118);
});

test('요율 없음·업체 연결 없음·사람 연결 없음은 그 사업장의 issues 로', () => {
  const noRate = Object.assign({}, RULE, { rates: { 'T-A': 25 } });
  const s1 = site(C.settleMonth(notice(), '2026-09', noRate, ctx()), '다라산업');
  assert.ok(s1.issues.some((x) => x.indexOf('이다라') >= 0 && x.indexOf('요율') >= 0), JSON.stringify(s1.issues));
  const c2 = ctx(); delete c2.companyLinks[C.linkKey('다라산업')];
  const s2 = site(C.settleMonth(notice(), '2026-09', RULE, c2), '다라산업');
  assert.ok(s2.issues.some((x) => x.indexOf('업체') >= 0));
  const c3 = ctx(); delete c3.personLinks[C.linkKey('이다라')];
  const s3 = site(C.settleMonth(notice(), '2026-09', RULE, c3), '다라산업');
  assert.ok(s3.issues.some((x) => x.indexOf('이다라') >= 0 && x.indexOf('사람') >= 0));
  const noLead = Object.assign({}, RULE, { leadSid: '' });
  assert.ok(C.settleMonth(notice(), '2026-10', noLead, ctx()).issues.some((x) => x.indexOf('주관') >= 0));
});

test('통장 실입금이 계산한 세후를 대신한다', () => {
  const s = site(C.settleMonth(notice(), '2026-10', RULE, ctx({ actuals: { 'C-1|T-A': 945000 } })), '가나상사');
  const a = mem(s, 'T-A');
  assert.equal(a.actual, 945000);
  assert.equal(a.used, 945000);
  assert.equal(s.totalNet, 2483442 + 945000);
  assert.equal(a.share, 857110);
  assert.equal(a.settle, -87890);
});

test('이월·조정은 담당 정산액에 더하고 주관이 반대로 받는다 — 합은 0, 최종 합은 세후 합', () => {
  const adj = [{ id: 'ADJ-1', consultingId: 'C-1', sid: 'T-A', amount: -1000, memo: '이월' }];
  const s = site(C.settleMonth(notice(), '2026-10', RULE, ctx({ adjusts: adj })), '가나상사');
  const a = mem(s, 'T-A'), l = mem(s, 'T-LEAD');
  assert.equal(a.adjust, -1000);
  assert.deepEqual(a.adjustIds, ['ADJ-1']);
  assert.equal(a.settle, -88915);
  assert.equal(l.settle, 88915);
  assert.equal(a.settle + l.settle, 0);
  assert.equal(a.final + l.final, s.totalNet);
  assert.deepEqual(C.appliedAdjustIds([s]), ['ADJ-1']);
});

test('송금 목록 — 정산액 부호로 방향을 정한다', () => {
  const n = notice();
  const oct = C.transfersOf(C.settleMonth(n, '2026-10', RULE, ctx()).sites, 'T-LEAD');
  assert.deepEqual(oct, [{ consultingId: 'C-1', company: '가나상사', fromSid: 'T-A', toSid: 'T-LEAD', amount: 87915 }]);
  const sep = C.transfersOf(C.settleMonth(n, '2026-09', RULE, ctx()).sites, 'T-LEAD');
  assert.deepEqual(sep.map((t) => [t.company, t.fromSid, t.toSid, t.amount]).sort(),
    [['다라산업', 'T-LEAD', 'T-B', 83509], ['마바상사', 'T-A', 'T-LEAD', 725250]].sort());
});

test('checkRun — 깨끗하면 ok, 확인 필요가 있으면 막는다', () => {
  assert.deepEqual(C.checkRun(C.settleMonth(notice(), '2026-10', RULE, ctx()).sites), { ok: true, issues: [] });
  const noRate = Object.assign({}, RULE, { rates: {} });
  assert.equal(C.checkRun(C.settleMonth(notice(), '2026-10', noRate, ctx()).sites).ok, false);
});

test('diffRun — 사람별 세전·실입금이 바뀌었을 때만 true', () => {
  const a = C.settleMonth(notice(), '2026-10', RULE, ctx()).sites;
  const b = C.settleMonth(notice(), '2026-10', RULE, ctx()).sites;
  assert.equal(C.diffRun(a, b), false);
  b[0].members[1].pre += 10;
  assert.equal(C.diffRun(a, b), true);
});

test('unapplyAdjusts — 그 정산표에 붙었던 조정 id 만 돌려준다', () => {
  const adjusts = { A1: { id: 'A1', appliedRunId: 'cons-test_2026-10' }, A2: { id: 'A2', appliedRunId: 'cons-test_2026-09' }, A3: { id: 'A3', appliedRunId: null } };
  assert.deepEqual(C.unapplyAdjusts(adjusts, 'cons-test_2026-10'), ['A1']);
  assert.equal(C.runId('cons-test', '2026-10'), 'cons-test_2026-10');
});

test('문구 — 담당마다 한 통, 그 사람 사업장만, 금액은 쉼표, 사번은 안 쓴다', () => {
  const run = { monthKey: '2026-09', sites: C.settleMonth(notice(), '2026-09', RULE, ctx()).sites };
  const msgs = C.buildMessages(run, RULE, ctx().names);
  assert.deepEqual(msgs.map((m) => m.sid).sort(), ['T-A', 'T-B']);
  const a = msgs.find((m) => m.sid === 'T-A');
  assert.equal(a.text.split('\n')[0], '[테스트사업 9월 입금분 정산 안내]');
  assert.ok(a.text.indexOf('마바상사') >= 0 && a.text.indexOf('725,250') >= 0);
  assert.equal(a.text.indexOf('다라산업'), -1);
  assert.ok(a.text.indexOf('송금 부탁드립니다') >= 0);
  const b = msgs.find((m) => m.sid === 'T-B');
  assert.ok(b.text.indexOf('83,509') >= 0 && b.text.indexOf('보내 드립니다') >= 0);
  msgs.forEach((m) => assert.equal(m.text.indexOf('T-'), -1));
});

test('문구 머리말·맺음말은 규칙에서 바꿀 수 있다', () => {
  const rule = Object.assign({}, RULE, { msgHead: '<{사업}> {월} 정산', msgFoot: '수고하셨습니다.' });
  const run = { monthKey: '2026-10', sites: C.settleMonth(notice(), '2026-10', rule, ctx()).sites };
  const t = C.buildMessages(run, rule, ctx().names)[0].text;
  assert.equal(t.split('\n')[0], '<테스트사업> 10월 정산');
  assert.equal(t.trim().split('\n').pop(), '수고하셨습니다.');
});

test('normalizeRun — 파이어베이스가 지운 빈 배열·null 칸을 되살리고, 되살린 정산표로 다시 검산이 된다', () => {
  const sites = C.settleMonth(notice(), '2026-10', RULE, ctx()).sites;
  /* 저장→읽기 흉내: JSON 으로 null 을 빼고, 빈 배열을 지우고, 배열을 {0:…} 로 */
  const stored = JSON.parse(JSON.stringify({ id: 'r', sites, issues: [], transfers: [] }, (k, v) => (v === null || (Array.isArray(v) && !v.length) ? undefined : v)));
  stored.sites = { 0: stored.sites[0] };
  const r = C.normalizeRun(stored);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.transfers, []);
  assert.deepEqual(r.sites[0].issues, []);
  assert.equal(r.sites[0].members.find((m) => m.role === 'lead').rate, null);
  assert.deepEqual(r.sites[0].members[0].adjustIds, []);
  assert.deepEqual(C.checkRun(r.sites), { ok: true, issues: [] });
  const n = C.normalizeNotice(JSON.parse(JSON.stringify({ rows: { 1: { name: 'b', company: 'x' }, 0: { name: 'a', company: 'x', amounts: { '2026-10': 1 } } }, months: { 0: { key: '2026-10' } } })));
  assert.deepEqual(n.rows.map((x) => x.name), ['a', 'b']);
  assert.deepEqual(n.rows[1].amounts, {});
});

test('noticeHash — 같은 줄이면 같고, 금액이 다르면 다르다', () => {
  const a = notice(), b = notice();
  assert.equal(C.noticeHash(a.rows), C.noticeHash(b.rows));
  b.rows[0].amounts['2026-10'] += 1;
  assert.notEqual(C.noticeHash(a.rows), C.noticeHash(b.rows));
});
