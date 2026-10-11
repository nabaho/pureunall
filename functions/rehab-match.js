/* rehab-match.js — 회생광고: 법원 공고의 회사가 «우리 쪽 자료»에 이미 있는지 알아본다 (2026-10-10).
   대표 지시 「푸른노무법인과 계약했거나 연결되어 있는 사업장은 표시 · 기업정보함에 내용이 있으면 찾아서 메일로 서류를 보내는 것으로」.

   ■ 읽는 곳(읽기만 한다 — 아무것도 고치지 않는다)
       푸른이알피 업체관리  data/companies/v   (업체 · 상태 · 대표자 · 메일)
       푸른이알피 계약관리  data/contracts/v   (계약 · 상태 · 종료일)
       기업정보함 색인      pucards/idx        (사업자등록증 biz · 명함 card — 회사명·대표자·메일)
   ■ 법원 공고에는 «사업자번호가 없다». 그래서 이름으로 «후보»를 찾는다.
       strong  이름이 같고 «시·군·구»까지 같다      → 같은 회사로 본다(화면은 「확인됨」)
       weak    이름만 같다(주소가 없거나 다르다)    → 「후보」 — 사람이 보고 판단한다
     ⚠ 이름으로 추정한 관계는 «저장하지 않는다»(온톨로지 규칙: 이름으로 추정한 관계는 사람이 원본 ID 를 확정하기 전까지 저장 대상이 아니다).
       이 모듈은 화면에 «그때그때 계산해 보여 줄 뿐»이다.
   ■ 이메일은 «연락처가 있다는 사실»이다 — 보내도 된다는 뜻이 아니다.
       거래 관계(계약·업체관리)가 있는 곳과 명함만 있는 곳은 다르다(정보통신망법 제50조 사전 동의). 그래서 출처를 함께 돌려준다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RehabMatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 푸른이알피 isActiveContract 와 같은 목록 — pu-erp.html ACTIVE_CONTRACT_STATUS */
  var ACTIVE_CONTRACT = ['consult', 'review', 'negotiate', 'confirmed', 'signed', 'progress', 'active'];
  var CLOSED_STATUS = ['closed', 'cancelled', 'transferred', 'terminated', 'expired'];

  function clean(v) { return v == null ? '' : String(v).trim(); }
  /* 비교용 이름 — (주)·주식회사·유한회사·법인 종류·띄어쓰기·점 따위를 걷는다 */
  function norm(s) {
    return clean(s).toLowerCase()
      .replace(/\((주|유|사|재|합)\)|㈜|㈔/g, '')
      .replace(/주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|의료법인|사회복지법인|협동조합|농업회사법인|영농조합법인/g, '')
      .replace(/[\s.,·\-_'"“”‘’()\[\]]/g, '');
  }
  /* 「서울특별시 서초구」와 「서울 서초구」를 같게 — 도·광역시를 빼고 시·군·구 이름 하나 */
  function addrKey(address) {
    var toks = clean(address).match(/[가-힣]{1,6}(?:특별자치시|특별시|광역시|특별자치도|도|시|군|구)(?=[\s,]|$)/g) || [];
    for (var i = 0; i < toks.length; i++) if (!/(특별자치시|특별시|광역시|특별자치도|도)$/.test(toks[i])) return toks[i];
    return '';
  }
  function sameRegion(a, b) {
    var ka = addrKey(a), kb = addrKey(b);
    return !!ka && !!kb && ka === kb;
  }
  function envelope(v) {                     // 푸른이알피 봉투 {v: …} 를 벗긴다
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'v')) v = v.v;
    if (Array.isArray(v)) return v;
    return v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : [];
  }
  function emails(list) {
    var out = [];
    (list || []).forEach(function (e) { e = clean(e).toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && out.indexOf(e) < 0) out.push(e); });
    return out;
  }
  function today() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }

  /* ── 색인 만들기 ── 세 자료를 «이름 → 항목들»로 한 번에 묶는다 */
  function buildIndex(src) {
    src = src || {};
    var byName = {}, count = { erp: 0, contract: 0, biz: 0, card: 0 };
    var now = today();
    function put(e) {
      var k = norm(e.name);
      if (k.length < 2) return;
      (byName[k] || (byName[k] = [])).push(e);
      count[e.src]++;
    }
    envelope(src.erpCompanies).forEach(function (c) {
      if (!c || c._deleted) return;
      var st = clean(c.status).toLowerCase();
      var closed = CLOSED_STATUS.indexOf(st) >= 0 || !!(c.closedDate || c.closedAt || c.permanentArchived || c.archived);
      put({ src: 'erp', id: clean(c.id), name: clean(c.name), bizNo: clean(c.bizNo), address: clean(c.address), ceo: clean(c.ceo),
        status: st || 'active', closed: closed, active: !closed,
        emails: emails([c.email, c.primaryContactEmail]), contact: clean(c.primaryContactName), tel: clean(c.phone) });
    });
    envelope(src.erpContracts).forEach(function (c) {
      if (!c || c._deleted) return;
      var st = clean(c.status).toLowerCase();
      var end = clean(c.endDate || c.contractEndDate);
      var ended = !!(c.closedAt || c.closedDate) || (end && end < now) || CLOSED_STATUS.indexOf(st) >= 0;
      put({ src: 'contract', id: clean(c.id || c.contractNo), name: clean(c.companyName), bizNo: clean(c.bizNo), address: '', ceo: '',
        status: st, closed: ended, active: !ended && (!st || ACTIVE_CONTRACT.indexOf(st) >= 0),
        kinds: [].concat(c.kinds || c.kind || []), emails: [], contactNo: clean(c.contractNo) });
    });
    var idx = src.cardsIdx || {};
    Object.keys(idx).forEach(function (id) {
      var r = idx[id];
      if (!r || !r.c) return;
      var em = emails([r.e, r.tie].concat(r.em || []));
      if (r.k === 'biz') put({ src: 'biz', id: id, name: clean(r.c), bizNo: clean(r.bz), address: clean(r.ad), ceo: clean(r.ceo), emails: em, tel: clean(r.ct) });
      else put({ src: 'card', id: id, name: clean(r.c), bizNo: '', address: clean(r.ad), ceo: '', emails: em, person: clean(r.n), title: clean(r.ti), tel: clean(r.m || r.t) });
    });
    return { byName: byName, count: count };
  }

  /* ── 공고 회사 하나 → 우리 쪽 자료와의 관계 ── */
  function matchNotice(notice, index) {
    var out = { level: 'none', client: null, contract: null, biz: 0, cards: 0, ceo: '', emails: [], hits: [] };
    var key = norm(notice && notice.debtorName);
    var hits = key.length >= 2 && index && index.byName ? (index.byName[key] || []) : [];
    if (!hits.length) return out;
    var strong = false;
    hits.forEach(function (h) {
      /* 주소가 있는 항목은 시·군·구까지 같아야 «확인됨». 주소가 없는 항목(계약)은 이름만으로는 «후보»다. */
      var sr = h.address ? sameRegion(h.address, notice.address) : false;
      if (sr) strong = true;
      out.hits.push({ src: h.src, id: h.id, name: h.name, address: h.address, strong: sr, active: !!h.active, closed: !!h.closed, status: h.status || '', ceo: h.ceo || '', person: h.person || '', title: h.title || '' });
    });
    /* 같은 이름의 계약·업체가 있고, 주소가 있는 다른 항목 중 하나라도 같은 곳이면 이름이 같은 «계약»도 같은 회사로 본다 */
    var erp = hits.filter(function (h) { return h.src === 'erp'; });
    var con = hits.filter(function (h) { return h.src === 'contract'; });
    var strongErp = erp.filter(function (h) { return sameRegion(h.address, notice.address); });
    var activeErp = (strongErp.length ? strongErp : erp).filter(function (h) { return h.active; })[0];
    var activeCon = con.filter(function (h) { return h.active; })[0];
    if (activeErp) out.client = { name: activeErp.name, status: activeErp.status, strong: strongErp.indexOf(activeErp) >= 0 };
    else if (erp.length) out.client = { name: erp[0].name, status: 'closed', strong: strongErp.length > 0, ended: true };
    if (activeCon) out.contract = { count: con.filter(function (h) { return h.active; }).length, kinds: activeCon.kinds || [], strong: strong };
    else if (con.length) out.contract = { count: 0, ended: true, strong: strong };
    out.biz = hits.filter(function (h) { return h.src === 'biz'; }).length;
    out.cards = hits.filter(function (h) { return h.src === 'card'; }).length;
    out.level = strong ? 'strong' : 'weak';
    /* 대표자 — 사업자등록증(biz) → 이알피 순 */
    var withCeo = hits.filter(function (h) { return h.ceo; }).sort(function (a, b) { return (a.src === 'biz' ? 0 : 1) - (b.src === 'biz' ? 0 : 1); })[0];
    if (withCeo) out.ceo = withCeo.ceo;
    /* 메일 — 어디서 왔는지(거래·사업자등록증·명함)를 함께 */
    var seen = {};
    hits.forEach(function (h) {
      (h.emails || []).forEach(function (e) {
        if (seen[e]) return; seen[e] = 1;
        out.emails.push({ email: e, src: h.src, who: h.person ? h.person + (h.title ? ' ' + h.title : '') : (h.contact || ''), trade: h.src === 'erp' || h.src === 'contract' });
      });
    });
    /* 거래 관계가 있는 곳의 메일을 앞에 */
    out.emails.sort(function (a, b) { return (b.trade ? 1 : 0) - (a.trade ? 1 : 0); });
    return out;
  }

  /* 표에 붙일 «한 단어» — 계약중 / 거래종료 / 기업정보함 / 후보 */
  function badge(m) {
    if (!m || m.level === 'none') return null;
    var live = (m.client && !m.client.ended) || (m.contract && m.contract.count > 0);
    if (live) return { kind: 'client', text: m.level === 'strong' ? '계약·거래중' : '거래중 후보', strong: m.level === 'strong' };
    if ((m.client && m.client.ended) || (m.contract && m.contract.ended)) return { kind: 'past', text: '거래 종료', strong: m.level === 'strong' };
    if (m.biz || m.cards) return { kind: 'cards', text: '기업정보함', strong: m.level === 'strong' };
    return { kind: 'weak', text: '후보', strong: false };
  }

  return { norm: norm, addrKey: addrKey, sameRegion: sameRegion, envelope: envelope, buildIndex: buildIndex, matchNotice: matchNotice, badge: badge,
    ACTIVE_CONTRACT: ACTIVE_CONTRACT };
});
