'use strict';
/* 🎓 보낸 메일의 강의자료 → 강의자료 앱 자동 정리 (2026-11-21, functions/edulib-mail-sweep.js)
 *
 * ■ 왜 이 검사가 있나 — 대표 지시 「메일로 보낸 강의 자료나 강의 내용의 경우 자동으로 정리해서 내용 넣을 수 있게 해달라」
 *   사람 손을 거치지 않고 «재직 직원 모두 보는» 자료함에 넣는 길이라, 무엇을 넣지 «않는지»가 더 중요하다.
 *   ① 서버 셈 사본(functions/edulib-core/)이 화면 원본(js/)과 한 글자까지 같다 — 다르면 화면과 다른 종류로 넣는다
 *   ② 우리가 보낸 메일만 — 보낸편지함·내게쓴편지함 둘뿐(사용자 폴더·받은편지함은 안 본다)
 *   ③ 사람이 보지 않고 넣는 것은 «내용을 읽어 확인한 문서»뿐 — 옛 형식·압축·스캔 pdf 는 «사람 확인 필요»로만 센다.
 *      명단·서명·급여 같은 이름, 이름에 전화·메일·주민번호 꼴, 문서 안 주민번호 꼴은 안 넣는다
 *   ③-1 직원이 더한 찾을 낱말은 «종류 나누기»에만 — 가져올지를 정하는 문을 넓히지 못한다
 *   ④ 같은 파일·이미 넣은 첨부·휴지통에 간 자료는 다시 올리지 않는다(되살리지 않는다) — 두 번 돌아도 그대로
 *   ⑤ «정리»까지만 자동 — 서버는 관리자만 읽는 자동 정리함(edulib_inbox)에만 쓰고, 자료함(edulib)·창고에는 쓰지 않는다.
 *      원본 바이트는 어디에도 담지 않는다. 넣기는 관리자가 화면에서 고른다(화면 «가져오기» 길)
 *   ⑥ 내용 정리 — 발표자료는 장마다 첫 줄(목차), 메일 주소·전화번호는 가린다
 *   ⑦ 서버 함수가 매일 한 번·관리자만·잠금·새로 쓰기만으로 이어져 있다
 * ⚠ 예시는 지어낸 것이다(가나상사·example 주소). 실제 메일·고객 자료를 쓰지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const S = require('../functions/edulib-mail-sweep.js');
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
    const nb = Buffer.from(name, 'utf8'), data = Buffer.from(text, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(0, 10);
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
const PPTX = makeZip([['ppt/slides/slide2.xml', slide('2. 직장 내 괴롭힘 판단 기준', '문의 010-1234-5678')],
  ['ppt/slides/slide1.xml', slide('2026 직장 내 괴롭힘 예방교육', '가나상사 담당 kim@example.com')], ['ppt/presentation.xml', '<p/>']]);
const DOCX_RRN = makeZip([['word/document.xml', '<w:document><w:p><w:r><w:t>참석자 900101-1234567</w:t></w:r></w:p></w:document>']]);
const ZIP_PII = makeZip([['강의안.pptx', 'x'], ['참석자 명단.xlsx', 'y']]);

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
        set: async (v) => { writes.push(['set', p]); put(p, v); },
        update: async (obj) => { writes.push(['update', p]); Object.keys(obj).forEach((k) => put(p + '/' + k, obj[k])); },
        transaction: async (fn) => {
          const cur = get(p);
          const next = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur)));
          if (next === undefined) return { committed: false };
          writes.push(['tx', p]); put(p, next); return { committed: true };
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
          101: { u: 101, s: '[푸른노무법인] 괴롭힘 예방교육 자료 송부', d: t(1), e: SELF, an: ['2026 괴롭힘 예방교육.pptx', '교육 참석자 명단.xlsx'] },
          102: { u: 102, s: '강의안 송부', d: t(2), e: SELF, an: ['노동법 강의 개인정보.docx'] },
          103: { u: 103, s: '교육 자료', d: t(3), e: SELF, an: ['교육자료 묶음.zip'] },
          104: { u: 104, s: '견적서 송부', d: t(1), e: SELF, an: ['견적서.pdf'] },
          105: { u: 105, s: '오래된 강의안', d: t(40), e: SELF, an: ['옛 강의.pptx'] },
          106: { u: 106, s: '교육자료', d: t(1), e: SELF, an: ['교육 일정표.xlsx'] },
          107: { u: 107, s: '강의 자료 송부', d: t(1), e: SELF, an: ['중처법 대응 강의.pdf'] },
          108: { u: 108, s: '자료 보내드립니다', d: t(1), e: SELF, an: ['중처법 실무.pdf'] },
          109: { u: 109, s: '교육 관련', d: t(1), e: SELF, an: ['11월 급여명세서.pdf', '강사 010-2222-3333.pdf', '스캔 강의안.pdf'] },
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
  '성희롱 예방 강의안.ppt': Buffer.from('OLD-PPT-BINARY'),
  '중처법 대응 강의.pdf': Buffer.from('%PDF-1.4 가짜'),
  '중처법 실무.pdf': Buffer.from('%PDF-1.4 낱말만'),
  '스캔 강의안.pdf': Buffer.from('%PDF-1.4 스캔'),
  '사용자폴더 강의.pdf': Buffer.from('%PDF-1.4 사용자폴더'),
};
const PDF_TEXT = {
  '%PDF-1.4 가짜': '중대재해처벌법 대응 실무 강의\n경영책임자의 안전보건 확보 의무와 사례 — 1. 적용 범위 2. 의무 내용 3. 처벌',
  '%PDF-1.4 낱말만': '중대재해처벌법 실무 정리 자료입니다. 누구나 더한 낱말만으로는 가져오지 않습니다. 시험용 긴 글자',
  '%PDF-1.4 스캔': '',
  '%PDF-1.4 사용자폴더': '사용자 폴더에 있는 강의자료 — 자동으로는 보지 않습니다. 시험용 긴 글자 시험용 긴 글자',
};
function deps(db, over) {
  const saved = {};
  const downloads = [];
  return Object.assign({
    db, saved, downloads,
    now: () => NOW,
    download: async (slug, uid, name, max) => {
      downloads.push(slug + '/' + uid + '/' + name);
      const buf = FILES[name];
      if (!buf) return { gone: true };
      if (buf.length > max) return { big: true };
      return { name, mime: 'application/octet-stream', buf };
    },
    pdfText: async (buf) => ({ text: PDF_TEXT[buf.toString('utf8')] || '' }),
  }, over || {});
}

test('★★★ 서버 셈 사본이 화면 원본과 같다 — 다르면 화면과 다른 종류·다른 모양으로 넣는다', () => {
  assert.ok(옮길것.indexOf('pu-edulib-classify.js') >= 0 && 옮길것.indexOf('pu-edulib-core.js') >= 0);
  옮길것.forEach((이름) => {
    const 사본 = path.join(ROOT, 'functions', 'edulib-core', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-edulib-core.js');
    assert.ok(read(path.join(ROOT, 'js', 이름)) === read(사본),
      '★★★ functions/edulib-core/' + 이름 + ' 이 js/ 원본과 다릅니다 — 고칠 곳은 js/, 고친 뒤 sync 를 돌리고 함수를 다시 올려 주세요');
  });
});

test('★★ 보낸·내게쓴 폴더만 — 받은편지함·사용자 폴더·스팸·창 밖 옛 메일은 후보가 아니다', () => {
  const t = mailTree();
  const r = S.pickCandidates(t.mailbox.folders, t.mailbox.msgs, { cutoff: NOW - 14 * DAY });
  const names = r.list.map((c) => c.name);
  assert.ok(names.indexOf('2026 괴롭힘 예방교육.pptx') >= 0);
  assert.ok(names.indexOf('성희롱 예방 강의안.ppt') >= 0, '내게쓴편지함');
  ['다른 기관 교육자료.pdf', '받은 강의자료.pdf', '사용자폴더 강의.pdf', '교육자료.pdf', '옛 강의.pptx'].forEach((n) => assert.equal(names.indexOf(n), -1, n));
  const by = (n) => r.list.find((c) => c.name === n);
  assert.equal(by('교육 참석자 명단.xlsx').why, 'pii', '명단');
  assert.equal(by('견적서.pdf').ok, false, '강의 말이 없는 메일의 서류');
  assert.equal(by('교육 일정표.xlsx').why, 'type', '표계산은 자동으로 안 넣는다');
  assert.equal(by('성희롱 예방 강의안.ppt').why, 'human', '옛 형식은 내용을 확인 못 해 사람에게');
  assert.equal(by('교육자료 묶음.zip').why, 'human', '압축도 사람에게');
  assert.equal(by('11월 급여명세서.pdf').why, 'pii', '서류 이름');
  assert.equal(by('강사 010-2222-3333.pdf').why, 'pii', '이름에 전화번호 꼴');
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

test('★★★ 한 번 돌면 올릴 것만 자동 정리함에 올리고, 두 번 돌아도 그대로다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db);
  const r1 = await S.runSweep(d, { days: 14, trigger: 'schedule' });
  const q = db.tree.edulib_inbox.q;
  const got = Object.keys(q).map((k) => q[k].att).sort();
  assert.deepEqual(got, ['2026 괴롭힘 예방교육.pptx', '중처법 대응 강의.pdf'].sort());
  assert.equal(r1.queued, 2);
  assert.ok(r1.skipped.pii >= 4, '명단·급여·전화 꼴 이름과 주민번호 꼴 문서는 뺀다');
  assert.ok(r1.skipped.human >= 3, '옛 형식·압축·스캔 pdf 는 사람 확인 필요로만 센다');
  assert.ok(!d.downloads.some((x) => /\.(ppt|zip)$/.test(x)), '내용을 확인 못 할 형식은 받지도 않는다');
  /* 자동 정리함 줄 — 화면 «가져오기»가 쓸 메일 자리·첨부 이름·종류·내용, 원본 바이트는 없다 */
  Object.keys(q).forEach((k) => {
    const e = q[k];
    assert.equal(e.key, k);
    assert.ok(e.slug && e.uid && e.mailKey && e.mailId && e.att);
    assert.equal(e.sha256, crypto.createHash('sha256').update(FILES[e.att]).digest('hex'));
    assert.equal(e.size, FILES[e.att].length);
    assert.ok(!('buf' in e) && !('id' in e) && !('entityType' in e), '원본을 담지 않고, 자료함 기록인 척하지 않는다');
    assert.ok(e.summary.length > 0);
  });
  /* 사람이 더한 종류(/edulib/cats)로 나눈다 */
  assert.equal(Object.values(q).find((e) => e.att === '중처법 대응 강의.pdf').cat, 'cat_abc');
  /* 자료함·창고에는 아무것도 안 쓴다 — 쓴 곳은 모두 관리자 전용 자리 */
  assert.deepEqual(db.tree.edulib.items, {});
  assert.ok(db.writes.length > 0 && db.writes.every((w) => /^edulib_inbox\//.test(w[1])), JSON.stringify(db.writes));
  assert.equal(db.tree.edulib_inbox.state.queued, 2);

  const before = JSON.stringify(db.tree.edulib_inbox.q);
  const r2 = await S.runSweep(deps(db), { days: 14 });
  assert.equal(r2.queued, 0);
  assert.equal(JSON.stringify(db.tree.edulib_inbox.q), before, '두 번째에는 아무것도 안 바뀐다');
});

