/* 기업규정집 — 분류(취업규칙 · 노사협의회 · 단체협약)와 각 서식 갈래 (2026-11-01 대표 지시)
   순수 모듈. 서버 사본(functions/rules-daily-core/lib-set.js)은 scripts/sync-rules-daily-core.js 가 그대로 옮긴다.
   ★ 지키는 것
     · 취업규칙은 기존 서식 갈래(규칙본문·신구대조표·신고서·동의서·의견청취·기타)를 그대로 둔다.
     · 노사협의회와 단체협약은 취업규칙과 섞이지 않도록 분류(set)를 가르고, 각 서식(본문·신구대조표·회의록·위원·고충·합의·교섭·신고서·기타)을 따로 관리한다. */
(function (root) {
  'use strict';

  var SETS = ['취업규칙', '노사협의회', '단체협약'];
  var KINDS_BY_SET = {
    '취업규칙': ['규칙본문', '신구대조표', '신고서', '동의서', '의견청취', '기타'],
    '노사협의회': ['노사협의회', '신구대조표', '회의록', '위원·고충', '신고서', '기타'],
    '단체협약': ['단체협약', '신구대조표', '합의·교섭', '신고서', '기타']
  };
  var ALL_KINDS = ['규칙본문', '노사협의회', '단체협약', '신구대조표', '회의록', '위원·고충', '합의·교섭', '신고서', '동의서', '의견청취', '기타'];
  var KIND_LABEL = {
    '규칙본문': '규칙 본문',
    '노사협의회': '규정 본문',
    '단체협약': '협약 본문'
  };
  var BODY_KIND = {
    '취업규칙': '규칙본문',
    '노사협의회': '노사협의회',
    '단체협약': '단체협약'
  };

  var RULES_NAME_RE = /취업\s*규칙|취업\s*규정|사규|인사\s*규정|복무\s*규정/;
  var NOSA_NAME_RE = /노사\s*협의회|협의회\s*(?:운영\s*)?규정|협의\s*규정|노사\s*위원|근로자\s*위원|고충\s*처리/;
  var DANCHE_NAME_RE = /단체\s*협약|임금\s*협약|단협|단체\s*교섭|노조\s*제시안|임단협|보충\s*협약/;

  function str(v) { return v == null ? '' : String(v); }

  function setOf(doc, h) {
    h = h || {};
    doc = doc || {};
    if (h.setFix && SETS.indexOf(h.setFix) >= 0) return h.setFix;
    var kf = str(h.kindFix);
    if (kf === '노사협의회' || kf === '회의록' || kf === '위원·고충') return '노사협의회';
    if (kf === '단체협약' || kf === '합의·교섭') return '단체협약';
    if (kf === '규칙본문' || kf === '동의서' || kf === '의견청취') return '취업규칙';
    if (doc.set && SETS.indexOf(doc.set) >= 0) return doc.set;

    var k = str(doc.kind);
    if (k === '노사협의회' || k === '회의록' || k === '위원·고충') return '노사협의회';
    if (k === '단체협약' || k === '합의·교섭') return '단체협약';

    var nm = str(doc.name);
    var hasRules = RULES_NAME_RE.test(nm);
    if (!hasRules) {
      if (NOSA_NAME_RE.test(nm)) return '노사협의회';
      if (DANCHE_NAME_RE.test(nm)) return '단체협약';
    }
    if (hasRules) return '취업규칙';

    var subj = str(doc.mail && doc.mail.subject);
    if (subj && !RULES_NAME_RE.test(subj) && /신고|제출|회의록|위원|고충|비교표|대조|내역|합의|교섭|요구안|제시안/.test(nm)) {
      if (NOSA_NAME_RE.test(subj) && !DANCHE_NAME_RE.test(subj)) return '노사협의회';
      if (DANCHE_NAME_RE.test(subj) && !NOSA_NAME_RE.test(subj)) return '단체협약';
    }
    return '취업규칙';
  }

  function kindOf(doc, h) {
    h = h || {};
    doc = doc || {};
    if (h.kindFix) return str(h.kindFix);
    var s = setOf(doc, h);
    var nm = str(doc.name);
    var k = str(doc.kind);

    if (s === '노사협의회') {
      if (/신구|대조|비교표|변경\s*내역/.test(nm)) return '신구대조표';
      if (/신고|제출서/.test(nm) && !/협의\s*규정\s*및\s*신고|규정.*신고서\s*외/.test(nm)) return '신고서';
      if (k === '신고서') return '신고서';
      if (/회의록|의결|운영\s*계획|협의\s*결과/.test(nm)) return '회의록';
      if (/위원|선출|투표|위촉|고충/.test(nm)) return '위원·고충';
      if (/안내|가이드|매뉴얼|양식|서식|체크리스트/.test(nm)) return '기타';
      if (/노사\s*협의회|협의회\s*(?:운영\s*)?규정|운영\s*규정|협의\s*규정|규정|회칙/.test(nm)) return '노사협의회';
      if (k === '규칙본문' || k === '노사협의회') return '노사협의회';
      return KINDS_BY_SET['노사협의회'].indexOf(k) >= 0 ? k : '기타';
    }

    if (s === '단체협약') {
      if (/신구|대조|비교표|요구안|제시안|검토안|변경\s*내역/.test(nm)) return '신구대조표';
      if (/신고|제출서/.test(nm)) return '신고서';
      if (/합의|교섭|회의록|타결/.test(nm) && !/단체\s*협약|임금\s*협약|단협/.test(nm)) return '합의·교섭';
      if (/안내|가이드|매뉴얼|인터뷰\s*양식|체크리스트/.test(nm)) return '기타';
      if (/단체\s*협약|임금\s*협약|단협|보충\s*협약|협약서|협약/.test(nm)) return '단체협약';
      if (k === '규칙본문' || k === '단체협약') return '단체협약';
      return KINDS_BY_SET['단체협약'].indexOf(k) >= 0 ? k : '기타';
    }

    return k || '기타';
  }

  function kindsFor(set) {
    return KINDS_BY_SET[set] || ALL_KINDS;
  }

  function kindLabel(kind) {
    return KIND_LABEL[kind] || str(kind);
  }

  var api = {
    SETS: SETS,
    KINDS_BY_SET: KINDS_BY_SET,
    ALL_KINDS: ALL_KINDS,
    KIND_LABEL: KIND_LABEL,
    BODY_KIND: BODY_KIND,
    setOf: setOf,
    kindOf: kindOf,
    kindsFor: kindsFor,
    kindLabel: kindLabel
  };
  if (root) root.PuRulesV2Set = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
