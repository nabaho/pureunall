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

/* ── 입금 대조 (대표 지시 2026-10-31 「개개인에게 입금된 금액을 비교 … 복사 붙여넣기 … 당겨오기」) ── */
test('붙여넣기 읽기 — 인터넷뱅킹·입금 문자·엑셀 줄에서 금액만, 잔액·계좌번호·날짜·시각은 빼고 출금 줄은 건너뛴다', () => {
  const text = [
    '2026.10.30 14:22:10\t입금\t가나재단\t945,033\t\t12,345,678',
    '[Web발신] 하나 10/30 14:23 123-******-45678 입금 2,483,442원 가나재단 잔액15,000,000원',
    '2026-10-31 09:10 출금 관리비 330,000',
    '10.29 다라협회 977,273'
  ].join('\n');
  const f = C.parseDepositText(text);
  const amounts = f.map((x) => x.amount);
  assert.ok(amounts.indexOf(945033) >= 0, JSON.stringify(amounts));
  assert.ok(amounts.indexOf(2483442) >= 0);
  assert.ok(amounts.indexOf(977273) >= 0);
  assert.equal(amounts.indexOf(15000000), -1, '잔액은 금액이 아니다');
  assert.equal(amounts.indexOf(330000), -1, '출금 줄은 건너뛴다');
  assert.equal(amounts.some((a) => String(a).indexOf('45678') >= 0 && a < 100000), false, '계좌번호 조각을 금액으로 읽지 않는다');
  assert.equal(f.find((x) => x.amount === 945033).date, '2026-10-30');
  assert.equal(f.find((x) => x.amount === 977273).date, '10-29');
});

test('재무관리 거래내역 — 기간 안 «입금»만, 지운 묶음·카드 취소·지출은 뺀다', () => {
  const batches = { v: [
    { id: 'lb1', rows: [
      { _k: 'a', type: 'income', date: '2026-10-02 10:01', amount: 2483442, memo: '가나재단', note: '하나은행 문자 · ****1234' },
      { _k: 'b', type: 'expense', date: '2026-10-02 11:00', amount: 50000 },
      { _k: 'c', type: 'income', date: '2026-08-01', amount: 999999 },
      { _k: 'd', type: 'income', date: '2026-10-05', amount: 120000, cancel: true }
    ] },
    { id: 'lb2', _deleted: true, rows: [{ _k: 'e', type: 'income', date: '2026-10-03', amount: 2483442 }] }
  ] }.v;
  const w = C.depositWindow('2026-09');
  assert.deepEqual(w, { from: '2026-09-01', to: '2026-10-20' });
  const got = C.ledgerDeposits(batches, w.from, w.to);
  assert.deepEqual(got.map((x) => [x.amount, x.memo, x.source]), [[2483442, '가나재단', 'ledger']]);
  assert.deepEqual(C.depositWindow('2026-12'), { from: '2026-12-01', to: '2027-01-20' });
});

test('예상 세후 — 그 사람의 사업장마다 한 줄(계산한 세후)', () => {
  const sites = C.settleMonth(notice(), '2026-10', RULE, ctx({ actuals: { 'C-1|T-A': 945000 } })).sites;
  assert.deepEqual(C.expectedFor({ sites }, 'T-A'), [{ key: 'C-1|T-A', company: '가나상사', round: 1, amount: 945033, actual: 945000 }]);
  assert.deepEqual(C.expectedFor({ sites }, 'T-LEAD').map((e) => e.amount), [2483442]);
});

