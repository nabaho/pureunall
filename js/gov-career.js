'use strict';
/* 푸른노무법인 정부사업신청 — 경력관리에서 «재료» 당겨오기
   (브라우저 window.GovCareer / Node module.exports 겸용, DOM·통신 없음 — 셈과 글자만)

   대표 지시 2026-09-05 「별도 프로그램에서 자료 당겨오기 했으면 좋겠다」
   범위는 대표 선택 「나」 = 자문·고문 + 경력·자격증·표창·학력.

   ── ⚠★ 읽기 «전용»이다 ──
   경력관리(kcareer/{uid})는 저 앱의 집이다. 여기서는 «한 글자도 쓰지 않는다».
   쓰기 시작하면 어느 쪽이 원본인지 알 수 없게 되고, 두 앱의 건수가 갈린다.

   ── ⚠★ 노드를 «통째로» 읽지 말 것 ──
   `kcareer/{uid}` 밑에는 ⑴`_secrets`(API 열쇠) ⑵첨부 조각 `ls/pf_chunk_*`(수 MB)가 있다.
   그래서 «필요한 창고만 콕 집어» 읽는다(PATHS 참조). 통째로 읽으면
   열쇠를 쓸데없이 내려받고 화면을 열 때마다 수 MB 를 먹는다.

   ── ⚠ 담긴 모양 ──
   `kcareer/{uid}/ls/{창고}` 의 값은 «JSON 글자»다(객체가 아니다).
   경력관리가 localStorage 를 그대로 올리기 때문이다 → parseStore 로 푼다.

   ── ⚠★ 갈래 나누는 잣대는 경력관리와 «같아야» 한다 ──
   위촉장/표창은 한 창고(wiccok)에 같이 있고 `type` 으로 갈린다.
   자격증/수료증도 한 창고(cert)에 같이 있고 «이름»으로 갈린다.
   잣대가 갈라지면 두 앱이 서로 «다른 건수»를 보여 준다 — 대표님이 어느 쪽을 믿어야 하나.
   → 아래 두 정규식은 kcareer.html 의 `isAwardType` · `complete.filter` 를 그대로 옮긴 것이다.
     고칠 일이 생기면 «두 곳을 함께» 고친다(회귀검사가 잡는다).

   ── ⚠★ 자문·고문 이름 가리기를 여기에 «다시 만들지 말 것» ──
   `js/kcareer-adv-summary.js`(KcareerAdvSummary)를 그대로 빌려 쓴다.
   두 벌이 되면 한쪽만 고쳐져 «고객사 이름이 새는» 날이 온다. */
