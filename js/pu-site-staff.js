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
     ㉠ 업체관리 유형이 「자문」으로 적힌 곳(엽떡신방점·운화헬스케어·씨에스바이오·
        행복한e치과) ㉡ 계약 종료된 곳 ㉢ 지점 묶음(현진글로벌 외 3곳)
     ㉣ 업체관리에 없는 곳(세창ENG) ㉤ 폴더 꼬리표가 붙은 찌꺼기 이름
        (이전 파일 · 선우기술_급여자료10일).
     그래서 «사람이 확정한 짝»(links)이 언제나 이긴다. 짐작은 빈칸을 메울 뿐이고,
     화면에는 짐작이라고 밝혀 준다.

   ⚠ 이름을 다듬을 때 낱말은 갈래(|)로 지운다. 글자 묶음([])으로 지우면
     「한식당」이 「한당」이 된다 — tests/company-name-normalize.test.js 가 막는 자리다.

   ⚠ 괄호 «속»까지 지우는 것은 이 자리에서만 옳다.
     업체관리는 「늘봄반찬(배방점)」처럼 지점을 괄호에 넣고, 급여관리는
     「늘봄반찬 배방월천점」처럼 이름에 붙인다. 그래서 괄호를 지워야 만난다.
     대신 «지점이 다른데 같은 곳으로 붙는» 위험이 생긴다(화담원 ↔ 화담원 천안점).
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

  /* 파일·폴더에서 묻어 온 꼬리표를 뗀다 — 「선우기술_급여자료10일」 → 「선우기술」.
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
  function payrollCos(list) { return (list || []).filter(isPayrollCo); }

  /* 이름으로 업체 한 곳 고르기.
     ① «그대로 같은 것»이 먼저다 — 「천성」이 있는데 「천성가축약품」을 고르면 안 된다
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

  function listOf(v) {
    var arr = v;
    if (arr && typeof arr === 'object' && arr.v !== undefined) arr = arr.v;
    if (arr && !Array.isArray(arr) && typeof arr === 'object') {
      arr = Object.keys(arr).map(function (k) { return arr[k]; });
    }
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }

  /* 사업장 한 곳의 담당 — 화면이 그대로 그릴 수 있는 한 덩이로 돌려준다.
     opts = {companies, dir, links}
       companies : data/companies (배열·{v:…} 아무 꼴이나)
       dir       : data/user_dir
       links     : payroll_os/site_co_link — 사람이 확정한 짝 {사업장:{coName,by,at}}

     돌려주는 것:
       {업체, 담당, 부담당[], sid, 유형, 상태, 확정, 짐작, 경고}
     ⚠ 못 찾으면 «모른다»고 돌려준다. 지어내지 않는다 — 급여관리 사업장 이름은
       업체관리에 없는 것이 실제로 있다(세창ENG). */
  function staffFor(site, opts) {
    var o = opts || {};
    var cos = listOf(o.companies), dir = nameBySid(o.dir), links = o.links || {};
    var out = { 사업장: String(site || ''), 업체: '', 담당: '', 부담당: [], sid: '', 유형: '', 상태: '', 확정: false, 짐작: false, 경고: '' };
    if (!out.사업장) return out;

    var co = null, fixed = links[out.사업장];
    if (fixed && fixed.coName) {                       /* ① 사람이 확정한 짝이 이긴다 */
      co = cos.filter(function (c) { return c && String(c.name) === String(fixed.coName); })[0] || null;
      if (co) out.확정 = true;
      else out.경고 = '사람이 이어 둔 업체(' + fixed.coName + ')를 업체관리에서 못 찾았습니다';
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
        out.경고 = '업체관리에서 같은 이름을 못 찾았습니다 — 손으로 이어 주세요';
        return out;
      }
    }
    out.업체 = String(co.name || '');
    out.유형 = String(co.typeCode || '');
    out.상태 = String(co.status || '');
    out.sid = String(co.managerMain || '');
    out.담당 = out.sid ? (dir[out.sid] || out.sid) : '';
    out.부담당 = (co.managerSubs || []).map(function (s) { return dir[String(s)] || String(s); });
    if (!out.sid && !out.경고) out.경고 = '업체관리에 주담당이 비어 있습니다';
    return out;
  }

  /* 사업장 목록을 담당자별로 묶는다.
     ⚠ 담당을 못 찾은 곳은 «버리지 않고» 맨 뒤 「담당 미확인」 묶음에 모은다 —
       감추면 그 사업장이 통째로 사라진 줄 안다. */
  function groupByStaff(sites, opts) {
    var by = {}, order = [], none = [];
    (sites || []).forEach(function (s) {
      var st = staffFor(s, opts);
      if (!st.담당) { none.push({ site: s, staff: st }); return; }
      if (!(st.담당 in by)) { by[st.담당] = []; order.push(st.담당); }
      by[st.담당].push({ site: s, staff: st });
    });
    order.sort(function (a, b) { return by[b].length - by[a].length || a.localeCompare(b); });
    var out = order.map(function (n) { return { 담당: n, rows: by[n] }; });
    if (none.length) out.push({ 담당: '담당 미확인', rows: none, 미확인: true });
    return out;
  }

  var API = {
    coreName: coreName, stripTag: stripTag,
    isPayrollCo: isPayrollCo, payrollCos: payrollCos,
    matchCompany: matchCompany,
    sidToEmail: sidToEmail, nameBySid: nameBySid,
    staffFor: staffFor, groupByStaff: groupByStaff
  };

  global.PuSiteStaff = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
