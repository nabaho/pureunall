/* 정부사업일정(gov-consulting.html) 폰 점검 자료 — 모두 지어낸 것이다.
 *
 * ★ 로그인 — 이 앱은 파이어베이스 로그인과 별개로 «자기 세션»(sessionStorage p_session ·
 *   localStorage p_autoSession)을 보고 로그인 화면(#mbLogin)을 닫는다. 세션이 없으면
 *   파이어베이스 사람 메일 → 명부(user_dir) 이름 → 담당자 목록(p_staff) 이름으로 맞춰 세션을 만든다.
 *   그 길은 명부가 늦게 오면 로그인 화면이 남는다 — 그래서 «담당자 세션»을 미리 넣어 둔다
 *   (p_autoSession: 담당자 id·이름·관리자). 비밀번호를 치는 길이 아니다.
 * ★ 자료 — scal_staff·scal_types·scal_cos·scal_scheds 를 앱이 내려받아 localStorage(p_*) 에 둔다.
 * ⚠ 사람은 「점검○○」, 업체는 「(주)가나다…」 식으로 지어낸다. 실제 고객·직원 이름을 넣지 말 것.
 */
'use strict';

const DAY = 864e5;
/* 오늘(한국 시각) 기준으로 날짜를 만든다 — 앱이 브라우저 시계로 «오늘»을 보므로 */
function ymd(off) {
  const d = new Date(Date.now() + 9 * 3600e3 + off * DAY);
  return d.toISOString().slice(0, 10);
}

const STAFF = [
  { id: 's1', name: '점검대표', color: '#d97706', isAdmin: true },
  { id: 's2', name: '점검노무', color: '#60a5fa', isAdmin: false },
  { id: 's3', name: '점검사무장', color: '#2a9d8f', isAdmin: false },
  { id: 's4', name: '점검노무사넷', color: '#e94560', isAdmin: false },
  { id: 's5', name: '점검노무사다섯', color: '#7c3aed', isAdmin: false },
];

const TYPES = [
  { id: 't1', name: '일터혁신', fullName: '일터혁신 컨설팅', agency: '점검협회', color: '#d97706', rounds: 8, mandatoryField: 3, exclusiveDay: true, active: true },
  { id: 't2', name: '구조혁신', fullName: '구조혁신 컨설팅', agency: '점검경제진흥원', color: '#60a5fa', rounds: 16, mandatoryField: 5, exclusiveDay: true, active: true },
  { id: 't3', name: '현장클리닉', fullName: '현장클리닉', agency: '점검지도사회', color: '#2563eb', rounds: 3, mandatoryField: 2, exclusiveDay: false, active: true },
  { id: 't4', name: '기술보호', fullName: '기술보호울타리', agency: '', color: '#2a9d8f', rounds: 3, mandatoryField: 3, exclusiveDay: false, active: true },
  { id: 't5', name: '진단컨설팅', fullName: '진단컨설팅', agency: '', color: '#fbbf24', rounds: 1, mandatoryField: 1, exclusiveDay: true, active: true },
  { id: 't6', name: '씨앗컨설팅', fullName: '씨앗컨설팅', agency: '점검사회적경제지원센터', color: '#e94560', rounds: 6, mandatoryField: 2, exclusiveDay: true, active: true },
  { id: 't7', name: '인사노무', fullName: '인사노무컨설팅', agency: '점검상공회의소', color: '#64748b', rounds: 0, mandatoryField: 0, exclusiveDay: false, active: true },
];

const 이름 = [
  '(주)가나다라마바사아자차카타파하정밀산업', '점검기계(주)', '(주)한빛점검테크놀로지솔루션', '점검식품',
  '(유)가온누리점검물류센터', '(주)바다점검', '점검정밀화학(주) 제2공장', '(주)나래점검',
  '(사)점검사회적협동조합 늘푸른마을', '점검전자', '(주)다온점검엔지니어링앤컨설팅', '점검건설(주)',
  '(주)라온점검', '점검메디칼', '(주)마루점검오토모티브코리아', '점검섬유',
  '(주)사랑점검', '점검산업개발(주) 천안사업장', '(주)아라점검', '점검테크',
  '(주)자람점검바이오헬스케어', '점검농산', '(주)차오름점검', '점검금속(주)',
  '(주)하늘점검스마트팩토리시스템즈', '점검유통', '(주)온새미점검', '점검화학',
];

