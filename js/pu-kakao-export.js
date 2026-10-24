/* 카톡 법인 업무채팅방 «대화 내보내기» 읽기·묶기 — 순수 계산(DOM 없음) (2026-10-24)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-24 「PC 카톡의 법인 대화방 자료를 받아 따로 보관하고, 대화 진행상황을 업무관리에
   자동으로 넣을 수 없나」 → 사람이 PC 카톡에서 내보낸 .txt 를 업무관리 💬 카톡정리가 읽는다.
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md

   ■ 지키는 것
     · 카톡 프로그램을 조종하거나 긁지 않는다(docs/카톡수집기-검토.md) — 사람이 내보낸 글 파일만 읽는다.
     · 여기는 «계산»만 한다. 가리개(maskSensitive·주민번호 지우개)는 부르는 쪽이 maskMessages 로 건다.
     · 이름으로 업체·업무 id 를 채우지 않는다 — 후보만 낸다(matchGroups).
   ⚠ 서버(functions/)에는 올라가지 않는 브라우저 전용 파일이다. 서버가 쓰는 셈은 js/pu-kakao-work.js 한 벌뿐. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuKakaoExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 내보내기 꼴 목록 — «한 곳»에 둔다 ─────────────────────────────────────
     실물이 오면 여기만 고친다(설계서 13장). 카톡은 판이 올라가며 꼴이 바뀐다.
     pc      : [이름] [오후 2:05] 내용        (날짜는 구분선 줄에서)
     android : 2026년 10월 23일 오후 2:05, 이름 : 내용
     iphone  : 2026. 10. 23. 오후 2:05, 이름 : 내용 */
  var AMPM = '(오전|오후)\\s*(\\d{1,2}):(\\d{2})';
  var RE_PC = new RegExp('^\\[([^\\]]+)\\]\\s*\\[' + AMPM + '\\]\\s?(.*)$');
  var RE_ANDROID = new RegExp('^(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일\\s*' + AMPM + ',\\s*(.+?)\\s:\\s(.*)$');
  var RE_IPHONE = new RegExp('^(\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*' + AMPM + ',\\s*(.+?)\\s:\\s(.*)$');
  /* 날짜 줄 — 점선 두른 것(PC)과 요일만 있는 것(안드로이드) */
  var RE_SEP_DASH = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*?-{3,}$/;
  var RE_SEP_PLAIN = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[월화수목금토일]요일\s*$/;
  /* 들어오고 나감 안내 — 앞 글의 이어지는 줄이 아니다 */
  var RE_SYSTEM = /님(이|을)\s.*(들어왔|나갔|초대했|내보냈)습니다\.?\s*$/;
  var RE_HEADER = /^(.+?)\s*(?:님과\s*)?카카오톡\s*대화\s*$/;
  var RE_SAVED = /^저장한\s*날짜\s*:/;
  /* 첨부 — 「파일: 이름」 또는 줄 전체가 파일 이름. ⚠ PC 카톡의 실제 표기는 실물로 확인 [확인 필요] */
  var RE_FILE_LABEL = /^파일\s*[:：]\s*(.+)$/;
  var RE_FILE_BARE = /^[^\n]{1,200}\.(?:hwpx?|pdf|docx?|xlsx?|pptx?|zip|csv|txt|jpe?g|png|gif|tiff?)$/i;
  var RE_MEDIA = /^\(?(사진|동영상)\)?(?:\s*(\d+)\s*장)?(?:을|를)?(?:\s*보냈습니다\.?)?$/;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayOf(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

  /* 한국 시각(+09:00)으로 읽는다 — 올리는 PC 의 시간대에 기대지 않는다.
     「오전 12시」는 0시, 「오후 12시」는 12시. Date.UTC 는 음수 시간을 전날로 넘겨 준다. */
  function atKst(y, m, d, ampm, h, mi) {
    var h24 = Number(h) % 12 + (ampm === '오후' ? 12 : 0);
    return Date.UTC(y, m - 1, d, h24 - 9, Number(mi));
  }

  function attachOf(text) {
    var first = String(text).split('\n')[0].trim();
    var files = [], media = 0, m;
    if ((m = RE_FILE_LABEL.exec(first))) files.push(m[1].trim());
    else if (text.indexOf('\n') < 0 && RE_FILE_BARE.test(first)) files.push(first);
    else if ((m = RE_MEDIA.exec(first))) media = m[2] ? Number(m[2]) : 1;
    return { files: files, media: media };
  }

  function parseExport(input) {
    var out = { room: '', format: 'unknown', messages: [], badLines: 0 };
    var lines = String(input == null ? '' : input).replace(/\r/g, '').split('\n');
    var cur = null;          /* 지금 읽는 구분선 날짜 {y,m,d} */
    var last = null;         /* 이어지는 줄을 붙일 앞 글 */
    var blanks = 0;          /* 글 사이의 빈 줄 — 다음 이어지는 줄이 올 때만 글 안으로 센다 */
    var headerDone = false;

    function push(fmt, y, m, d, ampm, h, mi, sender, body) {
      if (out.format === 'unknown') out.format = fmt;
      var a = attachOf(body);
      last = { at: atKst(y, m, d, ampm, h, mi), day: dayOf(y, m, d), sender: String(sender).trim(),
               text: body, files: a.files, media: a.media };
      out.messages.push(last);
      blanks = 0;
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].replace(/\s+$/, '');
      var m;
      if (!raw) { blanks++; continue; }

      if ((m = RE_SEP_DASH.exec(raw) || RE_SEP_PLAIN.exec(raw))) {
        cur = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }; last = null; blanks = 0; continue;
      }
      if ((m = RE_ANDROID.exec(raw))) {
        push('android', Number(m[1]), Number(m[2]), Number(m[3]), m[4], m[5], m[6], m[7], m[8]); continue;
      }
      if ((m = RE_IPHONE.exec(raw))) {
        push('iphone', Number(m[1]), Number(m[2]), Number(m[3]), m[4], m[5], m[6], m[7], m[8]); continue;
      }
      if ((m = RE_PC.exec(raw))) {
        if (!cur) { out.badLines++; last = null; continue; }   /* 날짜 줄 없이 시각만 있으면 날짜를 알 수 없다 */
        push('pc', cur.y, cur.m, cur.d, m[2], m[3], m[4], m[1], m[5]); continue;
      }
      if (RE_SYSTEM.test(raw)) { last = null; blanks = 0; continue; }

      /* 머리글은 첫 글 앞에서만 — 방 이름을 여기서 얻는다 */
      if (!out.messages.length && !headerDone && (m = RE_HEADER.exec(raw))) {
        out.room = m[1].trim(); headerDone = true; continue;
      }
      if (!out.messages.length && RE_SAVED.test(raw)) continue;

      /* 어디에도 안 맞는 줄 — 앞 글이 있으면 그 글의 이어지는 줄(엔터가 든 말)이다 */
      if (last) {
        while (blanks > 0) { last.text += '\n'; blanks--; }
        last.text += '\n' + raw;
        var a = attachOf(last.text);
        last.files = a.files; last.media = a.media;
      } else out.badLines++;
      blanks = 0;
    }
    return out;
  }

  /* 글·첨부 이름에 가리개를 건다 — 보낸 사람 이름은 그대로. 새 배열을 돌려주고 원본은 안 건드린다. */
  function maskMessages(messages, mask) {
    return (messages || []).map(function (m) {
      return { at: m.at, day: m.day, sender: m.sender, text: mask(m.text),
               files: (m.files || []).map(mask), media: m.media };
    });
  }

  return { parseExport: parseExport, maskMessages: maskMessages };
});
