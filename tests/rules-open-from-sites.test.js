'use strict';
/* 🏢 사업장에서 «바로» 검토·개정으로 — rules.html 의 #open= · #co= (③-ⓐⓑ Task 4, 2026-10-04)
   ─────────────────────────────────────────────────────────────────────────
   rules-v2.html 의 🏢 사업장 화면이 두 길로 이 화면을 부른다.
     · rules.html#open=<자료 id>(&nf=1)  — 메일에서 원본 첨부를 받아 «지문이 같을 때만» 연다,
                                           이은 업체가 있으면 사업장 이름·사업자번호가 정해진 채로
     · rules.html#co=<업체 id>           — 다음에 올리는 파일에 그 사업장을 미리 정해 둔다

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 머리줄 갈래 단추가 rules-v2.html 과 «같은 차례»로 넷 다 있고, 여기서는 ✏️ 가 켜져 있다
     ② 원본 받기 모듈(mail-orig.js)을 캐시 번호를 붙여 싣는다
     ③ loadFile 이 둘째 인자의 사업장·사업자번호를 «본문 인식보다 먼저» 쓴다 — 없으면 옛날 그대로
     ④ #open= 은 원본 받기가 «성공했을 때만» 파일을 연다 — 지문이 틀린 첨부를 원본으로 여는 길을 막는다
     ⑤ #co= 의 미리 정한 사업장은 «한 번만» 쓰이고 비워진다 — 다음 파일까지 따라가면 남의 회사로 저장된다
   ⚠ 함수 몸을 잘라 vm 상자에서 «실제로 돌려» 본다 — 글자 찾기로는 갈림의 차례를 못 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const HTML = stripComments(R('rules.html'));

/* 이름으로 함수 하나를 «통째로» 자른다 — 중괄호 짝으로 끝을 찾는다 */
function cutFn(src, head) {
  const at = src.indexOf(head);
  assert.ok(at > -1, '★★ rules.html 에 ' + head + ' 가 없다');
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(head + ' 의 끝을 못 찾았다');
}

/* ── ① 갈래 단추 ── */
function 단추(src) {
  const m = src.match(/<nav class="rmode"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(m, '★★ 머리줄에 갈래 단추(nav.rmode)가 없다');
  return [...m[1].matchAll(/<a\b([^>]*)>/g)].map((x) => ({
    href: (x[1].match(/href="([^"]+)"/) || [])[1],
    title: (x[1].match(/title="([^"]+)"/) || [])[1],
    on: /class="[^"]*\bon\b/.test(x[1])
  }));
}
test('①★★ 갈래 단추가 rules-v2.html 과 같은 차례·주소·설명이고, ✏️ 검토·개정이 켜져 있다', () => {
  const a = 단추(HTML), b = 단추(stripComments(R('rules-v2.html')));
  assert.ok(a.some((l) => l.href === 'rules-v2.html#sites'), '★★ 🏢 사업장 단추가 없다');
  assert.deepEqual(a.map((l) => [l.href, l.title]), b.map((l) => [l.href, l.title]),
    '★★ 두 화면의 단추 차례·주소가 다르다');
  assert.deepEqual(a.filter((l) => l.on).map((l) => l.href), ['rules.html']);
});

/* ── ② 모듈 싣기 ── */
test('②★ 원본 받기 모듈을 캐시 번호를 붙여 싣는다', () => {
  assert.match(HTML, /<script src="js\/rules-v2\/mail-orig\.js\?v=\d+"><\/script>/);
});

/* ── ③ loadFile 을 실제로 돌린다 ── */
function loadFileBox(extra) {
  const box = {
    SAMPLES: {}, CMT_BY: {}, READ_VIA: {}, SITE_MAP: {}, SITE_BIZNO: {}, SITE_FILE: {}, SITE_NAME: {},
    PDF_URLS: {}, HWP_BUFS: {}, upSeq: 0, CMT_CUT: 0, READ_LAST: '', LJ_LEFT: 0, LAST_UPLOAD: null,
    PENDING_CO: null, TextDecoder, console: { warn() {}, info() {}, log() {} },
    confirmSwitchDoc: () => true,
    detectSiteName: () => '본문에서찾은회사',
    lineJoinMarks: () => [], lineJoinCount: () => ({}), lineJoinApply: (t) => t, ljStd: () => ({}),
    siteSel: { value: '', options: [], appendChild(o) { this.options.push(o); } },
    document: { createElement: () => ({}), getElementById: () => null },
    saveWorkFromUpload() {}, resetReviewUI() {}, renderPreview: async () => {},
    autoSaveArchive() {}, showUploadUndo() {}, alert(m) { throw new Error('alert: ' + m); }
  };
  Object.assign(box, extra || {});
  vm.createContext(box);
  vm.runInContext(cutFn(HTML, 'async function loadFile('), box);
  return box;
}
const 글파일 = (n) => ({ name: n || '규칙.txt', arrayBuffer: async () => new TextEncoder().encode('제1조(목적) 이 규칙은 근로조건을 정한다.').buffer });

