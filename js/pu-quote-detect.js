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
  /* ⚠ 「견적서 요청드립니다」·「○○ 견적서 요청의 건」처럼 견적 «다음에 서가 끼는» 말도 거른다(견적서? — 서는 있어도 없어도).
     비교견적서 «제출»도 남이 낸 것이다 — 빠지면 우리 견적(bundle)으로 잘못 읽는다. */
  /* 두 갈래로 나눈다(검토 2026-11-09):
       EXCL_STRONG — 제목만 봐도 «남의 견적»(비교견적서 요청·작성·회신·제출 · 물품 견적). 첨부가 있어도 우리 견적이 아니다.
       EXCL_ASK    — 「견적(서) 의뢰·요청」. 우리가 달라고 보낸 메일일 수도 있고, 고객이 「견적서 요청드립니다」를 보내 와 우리가
                     「RE: 견적서 요청드립니다」로 «견적서를 붙여 답한» 메일일 수도 있다 → 첨부에 «견적서» 파일(견적요청서가 아닌)이 있으면 우리 견적이다. */
  var EXCL_STRONG = /비교\s*견적서?\s*(요청|작성|회신|제출)|상품\s*견적|루나랩/;
  var EXCL_ASK = /견적서?\s*(의뢰|요청)/;
  /* 첨부 «이름»에서는 구분자(_ - . 공백)가 끼어도 같은 말이다 — 「견적서_요청.pdf」·「견적서-의뢰.hwp」 (검토 2026-11-09 2차) */
  var ASK_IN_NAME = /견적서?[\s_\-.]*(의뢰|요청)/;
  var EXCL_QUOTE = new RegExp(EXCL_STRONG.source + '|' + EXCL_ASK.source);   /* 제목만 본 «뺄 말» 전체(옛 이름 그대로 내보낸다) */
  var CONTRACT = /(자문|위임|용역|컨설팅|교육|위탁|대행)\s*계약서/;
  var NOT_CONTRACT = /근로계약서/;
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

  /* 제목·첨부 이름에 «견적» — 단 남의 견적(비교견적 요청·견적 의뢰·물품 견적)은 제목으로 거른다 */
  function isOurQuote(subject, attNames) {
    var subj = s(subject);
    if (EXCL_STRONG.test(subj)) return false;
    if (EXCL_ASK.test(subj)) {
      /* 요청받아 «견적서를 붙여 답한» 메일 — 첨부 이름에 「견적서」가 있고, 그 이름이 견적요청서·견적의뢰서 모양(구분자가 껴도)이 아니며,
         «비교견적서»(남이 낸 것)만이 아닐 때만 우리 견적이다. 비교견적서만 붙은 메일은 우리 견적의 근거가 아니다. */
      return namesOf(attNames).some(function (n) { return /견적서/.test(n) && !ASK_IN_NAME.test(n) && !COMPARE.test(n); });
    }
    /* 첨부 이름의 «견적»은 우리 견적서(비교견적서가 아닌 것)만 근거다 — 남이 낸 비교견적서만 붙은 메일(제목에 견적 없음)은 우리 견적이 아니다 */
    var own = namesOf(attNames).filter(function (n) { return !COMPARE.test(n); }).join(' ');
    return /견적/.test(subj + ' ' + own);
  }
  /* 「자문·위임·용역·컨설팅·교육·위탁·대행 계약서」 — 근로계약서는 아니다 */
  function isOurContract(subject, attNames) {
    var subj = s(subject);
    if (NOT_CONTRACT.test(subj)) return false;
    return CONTRACT.test(subj + ' ' + joined(attNames));
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

  /* 제목·첨부 이름에 «금액»이 든 글자(「견적서_400만원.pdf」·「4,000,000원」·「1.2억」)를 가린다.
     요청 대기열(data/contract_requests)과 이알피 카드 비고는 직원 모두가 읽는다 — 금액 비공개 선을 파일 이름으로 우회하면 안 된다.
     ★ «놓치는 것보다 지나치게 가리는 것»이 낫다(금액이 새는 쪽이 더 큰 사고) — 그래서 넓게 가린다(검토 2026-11-09 Codex·Antigravity):
       · 원화 기호·코드 ₩4000000 · KRW 4000000 · 4000000KRW
       · 숫자 + 원 («원» 뒤에 한글 조사가 와도 — 「4000000원의 건」·「5000000원정」·「3500000원입니다」), 숫자 + 만·억·천·백만·천만(+원)
         — 단위 낱말 «뒤에 한글이 바로 이어지면»(「3천안공장」·「10만기일」) 금액이 아니라 낱말이라 두고, 「…만원」처럼 원이 붙은 것은 가린다
       · 한글 금액 «사백만원»·«천만원»·«삼천오백만 원» — 단위(백·천·만·억)가 든 것만(「사원」·「구원」·「공원」은 두지 않는다)
       · 쉼표 있는 숫자(4,000,000), 쉼표 없는 7자리 이상 숫자(4000000.pdf), 6자리는 «날짜(yymmdd) 모양이 아닐 때만»(500000 → 가림, 261106 → 둠)
     ⚠ 그래도 «모든» 표기를 못 막는다(예: 숫자 없이 「금 사백」). 이 한 벌은 «직원 모두가 읽는 곳»으로 가기 전 마지막 문지기 하나일 뿐이다. */
  var NUMS = '일이삼사오육칠팔구십';
  var KOR = NUMS + '백천만억';
  var NUM = '\\d(?:[\\d,.]*\\d)?';
  /* 단위(만·천·억) 뒤에 «원» 없이 붙는 조사·어미 — 「130만씩」·「400만입니다」·「2억이상」. 낱말(「3천안공장」·「10만기일」)은 여기 없다.
     숫자 뒤(P1)는 한 글자 조사(이·가)까지, 한글 숫자 뒤(P2)는 낱말과 헷갈리지 않게 줄였다. */
  var P2 = '씩|입니다|이에요|예요|이며|이고|으로|로|을|를|은|는|도|에|의|부터|까지|짜리|정|쯤|가량|정도|내외|이상|이하';
  var P1 = P2 + '|이|가|임|이다|이면|이라|와|과';
  var MONEY_RE = new RegExp([
    '[₩￦]\\s*' + NUM + '(?:\\s*원)?',                                   // ₩4,000,000 · ₩4,000,000원
    '(?:KRW|krw)\\s*' + NUM + '(?:\\s*원)?',
    NUM + '\\s*(?:KRW|krw)',
    NUM + '(?:\\s*[십백천만억]\\s*(?:' + NUM + ')?)+\\s*원',                 // 5십만원 · 3천5백만 원 · 1.2억 원
    NUM + '\\s*(?:천만|백만|억|만|천)(?:\\s*원|(?=' + P1 + ')|(?![가-힣]))',     // 400만 · 130만씩 · 400만입니다
    NUM + '\\s*원',
    '(?:[' + KOR + ']\\s*)*[백천만억](?:\\s*[' + KOR + '])*\\s*원',      // 사백만원 · 삼천오백만 원 · 사백 만 원
    '(?:[' + NUMS + ']+[백천만억]|[백천][만억])[' + KOR + ']*(?=' + P2 + '|(?![가-힣]))',    // 사백만 · 사백만입니다
    '\\d{1,3}(?:,\\d{3})+',
    '\\d{7,}'
  ].join('|'), 'g');
  var SIX_RE = /(?<!\d)\d{6}(?!\d)/g;
  /* yymmdd 모양(월 01~12 · 일 01~31)이면 날짜로 보고 둔다 */
  function looksYYMMDD(x) { var m = +x.slice(2, 4), d = +x.slice(4, 6); return m >= 1 && m <= 12 && d >= 1 && d <= 31; }
  function scrubMoney(text) {
    return s(text).replace(MONEY_RE, '○○').replace(SIX_RE, function (x) { return looksYYMMDD(x) ? x : '○○'; });
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
    EXCL_QUOTE: EXCL_QUOTE, CONTRACT: CONTRACT, NOT_CONTRACT: NOT_CONTRACT,
    s: s, nfc: nfc, namesOf: namesOf, isOurQuote: isOurQuote, isOurContract: isOurContract, docOf: docOf,
    compareHint: compareHint, addrsOf: addrsOf, domainOf: domainOf, scrubMoney: scrubMoney
  };
});
