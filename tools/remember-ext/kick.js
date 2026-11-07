/* 푸른 리멤버 연결 — «깨우기» 화면 (2026-11-07, 대표 「앞으로 중단 안되게」)
   PC 예약 작업(sync-ext.js)이 ① 회차가 늦었을 때 ② 새 판을 깔았을 때 이 화면을 연다.
   ① 일꾼(bg.js)에게 kick 을 보낸다 — 새 판 일꾼이면 판 번호로 답하고 그 자리에서 한 번 돈다.
   ② 답이 없거나(옛 판·멈춘 일꾼) 디스크 판과 다르면 확장을 «다시 시작»한다 — 1분 뒤 회차가 돌게 맞춰 둔다.
      (11/5 처럼 알람이 사라져 일꾼이 안 깨어나도, 확장 화면은 디스크에서 바로 열리므로 이 길은 늘 산다)
   ③ 이 탭은 스스로 닫는다 — 다시 시작하면 확장 화면은 크롬이 저절로 닫는다. */
'use strict';
function diskVer() {
  return fetch('ver.js', { cache: 'no-store' }).then(function (r) { return r.text(); })
    .then(function (t) { return (/DISK_VER\s*=\s*'([^']*)'/.exec(t) || [])[1] || ''; })
    .catch(function () { return ''; });
}
function askWorker() {
  return new Promise(function (ok) {
    var done = false;
    var end = function (r) { if (!done) { done = true; ok(r || null); } };
    setTimeout(function () { end(null); }, 3000);
    try {
      chrome.runtime.sendMessage({ cmd: 'kick' }, function (r) { void chrome.runtime.lastError; end(r); });
    } catch (e) { end(null); }
  });
}
function closeMe() { chrome.tabs.getCurrent(function (t) { if (t) chrome.tabs.remove(t.id); }); }
Promise.all([askWorker(), diskVer()]).then(function (got) {
  var r = got[0], v = got[1];
  if (r && r.ver && r.ver === v) { setTimeout(closeMe, 1000); return; }
  chrome.alarms.create('pull', { delayInMinutes: 1 });
  chrome.runtime.reload();
});
