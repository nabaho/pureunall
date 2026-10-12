/* 정부지원금 판정 엔진 — 설계 5절의 판정 규칙을 못 박는다 (2026-10-11)
   ★ 이 검사는 «규칙»을 본다: 초안 제외 · 지난해 확정 = 초안 · 모름 ≠ 0 · 0명은 값 · 안 맞음이 모름을 이긴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/pu-govaid-match.js');

const Y = 2026;
function prog(cond, over) {
  return Object.assign({ id: 'gp-t', name: '시험 사업', status: 'confirmed', baseYear: Y, cond: cond }, over || {});
}
function pf(vals, facts) {
  const v = {};
  ['headcount', 'foundedYear', 'size', 'region', 'industry', 'salesDropPct'].forEach((k) => {
    v[k] = { v: vals && vals[k] !== undefined ? vals[k] : null, src: '시험' };
  });
  const f = {};
  Object.keys(facts || {}).forEach((k) => { f[k] = { v: facts[k], src: '시험' }; });
  return { key: 'co_x', kind: 'co', id: 'x', name: '(예시)회사', bizno: '', aliases: [], vals: v, facts: f };
}

test('초안 사업은 계산하지 않는다 (조건 미확정)', () => {
  const r = M.judge(pf({ headcount: 10 }), prog({ headcount: { min: 5 } }, { status: 'draft' }), Y);
  assert.equal(r.verdict, 'unconfirmed');
});

test('지난해 확정은 올해 계산에서 초안 취급 — 자료는 그대로', () => {
  const p = prog({ headcount: { min: 5 } }, { baseYear: Y - 1 });
  assert.equal(M.judge(pf({ headcount: 10 }), p, Y).verdict, 'unconfirmed');
  assert.equal(p.status, 'confirmed', '판정이 자료를 고쳐 쓰면 안 된다');
});

test('조건이 하나도 없는 확정 사업도 계산하지 않는다 — 모든 회사가 후보로 쏟아지지 않게', () => {
  assert.equal(M.judge(pf({ headcount: 10 }), prog({}), Y).verdict, 'unconfirmed');
});

test('값이 없으면 «모름» → 정보 부족', () => {
  const r = M.judge(pf({}), prog({ headcount: { min: 5 } }), Y);
  assert.equal(r.verdict, 'unknown');
  assert.equal(r.items[0].state, 'unknown');
});

test('0 은 값이다 — 0명은 «모름»이 아니다', () => {
  assert.equal(M.judge(pf({ headcount: 0 }), prog({ headcount: { min: 1 } }), Y).verdict, 'no');
  assert.equal(M.judge(pf({ headcount: 0 }), prog({ headcount: { max: 10 } }), Y).verdict, 'candidate');
});

test('안 맞는 조건이 하나라도 있으면 «안 맞음» — 모름보다 먼저', () => {
  const r = M.judge(pf({ headcount: 3 }), prog({ headcount: { min: 5 }, regions: ['충남'] }), Y);
  assert.equal(r.verdict, 'no');
});

test('사람이 볼 조건은 후보여도 «사람 확인»으로 붙는다', () => {
  const r = M.judge(pf({ headcount: 9 }), prog({ headcount: { min: 5 }, manual: ['경영상 이유'] }), Y);
  assert.equal(r.verdict, 'candidate');
  assert.ok(r.items.some((i) => i.state === 'manual'));
});

test('업력은 개업 연도로 센다', () => {
  assert.equal(M.judge(pf({ foundedYear: Y - 3 }), prog({ yearsInBiz: { max: 7 } }), Y).verdict, 'candidate');
  assert.equal(M.judge(pf({ foundedYear: Y - 9 }), prog({ yearsInBiz: { max: 7 } }), Y).verdict, 'no');
});

test('업종 — 해당 목록 밖이거나 제외 목록 안이면 안 맞음', () => {
  assert.equal(M.judge(pf({ industry: 'C' }), prog({ industries: { include: ['C'] } }), Y).verdict, 'candidate');
  assert.equal(M.judge(pf({ industry: 'F' }), prog({ industries: { include: ['C'] } }), Y).verdict, 'no');
  assert.equal(M.judge(pf({ industry: 'K' }), prog({ industries: { exclude: ['K'] } }), Y).verdict, 'no');
});

test('예/아니오 사실 — 답이 없으면 모름, 원하는 답과 다르면 안 맞음', () => {
  const p = prog({ facts: [{ key: 'retireAgePolicy', want: true }] });
  assert.equal(M.judge(pf({}, {}), p, Y).verdict, 'unknown');
  assert.equal(M.judge(pf({}, { retireAgePolicy: true }), p, Y).verdict, 'candidate');
  assert.equal(M.judge(pf({}, { retireAgePolicy: false }), p, Y).verdict, 'no');
  const notWanted = prog({ facts: [{ key: 'hasFixedTerm', want: false }] });
  assert.equal(M.judge(pf({}, { hasFixedTerm: false }), notWanted, Y).verdict, 'candidate');
});

test('파이어베이스가 배열을 객체로 돌려줘도 같게 판정한다', () => {
  const asArr = prog({ regions: ['충남', '세종'] });
  const asObj = prog({ regions: { 0: '충남', 1: '세종' } });
  assert.equal(M.judge(pf({ region: '세종' }), asArr, Y).verdict, M.judge(pf({ region: '세종' }), asObj, Y).verdict);
  assert.deepEqual(M.list({ 0: 'a', 1: 'b' }), ['a', 'b']);
  assert.deepEqual(M.list(null), []);
});

test('주소 → 시·도 짧은 이름 (모르면 빈 글자)', () => {
  assert.equal(M.regionOf('충청남도 천안시 동남구 …'), '충남');
  assert.equal(M.regionOf('(31116) 충남 천안시'), '충남');
  assert.equal(M.regionOf('세종특별자치시 한누리대로'), '세종');
  assert.equal(M.regionOf('광주광역시 북구'), '광주');
  assert.equal(M.regionOf('광주시 오포읍'), '', '경기 광주시는 광주광역시와 헷갈리므로 모름');
  assert.equal(M.regionOf(''), '');
});

test('국민연금·고용보험 인원 — 자료가 있을 때만 값, 빈 자료의 0 은 모름', () => {
  const nps = M.headcountAuto({ nps: { now: { ym: '202609', cnt: 42 } } });
  assert.equal(nps.v, 42);
  assert.match(nps.src, /국민연금/);
  assert.equal(M.headcountAuto({ nps: { now: { ym: '202609', cnt: 0 } } }).v, 0, '자료가 있는 0 은 값');
  assert.equal(M.headcountAuto({ ei: { rows: null, gy: 0 } }).v, null, '공단에 없는 회사의 gy:0 은 모름');
  assert.equal(M.headcountAuto({ ei: { rows: [{ fg: 'gy', cnt: 7 }], gy: 7 } }).v, 7);
  assert.equal(M.headcountAuto(null).v, null);
});

test('업체 값 — 직접 넣은 값이 이기고, 업체관리 «기타» 규모는 모름', () => {
  const p = M.profileFromCompany({ id: 'c1', name: '(예시)회사', bizNo: '123-45-67890', address: '충남 아산시', companySize: '기타' },
    { nps: { now: { ym: '202609', cnt: 30 } } }, { vals: { headcount: 35 } });
  assert.equal(p.key, 'co_c1');
  assert.equal(p.bizno, '1234567890');
  assert.deepEqual(p.vals.headcount, { v: 35, src: '직접 입력' });
  assert.equal(p.vals.region.v, '충남');
  assert.equal(p.vals.size.v, null);
});

test('예비 고객 값 — 입력한 값을 쓰고 비면 모름', () => {
  const p = M.profileFromProspect({ id: 'p1', name: '(예시)예비', bizno: '', region: '세종', headcount: '' }, null, null);
  assert.equal(p.key, 'pr_p1');
  assert.equal(p.vals.region.v, '세종');
  assert.equal(p.vals.headcount.v, null);
});

test('서울 시각으로 해를 센다 — 12월 31일 15시(UTC)는 서울로 이미 새해', () => {
  assert.equal(M.kstYear(Date.UTC(2026, 11, 31, 15, 0, 0)), 2027);
  assert.equal(M.kstYear(Date.UTC(2026, 11, 31, 14, 0, 0)), 2026);
});

test('«사람이 볼 조건»만 있는 사업은 계산하지 않는다 — 모든 회사가 후보로 쏟아지지 않게', () => {
  const r = M.judge(pf({ headcount: 9 }), prog({ manual: ['경영상 이유로 고용조정이 불가피할 것'] }), Y);
  assert.equal(r.verdict, 'unconfirmed');
});

test('자동 칸(auto) — 사람이 넣은 값 > 업체관리 > 공공데이터 > 자동 추정 순서', () => {
  const extra = { vals: {}, auto: { vals: { headcount: 12, size: '중소기업', foundedYear: 2010 }, src: { headcount: '기업정보함 상시근로자수', size: '추정: 직전년도 매출 72억', foundedYear: '금융위 설립일' } } };
  const a = M.profileFromCompany({ id: 'c1', name: '(예시)회사', companySize: '' }, null, extra);
  assert.deepEqual(a.vals.headcount, { v: 12, src: '기업정보함 상시근로자수' });
  assert.deepEqual(a.vals.size, { v: '중소기업', src: '추정: 직전년도 매출 72억' });
  assert.deepEqual(a.vals.foundedYear, { v: 2010, src: '금융위 설립일' });
  const withPub = M.profileFromCompany({ id: 'c1', companySize: '중기업' }, { ei: { rows: [{ fg: 'gy', cnt: 30 }], gy: 30 } }, extra);
  assert.equal(withPub.vals.headcount.v, 30, '공공데이터가 자동 추정보다 먼저');
  assert.equal(withPub.vals.size.v, '중기업', '업체관리 규모가 자동 추정보다 먼저');
  const mine = M.profileFromCompany({ id: 'c1' }, null, Object.assign({}, extra, { vals: { headcount: 40 } }));
  assert.equal(mine.vals.headcount.v, 40, '사람이 넣은 값이 맨 먼저');
});

test('규모 «중소기업»(소·중 미구분) — 조건이 소·중을 다 받으면 맞음, 둘 다 안 받으면 안 맞음, 하나만 받으면 모름', () => {
  const v = { headcount: null, foundedYear: null, size: '중소기업', region: null, industry: null, salesDropPct: null };
  assert.equal(M.judge(pf(v), prog({ sizes: ['소기업', '중기업'] }), Y).verdict, 'candidate');
  assert.equal(M.judge(pf(v), prog({ sizes: ['소기업', '중기업', '중견기업'] }), Y).verdict, 'candidate');
  assert.equal(M.judge(pf(v), prog({ sizes: ['중견기업', '대기업'] }), Y).verdict, 'no');
  assert.equal(M.judge(pf(v), prog({ sizes: ['소기업'] }), Y).verdict, 'unknown');
});

/* 우선지원대상기업 — 고용보험법 시행령 제12조·별표 1(개정 2025. 10. 1., 2026-10-12 원문 확인).
   숫자 500·300·200·100 은 법이 정한 업종별 상한이다 — 검사고정-허용: 시행령 별표 1 의 기준 그 자체 */
