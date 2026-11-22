'use strict';
/* 강의자료 원본은 «열 때마다 권한 확인» — 토큰 주소를 만들지 않는다 (2026-11-22)
 *
 * ■ 왜 이 검사가 있나
 *   토큰 주소(getDownloadURL)는 로그인 없이 열리는 주소다 — 문서관리 서명본·사진첩 서류처럼 강의자료 원본도 그 주소를 쓰지 않는다.
 *   지금 로그인한 사람의 증표를 머리글에 실어 창고에 직접 묻는다 — 창고 규칙(재직 직원)을 매번 거친다.
 *
 * ■ 못 박는 규칙
 *   ① 화면 코드는 토큰 주소를 만들지도(getDownloadURL), 쓰지도(token=) 않는다
 *   ② 원본 요청은 «Authorization: Firebase <증표>» 머리글을 싣고, 주소에는 토큰이 없다 · 쿠키·리퍼러를 안 보낸다
 *   ③ 권한이 없으면(401·403) 권한 문구로 실패한다 — 다른 길(토큰 주소)로 몰래 다시 받지 않는다
 *   ④ 칸을 닫으면 그 칸이 받던 것만 멈춘다 · 내려받기는 창을 닫아도 끝까지 받는다
 *   ⑤ 내려받기는 받은 바이트를 이 창의 blob: 주소로 저장한다(새 탭에 창고 주소를 띄우지 않는다)
 *   ⑥ 큰 영상·소리는 «받아서 보기»를 눌러야 받는다(자세히만 열어도 큰 파일이 내려오지 않게)
 *   ⑦ 토큰 지우기 스크립트는 edulib/ 자리만, 그 열쇠 하나만, 기본은 «보기만»
 * node --test tests/edulib-auth-open.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const APP = read('js/pu-edulib-app.js');
const REV = require(path.join(ROOT, 'scripts/edulib-revoke-download-tokens.js'));

/* 원본 가져오기 묶음(«원본 가져오기» ~ «보기 칸» 머리 사이)을 가짜 세상에 올린다 */
function loadFetchBlock(fakeFetch) {
  const a = APP.indexOf('/* ───────── 원본 가져오기');
  const b = APP.indexOf('/* ───────── 보기 칸');
  assert.ok(a > 0 && b > a, '원본 가져오기 묶음을 못 찾았습니다');
  const toasts = [];
  const clicks = [];
  const ctx = {
    console, Promise, JSON, Math, Date, String, Number, Array, Object, Error, setTimeout: () => 0, clearTimeout,
    encodeURIComponent, AbortController, Response, ReadableStream, Uint8Array,
    BUCKET: 'gs://b-x', bucket: {}, K: { fmtBytes: (n) => n + 'B' }, PuViewerKind: { MAX_BYTES: 1e12 },
    MB_FN: 'https://fn.invalid/',
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('ID-TOKEN') } }) },
    toast: (m) => toasts.push(m), errMsg: (e) => String((e && e.message) || e),
    URL: { createObjectURL: () => 'blob:local/1', revokeObjectURL: () => {} },
    document: { createElement: () => { const el = { click() { clicks.push({ href: el.href, download: el.download, target: el.target }); }, remove() {} }; return el; }, body: { appendChild() {} } },
    fetch: fakeFetch,
  };
  vm.createContext(ctx);
  vm.runInContext(APP.slice(a, b) + '\nthis.__t = { fetchOriginal, stopFetches, downloadOriginal, bytesOf, apiUrlOf, get FETCHES() { return FETCHES; } };', ctx);
  return { t: ctx.__t, toasts, clicks };
}
const CLOUD = { id: 'e1', store: 'cloud', storagePath: 'edulib/e1/강의 자료.pdf', fileName: '강의 자료.pdf', size: 3, kind: 'doc' };

test('① 화면 코드는 토큰 주소를 만들지도 쓰지도 않는다', () => {
  assert.doesNotMatch(APP, /getDownloadURL/, '토큰 주소를 만들면 안 됩니다 — 한 번 새면 누구나 평생 엽니다');
  assert.doesNotMatch(APP, /[?&]token=/, '토큰 주소를 쓰면 안 됩니다');
  ['pu-edulib.html', 'js/pu-edulib-core.js', 'js/pu-edulib-classify.js', 'js/pu-edulib-preview.js'].forEach((f) => {
    assert.doesNotMatch(read(f), /getDownloadURL|[?&]token=/, f + ' 에 토큰 주소가 있습니다');
  });
});

