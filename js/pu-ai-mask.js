/* ══════════════════════════════════════════════════════════════════
   pu-ai-mask.js — AI 로 보내기 «전에» 개인정보를 꼬리표로 가리고, 답이 오면 «브라우저 안에서» 되돌린다 (2026-11-19)

   왜: 상담 AI 요약(푸른이알피)·업무관리 AI 초안·인터뷰·지식 뽑기·지식 묻기·기금 AI 가 의뢰인 이름·전화·주민번호를
       가림 없이 바깥 AI(Anthropic) 로 보내고 있었다. 회사 원칙은 «외부 서비스에 고객 실명·주민번호를 넣지 않는다».
   어떻게:
     ① 이미 아는 값(의뢰인·업체·담당자 이름 등, 부르는 쪽이 넘김)을 «정확히 같은 글자»로 찾아 [의뢰인1] 처럼 바꾼다.
        한 번에(정규식 하나로) 바꾼다 — 차례로 바꾸면 뒤의 값이 앞서 만든 꼬리표 글자([업체1]의 「업체」)를 다시 바꿔 깨뜨린다.
     ② 모양으로 아는 것 — 주민·외국인번호·카드·사업장관리번호·사업자번호·계좌·전화·전자우편 — 을 [주민번호1]·[전화1] 처럼 바꾼다.
     ③ 바깥으로는 꼬리표만 나간다. 진짜 값과 꼬리표의 짝은 이 브라우저 메모리에만 있고, 답이 오면 되돌린다.
        답이 JSON 이면 그 안에는 JSON 에 맞게(따옴표·역슬래시·줄바꿈을 풀어 쓴 꼴로) 넣는다 — 그냥 넣으면 JSON 이 깨진다.
     ④ 마지막 문지기: 가린 뒤에도 주민번호 꼴이 남아 있으면 PuRrnMask.maskRrnInText(실려 있으면)로 한 번 더 지운다.
   한계(숨기지 않는다): 넘겨받지 못한 «다른 사람 이름»은 모양으로 알 수 없어 못 가린다. 주소도 가리지 않는다.
   ⚠ 뒤돌아보기(lookbehind)를 쓰지 않는다 — 옛 아이폰 사파리에서 통째로 터진다(pu-rrn-mask.js 와 같은 까닭).
   모양 규칙은 js/pu-chatbot-kb.js 의 PII_MASKS 와 같은 꼴을 따랐다(그 파일은 205KB 라 여기서 싣지 않는다).
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 꼬리표 이름 → 모양 규칙. 순서가 중요하다 — 긴 것(주민번호 13자리·카드 16자리)을 먼저 가려야
     짧은 규칙(전화·계좌)이 그 조각을 먼저 물어 반쪽만 가리는 일이 없다.
     첫 묶음: 앞 글자(뒤돌아보기 대신) · 둘째 묶음: 가릴 값. skip(값) 이 참이면 가리지 않는다. */
  var RULES = [
    { label: '주민번호', re: /(^|[^0-9])(\d{6}\s?[-–—]\s?\d{7})(?![0-9])/g },
    { label: '주민번호', re: /(^|[^0-9])(\d{13})(?![0-9])/g },
    { label: '카드', re: /(^|[^0-9])(\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4})(?![0-9])/g },
    /* 4대보험 사업장관리번호(사업자번호-한 자리)는 사업자번호보다 먼저 — 아니면 앞 10자리만 가리고 「-0」이 남는다 */
    { label: '사업장관리번호', re: /(^|[^0-9])(\d{3}\s?-\s?\d{2}\s?-\s?\d{5}\s?-\s?\d)(?![0-9])/g },
    { label: '사업자번호', re: /(^|[^0-9])(\d{3}\s?-\s?\d{2}\s?-\s?\d{5})(?![0-9]|-\d)/g },
    /* «계좌·통장» 뒤의 번호 — 숫자와 «-» 만 잇는다. 띄어쓰기까지 이으면 뒤따르는 전화·날짜를 반쪽만 삼켜
       나머지(「-1234-5678」)가 그대로 나가고 날짜가 깨진다(2026-11-19 독립 검토 지적). */
    { label: '계좌', re: /((?:계좌(?:번호)?|통장)\s*[:：]?\s*)(\d[\d-]{8,20}\d)(?![0-9-])/g },
    /* 전화는 «아무 숫자-숫자-숫자» 계좌 규칙보다 먼저 — 010-1234-5678 도 그 꼴이라 계좌로 잘못 불린다.
       안심번호(050·0505)·수신자부담(080)·인터넷전화(070)도 잡는다. */
    { label: '전화', re: /(^|[^0-9])((?:01[016789]|02|0[3-6][1-5]|070|080|050\d?)[- .]?\d{3,4}[- .]?\d{4})(?![0-9])/g },
    { label: '계좌', re: /(^|[^0-9-])(\d{2,6}-\d{2,6}-\d{2,7}(?:-\d{1,3})?)(?![0-9-])/g, minDigits: 10, maxDigits: 16,
      /* 「2026-01-1234」 같은 연·월로 시작하는 문서·관리번호는 계좌가 아니다 */
      skip: function (v) { return /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-/.test(v); } },
    { label: '전자우편', re: /()([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g }
  ];

  var NOTE = '※ 대괄호 표시([의뢰인1]·[전화1] 같은 것)는 개인정보를 가려 둔 자리입니다. '
    + '표시를 글자 그대로 옮겨 쓰고, 풀거나 바꾸거나 새로 지어내지 마세요.';

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function digitCount(s) { return (String(s).match(/\d/g) || []).length; }

  /* 「㈜푸른샘 김철수 대표」 처럼 한 칸에 여럿이 들어 있으면 본문에는 「김철수」·「푸른샘」 따로 나온다 —
     조각도 함께 가린다. 회사 꼴·직함·노무 낱말·꼬리표 이름은 조각에서 뺀다(그 낱말을 가리면 글이 깨진다). */
  var NOT_A_NAME = new RegExp('^(?:'
    + '주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|의료법인|학교법인|사회복지법인|협동조합|'
    + '대표이사|대표자|대표|사장|부사장|회장|이사|전무|상무|감사|부장|차장|과장|대리|주임|사원|계장|팀장|실장|본부장|원장|소장|사무장|'
    + '님|씨|귀하|고객|의뢰인|상담자|담당자|담당|상대|상대담당|업체|업체담당|회사|사업장|본사|지점|지사|임원|위원|기금|'
    + '전화|연락처|휴대폰|사무실|계좌|카드|주민번호|사업자번호|사업장관리번호|전자우편|이메일|이름|'
    + '근로자|사용자|노동자|직원|해고|임금|체불|산재|상담|문의|신규|기존|외|등|'
    + '공동근로복지기금|사내근로복지기금|근로복지기금|복지기금|노동조합|노조|협의회'
    + ')$');
  var LEGAL_FORM = /^(?:㈜|\(주\)|\(유\)|\(사\)|\(재\)|주식회사|유한회사|사단법인|재단법인)\s*|\s*(?:㈜|\(주\)|주식회사|유한회사)$/g;
  function partsOf(value) {
    return String(value)
      .replace(/㈜|\((?:주|유|사|재)\)/g, ' ')            // 붙어 있는 법인 꼴을 먼저 떼어 낸다(괄호로 나누기 전에)
      .split(/[\s,·/()（）\[\]]+/)
      .map(function (p) { return p.replace(LEGAL_FORM, '').trim(); })
      .filter(function (p) { return p.length >= 2 && !NOT_A_NAME.test(p) && !/^\d+$/.test(p); });
  }

  /* JSON 문자열 안에 넣을 때의 꼴(따옴표·역슬래시·줄바꿈을 풀어 쓴 것) */
  function jsonInner(v) { return JSON.stringify(String(v)).slice(1, -1); }

  /* 가리개 하나 = 한 번의 AI 부름. 같은 값은 같은 꼬리표가 된다(시스템 글과 본문을 나눠 가려도 번호가 이어진다).
     opts.known: [{ value:'김철수', label:'의뢰인' }, …] — 2글자 미만·빈 값은 버린다(한 글자를 바꾸면 글이 깨진다).
     띄어쓰기로 나뉜 값은 조각(partsOf)도 같은 이름표로 가린다. parts:false 면 통째로만. */
  function createMasker(opts) {
    var known = [], labelOf = {};
    function add(v, label) {
      v = String(v).trim();
      if (v.length < 2 || Object.prototype.hasOwnProperty.call(labelOf, v)) return;
      if (/^[\[\]\-—–·.\s]+$/.test(v)) return;   // 「—」 같은 빈자리 표시는 값이 아니다
      labelOf[v] = label;
      known.push(v);
    }
    ((opts && opts.known) || []).forEach(function (k) {
      if (!k) return;
      var v = String(k.value == null ? '' : k.value).trim();
      var label = String(k.label || '이름').replace(/[\[\]\d]/g, '').trim() || '이름';
      add(v, label);
      if (k.parts !== false) partsOf(v).forEach(function (p) { add(p, label); });
    });
    /* 긴 값부터 — 같은 자리에서 「푸른샘 주식회사」가 「푸른샘」보다 먼저 맞아야 반쪽만 남지 않는다 */
    known.sort(function (a, b) { return b.length - a.length; });
    var knownRe = known.length ? new RegExp(known.map(escRe).join('|'), 'g') : null;

    var tokenOf = {};      // 이름표+진짜 값 → 꼬리표
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
      /* 아는 값은 «한 번에» — 바꾼 꼬리표를 다시 훑지 않는다 */
      if (knownRe) out = out.replace(knownRe, function (v) { return tokenFor(labelOf[v], v); });
      RULES.forEach(function (r) {
        out = out.replace(r.re, function (m, pre, val) {
          if (r.minDigits || r.maxDigits) {
            var n = digitCount(val);
            if ((r.minDigits && n < r.minDigits) || (r.maxDigits && n > r.maxDigits)) return m;
          }
          if (r.skip && r.skip(val)) return m;
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

    /* 꼬리표 → 진짜 값. 한 번에 바꾼다(되돌린 값 안에 꼬리표 꼴이 있어도 다시 바꾸지 않는다).
       꼬리표는 닫는 괄호까지 통째로 맞추므로 [전화1] 이 [전화10] 의 앞부분을 바꾸는 일은 없다. */
    function swap(text, inJson) {
      var toks = Object.keys(valueOf);
      var out = String(text == null ? '' : text);
      if (!toks.length) return out;
      toks.sort(function (a, b) { return b.length - a.length; });
      return out.replace(new RegExp(toks.map(escRe).join('|'), 'g'), function (t) {
        return inJson ? jsonInner(valueOf[t]) : valueOf[t];
      });
    }
    function unmask(text) { return swap(text, false); }

    /* AI 답 되돌리기 — 답 속 { … } 가 JSON 으로 읽히면 그 안에는 JSON 에 맞는 꼴로 넣는다.
       (부르는 쪽 aiJson 이 «첫 { 부터 마지막 } 까지»를 JSON.parse 하는 것과 같은 자리를 본다) */
    function unmaskReply(text) {
      var s = String(text == null ? '' : text), a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a >= 0 && b > a) {
        var mid = s.slice(a, b + 1), ok = false;
        try { JSON.parse(mid); ok = true; } catch (e) { ok = false; }
        if (ok) return swap(s.slice(0, a), false) + swap(mid, true) + swap(s.slice(b + 1), false);
      }
      return swap(s, false);
    }

    function count() { return Object.keys(kinds).reduce(function (a, k) { return a + kinds[k]; }, 0); }

    return {
      mask: mask,
      unmask: unmask,
      unmaskReply: unmaskReply,
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
