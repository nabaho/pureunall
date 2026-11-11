/* 📨 우리 견적서·계약서 메일 찾기 — 감지 셈 «한 벌» (견적·계약 자동화 계획 3 · 작업 1, 2026-11-08)
   ═════════════════════════════════════════════════════════════════
   총괄관리자 가져오기(js/pu-quote-import.js)와 서버 감지 훅(functions/mail-quote-watch.js)이 «같은 판정»을 쓴다.
   두 벌로 두면 한쪽만 고쳐져, 화면은 견적으로 안 보는 메일을 서버가 이알피로 올린다.
   ⚠ 서버에는 js/ 가 안 올라간다 — functions/quote-detect-core/ 에 «글자 그대로» 사본을 둔다.
     고칠 곳은 늘 여기(js/)다. 고친 뒤:  node scripts/sync-quote-detect-core.js  → 이것을 쓰는 서버 함수를 다시 배포.
     tests/quote-detect-core-in-sync.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 이 파일은 «제목·첨부 이름·받는 주소»만 본다. 본문·첨부 내용·금액은 읽지 않는다(AI 도 부르지 않는다).
   ⚠ 사진첩·메일함의 js/pu-doc-pick.js «빼는 말»(「견적」 포함 — 견적서는 기업정보함 서류가 아님)과는 목적이 달라
     건드리지 않는다. 여기는 «우리가 보낸 견적서·계약서 찾기»다.
   ⚠ 예시는 가짜다(가나상사·홍길동). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuQuoteDetect = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* 남의 견적(우리가 «달라고» 하는 메일·견적 의뢰·물품 견적)은 우리 견적이 아니다 */
  var EXCL_QUOTE = /비교\s*견적서?\s*(요청|작성|회신)|견적\s*(의뢰|요청)|상품\s*견적|루나랩/;
  var QUOTE_RE = /견적|수임료\s*안내|비용\s*안내|보수\s*안내|수수료\s*안내/;
  var CONTRACT = /(자문|위임|용역|컨설팅|교육|강의|위탁|대행|고문|직장\s*내\s*괴롭힘(\s*조사)?|괴롭힘(\s*조사)?|성희롱(\s*조사)?|진상\s*조사|조사|노무\s*진단|조직\s*진단|진단|기금(\s*설립)?|설립\s*지원|단체\s*교섭|임금\s*교섭|교섭|법률\s*의견|노무\s*의견|의견서|산업\s*안전|중대\s*재해|안전\s*보건|급여\s*관리|아웃소싱|사무\s*위탁|업무\s*대행|변경|갱신|연장)\s*(계약서|약정서|합의서|협약서)|위임\s*약정|약정서\s*(및\s*위임장)?|(변경|갱신|연장)\s*합의|업무\s*협약서/;
  var NOT_CONTRACT = /(근로|연봉|급여|촉탁)\s*계약서/;
  var SIGNED_HINT = /체결|서명|날인|도장|직인|확정|스캔|회신|날인본|서명본|계약\s*완료/;
  /* 비교견적 — 제목에 «견적서 요청/작성»이 있으면 우리가 남에게 달라고 한 것, «회신/제출»이면 남이 낸 것 */
  var COMPARE = /비교\s*견적/;
  var COMPARE_ASK = /비교\s*견적서?\s*(요청|작성)/;
  var COMPARE_REPLY = /비교\s*견적서?\s*(회신|제출)/;

  function s(v) { return String(v == null ? '' : v); }
  function nfc(v) { var t = s(v); return t.normalize ? t.normalize('NFC') : t; }

  /* 메일 줄의 첨부 이름 → 배열. 배열·«0,1,2» 열쇠 지도·JSON 글자 셋 다 받는다 */
  function namesOf(an) {
    var v = an;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return []; } }
    if (v && !Array.isArray(v) && typeof v === 'object') v = Object.keys(v).sort(function (a, b) { return a - b; }).map(function (k) { return v[k]; });
    return Array.isArray(v) ? v.map(s).filter(Boolean) : [];
  }
  function joined(attNames) { return namesOf(attNames).join(' '); }

  function words(subject, attNames) { return (s(subject) + ' ' + joined(attNames)).replace(/_/g, ' '); }

  /* 제목·첨부 이름에 «견적·수임료 안내» — 단 남의 견적(비교견적 요청·견적 의뢰·물품 견적)은 제목으로 거른다 */
  function isOurQuote(subject, attNames) {
    var subj = s(subject).replace(/_/g, ' ');
    if (EXCL_QUOTE.test(subj)) return false;
    return QUOTE_RE.test(words(subject, attNames));
  }
  /* 「자문·위임·용역·컨설팅·괴롭힘조사·산업안전·기금·단체교섭·변경합의 등 우리 계약서」 — 근로계약서는 아니다 */
  function isOurContract(subject, attNames) {
    var t = words(subject, attNames);
    if (NOT_CONTRACT.test(t)) return false;
    return CONTRACT.test(t);
  }
  /* 확정·서명·날인·회신 단서가 있는 우리 계약서 메일인지 판별 */
  function isSignedContract(subject, attNames) {
    if (!isOurContract(subject, attNames)) return false;
    return SIGNED_HINT.test(words(subject, attNames));
  }
  /* 한 메일이 견적도 계약서도 말하면 계약서가 이긴다(메일 하나에 기록 하나) */
  function docOf(subject, attNames) {
    if (isOurContract(subject, attNames)) return 'contract';
    if (isOurQuote(subject, attNames)) return 'quote';
    return '';
  }

  /* 비교견적 «단서» — 판정이 아니라 사람이 확인할 표시 후보다(헷갈리면 사람이 표시한다).
       'bundle' 우리 견적서 메일에 비교견적서가 붙거나 제목에 비교견적이 들었다(고객에게 낼 묶음)
       'asked'  우리가 다른 법인에 «비교견적서 요청»을 보낸 메일 — 카드를 만들지 않고 그 건의 근거로만 쓴다
       'reply'  비교견적서 회신·제출 글
       ''       비교견적과 상관 없음
     ⚠ 낱말(비교견적)만으로 가르지 않는다 — 우리 견적서인지(isOurQuote)를 먼저 본다. */
  function compareHint(subject, attNames) {
    var subj = s(subject), t = subj + ' ' + joined(attNames);
    if (!COMPARE.test(t)) return '';
    if (isOurQuote(subj, attNames)) return 'bundle';
    if (COMPARE_ASK.test(subj)) return 'asked';
    if (COMPARE_REPLY.test(subj)) return 'reply';
    return '';
  }

  /* 받는 주소 줄(t) → 소문자 주소 목록(중복 없이). «이름 <주소>» 모양도 받는다 */
  function addrsOf(t) {
    var out = [];
    s(t).split(/[,;]/).forEach(function (part) {
      var m = /([^\s<>"',;]+@[^\s<>"',;]+)/.exec(part);
      var a = m ? m[1].toLowerCase().replace(/[)\].]+$/, '') : '';
      if (a && out.indexOf(a) < 0) out.push(a);
    });
    return out;
  }
  function domainOf(addr) { var m = /@([^@\s>]+)/.exec(s(addr)); return m ? m[1].toLowerCase() : ''; }

  return {
    EXCL_QUOTE: EXCL_QUOTE, QUOTE_RE: QUOTE_RE, CONTRACT: CONTRACT, NOT_CONTRACT: NOT_CONTRACT, SIGNED_HINT: SIGNED_HINT,
    s: s, nfc: nfc, namesOf: namesOf, isOurQuote: isOurQuote, isOurContract: isOurContract, isSignedContract: isSignedContract, docOf: docOf,
    compareHint: compareHint, addrsOf: addrsOf, domainOf: domainOf
  };
});
