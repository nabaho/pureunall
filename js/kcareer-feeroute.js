'use strict';
/* 푸른노무법인 경력관리 — 이력서 보관함에 «잘못 들어온 비용 서류»를 알아본다
   (브라우저 window.KcareerFeeRoute / Node module.exports 겸용 · DOM·통신 없음 — 글자만 본다)

   ── 왜 만드나 (대표 지시 2026-11-15) ──
   「회의 비용관리에 있어야 될 내용이 이력서 관리에 있다. 잘못 입력되면 자동으로 비용관리로 보내게 해달라」
   협회 지급확인서(노무상담비)가 «5번 폴더 모두 넣기» 같은 길로 이력서 보관함에 들어와 있었다.
   올리기 화면(rhAutoSaveDomain)에는 같은 판정이 있었지만, 다른 입구는 그 판정을 거치지 않았다.
   → 판정을 여기 «한 곳»에 모으고, 화면(kcareer.html)은 어느 입구로 들어오든 같은 판정을 쓴다.

   ── 규칙(값이 아니라 뜻) — 2026-10-12 대표 지시 「비용관리 한정 협회」를 그대로 따른다 ──
   ① 협회 서류여야 한다 — 기관·파일 이름·메모·본문 어디든 «협회»가 있으면 된다. 협회가 아닌 곳의 지급확인서는 이력서 보관함 그대로.
   ② 돈을 받았다는 «확인 서류»의 낱말이 있어야 한다 — 지급확인서·상담비·강사비·원고료·영수증·참석확인서 같은 것.
   ③ 이름·종류가 이력서·프로필·경력기술서·자기소개서·약력이면 비용 서류가 아니다(본문의 낱말보다 이름이 먼저다).
   ④ 사람이 «여기 둔다»고 정한 것(keep)은 판정하지 않는다 — 사람이 정한 것이 이긴다.
   ⑤ 확신이 없으면 «옮기지 않는다» — 잘못 옮기는 것보다 안 옮기는 쪽이 싸다(되돌릴 수 있어도 사람이 한 번 더 봐야 한다).

   ── ⚠ 글이 밖으로 나가지 않는다 ──
   이 파일은 서버·AI 를 부르지 않는다(대표 결정 2026-11-15 「규칙으로 자동 분류」).
   결과에는 «찾은 낱말»만 담고 본문 조각·이름·번호는 담지 않는다 — 화면에 근거를 보일 때 개인정보가 새지 않게. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KcareerFeeRoute = api;
})(typeof self !== 'undefined' ? self : this, function () {
  /* 비용 서류 종류 — kcareer.html 의 KIND_DEFAULTS.feedoc 과 «같은 이름»이어야 한다(시험이 대조한다) */
  var KINDS = ['수당 지급 신청서', '개인정보 동의서', '지급조서·영수증', '참석 확인서', '기타'];

  /* 돈을 받았다는 확인 낱말 — 2026-10-12 RH_FEE_WORDS 에 «영수증·지급조서·참석확인서»를 더했다.
     ⚠ «수당» 한 낱말만으로는 판정하지 않는다 — 위촉장에도 「수당을 지급한다」가 들어갈 수 있다. */
  var FEE_WORDS = ['지급확인서', '지급조서', '영수증', '참석확인서', '노무상담비', '상담비', '강사비', '강사료', '원고료', '지급금액', '비용지급', '수당지급신청'];
  /* 이름·종류에 이런 말이 들면 비용 서류가 아니다 — 이력서류 + «증명서·위촉장·활동확인서» 같은 경력 증빙(본문에 강사료가 적혀 있어도 경력 증빙이다, 검증 2026-11-15) */
  var NOT_FEE_NAME = /이력서|프로필|경력\s*기술서|자기\s*소개서|약력|경력\s*증명|재직\s*증명|위촉\s*장|위촉\s*증명|강의\s*확인|활동\s*확인/;

  function s(v) { return String(v == null ? '' : v); }
  /* 낱말 사이 띄어쓰기·줄바꿈 때문에 놓치지 않게 공백을 지우고 본다(「지급 확인서」 = 「지급확인서」) */
  function squash(v) { return s(v).replace(/\s+/g, ''); }

  function wordsIn(text) {
    var t = squash(text), out = [];
    FEE_WORDS.forEach(function (w) { if (t.indexOf(w) >= 0) out.push(w); });
    /* 「노무상담비」 안에 「상담비」가 또 있다 — 같은 뜻을 두 번 세지 않는다 */
    return out.filter(function (w) { return !out.some(function (o) { return o !== w && o.indexOf(w) >= 0; }); });
  }

  function kindOf(text) {
    var t = squash(text);
    if (t.indexOf('참석확인서') >= 0) return '참석 확인서';
    if (/지급확인서|지급조서|영수증/.test(t)) return '지급조서·영수증';
    if (/수당지급신청|(상담비|강사비|강사료|원고료)[\s\S]{0,40}신청/.test(t)) return '수당 지급 신청서';
    if (t.indexOf('개인정보') >= 0 && t.indexOf('동의') >= 0) return '개인정보 동의서';
    return '기타';
  }

  function no(why) { return { fee: false, why: why, kind: '', words: [] }; }

  /* r: { name, kind, memo, org, text, keep }  →  { fee, why, kind, words }
     why 는 사람이 읽는 한 줄(화면에 그대로 보인다) — 본문 조각을 담지 않는다. */
  function judge(r) {
    r = r || {};
    if (r.keep) return no('사람이 이 보관함에 두기로 한 서류');
    var head = [r.name, r.kind, r.memo].map(s).join(' ');
    if (NOT_FEE_NAME.test(head)) return no('이름·종류가 이력서·프로필류');
    var all = [head, s(r.org), s(r.text)].join(' ');
    if (squash(all).indexOf('협회') < 0) return no('협회 서류가 아님');
    var words = wordsIn(all);
    if (!words.length) return no('돈을 받았다는 확인 낱말이 없음');
    return { fee: true, kind: kindOf(all), words: words, why: '협회 서류 · ' + words.join('·') };
  }

  return { judge: judge, kindOf: kindOf, wordsIn: wordsIn, KINDS: KINDS, FEE_WORDS: FEE_WORDS };
});
