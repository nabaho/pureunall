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
/* 툴바 아이콘을 누르면 지금 바로 한 번 돈다 · 글자 띠(뱃지)로 «어디까지 갔는지» 보인다 */
chrome.action.onClicked.addListener(function () { run(); });
function note(badge, why) {
  var at = new Date().toLocaleString('ko-KR');
  chrome.action.setBadgeText({ text: badge });
  chrome.action.setBadgeBackgroundColor({ color: /^(OK|\.\.)$/.test(badge) ? '#2e7d32' : '#c62828' });
  chrome.action.setTitle({ title: '푸른 리멤버 연결 — ' + (why || badge) + ' · ' + at + ' (눌러서 지금 돌리기)' });
}

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

/* 회차가 «어디까지 갔는지» 받는 화면이 pucards/remember/trace 에 적는다(단계·짧은 사유뿐 — 명함 내용 없음) */
async function trace(itId, step, why) { if (itId) await ask(itId, { cmd: 'trace', step: step, why: String(why || '').slice(0, 120) }); }

async function run() {
  if (running) return;
  running = true;
  note('..', '도는 중');
  var itId = 0;
  try {
    /* ① 받는 화면 */
    var it = await findOrOpen(INTAKE, INTAKE);
    itId = it.id;
    await waitLoaded(it.id, 60000);
    var hello = await ask(it.id, { cmd: 'hello' }, 10);
    if (!hello) {                                              /* 확장을 새로고침하면 열려 있던 탭의 다리가 끊긴다 — 탭을 새로 불러 한 번 더 */
      await chrome.tabs.reload(it.id).catch(function () {});
      await waitLoaded(it.id, 60000);
      hello = await ask(it.id, { cmd: 'hello' }, 10);
    }
    if (!hello || !hello.ready) { note('로그인', '푸른 포털 로그인 필요(받는 화면 탭 확인)'); return; }               /* 푸른 로그인 전 — 받는 화면이 빨간 띠로 알린다 */
    var cp = Number(hello.cp) || 0;
    await trace(itId, '1 받는 화면 확인', 'cp=' + cp);
    /* ② 리멤버 */
    var rt = await findOrOpen('https://card.rememberapp.co.kr/', REM_HOME);
    await chrome.tabs.update(rt.id, { url: REM_HOME });
    var t = await waitLoaded(rt.id, 60000);
    await trace(itId, '2 리멤버 탭', (t && t.status) + ' ' + String((t && t.url) || '').replace(/[?#].*$/, ''));
    if (!t || !/^https:\/\/card\.rememberapp\.co\.kr\//.test(t.url || '')) { await ask(it.id, { cmd: 'login-lost' }); note('리멤버', '리멤버 로그인 필요'); return; }
    var res = await ask(rt.id, { cmd: 'pull', cp: cp }, 10);
    if (!res) {                                                /* 리멤버 탭 다리가 없다 — 새로 불러 한 번 더 */
      await chrome.tabs.reload(rt.id).catch(function () {});
      await waitLoaded(rt.id, 60000);
      res = await ask(rt.id, { cmd: 'pull', cp: cp }, 10);
    }
    await trace(itId, '3 목록 받기', !res ? '응답 없음(리멤버 탭 다리 없음)' : res.err ? 'err=' + res.err : (res.stacks.length + '장'));
    if (!res || res.err) {
      var lost = res && (res.err === 'login' || res.err === 'no-heads');
      if (lost) await ask(it.id, { cmd: 'login-lost' });
      note(lost ? '리멤버' : '!', lost ? '리멤버 로그인 필요' : '리멤버 목록 못 받음: ' + (res && res.err ? res.err : '응답 없음'));
      return;
    }
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
    var done = await ask(it.id, { cmd: 'batch', stacks: res.stacks, images: images, total: res.total });
    await trace(itId, '4 batch 끝', done ? (done.err ? 'err=' + done.err : 'ok') : '받는 화면 답 없음');
    note(done ? 'OK' : '!', done ? '지난 회차 끝 · 받은 ' + res.stacks.length + '장' : '받는 화면이 답이 없음');
  } catch (e) {
    await trace(itId, '! 오류', (e && e.message) || e).catch(function () {});
    note('!', '오류: ' + String((e && e.message) || e).slice(0, 80));
  } finally { running = false; }
}