function coWith(vals, facts) {
  return M.profileFromCompany({ id: 'c1', name: '(예시)회사', companySize: vals.companySize || '' }, null,
    { vals: Object.assign({}, vals.mine || {}), facts: facts || {}, auto: { vals: vals.auto || {}, src: {} } });
}
test('우선지원 — 상시 인원이 업종 상한 이하면 «예»(추정), 업종을 모르면 가장 낮은 상한으로 본다', () => {
  const t = coWith({ mine: { headcount: 80 } });
  assert.equal(t.facts.prioritySupport.v, true);
  assert.match(t.facts.prioritySupport.src, /^추정/);
  assert.match(t.facts.prioritySupport.src, /별표 1/);
  assert.equal(coWith({ mine: { headcount: 450, industry: 'C' } }).facts.prioritySupport.v, true, '제조업 상한 500명'); // 검사고정-허용: 별표 1
  assert.equal(coWith({ mine: { headcount: 250, industry: 'F' } }).facts.prioritySupport.v, true, '건설업 상한 300명'); // 검사고정-허용: 별표 1
  assert.equal(coWith({ mine: { headcount: 150, industry: 'G' } }).facts.prioritySupport.v, true, '도소매 상한 200명'); // 검사고정-허용: 별표 1
  assert.equal(coWith({ mine: { headcount: 150, industry: 'P' } }).facts.prioritySupport, undefined, '그 밖의 업종 100명 초과 — 모름');
  assert.equal(coWith({ mine: { headcount: 150 } }).facts.prioritySupport, undefined, '업종 모름 + 100명 초과 — 모름');
});
test('우선지원 — 중소기업이면 인원과 상관없이 «예»(시행령 제12조 ②), 아니라고는 추정하지 않는다', () => {
  const s = coWith({ mine: { headcount: 900 }, auto: { size: '중소기업' } });
  assert.equal(s.facts.prioritySupport.v, true);
  assert.match(s.facts.prioritySupport.src, /제12조/);
  assert.equal(coWith({ companySize: '소기업' }).facts.prioritySupport.v, true);
  /* 대기업이라도 5년 유예(③)·업종 상한이 있어 «아니오»는 사람이 판단한다 */
  assert.equal(coWith({ mine: { headcount: 900 }, companySize: '대기업' }).facts.prioritySupport, undefined);
});
test('우선지원 — 사람이 넣은 답이 추정을 이긴다 (아니오 포함)', () => {
  const t = coWith({ mine: { headcount: 10 } }, { prioritySupport: false });
  assert.deepEqual(t.facts.prioritySupport, { v: false, src: '직접 입력' });
});
test('우선지원 — 인원 0 은 추정 근거가 아니다(가입자 0 은 «근로자 없음»이 아닐 수 있다)', () => {
  assert.equal(coWith({ mine: { headcount: 0 } }).facts.prioritySupport, undefined);
});
test('우선지원 — 예비 고객도 같은 규칙', () => {
  const p = M.profileFromProspect({ id: 'p1', name: '(예시)예비', headcount: 30 }, null, null);
  assert.equal(p.facts.prioritySupport.v, true);
});
