'use strict';
/* 🎓 보낸 메일의 강의자료 → 강의자료 앱 자동 저장 + 강의 이력 (2026-11-21 · 2026-11-27, functions/edulib-mail-sweep.js)
 *
 * ■ 왜 이 검사가 있나
 *   2026-11-21 「메일로 보낸 강의 자료나 강의 내용의 경우 자동으로 정리해서 내용 넣을 수 있게 해달라」
 *   2026-11-27 「새로운 강의 자료 같은 경우는 강의 자료함에 반드시 저장해 달라 … 누가 언제 강의했는지만 간략하게 … 캘린더에서도 찾아도 된다」
 *     → 대표 선택 «모두 저장, 위험한 것만 뺌» · 강의 이력은 «추정으로 두고 확인»
 *   사람 손을 거치지 않고 «재직 직원 모두 보는» 자료함에 넣는 길이라, 무엇을 넣지 «않는지»가 더 중요하다.
 *   ① 서버 셈 사본(functions/edulib-core/)이 화면 원본(js/)과 한 글자까지 같다 — 다르면 화면과 다른 종류로 넣는다
 *   ② 우리가 보낸 메일만 — 보낸편지함·내게쓴편지함 둘뿐(사용자 폴더·받은편지함은 안 본다)
 *   ③ 강의자료는 자료함에 «바로 저장»(원본 창고 + 기록 + 지문) — 옛 형식·압축·스캔 pdf 는 «내용 자동 확인 못 함» 표시로 저장
 *   ③-1 저장하지 않는 것: 명단·서류 이름, 문서 안 주민번호 꼴, 압축 안 명단 → 관리자 전용 정리함에 «남김»
 *       이름에 주민번호·전화·메일 꼴이 있으면 정리함에도 옮기지 않는다
 *   ③-2 직원이 더한 찾을 낱말은 «종류 나누기»에만 — 가져올지를 정하는 문을 넓히지 못한다
 *   ④ 같은 파일·이미 넣은 첨부·휴지통에 간 자료는 다시 넣지 않는다(되살리지 않는다) — 두 번 돌아도 그대로
 *   ⑤ 모든 쓰기는 «빈 자리일 때만»(창고 ifGenerationMatch:0 · 기록 transaction) · 기록은 온톨로지 도장을 다 갖춘다
 *   ⑥ 강의 이력은 «추정» — 캘린더 일정과 맞으면 그 일정의 강의에, 아니면 메일 하나 = 강의 하나. 강의자는 캘린더 만든이 표로만.
 *      사람이 확인한 기록은 고치지 않는다
 *   ⑦ 지난번 «정리만» 하던 때 쌓인 정리함 줄도 저장한다(지문이 같을 때만) — 줄은 지우지 않고 표시만 단다
 *   ⑧ 서버 함수가 매일 한 번·관리자만·잠금으로 이어져 있다
 * ⚠ 예시는 지어낸 것이다(가나상사·example 주소). 실제 메일·고객 자료를 쓰지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const S = require('../functions/edulib-mail-sweep.js');
const L = require('../functions/edulib-core/pu-edulib-lecture.js');
const { reviewRecord } = require('../functions/ontology-write-server.js');
const { 옮길것 } = require('../scripts/sync-edulib-core.js');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const SELF = 'office@example.com';
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 21, 10, 0, 0);

/* ── 작은 zip(저장 방식 0) — pptx·docx·zip 시험 파일을 손으로 만든다 ── */
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const locals = [], centrals = [];
  let off = 0;
  files.forEach(([name, text]) => {
    /* 이름을 바이트(Buffer)로 주면 UTF-8 표시(0x800) 없이 — 윈도 탐색기·알집처럼 CP949 이름 */
    const utf = !Buffer.isBuffer(name), gp = utf ? 0x800 : 0;
    const nb = utf ? Buffer.from(name, 'utf8') : name, data = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(gp, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(gp, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, data); centrals.push(ch, nb);
    off += 30 + nb.length + data.length;
  });
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(locals.concat([cd, end]));
}
const slide = (...paras) => '<p:sld>' + paras.map((p) => '<a:p><a:r><a:t>' + p + '</a:t></a:r></a:p>').join('') + '</p:sld>';
const PPTX = makeZip([['ppt/slides/slide2.xml', slide('2. 직장 내 괴롭힘 판단 기준', '문의 010-1234-5678', '행위자와 피해자의 관계, 업무상 적정 범위를 넘는 행위, 신체적·정신적 고통')],
  ['ppt/slides/slide1.xml', slide('2026 직장 내 괴롭힘 예방교육', '가나상사 담당 kim@example.com')], ['ppt/presentation.xml', '<p/>']]);
const DOCX_RRN = makeZip([['word/document.xml', '<w:document><w:p><w:r><w:t>참석자 900101-1234567</w:t></w:r></w:p></w:document>']]);
const ZIP_PII = makeZip([['강의안.pptx', 'x'], ['참석자 명단.xlsx', 'y']]);
const ZIP_OK = makeZip([['교안/1부 강의안.pptx', 'x'], ['교안/2부 퀴즈.pdf', 'y']]);

