'use strict';
/* 사진첩 — 옛 서류 원본 주소 지우기 단추 (대표 결정 2026-10-07 「지운다」)
   9/27 «전» 서류 847장에 만료 없는 원본 주소(fullUrl)가 남아 있었다. 서버 도구(photoSensitiveSweep)는
   있었는데 누를 단추가 없었다.

   못 박는 것(규칙):
   ① 세어 보기 «먼저» — 지우기 단추는 세어 본 직후에만, 센 장수를 달고 뜬다
   ② 지우기는 확인을 받는다 · 세지 않았거나 0장이면 서버를 안 부른다
   ③ 총괄관리자 카드에만 — 평소엔 숨김(서버도 requirePhotoAdmin)
   ④ 부르는 주소가 서버 함수의 실제 자리(지역·이름)와 같다 · 로그인 토큰을 붙인다
   ⑤ 서버는 원본 주소 한 칸만 지운다(미리보기는 남긴다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const pv = require(path.join(R, 'functions', 'photo-view.js'));
function body(s, head) {
  const i = s.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
/* 서버 함수 덩어리 — 다음 exports 까지(runWith({…}) 의 괄호에 걸리지 않게 글자로 자른다) */
const sweepFn = (() => { const a = fnSrc.indexOf('exports.photoSensitiveSweep'); assert.ok(a > 0); return fnSrc.slice(a, fnSrc.indexOf('\nexports.', a + 10)); })();
const line = (re) => { const m = re.exec(html); assert.ok(m, '못 찾음: ' + re); return m[0]; };

function world(reply, ok) {
  const els = { docSweepOut: { textContent: '' }, docSweepClear: { textContent: '', style: { display: 'none' } } };
  const calls = [];
  const c = {
    JSON, Object, String, Error,
    READ_LABEL: { card: '명함', bizreg: '사업자등록증' },
    $: (id) => els[id],
    confirm: () => ok !== false,
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('tok') } }) },
    fetch: (url, opt) => { calls.push({ url, opt }); return Promise.resolve({ ok: true, json: () => Promise.resolve(reply(JSON.parse(opt.body))) }); },
  };
  vm.createContext(c);
  vm.runInContext([line(/const SWEEP_URL = [^\n]+/), 'let docSweepFound = 0;',
    body(html, 'function docSweepKinds('), body(html, 'async function runDocUrlSweep(')].join('\n'), c);
  c.__els = els; c.__calls = calls;
  return c;
}
const scanReply = (b) => (b.mode === 'clear'
  ? { ok: true, mode: 'clear', cleared: 3, byKind: { doc: 2, bizreg: 1 } }
  : { ok: true, mode: 'scan', found: 3, byKind: { doc: 2, bizreg: 1 } });

test('①★ 세어 본 뒤에만 지우기 단추가 «센 장수»를 달고 뜬다', async () => {
  assert.match(html, /id="docSweepClear" style="display:none/, '세기 전에는 지우기 단추가 화면에 없다');
  const w = world(scanReply);
  await w.runDocUrlSweep('scan');
  assert.equal(JSON.parse(w.__calls[0].opt.body).mode, 'scan');
  assert.equal(w.__els.docSweepClear.style.display, 'block');
  assert.match(w.__els.docSweepClear.textContent, /3장/);
  assert.match(w.__els.docSweepOut.textContent, /사업자등록증 1장/);
  assert.match(w.__els.docSweepOut.textContent, /판독 전 서류 2장/);
});
test('②★ 세지 않고 지우기를 누르면 서버를 안 부른다', async () => {
  const w = world(scanReply);
  await w.runDocUrlSweep('clear');
  assert.equal(w.__calls.length, 0);
});
test('②★ 확인에서 «아니오»면 안 지운다 · «예»면 clear 를 보내고 단추를 거둔다', async () => {
  const no = world(scanReply, false);
  await no.runDocUrlSweep('scan');
  await no.runDocUrlSweep('clear');
  assert.equal(no.__calls.length, 1, '확인을 안 받고 지우면 안 된다');
  const yes = world(scanReply, true);
  await yes.runDocUrlSweep('scan');
  await yes.runDocUrlSweep('clear');
  assert.equal(JSON.parse(yes.__calls[1].opt.body).mode, 'clear');
  assert.match(yes.__els.docSweepOut.textContent, /3장을 지웠습니다/);
  assert.equal(yes.__els.docSweepClear.style.display, 'none');
  await yes.runDocUrlSweep('clear');
  assert.equal(yes.__calls.length, 2, '지운 뒤 같은 단추로 또 지우지 않는다 — 다시 세어야 한다');
});
test('② 0장이면 지우기 단추를 안 띄운다', async () => {
  const w = world(() => ({ ok: true, mode: 'scan', found: 0, byKind: {} }));
  await w.runDocUrlSweep('scan');
  assert.equal(w.__els.docSweepClear.style.display, 'none');
});
test('③ 총괄관리자 카드에만 — 평소엔 숨기고 관리자 조건으로만 띄운다', () => {
  assert.match(html, /<div class="card" id="docUrlSweep" style="display:none">/);
  assert.match(body(html, 'function renderSetCards('), /\$\('docUrlSweep'\)[\s\S]*?migAllowed \? 'block' : 'none'/);
  assert.match(sweepFn, /requirePhotoAdmin\(req\)/);
});
test('④ 부르는 주소가 서버 함수의 실제 자리와 같고, 로그인 토큰을 붙인다', async () => {
  const region = /const MAIL_REGION = "([^"]+)"/.exec(fnSrc)[1];
  assert.match(sweepFn, /\.region\(MAIL_REGION\)/);
  const w = world(scanReply);
  await w.runDocUrlSweep('scan');
  assert.equal(w.__calls[0].url, 'https://' + region + '-pureun-erp.cloudfunctions.net/photoSensitiveSweep');
  assert.equal(w.__calls[0].opt.headers.Authorization, 'Bearer tok');
});
test('⑤ 서버는 원본 주소 한 칸만 지운다 — 미리보기는 남긴다 · 판독 전 서류도 찾는다', () => {
  const tree = { u: { U1: { items: { 2026: {
    a: { kind: 'doc', fullUrl: 'https://x/a', thumbUrl: 'https://x/a_t' },
    b: { kind: 'photo', fullUrl: 'https://x/b' },
    c: { kind: 'doc', thumbUrl: 'https://x/c_t' },
  } } } } };
  const hits = pv.sweep(tree);
  assert.deepEqual(hits.map((h) => h.id), ['a'], '회의 사진(kind photo)·이미 지운 서류는 안 건드린다');
  assert.deepEqual(Object.keys(pv.clearPaths(hits, 'puphotos')), ['puphotos/u/U1/items/2026/a/fullUrl']);
});
/* ⑥ 서버를 «실제로» 돌려 본다 — 가짜 DB 로 (2026-10-09 대표 「세어 보기」 → Failed to fetch)
   뿌리(puphotos)를 통째로 읽다 메모리 512MB 를 넘겨 함수가 죽었다. 뿌리에는 열람 기록 같은 큰 묶음이 함께 있다. */
