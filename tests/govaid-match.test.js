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

/* 업종 — 고용·산재보험 업종명·업체관리 업태를 표준산업분류 대분류로. 뜻이 갈리면 «모름»(틀린 업종보다 모름이 낫다) */
test('업종명 → 대분류 — 제조·가공이 먼저, 소매가 음식보다 먼저, 기술서비스가 건설보다 먼저', () => {
  assert.equal(M.industryFromName('자동차부분품제조업'), 'C');
  assert.equal(M.industryFromName('그 외 기타 금속가공업'), 'C');
  assert.equal(M.industryFromName('건설용 금속제품제조업'), 'C', '건설용이어도 제조');
  assert.equal(M.industryFromName('한식 일반 음식점업'), 'I');
  assert.equal(M.industryFromName('조리 반찬류 소매업'), 'G', '반찬 «소매»는 도소매');
  assert.equal(M.industryFromName('건축기술, 엔지니어링 및 관련기술서비스업'), 'M');
  assert.equal(M.industryFromName('기타건설공사'), 'F');
  assert.equal(M.industryFromName('일반 의원'), 'Q');
  assert.equal(M.industryFromName('구역화물운수업'), 'H');
  assert.equal(M.industryFromName('시스템 소프트웨어 개발 및 공급업'), 'J');
  assert.equal(M.industryFromName('인물사진 및 행사용 영상 촬영업'), 'M', '사진 촬영은 전문서비스');
  assert.equal(M.industryFromName('신용조합'), 'K');
  assert.equal(M.industryFromName('지정 외 폐기물 수집, 운반업'), 'E');
});
test('업종명 → 대분류 — 뜻이 갈리는 이름은 모름', () => {
  ['서비스', '서비스업', '사업서비스업', '비영리법인', '각급사무소', '위생 및 유사서비스업', '', null].forEach((n) => {
    assert.equal(M.industryFromName(n), '', String(n));
  });
  assert.equal(M.industryFromName('제조업, 도매 및 소매업', { strict: true }), '', '업태에 둘이 섞이면 모름');
  assert.equal(M.industryFromName('제조 외', { strict: true }), 'C', '«외»는 첫 업태');
});
test('업종 값의 순서 — 사람 > 고용보험 업종 > 산재보험 업종 > 업체관리 업태, 사업장이 여럿이면 인원 많은 곳', () => {
  const ei = { gy: 30, rows: [{ fg: 'sj', ind: '음식 및 숙박업', cnt: 30 }, { fg: 'gy', ind: '자동차부분품제조업', cnt: 5 }, { fg: 'gy', ind: '한식 일반 음식점업', cnt: 25 }] };
  const a = M.profileFromCompany({ id: 'c1', bizType: '제조업' }, { ei: ei }, null);
  assert.equal(a.vals.industry.v, 'I', '고용보험 줄 가운데 인원이 많은 사업장');
  assert.match(a.vals.industry.src, /고용보험/);
  const b = M.profileFromCompany({ id: 'c1', bizType: '제조업' }, { ei: { gy: 0, rows: [{ fg: 'sj', ind: '건설업본사', cnt: 3 }] } }, null);
  assert.equal(b.vals.industry.v, 'F');
  assert.match(b.vals.industry.src, /산재/);
  const c = M.profileFromCompany({ id: 'c1', bizType: '음식업' }, null, null);
  assert.equal(c.vals.industry.v, 'I');
  assert.match(c.vals.industry.src, /업태/);
  assert.equal(M.profileFromCompany({ id: 'c1', bizType: '제조업' }, { ei: ei }, { vals: { industry: 'G' } }).vals.industry.v, 'G');
  assert.equal(M.profileFromCompany({ id: 'c1', bizType: '서비스' }, null, null).vals.industry.v, null, '갈리는 업태는 모름');
});
test('업종을 알면 우선지원 상한도 그 업종으로 — 제조업 고용보험 업종 + 450명은 «예»', () => {
  const p = M.profileFromCompany({ id: 'c1' }, { ei: { gy: 450, rows: [{ fg: 'gy', ind: '자동차부분품제조업', cnt: 450 }] } }, null);
  assert.equal(p.facts.prioritySupport.v, true); // 검사고정-허용: 별표 1 제조업 500명
});
test('업종명 → 대분류 — 표준산업분류 이름은 «끝말»이 업종이다 (운영 자료에서 틀렸던 것)', () => {
  assert.equal(M.industryFromName('제조업 및 유사 산업용 건물 건설업'), 'F');
  assert.equal(M.industryFromName('기타 신선식품 및 단순 가공식품 도매업'), 'G');
  assert.equal(M.industryFromName('국가 및 지방자치단체의 사업'), 'O');
  assert.equal(M.industryFromName('호텔업'), 'I');
  assert.equal(M.industryFromName('임시 및 일용 인력 공급업'), 'N');
  assert.equal(M.industryFromName('경 인쇄업'), 'C');
  assert.equal(M.industryFromName('기타 산업 회사 본부'), 'M');
  assert.equal(M.industryFromName('부동산 중개 및 대리업'), 'L', '부동산 중개는 도소매의 «상품 중개»가 아니다');
  assert.equal(M.industryFromName('요식업', { strict: true }), 'I');
});
