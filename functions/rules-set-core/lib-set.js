/* 기업규정집 — 규정 «분류» 셈 (2026-11-01 대표 「취업규칙을 기업규정집으로 하고 취업규칙·노사협의회·단체협약으로 분류」)
   순수 모듈. 아무것도 쓰지 않는다. 서버(functions/rules-set-core/)에도 «글자 그대로» 사본이 있다 — 고치면 scripts/sync-rules-set-core.js.

   ★ 지키는 것
     · 분류가 없는 서류는 «취업규칙»이다 — 지금까지 모은 것·사람이 손대지 않은 것이 그대로 취업규칙에 남는다(취업규칙은 기존대로).
     · 분류는 파일 이름이 먼저다. 이름에 아무 말이 없으면 글 머리(첫 300자 — 제목), 그래도 없으면 메일 제목, 끝내 모르면 취업규칙.
       ⚠ 글 «전체»는 보지 않는다 — 취업규칙 본문에도 「노사협의회」·「단체협약」이 상호참조로 나온다.
     · 한 글자 안에 여러 낱말이 있으면 «가장 앞에 나온 것»이 이긴다(「단체협약서(취업규칙 반영)」 → 단체협약).
     · 사람이 고친 값(human.setFix)이 서버가 찍은 값(doc.set)과 이름 짐작보다 앞선다.
     · scope 는 화면이 쓰는 «자료 덩어리»를 한 분류로 좁힌다 — 화면 부품(사업장·조별 문안·모은 자료)은 그대로 두고 넘기는 자료만 바꾼다. */
(function (root) {
  'use strict';
  var DEFAULT = '취업규칙';
  /* ns — 회차 레코드(rounds) id 의 이름공간. 취업규칙은 «빈 글자»라 지금 id 가 그대로다(co_r202606).
     ASCII 만 — 파이어베이스 열쇠에 한글·공백이 끼지 않게 */
  var SETS = [
    { key: '취업규칙', ns: '', icon: '📜', title: '취업규칙 — 작성·검토·개정·신고까지 도구가 있다' },
    { key: '노사협의회', ns: 'wc', icon: '🤝', title: '노사협의회 규정 — 모아서 보관·비교한다(검토·개정 도구는 아직 없다)' },
    { key: '단체협약', ns: 'cba', icon: '📑', title: '단체협약 — 모아서 보관·비교한다(검토·개정 도구는 아직 없다)' }
  ];
  /* 낱말 — 위에서부터 «가장 앞에 나온 것»이 이긴다. 단체협약의 「단협」은 줄임말 */
  var WORDS = [
    { key: '단체협약', re: /단체\s*협약|단협/ },
    { key: '노사협의회', re: /노사\s*협의|협의회\s*규정|근로자\s*참여\s*및?\s*협력/ },
    { key: '취업규칙', re: /취업\s*규칙/ }
  ];
  var HEAD = 300;

  function str(v) { return v == null ? '' : String(v); }
  function isKey(k) { for (var i = 0; i < SETS.length; i++) if (SETS[i].key === k) return true; return false; }
  function nsOf(key) { for (var i = 0; i < SETS.length; i++) if (SETS[i].key === key) return SETS[i].ns; return ''; }

  // 한 글자 안에서 «가장 앞에 나온» 분류 — 없으면 ''
  function firstIn(s) {
    s = str(s);
    var best = '', at = -1;
    WORDS.forEach(function (w) {
      var m = w.re.exec(s);
      if (m && (at < 0 || m.index < at)) { at = m.index; best = w.key; }
    });
    return best;
  }
  /* 이름 → 글 머리 → 메일 제목 → 취업규칙. 셋 다 «모르면 비워 두고» 다음으로 간다 */
  function setOfName(name, subject, text) {
    return firstIn(name) || firstIn(str(text).slice(0, HEAD)) || firstIn(subject) || DEFAULT;
  }
  /* 서류 하나의 분류 — 사람이 고친 값 > 서버가 찍은 값 > 이름 짐작(옛 서류는 찍힌 값이 없다) */
  function docSet(doc, human) {
    var d = doc || {}, h = human || {};
    if (isKey(h.setFix)) return h.setFix;
    if (isKey(d.set)) return d.set;
    return firstIn(d.name) || DEFAULT;
  }
  /* 자료 덩어리 {docs, human, rounds, …} 를 한 분류로 좁힌다 — 다른 칸(rounds·run·auto·index)은 그대로 건넨다.
     data.set·data.ns 를 달아 준다 — 회차 id 이름공간은 부품이 data.ns 로 읽는다 */
  function scope(data, key) {
    var d = data || {}, k = isKey(key) ? key : DEFAULT;
    var docs = {}, human = {};
    Object.keys(d.docs || {}).forEach(function (id) {
      var doc = d.docs[id];
      if (!doc || docSet(doc, (d.human || {})[id]) !== k) return;
      docs[id] = doc;
      if ((d.human || {})[id]) human[id] = d.human[id];
    });
    // 서류 없이 사람 칸만 남은 것(지워진 서류)은 넘기지 않는다 — merge 가 docs 를 기준으로 도는 것과 같다
    return Object.assign({}, d, { docs: docs, human: human, set: k, ns: nsOf(k) });
  }
  // 분류별 서류 수 — 「담김」·「보류」 모두(보류 줄도 모은 자료 갈래에 보인다)
  function counts(data) {
    var d = data || {}, c = {};
    SETS.forEach(function (s) { c[s.key] = 0; });
    Object.keys(d.docs || {}).forEach(function (id) {
      var doc = d.docs[id]; if (!doc) return;
      c[docSet(doc, (d.human || {})[id])]++;
    });
    return c;
  }

  var api = { DEFAULT: DEFAULT, SETS: SETS, WORDS: WORDS, HEAD: HEAD, isKey: isKey, nsOf: nsOf,
    firstIn: firstIn, setOfName: setOfName, docSet: docSet, scope: scope, counts: counts };
  if (root) root.PuRulesV2Set = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
