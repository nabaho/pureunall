/* 🤖 재무 자동화 1단계 — CMS 자동이체 입금 판정 (2026-10-09)
   ════════════════════════════════════════════════════════════════════════
   설계: docs/superpowers/specs/2026-10-09-재무자동화-CMS-design.md
   ★ 화면도 저장도 없다. 받은 줄과 이알피 자료를 받아 «무엇을 할지»만 돌려준다.
   ★ 업체는 회원코드(cmsMemberCodes)로만 찾는다 — 금액만 맞춘 추측은 쓰지 않는다
     (2026-09-15 김보람 노무사 건의: 금액이 같은 업체가 수십 곳이다).
   ★ 노드(scripts/thebill-pull.js)와 브라우저(pu-erp.html)가 함께 쓴다. */
(function (root) {
  'use strict';

  function str(v) { return String(v == null ? '' : v).trim(); }
  function nospace(v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
  function num(v) { return parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10) || 0; }
  function firstDate(v) { var m = String(v || '').match(/\d{4}-\d{2}-\d{2}/g) || []; return m; }

  /* 이알피 _nbStatusOf 와 같은 판정 — 검사가 둘을 견준다 */
  function statusOf(s) {
    var lead = nospace(String(s == null ? '' : s).split('[')[0]);
    if (!lead) return 'pending';
    if (lead.indexOf('출금성공') === 0 || lead.indexOf('정상') === 0
      || lead === '성공' || lead === '완료' || lead === '수납') return 'ok';
    if (lead.indexOf('출금실패') === 0
      || /미납|불능|실패|취소|잔액부족|지급정지|오류|해지|정지/.test(lead)) return 'fail';
    return 'pending';
  }
  function reasonOf(s) {
    var lead = str(String(s == null ? '' : s).split('[')[0]);
    var m = lead.match(/^출금실패\s*(.*)$/);
    return m ? nospace(m[1]) : '';
  }
  /* 이알피 _nbRowSig 와 같은 글자 */
  function rowKey(r) {
    return String(r.wdate || '') + '|' + nospace(r.name) + '|' + (parseInt(r.amount, 10) || 0) + '|' + String(r.code || '');
  }

  function col(head, words) {
    for (var i = 0; i < head.length; i++) {
      var h = nospace(head[i]);
      if (words.every(function (w) { return h.indexOf(w) >= 0; })) return i;
    }
    return -1;
  }

  /* 더빌 «출금결과조회» 표 → 줄. head 는 머리줄 칸 글자, body 는 줄마다 칸 글자.
     ⚠ 연락처·이메일·출금정보(계좌) 칸은 읽지 않는다 — 담을 까닭이 없다. */
  function parsePayTable(head, body) {
    var cDate = col(head, ['출금일']), cCode = col(head, ['회원코드']), cName = col(head, ['회원명']);
    var cAmt = col(head, ['납부금액']), cFee = col(head, ['수수료']), cSt = col(head, ['상태']);
    if (cDate < 0 || cCode < 0 || cName < 0 || cAmt < 0 || cSt < 0) return [];
    var out = [], seq = {};
    (body || []).forEach(function (cells) {
      if (!cells) return;
      var name = str(cells[cName]), wd = firstDate(cells[cDate])[0] || '';
      var amt = num(String(cells[cAmt] || '').split(/\n|원/)[0]);
      if (!name || !wd || !amt) return;
      var st = str(cells[cSt]);
      var r = { src: 'nicebill', wdate: wd, setdate: firstDate(cells[cAmt])[0] || '', name: name,
        code: str(cells[cCode]), amount: amt, fee: cFee >= 0 ? num(cells[cFee]) : 0,
        statusRaw: st.slice(0, 60), status: statusOf(st), reason: reasonOf(st), bank: '' };
      var sig = rowKey(r), i = seq[sig] || 0; seq[sig] = i + 1;
      r._k = i ? sig + '#' + i : sig;
      out.push(r);
    });
    return out;
  }

  function ymOf(rec) { return str(rec.advisoryYm) || str(rec.date).slice(0, 7); }
  function addMonth(ym, n) {
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + ('0' + (m + 1)).slice(-2);
  }
  /* 받을 달 = 그 업체 자문료의 가장 늦은 받을 달 + 1 (10/2 더빌 대조 규칙 — 말일 출금이 한 달 밀리지 않게) */
  function nextAdvisoryYm(companyId, incomes, wdate) {
    var last = '';
    (incomes || []).forEach(function (x) {
      if (!x || x._deleted || x.companyId !== companyId || x.kind !== '자문료') return;
      var ym = ymOf(x); if (ym > last) last = ym;
    });
    return last ? addMonth(last, 1) : str(wdate).slice(0, 7);
  }
  function feeFits(co, amt) {
    var fee = parseInt(co.monthlyAdvisoryFee, 10) || 0;
    if (!fee || !amt) return false;
    if (amt === fee) return true;
    return co.vatType === 'separate' && amt === Math.round(fee * 1.1);
  }
  /* 업체 이름 다듬기 기본값 — 이알피는 erpNormName 을 넘긴다 */
  function defaultNorm(s) { return nospace(s).replace(/주식회사|㈜|\(주\)|유한회사/g, '').toLowerCase(); }
  /* 이 입금이 그 업체 것인가 — 업체 번호가 같거나, 번호가 «비어 있고» 이름이 같을 때.
     ★ 이름 일치는 «자동 확정을 막는 데만» 쓴다(R15). 이름으로 잇거나 확정하지 않는다. */
  function sameCo(x, co, norm) {
    if (!x || !co) return false;
    if (x.companyId) return x.companyId === co.id;
    var a = norm(x.companyName), b = norm(co.name);
    return !!a && a === b;
  }
  /* 출금월(wdate 의 달)에 이미 받은 자문료가 있나 — 이번 실행에서 자동으로 정한 것도 포함 */
  function hasPaidInWdateMonth(co, incomes, wdate, norm) {
    var wm = str(wdate).slice(0, 7);
    return (incomes || []).some(function (x) {
      return x && !x._deleted && x.kind === '자문료' && sameCo(x, co, norm) && str(x.date).slice(0, 7) === wm;
    });
  }
  /* 이미 입금관리에 있나 — 같은 업체·같은 금액·출금일(또는 정산일) 앞뒤 5일, 또는 같은 받을 달.
     옛 은행 입금·손으로 넣은 입금(cmsKey 없음)과 겹치지 않게 한다. */
  function findRecorded(co, r, ym, incomes, norm) {
    var amt = parseInt(r.amount, 10) || 0, tw = dayMs(r.wdate), ts = dayMs(r.setdate);
    var near = function (a, b) { return !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= 5 * 864e5; };
    var hit = null;
    (incomes || []).some(function (x) {
      if (!x || x._deleted || x.kind !== '자문료' || !sameCo(x, co, norm)) return false;
      var xt = dayMs(x.date);
      var byAmt = (parseInt(x.amount, 10) || 0) === amt && (near(xt, tw) || near(xt, ts));
      if (byAmt || (ym && ymOf(x) === ym)) { hit = x; return true; }
      return false;
    });
    return hit;
  }

  /* 줄마다 판정 — 순서가 곧 우선순위다
     (실패 → 되돌림 → 이미 넣음 → 잇기 → 금액 → 마감 → 이미 입금관리에 있음 → 겹침 → 시작일 이전 → 자동)
     ★ ctx.since(자동 시작일) 이전 줄은 «auto» 가 될 수 없다(old). since 가 비었으면
       미리보기(ctx.preview) 때만 자르지 않는다 — 켜진 채 since 가 없으면 전부 old. */
  function judgeRows(rows, ctx) {
    ctx = ctx || {};
    var byCode = {}, ambiguous = {};
    (ctx.companies || []).forEach(function (c) {
      if (!c || !c.id || c.status !== 'active' || c._deleted === true) return;
      (c.cmsMemberCodes || []).forEach(function (code) {
        if (!code) return;
        if (byCode[code] && byCode[code].id !== c.id) { ambiguous[code] = true; return; }
        if (!byCode[code]) byCode[code] = c;
      });
    });
    var done = {};
    (ctx.incomes || []).forEach(function (x) { if (x && !x._deleted && x.cmsKey) done[x.cmsKey] = true; });
    var seen = (ctx.incomes || []).slice();         // 이번 실행에서 «자동»으로 정한 것도 다음 줄의 판정에 넣는다
    var locked = ctx.isLocked || function () { return false; };
    var skip = ctx.skip || {};
    var norm = ctx.normName || defaultNorm;
    var since = str(ctx.since), preview = ctx.preview === true;
    var real = (ctx.incomes || []).slice();
    return (rows || []).map(function (r) {
      var it = { row: r, verdict: '', company: null, ym: '', why: '' };
      if (r.status === 'fail') { it.verdict = 'fail'; it.why = r.reason || '출금 실패'; return it; }
      if (r.status !== 'ok') { it.verdict = 'skip'; it.why = '출금 중'; return it; }
      if (!str(r.wdate)) { it.verdict = 'skip'; it.why = '출금일 없음'; return it; }
      if (skip[r._k]) { it.verdict = 'skip'; it.why = '되돌린 줄'; return it; }
      if (done[r._k]) { it.verdict = 'done'; return it; }
      if (ambiguous[r.code]) { it.verdict = 'new_member'; it.why = '회원코드가 두 업체에 이어져 있음'; return it; }
      var co = byCode[r.code] || null;
      it.company = co;
      if (!co) { it.verdict = 'new_member'; it.why = '회원코드가 어느 업체에도 이어져 있지 않음'; return it; }
      it.ym = nextAdvisoryYm(co.id, seen, r.wdate);
      if (!feeFits(co, r.amount)) { it.verdict = 'amount'; it.why = '월 자문료 ' + (co.monthlyAdvisoryFee || 0) + '원과 다름'; return it; }
      /* 마감 — 받을 달뿐 아니라 입금 날짜(출금일)의 달도 본다(입금은 그 날짜의 달 장부에 앉는다) */
      var wym = str(r.wdate).slice(0, 7);
      if (locked(it.ym)) { it.verdict = 'locked'; it.why = it.ym + ' 마감됨'; return it; }
      if (locked(wym)) { it.verdict = 'locked'; it.why = wym + ' 마감됨 (입금일의 달)'; return it; }
      var rec = findRecorded(co, r, it.ym, real, norm);
      if (rec) { it.verdict = 'recorded'; it.why = '이미 입금관리에 있음 — ' + str(rec.date) + ' ' + (parseInt(rec.amount, 10) || 0) + '원'; return it; }
      if (hasPaidInWdateMonth(co, seen, r.wdate, norm)) { it.verdict = 'dup_month'; it.why = wym + ' 에 이미 받은 자문료가 있음'; return it; }
      if ((since && str(r.wdate) < since) || (!since && !preview)) {
        it.verdict = 'old'; it.why = since ? '자동 시작일(' + since + ') 이전 줄 — 미리보기만' : '자동 시작일이 없음 — 미리보기만'; return it;
      }
      it.verdict = 'auto';
      seen.push({ companyId: co.id, kind: '자문료', advisoryYm: it.ym, date: r.wdate });
      return it;
    });
  }

  /* 파이어베이스 열쇠에 못 쓰는 글자(. # $ [ ] /)를 _ 로 — 받기 스크립트·이알피·되돌리기가 함께 쓴다 */
  function safeKey(k) { return String(k).replace(/[.#$\[\]\/]/g, '_'); }

  /* ★ id 는 줄 지문에서 정한다 — 두 기기가 같은 줄을 동시에 넣어도 같은 칸을 덮을 뿐 두 건이 되지 않는다 */
  function buildIncome(item, nowMs, bySid) {
    var r = item.row, co = item.company;
    var t = nowMs || Date.now();
    return {
      id: 'fi-cms-' + safeKey(r._k),
      entityType: 'FinancialTransaction',
      kind: '자문료', sourceKind: 'company', sourceId: co.id,
      companyId: co.id, companyName: co.name,
      amount: r.amount, date: r.wdate, advisoryYm: item.ym,
      managerSid: co.managerMain || '', managerName: '',
      cmsKey: r._k, autoConfirmed: true, autoBy: 'cms-auto',
      note: '[나이스빌CMS] ' + r.wdate + ' 자동이체 (더빌 출금결과 자동)',
      createdAt: new Date(t).toISOString(), updatedAt: t, updatedBy: bySid || ''
    };
  }

  function dayMs(s) { return Date.parse(str(s).slice(0, 10) + 'T00:00:00Z'); }
  function shift(ymd, n) { var t = dayMs(ymd); return isNaN(t) ? '' : new Date(t + n * 864e5).toISOString().slice(0, 10); }
  function inSet(set, k) {
    if (!set) return false;
    if (typeof set.has === 'function') return set.has(k);
    return !!set[k];
  }
  /* ★ 입금을 만들지 않는다 — «처리됨» 표시만 고른다(2026-01·02 겹침 43건의 뿌리를 막는다)
     opts.recordedKeys      : 입금관리에 들어간 더빌 줄의 _k (done·recorded·이번에 넣은 것)
                              → 정산일 하루의 성공 줄이 «전부» 들어 있을 때만 더빌 합계 줄을 표시한다
     opts.processedIncomeIds: 이미 다른 통장 줄이 «처리됨»으로 가져간 입금 id — 두 번째 입금을 삼키지 않게 */
  function bankLinesToMark(bankRows, opts) {
    opts = opts || {};
    var norm = opts.normName || function (s) { return nospace(s).toLowerCase(); };
    var tol = opts.feeTol == null ? 1100 : opts.feeTol;
    var used = {}, usedDay = {}, out = [];
    var taken = opts.processedIncomeIds || {};
    (bankRows || []).forEach(function (b) {
      var amt = parseInt(b.amount, 10) || 0, d = str(b.date).slice(0, 10);
      if (!amt || !d) return;
      if (/더빌/.test(String(b.memo || ''))) {
        /* R9: 정산일 하루는 더빌 줄 하나만 먹는다 — 이미 쓴 날은 건너뛴다 */
        var days = [d, shift(d, -1), shift(d, 1)];
        for (var i = 0; i < days.length; i++) {
          if (usedDay[days[i]]) continue;
          var sum = 0, fee = 0, n = 0, all = true;
          (opts.cmsRows || []).forEach(function (r) {
            if (r && r.status === 'ok' && str(r.setdate).slice(0, 10) === days[i]) {
              sum += r.amount || 0; fee += r.fee || 0; n++;
              if (!inSet(opts.recordedKeys, r._k)) all = false;
            }
          });
          /* 그날 줄 하나라도 입금관리에 없으면 표시하지 않는다 — 처리됨이 되면 아무도 다시 안 본다 */
          if (n && all && Math.abs(sum - amt) <= fee + tol) { usedDay[days[i]] = true; out.push({ row: b, why: 'cms_sum', day: days[i] }); return; }
        }
        return;
      }
      var m = norm(b.memo), t = dayMs(d);
      if (isNaN(t)) return;
      var hits = (opts.incomes || []).filter(function (x) {
        if (!x || x._deleted || used[x.id] || inSet(taken, x.id) || (parseInt(x.amount, 10) || 0) !== amt) return false;
        /* CMS 로 들어간 입금은 더빌 합계 줄로 들어온다 — 업체 이름 줄과 짝짓지 않는다 */
        if (x.cmsKey) return false;
        var xt = dayMs(x.date);
        if (isNaN(xt) || Math.abs(xt - t) > 1 * 864e5) return false;
        var c = norm(x.companyName);
        return c && m && (c.indexOf(m) >= 0 || m.indexOf(c) >= 0);
      });
      if (hits.length === 1) { used[hits[0].id] = true; out.push({ row: b, why: 'recorded', incomeId: hits[0].id }); }
    });
    return out;
  }

  var API = { statusOf: statusOf, rowKey: rowKey, parsePayTable: parsePayTable,
    nextAdvisoryYm: nextAdvisoryYm, judgeRows: judgeRows, buildIncome: buildIncome,
    bankLinesToMark: bankLinesToMark, safeKey: safeKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuCmsAuto = API;
})(typeof window !== 'undefined' ? window : this);