/* ── 가짜 실시간DB — transaction 은 «현재 값»으로 부르고 undefined 면 그만둔다(실제 SDK 처럼) ── */
function fakeDb(tree) {
  const segs = (p) => String(p).split('/').filter(Boolean);
  const get = (p) => segs(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
  const put = (p, v) => {
    const ks = segs(p); let o = tree;
    ks.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const writes = [];
  return {
    tree, writes,
    ref(p) {
      return {
        once: async () => ({ val: () => { const v = get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
        set: async (v) => { writes.push(['set', p, v]); put(p, v); },
        update: async (obj) => { writes.push(['update', p, obj]); Object.keys(obj).forEach((k) => put(p + '/' + k, obj[k])); },
        transaction: async (fn) => {
          const cur = get(p);
          const next = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur)));
          if (next === undefined) return { committed: false };
          writes.push(['tx', p, next]); put(p, next); return { committed: true };
        },
      };
    },
  };
}

function mailTree() {
  const t = (n) => NOW - n * DAY;
  return {
    mailbox: {
      folders: {
        'Sent-1': { name: '보낸편지함', kind: 'sent' }, 'Tome-1': { name: '내게쓴편지함', kind: 'tome' },
        'Inbox-1': { name: '받은편지함', kind: 'inbox' }, 'Pub-1': { name: '6.공공기관', kind: 'custom' },
        'Spam-1': { name: '스팸', kind: 'spam' },
      },
      msgs: {
        'Sent-1': {
          101: { u: 101, s: '[푸른노무법인] 가나상사 괴롭힘 예방교육 자료 송부', d: t(1), e: SELF, an: ['2026 괴롭힘 예방교육.pptx', '교육 참석자 명단.xlsx'] },
          102: { u: 102, s: '강의안 송부', d: t(2), e: SELF, an: ['노동법 강의 개인정보.docx'] },
          103: { u: 103, s: '교육 자료', d: t(3), e: SELF, an: ['교육자료 묶음.zip'] },
          104: { u: 104, s: '견적서 송부', d: t(1), e: SELF, an: ['견적서.pdf'] },
          105: { u: 105, s: '오래된 강의안', d: t(40), e: SELF, an: ['옛 강의.pptx'] },
          106: { u: 106, s: '교육자료', d: t(1), e: SELF, an: ['교육 일정표.xlsx'] },
          107: { u: 107, s: '강의 자료 송부', d: t(1), e: SELF, an: ['중처법 대응 강의.pdf'] },
          108: { u: 108, s: '자료 보내드립니다', d: t(1), e: SELF, an: ['중처법 실무.pdf'] },
          109: { u: 109, s: '교육 관련', d: t(1), e: SELF, an: ['11월 급여명세서.pdf', '강사 010-2222-3333.pdf', '스캔 강의안.pdf'] },
          110: { u: 110, s: '특강 교안', d: t(2), e: SELF, an: ['특강 교안 묶음.zip'] },
        },
        'Tome-1': { 201: { u: 201, s: '강의 자료(내게)', d: t(2), e: SELF, an: ['성희롱 예방 강의안.ppt'] } },
        'Inbox-1': { 301: { u: 301, s: '외부 기관 교육자료 안내', d: t(1), e: 'someone@example.org', an: ['다른 기관 교육자료.pdf'] } },
        'Pub-1': {
          401: { u: 401, s: '공공기관 강의 자료', d: t(1), e: 'someone@example.org', an: ['받은 강의자료.pdf'] },
          402: { u: 402, s: '공공기관 강의 자료 보냅니다', d: t(1), e: SELF, an: ['사용자폴더 강의.pdf'] },
        },
        'Spam-1': { 501: { u: 501, s: '무료 교육자료', d: t(1), e: SELF, an: ['교육자료.pdf'] } },
      },
    },
    edulib: { items: {}, cats: { cat_abc: { id: 'cat_abc', entityType: 'EduCategory', label: '중대재해처벌법', words: ['중처법'], createdAt: 1 } } },
  };
}
const FILES = {
  '2026 괴롭힘 예방교육.pptx': PPTX,
  '노동법 강의 개인정보.docx': DOCX_RRN,
  '교육자료 묶음.zip': ZIP_PII,
  '특강 교안 묶음.zip': ZIP_OK,
  '성희롱 예방 강의안.ppt': Buffer.from('OLD-PPT-BINARY'),
  '중처법 대응 강의.pdf': Buffer.from('%PDF-1.4 가짜'),
  '중처법 실무.pdf': Buffer.from('%PDF-1.4 낱말만'),
  '스캔 강의안.pdf': Buffer.from('%PDF-1.4 스캔'),
  '사용자폴더 강의.pdf': Buffer.from('%PDF-1.4 사용자폴더'),
  '11월 급여명세서.pdf': Buffer.from('%PDF-1.4 급여'),
};
const PDF_TEXT = {
  '%PDF-1.4 가짜': '중대재해처벌법 대응 실무 강의\n경영책임자의 안전보건 확보 의무와 사례 — 1. 적용 범위 2. 의무 내용 3. 처벌',
  '%PDF-1.4 낱말만': '중대재해처벌법 실무 정리 자료입니다. 누구나 더한 낱말만으로는 가져오지 않습니다. 시험용 긴 글자',
  '%PDF-1.4 스캔': '',
  '%PDF-1.4 사용자폴더': '사용자 폴더에 있는 강의자료 — 자동으로는 보지 않습니다. 시험용 긴 글자 시험용 긴 글자',
};
/* 지어낸 캘린더 일정 — 가나상사 괴롭힘 교육(메일 4일 뒤) · 다른 업체 교육 · 우리가 «듣는» 교육 */
const EVENTS = [
  { id: 'ev_gana', entityType: 'ScheduleEvent', date: '2026-11-24', time: '14:00', allDay: false, summary: '가나상사 직장 내 괴롭힘 예방교육', location: '가나상사 본사 3층', creator: 'lect@example.com' },
  { id: 'ev_other', entityType: 'ScheduleEvent', date: '2026-11-25', time: '10:00', allDay: false, summary: '다라전자 성희롱 예방교육', location: '', creator: 'x@example.com' },
  { id: 'ev_listen', entityType: 'ScheduleEvent', date: '2026-11-22', allDay: true, summary: '가나상사 노무사 보수교육 수강', location: '', creator: 'lect@example.com' },
];
function deps(db, over) {
  const uploads = {};
  const downloads = [];
  return Object.assign({
    db, uploads, downloads,
    now: () => NOW,
    download: async (slug, uid, name, max) => {
      downloads.push(slug + '/' + uid + '/' + name);
      const buf = FILES[name];
      if (!buf) return { gone: true };
      if (buf.length > max) return { big: true };
      return { name, mime: 'application/octet-stream', buf };
    },
    /* 창고 — 새로 쓰기만(이미 있으면 exists) */
    upload: async (p, buf) => { if (uploads[p]) return { exists: true }; uploads[p] = Buffer.from(buf); return { created: true }; },
    calEvents: async (from, to) => EVENTS.filter((e) => e.date >= from && e.date <= to),
    pdfText: async (buf) => ({ text: PDF_TEXT[buf.toString('utf8')] || '' }),
  }, over || {});
}
const items = (db) => Object.values((db.tree.edulib && db.tree.edulib.items) || {});
const byFile = (db, n) => items(db).find((it) => it.fileName === n);
const holds = (db) => Object.values((db.tree.edulib_inbox && db.tree.edulib_inbox.q) || {}).filter((q) => q.hold);

test('★★★ 서버 셈 사본이 화면 원본과 같다 — 다르면 화면과 다른 종류·다른 모양으로 넣는다', () => {
  ['pu-edulib-classify.js', 'pu-edulib-core.js', 'pu-edulib-lecture.js'].forEach((n) => assert.ok(옮길것.indexOf(n) >= 0, n));
  옮길것.forEach((이름) => {
    const 사본 = path.join(ROOT, 'functions', 'edulib-core', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-edulib-core.js');
    assert.ok(read(path.join(ROOT, 'js', 이름)) === read(사본),
      '★★★ functions/edulib-core/' + 이름 + ' 이 js/ 원본과 다릅니다 — 고칠 곳은 js/, 고친 뒤 sync 를 돌리고 함수를 다시 올려 주세요');
  });
});

test('★★ 보낸·내게쓴 폴더만 — 받은편지함·사용자 폴더·스팸·창 밖 옛 메일은 후보가 아니다 · 판정', () => {
  const t = mailTree();
  const r = S.pickCandidates(t.mailbox.folders, t.mailbox.msgs, { cutoff: NOW - 14 * DAY });
  const names = r.list.map((c) => c.name);
  assert.ok(names.indexOf('2026 괴롭힘 예방교육.pptx') >= 0);
  assert.ok(names.indexOf('성희롱 예방 강의안.ppt') >= 0, '내게쓴편지함');
  ['다른 기관 교육자료.pdf', '받은 강의자료.pdf', '사용자폴더 강의.pdf', '교육자료.pdf', '옛 강의.pptx'].forEach((n) => assert.equal(names.indexOf(n), -1, n));
  const by = (n) => r.list.find((c) => c.name === n);
  assert.equal(by('2026 괴롭힘 예방교육.pptx').ok, true);
  assert.equal(by('2026 괴롭힘 예방교육.pptx').inspect, true, '글자를 읽어 확인하는 형식');
  assert.equal(by('성희롱 예방 강의안.ppt').ok, true, '옛 형식도 저장한다(«모두 저장, 위험한 것만 뺌»)');
  assert.equal(by('성희롱 예방 강의안.ppt').inspect, false, '…내용은 읽지 못한다고 표시');
  assert.equal(by('교육자료 묶음.zip').ok, true, '압축도 받아 안의 이름을 본다');
  assert.equal(by('교육 참석자 명단.xlsx').why, 'pii', '명단');
  assert.equal(by('교육 참석자 명단.xlsx').hold, false, '강의자료 형식이 아닌 명단은 정리함에도 안 올린다');
  assert.equal(by('견적서.pdf').ok, false, '강의 말이 없는 메일의 서류');
  assert.equal(by('교육 일정표.xlsx').why, 'type', '표계산은 자동으로 안 넣는다');
  assert.equal(by('11월 급여명세서.pdf').why, 'pii', '서류 이름');
  assert.equal(by('11월 급여명세서.pdf').hold, true, '…저장하지 않고 정리함에 남긴다');
  assert.equal(by('강사 010-2222-3333.pdf').why, 'pii', '이름에 전화번호 꼴');
  assert.equal(by('강사 010-2222-3333.pdf').hold, false, '이름의 개인정보 글자는 정리함에도 옮기지 않는다');
});

test('★★★ 직원이 더한 찾을 낱말은 «종류 나누기»에만 — 가져올지를 정하는 문을 넓히지 못한다', () => {
  const C = require('../functions/edulib-core/pu-edulib-classify.js');   /* 서버가 쓰는 사본 — 화면 원본과 글자까지 같다(맨 위 검사) */
  try {
    C.setCustom([{ id: 'cat_abc', label: '중대재해처벌법', words: ['중처법'] }]);
    assert.ok(C.classifyMail('자료 보내드립니다', '중처법 실무.pdf', ''), '화면 «메일에서 찾기»(사람이 고름)는 낱말로도 후보');
    assert.equal(C.lectureSignal('자료 보내드립니다', '중처법 실무.pdf'), false);
    assert.equal(S.judgeAttachment('자료 보내드립니다', '중처법 실무.pdf', '').ok, false, '서버 자동 정리는 기본 강의 근거가 있어야');
    assert.equal(S.judgeAttachment('강의 자료 송부', '중처법 대응 강의.pdf', '').cat, 'cat_abc', '가져올 것의 «종류»는 낱말로 나눈다');
  } finally { C.setCustom([]); }
});

test('★★★ 한 번 돌면 강의자료는 자료함에 «바로 저장»하고, 위험한 것만 정리함에 남기며, 두 번 돌아도 그대로다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db);
  const r1 = await S.runSweep(d, { days: 14, trigger: 'schedule' });
  const saved = items(db).map((it) => it.fileName).sort();
  assert.deepEqual(saved, ['2026 괴롭힘 예방교육.pptx', '스캔 강의안.pdf', '성희롱 예방 강의안.ppt', '중처법 대응 강의.pdf', '특강 교안 묶음.zip'].sort());
  assert.equal(r1.saved, 5);
  assert.equal(r1.unchecked, 3, '옛 ppt·스캔 pdf·압축은 «내용 자동 확인 못 함»');
  /* 자료 기록 — 화면 «가져오기»와 같은 칸 + 온톨로지 도장 + 원본 창고 자리 */
  items(db).forEach((it) => {
    assert.ok(/^edu_m[0-9a-f]{24}$/.test(it.id), it.id);
    assert.equal(db.tree.edulib.items[it.id].id, it.id);
    assert.equal(it.entityType, 'EduMaterial');
    assert.equal(it.schemaVersion, 3); assert.equal(it.contractVersion, 1); assert.equal(it.revision, 1);
    assert.equal(it.createdBy, S.AUTO_BY); assert.equal(it.updatedBy, S.AUTO_BY);
    assert.equal(it.status, 'review', '검토 대기로 들어간다');
    assert.equal(it.store, 'cloud');
    assert.equal(it.storagePath, 'edulib/' + it.id + '/' + it.fileName);
    assert.ok(d.uploads[it.storagePath], '원본이 창고에 있다');
    assert.ok(d.uploads[it.storagePath].equals(FILES[it.fileName]), '받은 그대로(바꾸지 않는다)');
    assert.equal(it.sha256, crypto.createHash('sha256').update(FILES[it.fileName]).digest('hex'));
    assert.equal(it.source.kind, 'mail');
    assert.ok(it.source.mailSubject.indexOf('@') < 0);
    assert.equal(reviewRecord(it).ok, true, '서버 저장 감시를 통과: ' + JSON.stringify(reviewRecord(it).issues));
  });
  assert.equal(byFile(db, '2026 괴롭힘 예방교육.pptx').auto.check, 'text');
  assert.ok(byFile(db, '2026 괴롭힘 예방교육.pptx').summary.indexOf('목차(2장)') === 0);
  assert.equal(byFile(db, '성희롱 예방 강의안.ppt').auto.check, 'none');
  assert.equal(byFile(db, '성희롱 예방 강의안.ppt').auto.why, 'old-format');
  assert.equal(byFile(db, '스캔 강의안.pdf').auto.why, 'little-text');
  assert.equal(byFile(db, '특강 교안 묶음.zip').auto.why, 'archive');
  assert.equal(byFile(db, '중처법 대응 강의.pdf').cat, 'cat_abc', '사람이 더한 종류(/edulib/cats)로 나눈다');
  /* 내용 지문 — 글자를 읽은 것만 */
  const sims = db.tree.edulib.sims || {};
  assert.ok(sims[byFile(db, '2026 괴롭힘 예방교육.pptx').id], '읽은 문서는 지문');
  assert.ok(!sims[byFile(db, '성희롱 예방 강의안.ppt').id], '못 읽은 것은 지문 없음');
  Object.values(sims).forEach((s) => assert.equal(reviewRecord(s).ok, true, JSON.stringify(reviewRecord(s).issues)));
  /* 남김 — 압축 안 명단 · 문서 안 주민번호 · 서류 이름(받지 않음) */
  const hs = holds(db).map((q) => q.att + ':' + q.hold).sort();
  assert.deepEqual(hs, ['11월 급여명세서.pdf:name', '교육자료 묶음.zip:zip-name', '노동법 강의 개인정보.docx:pii-text'].sort());
  assert.equal(r1.held, 3);
  assert.ok(!d.downloads.some((x) => /급여명세서/.test(x)), '서류 이름은 받지도 않는다');
  assert.ok(!items(db).some((it) => /명단|급여|010-|개인정보/.test(it.fileName)), '위험한 것은 자료함에 없다');
  holds(db).forEach((q) => assert.ok(!('id' in q) && !('entityType' in q) && !('buf' in q), '정리함 줄은 레코드인 척하지 않고 원본을 담지 않는다'));
  assert.ok(!holds(db).some((q) => /010-/.test(q.att)), '이름에 전화번호 꼴인 첨부는 정리함에도 없다');
  /* 쓴 곳 — 자료함(items·sims·lectures)·정리함뿐 */
  assert.ok(db.writes.every((w) => /^(edulib\/(items|sims|lectures)\/|edulib_inbox\/)/.test(w[1])), JSON.stringify(db.writes.map((w) => w[1])));
  assert.ok(!db.writes.some((w) => w[2] === null), '지우는 쓰기가 없다');
  assert.equal(db.tree.edulib_inbox.state.saved, 5);

  const snap = JSON.stringify([db.tree.edulib.items, db.tree.edulib.sims, db.tree.edulib.lectures, db.tree.edulib_inbox.q]);
  const d2 = deps(db); Object.assign(d2.uploads, d.uploads);
  const r2 = await S.runSweep(d2, { days: 14 });
  assert.equal(r2.saved, 0); assert.equal(r2.held, 0);
  assert.equal(JSON.stringify([db.tree.edulib.items, db.tree.edulib.sims, db.tree.edulib.lectures, db.tree.edulib_inbox.q]), snap, '두 번째에는 아무것도 안 바뀐다');
});

test('★★★ 강의 이력 — 캘린더 일정과 맞으면 그 강의에(강의자는 만든이 표로만) · 아니면 메일 하나 = 강의 하나 · 모두 «추정»', async () => {
  const tree = mailTree();
  tree.data = { gcal_mail_sid: { 'lect@example,com': 'P007' } };
  const db = fakeDb(tree);
  const r = await S.runSweep(deps(db), { days: 14 });
  const lec = db.tree.edulib.lectures;
  const gana = lec[L.idOfCal('ev_gana')];
  assert.ok(gana, '가나상사 메일 자료 → 가나상사 일정의 강의');
  assert.equal(gana.status, 'auto', '추정');
  assert.equal(gana.date, '2026-11-24'); assert.equal(gana.time, '14:00');
  assert.equal(gana.lecturerSid, 'P007', '캘린더 만든이 메일 → 사번 표');
  assert.equal(gana.guess.lecturer, 'cal-creator');
  assert.equal(gana.venue, '가나상사 본사 3층', '장소는 일정의 장소(글)');
  assert.ok(gana.itemIds[byFile(db, '2026 괴롭힘 예방교육.pptx').id]);
  assert.equal(gana.cal.id, 'ev_gana');
  assert.ok(!lec[L.idOfCal('ev_listen')], '«수강» 일정은 강의로 보지 않는다');
  assert.ok(!lec[L.idOfCal('ev_other')], '이름이 안 겹치는 다른 업체 일정과는 잇지 않는다');
  /* 맞는 일정이 없는 자료 → 메일 하나 = 강의 하나(날짜는 메일 날·강의자 모름) */
  const ppt = byFile(db, '성희롱 예방 강의안.ppt');
  const m = lec[L.idOfMail(ppt.source.mailId)];
  assert.ok(m && m.itemIds[ppt.id]);
  assert.equal(m.lecturerSid, '', '이름으로 짐작해 사번을 넣지 않는다');
  assert.equal(m.guess.date, 'mail');
  Object.values(lec).forEach((x) => {
    assert.equal(x.entityType, 'EduLecture');
    assert.equal(reviewRecord(x).ok, true, JSON.stringify(reviewRecord(x).issues));
    assert.ok(!JSON.stringify(x).includes('@example.com'), '만든이 메일 주소는 담지 않는다');
  });
  assert.ok(r.lectures >= 2);
});

test('★★★ 사람이 «확인»한 강의 이력·지운 강의 이력은 서버가 고치지 않는다', async () => {
  const tree = mailTree();
  const lid = L.idOfCal('ev_gana');
  const okRec = L.makeLecture({ id: lid, date: '2026-11-24', status: 'ok', title: '사람이 확인함', itemIds: [] }, { uid: 'P001' }, 1);
  tree.edulib.lectures = { [lid]: Object.assign(okRec, { contractVersion: 1, revision: 3 }) };
  const db = fakeDb(tree);
  await S.runSweep(deps(db), { days: 14 });
  assert.equal(db.tree.edulib.lectures[lid].title, '사람이 확인함');
  assert.equal(db.tree.edulib.lectures[lid].revision, 3);
  assert.deepEqual(db.tree.edulib.lectures[lid].itemIds, {});
  assert.ok(byFile(db, '2026 괴롭힘 예방교육.pptx'), '자료 저장은 그대로 된다');
});

test('★★★ 지난번 정리함에 쌓인 줄(남김 아님)도 저장한다 — 지문이 같을 때만 · 줄은 지우지 않고 표시만', async () => {
  const tree = mailTree();
  tree.mailbox.msgs['Sent-1'] = {};   /* 색인에는 없어도(창 밖) 정리함 줄로 저장한다 */
  const sha = crypto.createHash('sha256').update(PPTX).digest('hex');
  tree.edulib_inbox = { q: {
    k_old: { key: 'k_old', slug: 'Sent-1', uid: '101', mailKey: '101', mailId: 'Sent-1/101', att: '2026 괴롭힘 예방교육.pptx', subject: '가나상사 괴롭힘 예방교육 자료', d: NOW - DAY, cat: 'bullying', sha256: sha, size: PPTX.length, at: 1 },
    k_diff: { key: 'k_diff', slug: 'Sent-1', uid: '107', mailKey: '107', mailId: 'Sent-1/107', att: '중처법 대응 강의.pdf', subject: '강의 자료 송부', d: NOW - DAY, cat: 'etc', sha256: 'f'.repeat(64), size: 1, at: 1 },
  } };
  const db = fakeDb(tree);
  const r = await S.runSweep(deps(db), { days: 14 });
  const it = byFile(db, '2026 괴롭힘 예방교육.pptx');
  assert.ok(it, '정리함 줄을 자료함에 저장');
  assert.equal(it.id, S.itemIdOf('k_old'));
  const q = db.tree.edulib_inbox.q;
  assert.equal(q.k_old.saved, it.id, '정리함 줄에 «저장함» 표시');
  assert.equal(q.k_old.att, '2026 괴롭힘 예방교육.pptx', '줄은 지우지 않는다');
  assert.ok(!byFile(db, '중처법 대응 강의.pdf'), '정리할 때와 다른 파일은 저장하지 않는다');
  assert.equal(q.k_diff.hold, 'diff');
  assert.ok(r.saved >= 1);
});

test('★★ 자료함에 이미 들어간 첨부(관리자가 넣은 뒤)는 다시 넣지 않는다', async () => {
  const tree = mailTree();
  tree.edulib.items.edu_a = { id: 'edu_a', entityType: 'EduMaterial', fileName: '2026 괴롭힘 예방교육.pptx', size: 1,
    source: { kind: 'mail', mailId: 'Sent-1/101' }, revision: 1 };
  const db = fakeDb(tree);
  const d = deps(db);
  await S.runSweep(d, { days: 14 });
  assert.equal(items(db).filter((it) => it.fileName === '2026 괴롭힘 예방교육.pptx').length, 1);
  assert.ok(!d.downloads.some((x) => /괴롭힘 예방교육\.pptx$/.test(x)), '받지도 않는다');
});

test('★★ 실제로 받은 첨부 이름으로 한 번 더 판정한다(색인 이름과 다를 때) — 명단 이름이면 남긴다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db, { download: async (slug, uid, name) => {
    if (name === '2026 괴롭힘 예방교육.pptx') return { name: '2026 괴롭힘 예방교육 참석자 명단.pptx', mime: '', buf: PPTX };
    return { gone: true };
  } });
  const r = await S.runSweep(d, { days: 14 });
  assert.equal(r.saved, 0);
  assert.ok(!items(db).length, '명단 이름으로 드러난 첨부는 저장하지 않는다');
  assert.ok(holds(db).some((q) => q.att === '2026 괴롭힘 예방교육 참석자 명단.pptx' && q.hold === 'name'));
});

