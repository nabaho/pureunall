'use strict';
/* 정부사업 바로가기(gov-links.html) — 순수 함수 (브라우저 window.PuGovLinks / Node 겸용)
   (대표 지시 2026-11-28 「정부 지원 사업 바로 가기 앱을 하나 만들어줘 … 지금 진행하고 있는 모든 사업들, 기업 연결 …
    나중에 더 늘 수도 있고 빠질 수도 있는데 … 그 사업 바로 사업 보고나 시스템 들어갈 수 있게」)

   무엇을 하나
     · 바로가기 묶음(카드) 하나 = 사업 하나의 «기관 시스템 주소들 + 할 일 메모 + 이 PC 폴더 경로».
       저장 자리는 govlinks/sets/{id} (entityType 'GovLinkSet') — 재직 직원이 읽고 고친다(규칙 govlinks).
     · 묶음은 이알피 컨설팅 사업(data/biz_cons_types 의 code)과 «사람이 골라» 이어 둘 수 있다(bizCodes).
       이어 두면 그 사업의 올해 업체(정부사업일정 scal_cos·scal_scheds)가 카드에 붙고, 업체를 누르면
       정부사업일정의 그 업체 보고서 창(gov-consulting.html#rpt=업체|사업)으로 건너간다.
     · 이알피에서 진행 중인 사업인데 묶음이 없으면 «바로가기 없는 진행 사업»으로 따로 보인다 — 새 사업이 생기면 저절로 나타난다.
       묶음이 이어진 사업이 모두 종결(scal_bizState)이면 그 카드는 «종결된 사업»으로 내려간다 — 빠지는 것도 저절로.

   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 목록 모델을 만들 뿐 아무 데도 쓰지 않고 받은 값을 바꾸지 않는다.
     · 주소는 http(s) 만 받는다(safeUrl) — javascript:·data:·file: 주소는 저장도, 그리기도 안 한다.
       직원 누구나 고칠 수 있는 목록이라, 남이 넣은 «누르면 스크립트가 도는 주소»가 대표 화면에서 눌리면 안 된다.
     · 이름이 비슷하다고 사업을 «저장하며» 잇지 않는다(온톨로지 — 이름으로 추정한 관계는 저장하지 않는다).
       기본 묶음의 낱말(match)로 «연결 제안»만 보이고, 사람이 눌러야 bizCodes 에 들어간다.
     · 업체×사업 쌍은 PuGovReportDocs.pairs 를 그대로 부른다 — 컨설팅보고서 현황판과 같은 업체를 센다.
     · 아이디·비밀번호는 담지 않는다(칸이 없다).
   ⚠ 저장소는 공개다 — 기본 목록에는 기관 공개 주소·사업 폴더 이름만 둔다(고객사 이름 금지). 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Docs = isNode ? require('./pu-gov-report-docs.js') : root.PuGovReportDocs;
  var Nav = isNode ? require('./pu-gov-report-nav.js') : root.PuGovReportNav;

  var ROOT = 'govlinks';
  var SETS = 'sets';
  var ENTITY = 'GovLinkSet';
  var LIMIT = { title: 60, org: 80, note: 300, linkName: 80, url: 600, folder: 260, links: 30, folders: 10, biz: 10 };
  var CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
  function badKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }

  /* 기본 목록 — 바탕화면 「정부지원사업_바로가기.html」(에고라이트 북마크 «컨설팅 기관등» 2026-11-11 기준, 22곳)을 옮겼다.
     폴더는 대표 PC 의 바탕화면\컨설팅업체 아래 사업 폴더 이름이다(고객사 폴더는 넣지 않는다).
     match = 이알피 사업 이름(공백 뺀)에 이 낱말이 들어 있으면 «연결 제안»을 보인다 — 저장하지 않는다. */
  /* 카드에서 건너갈 «푸른 앱» — 정해 둔 것만(주소를 사람이 적지 않는다). 열쇠는 포털 enter.html APPS 의 key 와 같다.
     ⚠ 권한은 그 앱이 스스로 잠근다(컨설팅정산 = 재무권한 등) — 여기 있다고 열리는 것이 아니다. */
  var INNER = {
    consult: { name: '정부사업일정', icon: '📅', url: 'gov-consulting.html' },
    govreport: { name: '컨설팅보고서', icon: '📑', url: 'gov-report.html' },
    ilteo: { name: '일터상생혁신', icon: '🏭', url: 'ilteo.html' },
    jobtrans: { name: '산업일자리전환', icon: '⚡', url: 'jobtrans.html' },
    safety: { name: '안전보건체계구축', icon: '🦺', url: 'safety.html' },
    /* 컨설팅 전용 앱 12종(2026-11-28 PR #3312) — 사업마다 보고서·자동화 화면 */
    clinic: { name: '현장클리닉', icon: '🩺', url: 'clinic.html' },
    techprotect: { name: '기술보호컨설팅', icon: '🔐', url: 'techprotect.html' },
    chamber: { name: '상공회의소컨설팅', icon: '🏬', url: 'chamber.html' },
    hrconsult: { name: '기초인사노무', icon: '🗂️', url: 'hrconsult.html' },
    evalcomp: { name: '평가보상·임금체계', icon: '📈', url: 'evalcomp.html' },
    pubconsult: { name: '공공기관컨설팅', icon: '🏤', url: 'pubconsult.html' },
    familywork: { name: '출산육아·유연근무', icon: '🏡', url: 'familywork.html' },
    socialent: { name: '사회적기업·씨앗', icon: '🌱', url: 'socialent.html' },
    sixthind: { name: '6차산업컨설팅', icon: '🌾', url: 'sixthind.html' },
    laboraudit: { name: '자율점검·근로감독', icon: '🧭', url: 'laboraudit.html' },
    unionneg: { name: '민간노조·단체교섭', icon: '🫂', url: 'unionneg.html' },
    specialcons: { name: '특화·위탁컨설팅', icon: '🧩', url: 'specialcons.html' },
    govaid: { name: '기업정부지원금', icon: '🎯', url: 'pu-govaid.html' },
    govbid: { name: '정부사업신청', icon: '🏛', url: 'gov.html' },
    settle: { name: '컨설팅정산', icon: '🧾', url: 'pu-settle.html' },
    photos: { name: '사진첩', icon: '🖼️', url: 'pu-photos.html' }
  };
  var INNER_KEYS = Object.keys(INNER);
  var BASE = 'C:\\Users\\user\\Desktop\\컨설팅업체\\';
  var DEFAULTS = [
    { id: 'gl-jobtrans', title: '구조혁신 · 산업일자리전환 컨설팅', org: '중소벤처기업진흥공단',
      note: '착수보고서 → 수행계획서 → MD별 수행일지 → 최종결과보고서 → 완료보고서(요약), 모두 중진공 플랫폼',
      match: ['구조혁신', '산업일자리', '일자리전환'], folders: [BASE + '4. 구조혁신컨설팅(일자리전환)'], apps: ['jobtrans'],
      links: [
        { name: '산업일자리전환플랫폼 (컨설턴트 로그인)', url: 'https://www.kosmes.or.kr/3t/mgr/loginForm?', login: true },
        { name: '구조혁신 지원사업', url: 'https://www.kosmes.or.kr/3t/portal/Main' },
        { name: '중소벤처기업진흥공단 홈페이지', url: 'https://www.kosmes.or.kr/nsh/map/main.do' }] },
    { id: 'gl-ilteo', title: '일터혁신 상생컨설팅', org: '노사발전재단',
      note: '수행계획서, 회차별 수행보고서(사진·서명지), 이행관리를 일터혁신 플랫폼에 등록',
      match: ['일터혁신', '일터상생'], folders: [BASE + '0. 일터혁신'], apps: ['ilteo'],
      links: [
        { name: '일터혁신플랫폼 (사용자 메인)', url: 'https://www.kwpi.or.kr/user/main/index', login: true },
        { name: '일터혁신플랫폼 (홈)', url: 'https://www.kwpi.or.kr/home/main' }] },
    { id: 'gl-bizsup', title: '비즈니스지원단 · 현장클리닉', org: '중소벤처기업부',
      note: '시스템의 「현장클리닉(법률자문) 상담신청 및 현황」에서 상담일지 작성',
      match: ['현장클리닉', '비즈니스지원단', '비지니스지원단'], folders: [BASE + '3. 비지니스지원단 계획서', BASE + '_작업_현장클리닉'], apps: ['clinic'],
      links: [{ name: '중소벤처기업부 비즈니스지원단', url: 'https://www.smes.go.kr/bizlink', login: true }] },
    { id: 'gl-techguard', title: '기술보호 컨설팅', org: '대·중소기업·농어업협력재단',
      note: '별지11 완료보고서·자문일지 등은 기술보호울타리 시스템으로 제출',
      match: ['기술보호'], folders: [BASE + '5. 기술보호컨설팅(대중소협력재단)'], apps: ['techprotect'],
      links: [{ name: '기술보호울타리', url: 'https://www.ultari.go.kr/portal/ptm/main.do', login: true }] },
    { id: 'gl-voucher', title: '혁신바우처', org: '', note: '',
      match: ['혁신바우처'], folders: [BASE + '7. 혁신바우처 사전교육용(컨설팅 분야)'], apps: ['specialcons'],
      links: [{ name: '혁신플랫폼', url: 'https://www.mssmiv.com/portal/Main' }] },
    { id: 'gl-sbiz', title: '소상공인 컨설팅', org: '소상공인시장진흥공단', note: '',
      match: ['소상공인'], folders: [BASE + '소상공인컨설팅_관련서식'],
      links: [
        { name: '소상공인컨설팅 관리 (컨설턴트용)', url: 'https://mgr.sbiz.or.kr/cm/main.do', login: true },
        { name: '소상공인마당 - 컨설팅', url: 'https://www.sbiz.or.kr/cot/main.do' },
        { name: '소상공인24', url: 'https://www.sbiz24.kr/#/' }] },
    { id: 'gl-chungnam', title: '충남 지역 사업', org: '충남경제진흥원 · 충남농업6차산업센터 · 충남사회적경제지원센터', note: '',
      match: [], folders: [], apps: ['sixthind', 'socialent'],
      links: [
        { name: '충남경제진흥원', url: 'https://www.cepa.or.kr/main/main.do' },
        { name: '충남농업6차산업센터', url: 'https://www.xn--6-6v7en42by2es7i6jc.com/' },
        { name: '충남농업6차산업센터 관리자 로그인', url: 'https://www.xn--6-6v7en42by2es7i6jc.com/manage/login.do', login: true },
        { name: '충남사회적경제지원센터', url: 'https://www.cnse.kr/app/main/index' }] },
    { id: 'gl-safety', title: '안전보건 · 인력개발', org: '', note: '',
      match: ['안전보건'], folders: [BASE + '9 안전보건컨설팅'], apps: ['safety'],
      links: [
        { name: 'K2B (안전보건공단)', url: 'https://k2b.kosha.or.kr/index.do' },
        { name: 'HRD4U', url: 'https://www.hrd4u.or.kr/hrd4u' },
        { name: 'NCS Manager', url: 'https://mgt.ncs.go.kr/NCS_MGT/launch.html?screenid=OutDesktop_screen' }] },
    { id: 'gl-etc', title: '기타 기관', org: '', note: '',
      match: [], folders: [],
      links: [
        { name: '사회적기업 포털', url: 'https://www.seis.or.kr/home/main.do' },
        { name: '재도전종합지원센터', url: 'https://www.rechallenge.or.kr/index.9is' },
        { name: '범부처통합연구지원시스템 (IRIS)', url: 'https://www.iris.go.kr/index.do' },
        { name: '장애인식개선 이러닝센터', url: 'https://www.able-edu.or.kr/elearning/' }] }
  ];
  var DEFAULT_BY_ID = {};
  DEFAULTS.forEach(function (d) { DEFAULT_BY_ID[d.id] = d; });

  function str(v) { return v == null ? '' : String(v).trim(); }
  function cut(v, n) { return str(v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n).trim(); }
  function squash(v) { return str(v).replace(/\s+/g, ''); }
  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function rows(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; });
    return [];
  }
  function okCode(c) { return typeof c === 'string' && CODE_RE.test(c) && !badKey(c); }
  function okId(c) { return typeof c === 'string' && ID_RE.test(c) && !badKey(c); }

  /* 주소 — http(s) 만. 앞에 이름(www.…)만 적었으면 https:// 를 붙인다. 못 쓰는 주소는 '' */
  function safeUrl(v) {
    var s = str(v);
    if (!s || s.length > LIMIT.url || /[\s\u0000-\u001f\u007f<>"'`\\]/.test(s)) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      if (!/^[^/?#:@]+\.[^/?#:@]+/.test(s)) return '';
      s = 'https://' + s;
    }
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (!u.hostname || u.username || u.password) return '';
    } catch (e) { return ''; }
    return s;
  }
  /* 보일 주소 이름 — www. 를 떼고, 한글 주소(xn--)는 «한글 주소» 로 */
  function hostOf(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, '');
      return /(^|\.)xn--/.test(h) ? '한글 주소' : h;
    } catch (e) { return ''; }
  }
  /* 폴더 경로의 마지막 이름 — 보이는 글. 전체 경로는 «경로 복사»가 옮긴다 */
  function folderName(p) {
    var s = str(p).replace(/[\\/]+$/, '');
    var i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
    return i >= 0 ? s.slice(i + 1) : s;
  }

  /* 화면·저장소 어느 쪽에서 온 값이든 «묶음 모양»으로 다듬는다 — 저장 직전과 그리기 직전 둘 다 부른다.
     돌려주는 것: { ok, value, errors[] } — 제목이 없거나 id 가 이상하면 ok=false */
  function cleanSet(raw) {
    raw = raw || {};
    var errors = [];
    var id = str(raw.id);
    if (!okId(id)) errors.push('묶음 번호가 올바르지 않습니다');
    var title = cut(raw.title, LIMIT.title);
    if (!title) errors.push('사업(묶음) 이름을 적어 주세요');
    var links = [], badUrl = 0;
    rows(raw.links).forEach(function (l) {
      if (!l || typeof l !== 'object' || links.length >= LIMIT.links) return;
      var url = safeUrl(l.url), name = cut(l.name, LIMIT.linkName);
      if (!str(l.url) && !name) return;            // 빈 줄은 조용히 버린다
      if (!url) { badUrl++; return; }
      links.push({ name: name || hostOf(url) || url, url: url, login: l.login === true });
    });
    if (badUrl) errors.push('쓸 수 없는 주소 ' + badUrl + '개 — http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다');
    var folders = [];
    rows(raw.folders).forEach(function (f) {
      var p = cut(f, LIMIT.folder);
      if (p && folders.length < LIMIT.folders && folders.indexOf(p) < 0) folders.push(p);
    });
    var bizCodes = [];
    rows(raw.bizCodes).forEach(function (c) {
      c = str(c);
      if (okCode(c) && bizCodes.length < LIMIT.biz && bizCodes.indexOf(c) < 0) bizCodes.push(c);
    });
    var apps = [];
    rows(raw.apps).forEach(function (k) {
      k = str(k);
      if (own(INNER, k) && apps.indexOf(k) < 0) apps.push(k);   // 정해 둔 앱 열쇠만 — 모르는 것은 버린다
    });
    var order = Number(raw.order);
    var value = { id: id, title: title, org: cut(raw.org, LIMIT.org), note: cut(raw.note, LIMIT.note),
      links: links, folders: folders, bizCodes: bizCodes, apps: apps, order: isFinite(order) ? order : 0 };
    return { ok: errors.length === 0, value: value, errors: errors };
  }

  /* 저장소 govlinks/sets 통째 → 살아 있는 묶음(지운 것 뺌) · 순서(order → 이름) */
  function byOrder(a, b) {
    if (a.order !== b.order) return a.order < b.order ? -1 : 1;
    return a.title.localeCompare(b.title, 'ko');
  }
  function readSets(raw, wantDeleted) {
    var out = [];
    rows(raw).forEach(function (r) {
      if (!r || typeof r !== 'object' || !!r._deleted !== !!wantDeleted) return;
      var c = cleanSet(r);
      if (!okId(c.value.id) || !c.value.title) return;
      c.value.revision = Number(r.revision || 0);
      c.value.updatedAt = r.updatedAt || null;
      c.value.updatedBy = str(r.updatedBy);
      if (wantDeleted) { c.value.deletedAt = r.deletedAt || null; c.value.deletedBy = str(r.deletedBy); }
      out.push(c.value);
    });
    return out.sort(byOrder);
  }
  function liveSets(raw) { return readSets(raw, false); }
  function deletedSets(raw) { return readSets(raw, true); }
  /* 저장소에 아무 묶음도(지운 것 포함) 없으면 true — 그때 화면은 기본 목록을 보여 준다 */
  function isEmpty(raw) { return rows(raw).filter(function (r) { return r && typeof r === 'object'; }).length === 0; }

  /* 기본 목록 — 새 사본(순서 10, 20, …). match 는 저장하지 않는 제안 낱말이라 뺀다 */
  function defaultSets() {
    return DEFAULTS.map(function (d, i) {
      var v = cleanSet(Object.assign({}, d, { order: (i + 1) * 10, bizCodes: [] })).value;
      v.revision = 0;
      return v;
    });
  }

  /* 연결 제안 — 기본 묶음의 낱말이 이알피 사업 이름에 들어 있고 아직 안 이은 사업 code 들(저장하지 않는다) */
  function suggestCodes(set, types) {
    var d = set && DEFAULT_BY_ID[set.id];
    if (!d || !d.match || !d.match.length) return [];
    var have = (set.bizCodes || []);
    return (types || []).filter(function (t) {
      var n = squash(t.name) + squash(t.short);
      return have.indexOf(t.code) < 0 && d.match.some(function (w) { return n.indexOf(w) >= 0; });
    }).map(function (t) { return t.code; });
  }

  /* 정부사업일정 보고서 창 주소 — 업체를 누르면 그 업체·그 사업의 보고서 창이 열린다.
     ⚠ pu-gov-report-list.js reportHref 와 같은 꼴(업체·사업을 따로 감싸고 가운데 '|')이다 — 정부사업일정 linkRpt 가 이 꼴을 읽는다 */
  function reportHref(coId, typeId) {
    return 'gov-consulting.html#rpt=' + encodeURIComponent(str(coId)) + '|' + encodeURIComponent(str(typeId));
  }

  /* 판 만들기 — 카드(묶음) · 바로가기 없는 진행 사업 · 종결된 사업 카드
     o = { sets, biz, tmap, input:{cos,types,scheds,staff}, state, order, year }
     ★ 이알피 자료를 못 읽었으면(biz 없음) 묶음만 그대로 카드가 된다 — 업체 칸만 빈다. */
  function board(o) {
    o = o || {};
    var year = str(o.year);
    var input = o.input || {};
    var types = Docs.visibleTypes(o.biz);
    var byCode = {};
    types.forEach(function (t) { byCode[t.code] = t; });
    var nav = Nav.build({ biz: o.biz, tmap: o.tmap, input: input, state: o.state, order: o.order, year: year });
    var rank = {};
    ['open', 'quiet', 'noPlan', 'unlinked', 'closed'].forEach(function (k, gi) {
      (nav[k] || []).forEach(function (x, i) { rank[x.code] = gi * 1000 + i; });
    });
    function program(code) {
      var t = byCode[code];
      if (!t) return { code: code, missing: true, label: '이알피에 없는 사업', closed: false, typeId: '', companies: [] };
      var typeId = Docs.linkOf(code, o.tmap, input.types);
      var cos = typeId ? Docs.pairs(input, typeId, year).map(function (p) {
        return { coId: p.coId, coName: p.coName, typeId: typeId, rounds: p.rounds, planned: p.planned, href: reportHref(p.coId, typeId) };
      }) : [];
      return { code: code, missing: false, label: Nav.label(t).text, closed: Nav.closedFor(o.state, code, year),
        typeId: typeId, companies: cos };
    }
    var activeTypes = types.filter(function (t) { return !Nav.closedFor(o.state, t.code, year); });
    var used = {}, cards = [], closed = [];
    (o.sets || []).forEach(function (s) {
      var progs = (s.bizCodes || []).map(program);
      progs.forEach(function (p) { used[p.code] = 1; });
      var card = { set: s, programs: progs, suggest: suggestCodes(s, activeTypes),
        companyCount: progs.reduce(function (n, p) { return n + (p.closed ? 0 : p.companies.length); }, 0) };
      var known = progs.filter(function (p) { return !p.missing; });
      if (known.length && known.every(function (p) { return p.closed; })) closed.push(card);
      else cards.push(card);
    });
    var bare = activeTypes.filter(function (t) { return !used[t.code]; })
      .map(function (t) { return program(t.code); })
      .sort(function (a, b) { return (rank[a.code] || 0) - (rank[b.code] || 0); });
    return { cards: cards, bare: bare, closed: closed, types: types, year: year };
  }

  /* 찾기 — 묶음 이름·기관·메모·사이트 이름·주소·폴더·이어진 사업·업체 이름 어디든 */
  function cardText(card) {
    var s = card.set || {};
    var parts = [s.title, s.org, s.note].concat((s.folders || []).map(folderName));
    (s.links || []).forEach(function (l) { parts.push(l.name, l.url); });
    (card.programs || []).forEach(function (p) { parts.push(p.label); p.companies.forEach(function (c) { parts.push(c.coName); }); });
    return parts.join(' ').toLowerCase();
  }
  function linkHit(link, q) { return !q || (str(link.name) + ' ' + str(link.url)).toLowerCase().indexOf(q) >= 0; }
  /* 카드마다 { card, links(보일 사이트), hit } — 카드 글에 걸리면 사이트 모두, 아니면 걸린 사이트만 */
  function filterCards(cards, query) {
    var q = str(query).toLowerCase();
    return (cards || []).map(function (c) {
      var links = c.set.links || [];
      if (!q) return { card: c, links: links, hit: true };
      var all = (str(c.set.title) + ' ' + str(c.set.org) + ' ' + str(c.set.note)).toLowerCase().indexOf(q) >= 0;
      var some = links.filter(function (l) { return linkHit(l, q); });
      var any = all || some.length > 0 || cardText(c).indexOf(q) >= 0;
      return { card: c, links: all ? links : (some.length ? some : links), hit: any };
    }).filter(function (x) { return x.hit; });
  }

  /* 순서 바꾸기 — 보이는 차례에서 id 를 위(-1)·아래(+1)로. 바뀌는 묶음들의 { id, order } (10 간격으로 다시 매김) */
  function moveOrder(sets, id, dir) {
    var list = (sets || []).slice();
    var i = list.map(function (s) { return s.id; }).indexOf(id), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return [];
    var t = list[i]; list[i] = list[j]; list[j] = t;
    var out = [];
    list.forEach(function (s, k) { var want = (k + 1) * 10; if (s.order !== want) out.push({ id: s.id, order: want }); });
    return out;
  }
  /* 새 묶음의 순서 — 맨 뒤 */
  function nextOrder(sets) {
    return (sets || []).reduce(function (m, s) { return Math.max(m, Number(s.order) || 0); }, 0) + 10;
  }
  /* 새 묶음 번호 — 'gl' + 시각(36진) + 덤 네 자 */
  function newId(now, rnd) {
    var r = typeof rnd === 'number' ? rnd : Math.random();
    return 'gl' + Math.floor(now || Date.now()).toString(36) + Math.floor(r * 1679616).toString(36).padStart(4, '0');
  }

  /* 최근 연 사이트(이 기기만) — 지금 목록에 있는 주소만 남긴다(저장값이 바뀌어도 모르는 주소를 띄우지 않는다) */
  function recentList(raw, sets, max) {
    var known = {};
    (sets || []).forEach(function (s) { (s.links || []).forEach(function (l) { if (!own(known, l.url)) known[l.url] = l.name; }); });
    var list = [];
    try { list = JSON.parse(raw || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) return [];
    var seen = {};
    return list.filter(function (u) {
      if (typeof u !== 'string' || !own(known, u) || seen[u]) return false;
      seen[u] = 1; return true;
    }).slice(0, max || 6).map(function (u) { return { url: u, name: known[u] }; });
  }
  function pushRecent(raw, url, max) {
    var list = [];
    try { list = JSON.parse(raw || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    list = [url].concat(list.filter(function (u) { return u !== url && typeof u === 'string'; }));
    return JSON.stringify(list.slice(0, max || 6));
  }

  /* 카드의 «푸른 앱» — { key, name, icon, url } (정해 둔 것만) */
  function innerApps(set) {
    return ((set && set.apps) || []).filter(function (k) { return own(INNER, k); })
      .map(function (k) { return { key: k, name: INNER[k].name, icon: INNER[k].icon, url: INNER[k].url }; });
  }

  var api = { ROOT: ROOT, SETS: SETS, ENTITY: ENTITY, LIMIT: LIMIT, DEFAULTS: DEFAULTS, INNER: INNER, INNER_KEYS: INNER_KEYS, innerApps: innerApps,
    safeUrl: safeUrl, hostOf: hostOf, folderName: folderName, cleanSet: cleanSet, okCode: okCode, okId: okId,
    liveSets: liveSets, deletedSets: deletedSets, isEmpty: isEmpty, defaultSets: defaultSets, suggestCodes: suggestCodes,
    reportHref: reportHref, board: board, cardText: cardText, filterCards: filterCards,
    moveOrder: moveOrder, nextOrder: nextOrder, newId: newId, recentList: recentList, pushRecent: pushRecent };
  if (isNode) module.exports = api;
  else root.PuGovLinks = api;
})(typeof window !== 'undefined' ? window : this);