test('③★★ loadFile 이 넘겨받은 사업장·사업자번호를 본문 인식보다 먼저 쓴다', async () => {
  const box = loadFileBox();
  const key = await box.loadFile(글파일(), { site: '가나상사', bizno: '123-45-67890' });
  assert.ok(key, '★ 성공해도 열쇠를 돌려주지 않는다 — 부르는 쪽이 «열렸는지»를 모른다');
  assert.equal(box.SITE_NAME[key], '가나상사');
  assert.equal(box.SITE_BIZNO[key], '123-45-67890');
  assert.match(box.SITE_MAP[key], /가나상사/);
});

test('③★ 둘째 인자가 없으면 옛날 그대로 — 본문에서 찾은 이름, 사업자번호 빈칸', async () => {
  const box = loadFileBox();
  const key = await box.loadFile(글파일());
  assert.equal(box.SITE_NAME[key], '본문에서찾은회사');
  assert.equal(box.SITE_BIZNO[key], '');
});

/* ── ⑤ 미리 정한 사업장은 한 번만 ── */
test('⑤★★ #co= 로 미리 정한 사업장은 다음 파일 «하나»에만 쓰이고 비워진다', async () => {
  const box = loadFileBox({ PENDING_CO: { site: '나다물산', bizno: '220-81-12345' } });
  const k1 = await box.loadFile(글파일('첫째.txt'));
  assert.equal(box.SITE_NAME[k1], '나다물산');
  assert.equal(box.SITE_BIZNO[k1], '220-81-12345');
  assert.equal(box.PENDING_CO, null, '★★ 쓰고 나서도 남아 있다 — 다음 파일이 남의 회사로 저장된다');
  const k2 = await box.loadFile(글파일('둘째.txt'));
  assert.equal(box.SITE_NAME[k2], '본문에서찾은회사');
  assert.equal(box.SITE_BIZNO[k2], '');
});

test('⑤★ 「다른 문서로 바꿀까요」에서 취소하면 미리 정한 사업장이 남는다', async () => {
  const box = loadFileBox({ PENDING_CO: { site: '나다물산', bizno: '' }, confirmSwitchDoc: () => false });
  await box.loadFile(글파일());
  assert.deepEqual(box.PENDING_CO && box.PENDING_CO.site, '나다물산');
});

/* ── ④ #open= 을 실제로 돌린다 ── */
function openBox(o) {
  const calls = { load: [], alert: [], replace: 0, notFinal: 0, fetched: 0 };
  const db = {
    'rules_mgmt/library/docs/D1': o.doc === undefined ? { name: '취업규칙.hwp', sha: 'ab', mail: { src: 'imap', box: 'b', key: '1' } } : o.doc,
    'rules_mgmt/library/human/D1': o.human === undefined ? { companyId: 'C7', companyLinkStatus: 'linked' } : o.human
  };
  const box = {
    FBUSER: { uid: 'u' }, ERP_COS: [{ id: 'C6', name: '다른회사', bizNo: '1' }, { id: 'C7', name: '가나상사', bizNo: '123-45-67890' }],
    FBDB: { ref: (p) => ({ once: async () => ({ val: () => (db[p] === undefined ? null : db[p]) }) }) },
    MAIL_FN_BASE: 'https://함수.test/', window: {}, fetch() {}, File: class { constructor(parts, name) { this.parts = parts; this.name = name; } },
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 't' } }) },
    PuRulesMailOrig: {
      makeCall: (o) => { calls.made = o; return () => {}; }, sha256Hex() {},
      fetchOriginal: async (a) => { calls.fetched++; calls.doc = a.doc; return o.got || { ok: true, name: '취업규칙.hwp', bytes: new Uint8Array([1]) }; }
    },
    location: { pathname: '/rules.html', search: '' },
    history: { replaceState() { calls.replace++; } },
    setTimeout: (f) => setImmediate(f),
    console: { warn() {}, info() {}, log() {} },
    libNote() {}, showNotFinalNote() { calls.notFinal++; },
    loadFile: async (f, opts) => { calls.load.push({ f, opts }); return 'U1'; },
    alert: (m) => calls.alert.push(m)
  };
  vm.createContext(box);
  vm.runInContext(cutFn(HTML, 'function libWait(') + '\n' + cutFn(HTML, 'async function openFromLibrary('), box);
  return { box, calls };
}

