// 푸른메일함(37***@hanmail.net) → 급여아웃소싱 개인정보 자체 마스킹 가공 & 사업장 자동 매칭 (화면이 쓰는 «원본» 모듈)
//
// ⚠ 같은 규칙의 사본이 functions/payrollMailSync.js 에 있다(서버 배포물은 js/ 를 못 가져간다).
//   한쪽을 고치면 다른 쪽도 고치고 tests/payroll-mail-masking-parity.test.js 로 결과가 같은지 확인한다.
// ⚠ «뒤돌아보기(lookbehind)» 정규식은 쓰지 않는다 — 구형 사파리에서 스크립트 «전체»가 구문 오류로 죽는다.
(function(root) {
  'use strict';

  var EMAIL = /[A-Za-z0-9._%+-]+@/g;

  // 메일 주소: 앞 2글자만 남긴다
  function maskEmail(s) {
    return String(s || '').replace(EMAIL, function(m) {
      return (m.length > 3 ? m.slice(0, 2) : '') + '***@';
    });
  }

  // 숫자·하이픈이 이어진 «덩어리» 하나씩 판단한다 — 계좌 모양이 어떻든(마디 수·길이·0으로 시작) 통째로 가린다.
  //  · 날짜(2026-11-02)는 그대로, 전화(0으로 시작하는 9~11자리)는 앞 마디만 남기고,
  //  · 하이픈이 있고 숫자가 8개 이상이면 계좌·번호로 보고 가리고, 하이픈이 없으면 10개 이상일 때 가린다.
  function maskDigitRuns(s) {
    return s.replace(/(^|[^\d])(\d[\d-]*\d)(?![\d-])/g, function(m, pre, run) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(run)) return m;
      var digits = run.replace(/-/g, '');
      var phone = /^(0\d{1,2})-?(\d{3,4})-?(\d{4})$/.exec(run);
      if (phone && digits.length >= 9 && digits.length <= 11) return pre + phone[1] + '-****-****';
      if (run.indexOf('-') !== -1) return digits.length >= 8 ? pre + '***-****-****' : m;
      return digits.length >= 10 ? pre + '************' : m;
    });
  }

  function maskPii(rawText) {
    if (!rawText) return '';
    var s = maskEmail(rawText);
    // 주민번호(생년월일까지)
    s = s.replace(/(^|[^\d])(\d{6})[-\s]?([1-8]\d{6})(?![\d-])/g, function(m, pre) { return pre + '******-*******'; });
    // 점·공백으로 나눈 전화(010 1234 5678, 010.1234.5678)
    s = s.replace(/(^|[^\d])(0\d{1,2})[.\s](\d{3,4})[.\s](\d{4})(?![\d-])/g, function(m, pre, p1) { return pre + p1 + '-****-****'; });
    return maskDigitRuns(s);
  }

  // 한글 이름(2~4자)만 있는 말 하나: 가운데 글자를 가린다 («이철» → «이*», «홍길동» → «홍*동»)
  function maskName(s) {
    var t = String(s || '').trim();
    if (!/^[가-힣]{2,4}$/.test(t)) return String(s || '');
    return t.charAt(0) + new Array(t.length - 1).join('*') + (t.length > 2 ? t.charAt(t.length - 1) : '*');
  }

  // 글 안에서 «이미 알고 있는 이름들»을 가린다(메일 본문에서 뽑은 근로자 성명 등)
  function maskNames(text, names) {
    var out = String(text || '');
    (names || []).forEach(function(n) {
      if (/^[가-힣]{2,4}$/.test(String(n || ''))) out = out.split(n).join(maskName(n));
    });
    return out;
  }

  // 본문에서 «성명: 홍길동», «입사자 홍길동» 처럼 라벨 뒤에 적힌 이름을 모두 찾는다(마스킹본에서 가릴 이름들)
  var NAME_LABEL = /(?:성명|이름|입사자|퇴사자|파트타임|보조)\s*[:：]?\s*([가-힣]{2,4})/g;
  var NOT_A_NAME = ['없음', '미정', '확인', '해당없음', '주민등록', '연락처', '입사일', '퇴사일', '월급여', '월보수액', '급여계좌', '실무확인'];
  function findNames(text) {
    var found = [], m;
    var re = new RegExp(NAME_LABEL.source, 'g');
    var s = String(text || '');
    while ((m = re.exec(s)) !== null) {
      if (NOT_A_NAME.indexOf(m[1]) === -1 && found.indexOf(m[1]) === -1) found.push(m[1]);
    }
    return found;
  }

  // 보낸이 줄: 주소·전화·번호를 가리고, 따로 떨어진 한글 이름(2~4자)은 가운데 글자를 가린다
  function maskFrom(from) {
    return maskPii(from).replace(/(^|[\s"(])([가-힣]{2,4})(?=$|[\s")<])/g, function(m, pre, w) { return pre + maskName(w); });
  }

  // ── 사업장 자동 매칭 ──
  //  ① 발신 주소(pay_mail)가 겹치는 사업장이 «하나뿐»이면 그곳, 여럿이면 그 안에서만 이름으로 고른다.
  //  ② 이름 점수: 괄호·㈜·공백을 뺀 «전체 이름(지점 포함)»이 글에 있으면 1000+길이,
  //     지점·㈜(주)를 뗀 «머리 이름»만 맞으면 길이. 점수가 같은 사업장이 둘이면(같은 이름의 지점 둘) «못 정함».
  //  ③ 못 찾았거나 모호하면 null — 엉뚱한 사업장에 붙이지 않는다.
  function squeeze(s) { return String(s || '').replace(/[()\[\]㈜]/g, '').replace(/\s+/g, ''); }
  function headName(c) { return String(c.name || c.sort_key || '').replace(/\(.*?\)/g, '').replace(/㈜/g, '').replace(/\s+/g, '').trim(); }

  function matchCompany(mailObj, companies) {
    var list = companies || root.PU_PAYROLL_COMPANIES || [];
    mailObj = mailObj || {};
    var fromLower = String(mailObj.from || '').toLowerCase();
    var combined = squeeze(String(mailObj.from || '') + ' ' + String(mailObj.subject || '') + ' ' + String(mailObj.body || ''));

    var byMail = list.filter(function(c) {
      return c && c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1;
    });
    if (byMail.length === 1) return byMail[0];
    var pool = byMail.length > 1 ? byMail : list;

    var best = null, bestScore = 0, tie = false;
    for (var j = 0; j < pool.length; j++) {
      var c = pool[j];
      if (!c) continue;
      var full = squeeze(c.name || c.sort_key);
      var head = headName(c);
      var score = 0;
      if (full.length >= 2 && combined.indexOf(full) !== -1) score = 1000 + full.length;
      else if (head.length >= 2 && combined.indexOf(head) !== -1) score = head.length;
      if (score > bestScore) { best = c; bestScore = score; tie = false; }
      else if (score > 0 && score === bestScore) tie = true;
    }
    return tie ? null : best;
  }

  var api = {
    maskEmail: maskEmail,
    maskPii: maskPii,
    maskName: maskName,
    maskNames: maskNames,
    findNames: findNames,
    maskFrom: maskFrom,
    matchCompany: matchCompany
  };
  root.PuPayrollMailBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
