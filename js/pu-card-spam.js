/* 🚫 명함 스팸 잣대 — 메일에서 온 명함이 스팸·광고인가 (대표 지시 2026-11-18)
   ═══════════════════════════════════════════════════════════════════════════
   「메일에서 가지고 오는 정보들 중에 처음부터 스팸이거나 추후에 스팸이 되거나 광고 등으로
    들어오는 내용들이 많다 — 별도로 수집이 필요 없다. 완전 스팸은 자동으로 걸러서 반드시
    제거해라. 기업정보함으로 들어왔더라도 스팸으로 바로 정리해라.」
   「스팸으로 의심되는 것은 별도로 모아서, 들어올 경우 팝업창으로 남길지 판단을 요청하게 해라.」

   ★ 답은 셋이다.
       'spam'    확실한 스팸 — 명함으로 안 넣는다 / 이미 있으면 휴지통(30일 안에 되살린다)
       'suspect' 스팸 의심 — 따로 모아 «남길까요?» 창으로 사람에게 묻는다
       ''        스팸 아님
   ★ «확실한 스팸»은 «모양»으로만 정한다 — 낱말로는 정하지 않는다.
     메일함 🚫 거르개(pu-cards.html mbSpamWhy)가 이미 6,334통에 대 보고 세운 잣대다:
     「대출·광고·클릭 같은 목록은 우리 일에 못 쓴다 — 체불·해고 상담 메일에 그런 말이
     그대로 나온다」. 그래서 낱말(광고 제목·직함만 있는 이름·해외 영업)은 «의심»까지만 —
     사람이 한 번 보고 정한다.
   ⚠ 사람이 정한 것이 규칙보다 앞선다: 「남기기」(ok)·메일함 「스팸 아님」(notSpam)이면
     무엇에 걸려도 지나간다. 「스팸」으로 정한 주소(spam)는 다음부터 확실한 스팸이다.
   ⚠ 업체관리(이알피)에 이어진 명함·휴대폰 번호가 적힌 명함은 «저절로 지우지 않는다» —
     확실한 스팸 모양이어도 «의심»으로 낮춰 사람에게 묻는다(진짜 사람을 잃는 것이 더 나쁘다).
   ⚠ 이 파일은 «순수 판정»만 한다 — 읽기·쓰기·지우기는 부르는 쪽(remember-intake.html ·
     pu-cards.html)이 한다. 검사: tests/card-spam.test.js */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuCardSpam = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  /* 주소 열쇠 — functions/mail-card.js emailKey · pu-cards.html mbWhoKey 와 같은 모양 */
  function key(e) { return str(e).toLowerCase().replace(/[.#$\/\[\]]/g, ','); }
  function domainOf(e) {
    var s = str(e).toLowerCase(), at = s.lastIndexOf('@');
    return at > 0 ? s.slice(at + 1) : '';
  }
  function digits(v) { return str(v).replace(/\D/g, ''); }

  /* ── 확실한 스팸의 «모양» ── */

  /* 주소 앞부분에 실제 주소에 안 쓰는 글자(「?」·빈칸·한글 …).
     ⚠ 메일함 mbBadLocal(pu-cards.html)과 «같은 식»이다 — 하나를 고치면 둘 다 고친다
       (tests/card-spam.test.js 가 두 식이 같은지 본다). */
  function badLocal(email) {
    var e = str(email).toLowerCase();
    var at = e.indexOf('@');
    if (at < 1) return false;
    return /[^a-z0-9._%+\-]/.test(e.slice(0, at));
  }
  /* 도메인에 실제 도메인에 안 쓰는 글자 */
  function badDomain(email) {
    var d = domainOf(email);
    if (!d) return false;
    return /[^a-z0-9.\-]/.test(d);
  }
  /* 못 읽은 글자(U+FFFD) — 머리글·서명이 깨졌다는 뜻(메일함 mbBrokenText 와 같은 잣대) */
  function broken(s) { return /�/.test(str(s)); }
  /* 이름에 글자(한글 음절·영문·한자·가나)가 하나도 없다 — 「ㄴㄴ」「???」「...」「1234」 */
  function noLetterName(name) {
    var n = str(name);
    return !!n && !/[가-힣A-Za-z一-鿿぀-ヿ]/.test(n);
  }
  /* 아무렇게나 친 듯한 글자 — 모음이 거의 없거나 자음이 다섯 넘게 이어진다
     (dljenhxy · ojelvjwb). 영문 6자 미만은 보지 않는다(줄임 주소가 흔하다).
     ⚠ 이 하나로는 스팸이라 하지 않는다 — 앞(주소)과 뒤(도메인)가 «둘 다» 이렇고,
       메일 주소 말고는 아무것도 없을 때만이다. 한국식 줄임(sjhwang 등)이 이 모양에 걸린다. */
  function randomish(s) {
    var t = str(s).toLowerCase().replace(/[^a-z]/g, '');
    if (t.length < 6) return false;
    var run = 0, maxRun = 0, vowels = 0;
    for (var i = 0; i < t.length; i++) {
      if ('aeiou'.indexOf(t[i]) >= 0) { vowels++; run = 0; }
      else { run++; if (run > maxRun) maxRun = run; }
    }
    if (maxRun >= 5) return true;
    return t.length >= 7 && vowels / t.length < 0.2;
  }
  function randomDomain(email) {
    var labels = domainOf(email).split('.').filter(Boolean);
    if (labels.length < 2) return false;
    return labels.slice(0, -1).some(randomish);   /* 맨 끝(com·kr …)은 빼고 */
  }
  function randomLocal(email) {
    var e = str(email), at = e.indexOf('@');
    return at > 0 && randomish(e.slice(0, at));
  }

  /* ── 의심의 «낱말» — 사람이 보고 정한다 ── */

  /* 광고·홍보·영업 메일 제목. 「(광고)」는 서버(mail-card.js SKIP_SUBJ)가 이미 거르지만
     다른 꼴로 오는 것이 있다. ⚠ 「무료 상담」·「문의」처럼 진짜 문의에 나오는 말은 넣지 않는다. */
  var AD_SUBJ = /^\s*[\(\[【<]?\s*(광고|홍보|AD)\s*[\)\]】>]|수신\s*거부|unsubscribe|뉴스\s*레터|newsletter|웨비나|webinar|프로모션|promotion|제휴\s*제안|협업\s*제안|입점\s*제안|광고\s*제안|partnership|collaboration|sponsor|\bSEO\b|backlink|guest\s*post/i;
  /* 이름 칸에 사람 이름 대신 직함·부서만 — 「기업지원팀장」 */
  var ROLE_NAME = /(팀장|부장|차장|과장|실장|대리|주임|사원|이사|상무|전무|본부장|센터장|담당자?|매니저|팀|센터|본부|사무국|운영자|관리자|고객센터|상담원|상담사|컨설턴트|지원단|사업단|마케터)$/;
  /* 자금·광고 영업에 늘 붙는 말 — 이름·회사·직함 칸에 있을 때만 본다(제목·본문은 안 본다) */
  var PROMO = /(기업\s*지원|정책\s*자금|자금\s*지원|지원금\s*안내|대출|투자\s*유치|바이럴|체험단|광고\s*대행|마케팅\s*대행)/;
  /* 해외 영업 메일의 직함 */
  var OUTREACH = /\b(co-?founder|founder|ceo|cmo|cro|growth|marketing|sales|business\s+development|biz\s*dev|partnerships?|outreach|account\s+(executive|manager)|sdr|bdr|head\s+of)\b/i;
  /* 공공기관·학교 — 「이름 칸이 부서명」·「주소만 있음」이 흔하다(딥테크전략실 · kised.or.kr) */
  var PUBLIC_DOM = /\.(go|or|ac|re|mil|hs|ms|es|sc|kg|seoul|busan)\.kr$|\.gov$|\.edu$|\.ac\.[a-z]{2}$/;

  function hasKrPhone(f) {
    return ['mobile', 'tel', 'companyTel', 'fax', 'companyFax'].some(function (k) {
      var d = digits(f[k]);
      return d.length >= 8 && (d[0] === '0' || d.indexOf('82') === 0);
    });
  }
  function hasMobile(f) { return /^01[016789]\d{7,8}$/.test(digits(f.mobile)); }
  function hasAnyPhone(f) {
    return ['mobile', 'tel', 'companyTel', 'fax', 'companyFax'].some(function (k) { return digits(f[k]).length >= 7; });
  }
  function onlyEmail(f) {
    return !str(f.company) && !hasAnyPhone(f) && !str(f.address) && !str(f.companyAddr);
  }
  /* 사람 이름 같은가 — 한글 2~4자(띄어 쓰지 않은 것) */
  function personName(n) { return /^[가-힣]{2,4}$/.test(str(n)); }

  /* 목록(사람이 정한 것)에 있나 — 주소 그대로 또는 「@도메인」 */
  function listed(map, email) {
    if (!map || !str(email)) return '';
    var k = key(email), d = domainOf(email);
    if (map[k]) return k;
    if (d && map[key('@' + d)]) return key('@' + d);
    return '';
  }
  function listedAddr(map, email) {
    if (!map || !str(email)) return '';
    var k = key(email);
    return map[k] ? k : '';
  }

  /* 판정 — f: 명함 칸(name·company·title·dept·mobile·tel·companyTel·fax·email·address·companyAddr)
     ctx: { subject: 메일 제목, fromMail: 메일에서 온 명함인가,
            ok: 「남기기」 주소 표, notSpam: 메일함 「스팸 아님」 표, spam: 「스팸」 주소 표,
            protect: 업체관리에 이어진 명함인가 } */
  function judge(f, ctx) {
    f = f || {}; ctx = ctx || {};
    var email = str(f.email);
    var subject = str(ctx.subject);
    var name = str(f.name), company = str(f.company);
    var title = [str(f.title), str(f.dept)].filter(Boolean).join(' ');

    /* 사람이 「남긴다」고 정했으면 무엇에도 안 걸린다 */
    if (listed(ctx.ok, email) || listed(ctx.notSpam, email)) return { level: '', why: [], kept: true };

    var hard = [], soft = [];
    var human = listedAddr(ctx.spam, email);
    if (human) hard.push('스팸으로 정한 주소입니다');
    if (badLocal(email)) hard.push('메일 주소가 규약에 안 맞습니다');
    else if (badDomain(email)) hard.push('메일 도메인이 규약에 안 맞습니다');
    if (broken(name) || broken(company) || broken(title) || broken(subject)) hard.push('글자가 깨져 있습니다');
    if (noLetterName(name) && !company) hard.push('이름에 글자가 없습니다');
    if (onlyEmail(f) && randomLocal(email) && randomDomain(email)) hard.push('메일 주소가 아무렇게나 친 글자입니다');

    var pub = PUBLIC_DOM.test(domainOf(email));
    if (subject && AD_SUBJ.test(subject)) soft.push('광고·영업 메일 제목입니다');
    if (PROMO.test([name, company, title].join(' '))) soft.push('자금·광고 영업에 쓰는 말이 있습니다');
    if (!pub && !company && !hasAnyPhone(f) && ROLE_NAME.test(name.replace(/\s/g, '')) && !personName(name.replace(/(님)$/, '')))
      soft.push('이름 칸에 사람 이름 대신 직함만 있습니다');
    if (name && !/[가-힣]/.test(name) && !hasKrPhone(f) && (OUTREACH.test(title) || (company && !/[가-힣]/.test(company))))
      soft.push('국내 연락처 없는 해외 영업 메일로 보입니다');
    if (!pub && onlyEmail(f) && !personName(name) && !soft.length && !hard.length)
      soft.push('메일 주소 말고는 회사·전화가 없습니다');

    if (hard.length) {
      /* 진짜 사람을 잃지 않게 — 저절로 지우지 않고 묻는다 */
      var why = hard.concat(soft);
      if (ctx.protect) return { level: 'suspect', why: why.concat(['업체관리에 이어진 명함이라 저절로 지우지 않습니다']) };
      if (human && !ctx.fromMail) return { level: 'suspect', why: why.concat(['메일에서 온 명함이 아니라 저절로 지우지 않습니다']) };
      if (!human && hasMobile(f)) return { level: 'suspect', why: why.concat(['휴대폰 번호가 있어 저절로 지우지 않습니다']) };
      return { level: 'spam', why: why };
    }
    if (soft.length) return { level: 'suspect', why: soft };
    return { level: '', why: [] };
  }

  return {
    judge: judge, key: key, domainOf: domainOf, listed: listed,
    badLocal: badLocal, badDomain: badDomain, broken: broken, noLetterName: noLetterName,
    randomish: randomish, randomLocal: randomLocal, randomDomain: randomDomain,
    AD_SUBJ: AD_SUBJ, ROLE_NAME: ROLE_NAME, PROMO: PROMO, OUTREACH: OUTREACH, PUBLIC_DOM: PUBLIC_DOM
  };
});
