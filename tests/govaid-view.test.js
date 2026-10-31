/* 정부지원금 화면 묶음 — 예비 고객 접기 · 지운 것 빼기 · 표 열 숨기기 (2026-10-11) */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/pu-govaid-view.js');

const Y = 2026;
const P1 = { id: 'gp-a', name: '가 사업', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 5 } } };
const P2 = { id: 'gp-b', name: '나 사업', status: 'confirmed', baseYear: Y, cond: { regions: ['제주'] } };
const P3 = { id: 'gp-c', name: '다 사업', status: 'draft', cond: {} };
const COS = { v: [
  { id: 'c1', name: '(예시)가나다', bizNo: '111-11-11111', address: '충남 천안시', status: 'active' },
  { id: 'c2', name: '(예시)끝난곳', bizNo: '222-22-22222', status: 'terminated' },
  { id: 'c3', name: '(예시)지운곳', _deleted: true },
] };
const PUB = { 1111111111: { nps: { now: { ym: '202609', cnt: 12 } } } };

test('봉투를 벗기고, 지운 것·끝난 업체는 뺀다', () => {
  assert.deepEqual(V.companies(COS).map((c) => c.id), ['c1']);
  assert.deepEqual(V.programs({ a: P1, b: Object.assign({}, P2, { _deleted: true }) }).map((p) => p.id), ['gp-a']);
});

test('업체와 이어진 예비 고객은 목록에 따로 안 나오고 업체 쪽 별칭이 된다', () => {
  const prs = { p1: { id: 'p1', name: '(예시)예비', companyLinkStatus: 'linked', companyId: 'c1' },
                p2: { id: 'p2', name: '(예시)새손님', companyLinkStatus: 'pending' } };
  const s = V.subjects(COS, prs, PUB, {});
  assert.deepEqual(s.map((x) => x.key).sort(), ['co_c1', 'pr_p2']);
  assert.deepEqual(s.find((x) => x.key === 'co_c1').aliases, ['pr_p1']);
  assert.equal(s.find((x) => x.key === 'co_c1').vals.headcount.v, 12, '사업자번호로 공공데이터를 붙인다');
});

test('검토는 업체 열쇠 먼저, 없으면 이어진 예비 고객 때의 검토 — 지운 검토는 없는 셈', () => {
  const pf = { key: 'co_c1', aliases: ['pr_p1'] };
  const rv = { pr_p1: { 'gp-a': { decision: 'hold' } }, co_c1: { 'gp-b': { decision: 'yes', _deleted: true } } };
  assert.equal(V.reviewOf(rv, pf, 'gp-a').decision, 'hold');
  assert.equal(V.reviewOf(rv, pf, 'gp-b'), null);
});

test('회사 하나 — 사업을 판정 묶음으로 가른다', () => {
  const pf = V.subjects(COS, {}, PUB, {})[0];
  const g = V.forSubject(pf, [P1, P2, P3], Y);
  assert.deepEqual(g.candidate.map((x) => x.program.id), ['gp-a']);
  assert.deepEqual(g.no.map((x) => x.program.id), ['gp-b']);
  assert.deepEqual(g.unconfirmed.map((x) => x.program.id), ['gp-c']);
});

test('한눈 표 — 후보·정보 부족이 하나도 없는 사업 열은 숨긴다', () => {
  const s = V.subjects(COS, {}, PUB, {});
  const g = V.grid(s, [P1, P2, P3], Y);
  assert.deepEqual(g.cols.map((p) => p.id), ['gp-a']);
  assert.equal(g.rows[0].candidates, 1);
});

test('사업 하나 — 후보·정보 부족 회사와 안 맞음 수', () => {
  const s = V.subjects(COS, { p2: { id: 'p2', name: '(예시)새손님' } }, PUB, {});
  const g = V.forProgram(P1, s, Y);
  assert.deepEqual(g.candidate.map((x) => x.profile.key), ['co_c1']);
  assert.deepEqual(g.unknown.map((x) => x.profile.key), ['pr_p2']);
  assert.equal(g.no, 0);
});

test('검토 기록에 남길 «그때의 판정»', () => {
  const snap = V.snapshot({ verdict: 'candidate', items: [{ key: 'headcount', label: '근로자 5명 이상', state: 'ok', extra: 1 }] });
  assert.deepEqual(snap, { verdict: 'candidate', items: [{ key: 'headcount', label: '근로자 5명 이상', state: 'ok' }] });
});

