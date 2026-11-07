/* 자문료 입금확인 — «확인이 필요한 칸»을 가리고, 엑셀 «자문료입금현황» 양식으로 내보낸다 (대표 승인 2026-11-07)
   ■ 왜 — 해마다 엑셀 «자문료입금현황»에 입금 날짜를 손으로 적어 ERP 와 맞췄다. 실측(2026-11-07, 1~9월 1,155칸): ERP 에
     같은 달 입금이 있는 칸 90%, 금액까지 같은 칸 99.8%. 그러면 사람은 «ERP 에 없거나 금액이 어긋난 칸»만 보면 된다.
   ■ 이 파일은 «판단만» 한다 — 화면(업체입금 탭)이 부르는 함수(약정액·중단·입금 찾기)를 받아서 쓴다.
     그래서 ERP 의 셈(erpFeeForMonth · erpFeeStopped · erpAdvisoryPaidFor)을 다시 만들지 않는다. 같은 잣대가 두 벌이 되면 어긋난다.
   ⚠ 저절로 «입금표시를 만들지» 않는다. 읽고 알려 줄 뿐이다 — 금액만 같다고 업체를 짐작해 넣던 9월 CMS 사고를 되풀이하지 않으려고. */
(function (global) {
  'use strict';

  /* 이번 달은 «지정일이 지나고 며칠 더» 지나야 «입금 없음»으로 본다 — 하루 이틀 늦는 이체는 흔하다 */
  var GRACE_DAYS = 5;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(y, m) { return y + '-' + pad2(m); }
  function dueDayOf(c) {
    var a = parseInt(String(c.cmsPayDay == null ? '' : c.cmsPayDay).replace(/\D/g, ''), 10);
    if (a > 0 && a <= 31) return a;
    var b = parseInt(String(c.payDay == null ? '' : c.payDay).replace(/\D/g, ''), 10);
    return (b > 0 && b <= 31) ? b : 0;
  }

  /* o = { list:[업체…], year, nowYear, nowMonth, nowDay,
           feeFor(c, ym) → 그 달 약정액, stopped(c, ym) → 계약 중단 뒤인가,
           paid(c, ym) → {cnt, got} (그 업체가 그 달 자문료로 받은 건수·금액 합) }
     → [{id, name, ym, reason:'none'|'partial'|'over', fee, got, mainName}] 달 → 이름 차례 */
  function checkList(o) {
    var out = [];
    var nowYm = ymOf(o.nowYear, o.nowMonth);
    (o.list || []).forEach(function (c) {
      var start = String(c.contractStartDate || '').slice(0, 7);
      for (var m = 1; m <= 12; m++) {
        var ym = ymOf(o.year, m);
        if (ym > nowYm) continue;                                   /* 아직 안 온 달 */
        if (start && ym < start) continue;                          /* 계약 시작 전 */
        if (o.stopped && o.stopped(c, ym)) continue;                /* 계약 중단 뒤 */
        var fee = Number(o.feeFor(c, ym)) || 0;
        if (!(fee > 0)) continue;
        if (ym === nowYm) {                                         /* 이번 달 — 지정일을 모르거나 아직 안 지났으면 건너뜀 */
          var pd = dueDayOf(c);
          if (!pd || o.nowDay <= pd + GRACE_DAYS) continue;
        }
        var p = o.paid(c, ym) || { cnt: 0, got: 0 };
        var got = Number(p.got) || 0, cnt = Number(p.cnt) || 0;
        var reason = !cnt ? 'none' : (got < fee ? 'partial' : (got > fee ? 'over' : ''));
        if (reason) out.push({ id: c.id, name: c.name, ym: ym, reason: reason, fee: fee, got: got, mainName: c.mainName || '' });
      }
    });
    out.sort(function (a, b) { return a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : String(a.name).localeCompare(String(b.name)); });
    return out;
  }

  var REASON = { none: '입금 없음', partial: '금액 부족', over: '금액 초과' };
  function summarize(list) {
    var by = { none: 0, partial: 0, over: 0 };
    (list || []).forEach(function (r) { if (by[r.reason] != null) by[r.reason]++; });
    return by;
  }

  /* 엑셀 «자문료입금현황» 양식 — 사업장명 · 공급대가 · 입금일(지정일) · 1~12월(입금 날짜) · 비고
     o = { list, year, paidDates(c, ym) → ['YYYY-MM-DD'…], feeFor(c, ym), paid(c, ym) → {cnt, got} } → 줄 배열(첫 줄은 머리) */
  function excelRows(o) {
    var head = ['사업장명', '공급대가', '입금일'];
    for (var h = 1; h <= 12; h++) head.push(h + '월');
    head.push('비고');
    var rows = [head];
    (o.list || []).forEach(function (c) {
      var row = [c.name, Number(c.fee) || 0, dueDayOf(c) ? dueDayOf(c) + '일' : ''];
      var notes = [];
      for (var m = 1; m <= 12; m++) {
        var ym = ymOf(o.year, m);
        var ds = (o.paidDates(c, ym) || []).map(function (d) { return String(d).slice(0, 10); }).filter(Boolean).sort();
        row.push(ds.length ? ds[0] : '');
        if (ds.length) {
          var fee = Number(o.feeFor(c, ym)) || 0, p = o.paid(c, ym) || { got: 0 };
          if (fee > 0 && Number(p.got) < fee) notes.push(m + '월 부분입금 ' + Number(p.got).toLocaleString('ko-KR') + '/' + fee.toLocaleString('ko-KR'));
          else if (ds.length > 1) notes.push(m + '월 ' + ds.length + '번 입금');
        }
      }
      row.push(notes.join(' · '));
      rows.push(row);
    });
    return rows;
  }

  var api = { GRACE_DAYS: GRACE_DAYS, REASON: REASON, dueDayOf: dueDayOf, checkList: checkList, summarize: summarize, excelRows: excelRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuAdvCheck = api;
})(typeof window !== 'undefined' ? window : globalThis);