test('★★ 자료함에 이미 들어간 첨부(관리자가 넣은 뒤)는 다시 올리지 않는다', async () => {
  const tree = mailTree();
  tree.edulib.items.edu_a = { id: 'edu_a', entityType: 'EduMaterial', fileName: '2026 괴롭힘 예방교육.pptx', size: 1,
    source: { kind: 'mail', mailId: 'Sent-1/101' }, revision: 1 };
  const db = fakeDb(tree);
  await S.runSweep(deps(db), { days: 14 });
  assert.ok(!Object.values(db.tree.edulib_inbox.q).some((e) => e.att === '2026 괴롭힘 예방교육.pptx'));
});

test('★★ 실제로 받은 첨부 이름으로 한 번 더 판정한다(색인 이름과 다를 때)', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db, { download: async (slug, uid, name) => {
    if (name === '2026 괴롭힘 예방교육.pptx') return { name: '2026 괴롭힘 예방교육 참석자 명단.pptx', mime: '', buf: PPTX };
    return { gone: true };
  } });
  const r = await S.runSweep(d, { days: 14 });
  assert.equal(r.queued, 0);
  assert.ok(!db.tree.edulib_inbox.q, '명단 이름으로 드러난 첨부는 올리지 않는다');
});

test('★★★ 휴지통에 간 자료와 같은 파일은 다시 올리지 않는다(되살리지 않는다) · 정리함 자리는 덮지 않는다', async () => {
  const tree = mailTree();
  const sha = crypto.createHash('sha256').update(PPTX).digest('hex');
  tree.edulib.items.edu_old = { id: 'edu_old', entityType: 'EduMaterial', fileName: '다른이름.pptx', size: PPTX.length, sha256: sha, _deleted: true, revision: 2 };
  const db = fakeDb(tree);
  await S.runSweep(deps(db), { days: 14 });
  assert.ok(!Object.values(db.tree.edulib_inbox.q).some((e) => e.att === '2026 괴롭힘 예방교육.pptx'), '사람이 지운 같은 파일');
  assert.equal(db.tree.edulib.items.edu_old._deleted, true, '지운 기록은 그대로');
  /* 같은 열쇠 자리에 이미 줄이 있으면 덮지 않는다(transaction) */
  const t2 = mailTree();
  const c = S.pickCandidates(t2.mailbox.folders, t2.mailbox.msgs, { cutoff: 0 }).list.find((x) => x.name === '중처법 대응 강의.pdf');
  t2.edulib_inbox = { q: { [c.seenKey]: { key: c.seenKey, att: '중처법 대응 강의.pdf', mark: '먼저 있던 줄' } } };
  const db2 = fakeDb(t2);
  await S.runSweep(deps(db2), { days: 14 });
  assert.equal(db2.tree.edulib_inbox.q[c.seenKey].mark, '먼저 있던 줄');
});

