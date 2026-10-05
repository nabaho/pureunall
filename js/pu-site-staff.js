/* ══════════════════════════════════════════════════════════════════════
   급여 사업장 ↔ 업체관리 잇기 (pu-site-staff.js)
   ──────────────────────────────────────────────────────────────────────
   무엇인가: 급여관리의 «사업장 이름»(급여대장 파일·폴더에서 나온 것)을
   푸른이알피 업체관리의 «업체»에 붙이고, 그 업체의 담당 노무사를 돌려준다.

   왜 필요한가 (대표 지시 2026-09-13):
     "담당자별로 정리하고, 각 기업별로 근태·휴가·퇴직·명세서를 하나의 플로어로."
   담당 배정을 급여관리 안에 또 만들면 업체관리와 어긋난다. 이알피에서 담당을
   바꾸면 여기도 따라 바뀌어야 한다 — 그래서 **업체관리(data/companies)의
   주담당·부담당이 유일한 원본**이다. 급여데이터함이 이미 같은 방식으로 돈다
   (js/pu-paydata-store.js 의 isMyCompany·rosterNameMap).

   ⚠ 자동 짝맞추기는 «짐작»이다, 답이 아니다.
     실측(2026-09-13): 급여관리 46곳 중 33곳만 자동으로 붙었다. 못 붙은 13곳은
     ㉠ 업체관리 유형이 「자문」으로 적힌 곳(엽떡신방점·운화헬스케어·가온바이오·
        행복한e치과) ㉡ 계약 종료된 곳 ㉢ 지점 묶음(현진글로벌 외 3곳)
     ㉣ 업체관리에 없는 곳(세창ENG) ㉤ 폴더 꼬리표가 붙은 찌꺼기 이름
        (이전 파일 · 가온기술_급여자료10일).
     그래서 «사람이 확정한 짝»(links)이 언제나 이긴다. 짐작은 빈칸을 메울 뿐이고,
     화면에는 짐작이라고 밝혀 준다.

   ⚠ 이름을 다듬을 때 낱말은 갈래(|)로 지운다. 글자 묶음([])으로 지우면
     「한식당」이 「한당」이 된다 — tests/company-name-normalize.test.js 가 막는 자리다.

   ⚠ 괄호 «속»까지 지우는 것은 이 자리에서만 옳다.
     업체관리는 「새별반찬(배방점)」처럼 지점을 괄호에 넣고, 급여관리는
     「새별반찬 배방월천점」처럼 이름에 붙인다. 그래서 괄호를 지워야 만난다.
     대신 «지점이 다른데 같은 곳으로 붙는» 위험이 생긴다(다온원 ↔ 다온원 천안점).
     이 위험은 말로 못 가른다 — 사람이 확정한 짝으로 막는다.

   ── 검사: node --test tests/site-staff-match.test.js
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* 이름의 «알맹이» — 회사 표기어·괄호 속·공백을 걷어낸다.
     급여데이터함의 coreName 과 같은 규칙이다(같은 답을 내야 같은 곳을 찾는다). */
  function coreName(s) {
    return String(s == null ? '' : s).replace(/\(.*?\)|（.*?）|㈜|주식회사|유한회사|\s/g, '');
  }

  /* 파일·폴더에서 묻어 온 꼬리표를 뗀다 — 「가온기술_급여자료10일」 → 「가온기술」.
     ⚠ 뗀 이름으로 «한 번 더» 찾아볼 뿐이다. 원래 이름으로 먼저 찾고,
       못 찾았을 때만 쓴다 — 꼬리표처럼 보이는 진짜 이름이 있을 수 있다. */
  function stripTag(s) {
    var t = String(s == null ? '' : s);
    t = t.replace(/_.*$/, '');                 // 밑줄 뒤(급여자료10일·5일자…)
    t = t.replace(/\s*외\s*\d+\s*곳\s*$/, ''); // 「외 3곳」 묶음
    t = t.replace(/\s*\d{1,2}\s*일\s*$/, '');  // 뒤에 붙은 「25일」
    return t.trim();
  }

  /* 업체관리에서 «지금 급여를 하는 곳»만 — 급여데이터함 isPayrollCompany 와 같은 잣대.
     안 거르면 자문 196곳까지 섞여 엉뚱한 업체에 붙는다. */
  function isPayrollCo(co) {
    if (!co) return false;
    if (co.suspended) return false;
    if (String(co.status || '') !== 'active') return false;
    return String(co.typeCode || '') === '급여';
  }
  /* ⚠ 업체 명단은 배열로도, «업체번호 → 업체» 객체로도 온다 — 2026-10 현재 실데이터는
     객체다(9월엔 배열이었다). 예전처럼 배열만 믿고 .filter 를 부르면 회사 화면이 통째로 죽는다. */
  function payrollCos(list) { return listOf(list).filter(isPayrollCo); }

  /* 이름으로 업체 한 곳 고르기.
     ① «그대로 같은 것»이 먼저다 — 「두레」이 있는데 「두레가축약품」을 고르면 안 된다
       (PR #837 이 못 박은 쌍이다).
     ② 그다음에 품고 있는 것을 긴 이름부터 본다. */
  function matchCompany(site, list) {
    var want = coreName(site);
    if (!want) return null;
    var sorted = (list || []).slice().sort(function (a, b) {
      return coreName(b && b.name).length - coreName(a && a.name).length;
    });
    var i, c;
    for (i = 0; i < sorted.length; i++) {
      if (coreName(sorted[i] && sorted[i].name) === want) return sorted[i];
    }
    for (i = 0; i < sorted.length; i++) {
      c = coreName(sorted[i] && sorted[i].name);
      if (!c) continue;
      if (want.indexOf(c) >= 0 || c.indexOf(want) >= 0) return sorted[i];
    }
    return null;
  }

  /* 사번 → 이메일. 기업정보함·포털·급여데이터함과 **같은 규칙이어야** 같은 사람을 찾는다. */
  function sidToEmail(sid) {
    return String(sid || '').toLowerCase().replace(/-/g, '') + '@pureun.kr';
  }

  /* 공개 명부(data/user_dir)를 «사번 → 이름» 지도로. 담기는 꼴이 배열·객체·{v:…} 셋 다라 푼다. */
  function nameBySid(dirRows) {
    var map = {}, arr = dirRows;
    if (arr && typeof arr === 'object' && arr.v !== undefined) arr = arr.v;
    if (arr && !Array.isArray(arr) && typeof arr === 'object') {
      arr = Object.keys(arr).map(function (k) { return arr[k]; });
    }
    if (!Array.isArray(arr)) return map;
    arr.forEach(function (x) {
      if (x && x.sid && x.name) map[String(x.sid)] = String(x.name);
    });
    return map;
  }

  /* 명단을 배열로 편다. 객체로 온 것은 «열쇠가 곧 업체번호»다 — 칸에 id 가 없으면
     열쇠를 번호로 쓴다(급여데이터함 normalizeCompanies 와 같은 규칙: id → companyId → 열쇠).
     번호가 어긋나면 데이터함이 실어 보낸 번호와 영영 안 만난다. */
  function listOf(v) {
    var arr = v;
    if (arr && typeof arr === 'object' && arr.v !== undefined) arr = arr.v;
    if (arr && !Array.isArray(arr) && typeof arr === 'object') {
      var box = arr;
      arr = Object.keys(box).map(function (k) {
        var row = box[k];
        if (!row || typeof row !== 'object') return null;
        if (row.id || row.companyId) return row.id ? row : Object.assign({}, row, { id: row.companyId });
        return Object.assign({}, row, { id: k });
      });
    }
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }

  /* ══════ 이름표 (대표 지시 2026-10-05 「이름표 맞추기는 내가」) ══════
     payroll_os/site_co_link[급여관리 이름] =
       { coId, coName, by, at }   이 업체가 맞다 — 번호가 열쇠다
       { none: true, by, at }     업체가 아니다(폴더 꼬리표 같은 찌꺼기 이름)
     ⚠ 예전 꼴 { coName } 도 그대로 읽는다(2026-09 에 이름만 적어 둔 것).
     ⚠ 번호가 이긴다 — 업체관리에서 이름을 고쳐도 번호는 그대로다. */
  function linkOf(site, links) {
    var l = (links || {})[String(site || '')];
    return (l && typeof l === 'object') ? l : null;
  }
  function findLinked(l, cos) {
    var i;
    if (l.coId) {
      for (i = 0; i < cos.length; i++) if (cos[i] && String(cos[i].id) === String(l.coId)) return cos[i];
    }
    if (l.coName) {
      for (i = 0; i < cos.length; i++) if (cos[i] && String(cos[i].name) === String(l.coName)) return cos[i];
    }
    return null;
  }

  /* 사업장 한 곳의 담당 — 화면이 그대로 그릴 수 있는 한 덩이로 돌려준다.
     opts = {companies, dir, links}
       companies : data/companies (배열·{v:…} 아무 꼴이나)
       dir       : data/user_dir
       links     : payroll_os/site_co_link — 대표가 확정한 이름표

     돌려주는 것:
       {업체, coId, 담당, 부담당[], sid, subs[], 유형, 상태, 확정, 짐작, 정확, 업체아님, 경고}
       정확 = 짐작이지만 이름 알맹이가 «똑같다»(꼬리표만 다름). 이름표 화면이
              「한꺼번에 확정」에 넣는 것은 이것뿐이다.
     ⚠ 못 찾으면 «모른다»고 돌려준다. 지어내지 않는다 — 급여관리 사업장 이름은
       업체관리에 없는 것이 실제로 있다. */
  function staffFor(site, opts) {
    var o = opts || {};
    var cos = listOf(o.companies), dir = nameBySid(o.dir), links = o.links || {};
    var out = { 사업장: String(site || ''), 업체: '', coId: '', 담당: '', 부담당: [], sid: '', subs: [],
                유형: '', 상태: '', 확정: false, 짐작: false, 정확: false, 업체아님: false, 경고: '' };
    if (!out.사업장) return out;

    var co = null, fixed = linkOf(out.사업장, links);
    if (fixed && fixed.none) {                          /* ⓪ 대표가 「업체 아님」으로 정리한 이름 */
      out.업체아님 = true; out.확정 = true;
      return out;
    }
    if (fixed) {                                        /* ① 대표가 확정한 이름표가 이긴다 */
      co = findLinked(fixed, cos);
      if (co) out.확정 = true;
      else out.경고 = '확정해 둔 업체(' + (fixed.coName || fixed.coId) + ')를 업체관리에서 못 찾았습니다 — 이름표를 다시 맞춰 주세요';
    }
    if (!co) {                                          /* ② 지금 급여를 하는 곳에서 짐작 */
      co = matchCompany(out.사업장, payrollCos(cos)) || matchCompany(stripTag(out.사업장), payrollCos(cos));
      if (co) out.짐작 = true;
    }
    if (!co) {                                          /* ③ 그래도 없으면 «왜 없는지»라도 알려 준다 */
      var any = matchCompany(out.사업장, cos) || matchCompany(stripTag(out.사업장), cos);
      if (any) {
        co = any; out.짐작 = true;
        if (String(any.typeCode || '') !== '급여') out.경고 = '업체관리 유형이 「' + (any.typeCode || '미지정') + '」입니다 — 급여로 고쳐야 담당이 이어집니다';
        else if (String(any.status || '') === 'closed') out.경고 = '계약 종료된 업체입니다(지난 자료)';
        else if (String(any.status || '') === 'suboffice') out.경고 = '업체관리에 지점으로 담긴 곳입니다';
        else if (any.suspended) out.경고 = '업체관리에서 중단 표시된 업체입니다';
      } else {
        if (!out.경고) out.경고 = '업체관리에서 같은 이름을 못 찾았습니다 — 이름표 맞추기에서 골라 주세요';
        return out;
      }
    }
    out.업체 = String(co.name || '');
    out.coId = String(co.id || '');
    out.유형 = String(co.typeCode || '');
    out.상태 = String(co.status || '');
    if (out.짐작) {
      var c = coreName(co.name);
      out.정확 = !!c && (c === coreName(out.사업장) || c === coreName(stripTag(out.사업장)));
    }
    out.sid = String(co.managerMain || '');
    out.담당 = out.sid ? (dir[out.sid] || out.sid) : '';
    out.subs = (co.managerSubs || []).map(String).filter(function (x) { return x && x !== out.sid; });
    out.부담당 = out.subs.map(function (s) { return dir[s] || s; });
    if (!out.sid && !out.subs.length && !out.경고) out.경고 = '업체관리에 주담당이 비어 있습니다';
    return out;
  }

  /* 사번의 꼴 — 「글자 하나 + 숫자 두세 자리」(A-001·P-002). 데이터함 SID_RE 와 같다. */
  var SID_RE = /^[A-Za-z]-?\d{2,3}$/;

  /* 사번을 줄 세우는 열쇠 — 급여데이터함(pu-paydata-store.js sidKey)과 같은 규칙.
     A-9 가 A-10 보다 앞이어야 하고, 사번이 아닌 값은 맨 뒤다. */
  function sidKey(sid) {
    var m = String(sid || '').match(/^([A-Za-z])-?(\d{1,4})$/);
    if (!m) return 'zz' + String(sid || '');
    return m[1].toUpperCase() + ('000' + m[2]).slice(-4);
  }

  /* 사업장 목록을 담당자별로 묶는다 — ★ 급여데이터함 담당자 명단과 «같은 규칙».
     (대표 지시 2026-10-05 「형태나 유형을 일치시켜 연결성을 강하게」)
       · 주담당과 부담당 **둘 다**의 묶음에 들어간다(데이터함 managerRoster 와 같다).
         예전엔 주담당만 세어, 같은 사람이 두 앱에서 다른 숫자를 봤다.
       · 사번 순으로 세운다(데이터함과 같은 차례).
       · 담당을 못 찾은 곳은 「담당 미확인」, 대표가 업체 아님으로 정리한 이름은
         「업체 아님」 — 둘 다 «버리지 않고» 맨 뒤에 모은다.
     검사: tests/staff-roster-same.test.js 가 데이터함 managerRoster 와 실제로 견준다. */
  function groupByStaff(sites, opts) {
    var dir = nameBySid((opts || {}).dir);
    var bySid = {}, order = [], none = [], notCo = [];
    (sites || []).forEach(function (s) {
      var st = staffFor(s, opts);
      if (st.업체아님) { notCo.push({ site: s, staff: st }); return; }
      var sids = [], seen = {};
      [st.sid].concat(st.subs || []).forEach(function (x) {
        x = String(x || ''); if (!x || seen[x]) return; seen[x] = 1; sids.push(x);
      });
      if (!st.업체 || !sids.length) { none.push({ site: s, staff: st }); return; }
      sids.forEach(function (sid) {
        if (!bySid[sid]) { bySid[sid] = { sid: sid, 담당: dir[sid] || sid, rows: [] }; order.push(sid); }
        bySid[sid].rows.push({ site: s, staff: st, 역할: sid === st.sid ? '주' : '부' });
      });
    });
    /* 차례 — 데이터함 managerRoster 와 똑같이: 사번 꼴(SID_RE)인 사람은 사번 순,
       사번 꼴이 아닌 값(담당 칸에 이름·메모가 든 것)은 **맨 아래** 이름순.
       사이에 섞이면 멀쩡한 담당자처럼 보여 고쳐야 할 것이 묻힌다. */
    order.sort(function (a, b) {
      var ba = !SID_RE.test(a), bb = !SID_RE.test(b);
      if (ba !== bb) return ba ? 1 : -1;
      if (ba) return String(bySid[a].담당).localeCompare(String(bySid[b].담당), 'ko');
      var x = sidKey(a), y = sidKey(b); return x < y ? -1 : (x > y ? 1 : 0);
    });
    var out = order.map(function (sid) { return bySid[sid]; });
    if (none.length) out.push({ 담당: '담당 미확인', rows: none, 미확인: true });
    if (notCo.length) out.push({ 담당: '업체 아님', rows: notCo, 업체아님: true });
    return out;
  }

  /* 데이터함이 넘긴 도착 알림 한 줄이 이 사업장 것인가.
     ① 알림에 업체번호가 있고 이름표에도 번호가 있으면 **번호로만** 본다 —
        번호가 다르면 이름이 비슷해도 남의 것이다(같은 이름의 지점이 실제로 있다).
     ② 번호로 못 보면 이름으로 본다: 급여관리 이름, 그리고 이름표에 적힌 업체 이름.
     ③ 「업체 아님」으로 정리한 이름에는 아무것도 붙이지 않는다. */
  function arrivalMatches(rec, site, links) {
    if (!rec || !rec.사업장 && !rec.companyId) return false;
    var l = linkOf(site, links);
    if (l && l.none) return false;
    if (rec.companyId && l && l.coId) return String(rec.companyId) === String(l.coId);
    var names = [String(site || '')];
    if (l && l.coName) names.push(String(l.coName));
    var want = String(rec.사업장 || ''), wk = coreName(want);
    return names.some(function (n) { return n === want || (!!wk && coreName(n) === wk); });
  }

  /* 이름표 화면의 「다른 업체 고르기」 후보 — 지금 급여를 하는 곳이 먼저,
     이름 알맹이가 똑같은 곳이 그다음, 짧은 이름이 그다음. */
  function candidates(q, companies, limit) {
    var cos = listOf(companies), want = coreName(q), n = limit || 30;
    var hit = cos.filter(function (c) {
      if (!c || !c.name) return false;
      if (!want) return isPayrollCo(c);
      var cn = coreName(c.name);
      return !!cn && (cn.indexOf(want) >= 0 || want.indexOf(cn) >= 0);
    });
    hit.sort(function (a, b) {
      var pa = isPayrollCo(a) ? 0 : 1, pb = isPayrollCo(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      var ea = coreName(a.name) === want ? 0 : 1, eb = coreName(b.name) === want ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return String(a.name).localeCompare(String(b.name), 'ko');
    });
    return hit.slice(0, n);
  }

  var API = {
    coreName: coreName, stripTag: stripTag,
    isPayrollCo: isPayrollCo, payrollCos: payrollCos,
    matchCompany: matchCompany,
    sidToEmail: sidToEmail, nameBySid: nameBySid, sidKey: sidKey,
    linkOf: linkOf, staffFor: staffFor, groupByStaff: groupByStaff,
    arrivalMatches: arrivalMatches, candidates: candidates
  };

  global.PuSiteStaff = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
