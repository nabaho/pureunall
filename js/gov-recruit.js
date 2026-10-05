/* 정부사업신청 › 🧑‍💼 컨설턴트 모집 — 순수 모듈 (DOM·통신 없음)
   ────────────────────────────────────────────────────────────────────────
   대표 지시 2026-10-04: 「매년 공인노무사 컨설턴트 모집이 있어서 지원해야 되는데 …
   이력서 제출해서 사업 참여한 곳이 많다. 거기 기관들 모두 찾아서 별도로 컨설턴트 모집 창」

   ★ 하는 일은 셋뿐이다
     ① 서류 폴더 「7. 컨설턴트,위원신청등」의 «이름»을 기관별로 묶는다(group)
     ② 해마다 «몇 월»에 지원했는지 어림한다(typicalMonth) — 그래서 언제 알릴지 안다
     ③ 지금부터 가까운 순으로 줄 세우고 이번 달·다음 달을 짚는다(order·soon)

   ⚠★ 지원 «이력»은 여기에 적지 않는다. 이 파일은 공개 저장소에 있다.
      여기 있는 것은 «노무사가 지원할 만한 기관 사전»뿐이고, 대표님이 어디에 몇 번
      냈는지는 대표님 브라우저가 서류 폴더에서 그때그때 읽는다(대표 전용 클라우드에만 둔다).
   ⚠ 월은 «파일 날짜»로 어림한 값이다 — 옮기거나 복사한 파일은 날짜가 바뀐다.
      그래서 «가장 잦은 달»을 쓴다(한두 건 튀는 날짜에 끌려가지 않게).
   ⚠ 공지 링크는 2026-10-04 에 열리는 것을 확인한 주소만 적었다(지어낸 주소 금지).
      대표님이 화면에서 고칠 수 있다 — 고친 것은 클라우드에만 담긴다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GovRecruit = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ⚠ 이름 하나는 «처음 맞는» 기관 하나에만 간다(차례가 곧 우선순위).
     ⚠ 지금 사전은 실제 폴더 이름에서 «두 기관에 동시에 걸리는» 것이 없게 짰다 —
       찾는 말을 넓히면 겹침이 생기고, 그때는 차례가 조용히 승부를 낸다.
       tests/gov-recruit.test.js 「한 이름이 두 기관에 걸리지 않는다」가 실제 이름 꼴로 못박는다. */
  var ORGS = [
    { id: 'erc',    name: '지방공기업평가원',      what: '자문위원·평가위원·외부연구진',
      re: /지방공기업|공기업평가원/,
      url: 'https://www.erc.re.kr/usr/com/prm/BBSList.do?bbsId=BBSMSTR_000000000251&menuNo=3000&upperMenuId=3' },
    { id: 'cepa',   name: '충남일자리경제진흥원',  what: '컨설턴트·평가위원',
      re: /경제진흥원|일자리진흥원/, not: /세종/, url: 'https://www.cepa.or.kr/' },
    { id: 'seosan', name: '서산시 노동권익센터',   what: '비정규직 노무사',
      re: /서산\s*비정규직|서산시\s*노동권익/, url: 'https://www.seosan.go.kr/www/index.do' },
    { id: 'nosa',   name: '노사발전재단',          what: '일터혁신·고용구조개선·공무직 컨설턴트',
      re: /노사발전|고용구조개선|일터혁신|근무혁신|공무직\s*노사|공공부문\s*고용개선|노사협의회\s*구축|고용차별/,
      url: 'https://www.nosa.or.kr/portal' },
    { id: 'semas',  name: '소상공인시장진흥공단',  what: '역량강화·사업정리 컨설턴트',
      re: /소상공인|소상\s/, url: 'https://www.semas.or.kr/' },
    { id: 'sinbo',  name: '신용보증(신보·충남신보)', what: '컨설턴트·평가위원·강사',
      re: /신보|신용보증/, url: 'https://www.cnsinbo.co.kr/' },
    { id: 'kosmes', name: '중소벤처기업진흥공단',  what: '구조혁신·회생 컨설턴트',
      re: /중진공|중소벤처기업진흥공단|구조혁신|재도약|회생\s*컨설팅|재기\s*컨설팅/, url: 'https://www.kosmes.or.kr/' },
    { id: 'bizsup', name: '중소기업 비즈니스지원단', what: '상담위원',
      re: /비지니스지원단|비즈니스지원단|비즈콜센터/, url: 'https://www.kosmes.or.kr/' },
    { id: 'kordi',  name: '한국노인인력개발원',    what: '컨설턴트',
      re: /노인인력개발원/, url: 'https://www.kordi.or.kr/main.do' },
    { id: 'agri6',  name: '농촌융복합(6차산업)',   what: '현장코칭 전문위원',
      re: /6차산업|농촌융복합|현장코칭/, url: 'https://www.xn--6-ql4f73k2zh.com:448/home/coach/a.cs' },
    { id: 'lh',     name: 'LH 한국토지주택공사',    what: '안전보건 긴급상담·노무자문',
      re: /LH|한국토지/, url: 'https://www.lh.or.kr/' },
    { id: 'tp',     name: '테크노파크·기술닥터',    what: '기술닥터·전문가 풀',
      re: /테크노파크|기술닥터/, url: 'https://www.ctp.or.kr/' },
    { id: 'ccei',   name: '창조경제혁신센터',      what: '멘토·창업 소통위원',
      re: /창조혁신|창조경제|창업마루|창업현장/, url: 'https://ccei.creativekorea.or.kr/chungnam/' },
    { id: 'sei',    name: '한국사회적기업진흥원',  what: '프로보노',
      re: /프로보노|사회적기업진흥원/, url: 'https://www.socialenterprise.or.kr/' },
    { id: 'hrdk',   name: '한국산업인력공단',      what: 'NCS·공정채용 컨설턴트·전문가 인력풀',
      re: /NCS|공정채용|산업인력공단|HRD\s*전문가/, url: 'https://www.hrd4u.or.kr/expertpool/main.do' },
    { id: 'family', name: '가족친화 지원사업',     what: '가족친화 컨설턴트·인증심사원',
      re: /가족친화/, url: 'https://www.ffsb.kr/ffsbbod/bs/boardList.do?boardSeq=1' },
    { id: 'cnse',   name: '충남사회적경제지원센터', what: '컨설턴트·위원',
      re: /사회적경제|사회경제적/, url: 'https://www.cnse.kr/' },
    { id: 'alio',   name: '공공기관 경영평가(알리오)', what: '경영평가위원·직무급 점검',
      re: /경영평가|직무급|직무중심|알리오/, url: 'https://www.alio.go.kr/' },
    { id: 'kfcc',   name: '새마을금고중앙회',      what: '컨설턴트',
      re: /새마을/, url: 'https://www.kfcc.co.kr/' },
    { id: 'voucher', name: '혁신·데이터 바우처',   what: '공급기업·평가위원',
      re: /바우처/, url: 'https://kdata.or.kr/' },
    { id: 'keli',   name: '한국고용노동교육원',    what: '소규모사업장 노동교육 강사',
      re: /KELI|고용노동연수원|고용노동교육원/, url: 'https://www.keli.kr/' },
    { id: 'nrc',    name: '경제·인문사회연구회',   what: '위원·연구진(이력서 제출)',
      re: /경제인문사회연구회/, url: 'https://www.nrc.re.kr/' },
    /* 공인노무사회 — 고문·자문·위원·외부 조사자 모집 공고(서버 recruitWatch 가 «채용 정보»를 읽는다 — 공지·회원 공지는 제목으로 기관을 정한다).
       ⚠ 다른 기관들 «뒤»에 둔다 — 「대전충청지방노무사회 … 검찰시민위원회 위원 모집」처럼 노무사회가 «전달»한 다른 기관
         공고는 그 기관이 먼저 가져가야 한다. 차례가 곧 우선순위다. */
    { id: 'kcplaa', name: '한국공인노무사회', what: '고문·자문·위원·외부 조사자 모집 공고',
      re: /공인노무사회|노무사회/, url: 'https://www.kcplaa.or.kr/worker/list?scd=1' },
    /* ⚠ 맞는 주소를 확인하지 못했다 — 비워 두고 화면에서 넣게 한다(지어내지 않는다) */
    { id: 'pass',   name: '사회서비스원(충남·충북)', what: '이사·위원',
      re: /사회서비스원/, url: '' }
  ];

  function s(v) { return v == null ? '' : String(v); }

  /* 손으로 더한 기관 — 「찾는 말」은 쉼표로 가른 낱말이다. 정규식을 «짓지» 않고 낱말로만 본다
     (사람이 친 글자를 정규식으로 쓰면 괄호 하나에 화면이 멎는다). */
  function customOrg(c) {
    var words = s(c && c.kw).split(/[,，]/).map(function (w) { return w.trim(); }).filter(Boolean);
    return { id: s(c.id), name: s(c.name), what: s(c.what), url: s(c.url), custom: true,
      test: function (nm) { return words.some(function (w) { return nm.indexOf(w) >= 0; }); } };
  }
  function orgTest(o, nm) {
    if (o.test) return o.test(nm);
    if (o.not && o.not.test(nm)) return false;
    return o.re.test(nm);
  }
  /* 사전 + 손으로 더한 것 (손으로 더한 것이 «앞» — 대표님이 일부러 더한 것이 이긴다) */
  function allOrgs(custom) {
    return (custom || []).filter(function (c) { return c && c.id && c.name; }).map(customOrg).concat(ORGS);
  }

  /* entries: [{y:'2025', name:'2025 지방공기업평가원 …', t: 파일 날짜(ms) 또는 0}] */
  function group(entries, custom) {
    var orgs = allOrgs(custom), by = {}, rest = [];
    (entries || []).forEach(function (e) {
      if (!e || !e.name) return;
      var nm = s(e.name);
      for (var i = 0; i < orgs.length; i++) {
        if (orgTest(orgs[i], nm)) { (by[orgs[i].id] = by[orgs[i].id] || []).push(e); return; }
      }
      rest.push(e);
    });
    var out = orgs.map(function (o) {
      var items = (by[o.id] || []).slice().sort(function (a, b) {
        return s(b.y).localeCompare(s(a.y)) || s(a.name).localeCompare(s(b.name)); });
      var years = [];
      items.forEach(function (e) { var y = s(e.y).slice(0, 4); if (/^\d{4}$/.test(y) && years.indexOf(y) < 0) years.push(y); });
      years.sort();
      return { id: o.id, name: o.name, what: o.what, url: o.url, custom: !!o.custom,
        items: items, years: years, month: typicalMonth(items) };
    });
    return { orgs: out, rest: rest };
  }

  /* 가장 잦은 달 — 비기면 «이른» 달(알림은 이른 쪽이 안전하다). 날짜를 모르면 0 */
  function typicalMonth(items) {
    var c = {};
    (items || []).forEach(function (e) {
      var t = Number(e && e.t); if (!t) return;
      var m = new Date(t).getMonth() + 1; c[m] = (c[m] || 0) + 1;
    });
    var best = 0, n = 0;
    for (var m = 1; m <= 12; m++) if ((c[m] || 0) > n) { n = c[m]; best = m; }
    return best;
  }

  /* 이번 달부터 몇 달 뒤인가 (0 = 이번 달, 11 = 지난달). 달을 모르면 99 */
  function monthsAhead(month, today) {
    if (!month) return 99;
    var now = (today ? new Date(today) : new Date()).getMonth() + 1;
    return (month - now + 12) % 12;
  }

  /* 지원한 적 있는 곳만, 가까운 달부터 — 같은 달이면 «여러 해 낸 곳»이 위 */
  function order(orgs, today) {
    return (orgs || []).filter(function (o) { return o.years.length || o.custom; })
      .slice().sort(function (a, b) {
        return monthsAhead(a.month, today) - monthsAhead(b.month, today)
          || b.years.length - a.years.length || s(a.name).localeCompare(s(b.name));
      });
  }

  /* 이번 달·다음 달에 열리던 곳 — 없으면 «가장 가까운 달»과 그 달 곳 수 */
  function soon(orgs, today) {
    var list = order(orgs, today).filter(function (o) { return o.month; });
    var now = list.filter(function (o) { return monthsAhead(o.month, today) === 0; });
    var next = list.filter(function (o) { return monthsAhead(o.month, today) === 1; });
    var first = list[0] || null, near = null;
    if (!now.length && !next.length && first) {
      near = { month: first.month, count: list.filter(function (o) { return o.month === first.month; }).length,
        ahead: monthsAhead(first.month, today) };
    }
    return { now: now, next: next, near: near };
  }

  /* 올해 이미 냈나 — 폴더에 올해 이름이 있으면 «냈다» */
  function appliedThisYear(o, today) {
    var y = String((today ? new Date(today) : new Date()).getFullYear());
    return (o && o.years || []).indexOf(y) >= 0;
  }

  /* ═══ 구글 캘린더 (대표 결정 2026-10-04 「둘 다」 중 구글 쪽) ═══
     ⚠ 일정을 «우리가» 넣지 않는다 — 구글 캘린더의 «일정 만들기 창»을 채워 열 뿐이고,
       저장은 대표님이 누른다(로그인·권한을 우리가 쥐지 않는다). 그래서 서버도 열쇠도 필요 없다.
     ⚠ 싣는 것은 기관 이름·공지 링크뿐이다 — 개인정보를 주소에 싣지 않는다. */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  /* 준비 알림 날 — 모집 달의 «앞 달 1일», 오늘 이후로 가장 가까운 것.
     ⚠ 모집 달 1일에 알리면 이미 공고가 나와 있을 수 있다 — 서류 준비할 한 달을 번다. */
  function prepDate(month, today) {
    if (!month) return null;
    var t = today ? new Date(today) : new Date();
    var pm = month === 1 ? 12 : month - 1;
    var d = new Date(t.getFullYear(), pm - 1, 1);
    var t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if (d < t0) d = new Date(t.getFullYear() + 1, pm - 1, 1);
    return d;
  }
  /* o: {title, date:Date|'YYYY-MM-DD', details, yearly} → 하루짜리 일정 만들기 창 주소 */
  function gcalUrl(o) {
    var d = o.date instanceof Date ? o.date : new Date(String(o.date) + 'T00:00:00');
    if (isNaN(d)) return '';
    var e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    var q = 'action=TEMPLATE&text=' + encodeURIComponent(s(o.title))
      + '&dates=' + ymd(d) + '/' + ymd(e)
      + '&details=' + encodeURIComponent(s(o.details));
    if (o.yearly) q += '&recur=' + encodeURIComponent('RRULE:FREQ=YEARLY');
    return 'https://calendar.google.com/calendar/render?' + q;
  }
  /* 해마다 도는 «모집 준비» 일정 */
  function prepEvent(org, today) {
    var d = prepDate(org && org.month, today); if (!d) return '';
    return gcalUrl({ title: '[모집 준비] ' + org.name + ' — 보통 ' + org.month + '월 모집', date: d, yearly: true,
      details: (org.what ? org.what + '\n' : '') + '모집 공지를 확인하고 서류를 준비하세요.'
        + (org.url ? '\n공지: ' + org.url : '') + '\n(정부사업신청 › 컨설턴트 모집에서 넣은 일정)' });
  }
  /* 올해 «마감일» 일정 */
  function dueEvent(org, due) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s(due))) return '';
    return gcalUrl({ title: '[마감] ' + org.name + ' 컨설턴트 지원', date: due,
      details: (org.what ? org.what + '\n' : '') + (org.url ? '공지: ' + org.url + '\n' : '')
        + '(정부사업신청 › 컨설턴트 모집에서 넣은 일정)' });
  }

  /* 이 이름에 걸리는 사전 기관 번호들 — 겹침 검사용 */
  function matches(name, custom) {
    var nm = s(name);
    return allOrgs(custom).filter(function (o) { return orgTest(o, nm); }).map(function (o) { return o.id; });
  }

  /* ── 새 모집 글 나누기 (대표 지시 2026-10-05 「공인노무사 공지 · 그간 지원·메일 · 기타 공공기관으로 내용 보고 분류」) ──
     ① 어디서 왔나(hitGroup) — 공인노무사회 게시판(공지·회원 공지·채용 정보)이면 'kc', 나머지는 'pub'.
        ⚠ «출처»로 가른다 — 공인노무사회 공지에 실린 노사발전재단 모집 공문도 공인노무사회 탭에 둔다(대표가 거기서 봤다).
     ② 무엇을 뽑나(kindOf) — 제목으로. 차례가 중요하다: 행사·안내를 먼저 거르고(「박람회 참여 노무사 모집」이 컨설팅으로 가지 않게),
        다음 후보 추천 → 강사·멘토 → 컨설팅·자문·조사 → 위원·이사. 어디에도 안 맞으면 기타.
        ⚠ 낱말은 2026-10-05 실제 걸린 제목으로 정했다 — 넓힐 때는 실측 제목을 검사에 더한다. */
  var KINDS = [
    { k: 'event', icon: '📌', name: '행사·안내', re: /박람회|체험\s*부스|토크쇼|출연|행사|축제|설명회|간담회|세미나|규정\s*개정|개정\s*안내|교육생|수강생/ },
    { k: 'rec', icon: '🗳', name: '후보 추천', re: /추천/ },
    { k: 'teach', icon: '🎓', name: '강사·멘토', re: /강사|멘토|교수/ },
    { k: 'cons', icon: '💼', name: '컨설팅·자문·조사', re: /컨설턴트|컨설팅|전문가|전문위원|코칭|\bPM\b|수행\s*노무사|조사자|조사위원|연구진|인력\s*풀|\bpool\b|자문|고문|지원단|DB|담당자|노무사\s*모집|노무사\s*위촉|상담/i },
    { k: 'board', icon: '🏛', name: '위원·이사', re: /위원|이사|감사|심사|평가/ }
  ];
  var KIND_ETC = { k: 'etc', icon: '📎', name: '기타' };
  function kindOf(title) {
    var t = s(title);
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].re.test(t)) return KINDS[i].k;
    return 'etc';
  }
  function kindInfo(k) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k === k) return KINDS[i];
    return KIND_ETC;
  }
  function hitGroup(h) { return /^kcplaa/.test(s(h && h.board)) ? 'kc' : 'pub'; }

  return { ORGS: ORGS, group: group, matches: matches, prepDate: prepDate, gcalUrl: gcalUrl,
    prepEvent: prepEvent, dueEvent: dueEvent, typicalMonth: typicalMonth, monthsAhead: monthsAhead,
    order: order, soon: soon, appliedThisYear: appliedThisYear, allOrgs: allOrgs,
    KINDS: KINDS.concat([KIND_ETC]), kindOf: kindOf, kindInfo: kindInfo, hitGroup: hitGroup };
});
