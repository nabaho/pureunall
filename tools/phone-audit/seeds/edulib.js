/* 강의자료(pu-edulib.html) 폰 점검 자료 — 모두 지어낸 것이다(실제 고객·직원 이름·연락처 없음). */
'use strict';
const path = require('path');
/* 슬라이드 미리보기 점검용 «지어낸 pptx» — 두 장(제목·글머리·색 칸). 진짜 강의 파일이 아니다 */
async function fakePptx() {
  const JSZip = require(path.join(__dirname, '..', '..', '..', 'vendor', 'jszip.min.js'));
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const REL = (rs) => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rs.map((r) => '<Relationship Id="' + r[0] + '" Type="http://x/' + r[1] + '" Target="' + r[2] + '"/>').join('') + '</Relationships>';
  const box = (x, y, w, h, fill, txt, sz) => '<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>' +
    (fill ? '<a:solidFill><a:srgbClr val="' + fill + '"/></a:solidFill>' : '') + '</p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/>' +
    txt.map((t) => '<a:p><a:r><a:rPr lang="ko-KR" sz="' + sz + '" b="1"/><a:t>' + t + '</a:t></a:r></a:p>').join('') + '</p:txBody></p:sp>';
  const z = new JSZip();
  z.file('ppt/presentation.xml', '<?xml version="1.0"?><p:presentation ' + NS + '><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>');
  z.file('ppt/_rels/presentation.xml.rels', REL([['rId2', 'slide', 'slides/slide1.xml'], ['rId3', 'slide', 'slides/slide2.xml']]));
  z.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><p:sld ' + NS + '><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF4D6"/></a:solidFill></p:bgPr></p:bg><p:spTree>' +
    box(1000000, 2000000, 10192000, 1600000, 'FFD966', ['점검 강의안'], 4400) + box(1000000, 4000000, 10192000, 900000, '', ['지어낸 시험 자료'], 2400) + '</p:spTree></p:cSld></p:sld>');
  z.file('ppt/slides/slide2.xml', '<?xml version="1.0"?><p:sld ' + NS + '><p:cSld><p:spTree>' +
    box(600000, 300000, 10992000, 900000, '1E40AF', ['근로시간과 휴게'], 3200) + box(600000, 1500000, 5000000, 4000000, 'EFF6FF', ['연장근로', '휴게시간', '주휴일'], 2000) +
    box(6200000, 1500000, 5392000, 4000000, 'F0FDF4', ['가산수당 50%'], 2400) + '</p:spTree></p:cSld></p:sld>');
  return z.generateAsync({ type: 'nodebuffer' });
}
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
/* 2026-11-21 — 카드 «더 보기»가 생기게 한 종류(성희롱 예방)에 일곱 건을 더한다 */
for (let j = 0; j < 7; j++) {
  const id = 'edu_seedx' + j;
  items[id] = Object.assign({}, items.edu_seed0001, { id, cat: 'sexual', title: '점검 성희롱 예방 강의 추가 ' + (j + 1), fileName: '점검 성희롱 예방 강의 추가 ' + (j + 1) + '.pdf',
    ext: 'pdf', lectureDate: (2019 + j) + '-0' + (1 + j), dateFrom: 'name', createdAt: T0 + (50 + j) * 3600e3, updatedAt: T0 + (50 + j) * 3600e3 });
}
/* 2026-11-21 — 사람이 더한 강의 종류 하나(0건 카드도 보이는지) · 메일 자동 정리로 들어온 자료(내용 칸) · 자동 정리 상태 */
const cats = { cat_seed1: { id: 'cat_seed1', entityType: 'EduCategory', schemaVersion: 3, contractVersion: 1, label: '점검용 새 강의 종류 가나다라마바사',
  legal: false, law: '', words: ['점검용', '새강의'], createdAt: T0, updatedAt: T0, createdBy: 'P001', revision: 1 } };
items.edu_mseed01 = Object.assign({}, items.edu_seed0002, { id: 'edu_mseed01', title: '보낸 메일로 들어온 점검 강의안', fileName: '보낸 메일로 들어온 점검 강의안.pptx',
  ext: 'pptx', kind: 'doc', store: 'cloud', storagePath: 'edulib/edu_mseed01/보낸 메일로 들어온 점검 강의안.pptx', status: 'review', dateFrom: 'mail', lectureDate: '2026-11-20',
  summary: '목차(12장): 점검 강의 시작 · 근로시간 기본 · 휴게시간 · 연차 계산 · 가나다라마바사아자차카타파하 아주 긴 목차 줄 — [메일] 로 문의',
  source: { kind: 'mail', path: '', mailId: 'sent_seed/7001', mailSubject: '[점검상사] 강의자료 송부', mailDate: '2026-11-20', mtime: '' }, createdBy: 'AI-메일자동정리' });
