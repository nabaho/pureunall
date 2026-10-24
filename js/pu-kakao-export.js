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

  /* ── 사건번호 ──────────────────────────────────────────────────────────────
     「경기2026부해3347」 = 지역 + 연도 4자리 + 사건부호 + 번호. 공백·하이픈을 지워 견준다.
     ⚠ 사건부호는 «알려진 것만» 번호로 본다(잡음 방지) — 다만 업무관리에 이미 있는 번호는
       낯선 부호여도 부르는 쪽이 extraKnown 으로 넘겨 잡는다. 부호를 더할 곳은 여기 한 곳. */
  var CASE_CODES = ['부해', '부노', '부당', '부권', '구제', '차별', '구합', '구단', '구소', '가합', '가단', '가소', '카합', '카단'];
  /* 지역 이름 — 「공문경기2026…」처럼 앞 글자가 딸려 들어오면 지역부터 자른다 */
  var REGIONS = ['중앙', '서울', '부산', '경기', '인천', '대전', '대구', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  var RE_CASE = /([가-힣]{2,4})\s*(20\d{2})\s*([가-힣]{1,3})\s*(\d{1,6})/g;

  function normCaseNo(s) { return String(s == null ? '' : s).replace(/[\s\-. ]/g, ''); }

  function extractCaseNos(text, extraKnown) {
    var known = {};
    (extraKnown || []).forEach(function (n) { known[normCaseNo(n)] = 1; });
    var out = [], seen = {}, m;
    var re = new RegExp(RE_CASE.source, 'g');
    var s = String(text == null ? '' : text);
    while ((m = re.exec(s))) {
      var region = m[1];
      for (var i = 0; i < region.length - 1; i++) {
        if (REGIONS.indexOf(region.slice(i, i + 2)) >= 0) { region = region.slice(i); break; }
      }
      var no = region + m[2] + m[3] + m[4];
      if ((CASE_CODES.indexOf(m[3]) >= 0 || known[no]) && !seen[no]) { seen[no] = 1; out.push(no); }
    }
    return out;
  }

  /* ── 업체명 후보 — 이름으로 업체 id 를 «채우지» 않는다, 후보만 낸다 ────────────
     work.html 의 mlkSuggest 와 같은 뜻: 업체명 앞부분 minLen 글자 이상이 글에 들면 후보.
     ⚠ minLen 은 부르는 쪽이 MLK_MIN_MATCH 를 넘긴다 — 같은 숫자를 두 곳에 두지 않는다. */
  function koOnly(s) { return String(s == null ? '' : s).replace(/[^가-힣]/g, ''); }

  function findCompanyKeys(text, companies, minLen) {
    var hay = koOnly(text), out = [];
    if (!hay) return out;
    (companies || []).forEach(function (c) {
      var co = koOnly(c.name);
      for (var len = co.length; len >= minLen; len--) {
        if (hay.indexOf(co.slice(0, len)) >= 0) { if (out.indexOf(c.key) < 0) out.push(c.key); break; }
      }
    });
    return out;
  }

  /* ── 묶기 ──────────────────────────────────────────────────────────────────
     · 번호·업체가 있는 글은 같은 날 같은 번호(또는 같은 업체)의 묶음에 붙고, 아니면 새 묶음.
       같은 업체의 «다른 사건번호»는 따로 묶는다(번호가 둘 다 있고 겹치지 않을 때).
     · 번호·업체가 없는 글은 같은 날, 직전 묶음에서 gapMin(30)분 안이면 그 묶음에 붙고,
       아니면 그 날의 «미분류» 한 묶음에 모은다. */
  var GAP_MIN = 30;

  function hasAny(list, target) { return list.some(function (x) { return target.indexOf(x) >= 0; }); }

  function unionInto(target, list) { list.forEach(function (x) { if (target.indexOf(x) < 0) target.push(x); }); }

  function groupMessages(messages, opts) {
    opts = opts || {};
    var gap = (opts.gapMin == null ? GAP_MIN : opts.gapMin) * 60000;
    var list = (messages || []).slice().sort(function (a, b) { return a.at - b.at; });
    var groups = [], cur = null, noneByDay = {};

    function open(day, anchor) {
      var g = { day: day, caseNos: [], companyKeys: [], msgs: [], files: [], media: 0, anchor: anchor, lastAt: 0 };
      groups.push(g);
      return g;
    }

    list.forEach(function (m) {
      var cases = extractCaseNos(m.text, opts.extraKnown);
      var cos = opts.companies ? findCompanyKeys(m.text, opts.companies, opts.minLen || 3) : [];
      var g;
      if (cases.length || cos.length) {
        var joins = cur && cur.day === m.day && cur.anchor !== 'none' &&
          ((cases.length && cur.caseNos.length) ? hasAny(cases, cur.caseNos)
            : (hasAny(cases, cur.caseNos) || hasAny(cos, cur.companyKeys)));
        g = joins ? cur : open(m.day, cases.length ? 'case' : 'company');
        unionInto(g.caseNos, cases); unionInto(g.companyKeys, cos);
        if (g.caseNos.length) g.anchor = 'case';
      } else if (cur && cur.day === m.day && cur.anchor !== 'none' && m.at - cur.lastAt <= gap) {
        g = cur;
      } else {
        g = noneByDay[m.day] || (noneByDay[m.day] = open(m.day, 'none'));
      }
      g.msgs.push(m); unionInto(g.files, m.files || []); g.media += m.media || 0;
      g.lastAt = m.at; cur = g;
    });
    return groups;
  }

  /* ── 진행 기록 한 줄 ────────────────────────────────────────────────────────
     AI 없이 «사람별 첫 글» 발췌(최대 셋) + 첨부 이름. 잡담·첨부 줄은 문장에서 빼되 글 수에는 센다.
     ⚠ 280자는 진행 기록 한 줄의 한도(설계서 5장). 넘으면 «글 쪽»을 자른다 — 첨부 이름은 지키지 않으면
       어느 파일인지 알 수 없다. */
  var LINE_MAX = 280;
  var SENTENCE_MAX = 90;
  var NOISE_RE = /^(네+|넵|넹|예|옙|확인(했습니다|했어요|하였습니다)?|감사합니다|고맙습니다|수고하셨습니다|알겠습니다|알겠어요|ㅇㅋ|ok|ㅎㅎ+|ㅋㅋ+|ㅠㅠ+|이모티콘|좋아요)[.!~\s]*$/i;

  function sentenceOf(m) {
    var text = String(m.text == null ? '' : m.text);
    if ((m.files && m.files.length) || m.media) text = text.split('\n').slice(1).join('\n');   /* 첫 줄이 첨부 표시 */
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || NOISE_RE.test(text)) return '';
    return text.length > SENTENCE_MAX ? text.slice(0, SENTENCE_MAX) + '…' : text;
  }

  function digest(g) {
    var who = [];
    g.msgs.forEach(function (m) { if (who.indexOf(m.sender) < 0) who.push(m.sender); });
    var names = who.slice(0, 3).join('·') + (who.length > 3 ? ' 외 ' + (who.length - 3) + '명' : '');
    var head = '💬 카톡 · ' + names + ' — ';
    var picked = {}, sentences = [], rest = 0;
    g.msgs.forEach(function (m) {
      var s = sentenceOf(m);
      if (!s) return;
      if (!picked[m.sender] && sentences.length < 3) { picked[m.sender] = 1; sentences.push(s); } else rest++;
    });
    var body = sentences.join(' / ') + (rest ? ' (+' + rest + '건)' : '');
    if (!body) body = '글 ' + g.msgs.length + '건';
    var tail = g.files.length ? ' · 📎 ' + g.files.join(', ') : '';
    if (tail.length > 120) tail = tail.slice(0, 119) + '…';
    var room = LINE_MAX - head.length - tail.length;
    if (body.length > room) body = body.slice(0, Math.max(0, room - 1)) + '…';
    return { text: head + body + tail, who: who, n: g.msgs.length };
  }

  /* ── 열쇠 ──────────────────────────────────────────────────────────────────
     줄 열쇠 = (업무, 날짜, 방), 내용 열쇠 = (요약 글, 첨부). lid = 'K' + 줄 + 내용.
     같은 파일을 다시 올리면 lid 가 같아 건너뛰고, 그 날 글이 늘면 줄 열쇠는 같고 내용 열쇠만 달라 «보강»이다.
     해시는 32비트 둘(FNV-1a·djb2)을 이어 16진 16자 — BigInt 를 안 쓴다(옛 아이폰 사파리). */
  function hash(str) {
    var s = String(str), h1 = 0x811c9dc5, h2 = 5381;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2, 33) + c) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function lineKey(itemId, day, room) { return hash([itemId, day, room].join('\u0001')); }
  function logId(itemId, day, room, text, files) {
    return 'K' + lineKey(itemId, day, room) + hash(String(text) + '\u0001' + (files || []).join('\u0002'));
  }

  return {
    parseExport: parseExport, maskMessages: maskMessages,
    CASE_CODES: CASE_CODES, GAP_MIN: GAP_MIN, LINE_MAX: LINE_MAX,
    normCaseNo: normCaseNo, extractCaseNos: extractCaseNos, findCompanyKeys: findCompanyKeys,
    groupMessages: groupMessages, digest: digest, hash: hash, lineKey: lineKey, logId: logId
  };
});
