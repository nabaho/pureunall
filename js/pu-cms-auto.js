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
  function hasMonth(companyId, incomes, ym) {
    return (incomes || []).some(function (x) {
      return x && !x._deleted && x.companyId === companyId && x.kind === '자문료' && ymOf(x) === ym;
    });
  }

  /* 줄마다 판정 — 순서가 곧 우선순위다(실패 → 되돌림 → 이미 넣음 → 잇기 → 금액 → 마감 → 겹침 → 자동) */
  function judgeRows(rows, ctx) {
    ctx = ctx || {};
    var byCode = {};
    (ctx.companies || []).forEach(function (c) {
      if (!c || !c.id || c.status !== 'active') return;
      (c.cmsMemberCodes || []).forEach(function (code) { if (code && !byCode[code]) byCode[code] = c; });
    });
    var done = {};
    (ctx.incomes || []).forEach(function (x) { if (x && !x._deleted && x.cmsKey) done[x.cmsKey] = true; });
    var seen = (ctx.incomes || []).slice();         // 이번 실행에서 «자동»으로 정한 것도 다음 줄의 판정에 넣는다
    var locked = ctx.isLocked || function () { return false; };
    var skip = ctx.skip || {};
    return (rows || []).map(function (r) {
      var it = { row: r, verdict: '', company: null, ym: '', why: '' };
      if (r.status === 'fail') { it.verdict = 'fail'; it.why = r.reason || '출금 실패'; return it; }
      if (r.status !== 'ok') { it.verdict = 'skip'; it.why = '출금 중'; return it; }
      if (skip[r._k]) { it.verdict = 'skip'; it.why = '되돌린 줄'; return it; }
      if (done[r._k]) { it.verdict = 'done'; return it; }
      var co = byCode[r.code] || null;
      it.company = co;
      if (!co) { it.verdict = 'new_member'; it.why = '회원코드가 어느 업체에도 이어져 있지 않음'; return it; }
      it.ym = nextAdvisoryYm(co.id, seen, r.wdate);
      if (!feeFits(co, r.amount)) { it.verdict = 'amount'; it.why = '월 자문료 ' + (co.monthlyAdvisoryFee || 0) + '원과 다름'; return it; }
      if (locked(it.ym)) { it.verdict = 'locked'; it.why = it.ym + ' 마감됨'; return it; }
      if (hasMonth(co.id, seen, it.ym)) { it.verdict = 'dup_month'; it.why = it.ym + ' 입금이 이미 있음'; return it; }
      it.verdict = 'auto';
      seen.push({ companyId: co.id, kind: '자문료', advisoryYm: it.ym, date: r.wdate });
      return it;
    });
  }

  function buildIncome(item, nowMs, bySid) {
    var r = item.row, co = item.company;
    var t = nowMs || Date.now();
    return {
      id: 'fi-cms-' + t.toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      entityType: 'FinancialTransaction',
      kind: '자문료', sourceKind: 'company', sourceId: '',
      companyId: co.id, companyName: co.name,
      amount: r.amount, date: r.wdate, advisoryYm: item.ym,
      managerSid: co.managerMain || '', managerName: '',
      cmsKey: r._k, autoConfirmed: true, autoBy: 'cms-auto',
      note: '[나이스빌CMS] ' + r.wdate + ' 자동이체 (더빌 출금결과 자동)',
      createdAt: new Date(t).toISOString(), updatedAt: t, updatedBy: bySid || ''
    };
  }

  var API = { statusOf: statusOf, rowKey: rowKey, parsePayTable: parsePayTable,
    nextAdvisoryYm: nextAdvisoryYm, judgeRows: judgeRows, buildIncome: buildIncome };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuCmsAuto = API;
})(typeof window !== 'undefined' ? window : this);