test('★★★ 휴지통에 간 자료와 같은 파일은 다시 넣지 않는다(되살리지 않는다) · 기록·정리함 자리는 덮지 않는다', async () => {
  const tree = mailTree();
  const sha = crypto.createHash('sha256').update(PPTX).digest('hex');
  tree.edulib.items.edu_old = { id: 'edu_old', entityType: 'EduMaterial', fileName: '다른이름.pptx', size: PPTX.length, sha256: sha, _deleted: true, revision: 2 };
  const db = fakeDb(tree);
  await S.runSweep(deps(db), { days: 14 });
  assert.ok(!byFile(db, '2026 괴롭힘 예방교육.pptx'), '사람이 지운 같은 파일');
  assert.equal(db.tree.edulib.items.edu_old._deleted, true, '지운 기록은 그대로');
  /* 같은 열쇠 자리에 이미 줄·기록이 있으면 덮지 않는다(transaction) */
  const t2 = mailTree();
  const c = S.pickCandidates(t2.mailbox.folders, t2.mailbox.msgs, { cutoff: 0 }).list.find((x) => x.name === '중처법 대응 강의.pdf');
  t2.edulib_inbox = { q: { [c.seenKey]: { key: c.seenKey, att: '중처법 대응 강의.pdf', mark: '먼저 있던 줄' } } };
  const c2 = S.pickCandidates(t2.mailbox.folders, t2.mailbox.msgs, { cutoff: 0 }).list.find((x) => x.name === '스캔 강의안.pdf');
  t2.edulib.items[S.itemIdOf(c2.seenKey)] = { id: S.itemIdOf(c2.seenKey), entityType: 'EduMaterial', fileName: '먼저 있던 기록', revision: 1 };
  const db2 = fakeDb(t2);
  await S.runSweep(deps(db2), { days: 14 });
  assert.equal(db2.tree.edulib_inbox.q[c.seenKey].mark, '먼저 있던 줄');
  assert.equal(db2.tree.edulib.items[S.itemIdOf(c2.seenKey)].fileName, '먼저 있던 기록');
});