test('★★ 다시 하면 될 실패(연결 끊김)는 «본 것»으로 적지 않는다 · 없어진 메일·너무 큰 첨부는 적는다', async () => {
  const db = fakeDb(mailTree());
  const d = deps(db, { download: async (slug, uid, name) => {
    if (name === '2026 괴롭힘 예방교육.pptx') throw new Error('연결 끊김');
    if (name === '중처법 대응 강의.pdf') return { big: true };
    return { gone: true };
  } });
  const r = await S.runSweep(d, { days: 14 });
  assert.equal(r.queued, 0);
  assert.ok(r.skipped.err >= 1 && r.skipped.big >= 1);
  const seen = db.tree.edulib_inbox.seen;
  const why = Object.keys(seen).map((k) => seen[k].why);
  assert.ok(why.indexOf('big') >= 0 && why.indexOf('gone') >= 0);
  assert.ok(!db.tree.edulib_inbox.q);
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
    { name: 'a.pptx', buf: PPTX }, 'x', '', NOW);
  assert.ok(e.subject.indexOf('example.com') < 0 && e.subject.indexOf('1234-5678') < 0 && e.subject.indexOf('1234567') < 0, '메일 제목도 가린다(주민번호까지)');
  assert.ok(S.scrub('주민 900101-1234567').indexOf('[주민번호]') >= 0);
  const x = S.xmlLines('<w:p><w:r><w:t>&amp;#60;b&amp;#62;</w:t></w:r></w:p>', 'w:p', 'w:t');
  assert.deepEqual(x, ['&#60;b&#62;'], '엔티티는 한 번만 푼다(글자가 코드가 되지 않게)');
});

