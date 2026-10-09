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

  var API = { statusOf: statusOf, rowKey: rowKey, parsePayTable: parsePayTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuCmsAuto = API;
})(typeof window !== 'undefined' ? window : this);
