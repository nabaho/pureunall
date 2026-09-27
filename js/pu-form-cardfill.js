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
    ['email', 'e'], ['bizType', 'bt'], ['bizItem', 'bi'], ['smeType', 'sme'], ['workers', 'wk']];
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
    cards.forEach(function (r) {
      if (r.k === 'biz' && (claimed['b' + digits(r.bz)] || claimed['n' + sameCo(r.c)])) return;
      out.push(r);
    });
    return out;
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
      오늘날짜: today, 오늘: today, 작성일: today, 계약일: today
    };
    /* 엑셀 틀(급여위임계약서_양식)은 주소를 MID(주소,8,…) 로 잘라 쓴다 — 앞 8글자가 「(31068) 」 꼴이라 여긴다.
       우편번호가 없으면 같은 길이의 빈 괄호를 붙여 글자가 잘리지 않게 한다. */
    V.우편주소 = !V.주소 ? '' : (/^\(\d{5}\) /.test(V.주소) ? V.주소 : '(     ) ' + V.주소);
    V.근로자상세 = [V.근로자명, V.근로자주소, V.근로자연락처].filter(Boolean).join(' · ');
    return V;
  }

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
  function xlsxFillParts(names, xmls, V) {
    var out = (xmls || []).slice(), filled = 0, si = (names || []).indexOf('xl/sharedStrings.xml');
    out = out.map(function (x) { var r = xlsxFill(x, V); filled += r.filled; return r.xml; });
    var shared = sharedTexts(si >= 0 ? out[si] : '');
    (names || []).forEach(function (name, ni) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) return;
      out[ni] = out[ni].replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, function (row) {
        var cells = row.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [], changed = false;
        for (var i = 0; i + 1 < cells.length; i++) {
          var key = xlLabel(cellText(cells[i], shared)), value = key && V && V[key] != null ? String(V[key]) : '';
          if (!key || !value || !blankCell(cells[i + 1])) continue;
          var newer = putCell(cells[i + 1], value); row = row.replace(cells[i + 1], newer); cells[i + 1] = newer; filled++; changed = true;
        }
        return row;
      });
    });
    return { xmls: out, filled: filled };
  }
  function xlsxMarkersParts(names, xmls) {
    var out = xlsxMarkers(xmls), seen = {}; out.forEach(function (k) { seen[k] = 1; });
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
    rowsOf: rowsOf, erpRows: erpRows, mergeRows: mergeRows, searchCompanies: searchCompanies, contactsOf: contactsOf,
    searchPeople: searchPeople, searchContacts: searchContacts,
    valuesFrom: valuesFrom, markersIn: markersIn, fillText: fillText, hwpValues: hwpValues, safeName: safeName,
    stripLinesegsFor: stripLinesegsFor, xlsxMarkers: xlsxMarkers, xlsxFill: xlsxFill,
    xlsxMarkersParts: xlsxMarkersParts, xlsxFillParts: xlsxFillParts, excelDate: excelDate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuFormCardFill = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
