/* 카톡 업무방 정리 — 화면(work.html)과 서버(functions/index.js)가 «같이» 쓰는 셈 (2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-09 「카카오톡으로 대화를 많이 하는데 매번 보고 정리가 안 된다 …
   카톡에 내용 올린 담당자들의 업무도 모두 자동 정리하고 싶다」

   ■ 어디서 오나
     권형하 휴대폰의 하나문자 앱(android/hana-sms-bridge)이 카톡 «알림»을 읽어 보낸다.
     ⚠ PC 카톡은 안 된다 — 2026-10-09 시험: PC 카톡(26.8)은 윈도우 알림 장치를 안 쓰고
       자기 창으로 팝업을 띄운다. 윈도우 알림 기록에 카톡이 아예 없었다.
     ⚠ 카톡 프로그램을 조종하거나 긁지 않는다 — docs/카톡수집기-검토.md (약관·읽음처리·개인정보).

   ■ 지키는 것
     · «정해 둔 방 이름»과 정확히 같은 방만 받는다(KAKAO_ROOMS). 목록이 비면 아무것도 안 받는다.
       목록 없이 켜면 개인 대화가 통째로 서버로 간다(메모리 kakao-arrival-notification-only).
     · 주민번호·카드번호·계좌처럼 보이는 숫자는 폰에서 한 번, 서버에서 또 한 번 가린다(maskSensitive).
     · 「누가 원래 보냈나」는 «짐작»이다 — 카톡 «전달»은 원래 보낸 사람을 안 싣는다.
       확실한 것은 직원이 붙인 「[전달] 업체명 담당자」 한 줄뿐이다(classify 의 'mark').
       짐작으로 업체 id 를 채우지 않는다(CLAUDE.md 온톨로지 — 이름으로 잇지 않는다).

   ⚠ 고칠 곳은 이 파일 하나다. 서버 사본은 `node scripts/sync-kakao-lib.js` 로 옮긴다
     (functions/ 배포에는 js/ 가 안 올라간다). 둘이 다르면 tests/kakao-work.test.js 가 걸린다.
   ⚠ 폰(KakaoNotice.java)의 가리개는 이 파일과 «같은 잣대»여야 한다 — 같은 검사가 견준다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuKakaoWork = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 알림 글은 이만큼만 받는다 — 카톡 알림 미리보기는 대개 이보다 짧다. */
  var TEXT_MAX = 2000;
  /* 원래 알림 글을 서버에 두는 날 수 — 직원 안내문(2026-10-09)에 「30일 뒤 지운다」고 적었다. */
  var KEEP_DAYS = 30;
  /* 같은 직원이 이 안에 잇달아 올린 글·사진은 «한 건»으로 묶는다 — 전달은 글+사진 여러 개로 쪼개져 온다. */
  var BURST_MS = 2 * 60 * 1000;

  /* ── 가리개 ───────────────────────────────────────────────────────────
     ⚠ 전화번호(010-1111-2222, 02-123-4567)는 «안» 가린다 — 업무 연락에 꼭 필요하고,
       계좌처럼 생긴 것과는 앞자리(0)로 가른다.
     ⚠ 폰 KakaoNotice.java 에 같은 식이 «글자 그대로» 있다. 고치면 둘 다 고친다. */
  var RRN_RE = /\d{6}\s*-\s*[1-8]\d{6}/g;
  var CARD_RE = /\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}/g;
  var ACCOUNT_RE = /\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,6})?/g;
  var PHONE_RE = /^0\d{1,2}-\d{3,4}-\d{4}$/;

  function maskSensitive(text) {
    var s = String(text == null ? '' : text);
    s = s.replace(RRN_RE, '●●●●●●-●●●●●●●');
    s = s.replace(CARD_RE, '●●●●-●●●●-●●●●-●●●●');
    s = s.replace(ACCOUNT_RE, function (m) {
      if (PHONE_RE.test(m)) return m;
      var digits = m.replace(/\D/g, '').length;
      return digits >= 10 ? '●●●-계좌-●●●' : m;
    });
    return s;
  }

  /* 방 이름 견주기 — 앞뒤 빈칸과 겹친 빈칸만 정리한다. 그 밖에는 «정확히» 같아야 한다
     (「천성」과 「천성가축약품」 — 비슷한 이름이 다른 곳이다). */
  function normRoom(name) {
    return String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
  }

  function roomAllowed(rooms, room) {
    var r = normRoom(room);
    if (!r || !rooms) return false;
    for (var i = 0; i < rooms.length; i++) if (normRoom(rooms[i]) === r) return true;
    return false;
  }

  /* 한 줄의 영구 열쇠 재료 — 같은 알림이 고쳐져 또 와도(카톡은 알림을 덧쌓아 다시 띄운다)
     같은 글이면 같은 열쇠가 된다. 해시는 서버가 친다(sha256). */
  function noteKeySource(room, sender, sentAt, text) {
    return [normRoom(room), String(sender || '').trim(), String(Number(sentAt) || 0), String(text || '')].join('\u0001');
  }

  /* ── 갈래 나누기 ───────────────────────────────────────────────────────
     mark   : 「[전달] 가나상사 임꺽정 과장」 — 직원이 붙인 한 줄. 확실하다.
     guess  : 글 끝 서명(배상·드림·올림)이나 「노무사님」 말투 — 전달로 보인다. 짐작이다.
     own    : 그 밖 — 직원이 직접 쓴 글로 본다.
     media  : 「사진을 보냈습니다」류 — 알맹이가 없다. 사실만 남긴다. */
  var MARK_RE = /^\s*\[\s*전달\s*\]\s*(.*)$/;
  var SIGN_RE = /([^\n]{2,40}?)\s*(배상|드림|올림)\s*\.?\s*$/;
  var ASK_RE = /노무사님|대표님께|법인\s*담당자님/;
  var MEDIA_RE = /^(사진|동영상|파일|이모티콘|음성메시지)(을|를)?\s*보냈습니다\.?$|^사진\s*\d+장을\s*보냈습니다\.?$/;

  function classify(text) {
    var s = String(text == null ? '' : text).trim();
    var m = MARK_RE.exec(s.split('\n')[0]);
    if (m) return { kind: 'mark', origin: m[1].trim(), sure: true };
    if (MEDIA_RE.test(s)) return { kind: 'media', origin: '', sure: false };
    var sign = SIGN_RE.exec(s);
    if (sign) return { kind: 'guess', origin: (sign[1] + ' ' + sign[2]).trim(), sure: false };
    if (ASK_RE.test(s)) return { kind: 'guess', origin: '', sure: false };
    return { kind: 'own', origin: '', sure: false };
  }

  /* 같은 방·같은 직원이 BURST_MS 안에 잇달아 올린 것을 «한 건»으로 묶는다.
     ★ 「[전달] …」 한 줄은 그 바로 뒤 글들의 «원래 보낸 곳»이 된다 — 그 줄 자체는 내용이 아니다.
     ⚠ 묶음의 갈래는 «가장 확실한 것»을 따른다: mark > guess > own. 사진만 있으면 media. */
  function groupBursts(notes) {
    var list = (notes || []).slice().sort(function (a, b) { return (Number(a.sentAt) || 0) - (Number(b.sentAt) || 0); });
    var out = [], cur = null;
    var rank = { mark: 3, guess: 2, own: 1, media: 0 };
    list.forEach(function (n) {
      var c = classify(n.text);
      var t = Number(n.sentAt) || 0;
      var same = cur && cur.room === normRoom(n.room) && cur.sender === String(n.sender || '') && t - cur.lastAt <= BURST_MS;
      if (!same) {
        cur = { room: normRoom(n.room), sender: String(n.sender || ''), firstAt: t, lastAt: t,
                ids: [], texts: [], media: 0, kind: 'media', origin: '', sure: false };
        out.push(cur);
      }
      cur.lastAt = t;
      cur.ids.push(n.id);
      if (c.kind === 'media') cur.media += mediaCount(n.text);
      else {
        /* 「[전달] …」 줄은 내용 대신 원래 보낸 곳으로만 쓴다 — 그 줄 밑에 글이 붙어 있으면 그 글은 내용이다. */
        var body = c.kind === 'mark' ? String(n.text).split('\n').slice(1).join('\n').trim() : String(n.text || '').trim();
        if (body) cur.texts.push(body);
      }
      if (rank[c.kind] > rank[cur.kind]) { cur.kind = c.kind; cur.origin = c.origin; cur.sure = c.sure; }
      else if (c.kind === cur.kind && !cur.origin && c.origin) cur.origin = c.origin;
    });
    out.forEach(function (g) {
      /* 글이 하나라도 있는데 갈래가 media 로 남았으면 직원 글이다(사진+설명). */
      if (g.kind === 'media' && g.texts.length) g.kind = 'own';
    });
    return out;
  }

  function mediaCount(text) {
    var m = /사진\s*(\d+)장/.exec(String(text || ''));
    return m ? Number(m[1]) : 1;
  }

  /* 기한 찾기 — 「10월 16일까지」「10/16까지」「16일까지」. 못 찾으면 '' (지어내지 않는다).
     now 를 받는다 — 해를 넘길 때(12월에 「1월 5일까지」) 다음 해로 친다. */
  function findDue(text, now) {
    var s = String(text || '');
    var base = now ? new Date(now) : new Date();
    var y = base.getFullYear(), mo = null, d = null;
    var m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:까지|이전|전까지|마감)/.exec(s) ||
            /(\d{1,2})\s*[./]\s*(\d{1,2})\s*(?:\([^)]*\)\s*)?(?:까지|마감)/.exec(s);
    if (m) { mo = Number(m[1]); d = Number(m[2]); }
    else {
      var m2 = /(\d{1,2})\s*일\s*(?:까지|마감)/.exec(s);
      if (m2) { mo = base.getMonth() + 1; d = Number(m2[1]); }
    }
    if (!mo || !d || mo > 12 || d > 31) return '';
    if (mo < base.getMonth() + 1 - 6) y += 1;
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
  }

  return {
    TEXT_MAX: TEXT_MAX, KEEP_DAYS: KEEP_DAYS, BURST_MS: BURST_MS,
    RRN_RE: RRN_RE, CARD_RE: CARD_RE, ACCOUNT_RE: ACCOUNT_RE, PHONE_RE: PHONE_RE,
    maskSensitive: maskSensitive, normRoom: normRoom, roomAllowed: roomAllowed,
    noteKeySource: noteKeySource, classify: classify, groupBursts: groupBursts, findDue: findDue
  };
});
