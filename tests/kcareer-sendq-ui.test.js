/* 경력관리 «발송 대기» 화면 — kcareer.html 안의 sq* 코드를 «그대로 꺼내» 가짜 환경에서 돌린다 (2026-11-05)
   검사가 따로 짠 흉내가 아니라 화면에 실제로 있는 함수를 부른다. 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8');
const Q = require('../js/kcareer-sendq.js');
const Stamp = require('../js/kcareer-hwpstamp.js');
const JSZip = require('../vendor/jszip.min.js');

/* ── 화면 코드 꺼내기 ── */
const START = html.indexOf('var SQ_STORE=');
const END = html.indexOf('/* ===== 이력서 생성·보관 — 내 정보로 채우기');
const BLOCK = html.slice(START, END);

test('화면 자리가 있다 — 비용 서류 탭 위 띠 · 단추 · 모듈 불러오기(캐시 번호)', () => {
  assert.ok(START > 0 && END > START, '발송 대기 코드 덩어리를 못 찾았다');
  const tab = html.slice(html.indexOf('id="db-feedoc"'), html.indexOf('id="db-feedoc"') + 600);
  assert.match(tab, /id="sqBand"/);
  assert.match(html, /onclick="sqToggleIntake\(\)"/);
  assert.match(html, /<script src="js\/kcareer-sendq\.js\?v=\d+"><\/script>/);
  assert.match(html, /if\(domain==='feedoc'\) _safe\(sqRender\)/, '비용 서류를 다시 그릴 때 띠도 함께 그린다');
});
test('★ 자동으로 보내지 않는다 — sqSend 는 단추(onclick)에서만 불린다', () => {
  const callers = (BLOCK.match(/sqSend\(/g) || []).length;
  assert.equal(callers, 2, '정의 한 곳 + 단추 한 곳뿐이어야 한다');
  assert.match(BLOCK, /onclick="sqSend\(/);
  const proc = BLOCK.slice(BLOCK.indexOf('async function sqProcess'), BLOCK.indexOf('function sqView'));
  assert.ok(!/sqSend\(|SQ_MAIL_FN|fetch\(/.test(proc), 'sqProcess(채우기)는 메일을 보내는 길을 몰라야 한다');
});

/* ── 가짜 환경 ── */
const P = (t) => '<hp:p id="0"><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray></hp:p>';
function sectionXml(o) {
  o = o || {}; const c = '□ 동의       □ 동의하지 않음';
  return '<hs:sec>' + P('지급확인서 및 개인정보 수집 이용 동의서') + P('(사)' + (o.org || '가나다복지협회') + '는 수집합니다')
    + P('* 교육일 : 2030. 1. 2.(수) 10:00~12:00') + P('* 강사비 지급 내역 : 100,000원(1급 기준, 2h)') + P(' -원천세(8.8%) : 8,800원, 실지급액 : 91,200원')
    + P('[수집/이용항목] 성명, 주민등록번호, 주소, 입금계좌') + P(c) + (o.third ? P(c) : '') + P(c)
    + P('확   인 :          (서명)') + P(' 2030년    월     일 ') + '</hs:sec>';
}
async function hwpx(o) {
  const z = new JSZip();
  z.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  z.file('Contents/section0.xml', sectionXml(o));
  z.file('Contents/content.hpf', '<opf:package><opf:manifest></opf:manifest></opf:package>');
  return new Uint8Array(await z.generateAsync({ type: 'uint8array' }));
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]), Buffer.alloc(40)]);

function world(o) {
  o = o || {};
  const ls = new Map(), files = new Map(), toasts = [], sent = [], uploads = [];
  const el = {};
  const dom = (id) => (el[id] = el[id] || { id, innerHTML: '', style: {}, value: '' });
  const ctx = {
    KcareerSendQ: Q, KcareerHwpStamp: Stamp, JSZip, console, Date, Math, JSON, Object, Array, String, Number, Blob, Promise, Uint8Array, ArrayBuffer, /* vm 안 Uint8Array 가 다른 세계 것이면 JSZip 이 못 읽는다 */
    get: (k) => (ls.has(k) ? JSON.parse(ls.get(k)) : []), set: (k, v) => { ls.set(k, JSON.stringify(v)); },
    escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    _jsAttr: (s) => String(s == null ? '' : s), _won: (n) => n + '원', toast: (m) => toasts.push(String(m)), _safe: (f) => f(),
    document: { getElementById: dom }, renderDocStore: () => {},
    abToB64: (u8) => Buffer.from(u8).toString('base64'), b64ToAb: (b) => { const x = Buffer.from(b, 'base64'); return x.buffer.slice(x.byteOffset, x.byteOffset + x.length); },
    _rhToHwpx: async (b) => b, _loadJSZip: async () => {},
    saveFileWait: async (id, f) => { files.set(id, f); return !o.saveFails; }, getFileAsync: async (id) => files.get(id) || null,
    kcFormUpload: async () => '', getProfileInfo: () => ({ name: o.noName ? '' : '가나다' }),
    getDefaultStamp: () => (o.noStamp ? null : { id: 'st1' }), stampFit: () => ({ size: 3400, dx: 0, dy: -700 }), _rhStampPx: async () => 200,
    firebase: { auth: () => ({ currentUser: { uid: 'u1', getIdToken: async () => 'tok' } }),
      app: () => ({ storage: () => ({ ref: (p) => ({ put: async (b) => { uploads.push({ p, size: b.size }); } }) }) }) },
    fetch: async (url, init) => { sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return { ok: o.mailFails ? false : true, status: o.mailFails ? 500 : 200, json: async () => (o.mailFails ? { ok: false, error: '서버 거절' } : { ok: true, files: o.noFiles ? 0 : 1 }) }; },
    navTile: () => {}, showBig: (id) => toasts.push('big:' + id),
  };
  files.set('st1', { base64: PNG.toString('base64') });
  vm.createContext(ctx);
  vm.runInContext(BLOCK, ctx);
  return { ctx, ls, files, toasts, sent, uploads, el, items: () => ctx.get('sendq'), feedoc: () => ctx.get('feedoc') };
}
const META = { from: 'rule@example.test', subject: '지급확인서 서명 및 회신 요청', mailKey: 'mk1' };
const RULES = [{ id: 'r-test', org: '가나다복지협회', senders: ['rule@example.test'], subjectAny: ['지급확인서'], attachAll: ['지급확인서', '동의서'], kind: '개인정보 동의서' }];
const NAME = '지급확인서 및 동의서(교육).hwpx';
function withRules(w) { w.ctx.set('sendq_rules', RULES); return w; }

test('알던 양식 → «발송 대기» · 채운 파일이 보관되고 확인 칸이 다 찬다', async () => {
  const w = withRules(world());
  const r = await w.ctx.sqProcess(await hwpx(), NAME, META);
  assert.equal(r.action, 'queue');
  const it = w.items()[0];
  assert.equal(it.status, 'pending'); assert.equal(it.replyTo, 'rule@example.test'); assert.ok(it.fileId && it.origId);
  const out = await JSZip.loadAsync(Buffer.from(w.files.get(it.fileId).base64, 'base64'));
  const x = await out.file('Contents/section0.xml').async('string');
  assert.equal((x.match(/■ 동의/g) || []).length, 2); assert.match(x, /확 {3}인 : 가나다/); assert.match(x, /binaryItemIDRef="image\d+"/);
  assert.ok(Object.keys(out.files).some((n) => /BinData\/image\d+\.png/.test(n)), '도장 그림이 실렸다');
  assert.equal(Object.keys(out.files)[0], 'mimetype', 'mimetype 이 맨 앞이어야 한글이 연다');
  const orig = await JSZip.loadAsync(Buffer.from(w.files.get(it.origId).base64, 'base64'));
  assert.ok(!/■ 동의/.test(await orig.file('Contents/section0.xml').async('string')), '원본은 채우지 않은 그대로');
});
test('양식이 바뀌었으면 → «확인 필요» · 채우지 않는다', async () => {
  const w = withRules(world());
  const r = await w.ctx.sqProcess(await hwpx({ third: true }), NAME, META);
  assert.equal(r.action, 'review');
  const it = w.items()[0]; assert.equal(it.status, 'review'); assert.ok(it.reasons.length); assert.equal(it.fileId, '', '채운 파일이 없다');
});
test('다른 기관 + 같은 양식 → 확인 필요 + «이 기관도» 권유 → 누르면 규칙에 더해져 대기로 올라간다', async () => {
  const w = withRules(world());
  const r = await w.ctx.sqProcess(await hwpx(), NAME, Object.assign({}, META, { from: 'other@example.test', mailKey: 'mk2' }));
  assert.equal(r.action, 'review');
  let it = w.items()[0]; assert.equal(it.learn.type, 'addSender');
  await w.ctx.sqLearn(it.id);
  it = w.items()[0]; assert.equal(it.status, 'pending');
  assert.ok(w.ctx.get('sendq_rules')[0].senders.indexOf('other@example.test') >= 0);
});
test('★ 처음 쓸 때 — 기본 규칙(보낸 곳 없음)만 있어도: 확인 필요 + «이 기관도» → 누르면 기관 이름과 함께 대기로', async () => {
  const w = world();   /* sendq_rules 를 안 넣었다 = 기본 규칙 */
  const r = await w.ctx.sqProcess(await hwpx(), NAME, Object.assign({}, META, { org: '가나다복지협회' }));
  assert.equal(r.action, 'review');
  let it = w.items()[0]; assert.equal(it.org, '가나다복지협회'); assert.equal(it.learn.type, 'addSender');
  await w.ctx.sqLearn(it.id);
  it = w.items()[0]; assert.equal(it.status, 'pending'); assert.equal(it.org, '가나다복지협회');
  assert.deepEqual(w.ctx.get('sendq_rules')[0].senders, ['rule@example.test']);
  w.ctx.sqRender();
  assert.match(w.el.sqBand.innerHTML, /가나다복지협회/);
});
test('같은 메일을 또 넣으면 중복 — 두 줄이 되지 않는다', async () => {
  const w = withRules(world());
  await w.ctx.sqProcess(await hwpx(), NAME, META);
  const r = await w.ctx.sqProcess(await hwpx(), NAME, META);
  assert.equal(r.action, 'dup'); assert.equal(w.items().length, 1);
});
test('도장·성명이 없으면 반쯤 채우지 않고 확인 필요', async () => {
  for (const [o, 까닭] of [[{ noStamp: true }, /도장/], [{ noName: true }, /성명/]]) {
    const w = withRules(world(o));
    const r = await w.ctx.sqProcess(await hwpx(), NAME, META);
    assert.equal(r.action, 'review', JSON.stringify(o)); assert.equal(w.items()[0].fileId, '');
    assert.match(w.items()[0].reasons[0], 까닭, '무엇이 모자란지 알려 준다');
  }
});
test('이 PC 에 담지 못하면 던진다 — «올렸다»고 하지 않는다', async () => {
  const w = withRules(world({ saveFails: true }));
  await assert.rejects(async () => w.ctx.sqProcess(await hwpx(), NAME, META), /담지 못했습니다/);
  assert.equal(w.items().length, 0);
});

test('★ 보내기 — 한 번 누르면: 임시 자리 올림 → 서버 호출(로그인 열쇠) → 보냄 표시 → 저장 서류에 기록', async () => {
  const w = withRules(world());
  await w.ctx.sqProcess(await hwpx(), NAME, META);
  const id = w.items()[0].id;
  await w.ctx.sqSend(id);
  assert.equal(w.uploads.length, 1); assert.match(w.uploads[0].p, /^pucards\/mailout\/u1\//);
  assert.equal(w.sent.length, 1); assert.equal(w.sent[0].auth, 'Bearer tok');
  assert.equal(w.sent[0].body.to, 'rule@example.test'); assert.match(w.sent[0].body.subject, /^RE: /); assert.equal(w.sent[0].body.files[0].path, w.uploads[0].p);
  const it = w.items()[0]; assert.equal(it.status, 'sent'); assert.ok(it.sentAt && it.recordId);
  const rec = w.feedoc()[0];
  assert.equal(rec.id, it.recordId); assert.equal(rec.kind, '개인정보 동의서'); assert.equal(rec.submits[0].method, '메일'); assert.ok(rec.genFileId && rec.origFileId);
});
test('★ 두 번 눌러도 한 통 — 이미 보낸 것은 다시 못 보낸다', async () => {
  const w = withRules(world());
  await w.ctx.sqProcess(await hwpx(), NAME, META);
  const id = w.items()[0].id;
  await w.ctx.sqSend(id); await w.ctx.sqSend(id);
  assert.equal(w.sent.length, 1); assert.equal(w.feedoc().length, 1);
});
test('보내기가 서버에서 거절되면 «대기»에 그대로 남고 기록도 안 남는다', async () => {
  const w = withRules(world({ mailFails: true }));
  await w.ctx.sqProcess(await hwpx(), NAME, META);
  await w.ctx.sqSend(w.items()[0].id);
  assert.equal(w.items()[0].status, 'pending'); assert.equal(w.feedoc().length, 0);
  assert.ok(w.toasts.some((t) => /보내지 못했습니다/.test(t) && /서버 거절/.test(t)));
});
test('서버가 첨부를 못 붙였으면(files=0) 크게 알린다 — 그냥 성공이라 하지 않는다', async () => {
  const w = withRules(world({ noFiles: true }));
  await w.ctx.sqProcess(await hwpx(), NAME, META);
  await w.ctx.sqSend(w.items()[0].id);
  assert.ok(w.toasts.some((t) => /첨부가 빠졌을 수 있습니다/.test(t)));
  assert.ok(!w.toasts.some((t) => /답장을 보냈습니다/.test(t)));
});
test('확인 필요 건은 보내기 단추가 없고, 눌러도 안 나간다', async () => {
  const w = withRules(world());
  await w.ctx.sqProcess(await hwpx({ third: true }), NAME, META);
  w.ctx.sqRender();
  assert.ok(!/sqSend\(/.test(w.el.sqBand.innerHTML), '확인 필요 카드에는 보내기 단추가 없다');
  await w.ctx.sqSend(w.items()[0].id);
  assert.equal(w.sent.length, 0);
});
test('띠 그리기 — 대기 카드에 받는 곳·금액·답장 단추 · 개인정보는 이스케이프', async () => {
  const w = withRules(world());
  await w.ctx.sqProcess(await hwpx(), NAME, Object.assign({}, META, { subject: '<b>지급확인서</b>' }));
  w.ctx.sqRender();
  const h = w.el.sqBand.innerHTML;
  assert.match(h, /발송 대기 1건/); assert.match(h, /rule@example\.test/); assert.match(h, /답장 보내기/); assert.match(h, /100000원|100,000원|강사비/);
  assert.ok(!/<b>지급확인서<\/b>/.test(h), '메일 제목의 태그가 그대로 들어가면 안 된다');
  assert.match(h, /&lt;b&gt;지급확인서&lt;\/b&gt;/, '대신 글자로 보인다');
});
