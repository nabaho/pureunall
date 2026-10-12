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
  function factsOf(extra) {
    var f = (extra && extra.facts) || {}, out = {};
    Object.keys(FACTS).forEach(function (k) { if (typeof f[k] === 'boolean') out[k] = { v: f[k], src: MINE }; });
    return out;
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
    var ex = (extra && extra.vals) || {}, hc = headcountAuto(pub);
    return {
      key: 'co_' + clean(co.id), kind: 'co', id: clean(co.id), name: clean(co.name), bizno: digits(co.bizNo), aliases: [],
      vals: {
        headcount: first([[num(ex.headcount), MINE], [hc.v, hc.src], [num(autoOf(extra, 'headcount')[0]), autoOf(extra, 'headcount')[1]]]),
        foundedYear: first([[num(ex.foundedYear), MINE], [num(autoOf(extra, 'foundedYear')[0]), autoOf(extra, 'foundedYear')[1]]]),
        size: first([[sizeOk(ex.size), MINE], [sizeOk(co.companySize), '업체관리'], [autoSizeOk(autoOf(extra, 'size')[0]), autoOf(extra, 'size')[1]]]),
        region: first([[regionOk(ex.region), MINE], [regionOf(co.address), '업체관리 주소']]),
        industry: first([[industryOk(ex.industry), MINE]]),
        salesDropPct: first([[num(ex.salesDropPct), MINE]])
      },
      facts: factsOf(extra)
    };
  }
  /* 예비 고객 — govaid/prospects/{id} + 공공데이터(사업자번호가 있으면) + 보충값(govaid/extras/pr_{id}) */
  function profileFromProspect(pr, pub, extra) {
    pr = pr || {};
    var ex = (extra && extra.vals) || {}, hc = headcountAuto(pub), IN = '예비 고객 입력';
    return {
      key: 'pr_' + clean(pr.id), kind: 'pr', id: clean(pr.id), name: clean(pr.name), bizno: digits(pr.bizno), aliases: [],
      vals: {
        headcount: first([[num(ex.headcount), MINE], [num(pr.headcount), IN], [hc.v, hc.src]]),
        foundedYear: first([[num(ex.foundedYear), MINE], [num(pr.foundedYear), IN]]),
        size: first([[sizeOk(ex.size), MINE], [sizeOk(pr.size), IN]]),
        region: first([[regionOk(ex.region), MINE], [regionOk(pr.region), IN]]),
        industry: first([[industryOk(ex.industry), MINE], [industryOk(pr.industry), IN]]),
        salesDropPct: first([[num(ex.salesDropPct), MINE]])
      },
      facts: factsOf(extra)
    };
  }

  function hasRange(r) { return !!r && (num(r.min) != null || num(r.max) != null); }
  function inRange(r, v) { var lo = num(r.min), hi = num(r.max); return (lo == null || v >= lo) && (hi == null || v <= hi); }
  function rangeText(r, unit) {
    var lo = num(r.min), hi = num(r.max);
    if (lo != null && hi != null) return lo + '~' + hi + unit;
    return lo != null ? lo + unit + ' 이상' : hi + unit + ' 이하';
  }
  function indName(k) { return INDUSTRIES[k] || k; }

  function judge(profile, program, year) {
    program = program || {}; profile = profile || {};
    var vals = profile.vals || {}, facts = profile.facts || {}, c = program.cond || {}, items = [];
    if (program.status !== 'confirmed' || !(num(program.baseYear) >= num(year))) return { verdict: 'unconfirmed', items: items };
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
    var states = items.map(function (x) { return x.state; });
    /* 기계가 잴 수 있는 조건(manual 이 아닌 것)이 하나도 없으면 계산하지 않는다 —
       «사람이 볼 조건»만으로는 모든 회사가 후보로 쏟아진다(2026-10-11 최종 검토) */
    if (!states.filter(function (s) { return s !== 'manual'; }).length) return { verdict: 'unconfirmed', items: items };
    var verdict = states.indexOf('no') >= 0 ? 'no' : (states.indexOf('unknown') >= 0 ? 'unknown' : 'candidate');
    return { verdict: verdict, items: items };
  }

  return {
    SIZES: SIZES, REGIONS: REGIONS, INDUSTRIES: INDUSTRIES, FACTS: FACTS,
    list: list, digits: digits, blank: blank, num: num, kstYear: kstYear, regionOf: regionOf,
    headcountAuto: headcountAuto, profileFromCompany: profileFromCompany, profileFromProspect: profileFromProspect,
    judge: judge
  };
});