test('② 원본 요청 — 증표 머리글을 싣고, 주소엔 토큰이 없고, 쿠키·리퍼러를 안 보낸다', async () => {
  const seen = [];
  const { t } = loadFetchBlock((url, opt) => { seen.push({ url, opt }); return Promise.resolve(new Response(new Uint8Array([1, 2, 3]))); });
  const buf = await t.bytesOf(CLOUD);
  assert.equal(buf.byteLength, 3);
  assert.equal(seen.length, 1);
  const { url, opt } = seen[0];
  assert.match(url, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/b-x\/o\/[^?]+\?alt=media$/, '창고 이름·경로만 담은 주소여야 합니다');
  assert.ok(url.includes(encodeURIComponent(CLOUD.storagePath)), '경로를 통째로 인코딩해야 합니다(/ 포함)');
  assert.doesNotMatch(url, /token/i);
  assert.equal(opt.headers.Authorization, 'Firebase ID-TOKEN', '지금 로그인한 사람의 증표를 실어야 합니다');
  assert.equal(opt.credentials, 'omit');
  assert.equal(opt.referrerPolicy, 'no-referrer');
  assert.equal(opt.cache, 'no-store');
  assert.equal(t.FETCHES.length, 0, '다 받으면 받는 중 목록에서 빠져야 합니다');
});

test('③ 권한이 없으면 권한 문구로 실패 — 다른 길로 다시 받지 않는다', async () => {
  for (const st of [401, 403]) {
    let n = 0;
    const { t } = loadFetchBlock(() => { n++; return Promise.resolve(new Response('no', { status: st })); });
    await assert.rejects(t.bytesOf(CLOUD), /권한/);
    assert.equal(n, 1, '한 번만 묻고 끝나야 합니다(' + st + ')');
  }
  const { t } = loadFetchBlock(() => Promise.resolve(new Response('', { status: 404 })));
  await assert.rejects(t.bytesOf(CLOUD), /원본이 없습니다/);
  const none = loadFetchBlock(() => { throw new Error('부르면 안 됩니다'); });
  await assert.rejects(none.t.bytesOf({ id: 'p', store: 'pc', fileName: 'a.pdf' }), /원본이 없습니다/, '창고에 없는 것은 묻지도 않는다');
});

test('④ 칸을 닫으면 그 칸이 받던 것만 멈춘다 · 내려받기는 끝까지', async () => {
  const pending = [];
  const { t } = loadFetchBlock((url, opt) => new Promise((res, rej) => {
    pending.push({ res, opt });
    opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
  }));
  const paneA = { id: 'A' }, paneB = { id: 'B' };
  const root = { contains: (x) => x === paneA };
  const pA = t.fetchOriginal(CLOUD, 'buf', null, paneA);
  const pB = t.fetchOriginal(CLOUD, 'buf', null, paneB);
  const pDl = t.fetchOriginal(CLOUD, 'blob', null, null);
  await new Promise((r) => setImmediate(r));
  assert.equal(t.FETCHES.length, 3);
  t.stopFetches(root);
  await assert.rejects(pA, /멈췄습니다/);
  assert.equal(t.FETCHES.length, 2, '닫은 칸의 것만 빠져야 합니다');
  pending.forEach((p) => { if (!p.opt.signal.aborted) p.res(new Response(new Uint8Array([9]))); });
  assert.equal((await pB).byteLength, 1, '다른 칸은 그대로 받아야 합니다');
  assert.ok(await pDl, '내려받기(칸 없음)는 칸을 닫아도 끝까지 받아야 합니다');
  assert.equal(t.FETCHES.length, 0);
});

test('⑤ 내려받기 — blob: 주소로 저장하고 새 탭에 창고 주소를 띄우지 않는다 · 두 번 눌러도 한 번', async () => {
  let n = 0;
  const { t, clicks, toasts } = loadFetchBlock(() => { n++; return Promise.resolve(new Response(new Uint8Array([1, 2, 3]))); });
  const btn = { textContent: '⬇ 원본', disabled: false };
  t.downloadOriginal(CLOUD, btn);
  t.downloadOriginal(CLOUD, btn);
  assert.equal(btn.disabled, true, '받는 동안 단추를 막아야 합니다');
  for (let i = 0; i < 20 && !clicks.length; i++) await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(n, 1, '받는 중에 또 누르면 다시 받지 않아야 합니다');
  assert.equal(clicks.length, 1);
  assert.match(clicks[0].href, /^blob:/, '받은 바이트(blob:)로 저장해야 합니다');
  assert.equal(clicks[0].download, CLOUD.fileName);
  assert.ok(!clicks[0].target, '새 탭을 열지 않아야 합니다');
  assert.equal(btn.disabled, false, '끝나면 단추를 되돌려야 합니다');
  assert.equal(btn.textContent, '⬇ 원본');
  assert.ok(toasts.some((m) => /이미 받는 중/.test(m)));
});

