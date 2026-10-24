/* 푸른 리멤버 연결 — 리멤버 탭의 «다리»(격리 공간). 확장 ↔ 화면 안 조각(hook.js) 사이에 말을 옮긴다 */
(function () {
  'use strict';
  var HOOK = 'pu-rem-hook', RELAY = 'pu-rem-relay';
  var wait = {}, seq = 0;
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var m = ev.data;
    if (!m || m.__from !== HOOK || m.__to !== RELAY || m.cmd !== 'cards') return;
    var cb = wait[m.seq]; if (!cb) return;
    delete wait[m.seq]; cb(m);
  });
  chrome.runtime.onMessage.addListener(function (msg, sender, send) {
    if (!msg || msg.cmd !== 'pull') return false;
    var id = ++seq;
    var timer = setTimeout(function () { if (wait[id]) { delete wait[id]; send({ err: 'timeout' }); } }, 120000);
    wait[id] = function (m) { clearTimeout(timer); send({ stacks: m.stacks || [], total: m.total || 0, err: m.err || null }); };
    window.postMessage({ __from: RELAY, __to: HOOK, cmd: 'pull', cp: msg.cp || 0, seq: id }, location.origin);
    return true;      /* 답은 나중에 */
  });
})();
