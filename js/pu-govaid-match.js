/* pu-govaid-match.js — 정부지원금: 사업장 하나 × 지원사업 하나의 조건 판정 (2026-10-11)
   설계: docs/superpowers/specs/2026-10-11-govaid-design.md (4·5절)

   ■ 순수 함수다 — 읽기·쓰기·화면이 없다. 브라우저 window.GovaidMatch · Node require 겸용.
   ■ 판정은 «후보»일 뿐이다. 해당·보류·비해당은 노무사가 누른다(govaid/reviews).
   ■ 값이 없으면 «모름»이다 — 0 으로 보지 않는다. 0 은 값이다(0명은 0명).
   ■ 확정(confirmed) + 올해 기준(baseYear >= 올해)인 조건만 쓴다. 해가 바뀌면 «계산에서만» 초안으로 본다
     — 자료를 고쳐 쓰지 않는다. 조건이 하나도 없는 사업도 계산하지 않는다(모든 회사가 후보로 쏟아진다).
   ⚠ 국민연금 «가입자 수»는 법의 «상시 근로자 수»와 같지 않다. 출처 꼬리표(src)로 그 차이를 화면에 남긴다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GovaidMatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 업체관리(pu-erp.html) companySize 와 같은 낱말 — «기타»·빈칸은 모름 */
  var SIZES = ['소기업', '중기업', '중견기업', '대기업', '공공기관'];
  var REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원',
    '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  /* 한국표준산업분류 대분류 */
  var INDUSTRIES = {
    A: '농업·임업·어업', B: '광업', C: '제조업', D: '전기·가스·증기', E: '수도·하수·폐기물',
    F: '건설업', G: '도매·소매업', H: '운수·창고업', I: '숙박·음식점업', J: '정보통신업',
    K: '금융·보험업', L: '부동산업', M: '전문·과학·기술 서비스업', N: '사업시설관리·사업지원·임대 서비스업',
    O: '공공행정·국방·사회보장', P: '교육 서비스업', Q: '보건업·사회복지 서비스업', R: '예술·스포츠·여가',
    S: '협회·단체·수리·기타 개인 서비스업', T: '가구 내 고용활동', U: '국제·외국기관'
  };
  /* 사람만 답할 수 있는 «예/아니오» 사실 — 사업마다 이름이 갈라지지 않게 «이 목록에서만» 고른다 */
  var FACTS = {
    prioritySupport: '우선지원대상기업이다',
    smeCert: '중소기업 확인서가 있다',
    retireAgePolicy: '정년 제도가 있다',
    hasWorkers60: '만 60세 이상 근로자가 있다',
    hasFixedTerm: '기간제 근로자가 있다',
    hiredYouth: '최근 청년을 채용했다',
    flexWork: '유연근무·근로시간 단축을 운영한다'
  };
  /* 필요서류 낱말표 (대표 지시 2026-10-12 「사업장에 필요서류. 취업규칙 근로계약서 등등 … 구체적으로 정리」).
     사업마다 서류 이름이 갈라지면 회사별 «준비할 서류»로 모을 수 없다 — 사업의 docs[].key 는 이 목록에서만 고른다.
     labor:true = 노무 서류(노무법인이 만들어·정리해 줄 수 있는 것). 차례가 화면 차례다(노무 서류 먼저) */
  var DOCS = {
    contract: { label: '근로계약서', labor: true },
    rules: { label: '취업규칙(신고 증빙)', labor: true },
    payroll: { label: '임금대장', labor: true },
    wageProof: { label: '임금 지급 증빙(계좌이체 등)', labor: true },
    attendance: { label: '출근부·근태·근로시간 기록', labor: true },
    laborAgree: { label: '근로자대표 서면합의·노사합의', labor: true },
    retireRule: { label: '정년 제도 규정', labor: true },
    flexRule: { label: '유연근무·단축 규정·신청서', labor: true },
    applyForm: { label: '신청서(기관 서식)', labor: false },
    bizPlan: { label: '사업계획서·훈련계획서', labor: false },
    bizReg: { label: '사업자등록증', labor: false },
    corpReg: { label: '법인 등기사항전부증명서', labor: false },
    smeCert: { label: '중소기업(소상공인)확인서', labor: false },
    taxPaid: { label: '국세·지방세 완납증명', labor: false },
    insPaid: { label: '4대보험 완납증명', labor: false },
    finStat: { label: '재무제표·과세표준증명', labor: false },
    eiRoster: { label: '고용보험 피보험자 명부·자격이력', labor: false },
    workerDocs: { label: '대상 근로자 서류(신분증·동의서 등)', labor: false },
    bankbook: { label: '통장 사본', labor: false },
    other: { label: '그 밖', labor: false }
  };
  /* 공고에 적힌 서류 이름 → 낱말. 위에서부터 처음 걸리는 것(4대보험 완납이 세금 완납보다 먼저, 지급 «증빙»이 임금대장보다 먼저) */
  var DOC_RULES = [
    ['laborAgree', /서면\s*합의|노사\s*합의|노사협의|근로자\s*대표/], ['contract', /근로\s*계약/], ['rules', /취업\s*규칙/],
    ['retireRule', /정년/], ['flexRule', /유연근무|시차출퇴근|재택|단축\s*(신청|합의|규정)/],
    ['wageProof', /계좌\s*이체|지급\s*(증빙|내역|확인)|이체\s*내역/], ['payroll', /임금\s*대장|급여\s*대장/],
    ['attendance', /출근부|출퇴근|근태|근로시간\s*기록/],
    ['insPaid', /(4대|사회)\s*보험.*완납|보험료\s*완납/], ['taxPaid', /국세|지방세|납세\s*증명|완납\s*증명/],
    ['eiRoster', /피보험자|가입자\s*명부|자격\s*이력|취득\s*내역/], ['smeCert', /중소기업\s*확인|소상공인\s*확인/],
    ['corpReg', /등기/], ['bizReg', /사업자\s*등록/], ['finStat', /재무제표|과세표준|부가가치세|매출액\s*증명/],
    ['bankbook', /통장/], ['bizPlan', /계획서/], ['applyForm', /신청서/],
    ['workerDocs', /신분증|개인정보|동의서|졸업|재학/]
  ];
  function docKeyOf(label) {
    var s = String(label == null ? '' : label);
    for (var i = 0; i < DOC_RULES.length; i++) if (DOC_RULES[i][1].test(s)) return DOC_RULES[i][0];
    return 'other';
  }
  /* 주소 앞머리 → 시·도 짧은 이름. ⚠ 「광주시」(경기 광주)는 광주광역시와 헷갈리므로 regionOf 가 먼저 걸러 모름으로 둔다 */
  var REGION_PREFIX = [
    ['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'], ['광주', '광주'],
    ['대전', '대전'], ['울산', '울산'], ['세종', '세종'], ['경기', '경기'], ['강원', '강원'],
    ['충북', '충청북도'], ['충북', '충북'], ['충남', '충청남도'], ['충남', '충남'],
    ['전북', '전라북도'], ['전북', '전북'], ['전남', '전라남도'], ['전남', '전남'],
    ['경북', '경상북도'], ['경북', '경북'], ['경남', '경상남도'], ['경남', '경남'], ['제주', '제주']
  ];
  var MINE = '직접 입력';

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function digits(v) { return clean(v).replace(/[^0-9]/g, ''); }
  function blank(v) {
    return v == null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && !isFinite(v));
  }
  function num(v) { if (blank(v)) return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* 파이어베이스는 배열을 {0:…,1:…} 로 돌려줄 때가 있다 — 둘 다 배열로 */
  function list(v) {
    var out = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return out.filter(function (x) { return x != null; });
  }
  function kstYear(now) { return new Date((now == null ? Date.now() : now) + 9 * 3600e3).getUTCFullYear(); }

  function regionOf(address) {
    var a = clean(address).replace(/^\(?\d{5}\)?\s*/, '');
    if (/^광주시/.test(a)) return '';
    for (var i = 0; i < REGION_PREFIX.length; i++) if (a.indexOf(REGION_PREFIX[i][1]) === 0) return REGION_PREFIX[i][0];
    return '';
  }
  /* 주소 → 시·군·구 (대표 지시 2026-10-31 「각 지자체별로 진행되는 지원사업등 매칭」) — 시·도를 알고, 그 다음 낱말이 …시·…군·…구일 때만.
     «천안시 동남구»처럼 구가 붙으면 앞의 시를 쓴다(지원사업은 시 단위로 나온다). 세종은 시·군이 없다 */
  function sigunguOf(address) {
    var a = clean(address).replace(/^\(?\d{5}\)?\s*/, '');
    if (!regionOf(a) || regionOf(a) === '세종') return '';
    var w = a.split(/\s+/)[1] || '';
    return /^[가-힣]{1,6}(시|군|구)$/.test(w) ? w : '';
  }
  /* 고용·산재보험 사업장 줄의 주소 — 업체관리 주소가 없을 때 지역을 채운다(인원이 가장 많은 줄) */
  function eiAddr(pub) {
    var best = null;
    list(((pub || {}).ei || {}).rows).forEach(function (r) { if (r && clean(r.addr) && (!best || (num(r.cnt) || 0) > (num(best.cnt) || 0))) best = r; });
    return best ? clean(best.addr) : '';
  }

  /* 후보 [값, 출처] 가운데 «빈 것이 아닌» 첫 값 — 0 은 빈 것이 아니다 */
  function first(cands) {
    for (var i = 0; i < cands.length; i++) if (!blank(cands[i][0])) return { v: cands[i][0], src: cands[i][1] };
    return { v: null, src: '' };
  }
  /* pubdata/co/{사업자번호} — nps-monthly.js 가 담는다. ⚠ 공단에 없는 회사는 ei.rows 가 비고 gy 가 0 이다 → 모름 */
  function headcountAuto(pub) {
    pub = pub || {};
    var now = pub.nps && pub.nps.now, ym = clean(now && now.ym);
    if (ym && num(now.cnt) != null) return { v: num(now.cnt), src: '국민연금 가입자 ' + ym.slice(0, 4) + '-' + ym.slice(4, 6) };
    var ei = pub.ei;
    if (ei && list(ei.rows).length && num(ei.gy) != null) return { v: num(ei.gy), src: '고용보험 상시인원' };
    return { v: null, src: '' };
  }
  /* 업종 이름 → 표준산업분류 대분류. 위에서부터 «처음 걸리는 것» — 순서가 규칙이다.
     표준산업분류 이름은 «끝말»이 업종이라 끝말을 먼저 본다(«…산업용 건물 건설업»은 건설, «…가공식품 도매업»은 도소매).
     그다음 제조·가공 > 사진촬영 > 정보통신 > 도소매 > 숙박음식 > 전문기술 > 건설 …
     («건설용 금속제품제조업»은 제조, «조리 반찬류 소매업»은 도소매, «건축기술·엔지니어링»은 전문기술).
     ⚠ 뜻이 갈리는 이름(서비스·사업서비스업·위생 및 유사서비스업·개인 및 가사서비스업·비영리법인·각급사무소)은
       어디에도 안 걸리게 둔다 → 모름.
     ⚠ 76 임대업(N 안에서 100명 기준)은 일부러 대분류로 보내지 않는다. 34 산업용 기계 수리업은 «수리업»으로 S 에 간다
       — 우선지원 기준(그 밖의 업종 100명)과는 맞고, 업종 조건 «제조업»과는 어긋날 수 있다 */
  var INDUSTRY_RULES = [
    ['F', /(건설|공사)업$/], ['G', /(도매|소매)업$/], ['O', /지방자치단체|행정/],
    ['C', /제조|가공|인쇄|피막|열처리|코팅|도정|제분/], ['M', /사진|촬영|회사\s*본부/],
    ['J', /소프트웨어|정보처리|컴퓨터|전기통신|통신업|출판|방송|데이터베이스|포털|프로그래밍/],
    ['G', /도매|소매|도\.?소매|상품.*중개|슈퍼마켓/],
    ['I', /음식|식당|숙박|호텔|요식|주점|제과점|한식|중식|일식|패스트푸드|커피|분식|치킨/],
    ['M', /엔지니어링|설계|기술서비스|연구|시험|검사|분석|광고|회계|법무|세무|컨설팅|디자인|수의/],
    ['F', /건설|공사/],
    ['Q', /의원|병원|보건|복지|요양|어린이집|간호/],
    ['H', /운수|운송|화물|택배|창고|물류|여객/],
    ['K', /금융|보험업|신용조합|은행|증권|여신|대부/],
    ['N', /인력\s*공급|고용\s*알선|사무지원|사업시설|포장 및 충전|근로자\s*파견|경비|청소|건물.*관리|시설관리|여행사/],
    ['E', /폐기물|하수|재활용|수도/], ['P', /교육|학원/], ['L', /부동산/], ['B', /광업|채석|채굴|채취/],
    ['A', /농업|임업|어업|양계|양돈|축산|재배/], ['O', /국방|사회보장/],
    ['R', /스포츠|체육|오락|예술|공연|골프|유원지/], ['D', /전기업|발전업|가스|증기/],
    ['S', /협회|단체$|수리업|미용|세탁|이용업/]
  ];
  function industryFromName(name, opt) {
    var s = clean(name);
    if (!s) return '';
    if (opt && opt.strict) {
      /* 업체관리 «업태» — «제조업, 도매 및 소매업»처럼 둘이 섞이면 모름, «제조 외»는 첫 업태 */
      var got = s.split(/[,·\/]|\s및\s|\s외$|\s외\s/).map(function (x) { return industryFromName(x); }).filter(Boolean);
      var uniq = got.filter(function (x, i) { return got.indexOf(x) === i; });
      return uniq.length === 1 ? uniq[0] : '';
    }
    for (var i = 0; i < INDUSTRY_RULES.length; i++) if (INDUSTRY_RULES[i][1].test(s)) return INDUSTRY_RULES[i][0];
    return '';
  }
  /* 고용·산재보험 사업장 줄(pubdata/co ei.rows: fg gy/sj, ind 업종명, cnt) — 시행령 제12조⑤2 처럼 인원이 많은 사업장의 업종 */
  function industryAuto(pub, co) {
    var rows = list(((pub || {}).ei || {}).rows);
    var kinds = [['gy', '고용보험 업종'], ['sj', '산재보험 업종']];
    for (var k = 0; k < kinds.length; k++) {
      var best = null;
      rows.forEach(function (r) {
        if (!r || r.fg !== kinds[k][0]) return;
        var L = industryFromName(r.ind), n = num(r.cnt) || 0;
        if (L && (!best || n > best.n)) best = { v: L, n: n, src: kinds[k][1] + ' «' + clean(r.ind) + '»' };
      });
      if (best) return { v: best.v, src: best.src };
    }
    var t = clean((co || {}).bizType), L2 = industryFromName(t, { strict: true });
    return L2 ? { v: L2, src: '업체관리 업태 «' + t + '»' } : { v: null, src: '' };
  }
  function factsOf(extra) {
    var f = (extra && extra.facts) || {}, out = {};
    Object.keys(FACTS).forEach(function (k) { if (typeof f[k] === 'boolean') out[k] = { v: f[k], src: MINE }; });
    return out;
  }
  /* 우선지원대상기업 — 고용보험법 시행령 제12조·별표 1(개정 2025. 10. 1., 2026-10-12 원문 확인).
     업종별 상시 근로자 상한. 표에 없는 업종(그 밖의 업종)은 100명. C 안의 34(산업용 기계 수리업)·N 안의 76(임대업)은 100명 */
  var PRIORITY_MAX = { C: 500, B: 300, F: 300, H: 300, J: 300, N: 300, M: 300, Q: 300, G: 200, I: 200, K: 200, R: 200 };
  var PRIORITY_LOW = 100;
  /* 사람 답이 없을 때만 «예»를 추정한다 — «아니오»는 추정하지 않는다
     (중소기업이면 인원과 상관없이 예(②), 상한을 넘어도 5년은 예(③) — 기계가 아니라고 단정할 수 없다).
     ⚠ 상호출자제한기업집단 소속(④)은 기계가 모른다 → 추정 꼬리표로 남긴다 */
  function prioritySupportAuto(vals) {
    var hc = num((vals.headcount || {}).v), ind = industryOk((vals.industry || {}).v), sz = clean((vals.size || {}).v);
    if (hc != null && hc > 0) {
      var max = ind ? (PRIORITY_MAX[ind] || PRIORITY_LOW) : PRIORITY_LOW;
      if (hc <= max) return { v: true, src: '추정: 상시 ' + hc + '명 ≤ ' + max + '명(시행령 별표 1, ' + (ind ? indName(ind) : '업종 모름 → 가장 낮은 기준') + ')'
        + ((ind === 'C' || ind === 'N') && hc > PRIORITY_LOW ? ' — 수리업·임대업이면 100명' : '') };
    }
    if (sz === '소기업' || sz === '중기업' || sz === SME) return { v: true, src: '추정: 규모 ' + sz + ' → 중소기업은 우선지원(시행령 제12조②)' };
    return null;
  }
  function withPriority(p) {
    if (!p.facts.prioritySupport) { var a = prioritySupportAuto(p.vals); if (a) p.facts.prioritySupport = a; }
    return p;
  }
  function sizeOk(v) { return SIZES.indexOf(clean(v)) >= 0 ? clean(v) : ''; }
  /* «중소기업» — 소기업인지 중기업인지 모르는 중소기업(매출로 추정할 때). 조건 칸에는 쓰지 않고 사업장 값으로만 온다 */
  var SME = '중소기업';
  function autoSizeOk(v) { return clean(v) === SME ? SME : sizeOk(v); }
  /* 보충값의 «자동» 칸 — 공공데이터·기업정보함에서 기계가 채운 값(govaid/extras/{key}.auto). 사람 값·원장보다 뒤 */
  function autoOf(extra, k) {
    var a = (extra && extra.auto) || {}, v = (a.vals || {})[k], s = (a.src || {})[k];
    return [v, clean(s) || '자동'];
  }
  function regionOk(v) { return REGIONS.indexOf(clean(v)) >= 0 ? clean(v) : ''; }
  function industryOk(v) { return Object.prototype.hasOwnProperty.call(INDUSTRIES, clean(v)) ? clean(v) : ''; }

  /* 기존 고객사 — 업체관리 원장(data/companies/v 한 줄) + 공공데이터 + 보충값(govaid/extras/co_{id}) */
  function profileFromCompany(co, pub, extra) {
    co = co || {};
    var ex = (extra && extra.vals) || {}, hc = headcountAuto(pub), ia = industryAuto(pub, co);
    /* 지역 — 업체관리 주소가 시·도를 모르면 고용보험 사업장 주소로(2026-10-31). 사람이 시·도를 따로 넣었는데 주소와 다르면 시·군은 모름 */
    var addr = regionOf(co.address) ? clean(co.address) : eiAddr(pub), asrc = regionOf(co.address) ? '업체관리 주소' : '고용보험 사업장 주소';
    var sgg = (regionOk(ex.region) && regionOk(ex.region) !== regionOf(addr)) ? '' : sigunguOf(addr);
    return withPriority({
      key: 'co_' + clean(co.id), kind: 'co', id: clean(co.id), name: clean(co.name), bizno: digits(co.bizNo), aliases: [],
      vals: {
        headcount: first([[num(ex.headcount), MINE], [hc.v, hc.src], [num(autoOf(extra, 'headcount')[0]), autoOf(extra, 'headcount')[1]]]),
        foundedYear: first([[num(ex.foundedYear), MINE], [num(autoOf(extra, 'foundedYear')[0]), autoOf(extra, 'foundedYear')[1]]]),
        size: first([[sizeOk(ex.size), MINE], [sizeOk(co.companySize), '업체관리'], [autoSizeOk(autoOf(extra, 'size')[0]), autoOf(extra, 'size')[1]]]),
        region: first([[regionOk(ex.region), MINE], [regionOf(addr), asrc]]),
        sigungu: first([[clean(ex.sigungu), MINE], [sgg, asrc]]),
        industry: first([[industryOk(ex.industry), MINE], [ia.v, ia.src]]),
        salesDropPct: first([[num(ex.salesDropPct), MINE]])
      },
      facts: factsOf(extra)
    });
  }
  /* 예비 고객 — govaid/prospects/{id} + 공공데이터(사업자번호가 있으면) + 보충값(govaid/extras/pr_{id}) */
  function profileFromProspect(pr, pub, extra) {
    pr = pr || {};
    var ex = (extra && extra.vals) || {}, hc = headcountAuto(pub), ia = industryAuto(pub, null), IN = '예비 고객 입력';
    return withPriority({
      key: 'pr_' + clean(pr.id), kind: 'pr', id: clean(pr.id), name: clean(pr.name), bizno: digits(pr.bizno), aliases: [],
      vals: {
        headcount: first([[num(ex.headcount), MINE], [num(pr.headcount), IN], [hc.v, hc.src]]),
        foundedYear: first([[num(ex.foundedYear), MINE], [num(pr.foundedYear), IN]]),
        size: first([[sizeOk(ex.size), MINE], [sizeOk(pr.size), IN]]),
        region: first([[regionOk(ex.region), MINE], [regionOk(pr.region), IN]]),
        industry: first([[industryOk(ex.industry), MINE], [industryOk(pr.industry), IN], [ia.v, ia.src]]),
        salesDropPct: first([[num(ex.salesDropPct), MINE]])
      },
      facts: factsOf(extra)
    });
  }

  function hasRange(r) { return !!r && (num(r.min) != null || num(r.max) != null); }
  function inRange(r, v) { var lo = num(r.min), hi = num(r.max); return (lo == null || v >= lo) && (hi == null || v <= hi); }
  function rangeText(r, unit) {
    var lo = num(r.min), hi = num(r.max);
    if (lo != null && hi != null) return lo + '~' + hi + unit;
    return lo != null ? lo + unit + ' 이상' : hi + unit + ' 이하';
  }
  function indName(k) { return INDUSTRIES[k] || k; }

  /* 사업종료 — 예산 소진·접수 마감·폐지 (대표 지시 2026-10-12 「예산이 소진되었다는 부분 … 사업종료 표시」).
     program.closure = { state: open|partial|closed|unknown, reason: budget|deadline|abolished|other, closedAt, note, sources, confidence, checkedAt, by }
     closed  → 확정 사업이어도 후보가 아니다(verdict 'closed') — 신청할 수 없는 사업을 권하지 않는다
     partial → 일부 운영기관·지역만 마감: 후보로 두되 «사람 확인» 조건을 붙인다 */
  var CLOSE_REASON = { budget: '사업종료 · 예산 소진', deadline: '접수 마감', abolished: '사업 폐지', other: '사업종료' };
  function closureOf(p) {
    var c = (p && p.closure) || {}, st = clean(c.state);
    if (st === 'closed') return { closed: true, partial: false, label: CLOSE_REASON[clean(c.reason)] || CLOSE_REASON.other, at: clean(c.closedAt), note: clean(c.note) };
    if (st === 'partial') return { closed: false, partial: true, label: '일부 마감' + (c.reason === 'budget' ? '(예산 소진)' : ''), at: clean(c.closedAt), note: clean(c.note) };
    return { closed: false, partial: false, label: '', at: '', note: '' };
  }
  function judge(profile, program, year) {
    program = program || {}; profile = profile || {};
    var vals = profile.vals || {}, facts = profile.facts || {}, c = program.cond || {}, items = [];
    if (program.status !== 'confirmed' || !(num(program.baseYear) >= num(year))) return { verdict: 'unconfirmed', items: items };
    var cl = closureOf(program);
    if (cl.closed) return { verdict: 'closed', items: items };
    function v(k) { return (vals[k] || {}).v; }
    function add(key, label, state) { items.push({ key: key, label: label, state: state }); }
    function range(key, r, val, label, unit) {
      if (!hasRange(r)) return;
      var text = label + ' ' + rangeText(r, unit);
      if (val == null) add(key, text, 'unknown'); else add(key, text, inRange(r, val) ? 'ok' : 'no');
    }
    function oneOf(key, arr, val, label) {
      arr = list(arr); if (!arr.length) return;
      var text = label + ': ' + arr.join('·');
      if (blank(val)) add(key, text, 'unknown'); else add(key, text, arr.indexOf(val) >= 0 ? 'ok' : 'no');
    }
    range('headcount', c.headcount, num(v('headcount')), '근로자', '명');
    var fy = num(v('foundedYear'));
    range('yearsInBiz', c.yearsInBiz, fy == null ? null : num(year) - fy, '업력', '년');
    range('salesDropPct', c.salesDropPct, num(v('salesDropPct')), '매출 감소', '%');
    var sizes = list(c.sizes);
    if (sizes.length && v('size') === SME) {
      /* 소·중 미구분 중소기업 — 둘 다 받으면 맞음, 둘 다 안 받으면 안 맞음, 하나만 받으면 모름 */
      var hasS = sizes.indexOf('소기업') >= 0, hasM = sizes.indexOf('중기업') >= 0;
      add('size', '규모: ' + sizes.join('·'), hasS && hasM ? 'ok' : (!hasS && !hasM ? 'no' : 'unknown'));
    } else oneOf('size', c.sizes, v('size'), '규모');
    oneOf('region', c.regions, v('region'), '지역');
    var ind = c.industries || {}, inc = list(ind.include), exc = list(ind.exclude), iv = v('industry');
    if (inc.length || exc.length) {
      var text = '업종' + (inc.length ? ': ' + inc.map(indName).join('·') : '') + (exc.length ? ' (제외 ' + exc.map(indName).join('·') + ')' : '');
      if (blank(iv)) add('industry', text, 'unknown');
      else add('industry', text, (inc.length && inc.indexOf(iv) < 0) || exc.indexOf(iv) >= 0 ? 'no' : 'ok');
    }
    list(c.facts).forEach(function (f) {
      if (!f || !FACTS[f.key]) return;
      var want = f.want !== false, got = facts[f.key];
      var label = FACTS[f.key] + (want ? '' : ' — 아니어야 함');
      if (!got || typeof got.v !== 'boolean') add('fact:' + f.key, label, 'unknown');
      else add('fact:' + f.key, label, got.v === want ? 'ok' : 'no');
    });
    list(c.manual).forEach(function (m, i) { if (clean(m)) add('manual:' + i, clean(m), 'manual'); });
    if (cl.partial) add('closure', cl.label + (cl.note ? ' — ' + cl.note : '') + ' · 신청 가능 여부 확인', 'manual');
    var states = items.map(function (x) { return x.state; });
    /* 기계가 잴 수 있는 조건(manual 이 아닌 것)이 하나도 없으면 계산하지 않는다 —
       «사람이 볼 조건»만으로는 모든 회사가 후보로 쏟아진다(2026-10-11 최종 검토) */
    if (!states.filter(function (s) { return s !== 'manual'; }).length) return { verdict: 'unconfirmed', items: items };
    var verdict = states.indexOf('no') >= 0 ? 'no' : (states.indexOf('unknown') >= 0 ? 'unknown' : 'candidate');
    return { verdict: verdict, items: items };
  }

  return {
    SIZES: SIZES, REGIONS: REGIONS, INDUSTRIES: INDUSTRIES, FACTS: FACTS, DOCS: DOCS, docKeyOf: docKeyOf, closureOf: closureOf,
    list: list, digits: digits, blank: blank, num: num, kstYear: kstYear, regionOf: regionOf, sigunguOf: sigunguOf,
    headcountAuto: headcountAuto, prioritySupportAuto: prioritySupportAuto, industryFromName: industryFromName, industryAuto: industryAuto, profileFromCompany: profileFromCompany, profileFromProspect: profileFromProspect,
    judge: judge
  };
});