test('★★ 창고에 같은 자리가 이미 있으면(지난번에 올리고 끊김) 덮지 않고 기록만 잇는다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db);
  const c = S.pickCandidates(db.tree.mailbox.folders, db.tree.mailbox.msgs, { cutoff: 0 }).list.find((x) => x.name === '중처법 대응 강의.pdf');
  const p = 'edulib/' + S.itemIdOf(c.seenKey) + '/중처법 대응 강의.pdf';
  d.uploads[p] = Buffer.from('%PDF-1.4 가짜');
  await S.runSweep(d, { days: 14 });
  assert.equal(byFile(db, '중처법 대응 강의.pdf').storagePath, p);
});

test('★★ 다시 하면 될 실패(연결 끊김)는 «본 것»으로 적지 않는다 · 없어진 메일·너무 큰 첨부는 적는다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db, { download: async (slug, uid, name) => {
    if (name === '2026 괴롭힘 예방교육.pptx') throw new Error('연결 끊김');
    if (name === '중처법 대응 강의.pdf') return { big: true };
    return { gone: true };
  } });
  const r = await S.runSweep(d, { days: 14 });
  assert.equal(r.saved, 0);
  assert.ok(r.skipped.err >= 1 && r.skipped.big >= 1);
  const seen = db.tree.edulib_inbox.seen;
  const why = Object.keys(seen).map((k) => seen[k].why);
  assert.ok(why.indexOf('big') >= 0 && why.indexOf('gone') >= 0);
  /* «본 것»은 레코드가 아니다 — id·entityType 칸이 있으면 서버 저장 감시가 레코드로 보고 경고한다(2026-11-22 첫 밤 기록) */
  Object.keys(seen).forEach((k) => assert.ok(!('id' in seen[k]) && !('entityType' in seen[k]), '«본 것»에 id·entityType 칸이 없다'));
  assert.match(read(path.join(ROOT, 'functions', 'edulib-mail-sweep.js')), /if \(id\) v\.item = id;/, '같은 파일의 자료 열쇠는 item 칸에');
  assert.ok(!items(db).length);
  /* 다음 번엔 끊겼던 것만 다시 받는다 */
  const d2 = deps(db);
  await S.runSweep(d2, { days: 14 });
  assert.ok(d2.downloads.some((x) => /괴롭힘 예방교육\.pptx$/.test(x)));
  assert.ok(!d2.downloads.some((x) => /중처법 대응 강의\.pdf$/.test(x)), '너무 컸던 것은 다시 안 받는다');
});