const COS = [];
const SCHEDS = [];
let sid = 0;
이름.forEach((name, i) => {
  const id = 'c' + String(i + 1).padStart(2, '0');
  const t1 = TYPES[i % TYPES.length].id;
  const types = (i % 4 === 0) ? [t1, TYPES[(i + 3) % TYPES.length].id] : [t1];
  const defAtt = STAFF[i % 3 === 0 ? 0 : (i % STAFF.length)].id;
  const co = { id, name, defAtt, defCoAtts: i % 5 === 0 ? ['s2', 's3'] : [], types, active: true,
    deadlines: {}, customRounds: {}, customMandatory: {}, createdAt: ymd(-120 + i) };
  types.forEach((tid, k) => {
    co.deadlines[tid] = ymd(5 + i * 3 + k * 7);
    const ty = TYPES.find(t => t.id === tid);
    const max = ty.rounds || 6;
    const done = Math.min(max, 1 + (i * 2 + k) % (max + 1));
    const plan = Math.max(0, Math.min(max - done, (i % 3)));
    for (let r = 0; r < done + plan; r++) {
      const off = r < done ? -(done - r) * 9 - (i % 5) : (r - done + 1) * 6 + (i % 4);
      SCHEDS.push({ id: 'h' + (++sid), date: ymd(off), coId: id, typeId: tid, attId: defAtt,
        coAttIds: co.defCoAtts, round: r + 1, isField: (r % 2 === 0), phase: tid === 't1' ? 'main' : undefined,
        memo: r % 4 === 0 ? '현장 방문 — 취업규칙·근로계약서 점검, 임금체계 개편안 설명 및 질의응답' : '' });
    }
  });
  if (i % 9 === 8) co.endedTypes = { [types[0]]: ymd(-10) };
  COS.push(co);
});
/* 오늘·이번 주에 몰린 날 — 달력 칸이 꽉 찼을 때 */
for (let k = 0; k < 6; k++) {
  const co = COS[k * 3];
  SCHEDS.push({ id: 'h' + (++sid), date: ymd(0), coId: co.id, typeId: co.types[0], attId: co.defAtt, coAttIds: [], round: 9, isField: k % 2 === 0, memo: '' });
}
SCHEDS.forEach(s => { if (s.phase === undefined) delete s.phase; });

const SESSION = JSON.stringify({ id: 's1', name: '점검대표', color: '#d97706', isAdmin: true });

module.exports = {
  data: {
    scal_staff: STAFF,
    scal_types: TYPES,
    scal_cos: COS,
    scal_scheds: SCHEDS,
  },
  localStorage: {
    p_autoSession: SESSION,
    pu_portal_auto: '1',
    p_staff: JSON.stringify(STAFF),
    p_types: JSON.stringify(TYPES),
    p_cos: JSON.stringify(COS),
    p_scheds: JSON.stringify(SCHEDS),
  },
  views: [
    /* 첫 화면에 «종료 확인 사업장» 창이 뜬다(내 담당 가운데 다 끝난 곳) — 갈무리는 첫 화면이 맡고, 여기서 닫는다 */
    { name: 'prog-all', run: async (p) => { await p.evaluate(() => closeModal('mbEndConfirm')); await p.click('#viewProg .mp-tab[data-mine="0"]'); } },
    { name: 'prog-open', run: async (p) => { await p.click('#mpList .mp-row >> nth=1'); } },
    { name: 'cal', run: async (p) => { await p.evaluate(() => closeModal('mbEndConfirm')); await p.click('#tabMain'); } },
    { name: 'week', run: async (p) => { await p.click('#calControls .mode-btn[data-mode="week"]'); } },
    { name: 'day', run: async (p) => { await p.click('#calControls .mode-btn[data-mode="day"]'); } },
    /* --view=sheet 처럼 혼자 돌 때도 되게 — 종료 확인 창을 닫고 달력으로 */
    { name: 'sheet', run: async (p) => { await p.evaluate(() => { closeModal('mbEndConfirm'); showTab('main'); }); await p.click('#calControls .mode-btn[data-mode="month"]'); await p.click('#dashMToggle'); },
      back: async (p) => { await p.click('#dashMToggle'); } },
    { name: 'more', run: async (p) => { await p.click('.hdr-more'); }, back: async (p) => { await p.click('.hdr-more'); } },
    { name: 'timeline', run: async (p) => { await p.click('#tabTimeline'); } },
    { name: 'tlzoom', run: async (p) => { await p.evaluate(() => openTlZoom('c03', 't3')); } },
    { name: 'report', run: async (p) => { await p.evaluate(() => { closeModal('mbTlZoom'); return grpOpenReport('c03', 't3'); }); }, wait: 2500,
      back: async (p) => { await p.evaluate(() => closeModal('mbGovRpt')); } },
    { name: 'ended', run: async (p) => { await p.click('#tabEnded'); } },
  ],
};
