/* ══════════════════════════════════════════════════════════════════
   pu-ai-mask.js — AI 로 보내기 «전에» 개인정보를 꼬리표로 가리고, 답이 오면 «브라우저 안에서» 되돌린다 (2026-11-19)

   왜: 상담 AI 요약(푸른이알피)·업무관리 AI 초안·인터뷰·지식 뽑기·기금 AI 가 의뢰인 이름·전화·주민번호를
       가림 없이 바깥 AI(Anthropic) 로 보내고 있었다. 회사 원칙은 «외부 서비스에 고객 실명·주민번호를 넣지 않는다».
   어떻게:
     ① 이미 아는 값(의뢰인·업체·담당자 이름 등, 부르는 쪽이 넘김)을 «정확히 같은 글자»로 찾아 [의뢰인1] 처럼 바꾼다.
     ② 모양으로 아는 것 — 주민번호·외국인번호·카드·사업자번호·계좌·전화·전자우편 — 을 [주민번호1]·[전화1] 처럼 바꾼다.
     ③ 바깥으로는 꼬리표만 나간다. 진짜 값과 꼬리표의 짝은 이 브라우저 메모리에만 있고, 답이 오면 unmask 로 되돌린다.
        (그래서 초안에는 진짜 이름이 들어가 있다 — 사람이 다시 채울 일이 없다.)
     ④ 마지막 문지기: 가린 뒤에도 주민번호 꼴이 남아 있으면 PuRrnMask.maskRrnInText(실려 있으면)로 한 번 더 지운다.
   한계(숨기지 않는다): 넘겨받지 못한 «다른 사람 이름»은 모양으로 알 수 없어 못 가린다. 주소도 가리지 않는다.
   ⚠ 뒤돌아보기(lookbehind)를 쓰지 않는다 — 옛 아이폰 사파리에서 통째로 터진다(pu-rrn-mask.js 와 같은 까닭).
   모양 규칙은 js/pu-chatbot-kb.js 의 PII_MASKS 와 같은 꼴을 따랐다(그 파일은 205KB 라 여기서 싣지 않는다).
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 꼬리표 이름 → 모양 규칙. 순서가 중요하다 — 긴 것(주민번호 13자리·카드 16자리)을 먼저 가려야
     짧은 규칙(전화·계좌)이 그 조각을 먼저 물어 반쪽만 가리는 일이 없다.
     pre: 앞 글자를 잡는 묶음 번호(뒤돌아보기 대신). val: 가릴 값 묶음 번호. */
  var RULES = [
    { label: '주민번호', re: /(^|[^0-9])(\d{6}\s?[-–—]\s?\d{7})(?![0-9])/g },
    { label: '주민번호', re: /(^|[^0-9])(\d{13})(?![0-9])/g },
    { label: '카드', re: /(^|[^0-9])(\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4})(?![0-9])/g },
    { label: '사업자번호', re: /(^|[^0-9])(\d{3}\s?-\s?\d{2}\s?-\s?\d{5})(?![0-9])/g },
    { label: '계좌', re: /((?:계좌(?:번호)?|통장)\s*[:：]?\s*)(\d[\d -]{8,20}\d)(?![0-9])/g },
    /* 전화는 «아무 숫자-숫자-숫자» 계좌 규칙보다 먼저 — 010-1234-5678 도 그 꼴이라 계좌로 잘못 불린다 */
    { label: '전화', re: /(^|[^0-9])((?:01[016789]|02|0[3-6][1-5]|070)[- .]?\d{3,4}[- .]?\d{4})(?![0-9])/g },
    { label: '계좌', re: /(^|[^0-9-])(\d{2,6}-\d{2,6}-\d{2,7}(?:-\d{1,3})?)(?![0-9-])/g, minDigits: 10, maxDigits: 16 },
    { label: '전자우편', re: /()([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g }
  ];

  var NOTE = '※ 대괄호 표시([의뢰인1]·[전화1] 같은 것)는 개인정보를 가려 둔 자리입니다. '
    + '표시를 글자 그대로 옮겨 쓰고, 풀거나 바꾸거나 새로 지어내지 마세요.';

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function digitCount(s) { return (String(s).match(/\d/g) || []).length; }

  /* 「㈜푸른샘 김철수 대표」 처럼 한 칸에 여럿이 들어 있으면 본문에는 「김철수」·「푸른샘」 따로 나온다 —
     조각도 함께 가린다. 회사 꼴·직함은 조각에서 뺀다(그 낱말을 가리면 글이 깨진다). */
  var NOT_A_NAME = /^(?:주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|의료법인|학교법인|사회복지법인|대표이사|대표|사장|부사장|이사|전무|상무|부장|차장|과장|대리|주임|사원|계장|팀장|실장|본부장|원장|소장|사무장|님|씨|귀하|고객|의뢰인|상담자|담당자|외|등)$/;
  function partsOf(value) {
    return String(value).split(/[\s,·/()（）\[\]]+/)
      .map(function (p) { return p.replace(/^(?:㈜|\(주\)|\(유\)|\(사\)|\(재\))+|(?:㈜|\(주\))+$/g, '').trim(); })
      .filter(function (p) { return p.length >= 2 && !NOT_A_NAME.test(p) && !/^\d+$/.test(p); });
  }

  /* 가리개 하나 = 한 번의 AI 부름. 같은 값은 같은 꼬리표가 된다(시스템 글과 본문을 나눠 가려도 번호가 이어진다).
     opts.known: [{ value:'김철수', label:'의뢰인' }, …] — 2글자 미만·빈 값은 버린다(한 글자를 바꾸면 글이 깨진다).
     띄어쓰기로 나뉜 값은 조각(partsOf)도 같은 이름표로 가린다. parts:false 면 통째로만. */
  function createMasker(opts) {
    var known = [], seen = {};
    function add(v, label) {
      v = String(v).trim();
      if (v.length < 2 || seen[v]) return;
      if (/^[\[\]\-—–·.\s]+$/.test(v)) return;   // 「—」 같은 빈자리 표시는 값이 아니다
      seen[v] = 1;
      known.push({ value: v, label: label });
    }
    ((opts && opts.known) || []).forEach(function (k) {
      if (!k) return;
      var v = String(k.value == null ? '' : k.value).trim();
      var label = String(k.label || '이름').replace(/[\[\]\d]/g, '').trim() || '이름';
      add(v, label);
      if (k.parts !== false) partsOf(v).forEach(function (p) { add(p, label); });
    });
    /* 긴 값부터 — 「푸른샘 주식회사」를 「푸른샘」보다 먼저 바꿔야 반쪽만 남지 않는다 */
    known.sort(function (a, b) { return b.value.length - a.value.length; });

    var tokenOf = {};      // 진짜 값 → 꼬리표
    var valueOf = {};      // 꼬리표 → 진짜 값
    var seq = {};          // 꼬리표 이름 → 다음 번호
    var kinds = {};        // 꼬리표 이름 → 가린 수(서로 다른 값)

    function tokenFor(label, value) {
      var key = label + '\u0000' + value;
      if (tokenOf[key]) return tokenOf[key];
      seq[label] = (seq[label] || 0) + 1;
      var t = '[' + label + seq[label] + ']';
      tokenOf[key] = t;
      valueOf[t] = value;
      kinds[label] = (kinds[label] || 0) + 1;
      return t;
    }

    function mask(text) {
      var out = String(text == null ? '' : text);
      known.forEach(function (k) {
        out = out.replace(new RegExp(escRe(k.value), 'g'), function () { return tokenFor(k.label, k.value); });
      });
      RULES.forEach(function (r) {
        out = out.replace(r.re, function (m, pre, val) {
          if (r.minDigits || r.maxDigits) {
            var n = digitCount(val);
            if ((r.minDigits && n < r.minDigits) || (r.maxDigits && n > r.maxDigits)) return m;
          }
          return pre + tokenFor(r.label, val);
        });
      });
      /* 마지막 문지기 — 위에서 못 잡은 주민번호 꼴이 남았으면 되돌릴 수 없게 지운다 */
      var R = root && root.PuRrnMask;
      if (R && typeof R.maskRrnInText === 'function') {
        var res = R.maskRrnInText(out);
        if (res && res.count > 0) { out = res.text; kinds['주민번호(지움)'] = (kinds['주민번호(지움)'] || 0) + res.count; }
      }
      return out;
    }

    /* 답 → 진짜 값으로. 꼬리표는 닫는 괄호까지 통째로 맞추므로 [전화1] 이 [전화10] 의 앞부분을 바꾸는 일은 없다 */
    function unmask(text) {
      var out = String(text == null ? '' : text);
      Object.keys(valueOf).forEach(function (t) {
        out = out.split(t).join(valueOf[t]);
      });
      return out;
    }

    function count() { return Object.keys(kinds).reduce(function (a, k) { return a + kinds[k]; }, 0); }

    return {
      mask: mask,
      unmask: unmask,
      changed: function () { return count() > 0; },
      count: count,
      kinds: function () { var o = {}; Object.keys(kinds).forEach(function (k) { o[k] = kinds[k]; }); return o; },
      /* 가린 것이 있을 때만 시스템 글 끝에 붙인다 — 없으면 AI 에게 쓸데없는 말을 하지 않는다 */
      withNote: function (system) { return count() > 0 ? String(system || '') + '\n\n' + NOTE : String(system || ''); }
    };
  }

  var api = { createMasker: createMasker, partsOf: partsOf, NOTE: NOTE, RULES: RULES };
  if (root) root.PuAiMask = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
