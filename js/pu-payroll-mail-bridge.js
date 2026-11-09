// 푸른메일함(37***@hanmail.net) → 급여아웃소싱 개인정보 자체 마스킹 가공 & 원본 금고 자동 전송 브릿지
(function(global) {
  'use strict';

  function maskPii(rawText) {
    if (!rawText) return '';
    return String(rawText)
      .replace(/(\d{6})[-\s]?([1-8]\d{6})/g, '$1-*******')
      .replace(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g, '$1-****-$3')
      .replace(/(\d{3,4})-(\d{2,6})-(\d{4,6})(-\d{1,3})?/g, function(m, p1, p2, p3, p4) {
        return p1 + '-****-****' + (p4 || '');
      });
  }

  function matchCompany(mailObj, companies) {
    var list = companies || global.PU_PAYROLL_COMPANIES || [];
    var fromLower = String(mailObj.from || '').toLowerCase();
    var combined = (String(mailObj.from || '') + ' ' + String(mailObj.subject || '') + ' ' + String(mailObj.body || '')).replace(/\s+/g, '');

    for (var i = 0; i < list.length; i++) {
      if (list[i].pay_mail && fromLower.indexOf(list[i].pay_mail.toLowerCase()) !== -1) {
        return list[i];
      }
    }
    var best = null, bestLen = 0;
    for (var j = 0; j < list.length; j++) {
      var clean = String(list[j].sort_key || list[j].name || '').replace(/\(.*?\)/g, '').trim();
      if (clean.length >= 2 && combined.indexOf(clean) !== -1 && clean.length > bestLen) {
        best = list[j];
        bestLen = clean.length;
      }
    }
    return best;
  }

  global.PuPayrollMailBridge = {
    maskPii: maskPii,
    matchCompany: matchCompany
  };
})(window);
