/* ══════════════════════════════════════════════════════════════════
   pu-contract-vars.js — 계약 자료 → 채울 값 (설계 2026-10-03-계약서류-표준-기록 §4)
   이알피 「📄 계약서 출력」(fillContractVars)과 문서관리 「📦 서류 묶음 채우기」가 «같은 한 벌»을 쓴다.
   2026-10-03 이알피 fillContractVars 에서 «그대로» 옮겼다(tests/contract-vars.test.js 가 옮기기 전 값과 견준다).
   ⚠ 고칠 때는 여기 한 곳만 — 두 화면이 따로 셈하면 같은 계약이 서류마다 다르게 찍힌다.

   contractVars(contract, ctx) → { 회사명, 사업자번호, …, 근로자상세 } (중괄호 없는 이름)
   ctx = {
     findCompany(item) → 업체 | null   — 이알피 CompanyRef.findCompany 와 같은 판정(ID > 사업자번호 > 이름)
     companies: [업체]                  — 사업자번호로 납부일·4대보험 번호 보강
     users: [{ sid, name }]             — 주담당·부담당 이름
     korMoney(n) → '일백만'             — js/utils.js numToKorMoney
     today: 'YYYY-MM-DD'
   }
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  /* 주민번호 마스킹 - 951212-1****** (앞6 + 뒤1자리만 표시) */
  function maskRRN(rrn) {
    if (!rrn) return '';
    var clean = String(rrn).replace(/\s/g, '');
    if (clean.length < 8) return clean;
    var parts = clean.split('-');
    if (parts.length === 2 && parts[0].length === 6) return parts[0] + '-' + (parts[1][0] || '') + '******';
    return clean.slice(0, 6) + '-' + (clean[6] || '') + '******';
  }
  function contractVars(contract, ctx) {
    ctx = ctx || {};
    var c = contract || {};
    var co = Object.assign({}, c.company || {});
    /* 계약추가 폼에 없는 항목(납부일·4대보험 관리번호)은 업체관리에서 사업자번호로 보강 */
    var bizKey = (co.bizNo || '').replace(/\D/g, '').slice(0, 10);
    if (bizKey.length === 10) {
      var matches = (ctx.companies || []).filter(function (x) { return (x.bizNo || '').replace(/\D/g, '').slice(0, 10) === bizKey; });
      var coRec = matches.filter(function (x) { return x.status !== 'suboffice'; })[0] || matches[0];
      if (coRec) {
        ['taxInvoicePaymentDay', 'cmsPayDay', 'pensionNo', 'healthNo', 'employmentNo', 'injuryNo', 'corpRegNo', 'ceoBirth', 'ceoGender'].forEach(function (k) {
          if (!co[k] && coRec[k]) co[k] = coRec[k];
        });
      }
    }
    /* 업체관리 레코드 병합 — 계약에 입력된 값(스냅샷) 우선, 비어 있으면 업체관리 값 */
    try {
      if (typeof ctx.findCompany === 'function') {
        var dbCo = ctx.findCompany({ companyId: c.companyId || co.companyId, bizNo: c.bizNo || co.bizNo, companyName: c.companyName || co.name });
        if (dbCo) {
          var merged = Object.assign({}, dbCo);
          Object.keys(co).forEach(function (k) {
            var v = co[k];
            if (v !== '' && v != null && !(Array.isArray(v) && v.length === 0)) merged[k] = v;
          });
          co = merged;
        }
      }
    } catch (e) {}
    var primaryContact = (co.contacts || []).filter(function (x) { return x.isPrimary; })[0] || (co.contacts || [])[0] || {};
    var users = ctx.users || [];
    function uName(sid) { var u = users.filter(function (x) { return x.sid === sid; })[0]; return u ? u.name : ''; }
    var successFeeStr = '';
    if (c.successFee) {
      successFeeStr = c.successFeeType === 'percent' ? c.successFee + '%' : (c.successFee).toLocaleString() + '원';
    }
    var totalAmount = 0;
    var kindsArr = c.kinds || (c.kind ? [c.kind] : []);
    if (c.amounts) kindsArr.forEach(function (kv) { totalAmount += (c.amounts[kv] || 0); });
    else totalAmount = c.contractAmount || 0;
    var workers = co.workers || [];
    var primaryWorker = workers.filter(function (x) { return x.isPrimary; })[0] || workers[0] || {};
    var workerNamesAll = workers.map(function (x) { return x.name; }).filter(function (x) { return x; }).join(', ');
    var workerDetailLines = workers.map(function (x, i) {
      return (i + 1) + '. ' + (x.name || '') + (x.position ? ' (' + x.position + ')' : '')
        + (x.address ? ' / 주소: ' + x.address : '')
        + (x.phone ? ' / 연락처: ' + x.phone : '')
        + (x.rrn ? ' / 주민번호: ' + maskRRN(x.rrn) : '');
    }).join('\n');
    var kor = typeof ctx.korMoney === 'function' ? ctx.korMoney : function () { return ''; };
    return {
      회사명: co.name || c.companyName || '',
      사업자번호: co.bizNo || c.bizNo || '',
      대표자: co.ceo || '',
      주소: co.address || '',
      우편번호: co.zipcode || '',
      대표전화: co.phone || '',
      대표팩스: co.fax || '',
      대표이메일: co.email || '',
      업태: co.bizType || '',
      종목: co.bizCategory || '',
      규모: co.companySize || '',
      고용가입자수: String(co.employmentInsuredCount || 0),
      산재가입자수: String(co.injuryInsuredCount || 0),
      담당자: primaryContact.name || '',
      담당자연락처: primaryContact.phone || '',
      담당자이메일: primaryContact.email || '',
      계약번호: c.contractNo || '',
      계약일: c.signDate || '',
      계약시작일: c.startDate || '',
      계약종료일: c.endDate || '',
      계약기간: (c.startDate && c.endDate) ? (c.startDate + ' ~ ' + c.endDate) : (c.signDate || ''),
      부가세처리: c.vatType === 'inclusive' ? '부가세 포함' : '부가세 별도',
      납부일: co.taxInvoicePaymentDay || co.cmsPayDay || '',
      국민연금관리번호: co.pensionNo || '',
      건강보험번호: co.healthNo || '',
      고용보험번호: co.employmentNo || '',
      산재관리번호: co.injuryNo || '',
      법인등록번호: co.corpRegNo || '',
      대표생년월일: co.ceoBirth || '',
      대표자전체: co.ceo2 ? ((co.ceo || '') + ', ' + co.ceo2) : (co.ceo || ''),
      대표주민번호: (function () { var d = (co.ceoBirth || '').replace(/\D/g, ''); var ymd = d.length >= 8 ? d.slice(2, 8) : (d.length === 6 ? d : ''); return (ymd && co.ceoGender) ? (ymd + '-' + co.ceoGender + '******') : ''; })(),
      계약금액: totalAmount.toLocaleString(),
      계약금액한글: kor(totalAmount),
      성공보수: successFeeStr,
      주담당: uName(c.managerMain),
      부담당: (c.managerSubs || []).map(uName).filter(function (x) { return x; }).join(', '),
      오늘날짜: ctx.today || '',
      근로자수: String(workers.length),
      근로자이름: primaryWorker.name || '',
      근로자명단: workerNamesAll,
      근로자주민: maskRRN(primaryWorker.rrn || ''),
      근로자주소: primaryWorker.address || '',
      근로자연락처: primaryWorker.phone || '',
      근로자상세: workerDetailLines
    };
  }
  var api = { contractVars: contractVars, maskRRN: maskRRN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuContractVars = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