test('★★ 주민번호 꼴 — 빈칸·여러 대시·전각·붙여 쓴 13자리도 막고 가린다(앞 6자리가 날짜 꼴일 때)', () => {
  ['900101-1234567', '900101 1234567', '900101–1234567', '900101−1234567', '9001011234567', '９００１０１－１２３４５６７']
    .forEach((s) => {
      assert.ok(S.hasRrn('참석 ' + s), s);
      assert.ok(S.scrub('참석 ' + s).indexOf('[주민번호]') >= 0 && !/\d{7}/.test(S.scrub('참석 ' + s)), s);
    });
  ['1234567890123', '2026-11-21 1234567', '010-1234-5678'].forEach((s) => assert.equal(S.hasRrn(s), false, '날짜 꼴이 아니면 주민번호로 안 본다: ' + s));
  assert.equal(S.judgeAttachment('강의 자료', '강의안 9001011234567.pdf', '').why, 'pii', '이름에 붙여 쓴 주민번호');
});

test('★★ 자동 정리함에서 넣을 때는 «정리한 바로 그 첨부»만 — 이름이 정확히 같고 지문도 같아야 올린다', () => {
  const app = read(path.join(ROOT, 'js', 'pu-edulib-app.js'));
  const row = app.slice(app.indexOf('function importMailRow'), app.indexOf('/* ───────── 사람이 더한 강의 종류'));
  assert.match(row, /!r\.qsha && a\.name\.slice\(0, 60\)/, '정리함 줄은 앞 60자 맞추기를 쓰지 않는다');
  assert.match(row, /if \(r\.qsha\) want = want\.slice\(0, 1\)/, '한 건만');
  assert.match(row, /r\.qsha && h !== r\.qsha/, '받은 뒤 지문이 정리할 때와 같아야');
  const inbox = app.slice(app.indexOf('function inboxRows'), app.indexOf('function drawInbox'));
  assert.match(inbox, /qsha: String\(q\.sha256 \|\| ''\) \|\| 'none'/, '지문이 없는 줄은 올리지 못한다(none)');
});

