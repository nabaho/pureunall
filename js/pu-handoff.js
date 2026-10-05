/* ══════════════════════════════════════════════════════════════════════════
   앱과 앱 사이로 «파일 한 개»를 건네는 통로 — PuHandoff (2026-10-05)
   ══════════════════════════════════════════════════════════════════════════
   대표 지시 「메일함에 들어오는 사업자등록증·명함·계약서를 자동으로 사진첩으로
   가져와 판독하고 기업정보함으로 보낼 수 없나」의 1걸음.

   ★ 왜 이런 것이 필요한가
     메일 첨부는 기업정보함(pu-cards.html) 화면에서 손에 쥔다. 그런데 그것을 받을
     사진첩은 «다른 쪽»(pu-photos.html)이다. 주소줄로는 파일을 못 건넨다.

   ★ 왜 서버를 안 거치나
     ① 첨부는 이미 브라우저 손에 있다 — 서버로 올렸다 다시 받으면 같은 것을 두 번
        실어 나르고 요금도 두 번 든다.
     ② 서버에 두면 «누가 지우나»가 생긴다. 여기 것은 받는 쪽이 가져가며 지우고,
        안 가져가도 반나절이면 스스로 삭는다.
     ③ 창고 규칙·사진첩 정보 모양을 서버가 또 알 필요가 없다 — 받는 쪽이 제 길로
        담는다(사진첩의 addFiles 그대로). 한 벌을 두 벌로 만들지 않는다.

   ★ 무엇을 지키나
     · 같은 기기 · 같은 브라우저 안에서만 오간다(IndexedDB). 서버에 안 간다.
     · 열쇠는 한 번만 쓴다 — 가져가면 지운다(뒤로가기로 두 번 담기지 않는다).
     · 반나절(12시간) 지난 것은 열 때 스스로 치운다.
     · 담는 크기에 한도를 둔다 — 메일 첨부 한도(25MB)와 같은 잣대.

   쓰는 법
     보내는 쪽: PuHandoff.put({ name, type, bytes }).then(k => 주소에 ?take=k)
     받는 쪽:   PuHandoff.take(k).then(file => addFiles([file], true))
   ══════════════════════════════════════════════════════════════════════════ */
(function (글로벌) {
  'use strict';

  var DB = 'pu-handoff';
  var 칸 = 'files';
  var 최대 = 25 * 1024 * 1024;          /* 25MB — 메일 첨부 한도와 같은 잣대 */
  var 목숨 = 12 * 60 * 60 * 1000;       /* 반나절 */

  function 열기() {
    return new Promise(function (풀림, 막힘) {
      if (!글로벌.indexedDB) { 막힘(new Error('이 브라우저에서는 앱 사이로 파일을 건넬 수 없습니다')); return; }
      var req = 글로벌.indexedDB.open(DB, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(칸)) d.createObjectStore(칸, { keyPath: 'k' });
      };
      req.onsuccess = function () { 풀림(req.result); };
      req.onerror = function () { 막힘(req.error || new Error('임시 보관함을 열지 못했습니다')); };
    });
  }

  function 한번(d, 모드, 일) {
    return new Promise(function (풀림, 막힘) {
      var t = d.transaction(칸, 모드);
      var s = t.objectStore(칸);
      var 결과;
      try { 결과 = 일(s); } catch (e) { 막힘(e); return; }
      t.oncomplete = function () { 풀림(결과 && 결과.result !== undefined ? 결과.result : 결과); };
      t.onerror = function () { 막힘(t.error || new Error('임시 보관함 쓰기에 실패했습니다')); };
    });
  }

  /* 오래 묵은 것 치우기 — 열 때마다 조용히 한 번 */
  function 쓸기(d) {
    return 한번(d, 'readwrite', function (s) {
      var cur = s.openCursor();
      cur.onsuccess = function () {
        var c = cur.result;
        if (!c) return;
        var v = c.value || {};
        if (!v.at || Date.now() - v.at > 목숨) c.delete();
        c.continue();
      };
    }).catch(function () { /* 치우다 실패해도 본 일은 계속한다 */ });
  }

  function 열쇠짓기() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* 보내는 쪽 — 파일을 담고 «열쇠»를 돌려준다 */
  function put(파일) {
    파일 = 파일 || {};
    var bytes = 파일.bytes;
    if (!bytes) return Promise.reject(new Error('건넬 내용이 없습니다'));
    var len = bytes.byteLength !== undefined ? bytes.byteLength : (bytes.size || bytes.length || 0);
    if (len > 최대) {
      return Promise.reject(new Error('너무 큽니다(' + Math.round(len / 1048576) + 'MB) — 내려받아 사진첩에 직접 올려 주세요'));
    }
    var 열쇠 = 열쇠짓기();
    return 열기().then(function (d) {
      return 쓸기(d).then(function () {
        return 한번(d, 'readwrite', function (s) {
          s.put({
            k: 열쇠, at: Date.now(),
            name: String(파일.name || '첨부'),
            type: String(파일.type || 'application/octet-stream'),
            bytes: bytes,
            from: String(파일.from || ''),       /* 어디서 왔는지 — 받는 쪽이 안내에 쓴다 */
          });
        }).then(function () { return 열쇠; });
      });
    });
  }

  /* 받는 쪽 — 꺼내면서 «지운다». 없으면 null (두 번 담기지 않게) */
  function take(열쇠) {
    열쇠 = String(열쇠 || '');
    if (!열쇠) return Promise.resolve(null);
    return 열기().then(function (d) {
      return 한번(d, 'readonly', function (s) { return s.get(열쇠); }).then(function (v) {
        if (!v) return null;
        return 한번(d, 'readwrite', function (s) { s.delete(열쇠); }).then(function () {
          if (Date.now() - (v.at || 0) > 목숨) return null;     /* 묵은 것은 없는 것으로 */
          var 파일;
          try {
            파일 = new File([v.bytes], v.name, { type: v.type });
          } catch (e) {
            /* File 을 못 만드는 옛 브라우저 — Blob 에 이름만 붙여 준다 */
            파일 = new Blob([v.bytes], { type: v.type });
            try { 파일.name = v.name; } catch (_) { /* 읽기 전용이면 그대로 */ }
          }
          return { file: 파일, name: v.name, type: v.type, from: v.from || '' };
        });
      });
    });
  }

  글로벌.PuHandoff = { put: put, take: take, 최대: 최대, 목숨: 목숨 };
})(typeof window !== 'undefined' ? window : globalThis);
