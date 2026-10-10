'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 보고서 현황판의 순수 함수 (브라우저 window.PuGovReportList / Node 겸용)
   (대표 지시 2026-10-10 「포털 의뢰인 업무에 별도 앱을 만들어 진행」 · 설계 docs/superpowers/specs/2026-10-10-gov-report-app-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-app.md)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 줄을 만들 뿐 아무 데도 쓰지 않는다.
     · 줄 열쇠는 정부사업일정과 같다 — rid = 사업번호_연도, 연도 = 사전진단 뺀 첫 회차의 해(gov-consulting grpYearOf).
       어긋나면 이 화면의 「초안」과 보고서 창의 초안이 서로 다른 자리를 본다.
     · 간단형 양식만 줄이 생긴다 — resolveFormKey 가 양식을 고르거나(ask 포함) 저장본에 formKey 가 있을 때.
       이알피 사업명(programName)은 넘기지 않는다 — 이알피 계약을 읽지 않는 화면이다(종류 이름만으로 가린다).
     · 목록에는 이름·상태만 — 보고서 본문(report)은 줄에 담지 않는다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var B = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-build.js') : root.PuGovReportBuild;

  var UNWRITTEN_DAYS = 14;   // 종료 뒤 이만큼 «넘게» 미작성이면 ⏰
  var DRAFT_DAYS = 7;        // 초안이 이만큼 «넘게» 묵으면 ⏰
  var ORDER = { todo: 0, draft: 1, wait: 2, done: 3 };
  var STATUS_KO = { todo: '미작성', wait: '작성 전', draft: '초안', done: '검토완료' };
  /* gov-consulting.html GRP_FILE_KO 와 같은 이름 — 서고 창과 이 화면이 같은 말을 쓴다 */
  var FILE_KO = { main: '본문', visit: '업체 방문 확인서', report: '결과보고서' };
  var REPORT_PAGE = 'gov-consulting.html';
  var FORMS_HREF = REPORT_PAGE + '#forms';

  function str(v) { return v == null ? '' : String(v).trim(); }
  /* 정부사업일정은 배열로 쓰지만 DB 가 번호 객체로 돌려줄 때도 있다 — 둘 다 받는다 */
  function list(v) {
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && x.id; });
  }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  function dayNum(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN;
  }
  function daysBetween(from, to) { var n = dayNum(to) - dayNum(from); return isFinite(n) ? n : null; }
  /* 저장 시각(ms) → 서울 날짜 */
  function dayOf(ms) { var n = Number(ms || 0); if (!n) return ''; return new Date(n + 9 * 3600e3).toISOString().slice(0, 10); }
  /* gov-consulting getCoAtts 와 같은 차례 */
  function coAtts(o) {
    if (!o) return [];
    if (Array.isArray(o.coAttIds)) return o.coAttIds.filter(Boolean);
    if (Array.isArray(o.defCoAtts)) return o.defCoAtts.filter(Boolean);
    if (o.coAttId) return [o.coAttId];
    if (o.defCoAtt) return [o.defCoAtt];
    return [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  /* gov-consulting getCoMaxRounds 와 같다 — 사업장 값이 먼저 */
  function maxRounds(co, t) {
    var v = co.customRounds && co.customRounds[t.id];
    if (v !== undefined && v !== null && v !== '') return +v || 0;
    return +t.rounds || 0;
  }

  /* 업체×사업 후보 — 회차(사전진단 뺀)가 하나라도 있는 것 */
  function candidates(input) {
    input = input || {};
    var types = {};
    list(input.types).forEach(function (t) { types[t.id] = t; });
    var scheds = list(input.scheds).filter(function (s) { return s.phase !== 'pre' && isDay(s.date); });
    var out = [];
    list(input.cos).forEach(function (co) {
      if (co.deleted) return;
      (Array.isArray(co.types) ? co.types : []).forEach(function (tid) {
        var t = types[tid]; if (!t) return;
        var sc = scheds.filter(function (s) { return s.coId === co.id && s.typeId === tid; });
        if (!sc.length) return;
        var ds = sc.map(function (s) { return str(s.date); }).sort();
        var year = ds[0].slice(0, 4);
        out.push({ co: co, type: t, scheds: sc, dates: ds, year: year, rid: String(tid) + '_' + year,
          fk: B.resolveFormKey(t, '') });
      });
    });
    return out;
  }
  function reportKeys(input) {
    return candidates(input).filter(function (c) { return c.fk.formKey || c.fk.ask; })
      .map(function (c) { return { coId: c.co.id, typeId: c.type.id, year: c.year, rid: c.rid }; });
  }

  function statusOf(row, today) {
    row = row || {};
    var s;
    if (row.state === '검토완료') {
      s = { key: 'done', label: '검토완료 v' + (Number(row.ver) || 0), days: null, steps: [true, true, false, false],
        action: { label: '⬇ HWPX', enabled: true, why: '보고서 창을 열어 내려받습니다' } };
    } else if (row.state) {
      s = { key: 'draft', label: '초안', days: daysBetween(dayOf(row.updatedAt), today), steps: [true, false, false, false],
        action: { label: '이어 쓰기', enabled: true, why: '' } };
    } else if (row.ended) {
      s = { key: 'todo', label: '미작성', days: daysBetween(row.endDate, today), steps: [false, false, false, false],
        action: { label: '📄 작성', enabled: true, why: '' } };
    } else {
      s = { key: 'wait', label: '작성 전', days: null, steps: [false, false, false, false],
        action: { label: '📄 작성', enabled: false, why: '회차가 남았습니다' } };
    }
    s.ai = s.key === 'draft' && !!row.ai;
    return s;
  }

  function buildRows(input) {
    input = input || {};
    var today = str(input.today);
    var names = staffNames(input.staff);
    var reps = input.reports || {};
    var rows = [];
    candidates(input).forEach(function (c) {
      var saved = (reps[c.co.id] && reps[c.co.id][c.rid]) || null;
      var formKey = str(saved && saved.formKey) || str(c.fk.formKey);
      if (!formKey && !c.fk.ask) return;
      var maxR = maxRounds(c.co, c.type);
      var last = c.dates[c.dates.length - 1];
      var endedAt = str(c.co.endedTypes && c.co.endedTypes[c.type.id]);
      var ended = !!endedAt || (maxR > 0 && c.scheds.length >= maxR && !!today && last <= today);
      var attIds = uniq([str(c.co.defAtt)].concat(coAtts(c.co)));
      rows.push({
        coId: c.co.id, coName: str(c.co.name), typeId: c.type.id, typeName: str(c.type.fullName) || str(c.type.name),
        year: c.year, rid: c.rid, formKey: formKey, askForm: !formKey, techguard: formKey === 'techguard',
        attIds: attIds, attNames: attIds.map(function (id) { return names[id] || ''; }).filter(Boolean),
        rounds: c.scheds.length, maxRounds: maxR, lastDate: last, ended: ended, endDate: ended ? (endedAt || last) : '',
        state: saved ? (str(saved.state) || '초안') : '', ver: Number(saved && saved.ver) || 0,
        updatedAt: Number(saved && saved.updatedAt) || 0, updatedBy: str(saved && saved.updatedBy),
        ai: !!(saved && Array.isArray(saved.aiFields) && saved.aiFields.length)
      });
    });
    rows.forEach(function (r) { r.st = statusOf(r, today); });
    rows.sort(function (a, b) {
      return (ORDER[a.st.key] - ORDER[b.st.key]) || ((b.st.days || 0) - (a.st.days || 0))
        || a.coName.localeCompare(b.coName, 'ko') || a.typeName.localeCompare(b.typeName, 'ko');
    });
    return rows;
  }

  function kpis(rows) {
    var k = { all: 0, todo: 0, wait: 0, draft: 0, done: 0, signed: 0, submitted: 0 };
    (rows || []).forEach(function (r) {
      k.all++;
      var key = (r.st || statusOf(r, '')).key;
      if (k[key] != null) k[key]++;
    });
    return k;   // ③ 서명 ④ 제출은 이번 범위 밖 — 늘 0
  }

  function filterRows(rows, f) {
    f = f || {};
    var q = str(f.co).toLowerCase();
    return (rows || []).filter(function (r) {
      if (f.year && r.year !== String(f.year)) return false;
      if (f.type && r.typeId !== f.type) return false;
      if (f.att && (r.attIds || []).indexOf(f.att) < 0) return false;
      if (f.mine && (r.attIds || []).indexOf(f.mine) < 0) return false;
      if (f.status && (r.st || statusOf(r, '')).key !== f.status) return false;
      if (q && str(r.coName).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function alerts(rows, today) {
    var unwritten = [], staleDraft = [];
    (rows || []).forEach(function (r) {
      var s = statusOf(r, today);
      if (s.key === 'todo' && s.days != null && s.days > UNWRITTEN_DAYS) unwritten.push(r);
      if (s.key === 'draft' && s.days != null && s.days > DRAFT_DAYS) staleDraft.push(r);
    });
    var by = function (a, b) { return statusOf(b, today).days - statusOf(a, today).days; };
    unwritten.sort(by); staleDraft.sort(by);
    return { unwritten: unwritten, staleDraft: staleDraft, waitSign: [], total: unwritten.length + staleDraft.length };
  }

  function formsStatus(index, FORMS) {
    var idx = (index && typeof index === 'object') ? index : {};
    return Object.keys(FORMS || {}).map(function (fk) {
      var f = FORMS[fk] || {};
      var files = Object.keys(f.files || {}).map(function (fl) {
        var got = (idx[fk] || {})[fl] || {};
        var years = Object.keys(got).filter(function (y) { return got[y] && /^\d{4}$/.test(y); }).sort().reverse();
        return { fileKey: fl, label: FILE_KO[fl] || fl, years: years, latest: years[0] || '' };
      });
      return { formKey: fk, name: str(f.name), agency: str(f.agency), files: files,
        ready: files.length > 0 && files.every(function (x) { return x.years.length > 0; }) };
    });
  }

  function reportHref(coId, typeId) {
    return REPORT_PAGE + '#rpt=' + encodeURIComponent(str(coId)) + '|' + encodeURIComponent(str(typeId));
  }

  function staffNames(staff) {
    var o = {};
    list(staff).forEach(function (s) { o[s.id] = str(s.name); });
    return o;
  }
  /* gov-consulting 포털 연동 로그인과 같은 길 — 메일 = 사번(하이픈 뺀 소문자)@pureun.kr → 명부 이름 → 담당자 번호 */
  function staffIdFor(staff, roster, email) {
    var em = str(email).toLowerCase();
    if (!em) return '';
    var r = (roster && !Array.isArray(roster) && roster.v !== undefined) ? roster.v : roster;
    var accts = Array.isArray(r) ? r : (r && typeof r === 'object' ? Object.keys(r).map(function (k) { return r[k]; }) : []);
    var acct = accts.filter(function (a) {
      return a && (str(a.sid).toLowerCase().replace(/-/g, '') + '@pureun.kr') === em;
    })[0];
    if (!acct || acct.status === 'retired') return '';
    var st = list(staff).filter(function (s) { return str(s.name) === str(acct.name); })[0];
    return st ? st.id : '';
  }
  function yearsOf(rows, today) {
    var seen = {};
    (rows || []).forEach(function (r) { if (r && r.year) seen[r.year] = 1; });
    if (str(today).length >= 4) seen[str(today).slice(0, 4)] = 1;
    return Object.keys(seen).sort().reverse();
  }

  var api = { reportKeys: reportKeys, buildRows: buildRows, statusOf: statusOf, kpis: kpis, filterRows: filterRows,
    alerts: alerts, formsStatus: formsStatus, reportHref: reportHref, staffIdFor: staffIdFor, staffNames: staffNames,
    yearsOf: yearsOf, dayOf: dayOf, daysBetween: daysBetween,
    FORMS_HREF: FORMS_HREF, STATUS_KO: STATUS_KO, FILE_KO: FILE_KO, UNWRITTEN_DAYS: UNWRITTEN_DAYS, DRAFT_DAYS: DRAFT_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportList = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