(function (root) {

  /* ── 어느 창고를 읽나 ── (경력관리 localStorage 열쇠 = 클라우드 ls 의 칸 이름) */
  var STORES = ['edu', 'cert', 'wiccok', 'advisory', 'work',
                'consult', 'case', 'fund', 'etc', 'lecture'];

  function paths(uid) {
    return STORES.map(function (s) { return { store: s, path: 'kcareer/' + uid + '/ls/' + s }; });
  }

  function s(v) { return v == null ? '' : String(v).trim(); }

  /* JSON 글자 → 배열. 깨졌으면 «빈 배열»로 돌린다(지어내지 않는다). */
  function parseStore(raw) {
    if (Array.isArray(raw)) return raw;              /* 이미 풀려서 오는 판도 받는다 */
    if (typeof raw !== 'string' || !raw) return [];
    try { var a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  /* ⚠ kcareer.html `isAwardType` 과 «같은 정규식» — 함께 고칠 것 */
  function isAward(t) { return /표창|포상|감사|공로|상장/.test(s(t)); }
  /* ⚠ kcareer.html `CAREER_CFG.complete.filter` 와 «같은 정규식» — 함께 고칠 것 */
  function isComplete(title) { return /수료|이수/.test(s(title)); }

  /* 'YYYY-MM-DD' 로 맞춘다. 모르면 «빈 글자» — 오늘 날짜로 채우지 않는다. */
  function ymd(v) {
    var t = s(v);
    if (/^\d{8}$/.test(t)) return t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6, 8);
    var m = t.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    return '';
  }
  function yearOf(v) { var m = s(v).match(/(19|20)\d{2}/); return m ? m[0] : ''; }

  /* 경력관리의 `period` 는 '2019.03 ~ 2021.02' 처럼 한 글자로 들어 있기도 하다 */
  function splitPeriod(p) {
    var t = s(p); if (!t) return ['', ''];
    var a = t.split(/[~〜–—]/);
    return [ymd(a[0]) || s(a[0]), ymd(a[1]) || s(a[1] || '')];
  }

  /* ── 갈래별로 고르게 다듬는다 ── */

  function normEdu(rows) {
    return rows.map(function (r) {
      return { school: s(r.school), major: s(r.major), degree: s(r.degree),
               period: s(r.period), graduated: s(r.graduated) };
    }).filter(function (x) { return !!x.school; });
  }

  function normLicense(rows) {
    return rows.filter(function (r) { return !isComplete(r.title); }).map(function (r) {
      return { title: s(r.title), org: s(r.org), date: ymd(r.date) || s(r.date), num: s(r.num) };
    }).filter(function (x) { return !!x.title; });
  }

  function normComplete(rows) {
    return rows.filter(function (r) { return isComplete(r.title); }).map(function (r) {
      return { title: s(r.title), org: s(r.org), date: ymd(r.date) || s(r.date),
               duration: s(r.duration) };
    }).filter(function (x) { return !!x.title; });
  }

  /* 위촉·위원 경력. ⚠ 「지금 맡고 있나」는 «종료일이 있을 때만» 판단한다 —
     종료일을 모르는 건을 진행으로 세면 지원서에 없는 직책이 올라간다. */
  function normWiccok(rows, today) {
    var t = ymd(today) || '';
    return rows.filter(function (r) { return !isAward(r.type); }).map(function (r) {
      var sp = splitPeriod(r.period);
      var st = ymd(r.periodStart) || sp[0], en = ymd(r.periodEnd) || sp[1];
      var live = '';
      if (en) live = (t && en >= t) ? '진행' : '종료';
      return { org: s(r.org), role: s(r.titleVal), issuer: s(r.issuer),
               issueDate: ymd(r.issueDate) || '', start: st, end: en,
               year: yearOf(r.issueDate) || s(r.year), state: live };
    }).filter(function (x) { return !!(x.org || x.role); });
  }

  function normAward(rows) {
    return rows.filter(function (r) { return isAward(r.type); }).map(function (r) {
      return { org: s(r.org), title: s(r.titleVal), issuer: s(r.issuer), type: s(r.type),
               date: ymd(r.issueDate) || '', year: yearOf(r.issueDate) || s(r.year) };
    }).filter(function (x) { return !!x.org; });
  }

  /* 자문·고문. ⚠ 이름은 «그대로» 둔다 — 가리는 것은 내보낼 때뿐이다
     (대표 지시 「목록보이고 내보낼떄 가림」). 가리기는 KcareerAdvSummary 가 한다. */
  function normAdvisory(rows) {
    return rows.filter(function (r) { return !r.excluded; }).map(function (r) {
      return { org: s(r.org), type: s(r.type), bizType: s(r.bizType),
               bizCategory: s(r.bizCategory), size: s(r.size),
               insured: Number(r.insured || 0) || 0, period: s(r.period),
               status: s(r.status), year: s(r.year) };
    }).filter(function (x) { return !!x.org; });
  }

  /* 수행 실적 — 컨설팅·사건·기금·기타·강의를 한 줄 모양으로 모은다.
     ⚠ 「배제」한 건(`excluded`)은 대표가 실적에서 뺀 것이다 — 도로 넣지 말 것. */
  function normPerf(store, rows) {
    var KIND = { consult: '컨설팅', 'case': '사건', fund: '기금', etc: '기타', lecture: '강의' };
    return rows.filter(function (r) { return !r.excluded; }).map(function (r) {
      var isLec = store === 'lecture';
      return { kind: KIND[store] || store,
               year: s(r.year) || yearOf(r.date),
               project: isLec ? s(r.topic) : s(r.project),
               org: s(r.org), agency: s(r.agency), main: s(r.main),
               status: s(r.status), type: s(r.type) };
    }).filter(function (x) { return !!(x.project || x.org); });
  }

  function normWork(rows) {
    return rows.map(function (r) {
      var sp = splitPeriod(r.period);
      return { org: s(r.org), dept: s(r.dept), title: s(r.title),
               start: ymd(r.startDate) || sp[0], end: ymd(r.endDate) || sp[1] };
    }).filter(function (x) { return !!x.org; });
  }

  /* ── 창고 묶음 하나를 통째로 다듬는다 ──
     ls = { edu:'[...]', cert:'[...]', ... } (값은 JSON 글자) */
  function build(ls, today) {
    ls = ls || {};
    var cert = parseStore(ls.cert), wic = parseStore(ls.wiccok);
    var perf = [];
    ['consult', 'case', 'fund', 'etc', 'lecture'].forEach(function (k) {
      perf = perf.concat(normPerf(k, parseStore(ls[k])));
    });
    perf.sort(function (a, b) { return s(b.year).localeCompare(s(a.year)); });
    return {
      edu:      normEdu(parseStore(ls.edu)),
      license:  normLicense(cert),
      complete: normComplete(cert),
      wiccok:   normWiccok(wic, today),
      award:    normAward(wic),
      advisory: normAdvisory(parseStore(ls.advisory)),
      work:     normWork(parseStore(ls.work)),
      perf:     perf
    };
  }

  function counts(m) {
    m = m || {};
    var o = {}, total = 0;
    Object.keys(m).forEach(function (k) {
      var n = Array.isArray(m[k]) ? m[k].length : 0; o[k] = n; total += n;
    });
    o.total = total;
    return o;
  }

  /* ── 붙여넣기용 문장 ──
     ⚠ 없는 것을 지어내지 않는다. 비면 «빈 글자»를 돌리고, 부르는 쪽이 「없습니다」라 쓴다. */
  function line(parts) { return parts.filter(Boolean).join(' '); }

  function sentence(kind, rows, opt) {
    rows = rows || []; opt = opt || {};
    if (!rows.length) return '';
    if (kind === 'edu') {
      return rows.map(function (r) {
        return line([r.period, r.school, r.major, r.degree ? '(' + r.degree + ')' : '',
                     r.graduated]);
      }).join('\n');
    }
    if (kind === 'license' || kind === 'complete') {
      return rows.map(function (r) {
        var inner = [r.org, r.date, r.num || (r.duration ? r.duration + 'h' : '')]
                      .filter(Boolean).join(', ');
        return r.title + (inner ? ' (' + inner + ')' : '');
      }).join('\n');
    }
    if (kind === 'wiccok') {
      return rows.map(function (r) {
        return line([[r.start, r.end].filter(Boolean).join('~'), r.org, r.role]);
      }).join('\n');
    }
    if (kind === 'award') {
      return rows.map(function (r) {
        return line([r.date || r.year, r.org, r.type || '표창', r.title]);
      }).join('\n');
    }
    if (kind === 'work') {
      return rows.map(function (r) {
        return line([[r.start, r.end].filter(Boolean).join('~'), r.org, r.dept, r.title]);
      }).join('\n');
    }
    if (kind === 'perf') {
      return rows.map(function (r) {
        return line([r.year, r.kind ? '[' + r.kind + ']' : '', r.project,
                     r.agency ? '(' + r.agency + ')' : '']);
      }).join('\n');
    }
    /* 자문·고문은 «이름 없이 세는 문장»이라 여기서 짓지 않는다 — advisorySentence 참조 */
    return '';
  }

  /* ⚠★ 자문·고문 문장은 «반드시» KcareerAdvSummary 를 거친다(이름이 안 나가야 한다).
     모듈이 없으면 «빈 글자»를 돌린다 — 이름이 든 문장을 대신 짓지 않는다. */
  function advisorySentence(rows, today, targetBiz, Adv) {
    var A = Adv || root.KcareerAdvSummary ||
            (typeof require === 'function' ? tryReq() : null);
    if (!A || !A.summarize || !A.sentence) return '';
    try { return A.sentence(A.summarize(rows || [], today), targetBiz) || ''; }
    catch (e) { return ''; }
  }
  function tryReq() { try { return require('./kcareer-adv-summary.js'); } catch (e) { return null; } }

  /* 내보낼 때(복사·CSV·신청서)의 자문·고문 목록 — «반드시» 가려서 나간다. */
  function advisoryForExport(rows, Adv) {
    var A = Adv || root.KcareerAdvSummary ||
            (typeof require === 'function' ? tryReq() : null);
    if (!A || !A.maskRows) return [];      /* 가릴 수 없으면 «안 내보낸다» */
    try { return A.maskRows(rows || []); } catch (e) { return []; }
  }

  var api = { STORES: STORES, paths: paths, parseStore: parseStore,
              isAward: isAward, isComplete: isComplete, ymd: ymd, splitPeriod: splitPeriod,
              build: build, counts: counts, sentence: sentence,
              advisorySentence: advisorySentence, advisoryForExport: advisoryForExport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovCareer = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
