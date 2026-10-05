/* 정부사업신청 ↔ 경력관리 — 동일·유사 판정기 (설계 docs/superpowers/specs/2026-10-05-gov-경력비교-design.md)
   대표 지시 2026-10-05 「경력관리에 이미 수행했던 부분과 비교해서 유사 또는 동일 등을 표시하고 확인하게」.
   ⚠ 순수 모듈 — DOM·통신 없음. 브라우저(window.GovMatch)·Node(require) 겸용.
   ⚠ 규칙으로 가른다(AI 아님) — 같은 자료면 언제나 같은 답, 까닭(why)을 늘 함께 낸다.
   ⚠ 보여 주는 글(show)에 «고객사·사람 이름»을 넣지 않는다 — 컨설팅의 고객사(org), 사건 이름(project)은 화면에 안 띄운다. */
(function (root) {
  function s(v) { return v == null ? '' : String(v).trim(); }

  /* ── 기관 이름 열쇠 ──
     ⚠ 「충청남도」와 「충청남도경제진흥원」은 다른 기관이다 — 앞 글자가 같다고 같은 곳으로 보면 안 된다.
       같음 = 열쇠가 같거나, 긴 쪽이 짧은 쪽 + «꼬리»(청·본부·지사·본사·지역본부·지청)일 때만. */
  var ALIAS = [[/충청남도/g, '충남'], [/충청북도/g, '충북'], [/경상남도/g, '경남'], [/경상북도/g, '경북'],
    [/전라남도/g, '전남'], [/전라북도/g, '전북'], [/세종특별자치시/g, '세종'], [/특별자치시|특별자치도/g, ''],
    [/경기도/g, '경기'], [/강원도/g, '강원'], [/제주도/g, '제주'],
    [/충남일자리경제진흥원/g, '충남경제진흥원'], [/한국토지주택공사/g, 'lh'], [/중소벤처기업진흥공단/g, '중진공'],
    [/소상공인시장진흥공단/g, '소진공'], [/에프엠어소시에이(?:션|츠)/g, '에프엠어소시에이츠']];
  function orgKey(name) {
    var t = s(name).toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .replace(/재단법인|사단법인|주식회사|\(재\)|\(사\)|\(주\)|㈜/g, '')
      .replace(/\s+|[.·,]/g, '');
    ALIAS.forEach(function (a) { t = t.replace(a[0], a[1]); });
    return t.replace(/(공지사항|공지|게시판|알림|홈페이지)$/, '');
  }
  /* 꼬리 — 「청」·「본사」, 또는 지역 이름이 붙은 「대전지사」·「경기본부」·「서산지청」 */
  var TAIL = /^(?:청|시청|도청|군청|구청|본사|[가-힣]{0,4}(?:지사|지역본부|본부|지청|사무소))$/;
  function sameOrg(a, b) {
    var x = orgKey(a), y = orgKey(b);
    if (x.length < 2 || y.length < 2) return false;
    if (x === y) return true;
    var l = x.length >= y.length ? x : y, sh = l === x ? y : x;
    return l.indexOf(sh) === 0 && TAIL.test(l.slice(sh.length));
  }

  /* ── 사업 종류 — 2026-10-05 대표 경력관리 실적에 실제 적힌 이름에서 만들었다 ──
     ⚠ 「컨설팅」 같은 넓은 말 하나로는 종류가 되지 않는다. 넓힐 때는 실측 이름을 검사에 더한다. */
  var TOPICS = [
    { k: 'worklife',  name: '일터혁신',            re: /일터\s*혁신|일터\s*상생|상생\s*컨설팅|장시간\s*근로|평생\s*근로|임금\s*[·.,+]?\s*평가|안전\s*(?:한\s*)?일터|장년\s*친화|직무\s*분석/ },
    { k: 'transit',   name: '산업·일자리 전환',    re: /일자리\s*전환|산업\s*전환|구조\s*혁신|사업\s*전환/ },
    { k: 'clinic',    name: '현장클리닉·비즈니스지원단', re: /현장\s*클리닉|비즈니스\s*지원단/ },
    { k: 'techprot',  name: '기술보호',            re: /기술\s*보호/ },
    { k: 'harass',    name: '직장 내 괴롭힘·성희롱 조사', re: /괴롭힘|성희롱|외부\s*조사/ },
    { k: 'family',    name: '출산·육아·가족친화',  re: /출산|육아|가족\s*친화|일\s*생활\s*균형/ },
    { k: 'hrconsult', name: '인사노무 컨설팅·자문', re: /인사\s*노무|노무\s*(?:자문|고문|상담)|자문\s*노무사|고문\s*노무사/ },
    { k: 'apart',     name: '공동주택·경비원',     re: /공동\s*주택|경비원/ },
    { k: 'fairhire',  name: '공정채용',            re: /공정\s*채용|블라인드\s*채용/ },
    { k: 'ncs',       name: 'NCS',                 re: /\bNCS\b|직무\s*능력\s*표준/i },
    { k: 'hours',     name: '노동시간 단축',       re: /노동\s*시간\s*단축|근로\s*시간\s*단축|주\s*52/ },
    { k: 'nonreg',    name: '고용구조 개선(비정규직)', re: /고용\s*구조|비정규직|고용\s*개선/ },
    { k: 'selfimp',   name: '근로조건 자율개선',   re: /자율\s*개선|기초\s*노동\s*질서/ },
    { k: 'public',    name: '공공부문·공무직',     re: /공무직|공공\s*부문/ },
    { k: 'wage',      name: '임금체계·직무급',     re: /임금\s*체계|직무급|보수\s*체계/ },
    { k: 'evalcomm',  name: '경영평가',            re: /경영\s*평가/ },
    { k: 'safety',    name: '위험성평가·산업안전', re: /위험성\s*평가|산업\s*안전|중대\s*재해/ },
    { k: 'social',    name: '사회적기업·사회적경제', re: /사회적\s*(?:기업|경제)/ },
    { k: 'welfund',   name: '근로복지기금',        re: /근로\s*복지\s*기금/ },
    { k: 'labcase',   name: '노동사건 대리',       re: /부당\s*해고|권리\s*구제|대리인|노동\s*위원회|체불|대지급금|산업\s*재해|산재/ },
    { k: 'lecture',   name: '강의·교육',           re: /강의|강사|교육/ },
    { k: 'judge',     name: '심사·평가·인사위원',  re: /심사\s*위원|평가\s*위원|심의\s*위원|인사\s*위원/ },
    { k: 'labmgmt',   name: '노사관계·노사민정',   re: /노사\s*민정|노사\s*협력|노사\s*관계|조정\s*위원|중재/ }
  ];
  function topicsOf(text) {
    var t = s(text), out = [];
    TOPICS.forEach(function (x) { if (x.re.test(t)) out.push(x.k); });
    return out;
  }
  function topicName(k) { for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].k === k) return TOPICS[i].name; return k; }

  /* ── 낱말 ── 버리는 말을 빼고 2글자 이상만 */
  var STOP = /^(모집|공고|안내|사업|지원|지원사업|년도|년|위촉|위원|위원회|의|건|및|등|관련|대상|추가|재공고|공개|선정|신청|참여|참가|운영|추진|위한|하반기|상반기|컨설팅|컨설턴트|노무사|공인노무사|전문가|인력풀|pool)$/i;
  function words(text) {
    var a = s(text).replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/(20\d{2})년?/g, ' ').toLowerCase()
      .split(/[^0-9a-z가-힣]+/);
    var out = [], seen = {};
    a.forEach(function (w) { if (w.length >= 2 && !STOP.test(w) && !seen[w]) { seen[w] = 1; out.push(w); } });
    return out;
  }
  function overlap(a, b) {
    if (a.length < 2 || b.length < 2) return 0;
    var set = {}, n = 0; a.forEach(function (w) { set[w] = 1; });
    b.forEach(function (w) { if (set[w]) n++; });
    return n / Math.min(a.length, b.length);
  }
  function yearOf(v) { var m = s(v).match(/20\d{2}/); return m ? m[0] : ''; }

  /* ── 경력관리 자료 → 견줄 줄 ──
     mat: GovCareer.build 결과 { wiccok, perf, work, ... } · scan: GovRecruit.group(...).orgs (서류 폴더 7번)
     ⚠ 자문·고문(advisory)은 넣지 않는다 — 고객사 이름을 공고 옆에 늘어놓을 까닭이 없다(설계 0절). */
  function selfAgency(a) { return !a || /직접|푸른\s*노무/.test(a); }
  function toRecs(mat, scanOrgs) {
    var out = [];
    mat = mat || {};
    (mat.wiccok || []).forEach(function (r) {
      out.push({ id: 'w|' + orgKey(r.org) + '|' + s(r.role) + '|' + s(r.year), src: 'wiccok', srcName: '위촉',
        org: s(r.org), title: s(r.role), year: s(r.year) || yearOf(r.issueDate),
        show: s(r.org) + (r.role ? ' · ' + s(r.role) : ''), topics: topicsOf(s(r.org) + ' ' + s(r.role)) });
    });
    (mat.perf || []).forEach(function (r) {
      var isCase = r.kind === '사건', isLec = r.kind === '강의';
      var agency = selfAgency(r.agency) ? '' : s(r.agency);
      /* 보여 줄 글 — 사건은 유형만, 컨설팅은 유형·사업·수행기관(고객사 빼고), 강의는 주제 */
      var show = isCase ? s(r.type) : isLec ? s(r.project) : [s(r.type), s(r.project), agency].filter(Boolean).join(' · ');
      out.push({ id: 'p|' + r.kind + '|' + (isCase ? s(r.type) : s(r.project) || s(r.type)) + '|' + agency + '|' + s(r.year) + '|' + s(r.status),
        src: 'perf', srcName: s(r.kind) || '실적', org: agency, title: isCase ? s(r.type) : (s(r.project) + ' ' + s(r.type)).trim(),
        year: s(r.year), show: show || s(r.kind), topics: topicsOf(s(r.type) + ' ' + (isCase ? '' : s(r.project)) + ' ' + (isLec ? '강의' : '')) });
    });
    (mat.work || []).forEach(function (r) {
      out.push({ id: 'k|' + orgKey(r.org) + '|' + s(r.start), src: 'work', srcName: '근무', org: s(r.org),
        title: s(r.dept) + ' ' + s(r.title), year: yearOf(r.start), show: [s(r.org), s(r.dept), s(r.title)].filter(Boolean).join(' · '),
        topics: [] });
    });
    (scanOrgs || []).forEach(function (o) {
      (o.items || []).forEach(function (e) {
        out.push({ id: 'd|' + o.id + '|' + s(e.y) + '|' + s(e.name), src: 'scan', srcName: '지원 서류', org: s(o.name), orgId: o.id,
          title: s(e.name), year: s(e.y).slice(0, 4), show: s(e.name), topics: topicsOf(e.name) });
      });
    });
    /* ⚠ 같은 줄은 묶는다 — 고객사만 다른 실적이 24줄씩 반복되면 볼 수가 없다(화면엔 고객사를 안 띄우니 똑같아 보인다).
         묶음 = 갈래(src) + 보여 줄 글(show). 해는 모아 두고, 견줄 때는 가장 최근 해를 쓴다. */
    var by = {}, list = [];
    out.forEach(function (r) {
      var gid = r.src + '|' + r.show;
      var g = by[gid];
      if (!g) { g = by[gid] = { id: gid, src: r.src, srcName: r.srcName, org: r.org, orgId: r.orgId, title: r.title, show: r.show,
        topics: r.topics.slice(), years: [], count: 0, year: '' }; list.push(g); }
      g.count++;
      if (r.year && g.years.indexOf(r.year) < 0) g.years.push(r.year);
      r.topics.forEach(function (k) { if (g.topics.indexOf(k) < 0) g.topics.push(k); });
    });
    list.forEach(function (g) { g.years.sort().reverse(); g.year = g.years[0] || ''; });
    return list;
  }

  /* ── 견주기 ──
     target: { orgId, orgNames:[...], title, year } · matches(name) → [사전 기관 id] (GovRecruit.matches, 없으면 생략)
     → { level:'same'|'similar'|'', score, why:[] } */
  function compare(target, rec, matches) {
    target = target || {}; rec = rec || {};
    var why = [];
    var orgSame = false;
    if (rec.org) {
      if (target.orgId && (rec.orgId === target.orgId || (matches && matches(rec.org).indexOf(target.orgId) >= 0))) orgSame = true;
      else (target.orgNames || []).forEach(function (n) { if (!orgSame && sameOrg(n, rec.org)) orgSame = true; });
    }
    var tt = topicsOf(target.title), shared = tt.filter(function (k) { return rec.topics && rec.topics.indexOf(k) >= 0; });
    var ov = overlap(words(target.title), words(rec.title));
    if (orgSame) why.push('기관 같음');
    if (shared.length) why.push('같은 종류: ' + shared.map(topicName).join(', '));
    if (ov >= 0.5) why.push('이름 ' + Math.round(ov * 100) + '% 겹침');
    if (rec.year) why.push(rec.years && rec.years.length > 1 ? rec.years[rec.years.length - 1] + '~' + rec.years[0] : rec.year);
    var level = '';
    if (orgSame && (shared.length || ov >= 0.6)) level = 'same';
    else if (orgSame || shared.length || ov >= 0.5) level = 'similar';
    if (!level) return { level: '', score: 0, why: [] };
    var score = (level === 'same' ? 1000 : 0) + (orgSame ? 300 : 0) + shared.length * 50 + Math.round(ov * 100) + (Number(rec.year) || 0) / 10000;
    return { level: level, score: score, why: why };
  }

  /* ── 한 대상에 대해 모두 견준다 ──
     marks: { safeKey(대상열쇠|기록열쇠): 'y'|'n' } · keyOf(targetKey, recId) → marks 열쇠
     → { same:[{rec,level,why,mark}], similar:[...], no:[...] } — 「아님」 표시한 것은 no 로 */
  function findFor(target, recs, marks, keyOf, matches) {
    var res = { same: [], similar: [], no: [] };
    (recs || []).forEach(function (r) {
      var c = compare(target, r, matches);
      if (!c.level) return;
      var mk = marks && keyOf ? marks[keyOf(target.key, r.id)] : '';
      var it = { rec: r, level: c.level, why: c.why, score: c.score, mark: mk || '' };
      if (mk === 'n') res.no.push(it); else res[c.level].push(it);
    });
    var by = function (a, b) { return b.score - a.score; };
    res.same.sort(by); res.similar.sort(by); res.no.sort(by);
    return res;
  }

  var api = { orgKey: orgKey, sameOrg: sameOrg, TOPICS: TOPICS, topicsOf: topicsOf, topicName: topicName,
    words: words, overlap: overlap, toRecs: toRecs, compare: compare, findFor: findFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovMatch = api;
})(typeof window !== 'undefined' ? window : this);