test('★★ 내용 정리 — 발표자료는 장 순서대로 첫 줄(목차), 메일 주소·전화번호는 가린다', async () => {
  const ex = await S.extractContent('a.pptx', PPTX, {});
  assert.equal(ex.slides.length, 2);
  const s = S.summarize(ex);
  assert.ok(s.indexOf('목차(2장): 2026 직장 내 괴롭힘 예방교육 · 2. 직장 내 괴롭힘 판단 기준') === 0, s);
  assert.ok(s.indexOf('kim@example.com') < 0 && s.indexOf('010-1234-5678') < 0, '가린다');
  assert.ok(s.indexOf('[메일]') >= 0 && s.indexOf('[전화]') >= 0);
  assert.ok(S.summarize({ lines: ['가'.repeat(3000)] }).length <= 1200);
  const e = S.queueEntry({ seenKey: 'k1', slug: 'Sent-1', uid: '1', key: '1', name: 'a.pptx', subject: '담당 kim@example.com 010-1234-5678 900101-1234567 강의자료', d: NOW, cat: 'etc', mailId: 'Sent-1/1' },
    { name: 'a.pptx', buf: PPTX }, 'x', '', NOW, 'name');
  assert.ok(e.subject.indexOf('example.com') < 0 && e.subject.indexOf('1234-5678') < 0 && e.subject.indexOf('1234567') < 0, '메일 제목도 가린다(주민번호까지)');
  assert.ok(S.scrub('주민 900101-1234567').indexOf('[주민번호]') >= 0);
  const x = S.xmlLines('<w:p><w:r><w:t>&amp;#60;b&amp;#62;</w:t></w:r></w:p>', 'w:p', 'w:t');
  assert.deepEqual(x, ['&#60;b&#62;'], '엔티티는 한 번만 푼다(글자가 코드가 되지 않게)');
  assert.equal(S.zipRisk(ZIP_PII), true); assert.equal(S.zipRisk(ZIP_OK), false);
});

