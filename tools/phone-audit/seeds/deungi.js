/* 푸른등기(pu-deungi.html) 폰 점검 자료 — 모두 지어낸 것이다(공개 저장소). 실제 사원·주소·주민번호를 넣지 말 것.
   긴 주소·여러 변경을 일부러 섞어 폰에서 카드가 깨지는지 본다. */
'use strict';
const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);
const meta = (id, type) => ({ id, entityType: type, schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: T0, updatedAt: T0 });

const base = Object.assign(meta('base', 'DeungiBase'), {
  asOf: '2026-02-09', source: '등기사항전부증명서(현재 유효사항) — 점검용',
  firm: { name: '가나 노무법인', regNo: '000000', corpNo: '000000-0000000', hq: '점검도 점검시 점검구 가나다라마바사로 12길 34, 3층(점검동, 가나다라마바사빌딩)',
    hqCharter: '점검도 점검시', court: '점검지방법원 점검지원 등기과', authority: '점검지방고용노동청 점검지청장', approvalNo: '', phone: '041-000-0000' },
  members: [
    { id: 'm1', name: '점검대표', birth: '700101', addr: '점검도 점검시 점검구 가나다라로 20, 103동 1303호(점검동, 가나다라마바사아파트)', invest: { cash: 15000000, labor: false }, rep: true, joinDate: '2017-11-20' },
    { id: 'm2', name: '점검노무', birth: '800101', addr: '점검도 점검시 마바로 31, 105동 1201호', invest: { cash: 15000000, labor: false }, rep: true, joinDate: '2017-11-20' },
    { id: 'm3', name: '점검사원', birth: '900101', addr: '점검도 점검시 사아로 3', invest: { cash: 0, labor: true }, rep: false, joinDate: '2024-02-28' },
    { id: 'm4', name: '점검사무장', birth: '850101', addr: '점검도 점검시 자차로 4', invest: { cash: 10000000, labor: false, inKind: '차종 : 점검차 / 연식 : 2000 / 차대번호 : TEST0000' }, rep: false, joinDate: '2025-01-01' },
  ],
  branches: [
    { id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검광역시 서구 점검서로 79, 2층(점검동, 점검빌딩)', no: 1, since: '2002-03-11' },
    { id: 'b3', name: '나무분사무소', alias: '나무지사', addr: '점검도 점검시 점검남1로 37, 2층(점검동, 점검인빌딩)', no: 3, since: '2019-07-24' },
  ],
  charter: '', history: [],
});
const c1 = Object.assign(meta('DG20261114-test', 'DeungiCase'), {
  title: '2026 사원 변경등기(점검)', status: 'meeting',
  meeting: { date: '2026-11-20', time: '10:00', place: '가나 노무법인 본 사무소', chair: 'm1' },
  changes: [
    { id: 'cj', type: 'join', name: '새노무', birth: '950101', addr: '점검도 점검시 라마로 4, 가나다라마바사아파트 101동 1001호', invest: { cash: 0, labor: false }, rep: true },
    { id: 'cl', type: 'leave', member: 'm2', reason: '개인 사정', share: { mode: 'transfer', to: [{ member: 'new:cj', amount: 10000000 }, { member: 'm1', amount: 5000000 }] } },
    { id: 'ca', type: 'addr', member: 'm1', addr: '점검도 점검시 새주소로 9, 점검아파트 2동 202호' },
    { id: 'cb', type: 'brAdd', name: '다리분사무소', addr: '점검특별자치시 점검대로 312, 502호(점검동, 점검비즈니스타운)' },
  ],
  agent: { name: '점검법무', office: '점검법무사사무소', phone: '041-000-0000', addr: '' }, notary: '법무법인 점검',
  dates: { notice: '2026-11-13' }, checks: { corpSeal: { ok: true }, corpCert: { ok: true, issued: '2026-07-01' } }, docsOff: {},
});

/* 지난 등기 원본 서류 묶음(2026-11-14) — 긴 파일 이름·여러 종류를 섞어 폰 카드가 깨지는지 본다. 파일 번호는 지어낸 것 */
const ar1 = Object.assign(meta('ARtest2019a', 'DeungiArchive'), {
  title: '2019-07 나무분사무소 설치·정관변경(점검)', at: '2019-07-30', summary: '분사무소 1곳 설치 — 정관 제3조 변경, 인가 뒤 등기',
  files: {
    fake_file_id_0001: { fileId: 'fake_file_id_0001', name: '1. 노무법인 정관 변경인가 신청서(점검용 아주 긴 파일 이름 가나다라마바사아자차카타파하).hwp', kind: 'apply', date: '2019-07-17', note: '', masked: false, addedAt: T0 },
    fake_file_id_0002: { fileId: 'fake_file_id_0002', name: '4. 총사원 동의서_주민번호가림.hwp', kind: 'consent', date: '2019-07-30', note: '', masked: true, addedAt: T0 },
    fake_file_id_0003: { fileId: 'fake_file_id_0003', name: '정관변경인가증.pdf', kind: 'approval', date: '2019-07-31', note: '', masked: false, addedAt: T0 },
  },
});
const ar2 = Object.assign(meta('ARtest2017b', 'DeungiArchive'), { title: '2017-12 정관변경(점검)', at: '2017-12-06', summary: '', files: {} });

module.exports = {
  data: { deungi: { base, cases: { [c1.id]: c1 }, archive: { [ar1.id]: ar1, [ar2.id]: ar2 } } },
  localStorage: { pu_deungi_tab: 'case', pu_deungi_cur: c1.id },
  views: [
    { name: 'easy1', run: async (p) => { await p.click('#wizSteps [data-s="1"]'); } },
    { name: 'easy3', run: async (p) => { await p.click('#wizSteps [data-s="3"]'); } },
    { name: 'easy4', run: async (p) => { await p.click('#wizSteps [data-s="4"]'); } },
    { name: 'docs', run: async (p) => { await p.click('[data-act=mode][data-m=full]'); await p.click('#edDocs input[data-doc]'); } },
    { name: 'base', run: async (p) => { await p.click('#tabs button[data-tab=base]'); } },
    { name: 'hist', run: async (p) => { await p.click('#tabs button[data-tab=hist]'); } },
  ],
};
