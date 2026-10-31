/* pu-settle-core.js — 컨설팅정산: 비용지급 안내 읽기 · 지급월 정산 · 송금 · 카톡 문구 (2026-10-31)
   설계 docs/superpowers/specs/2026-10-31-consult-settle-design.md §5
   ■ 순수 함수 — 화면·저장·네트워크 없음. 브라우저(pu-settle.html)와 이 PC 의 카톡 심부름꾼
     (scripts/kakao-agent)이 «같은 파일»을 쓴다 — 정산 식이 두 벌이 되면 한쪽만 고쳐진다.
   ■ 금액은 정수 원, 요율은 퍼센트 숫자(25 = 25%). 곱할 때는 만분율 정수로 바꿔 소수 끝수를 피한다.
   ⚠ 사람·업체는 안내 파일의 «글»로만 들고 온다. ID(sid·consultingId)는 사람이 확정한 연결(links)로만 붙인다 —
     이름이 비슷하다고 저절로 잇지 않는다(온톨로지 규칙). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SettleCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_HEAD = '[{사업} {월} 입금분 정산 안내]';
  var DEFAULT_FOOT = '확인 부탁드립니다. 감사합니다.';
  var KST = 9 * 3600 * 1000;

  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function clean(v) { return String(v == null ? '' : v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function bare(v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 원 단위 반올림 — 안내 파일 금액은 원 미만 소수가 든 채로 온다(2,568,181.818…) */
  function won(x) {
    if (typeof x === 'string') x = x.replace(/[,\s원]/g, '');
    var n = Number(x);
    return isFinite(n) && x !== '' && x !== null ? Math.round(n) : 0;
  }
  /* 사업소득 3.3% — 소득세 3%, 지방소득세 = 소득세 × 10%, 둘 다 10원 아래 버림 */
  function withholding(pre) {
    pre = Math.max(0, Math.floor(Number(pre) || 0));
    var inc = Math.floor(pre * 3 / 1000) * 10;
    var loc = Math.floor(inc / 100) * 10;
    return { inc: inc, loc: loc, total: inc + loc };
  }
  /* 연결 열쇠 — 카톡 창 제목·엑셀 글에 섞이는 특수 공백을 고르고, RTDB 열쇠에 못 쓰는 글자를 바꾼다 */
  function linkKey(text) { return clean(text).replace(/[.#$\[\]\/]/g, '_'); }

  function kstParts(t) {
    var d = new Date((Number(t) || Date.now()) + KST);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  }
  /* 「9월 (10/2 지급)」 → 2026-09. 연도는 받은 날 기준, 받은 달보다 큰 달은 지난해 */
  function monthKeyOf(label, receivedAt) {
    var m = /(\d{1,2})\s*월/.exec(String(label == null ? '' : label));
    if (!m) return null;
    var month = Number(m[1]);
    if (month < 1 || month > 12) return null;
    var now = kstParts(receivedAt), year = month > now.m ? now.y - 1 : now.y;
    return { key: year + '-' + pad2(month), year: year, month: month };
  }

  /* ═══ 안내 파일 읽기 ═══
     grid = 시트를 [행][열] 로 편 것(SheetJS sheet_to_json header:1), merges = ws['!merges'], meta.ref = ws['!ref']
     ⚠ SheetJS 는 grid 를 «시트가 실제로 시작하는 칸»(예: B5)부터 펴지만 merges 는 A1 기준 자리다 —
       meta.ref 의 시작 칸만큼 merges 를 옮겨야 지급월 병합 칸이 맞는다(2026-10-31 실제 안내 파일에서 7월만 읽힌 까닭). */
  function fail(msg) { return { ok: false, error: msg }; }
  function refStart(ref) {
    var m = /^\$?([A-Z]+)\$?(\d+)/i.exec(String(ref || ''));
    if (!m) return { r: 0, c: 0 };
    var c = 0, s = m[1].toUpperCase();
    for (var i = 0; i < s.length; i++) c = c * 26 + (s.charCodeAt(i) - 64);
    return { r: Number(m[2]) - 1, c: c - 1 };
  }
  function parseNotice(grid, merges, meta) {
    meta = meta || {};
    if (!Array.isArray(grid) || !grid.length) return fail('시트가 비어 있습니다');
    var o = refStart(meta.ref);
    merges = (merges || []).map(function (m) {
      return m && m.s && m.e ? { s: { r: m.s.r - o.r, c: m.s.c - o.c }, e: { r: m.e.r - o.r, c: m.e.c - o.c } } : null;
    });
    var hr = -1, nameCol = -1, compCol = -1;
    for (var r = 0; r < Math.min(grid.length, 20) && hr < 0; r++) {
      var row = grid[r] || [];
      var a = -1, b = -1;
      for (var c = 0; c < row.length; c++) {
        if (bare(row[c]) === '컨설턴트') a = c;
        else if (bare(row[c]) === '기업명') b = c;
      }
      if (a >= 0 && b >= 0) { hr = r; nameCol = a; compCol = b; }
    }
    if (hr < 0) return fail('«컨설턴트»·«기업명» 머리줄을 찾지 못했습니다');
    var head = grid[hr] || [], sub = grid[hr + 1] || [];
    var totalCol = -1;
    [head, sub].forEach(function (line) {
      for (var c = 0; c < line.length && totalCol < 0; c++) {
        var t = bare(line[c]);
        if (t.indexOf('합계') >= 0 && t.indexOf('세전') >= 0) totalCol = c;
      }
    });
    var start = -1;
    for (var c2 = 0; c2 < head.length; c2++) if (bare(head[c2]) === '지급월') { start = c2; break; }
    if (start < 0) return fail('«지급월» 열을 찾지 못했습니다');
    var end = start;
    (merges || []).forEach(function (m) { if (m && m.s && m.e && m.s.r === hr && m.s.c === start) end = m.e.c; });
    var months = [], seen = {};
    for (var col = start; col <= end; col++) {
      var label = clean(sub[col]), mk = monthKeyOf(label, meta.receivedAt);
      if (!mk || seen[mk.key]) continue;
      seen[mk.key] = 1;
      months.push({ key: mk.key, label: label, col: col });
    }
    if (!months.length) return fail('지급월 열에 «N월» 이름이 없습니다');
    var rows = [], blank = 0;
    for (var i = hr + 2; i < grid.length; i++) {
      var line = grid[i] || [], name = clean(line[nameCol]), company = clean(line[compCol]);
      if (!name && !company) { if (++blank >= 3) break; continue; }
      blank = 0;
      if (!name || !company) continue;
      var amounts = {};
      months.forEach(function (m) { var v = won(line[m.col]); if (v > 0) amounts[m.key] = v; });
      rows.push({ line: i + 1, name: name, company: company, totalPre: totalCol >= 0 ? Math.max(0, won(line[totalCol])) : 0, amounts: amounts });
    }
    if (!rows.length) return fail('읽을 줄이 없습니다');
    return { ok: true, fileName: String(meta.fileName || ''), receivedAt: Number(meta.receivedAt) || 0, months: months, rows: rows };
  }

  /* ═══ 지급월 정산 — 방식 pool (일터혁신) ═══
     사람마다 세후 = 세전 − 3.3% (통장 실입금이 있으면 그 값), 사업장 T = 세후 합,
     담당 몫 = FLOOR(T × 요율), 정산액 = 몫 − 세후 + 이월·조정, 주관 정산액 = −(담당 합), 최종 = 세후 + 정산액 */
  function rateOf(rule, consultingId, sid) {
    var site = rule.siteRates && consultingId && rule.siteRates[consultingId];
    if (site && own(site, sid) && site[sid] !== '' && site[sid] != null && isFinite(Number(site[sid]))) return Number(site[sid]);
    if (rule.rates && own(rule.rates, sid) && rule.rates[sid] !== '' && rule.rates[sid] != null && isFinite(Number(rule.rates[sid]))) return Number(rule.rates[sid]);
    return null;
  }
  function settleMonth(notice, monthKey, rule, ctx) {
    rule = rule || {}; ctx = ctx || {};
    var cl = ctx.companyLinks || {}, pl = ctx.personLinks || {}, act = ctx.actuals || {}, adjs = ctx.adjusts || [], names = ctx.names || {};
    var issues = [];
    if (!rule.leadSid) issues.push('주관(대표)이 규칙에 정해지지 않았습니다');
    var months = (notice && notice.months) || [], idx = -1;
    months.forEach(function (m, i) { if (m.key === monthKey) idx = i; });
    var prevKeys = months.slice(0, Math.max(0, idx)).map(function (m) { return m.key; });
    var groups = [], byKey = {};
    ((notice && notice.rows) || []).forEach(function (r) {
      var k = linkKey(r.company);
      if (!byKey[k]) { byKey[k] = { key: k, company: r.company, rows: [] }; groups.push(byKey[k]); }
      byKey[k].rows.push(r);
    });
    var sites = [];
    groups.forEach(function (g) {
      var roster = g.rows.filter(function (r) { return r.totalPre > 0 || Object.keys(r.amounts || {}).length > 0; });
      if (!roster.some(function (r) { return (r.amounts || {})[monthKey] > 0; })) return;
      var link = cl[g.key] || null, cid = link && link.consultingId || '', coid = link && link.companyId || '';
      var sIssues = [];
      if (!cid) sIssues.push('업체 연결 필요: ' + g.company);
      var paidBefore = prevKeys.filter(function (k) { return roster.some(function (r) { return (r.amounts || {})[k] > 0; }); }).length;
      var members = roster.map(function (r) {
        var sid = pl[linkKey(r.name)] || '';
        if (!sid) sIssues.push('사람 연결 필요: ' + r.name);
        var pre = (r.amounts || {})[monthKey] || 0, w = withholding(pre), net = pre - w.total;
        var ak = cid + '|' + sid, actual = cid && sid && own(act, ak) && act[ak] !== '' && act[ak] != null ? won(act[ak]) : null;
        return { name: r.name, sid: sid, role: sid && sid === rule.leadSid ? 'lead' : 'staff', pre: pre, inc: w.inc, loc: w.loc, net: net,
          actual: actual, used: actual != null ? actual : net, rate: null, share: null, diff: null, adjust: 0, adjustIds: [], settle: null, final: null };
      });
      if (rule.leadSid && !members.some(function (m) { return m.role === 'lead'; })) {
        members.push({ name: names[rule.leadSid] || '주관', sid: rule.leadSid, role: 'lead', pre: 0, inc: 0, loc: 0, net: 0, actual: null, used: 0,
          rate: null, share: null, diff: null, adjust: 0, adjustIds: [], settle: null, final: null });
      }
      var T = members.reduce(function (s, m) { return s + m.used; }, 0), staffSum = 0, complete = true;
      members.forEach(function (m) {
        if (m.role !== 'staff') return;
        if (!m.sid) { complete = false; return; }
        var rate = rateOf(rule, cid, m.sid);
        if (rate == null) { sIssues.push('요율 없음: ' + m.name); complete = false; return; }
        m.rate = rate;
        m.share = Math.floor(T * Math.round(rate * 100) / 10000);
        m.diff = m.share - m.used;
        adjs.forEach(function (a) {
          if (a && cid && a.consultingId === cid && a.sid === m.sid) { m.adjust += Math.round(Number(a.amount) || 0); m.adjustIds.push(a.id); }
        });
        m.settle = m.diff + m.adjust;
        m.final = m.used + m.settle;
        staffSum += m.settle;
      });
      members.forEach(function (m) {
        if (m.role !== 'lead' || !complete) return;
        m.settle = -staffSum;
        m.final = m.used + m.settle;
      });
      sites.push({ company: g.company, key: g.key, consultingId: cid, companyId: coid, round: paidBefore + 1, members: members, totalNet: T, issues: sIssues });
    });
    return { sites: sites, issues: issues };
  }

  function transfersOf(sites, leadSid) {
    var out = [];
    (sites || []).forEach(function (s) {
      s.members.forEach(function (m) {
        if (m.role !== 'staff' || !m.settle) return;
        if (m.settle < 0) out.push({ consultingId: s.consultingId, company: s.company, fromSid: m.sid, toSid: leadSid, amount: -m.settle });
        else out.push({ consultingId: s.consultingId, company: s.company, fromSid: leadSid, toSid: m.sid, amount: m.settle });
      });
    });
    return out;
  }
  /* 확정해도 되는가 — 확인 필요가 하나라도 있거나 검산(정산액 합 0 · 최종 합 = 세후 합)이 어긋나면 막는다 */
  function checkRun(sites, globalIssues) {
    var issues = (globalIssues || []).slice();
    (sites || []).forEach(function (s) {
      s.issues.forEach(function (x) { issues.push(s.company + ' — ' + x); });
      if (s.issues.length) return;
      var sumSettle = 0, sumFinal = 0;
      s.members.forEach(function (m) { sumSettle += m.settle || 0; sumFinal += m.final || 0; });
      if (sumSettle !== 0 || sumFinal !== s.totalNet) issues.push(s.company + ' — 검산이 맞지 않습니다');
    });
    if (!(sites || []).length) issues.push('정산할 사업장이 없습니다');
    return { ok: issues.length === 0, issues: issues };
  }
  function runId(typeCode, monthKey) { return String(typeCode) + '_' + String(monthKey); }
  /* 확정된 달에 새 안내가 오면 «바뀜»만 알린다 — 사람별 세전·실입금을 견준다 */
  function diffRun(oldSites, newSites) {
    function sig(sites) {
      var o = {};
      (sites || []).forEach(function (s) { (s.members || []).forEach(function (m) { o[s.key + '|' + (m.sid || m.name)] = m.pre + '/' + (m.actual == null ? '' : m.actual); }); });
      return o;
    }
    var a = sig(oldSites), b = sig(newSites), ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return true;
    return ka.some(function (k) { return a[k] !== b[k]; });
  }
  function appliedAdjustIds(sites) {
    var seen = {}, out = [];
    (sites || []).forEach(function (s) { s.members.forEach(function (m) { (m.adjustIds || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } }); }); });
    return out;
  }
  function unapplyAdjusts(adjusts, rid) {
    return Object.keys(adjusts || {}).filter(function (id) { return adjusts[id] && adjusts[id].appliedRunId === rid; });
  }

  /* ═══ 카톡 문구 ═══ — 담당마다 한 통. 사번·계좌는 넣지 않는다. 조사(에게·가)를 쓰지 않아 이름 받침에 안 걸린다 */
  function fmt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '−' : '') + s;
  }
  function settleLine(prefix, v, leadName) {
    if (v < 0) return prefix + fmt(-v) + '원 송금 부탁드립니다 (받는 분 ' + leadName + ')';
    if (v > 0) return prefix + fmt(v) + '원을 보내 드립니다 (보내는 분 ' + leadName + ')';
    return prefix + '주고받을 금액이 없습니다';
  }
  function buildMessages(run, rule, names) {
    rule = rule || {}; names = names || {};
    var month = Number(String(run.monthKey || '').slice(5)) + '월';
    var head = String(rule.msgHead || DEFAULT_HEAD).split('{사업}').join(rule.title || '').split('{월}').join(month);
    var foot = String(rule.msgFoot || DEFAULT_FOOT);
    var leadName = names[rule.leadSid] || '주관';
    var order = [], by = {};
    (run.sites || []).forEach(function (s) {
      s.members.forEach(function (m) {
        if (m.role !== 'staff' || !m.sid || m.settle == null) return;
        if (!by[m.sid]) { by[m.sid] = { sid: m.sid, name: names[m.sid] || m.name, items: [] }; order.push(m.sid); }
        by[m.sid].items.push({ s: s, m: m });
      });
    });
    return order.map(function (sid) {
      var p = by[sid], L = [head, p.name + '님, ' + month + ' 입금분 정산 내역을 안내드립니다.', ''], total = 0;
      p.items.forEach(function (it) {
        var s = it.s, m = it.m;
        L.push('■ ' + s.company + ' (' + s.round + '차)');
        if (m.actual != null) L.push('· 세전 ' + fmt(m.pre) + '원 / 통장 입금 ' + fmt(m.used) + '원');
        else L.push('· 세전 ' + fmt(m.pre) + '원 − 원천징수 ' + fmt(m.inc + m.loc) + '원 = 세후 ' + fmt(m.used) + '원');
        L.push('· 사업장 세후 합계 ' + fmt(s.totalNet) + '원 × ' + m.rate + '% = ' + fmt(m.share) + '원');
        if (m.adjust) L.push('· 이월·조정 ' + fmt(m.adjust) + '원');
        L.push(settleLine('· 정산: ', m.settle, leadName));
        L.push('');
        total += m.settle;
      });
      if (p.items.length > 1) { L.push(settleLine('■ 합계: ', total, leadName)); L.push(''); }
      L.push(foot);
      return { sid: sid, name: p.name, text: L.join('\n') };
    });
  }

  /* ═══ 입금 대조 ═══ — 통장에 «실제로» 들어온 금액을 계산한 세후와 견준다(대표 지시 2026-10-31 「개개인에게 입금된 금액을 비교」)
     ⚠ 금액이 같다는 것은 «후보»일 뿐이다 — 사람이 고르고 «저장»을 눌러야 통장 실입금이 된다(온톨로지: 금액 일치로 ID 를 자동 대입하지 않는다). */
  var MONEY_RE = /(?:^|[^\d,.\-*])(\d{1,3}(?:,\d{3})+|\d{4,9})(?:\s*원)?(?![\d,*\-])/g;
  /* 인터넷뱅킹 거래내역·입금 문자·엑셀에서 복사한 글 → 줄마다 금액 후보.
     잔액·계좌번호(-·*)·날짜·시각은 금액으로 안 본다. «출금»만 있는 줄은 건너뛴다. */
  function parseDepositText(text) {
    var out = [];
    String(text == null ? '' : text).split(/\r?\n/).forEach(function (raw, li) {
      var line = clean(raw.replace(/\t/g, ' '));
      if (!line) return;
      if (/출금|이체출금|지급/.test(line) && !/입금/.test(line)) return;
      var date = '', d = /(20\d{2})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})/.exec(line);
      if (d) date = d[1] + '-' + pad2(Number(d[2])) + '-' + pad2(Number(d[3]));
      else if ((d = /(?:^|\s)(\d{1,2})[.\/](\d{1,2})(?:\s|$)/.exec(line))) date = pad2(Number(d[1])) + '-' + pad2(Number(d[2]));
      var body = line.replace(/잔액\s*:?\s*[\d,]+\s*원?/g, ' ')
        .replace(/20\d{2}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}일?/g, ' ').replace(/\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
        .replace(/[\d*]+(?:-[\d*]+){1,4}/g, ' ');
      var m, n = 0;
      MONEY_RE.lastIndex = 0;
      while ((m = MONEY_RE.exec(body))) {
        var amount = Number(m[1].replace(/,/g, ''));
        if (amount < 1000) continue;
        out.push({ id: 'p' + li + '_' + (n++), source: 'paste', amount: amount, date: date, memo: line.length > 60 ? line.slice(0, 60) + '…' : line });
      }
    });
    return out;
  }
  function ymd(s) { return String(s || '').slice(0, 10); }
  /* 재무관리 거래내역 묶음(data/ledger_batches 의 v) → 기간 안의 «입금» 줄. 지운 묶음·카드 취소는 뺀다 */
  function ledgerDeposits(batches, from, to) {
    var out = [];
    toArr(batches).forEach(function (b) {
      if (!b || b._deleted) return;
      toArr(b.rows).forEach(function (r, i) {
        if (!r || r.type !== 'income' || r.cancel || r._deleted) return;
        var day = ymd(r.date), amount = Math.round(Number(r.amount) || 0);
        if (!day || day < from || day > to || amount <= 0) return;
        out.push({ id: String(b.id || 'b') + ':' + String(r._k || i), source: 'ledger', amount: amount, date: String(r.date || ''), memo: clean(r.memo), note: clean(r.note) });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  /* 지급월 열쇠의 입금 찾을 기간 — 「9월 (10/2 지급)」처럼 이름 달보다 늦게 들어오기도 해서 다음 달 20일까지 본다 */
  function depositWindow(monthKey) {
    var y = Number(String(monthKey).slice(0, 4)), m = Number(String(monthKey).slice(5, 7));
    var ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return { from: y + '-' + pad2(m) + '-01', to: ny + '-' + pad2(nm) + '-20' };
  }
  /* 한 사람이 이 정산표에서 받았어야 할 세후 — 사업장마다 한 줄(계산값 기준, 이미 넣은 실입금과 견주려고 net 을 쓴다) */
  function expectedFor(run, sid) {
    var out = [];
    ((run && run.sites) || []).forEach(function (s) {
      (s.members || []).forEach(function (m) {
        if (m.sid !== sid || !(m.pre > 0) || !s.consultingId) return;
        out.push({ key: s.consultingId + '|' + sid, company: s.company, round: s.round, amount: m.net, actual: m.actual == null ? null : m.actual });
      });
    });
    return out;
  }
  /* 맞추기 — ① 같은 금액 ② 1%(최소 1,000원) 안쪽의 가까운 금액(«확인 필요») ③ 없음. 찾은 줄 하나는 한 번만 쓴다 */
  function matchDeposits(expected, found) {
    var used = {}, out = (expected || []).map(function (e) { return { key: e.key, company: e.company, expected: e.amount, found: null, kind: 'none', diff: null }; });
    out.forEach(function (o) {
      var f = (found || []).filter(function (x) { return !used[x.id] && x.amount === o.expected; })[0];
      if (f) { used[f.id] = 1; o.found = f; o.kind = 'exact'; o.diff = 0; }
    });
    out.forEach(function (o) {
      if (o.found) return;
      var tol = Math.max(1000, Math.round(o.expected * 0.01)), best = null;
      (found || []).forEach(function (x) {
        if (used[x.id]) return;
        var d = Math.abs(x.amount - o.expected);
        if (d <= tol && (!best || d < Math.abs(best.amount - o.expected))) best = x;
      });
      if (best) { used[best.id] = 1; o.found = best; o.kind = 'near'; o.diff = best.amount - o.expected; }
    });
    return out;
  }

  /* ═══ 읽은 자료 고르기 ═══ — 파이어베이스는 빈 배열·null 칸을 저장하지 않고, 배열을 {0:…,1:…} 로 돌려줄 때가 있다.
     읽을 때 늘 이것을 거친다(전광판 normalizeAd 와 같은 까닭) */
  function toArr(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
    if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
    return [];
  }
  function nn(v) { return v === undefined ? null : v; }
  function normalizeRun(run) {
    if (!run || typeof run !== 'object') return null;
    var out = {};
    Object.keys(run).forEach(function (k) { out[k] = run[k]; });
    out.issues = toArr(run.issues);
    out.transfers = toArr(run.transfers);
    out.actuals = run.actuals && typeof run.actuals === 'object' ? run.actuals : {};
    out.sites = toArr(run.sites).map(function (s) {
      return { company: s.company || '', key: s.key || linkKey(s.company), consultingId: s.consultingId || '', companyId: s.companyId || '', round: Number(s.round) || 1,
        totalNet: Number(s.totalNet) || 0, issues: toArr(s.issues),
        members: toArr(s.members).map(function (m) {
          return { name: m.name || '', sid: m.sid || '', role: m.role === 'lead' ? 'lead' : 'staff', pre: Number(m.pre) || 0, inc: Number(m.inc) || 0, loc: Number(m.loc) || 0,
            net: Number(m.net) || 0, actual: nn(m.actual), used: Number(m.used) || 0, rate: nn(m.rate), share: nn(m.share), diff: nn(m.diff),
            adjust: Number(m.adjust) || 0, adjustIds: toArr(m.adjustIds), settle: nn(m.settle), final: nn(m.final) };
        }) };
    });
    return out;
  }
  function normalizeNotice(n) {
    if (!n || typeof n !== 'object') return null;
    var out = {};
    Object.keys(n).forEach(function (k) { out[k] = n[k]; });
    out.months = toArr(n.months);
    out.rows = toArr(n.rows).map(function (r) { return { line: r.line, name: r.name || '', company: r.company || '', totalPre: Number(r.totalPre) || 0, amounts: r.amounts || {} }; });
    return out;
  }

  /* 같은 내용을 두 번 올리지 않게 — 줄을 정렬해 FNV-1a 32비트 */
  function noticeHash(rows) {
    var parts = (rows || []).map(function (r) {
      var a = Object.keys(r.amounts || {}).sort().map(function (k) { return k + '=' + r.amounts[k]; }).join(',');
      return linkKey(r.name) + '|' + linkKey(r.company) + '|' + (r.totalPre || 0) + '|' + a;
    }).sort();
    var s = parts.join('\n'), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + '-' + parts.length;
  }

  return {
    DEFAULT_HEAD: DEFAULT_HEAD, DEFAULT_FOOT: DEFAULT_FOOT,
    won: won, withholding: withholding, linkKey: linkKey, monthKeyOf: monthKeyOf, fmt: fmt,
    parseNotice: parseNotice, settleMonth: settleMonth, transfersOf: transfersOf, checkRun: checkRun,
    runId: runId, diffRun: diffRun, appliedAdjustIds: appliedAdjustIds, unapplyAdjusts: unapplyAdjusts,
    buildMessages: buildMessages, noticeHash: noticeHash, toArr: toArr, normalizeRun: normalizeRun, normalizeNotice: normalizeNotice,
    parseDepositText: parseDepositText, ledgerDeposits: ledgerDeposits, depositWindow: depositWindow, expectedFor: expectedFor, matchDeposits: matchDeposits
  };
});