test('★★★ 저장 전 «파일 전체» 검사 — 슬라이드 노트·머리글·포함 엑셀·옛 형식 글의 주민번호 꼴, 안을 못 보는 압축은 남긴다(2026-11-27 보안 검토)', async () => {
  const RRN = '900101-1234567';
  const NOTE = makeZip([['ppt/slides/slide1.xml', slide('2026 직장 내 괴롭힘 예방교육 강의', '판단 기준과 사례를 차례로 살펴봅니다 — 시험용 긴 글자 시험용 긴 글자')],
    ['ppt/notesSlides/notesSlide1.xml', slide('참석자 ' + RRN)]]);
  const HEAD = makeZip([['word/document.xml', '<w:document><w:p><w:r><w:t>노동법 강의 본문 — 근로계약과 근로시간의 기본 원칙을 살펴봅니다. 시험용 긴 글자</w:t></w:r></w:p></w:document>'],
    ['word/header1.xml', '<w:hdr><w:p><w:r><w:t>담당 900101-</w:t></w:r><w:r><w:t>1234567</w:t></w:r></w:p></w:hdr>']]);
  const XLSX = makeZip([['xl/sharedStrings.xml', '<sst><si><t>이름</t></si><si><t>' + RRN + '</t></si></sst>']]);
  const EMB = makeZip([['ppt/slides/slide1.xml', slide('강의 표지', '본문 시험용 긴 글자 시험용 긴 글자 시험용 긴 글자 시험용')],
    ['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx', XLSX]]);
  const OLD = Buffer.concat([Buffer.from('OLE-PPT-'), Buffer.from('수강생 ' + RRN, 'utf16le'), Buffer.from('-END')]);
  /* 모양만 보는 셈 */
  assert.equal(S.scanPii(NOTE), 'rrn', '슬라이드 노트');
  assert.equal(S.scanPii(HEAD), 'rrn', '머리글(조각난 숫자도 잇는다)');
  assert.equal(S.rawRrn(OLD), true, '옛 형식의 UTF-16 글');
  assert.equal(S.scanPii(PPTX), '', '주민번호 없는 강의안은 그대로');
  assert.equal(S.scanPii(Buffer.from('OLD-PPT-BINARY')), '');
  assert.equal(S.scanPii(EMB), 'rrn', '포함된 엑셀 안의 주민번호 꼴');
  assert.equal(S.scanPii(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('깨진 zip')])), 'unread', 'zip 꼴인데 목록이 깨졌으면 «다 못 봄»');
  /* 한 번 돌기 — 모두 남기고 자료함에는 없다 */
  const tree = mailTree();
  tree.mailbox.msgs['Sent-1'] = {
    201: { u: 201, s: '강의 자료 송부', d: NOW - DAY, an: ['노트 강의안.pptx', '머리글 강의안.docx', '포함 강의안.pptx', '옛 강의안.ppt', '묶음 강의자료.7z'] } };
  tree.mailbox.msgs['Tome-1'] = {};
  const files = { '노트 강의안.pptx': NOTE, '머리글 강의안.docx': HEAD, '포함 강의안.pptx': EMB, '옛 강의안.ppt': OLD, '묶음 강의자료.7z': Buffer.from('7z-bytes') };
  const db = fakeDb(tree);
  const d = deps(db, { download: async (slug, uid, name) => (files[name] ? { name, mime: '', buf: files[name] } : { gone: true }) });
  await S.runSweep(d, { days: 14 });
  assert.deepEqual(items(db).map((it) => it.fileName), [], '하나도 자료함에 넣지 않는다');
  assert.equal(Object.keys(d.uploads).length, 0, '창고에도 올리지 않는다');
  const hs = holds(db).map((q) => q.att + ':' + q.hold).sort();
  assert.deepEqual(hs, ['노트 강의안.pptx:pii-text', '머리글 강의안.docx:pii-text', '묶음 강의자료.7z:archive', '옛 강의안.ppt:pii-text', '포함 강의안.pptx:pii-text'].sort());
});

/* ── 작은 CFB(옛 오피스·한글 묶음 파일) — 흐름을 모두 큰 섹터에(작은 흐름 한도 0) 둔다. 시험 자료를 손으로 만든다 ── */
function makeCfb(streams) {
  const SEC = 512, FREE = 0xFFFFFFFF, END = 0xFFFFFFFE, FATS = 0xFFFFFFFD;
  const dirSecs = Math.ceil((streams.length + 1) / 4);
  const fat = [FATS];
  const body = [];
  let next = 1;
  const dirStart = next;
  for (let i = 0; i < dirSecs; i++) { fat.push(i === dirSecs - 1 ? END : next + 1); next++; }
  const starts = streams.map((s) => {
    const n = Math.max(1, Math.ceil(s.data.length / SEC)); const st = next;
    for (let i = 0; i < n; i++) { fat.push(i === n - 1 ? END : next + 1); next++; }
    body.push(Buffer.concat([s.data, Buffer.alloc(n * SEC - s.data.length)]));
    return st;
  });
  while (fat.length < 128) fat.push(FREE);
  const head = Buffer.alloc(512, 0);
  head.writeUInt32LE(0xE011CFD0, 0); head.writeUInt32LE(0xE11AB1A1, 4);
  head.writeUInt16LE(0x3E, 24); head.writeUInt16LE(3, 26); head.writeUInt16LE(0xFFFE, 28); head.writeUInt16LE(9, 30); head.writeUInt16LE(6, 32);
  head.writeUInt32LE(1, 44); head.writeUInt32LE(dirStart, 48); head.writeUInt32LE(0, 56);
  head.writeUInt32LE(END, 60); head.writeUInt32LE(0, 64); head.writeUInt32LE(END, 68); head.writeUInt32LE(0, 72);
  for (let i = 0; i < 109; i++) head.writeUInt32LE(i === 0 ? 0 : FREE, 76 + i * 4);
  const fatBuf = Buffer.alloc(SEC); fat.slice(0, 128).forEach((v, i) => fatBuf.writeUInt32LE(v >>> 0, i * 4));
  const dir = Buffer.alloc(dirSecs * SEC);
  const ent = (i, name, type, start, size) => {
    const o = i * 128; const nb = Buffer.from(name + '\0', 'utf16le'); nb.copy(dir, o);
    dir.writeUInt16LE(nb.length, o + 64); dir[o + 66] = type; dir[o + 67] = 1;
    dir.writeUInt32LE(FREE, o + 68); dir.writeUInt32LE(FREE, o + 72); dir.writeUInt32LE(FREE, o + 76);
    dir.writeUInt32LE(start >>> 0, o + 116); dir.writeUInt32LE(size, o + 120);
  };
  ent(0, 'Root Entry', 5, END, 0);
  streams.forEach((s, i) => ent(i + 1, s.name, 2, starts[i], s.data.length));
  return Buffer.concat([head, fatBuf, dir].concat(body));
}
function hwpFile(text, prop) {
  const fh = Buffer.alloc(256); fh.write('HWP Document File', 0, 'latin1'); fh.writeUInt32LE(0x05000000, 32); fh.writeUInt32LE(prop, 36);
  return makeCfb([{ name: 'FileHeader', data: fh }, { name: 'PrvText', data: Buffer.from('강의 미리보기', 'utf16le') },
    { name: 'Section0', data: require('node:zlib').deflateRawSync(Buffer.from(text, 'utf16le')) }]);
}
/* zip 조각 하나를 «암호 걸림»(flag 1)으로 바꾼다 */
function encZip(buf) {
  const b = Buffer.from(buf);
  for (let i = 0; i + 4 <= b.length; i++) {
    const sig = b.readUInt32LE(i);
    if (sig === 0x04034b50) b.writeUInt16LE(b.readUInt16LE(i + 6) | 1, i + 6);
    if (sig === 0x02014b50) b.writeUInt16LE(b.readUInt16LE(i + 8) | 1, i + 8);
  }
  return b;
}