test('★★ 서버 함수 — 매일 한 번 · 관리자만 · 잠금 · 창고·자료함에는 안 쓴다 · AI 안 씀', () => {
  const idx = read(path.join(ROOT, 'functions', 'index.js'));
  const i = idx.indexOf('exports.edulibMailSweep');
  assert.ok(i > 0 && idx.indexOf('exports.runEdulibMailSweep') > i);
  const fn = idx.slice(i, idx.indexOf('\nexports.', i + 10));
  assert.match(fn, /\.pubsub\.schedule\("30 19 \* \* \*"\)/);
  assert.match(fn, /acquireEdulibSweepLock/);
  const run = idx.slice(idx.indexOf('exports.runEdulibMailSweep'), idx.indexOf('exports.runEdulibMailSweep') + 2000);
  assert.match(run, /requireStaff\(req\)/);
  assert.match(run, /staffRole\.isAdmin/);
  const block = idx.slice(idx.indexOf('const EdulibMailSweep'), idx.indexOf('exports.runEdulibMailSweep') + 2000);
  assert.ok(!/\.save\(|getStorage\(|edulib\/items/.test(block), '서버는 창고·자료함에 쓰지 않는다(자동 정리함만)');
  assert.ok(!/callGemini|GEMINI_KEY/.test(block), 'AI 를 쓰지 않는다');
  const sweep = read(path.join(ROOT, 'functions', 'edulib-mail-sweep.js'));
  assert.ok(!/\bITEMS_ROOT\s*\+|ref\(ITEMS_ROOT\s*\+/.test(sweep), '자료함 기록 자리에 쓰는 줄이 없다');
  /* 규칙 — 자동 정리함은 관리자만 읽고 화면은 못 쓴다 */
  const rules = require('../docs/rules-paste.json').rules.edulib_inbox;
  assert.equal(rules['.write'], false);
  assert.match(rules['.read'], /isAdmin/);
});
