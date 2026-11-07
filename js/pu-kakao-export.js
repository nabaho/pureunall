/* 카톡 법인 업무채팅방 대화 → 업무관리 «진행 기록» 묶기 — 순수 계산(DOM 없음) (2026-10-24, 2026-10-26 개정)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-24 「PC 카톡의 법인 대화방 자료를 받아 따로 보관하고, 대화 진행상황을 업무관리에
   자동으로 넣을 수 없나」. 설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md

   ■ 2026-10-26 개정 — 대화 .txt 읽기·받는 방 확인·가림·원문 보관·받을 파일은 main 의 💬 카톡정리가 이미 한다
     (js/pu-kakao-work.js parseExport · 서버 kakaoImport). 여기에는 «그 위에 얹는 것»만 남겼다:
     사건번호·업체명으로 묶기 → 업무관리 진행 기록 한 줄 + 그 줄의 중복 방지 열쇠 + 업무 맞추기.
   ■ 지키는 것
     · 카톡 프로그램을 조종하거나 긁지 않는다(docs/카톡수집기-검토.md) — 사람이 내보낸 글만 쓴다.
     · 여기는 «계산»만 한다. 가림은 읽는 쪽(maskCount)이 이미 했다 — 부르는 화면이 주민번호 지우개를 한 번 더 건다.
     · 이름으로 업체·업무 id 를 채우지 않는다 — 후보만 낸다(matchGroups).
   ⚠ 서버(functions/)에는 올라가지 않는 브라우저 전용 파일이다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuKakaoExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── main 의 읽기 결과 → 묶기 입력 ─────────────────────────────────────────
     lines = parseExport().messages [{sender,sentAt,text}] (글만), files = parseExport().files [{sender,sentAt,name}].
     sentAt 은 한국 시각 «분»의 시작(ms). 파일은 「파일: 이름」 글 하나로 시간 순에 끼워 묶음의 첨부가 되게 한다. */
  function kstDay(ms) { return new Date(Number(ms) + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function fromLines(lines, files) {
    var out = [];
    (lines || []).forEach(function (x) {
      if (!x || !isFinite(x.sentAt)) return;
      out.push({ at: Number(x.sentAt), day: kstDay(x.sentAt), sender: String(x.sender || ''), text: String(x.text || ''), files: [], media: 0 });
    });
    (files || []).forEach(function (x) {
      if (!x || !isFinite(x.sentAt) || !x.name) return;
      out.push({ at: Number(x.sentAt), day: kstDay(x.sentAt), sender: String(x.sender || ''), text: '파일: ' + x.name, files: [String(x.name)], media: 0 });
    });
    return out.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return a.m.at - b.m.at || a.i - b.i; })
      .map(function (p) { return p.m; });
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
    /* 이 글이 g 에 붙는가 — 같은 날, 같은 번호(번호가 둘 다 있으면 번호가 겹칠 때만, 아니면 업체로도) */
    function joinsGroup(g, day, cases, cos) {
      if (g.day !== day || g.anchor === 'none') return false;
      if (cases.length && g.caseNos.length) return hasAny(cases, g.caseNos);
      return hasAny(cases, g.caseNos) || hasAny(cos, g.companyKeys);
    }

    function place(g, m) {
      g.msgs.push(m); unionInto(g.files, m.files || []); g.media += m.media || 0; g.lastAt = m.at;
    }

    list.forEach(function (m) {
      var cases = extractCaseNos(m.text, opts.extraKnown);
      var cos = opts.companies ? findCompanyKeys(m.text, opts.companies, opts.minLen || 3) : [];
      var g;
      /* 한 글에 사건번호가 «둘 이상»이면 사건마다 묶음에 각각 넣는다 — 한 묶음에 합치면 그날 두 사건의 대화가
         모두 거기로 모여, 사람이 하나를 고르는 순간 다른 사건의 대화가 그 업무에 붙는다.
         바로 뒤의 번호 없는 글은 어느 사건인지 모르므로 직전 묶음에 붙이지 않는다(cur=null → 미분류). */
      if (cases.length > 1) {
        cases.forEach(function (c) {
          var t = null;
          for (var gi = groups.length - 1; !t && gi >= 0; gi--) if (joinsGroup(groups[gi], m.day, [c], cos)) t = groups[gi];
          if (!t) t = open(m.day, 'case');
          unionInto(t.caseNos, [c]); unionInto(t.companyKeys, cos); t.anchor = 'case';
          place(t, m);
        });
        cur = null;
        return;
      }
      if (cases.length || cos.length) {
        /* 사건 9001 → 9002 → 9001 로 번갈아 오가도 같은 날 같은 번호는 «한 묶음»이다(업무·날짜당 한 줄).
           직전 묶음에 안 붙으면 같은 날 앞선 묶음 중 가장 최근 것에서 찾는다. */
        g = (cur && joinsGroup(cur, m.day, cases, cos)) ? cur : null;
        for (var gi = groups.length - 1; !g && gi >= 0; gi--) if (joinsGroup(groups[gi], m.day, cases, cos)) g = groups[gi];
        if (!g) g = open(m.day, cases.length ? 'case' : 'company');
        unionInto(g.caseNos, cases); unionInto(g.companyKeys, cos);
        if (g.caseNos.length) g.anchor = 'case';
      } else if (cur && cur.day === m.day && cur.anchor !== 'none' && m.at - cur.lastAt <= gap) {
        g = cur;
      } else {
        g = noneByDay[m.day] || (noneByDay[m.day] = open(m.day, 'none'));
      }
      place(g, m); cur = g;
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
     줄 열쇠(recordKey) = (업무, 날짜, 방), 내용 열쇠 = (요약 글, 첨부). lid = 'K' + 줄 + 내용.
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
  function recordKey(itemId, day, room) { return hash([itemId, day, room].join('\u0001')); }
  function logId(itemId, day, room, text, files) {
    return 'K' + recordKey(itemId, day, room) + hash(String(text) + '\u0001' + (files || []).join('\u0002'));
  }

  /* ── 업무 맞추기 ───────────────────────────────────────────────────────────
     sure   : 사건번호가 업무관리 번호(no) 또는 심급 사건번호(stageNos)와 «글자 그대로» 같고 업무가 하나.
     guess  : 같은 번호가 업무 여럿이거나, 업체명만 같다 — 사람이 고른다. 자동으로 정하지 않는다.
     newno  : 알려진 부호의 번호인데 업무관리에 없다 — 「새 업무 창 열기」는 사람이 저장한다.
     none   : 근거 없음.
     ⚠ 사건번호 일치는 종결된 업무도 본다(번호가 정확하고, 종결 뒤 후속 대화도 기록돼야 한다).
       업체명 후보는 «진행 중»인 업무만 — 닫힌 업무에 줄을 붙이는 것은 거의 항상 실수다.
     ⚠ 연결 열쇠는 업무 id 다. 업체명은 후보를 보여 주는 데만 쓴다(이름으로 id 를 채우지 않는다). */
  function matchGroups(groups, items) {
    var byNo = {}, byKey = {};
    (items || []).forEach(function (it) {
      [it.no].concat(it.stageNos || []).forEach(function (n) {
        var k = normCaseNo(n);
        if (!k) return;
        var a = byNo[k] || (byNo[k] = []);
        if (a.indexOf(it.id) < 0) a.push(it.id);
      });
      if (it.open) (byKey[it.key] || (byKey[it.key] = [])).push(it.id);
    });
    return (groups || []).map(function (g) {
      var cases = g.caseNos || [];
      var cands = [];
      (g.companyKeys || []).forEach(function (k) { unionInto(cands, byKey[k] || []); });
      if (cases.length) {
        var ids = [], matchedNo = '';
        cases.forEach(function (n) {
          var hit = byNo[normCaseNo(n)];
          if (hit) { if (!matchedNo) matchedNo = n; unionInto(ids, hit); }
        });
        if (ids.length === 1) return { basis: 'sure', itemId: ids[0], candidates: ids, caseNo: matchedNo };
        if (ids.length > 1) return { basis: 'guess', itemId: '', candidates: ids, caseNo: matchedNo };
        return { basis: 'newno', itemId: '', candidates: cands, caseNo: cases[0] };
      }
      if (cands.length) return { basis: 'guess', itemId: cands.length === 1 ? cands[0] : '', candidates: cands, caseNo: '' };
      return { basis: 'none', itemId: '', candidates: [], caseNo: '' };
    });
  }

  return {
    CASE_CODES: CASE_CODES, GAP_MIN: GAP_MIN, LINE_MAX: LINE_MAX,
    fromLines: fromLines, normCaseNo: normCaseNo, extractCaseNos: extractCaseNos, findCompanyKeys: findCompanyKeys,
    groupMessages: groupMessages, digest: digest, hash: hash, recordKey: recordKey, logId: logId,
    matchGroups: matchGroups
  };
});