/* 자동 정리함(관리자만) — 서버가 정리해 둔 줄 두 개(지어낸 것). 넣기 전이라 자료함에는 없다 */
const NOWISH = Date.now();
const inbox = {
  state: { lastRunAt: NOWISH - 3600e3, trigger: 'schedule', by: 'schedule', days: 14, mails: 9, candidates: 4, tried: 3, queued: 2, more: false,
    skipped: { seen: 0, same: 1, pii: 1, big: 0, gone: 0, type: 2, human: 2, err: 0 }, ms: 4200 },
  q: {
    qseed1: { key: 'qseed1', slug: 'sent_seed', uid: '7101', mailKey: '7101', mailId: 'sent_seed/7101', att: '점검상사 산업안전보건 정기교육 교안 가나다라마바사.pptx',
      subject: '[점검상사] 안전보건교육 자료 송부', d: NOWISH - 2 * 864e5, cat: 'safety', lectureDate: '2026-11', dateFrom: 'name',
      summary: '목차(18장): 산업안전보건 정기교육 · 위험성평가 이해 · 아차사고 사례 · 보호구 착용 · 가나다라마바사아자차카타파하 아주 긴 목차 줄', sha256: 'seedsha1', size: 1820000, at: NOWISH - 3600e3 },
    qseed2: { key: 'qseed2', slug: 'tome_seed', uid: '7102', mailKey: '7102', mailId: 'tome_seed/7102', att: '점검 노동법 기초 강의안.pdf',
      subject: '강의안(내게)', d: NOWISH - 5 * 864e5, cat: 'labor_law', lectureDate: '2026-11-16', dateFrom: 'mail',
      summary: '노동법 기초 — 근로계약·근로시간·휴일·임금 지급 원칙', sha256: 'seedsha2', size: 640000, at: NOWISH - 3600e3 }
  }
};
module.exports = {
  /* 지어낸 창고 파일 — run.mjs 가 창고 주소 요청에 내준다(진짜 창고에는 안 나간다) */
  storageFiles: async () => ({ 'edulib/edu_mseed01/보낸 메일로 들어온 점검 강의안.pptx': await fakePptx() }),
  data: {
    edulib: { items, notes, cats },
    edulib_inbox: inbox,
    mailbox: { folders: { inbox_seed: { path: 'INBOX', name: '받은편지함', kind: 'inbox', order: 1, total: 14, unseen: 0 } }, msgs: { inbox_seed: msgs }, old: { msgs: {} } },
  },
  views: [
    { name: 'list', run: async (p) => { await p.click('#tabs button[data-tab=list]'); } },
    { name: 'table', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.click('#vSeg [data-view=table]'); }, back: async (p) => { await p.click('#vSeg [data-view=card]'); } },
    { name: 'expand', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.click('#list [data-gx]'); } },
    { name: 'catnew', run: async (p) => { await p.click('#tabs button[data-tab=dash]'); await p.click('#cats [data-catnew]'); }, back: async (p) => { await p.click('#dX'); } },
    { name: 'sel', run: async (p) => { await p.click('#tabs button[data-tab=list]'); const c = await p.$$('#list input[data-pick]'); for (const x of c.slice(0, 2)) await x.click(); } },
    { name: 'detail', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.click('#list [data-open]'); }, back: async (p) => { await p.click('#dX'); } },
    { name: 'year', run: async (p) => { await p.click('#tabs button[data-tab=list]'); await p.selectOption('#fGroup', 'year'); } },
    /* 왼쪽 메뉴(PC 만 보인다) — 종류 누르기·묶음 접기. 폰에서는 메뉴가 숨으므로 한눈에 카드로 같은 일을 한다 */
    { name: 'sbcat', run: async (p) => { if (await p.isVisible('#sb')) await p.click('#sbNav [data-sbcat=sexual]'); else { await p.click('#tabs button[data-tab=dash]'); await p.click('#cats [data-cat=sexual]'); } } },
    { name: 'sbfold', run: async (p) => { await p.click('#tabs button[data-tab=dash]'); if (await p.isVisible('#sb')) await p.click('#sbNav [data-sbfold=legal]'); },
      back: async (p) => { if (await p.isVisible('#sb')) await p.click('#sbNav [data-sbfold=legal]'); } },
    /* 슬라이드 미리보기 — 자세히를 열면 왼쪽 칸에 지어낸 pptx 가 작게 늘어선다 */
    { name: 'slides', run: async (p) => {
        await p.click('#tabs button[data-tab=list]');
        if (!(await p.isVisible('#fClr'))) await p.click('#fMore');           /* 앞 화면(종류 누르기)의 거르개를 비운다 */
        await p.click('#fClr');
        await p.click('#list [data-open=edu_mseed01]'); await p.waitForTimeout(2500); },
      back: async (p) => { await p.click('#dX'); } },
    { name: 'add', run: async (p) => { await p.click('#tabs button[data-tab=add]'); } },
    { name: 'mail', run: async (p) => { await p.click('#tabs button[data-tab=mail]'); await p.click('#mScan'); } },
  ],
};
