/* 취업규칙 — 「📚 조별 문안」 셈 (설계 §6-2 · 2026-10-04 목업 2 「추천대로」)
   순수 모듈. 가린 규칙 본문을 조로 쪼개고, 조 제목을 «주제»로 모으고, 같은 글끼리 묶는다.
   ⚠ «같은 글» = 회사 이름·호칭(사원/근로자/직원/종업원)·띄어쓰기·조 번호·문장부호 띄움만 다른 것.
     숫자·낱말이 하나라도 다르면 다른 글 — 「15일」과 「12일」을 한 덩어리로 묶으면 위반을 덮는다. */
(function (root) {
  'use strict';
  // ⚠ 조 번호 바로 뒤에 조사(에·의·을…)·「제」·쉼표가 오면 머리가 아니라 «상호참조»다.
  //   줄이 접혀 「제5조에 따라 …」 가 줄 머리에 오면 새 조로 오인해 앞 조를 자르고 진짜 제5조를 덮어쓴다.
  var NOT_REF = '(?![에의을를과와로은는이가도및제,，·、])';
  var HEAD_RE = new RegExp('^[ \\t]*제\\s*(\\d+)\\s*조(?:\\s*의\\s*(\\d+))?' + NOT_REF + '\\s*(?:[(（【\\[〔]([^)）】\\]〕\\n]{1,40})[)）】\\]〕])?', 'gm');
  var STRIP_HEAD = new RegExp('^\\s*제\\s*\\d+\\s*조(?:\\s*의\\s*\\d+)?' + NOT_REF + '\\s*(?:[(（【\\[〔][^)）】\\]〕\\n]{0,40}[)）】\\]〕])?\\s*');
  var CHAPTER_RE = /^[ \t]*(제\s*\d+\s*장[^\n]*)$/;
  // 목차 점선(····1)이나 쪽 번호만 있는 줄은 조 본문이 아니다 — 본문보다 점선이 길어 본문을 덮어쓰던 구멍을 막는다.
  var TOC_ONLY_RE = /^[ \t·.…‥ㆍ․‧・─━\-_]*\d*[ \t]*$/;
  // 조 끝에 붙은 다음 장·절·편·부칙 머리(빈 줄 건너뛰기·「제15 기 타」처럼 장 글자가 빠진 줄 포함)를 걷어 낸다.
  var CHAP_LINE_RE = /^[ \t]*(?:제\s*\d+\s*(?:[장절편][^\n]*|[ \t]+[가-힣][^\n]{0,20})|(?:부\s*칙|附\s*則)[ \t·.…‥ㆍ․‧・─━\-_\d]*)$/;
  var SYN = { '연차휴가': '연차유급휴가', '연차': '연차유급휴가', '휴게시간': '휴게', '정년퇴직': '정년' };

  function str(v) { return v == null ? '' : String(v); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function trimTrailingChapters(s) {
    var lines = str(s).split('\n');
    while (lines.length) {
      var last = lines[lines.length - 1].trim();
      if (!last || CHAP_LINE_RE.test(last)) lines.pop();
      else break;
    }
    return lines.join('\n').trim();
  }
  function bodyCore(body) {
    var s = trimTrailingChapters(body).replace(STRIP_HEAD, '').trim();
    return (!s || !/[가-힣一-龥A-Za-z]/.test(s) || TOC_ONLY_RE.test(s)) ? '' : s;
  }

  function splitArticles(text) {
    var t = str(text).replace(/\r\n?/g, '\n');
    var ms = [], m;
    HEAD_RE.lastIndex = 0;
    while ((m = HEAD_RE.exec(t))) ms.push({ i: m.index, num: +m[1], sub: m[2] ? +m[2] : null, title: str(m[3]).trim() });
    // ⚠ 목차 끝에 있는 「부 칙」 줄에서 멈추면 뒤쪽 진짜 본문 전체가 통째로 잘린다.
    //   앞에 실제 본문이 있는 조가 하나 이상 나온 뒤에 오는 「부칙」에서만 멈춘다.
    var bRe = /^[ \t]*(?:제\s*\d+\s*장[.\s]*)?(부\s*칙|附\s*則)(?=[ \t.<(\[【]|$)/gm, bm, end = t.length;
    while ((bm = bRe.exec(t))) {
      var bIdx = bm.index, hasReal = false;
      for (var k = 0; k < ms.length && ms[k].i < bIdx; k++) {
        var nextI = (k + 1 < ms.length && ms[k + 1].i < bIdx) ? ms[k + 1].i : bIdx;
        if (bodyCore(t.slice(ms[k].i, nextI)).length >= 5) { hasReal = true; break; }
      }
      if (hasReal) { end = bIdx; break; }
    }
    var byLabel = {}, order = [], titleHint = {};
    ms.forEach(function (x, k) {
      if (x.i >= end) return;
      var label = '제' + x.num + '조' + (x.sub ? '의' + x.sub : '');
      if (x.title && !titleHint[label]) titleHint[label] = x.title;
      var e = (k + 1 < ms.length && ms[k + 1].i < end) ? ms[k + 1].i : end;
      var body = trimTrailingChapters(t.slice(x.i, e));
      var core = bodyCore(body);
      if (!core) return;   // 목차 줄(본문 없음·점선만 있음)은 버린다
      var a = { num: x.num, sub: x.sub, label: label, title: x.title || titleHint[label] || '', body: body };
      if (!byLabel[label]) { byLabel[label] = a; order.push(label); }
      else if (core.length > bodyCore(byLabel[label].body).length) {
        byLabel[label] = a;   // 목차 줄보다 실제 본문 — 차례도 실제 본문 위치로 옮긴다
        order.splice(order.indexOf(label), 1);
        order.push(label);
      }
    });
    return order.map(function (l) { return byLabel[l]; });
  }
  function topicKey(title) {
    // 한글 문서의 가운뎃점 변형(· ㆍ ․ ‧ ・)을 모두 걷어 표준 주제와 맞춘다.
    var k = str(title).replace(/[\s·ㆍ․‧・,()（）]/g, '').replace(/등$/, '');
    return SYN[k] || k;
  }
  function topicOrder(stdText) {
    var lines = str(stdText).replace(/\r\n?/g, '\n').split('\n');
    var arts = splitArticles(stdText), seen = {}, out = [], chapter = '', ai = 0;
    var firstLine = {};
    arts.forEach(function (a) { firstLine[a.label] = a.body.split('\n')[0].trim(); });
    lines.forEach(function (ln) {
      var c = ln.match(CHAPTER_RE);
      if (c) { chapter = c[1].replace(/\s+/g, ' ').trim(); return; }
      while (ai < arts.length && ln.trim() === firstLine[arts[ai].label]) {
        var a = arts[ai++], k = topicKey(a.title);
        if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, title: a.title, chapter: chapter }); }
      }
    });
    return out;
  }
  // 토큰 뒤 조사는 받침 때문에 갈린다(사원은/근로자는, 가나상사는/나다물산은) — 한 모양으로 맞춘다.
  // 뒤에 한글이 이어지면 조사가 아니라 낱말의 일부(은행·이다)이므로 건드리지 않는다.
  function josa(t, tag) {
    var T = esc(tag);
    return t.replace(new RegExp(T + '(은|는)(?![가-힣])', 'g'), tag + '는')
      .replace(new RegExp(T + '(이|가)(?![가-힣])', 'g'), tag + '가')
      .replace(new RegExp(T + '(을|를)(?![가-힣])', 'g'), tag + '를')
      .replace(new RegExp(T + '(과|와)(?![가-힣])', 'g'), tag + '와');
  }
  // 회사 이름 — (주)·㈜·주식회사·유한회사와 띄어쓰기를 걷어 낸 뒤 두 글자 이상일 때만 쓴다.
  // 💡 우리 문안(view-recommend)이 대표 글의 회사 이름을 이 회사 이름으로 바꿀 때도 «같은 잣대»로 쓴다 — 그래서 내보낸다.
  function coCore(name) {
    return str(name).replace(/\(\s*[주유]\s*\)|[㈜㈲]|주식회사|유한회사|유한책임회사/g, '').replace(/\s+/g, '');
  }
  var CORP_TAG = '(?:주식회사|유한책임회사|유한회사|사단법인|재단법인|사회복지법인|의료법인|\\(\\s*[주유사재의]\\s*\\)|[㈜㈲])';
  // 「○○(이하 "회사/당사/본원/법인…"이라 한다)」 앞의 기관·회사 이름 — 미확정 문서이거나 시설명이 달라도 {회사}로 맞춘다.
  var ALIAS_PAREN = '(?=\\s*\\(\\s*이하\\s*["\'“”‘’「『\\uDB82\\uDC50-\\uDC53]?(?:회사|당사|본원|본사|법인|공단|공사|센터|시설|병원|의원|학원|조합|연구원|사업단|사업장)["\'“”‘’」』\\uDB82\\uDC50-\\uDC53]?(?:\\s*(?:등|이?라)\\s*(?:한다|칭한다|함))?[.\\s]*\\))';
  var CORP_ALIAS_RE = new RegExp(
    '(?:' + CORP_TAG + '\\s*[가-힣A-Za-z0-9○◯ㅇO0][가-힣A-Za-z0-9○◯ㅇO0\\s&·.-]{0,25}?|[가-힣A-Za-z0-9○◯ㅇO0]{2,20}\\s*' + CORP_TAG + ')'
    + '(?:\\([A-Za-z0-9가-힣&.\\s-]{1,20}\\))?' + ALIAS_PAREN,
    'g'
  );
  var AFTER_CUE_ALIAS_RE = new RegExp(
    '((?:취업규칙은|규칙은|규정은|지침은|\\)\\s*[은는]|따라|의거하여|의거|의하여|으로써|으로서)\\s+)'
    + '((?:(?!(?:규칙은|규정은|법령에|법에|따라|의거|근로기준법))[가-힣A-Za-z0-9○◯ㅇO0()㈜㈲&·.\\s-]){2,30}?)'
    + ALIAS_PAREN,
    'g'
  );
  var STANDALONE_CORP_RE = new RegExp(
    CORP_TAG + '\\s*[○◯ㅇO0]{2,5}'
    + '|[○◯ㅇO0]{2,5}\\s*' + CORP_TAG
    + '|' + CORP_TAG + '\\s*[가-힣A-Za-z0-9]{1,20}(?:\\([A-Za-z0-9&.\\s-]{1,15}\\))?',
    'g'
  );
  function normText(body, coName) {
    var t = bodyCore(body).replace(/\uDB82[\uDC50-\uDC53]/g, '"').replace(/\s+/g, ' ').trim();
    var co = coCore(coName);
    if (co.length >= 2) {
      var coPat = '(?:' + CORP_TAG + '\\s*)?' + esc(co) + '(?:\\s*' + CORP_TAG + ')?(?:\\s*\\([A-Za-z0-9가-힣&.\\s-]{1,15}\\))?';
      t = t.replace(new RegExp(coPat, 'g'), '{회사}');
    }
    t = t.replace(CORP_ALIAS_RE, '{회사}');
    t = t.replace(AFTER_CUE_ALIAS_RE, '$1{회사}');
    t = t.replace(STANDALONE_CORP_RE, '{회사}');
    t = t.replace(/\{회사\}(?:\s*\{회사\})+/g, '{회사}');
    t = josa(t, '{회사}');
    // 호칭은 복합어(사원증·근로자대표) 안의 것도 일부러 한꺼번에 맞춘다 — 같은 글 판정은 호칭 차이를 무시하는 규칙이다.
    t = josa(t.replace(/사원|근로자|직원|종업원/g, '{근로자}'), '{근로자}');
    return t;
  }
  function normKey(body, coName) { return normText(body, coName).replace(/\s+/g, ''); }
  function groupVariants(entries) {
    var map = Object.create(null), list = [];   // 열쇠가 「constructor」 같아도 안전하게
    (entries || []).forEach(function (e) {
      var k = normKey(e.body, e.companyName);
      if (!k) return;                           // 빈 본문은 덩어리로 만들지 않는다
      if (!map[k]) { map[k] = { key: k, text: '', members: [], finals: 0, last: 0 }; list.push(map[k]); }
      var g = map[k];
      g.members.push(e);
      if (e.final) g.finals++;
      g.last = Math.max(g.last, Number(e.date) || 0);
    });
    list.forEach(function (g) {
      g.members.sort(function (a, b) { return (b.final ? 1 : 0) - (a.final ? 1 : 0) || (Number(b.date) || 0) - (Number(a.date) || 0); });
      g.text = normText(g.members[0].body, g.members[0].companyName);
    });
    return list.sort(function (a, b) { return b.finals - a.finals || b.members.length - a.members.length || b.last - a.last; });
  }
  function clip(s) { s = s.replace(/\s+/g, ' ').trim(); return s.length > 24 ? s.slice(0, 24) + '…' : s; }
  function diffSummary(segs) {
    var del = (segs || []).filter(function (x) { return x.t === '-' && x.s.trim(); });
    var add = (segs || []).filter(function (x) { return x.t === '+' && x.s.trim(); });
    if (del.length === 1 && add.length === 1 && del[0].s.length <= 12 && add[0].s.length <= 12) return del[0].s.trim() + ' → ' + add[0].s.trim();
    if (!del.length && add.length) return '덧붙임: ' + clip(add.map(function (x) { return x.s; }).join(' '));
    if (del.length && !add.length) return '빠짐: ' + clip(del.map(function (x) { return x.s; }).join(' '));
    return '바뀐 곳 ' + Math.max(del.length, add.length);
  }
  var api = { splitArticles: splitArticles, topicKey: topicKey, topicOrder: topicOrder, normText: normText,
    normKey: normKey, groupVariants: groupVariants, diffSummary: diffSummary, coCore: coCore, bodyCore: bodyCore };
  if (root) root.PuRulesV2Topics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
