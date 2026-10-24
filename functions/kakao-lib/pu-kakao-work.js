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
     (「한솔」과 「한솔가축약품」 — 비슷한 이름이 다른 곳이다). */
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

  /* ══ 대화 저장본(.txt) 읽기 (2026-10-24) ══════════════════════════════════
     대표 「카톡 대화와 다운받을 것을 위반 없이 자동 정리」 → 목업 승인 → 「목업대로 진행」.
     ★ 알림으로는 «대표님 글»이 안 온다(카톡은 내 글에 알림을 안 띄운다). 그래서 사람이
       PC 카톡에서 「≡ → 대화 내용 → 대화 내보내기」로 저장한 .txt 를 끌어 놓아 채운다.
     ⚠ 이 셈은 «브라우저 안»에서 돈다 — 원본 .txt 는 서버로 안 간다. 서버로는 가린 줄만 간다.
     ⚠ 카톡 판마다 모양이 조금씩 다르다 — PC(윈도)·안드로이드·아이폰·맥(CSV) 넷을 읽는다.
       못 읽으면 지어내지 않고 «못 읽었다»고 돌려준다(첫 줄을 함께 보여 사람이 알 수 있게). */
  var KST_MS = 9 * 60 * 60 * 1000;
  var DAY_MS = 24 * 60 * 60 * 1000;
  /* 카톡 파일 «남은 기간»의 잣대 — 카카오는 보관 기간을 공개하지 않는다.
     대표 캡처(2026-10-19)에 보인 유효기간이 «보낸 날 + 14일»이었다. 그래서 화면에는 늘 «추정»이라 적는다. */
  var EXPIRE_DAYS = 14;

  function kstMs(y, mo, d, ampm, h, mi) {
    var hh = Number(h);
    if (ampm === '오후' && hh < 12) hh += 12;
    if (ampm === '오전' && hh === 12) hh = 0;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), hh, Number(mi)) - KST_MS;
  }

  var PC_DAY = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\S*\s*-{3,}\s*$/;
  var PC_MSG = /^\[([^\]]{1,80})\]\s*\[(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})\]\s?([\s\S]*)$/;
  var AND_MSG = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2}),\s*(.+?)\s:\s([\s\S]*)$/;
  var IOS_MSG = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2}),\s*(.+?)\s:\s([\s\S]*)$/;
  /* 안드로이드·아이폰의 날짜 줄과 «들어왔습니다»류 알림 줄 — 시각은 있는데 「 : 」 가 없다 */
  var AND_HEAD = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*((오전|오후)\s*)?\d{1,2}:\d{2}(,|\s*$)/;
  var IOS_HEAD = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*((오전|오후)\s*)?\d{1,2}:\d{2}(,|\s*$)/;
  var DAY_ONLY = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\S*요일\s*$/;
  var SYS_RE = /님이 (들어왔습니다|나갔습니다)|님을 (초대했습니다|내보냈습니다)|님이 .{0,80}님을 초대했습니다|채팅방 관리자가 메시지를 가렸습니다|^삭제된 메시지입니다\.?$|^저장한 날짜\s*:/;
  var FILE_RE = /^파일\s*:\s*(.+)$/;
  var FILE_NAME_RE = /^[^\n\\\/:*?"<>|]{1,200}\.(xlsx|xlsm|xls|csv|hwpx|hwp|docx|doc|pdf|pptx|ppt|zip|jpg|jpeg|png|gif|heic)$/i;
  var PHOTO_RE = /^(사진|동영상)(\s*(\d+)\s*장)?$|^(사진|동영상)(을|를)\s*보냈습니다\.?$|^사진\s*(\d+)\s*장을\s*보냈습니다\.?$/;
  var EMOTI_RE = /^(\(?이모티콘\)?|\(?emoticon\)?)$/i;

  /* 첫 줄(「푸른 업무방 님과 카카오톡 대화」)과 파일 이름에서 «방 이름 후보»를 뽑는다.
     ⚠ 단톡방은 이름 뒤에 사람 수가 붙는 판이 있다(「… 업무방 11 님과 …」) — 붙은 것·뗀 것 둘 다 후보다.
     ⚠ 후보는 «받는 방 목록과 정확히 같을 때만» 쓴다(roomAllowed) — 비슷한 이름으로 넣지 않는다. */
  function exportRooms(firstLine, fileName) {
    var out = [];
    function add(s) {
      var r = normRoom(s);
      if (r && r.length <= 80 && out.indexOf(r) < 0) out.push(r);
      var bare = r.replace(/\s+\d{1,4}$/, '');
      if (bare && bare !== r && out.indexOf(bare) < 0) out.push(bare);
    }
    var t = String(firstLine || '').replace(/^\uFEFF/, '');
    if (/카카오톡\s*대화\s*$/.test(t)) add(t.replace(/\s*(님과\s*)?카카오톡\s*대화\s*$/, ''));
    var f = String(fileName || '').replace(/\.[a-z0-9]{1,5}$/i, '')
      .replace(/^KakaoTalk(Chats)?_?/i, '').replace(/(님과\s*)?카카오톡\s*대화/g, '')
      .replace(/[_\s-]*\d{6,}[\s\S]*$/, '').replace(/^[_\s-]+|[_\s-]+$/g, '');
    if (f.length >= 2) add(f);
    return out;
  }

  /* 받는 방 목록에서 후보와 «정확히» 같은 방 하나 — 없으면 '' */
  function pickRoom(rooms, candidates) {
    var c = candidates || [];
    for (var i = 0; i < c.length; i++) if (roomAllowed(rooms, c[i])) return normRoom(c[i]);
    return '';
  }

  /* 맥 CSV 한 벌 — 따옴표 안의 쉼표·줄바꿈을 지킨다 */
  function csvRows(text) {
    var rows = [], row = [], cell = '', q = false, s = String(text || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (q) {
        if (ch === '"') { if (s.charAt(i + 1) === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  /* 한 줄 글을 갈래로 — 파일·사진·이모티콘·글 */
  function exportKindOf(text) {
    var s = String(text || '').trim();
    var m = FILE_RE.exec(s);
    if (m && s.indexOf('\n') < 0) return { kind: 'file', name: m[1].trim() };
    if (s.indexOf('\n') < 0 && FILE_NAME_RE.test(s)) return { kind: 'file', name: s };
    m = PHOTO_RE.exec(s);
    if (m) return { kind: 'photo', n: Number(m[3] || m[6] || 1) || 1 };
    if (EMOTI_RE.test(s)) return { kind: 'emoticon' };
    return { kind: 'text' };
  }

  /* 저장본 → { ok, format, rooms:[후보], messages:[{sender,sentAt,text}], files:[{sender,sentAt,name}], photos, system }
     sentAt 은 한국 시각 «분»의 시작(ms). 못 읽으면 { ok:false, error, firstLine }. */
  function parseExport(text, opts) {
    opts = opts || {};
    var raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var lines = raw.split('\n');
    var first = '';
    for (var f0 = 0; f0 < lines.length && !first; f0++) first = lines[f0].trim();
    var out = { ok: true, format: '', rooms: exportRooms(first, opts.fileName), messages: [], files: [], photos: 0, system: 0 };
    var msgs = [];

    if (/^"?date"?\s*,\s*"?user"?\s*,\s*"?message"?/i.test(first)) {
      out.format = 'mac';
      csvRows(raw).slice(1).forEach(function (r) {
        var dm = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(String(r[0] || ''));
        if (!dm || r.length < 3) return;
        msgs.push({ sender: String(r[1] || '').trim(), sentAt: kstMs(dm[1], dm[2], dm[3], '', dm[4], dm[5]), text: String(r[2] || '') });
      });
    } else {
      var day = null, cur = null;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i], m;
        if ((m = PC_DAY.exec(ln))) { day = [m[1], m[2], m[3]]; cur = null; out.format = out.format || 'pc'; continue; }
        if ((m = PC_MSG.exec(ln)) && day) {
          cur = { sender: m[1].trim(), sentAt: kstMs(day[0], day[1], day[2], m[2] || '', m[3], m[4]), text: m[5] };
          msgs.push(cur); out.format = 'pc'; continue;
        }
        if ((m = AND_MSG.exec(ln))) {
          cur = { sender: m[7].trim(), sentAt: kstMs(m[1], m[2], m[3], m[4] || '', m[5], m[6]), text: m[8] };
          msgs.push(cur); out.format = out.format || 'android'; continue;
        }
        if ((m = IOS_MSG.exec(ln))) {
          cur = { sender: m[7].trim(), sentAt: kstMs(m[1], m[2], m[3], m[4] || '', m[5], m[6]), text: m[8] };
          msgs.push(cur); out.format = out.format || 'ios'; continue;
        }
        if (AND_HEAD.test(ln) || IOS_HEAD.test(ln) || DAY_ONLY.test(ln)) {
          if (/,/.test(ln)) out.system++;
          cur = null; continue;
        }
        if (SYS_RE.test(ln.trim())) { out.system++; cur = null; continue; }
        /* 그 밖 — 앞 글이 여러 줄이었던 것. 앞 글이 없으면(머리말 등) 버린다 */
        if (cur) cur.text += '\n' + ln;
      }
    }

    if (!msgs.length) {
      return { ok: false, error: '저장본의 모양을 못 읽었습니다 — 카톡 «대화 내보내기»로 저장한 .txt 인지 확인해 주세요',
        firstLine: first.slice(0, 80), rooms: out.rooms };
    }
    msgs.forEach(function (x) {
      var t = String(x.text || '').replace(/\s+$/, '');
      if (!x.sender || !isFinite(x.sentAt)) return;
      var k = exportKindOf(t);
      if (k.kind === 'file') out.files.push({ sender: x.sender, sentAt: x.sentAt, name: k.name.slice(0, 200) });
      else if (k.kind === 'photo') out.photos += k.n;
      else if (k.kind === 'text' && t.trim()) out.messages.push({ sender: x.sender, sentAt: x.sentAt, text: t.trim() });
    });
    return out;
  }

  /* 가리면서 «몇 곳을 가렸는지» 센다 — 미리보기 창에 「주민번호 1곳 · 계좌 2곳」으로 보인다.
     ⚠ 가리는 식은 maskSensitive 그대로다(셈만 덧붙였다). */
  function maskCount(text) {
    var s = String(text == null ? '' : text);
    var n = { rrn: 0, card: 0, account: 0 };
    s = s.replace(RRN_RE, function () { n.rrn++; return '●●●●●●-●●●●●●●'; });
    s = s.replace(CARD_RE, function () { n.card++; return '●●●●-●●●●-●●●●-●●●●'; });
    s = s.replace(ACCOUNT_RE, function (m) {
      if (PHONE_RE.test(m)) return m;
      if (m.replace(/\D/g, '').length < 10) return m;
      n.account++; return '●●●-계좌-●●●';
    });
    return { text: s, rrn: n.rrn, card: n.card, account: n.account };
  }

  /* 알림 글과 저장본 글이 «같은 글»인지 견주는 열쇠 — 알림은 밀리초, 저장본은 분까지라
     분으로 맞추고 빈칸을 한 칸으로 줄인다. 서버는 앞뒤 1분도 함께 본다(알림이 분 경계를 넘을 수 있다). */
  function lineKey(sender, minute, text) {
    return [String(sender || '').trim(), String(Number(minute) || 0), String(text || '').replace(/\s+/g, ' ').trim()].join('\u0001');
  }

  /* ── 받을 파일 ─────────────────────────────────────────────────────────
     보낼 곳은 «짐작»이다 — 화면은 미리 골라 둘 뿐이고, 보내는 것은 사람이 누른다.
       co    📑 기업별 계약서 — 우리와 맺은 계약서류(자문·고문·위임 …). 메일 첨부와 같은 길.
       pc    💻 PC에만      — 급여·근태·개인 서류. 서버로 안 올린다(급여데이터함은 2026-10-20 감췄다).
       photo 📷 사진첩      — 그 밖의 서류·작업 파일. 사업자등록증·명함은 사진첩이 판독한다.
     ⚠ 「근로계약서」는 고객사 직원 개인정보다 — 우리 계약서가 아니다(pu-co-roster NOT_OURS 와 같은 뜻). */
  var DEST_OURS = /자문\s*계약|고문\s*계약|자문\s*약정|급여\s*(관리|위임|아웃소싱)\s*계약|위임\s*계약|위임\s*약정|약정서|컨설팅\s*(위임|계약|위탁)|위탁\s*계약/;
  var DEST_PC = /급여|임금|명세|대장|근태|출퇴근|출근부|4대\s*보험|사대\s*보험|원천|연말\s*정산|정산|퇴직금|주민|통장|신분증|근로\s*계약|연봉\s*계약|촉탁\s*계약|이력서|인사\s*기록|가족\s*관계|등본/;
  var DEST_CO = /계약서/;
  function guessDest(name) {
    var n = String(name || '');
    if (DEST_OURS.test(n)) return 'co';
    if (DEST_PC.test(n)) return 'pc';
    if (DEST_CO.test(n)) return 'co';
    return 'photo';
  }

  function kstDay(ms) { return Math.floor((Number(ms) + KST_MS) / DAY_MS); }
  /* 남은 날 — 0 은 «오늘까지», 음수는 지난 것. 추정이다(EXPIRE_DAYS). */
  function fileLeft(sentAt, now) { return kstDay(sentAt) + EXPIRE_DAYS - kstDay(now == null ? Date.now() : now); }
  /* 끝나는 날 「M/D」 */
  function fileEnds(sentAt) {
    var d = new Date((kstDay(sentAt) + EXPIRE_DAYS) * DAY_MS);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
  }

  /* 폴더에 있는 이름이 그 파일인가 — 윈도는 큰작은 글자를 안 가리고,
     같은 이름이 또 받히면 「이름 (1).xlsx」로 붙는다. */
  function sameFileName(want, have) {
    var nf = function (s) { s = String(s || '').trim(); return (s.normalize ? s.normalize('NFC') : s).toLowerCase(); };
    var a = nf(want), b = nf(have);
    if (!a || !b) return false;
    if (a === b) return true;
    var dot = a.lastIndexOf('.');
    var base = dot > 0 ? a.slice(0, dot) : a, ext = dot > 0 ? a.slice(dot) : '';
    if (b.slice(0, base.length) !== base || b.slice(b.length - ext.length) !== ext) return false;
    return /^\s?\(\d{1,3}\)$/.test(b.slice(base.length, b.length - ext.length));
  }

  return {
    TEXT_MAX: TEXT_MAX, KEEP_DAYS: KEEP_DAYS, BURST_MS: BURST_MS, EXPIRE_DAYS: EXPIRE_DAYS,
    RRN_RE: RRN_RE, CARD_RE: CARD_RE, ACCOUNT_RE: ACCOUNT_RE, PHONE_RE: PHONE_RE,
    maskSensitive: maskSensitive, normRoom: normRoom, roomAllowed: roomAllowed,
    noteKeySource: noteKeySource, classify: classify, groupBursts: groupBursts, findDue: findDue,
    exportRooms: exportRooms, pickRoom: pickRoom, parseExport: parseExport, maskCount: maskCount, lineKey: lineKey,
    guessDest: guessDest, fileLeft: fileLeft, fileEnds: fileEnds, sameFileName: sameFileName
  };
});