test('④★★ 원본 받기가 실패하면 파일을 열지 않고, 까닭을 알리고, 주소를 비운다', async () => {
  const { box, calls } = openBox({ got: { ok: false, why: '메일의 첨부가 모은 때와 다릅니다' } });
  await box.openFromLibrary('#open=D1');
  assert.equal(calls.fetched, 1);
  assert.equal(calls.load.length, 0, '★★ 지문이 틀린 첨부를 원본으로 열었다');
  assert.deepEqual(calls.alert, ['메일의 첨부가 모은 때와 다릅니다']);
  assert.ok(calls.replace >= 1, '★ 주소를 안 비웠다 — 새로고침하면 또 받는다');
});

test('④★★ 성공하면 이은 업체(id 로 찾은 것)의 이름·사업자번호로 연다', async () => {
  const { box, calls } = openBox({});
  await box.openFromLibrary('#open=D1');
  assert.equal(calls.load.length, 1);
  assert.equal(calls.load[0].f.name, '취업규칙.hwp');
  assert.deepEqual({ ...calls.load[0].opts }, { site: '가나상사', bizno: '123-45-67890' });
  assert.equal(calls.doc.sha, 'ab', '★ 모은 자료의 지문을 넘기지 않았다');
  assert.equal(calls.made.base, box.MAIL_FN_BASE, '★ 서버 함수 주소를 넘기지 않았다');
  assert.equal(typeof calls.made.getToken, 'function', '★ 로그인 토큰을 실어 보내지 않는다');
  assert.equal(calls.notFinal, 0);
  assert.ok(calls.replace >= 1);
});

test('④★ 최종본이 아니면(&nf=1) 연 뒤에 그렇다고 한 줄 알린다', async () => {
  const { box, calls } = openBox({});
  await box.openFromLibrary('#open=D1&nf=1');
  assert.equal(calls.load.length, 1);
  assert.equal(calls.notFinal, 1);
});

test('④★★ 업체가 «확정 안 된» 자료는 사업장을 정하지 않고 연다 — 이름으로 맞추지 않는다', async () => {
  const { box, calls } = openBox({ human: { companyId: 'C7', companyLinkStatus: 'candidate' } });
  await box.openFromLibrary('#open=D1');
  assert.equal(calls.load.length, 1);
  const o = calls.load[0].opts || {};
  assert.ok(!o.site && !o.bizno, '★★ 확정 안 된 업체를 사업장으로 정했다');
});

test('④★ 모은 자료에 없는 id 면 열지 않고 다시 열 곳을 알린다', async () => {
  const { box, calls } = openBox({ doc: null });
  await box.openFromLibrary('#open=D1');
  assert.equal(calls.fetched, 0);
  assert.equal(calls.load.length, 0);
  assert.deepEqual(calls.alert, ['그 자료를 찾지 못했습니다 — 📥 모은 자료에서 다시 열어 주세요.']);
  assert.ok(calls.replace >= 1);
});

test('④ #open= 이 아니면 아무것도 안 한다', async () => {
  const { box, calls } = openBox({});
  await box.openFromLibrary('#rev=x');
  assert.equal(calls.fetched + calls.load.length + calls.alert.length + calls.replace, 0);
});

/* ── #co= 를 실제로 돌린다 ── */
test('⑤★★ #co= 는 업체를 id 로 찾아 다음 파일에 쓸 사업장을 정하고 주소를 비운다', async () => {
  let replaced = 0;
  const box = {
    FBUSER: { uid: 'u' }, PENDING_CO: null,
    ERP_COS: [{ id: 'C6', name: '다른회사', bizNo: '1' }, { id: 'C7', name: '가나상사', bizNo: '123-45-67890' }],
    location: { pathname: '/rules.html', search: '' },
    history: { replaceState() { replaced++; } },
    setTimeout: (f) => setImmediate(f), libNote() {}, alert() {}, console: { warn() {} }, escapeH: (x) => x
  };
  vm.createContext(box);
  vm.runInContext(cutFn(HTML, 'function libWait(') + '\n' + cutFn(HTML, 'async function presetCoFromHash('), box);
  await box.presetCoFromHash('#co=C7');
  assert.deepEqual({ ...box.PENDING_CO }, { site: '가나상사', bizno: '123-45-67890' });
  assert.ok(replaced >= 1, '★ 주소를 안 비웠다');
  box.PENDING_CO = null;
  await box.presetCoFromHash('#co=없는id');
  assert.equal(box.PENDING_CO, null, '★★ 없는 업체인데 사업장을 정했다');
});

/* ── 손잡이가 달렸는가 — 처음 열 때와 주소가 바뀔 때 ── */
test('⑥★ #open= · #co= 는 처음 열 때와 hashchange 에 모두 불린다', () => {
  assert.match(HTML, /addEventListener\("hashchange",[\s\S]{0,160}?openFromLibrary/);
  assert.match(HTML, /addEventListener\("hashchange",[\s\S]{0,160}?presetCoFromHash/);
  assert.match(HTML, /\n\s*openFromLibrary\(location\.hash\)/);
  assert.match(HTML, /\n\s*presetCoFromHash\(location\.hash\)/);
});