test('맞추기 — 같은 금액 먼저, 1% 안쪽은 «가까움»(차이 표시), 찾은 줄은 한 번만 쓴다', () => {
  const exp = [{ key: 'C-1|T-LEAD', company: '가나상사', amount: 2483442 }, { key: 'C-2|T-LEAD', company: '다라산업', amount: 2483442 },
    { key: 'C-3|T-LEAD', company: '마바상사', amount: 1934000 }, { key: 'C-4|T-LEAD', company: '사아상사', amount: 500000 }];
  const found = [{ id: 'x1', amount: 2483442 }, { id: 'x2', amount: 2483442 }, { id: 'x3', amount: 1933980 }, { id: 'x4', amount: 777777 }];
  const m = C.matchDeposits(exp, found);
  assert.deepEqual(m.map((o) => [o.kind, o.found && o.found.id, o.diff]), [['exact', 'x1', 0], ['exact', 'x2', 0], ['near', 'x3', -20], ['none', null, null]]);
});

/* ── 계산기 (대표 지시 2026-10-31 「컨설팅종류, 사업장 수행자 요율 등 각각 선택하게 하고 그부분만 반영하게 간단하게」) ── */
test('계산기 — 사업장 하나: 주관 1 + 담당, 정산표와 같은 식', () => {
  const r = C.calcSite([{ sid: 'T-LEAD', name: '홍길동', role: 'lead', pre: '2,568,182' }, { sid: 'T-A', name: '김가나', role: 'staff', pre: 977273, rate: '25' }]);
  assert.deepEqual(r.issues, []);
  assert.equal(r.totalNet, 3428475);
  const a = r.members[1], l = r.members[0];
  assert.deepEqual([a.net, a.share, a.settle, a.final], [945033, 857118, -87915, 857118]);
  assert.deepEqual([l.net, l.settle, l.final], [2483442, 87915, 2571357]);
  assert.deepEqual(r.transfers, [{ from: '김가나', to: '홍길동', amount: 87915 }]);
});

test('계산기 — 담당 둘·통장 실입금, 정산액 합 0', () => {
  const r = C.calcSite([{ name: '홍길동', role: 'lead', pre: 2568182 }, { name: '김가나', role: 'staff', pre: 977273, rate: 25, actual: '945,000' },
    { name: '이다라', role: 'staff', pre: 977273, rate: 30 }]);
  assert.deepEqual(r.issues, []);
  assert.equal(r.members[1].used, 945000);
  assert.equal(r.members.reduce((s, m) => s + m.settle, 0), 0);
  assert.equal(r.members.reduce((s, m) => s + m.final, 0), r.totalNet);
  /* 담당이 둘이면 사업장 합계가 커져 김가나 몫(1,093,368)도 받은 돈(945,000)보다 크다 — 둘 다 주관에게서 받는다 */
  assert.equal(r.members[1].share, 1093368);
  assert.deepEqual(r.transfers.map((t) => t.to + '<' + t.from + ':' + t.amount), ['김가나<홍길동:148368', '이다라<홍길동:367009']);
});

test('계산기 — 주관 없음·주관 둘·요율 없음·금액 없음은 알리고 정산액을 내지 않는다', () => {
  assert.ok(C.calcSite([{ name: '김가나', role: 'staff', pre: 1000000, rate: 25 }]).issues.some((x) => x.indexOf('주관') >= 0));
  assert.ok(C.calcSite([{ name: 'A', role: 'lead', pre: 1 }, { name: 'B', role: 'lead', pre: 1 }]).issues.some((x) => x.indexOf('한 사람') >= 0));
  const r = C.calcSite([{ name: '홍길동', role: 'lead', pre: 2000000 }, { name: '김가나', role: 'staff', pre: 1000000, rate: '' }]);
  assert.ok(r.issues.some((x) => x.indexOf('김가나') >= 0 && x.indexOf('요율') >= 0));
  assert.equal(r.members[0].settle, null);
  assert.deepEqual(r.transfers, []);
  assert.ok(C.calcSite([]).issues.length > 0);
});

test('noticeHash — 같은 줄이면 같고, 금액이 다르면 다르다', () => {
  const a = notice(), b = notice();
  assert.equal(C.noticeHash(a.rows), C.noticeHash(b.rows));
  b.rows[0].amounts['2026-10'] += 1;
  assert.notEqual(C.noticeHash(a.rows), C.noticeHash(b.rows));
});
