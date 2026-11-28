/* 정부사업 바로가기(gov-links.html) 폰 점검 자료 — 모두 지어낸 것이다.
 *
 * 이 앱은 컨설팅보고서와 같은 자리(이알피 사업 data/biz_cons_types · 사업 이음표 scal_erpTypeMap ·
 * 정부사업일정 scal_cos·scal_types·scal_scheds·scal_staff)를 읽고, 제 자리 govlinks/sets 의 묶음에
 * «이어 둔 사업의 올해 업체»를 붙인다. 일정·사업 자료는 seeds/govreport.js 것을 그대로 쓴다.
 * ⚠ 주소는 «점검용 가짜 도메인»(.invalid)이다 — 눌러도 아무 데도 안 간다. 업체·사람은 지어낸 것.
 * ⚠ 일부러 긴 이름·긴 메모·업체가 많은 사업을 섞는다(폰에서 넘치는지 보려고).
 */
'use strict';

const govreport = require('./govreport.js');
const D = govreport.data;

const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);
function set(id, order, o) {
  return Object.assign({ id, entityType: 'GovLinkSet', schemaVersion: 1, contractVersion: 1, revision: 1,
    createdAt: NOW, updatedAt: NOW, createdBy: 'P001', updatedBy: 'P001', order, org: '', note: '',
    links: [], folders: [], bizCodes: [], apps: [] }, o);
}
const SETS = {
  'gl-a': set('gl-a', 10, { title: '점검 일터상생혁신컨설팅 · 아주 긴 사업 이름이 폰에서 어떻게 보이나', org: '점검노사발전재단',
    note: '수행계획서, 회차별 수행보고서(사진·서명지), 이행관리를 점검 플랫폼에 등록 — 메모가 길면 줄을 내려 다 보인다',
    links: [
      { name: '점검 플랫폼 (사용자 메인 · 로그인 필요한 긴 이름)', url: 'https://www.ilteo-check.invalid/user/main/index', login: true },
      { name: '점검 플랫폼 (홈)', url: 'https://www.ilteo-check.invalid/home/main' }],
    folders: ['C:\\Users\\user\\Desktop\\점검업체\\0. 점검 일터혁신 폴더 이름이 길 때'],
    bizCodes: ['consulting-02'], apps: ['ilteo', 'consult'] }),
  'gl-b': set('gl-b', 20, { title: '점검 산업일자리전환', org: '점검진흥공단',
    note: '착수보고서 → 수행계획서 → 수행일지 → 최종결과보고서',
    links: [{ name: '점검 전환플랫폼 (컨설턴트 로그인)', url: 'https://www.jobtrans-check.invalid/mgr/login', login: true }],
    folders: ['C:\\Users\\user\\Desktop\\점검업체\\4. 점검 전환'], bizCodes: ['consulting-05'], apps: ['jobtrans'] }),
  'gl-c': set('gl-c', 30, { title: '점검 기타 기관',
    links: [
      { name: '점검 사회적기업 포털', url: 'https://www.seis-check.invalid/home/main.do' },
      { name: '점검 연구지원시스템', url: 'https://www.iris-check.invalid/index.do' }] }),
  /* 지운 묶음 하나 — «지운 묶음» 칸이 폰에서 깨지는지 */
  'gl-d': set('gl-d', 40, { title: '점검 지운 사업', _deleted: true, deletedAt: NOW, deletedBy: 'P001',
    links: [{ name: '점검 옛 사이트', url: 'https://www.old-check.invalid/' }] }),
};

module.exports = {
  data: Object.assign({}, D, {
    govlinks: { sets: SETS,
      /* 점검 대표(P001)의 ★ 즐겨찾기 — 사업 하나 · 사이트 하나 · 이알피 사업 하나 */
      stars: { P001: { id: 'P001', entityType: 'GovLinkStar', schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: NOW, updatedAt: NOW,
        items: ['gl-b', 'erp:consulting-01'], links: ['https://www.ilteo-check.invalid/home/main'] } } },
    /* 셋째 사업(통합기술보호지원단)은 올해 종결 — 종결 표시가 이 앱에서 어떻게 보이는지(카드가 없으니 진행 사업 칸에서 빠진다) */
    scal_bizState: { 'consulting-03': { closedFrom: '2000', closedAt: '2026-11-01', reason: '사업 기간 끝남', by: '점검대표', at: NOW } },
  }),
  views: [
    /* 폰에서는 사업을 누르면 상세 한 화면 — PC 에서는 오른쪽 칸이 바뀐다 */
    { name: 'detail', run: async (p) => { await p.evaluate(() => pick('gl-a')); },
      back: async (p) => { await p.evaluate(() => { showDetail(false); }); } },
    { name: 'erp', run: async (p) => { await p.evaluate(() => pick('erp:consulting-01')); },
      back: async (p) => { await p.evaluate(() => { showDetail(false); pick('gl-a'); showDetail(false); }); } },
    { name: 'open', run: async (p) => { await p.evaluate(() => { OPEN={'gl-a':true,'gl-b':true}; renderGo(); }); } },
    { name: 'search', run: async (p) => { await p.fill('#q', '점검'); }, back: async (p) => { await p.fill('#q', ''); } },
    { name: 'manage', run: async (p) => { await p.evaluate(() => setTab('manage')); },
      back: async (p) => { await p.evaluate(() => setTab('go')); } },
    { name: 'edit', run: async (p) => { await p.evaluate(() => { var s = findSet('gl-a'); if (s) openEdit(s); }); },
      back: async (p) => { await p.evaluate(() => closeEdit()); } },
  ],
};
