/* 🧾 사업자번호·담당자 «근거로 빈 곳 채우기» — 판정 «한 벌» (대표 지시 2026-11-28)
   ═══════════════════════════════════════════════════════════════════════════
   「ERP 안에 사업자 등록번호가 제대로 안 들어가거나 담당자가 없는 경우도 종종 있다. 최근 계산서나 이런 데를
    찾아서 다 자동으로 들어갈 수 있게 해라 … 항상 동일성이 유지된다라고 판단되면 자동으로 끌고 와서 연결하는 기능」

   ■ 이 파일이 하는 일 — «판정만» 한다. 저장·화면은 하지 않는다(pu-erp.html 의 BizFillModal 이 부른다).
     입력은 배열 몇 개(업체·업무 표·세금계산서 발행분·CMS 장부·기업정보함 등록증)고, 출력은 «줄마다 한 가지 판정»이다.
     브라우저(window.PuBizEvidence)와 Node 겸용 — 검사가 이 파일을 그대로 돌린다(tests/biz-evidence.test.js).

   ■ 자동으로 채워도 되는 것 — 아래 «전부»를 통과한 것만 level:'auto'
     ① 사업자번호 칸이 «비어 있거나» 열 자리 숫자가 «표기만» 다른 것(하이픈 없음) — 표기만 다르면 같은 번호라 자동.
     ② 채울 번호가 검증숫자(국세청 규칙)를 통과한다.
     ③ 같은 «이름(법인 표기·공백·기호만 걷은 꼭 같은 이름)»에 근거 자료가 «서로 다른 두 곳 이상»(kind)에서 같은 번호를 말한다.
        그 가운데 «바깥 자료»(홈택스 세금계산서·등록증·메일 계산서 같은 공문서, 또는 재무 발행분·CMS 장부)가 하나는 있어야 한다.
        업체관리와 다른 업무 건만 짝을 이룬 것은 둘 다 안쪽에서 베낀 기록이라 «독립된 두 곳»이 아니다 → 사람이 고른다.
     ④ 같은 이름에 «다른 번호»가 하나라도 나오면 충돌 — 채우지 않는다.
     ⑤ 대표자 이름이 양쪽에 있는데 겹치지 않으면 충돌 — 채우지 않는다.
     ⑥ 끝난 건(종결·취소·이관·보관·삭제)은 건드리지 않는다.
     ⑦ 이미 값이 있으면 «덮어쓰지 않는다» — 다르면 확인 필요로만 알린다.
     ⑧ «자동으로 채운 값»(bizAuto 표시)은 다시 근거로 쓰지 않는다 — 짐작이 짐작을 낳지 않게.
     업체 번호(companyId)로 이어진 업체의 번호는 «이름 짐작이 아닌 번호표 연결»이라 근거 하나로 충분하다(via:'link').
   ■ 자동으로 하지 않는 것 — level:'ask'(사람이 눈으로 보고 고름)
     · 근거가 한 곳뿐이거나 공문서·원장이 없는 후보 · 주담당·부담당 · 거래처 담당자.
     · 이름이 «닮기만» 한 것(부분 일치·별칭 추정)은 후보로도 안 올린다 — 꼭 같은 이름만.
   ■ 못 믿는 것 — level:'check'/'conflict' 는 값을 «제안만» 하고 어디에도 쓰지 않는다.

   ⚠ 저장소는 공개다 — 이 파일·검사·문서에 실제 업체 이름·사업자번호를 쓰지 않는다(가나상사·123- 으로 시작하는 가짜만).
   ⚠ 이름 다듬개(nameKey)는 pu-erp.html 의 erpNormName 과 «글자까지 같다» — tests/biz-evidence.test.js 가 견준다. */
