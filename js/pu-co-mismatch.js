/* 🔍 업체 정보 대조 — 업체관리 ↔ 기업정보함 사업자등록증 ↔ 진행 중 계약의 회사 사본
   ════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-03 「푸른이알피와 기업정보함 … 대표·담당자가 제대로 연결이 안되는
   경우가 종종 있다 — 근본적으로」 → 1단계 「어긋남 대조표」(목업 승인 「진행」).

   ★ 읽기만 한다. 아무것도 고치지 않는다 — 고칠 곳은 각 줄의 「업체 열기」로 간다.
   ★ 짝은 «사업자번호로만» 짓는다(js/pu-cokey.js). 이름으로는 짓지 않는다 —
     「가나상사」가 두 곳일 수 있다. 번호가 없거나 검산에 걸리면 «못 잇는 업체»로 따로 센다.
   ★ 주소는 「📍 주소 다름」 과 «같은 잣대»를 쓴다(화면이 넘겨주는 addrSame = PuAddr.same).
     두 자리가 다른 말을 하면 안 된다.

   2026-10-03 서버 실측: 등록증과 짝지어진 91곳 가운데 45곳이 어긋났다(대표 16 · 주소 23 ·
   상호 30), 업체 쪽 빈칸(등록증엔 있음) 38칸, 번호로 못 잇는 업체 24곳. */
