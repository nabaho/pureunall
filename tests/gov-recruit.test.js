/* 정부사업신청 › 컨설턴트 모집 — 순수 모듈을 «돌려 보는» 검사 (2026-10-04) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/gov-recruit.js');

test('준비 알림 날 — 모집 달의 앞 달 1일, 오늘 이후 가장 가까운 것', () => {
  const loc = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  assert.equal(loc(R.prepDate(1, '2026-10-04T09:00:00')), '2026-12-01');
  assert.equal(loc(R.prepDate(10, '2026-10-04T09:00:00')), '2027-09-01', '이미 지난 앞 달이면 내년');
  assert.equal(loc(R.prepDate(11, '2026-10-01T09:00:00')), '2026-10-01', '오늘이 그날이면 오늘');
  assert.equal(R.prepDate(0, '2026-10-04'), null, '달을 모르면 지어내지 않는다');
});
test('★ 구글 캘린더 창 주소 — 하루짜리, 해마다는 RRULE, 틀린 날짜는 빈 값', () => {
  const u = R.gcalUrl({ title: 'A B', date: '2027-01-31', details: 'x' });
  assert.match(u, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=A%20B&dates=20270131\/20270201&details=x$/);
  assert.match(R.gcalUrl({ title: 'A', date: '2027-01-31', yearly: true }), /&recur=RRULE%3AFREQ%3DYEARLY$/);
  assert.equal(R.gcalUrl({ title: 'A', date: 'nope' }), '');
  assert.equal(R.dueEvent({ name: 'X' }, '2027/01/31'), '', '날짜 꼴이 아니면 안 만든다');
});
test('★ 캘린더 주소에 싣는 것은 기관 이름·하는 일·공지뿐이다', () => {
  const u = decodeURIComponent(R.prepEvent({ name: '기관', what: '컨설턴트', url: 'https://a.example/', month: 3, items: [{ name: '비밀 서류.hwp' }] }, '2026-10-04'));
  assert.doesNotMatch(u, /비밀 서류/, '폴더 이름(지원 이력)을 구글로 보내지 않는다');
  assert.match(u, /기관/); assert.match(u, /https:\/\/a\.example\//);
});

const T = (y, m) => new Date(y, m - 1, 15).getTime();
const E = [
  { y: '2024', name: '2024 공기업평가원 상시자문위원모집공고', t: T(2024, 1) },
  { y: '2025', name: '2025_지방공기업평가원_자문위원_인사노무.zip', t: T(2025, 1) },
  { y: '2026', name: '2026 지방공기업평가원 정책연구 외부연구진 풀 모집', t: T(2026, 4) },
  { y: '2023', name: '2023 서산 비정규직 노무사', t: T(2023, 2) },
  { y: '2022', name: '2022년도 비정규직 고용구조개선 지원단 컨설팅 사업 컨설턴트 모집 안내', t: T(2022, 3) },
  { y: '2024', name: '2024세종일자리경제진흥원 이사', t: T(2024, 5) },
  { y: '2025', name: '2025충남경제진흥원 산업일자리 전환', t: T(2025, 3) },
  { y: '2025', name: '2025 경영평가위원위촉 알리오', t: T(2025, 12) },
  { y: '2017', name: '2017종합소득세신고', t: T(2017, 5) }
];

test('기관별로 묶는다 — 이름 하나는 처음 맞는 기관 하나에만', () => {
  const g = R.group(E, []);
  const by = Object.fromEntries(g.orgs.map((o) => [o.id, o]));
  assert.deepEqual(by.erc.years, ['2024', '2025', '2026']);
  assert.equal(by.erc.items.length, 3);
  assert.deepEqual(by.alio.years, ['2025']);
  assert.ok(g.rest.some((e) => /종합소득세/.test(e.name)), '모집과 무관한 것은 남긴다');
});

test('★ 서산 비정규직은 노사발전재단(고용구조개선)이 아니라 서산으로 간다', () => {
  const by = Object.fromEntries(R.group(E, []).orgs.map((o) => [o.id, o]));
  assert.deepEqual(by.seosan.years, ['2023']);
  assert.deepEqual(by.nosa.years, ['2022'], '고용구조개선은 노사발전재단');
});

test('★ 세종일자리경제진흥원은 충남일자리경제진흥원에 섞지 않는다', () => {
  const by = Object.fromEntries(R.group(E, []).orgs.map((o) => [o.id, o]));
  assert.deepEqual(by.cepa.years, ['2025']);
  assert.ok(R.group(E, []).rest.some((e) => /세종일자리/.test(e.name)));
});

test('가장 잦은 달을 쓴다 — 한 건 튀는 날짜에 끌려가지 않는다', () => {
  assert.equal(R.typicalMonth([{ t: T(2024, 1) }, { t: T(2025, 1) }, { t: T(2026, 4) }]), 1);
  assert.equal(R.typicalMonth([{ t: T(2023, 1) }, { t: T(2024, 3) }, { t: T(2025, 3) }]), 3, '이른 달 하나가 튀어도 잦은 달');
});
test('비기면 «이른» 달 — 알림은 이른 쪽이 안전하다', () => {
  assert.equal(R.typicalMonth([{ t: T(2024, 3) }, { t: T(2025, 1) }]), 1);
});
test('날짜를 모르면 0 (지어내지 않는다)', () => {
  assert.equal(R.typicalMonth([{ t: 0 }, {}]), 0);
});

test('몇 달 뒤인가 — 해를 넘어 돈다', () => {
  assert.equal(R.monthsAhead(10, '2026-10-04'), 0);
  assert.equal(R.monthsAhead(1, '2026-10-04'), 3);
  assert.equal(R.monthsAhead(9, '2026-10-04'), 11);
  assert.equal(R.monthsAhead(0, '2026-10-04'), 99, '달을 모르면 맨 뒤');
});

test('★ 줄 세우기 — 지원한 적 있는 곳만, 가까운 달부터', () => {
  const od = R.order(R.group(E, []).orgs, '2026-10-04');
  assert.ok(od.every((o) => o.years.length), '한 번도 안 낸 사전 기관은 안 보인다');
  assert.equal(od[0].id, 'alio', '10월 기준 12월이 가장 가깝다');
  const a = od.map((o) => R.monthsAhead(o.month, '2026-10-04'));
  assert.deepEqual(a, a.slice().sort((x, y) => x - y));
});
test('같은 달이면 여러 해 낸 곳이 위', () => {
  const e = [{ y: '2024', name: '2024 LH 자문', t: T(2024, 2) },
    { y: '2025', name: '2025 LH공사', t: T(2025, 2) },
    { y: '2025', name: '2025 새마을 금고', t: T(2025, 2) }];
  const od = R.order(R.group(e, []).orgs, '2026-01-10');
  assert.deepEqual(od.map((o) => o.id), ['lh', 'kfcc']);
});

test('★ 이번 달·다음 달을 짚는다', () => {
  const s = R.soon(R.group(E, []).orgs, '2025-12-01');
  assert.deepEqual(s.now.map((o) => o.id), ['alio']);
  assert.ok(s.next.some((o) => o.id === 'erc'), '1월은 다음 달');
  assert.equal(s.near, null);
});
test('이번 달·다음 달에 없으면 가장 가까운 달과 곳 수를 말한다', () => {
  const s = R.soon(R.group(E, []).orgs, '2026-10-04');
  assert.deepEqual(s.now, []); assert.deepEqual(s.next, []);
  assert.deepEqual(s.near, { month: 12, count: 1, ahead: 2 });
});

test('올해 냈나 — 폴더에 올해 이름이 있으면 냈다', () => {
  const by = Object.fromEntries(R.group(E, []).orgs.map((o) => [o.id, o]));
  assert.equal(R.appliedThisYear(by.erc, '2026-10-04'), true);
  assert.equal(R.appliedThisYear(by.alio, '2026-10-04'), false);
});

test('★ 손으로 더한 기관 — 낱말로 찾고, 사전보다 앞선다', () => {
  const g = R.group([{ y: '2025', name: '2025 대전지방법원 조정위원', t: T(2025, 3) },
    { y: '2024', name: '2024 LH 법원 자문', t: T(2024, 2) }],
  [{ id: 'C1', name: '법원 조정위원', kw: '법원, 조정위원', url: 'https://example.invalid/' }]);
  const c = g.orgs.find((o) => o.id === 'C1');
  assert.equal(c.custom, true);
  assert.equal(c.items.length, 2, '손으로 더한 것이 사전(LH)보다 먼저 가져간다');
  assert.ok(R.order(g.orgs, '2026-10-04').some((o) => o.id === 'C1'));
});
test('★ 손으로 친 낱말은 정규식으로 쓰지 않는다 — 괄호 하나에 멎으면 안 된다', () => {
  assert.doesNotThrow(() => R.group([{ y: '2025', name: '2025 (주)가나 컨설팅', t: 1 }],
    [{ id: 'C2', name: '가나', kw: '(주)가나' }]));
  const g = R.group([{ y: '2025', name: '2025 (주)가나 컨설팅', t: 1 }], [{ id: 'C2', name: '가나', kw: '(주)가나' }]);
  assert.equal(g.orgs.find((o) => o.id === 'C2').items.length, 1);
});
test('이름·번호 없는 손 기관은 무시한다', () => {
  assert.equal(R.allOrgs([{ id: '', name: 'x' }, { id: 'C', name: '' }, null]).length, R.ORGS.length);
});

test('★ 사전의 링크는 https 이거나 «비어» 있다 — 지어낸 주소 금지, http 금지', () => {
  R.ORGS.forEach((o) => assert.ok(o.url === '' || /^https:\/\//.test(o.url), o.id + ' ' + o.url));
  const ids = R.ORGS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, '번호가 겹치면 기록이 섞인다');
});

test('★★ 사전에 «지원 이력»이 없다 — 이 파일은 공개 저장소다', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../js/gov-recruit.js'), 'utf8');
  assert.doesNotMatch(src, /years\s*:\s*\[\s*['"]?\d{4}/, '지원한 해를 박아 두면 안 된다');
  R.ORGS.forEach((o) => assert.equal(o.years, undefined));
});

/* 실제 서류 폴더 이름 «꼴»(2026-10-04 실측 276건에서 가려 뽑음, 개인 이름 없음) */
const REAL = ['2024 공기업평가원 상시자문위원모집공고', '2022지방공기업타당성검사위원', '2025충남경제진흥원 산업일자리 전환',
  '2023 충남일자리경제진흥원 임원초빙', '2022 서산비정규직 노무사 공고', '2025 서산시노동권익센타', '2026 비정규직고용구조개선',
  '공문0157_2021년도 공공부문 고용개선 컨설팅 컨설턴트 모집 공고', '2017소상공인역량강화컨설턴트', '2024 충남신보 경영지도사업평가위원',
  '2020신용보증재단중앙회 재기지원 컨설턴트 모집공고', '2025 중진공 회생 컨설팅', '2025년 중소기업 비즈니스지원단(상담위원) 협약서.hwpx',
  '2024 한국노인인력개발원 컨설턴트', '2024 농촌융복합산업 현장코치 모집', '2025 LH공사', '2024 한국토지공사 자문',
  '2021고려대 기술닥터 전문가 pool 요청', '2024 충남창업마루 멘토링모집', '2024 사회적기업 프로보노', '22년 NCS 기업활용 컨설턴트 모집 안내',
  '2025 HRD 전문가인력풀', '2022 가족친화인증심사원', '2025 충남사회적경제육성위원회 모집', '2025 경영평가위원위촉 알리오',
  '2024년 직무급 점검단(공공기관)', '2025 새마을 금고 컨설턴트모집', '2024데이터바우처 평가위원신청.zip',
  '_KELI 소규모사업장노동교육 강사워크숍 선발결과 알림_', '2024 붙임. 경제인문사회연구회 이력서.hwp', '2023충남사회서비스원 이사'];
