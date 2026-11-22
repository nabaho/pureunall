/* ══════════════════════════════════════════════════════════════════════
   데이터관리(대표 전용) 계산 모듈 — js/pu-datahub-calc.js (2026-11-21)
   계획서 docs/superpowers/plans/2026-11-18-데이터관리-계획서.md 2절 «무엇을 어디서 읽나»

   ★ 원본은 «읽기만» 한다. 이 파일에는 파이어베이스가 없다 — 받은 자료를 셈만 한다(노드에서도 돈다).
   ★ 두 번 세지 않는다 — 입금 합계는 data/finance_income 한 곳에서만 낸다(사건 incomes·계약 금액 같은 사본은 더하지 않는다).
   ★ 거르개는 이알피와 «같은 규칙» — erpIncomeLive · erpIncomeIsRevenue · erpPerfCounts · erpAdvisoryDues 를 그대로 옮겼다.
     tests/datahub-calc.test.js 가 pu-erp.html 의 진짜 함수를 떼어 같은 답인지 견준다(한쪽만 고치면 빨개진다).
   ★ 사람은 sid 로만 잇는다 — 이름으로 짐작해 잇지 않는다(온톨로지 규칙).

   화면이 받는 자료 모양 (build 의 결과)
     months     ['2025-12', … '2026-11']  끝 달 포함 12개
     MONTHS     ['25.12', …]  · MONTH_KO ['2025년 12월', …]
     PEOPLE     [{ id(sid), name, kind:'대표'|'노무사'|'직원', retired, color, cos(주담당 업체 수),
                   recRate(최근 26주 기록 있는 주 비율 0~100 | null), m:[{inc(원), task(건), proc(건)}]×12,
                   wkN:[주별 업무 기록 건수]×26 }]
     NONE       { m:[{inc}]×12 }   담당을 못 정한 입금(성과 몫도 업체 주담당도 없음)
     CATS       [{k,name,color}]  adv 자문(월정) · case 사건 · cons 컨설팅 · fund 기금 · etc 기타
     MTOT       [{inc, task, proc, n(입금 건수), cat:{adv,case,cons,fund,etc}}]×12
     COMP       [{ id, code, name, owner(sid|''), inc12(원), incAll(원), task(건), misu(bool|null), misuAmt(원), misuMonths }]
     weeks      ['2026-W22', …] 26개 · REC_RATES [달별 전체 기록률 | null]×12
     years      [{ y, gross, net, n, cat:{…} }]  자료가 있는 해만(첫 입금 해 ~ 끝 달의 해)
     quality    { 읽은 줄·뺀 줄 셈 — 화면 «포함·제외 검토»와 근거 줄에 그대로 쓴다 }
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── 0. 자료 봉투 풀기 — data/{표} 는 {v:…, u:…}. v 는 배열이거나 {id:rec} 지도이거나 {0,1,2…} 객체 ── */
  function unwrap(val) {
    if (val == null) return [];
    var v = (val && typeof val === 'object' && !Array.isArray(val) && val.v !== undefined) ? val.v : val;
    if (Array.isArray(v)) return v.filter(function (x) { return x && typeof x === 'object'; });
    if (v && typeof v === 'object') {
      return Object.keys(v).map(function (k) {
        var r = v[k];
        if (!r || typeof r !== 'object') return null;
        /* 열쇠에는 번호가 있는데 본문에 번호가 없는 자국(이알피 normalizeFbValue 주석)도 식구로 친다 — 사본으로만, 원본은 안 고친다 */
        if (r.id == null && !/^\d+$/.test(k)) { var c = {}; for (var f in r) c[f] = r[f]; c.id = k; return c; }
        return r;
      }).filter(Boolean);
    }
    return [];
  }

  /* ── 1. 이알피와 같은 판정 (pu-erp.html 그대로 — 고치려면 이알피와 함께) ── */
  function erpIncomeLive(fi){
    return !!fi && !fi._deleted && !fi.undoneDate;
  }
  function erpIncomeIsRevenue(fi){
    return erpIncomeLive(fi) && fi.sourceKind !== 'perf-adjust';
  }
  function erpPerfCounts(item, forPay){
    if(!item || item._deleted) return false;
    if(item.sourceKind === 'company') return false;
    if(item.isPersonalIncome) return false;
    if(item.undoneDate && !item.perfSettled) return false;
    if(forPay && item.perfHistorical) return false;
    return true;
  }
  function erpAdvisoryYmOf(fi){
    var a = String((fi && fi.advisoryYm) == null ? '' : fi.advisoryYm).trim();
    return a || String((fi && fi.date) == null ? '' : fi.date).trim().slice(0, 7);
  }
  function erpIsAdvisoryIncome(fi){
    if(!fi) return false;
    return fi.kind === '자문료' || (!fi.kind && fi.sourceKind === 'company');
  }
  function incomeIsCo(i, co){
    if(!i || !co) return false;
    var id = (typeof co === 'object') ? (co.id || '') : '';
    var nm = (typeof co === 'object') ? (co.name || '') : String(co);
    if(id && i.companyId) return i.companyId === id;
    return i.companyName === nm;
  }
  function erpFeeForMonth(co, ym){
    var now = co ? (parseInt(co.monthlyAdvisoryFee, 10) || parseInt(co.fee, 10) || 0) : 0;
    if(!co || !ym) return now;
    var hist = co.feeHistory;
    if(!hist || !hist.length) return now;
    var key = String(ym).slice(0, 7);
    var best = null, oldest = null;
    for(var i = 0; i < hist.length; i++){
      var hrec = hist[i];
      if(!hrec || !hrec.from) continue;
      var from = String(hrec.from).slice(0, 7);
      if(!oldest || from < String(oldest.from).slice(0, 7)) oldest = hrec;
      if(from > key) continue;
      if(!best || from > String(best.from).slice(0, 7)) best = hrec;
    }
    if(best) return parseInt(best.fee, 10) || 0;
    return oldest ? (parseInt(oldest.fee, 10) || 0) : now;
  }
  var _todayYM = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); };
  function erpFeeStopped(co, ym){
    if(!co || !co.suspended) return false;
    var at = String(co.suspendedAt || '').slice(0, 7) || _todayYM();
    return String(ym || _todayYM()).slice(0, 7) > at;
  }
  function erpAdvisoryIndex(incomes){
    var by = {};
    (Array.isArray(incomes) ? incomes : []).forEach(function(i){
      if(!erpIncomeLive(i) || !erpIsAdvisoryIncome(i)) return;
      var ym = erpAdvisoryYmOf(i);
      if(!ym) return;
      (by[ym] = by[ym] || []).push(i);
    });
    return { __advIdx:true, byYm:by };
  }
  function erpAdvisoryPaidFor(co, ym, incomes){
    if(!co || !ym) return [];
    var list = (incomes && incomes.__advIdx) ? (incomes.byYm[ym] || [])
             : (Array.isArray(incomes) ? incomes : []);
    return list.filter(function(i){
      return erpIncomeLive(i) && erpIsAdvisoryIncome(i) && erpAdvisoryYmOf(i) === ym && incomeIsCo(i, co);
    });
  }
  var ERP_ARREARS_MAX_MONTHS = 24;
  var ERP_ARREARS_TOL = 1100;
  function _erpYmShift(ym, n){
    var m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
    if(!m) return '';
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10) + (parseInt(n, 10) || 0);
    while(mo <= 0){ mo += 12; y -= 1; }
    while(mo > 12){ mo -= 12; y += 1; }
    return y + '-' + (mo < 10 ? '0' : '') + mo;
  }
  function erpAdvisoryDues(co, incomes, opts){
    opts = opts || {};
    var out = [];
    if(!co || typeof co !== 'object' || co._deleted || co.status !== 'active') return out;
    if((parseInt(co.monthlyAdvisoryFee, 10) || 0) <= 0 && !(co.feeHistory && co.feeHistory.length)) return out;
    var pd = co.taxInvoicePaymentDay;
    if(pd === '선납' || pd === '건별' || pd === '분기별') return out;
    var upTo = String(opts.upToYm || _todayYM()).slice(0, 7);
    if(!/^\d{4}-\d{2}$/.test(upTo)) return out;
    var back = parseInt(opts.maxMonths, 10) || ERP_ARREARS_MAX_MONTHS;
    var start = String(co.contractStartDate || '').slice(0, 7);
    var idx = (incomes && incomes.__advIdx) ? incomes : erpAdvisoryIndex(incomes || []);
    for(var n = back - 1; n >= 0; n--){
      var ym = _erpYmShift(upTo, -n);
      if(!ym) continue;
      if(start && ym < start) continue;
      if(erpFeeStopped(co, ym)) continue;
      var fee = erpFeeForMonth(co, ym);
      if(fee <= 0) continue;
      var got = 0;
      erpAdvisoryPaidFor(co, ym, idx).forEach(function(i){ got += parseInt(i.amount, 10) || 0; });
      if(got >= fee) continue;
      if(got > 0 && fee - got <= ERP_ARREARS_TOL) continue;
      out.push({ ym:ym, fee:fee, got:got, remain:fee - got });
    }
    return out;
  }

  /* ── 2. 작은 도구 ── */
  function num(v) { var x = parseInt(v, 10); return isFinite(x) ? x : 0; }
  function ymOk(s) { return /^\d{4}-\d{2}$/.test(String(s || '')); }
  function ymList(endYm, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(_erpYmShift(endYm, -i));
    return out;
  }
  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  /* 업무관리(work.html)와 같은 주 열쇠 — ISO 주(그 주 목요일의 해) 'YYYY-Www' */
  function mondayOf(d) { d = new Date(d.getTime()); d.setHours(0, 0, 0, 0); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function weekKeyOfDate(dt) {
    var mon = mondayOf(dt), thu = addDays(mon, 3), y = thu.getFullYear(), jan4 = new Date(y, 0, 4);
    var wk = 1 + Math.round((mondayOf(thu) - mondayOf(jan4)) / (7 * 86400000));
    return y + '-W' + pad2(wk);
  }
  function weekKeyOf(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
    if (!m) return '';
    return weekKeyOfDate(new Date(+m[1], +m[2] - 1, +m[3]));
  }
  /* endYmd 가 든 주부터 거슬러 n 주 (오래된 주가 앞) */
  function weekList(endYmd, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(endYmd || ''));
    var end = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    var mon = mondayOf(end), out = [];
    for (var i = n - 1; i >= 0; i--) out.push(weekKeyOfDate(addDays(mon, -7 * i)));
    return out;
  }
  function lastDayOfYm(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
    if (!m) return '';
    var d = new Date(+m[1], +m[2], 0);
    return m[1] + '-' + m[2] + '-' + pad2(d.getDate());
  }

  /* 사람 구분 — 직종 칸이 따로 없다(계획서 2-1). 사번 머리글자와 직위로 가르고, 대표는 노무사 평균에서 빼지 않게 «대표»로 따로 센다 */
  function personKind(u) {
    if (!u) return '직원';
    if (u.role === 'admin') return '대표';
    if ((u.title && String(u.title).indexOf('노무사') >= 0) || /^P-/.test(String(u.sid || ''))) return '노무사';
    return '직원';
  }
  /* 사람 구분색 — 저장소의 «사람 구분색» 스물네 색(tests/color-palette.test.js EXT_PERSON_COLORS)만 돌려 쓴다.
     목업과 같은 차례로 앞의 일곱을 두었다. 5계열 27색 밖 색을 새로 만들지 않는다 */
  var PERSON_COLORS = ['#1e3a8a', '#0e7490', '#a21caf', '#c2410c', '#4d7c0f', '#be185d', '#5b21b6',
    '#166534', '#9f1239', '#155e75', '#92400e', '#701a75', '#3730a3', '#065f46', '#9a3412', '#6b21a8',
    '#134e4a', '#831843', '#78350f', '#1e40af', '#812d8b', '#7c2d12', '#1d1de7', '#e71ddd'];
  var CATS = [
    { k: 'adv', name: '자문(월정)', color: '#166534' },
    { k: 'case', name: '사건', color: '#16a34a' },
    { k: 'cons', name: '컨설팅', color: '#4ade80' },
    { k: 'fund', name: '기금', color: '#2563eb' },
    { k: 'etc', name: '기타', color: '#94a3b8' }
  ];
  function catOf(fi) {
    if (erpIsAdvisoryIncome(fi)) return 'adv';
    var sk = String((fi && fi.sourceKind) || '');
    if (sk === 'case') return 'case';
    if (sk === 'consulting' || (fi && fi.kind === '컨설팅')) return 'cons';
    if (sk === 'fund') return 'fund';
    return 'etc';
  }
  function emptyCat() { return { adv: 0, case: 0, cons: 0, fund: 0, etc: 0 }; }

  /* 입금 한 줄의 «달» — 입금일 기준(cash) 또는 귀속월 기준(accrual: 자문료 몇 월분 · 그 밖은 성과 반영 월) */
  function monthOf(fi, basis) {
    if (basis === 'accrual') {
      if (erpIsAdvisoryIncome(fi)) return erpAdvisoryYmOf(fi);
      return String(fi.perfYM || String(fi.date || '').slice(0, 7));
    }
    return String(fi.date || '').slice(0, 7);
  }
  /* 입금 한 줄의 금액 — 총액(amount, 카드 수수료 빼기 전) 또는 순액(amount − cardFee) */
  function amountOf(fi, net) {
    var a = num(fi.amount);
    return net ? a - num(fi.cardFee) : a;
  }

  /* ── 3. 모으기 ──
     raw = { incomes, userDir, companies, workItems(배열), workLogs([{d,by}] — 본문 t 는 받지 않아도 된다) }
     opts = { endYm, basis:'cash'|'accrual', net:bool, today:'YYYY-MM-DD' }
     결정(계획서 9절 — 추천안으로 시작, 화면 «포함·제외 검토»에 적는다)
       ① 성과 몫 없는 입금(자문료 등) → 업체 주담당(managerMain) 몫. 그것도 없으면 «담당 없음»
       ③ 과거기록(confirmed:false)·개인수익(isPersonalIncome) 줄 → 뺀다(셈은 quality 에 남긴다) */
  function build(raw, opts) {
    raw = raw || {}; opts = opts || {};
    var basis = opts.basis === 'accrual' ? 'accrual' : 'cash';
    var net = !!opts.net;
    var endYm = ymOk(opts.endYm) ? opts.endYm : _todayYM();
    var months = ymList(endYm, 12), mIdx = {};
    months.forEach(function (ym, i) { mIdx[ym] = i; });
    var today = String(opts.today || (lastDayOfYm(endYm))).slice(0, 10);
    var weeks = weekList(today, 26), wIdx = {};
    weeks.forEach(function (w, i) { wIdx[w] = i; });

    var incomes = Array.isArray(raw.incomes) ? raw.incomes : unwrap(raw.incomes);
    var users = Array.isArray(raw.userDir) ? raw.userDir : unwrap(raw.userDir);
    var companies = Array.isArray(raw.companies) ? raw.companies : unwrap(raw.companies);
    var items = Array.isArray(raw.workItems) ? raw.workItems : unwrap(raw.workItems);
    var logs = Array.isArray(raw.workLogs) ? raw.workLogs : [];

    var q = { incomeRows: incomes.length, used: 0, deleted: 0, undone: 0, adjust: 0, historical: 0, personal: 0,
      noDate: 0, outOfRange: 0, noOwner: 0, viaShares: 0, viaCompany: 0, logRows: logs.length, logNoBy: 0, logOutOfRange: 0,
      cardFeeRows: 0, accrualDiffRows: 0 };

    /* 사람 칸 — 명부의 sid 로만. 명부에 없는 sid 는 «명부에 없음(sid)» 으로 따로 둔다(이름을 짐작하지 않는다) */
    var P = {}, order = [], ghostN = 0;
    function person(sid) {
      sid = String(sid || '');
      if (!sid) return null;
      if (P[sid]) return P[sid];
      var u = null;
      for (var i = 0; i < users.length; i++) if (users[i] && users[i].sid === sid) { u = users[i]; break; }
      /* ⚠ 이름을 모를 때 사번을 대신 적지 않는다(대표 결정 2026-10-25 «이름만» — tests/sid-never-shown). 명부에 없는 사람은 «명부에 없음 N» */
      if (!u) ghostN++;
      var p = { id: sid, name: u ? String(u.name || '이름 미확인') : ('명부에 없음 ' + ghostN), kind: personKind(u || { sid: sid }),
        retired: !u || (u.status && u.status !== 'active'), color: '', cos: 0, recRate: null,
        m: months.map(function () { return { inc: 0, task: 0, proc: 0 }; }), wkN: weeks.map(function () { return 0; }),
        _wkAny: weeks.map(function () { return false; }), inDir: !!u };
      P[sid] = p; order.push(sid);
      return p;
    }
    /* 재직자는 자료가 없어도 줄을 둔다(빠진 사람이 «일을 안 한 사람»으로 안 보이게 — 기록률을 옆에 붙인다) */
    users.forEach(function (u) { if (u && u.sid && u.status === 'active' && u.role !== 'reviewer') person(u.sid); });

    var coById = {};
    companies.forEach(function (c) { if (c && c.id) coById[c.id] = c; });

    var NONE = { m: months.map(function () { return { inc: 0 }; }) };
    var MTOT = months.map(function () { return { inc: 0, task: 0, proc: 0, n: 0, cat: emptyCat() }; });
    var yearBox = {};

    incomes.forEach(function (fi) {
      if (!fi || typeof fi !== 'object') return;
      if (fi._deleted) { q.deleted++; return; }
      if (fi.undoneDate) { q.undone++; return; }
      if (fi.sourceKind === 'perf-adjust') { q.adjust++; return; }
      if (fi.confirmed === false) { q.historical++; return; }
      if (fi.isPersonalIncome) { q.personal++; return; }
      if (!erpIncomeIsRevenue(fi)) return;
      if (num(fi.cardFee)) q.cardFeeRows++;
      var ym = monthOf(fi, basis), amt = amountOf(fi, net), ck = catOf(fi);
      if (ym !== String(fi.date || '').slice(0, 7)) q.accrualDiffRows++;
      if (!ymOk(ym)) { q.noDate++; return; }
      /* 해마다 (다년 대조) — 같은 기준·같은 금액 */
      var y = ym.slice(0, 4);
      var yb = yearBox[y] || (yearBox[y] = { y: +y, gross: 0, net: 0, n: 0, cat: emptyCat() });
      yb.gross += num(fi.amount); yb.net += num(fi.amount) - num(fi.cardFee); yb.n++; yb.cat[ck] += num(fi.amount);
      var i = mIdx[ym];
      if (i == null) { q.outOfRange++; return; }
      q.used++;
      var t = MTOT[i];
      t.inc += amt; t.n++; t.cat[ck] += amt;
      /* 처리 건수 — 확정한 사람(confirmedBy, sid) */
      if (fi.confirmedBy) { var cp = person(fi.confirmedBy); if (cp) cp.m[i].proc++; t.proc++; }
      /* 사람 몫 — 성과 몫(perfShares)의 분배 비율(sharePct)로 입금액을 나눈다. 성과급 금액(amount)이 아니라 «입금 기여»다 */
      var shares = (Array.isArray(fi.perfShares) ? fi.perfShares : []).filter(function (s) { return s && s.sid; });
      if (shares.length) {
        q.viaShares++;
        var sumPct = 0;
        shares.forEach(function (s) { sumPct += (s.sharePct != null ? Number(s.sharePct) : 100); });
        if (!(sumPct > 0)) sumPct = 100 * shares.length;
        var given = 0;
        shares.forEach(function (s, k) {
          var pct = (s.sharePct != null ? Number(s.sharePct) : 100);
          var part = (k === shares.length - 1) ? amt - given : Math.round(amt * pct / sumPct);
          given += part;
          var sp = person(s.sid); if (sp) sp.m[i].inc += part;
        });
        return;
      }
      /* 결정 ① — 성과 몫 없는 입금은 업체 주담당 몫 */
      var co = fi.companyId ? coById[fi.companyId] : null;
      if (co && co.managerMain) { q.viaCompany++; var op = person(co.managerMain); if (op) { op.m[i].inc += amt; return; } }
      q.noOwner++; NONE.m[i].inc += amt;
    });

    /* 업무 기록 — 건수만 센다(소요시간 칸이 없다). 본문은 보지 않는다 */
    var monthAnyByMonth = months.map(function () { return {}; });
    logs.forEach(function (lg) {
      if (!lg) return;
      var d = String(lg.d || '').slice(0, 10), by = String(lg.by || '');
      if (!by) { q.logNoBy++; return; }
      var ym = d.slice(0, 7), i = mIdx[ym], w = wIdx[weekKeyOf(d)];
      if (i == null && w == null) { q.logOutOfRange++; return; }
      var p = person(by); if (!p) return;
      if (i != null) { p.m[i].task++; MTOT[i].task++; monthAnyByMonth[i][by] = true; }
      if (w != null) { p.wkN[w]++; p._wkAny[w] = true; }
    });

    /* 업체 — 주담당 수 · 12달 입금 · 누적 입금 · 업무건 수 · 자문료 미수(이알피 erpAdvisoryDues 와 같은 규칙) */
    var advIdx = erpAdvisoryIndex(incomes);
    var taskByCo = {};
    items.forEach(function (it) { if (it && !it._deleted && it.co_id) taskByCo[it.co_id] = (taskByCo[it.co_id] || 0) + 1; });
    var COMP = [];
    companies.forEach(function (c) {
      if (!c || !c.id || c._deleted || c.mergedInto) return;
      if (c.status !== 'active' && !taskByCo[c.id]) return;
      if (c.managerMain && c.status === 'active') { var op = person(c.managerMain); if (op) op.cos++; }
      COMP.push({ id: c.id, code: String(c.no || c.puNo || c.id), name: String(c.name || ''), owner: String(c.managerMain || ''),
        inc12: 0, incAll: 0, task: taskByCo[c.id] || 0, misu: null, misuAmt: 0, misuMonths: 0, active: c.status === 'active' });
    });
    var compById = {};
    COMP.forEach(function (x) { compById[x.id] = x; });
    incomes.forEach(function (fi) {
      if (!erpIncomeIsRevenue(fi) || fi.confirmed === false || fi.isPersonalIncome || !fi.companyId) return;
      var x = compById[fi.companyId]; if (!x) return;
      var a = amountOf(fi, net);
      x.incAll += a;
      if (mIdx[monthOf(fi, basis)] != null) x.inc12 += a;
    });
    /* 미수 — 끝 달의 «지난 달»까지(이번 달은 아직 받을 날이 안 왔을 수 있다). 자문료를 매달 걷는 업체만 */
    var upTo = _erpYmShift(endYm, -1);
    COMP.forEach(function (x) {
      var c = coById[x.id];
      var advisory = c && c.status === 'active' && ((num(c.monthlyAdvisoryFee) > 0) || (c.feeHistory && c.feeHistory.length));
      if (!advisory) return;
      var dues = erpAdvisoryDues(c, advIdx, { upToYm: upTo, maxMonths: 12 });
      x.misu = dues.length > 0;
      x.misuMonths = dues.length;
      dues.forEach(function (d) { x.misuAmt += d.remain; });
    });

    /* 사람 줄 마무리 — 색·기록률. 자료가 하나도 없고 재직도 아닌 사람은 뺀다 */
    var PEOPLE = order.map(function (sid) { return P[sid]; }).filter(function (p) {
      if (!p.retired) return true;
      return p.m.some(function (x) { return x.inc || x.task || x.proc; });
    });
    var rank = { '대표': 0, '노무사': 1, '직원': 2 };
    PEOPLE.sort(function (a, b) { return (rank[a.kind] - rank[b.kind]) || (a.retired - b.retired) || String(a.id).localeCompare(String(b.id)); });
    PEOPLE.forEach(function (p, k) {
      p.color = PERSON_COLORS[k % PERSON_COLORS.length];
      if (!p.retired) {
        var any = 0; p._wkAny.forEach(function (b) { if (b) any++; });
        p.recRate = Math.round(any / weeks.length * 100);
      }
      delete p._wkAny;
    });
    /* 달별 전체 기록률 — 그 달에 기록이 하나라도 있는 재직자 비율(분모 0 이면 null) */
    var activeN = PEOPLE.filter(function (p) { return !p.retired; }).length;
    var REC_RATES = months.map(function (_, i) {
      if (!activeN) return null;
      var c = 0; PEOPLE.forEach(function (p) { if (!p.retired && monthAnyByMonth[i][p.id]) c++; });
      return Math.round(c / activeN * 100);
    });

    var endY = +endYm.slice(0, 4);
    var years = Object.keys(yearBox).map(function (k) { return yearBox[k]; })
      .filter(function (r) { return r.y <= endY; })
      .sort(function (a, b) { return a.y - b.y; });

    return {
      endYm: endYm, basis: basis, net: net, months: months,
      MONTHS: months.map(function (ym) { return ym.slice(2, 4) + '.' + ym.slice(5, 7); }),
      MONTH_KO: months.map(function (ym) { return ym.slice(0, 4) + '년 ' + (+ym.slice(5, 7)) + '월'; }),
      PEOPLE: PEOPLE, NONE: NONE, CATS: CATS.map(function (c) { return { k: c.k, name: c.name, color: c.color }; }),
      MTOT: MTOT, COMP: COMP, weeks: weeks, REC_RATES: REC_RATES, years: years, quality: q
    };
  }

  /* ── 4. 채팅에 보낼 «집계 숫자» — 사람은 P1·P2, 업체는 C-01 같은 가명. 실명·업체명·번호는 싣지 않는다 ──
     돌려줌 { ctx(서버로 보낼 객체), back:{가명:실명} — back 은 화면에서만 쓰고 어디에도 보내지 않는다 } */
  function pseudonymize(ds) {
    /* ⚠ 서버(functions/datahub.js ctxShapeOk)는 이 모양 그대로만 받는다 — 칸을 더하면 서버도 함께 고친다. 자유 글 칸은 두지 않는다 */
    var back = {}, fwd = [], ctx = { months: ds.months, basis: ds.basis, net: ds.net, unit: '원',
      total: ds.MTOT.map(function (t) { return { inc: t.inc, n: t.n, task: t.task, proc: t.proc, cat: t.cat }; }),
      none: ds.NONE.m.map(function (x) { return x.inc; }),
      people: [], companies: [] };
    ds.PEOPLE.forEach(function (p, k) {
      var alias = 'P' + (k + 1);
      back[alias] = p.name;
      ctx.people.push({ alias: alias, kind: p.kind, retired: !!p.retired, cos: p.cos, recRate: p.recRate,
        m: p.m.map(function (x) { return { inc: x.inc, task: x.task, proc: x.proc }; }), wkN: p.wkN.slice() });
    });
    var aliasOf = {};
    ds.PEOPLE.forEach(function (p, k) { aliasOf[p.id] = 'P' + (k + 1); });
    ds.PEOPLE.forEach(function (p, k) { if (p.inDir !== false) addFwd(p.name, 'P' + (k + 1)); });
    /* 업체 — 숫자는 큰 곳 40곳만 싣지만, 가명은 «모든» 업체에 준다: 질문에 적은 업체명이 어느 곳이든 가명으로 바뀌어 나가게(보안 검토 2026-11-21) */
    ds.COMP.slice().sort(function (a, b) { return b.inc12 - a.inc12; }).forEach(function (c, k) {
      var alias = 'C-' + pad2(k + 1);
      back[alias] = c.name || c.code;
      addFwd(c.name, alias);
      var bare = String(c.name || '').replace(/^\s*(주식회사|\(주\)|㈜)\s*|\s*(주식회사|\(주\)|㈜)\s*$/g, '');
      if (bare !== c.name) addFwd(bare, alias);
      if (k < 40) ctx.companies.push({ alias: alias, owner: aliasOf[c.owner] || '', inc12: c.inc12, task: c.task, misu: c.misu, misuMonths: c.misuMonths });
    });
    function addFwd(name, alias) { name = String(name || '').trim(); if (Array.from(name).length >= 2) fwd.push([name, alias]); }
    fwd.sort(function (a, b) { return b[0].length - a[0].length; });
    return { ctx: ctx, back: back, fwd: fwd };
  }
  /* 질문 글의 실명·업체명을 보내기 전에 가명으로 — 긴 이름부터(«가나상사»가 «가나»보다 먼저). fwd 는 화면에서만 쓴다 */
  function maskText(text, ps) {
    var s = String(text == null ? '' : text).normalize('NFKC');
    ((ps && ps.fwd) || []).forEach(function (p) {
      /* 글자 사이 빈칸이 있어도 바꾼다(«가나 상사») — 서버도 빈칸을 뺀 꼴로 실명을 본다 */
      var chars = Array.from(String(p[0]).normalize('NFKC').replace(/\s+/g, ''));
      if (chars.length < 2) return;
      var re = new RegExp(chars.map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('\\s*'), 'g');
      s = s.replace(re, p[1]);
    });
    return s;
  }
  /* 답에 든 가명을 화면에서만 실명으로 되돌린다(긴 가명부터 — P1 이 P10 을 먹지 않게) */
  function unalias(text, back) {
    var keys = Object.keys(back || {}).sort(function (a, b) { return b.length - a.length; });
    var s = String(text == null ? '' : text);
    keys.forEach(function (k) { s = s.split(k).join(back[k]); });
    return s;
  }

  var API = {
    unwrap: unwrap, build: build, pseudonymize: pseudonymize, unalias: unalias, maskText: maskText,
    erpIncomeLive: erpIncomeLive, erpIncomeIsRevenue: erpIncomeIsRevenue, erpPerfCounts: erpPerfCounts,
    erpAdvisoryYmOf: erpAdvisoryYmOf, erpIsAdvisoryIncome: erpIsAdvisoryIncome, incomeIsCo: incomeIsCo,
    erpFeeForMonth: erpFeeForMonth, erpFeeStopped: erpFeeStopped, erpAdvisoryIndex: erpAdvisoryIndex,
    erpAdvisoryPaidFor: erpAdvisoryPaidFor, erpAdvisoryDues: erpAdvisoryDues,
    catOf: catOf, monthOf: monthOf, amountOf: amountOf, personKind: personKind,
    ymList: ymList, weekKeyOf: weekKeyOf, weekList: weekList, CATS: CATS, PERSON_COLORS: PERSON_COLORS,
    _setToday: function (fn) { _todayYM = fn; }
  };
  global.PuDatahubCalc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