test('확인할 조건 — 초안이거나 지난해 확정이면 확인 필요', () => {
  assert.equal(V.needsCheck(P1, Y), false);
  assert.equal(V.needsCheck(P3, Y), true);
  assert.equal(V.needsCheck(Object.assign({}, P1, { baseYear: Y - 1 }), Y), true);
});

/* 사업 중심 — 부처(관) 중심으로 묶는다 (대표 지시 2026-10-12 「고용노동부 등 관 중심으로 우선 재편」) */
test('담당기관 → 부처: 앞머리만 (괄호·가운뎃점·빗금 뒤는 산하기관)', () => {
  assert.equal(V.ministryOf('고용노동부(기업훈련지원과)·한국산업인력공단'), '고용노동부');
  assert.equal(V.ministryOf('중소벤처기업부 · 중소벤처기업진흥공단'), '중소벤처기업부');
  assert.equal(V.ministryOf('병무청(선정·인원배정) / 분야별 추천권자: 중소벤처기업부 등'), '병무청');
  assert.equal(V.ministryOf('특허청'), '특허청');
  assert.equal(V.ministryOf(''), '기관 모름');
});
test('부처 묶음 — 고용노동부가 맨 앞, 그다음 사업이 많은 부처, 기관 모름은 맨 끝', () => {
  const mk = (id, agency) => ({ id, name: id, agency });
  const g = V.byMinistry([mk('a', '중소벤처기업부'), mk('b', '특허청'), mk('c', '중소벤처기업부'), mk('d', ''), mk('e', '고용노동부·한국산업인력공단')]);
  assert.deepEqual(g.map((x) => x.ministry), ['고용노동부', '중소벤처기업부', '특허청', '기관 모름']);
  assert.deepEqual(g[1].items.map((p) => p.id), ['a', 'c'], '묶음 안에서는 받은 차례 그대로');
});
test('목록에 보일 이름 — 앞의 «2026년(도)»는 떼고 해는 따로 돌려준다', () => {
  assert.deepEqual(V.shortTitle({ name: '2026년도 중소기업 클라우드 서비스 보급·확산 사업' }), { title: '중소기업 클라우드 서비스 보급·확산 사업', year: '2026' });
  assert.deepEqual(V.shortTitle({ name: '고용유지지원금' }), { title: '고용유지지원금', year: '' });
});

/* 회사별 «준비할 서류» — 후보 사업의 서류를 낱말로 모아, 서류마다 쓰이는 사업을 단다 (대표 지시 2026-10-12) */
test('준비할 서류 — 후보 사업만, 같은 낱말은 하나로 모으고 노무 서류가 먼저', () => {
  const pf = { key: 'co_x', kind: 'co', vals: { headcount: { v: 10 } }, facts: {} };
  const A = { id: 'a', name: '가 장려금', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 5 } },
    docs: [{ key: 'bizReg', label: '사업자등록증' }, { key: 'contract', label: '근로계약서(채용자)' }] };
  const B = { id: 'b', name: '나 장려금', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 1 } },
    docs: [{ key: 'contract', label: '근로계약서' }, { key: 'other', label: '특허 등록원부' }] };
  const C = { id: 'c', name: '다 사업', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 50 } },
    docs: [{ key: 'payroll', label: '임금대장' }] };
  const out = V.docsFor(pf, [A, B, C], Y);
  assert.equal(out[0].key, 'contract', '노무 서류가 맨 앞');
  assert.equal(out[0].labor, true);
  assert.deepEqual(out[0].programs.map((p) => p.id), ['a', 'b']);
  assert.ok(!out.some((d) => d.key === 'payroll'), '후보가 아닌 사업(다)의 서류는 빼고');
  assert.ok(out.some((d) => d.key === 'other' && d.label === '특허 등록원부'), '«그 밖»은 공고 이름 그대로');
});
test('짧은 이름 — 사람이 넣은 것이 먼저, 없으면 해·괄호·꼬리 «지원사업»을 떼고 10자 넘으면 자른다', () => {
  assert.equal(V.shortName({ name: '체계적 현장훈련(S-OJT) 지원', short: 'S-OJT' }), 'S-OJT');
  assert.equal(V.shortName({ name: '2026년 중소기업 혁신바우처 사업' }), '중소기업 혁신바우처');
  assert.equal(V.shortName({ name: '고용유지지원금' }), '고용유지지원금');
  assert.ok(V.shortName({ name: '국가인적자원개발컨소시엄 지원 — 산업맞춤형 공동훈련센터' }).length <= 10);
});

