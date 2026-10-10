'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서류 관리(왼쪽 패널)·목차의 순수 함수 (브라우저 window.PuGovReportDocs / Node 겸용)
   (대표 지시 2026-10-10 「대시보드 왼쪽에 서류(페이퍼) 관리」 · 「환경설정 → 컨설팅관리 → 컨설팅 사업과 연계해 목차」
    · 설계 docs/superpowers/specs/2026-10-10-gov-report-docs-design.md · 계획 docs/superpowers/plans/2026-10-10-gov-report-docs.md)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 사업 목록·체크표·목차를 만들 뿐 아무 데도 쓰지 않는다.
     · 서류 틀은 ERP 사업 «이름»(공백 뺀)에 낱말이 들어 있는가로 고른다 — 코드(consulting-…)는 환경마다 다르다.
       DOC_PLANS 차례가 뜻이다: 좁은 낱말이 먼저(산업일자리전환컨설팅충남 → 산업일자리).
     · ①② 자동은 정부사업일정 보고서 창이 채우는 간단형 셋(AUTO)만 — 현황판 줄(buildRows)의 상태를 그대로 쓴다.
     · [확인 필요] 는 지어내지 않고 딱지로 보인다(현장클리닉 운영지침 · 농촌융복합 양식 글자 · 연결·계약 못 찾음).
     · 목차에는 업체 이름·담당 이름·날짜·서류 이름·상태만 — 연락처·금액·보고서 본문은 담지 않는다.
   ⚠ 업체×사업 쌍(pairs)은 pu-gov-report-list.js candidates 와 같은 조건이다(지운 업체 뺌 · 사전진단 뺀 회차 · 해 = 첫 회차).
     한쪽만 바꾸면 체크표와 목록이 다른 업체를 센다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var NO_AGENCY = '기관 미지정';
  var UNLINKED = '정부사업일정에 사업 없음';
  var NO_PLAN = '서류 틀 없음';
  var SOURCE = '컨설팅보고서_사업별_양식·항목_정리_2026-10-09.md §2';
  var AUTO = { 'cci-north': true, 'cci-seosan': true, techguard: true };
  var KIND_KO = { '간단': '간단형', '대형': '대형', '없음': NO_PLAN };
  var COLS = ['①초안', '②확정', '③서명본', '④별첨', '⑤제출'];
  /* gov-consulting.html CO_CORP_RE 의 줄인 꼴 — 이름 견주기에서 법인 표기를 뗀다 */
  var CORP_RE = /(주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|농업회사법인|영농조합법인|㈜|\(주\)|\(유\)|\(사\)|\(재\))/g;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function squash(v) { return str(v).replace(/\s+/g, ''); }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  function it(id, name, per, step) { return { id: id, name: name, per: per, step: step }; }

  var DOC_PLANS = [
    { key: 'industry-cn', words: ['산업일자리전환컨설팅충남'], kind: '대형', source: SOURCE, items: [
      it('log', '수행일지', 'once', 'plat'),
      it('monthly', '월별 수행실적보고서', 'month', 'report'),
      it('result', '결과보고서', 'once', 'report'),
      it('after', '사후관리 결과보고서', 'once', 'report')] },
    { key: 'cci-north', words: ['충남북부'], kind: '간단', source: SOURCE, items: [
      it('report', '결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'cci-seosan', words: ['서산'], kind: '간단', source: SOURCE, items: [
      it('visit', '방문확인서', 'round', 'report'),
      it('report', '상담·자문 결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'techguard', words: ['기술보호'], kind: '간단', source: SOURCE, items: [
      it('report', '별지11 완료보고서', 'once', 'report'),
      it('advice', '법률 자문 일지', 'round', 'attach'),
      it('pledge', '보안서약서', 'once', 'attach'),
      it('travel', '별지8 여비지급신청서', 'once', 'attach'),
      it('survey', '만족도조사', 'once', 'attach'),
      it('submit', '기관 제출(기술보호울타리)', 'once', 'submit')] },
    { key: 'clinic', words: ['현장클리닉'], kind: '간단', check: '운영지침', source: SOURCE, items: [
      it('log', '상담일지', 'round', 'report'),
      it('track', '별지24 성과추적관리결과서', 'once', 'report'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'rural', words: ['농촌융복합'], kind: '간단', check: '양식 글자', source: SOURCE, items: [
      it('plan', '사업계획서', 'once', 'report'),
      it('result', '결과보고서', 'round', 'report'),
      it('receipt', '수당 영수증·청렴서약서', 'once', 'attach'),
      it('photo', '현장 사진', 'once', 'attach')] },
    /* 이알피 이름이 「일터상생혁신컨설팅」이다(옛 「일터혁신상생컨설팅」은 숨김·합침) — 낱말 둘 다 본다 */
    { key: 'workplace', words: ['일터혁신', '일터상생혁신'], kind: '대형', source: SOURCE, items: [
      it('guide', '참여 안내서(서명)', 'once', 'sign'),
      it('plan', '수행계획서', 'once', 'plat'),
      it('round', '회차별 수행보고서+사진2장+서명지', 'round', 'plat'),
      it('kickoff', '착수보고', 'once', 'report'),
      it('mid', '중간보고', 'once', 'report'),
      it('final', '최종보고', 'once', 'report'),
      it('follow', '이행관리 등록', 'once', 'plat'),
      it('outcome', '이행결과표', 'once', 'report')] },
    { key: 'industry', words: ['산업일자리'], kind: '대형', source: SOURCE, items: [
      it('kickoff', '착수보고서(PPT)', 'once', 'report'),
      it('plan', '수행계획서', 'once', 'report'),
      it('mdlog', 'MD별 수행일지', 'round', 'report'),
      it('final', '최종결과보고서', 'once', 'report'),
      it('meeting', '최종보고회', 'once', 'report'),
      it('link', '연계지원사업 등록', 'once', 'plat'),
      it('done', '완료보고서(요약)', 'once', 'report')] },
  ];
  var NONE = { key: 'none', words: [], kind: '없음', source: '', items: [] };

  /* {u, v} 를 벗기고 배열·번호 객체를 다 받는다 — 객체가 아닌 것은 버린다 */
  function rowsOf(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined) v = v.v;
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && typeof x === 'object'; });
  }
  /* pu-gov-report-list.js list 와 같다 — id 가 있는 것만 */
  function list(v) {
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && x.id; });
  }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  /* pu-gov-report-list.js coAtts 와 같은 차례(gov-consulting getCoAtts) */
  function coAtts(o) {
    if (!o) return [];
    if (Array.isArray(o.coAttIds)) return o.coAttIds.filter(Boolean);
    if (Array.isArray(o.defCoAtts)) return o.defCoAtts.filter(Boolean);
    if (o.coAttId) return [o.coAttId];
    if (o.defCoAtt) return [o.defCoAtt];
    return [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function order(t) { return (t.sortOrder != null && t.sortOrder !== '' && isFinite(+t.sortOrder)) ? +t.sortOrder : Infinity; }
  function byOrder(a, b) {
    var x = order(a), y = order(b);
    if (x !== y) return x < y ? -1 : 1;
    return str(a.name).localeCompare(str(b.name), 'ko');
  }

  function visibleTypes(biz) {
    return rowsOf(biz).filter(function (t) { return str(t.code) && str(t.name) && !t.hidden && !str(t.mergedInto); })
      .map(function (t) { return { code: str(t.code), name: str(t.name), short: str(t.short), agency: str(t.agency), sortOrder: order(t) }; })
      .sort(byOrder);
  }
  function groupByAgency(types) {
    var out = [], at = {};
    (types || []).slice().sort(byOrder).forEach(function (t) {
      var a = str(t.agency) || NO_AGENCY;
      if (!(a in at)) { at[a] = out.length; out.push({ agency: a, types: [] }); }
      out[at[a]].types.push(t);
    });
    return out;
  }
  function planFor(name) {
    var n = squash(name);
    if (!n) return NONE;
    for (var i = 0; i < DOC_PLANS.length; i++) {
      var p = DOC_PLANS[i];
      if (p.words.some(function (w) { return n.indexOf(w) >= 0; })) return p;
    }
    return NONE;
  }
  function linkOf(code, tmap, scalTypes) {
    var id = str(tmap && typeof tmap === 'object' ? tmap[code] : '');
    if (!id) return '';
    return list(scalTypes).some(function (t) { return t.id === id; }) ? id : '';
  }

  function pairs(input, typeId, year) {
    input = input || {};
    var t = list(input.types).filter(function (x) { return x.id === typeId; })[0];
    if (!t) return [];
    var names = {};
    list(input.staff).forEach(function (s) { names[s.id] = str(s.name); });
    var sc = list(input.scheds).filter(function (s) { return s.typeId === typeId && s.phase !== 'pre' && isDay(s.date); });
    var out = [];
    list(input.cos).forEach(function (co) {
      if (co.deleted || !(Array.isArray(co.types) && co.types.indexOf(typeId) >= 0)) return;
      var ds = sc.filter(function (s) { return s.coId === co.id; }).map(function (s) { return str(s.date); }).sort();
      if (!ds.length) return;
      var y = ds[0].slice(0, 4);
      if (year && y !== String(year)) return;
      var cr = co.customRounds && co.customRounds[typeId];
      var planned = (cr !== undefined && cr !== null && cr !== '') ? (+cr || 0) : (+t.rounds || 0);
      var attIds = uniq([str(co.defAtt)].concat(coAtts(co)));
      out.push({ coId: co.id, coName: str(co.name), co: co, typeId: typeId, typeName: str(t.fullName) || str(t.name),
        year: y, rid: String(typeId) + '_' + y, rounds: ds.length, planned: planned, firstDate: ds[0], lastDate: ds[ds.length - 1],
        attNames: attIds.map(function (id) { return names[id] || ''; }).filter(Boolean) });
    });
    return out.sort(function (a, b) { return a.coName.localeCompare(b.coName, 'ko'); });
  }

  function sidebarGroups(biz, tmap, input, year) {
    var linked = [], unlinked = [];
    visibleTypes(biz).forEach(function (t) {
      var p = planFor(t.name), id = linkOf(t.code, tmap, (input || {}).types);
      var item = { code: t.code, name: t.name, short: t.short, agency: t.agency, sortOrder: t.sortOrder,
        plan: p.key, kind: p.kind, typeId: id, count: id ? pairs(input, id, year).length : 0 };
      (id ? linked : unlinked).push(item);
    });
    var g = groupByAgency(linked);
    if (unlinked.length) g.push({ agency: UNLINKED, unlinked: true, types: unlinked });
    return g;
  }
  function erpTypeFor(typeId, biz, tmap) {
    if (!typeId || !tmap || typeof tmap !== 'object') return null;
    return visibleTypes(biz).filter(function (t) { return str(tmap[t.code]) === typeId; })[0] || null;
  }

  function coKey(s) { return str(s).replace(CORP_RE, '').replace(/[\s·,.\-_'"()（）]/g, '').toLowerCase(); }
  /* gov-consulting.html erpConsCode 와 같은 차례 — 코드 칸 → 사업 이름(이름·줄인 이름) */
  function enSquash(v) { return str(v).replace(/[\s()（）·,]/g, ''); }
  function consCode(c, biz) {
    c = c || {};
    var tc = c.typeCodes || {};
    var code = str(tc.consulting || tc.consult || c.typeCode);
    if (code) return code;
    var nm = enSquash(c.consultingType || c.programName || c.type);
    if (!nm) return '';
    var t = rowsOf(biz).filter(function (x) { return enSquash(x.name) === nm || enSquash(x.short) === nm; })[0];
    return t ? str(t.code) : ('name:' + nm);
  }
  /* 이 업체·이 사업의 이알피 계약 — 업체는 erpId → 사업자번호 → 이름, 사업은 코드 → 이음표. 여럿이면 늦게 시작한 것 */
  function consFor(o) {
    o = o || {};
    var co = o.co || {}, bn = digits(co.bizNo), ck = coKey(co.name), tm = o.tmap || {};
    var mine = rowsOf(o.consultings).filter(function (c) {
      if (c && c._deleted === true) return false;
      if (str(co.erpId) && str(c.id) === str(co.erpId)) return true;
      var cc = (c.company && typeof c.company === 'object') ? c.company : {};
      var cb = digits(cc.bizNo || c.bizNo);
      if (bn && cb) return bn === cb;
      return !!ck && coKey(cc.name || c.companyName) === ck;
    });
    var hit = mine.filter(function (c) { return !!o.code && consCode(c, o.biz) === o.code; });
    if (!hit.length) hit = mine.filter(function (c) { var k = consCode(c, o.biz); return !!k && !!o.typeId && str(tm[k]) === str(o.typeId); });
    hit.sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); });
    return hit[0] || null;
  }
  function sidName(dir, sid) {
    var k = str(sid);
    if (!k) return '';
    var u = rowsOf(dir).filter(function (x) { return str(x.sid) === k || str(x.id) === k || str(x.empNo) === k; })[0];
    return u ? str(u.name || u.userName) : '';
  }
  function months(from, to) {
    var a = /^(\d{4})-(\d{2})/.exec(str(from)), b = /^(\d{4})-(\d{2})/.exec(str(to));
    if (!a || !b) return [];
    var y = +a[1], m = +a[2], end = (+b[1]) * 12 + (+b[2]), out = [];
    while (y * 12 + m <= end && out.length < 36) {
      out.push(y + '-' + (m < 10 ? '0' : '') + m);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  function range(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i + '회차'); return a; }

  var DASH = { txt: '—', key: '' };
  function chips(r) {
    var out = [DASH, DASH, DASH, DASH, DASH];
    if (!r || !r.st) return out;
    if (r.st.key === 'done') { out[0] = { txt: '✓', key: 'done' }; out[1] = { txt: r.st.label, key: 'done' }; }
    else out[0] = { txt: r.st.label, key: r.st.key };
    return out;
  }
  function docsTable(o) {
    o = o || {};
    var erp = o.erp || null, plan = planFor(erp ? erp.name : ''), auto = !!AUTO[plan.key];
    var byCo = {};
    (o.rows || []).forEach(function (r) { if (r && r.typeId === o.typeId) byCo[r.coId + '|' + r.year] = r; });
    var lines = o.typeId ? pairs(o.input, o.typeId, o.year).map(function (p) {
      var r = byCo[p.coId + '|' + p.year] || null;
      var cons = consFor({ consultings: o.consultings, co: p.co, code: erp ? erp.code : '', typeId: o.typeId, tmap: o.tmap, biz: o.biz });
      return { coId: p.coId, coName: p.coName, typeId: p.typeId, year: p.year, rounds: p.rounds,
        cells: auto ? chips(r) : null, due: cons ? str(cons.endDate).slice(0, 10) : '' };
    }) : [];
    return { plan: plan, auto: auto, cols: COLS.slice(), lines: lines };
  }

  function tocFor(o) {
    o = o || {};
    var p = o.pair || {}, erp = o.erp || null, cons = o.cons || null, r = o.row || null;
    var plan = planFor(erp ? erp.name : p.typeName), auto = !!AUTO[plan.key];
    var warn = [];
    if (!erp) warn.push('[확인 필요] 푸른이알피 사업 연결 없음');
    if (!cons) warn.push('[확인 필요] 푸른이알피 계약 못 찾음');
    var s = str(cons && cons.startDate).slice(0, 10), e = str(cons && cons.endDate).slice(0, 10);
    var period = (s || e) ? (s || '?') + ' ~ ' + (e || '?')
      : (p.firstDate ? p.firstDate + ' ~ ' + p.lastDate + ' (회차 날짜)' : '');
    var n = Math.max(+p.rounds || 0, +p.planned || 0);
    var check = plan.check ? '[확인 필요: ' + plan.check + ']' : '';
    var items = plan.items.map(function (x, i) {
      var subs = x.per === 'round' ? range(n) : (x.per === 'month' ? months(s || p.firstDate, e || p.lastDate) : []);
      var chip = (auto && x.step === 'report' && r && r.st) ? { txt: r.st.label, key: r.st.key } : { txt: '—', key: '' };
      return { no: i + 1, id: x.id, name: x.name, per: x.per, step: x.step, subs: subs, chip: chip, check: check };
    });
    return { head: { coName: str(p.coName), bizName: erp ? erp.name : str(p.typeName), agency: erp ? (erp.agency || NO_AGENCY) : '',
        period: period, manager: sidName(o.dir, cons && cons.managerMain) || (p.attNames || []).join('·'), rounds: n,
        plan: plan.key, kind: plan.kind, warn: warn },
      items: items };
  }
  function tocText(toc) {
    toc = toc || {};
    var h = toc.head || {}, items = toc.items || [];
    var out = ['목차 — ' + str(h.coName),
      '사업: ' + str(h.bizName) + (h.agency ? ' (' + h.agency + ')' : '') + ' · ' + (KIND_KO[h.kind] || NO_PLAN),
      '계약 기간: ' + (h.period || '—') + ' · 담당: ' + (h.manager || '—') + ' · 회차 ' + (h.rounds || 0)];
    (h.warn || []).forEach(function (w) { out.push(w); });
    if (!items.length) out.push(NO_PLAN + ' — 목차는 머리말만');
    items.forEach(function (x) {
      out.push(x.no + '. ' + x.name + ' (' + x.chip.txt + ')' + (x.check ? ' ' + x.check : ''));
      x.subs.forEach(function (s) { out.push('   - ' + s); });
    });
    return out.join('\n');
  }

  var api = { rowsOf: rowsOf, visibleTypes: visibleTypes, groupByAgency: groupByAgency, planFor: planFor, linkOf: linkOf,
    pairs: pairs, sidebarGroups: sidebarGroups, erpTypeFor: erpTypeFor, coKey: coKey, consCode: consCode, consFor: consFor,
    sidName: sidName, months: months, docsTable: docsTable, tocFor: tocFor, tocText: tocText,
    DOC_PLANS: DOC_PLANS, NONE: NONE, AUTO: AUTO, KIND_KO: KIND_KO, COLS: COLS,
    NO_AGENCY: NO_AGENCY, UNLINKED: UNLINKED, NO_PLAN: NO_PLAN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportDocs = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
