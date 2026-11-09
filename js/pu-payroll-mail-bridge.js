// 푸른메일함(37***@hanmail.net) → 급여아웃소싱 개인정보 자체 마스킹 가공 & 원본 금고 자동 전송 브릿지
(function(global) {
  'use strict';

  function maskPii(rawText) {
    if (!rawText) return '';
    return String(rawText)
      .replace(/(^|[^\d])(\d{6})[-\s]?([1-8]\d{6})(?!\d)/g, function(m, pre) { return pre + '******-*******'; })
      .replace(/(^|[^\d])(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)/g, function(m, pre, p1) {
        return pre + p1 + '-****-****';
      })
      .replace(/(^|[^\d-])(?!\d{4}-\d{2}-\d{2}(?!\d))(\d{2,6}(?:-\d{2,6}){2,3})(?!\d)/g, function(m, pre) {
        return pre + '***-****-****';
      })
      .replace(/\d{10,16}/g, '************');
  }

  function matchCompany(mailObj, companies) {
    var list = companies || global.PU_PAYROLL_COMPANIES || [];
    mailObj = mailObj || {};
    var fromLower = String(mailObj.from || '').toLowerCase();
    var combined = (String(mailObj.from || '') + ' ' + String(mailObj.subject || '') + ' ' + String(mailObj.body || '')).replace(/\s+/g, '');

    // ① 발신 주소가 겹치는 사업장이 하나뿐이면 그곳, 여럿이면 그 안에서만 이름으로 고른다
    var byMail = list.filter(function(c) {
      return c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1;
    });
    if (byMail.length === 1) return byMail[0];
    var pool = byMail.length > 1 ? byMail : list;

    // ② 지점까지 쓴 전체 이름이 맞으면 높은 점수. 점수가 같은 사업장이 둘이면 «못 정함»(null)
    var best = null, bestScore = 0, tie = false;
    for (var j = 0; j < pool.length; j++) {
      var full = String(pool[j].name || '').replace(/\s+/g, '');
      var clean = String(pool[j].sort_key || pool[j].name || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
      var score = 0;
      if (full.length >= 2 && combined.indexOf(full) !== -1) score = 1000 + full.length;
      else if (clean.length >= 2 && combined.indexOf(clean) !== -1) score = clean.length;
      if (score > bestScore) { best = pool[j]; bestScore = score; tie = false; }
      else if (score > 0 && score === bestScore) tie = true;
    }
    return tie ? null : best;
  }

  global.PuPayrollMailBridge = {
    maskPii: maskPii,
    matchCompany: matchCompany
  };
})(window);