test('사업종료 — 회사별 묶음에 «종료» 칸, 사업별로는 종료된 사업이 후보를 내지 않는다', () => {
  const pf = { key: 'co_x', kind: 'co', vals: { headcount: { v: 10 } }, facts: {} };
  const P = { id: 'z', name: '마감 사업', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 5 } }, closure: { state: 'closed', reason: 'budget' } };
  const g = V.forSubject(pf, [P], Y);
  assert.equal(g.closed.length, 1);
  assert.equal(g.candidate.length, 0);
  const fp = V.forProgram(P, [pf], Y);
  assert.equal(fp.candidate.length, 0);
  assert.equal(fp.closed, 1);
});

/* 📰 새 공고 목록 (2026-10-12) — 서버가 쌓은 공고를 «처리할 것»부터 거른다 */
test('새 공고 거르기 — 비슷한 것·전체·이은 것·관계없음, 접수 중만, 이은 사업은 program.bizinfo 로 안다', () => {
  const T = '2026-10-12';
  const N = {
    a: { id: 'a', no: 'a', nm: '청년 공고', field: '인력', closeDt: '2026-11-30', openDt: '2026-10-01', suggest: [{ id: 'p1', score: 0.9 }] },
    b: { id: 'b', no: 'b', nm: '마감 공고', field: '금융', closeDt: '2026-04-30', openDt: '2026-03-01', suggest: [{ id: 'p1', score: 0.7 }] },
    c: { id: 'c', no: 'c', nm: '관계없는 공고', field: '경영', closeDt: '', openDt: '2026-10-05', decision: 'ignore' },
    d: { id: 'd', no: 'd', nm: '이은 공고', field: '수출', closeDt: '2026-12-31', openDt: '2026-09-01' },
    e: { id: 'e', no: 'e', nm: '그냥 공고', field: '기술', closeDt: '', openDt: '2026-10-10' },
  };
  const P = [{ id: 'p1', name: '청년도약', status: 'confirmed', baseYear: 2026 }, { id: 'p2', name: '수출', bizinfo: ['d'] }];
  const ids = (o) => V.noticeRows(N, P, Object.assign({ today: T }, o)).map((r) => r.n.id);
  assert.deepEqual(ids({ view: 'sug', openOnly: true }), ['a']);
  assert.deepEqual(ids({ view: 'sug', openOnly: false }).sort(), ['a', 'b']);
  assert.deepEqual(ids({ view: 'all', openOnly: true }).sort(), ['a', 'e'], '처리했거나 이은 것은 «전체»에서도 뺀다');
  assert.deepEqual(ids({ view: 'labor', openOnly: false }), ['a'], '인력·경영 분야만(처리 안 한 것)');
  assert.deepEqual(ids({ view: 'linked' }), ['d']);
  assert.equal(V.noticeRows(N, P, { view: 'linked', today: T })[0].linkedTo.id, 'p2');
  assert.deepEqual(ids({ view: 'ignored' }), ['c']);
  assert.equal(V.noticeRows(N, P, { view: 'sug', today: T })[0].sug[0].p.id, 'p1', '제안은 사업 레코드로 돌려준다');
  assert.deepEqual(ids({ view: 'all', q: '그냥' }), ['e']);
  assert.equal(V.noticeCount(N, P, T), 1, '탭 숫자 = 처리 안 한 «비슷한» 공고 중 접수 중');
});

test('별표 — 켜진 사업만 ★, 거르기는 별 사업만 남긴다', () => {
  const P = [{ id: 'a', star: { on: true } }, { id: 'b', star: { on: false } }, { id: 'c' }];
  assert.deepEqual(P.map(V.isStar), [true, false, false]);
  assert.deepEqual(V.starOnly(P, true).map((p) => p.id), ['a']);
  assert.deepEqual(V.starOnly(P, false).map((p) => p.id), ['a', 'b', 'c']);
});

