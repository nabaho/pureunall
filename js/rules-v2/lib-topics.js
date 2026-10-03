/* 취업규칙 — 「📚 조별 문안」 셈 (설계 §6-2 · 2026-10-04 목업 2 「추천대로」)
   순수 모듈. 가린 규칙 본문을 조로 쪼개고, 조 제목을 «주제»로 모으고, 같은 글끼리 묶는다.
   ⚠ «같은 글» = 회사 이름·호칭(사원/근로자/직원/종업원)·띄어쓰기·조 번호·문장부호 띄움만 다른 것.
     숫자·낱말이 하나라도 다르면 다른 글 — 「15일」과 「12일」을 한 덩어리로 묶으면 위반을 덮는다. */
(function (root) {
  'use strict';
  var HEAD_RE = /^[ \t]*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?\s*(?:[(（]([^)）\n]{1,40})[)）])?/gm;
  var STRIP_HEAD = /^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:[(（][^)）\n]{0,40}[)）])?\s*/;
  var CHAPTER_RE = /^[ \t]*(제\s*\d+\s*장[^\n]*)$/;
  var SYN = { '연차휴가': '연차유급휴가', '연차': '연차유급휴가', '휴게시간': '휴게', '정년퇴직': '정년' };

  function str(v) { return v == null ? '' : String(v); }
  function splitArticles(text) {
    var t = str(text).replace(/\r\n?/g, '\n');
    var bm = t.match(/^[ \t]*(부\s*칙|附\s*則)\s*$/m);
    var end = bm ? bm.index : t.length;
    var ms = [], m;
    HEAD_RE.lastIndex = 0;
    while ((m = HEAD_RE.exec(t)) && m.index < end) ms.push({ i: m.index, num: +m[1], sub: m[2] ? +m[2] : null, title: str(m[3]).trim() });
    var byLabel = {}, order = [];
    ms.forEach(function (x, k) {
      var e = k + 1 < ms.length ? ms[k + 1].i : end;
      var body = t.slice(x.i, e).trim();
      var cm = body.match(/(?:\n[ \t]*제\s*\d+\s*[장절][^\n]*)+$/);
      if (cm) body = body.slice(0, cm.index).trim();
      var label = '제' + x.num + '조' + (x.sub ? '의' + x.sub : '');
      var a = { num: x.num, sub: x.sub, label: label, title: x.title, body: body };
      if (!byLabel[label]) { byLabel[label] = a; order.push(label); }
      else if (body.replace(STRIP_HEAD, '').length > byLabel[label].body.replace(STRIP_HEAD, '').length) byLabel[label] = a;   // 목차 줄보다 본문
    });
    return order.map(function (l) { return byLabel[l]; });
  }
  function topicKey(title) {
    var k = str(title).replace(/[\s·ㆍ,()（）]/g, '').replace(/등$/, '');
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
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function normText(body, coName) {
    var t = str(body).replace(STRIP_HEAD, '').replace(/\s+/g, ' ').trim();
    var co = str(coName).trim();
    if (co.length >= 2) t = t.replace(new RegExp(esc(co), 'g'), '{회사}');
    t = t.replace(/사원|근로자|직원|종업원/g, '{근로자}');
    t = t.replace(/\{근로자\}(은|는)/g, '{근로자}는').replace(/\{근로자\}(이|가)(?![가-힣])/g, '{근로자}가')
      .replace(/\{근로자\}(을|를)/g, '{근로자}를').replace(/\{근로자\}(과|와)/g, '{근로자}와');
    return t;
  }
  function normKey(body, coName) { return normText(body, coName).replace(/\s+/g, ''); }
  function groupVariants(entries) {
    var map = {}, list = [];
    (entries || []).forEach(function (e) {
      var k = normKey(e.body, e.companyName);
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
    normKey: normKey, groupVariants: groupVariants, diffSummary: diffSummary };
  if (root) root.PuRulesV2Topics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
