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

  /* 카톡 문구 머리 — 대표 지시 2026-10-31 「카톡은 컨설팅 비용 정산 안내로」. {사업} 사업 이름 · {지급월} «2026년 10월» · {월} «10월» */
  var DEFAULT_HEAD = '[컨설팅 비용 정산 안내]\n{사업} — {지급월}';
  var HOW_TO = '※ 계산 방법 — 입금 금액(원천징수 뒤 세후)을 모두 더해 담당자 퍼센트를 곱한 것이 담당자 퍼센트 반영금액입니다(원 미만 버림). '
    + '담당자가 받은 금액이 반영금액보다 많으면 차액을 반환하고, 적으면 차액을 추가로 지급받습니다. 담당자 입금 없이 주관에게만 입금됐으면 주관이 반영금액 전액을 지급합니다.';
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
  /* 원천징수 — 대표 지시 2026-10-31 「세전금액을 3.3 8.8 퍼로 역계산」.
     '3.3' 사업소득: 소득세 = 세전 × 3%, 지방소득세 = 소득세 × 10%, 둘 다 10원 아래 버림.
     '8.8' 기타소득(필요경비 60%): 기타소득금액 = 세전 × 40%, 소득세 = 그 × 20%, 지방소득세 = 소득세 × 10%, 10원 아래 버림.
       기타소득금액이 5만 원 이하(세전 12만 5천 원 이하)면 과세최저한으로 0원(소득세법 제84조) [확인 필요: 건별 판단은 담당 노무사]. */
  var TAX_KO = { '3.3': '3.3% 사업소득', '8.8': '8.8% 기타소득' };
  function taxOf(x) { return String(x) === '8.8' ? '8.8' : '3.3'; }
  function withholding(pre, tax) {
    pre = Math.max(0, Math.floor(Number(pre) || 0));
    var inc;
    if (taxOf(tax) === '8.8') { var base = Math.floor(pre * 4 / 10); inc = base > 50000 ? Math.floor(base * 2 / 100) * 10 : 0; }
    else inc = Math.floor(pre * 3 / 1000) * 10;
    var loc = Math.floor(inc / 100) * 10;
    return { inc: inc, loc: loc, total: inc + loc };
  }
  /* 실수령액(세후) → 세전 역계산. 10원 버림 때문에 딱 맞는 세전이 없거나 둘일 수 있다 —
     딱 맞는 것 중 끝자리 0 이 많은 것(실제 지급액은 대개 둥근 수), 없으면 가장 가까운 것(exact:false) */
  function preFromNet(net, tax) {
    net = won(net);
    if (!(net > 0)) return { pre: 0, exact: net === 0, net: 0, inc: 0, loc: 0 };
    var r = taxOf(tax) === '8.8' ? 0.088 : 0.033, mid = Math.round(net / (1 - r)), best = null, near = null;
    var zeros = function (n) { var z = 0; while (n > 0 && n % 10 === 0 && z < 9) { n /= 10; z++; } return z; };
    var cands = [net];
    for (var p = mid - 40; p <= mid + 40; p++) if (p > 0) cands.push(p);
    cands.forEach(function (q) {
      var d = Math.abs(q - withholding(q, tax).total - net);
      if (d === 0 && (best == null || zeros(q) > zeros(best) || (zeros(q) === zeros(best) && q < best))) best = q;
      if (!near || d < near.d || (d === near.d && q < near.p)) near = { p: q, d: d };
    });
    var pre = best != null ? best : near.p, w = withholding(pre, tax);
    return { pre: pre, exact: best != null, net: pre - w.total, inc: w.inc, loc: w.loc };
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
  /* 담당 몫 = FLOOR(사업장 세후 합계 × 요율) — 요율은 만분율 정수로 바꿔 곱한다(정산표·계산기가 같이 쓴다) */
  function shareOf(T, rate) { return Math.floor(T * Math.round(Number(rate) * 100) / 10000); }
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
        var tax = taxOf(r.tax || rule.tax), pre = (r.amounts || {})[monthKey] || 0, w = withholding(pre, tax), net = pre - w.total;
        var ak = cid + '|' + sid, actual = cid && sid && own(act, ak) && act[ak] !== '' && act[ak] != null ? won(act[ak]) : null;
        return { name: r.name, sid: sid, role: sid && sid === rule.leadSid ? 'lead' : 'staff', tax: tax, pre: pre, inc: w.inc, loc: w.loc, net: net,
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
        m.share = shareOf(T, rate);
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

  /* ═══ 계산기 — 사업장 하나를 그 자리에서 ═══ (대표 지시 2026-10-31 「컨설팅종류, 사업장 수행자 요율 등 각각 선택하게 하고 그부분만 반영하게 간단하게」)
     rows = [{sid?, name, role:'lead'|'staff', pre, rate?, actual?}] — 저장하지 않는다. 식은 정산표(settleMonth)와 같다. */
  function calcSite(rows) {
    /* 빈 줄 거르기 — 수행자를 고른(sid) 줄이나 이름을 적은 줄만. ⚠ «이름 || 사번» 모양을 쓰지 않는다(tests/sid-never-shown) */
    var issues = [], members = (rows || []).filter(function (r) { return r && (r.sid || clean(r.name)); }).map(function (r) {
      var tax = taxOf(r.tax), pre = won(r.pre), w = withholding(pre, tax), net = pre - w.total, actual = r.actual === '' || r.actual == null ? null : won(r.actual);
      var rate = r.role === 'staff' && r.rate !== '' && r.rate != null && isFinite(Number(String(r.rate).replace(/[%\s]/g, ''))) ? Number(String(r.rate).replace(/[%\s]/g, '')) : null;
      return { sid: r.sid || '', name: clean(r.name), role: r.role === 'lead' ? 'lead' : 'staff', tax: tax, pre: pre, inc: w.inc, loc: w.loc, net: net, actual: actual,
        used: actual != null ? actual : net, rate: rate, share: null, diff: null, settle: null, final: null };
    });
    if (!members.length) return { members: [], totalNet: 0, issues: ['수행자를 넣으세요'], transfers: [] };
    var leads = members.filter(function (m) { return m.role === 'lead'; });
    if (!leads.length) issues.push('주관을 한 사람 고르세요');
    if (leads.length > 1) issues.push('주관은 한 사람만 고르세요');
    var T = members.reduce(function (s, m) { return s + m.used; }, 0), staffSum = 0;
    members.forEach(function (m) {
      if (m.role !== 'staff') return;
      if (m.rate == null || m.rate < 0 || m.rate > 100) { issues.push('요율 없음: ' + (m.name || '(이름 없음)')); m.rate = null; return; }
      m.share = shareOf(T, m.rate); m.diff = m.share - m.used; m.settle = m.diff; m.final = m.used + m.settle; staffSum += m.settle;
    });
    var transfers = [];
    if (!issues.length) {
      var lead = leads[0];
      lead.settle = -staffSum; lead.final = lead.used + lead.settle;
      members.forEach(function (m) {
        if (m.role !== 'staff' || !m.settle) return;
        transfers.push(m.settle < 0 ? { from: m.name, to: lead.name, amount: -m.settle, dir: 'back' } : { from: lead.name, to: m.name, amount: m.settle, dir: 'more' });
      });
    } else {
      members.forEach(function (m) { m.settle = null; m.final = null; });
    }
    return { members: members, totalNet: T, issues: issues, transfers: transfers };
  }

  /* 송금 방향의 이름 — 대표 지시 2026-10-31 「권형하가 더 받은것이면 추가로 담당자에게 더 지급해야되고 담당자가 더받은것이면 반환해야된다 …
     정확하게 이해가능하게」. back = 담당이 몫보다 더 받아 주관에게 돌려줌(반환) · more = 주관이 더 받아 담당에게 더 줌(추가 지급).
     저장된 송금(transfers)에는 방향 칸이 없다 — 받는 사람이 그 사업장 주관이면 반환이다. */
  var DIR_KO = { back: '반환', more: '추가 지급' };
  function dirOf(t, leadSid) { return t && t.dir ? t.dir : (t && leadSid && t.toSid === leadSid ? 'back' : 'more'); }
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
      (sites || []).forEach(function (s) { (s.members || []).forEach(function (m) { o[s.key + '|' + (m.sid || m.name)] = m.pre + '/' + (m.actual == null ? '' : m.actual) + '/' + taxOf(m.tax); }); });
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
  /* 담당 기준 정산액 → 누가 누구에게(반환 / 추가 지급) */
  function settleLine(prefix, v, staffName, leadName) {
    if (v < 0) return prefix + '반환: ' + staffName + ' → ' + leadName + ' ' + fmt(-v) + '원 (송금 부탁드립니다)';
    if (v > 0) return prefix + '추가 지급: ' + leadName + ' → ' + staffName + ' ' + fmt(v) + '원 (보내 드립니다)';
    return prefix + '주고받을 금액이 없습니다';
  }
  /* 입금자 한 줄 — 통장 확인 금액이 있으면 그것, 없으면 세전에서 원천징수를 뺀 계산값 */
  function depositLine(m, nm) {
    var w = '세전 ' + fmt(m.pre) + '원 − 원천징수 ' + taxOf(m.tax) + '% ' + fmt(m.inc + m.loc) + '원';
    if (m.actual != null) return ' · ' + nm + ' ' + fmt(m.used) + '원 (' + (m.actual === m.net ? w : '통장 확인 금액 · 계산상 세후 ' + fmt(m.net) + '원') + ')';
    if (!(m.pre > 0)) return ' · ' + nm + ' 0원';
    return ' · ' + nm + ' ' + fmt(m.used) + '원 (' + w + ')';
  }
  /* 카톡 문구 — 대표 지시 2026-10-31 「카톡은 컨설팅 비용 정산 안내로 하고 입금자 입금금액 담당자 담당자 산정금액 % 등 계산방법등을 정리해서」,
     「권형하 입금금액 얼마 박재원 얼마. 각각 세후 담당자 퍼센트 반영금액 담당자 받은금액 에대한 차액등으로」,
     「담당자가 전혀 입금없이 권형하만 입금되는경우 … 권형하가 담당자에게 지급만 하면 된다 퍼센트에 따라」.
     담당마다 한 통: 사업장마다 ① 입금 금액(세후, 사람마다) ② 담당자 퍼센트 반영금액(합계 × %) ③ 담당자 받은 금액 ④ 차액(반환 / 추가 지급), 끝에 계산 방법 */
  function buildMessages(run, rule, names) {
    rule = rule || {}; names = names || {};
    var month = Number(String(run.monthKey || '').slice(5)) + '월', label = run.label || (String(run.monthKey || '').slice(0, 4) + '년 ' + month);
    var head = String(rule.msgHead || DEFAULT_HEAD).split('{사업}').join(rule.title || '').split('{지급월}').join(label).split('{월}').join(month);
    var foot = String(rule.msgFoot || DEFAULT_FOOT);
    var nameOf = function (m) { return names[m.sid] || m.name || ''; };
    var order = [], by = {};
    (run.sites || []).forEach(function (s) {
      s.members.forEach(function (m) {
        if (m.role !== 'staff' || !m.sid || m.settle == null) return;
        if (!by[m.sid]) { by[m.sid] = { sid: m.sid, name: nameOf(m), items: [] }; order.push(m.sid); }
        by[m.sid].items.push({ s: s, m: m });
      });
    });
    return order.map(function (sid) {
      var p = by[sid], L = [head, '', p.name + '님, ' + label + ' 지급분 컨설팅 비용 정산 내역을 안내드립니다.', ''], total = 0, leadName = '';
      p.items.forEach(function (it) {
        var s = it.s, m = it.m, lead = s.members.filter(function (x) { return x.role === 'lead'; })[0];
        var ln = (lead && nameOf(lead)) || names[rule.leadSid] || '주관';
        leadName = leadName || ln;
        L.push('■ ' + s.company + ' (' + s.round + '차)');
        L.push('① 입금 금액(세후)');
        s.members.forEach(function (x) { if (x.role === 'lead' || x.sid === m.sid || x.pre > 0 || x.actual != null) L.push(depositLine(x, nameOf(x))); });
        L.push(' · 합계 ' + fmt(s.totalNet) + '원');
        L.push('② 담당자 퍼센트 반영금액 (' + p.name + ' ' + m.rate + '%)');
        L.push(' · ' + fmt(s.totalNet) + '원 × ' + m.rate + '% = ' + fmt(m.share) + '원');
        L.push('③ 담당자 받은 금액');
        L.push(' · ' + p.name + ' ' + fmt(m.used) + '원' + (m.used > 0 ? '' : ' (입금 없음 — ' + ln + '에게 입금)'));
        L.push('④ 차액');
        L.push(' · ' + fmt(m.share) + '원 − ' + fmt(m.used) + '원' + (m.adjust ? ' + 이월·조정 ' + fmt(m.adjust) + '원' : '') + ' = ' + (m.settle > 0 ? '+' : '') + fmt(m.settle) + '원');
        L.push(settleLine(' → ', m.settle, p.name, ln));
        L.push('');
        total += m.settle;
      });
      if (p.items.length > 1) { L.push(settleLine('■ 이번 지급분 합계 — ', total, p.name, leadName)); L.push(''); }
      L.push(HOW_TO);
      L.push('');
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
          return { name: m.name || '', sid: m.sid || '', role: m.role === 'lead' ? 'lead' : 'staff', tax: taxOf(m.tax), pre: Number(m.pre) || 0, inc: Number(m.inc) || 0, loc: Number(m.loc) || 0,
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
    out.rows = toArr(n.rows).map(function (r) {
      var o = { line: r.line, name: r.name || '', company: r.company || '', totalPre: Number(r.totalPre) || 0, amounts: r.amounts || {} };
      if (r.tax) o.tax = taxOf(r.tax);
      return o;
    });
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

  /* ═══ 직접 입력 — 안내 엑셀이 없는 컨설팅(대표 선택 2026-10-31 「직접 입력 기능 추가」) ═══
     사업 종류마다 «직접 입력» 안내 하나에 쌓는다 — 안내 파일과 같은 모양(사람+사업장 한 줄, 달마다 amounts)이라 정산표 계산은 그대로.
     entry = {monthKey:'2026-10', company:'사업장 글', people:[{name, pre}]}. 같은 달·같은 사업장을 다시 넣으면 통째로 바꾼다.
     ★ 세전 0 인 담당도 줄로 남긴다(amounts 에 0) — 대표 2026-10-31 「특별히 배분되어서 입금되는게 아니면 항상 권형하에게 입금」:
       주관이 전액 받은 사업장에서도 담당이 정산표에 들어가 몫을 «추가 지급» 받는다. */
  function manualRows(rows) {
    rows = rows.filter(function (r) { return Object.keys(r.amounts).length; });
    rows.forEach(function (r, i) { r.line = i + 1; r.totalPre = Object.keys(r.amounts).reduce(function (s, k) { return s + (Number(r.amounts[k]) || 0); }, 0); });
    return rows;
  }
  function manualMonths(rows, known) {
    var label = {}, seen = {};
    (known || []).forEach(function (m) { if (m && m.key) label[m.key] = m.label; });
    rows.forEach(function (r) { Object.keys(r.amounts).forEach(function (k) { seen[k] = 1; }); });
    return Object.keys(seen).sort().map(function (k) { return { key: k, label: label[k] || (Number(k.slice(5)) + '월') }; });
  }
  function manualCopy(notice) {
    var n = normalizeNotice(notice) || { months: [], rows: [] };
    return { months: n.months, rows: n.rows.map(function (r) {
      var o = { line: r.line, name: r.name, company: r.company, totalPre: r.totalPre, amounts: Object.assign({}, r.amounts) };
      if (r.tax) o.tax = r.tax;
      return o;
    }) };
  }
  function manualAdd(notice, entry) {
    var n = manualCopy(notice), mk = entry.monthKey, ck = linkKey(entry.company);
    n.rows.forEach(function (r) { if (linkKey(r.company) === ck) delete r.amounts[mk]; });
    (entry.people || []).forEach(function (p) {
      var r = n.rows.filter(function (x) { return linkKey(x.company) === ck && linkKey(x.name) === linkKey(p.name); })[0];
      if (!r) { r = { line: 0, name: p.name, company: entry.company, totalPre: 0, amounts: {} }; n.rows.push(r); }
      r.amounts[mk] = won(p.pre);
      if (taxOf(p.tax) === '8.8') r.tax = '8.8'; else delete r.tax;
    });
    var rows = manualRows(n.rows);
    return { months: manualMonths(rows, n.months.concat([{ key: mk, label: Number(mk.slice(5)) + '월' }])), rows: rows };
  }
  /* picks = [{monthKey, company}] — 그 달·그 사업장 입력을 뺀다 */
  function manualRemove(notice, picks) {
    var n = manualCopy(notice);
    (picks || []).forEach(function (p) { n.rows.forEach(function (r) { if (linkKey(r.company) === linkKey(p.company)) delete r.amounts[p.monthKey]; }); });
    var rows = manualRows(n.rows);
    return { months: manualMonths(rows, n.months), rows: rows };
  }
  /* 화면에 보일 입력 목록 — 달·사업장마다 한 줄(최근 달 위) */
  function manualEntries(notice) {
    var n = manualCopy(notice), by = {}, out = [];
    n.rows.forEach(function (r) {
      Object.keys(r.amounts).forEach(function (mk) {
        var k = mk + '|' + linkKey(r.company);
        if (!by[k]) { by[k] = { key: k, monthKey: mk, company: r.company, people: [] }; out.push(by[k]); }
        by[k].people.push({ name: r.name, pre: Number(r.amounts[mk]) || 0, tax: taxOf(r.tax) });
      });
    });
    return out.sort(function (a, b) { return a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : (a.company < b.company ? -1 : 1); });
  }

  /* ═══ 기존 % 끌어오기 — 대표 지시 2026-10-31 「퍼센트는 가급적 기존에 있던 퍼센트를 가지고 오도록」 ═══
     rules = {종류: {rates:{sid:%}, updatedAt}} — 그 사람이 «다른 컨설팅 종류»에 이미 가진 요율. 여럿이면 가장 많이 쓴 값,
     같으면 최근에 고친 규칙의 값. 없으면 null(이알피 성과%는 성과급용이라 쓰지 않는다 — 김혜민 15% vs 정산 25% 처럼 다르다). */
  function existingRate(rules, sid, exceptType) {
    var count = {}, latest = {};
    Object.keys(rules || {}).forEach(function (k) {
      var r = rules[k];
      if (!r || r._deleted || k === exceptType || !r.rates || r.rates[sid] == null || String(r.rates[sid]).trim() === '') return;
      var v = Number(String(r.rates[sid]).replace(/[%\s]/g, ''));
      if (!(v >= 0 && v <= 100)) return;
      count[v] = (count[v] || 0) + 1;
      latest[v] = Math.max(latest[v] || 0, Number(r.updatedAt) || 0);
    });
    var vs = Object.keys(count);
    if (!vs.length) return null;
    vs.sort(function (a, b) { return count[b] - count[a] || latest[b] - latest[a] || Number(b) - Number(a); });
    return Number(vs[0]);
  }

  /* ═══ 연도별 관리 — 대표 지시 2026-10-31 「매년 관리할 수 있게 해라」 ═══
     그 해(지급월 기준) 정산표에서 담당마다 반환·추가 지급 합계와 주관 순액(+ 받을 돈). 지운(_deleted) 정산표는 뺀다. */
  function yearOf(monthKey) { return String(monthKey || '').slice(0, 4); }
  function yearSummary(runs, year) {
    var by = {}, order = [], leads = {}, n = { runs: 0, draft: 0, confirmed: 0, manual: 0 };
    (runs || []).forEach(function (run) {
      if (!run || run._deleted || yearOf(run.monthKey) !== String(year)) return;
      n.runs++; n[run.status] = (n[run.status] || 0) + 1;
      toArr(run.sites).forEach(function (s) {
        var lead = toArr(s.members).filter(function (m) { return m.role === 'lead'; })[0];
        toArr(s.members).forEach(function (m) {
          if (m.role !== 'staff' || !m.sid || !m.settle) return;
          if (!by[m.sid]) { by[m.sid] = { sid: m.sid, name: m.name || '', back: 0, more: 0, sites: 0 }; order.push(m.sid); }
          var p = by[m.sid];
          p.sites++;
          if (m.settle < 0) p.back += -m.settle; else p.more += m.settle;
          if (lead && lead.sid) leads[lead.sid] = (leads[lead.sid] || 0) + (-m.settle);
        });
      });
    });
    return { year: String(year), counts: n, people: order.map(function (k) { return by[k]; }), leads: leads };
  }

  return {
    DEFAULT_HEAD: DEFAULT_HEAD, DEFAULT_FOOT: DEFAULT_FOOT,
    won: won, withholding: withholding, linkKey: linkKey, monthKeyOf: monthKeyOf, fmt: fmt,
    parseNotice: parseNotice, settleMonth: settleMonth, transfersOf: transfersOf, checkRun: checkRun,
    runId: runId, diffRun: diffRun, appliedAdjustIds: appliedAdjustIds, unapplyAdjusts: unapplyAdjusts,
    buildMessages: buildMessages, noticeHash: noticeHash, toArr: toArr, normalizeRun: normalizeRun, normalizeNotice: normalizeNotice,
    parseDepositText: parseDepositText, ledgerDeposits: ledgerDeposits, depositWindow: depositWindow, expectedFor: expectedFor, matchDeposits: matchDeposits,
    shareOf: shareOf, calcSite: calcSite, DIR_KO: DIR_KO, dirOf: dirOf,
    manualAdd: manualAdd, manualRemove: manualRemove, manualEntries: manualEntries,
    TAX_KO: TAX_KO, taxOf: taxOf, preFromNet: preFromNet, yearOf: yearOf, yearSummary: yearSummary, existingRate: existingRate
  };
});