function server(data, opt) {
  opt = opt || {};
  const reads = [];
  let handler = null;
  const chain = { region: () => chain, runWith: () => chain, https: { onRequest: (fn) => { handler = fn; return fn; } } };
  const db = {
    ref: (p) => ({
      once: async () => { reads.push(p || '/'); if (opt.failRead && p !== 'puphotos/owners') throw new Error('읽기 실패'); return { val: () => (p in data ? data[p] : null) }; },
      toString: () => 'https://db.example/' + p,
      update: async (u) => { reads.push('update:' + Object.keys(u).length); },
    }),
  };
  const c = {
    exports: {}, functions: chain, MAIL_REGION: 'asia-northeast3', PHOTOS_DB_ROOT: 'puphotos', PV: pv,
    setCors() {}, requirePhotoAdmin: async () => ({}), getDatabase: () => db,
    getApps: () => [{ options: { credential: { getAccessToken: async () => ({ access_token: 't' }) } } }],
    fetch: async (url) => { reads.push('shallow:' + url); return opt.shallow ? { ok: true, json: async () => opt.shallow } : { ok: false, status: 401 }; },
    console: { log() {}, warn() {}, error() {} }, Set, Array, Object, String, Error, JSON,
    require: () => ({}),   // 덩어리 끝(다음 exports 앞)에 딸려 오는 require 줄 — 이 검사와 상관없다
  };
  vm.createContext(c);
  vm.runInContext(body(fnSrc, 'async function photoOwnerIds(') + '\n' + sweepFn, c);
  async function call(mode) {
    let st = 200, out = null;
    const res = { status(s) { st = s; return res; }, json(j) { out = j; return res; }, send() { return res; } };
    await handler({ method: 'POST', body: { mode } }, res);
    return { st, out };
  }
  return { call, reads };
}
const 사진 = {
  'puphotos/owners': { U1: { name: '가' }, U2: { name: '나' } },
  'puphotos/u/U1/items': { 2026: { a: { kind: 'doc', fullUrl: 'https://x/a' }, b: { kind: 'photo', fullUrl: 'https://x/b' } } },
  'puphotos/u/U2/items': { 2025: { c: { kind: 'doc', fullUrl: 'https://x/c' } } },
  'puphotos/u/U3/items': { 2026: { d: { kind: 'doc', fullUrl: 'https://x/d' } } },
};
test('⑥★ 뿌리를 통째로 읽지 않는다 — 주인별 사진 항목만 나눠 읽는다', async () => {
  const s = server(사진);
  const r = await s.call('scan');
  assert.equal(r.st, 200);
  assert.equal(r.out.found, 2);
  assert.ok(!s.reads.includes('puphotos') && !s.reads.includes('puphotos/u'), '★ 뿌리·사진 칸 통째 읽기 — 열람 기록까지 받아 메모리를 넘긴다: ' + s.reads.join(','));
  assert.ok(s.reads.every((p) => /^(puphotos\/owners|puphotos\/u\/[^/]+\/items|shallow:.*|update:\d+)$/.test(p)), s.reads.join(','));
});
test('⑥ 주인 색인에 빠진 주인도 얕은 열쇠 읽기로 찾는다 · 지우기도 같은 대상', async () => {
  const s = server(사진, { shallow: { U1: true, U3: true } });
  const r = await s.call('scan');
  assert.equal(r.out.found, 3, '색인에 없는 U3 의 서류를 놓쳤다');
  assert.ok(s.reads.some((p) => /^shallow:https:\/\/db\.example\/puphotos\/u\.json\?shallow=true$/.test(p)));
  const c = await s.call('clear');
  assert.equal(c.out.cleared, 3);
});
test('⑥ 읽다 실패하면 죽지 않고 까닭을 답한다(화면에 「Failed to fetch」만 뜨지 않게)', async () => {
  const s = server(사진, { failRead: true });
  const r = await s.call('scan');
  assert.equal(r.st, 500);
  assert.match(r.out.error, /사진 목록을 읽지 못했습니다/);
});
