/* 취업규칙(새) — 메일에서 «원본» 첨부 받기 (설계 §4 · 2026-10-04)
   서버(functions/mail-sync.js)의 기존 함수만 부른다 — readMailMessage·readMailAttachment(IMAP) / readOldMail(POP3).
   ⚠ 받은 바이트의 sha256 이 «모을 때 적어 둔 지문(doc.sha)» 과 같을 때만 돌려준다.
     같은 이름의 다른 첨부(메일이 고쳐졌거나 같은 이름이 둘)를 원본으로 착각해 여는 것을 막는 단 하나의 관문이다.
   부르는 쪽: PuRulesMailOrig.fetchOriginal({doc, call: makeCall({...}), sha256: sha256Hex}) */
(function (root) {
  'use strict';
  var HINT = ' (📥 에서 가린 파일을 받거나 메일함에서 직접 여세요)';
  var DASH = ' — 📥 에서 가린 파일을 받거나 메일함에서 직접 여세요';

  // 서버 호출 한 벌 — POST base+fn · Bearer 토큰 · ok 가 true 가 아니면 status 를 실어 던진다
  function makeCall(o) {
    return async function call(fn, body) {
      var tok = await o.getToken();
      var res = await o.fetch(o.base + fn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify(body || {})
      });
      var j = null;
      try { j = await res.json(); } catch (e) { j = null; }
      if (!j || j.ok !== true) {
        var err = new Error((j && j.error) || '서버가 거절했습니다');
        err.status = res.status;
        throw err;
      }
      return j;
    };
  }

  // base64 → 바이트 (화면은 atob, 노드는 Buffer)
  function b64ToBytes(b64) {
    if (typeof atob === 'function') {
      var bin = atob(b64), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  // 바이트 → 소문자 hex 지문
  async function sha256Hex(bytes) {
    var buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2);
    return s;
  }

  function fail(why) { return { ok: false, why: why }; }

  async function fetchOriginal(o) {
    var doc = o.doc || {}, call = o.call, sha256 = o.sha256;
    var mail = doc.mail || {};
    var want = String(doc.sha || '').toLowerCase();
    if (!want) return fail('원본 지문이 없어 확인할 수 없습니다' + DASH);
    var imap = mail.src === 'imap';
    var key = String(mail.key);
    try {
      // 1) 메일의 첨부 목록
      // ⚠ peek:true — 열어 보기만 한다. 고객 메일을 «읽음»(Seen·r=1)으로 바꾸지 않는다(서버: peek 이면 아무것도 안 건드림, 첨부 목록은 그대로 온다)
      var head = imap ? await call('readMailMessage', { slug: mail.box, uid: key, peek: true })
                      : await call('readOldMail', { key: key });
      var same = (head.atts || []).map(function (a, idx) {
        return { i: a.i == null ? idx : a.i, part: a.part || '', name: a.name };
      }).filter(function (a) { return a.name === doc.name; });
      if (!same.length) return fail('메일에 그 첨부가 없습니다' + DASH);
      // 2) 같은 이름을 차례로 받아 지문이 맞는 것만 돌려준다
      for (var n = 0; n < same.length; n++) {
        var a = same[n];
        var got = imap ? await call('readMailAttachment', { slug: mail.box, uid: key, index: a.i, part: a.part })
                       : await call('readOldMail', { key: key, index: a.i });
        if (!got || !got.b64) continue;
        var bytes = b64ToBytes(got.b64);
        if ((await sha256(bytes)).toLowerCase() === want) return { ok: true, name: doc.name, bytes: bytes };
      }
      return fail('메일의 첨부가 모은 때와 다릅니다' + DASH);
    } catch (e) {
      return fail('메일에서 원본을 못 받았습니다 — ' + ((e && e.message) || e) + HINT);
    }
  }

  var api = { fetchOriginal: fetchOriginal, makeCall: makeCall, b64ToBytes: b64ToBytes, sha256Hex: sha256Hex };
  if (root) root.PuRulesMailOrig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
