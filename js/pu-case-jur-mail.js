'use strict';
/* 사건 관할기관 «메일에서 가져오기» — 순수 함수
   (브라우저 window.PuCaseJurMail / Node 겸용 · 대표 지시 2026-11-07 「A안으로」
    · 계획 docs/superpowers/plans/2026-11-07-case-jur-mail.md · 검사 tests/case-jur-mail.test.js)
   무엇을 지키나
     · 읽기만 — 메일함 거울(mailbox/msgs/{폴더}/{번호}, 짧은 칸 f·e·s·d·a)의 머리글과, 사람이 고른 한 통의 본문 글자만 본다.
       본문·첨부를 어디에도 담지 않는다. 사건에 들어갈 수 있는 것은 기관·담당자·연락처·이메일 네 칸뿐이다.
     · AI 를 부르지 않는다 — 정규식으로만 뽑는다. 못 찾은 칸은 빈 글('')이다(채움 글자를 넣지 않는다).
     · 합칠 때 새 값이 빈 칸이면 기존 값을 덮지 않고, 이미 적힌 칸이 다르면 기본은 «그대로 두기»다(사람이 칸마다 고른다).
     · 이름만 같다고 사건을 잇지 않는다 — 어느 메일인지는 화면에서 사람이 고른다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;

  var DAY = 86400000;
  var DAYS = 60, MAX_ROWS = 30, SIG_LINES = 15;
  var FIELDS = ['org', 'officer', 'phone', 'email'];
  var LABELS = { org: '기관', officer: '담당자', phone: '연락처', email: '이메일' };
  /* 받은 칸만 — 보낸·스팸·휴지통·임시는 공문이 도착하는 자리가 아니다 */
  var BOX_KINDS = ['inbox', 'archive', 'custom'];
  var OWN_RE = /@pureun\.kr$/i;
  var NOREPLY_RE = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|postmaster|mailer-daemon|webmaster)@/i;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function addrOf(v) {
    var m = /[^\s<>"',;]+@[^\s<>"',;]+/.exec(str(v));
    return m ? m[0].toLowerCase() : '';
  }
  function domainOf(addr) { var i = addr.lastIndexOf('@'); return i < 0 ? '' : addr.slice(i + 1); }

  /* ── 메일 줄 ── 폴더 표 + 폴더별 거울 → 평평한 줄 */
  function mailRows(folders, msgs) {
    var out = [];
    if (!obj(folders) || !obj(msgs)) return out;
    Object.keys(folders).forEach(function (slug) {
      var f = folders[slug];
      if (!okId(slug) || !obj(f) || f.nomsg || BOX_KINDS.indexOf(f.kind) < 0) return;
      var box = has(msgs, slug) ? msgs[slug] : null;
      /* DB(RTDB)는 번호가 촘촘한 폴더(키가 0 부터 거의 빈틈없는 정수)를 «배열» 로 돌려준다 — 배열이면 인덱스가 번호, null 칸은 건너뛴다 */
      if (!obj(box) && !Array.isArray(box)) return;
      Object.keys(box).forEach(function (k) {
        var r = box[k];
        if (!obj(r) || !/^[0-9]{1,12}$/.test(k)) return;
        var from = addrOf(r.e);
        if (OWN_RE.test(from)) return;
        out.push({ slug: slug, uid: k, from: from, who: str(r.f), s: str(r.s), d: Number(r.d) || 0, a: Number(r.a) || 0 });
      });
    });
    return out;
  }

  /* ── 노동 쪽 거르기 ── 노동 직통 도메인은 늘, 정부 도메인(go.kr·korea.kr)은 이름·제목에 노동 낱말이 있을 때만.
     노동부 공무원은 지청과 상관없이 korea.kr 로 보내므로 도메인만으로는 «지청»을 못 가른다(2026-11-05 실측) */
  var LABOR_DIRECT = ['moel.go.kr', 'nlrc.go.kr', 'comwel.or.kr', 'kcomwel.or.kr', 'kosha.or.kr'];
  var GOV_RE = /(^|\.)(go\.kr|korea\.kr)$/;
  var LABOR_WORD_RE = /노동|근로|고용|임금|체불|해고|진정|신고|산재|감독|조정|구제/;
  function isLabor(r) {
    var dom = domainOf(str(r && r.from).toLowerCase());
    if (!dom) return false;
    for (var i = 0; i < LABOR_DIRECT.length; i++) {
      var d = LABOR_DIRECT[i];
      if (dom === d || dom.slice(-(d.length + 1)) === '.' + d) return true;
    }
    if (!GOV_RE.test(dom)) return false;
    return LABOR_WORD_RE.test(str(r.who) + ' ' + str(r.s));
  }

  /* ── 후보 목록 ── 최근 days 일 · 날짜 내림차순 · 칩(labor|all) · 찾기 · 최대 MAX_ROWS */
  function candidates(rows, o) {
    o = o || {};
    var days = Number(o.days) > 0 ? Number(o.days) : DAYS;
    var now = Number(o.now) || Date.now();
    var since = now - days * DAY;
    var q = str(o.query).toLowerCase();
    var laborOnly = o.chip !== 'all';
    var list = (Array.isArray(rows) ? rows : []).filter(function (r) {
      if (!obj(r)) return false;
      if (!(Number(r.d) >= since)) return false;   // 날짜가 이상한 줄(NaN)도 여기서 빠진다
      if (laborOnly && !isLabor(r)) return false;
      if (q && (str(r.who) + ' ' + str(r.from) + ' ' + str(r.s)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      return (Number(b.d) - Number(a.d)) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0) || (Number(a.uid) - Number(b.uid));
    });
    return { list: list.slice(0, MAX_ROWS), total: list.length, more: list.length > MAX_ROWS };
  }

  /* ── html → 글자 ── 태그를 걷고(줄 끝 태그는 줄바꿈), 글자 엔티티를 푼다. 결과는 «글자»로만 쓴다(html 로 되돌려 넣지 않는다) */
  function htmlToText(html) {
    var s = str(html);
    if (!s) return '';
    s = s.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&amp;/gi, '&');
    return s.replace(/\r\n?/g, '\n').replace(/[ \t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── 네 칸 뽑기 ── */
  /* 인용된 답장은 우리 쪽 글이다 — 「>」 줄은 버리고, 원본 표지(Original Message·원본 메일·…wrote:) 아래는 통째로 버린다 */
  var CUT_RES = [/^\s*[-_=*]{2,}\s*(original message|원본\s*(메일|메시지)|forwarded message)/i, /^\s*on\s.+wrote:\s*$/i];
  function cleanLines(text) {
    var out = [], lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (CUT_RES.some(function (re) { return re.test(ln); })) break;
      if (/^\s*>/.test(ln)) continue;
      out.push(ln.replace(/\s+$/, ''));
    }
    return out;
  }

  /* 사람 이름 꼴인가 — 한글 2~4자, 직함·부서·안내 낱말이 아니다.
     한 글자 끝말(국·실·팀…)은 사람 이름에도 흔하다(예: 김○국) — 4자 이상일 때와 흔한 부서 낱말일 때만 부서로 본다 */
  var TITLE_RE = /(주무관|사무관|감독관|조사관|서기관|심판관|팀장|과장|계장|국장)$/;
  var DEPT_LONG_RE = /(센터|위원회|지청|공단|본부|지사|사무소)$/;
  var DEPT_SHORT_RE = /(부|청|과|팀|국|실|처)$/;
  var DEPT_WORDS = ['민원실', '총무과', '기획과', '감독과', '지원팀', '운영팀', '관리과', '정책과', '민원과', '조사과', '심판과'];
  var NOT_NAME = ['부서', '업무', '사항', '안내', '기관', '연락처', '전화', '팩스', '이메일', '문의', '확인', '참조', '관련', '내용', '메일', '주소', '배정', '지정', '조사', '출석', '명단'];
  function okName(v) {
    v = str(v);
    if (!/^[가-힣]{2,4}$/.test(v)) return false;
    if (NOT_NAME.indexOf(v) >= 0 || DEPT_WORDS.indexOf(v) >= 0) return false;
    if (TITLE_RE.test(v) || (v.length >= 3 && DEPT_LONG_RE.test(v))) return false;
    if (v.length >= 4 && DEPT_SHORT_RE.test(v)) return false;
    return true;
  }
  /* 보낸 사람 표시(가나다/천안지청 · 가나다 주무관 · 가나다(고용노동부))를 토큰으로 */
  function headerTokens(who) {
    return str(who).replace(/\([^)]*\)|\[[^\]]*\]|<[^>]*>/g, ' ').split(/[\/,·|]+|\s+/).map(str).filter(Boolean);
  }

  var OFFICER_RES = [
    /(?:담당자|담당관|담당|근로감독관|감독관|조사관|심판관|주무관|사무관)\s*[:：]\s*([가-힣]{2,4})(?![가-힣])/g,
    /(?:근로감독관|감독관|조사관|심판관|주무관|사무관)\s+([가-힣]{2,4})(?![가-힣])/g
  ];
  var ORG_RE = new RegExp('(' + [
    '[가-힣]{2,8}지방고용노동청\\s+[가-힣]{2,6}(?:지청|지사)',
    '[가-힣]{2,10}(?:지방고용노동청|고용노동지청|고용노동청|지방노동위원회|노동위원회)',
    '근로복지공단(?:\\s*[가-힣]{2,8}(?:지역본부|지사|본부))?',
    '[가-힣]{2,6}지청',
    '[가-힣]{2,6}지사'
  ].join('|') + ')');
  var ORG_TOKEN_RE = /(지방고용노동청|고용노동지청|고용노동청|지방노동위원회|노동위원회|근로복지공단|지청|지사)$/;

  /* 전화 — 지역번호·휴대폰(구분은 - . ) 중 하나)과 대표번호(1588-0075 꼴). 숫자만 이어진 긴 글은 안 본다 */
  var PHONE_RE = /(?:^|[^\d-])(0\d{1,2}[-.)]\s?\d{3,4}[-.]\d{4}|1[5-9]\d{2}-\d{4})(?!\d)/g;
  var FAX_BEFORE_RE = /(?:팩스|fax|(?:^|[^A-Za-z])F)\s*[:.)]*\s*$/i;
  var PHONE_LABEL_RE = /(전화|연락처|문의|직통|대표|TEL|☎|(?:^|[^A-Za-z])T\s*[.:])/i;
  function fmtPhone(raw) {
    var d = String(raw).replace(/\D/g, '');
    if (/^1[5-9]\d{6}$/.test(d)) return d.slice(0, 4) + '-' + d.slice(4);
    if (d.length < 9 || d.length > 11) return '';
    var a = d.slice(0, 2) === '02' ? 2 : 3;
    return d.slice(0, a) + '-' + d.slice(a, d.length - 4) + '-' + d.slice(-4);
  }

  /* 줄 모음에서 찾기 — 서명 칸(끝의 비지 않은 SIG_LINES 줄)을 먼저, 없으면 나머지 본문. 찾은 곳을 '서명'|'본문' 으로 돌려준다 */
  function regions(lines) {
    var sig = [], rest = [], seen = 0, i;
    for (i = lines.length - 1; i >= 0; i--) {
      if (str(lines[i]) && seen < SIG_LINES) { sig.unshift(lines[i]); seen++; }
      else rest.unshift(lines[i]);
    }
    return [{ where: '서명', lines: sig }, { where: '본문', lines: rest }];
  }
  function findIn(regs, fn) {
    for (var r = 0; r < regs.length; r++) {
      for (var i = 0; i < regs[r].lines.length; i++) {
        var v = fn(regs[r].lines[i]);
        if (v) return { val: v, where: regs[r].where };
      }
    }
    return null;
  }
  function findOfficer(line) {
    for (var i = 0; i < OFFICER_RES.length; i++) {
      var re = new RegExp(OFFICER_RES[i].source, 'g'), m;
      while ((m = re.exec(line))) if (okName(m[1])) return m[1];
    }
    return '';
  }
  function findOrg(line) { var m = ORG_RE.exec(line); return m ? str(m[1]).replace(/\s+/g, ' ') : ''; }
  /* 전화는 «라벨 있는 것 먼저» — 서명 라벨 → 본문 라벨 → 서명 아무거나 → 본문 아무거나. 팩스 표시 바로 뒤의 번호는 전화가 아니다 */
  function findPhone(regs) {
    var tiers = [[], [], [], []];   // 서명·라벨 / 본문·라벨 / 서명 / 본문
    regs.forEach(function (reg, ri) {
      reg.lines.forEach(function (ln) {
        var re = new RegExp(PHONE_RE.source, 'g'), m;
        while ((m = re.exec(ln))) {
          var start = m.index + m[0].length - m[1].length;
          var before = ln.slice(Math.max(0, start - 12), start);
          if (FAX_BEFORE_RE.test(before)) continue;
          var p = fmtPhone(m[1]);
          if (!p) continue;
          tiers[(PHONE_LABEL_RE.test(before) ? 0 : 2) + ri].push({ val: p, where: reg.where });
        }
      });
    });
    for (var t = 0; t < tiers.length; t++) if (tiers[t].length) return tiers[t][0];
    return null;
  }

  function extract(m) {
    m = obj(m) ? m : {};
    var out = { org: '', officer: '', phone: '', email: '', src: { org: '', officer: '', phone: '', email: '' } };
    /* 본문 글자 — text 가 있으면 그것, 비었으면(html 뿐인 메일) html 을 글자로. html 의 인용 상자(blockquote)는 먼저 버린다 */
    var text = str(m.text) || htmlToText(String(m.html == null ? '' : m.html).replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ''));
    var regs = regions(cleanLines(text));

    var o = findIn(regs, findOfficer);
    if (o) { out.officer = o.val; out.src.officer = o.where; }
    var g = findIn(regs, findOrg);
    if (g) { out.org = g.val; out.src.org = g.where; }
    var p = findPhone(regs);
    if (p) { out.phone = p.val; out.src.phone = p.where; }

    /* 본문에 단서가 없을 때만 보낸 사람 표시에서 — 담당자는 이름 꼴 토큰, 기관은 기관 끝말 토큰 */
    var tokens = headerTokens(m.who);
    if (!out.officer) {
      for (var i = 0; i < tokens.length; i++) if (okName(tokens[i])) { out.officer = tokens[i]; out.src.officer = '보낸 사람 이름'; break; }
    }
    if (!out.org) {
      for (var j = 0; j < tokens.length; j++) if (ORG_TOKEN_RE.test(tokens[j])) { out.org = tokens[j]; out.src.org = '보낸 사람 표시'; break; }
    }
    /* 이메일은 늘 보낸 주소 — 자동발송·우리 주소는 비운다 */
    var from = addrOf(m.from);
    if (from && !OWN_RE.test(from) && !NOREPLY_RE.test(from)) { out.email = from; out.src.email = '보낸 주소'; }
    return out;
  }

  /* ── 현재값과 견주기 · 합치기 ── */
  function norm(k, v) {
    v = str(v);
    if (k === 'phone') return v.replace(/\D/g, '');
    if (k === 'email') return v.toLowerCase();
    return v.replace(/\s+/g, ' ');
  }
  /* state — fill: 현재 빔·새 값 있음 / same: 견주어 같음 / change: 둘 다 있고 다름 / miss: 새 값 없음 */
  function diff(cur, next) {
    cur = obj(cur) ? cur : {}; next = obj(next) ? next : {};
    return FIELDS.map(function (k) {
      var c = str(cur[k]), n = str(next[k]), state;
      if (!n) state = 'miss';
      else if (!c) state = 'fill';
      else state = norm(k, c) === norm(k, n) ? 'same' : 'change';
      return { k: k, label: LABELS[k], cur: c, next: n, state: state };
    });
  }
  /* 기본 선택: fill → 'new'(채움), change → 'keep'(그대로 두기). 새 값이 빈 칸(miss)은 무엇을 골라도 기존 값을 덮지 않는다 */
  function merge(cur, next, picks) {
    var base = obj(cur) ? cur : {}, out = {}, pk = obj(picks) ? picks : {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    FIELDS.forEach(function (k) { if (out[k] == null) out[k] = ''; });
    diff(base, next).forEach(function (x) {
      var pick = pk[x.k] || (x.state === 'fill' ? 'new' : 'keep');
      if ((x.state === 'fill' || x.state === 'change') && pick === 'new') out[x.k] = x.next;
    });
    return out;
  }

  var api = { DAYS: DAYS, MAX_ROWS: MAX_ROWS, FIELDS: FIELDS, LABELS: LABELS, BOX_KINDS: BOX_KINDS,
    mailRows: mailRows, isLabor: isLabor, candidates: candidates, htmlToText: htmlToText,
    extract: extract, diff: diff, merge: merge };
  if (isNode) module.exports = api;
  else root.PuCaseJurMail = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