test('⑥ 화면 이음 — 칸 닫기가 받기를 멈추고, 큰 영상은 눌러야 받고, 두 내려받기 단추가 같은 길', () => {
  const cf = APP.slice(APP.indexOf('function closeFrames('), APP.indexOf('function closeFrames(') + 200);
  assert.match(cf, /stopFetches\(root\)/, '칸을 닫으면 받던 것을 멈춰야 합니다');
  const fp = APP.slice(APP.indexOf('function fillPane('), APP.indexOf('function pickLocal('));
  assert.match(fp, /MEDIA_AUTO_MAX/, '큰 영상·소리 기준이 있어야 합니다');
  assert.match(fp, /data-load/, '큰 것은 «받아서 보기»를 눌러야 받습니다');
  assert.match(fp, /fetchOriginal\(it, 'blob'[^)]*\)?[\s\S]*?pane\)/, '영상·그림도 권한 확인 길로 받고 그 칸에 묶어야 합니다');
  assert.match(fp, /bytesOf\(it,[\s\S]*?pane\)/, '문서 미리보기도 그 칸에 묶어야 합니다');
  assert.match(APP, /data-act="dl"[\s\S]*downloadOriginal\(it, b\)/);
  assert.match(APP, /id === 'dDl'\) downloadOriginal\(ITEMS\[DETAIL\], e\.target\)/);
  assert.ok(/var MEDIA_AUTO_MAX = (\d+) \* 1024 \* 1024/.test(APP) && +RegExp.$1 > 0, '기준은 양수 MB');
});

test('⑦ 토큰 지우기 스크립트 — edulib/ 자리만, 그 열쇠 하나만, 기본은 보기만', () => {
  assert.equal(REV.PREFIX, 'edulib/');
  assert.ok(REV.isEdulibObject('edulib/e1/강의.pdf'));
  ['puphotos/u/a/b.jpg', 'edulib', 'edulib/e1', 'edulibx/a/b.pdf', 'edulib/../puphotos/x', '', null].forEach((n) =>
    assert.ok(!REV.isEdulibObject(n), '손대면 안 되는 자리: ' + n));
  assert.ok(REV.needsRevoke({ name: 'edulib/e1/a.pdf', metadata: { [REV.KEY]: 't1', originalName: 'a.pdf' } }));
  assert.ok(!REV.needsRevoke({ name: 'edulib/e1/a.pdf', metadata: { originalName: 'a.pdf' } }), '토큰이 없으면 손대지 않는다');
  assert.ok(!REV.needsRevoke({ name: 'puphotos/u/a/b.jpg', metadata: { [REV.KEY]: 't1' } }), '다른 앱 파일은 토큰이 있어도 손대지 않는다');
  assert.deepEqual(REV.patchBody(), { metadata: { [REV.KEY]: null } }, '그 열쇠 하나만 지운다(다른 메타데이터·내용은 그대로)');
  assert.match(REV.patchUrl({ name: 'edulib/e1/a b.pdf', metageneration: '3' }), /\/o\/edulib%2Fe1%2Fa%20b\.pdf\?ifMetagenerationMatch=3/, '그 사이 바뀐 파일은 건너뛰어야 합니다');
  assert.match(REV.listUrl(''), /prefix=edulib%2F/);
  const src = read('scripts/edulib-revoke-download-tokens.js');
  const main = src.slice(src.indexOf('async function main('));
  assert.ok(main.indexOf("includes('--apply')") >= 0, '--apply 를 줘야만 바꾼다');
  assert.ok(main.indexOf('if (!apply)') < main.indexOf("method: 'PATCH'"), '보기만일 때는 PATCH 앞에서 끝나야 합니다');
  src.split('\n').filter((l) => /console\.(log|error)/.test(l)).forEach((l) =>
    assert.doesNotMatch(l, /metadata|KEY\]/, '토큰 값을 출력하면 안 됩니다: ' + l.trim()));
});