/* 지자체 공고 (대표 지시 2026-10-31 「각 지자체별로 진행되는 지원사업등 매칭」 → 「추천대로」: 공고 그대로 회사에 매칭) */
const T31 = '2026-10-31';
const LN = {
  a: { id: 'a', nm: '[충남] 아산시 해외마케팅', area: { sido: ['충남'], sgg: ['아산시'] }, who: ['중소기업'], closeDt: '2026-11-14', openDt: '2026-10-01' },
  b: { id: 'b', nm: '[충남] 중소기업육성자금', area: { sido: ['충남'], sgg: [] }, who: ['중소기업'], closeDt: '', openDt: '2026-01-02' },
  c: { id: 'c', nm: '[충남] 공주시 특례보증', area: { sido: ['충남'], sgg: ['공주시'] }, who: ['소상공인'], closeDt: '', openDt: '2026-02-01' },
  d: { id: 'd', nm: '[충남] 소상공인자금', area: { sido: ['충남'], sgg: [] }, who: ['소상공인'], closeDt: '', openDt: '2026-01-05' },
  e: { id: 'e', nm: '[충남] 마감 공고', area: { sido: ['충남'], sgg: [] }, who: [], closeDt: '2026-09-30', openDt: '2026-09-01' },
  f: { id: 'f', nm: '[충남] 관계없음 둔 것', area: { sido: ['충남'], sgg: [] }, who: [], closeDt: '', decision: 'ignore', openDt: '2026-03-01' },
  g: { id: 'g', nm: '전국 공고', area: { sido: [], sgg: [] }, who: [], closeDt: '', openDt: '2026-03-01' },
  h: { id: 'h', nm: '[경기] 수원시 공고', area: { sido: ['경기'], sgg: ['수원시'] }, who: [], closeDt: '', openDt: '2026-03-01' },
};
const pfOf = (key, region, sgg, hc) => ({ key, kind: 'co', vals: { region: { v: region }, sigungu: { v: sgg }, headcount: { v: hc } }, facts: {} });
test('우리 지역 공고 — 시·도가 같고, 시·군 공고면 시·군도 같아야, 접수 중·처리 안 한 것만, 시·군 공고가 먼저', () => {
  const rs = V.localNotices(pfOf('co_1', '충남', '아산시', 22), LN, T31);
  assert.deepEqual(rs.map((r) => r.n.id), ['a', 'b', 'd']);
  assert.equal(rs[0].scope, 'sgg');
  assert.equal(rs[1].scope, 'sido');
  assert.match(rs[2].mismatch, /소상공인/, '근로자 22명 — 소상공인 대상 공고는 흐리게');
  assert.equal(rs[1].mismatch, '');
  assert.deepEqual(V.localNotices(pfOf('co_2', '', '', 3), LN, T31), [], '지역을 모르면 없음');
});
test('지역 요약 — 고객사가 있는 시·도·시·군마다 고객사 수와 접수 중 지역 공고 수(시·군 + 도 전체)', () => {
  const S = V.regionSummary([pfOf('co_1', '충남', '아산시', 5), pfOf('co_2', '충남', '아산시', 5), pfOf('co_3', '충남', '천안시', 5), pfOf('co_4', '', '', 5)], LN, T31);
  const as = S.find((x) => x.sido === '충남' && x.sgg === '아산시');
  assert.equal(as.cos, 2);
  assert.equal(as.sggOpen, 1);
  assert.equal(as.sidoOpen, 2, '도 전체 공고 b·d');
  assert.equal(S[0].sgg, '아산시', '고객사 많은 곳이 먼저');
  assert.ok(S.some((x) => x.sido === '' && x.cos === 1), '지역 모름도 센다');
});
test('새 공고 «지역 공고» 보기 — 고객사가 있는 지역의 지역 공고만, 해당 고객사 수를 단다', () => {
  const P = [pfOf('co_1', '충남', '아산시', 5), pfOf('co_2', '충남', '천안시', 5)];
  const rs = V.noticeRows(LN, [], { view: 'local', openOnly: true, today: T31, profiles: P });
  assert.deepEqual(rs.map((r) => r.n.id).sort(), ['a', 'b', 'd']);
  assert.equal(rs.find((r) => r.n.id === 'b').cos, 2);
  assert.equal(rs.find((r) => r.n.id === 'a').cos, 1);
});