(function (root) {
  'use strict';

  function str(v) { return String(v == null ? '' : v).trim(); }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  function okKey(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }

  /* 사업자등록번호 검산 — 국세청 규칙(js/pu-cokey.js 와 같은 셈). 아홉째 자리 ×5 의 십의 자리 보정을 지우지 말 것. */
  function checksumOk(d) {
    d = digits(d);
    if (d.length !== 10) return false;
    if (/^([0-9])\1{9}$/.test(d)) return false;        // 0000000000 같은 자리표시자는 검증숫자를 «통과»하지만 번호가 아니다
    var w = [1, 3, 7, 1, 3, 7, 1, 3, 5], s = 0, i;
    for (i = 0; i < 9; i++) s += (+d[i]) * w[i];
    s += Math.floor((+d[8]) * 5 / 10);
    return ((10 - (s % 10)) % 10) === (+d[9]);
  }
  function fmtDigits(d) { d = digits(d); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : d; }

  /* 칸 상태 — 'empty' 빈 칸 · 'ok' 000-00-00000 꼴 그대로 · 'format' 열 자리인데 표기만 다름 ·
     'text' 숫자 사이에 글자(메모)가 섞임 · 'badsum' 열 자리인데 검증숫자 틀림 · 'short' 모자람 · 'long' 열한 자리 이상(공단 관리번호로 보임) · 'nodigit' 숫자 없음 */
  function bizStatus(raw) {
    var t = str(raw);
    if (!t) return { kind: 'empty', digits: '', fmt: '' };
    var d = digits(t);
    if (!d) return { kind: 'nodigit', digits: '', fmt: '' };
    if (d.length > 10) return { kind: 'long', digits: d, fmt: '', headOk: checksumOk(d.slice(0, 10)) };
    if (d.length < 10) return { kind: 'short', digits: d, fmt: '' };
    if (!checksumOk(d)) return { kind: 'badsum', digits: d, fmt: fmtDigits(d) };
    var f = fmtDigits(d);
    if (t === f) return { kind: 'ok', digits: d, fmt: f };
    return { kind: /^[0-9\s.\-]+$/.test(t) ? 'format' : 'text', digits: d, fmt: f };
  }

  /* 업체 이름 열쇠 — 법인 표기(이름 «앞·뒤»에서만)·공백·기호를 걷는다. 괄호 «안의 글»은 남긴다 → 「가나상사(서울점)」≠「가나상사」(다른 지점일 수 있다).
     ⚠ erpNormName(pu-erp.html)은 법인 표기를 이름 «어디서든» 걷는다. 이쪽은 가운데에 낀 낱말로 서로 다른 상호가 같아지지 않게 더 엄격하다 —
       앞·뒤에 붙은 표기는 두 함수가 같은 답을 낸다(tests/biz-evidence.test.js 가 견준다). */
  var CORP_HEAD = /^(?:주식회사|㈜|\(주\)|유한회사|합자회사|재단법인|사단법인|\(재\)|\(사\))/;
  var CORP_TAIL = /(?:주식회사|㈜|\(주\)|유한회사|합자회사|재단법인|사단법인|\(재\)|\(사\))$/;
  var EDGE_JUNK = /^[\s\-_.,·'"\[\]{}]+|[\s\-_.,·'"\[\]{}]+$/g;
  function nameKey(s) {
    var t = String(s === null || s === undefined ? '' : s).toLowerCase(), prev;
    do { prev = t; t = t.replace(EDGE_JUNK, '').replace(CORP_HEAD, '').replace(CORP_TAIL, ''); } while (t !== prev);
    return t.replace(/[\s\-_.,·()\[\]{}'"]/g, '');
  }

  /* 근거의 갈래 — kind 는 «어디서 왔나», class 는 «얼마나 믿나» */
  var KIND_CLASS = {
    hometax: 'official',   // 홈택스에서 올린 매출 세금계산서(국세청 발행분)
    regcert: 'official',   // 기업정보함 사업자등록증 판독
    mail: 'official',      // 메일로 받은 세금계산서 본문
    invoice: 'ledger',     // 재무관리에서 사람이 적은 세금계산서 발행분
    cms: 'ledger',         // 나이스빌·효성 CMS 회원 장부
    master: 'master',      // 업체관리 원장
    record: 'record'       // 다른 업무 건(컨설팅·기금·계약…)에 적힌 번호
  };
  var KIND_LABEL = { hometax: '홈택스 세금계산서', regcert: '사업자등록증', mail: '메일 세금계산서', invoice: '재무 발행분',
    cms: 'CMS 장부', master: '업체관리', record: '다른 업무 건' };

  function ceoKeys(v) {
    return str(v).replace(/\s*외\s*\d*\s*명?/g, '').split(/[,·/]|\s및\s/)
      .map(function (s) { return s.replace(/\s+/g, '').replace(/^대표(이사)?|대표(이사)?$/g, ''); })
      .filter(Boolean);
  }

  /* ── 근거 색인 ── rows: [{kind, name, bizNo, ref, date, ceo, auto}] */
  function buildIndex(rows) {
    var byName = Object.create(null), seen = Object.create(null), stat = { rows: 0, used: 0, skippedAuto: 0, badNumber: 0 };
    (rows || []).forEach(function (r) {
      if (!r) return;
      stat.rows++;
      if (r.auto) { stat.skippedAuto++; return; }                 // ⑧ 자동으로 채운 값은 근거가 아니다
      var k = nameKey(r.name);
      if (!okKey(k) || k.length < 2) return;
      var st = bizStatus(r.bizNo);
      if (st.kind !== 'ok' && st.kind !== 'format') { if (st.kind !== 'empty') stat.badNumber++; return; }
      var kind = Object.prototype.hasOwnProperty.call(KIND_CLASS, r.kind) ? r.kind : 'record';
      var dup = kind + '|' + str(r.ref) + '|' + k + '|' + st.digits;     // 같은 줄을 두 번 세지 않는다
      if (str(r.ref) && seen[dup]) return;
      seen[dup] = 1;
      stat.used++;
      var e = byName[k] || (byName[k] = { name: str(r.name), nums: Object.create(null) });
      var n = e.nums[st.digits] || (e.nums[st.digits] = { rows: 0, kinds: Object.create(null), refs: [], last: '', ceos: Object.create(null), ceoRows: [], ceoSigs: Object.create(null), ceoOverflow: false });
      n.rows++;
      n.kinds[kind] = (n.kinds[kind] || 0) + 1;
      if (n.refs.length < 5 && str(r.ref)) n.refs.push(kind + ':' + str(r.ref));
      var d = str(r.date).slice(0, 10);
      if (d && d > n.last) n.last = d;
      var ck = ceoKeys(r.ceo);
      ck.forEach(function (c) { n.ceos[c] = 1; });
      if (ck.length) {
        var sig = ck.slice().sort().join('|');                       // 같은 대표자 조합은 한 번만 간직한다
        if (!n.ceoSigs[sig]) {
          if (n.ceoRows.length < 200) { n.ceoSigs[sig] = 1; n.ceoRows.push(ck); }
          else n.ceoOverflow = true;                                  // 넘치면 «다 견주지 못했다» — 아래에서 충돌로 친다
        }
      }
    });
    return { byName: byName, stat: stat };
  }

  function isTerminal(rec) {
    if (!rec || typeof rec !== 'object') return false;
    var st = String(rec.status || '').toLowerCase();
    if (st === 'closed' || st === 'cancelled' || st === 'transferred' || st === 'done' || st === 'end') return true;
    return !!(rec.closedAt || rec.closedDate || rec.closeDate || rec.permanentArchived || rec.transferredTo);
  }

  /* 이 건의 대표자(rc)가 근거 «줄마다» 적힌 대표자와 겹치는가 — 하나라도 안 겹치면 충돌. 줄이 너무 많아 다 못 견줬으면 충돌로 친다(모르면 안 채운다). */
  function ceoClash(rc, n) {
    if (!rc.length || !n) return false;
    if (n.ceoOverflow) return true;
    return (n.ceoRows || []).some(function (set) { return !rc.some(function (c) { return set.indexOf(c) >= 0; }); });
  }
  function evidenceOf(n) {
    var kinds = Object.keys(n.kinds);
    return { kinds: kinds, rows: n.rows, last: n.last, refs: n.refs.slice(),
      labels: kinds.map(function (k) { return KIND_LABEL[k] || k; }) };
  }
  function classesOf(kinds) {
    var c = {};
    kinds.forEach(function (k) { c[KIND_CLASS[k] || 'record'] = 1; });
    return c;
  }
  /* 이 번호가 «자동으로 채울 만큼» 단단한가 — 서로 다른 두 갈래 이상 + 그 가운데 «바깥 자료»(공문서·재무 장부) 하나.
     업체관리와 다른 업무 건만 짝을 이룬 것은 안 된다 — 둘 다 사람이 적은(베낀) 안쪽 기록이라 «독립된 두 곳»이 아니다. */
  function isSolid(n) {
    var kinds = Object.keys(n.kinds);
    if (kinds.length < 2) return false;
    var c = classesOf(kinds);
    return !!(c.official || c.ledger);
  }
  function hasOutside(n) { var c = classesOf(Object.keys(n.kinds)); return !!(c.official || c.ledger); }

  /* ── 번호 판정 ──
     rec: { name, bizNo, ceo, companyId, ref, deleted, terminal }
     ctx: { idx(buildIndex 결과), companyById: {id: {bizNo, ceo, deleted}} }
     돌려주는 것: { action, level, to, from, via, reason, evidence, cands } */
  function decideBiz(rec, ctx) {
    rec = rec || {}; ctx = ctx || {};
    var st = bizStatus(rec.bizNo);
    /* 열한 자리 이상인데 «앞 열 자리»가 검증을 통과하면 사업자번호 뒤에 종사업장 번호가 붙은 꼴이다(pu-cokey.js 가 앞 열 자리로 자르는 그 꼴).
       잘못된 값이 아니고 «고칠 것도 없다» — 표기를 바꾸지 않는다(ok). 앞 열 자리가 검증을 못 넘는 것만 공단 관리번호로 의심한다. */
    var suffixOnly = false;
    if (st.kind === 'long' && st.headOk) {
      st = { kind: 'ok', digits: st.digits.slice(0, 10), fmt: fmtDigits(st.digits.slice(0, 10)) };
      suffixOnly = true;
    }
    var base = { from: str(rec.bizNo), to: '', via: '', reason: '', evidence: null, cands: [] };
    function out(action, level, extra) { return Object.assign({}, base, { action: action, level: level }, extra || {}); }

    if (rec.deleted) return out('skip', 'skip', { reason: 'deleted' });
    if (rec.terminal) return out('skip', 'skip', { reason: 'terminal' });       // ⑥

    /* 업체 번호(companyId)로 이어진 업체의 번호 — 이름 짐작이 아니다 */
    var co = (rec.companyId && ctx.companyById && okKey(String(rec.companyId)) && Object.prototype.hasOwnProperty.call(ctx.companyById, rec.companyId)) ? ctx.companyById[rec.companyId] : null;
    var cs = (co && !co.deleted) ? bizStatus(co.bizNo) : null;
    var coOk = !!(cs && (cs.kind === 'ok' || cs.kind === 'format'));
    /* 이 건을 만든 «원본 계약»(sourceContractId·sourceContractNo 로 이어진)의 번호 — 이름 짐작이 아니라 이관 때의 번호표다 */
    var srcOk = !!(rec.srcBiz && rec.srcBiz.digits && checksumOk(rec.srcBiz.digits));

    var key = nameKey(rec.name);
    var entry = (ctx.idx && ctx.idx.byName && okKey(key) && key.length >= 2 && Object.prototype.hasOwnProperty.call(ctx.idx.byName, key)) ? ctx.idx.byName[key] : null;
    var nums = entry ? Object.keys(entry.nums) : [];

    /* 이미 번호가 있다 — 덮어쓰지 않는다. 업체관리나 «바깥 자료»가 다른 번호를 말하면 확인 필요로만 알린다. */
    if (st.kind === 'ok' || st.kind === 'format') {
      if (coOk && cs.digits !== st.digits) return out('check', 'check', { reason: 'differs-from-company', to: cs.fmt, via: 'link' });
      var others = nums.filter(function (d) { return d !== st.digits && hasOutside(entry.nums[d]); });
      if (others.length) return out('check', 'check', { reason: 'evidence-differs', cands: others.map(fmtDigits), evidence: evidenceOf(entry.nums[others[0]]) });
      if (st.kind === 'ok') return out('ok', 'ok', { to: st.fmt, reason: suffixOnly ? 'has-suffix' : '' });
      return out('format', 'auto', { to: st.fmt, via: 'format', reason: 'format-only' });     // ① 같은 번호의 표기만
    }

    if (st.kind === 'empty') {
      /* 번호표가 둘(업체·원본 계약)인데 서로 다른 번호를 말하면 어느 쪽도 믿지 않는다 */
      if (coOk && srcOk && cs.digits !== rec.srcBiz.digits) return out('conflict', 'conflict', { reason: 'link-sources-differ', cands: [cs.fmt, fmtDigits(rec.srcBiz.digits)] });
      var lk = coOk ? { d: cs.digits, fmt: cs.fmt, ceo: co.ceo, auto: !!co.auto, via: 'link', reason: 'company-id', autoReason: 'company-auto', label: '업체 번호로 이어진 업체관리' }
        : (srcOk ? { d: rec.srcBiz.digits, fmt: fmtDigits(rec.srcBiz.digits), ceo: rec.srcBiz.ceo, auto: !!rec.srcBiz.auto, via: 'source-contract', reason: 'source-contract', autoReason: 'source-auto', label: '이관 원본 계약' } : null);
      if (lk) {
        var linkEv = { kinds: [lk.via === 'link' ? 'link' : 'source'], labels: [lk.label], rows: 1, last: '', refs: [] };
        /* 근거 색인은 «이 건의 이름»과 «연결된 원본 계약의 이름» 둘 다로 찾는다 — 이름이 다르게 적혔어도 한쪽 이름의 근거가 충돌을 알려 준다 */
        var entries = entry ? [entry] : [];
        var sk = srcOk ? nameKey(rec.srcBiz.name) : '';
        if (sk.length >= 2 && ctx.idx && ctx.idx.byName && okKey(sk) && Object.prototype.hasOwnProperty.call(ctx.idx.byName, sk) && ctx.idx.byName[sk] !== entry) entries.push(ctx.idx.byName[sk]);
        /* 번호표로 이어졌어도 «바깥 자료»가 다른 번호를 말하면 충돌 — 번호표가 틀렸을 수 있다 */
        var linkConf = [];
        entries.forEach(function (en) { Object.keys(en.nums).forEach(function (d) { if (d !== lk.d && hasOutside(en.nums[d]) && linkConf.indexOf(d) < 0) linkConf.push(d); }); });
        if (linkConf.length) return out('conflict', 'conflict', { reason: 'link-vs-evidence', cands: linkConf.map(fmtDigits).concat([lk.fmt]) });
        var rc0 = ceoKeys(rec.ceo), cc0 = ceoKeys(lk.ceo);
        if (rc0.length && cc0.length && !rc0.some(function (c) { return cc0.indexOf(c) >= 0; })) return out('conflict', 'conflict', { reason: 'ceo-differs', cands: [lk.fmt] });
        /* 이 번호를 말하는 «바깥 자료의 대표자»와도 견준다 — 연결된 한 곳의 대표자만 보지 않는다 */
        if (entries.some(function (en) { return en.nums[lk.d] && ceoClash(rc0, en.nums[lk.d]); })) return out('conflict', 'conflict', { reason: 'ceo-differs', cands: [lk.fmt] });
        /* 이 건의 이름이 없으면(2글자 미만) 이름 근거를 견줄 수 없다 — 눈으로 확인할 «제안»으로만 */
        if (key.length < 2) return out('suggest', 'ask', { to: lk.fmt, via: lk.via, reason: 'link-no-name', evidence: linkEv });
        /* 연결된 쪽의 번호가 «자동으로 채운 값»이면 그것을 다시 퍼뜨리지 않는다 — 사람이 보고 고른다 */
        if (lk.auto) return out('suggest', 'ask', { to: lk.fmt, via: lk.via, reason: lk.autoReason, evidence: linkEv });
        return out('fill', 'auto', { to: lk.fmt, via: lk.via, reason: lk.reason, evidence: linkEv });
      }
      if (!entry) return out('none', 'none', { reason: 'no-evidence' });
      if (nums.length > 1) return out('conflict', 'conflict', { reason: 'same-name-other-number', cands: nums.map(fmtDigits) });          // ④
      var d0 = nums[0], n0 = entry.nums[d0];
      var rc = ceoKeys(rec.ceo);
      /* 대표자는 «근거 줄마다» 견준다 — 대표자를 적은 줄이 하나라도 이 건의 대표자와 안 겹치면 충돌(서로 다른 대표자 근거가 섞여도 한 이름만 맞으면 통과하던 것을 막는다) */
      if (ceoClash(rc, n0)) {  // ⑤
        return out('conflict', 'conflict', { reason: 'ceo-differs', cands: [fmtDigits(d0)] });
      }
      var ev = evidenceOf(n0);
      if (isSolid(n0)) return out('fill', 'auto', { to: fmtDigits(d0), via: 'evidence', reason: 'two-kinds', evidence: ev });             // ③
      return out('suggest', 'ask', { to: fmtDigits(d0), via: 'evidence', reason: 'thin-evidence', evidence: ev });
    }

    /* 값이 있는데 믿을 수 없는 것(검증숫자 틀림·모자람·글자 섞임·열한 자리 이상) — 덮어쓰지 않는다. 후보만 보여 준다. */
    var extra = { reason: st.kind };
    if (entry && nums.length === 1) {
      extra.to = fmtDigits(nums[0]); extra.via = 'evidence'; extra.evidence = evidenceOf(entry.nums[nums[0]]);
      extra.solid = isSolid(entry.nums[nums[0]]);
    } else if (entry && nums.length > 1) {
      extra.cands = nums.map(fmtDigits);
    }
    return out('check', 'check', extra);                                                                                                 // ⑦
  }

  /* 두 이름이 이어서 겹치는 가장 긴 글자 수 */
  function lcsLen(a, b) {
    var best = 0, prev = new Array(b.length + 1), cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = 0;
    for (i = 1; i <= a.length; i++) {
      cur = [0];
      for (j = 1; j <= b.length; j++) {
        cur[j] = a.charAt(i - 1) === b.charAt(j - 1) ? prev[j - 1] + 1 : 0;
        if (cur[j] > best) best = cur[j];
      }
      prev = cur;
    }
    return best;
  }
  var SIG_NAME_MIN = 5, SIG_NAME_RATIO = 0.6, SIG_DAYS = 90, SIG_CAP = 20000;

  /* 복합 신호용 홈택스 줄 손질 — 한 번만(건마다 다시 하지 않는다). 번호가 믿을 만하고 이름·금액·날짜가 있는 줄만, «최근 날짜순»으로 상한만큼. */
  function prepSignalRows(hometax) {
    var list = [];
    (hometax || []).forEach(function (h) {
      if (!h || h._deleted) return;
      var st = bizStatus(h.biznum);
      if (st.kind !== 'ok' && st.kind !== 'format') return;
      var hn = nameKey(h.company), sup = Number(h.supply) || 0, dt = Date.parse(h.date);
      if (!hn || hn.length < 4 || !sup || isNaN(dt)) return;
      list.push({ d: st.digits, hn: hn, sup: sup, dt: dt, date: str(h.date).slice(0, 10) });
    });
    list.sort(function (a, b) { return b.dt - a.dt; });
    if (list.length > SIG_CAP) list.length = SIG_CAP;              // 넘치면 «오래된 줄»부터 빠진다(최근 계산서를 남긴다)
    list.__prep = true;
    return list;
  }

  /* ── 복합 신호 판정 — «꼭 같은 이름»의 근거가 없는 건에서, 세금계산서 한 줄이 «이름 일부 + 금액 + 날짜»를 모두 만족하고 번호가 «하나»일 때만 후보로 낸다.
     ⚠ 자동으로 쓰지 않는다(level:'ask') — 이름이 닮기만 한 것은 같은 업체가 아닐 수 있고(예: 같은 낱말이 든 지점들), 금액은 업무 ID 가 아니다.
       세 신호가 한꺼번에 맞고 후보가 하나일 때만 «눈으로 확인할 만한 제안»으로 올린다. 셋 중 하나라도 어긋나거나 후보가 둘 이상이면 아무것도 내지 않는다.
     rec: { name, fees:[금액…], date:'YYYY-MM-DD' } · hometax: [{ company, biznum, supply, date }] */
  function signalBiz(rec, hometax) {
    var n = nameKey(rec && rec.name);
    if (!n || n.length < 4 || !rec.fees || !rec.fees.length || !rec.date) return null;
    var t0 = Date.parse(rec.date);
    if (isNaN(t0)) return null;
    var by = Object.create(null);
    var rows = (hometax && hometax.__prep) ? hometax : prepSignalRows(hometax);
    rows.forEach(function (h) {
      /* 싼 검사부터 — 금액·날짜로 먼저 거르고, 맞는 줄에서만 이름을 견준다 */
      var amtOk = rec.fees.some(function (f) { return f > 0 && (h.sup === f || Math.round(h.sup * 1.1) === f || Math.round(f / 1.1) === h.sup); });
      if (!amtOk) return;
      var days = Math.round(Math.abs(h.dt - t0) / 86400000);
      if (days > SIG_DAYS) return;
      var L = lcsLen(n, h.hn);
      if (L < SIG_NAME_MIN || L < Math.ceil(Math.min(n.length, h.hn.length) * SIG_NAME_RATIO)) return;
      var e = by[h.d] || (by[h.d] = { rows: 0, L: 0, dmin: 1e9, last: '' });
      e.rows++; e.L = Math.max(e.L, L); e.dmin = Math.min(e.dmin, days);
      if (h.date > e.last) e.last = h.date;
    });
    var nums = Object.keys(by);
    if (nums.length !== 1) return null;                      // 후보가 둘 이상이면 고르지 않는다
    var e0 = by[nums[0]];
    return { to: fmtDigits(nums[0]), evidence: { kinds: ['hometax'], labels: ['홈택스 세금계산서'], rows: e0.rows, last: e0.last, refs: [],
      signals: ['이름 일부 ' + e0.L + '글자', '금액 일치', '날짜 ' + e0.dmin + '일 차'] } };
  }

  /* ── 주담당 판정 — «제안만» (성과 분배·권한이 담당자에 걸려 있어 자동으로 배정하지 않는다) ──
     rec: { managerMain, terminal, deleted }
     peers: [{ main, terminal, deleted, kind:'master'|'record' }] — 같은 업체(번호표·검증된 사업자번호로만 이은 것)의 다른 건
     isActiveSid(sid): 재직 중이고 담당을 맡을 수 있는가 */
  function decideManager(rec, peers, isActiveSid) {
    rec = rec || {};
    var base = { action: 'none', level: 'none', sid: '', evidence: { master: false, peers: 0 } };
    if (rec.deleted || rec.terminal) return Object.assign(base, { action: 'skip', level: 'skip' });
    if (str(rec.managerMain)) return Object.assign(base, { action: 'ok', level: 'ok' });
    var sids = {}, master = false, n = 0;
    (peers || []).forEach(function (p) {
      if (!p || p.deleted || p.terminal) return;          // 끝난 건의 옛 담당은 근거가 아니다
      var s = str(p.main); if (!s) return;
      sids[s] = 1; n++;
      if (p.kind === 'master') master = true;
    });
    var list = Object.keys(sids);
    base.evidence = { master: master, peers: n };
    if (!list.length) return Object.assign(base, { reason: 'no-peer' });
    if (list.length > 1) return Object.assign(base, { action: 'conflict', level: 'conflict', reason: 'peers-differ', count: list.length });
    if (typeof isActiveSid === 'function' && !isActiveSid(list[0])) return Object.assign(base, { action: 'none', level: 'none', reason: 'not-assignable' });
    if (!master && n < 2) return Object.assign(base, { reason: 'thin-evidence' });
    return Object.assign(base, { action: 'suggest', level: 'ask', sid: list[0], reason: master ? 'company-main' : 'peers-agree' });
  }

  /* ── 거래처 담당자 판정 — «제안만» ──
     rec: { hasContact, terminal, deleted }
     peers: [{ contact:{name, phone, email, role}|null, terminal, deleted, kind }] */
  function decideContact(rec, peers) {
    rec = rec || {};
    var base = { action: 'none', level: 'none', contact: null, evidence: { master: false, peers: 0 } };
    if (rec.deleted || rec.terminal) return Object.assign(base, { action: 'skip', level: 'skip' });
    if (rec.hasContact) return Object.assign(base, { action: 'ok', level: 'ok' });
    var by = {}, master = false, n = 0;
    (peers || []).forEach(function (p) {
      if (!p || p.deleted || p.terminal || !p.contact || !str(p.contact.name)) return;
      var k = nameKey(p.contact.name);
      if (!okKey(k) || !k) return;
      if (!by[k]) by[k] = { contact: p.contact, n: 0 };
      by[k].n++; n++;
      if (p.kind === 'master') master = true;
    });
    var keys = Object.keys(by);
    base.evidence = { master: master, peers: n };
    if (!keys.length) return Object.assign(base, { reason: 'no-peer' });
    if (keys.length > 1) return Object.assign(base, { action: 'conflict', level: 'conflict', reason: 'peers-differ', count: keys.length });
    if (!master && n < 2) return Object.assign(base, { reason: 'thin-evidence' });
    var c = by[keys[0]].contact;
    return Object.assign(base, { action: 'suggest', level: 'ask', reason: master ? 'company-contact' : 'peers-agree',
      contact: { name: str(c.name), role: str(c.role), phone: str(c.phone), email: str(c.email) } });
  }

  /* ── 한 번에 계획 ──
     input: {
       companies: [업체…], stores: { consultings, funds, other_projects, cases, contracts },
       evidence: { hometax:[{company,biznum,date,_id}], invoices:[{companyName,bizNo,issueDate,id,ceoName,status}],
                   cms:[{name,bizNo,wdate,_k}], regcerts:[{name,bz,id,ceo}], mails:[{name,bizNo,date,id}] },
       isActiveSid
     }
     출력: { rows:[…], counts:{…}, stat } — rows 의 한 줄은 «저장소·id·칸·판정» */
  var STORE_LABEL = { companies: '업체', consultings: '컨설팅', funds: '기금', other_projects: '기타', cases: '사건', contracts: '계약' };
  var NO_OF = { companies: function (r) { return r.no || r.coNo || ''; }, consultings: function (r) { return r.no || r.consultNo || ''; },
    funds: function (r) { return r.no || r.fundNo || ''; }, other_projects: function (r) { return r.no || r.projectNo || ''; },
    cases: function (r) { return r.caseNo || r.no || ''; }, contracts: function (r) { return r.contractNo || r.no || ''; } };
  /* 쓰기를 «이 도구가 직접 하지 않는» 표 — 계약은 입력 관문(validateCompanyLink)이 따로 있어 제안만 보여 준다 */
  var READONLY_STORES = { contracts: 1 };

  function bizOfRec(store, r) {
    if (store === 'contracts') return (r.company && r.company.bizNo) || r.bizNo || '';
    return r.bizNo || r.bizno || '';
  }
  function nameOfRec(store, r) { return store === 'companies' ? (r.name || r.companyName || '') : (r.companyName || (r.company && r.company.name) || ''); }
  function contactOf(r) {
    var list = Array.isArray(r.contacts) ? r.contacts.filter(function (c) { return c && str(c.name); }) : [];
    var p = list.filter(function (c) { return c.isPrimary && !c.left; })[0] || list.filter(function (c) { return !c.left; })[0] || null;
    if (p) return p;
    if (str(r.primaryContactName)) return { name: r.primaryContactName, phone: r.primaryContactPhone, email: r.primaryContactEmail };
    return null;
  }

  function buildPlan(input, opts) {
    input = input || {}; opts = opts || {};
    var companies = (input.companies || []).filter(Boolean);
    var stores = input.stores || {};
    var ev = input.evidence || {};
    var rows = [];

    /* 근거 줄 모으기 */
    (ev.hometax || []).forEach(function (r) { if (r && !r._deleted) rows.push({ kind: 'hometax', name: r.company, bizNo: r.biznum, ref: r._id, date: r.date }); });
    (ev.invoices || []).forEach(function (r) {
      if (!r || r._deleted) return;
      if (r.status !== '발행') return;                      // 「발행」이 분명한 것만 — 취소·미발행·상태 없는 줄은 근거가 아니다
      rows.push({ kind: 'invoice', name: r.companyName, bizNo: r.bizNo, ref: r.id, date: r.issueDate, ceo: r.ceoName });
    });
    (ev.cms || []).forEach(function (r) { if (r && !r._deleted) rows.push({ kind: 'cms', name: r.name, bizNo: r.bizNo, ref: r._k, date: r.wdate }); });
    (ev.regcerts || []).forEach(function (r) { if (r && !r._deleted) rows.push({ kind: 'regcert', name: r.name, bizNo: r.bz, ref: r.id, ceo: r.ceo }); });
    (ev.mails || []).forEach(function (r) { if (r && !r._deleted) rows.push({ kind: 'mail', name: r.name, bizNo: r.bizNo, ref: r.id, date: r.date }); });
    var companyById = Object.create(null);
    companies.forEach(function (c) {
      if (!c || !c.id || !okKey(String(c.id))) return;
      companyById[c.id] = { bizNo: c.bizNo, deleted: !!c._deleted || !!c.mergedInto, ceo: [c.ceo, c.ceo2].filter(Boolean).join(','),
        auto: !!(c.bizAuto && c.bizAuto.via !== 'format') };
      if (c._deleted || c.mergedInto) return;
      rows.push({ kind: 'master', name: c.name || c.companyName, bizNo: c.bizNo, ref: c.id, ceo: [c.ceo, c.ceo2].filter(Boolean).join(','), auto: !!(c.bizAuto && c.bizAuto.via !== 'format') });
    });
    Object.keys(stores).forEach(function (s) {
      (stores[s] || []).forEach(function (r) {
        if (!r || r._deleted) return;
        rows.push({ kind: 'record', name: nameOfRec(s, r), bizNo: bizOfRec(s, r), ref: s + ':' + r.id, ceo: r.ceo, auto: !!(r.bizAuto && r.bizAuto.via !== 'format') });
      });
    });
    var idx = buildIndex(rows);

    /* 같은 업체의 다른 건 — 번호표(companyId) 또는 «검증을 통과한» 사업자번호로만 잇는다(이름으로 잇지 않는다) */
    var byLinkId = Object.create(null), byNum = Object.create(null);
    function addPeer(link, num, peer) {
      if (okKey(String(link || ''))) (byLinkId[link] = byLinkId[link] || []).push(peer);
      if (num) (byNum[num] = byNum[num] || []).push(peer);
    }
    function numOf(raw) { var s = bizStatus(raw); return (s.kind === 'ok' || s.kind === 'format') ? s.digits : ''; }
    function autoNum(rec) { return !!(rec && rec.bizAuto && rec.bizAuto.via !== 'format'); }     // 자동으로 채운 번호 — 이어 붙이는 열쇠로 쓰지 않는다
    companies.forEach(function (c) {
      if (!c || !c.id || c._deleted || c.mergedInto) return;
      addPeer(c.id, autoNum(c) ? '' : numOf(c.bizNo), { ref: 'companies:' + c.id, kind: 'master', main: c.managerMain, contact: contactOf(c), terminal: isTerminal(c) });
    });
    Object.keys(stores).forEach(function (s) {
      (stores[s] || []).forEach(function (r) {
        if (!r || !r.id || r._deleted) return;
        addPeer(r.companyId, autoNum(r) ? '' : numOf(bizOfRec(s, r)), { ref: s + ':' + r.id, kind: 'record', main: r.managerMain, contact: contactOf(r), terminal: isTerminal(r) });
      });
    });
    function peersFor(selfRef, companyId, rawBiz, selfIsCompany, selfId) {
      var out = [], seen = Object.create(null);
      function take(list) { (list || []).forEach(function (p) { if (p.ref === selfRef || seen[p.ref]) return; seen[p.ref] = 1; out.push(p); }); }
      if (selfIsCompany) take(byLinkId[selfId]); else if (companyId) take(byLinkId[companyId]);
      var nm = numOf(rawBiz);
      if (nm) take(byNum[nm]);
      return out;
    }

    /* 이 건을 만든 원본 계약 — id·번호로 이어진 것만(이름으로 찾지 않는다) */
    var ctById = Object.create(null), ctByNo = Object.create(null);
    (stores.contracts || []).forEach(function (ct) {
      if (!ct || ct._deleted || !ct.id) return;
      if (okKey(String(ct.id))) ctById[ct.id] = ct;
      var no = str(ct.contractNo);
      if (no && okKey(no)) ctByNo[no] = ctByNo[no] ? 'DUP' : ct;          // 같은 번호의 계약이 둘이면 «모른다»(마지막이 이기지 않는다)
    });
    /* 자동으로 채운 번호 — 계약 표는 이 도구가 쓰지 않아 표시가 안 남는다. 계약이 그 번호를 «베껴 오면» 자동 값으로 친다(짐작이 짐작을 낳지 않게). */
    var autoNums = Object.create(null);
    companies.forEach(function (c) { if (c && c.bizAuto && c.bizAuto.via !== 'format') autoNums[bizStatus(c.bizNo).digits] = 1; });
    Object.keys(stores).forEach(function (s) { (stores[s] || []).forEach(function (r) { if (r && r.bizAuto && r.bizAuto.via !== 'format') autoNums[bizStatus(bizOfRec(s, r)).digits] = 1; }); });
    function srcBizOf(store, r) {
      if (store === 'contracts' || store === 'companies') return null;
      var id = str(r.sourceContractId) || (r.sourceKind === 'contract' ? str(r.sourceId) : '');
      var ct = (id && ctById[id]) || null;
      if (!ct) {
        /* 번호로 찾은 계약은 «같은 업체»일 때만 — 이름(법인 표기만 걷은 꼭 같은 이름)이나 업체 번호표가 같아야 한다 */
        var byNo = str(r.sourceContractNo) ? ctByNo[str(r.sourceContractNo)] : null;
        if (byNo && byNo !== 'DUP') {
          var sameName = nameKey(nameOfRec(store, r)) !== '' && nameKey(nameOfRec(store, r)) === nameKey(nameOfRec('contracts', byNo));
          var sameId = !!(str(r.companyId) && str(byNo.companyId) && str(r.companyId) === str(byNo.companyId));
          if (sameName || sameId) ct = byNo;
        }
      }
      if (!ct) return null;
      var sn = bizStatus(bizOfRec('contracts', ct));
      if (sn.kind !== 'ok' && sn.kind !== 'format') return null;
      return { digits: sn.digits, name: nameOfRec('contracts', ct), ceo: str(ct.ceo) || str(ct.company && ct.company.ceo),
        auto: !!(ct.bizAuto && ct.bizAuto.via !== 'format') || !!autoNums[sn.digits] };
    }
    var FEE_KEYS = ['contractFee', 'balanceFee', 'retainerFee', 'successFee', 'fee', 'totalFee'];
    function feesOf(r) { return FEE_KEYS.map(function (k) { return Number(r[k]) || 0; }).filter(function (v) { return v > 0; }); }
    function dateOf(r) { return str(r.startDate) || str(r.contractDate) || str(r.receiveDate) || str(r.estDate); }

    var sigRows = prepSignalRows(ev.hometax);                     // 복합 신호용 홈택스 줄 — 한 번만 손질한다
    var out = [], noneN = 0, okN = 0;
    var tables = Object.assign({ companies: companies }, stores);
    Object.keys(tables).forEach(function (s) {
      (tables[s] || []).forEach(function (r) {
        if (!r || !r.id) return;
        var deleted = !!r._deleted || !!r.mergedInto;
        var term = isTerminal(r) || (s === 'companies' && String(r.status || '') === 'closed');
        var selfRef = s + ':' + r.id;
        var rec = { name: nameOfRec(s, r), bizNo: bizOfRec(s, r), ceo: r.ceo, companyId: r.companyId, ref: selfRef, deleted: deleted, terminal: term, srcBiz: srcBizOf(s, r) };
        var b = decideBiz(rec, { idx: idx, companyById: companyById });
        /* 꼭 같은 이름의 근거가 없는 빈 칸 — 세금계산서 한 줄이 «이름 일부 + 금액 + 날짜»를 모두 맞출 때만 «제안» */
        if (b.action === 'none' && !deleted && !term && s !== 'companies' && s !== 'contracts') {
          var sg = signalBiz({ name: rec.name, fees: feesOf(r), date: dateOf(r) }, sigRows);
          if (sg) b = Object.assign({}, b, { action: 'suggest', level: 'ask', to: sg.to, via: 'signals', reason: 'multi-signal', evidence: sg.evidence });
        }
        if (b.level === 'none') noneN++;
        if (b.level === 'ok') okN++;
        if (['auto', 'ask', 'check', 'conflict'].indexOf(b.level) >= 0) {
          out.push(Object.assign({ store: s, storeLabel: STORE_LABEL[s] || s, id: r.id, no: (NO_OF[s] || function () { return ''; })(r), name: rec.name,
            field: 'bizNo', readOnlyStore: !!READONLY_STORES[s] }, b));
        }
        /* 담당자 — 번호는 «지금 칸에 있는 검증된 번호»만 쓴다(이 계획이 채울 번호는 아직 없는 것으로 본다 → 채운 뒤 다시 계획하면 늘어난다) */
        if (!deleted && !term) {
          var peers = peersFor(selfRef, r.companyId, autoNum(r) ? '' : rec.bizNo, s === 'companies', r.id);
          var m = decideManager({ managerMain: r.managerMain, deleted: deleted, terminal: term }, peers, opts.isActiveSid);
          if (m.level === 'ask' || m.level === 'conflict') {
            out.push(Object.assign({ store: s, storeLabel: STORE_LABEL[s] || s, id: r.id, no: (NO_OF[s] || function () { return ''; })(r), name: rec.name,
              field: 'managerMain', readOnlyStore: !!READONLY_STORES[s], from: '', to: m.sid, via: 'peers' }, m));
          }
          var cthave = !!contactOf(r);
          var cc = decideContact({ hasContact: cthave, deleted: deleted, terminal: term }, peers);
          if (cc.level === 'ask' || cc.level === 'conflict') {
            out.push(Object.assign({ store: s, storeLabel: STORE_LABEL[s] || s, id: r.id, no: (NO_OF[s] || function () { return ''; })(r), name: rec.name,
              field: 'contacts', readOnlyStore: !!READONLY_STORES[s], from: '', via: 'peers' }, cc));
          }
        }
      });
    });
    var counts = Object.create(null);
    out.forEach(function (x) { var k = x.field + ':' + x.action; counts[k] = (counts[k] || 0) + 1; });
    return { rows: out, counts: counts, stat: idx.stat, noEvidence: noneN, alreadyOk: okN };
  }

  var API = { bizStatus: bizStatus, checksumOk: checksumOk, fmtDigits: fmtDigits, nameKey: nameKey, buildIndex: buildIndex,
    decideBiz: decideBiz, signalBiz: signalBiz, prepSignalRows: prepSignalRows, decideManager: decideManager, decideContact: decideContact, buildPlan: buildPlan,
    isTerminal: isTerminal, KIND_CLASS: KIND_CLASS, KIND_LABEL: KIND_LABEL, STORE_LABEL: STORE_LABEL, READONLY_STORES: READONLY_STORES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuBizEvidence = API;
})(typeof window !== 'undefined' ? window : globalThis);