(function (root) {
  'use strict';

  function str(v) { return String(v == null ? '' : v).trim(); }
  function digits(v) { return str(v).replace(/\D/g, ''); }

  /* 대표자 «사람들» — 「홍길동, 김철수」 · 「홍길동 외 1명」 · 공동대표를 낱사람으로 가른다.
     겹치는 사람이 한 명이라도 있으면 같다고 본다(공동대표 중 한 분만 적어 둔 경우). */
  function people(v) {
    return str(v).replace(/\s*외\s*\d*\s*명?/g, '').split(/[,·/]|\s및\s/)
      .map(function (s) { return s.replace(/\s+/g, '').replace(/^대표(이사)?|대표(이사)?$/g, ''); })
      .filter(Boolean);
  }
  function samePeople(a, b) {
    var pa = people(a), pb = people(b);
    if (!pa.length || !pb.length) return null;
    return pa.some(function (x) { return pb.indexOf(x) >= 0; });
  }
  function ceoOf(co) {
    return [str(co.ceo), str(co.ceo2)].filter(Boolean).join(', ');
  }

  /* 기업정보함 색인(pucards/idx)에서 «등록증» 줄만 번호별로 모은다.
     ⚠ 한 번호에 등록증이 여럿이면 «먼저 만난 것» — 「📍 주소 다름」(pcBizAddrByNo)과 같은 차례다.
       다른 차례를 쓰면 같은 업체가 두 화면에서 다른 등록증과 견줘진다. */
  function bizIndex(idx, keyOf) {
    var by = {};
    Object.keys(idx || {}).forEach(function (id) {
      var r = idx[id];
      if (!r || r.k !== 'biz') return;
      var k = keyOf(r.bz);
      if (!k) return;
      if (!by[k]) by[k] = { id: id, r: r, n: 0 };
      by[k].n++;
    });
    return by;
  }

  /* 한 칸 견주기 → 'diff'(둘 다 있는데 다름) · 'empty'(업체만 비었고 등록증엔 있음) · null */
  function judge(mine, theirs, same) {
    var a = str(mine), b = str(theirs);
    if (!b) return null;
    if (!a) return 'empty';
    var s = same(a, b);
    return s === false ? 'diff' : null;
  }

  function closedCo(co) {
    return !co || co._deleted || str(co.status) === 'closed';
  }
  function liveContract(ct) {
    if (!ct || ct._deleted || ct.closedAt || ct.transferredTo) return false;
    return !/^(closed|cancelled|transferred)$/.test(str(ct.status));
  }

  /* opts = { keyOf, looksLikeBizNo, normName, addrSame }
     — 화면에서는 PuCoKey.key · PuCoKey.looksLikeBizNo · pcNormCo · PuAddr.same 를 넘긴다. */
  function build(companies, contracts, idx, opts) {
    var keyOf = opts.keyOf, normName = opts.normName, addrSame = opts.addrSame;
    var biz = bizIndex(idx, keyOf);
    var rows = [], noKey = [], ctRows = [];
    var count = { diff: 0, ceo: 0, addr: 0, name: 0, tel: 0, empty: 0, near: 0, noKey: 0, contract: 0, paired: 0, noCert: 0 };

    /* 상호는 셋으로 가른다 — 같음 · 'near'(한쪽이 다른 쪽을 품음: 「가나상사」/「가나상사 서울지점」) · 다름.
       실측 2026-10-03: 상호가 달랐던 30곳 중 15곳이 'near' 였다. 그것까지 빨강이면 진짜 다른 회사가 묻힌다. */
    var nameJudge = function (mine, theirs) {
      var a = normName(mine), b = normName(theirs);
      if (!b) return null;
      if (!a) return 'empty';
      if (a === b) return null;
      return (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) ? 'near' : 'diff';
    };
    var sameTel = function (a, b) { return digits(a) === digits(b); };

    (companies || []).forEach(function (co) {
      if (closedCo(co)) return;
      var k = keyOf(co.bizNo);
      if (!k) {
        noKey.push({ co: co, why: opts.looksLikeBizNo(co.bizNo) ? 'bad' : 'none' });
        count.noKey++;
        return;
      }
      var b = biz[k];
      if (!b) { count.noCert++; return; }
      count.paired++;
      var r = b.r;
      var f = {
        name: nameJudge(co.name, r.c),
        ceo: judge(ceoOf(co), r.ceo, samePeople),
        addr: judge(co.address, r.ad, addrSame),
        tel: judge(co.phone, r.ct, sameTel)
      };
      var diffs = Object.keys(f).filter(function (x) { return f[x] === 'diff'; });
      var empties = Object.keys(f).filter(function (x) { return f[x] === 'empty'; });
      var near = f.name === 'near';
      if (!diffs.length && !empties.length && !near) return;
      if (diffs.length) count.diff++;
      diffs.forEach(function (x) { count[x]++; });
      count.empty += empties.length;
      if (near) count.near++;
      rows.push({ co: co, cert: r, certId: b.id, certN: b.n, f: f, diffs: diffs, empties: empties, near: near });
    });

    /* 진행 중 계약의 «회사 사본»이 업체관리와 다른가 — 이관·종료된 계약은 옛 기록이라 안 본다 */
    var byId = {}, byKey = {};
    (companies || []).forEach(function (co) {
      if (!co || co._deleted) return;
      if (co.id) byId[co.id] = co;
      var k = keyOf(co.bizNo);
      if (k && !byKey[k]) byKey[k] = co;
    });
    (contracts || []).forEach(function (ct) {
      if (!liveContract(ct)) return;
      var cc = ct.company || {};
      var co = (ct.companyId && byId[ct.companyId]) || byKey[keyOf(ct.bizNo || cc.bizNo)] || null;
      if (!co) return;
      var contact = str(((cc.contacts || [])[0] || {}).name);
      var known = [str(co.primaryContactName)].concat((co.contacts || []).map(function (p) { return str(p && p.name); }))
        .filter(Boolean).map(function (s) { return s.replace(/\s+/g, ''); });
      var f = {
        ceo: str(cc.ceo) && ceoOf(co) && samePeople(cc.ceo, ceoOf(co)) === false ? 'diff' : null,
        addr: str(cc.address) && str(co.address) && addrSame(cc.address, co.address) === false ? 'diff' : null,
        tel: str(cc.phone) && str(co.phone) && !sameTel(cc.phone, co.phone) ? 'diff' : null,
        contact: contact && known.length && known.indexOf(contact.replace(/\s+/g, '')) < 0 ? 'diff' : null
      };
      var diffs = Object.keys(f).filter(function (x) { return f[x]; });
      if (!diffs.length) return;
      count.contract++;
      ctRows.push({ ct: ct, co: co, f: f, diffs: diffs });
    });

    return { rows: rows, noKey: noKey, ctRows: ctRows, count: count };
  }

  /* ── 빈칸 채우기 (대표 지시 2026-10-03 「빈칸채우기 해라」) ─────────────────
     업체 쪽이 «비었고» 등록증엔 있는 칸만 등록증 값으로 채운다. 상호는 안 채운다(비는 일이 없다).
     ⚠ 저장 «직전»의 업체 목록(fresh)으로 다시 본다 — 창을 연 뒤 누가 그 칸을 적었으면 건너뛴다.
       한 번 띄운 화면의 옛 값을 믿고 덮으면, 그사이 사람이 적은 값이 사라진다.
     ⚠ 되돌리기도 «내가 넣은 값 그대로»인 칸만 비운다 — 그 뒤 사람이 고친 칸은 안 건드린다. */
  var FILL = [['ceo', 'ceo', 'ceo'], ['addr', 'address', 'ad'], ['tel', 'phone', 'ct']];   // [판정칸, 업체칸, 등록증칸]
  /* ★ 무엇을 넣었는지 «업체 기록 안»(coFill)에 남긴다 (2026-10-07 대표 결정 「빈칸만 채우기」 — 기업정보함 점검 4절).
       예전에는 화면 상태에만 있어 창을 닫으면 되돌릴 길이 사라졌다. 명함 「🏢 푸른이알피로」의 cardSync 와 같은 결:
       따로 기록 자리를 만들지 않고 그 업체와 함께 다닌다 — 다른 PC·다음 날에도 되돌린다.
     opts: { at, by } — 안 주면 예전처럼 기록 없이(검사·옛 부르는 곳). */
  function fillRecs(rows, fresh, opts) {
    var o = opts || {};
    var byId = {};
    (fresh || []).forEach(function (co) { if (co && co.id) byId[co.id] = co; });
    var recs = [], undo = [], cells = 0;
    (rows || []).forEach(function (x) {
      var cur = x && x.co && byId[x.co.id];
      if (!cur || cur._deleted) return;
      var patch = {}, put = {};
      FILL.forEach(function (m) {
        if (x.f[m[0]] !== 'empty') return;
        var v = str(x.cert[m[2]]);
        if (!v || str(cur[m[1]])) return;
        patch[m[1]] = v; put[m[1]] = v;
      });
      var n = Object.keys(patch).length;
      if (!n) return;
      cells += n;
      if (o.at) patch.coFill = { at: o.at, by: str(o.by), put: put };
      recs.push(Object.assign({}, cur, patch));
      undo.push({ id: cur.id, put: put });
    });
    return { recs: recs, undo: undo, cells: cells };
  }
  /* 되돌리기 — «넣은 값 그대로»인 칸만 비운다. opts.at 을 주면 그 업체의 coFill 에 «되돌렸음»을 찍는다
     (지우지 않는다 — 언제 무엇을 넣고 되돌렸는지 남는다). */
  function undoRecs(undo, fresh, opts) {
    var o = opts || {};
    var byId = {};
    (fresh || []).forEach(function (co) { if (co && co.id) byId[co.id] = co; });
    var recs = [], cells = 0;
    (undo || []).forEach(function (u) {
      var cur = byId[u.id];
      if (!cur) return;
      var back = {};
      Object.keys(u.put || {}).forEach(function (k) { if (str(cur[k]) === u.put[k]) back[k] = ''; });
      var n = Object.keys(back).length;
      var mark = o.at && cur.coFill && !cur.coFill.undoneAt;
      if (!n && !mark) return;
      cells += n;
      if (mark) back.coFill = Object.assign({}, cur.coFill, { undoneAt: o.at, undoneBy: str(o.by) });
      recs.push(Object.assign({}, cur, back));
    });
    return { recs: recs, cells: cells };
  }
  /* 아직 안 되돌린 «마지막 채우기» — 업체 기록의 coFill 에서 다시 모은다. 없으면 null.
     ⚠ 화면 상태가 아니라 업체 기록에서 센다 — 창을 닫았다 열어도, 다른 PC 에서도 같은 답이다. */
  function pendingFill(fresh) {
    var last = 0;
    (fresh || []).forEach(function (co) {
      var f = co && !co._deleted && co.coFill;
      if (f && !f.undoneAt && Number(f.at) > last) last = Number(f.at);
    });
    if (!last) return null;
    var undo = [], cells = 0;
    (fresh || []).forEach(function (co) {
      var f = co && !co._deleted && co.coFill;
      if (!f || f.undoneAt || Number(f.at) !== last) return;
      undo.push({ id: co.id, put: f.put || {} });
      cells += Object.keys(f.put || {}).length;
    });
    return { at: last, undo: undo, cells: cells, n: undo.length };
  }

  var API = { build: build, people: people, samePeople: samePeople, fillRecs: fillRecs, undoRecs: undoRecs, pendingFill: pendingFill };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuCoMismatch = API;
})(typeof window !== 'undefined' ? window : this);
