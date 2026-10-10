'use strict';
// 푸른노무법인 경력관리 — pu-erp 실적 동기화 순수 모듈
// (브라우저 window.KcareerPuSync / Node module.exports 겸용, DOM·Firebase 미사용)
// 설계서: docs/superpowers/specs/2026-08-01-kcareer-실적동기화-design.md
(function (root) {

  /* ===== 종료 판별 =====
     pu-erp 상태값은 closed·done·완료가 혼재하고 UI 상태(active·saving)와 필드명이 같다.
     ⚠ endDate만 있는 건은 예정일일 수 있으므로 미종료로 본다(기존 화면의 "(예정)" 해석과 동일). */
  var CLOSED_STATUS = ['closed', 'done', '완료', '종료'];
  function isClosed(c) {
    if (!c) return false;
    if (c.closedDate) return true;
    var s = String(c.status || '').toLowerCase();
    return CLOSED_STATUS.indexOf(s) >= 0;
  }

  /* 주담당 sid: managerMain → workers의 isPrimary → 첫 번째 (kcareer._puMainMgr와 동일 규칙) */
  function mainSid(c) {
    var sid = c.managerMain || '';
    if (!sid && Array.isArray(c.workers)) {
      var w = c.workers.find(function (x) { return x && x.isPrimary; }) || c.workers[0];
      if (w) sid = w.sid || '';
    }
    return String(sid || '');
  }

  /* ===== 업체(자문·고문) 종료 판별 =====
     ⚠ 사업(사건·컨설팅)과 잣대가 «다르다». 업체관리는 해지하면 status 를 active 에서 바꾸고
       closedDate·closedReason(계약만료/계약해지/폐업/법인전환…)을 남긴다.
       사업 쪽 isClosed 를 그대로 쓰면 해지된 업체가 영원히 「진행」으로 남는다. */
  function isCoClosed(c) {
    if (!c) return false;
    if (c.closedDate) return true;
    return String(c.status || 'active') !== 'active';
  }

  /* ===== 필드 매핑 (설계서 §4 표) =====
     ⚠★ `contracts` 를 여기에 넣지 말 것 — 그것은 「상담접수 → 계약협의 → 계약확정」
       파이프라인이고, 계약이 확정되면 업체관리(companies)로 «이관»된다.
       contracts 를 가져오면 아직 계약도 안 된 곳이 자문 실적으로 센다(회귀검사 있음).
       노무법인이 «수행한» 자문·고문의 실체는 companies 다. */
  var COLL_MAP = {
    cases:          { store: 'case',    type: ['caseType'],                        proj: ['title', 'caseNo'] },
    consultings:    { store: 'consult', type: ['consultingType', 'programName'],   proj: ['title', 'programName'] },
    funds:          { store: 'fund',    type: ['fundType', 'programName'],         proj: ['title'] },
    other_projects: { store: 'etc',     type: ['programName', 'projectType'],      proj: ['title'] },
    companies:      { store: 'advisory', type: [], proj: [], kind: 'company' }
  };

  /* ===== 영구 연결 열쇠 (온톨로지 검토 2026-09-29) =====
     ⚠★ 예전 열쇠는 'cases/3' — 3 은 이알피 목록의 «몇 번째 줄»이었다(배열 저장이라서).
       이알피에서 사건 하나를 지우면 줄이 밀려, 경력관리의 실적이 «남의 사건» 상태로
       덮일 수 있었다. 이제 이알피 레코드의 영구 id 로 잇는다: 'cases#<id>'.
     ⚠ 이알피 관리번호(산재등-2026-901)는 «이름표»다 — 컨설팅은 계약일 순으로 번호를 다시
       매기기도 한다(reorderConsultingNos). 그래서 열쇠로 쓰지 않고 sourceNo 로 «보여만» 준다.
     ⚠ id 가 없는 옛 레코드만 줄 번호 열쇠('cases/3')를 그대로 쓰고 puRefWeak 로 표시한다 —
       그런 건의 상태 갱신은 업체 이름이 여전히 같을 때만 한다(아래 buildStatusUpdates). */
  var KIND_OF = { cases: 'case', consultings: 'consulting', funds: 'fund', other_projects: 'other', companies: 'company' };
  function _idOf(c) { return (c && c.id != null) ? String(c.id).trim() : ''; }
  function refOf(coll, key, c) {
    var id = _idOf(c);
    return id ? (coll + '#' + id) : (coll + '/' + key);
  }
  function isIdRef(ref) { return /^[a-z_]+#./.test(String(ref || '')); }
  /* 이알피 관리번호 — 사건 caseNo, 컨설팅·기금·기타·업체 no */
  function sourceNoOf(coll, c) {
    if (!c) return '';
    return String(c.caseNo || c.no || c.projectNo || '').trim();
  }

  /* 컬렉션마다 종료 잣대가 다르다 — 업체만 isCoClosed 를 쓴다 */
  function collClosed(coll, c) {
    return (COLL_MAP[coll] && COLL_MAP[coll].kind === 'company') ? isCoClosed(c) : isClosed(c);
  }
  function pick(c, keys) { for (var i = 0; i < keys.length; i++) { if (c[keys[i]]) return c[keys[i]]; } return ''; }

  /* 사건번호에서 유형·연도를 뽑는다.
     pu-erp 사건은 caseType이 비어 있고 진행중이면 종료일도 없는데,
     사건번호가 '부해등-2026-003' 꼴이라 둘 다 여기 들어 있다(실사용에서 확인). */
  var CASENO_RE = /^\s*([^\-\s][^\-]*?)\s*-\s*(20\d{2})\s*-\s*\d+/;
  function fromCaseNo(no) {
    var m = CASENO_RE.exec(String(no || ''));
    return m ? { type: m[1].trim(), year: m[2] } : null;
  }

  /* ===== 유형 코드표 =====
     pu-erp는 유형을 코드로 저장하고(c.typeCodes.consulting 또는 c.typeCode),
     코드표(biz_cons_types 등)에 이름과 수행기관이 함께 있다.
     예) cons-job-neung → 산업일자리 / 한국능률협회 (실사용에서 확인).
     수행기관이 채워지면 kcareer가 그 건을 외부기관 실적으로 분류한다. */
  var TYPEMAP_KEY = { cases: 'case', consultings: 'consulting', funds: 'fund', other_projects: 'other',
                      companies: 'company' };
  function typeCodeOf(coll, c) {
    var k = TYPEMAP_KEY[coll];
    if (c.typeCodes && k && c.typeCodes[k]) return String(c.typeCodes[k]);
    return String(c.typeCode || '');
  }
  function lookupType(coll, c, typeMap) {
    var k = TYPEMAP_KEY[coll];
    var list = (typeMap && k && typeMap[k]) || null;
    if (!list || !list.length) return null;
    var code = typeCodeOf(coll, c);
    if (!code) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].code) === code) return list[i];
    }
    return null;
  }

  /* ===== 업체관리 한 줄 → 자문·고문 실적 =====
     ⚠★ 월 자문료(monthlyAdvisoryFee)를 «절대 담지 않는다». pu-erp 자신도 canSeeAmount()로
       가리는 값이고, 공모 지원에 쓸 일이 없다. 담으면 유출 위험만 늘어난다(회귀검사 있음).
     ⚠ 연도는 «자문을 시작한 해»(contractStartDate)다. 해지연도로 바꾸면 「언제부터
       자문해 왔는가」를 잃는다 — 그것이 공모 평가에서 보는 값이다. */
  function mapCompany(key, c, userMap, typeMap) {
    var sid = mainSid(c);
    var t = lookupType('companies', c, typeMap);
    var start = String(c.contractStartDate || '').trim();
    var closed = isCoClosed(c);
    var endRaw = String(c.closedDate || c.contractEndDate || '').trim();
    return {
      store: 'advisory',
      rec: {
        /* 유형은 코드표(biz_company_types)에서만 온다 — 모르면 비워 둔다 */
        type: (t && t.name) || '',
        org: c.name || '',
        /* 고객사 이름 없이 실적을 세기 위한 칸 — 업태·종목·규모·근로자 수 */
        bizType: c.bizType || '',
        bizCategory: c.bizCategory || '',
        size: c.companySize || '',
        insured: Number(c.employmentInsuredCount) || 0,
        year: start.slice(0, 4),
        /* 화면에 보일 글자와 «셈에 쓸 날짜»를 함께 담는다 —
           평균 자문기간을 세려면 period 문자열이 아니라 날짜가 필요하다 */
        start: start,
        end: (closed && endRaw) ? endRaw : '',
        period: start ? (start + ' ~ ' + ((closed && endRaw) ? endRaw : '현재')) : '',
        main: (userMap && userMap[sid]) || sid,
        status: closed ? '종료' : '진행',
        closedReason: c.closedReason || '',
        puRef: refOf('companies', key, c)
      }
    };
  }

  /* ===== 업체 중 «자문·고문» 고객만 ===== (2026-10-03 대표 지시 「672 고쳐」)
     ⚠★ 업체관리(companies)에는 자문만 있는 것이 아니다 — 실측 377곳 = 자문 197 · 급여 171 · 기금 7 · 노조 2.
        종류를 안 가려 «급여 고객»까지 자문·고문 실적으로 들어왔다(신청 재료에 672개사).
        지원서에 «자문 실적»으로 나가면 사실과 다르다 → 종류가 자문인 업체만 받는다.
     ⚠ 잣대는 이 함수 «한 곳» — 가져오기(mapRecord)와 정리(buildAdvisoryPrune)가 같이 쓴다.
     ⚠ 종류 코드는 '자문'(pu-erp COMPANY_TYPE_SEED). 코드표에서 이름을 바꿔 써도 알아보게
        이름·줄임말에 「자문」「고문」이 들면 받는다. 모르는 종류는 «받지 않는다». */
  function isAdvisoryCompany(c, typeMap) {
    if (!c) return false;
    var code = typeCodeOf('companies', c);
    if (code === '자문') return true;
    var t = lookupType('companies', c, typeMap);
    return !!(t && /자문|고문/.test(String(t.name || '') + String(t.short || '')));
  }

  function mapRecord(coll, key, c, userMap, typeMap) {
    var m = COLL_MAP[coll];
    if (!m || !c) return null;
    if (m.kind === 'company') return isAdvisoryCompany(c, typeMap) ? mapCompany(key, c, userMap, typeMap) : null;
    var sid = mainSid(c);
    var dateRaw = c.closedDate || c.endDate || '';
    var proj = pick(c, m.proj);
    var cn = fromCaseNo(c.caseNo || proj);
    var t = lookupType(coll, c, typeMap);
    var out = {
      store: m.store,
      rec: {
        type: pick(c, m.type) || (t ? (t.name || '') : '') || (cn ? cn.type : ''),
        /* 수행기관은 코드표에서만 온다 — 비면 푸른 자체 실적(내부 탭) */
        agency: (t && t.agency) || '',
        org: c.companyName || c.payee || '',
        project: proj,
        year: String(dateRaw).slice(0, 4) || (cn ? cn.year : '') || yearOf(coll, c),
        main: (userMap && userMap[sid]) || sid,
        /* 진행중도 가져온다(실사용: 사건 13건 중 11건이 진행중이었다).
           상태를 그대로 옮겨 두고, 증명서 발급은 '완료' 건만 고르게 한다. */
        status: isClosed(c) ? '완료' : '진행',
        puRef: refOf(coll, key, c)
      }
    };
    /* 💰 금액(공급가액) — 있을 때만 칸을 만든다. 출처를 함께 적어 다음 동기화가 따라 고칠 수 있게 */
    var 돈 = amountOf(coll, c);
    if (돈) { out.rec.amt = String(돈); out.rec.amtFrom = 'erp'; }
    return out;
  }
  /* 온톨로지 연결 칸 — 실적은 이알피 원본에서 «나온» 것(derivedFrom).
     sourceId 가 비면 영구 연결이 아니다(puRefWeak). */
  function withSource(m, coll, c) {
    if (!m) return m;
    var id = _idOf(c);
    m.rec.sourceKind = KIND_OF[coll] || '';
    m.rec.sourceId = id;
    m.rec.sourceNo = sourceNoOf(coll, c);
    if (!id) m.rec.puRefWeak = true;
    return m;
  }

  /* ===== pu-erp 저장 봉투 벗기기 =====
     pu-erp는 data/{키} = { v:실제값, u:갱신시각 } 형태로 저장하고 자신은 data/{키}/v 로 읽는다.
     봉투를 안 벗기면 컬렉션마다 v·u 두 개가 레코드로 세어져 유령 8건이 생긴다(실사용에서 발견). */
  function unwrap(val) {
    if (val && typeof val === 'object' && !Array.isArray(val) &&
        Object.prototype.hasOwnProperty.call(val, 'v')) return val.v;
    return val;
  }

  /* 같은 실적«일 수도» 있는지 — 기관·연도로 «후보»만 고른다.
     ⚠★ 이것으로 자동 연결하지 않는다(온톨로지: 이름으로 관계 열쇠를 삼지 않는다).
       한 업체에 같은 해 사건이 두 건이면 아무 쪽에나 붙었다. 사람이 고른 것만 잇는다. */
  function _norm(s) { return String(s || '').replace(/[\s\(\)（）\-·,㈜]/g, '').toLowerCase(); }
  function _sameWork(rec, r) {
    if (!r || r.puRef) return false;                 /* 이미 pu와 이어진 건은 대상 아님 */
    if (r.store && r.store !== rec._store) return false;
    var a = _norm(rec.org), b = _norm(r.org);
    if (!a || !b || a !== b) return false;           /* 기관(고객사)이 다르면 다른 건 */
    if (rec.year && r.year && rec.year !== r.year) return false;
    return true;
  }

  /* ===== 병합 계획 =====
     추가만 계획한다. 다만 이어지지 않은 기존 실적(시드 등)에 같은 업체·같은 해 것이 있으면
     새로 만들지도, 붙이지도 않고 «연결 제안(suggests)»으로 둔다 — 사람이 미리보기에서
     「이 실적에 연결 / 새로 추가 / 보류」 중 하나를 고른다(중복 방지 — 실사용에서 컨설팅 17건이 겹쳤다).
     plan.links 는 비어서 나온다 — 사람이 고른 것을 화면이 채운다. */
  /* ===== 자문·고문 창고 정리 =====
     이미 들어온 줄 중 «지금 이알피의 자문 업체»와 이어지지 않은 것을 골라낸다.
     ⚠★ 이알피를 못 읽었거나 자문 업체가 0곳이면 «아무것도 빼지 않는다» — 읽기 실패로 실적이 통째로 사라지면 안 된다.
     ⚠ 손으로 넣은 줄(puRef 없음)은 건드리지 않는다.
     ⚠ 빼는 것은 부르는 쪽이 «휴지통»으로 보낸다(지우지 않는다).
     돌려주는 것: drop [{id, reason}] · retype [{id, type}] (이알피에서 종류만 자문으로 바뀐 줄) */
  function buildAdvisoryPrune(collData, rows, typeMap) {
    var out = { drop: [], retype: [], liveAdvisory: 0 };
    var v = unwrap(collData ? collData.companies : null);
    if (!v || typeof v !== 'object') return out;
    var live = {};                                        /* ref → 업체 */
    Object.keys(v).forEach(function (key) {
      var c = v[key]; if (!c) return;
      live['companies/' + key] = c;
      var id = _idOf(c); if (id) live['companies#' + id] = c;
      if (isAdvisoryCompany(c, typeMap)) out.liveAdvisory++;
    });
    if (!out.liveAdvisory) return out;
    var t = (typeMap && typeMap.company) || [];
    var advName = (t.filter(function (x) { return x && String(x.code) === '자문'; })[0] || {}).name || '자문';
    (rows || []).forEach(function (r) {
      if (!r || !r.puRef || String(r.puRef).indexOf('companies') !== 0) return;
      var c = live[r.puRef];
      if (!c) { out.drop.push({ id: r.id, reason: '이알피에 없는 업체(옛 번호·겹친 줄)' }); return; }
      if (!isAdvisoryCompany(c, typeMap)) {
        out.drop.push({ id: r.id, reason: '자문이 아닌 업체(' + (typeCodeOf('companies', c) || '종류 모름') + ')' });
        return;
      }
      if (r.type !== advName) out.retype.push({ id: r.id, type: advName });
    });
    return out;
  }

  function buildSyncPlan(collData, existingRefs, userMap, typeMap, existingRecords) {
    var known = (existingRefs instanceof Set) ? existingRefs : new Set(existingRefs || []);
    var pool = (existingRecords || []).slice();
    var plan = { adds: [], links: [], suggests: [], counts: { case: 0, consult: 0, fund: 0, etc: 0, advisory: 0 },
                 skippedOpen: 0, skippedKnown: 0, closedCount: 0, openCount: 0 };
    Object.keys(COLL_MAP).forEach(function (coll) {
      var v = unwrap(collData ? collData[coll] : null);
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach(function (key) {
        var c = v[key];
        if (!c) return;                                       /* Firebase 배열형의 null 구멍 */
        var ref = refOf(coll, key, c);
        if (known.has(ref)) { plan.skippedKnown++; return; }
        var m = withSource(mapRecord(coll, key, c, userMap, typeMap), coll, c);
        if (!m) return;
        /* 같은 업체·같은 해의 이어지지 않은 실적이 있으면 «제안»으로 둔다 — 자동으로 붙이지 않는다 */
        m.rec._store = m.store;
        var cands = pool.filter(function (r) { return _sameWork(m.rec, r); });
        delete m.rec._store;
        if (cands.length) {
          plan.suggests.push({ add: m, cands: cands.map(function (h) {
            return { id: h.id, store: h.store, org: h.org || '', year: h.year || '', project: h.project || '' }; }) });
          return;
        }
        /* 진행중도 담는다 — 종료만 받으면 실적이 영원히 안 들어온다(실사용) */
        if (collClosed(coll, c)) plan.closedCount++; else plan.openCount++;
        plan.adds.push(m);
        plan.counts[m.store]++;
      });
    });
    return plan;
  }

  /* ===== 상태 맞추기 =====
     진행중으로 가져온 건이 pu-erp에서 종료되면 상태·연도만 맞춘다.
     다른 필드는 손대지 않는다 — 사람이 고친 내용을 덮어쓰지 않기 위해서다. */
  function buildStatusUpdates(collData, existingRecords) {
    var byRef = _indexByRef(collData);
    var out = [];
    (existingRecords || []).forEach(function (r) {
      if (!r || !r.puRef) return;                      /* 손으로 등록한 건은 건드리지 않는다 */
      if (r.puRefCheck) return;                        /* 연결이 어긋나 사람 확인을 기다리는 건 — 덮지 않는다 */
      var hit = byRef[r.puRef];
      if (!hit) return;                                /* pu-erp에서 사라진 건 */
      var c = hit.c;
      /* ⚠ 줄 번호 열쇠는 그 줄에 «다른 건»이 와 있을 수 있다 — 업체가 같을 때만 믿는다 */
      if (!isIdRef(r.puRef) && !_sameOrg(r, hit)) return;
      var isCo = (COLL_MAP[hit.coll] || {}).kind === 'company';
      if (isCo) {
        /* 자문·고문이 해지됐다 — 상태만 「종료」로 바꾼다.
           ⚠ 연도는 손대지 않는다. 자문 실적의 연도는 «시작한 해»이고,
             해지연도로 덮으면 「언제부터 자문해 왔는가」를 잃는다. */
        if (isCoClosed(c) && r.status !== '종료') {
          out.push({ puRef: r.puRef, status: '종료', year: r.year || '' });
        }
        return;
      }
      if (isClosed(c) && r.status !== '완료') {
        var d = c.closedDate || c.endDate || '';
        out.push({ puRef: r.puRef, status: '완료', year: String(d).slice(0, 4) || r.year || '' });
      }
    });
    return out;
  }

  /* 이알피 자료를 열쇠로 찾는 표 — 영구 열쇠('cases#id')와, id 없는 옛 건만 줄 번호 열쇠 */
  function _indexByRef(collData) {
    var byRef = {};
    Object.keys(COLL_MAP).forEach(function (coll) {
      var v = unwrap(collData ? collData[coll] : null);
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach(function (key) {
        var c = v[key];
        if (!c) return;
        byRef[refOf(coll, key, c)] = { coll: coll, key: key, c: c };
      });
    });
    return byRef;
  }
  function _orgOf(coll, c) { return (COLL_MAP[coll] || {}).kind === 'company' ? (c.name || '') : (c.companyName || c.payee || ''); }
  function _sameOrg(r, hit) {
    var a = _norm(r.org), b = _norm(_orgOf(hit.coll, hit.c));
    return !!a && a === b;
  }

  /* ===== 옛 줄 번호 열쇠 옮겨 적기 (읽기만 — 바꿀 목록을 돌려준다) =====
     'cases/3' 을 가진 실적마다 이알피의 그 자리를 본다.
       ① 이알피가 id 지도로 저장돼 있고 열쇠가 곧 id → 그대로 영구 열쇠로(자리가 안 밀린다)
       ② 배열(줄 번호)인데 그 줄의 업체와 내용이 실적과 같다 → 영구 열쇠로
       ③ 그 줄이 비었거나 다른 건이다 → «확인 필요»(broken). 자동으로 다른 건을 찾아 붙이지 않는다.
       ④ 그 줄에 id 가 없다 → 업체가 같으면 약한 열쇠로 두고(weak), 다르면 ③
     ⚠ 관리번호만 같다고 붙이지 않는다 — 번호는 다시 매겨진다.
     ⚠ 업체·내용 대조는 «이미 있던 연결이 아직 맞는지» 확인할 뿐이다. 새 연결을 짓지 않는다. */
  function buildRefMigration(collData, records) {
    var out = { upgrades: [], broken: [], weak: [] };
    (records || []).forEach(function (r) {
      if (!r || !r.puRef || isIdRef(r.puRef)) return;
      var seg = String(r.puRef).split('/');
      var coll = seg[0], key = seg.slice(1).join('/');
      if (!COLL_MAP[coll]) return;
      var v = unwrap(collData ? collData[coll] : null);
      var c = (v && typeof v === 'object') ? v[key] : null;
      if (!c) { out.broken.push({ id: r.id, store: r.store, oldRef: r.puRef, reason: 'gone' }); return; }
      var id = _idOf(c);
      var hit = { coll: coll, key: key, c: c };
      if (!id) {
        if (_sameOrg(r, hit)) out.weak.push({ id: r.id, store: r.store, puRef: r.puRef });
        else out.broken.push({ id: r.id, store: r.store, oldRef: r.puRef, reason: 'moved' });
        return;
      }
      var ok = !Array.isArray(v) && key === id;       /* ① 지도 저장 — 열쇠가 곧 id */
      if (!ok && _sameOrg(r, hit)) {                   /* ② 줄 번호 — 그 줄이 아직 같은 건인가 */
        var p = String(r.project || '').trim();
        /* 내용이 빈 옛 실적·자문(업체마다 한 줄)은 업체가 같으면 된다 */
        ok = !p || COLL_MAP[coll].kind === 'company' ||
             [c.title, c.caseNo, c.no, c.programName].some(function (x) { return x && String(x).trim() === p; });
      }
      if (ok) out.upgrades.push({ id: r.id, store: r.store, oldRef: r.puRef, puRef: coll + '#' + id,
                                   sourceKind: KIND_OF[coll] || '', sourceId: id, sourceNo: sourceNoOf(coll, c) });
      else out.broken.push({ id: r.id, store: r.store, oldRef: r.puRef, reason: 'moved' });
    });
    return out;
  }

  /* ===== 관리번호 새로 고침 =====
     관리번호는 이름표라 이알피에서 바뀔 수 있다 — 영구 열쇠로 이어진 건만 따라 고친다. */
  function buildNoUpdates(collData, existingRecords) {
    var byRef = _indexByRef(collData), out = [];
    (existingRecords || []).forEach(function (r) {
      if (!r || !isIdRef(r.puRef) || r.puRefCheck) return;
      var hit = byRef[r.puRef];
      if (!hit) return;
      var no = sourceNoOf(hit.coll, hit.c);
      if (no && no !== (r.sourceNo || '')) out.push({ puRef: r.puRef, sourceNo: no });
    });
    return out;
  }

  /* ===== 💰 금액 (대표 지시 2026-10-09 「이알피금액도 받아오게」) =====
     예전에는 «금액은 안 담는다»였다(계약서와 엮인 값이라 이알피가 원본). 이제 받아 온다 — 다만
     ⚠ 이알피가 «원본»인 것은 그대로다: 받은 금액에는 amtFrom:'erp' 를 달고, 사람이 손으로 적은 금액은 덮지 않는다.
     ■ 이알피가 보이는 «받을 돈»과 같은 셈이다(pu-erp erpUnpaidParts):
        계약금(contractFee) + 잔금(balanceFee) + 옛 한 칸 컨설팅비(consultingFee).
        ⚠ fee 칸은 더하지 않는다 — 계약서에서 넘어올 때 계약금과 «같은 값»을 한 번 더 적어 둔 것이다.
     ■ 부가세가 들고 안 들고가 건마다 다르다(contractFeeVatIncluded·balanceFeeVatIncluded) —
        섞인 채로 더하면 셈이 틀린다. 그래서 «공급가액»(부가세 뺀 값)으로 맞춘다: 포함이면 ÷1.1 반올림.
     ⚠ 사건(cases)은 안 받는다 — 성공보수가 %(승소금액 기준)라 확정 금액이 아니다. */
  function _n(v) { var x = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isFinite(x) && x > 0 ? x : 0; }
  function amountOf(coll, c) {
    if (!c || coll === 'cases' || coll === 'companies') return 0;
    var 공급 = function (v, vat) { var x = _n(v); return vat === true ? Math.round(x / 1.1) : x; };
    return 공급(c.contractFee, c.contractFeeVatIncluded) + 공급(c.balanceFee, c.balanceFeeVatIncluded) + _n(c.consultingFee);
  }
  /* 이미 가져온 실적의 금액을 이알피에 맞춘다 — 영구 열쇠로 이어진 건만(줄 번호 열쇠는 다른 건일 수 있다).
     ⚠ 비어 있거나 «이알피에서 받은 금액»인 것만 고친다. 사람이 적은 금액은 그대로 둔다. */
  function buildAmtUpdates(collData, existingRecords) {
    var byRef = _indexByRef(collData), out = [];
    (existingRecords || []).forEach(function (r) {
      if (!r || !isIdRef(r.puRef) || r.puRefCheck) return;
      var hit = byRef[r.puRef]; if (!hit) return;
      var amt = amountOf(hit.coll, hit.c);
      var 지금 = _n(r.amt);
      /* 이알피에서 금액이 지워졌는데(0) 예전에 받은 금액이 남아 있으면 비운다 — 안 비우면 영영 셈에 남는다 */
      if (!amt) { if (지금 && r.amtFrom === 'erp') out.push({ puRef: r.puRef, amt: '' }); return; }
      if (지금 && r.amtFrom !== 'erp') return;                 /* 사람이 적은 금액 */
      if (지금 === amt && r.amtFrom === 'erp') return;          /* 이미 같다 */
      out.push({ puRef: r.puRef, amt: String(amt) });
    });
    return out;
  }

  /* ===== 📅 연도 (대표 지시 2026-10-10 「년도모름도 채워라」) =====
     실적 연도는 «끝난 해»(closedDate·endDate)다 — 그대로다. 아직 안 끝난 건은 그동안 빈칸(«모름»)이었다
     (실측: 모름 58건이 모두 이알피의 «진행 중» 건, 시작일은 57건에 있다).
     → 끝난 날이 없으면 «시작한 해»(startDate·contractDate·signDate), 그것도 없으면 관리번호 속 해(기술보호-2026-015).
     ⚠ 지어내지 않는다 — 이알피에 적힌 날짜·번호에서만 읽는다. 아무것도 없으면 그대로 «모름».
     ⚠ 나중에 끝나면 buildStatusUpdates 가 «끝난 해»로 고친다(완료 갱신 때 연도도 함께). */
  function _y(v) { var m = String(v || '').match(/(19|20)\d{2}/); return m ? m[0] : ''; }
  function yearOf(coll, c) {
    if (!c) return '';
    return _y(c.closedDate) || _y(c.endDate) || _y(c.startDate) || _y(c.contractDate) || _y(c.signDate)
      || _y(sourceNoOf(coll, c));
  }
  /* 이미 가져온 실적 중 연도가 «비어 있는» 것만 채운다 — 영구 열쇠로 이어진 건만. 적혀 있는 연도는 안 건드린다 */
  function buildYearUpdates(collData, existingRecords) {
    var byRef = _indexByRef(collData), out = [];
    (existingRecords || []).forEach(function (r) {
      if (!r || !isIdRef(r.puRef) || r.puRefCheck) return;
      if (String(r.year || '').trim()) return;
      var hit = byRef[r.puRef]; if (!hit) return;
      if ((COLL_MAP[hit.coll] || {}).kind === 'company') return;     /* 자문은 «시작한 해»를 이미 따로 다룬다 */
      var y = yearOf(hit.coll, hit.c);
      if (y) out.push({ puRef: r.puRef, year: y });
    });
    return out;
  }

  var api = { yearOf: yearOf, buildYearUpdates: buildYearUpdates,
              amountOf: amountOf, buildAmtUpdates: buildAmtUpdates,
              isClosed: isClosed, isCoClosed: isCoClosed, mapRecord: mapRecord, buildSyncPlan: buildSyncPlan,
              buildStatusUpdates: buildStatusUpdates, unwrap: unwrap, fromCaseNo: fromCaseNo,
              refOf: refOf, isIdRef: isIdRef, sourceNoOf: sourceNoOf,
              buildRefMigration: buildRefMigration, buildNoUpdates: buildNoUpdates,
              isAdvisoryCompany: isAdvisoryCompany, buildAdvisoryPrune: buildAdvisoryPrune };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerPuSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
