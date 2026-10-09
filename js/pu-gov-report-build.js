'use strict';
/* 정부컨설팅 보고서 2단계 — 정부사업일정 자료로 «어느 양식을 쓸지» 고르고 «보고서 자료»를 모은다
   (브라우저 window.PuGovReportBuild / Node 겸용 · 계획 docs/superpowers/plans/2026-10-09-gov-report-step2-ui.md Task 1)
   무엇을 지키나
     · 모르는 값은 비워 둔다('') — 지어내지 않는다. 근로자수는 이알피에 없다(employmentInsuredCount 는 피보험자수 — 안 쓴다):
       비워 두고 «확인 필요» 경고를 띄운다.
     · 저장된 초안(saved.report)이 있으면 사람이 고친 것이므로 그 값이 이긴다(빈 문자열도 «사람이 비운 값»).
     · 개인 단위 자료(급여대장·근태·4대보험 명부 등)는 목록에만 두고 priv 딱지를 단다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var G = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report.js') : root.PuGovReport;

  var PRIV_RE = /급여|근태|명부|4대|원천|주민|통장|연말정산/;
  var WORKERS_WARN = '근로자수(상시근로자수)는 이알피에 없습니다 — 직접 넣어 주세요';

  function str(v) { return v == null ? '' : String(v).trim(); }

  /* 사업 종류 → 양식. 이름·정식명·이알피 사업명을 한 줄로 이어 본다 */
  function pickByLine(line, name) {
    if (line.indexOf('서산') >= 0) return 'cci-seosan';
    if (line.indexOf('충남북부') >= 0 || name === '인사충남') return 'cci-north';
    if (line.indexOf('기술보호') >= 0) return 'techguard';
    return null;
  }
  /* 사업 종류 자신의 이름이 먼저다 — 이알피 사업명(programName)은 종류만으로 못 가릴 때만 보탠다
     (종류가 기술보호인데 계약 사업명에 다른 기관 이름이 섞여 있어도 종류가 이긴다) */
  function resolveFormKey(type, programName) {
    type = type || {};
    var own = [type.name, type.fullName].map(str).join(' ');
    var k = pickByLine(own, str(type.name)) || pickByLine(own + ' ' + str(programName), str(type.name));
    if (k) return { formKey: k, ask: false, choices: [] };
    var all = own + ' ' + str(programName) + ' ' + str(type.agency);
    if (all.indexOf('상공회의소') >= 0 || all.indexOf('인사노무') >= 0)
      return { formKey: null, ask: true, choices: ['cci-north', 'cci-seosan'] };
    return { formKey: null, ask: false, choices: [] };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  /* 깊게 덮는다 — 객체는 안으로 들어가고, 배열·글자는 통째로 바꾼다(빈 문자열 포함) */
  function deepMerge(dst, src) {
    Object.keys(src || {}).forEach(function (k) {
      if (isObj(src[k]) && isObj(dst[k])) deepMerge(dst[k], src[k]);
      else dst[k] = isObj(src[k]) ? deepMerge({}, src[k]) : src[k];
    });
    return dst;
  }

  function stripExt(name) { return str(name).replace(/\.[^.\\/]+$/, ''); }
  var KIND_ORDER = { '일정': 0, '받은 메일': 1, '보낸 메일': 2, '보낸 서류': 3 };

  function buildReport(input) {
    input = input || {};
    var co = input.co || {}, type = input.type || {}, cons = input.cons || null, cc = (cons && cons.company) || null;
    var res = resolveFormKey(type, cons && cons.programName), formKey = res.formKey;
    var warnings = [], src = {};

    /* 기업정보 — 이알피 계약에서. 계약이 없으면 사업장 이름만 */
    var contacts = (cc && cc.contacts) || [];
    var ct = null;
    contacts.forEach(function (x) { if (!ct && x && x.isPrimary) ct = x; });
    if (!ct && contacts.length) ct = contacts[0];
    ct = ct || {};
    var company = {
      name: str(cc ? cc.name : '') || str(co.name),
      bizNo: str(cc && cc.bizNo), ceo: str(cc && cc.ceo), address: str(cc && cc.address),
      bizType: str(cc && cc.bizType) || str(cc && cc.bizCategory),
      workers: '', workType: '',
      contact: str(ct.name), contactDept: '', contactTitle: str(ct.role),
      tel: str(ct.phone), fax: str(ct.fax), email: str(ct.email),
    };
    var FROM_ERP = '이알피 계약', FROM_SCHED = '정부사업일정';
    var erpSrc = function (v) { return v ? (cc ? FROM_ERP : FROM_SCHED) : ''; };
    src['업체명'] = erpSrc(company.name); src['사업자번호'] = erpSrc(company.bizNo); src['대표자'] = erpSrc(company.ceo);
    src['업종'] = erpSrc(company.bizType); src['소재지'] = erpSrc(company.address); src['근로자수'] = '';
    src['담당자'] = erpSrc(company.contact); src['담당부서직위'] = erpSrc(company.contactTitle);
    if (cc && !company.name) src['업체명'] = '';

    /* 회차 — 사전진단 빼고 날짜순(같은 날짜는 회차 번호순) */
    var sc = (input.scheds || []).filter(function (s) { return s && s.phase !== 'pre'; });
    sc = sc.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) {
      var da = str(a.s.date), db = str(b.s.date);
      return da < db ? -1 : da > db ? 1 : ((a.s.round || 0) - (b.s.round || 0)) || (a.i - b.i);
    }).map(function (o) { return o.s; });
    var rounds = sc.map(function (s) {
      return { date: str(s.date), visit: s.isField === true ? true : s.isField === false ? false : null, advice: str(s.memo) };
    });
    rounds.forEach(function (r, i) { src['일자' + (i + 1)] = r.date ? FROM_SCHED : ''; });

    var sent = input.sent || [];
    var report = {
      company: company, rounds: rounds, field: '', techField: {},
      summary: { inquiryDiag: '', review: '', action: '', etc: '', adviceAll: '', overall: '',
        outputs: sent.map(function (x) { return stripExt(x && x.name); }).filter(Boolean) },
      consultant: str(input.staffName), writtenAt: str(input.today),
    };
    if (report.summary.outputs.length) src['산출물목록'] = FROM_SCHED;
    if (input.saved && isObj(input.saved.report)) deepMerge(report, input.saved.report);

    if (!str(report.company && report.company.workers)) warnings.push(WORKERS_WARN);
    var lim = (formKey && G && G.FORMS && G.FORMS[formKey] && G.FORMS[formKey].rounds) || {};
    var have = (report.rounds || []).length;
    if (lim.min && have < lim.min) warnings.push('회차가 기관 기준(' + lim.min + '회)보다 적습니다 — 지금 ' + have + '회');
    if (lim.max && have > lim.max) warnings.push('회차가 기관 기준(최대 ' + lim.max + '회)을 넘습니다 — 지금 ' + have + '회(넘는 회차는 양식에 안 들어갑니다)');
    if (!formKey) warnings.push(res.ask ? '어느 기관 양식인지 정해 주세요' : '이 사업은 2단계 양식 대상이 아닙니다');

    /* 출처 목록 */
    var feed = [];
    sc.forEach(function (s, i) {
      feed.push({ d: str(s.date), kind: '일정', att: [], priv: false,
        text: (s.round ? s.round + '회' : '') + (s.round ? ' · ' : '') + (s.isField === true ? '방문' : s.isField === false ? '사무' : '방문 여부 미상') +
          (str(s.memo) ? ' · ' + str(s.memo) : '') });
    });
    (input.mail || []).forEach(function (m) {
      if (!m) return;
      var att = (m.att || []).map(str).filter(Boolean);
      feed.push({ d: str(m.d), kind: m.io === 'out' ? '보낸 메일' : '받은 메일', text: str(m.s), att: att,
        priv: att.some(function (a) { return PRIV_RE.test(a); }) });
    });
    sent.forEach(function (x) {
      if (!x) return;
      feed.push({ d: str(x.d), kind: '보낸 서류', text: str(x.name), att: [], priv: PRIV_RE.test(str(x.name)) });
    });
    feed = feed.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return a.x.d < b.x.d ? -1 : a.x.d > b.x.d ? 1 : ((KIND_ORDER[a.x.kind] || 0) - (KIND_ORDER[b.x.kind] || 0)) || (a.i - b.i);
    }).map(function (o) { return o.x; });

    return { formKey: formKey, report: report, src: src, warnings: warnings, feed: feed, techguard: formKey === 'techguard' };
  }

  var api = { resolveFormKey: resolveFormKey, buildReport: buildReport, PRIV_RE: PRIV_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportBuild = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
