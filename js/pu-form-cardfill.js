'use strict';
/* ══ 계약서 양식 › 채워서 받기 — 기업정보함에서 회사·담당자·근로자를 골라 채운다 (대표 지시 2026-09-27) ══
   「서류에는 기업정보 담당자 근로자 본인등 이름을 가지고 와야된다. 기업정보함에서 찾아서 직접 가지고 오고
    넣을 수 있게 연결 … 한글화일에도」 → 목업 승인 후 구현.

   ■ 읽는 규칙 — 기금관리(fund.html loadCardIdx·loadCardCo)와 같다
     · pucards/idx  (가벼운 검색목록) 만 통째로 읽는다. pucards/items(사진 수 MB)는 안 읽는다.
     · pucards/coInfo 는 고른 회사 «한 칸»(많아야 두 칸)만.
     · 쓰기 금지 — 기업정보함은 남의 자료다.
   ■ 채운 값은 어디에도 저장하지 않는다 — 내려받는 파일에만 들어간다.
   ■ 주민번호는 기업정보함에 없다 — 밑줄(＿＿＿)로 두고 사람이 적는다(지어내지 않는다).

   순수 함수만 둔다 — 화면(pu-contract-forms.js)이 부르고, Node 검사(tests/form-cardfill.test.js)가 그대로 싣는다. */
