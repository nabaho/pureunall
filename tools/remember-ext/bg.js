/* 푸른 리멤버 연결 — 확장의 시계 (2026-10-24, 대표 「반드시 자동으로」)
   30분마다: ① 받는 화면(푸른) 탭을 찾거나 연다 → 지난번 기준(cp)을 묻는다
              ② 리멤버 탭을 찾거나 열고 새로 고친다 → 기준 뒤에 바뀐 명함을 받는다
              ③ 앞면 그림을 받아(리멤버 그림 창고만) 받는 화면에 건넨다 → 사진첩·기업정보함에 담긴다
   ⚠ 리멤버 로그인이 풀렸으면 받는 화면에 알리고(빨간 띠) 그 회차는 쉰다.
   ⚠ 두 탭은 «고정 탭»으로 연다 — 대표가 닫으면 다음 회차에 다시 연다. */
'use strict';
var REM_HOME = 'https://card.rememberapp.co.kr/book/groups';
var INTAKE = 'https://nabaho.github.io/pureunall/remember-intake.html';
var EVERY_MIN = 30;
var IMG_OK = /^https:\/\/remember-cdn\.rememberapp\.co\.kr\/[^\s"'<>]+$/;
var IMG_MAX = 4 * 1024 * 1024;
var running = false;

function arm() { chrome.alarms.create('pull', { periodInMinutes: EVERY_MIN, delayInMinutes: 1 }); }
chrome.runtime.onInstalled.addListener(arm);
chrome.runtime.onStartup.addListener(arm);
chrome.alarms.onAlarm.addListener(function (a) { if (a.name === 'pull') run(); });

function sleep(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
async function findOrOpen(prefix, url) {
  var all = await chrome.tabs.query({});
  var hit = all.find(function (t) { return t.url && t.url.indexOf(prefix) === 0; });
  if (hit) return hit;
  return chrome.tabs.create({ url: url, pinned: true, active: false });
}
async function waitLoaded(id, ms) {
  var t0 = Date.now();
  while (Date.now() - t0 < ms) {
    var t = await chrome.tabs.get(id).catch(function () { return null; });
    if (!t) return null;
    if (t.status === 'complete') return t;
    await sleep(500);
  }
  return chrome.tabs.get(id).catch(function () { return null; });
}
async function ask(id, msg, tries) {
  for (var i = 0; i < (tries || 1); i++) {
    try { var r = await chrome.tabs.sendMessage(id, msg); if (r) return r; } catch (e) { /* 다리가 아직 안 깔림 */ }
    await sleep(2000);
  }
  return null;
}
function b64(buf) {
  var s = '', b = new Uint8Array(buf);
  for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function image(url) {
  if (!IMG_OK.test(url || '')) return '';
  try {
    var r = await fetch(url);
    if (!r.ok) return '';
    var ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(ct)) return '';
    var buf = await r.arrayBuffer();
    if (buf.byteLength > IMG_MAX) return '';
    return 'data:' + ct + ';base64,' + b64(buf);
  } catch (e) { return ''; }
}

async function run() {
  if (running) return;
  running = true;
  try {
    /* ① 받는 화면 */
    var it = await findOrOpen(INTAKE, INTAKE);
    await waitLoaded(it.id, 60000);
    var hello = await ask(it.id, { cmd: 'hello' }, 10);
    if (!hello || !hello.ready) return;               /* 푸른 로그인 전 — 받는 화면이 빨간 띠로 알린다 */
    var cp = Number(hello.cp) || 0;
    /* ② 리멤버 */
    var rt = await findOrOpen('https://card.rememberapp.co.kr/', REM_HOME);
    await chrome.tabs.update(rt.id, { url: REM_HOME });
    var t = await waitLoaded(rt.id, 60000);
    if (!t || !/^https:\/\/card\.rememberapp\.co\.kr\//.test(t.url || '')) { await ask(it.id, { cmd: 'login-lost' }); return; }
    var res = await ask(rt.id, { cmd: 'pull', cp: cp }, 10);
    if (!res || res.err) { if (res && (res.err === 'login' || res.err === 'no-heads')) await ask(it.id, { cmd: 'login-lost' }); return; }
    /* ③ 그림 — 이번에 새로 다룰 것만(기준 뒤) */
    var images = {};
    if (cp) {
      for (var i = 0; i < res.stacks.length; i++) {
        var st = res.stacks[i];
        if ((Date.parse(st.updated_at) || 0) <= cp) continue;
        var f = st.main_card && st.main_card.image && st.main_card.image.front;
        if (f && !f.empty) { var d = await image(f.original || f.preview); if (d) images[st.id] = d; }
      }
    }
    await ask(it.id, { cmd: 'batch', stacks: res.stacks, images: images, total: res.total });
  } finally { running = false; }
}
