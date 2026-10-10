'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 (브라우저 window.PuGovReportAi / Node 겸용)
   (대표 「추천대로」 2026-10-10 · 설계 docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-step3-ai-draft.md)
   무엇을 지키나
     · 밖(Anthropic)으로 나가는 글은 모두 가린다 — 주민·전화·메일·계좌·사업자번호는 [가림](되돌리지 않는다),
       업체·대표자·담당자 이름은 대괄호 자리 표시([해당 기업]·[대표자]·[담당자])로 바꾸고 받은 글에서 되돌린다.
       (맨 낱말 「대표자」로 바꾸면 되돌릴 때 보통 글의 「대표자」까지 사람 이름이 된다 — 그래서 대괄호)
     · 양식이 쓰지 않는 칸은 보내지도 받지도 않는다(USES — pu-gov-report.js buildValues 와 검사가 대조한다).
     · 사람이 쓴 칸은 덮지 않는다 — 비었거나 전에 AI 가 넣고 사람이 손대지 않은 칸만.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  /* Task 2 의 buildRequest 가 양식 이름(FORMS[formKey].name)을 읽는다 */
  var G = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report.js') : root.PuGovReport;

  var GARIM = '[가림]';
  var NO_RECORD = '기록 없음 — 입력 필요';
  var ROUND_KEYS = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
  var SUMMARY_KEYS = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];
  /* 양식 파일마다 쓰는 칸 — buildValues 가 실제로 찍는 칸 */
  var USES = {
    'cci-north': { main: { rounds: ROUND_KEYS, summary: ['inquiryDiag', 'review', 'action', 'etc'] } },
    'cci-seosan': {
      visit: { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] },
      report: { rounds: [], summary: ['inquiryDiag', 'adviceAll'] },
    },
    techguard: { main: { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] } },
  };
  /* 칸별 글자 수 한도 — 기관 공식 한도가 아니라 양식 칸 크기에 맞춘 출발값(노무사 확인 필요) */
  var LIMITS = { inquiry: 300, diagnosis: 300, advice: 300, result: 300, next: 300,
    inquiryDiag: 600, review: 600, action: 600, etc: 300, adviceAll: 1000, overall: 600 };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function fieldsFor(formKey, fileKeys) {
    var u = USES[formKey];
    if (!u) return { rounds: [], summary: [] };
    var ks = (fileKeys && fileKeys.length) ? fileKeys : Object.keys(u), r = {}, s = {};
    ks.forEach(function (k) {
      var f = u[k]; if (!f) return;
      f.rounds.forEach(function (x) { r[x] = 1; });
      f.summary.forEach(function (x) { s[x] = 1; });
    });
    return { rounds: ROUND_KEYS.filter(function (x) { return r[x]; }), summary: SUMMARY_KEYS.filter(function (x) { return s[x]; }) };
  }

  /* 가리기 — 차례가 중요하다: 메일(숫자를 품을 수 있다) → 주민 → 사업자 → 전화 → 대표번호 → 긴 숫자열(계좌) */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var RRN_RE = /(?<!\d)\d{6}\s?-\s?[1-8]\d{6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g;
  var REP_RE = /(?<!\d)1[5-9]\d{2}-\d{4}(?!\d)/g;
  var LONG_RE = /\d[\d-]{8,}\d/g;          // 숫자가 10개 이상일 때만 가린다(날짜 2025-09-04 는 8개라 남는다)

  /* 이름 목록 — 2자 미만은 버린다. 「(주)가나상사」면 「가나상사」도 같은 자리 표시로 */
  function nameList(names) {
    var out = [];
    (names || []).forEach(function (n) {
      var v = str(n && n.v), as = str(n && n.as);
      if (v.length < 2 || !as) return;
      out.push({ v: v, as: as, orig: v });
      var core = v.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(합\)|합자회사/g, '').trim();
      if (core !== v && core.length >= 2) out.push({ v: core, as: as, orig: v });
    });
    return out;
  }
  function mask(text, names) {
    var t = String(text == null ? '' : text)
      .replace(EMAIL_RE, GARIM).replace(RRN_RE, GARIM).replace(BIZ_RE, GARIM)
      .replace(TEL_RE, GARIM).replace(REP_RE, GARIM)
      .replace(LONG_RE, function (m) { return m.replace(/\D/g, '').length >= 10 ? GARIM : m; });
    var list = nameList(names), back = [], seenAs = {};
    list.forEach(function (n) { if (!seenAs[n.as]) { seenAs[n.as] = 1; back.push({ as: n.as, v: n.orig }); } });
    /* 긴 이름부터 — 「(주)가나상사」를 「가나상사」보다 먼저 */
    list.slice().sort(function (a, b) { return b.v.length - a.v.length; })
      .forEach(function (n) { t = t.split(n.v).join(n.as); });
    return { text: t, back: back };
  }
  function unmask(text, back) {
    var t = String(text == null ? '' : text);
    (back || []).forEach(function (b) { if (b && b.as) t = t.split(b.as).join(String(b.v == null ? '' : b.v)); });
    return t;
  }

  var api = { fieldsFor: fieldsFor, mask: mask, unmask: unmask,
    ROUND_KEYS: ROUND_KEYS, SUMMARY_KEYS: SUMMARY_KEYS, USES: USES, LIMITS: LIMITS, GARIM: GARIM, NO_RECORD: NO_RECORD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