test('★★ 한 이름이 두 기관에 걸리지 않는다 — 실제 폴더 이름 꼴로', () => {
  REAL.forEach((n) => assert.equal(R.matches(n).length, 1, n + ' → ' + R.matches(n).join(',')));
});
test('★ 모집과 무관한 이름은 어느 기관에도 안 걸린다', () => {
  ['2017종합소득세신고', '2018년귀속연말정산요청자료', '2023 공동주택 경비원 개편', '2024 충남 인권센타위원', '2022 동남경찰서 외사자문협의회']
    .forEach((n) => assert.deepEqual(R.matches(n), [], n));
});

test('★★ 제목 내용으로 갈래 — 2026-10-05 실제 걸린 제목', () => {
  const k = (t) => R.kindOf(t);
  assert.equal(k('[일반추천] (주)강원랜드 사내·외 투자심의위원회 심의 및 자문위원 후보자 일반추천의 건'), 'rec');
  assert.equal(k('[일반추천] 경기도 부천시 민간위탁 운영평가위원회 심사위원 일반추천의 건'), 'rec');
  assert.equal(k('인천시 민간위탁 적격자 심의위원 인력POOL 추천의 건(인천음악창작소)'), 'rec');
  assert.equal(k('직장 내 괴롭힘 사건 외부 조사자 선임 공고'), 'cons');
  assert.equal(k('AI 노동법 상담서비스 개선지원단 DB작성 담당자 모집의 건'), 'cons');
  assert.equal(k('대한의료법인연합회 및 대한중소병원협회 업무협약에 따른 공인노무사 모집의 건'), 'cons');
  assert.equal(k('2027년 농촌융복합산업 현장코칭 전문위원 모집'), 'cons', '「전문위원」은 위원이 아니라 컨설팅');
  assert.equal(k('2026년 하반기 지방공기업평가원 정책연구 및 컨설팅 외부연구진 풀(Pool) 공개 모집'), 'cons');
  /* ⚠ 행사는 «먼저» 거른다 — 「박람회 참여 공인노무사 모집」이 컨설팅으로 가지 않게 */
  assert.equal(k('2026 부천시 다다진로박람회 체험부스 참여 공인노무사 모집 안내'), 'event');
  assert.equal(k('한국공인노무사회 유튜브 토크쇼 출연 참여자 모집 안내'), 'event');
  assert.equal(k('등록심사위원회 규정 개정안내'), 'event');
  assert.equal(k('충남 국적 Dream 사업 강사·멘토 인력풀(POOL) 모집 재공고'), 'teach');
  assert.equal(k('소상공인시장진흥공단 비상임이사 모집공고'), 'board');
  assert.equal(k('지방공기업평가원 위촉직이사 모집 공고'), 'board');
  assert.equal(k('무엇인지 모를 글'), 'etc');
  assert.equal(R.kindInfo('zzz').k, 'etc');
  assert.equal(new Set(R.KINDS.map((x) => x.k)).size, R.KINDS.length);
});
test('★ 출처 갈래 — 공인노무사회 게시판 셋은 kc, 나머지는 pub', () => {
  ['kcplaa', 'kcplaa_m', 'kcplaa_job'].forEach((b) => assert.equal(R.hitGroup({ board: b }), 'kc'));
  ['erc', 'semas', 'nosa', ''].forEach((b) => assert.equal(R.hitGroup({ board: b }), 'pub'));
});