test('★★★ «못 보면 남긴다» — zip 안 7z·암호 조각·한글 압축 본문·암호/배포용 한글·암호 오피스·깨진 목록(2026-11-27 보안 재검증)', () => {
  const RRN = '900101-1234567';
  /* 한글(hwp) — 압축된 본문까지 풀어서 본다 */
  assert.equal(S.scanPii(hwpFile('직장 내 괴롭힘 예방 강의 본문입니다. 시험용 긴 글자', 1)), '', '주민번호 없는 한글 강의안은 그대로(저장)');
  assert.equal(S.scanPii(hwpFile('수강생 ' + RRN, 1)), 'rrn', '압축된 한글 본문 속 주민번호 꼴');
  assert.equal(S.scanPii(hwpFile('본문', 1 | 2)), 'unread', '암호 걸린 한글');
  assert.equal(S.scanPii(hwpFile('본문', 1 | 4)), 'unread', '배포용 한글');
  /* 암호 오피스(EncryptedPackage) · 옛 워드 */
  assert.equal(S.scanPii(makeCfb([{ name: 'EncryptionInfo', data: Buffer.alloc(64) }, { name: 'EncryptedPackage', data: Buffer.alloc(600, 7) }])), 'unread');
  assert.equal(S.scanPii(makeCfb([{ name: 'PowerPoint Document', data: Buffer.from('슬라이드 ' + RRN, 'utf16le') }])), 'rrn', '옛 ppt 흐름의 UTF-16 글');
  /* zip 안 — 볼 수 없는 압축·암호 조각·낯선 글 파일 */
  assert.equal(S.scanPii(makeZip([['강의/자료.7z', 'x'], ['강의/표지.png', 'y']])), 'unread', 'zip 으로 싼 7z 도 남긴다');
  assert.equal(S.scanPii(makeZip([['메모.rtf', '{\\rtf1 수강생 ' + RRN + '}']])), 'rrn', 'zip 안 rtf 글');
  assert.equal(S.scanPii(makeZip([['목록.json', '{"a":"' + RRN + '"}']])), 'rrn', 'zip 안 json 글');
  assert.equal(S.scanPii(encZip(makeZip([['강의안.pptx', 'x']]))), 'unread', '암호 걸린 조각');
  assert.equal(S.scanPii(makeZip([['교안/표지.png', 'PNG'], ['교안/강의.mp4', 'MP4']])), '', '그림·영상만 든 묶음은 그대로');
  /* 목록 자리가 틀린 docx — 다 못 봄 */
  const docx = makeZip([['word/document.xml', '<w:p><w:r><w:t>' + RRN + '</w:t></w:r></w:p>']]);
  const broken = Buffer.from(docx); broken.writeUInt32LE(broken.readUInt32LE(broken.length - 6) + 3, broken.length - 6);
  assert.notEqual(S.scanPii(broken), '', '목록 자리가 어긋나면 그냥 통과시키지 않는다');
  assert.equal(S.scanPii(makeCfb([])), 'unread', '흐름이 하나도 없는 묶음 파일');
});

test('★★★ 재검증 2회차 — 태그로 붙은 숫자 · CP949 이름 zip · PDF 못 읽음/300쪽 넘음 · UTF-8 긴 대시 · 빈 CFB 는 그냥 통과시키지 않는다', async () => {
  const RRN = '900101-1234567';
  const TAB = makeZip([['word/document.xml', '<w:p><w:r><w:t>' + RRN + '</w:t><w:tab/><w:t>010-1234-5678</w:t></w:r></w:p>']]);
  assert.equal(S.scanPii(TAB), 'rrn', '<w:tab/> 로 붙은 뒤 숫자 때문에 꼴이 깨지지 않는다');
  const cp949 = makeZip([[Buffer.from([0xB8, 0xED, 0xB4, 0xDC, 0x2E, 0x74, 0x78, 0x74]), '이름 목록'], ['강의안.pptx', 'x']]);   /* «명단.txt»(CP949) */
  assert.equal(S.zipRisk(cp949), true, 'UTF-8 표시 없는 한글 이름도 «명단»으로 읽는다');
  assert.equal(S.rawRrn(Buffer.from('수강생 900101–1234567', 'utf8')), true, 'UTF-8 글 속 긴 대시');
  assert.equal(S.scanPii(makeZip([['목록.csv', '이름,번호\n가,900101–1234567']])), 'rrn', 'zip 안 UTF-8 csv');
  /* PDF — 못 읽었거나 300쪽 넘어 뒤를 못 봤으면 남긴다 */
  const tree = mailTree();
  tree.mailbox.msgs['Sent-1'] = { 401: { u: 401, s: '강의 자료 송부', d: NOW - DAY, an: ['깨진 강의안.pdf', '아주 긴 강의안.pdf', '보통 강의안.pdf'] } };
  tree.mailbox.msgs['Tome-1'] = {};
  const db = fakeDb(tree);
  await S.runSweep(deps(db, {
    download: async (s, u, name) => ({ name, mime: '', buf: Buffer.from('%PDF-1.4 ' + name) }),
    pdfText: async (buf) => {
      const t = buf.toString('utf8');
      if (/깨진/.test(t)) throw new Error('pdf 못 읽음');
      if (/아주 긴/.test(t)) return { text: '앞 300쪽만 읽은 강의 글 — 시험용 긴 글자 시험용 긴 글자 시험용 긴 글자', truncated: true };
      return { text: '근로시간과 휴게 강의 — 시험용 긴 글자 시험용 긴 글자 시험용 긴 글자 시험용' };
    } }), { days: 14 });
  assert.deepEqual(items(db).map((it) => it.fileName), ['보통 강의안.pdf']);
  assert.deepEqual(holds(db).map((q) => q.att + ':' + q.hold).sort(), ['깨진 강의안.pdf:unread', '아주 긴 강의안.pdf:unread']);
});

test('★★ 강의 이력 규칙 — 칸 묶음은 묶음 꼴만 · 만든/고친/지운 사람은 그대로 두거나 지금 쓰는 사람의 사번만 · 창고 파일 종류는 확장자 허용표', () => {
  const L2 = require('../docs/rules-paste.json').rules.edulib.lectures.$id;
  ['cal', 'mail', 'guess', 'itemIds'].forEach((k) => assert.equal(L2[k]['.validate'], 'newData.hasChildren()', k));
  ['createdBy', 'updatedBy', 'deletedBy', 'confirmedBy'].forEach((k) => assert.ok(L2[k]['.validate'].includes("newData.val() === data.val() || newData.val() === root.child('uid_roles').child(auth.uid).child('sid').val()"), k));
  const idx = read(path.join(ROOT, 'functions', 'index.js'));
  const up = idx.slice(idx.indexOf('upload: async (p, buf)'), idx.indexOf('calEvents: async'));
  assert.match(up, /EDULIB_TYPES\[ext\.toLowerCase\(\)\] \|\| "application\/octet-stream"/, '메일이 말한 종류를 믿지 않는다');
  assert.ok(!/contentType: mime/.test(up));
});

test('★★ 한 번 돌기 — 암호 한글·이름만 pptx 인 암호 파일은 남기고, 주민번호 없는 한글은 «내용 확인 못 함»으로 저장', async () => {
  const tree = mailTree();
  tree.mailbox.msgs['Sent-1'] = { 301: { u: 301, s: '강의 자료 송부', d: NOW - DAY, an: ['암호 강의안.hwp', '괜찮은 강의안.hwp', '암호 강의안.pptx', '암호 강의안.pdf'] } };
  tree.mailbox.msgs['Tome-1'] = {};
  const files = { '암호 강의안.hwp': hwpFile('본문', 3), '괜찮은 강의안.hwp': hwpFile('근로시간과 휴게 강의 본문', 1),
    '암호 강의안.pptx': makeCfb([{ name: 'EncryptedPackage', data: Buffer.alloc(600, 1) }]), '암호 강의안.pdf': Buffer.from('%PDF-1.7 trailer << /Encrypt 5 0 R >>') };
  const db = fakeDb(tree);
  await S.runSweep(deps(db, { download: async (s, u, name) => (files[name] ? { name, mime: '', buf: files[name] } : { gone: true }) }), { days: 14 });
  assert.deepEqual(items(db).map((it) => it.fileName), ['괜찮은 강의안.hwp']);
  assert.equal(byFile(db, '괜찮은 강의안.hwp').auto.check, 'none');
  assert.deepEqual(holds(db).map((q) => q.att + ':' + q.hold).sort(), ['암호 강의안.hwp:unread', '암호 강의안.pdf:unread', '암호 강의안.pptx:unread']);
});

