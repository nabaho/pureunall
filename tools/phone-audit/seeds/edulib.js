/* 강의자료(pu-edulib.html) 폰 점검 자료 — 모두 지어낸 것이다(실제 고객·직원 이름·연락처 없음). */
'use strict';
const T0 = Date.UTC(2026, 9, 1, 0, 0, 0);
const CATS = ['sexual', 'disability', 'privacy', 'safety', 'pension', 'bullying', 'youth', 'equality', 'labor_law', 'hours', 'ai', 'etc'];
const 제목 = ['직장 내 성희롱 예방교육 표준 강의안', '장애인 인식개선 교육 — 함께 일하는 일터', '개인정보 보호 교육 자료',
  '산업안전보건 정기교육 교안 가나다라마바사아자차카타파하 아주 긴 제목', '퇴직연금 가입자 교육', '직장 내 괴롭힘 예방 사례집',
  '현장실습생 노동인권 강의', '차별시정 교육 자료', '소규모사업장 노동법 강의', '근로시간·연차 실무', 'AI 활용 업무 자동화 강의', '노무사 보수교육 정리'];
const EXT = ['pptx', 'pdf', 'hwp', 'ppt', 'mp4', 'zip', 'docx', 'hwpx'];
const 강의처 = ['점검상사', '가나다상사', '시험복지관', '', '라마바 산업', '점검시청 가나다라마바사아자차카타파하'];
const items = {};
for (let i = 0; i < 46; i++) {
  const id = 'edu_seed' + String(i + 1).padStart(4, '0');
  const cat = CATS[i % CATS.length], ext = EXT[i % EXT.length];
  const y = 2016 + (i % 11), m = 1 + (i % 12), d = 1 + (i % 27);
  const date = i % 9 === 0 ? '' : (i % 4 === 0 ? String(y) : (i % 4 === 1 ? y + '-' + String(m).padStart(2, '0') : y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')));
  const fileName = 제목[i % 제목.length] + (i > 11 ? ' ' + (i + 1) : '') + '.' + ext;
  const store = i % 3 === 0 ? 'cloud' : 'pc';
  items[id] = {
    id, entityType: 'EduMaterial', schemaVersion: 3, contractVersion: 1, title: fileName.replace(/\.[^.]+$/, ''), fileName, ext,
    kind: ext === 'mp4' ? 'video' : ext === 'zip' ? 'archive' : 'doc', size: 180000 + i * 731233, sha256: '',
    cat, lectureDate: date, dateFrom: date ? (i % 5 === 0 ? 'manual' : 'folder') : '', venue: 강의처[i % 강의처.length], note: i % 6 === 0 ? '2026 개정 반영 필요' : '',
    status: i % 4 === 0 ? 'ok' : 'review', pii: i % 13 === 0, store, storagePath: store === 'cloud' ? 'edulib/' + id + '/' + fileName : '',
    source: { kind: 'pc', path: '~\\Desktop\\점검강의\\' + fileName, mailId: '', mailSubject: '', mailDate: '', mtime: '2025-0' + (1 + i % 9) + '-15' },
    createdAt: T0 + i * 3600e3, updatedAt: T0 + i * 3600e3, createdBy: 'P001', revision: 1,
  };
  if (i >= 43) Object.assign(items[id], { _deleted: true, deletedAt: T0 + 20 * 864e5, deletedBy: 'P001' });
}
const notes = { edu_seed0001: { n1: { id: 'n1', entityType: 'EduReviewNote', sourceKind: 'EduMaterial', sourceId: 'edu_seed0001', text: '3쪽 사례가 좋습니다 — 2026 개정 조문만 바꾸면 그대로 쓸 수 있습니다.', createdAt: T0, updatedAt: T0, createdBy: 'P001', revision: 1 } } };
/* 메일 찾기(관리자) 화면용 — 머리글·첨부 이름만, 모두 지어낸 것 */
const msgs = {};
for (let i = 0; i < 14; i++) {
  const u = 5000 + i;
  msgs[u] = { u, f: '점검담당' + i, e: 'tester' + i + '@example.com', t: 'office@example.com', tn: '', s: (i % 2 ? '[점검상사] 성희롱 예방교육 자료 발송의 건 ' : '산업안전보건 교육자료 요청 ') + i,
    d: T0 + i * 864e5, r: 1, g: 0, w: 0, a: 1, z: 200000, an: [i % 3 ? '직장내괴롭힘 예방교육 ' + i + '.pptx' : '교육 참석자 명단 ' + i + '.xlsx'], p: '' };
}
module.exports = {
  data: {
    edulib: { items, notes },
    mailbox: { folders: { inbox_seed: { path: 'INBOX', name: '받은편지함', kind: 'inbox', order: 1, total: 14, unseen: 0 } }, msgs: { inbox_seed: msgs }, old: { msgs: {} } },
  },
  views: [
    { name: 'list', run: async (p) => { await p.click('#tabs button[data-tab=list]'); } },
    { name: 'sel', run: async (p) => { await p.click('#tabs button[data-tab=list]'); const c = await p.$$('#list input[data-pick]'); for (const x of c.slice(0, 2)) await x.click(); } },
    { name: 'detail', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.click('#list [data-open]'); }, back: async (p) => { await p.click('#dX'); } },
    { name: 'year', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.selectOption('#fGroup', 'year'); } },
    { name: 'add', run: async (p) => { await p.click('#tabs button[data-tab=add]'); } },
    { name: 'mail', run: async (p) => { await p.click('#tabs button[data-tab=mail]'); await p.click('#mScan'); } },
  ],
};
