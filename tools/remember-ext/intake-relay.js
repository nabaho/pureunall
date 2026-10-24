/* 푸른 리멤버 연결 — 받는 화면(remember-intake.html)의 «다리». 확장 ↔ 받는 화면 사이에 말을 옮긴다 */
(function () {
  'use strict';
  var EXT = 'pu-remember-ext', PAGE = 'pu-remember-intake';
  var wait = null;
  window.addEventListener('message', function (ev) {
    if (ev.source !== window || ev.origin !== location.origin) return;
    var m = ev.data;
    if (!m || m.__from !== PAGE || m.__to !== EXT) return;
    if (wait && wait.cmd === m.cmd) { var cb = wait.cb; wait = null; cb(m); }
  });
  chrome.runtime.onMessage.addListener(function (msg, sender, send) {
    if (!msg || !msg.cmd) return false;
    var expect = msg.cmd === 'hello' ? 'cp' : msg.cmd === 'batch' ? 'done' : null;
    var out = Object.assign({ __from: EXT, __to: PAGE }, msg);
    if (!expect) { window.postMessage(out, location.origin); send({ ok: true }); return false; }
    var timer = setTimeout(function () { if (wait) { wait = null; send({ err: 'timeout' }); } }, msg.cmd === 'batch' ? 600000 : 30000);
    wait = { cmd: expect, cb: function (m) { clearTimeout(timer); send(m); } };
    window.postMessage(out, location.origin);
    return true;
  });
})();