test('★★ 지난번 정리함 줄도 지금 잣대로 이름을 다시 본다 · 문단 읽기는 닫힘 없는 태그가 많아도 금방 끝난다', async () => {
  const tree = mailTree();
  tree.mailbox.msgs['Sent-1'] = {}; tree.mailbox.msgs['Tome-1'] = {};
  tree.edulib_inbox = { q: { k_bad: { key: 'k_bad', slug: 'Sent-1', uid: '101', mailKey: '101', mailId: 'Sent-1/101', att: '교육 참석자 명단 강의.pptx', subject: '강의 자료', d: NOW - DAY, cat: 'etc', sha256: '', size: 1, at: 1 } } };
  const db = fakeDb(tree);
  await S.runSweep(deps(db, { download: async (s, u, name) => ({ name, mime: '', buf: PPTX }) }), { days: 14 });
  assert.ok(!items(db).length, '명단 이름은 저장하지 않는다');
  assert.equal(db.tree.edulib_inbox.q.k_bad.hold, 'name');
  const t0 = Date.now();
  S.xmlLines('<a:p x="1">'.repeat(200000) + '<a:p><a:t>끝</a:t></a:p>', 'a:p', 'a:t');
  assert.ok(Date.now() - t0 < 3000, '한 번 훑기(닫힘 없는 여는 태그 20만 개)');
});

test('★★ 주민번호 꼴 — 빈칸·여러 대시·전각·붙여 쓴 13자리도 막고 가린다(앞 6자리가 날짜 꼴일 때)', () => {
  ['900101-1234567', '900101 1234567', '900101–1234567', '900101−1234567', '9001011234567', '９００１０１－１２３４５６７']
    .forEach((s) => {
      assert.ok(S.hasRrn('참석 ' + s), s);
      assert.ok(S.scrub('참석 ' + s).indexOf('[주민번호]') >= 0 && !/\d{7}/.test(S.scrub('참석 ' + s)), s);
    });
  ['1234567890123', '2026-11-21 1234567', '010-1234-5678'].forEach((s) => assert.equal(S.hasRrn(s), false, '날짜 꼴이 아니면 주민번호로 안 본다: ' + s));
  assert.equal(S.judgeAttachment('강의 자료', '강의안 9001011234567.pdf', '').why, 'pii', '이름에 붙여 쓴 주민번호');
  assert.equal(S.judgeAttachment('강의 자료', '강의안 9001011234567.pdf', '').hold, false, '…그 이름은 정리함에도 옮기지 않는다');
});

test('★★ 서버 도장 — 화면 관문과 같은 판(schemaVersion·contractVersion)', () => {
  const O = require(path.join(ROOT, 'js', 'pu-ontology.js'));
  const W = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
  assert.equal(S.ONTOLOGY_SCHEMA, O.VERSION, '서버가 찍는 자료 구조 판 = 화면 관문(PuOntology.VERSION)');
  assert.equal(S.CONTRACT_VERSION, W.CONTRACT_VERSION || 1);
});

test('★★ 정리함에서 넣을 때 — «정리한 바로 그 첨부»만(이름이 정확히 같고, 지문이 있으면 지문도 같아야) · 남긴 줄은 한 번 더 묻는다', () => {
  const app = read(path.join(ROOT, 'js', 'pu-edulib-app.js'));
  const row = app.slice(app.indexOf('function importMailRow'), app.indexOf('/* ───────── 사람이 더한 강의 종류'));
  assert.match(row, /!r\.exact && a\.name\.slice\(0, 60\)/, '정리함 줄은 앞 60자 맞추기를 쓰지 않는다');
  assert.match(row, /if \(r\.exact\) want = want\.slice\(0, 1\)/, '한 건만');
  assert.match(row, /r\.qsha && h !== r\.qsha/, '받은 뒤 지문이 정리할 때와 같아야');
  const inbox = app.slice(app.indexOf('function inboxRows'), app.indexOf('function drawInbox'));
  assert.match(inbox, /exact: true/);
  assert.match(inbox, /!q\.saved && !q\.same/, '저장한 줄은 안 보인다');
  const imp = app.slice(app.indexOf('function importRows'), app.indexOf('function importMailRow'));
  assert.match(imp, /\.hold/, '남긴(개인정보 의심) 줄을 넣을 때는 한 번 더 묻는다');
});

test('★★ 서버 함수 — 매일 한 번 · 관리자만 · 잠금 · 창고는 새로 쓰기만 · AI 안 씀', () => {
  const idx = read(path.join(ROOT, 'functions', 'index.js'));
  const i = idx.indexOf('exports.edulibMailSweep');
  assert.ok(i > 0 && idx.indexOf('exports.runEdulibMailSweep') > i);
  const fn = idx.slice(i, idx.indexOf('\nexports.', i + 10));
  assert.match(fn, /\.pubsub\.schedule\("30 19 \* \* \*"\)/);
  assert.match(fn, /acquireEdulibSweepLock/);
  const run = idx.slice(idx.indexOf('exports.runEdulibMailSweep'), idx.indexOf('exports.runEdulibMailSweep') + 2000);
  assert.match(run, /requireStaff\(req\)/);
  assert.match(run, /staffRole\.isAdmin/);
  const block = idx.slice(idx.indexOf('const EdulibMailSweep'), idx.indexOf('async function acquireEdulibSweepLock'));
  assert.match(block, /ifGenerationMatch: 0/, '창고는 새로 쓰기만(덮지 않는다)');
  assert.match(block, /edu_m\[0-9a-z\]\+/, '창고 자리는 자동 저장 자료 자리만');
  assert.match(block, /orderByChild\("date"\)\.startAt/, '캘린더는 날짜 범위로만 읽는다');
  assert.ok(!/callGemini|GEMINI_KEY/.test(block), 'AI 를 쓰지 않는다');
  const sweep = read(path.join(ROOT, 'functions', 'edulib-mail-sweep.js'));
  assert.ok(!/\.remove\(\)|\.set\(null\)/.test(sweep), '지우는 쓰기가 없다');
  ['ITEMS_ROOT', 'SIMS_ROOT', 'LECT_ROOT'].forEach((k) => {
    const re = new RegExp('db\\.ref\\(' + k + ' \\+ "/" \\+ [^)]+\\)\\.(\\w+)', 'g');
    const uses = [...sweep.matchAll(re)].map((m) => m[1]);
    assert.ok(uses.length && uses.every((u) => u === 'transaction'), k + ' 자리는 transaction 으로만 쓴다: ' + uses);
  });
  /* 규칙 — 자동 정리함은 관리자만 읽고 화면은 못 쓴다 */
  const rules = require('../docs/rules-paste.json').rules.edulib_inbox;
  assert.equal(rules['.write'], false);
  assert.match(rules['.read'], /isAdmin/);
});
