/* ══════════════════════════════════════════════════════════════════
   pu-rules-lawlink.js — 검토 규칙 ↔ 법 조문 연결표 (공용)

   규정관리의 검토 규칙 92개는 근거 법을 «글자로만» 적어 두었다
   (「근로기준법 §74⑨·⑩」「남녀고용평등법 §18의2·§18의3」 …).
   글자로는 「근로기준법 제54조가 바뀌면 어느 규칙이 흔들리나」를 물을 수 없다.
   이 파일이 그 글자를 «법 · 조 · 항 · 호» 로 풀어 서로 찾을 수 있게 한다.

     parse('근로기준법 §50, §53')
       → { refs:[{law:'근로기준법', art:'50', jo:'005000'}, {law:'근로기준법', art:'53', …}], other:[], bad:[] }
     build(RULES).byArticle['근로기준법|54'] → ['B2','D11']
     rulesFor('근로기준법', '54')           → ['B2','D11']

   ── 온톨로지 ──
   관계어는 groundedIn(검토 기준 → 법령 조문)이다. 관계 색인(ontology/v1)이 아직
   꺼져 있어 색인에는 넣지 않는다 — 이 표는 코드 안의 «정적 참고표»일 뿐이고
   아무 자리에도 쓰지 않는다(sourceMutation 없음).

   ── 법 이름 ──
   법령 ID 는 법제처의 것이다(바뀌지 않는 열쇠). 법 이름은 바뀐다 —
   「근로자의 날 제정에 관한 법률」이 2025-11-11 「노동절 제정에 관한 법률」이 되었다.
   그래서 연결의 열쇠는 이름이 아니라 LAWS 의 key(정식 제명)와 id 둘이다.

   ── 기준 판(SNAPSHOT) ──
   연결된 조의 «제목»을 받아 둔 날의 판이다. 출처는 legalize-kr(법제처 원문을 조문 단위로
   git 에 담은 저장소, 공포일자 = 커밋 날짜). 제목이 곁에 있어야 연결이 맞는지 사람이 한눈에
   보고, 다음 단계(법 개정 감시)가 「그날 이후 공포된 개정」을 가려낸다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (!root || root.PuRulesLawLink) return;

  /* 법 한 벌 — key 는 정식 제명, id 는 법제처 법령ID, src 는 legalize-kr 의 폴더 이름.
     promulgated·effective 는 SNAPSHOT 을 받은 날 그 저장소가 가진 최신 공포본이다
     (시행일이 아직 안 온 공포본일 수 있다 — 조문 제목을 대조하는 데는 문제없다). */
  var LAWS = [
    { key:'근로기준법', id:'001872', src:'근로기준법', promulgated:'2026-06-09', effective:'2027-06-10', alias:['근로기준법'] },
    { key:'최저임금법', id:'000129', src:'최저임금법', promulgated:'2026-04-07', effective:'2026-12-08', alias:['최저임금법'] },
    { key:'남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', id:'000130', src:'남녀고용평등과일ㆍ가정양립지원에관한법률',
      promulgated:'2026-05-26', effective:'2026-11-27', alias:['남녀고용평등법'] },
    { key:'기간제 및 단시간근로자 보호 등에 관한 법률', id:'010356', src:'기간제및단시간근로자보호등에관한법률',
      promulgated:'2026-04-07', effective:'2026-12-08', alias:['기간제법'] },
    { key:'파견근로자 보호 등에 관한 법률', id:'000122', src:'파견근로자보호등에관한법률',
      promulgated:'2026-05-26', effective:'2026-05-26', alias:['파견법'] },
    { key:'고용상 연령차별금지 및 고령자고용촉진에 관한 법률', id:'000121', src:'고용상연령차별금지및고령자고용촉진에관한법률',
      promulgated:'2022-06-10', effective:'2022-06-10', alias:['고령자고용법'] },
    { key:'근로자퇴직급여 보장법', id:'009883', src:'근로자퇴직급여보장법', promulgated:'2026-03-17', effective:'2026-07-01',
      alias:['근로자퇴직급여 보장법','퇴직급여법'] },
    { key:'노동조합 및 노동관계조정법', id:'000143', src:'노동조합및노동관계조정법', promulgated:'2025-09-09', effective:'2026-03-10',
      alias:['노동조합법','노조법'] },
    { key:'산업안전보건법', id:'001766', src:'산업안전보건법', promulgated:'2026-07-07', effective:'2027-01-08', alias:['산업안전보건법'] },
    { key:'근로자참여 및 협력증진에 관한 법률', id:'000141', src:'근로자참여및협력증진에관한법률',
      promulgated:'2022-06-10', effective:'2022-12-11', alias:['근로자참여법'] },
    { key:'개인정보 보호법', id:'011357', src:'개인정보보호법', promulgated:'2026-09-08', effective:'2027-03-09', alias:['개인정보보호법'] },
    { key:'민법', id:'001706', src:'민법', promulgated:'2026-03-17', effective:'2026-03-17', alias:['민법'] },
    { key:'신원보증법', id:'001247', src:'신원보증법', promulgated:'2009-01-30', effective:'2009-01-30', alias:['신원보증법'] },
    { key:'채용절차의 공정화에 관한 법률', id:'011990', src:'채용절차의공정화에관한법률',
      promulgated:'2020-05-26', effective:'2020-05-26', alias:['채용절차법'] },
    { key:'장애인고용촉진 및 직업재활법', id:'001763', src:'장애인고용촉진및직업재활법',
      promulgated:'2026-05-26', effective:'2028-05-27', alias:['장애인고용법'] },
    { key:'예비군법', id:'001619', src:'예비군법', promulgated:'2026-06-09', effective:'2026-12-10', alias:['예비군법'] },
    { key:'민방위기본법', id:'001631', src:'민방위기본법', promulgated:'2025-04-01', effective:'2025-04-01', alias:['민방위기본법'] },
    { key:'산업재해보상보험법', id:'001760', src:'산업재해보상보험법', promulgated:'2026-02-19', effective:'2026-07-01',
      alias:['산재보험법'] },
    { key:'국민연금법', id:'001781', src:'국민연금법', promulgated:'2026-09-15', effective:'2027-03-16', alias:['국민연금법'] },
    { key:'국민건강보험법', id:'001971', src:'국민건강보험법', promulgated:'2026-05-26', effective:'2027-01-01', alias:['국민건강보험법'] },
    { key:'고용보험법', id:'001761', src:'고용보험법', promulgated:'2026-05-26', effective:'2026-11-27', alias:['고용보험법'] },
    { key:'임금채권보장법', id:'000128', src:'임금채권보장법', promulgated:'2026-04-07', effective:'2026-12-08', alias:['임금채권보장법'] },
    { key:'공휴일에 관한 법률', id:'014112', src:'공휴일에관한법률', promulgated:'2026-04-09', effective:'2026-05-01',
      alias:['공휴일에 관한 법률','공휴일법'] },
    /* 조가 없는 한 줄짜리 법이다 — 연결은 «법 전체» 로만 한다. 옛 이름도 받는다. */
    { key:'노동절 제정에 관한 법률', id:'000132', src:'노동절제정에관한법률', promulgated:'2025-11-11', effective:'2025-11-11',
      alias:['노동절 제정에 관한 법률','근로자의 날 제정에 관한 법률'] }
  ];

  /* 기준 판 — 연결된 조의 제목. 받은 날: SNAPSHOT_AT.
     ⚠ 손으로 늘리지 말고 규칙이 새 조를 가리키게 되면 그 조의 제목을 원문에서 옮겨 적는다
       (tests/rules-lawlink.test.js 가 «연결됐는데 제목이 없는 조» 를 잡는다). */
  var SNAPSHOT_AT = '2026-09-26';
  var TITLES = {
    '근로기준법': {
      '6':'균등한 처우', '10':'공민권 행사의 보장', '14':'법령 주요 내용 등의 게시', '18':'단시간근로자의 근로조건',
      '20':'위약 예정의 금지', '21':'전차금 상계의 금지', '22':'강제 저금의 금지', '23':'해고 등의 제한',
      '26':'해고의 예고', '27':'해고사유 등의 서면통지', '36':'금품 청산', '43':'임금 지급',
      '46':'휴업수당', '48':'임금대장 및 임금명세서', '50':'근로시간', '51':'3개월 이내의 탄력적 근로시간제',
      '51의2':'3개월을 초과하는 탄력적 근로시간제', '52':'선택적 근로시간제', '53':'연장 근로의 제한', '54':'휴게',
      '55':'휴일', '56':'연장ㆍ야간 및 휴일 근로', '57':'보상 휴가제', '60':'연차 유급휴가',
      '61':'연차 유급휴가의 사용 촉진', '62':'유급휴가의 대체', '64':'최저 연령과 취직인허증', '65':'사용 금지',
      '66':'연소자 증명서', '67':'근로계약', '68':'임금의 청구', '69':'근로시간',
      '70':'야간근로와 휴일근로의 제한', '73':'생리휴가', '74':'임산부의 보호', '74의2':'태아검진 시간의 허용 등',
      '75':'육아 시간', '76의2':'직장 내 괴롭힘의 금지', '76의3':'직장 내 괴롭힘 발생 시 조치', '87':'다른 손해배상과의 관계',
      '93':'취업규칙의 작성ㆍ신고', '94':'규칙의 작성, 변경 절차', '95':'제재 규정의 제한', '97':'위반의 효력'
    },
    '최저임금법': { '5':'최저임금액', '6':'최저임금의 효력' },
    '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률': {
      '13':'직장 내 성희롱 예방 교육 등', '14':'직장 내 성희롱 발생 시 조치', '18의2':'배우자 출산전후휴가',
      '18의3':'난임치료휴가', '18의4':'배우자 유산ㆍ사산휴가', '19':'육아휴직', '19의2':'육아기 근로시간 단축',
      '22의2':'근로자의 가족 돌봄 등을 위한 지원'
    },
    '기간제 및 단시간근로자 보호 등에 관한 법률': { '4':'기간제근로자의 사용', '8':'차별적 처우의 금지' },
    '파견근로자 보호 등에 관한 법률': { '6의2':'고용의무', '21':'차별적 처우의 금지 및 시정 등' },
    '고용상 연령차별금지 및 고령자고용촉진에 관한 법률': { '19':'정년' },
    '근로자퇴직급여 보장법': { '4':'퇴직급여제도의 설정', '8':'퇴직금제도의 설정 등', '9':'퇴직금의 지급 등' },
    '노동조합 및 노동관계조정법': { '33':'기준의 효력' },
    '산업안전보건법': { '29':'근로자에 대한 안전보건교육', '36':'위험성평가의 실시', '41':'고객의 폭언 등으로 인한 건강장해 예방조치 등',
      '52':'근로자의 작업중지', '129':'일반건강진단', '133':'건강진단에 관한 근로자의 의무' },
    '근로자참여 및 협력증진에 관한 법률': { '4':'노사협의회의 설치', '26':'고충처리위원' },
    '개인정보 보호법': { '15':'개인정보의 수집ㆍ이용', '17':'개인정보의 제공', '21':'개인정보의 파기', '25':'고정형 영상정보처리기기의 설치ㆍ운영 제한' },
    '민법': { '660':'기간의 약정이 없는 고용의 해지통고' },
    '신원보증법': { '3':'신원보증계약의 존속기간 등', '4':'사용자의 통지의무', '6':'신원보증인의 책임' },
    '채용절차의 공정화에 관한 법률': { '4':'거짓 채용광고 등의 금지', '4의3':'출신지역 등 개인정보 요구 금지', '11':'채용서류의 반환 등' },
    '장애인고용촉진 및 직업재활법': { '5의2':'직장 내 장애인 인식개선 교육' },
    '예비군법': { '10':'직장 보장' },
    '민방위기본법': { '27':'직장 보장' },
    '산업재해보상보험법': { '80':'다른 보상이나 배상과의 관계' },
    '임금채권보장법': { '7':'퇴직한 근로자에 대한 대지급금의 지급' }
  };

  var ALIAS = {};
  var BY_KEY = {};
  LAWS.forEach(function (l) {
    BY_KEY[l.key] = l;
    ALIAS[squash(l.key)] = l.key;
    (l.alias || []).forEach(function (a) { ALIAS[squash(a)] = l.key; });
  });

  /* 이름 견주기 — 띄어쓰기와 가운뎃점(ㆍ·) 차이는 같은 이름으로 본다 */
  function squash(s) { return String(s || '').replace(/[\sㆍ·・]/g, ''); }
  function lawOf(name) { return ALIAS[squash(name)] || ''; }

  var CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  function circled(ch) { var i = CIRCLED.indexOf(ch); return i < 0 ? 0 : i + 1; }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }

  /* 항 적기 「⑨·⑩」「⑥~⑧」「⑤」 → [9,10] · [6,7,8] · [5] */
  function hangs(s) {
    var out = [];
    String(s || '').split('·').forEach(function (p) {
      var m = /^([①-⑳])(?:~([①-⑳]))?$/.exec(p);
      if (!m) return;
      var a = circled(m[1]), b = m[2] ? circled(m[2]) : a;
      out = out.concat(range(a, b));
    });
    return out;
  }

  /* 조 번호 → 법제처 JO 코드 (조 4자리 + 의 2자리). 제10조의2 → 001002 */
  function joCode(art) {
    var m = /^(\d+)(?:의(\d+))?$/.exec(String(art || ''));
    if (!m) return '';
    var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };
    return pad(m[1], 4) + pad(m[2] || 0, 2);
  }

  /* 조 한 토막 「§93 제9호의2」「§74⑨·⑩」「§64~§69」「§25 등」 */
  var ART = /^§(\d+)(?:의(\d+))?((?:[①-⑳](?:[~·][①-⑳])*)?)(?:\s*제(\d+)호(?:의(\d+))?)?(?:\s*~\s*§(\d+))?(\s*등)?$/;

  function artRefs(law, piece) {
    var m = ART.exec(piece.trim());
    if (!m) return null;
    var base = m[1] + (m[2] ? '의' + m[2] : '');
    var arts = m[6] ? range(+m[1], +m[6]).map(String) : [base];
    var hang = hangs(m[3]);
    var ho = m[4] ? [m[4] + (m[5] ? '의' + m[5] : '')] : [];
    return arts.map(function (a) {
      var r = { law: law, art: a, jo: joCode(a) };
      if (hang.length) r.hang = hang;
      if (ho.length) r.ho = ho;
      if (m[7]) r.partial = true;        // 「등」 — 이 조 말고도 더 있다는 뜻
      return r;
    });
  }

  /* 글자 한 줄 → { refs(조 단위), laws(법 전체), other(판례 등), bad(못 푼 토막) } */
  function parse(text) {
    var out = { refs: [], laws: [], other: [], bad: [] };
    var s = String(text || '').trim();
    if (!s) return out;
    if (/^대법원|판결|결정$/.test(s)) { out.other.push({ kind: 'precedent', text: s }); return out; }
    var cur = '';
    /* 쉼표·빗금·«띄운» 가운뎃점은 토막을 가른다. 붙은 가운뎃점은 같은 법 안의 조·항을 잇는다. */
    s.split(/\s*[,\/]\s*|\s+[·ㆍ]\s+/).forEach(function (seg) {
      seg = seg.trim();
      if (!seg) return;
      var at = seg.indexOf('§');
      var name = (at < 0 ? seg : seg.slice(0, at)).trim();
      var refs = at < 0 ? '' : seg.slice(at);
      var note = '';
      var nm = /^(.*?)\s*개정(?:\(([^)]*)\))?$/.exec(name);
      if (nm) { name = nm[1].trim(); note = '개정' + (nm[2] ? '(' + nm[2] + ')' : ''); }
      if (name) {
        var names = refs ? [name] : name.split(/[·ㆍ]/);
        var keys = names.map(lawOf);
        if (keys.some(function (k) { return !k; })) { out.bad.push(seg); return; }
        if (!refs) {
          keys.forEach(function (k) { var o = { law: k }; if (note) o.note = note; out.laws.push(o); });
          cur = keys[keys.length - 1];
          return;
        }
        cur = keys[0];
      }
      if (!cur) { out.bad.push(seg); return; }
      refs.split(/[·ㆍ](?=§)/).forEach(function (p) {
        var r = artRefs(cur, p);
        if (r) out.refs = out.refs.concat(r); else out.bad.push(p);
      });
    });
    return out;
  }

  /* 규칙 전부 → 연결 목록과 찾아보기 */
  function build(rules) {
    var links = [], byArticle = {}, byLaw = {}, byRule = {}, unresolved = [], untitled = [];
    (rules || []).forEach(function (r) {
      if (!r || !r.id) return;
      var p = parse(r.law);
      byRule[r.id] = { refs: p.refs, laws: p.laws, other: p.other };
      p.refs.forEach(function (x) {
        links.push({ predicate: 'groundedIn', from: r.id, law: x.law, art: x.art, jo: x.jo,
          hang: x.hang || [], ho: x.ho || [], partial: !!x.partial });
        var k = x.law + '|' + x.art;
        (byArticle[k] = byArticle[k] || []).indexOf(r.id) < 0 && byArticle[k].push(r.id);
        if (!titleOf(x.law, x.art)) untitled.push({ rule: r.id, law: x.law, art: x.art });
      });
      p.refs.concat(p.laws).forEach(function (x) {
        (byLaw[x.law] = byLaw[x.law] || []).indexOf(r.id) < 0 && byLaw[x.law].push(r.id);
      });
      p.laws.forEach(function (x) {
        links.push({ predicate: 'groundedIn', from: r.id, law: x.law, art: '', jo: '', hang: [], ho: [], partial: false, note: x.note || '' });
      });
      if (p.bad.length) unresolved.push({ rule: r.id, text: r.law, bad: p.bad });
      if (!p.refs.length && !p.laws.length && !p.other.length) unresolved.push({ rule: r.id, text: r.law, bad: [r.law] });
    });
    return { links: links, byArticle: byArticle, byLaw: byLaw, byRule: byRule, unresolved: unresolved, untitled: untitled };
  }

  var built = null, builtFrom = null;
  function ensure(rules) {
    if (rules && rules !== builtFrom) { built = build(rules); builtFrom = rules; }
    if (!built) {
      var R = (typeof RULES !== 'undefined' && RULES) || root.RULES;
      if (R) { built = build(R); builtFrom = R; }
    }
    return built || build([]);
  }

  /* 이 조가 바뀌면 흔들리는 규칙들 — 조를 안 적은(법 전체) 규칙도 함께 돌려준다 */
  function rulesFor(law, art, rules) {
    var key = lawOf(law) || law, b = ensure(rules);
    var hit = (b.byArticle[key + '|' + String(art || '')] || []).slice();
    b.links.forEach(function (l) {
      if (l.law === key && !l.art && hit.indexOf(l.from) < 0) hit.push(l.from);
    });
    return hit;
  }
  function articlesOf(ruleId, rules) {
    var r = ensure(rules).byRule[ruleId];
    return r ? r.refs.slice() : [];
  }
  function titleOf(law, art) { var t = TITLES[lawOf(law) || law]; return (t && t[art]) || ''; }
  /* 사람이 읽는 한 토막 — 「근로기준법 제54조(휴게) 제1항」 */
  function label(ref) {
    if (!ref) return '';
    var s = ref.law + (ref.art ? ' 제' + ref.art.replace('의', '조의') + (ref.art.indexOf('의') < 0 ? '조' : '') : '');
    var t = ref.art ? titleOf(ref.law, ref.art) : '';
    if (t) s += '(' + t + ')';
    if (ref.hang && ref.hang.length) s += ' 제' + ref.hang.join('·') + '항';
    if (ref.ho && ref.ho.length) s += ' 제' + ref.ho.join('·').replace(/의/g, '호의') + (ref.ho[0].indexOf('의') < 0 ? '호' : '');
    return s;
  }
  function sourceUrl(law) {
    var l = BY_KEY[lawOf(law) || law];
    return l ? 'https://www.law.go.kr/법령/' + encodeURIComponent(l.key) : '';
  }

  root.PuRulesLawLink = {
    LAWS: LAWS, TITLES: TITLES, SNAPSHOT_AT: SNAPSHOT_AT,
    parse: parse, build: build, rulesFor: rulesFor, articlesOf: articlesOf,
    lawOf: lawOf, titleOf: titleOf, label: label, joCode: joCode, sourceUrl: sourceUrl,
    law: function (name) { return BY_KEY[lawOf(name) || name] || null; }
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));

/* node 검사에서도 그대로 부를 수 있게 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).PuRulesLawLink;
}