(function (root) {
  var BLANK = '＿＿＿';

  /* ⚠ 기업정보함(pu-cards.html 의 _norm)과 «글자 하나까지» 같아야 한다 — coInfo 열쇠가 이 꼴이다 */
  function coNorm(s) { return String(s || '').replace(/\s|\(주\)|주식회사|㈜/g, '').replace(/[.#$/[\]]/g, '').toLowerCase(); }
  /* 명함 ↔ 사업자등록증 같은 회사 맞추기 — 기금 cardEffective 의 _cardNorm 과 같다 */
  function cardNorm(s) { return String(s || '').toLowerCase().replace(/[\s\-㈜()]|주식회사/g, ''); }
  /* 같은 회사인지 볼 때 쓰는 열쇠 — 「(주)가나」·「㈜ 가나」·「가나」를 한 회사로 */
  function sameCo(s) { return cardNorm(coNorm(s)); }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

  function coInfoKeys(r) {
    var d = digits(r && r.bz), nameKey = 'n' + coNorm((r && r.c) || '');
    var key = d.length >= 10 ? d : nameKey;
    if (!key || key === 'n') return [];
    /* 이름 열쇠가 «아래», 번호 열쇠가 «위» — 등록증이 나중에 들어온 회사는 옛 이름 열쇠에 값이 남는다 */
    return (nameKey !== 'n' && nameKey !== key) ? [nameKey, key] : [key];
  }
  var CO_KEYMAP = [['bizno', 'bz'], ['ceo', 'ceo'], ['corpno', 'cno'], ['address', 'ad'], ['companyTel', 'ct'],
    ['email', 'e'], ['bizType', 'bt'], ['bizItem', 'bi'], ['smeType', 'sme'], ['workers', 'wk'],
    /* 국세청 상태 — 기업정보함이 «물어본 날»과 함께 적어 둔 값(pu-cards.html 🏛 국세청 사업자 상태). 읽기만 */
    ['ntsState', 'ns'], ['ntsAt', 'na'], ['ntsEndDt', 'ne']];
  function mergeCoInfo(vals) {
    var out = {};
    (vals || []).forEach(function (v) {
      CO_KEYMAP.forEach(function (p) { var x = String((v || {})[p[0]] == null ? '' : v[p[0]]).trim(); if (x) out[p[1]] = x; });
    });
    return out;
  }

  /* ERP 업체관리(data/companies/v)를 기업정보함 검색줄과 같은 꼴로 바꾼다.
     문서의 회사 원본은 ERP 업체관리이고, 명함은 담당자 보충자료다. */
  function erpRows(raw) {
    var v = raw && raw.v !== undefined ? raw.v : raw;
    var list = Array.isArray(v) ? v : Object.keys(v || {}).map(function (k) {
      var x = Object.assign({}, (v || {})[k] || {}); if (!x.id) x.id = k; return x;
    });
    return list.filter(function (x) { return x && !x._deleted && (x.name || x.bizNo); }).map(function (x) {
      var contacts = Array.isArray(x.contacts) ? x.contacts : [];
      var main = contacts.filter(function (c) { return c && (c.primary || c.isPrimary); })[0] || contacts[0] || {};
      return { k: 'erp', companyId: x.id || '', c: x.name || '', bz: x.bizNo || '', ceo: x.ceo || '', ceo2: x.ceo2 || '',
        ad: [x.zipcode ? '(' + String(x.zipcode).replace(/[()]/g, '') + ')' : '', x.address || ''].filter(Boolean).join(' '),
        ct: x.phone || '', cfx: x.fax || '', e: x.email || '', bt: x.bizType || '', bi: x.bizCategory || x.industry || '',
        cno: x.corpRegNo || x.corpNo || '', sme: x.companySize || '', wk: x.employmentInsuredCount || '',
        primaryContactName: x.primaryContactName || main.name || main.n || '',
        primaryContactPhone: x.primaryContactPhone || main.phone || main.mobile || main.m || '',
        primaryContactEmail: x.primaryContactEmail || main.email || main.e || '', _erp: x };
    });
  }
  function mergeRows(idx, companies) {
    var cards = rowsOf(idx), erp = erpRows(companies), out = erp.slice(), claimed = {};
    erp.forEach(function (r) { var b = digits(r.bz), n = sameCo(r.c); if (b) claimed['b' + b] = 1; if (n) claimed['n' + n] = 1; });
    /* 같은 회사의 사업자등록증은 검색목록에서 빠지지만(한 회사 한 줄) 이알피 줄에 _biz 로 붙여 둔다 —
       채우기 전 확인표가 둘을 견준다(대표 「추천대로」 2026-10-05: 같은 번호 111곳 중 대표자 23·주소 약 27곳이 달랐다) */
    var byBz = {}, byName = {};
    erp.forEach(function (r) { var b = digits(r.bz), n = sameCo(r.c); if (b && !byBz[b]) byBz[b] = r; if (n && !byName[n]) byName[n] = r; });
    cards.forEach(function (r) {
      if (r.k === 'biz' && (claimed['b' + digits(r.bz)] || claimed['n' + sameCo(r.c)])) {
        var twin = (digits(r.bz) && byBz[digits(r.bz)]) || byName[sameCo(r.c)];
        if (twin && !twin._biz && (!digits(twin.bz) || !digits(r.bz) || digits(twin.bz) === digits(r.bz))) twin._biz = r;
        return;
      }
      out.push(r);
    });
    return out;
  }

  /* ══ 채우기 전 확인표 (대표 「추천대로」 2026-10-05, 목업 승인) ══
     이알피 값과 사업자등록증 값이 다른 칸을 찾는다. 같은 뜻의 다른 적기(충청남도/충남, 띄어쓰기, 우편번호)는 같다고 본다. */
  var CHECK_FIELDS = [['회사명', 'c'], ['대표자', 'ceo'], ['주소', 'ad'], ['대표전화', 'ct']];
  /* 표지 → 회사 칸 — 둘 이상이 한 칸을 쓴다(대표자·대표자전체, 주소·우편주소) */
  var CO_FIELD_OF = { 회사명: 'c', 사업자번호: 'bz', 대표자: 'ceo', 대표자전체: 'ceo', 주소: 'ad', 우편주소: 'ad', 대표전화: 'ct',
    대표팩스: 'cfx', 대표이메일: 'e', 업태: 'bt', 종목: 'bi', 법인등록번호: 'cno', 규모: 'sme' };
  var PROVINCE = [[/^서울특별시/, '서울'], [/^부산광역시/, '부산'], [/^대구광역시/, '대구'], [/^인천광역시/, '인천'], [/^광주광역시/, '광주'],
    [/^대전광역시/, '대전'], [/^울산광역시/, '울산'], [/^세종특별자치시/, '세종'], [/^경기도/, '경기'], [/^강원(특별자치)?도/, '강원'],
    [/^충청북도/, '충북'], [/^충청남도/, '충남'], [/^전(라북|북특별자치)도/, '전북'], [/^전라남도/, '전남'], [/^경상북도/, '경북'],
    [/^경상남도/, '경남'], [/^제주특별자치도/, '제주']];
  function addrNorm(s) {
    var t = String(s || '').replace(/^\s*\(\s*\d{5}\s*\)\s*/, '').replace(/\([^)]*\)/g, '').trim();
    PROVINCE.forEach(function (p) { t = t.replace(p[0], p[1]); });
    return t.replace(/[\s,.\-·]/g, '');
  }
  /* 도로명 + 건물번호(「호서로79번길 20」) — 층·호수·괄호 속 동 이름 적기가 달라도 같은 곳으로 본다 */
  function roadOf(s) { var m = /([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/.exec(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/(\d)\s+(?=[가-힣])/g, '$1')); return m ? m[1] + ' ' + m[2] : ''; }
  function nameCore(s) { return sameCo(String(s || '').replace(/\([^)]*\)/g, '').replace(/-\d+$/, '').replace(/신용협동조합/g, '신협').replace(/농업회사법인|사회복지법인|재단법인|사단법인|영농조합법인/g, '')); }
  function sameField(f, a, b) {
    if (f === 'c') { var m = nameCore(a), n = nameCore(b); return m === n || (m.length >= 2 && n.length >= 2 && (m.indexOf(n) >= 0 || n.indexOf(m) >= 0)); }
    if (f === 'ct') { var da = digits(a), db = digits(b); return da === db || /^01/.test(da) !== /^01/.test(db); }   // 휴대폰↔사무실 전화는 견주지 않는다
    if (f === 'ad') {
      var ra = roadOf(a), rb = roadOf(b);
      if (ra && rb) return ra === rb;
      var x = addrNorm(a), y = addrNorm(b); return x === y || (x.length >= 6 && y.length >= 6 && (x.indexOf(y) === 0 || y.indexOf(x) === 0));
    }
    var p = String(a || '').replace(/\s/g, ''), q = String(b || '').replace(/\s/g, '');
    return p === q || (!!p && !!q && (p.indexOf(q) >= 0 || q.indexOf(p) >= 0));   // 공동대표 「홍길동,김철수」 ⊃ 「홍길동」
  }
  /* ══ 🏛 국세청 상태 (대표 「추천대로」 2026-10-05 — 오래된 등록증 경고 대신) ══
     ⚠ 기업정보함 coNtsCls 와 «같은 답»이어야 한다(검사가 두 쪽을 견준다). 우리가 정하지 않는다 — 국세청 말 그대로. */
  function ntsCls(word) {
    var w = String(word || '');
    if (!w) return '';
    if (w.indexOf('폐업') >= 0) return 'gone';
    if (w.indexOf('휴업') >= 0) return 'soon';
    if (w.indexOf('계속') >= 0) return 'ok';
    if (w.indexOf('등록되지 않은') >= 0) return 'none';
    return 'dim';
  }
  /* 국세청 한 줄(b_stt·tax_type·end_dt) → 말 */
  function ntsWordOf(row) { return String((row && row.b_stt) || '').trim() || String((row && row.tax_type) || '').trim(); }
  function ntsEndOf(row) { var d = digits(row && row.end_dt); return d.length === 8 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) : ''; }
  var NTS_STALE_DAYS = 90;
  /* x: {word, at, end} → 화면 한 줄. stale = 물어본 지 90일 넘음(또는 날짜 없음) — 상태는 «그때의 사실»이다 */
  function ntsView(x, today) {
    x = x || {};
    var word = String(x.word || '').trim(), at = String(x.at || '').slice(0, 10), cls = ntsCls(word);
    var t = today || new Date(), days = at ? Math.floor((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.parse(at + 'T00:00:00Z')) / 864e5) : null;
    var stale = !word || days == null || !(days <= NTS_STALE_DAYS);
    var bad = cls === 'gone' || cls === 'soon' || cls === 'none';
    var say = cls === 'none' ? '등록되지 않은 번호' : word;
    var text = !word ? '국세청 확인 기록 없음'
      : '국세청: ' + say + (x.end ? ' (' + x.end + ' 폐업)' : '') + (at ? ' · ' + at + ' 확인' + (days > NTS_STALE_DAYS ? '(' + days + '일 전)' : '') : ' · 확인 날짜 모름');
    return { word: word, at: at, cls: cls, bad: bad, stale: stale, text: text };
  }
  /* co: 고른 회사 줄(이알피 줄이면 _biz 가 붙어 있을 수 있다) → [{f, key, erp, biz}] */
  function coConflicts(co) {
    var b = co && co._biz;
    if (!b || co.k !== 'erp') return [];
    var s = function (v) { return v == null ? '' : String(v).trim(); };
    return CHECK_FIELDS.filter(function (p) { var x = s(co[p[1]]), y = s(b[p[1]]); return x && y && !sameField(p[1], x, y); })
      .map(function (p) { return { f: p[1], key: p[0], erp: s(co[p[1]]), biz: s(b[p[1]]) }; });
  }
  /* 칸마다 출처 이름표 — o: {co, coX, contact, worker, edits, contract, contractWins, picks, conflicts} */
  function fieldSource(key, o) {
    o = o || {};
    if (o.edits && Object.prototype.hasOwnProperty.call(o.edits, key)) return { label: '직접' };
    var cv = o.contract && o.contract[key];
    if (cv != null && cv !== '' && (o.contractWins || !(o.co && CO_FIELD_OF[key] && o.co[CO_FIELD_OF[key]]))) return { label: '이알피 계약' };
    var f = CO_FIELD_OF[key], co = o.co || {};
    if (f) {
      var c = (o.conflicts || []).filter(function (x) { return x.f === f; })[0], pk = (o.picks || {})[f];
      if (c) return pk ? { label: (pk === 'biz' ? '등록증' : '이알피') + ' (고름)', picked: pk } : { label: '⚠ 다름', warn: true, conflict: c };
      var has = function (r) { return r && r[f] != null && String(r[f]).trim() !== ''; };
      if (has(co)) {
        if (co.k === 'erp') return { label: has(co._biz) ? '이알피·등록증' : '이알피' };
        if (co.k === 'biz') return { label: '등록증' };
        return { label: '명함' };
      }
      if (has(o.coX)) return { label: '기업정보함' };
      return { label: '없음', miss: true };
    }
    if (/^담당자/.test(key)) return o.contact ? { label: o.contact.k === 'card' ? '명함' : '이알피' } : { label: '없음', miss: true };
    if (/^근로자|^이름$/.test(key)) return o.worker ? { label: '근로자' } : { label: '없음', miss: true };
    if (/^(오늘날짜|오늘|작성일|계약일)$/.test(key)) return { label: '오늘' };
    if (key === '공인노무사명단') return { label: '푸른 명부' };
    return { label: '' };
  }

  /* idx 객체({id: 줄}) → 배열. 사업자등록증(biz)·명함(card)과 ERP 변환줄(erp) */
  function rowsOf(idx) {
    if (Array.isArray(idx)) return idx;
    var v = idx || {};
    return Object.keys(v).map(function (k) { var r = Object.assign({}, v[k] || {}); r._id = k; return r; })
      .filter(function (r) { return (r.k === 'biz' || r.k === 'card' || r.k === 'erp') && (r.c || r.bz || r.n); });
  }

  /* 회사 찾기 — 사업자등록증이 있으면 그것, 없으면 명함에만 있는 회사도 한 줄로 */
  function searchCompanies(rows, q, limit) {
    q = String(q || '').trim(); if (!q) return [];
    var qn = cardNorm(q), qd = digits(q), seen = {}, out = [];
    function hit(r) {
      if (qd.length >= 3 && digits(r.bz).indexOf(qd) >= 0) return true;
      return qn && (sameCo(r.c).indexOf(qn) >= 0 || cardNorm(r.c).indexOf(qn) >= 0 || ((r.k === 'biz' || r.k === 'erp') && cardNorm(r.ceo).indexOf(qn) >= 0));
    }
    rows.filter(function (r) { return (r.k === 'erp' || r.k === 'biz') && hit(r); }).sort(function (a, b) { return a.k === b.k ? 0 : (a.k === 'erp' ? -1 : 1); }).forEach(function (r) {
      var key = sameCo(r.c) || digits(r.bz); if (seen[key]) return; seen[key] = 1; out.push(r);
    });
    rows.filter(function (r) { return r.k === 'card' && r.c && hit(r); }).forEach(function (r) {
      var key = sameCo(r.c); if (!key || seen[key]) return; seen[key] = 1;
      out.push({ k: 'card-co', c: r.c, ad: r.ad, ct: r.ct, cfx: r.cfx, _id: r._id });
    });
    return out.slice(0, limit || 20);
  }
  /* 그 회사 명함들(담당자 고르기) */
  function contactsOf(rows, co) {
    var key = sameCo(co && co.c); if (!key) return [];
    var out = rows.filter(function (r) { return r.k === 'card' && r.n && sameCo(r.c) === key; });
    if (co && co.primaryContactName && !out.some(function (r) { return cardNorm(r.n) === cardNorm(co.primaryContactName); }))
      out.unshift({ k: 'erp-contact', c: co.c, n: co.primaryContactName, m: co.primaryContactPhone || '', e: co.primaryContactEmail || '' });
    return out;
  }
  /* 사람 찾기(근로자 본인) — 명함 이름·휴대폰 */
  function searchPeople(rows, q, limit) {
    q = String(q || '').trim(); if (!q) return [];
    var qn = cardNorm(q), qd = digits(q);
    return rows.filter(function (r) {
      if (r.k !== 'card' || !r.n) return false;
      if (qd.length >= 4 && digits(r.m).indexOf(qd) >= 0) return true;
      return qn && cardNorm(r.n).indexOf(qn) >= 0;
    }).slice(0, limit || 20);
  }

  /* 담당자 찾기 — 고른 회사 사람이 먼저, 이름·회사·직급·부서·전화·메일로 찾는다. */
  function searchContacts(rows, q, company, limit) {
    q = String(q || '').trim(); var qn = cardNorm(q), qd = digits(q), coKey = sameCo(company && company.c);
    var pool = (rows || []).filter(function (r) { return r.k === 'card' && r.n; }).slice();
    (rows || []).filter(function (r) { return r.k === 'erp' && r.primaryContactName; }).forEach(function (r) {
      pool.push({ k:'erp-contact', c:r.c, n:r.primaryContactName, m:r.primaryContactPhone || '', e:r.primaryContactEmail || '' });
    });
    var seen = {}, list = pool.filter(function (r) {
      var unique = sameCo(r.c) + '|' + cardNorm(r.n) + '|' + digits(r.m || r.t); if (seen[unique]) return false; seen[unique] = 1;
      if (!q) return coKey && sameCo(r.c) === coKey;
      if (qd.length >= 3 && digits((r.m || '') + (r.t || '')).indexOf(qd) >= 0) return true;
      return [r.n, r.c, r.ti, r.d, r.e].some(function (v) { return qn && cardNorm(v).indexOf(qn) >= 0; });
    });
    list.sort(function (a, b) {
      var aa = coKey && sameCo(a.c) === coKey ? 0 : 1, bb = coKey && sameCo(b.c) === coKey ? 0 : 1;
      return aa - bb;
    });
    return list.slice(0, limit || 20);
  }

  function fmtBizNo(s) { var d = digits(s); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : String(s || ''); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* ══ {{공인노무사명단}} — 푸른노무법인에 «재직 중인» 공인노무사 전원 (대표 지시 2026-10-09 「위임장에는 기본적으로 … 모든 이름」) ══
     명부(data/user_dir): 사번 P-… 이거나 직책에 「노무사」(A- 직원 제외) · 상태 재직(active·휴직 leave).
     대표노무사가 앞, 나머지는 사번 차례. 명부를 못 읽으면 FALLBACK(2026-10-09 명부 기준) — 바뀌면 명부가 이긴다. */
  var LAWYERS_FALLBACK = '대표 공인노무사 권형하, 공인노무사 박한별·김혜민·박재원·김동현';
  var lawyersLineNow = '';
  function lawyersLine(dir) {
    var list = (Array.isArray(dir) ? dir : (dir && typeof dir === 'object' ? Object.keys(dir).map(function (k) { return dir[k]; }) : []))
      .filter(function (u) {
        if (!u || !u.name) return false;
        var sid = String(u.sid || ''), t = String(u.title || u.position || '');
        if (u.status !== 'active' && u.status !== 'leave') return false;
        if (sid.indexOf('A-') === 0) return false;
        return sid.indexOf('P-') === 0 || /노무사/.test(t);
      })
      .sort(function (a, b) {
        var ra = /대표/.test(String(a.title || a.position || '')) ? 0 : 1, rb = /대표/.test(String(b.title || b.position || '')) ? 0 : 1;
        return ra - rb || String(a.sid || '').localeCompare(String(b.sid || ''));
      });
    if (!list.length) return '';
    var head = list[0], rest = list.slice(1).map(function (u) { return String(u.name).replace(/\s+/g, ''); });
    var first = (/대표/.test(String(head.title || head.position || '')) ? '대표 공인노무사 ' : '공인노무사 ') + String(head.name).replace(/\s+/g, '');
    return rest.length ? first + ', 공인노무사 ' + rest.join('·') : first;
  }
  function setLawyers(dirOrLine) { lawyersLineNow = typeof dirOrLine === 'string' ? dirOrLine : lawyersLine(dirOrLine); return lawyersLineNow; }
  function lawyersNow() { return lawyersLineNow || LAWYERS_FALLBACK; }

  /* 표지 이름 → 값. co 는 회사 한 벌(사업자등록증 줄 + coInfo 를 합친 것), contact·worker 는 명함 줄
     (worker 는 사람이 적은 {n,m,ad} 이어도 된다). 모르는 값은 '' — 채울 때 밑줄로 바뀐다. */
  function valuesFrom(o) {
    o = o || {};
    var co = o.co || {}, ct = o.contact || {}, wk = o.worker || {};
    var today = ymd(o.today || new Date());
    var s = function (v) { return v == null ? '' : String(v).trim(); };
    var V = {
      회사명: s(co.c), 사업자번호: co.bz ? fmtBizNo(co.bz) : '', 대표자: s(co.ceo), 대표자전체: s(co.ceo),
      주소: s(co.ad), 대표전화: s(co.ct), 대표팩스: s(co.cfx || co.fx), 대표이메일: s(co.e),
      업태: s(co.bt), 종목: s(co.bi), 법인등록번호: s(co.cno), 규모: s(co.sme),
      담당자: s(ct.n), 담당자연락처: s(ct.m || ct.t), 담당자이메일: s(ct.e),
      담당자직급: s(ct.ti), 담당자부서: s(ct.d), 담당자휴대폰: s(ct.m), 담당자전화: s(ct.t), 담당자주소: s(ct.ad),
      근로자명: s(wk.n), 근로자이름: s(wk.n), 이름: s(wk.n), 근로자명단: s(wk.n),
      근로자연락처: s(wk.m || wk.t), 근로자주소: s(wk.ad),
      근로자수: wk.n ? '1' : '',
      /* 기업정보함에 없는 값 — 사람이 적는다 */
      주민번호: '', 근로자주민: '', 주민등록번호: '', 가족연락처: '',
      오늘날짜: today, 오늘: today, 작성일: today, 계약일: today,
      공인노무사명단: s(o.lawyers) || lawyersNow()
    };
    /* 엑셀 틀(급여위임계약서_양식)은 주소를 MID(주소,8,…) 로 잘라 쓴다 — 앞 8글자가 「(31068) 」 꼴이라 여긴다.
       우편번호가 없으면 같은 길이의 빈 괄호를 붙여 글자가 잘리지 않게 한다. */
    V.우편주소 = !V.주소 ? '' : (/^\(\d{5}\) /.test(V.주소) ? V.주소 : '(     ) ' + V.주소);
    V.근로자상세 = [V.근로자명, V.근로자주소, V.근로자연락처].filter(Boolean).join(' · ');
    return V;
  }

  /* ── 위임계약서 고르기 값 (설계 2026-10-03 §2.2·2.3, 목업 승인) ──
     사용자측 틀: {{위임분야}}과 관련하여 … {{위임사무}} · 금 {{계약금액}}원 ({{부가세처리}}) · ② {{기간연장}}
     근로자측 틀: 위임내용 : {{위임내용}} · 착수금 ({{부가세처리}}) · 성공한 때에는 {{성공보수}}을 성공보수로
     ⚠ 위임분야는 「…과 관련하여」 앞에 들어간다 — 받침 있는 말로 끝나야 한다(컨설팅·대응·교섭·신청). */
  var CASE_TASKS = [
    { v: 'consult', t: '인사노무컨설팅', area: '인사노무컨설팅', task: '1. 인사노무 진단 및 취업규칙·근로계약서 등 규정 정비에 관한 사항' },
    { v: 'dismiss', t: '부당해고 대응', area: '부당해고 대응', task: '1. 부당해고 구제신청 사건 대응에 관한 일체의 사항' },
    { v: 'harass', t: '직장 내 괴롭힘 대응', area: '직장 내 괴롭힘 대응', task: '1. 직장 내 괴롭힘 대응에 관한 일체의 사항' },
    { v: 'inspect', t: '근로감독 대응', area: '근로감독 대응', task: '1. 근로감독 대응에 관한 일체의 사항' },
    { v: 'bargain', t: '단체교섭', area: '단체교섭', task: '1. 단체교섭 및 노사협의에 관한 자문' },
    { v: 'fund', t: '기금 지원금 신청', area: '근로복지기금 지원금 신청', task: '1. 근로복지기금 지원금 신청에 관한 일체의 사항' },
    { v: 'own', t: '직접 적기', area: '', task: '' }
  ];
  var WORKER_TASKS = [
    { v: 'arrears', t: '임금·퇴직금 체불', text: '미지급임금 및 퇴직금 체불 처리에 대한 일체의 사항 위임' },
    { v: 'dismiss', t: '부당해고 구제신청', text: '부당해고 구제신청 사건 처리에 대한 일체의 사항 위임' },
    { v: 'suspend', t: '부당정직 구제신청', text: '부당정직 구제신청 사건 처리에 대한 일체의 사항 위임' },
    { v: 'injury', t: '산재 신청', text: '산업재해보상보험 급여 신청에 대한 일체의 사항 위임' },
    { v: 'own', t: '직접 적기', text: '' }
  ];
  var CASE_KEYS = ['위임분야', '위임사무', '위임내용', '부가세처리', '기간연장', '성공보수'];
  var EXT_TEXT = {
    agree: '당사자 간 위임사무의 원활한 수행을 위해 필요한 경우 당사자 간 합의로 위 기간을 연장할 수 있다.',
    auto: '제1항의 기간이 만료되더라도 위임사무가 종료되지 아니한 경우, 그 사무가 실질적으로 종결될 때까지 본 계약기간은 자동 연장되는 것으로 한다.'
  };
  function caseValues(wi) {
    wi = wi || {};
    var t = CASE_TASKS.filter(function (x) { return x.v === wi.task; })[0];
    var w = WORKER_TASKS.filter(function (x) { return x.v === wi.wtask; })[0];
    var amt = String(wi.succAmt == null ? '' : wi.succAmt).trim();
    var vatTxt = wi.vat === 'incl' ? '부가세 포함' : '부가세 별도';
    var succ = '';
    if (amt) succ = wi.succ === 'rate' ? '총 수령금액의 ' + amt.replace(/%$/, '') + '%(' + vatTxt + ')' : '금 ' + amt + '원(' + vatTxt + ')';
    return {
      위임분야: t ? t.area : '', 위임사무: t ? t.task : '', 위임내용: w ? w.text : '',
      부가세처리: vatTxt, 기간연장: EXT_TEXT[wi.ext === 'auto' ? 'auto' : 'agree'], 성공보수: succ
    };
  }

  /* ── 제안서·견적서 자동 값 (설계 2026-09-29 §5) — 받는 곳 종류(기업/기관)·금액·부가세로 만든다.
     ⚠ 저장하지 않는다. 창에서 고칠 수 있고, 고친 값이 이긴다(openFill 의 edits). */
  var PROPOSAL_KEYS = ['수신자', '참조', '호칭', '송부일자', '담당노무사', '노무사연락처', '견적금액', '부가세', '비용합계'];
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function sendDate(d) { d = d || new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '. (' + WEEK[d.getDay()] + ')'; }
  function won(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }
  function proposalValues(V, o) {
    V = V || {}; o = o || {};
    var org = o.orgType === 'org';
    var person = [V.담당자부서, V.담당자, V.담당자직급].filter(Boolean).join(' ');
    var n = String(o.amount == null ? '' : o.amount).replace(/[,\s원]/g, '');
    var amt = /^\d{1,13}$/.test(n) ? +n : null;
    var total = amt == null ? null : (o.vat === 'excl' ? Math.round(amt * 1.1) : amt);
    return {
      수신자: org ? [V.회사명, person].filter(Boolean).join(' ') + (V.담당자 ? '님' : '') : String(V.회사명 || ''),
      참조: org ? '-' : (V.담당자 ? person + '님' : '담당자'),
      호칭: org ? '귀 기관' : '귀사',
      송부일자: sendDate(o.today),
      담당노무사: String(o.staffName || ''),
      노무사연락처: String(o.staffTel || '041-556-0035'),
      견적금액: amt == null ? '' : won(amt),
      부가세: amt == null ? '' : (o.vat === 'excl' ? '10% 별도' : '포함'),
      비용합계: total == null ? '' : won(total)
    };
  }

  /* ── ✉ 메일 기본값 · 보낸 기록 (설계 2026-09-29 §7) ── 저장하지 않는 기본값이다. 창에서 고친다. */
  /* opts.agency — 받는 곳이 공단(근로복지공단·건강보험·국민연금) 직원일 때: 「담당자님」·「제출합니다」.
     ⚠ 「공동근로복지기금 설립과 관련하여」는 기금 서류(이름에 「기금」)일 때만 — 위임장·계약서에 붙던 것을 바로잡음(2026-10-09) */
  function mailDefaults(V, formName, opts) {
    V = V || {}; opts = opts || {};
    var to = [], seen = {};
    function add(v, label) { v = String(v || '').trim(); if (!v || seen[v.toLowerCase()]) return; seen[v.toLowerCase()] = 1; to.push({ v: v, label: label + ' · ' + v }); }
    add(V.담당자이메일, '담당자 메일' + (V.담당자 ? ' · ' + V.담당자 : ''));
    add(V.대표이메일, '대표 메일');
    var co = String(V.회사명 || '').trim();
    var dear = (V.참조 && V.참조 !== '-') ? V.참조 : (V.수신자 || '담당자');
    var staff = String(V.담당노무사 || '').trim();
    var fname = String(formName || '서류'), fund = /기금/.test(fname);
    /* 을/를 — 끝 글자 받침으로(괄호 꼬리 「(푸른 표준)」은 떼고 본다) */
    var ul = function (t) { var c = String(t).replace(/\s*\([^)]*\)\s*$/, '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '을' : '를'; };
    if (opts.agency) dear = '담당자님';
    var what = opts.agency
      ? (co ? co + ' 사업장의 ' : '') + fname + ul(fname) + ' 제출합니다.'
      : fund ? (V.호칭 || '귀사') + '의 공동근로복지기금 설립과 관련하여 ' + String(formName || '제안서 및 견적서') + '를 보내드립니다.'
        : (co ? co + ' 관련 ' : '요청하신 ') + fname + ul(fname) + ' 보내드립니다.';
    var body = [dear + ', 안녕하십니까.',
      '푸른노무법인 ' + (staff ? staff + ' ' : '') + '노무사입니다.', '',
      what,
      opts.agency ? '확인하시고 보완할 점이 있으면 연락 주십시오.' : '검토하시고 궁금하신 점은 편하게 연락 주십시오.', '',
      '푸른노무법인 ' + (staff ? staff + ' ' : '') + '드림' + (V.노무사연락처 ? ' · ' + V.노무사연락처 : '')].join('\n');
    return { to: to, subject: '[푸른노무법인] ' + String(formName || '서류') + (co ? ' — ' + co : ''), body: body };
  }
  /* 기업정보함 「보낸 서류」 열쇠 — 사업자번호 숫자(10자리 이상)와 이름 열쇠 둘 다.
     업무관리(work.html)는 두 열쇠를 다 읽고 같은 at 은 한 번만 보인다. */
  function sentKeys(row, V) {
    row = row || {}; V = V || {};
    var out = [], d = digits(row.bz || V.사업자번호 || ''), nm = coNorm(V.회사명 || row.c || '');
    if (d.length >= 10) out.push(d);
    if (nm) out.push('n' + nm);
    return out.filter(function (k, i) { return out.indexOf(k) === i; });
  }
  /* 보낸 기록 한 줄 — ⚠ 받는 주소는 남기지 않는다(기업정보함 보낸 서류와 같은 원칙) */
  function sentRecord(o) {
    o = o || {};
    return { at: Number(o.at) || 0, by: String(o.by || ''), kind: String(o.kind || '그 밖'),
      names: (o.names || []).map(function (v) { return String(v || ''); }).filter(Boolean), card: '', who: String(o.who || '').trim() };
  }
  /* ══ 📇 공단 연락처 (대표 2026-10-09 「공단지사도 메일함에서 찾아서 연결시켜라」) ══
     푸른메일함 목록(mailbox 의 한 줄: e 보낸 주소, f 보낸 이름, d 날짜, s 제목, p 미리보기)에서
     공단 도메인 주소만 모아 «기관 · 지사 · 이름 · 주소 · 마지막으로 주고받은 날»로 만든다.
     ⚠ 지사는 미리보기·제목 글에 「○○지사/지역본부/센터」가 있을 때만 — 없으면 빈칸(지어내지 않는다).
     ⚠ 자동 발신 주소(noreply·webmaster·master 등)는 사람이 아니라 뺀다. 팩스번호는 미리보기에 없어 모으지 않는다. */
  var AGENCY_ORGS = { 'kcomwel.or.kr': '근로복지공단', 'nhis.or.kr': '국민건강보험공단', 'nps.or.kr': '국민연금공단' };
  var AGENCY_SKIP = /^(no-?reply|webmaster|master|admin|mailadmin|pension_master|welco|postmaster|help|info)@/i;
  /* 받는 주소가 공단이면 기관 이름, 아니면 '' — 공단에 낸 서류는 회사 «서명본 대기»에 올리지 않는다 */
  function agencyOrgOf(email) {
    var m = /@([a-z0-9.-]+)$/.exec(String(email || '').trim().toLowerCase());
    return (m && AGENCY_ORGS[m[1]]) || '';
  }
  function agencyBook(rows) {
    var by = {};
    (rows || []).forEach(function (r) {
      if (!r) return;
      var e = String(r.e || '').trim().toLowerCase(), m = /@([a-z0-9.-]+)$/.exec(e);
      var org = m && AGENCY_ORGS[m[1]];
      if (!org || AGENCY_SKIP.test(e)) return;
      var txt = String(r.p || '') + ' ' + String(r.s || '') + ' ' + String(r.f || '');
      /* 「고객센터·콜센터」는 지사가 아니다(검토 2026-10-09) — 건너뛰고 다음 것을 본다 */
      var br = ((txt.replace(/근로복지공단|국민건강보험공단|국민연금공단/g, ' ').match(/[가-힣]{2,6}(?:지사|지역본부|지부|센터)/g) || [])
        .filter(function (x) { return !/(고객|콜)센터$/.test(x); })[0]) || '';
      var d = Number(r.d) || 0;
      var x = by[e] || (by[e] = { org: org, branch: '', email: e, name: '', last: 0, n: 0, brs: {} });
      x.n++;
      if (br) x.brs[br] = (x.brs[br] || 0) + 1;
      if (d >= x.last) { x.last = d; var nm = String(r.f || '').trim(); if (nm && !/공단|위원회|관리자/.test(nm)) x.name = nm.slice(0, 20); }
    });
    return Object.keys(by).map(function (k) {
      var x = by[k], best = Object.keys(x.brs).sort(function (a, b) { return x.brs[b] - x.brs[a]; })[0] || '';
      return { org: x.org, branch: best, email: x.email, name: x.name, last: x.last, n: x.n };
    }).sort(function (a, b) {
      return a.org.localeCompare(b.org) || (a.branch ? 0 : 1) - (b.branch ? 0 : 1) || a.branch.localeCompare(b.branch) || b.last - a.last;
    });
  }
  function SENT_KIND_OF(group) { return group === '제안서·견적서' ? '제안서' : '계약서'; }

  var RE = /\x7b\x7b([^\x7b\x7d\n]{1,30})\x7d\x7d/g;
  /* 글자 본문에 든 표지 이름(나온 차례, 겹침 없이) */
  function markersIn(text) {
    var out = [], seen = {}, m; RE.lastIndex = 0;
    while ((m = RE.exec(String(text || '')))) { if (!seen[m[1]]) { seen[m[1]] = 1; out.push(m[1]); } }
    return out;
  }
  /* 글자 본문 채우기 — 표에 없는 이름·빈 값은 밑줄 */
  function fillText(text, V) {
    return String(text || '').replace(RE, function (_, k) {
      var v = V && V[k]; v = v == null ? '' : String(v);
      return v === '' ? BLANK : v;
    });
  }
  /* 한글 채우기에 넘길 값 — 문서에 있는 표지는 «모두» 넣는다(빈 값은 밑줄로 바뀐다) */
  function hwpValues(markers, V) {
    var out = {};
    (markers || []).forEach(function (k) { out[k] = (V && V[k] != null) ? String(V[k]) : ''; });
    return out;
  }
  /* ★ 값을 넣은 문단만 줄 정보를 걷는다 (HWPX section XML).
     문서 전체를 걷으면 rhwp 가 모든 줄을 제 자로 다시 나눠, 한 쪽에 꽉 찬 서식(CMS 신청서)이
     마지막 한 줄만 다음 쪽으로 넘쳤다(한글로 열어 확인 2026-09-27). 경력관리 dropLines 와 같은 생각.
     줄 정보(linesegarray)는 문단 끝에 있다 — 그 앞 가장 가까운 문단 시작부터의 글에 넣은 값이 있으면 걷는다. */
  function xmlEsc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function stripLinesegsFor(xml, vals) {
    var want = (vals || []).map(function (v) { return v == null ? '' : String(v); }).filter(function (v) { return v.length >= 2; })
      .map(xmlEsc);
    if (!want.length) return String(xml || '');
    var src = String(xml || ''), out = '', at = 0, re = /<hp:linesegarray(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/hp:linesegarray>)/g, m;
    while ((m = re.exec(src))) {
      var pStart = src.lastIndexOf('<hp:p ', m.index);
      var seg = src.slice(pStart < 0 ? 0 : pStart, m.index);
      var text = (seg.match(/<hp:t(?:\s[^>]*)?>[\s\S]*?<\/hp:t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join('');
      var hit = want.some(function (v) { return text.indexOf(v) >= 0; });
      out += src.slice(at, m.index) + (hit ? '' : m[0]);
      at = m.index + m[0].length;
    }
    return out + src.slice(at);
  }
  /* ══ 엑셀(.xlsx) 채우기 — XML 을 직접 고친다(모양·수식·그림은 그대로) ══
     SheetJS 로 다시 저장하면 칸 모양이 날아가서 쓰지 않는다. 틀은 「명단 한 줄에 표지」 꼴 —
     서식 시트들이 그 줄을 수식으로 끌어오고, 틀에 fullCalcOnLoad 가 있어 엑셀이 열 때 다시 계산한다.
     · 표지 하나만 든 글자 칸(inlineStr)은 값이 숫자면 숫자 칸, 날짜면 날짜 일련번호로 바꾼다
       (계약체결일을 EDATE 로 더하고, 공급대가를 셈에 쓰기 때문).
     · 모르는 값은 빈칸 — 엑셀 서식은 제 밑줄·칸이 있다(한글처럼 밑줄 글자를 넣지 않는다). */
  function unescXml(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
  function xlsxMarkers(xmls) {
    var txt = (xmls || []).map(function (x) {
      return (String(x || '').match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map(function (t) { return unescXml(t.replace(/<[^>]+>/g, '')); }).join('\n');
    }).join('\n');
    return markersIn(txt);
  }
  function excelDate(v) {
    var m = /^(\d{4})[-.\/년]\s*(\d{1,2})[-.\/월]\s*(\d{1,2})일?$/.exec(String(v).trim());
    if (!m) return null;
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  function excelNum(v) {
    var t = String(v).trim().replace(/,/g, '');
    return /^-?\d+(\.\d+)?$/.test(t) && t.length < 16 && !/^0\d/.test(t) ? +t : null;
  }
  var ONE = /^\x7b\x7b([^\x7b\x7d\n]{1,30})\x7d\x7d$/;
  function replaceRichText(xml, rep) {
    var changed = false;
    var out = String(xml || '').replace(/(<t(?:\s[^>]*)?>)([\s\S]*?)(<\/t>)/g, function (all, o, t, c) {
      var u = unescXml(t); RE.lastIndex = 0;
      if (!RE.test(u)) { RE.lastIndex = 0; return all; }
      RE.lastIndex = 0; changed = true; return o + xmlEsc(rep(u)) + c;
    });
    if (changed) return out;
    var combined = '';
    String(xml || '').replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function (all, t) { combined += unescXml(t); return all; });
    RE.lastIndex = 0; if (!RE.test(combined)) { RE.lastIndex = 0; return String(xml || ''); } RE.lastIndex = 0;
    var filledText = rep(combined), first = true;
    return String(xml || '').replace(/(<t(?:\s[^>]*)?>)([\s\S]*?)(<\/t>)/g, function (all, o, t, c) {
      var value = first ? filledText : ''; first = false; return o + xmlEsc(value) + c;
    });
  }
  function xlsxFill(xml, V) {
    var filled = 0;
    var val = function (k) { var v = V && V[k]; return v == null ? '' : String(v); };
    var rep = function (text) {
      return text.replace(RE, function (_, k) { var v = val(k); if (v !== '') filled++; return v; });
    };
    var out = String(xml || '').replace(/<c ([^>]*?)t="inlineStr"([^>]*)><is>([\s\S]*?)<\/is><\/c>/g, function (all, a1, a2, is) {
      var text = unescXml((is.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join(''));
      var m = ONE.exec(text.trim());
      if (m) {
        var v = val(m[1]), n = v === '' ? null : (excelDate(v) != null ? excelDate(v) : excelNum(v));
        if (n != null) { filled++; return '<c ' + (a1 + a2).replace(/\s+$/, '') + '><v>' + n + '</v></c>'; }
      }
      if (!RE.test(text)) { RE.lastIndex = 0; return all; }
      RE.lastIndex = 0;
      return '<c ' + a1 + 't="inlineStr"' + a2 + '><is>' + replaceRichText(is, rep) + '</is></c>';
    });
    /* 공유 글자도 si 안의 글꼴·줄바꿈·간격 노드를 그대로 둔다. */
    out = out.replace(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g, function (si) { return replaceRichText(si, rep); });
    return { xml: out, filled: filled };
  }
  /* 표시({{회사명}})가 없는 기존 엑셀도 「상호/사업자번호/대표자…」 오른쪽의 빈 서식칸을 채운다.
     셀을 새로 만들지는 않고, 이미 서식이 잡힌 바로 다음 빈 셀만 쓴다. 수식은 절대 덮지 않는다. */
  var XL_LABELS = {
    '회사명':'회사명','상호':'회사명','사업장명':'회사명','업체명':'회사명','사업자번호':'사업자번호','사업자등록번호':'사업자번호',
    '대표자':'대표자','대표자명':'대표자','소재지':'주소','사업장주소':'주소','주소':'주소','전화번호':'대표전화','대표전화':'대표전화',
    '팩스':'대표팩스','팩스번호':'대표팩스','이메일':'대표이메일','업태':'업태','종목':'종목','법인등록번호':'법인등록번호',
    '담당자':'담당자','담당자명':'담당자','담당자연락처':'담당자연락처','담당자이메일':'담당자이메일',
    '담당자직급':'담당자직급','직급':'담당자직급','담당자부서':'담당자부서','부서':'담당자부서',
    '담당자휴대폰':'담당자휴대폰','휴대폰':'담당자휴대폰','담당자전화':'담당자전화','담당자주소':'담당자주소'
  };
  function xlLabel(text) { return XL_LABELS[String(text || '').replace(/[\s:：·ㆍ()\[\]]/g, '')] || ''; }
  function sharedTexts(xml) {
    return (String(xml || '').match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g) || []).map(function (si) {
      return unescXml((si.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join(''));
    });
  }
  function cellText(cell, shared) {
    if (/\st="s"/.test(cell)) { var m = /<v>(\d+)<\/v>/.exec(cell); return m ? (shared[+m[1]] || '') : ''; }
    return unescXml((cell.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join(''));
  }
  function blankCell(cell) { return !/<f(?:\s|>)/.test(cell) && !/<v>[^<]+<\/v>/.test(cell) && !/<t(?:\s[^>]*)?>[\s\S]*?\S[\s\S]*?<\/t>/.test(cell); }
  function putCell(cell, value) {
    var open = /^<c\b([^>]*?)(?:\/>|>)/.exec(cell), attrs = open ? open[1] : '';
    attrs = attrs.replace(/\s+t="[^"]*"/g, '');
    var n = value === '' ? null : (excelDate(value) != null ? excelDate(value) : excelNum(value));
    if (n != null) return '<c' + attrs + '><v>' + n + '</v></c>';
    return '<c' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(value) + '</t></is></c>';
  }
  /* 병합 영역의 «왼쪽 위가 아닌» 칸 — 엑셀은 이 칸 값을 그리지 않는다(쓰면 안 보이는 값만 남는다) */
  function colNum(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; }
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function mergedInner(xml) {
    var out = {};
    String(xml || '').replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/g, function (all, c1, r1, c2, r2) {
      for (var c = colNum(c1); c <= colNum(c2); c++) for (var r = +r1; r <= +r2; r++) {
        if (c === colNum(c1) && r === +r1) continue;
        out[colName(c) + r] = 1;
      }
      return all;
    });
    return out;
  }
  function xlsxFillParts(names, xmls, V) {
    var out = (xmls || []).slice(), filled = 0, si = (names || []).indexOf('xl/sharedStrings.xml');
    /* ⚠ 표지가 하나라도 있으면 «표지 틀»이다 — 이름표 짐작을 하지 않는다(2026-10-03 6종 틀에서 18칸에 더 들어갔다) */
    var marked = xlsxMarkers(out).length > 0;
    out = out.map(function (x) { var r = xlsxFill(x, V); filled += r.filled; return r.xml; });
    if (marked) return { xmls: out, filled: filled };
    var shared = sharedTexts(si >= 0 ? out[si] : '');
    (names || []).forEach(function (name, ni) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) return;
      var inner = mergedInner(out[ni]);
      out[ni] = out[ni].replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, function (row) {
        var cells = row.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
        for (var i = 0; i + 1 < cells.length; i++) {
          var key = xlLabel(cellText(cells[i], shared)), value = key && V && V[key] != null ? String(V[key]) : '';
          if (!key || !value || !blankCell(cells[i + 1])) continue;
          var ref = (/\sr="([A-Z]+\d+)"/.exec(cells[i + 1]) || [])[1];
          if (ref && inner[ref]) continue;
          var newer = putCell(cells[i + 1], value); row = row.replace(cells[i + 1], newer); cells[i + 1] = newer; filled++;
        }
        return row;
      });
    });
    return { xmls: out, filled: filled };
  }
  function xlsxMarkersParts(names, xmls) {
    var out = xlsxMarkers(xmls), seen = {}; out.forEach(function (k) { seen[k] = 1; });
    if (out.length) return out;   // 표지 틀 — 이름표 짐작 키를 더하지 않는다(채우기와 같은 판정)
    var si = (names || []).indexOf('xl/sharedStrings.xml'), shared = sharedTexts(si >= 0 ? xmls[si] : '');
    (names || []).forEach(function (name, ni) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) return;
      var cells = String(xmls[ni] || '').match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
      cells.forEach(function (cell) { var k = xlLabel(cellText(cell, shared)); if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
    });
    return out;
  }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '서류'; }

  var api = {
    BLANK: BLANK, coNorm: coNorm, cardNorm: cardNorm, sameCo: sameCo, coInfoKeys: coInfoKeys, mergeCoInfo: mergeCoInfo,
    rowsOf: rowsOf, erpRows: erpRows, mergeRows: mergeRows, coConflicts: coConflicts, ntsCls: ntsCls, ntsWordOf: ntsWordOf, ntsEndOf: ntsEndOf, ntsView: ntsView, fieldSource: fieldSource, sameField: sameField, CO_FIELD_OF: CO_FIELD_OF, searchCompanies: searchCompanies, contactsOf: contactsOf,
    searchPeople: searchPeople, searchContacts: searchContacts,
    valuesFrom: valuesFrom, markersIn: markersIn, fillText: fillText, hwpValues: hwpValues, safeName: safeName,
    stripLinesegsFor: stripLinesegsFor, xlsxMarkers: xlsxMarkers, xlsxFill: xlsxFill,
    xlsxMarkersParts: xlsxMarkersParts, xlsxFillParts: xlsxFillParts, excelDate: excelDate,
    proposalValues: proposalValues, PROPOSAL_KEYS: PROPOSAL_KEYS, sendDate: sendDate,
    CASE_TASKS: CASE_TASKS, WORKER_TASKS: WORKER_TASKS, CASE_KEYS: CASE_KEYS, caseValues: caseValues,
    mailDefaults: mailDefaults, sentKeys: sentKeys, sentRecord: sentRecord, SENT_KIND_OF: SENT_KIND_OF, agencyBook: agencyBook, agencyOrgOf: agencyOrgOf,
    lawyersLine: lawyersLine, setLawyers: setLawyers, lawyersNow: lawyersNow, LAWYERS_FALLBACK: LAWYERS_FALLBACK
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuFormCardFill = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
