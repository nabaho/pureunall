/* 정부사업신청 › 컨설턴트 모집 — 「냈나·됐나」를 메일에서 찾고, 내기 «전»에 서류를 점검한다
   ────────────────────────────────────────────────────────────────────────
   대표 지시 2026-10-04 「제출한 경우 이를 어떻게 자동으로 정리 … 푸른메일함 또는 보내기전
   자료 등을 검토하게」 → 선택 「① 정리 + ②-가(정부사업신청 안에 제출 전 점검)」.

   ★ 순수 모듈 (DOM·통신 없음). 화면(gov.html)이 메일 목록·파일 글자를 넘겨주고 결과만 받는다.

   ① 메일 가르기 (classify) — 실측 2026-10-04 로 짠 잣대
      · 기관 담당자가 «개인 메일»(naver·hanmail)을 쓰는 일이 많아 «주소로는» 기관을 모른다 → «제목»으로 가른다.
      · 기관 이름이 든 메일의 대부분은 «이미 맡은 일»의 메일이다(현장클리닉 산출물·근무일정·기업 신청서 송부).
        그래서 «지원»은 「지원서·응모·이력서·프로필」 낱말이 있을 때만, 고객 업무 낱말(자동이체·급여·기업 참여신청서…)이
        있으면 빼낸다.
      · 「선정·심사 결과·위촉 안내」는 «결과»다. 단 「기업 선정」·「참여기업」은 고객 일이라 뺀다.
      · ⚠ 결과는 «저절로» 적지 않는다 — 제목만 보고 「선정」이라 적었다가 틀리면 지원 이력이 거짓이 된다. 묻는다.
   ② 기록 정리 (plan) — «지원함»만 저절로 적고(되돌릴 수 있게 via:'mail' 표시), 선정·탈락은 절대 덮지 않는다.
   ③ 제출 전 점검 (checkFiles) — 파일 글자는 화면이 «브라우저 안에서» 읽어 넘긴다(어디에도 안 보낸다).

   ⚠ 모집 공고 잣대(WHO·PICK·DONE)는 서버 functions/recruit-watch.js 와 «같아야» 한다.
     functions/ 는 웹에 안 올라가 화면이 못 부르므로 여기 한 벌 더 있다 —
     tests/gov-submit.test.js 가 두 벌의 정규식이 «한 글자도» 다르지 않은지 본다. 고칠 때 둘 다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GovSubmit = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ── 모집 공고 (서버와 같은 잣대) ── */
  var WHO = /컨설턴트|전문가|전문위원|자문위원|평가위원|심사위원|외부위원|운영위원|조정위원|인력\s*풀|인력풀|\bpool\b|강사|멘토|현장\s*코치|코칭|외부\s*연구진|연구진|자문단|지원단|상담위원|노무사|위촉직\s*이사|비상임\s*이사|사외\s*이사|임원/i;
  var PICK = /모집|공모|선발|위촉|등록|구성|신청|추천|초빙/;
  var DONE = /결과|명단|합격|발표|개최|선정\s*안내|최종\s*선정|공모전/;
  var LEARN = /교육생|수강생|참가\s*신청|참석자|심포지엄|세미나|강좌|양성\s*과정|전문가\s*과정|기본\s*과정|시상|자격증|서식/;
  function isRecruit(title) {
    var t = String(title || '');
    return WHO.test(t) && PICK.test(t) && !DONE.test(t) && !LEARN.test(t);
  }

  /* ── 지원 메일 ── */
  /* ⚠ 「제출 서류」는 뺐다 — 「보험료 고지 건 - 추가제출서류」(실측)처럼 고객 업무에 흔하다 */
  var APPLY = /지원서|응모|이력서|프로필|지원\s*서류|입사\s*지원/;
  /* 고객 업무 메일 — 「산업일자리전환 컨설팅 신청서 송부」는 고객 기업의 신청서다(실측) */
  var CLIENT = /자동이체|급여|퇴직금|건강보험|국민연금|산재|육아휴직|일용|대체인력|해지|참여\s*신청|기업\s*리스트|기업\s*참여|근로자|사업장\s*신청|컨설팅\s*신청서|신청서\s*송부/;
  /* ── 결과 메일 ── */
  var RESULT = /선정|합격|심사\s*결과|지원\s*결과|위촉\s*(?:안내|통보|결과|동의서)|재위촉|등급\s*평가\s*결과|탈락|미선정/;
  var RESULT_WHO = /위원|컨설턴트|전문가|공급기업|지정노무사|강사|코칭|코치|멘토|자문|연구진|인력\s*풀|이사/;
  var NOT_RESULT = /기업\s*선정|참여\s*기업|대상자|마케팅|입주|기업\s*리스트/;
  /* 메일로 온 모집 공고 — 게시판 제목보다 지저분하다(업무 메일에 「신청·위촉·구성」이 흔하다, 실측 46건 중 절반).
     그래서 «분명한» 말(모집·공모·초빙·등록 공고/요청/안내)만, 업무 낱말은 뺀다. 서버 잣대(isRecruit) 위에 덧씌운다. */
  var STRONG = /모집|공모|초빙|등록\s*(?:공고|요청|재안내|안내)/;
  var MAILNOISE = /신청\s*내역|신청\s*기업|참여\s*기업|상담\s*의뢰|참석|연장|성과\s*추적|양성\s*과정|교육생|신청서\s*(?:송부|전달)/;
  function isMailNotice(t) { t = String(t || ''); return isRecruit(t) && STRONG.test(t) && !MAILNOISE.test(t); }
  function isReply(s) { return /^\s*(?:\[?\s*re\s*\]?\s*:?|회신|답장)/i.test(String(s || '')); }

  function s(v) { return v == null ? '' : String(v); }
  /* js/gov-sync.js 의 safeKey 와 같은 잣대 — 검사가 맞댄다 */
  function safeKey(k) { return s(k).replace(/[.#$\/\[\]]/g, '_') || '_'; }
  function ymd(ms) {
    var d = new Date(Number(ms) || 0); if (!(+d)) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* 결과의 «짐작» — 화면이 「선정으로 적을까요?」를 묻는 데만 쓴다 */
  function outcome(subj) {
    var t = s(subj);
    if (/탈락|불합격|미선정/.test(t)) return '탈락';
    if (/최종\s*선정|선정\s*안내|선정\s*통보|합격\s*안내|위촉\s*(?:안내|통보|동의서)|재위촉|공급기업\s*\(?컨설턴트\)?\s*선정/.test(t)) return '선정';
    return '';   /* 「결과 안내」 — 열어 봐야 안다 */
  }

  /* row: 푸른 메일 목록 한 줄 {u,s,d,a,t|e,...}  ·  o: {sent:bool, folder, matches(subject)→[기관id]} */
  function classify(row, o) {
    if (!row) return null;
    var subj = s(row.s), sent = !!o.sent, reply = isReply(subj);
    /* ⚠★ 이 열쇠는 클라우드 자리 이름(mailskip·mailmap·seen 의 열쇠)으로 쓰인다 — RTDB 는 . # $ / [ ] 를 못 받는다.
         폴더 「3.컨설팅(정부사업)」의 «.» 하나로 클라우드 저장이 통째로 멈췄다(검토 2026-10-04) → safeKey */
    var base = { key: safeKey(o.folder) + '|' + s(row.u), subject: subj, date: ymd(row.d), att: Number(row.a) || 0,
      sent: sent, folder: s(o.folder) };
    var orgs = (o.matches ? o.matches(subj) : []) || [];
    base.org = orgs[0] || '';
    /* 내가 보낸 지원 — 또는 받은편지함의 «내 지원 메일에 단 답장»(Re: 응모서류 제출의 건) */
    if ((sent || reply) && APPLY.test(subj) && !CLIENT.test(subj)) { base.kind = 'submit'; base.viaReply = !sent; return base; }
    if (!sent && !reply && RESULT.test(subj) && RESULT_WHO.test(subj) && !NOT_RESULT.test(subj)) {
      base.kind = 'result'; base.guess = outcome(subj); return base;
    }
    if (!sent && !reply && isMailNotice(subj)) { base.kind = 'notice'; return base; }
    return null;
  }

  /* folders: [{folder, sent, rows:{uid:row}}] → 찾은 것들(최근 먼저). 같은 메일이 두 폴더에 있어도 한 번 */
  function collect(folders, matches) {
    var out = [], seen = {};
    (folders || []).forEach(function (f) {
      Object.keys(f && f.rows || {}).forEach(function (k) {
        var c = classify(f.rows[k], { sent: f.sent, folder: f.folder, matches: matches });
        if (!c) return;
        var dk = c.kind + '|' + c.subject.replace(/^\s*(?:\[?\s*re\s*\]?\s*:?\s*)+/i, '') + '|' + c.date;
        if (seen[dk]) return; seen[dk] = 1;
        out.push(c);
      });
    });
    return out.sort(function (a, b) { return b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject); });
  }

  /* 기록 정리 계획 — log: {기관id:{연도:{st,due,at,via,mail}}} · map: {메일key: 기관id}(사람이 고른 기관) · skip: {메일key:1}
     돌려주는 것: auto(저절로 「지원함」), ask(결과 — 물어볼 것), pick(지원 메일인데 기관 모름), notices(메일로 온 모집 공고) */
  function plan(items, log, map, skip) {
    log = log || {}; map = map || {}; skip = skip || {};
    var auto = [], ask = [], pick = [], notices = [], doneAuto = {};
    (items || []).forEach(function (it) {
      var k = safeKey(it.key);   /* 옛 판이 담아 둔 열쇠(«.» 든 것)도 같은 자리로 */
      if (skip[k] || skip[it.key]) return;
      var org = map[k] || map[it.key] || it.org, y = it.date.slice(0, 4);
      var cur = ((log[org] || {})[y] || {});
      if (it.kind === 'notice') { notices.push(it); return; }
      /* ⚠ 기관을 모르는 결과도 버리지 않는다 — 고르게 한다(한전 지정노무사 위촉 등, 실측) */
      if (!org) { if (it.kind === 'submit' || it.kind === 'result') pick.push(it); return; }
      if (it.kind === 'submit') {
        /* ⚠ 선정·탈락·지원함(사람이 적은 것)은 덮지 않는다. 비었거나 「지원 예정」일 때만 */
        if (doneAuto[org + y]) return;
        if (cur.st && cur.st !== '지원 예정') return;
        doneAuto[org + y] = 1;
        auto.push({ org: org, year: y, item: it });
        return;
      }
      if (it.kind === 'result') {
        if (cur.st === '선정' || cur.st === '탈락') return;   /* 이미 적었다 */
        ask.push({ org: org, year: y, item: it, guess: it.guess });
      }
    });
    return { auto: auto, ask: ask, pick: pick, notices: notices };
  }

  /* plan.auto 를 log 에 적은 «새» log (원래 것은 안 고친다) */
  function applyAuto(log, auto, nowMs) {
    var out = JSON.parse(JSON.stringify(log || {}));
    (auto || []).forEach(function (a) {
      out[a.org] = out[a.org] || {};
      var cur = out[a.org][a.year] || {};
      /* ⚠ 덮기 «전» 상태(지원 예정)를 남긴다 — ↩ 되돌리기가 그 상태로 돌려놓는다(검토 2026-10-04) */
      var prev = cur.st || '';
      cur.st = '지원함'; cur.at = nowMs || 0; cur.via = 'mail';
      cur.mail = { key: safeKey(a.item.key), date: a.item.date, subject: a.item.subject.slice(0, 120), att: a.item.att, prev: prev };
      out[a.org][a.year] = cur;
    });
    return out;
  }

  /* ════ ③ 제출 전 점검 ════ */
  /* 서류 종류 — 파일 이름 먼저, 모르면 글 앞부분. 순서가 우선순위다(「지원서」에 「이력」이 들어도 지원서) */
  var KINDS = [
    { k: 'consent', name: '개인정보 동의서', re: /개인\s*정보[\s\S]{0,12}(?:동의|수집|이용)|동의서/ },
    { k: 'apply',   name: '지원서·신청서',   re: /지원\s*서|신청\s*서|응모\s*서|참가\s*신청/ },
    { k: 'career',  name: '경력증명서',      re: /경력\s*증명|재직\s*증명|경력\s*확인/ },
    { k: 'resume',  name: '이력서·프로필',   re: /이력\s*서|프로필|profile|경력\s*기술/i },
    { k: 'license', name: '자격증 사본',     re: /자격\s*증|자격\s*수첩|노무사\s*등록|합격\s*증|등록\s*증/ },
    { k: 'perf',    name: '실적 증명',       re: /실적\s*증명|수행\s*실적|참여\s*확인|실적\s*확인/ },
    { k: 'degree',  name: '학위·졸업 증명',  re: /졸업\s*증명|학위\s*증명|학위\s*기/ },
    { k: 'biz',     name: '사업자등록증',    re: /사업자\s*등록/ },
    { k: 'plan',    name: '수행계획서·제안서', re: /계획\s*서|제안\s*서/ }
  ];
  var NEED_DEFAULT = ['apply', 'resume', 'career', 'consent', 'license'];
  function kindOf(name, text) {
    var n = s(name).replace(/\.[^.]+$/, ''), t = s(text).slice(0, 400);
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].re.test(n)) return KINDS[i].k;
    for (var j = 0; j < KINDS.length; j++) if (KINDS[j].re.test(t)) return KINDS[j].k;
    return '';
  }
  function kindName(k) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k === k) return KINDS[i].name; return '기타'; }

  /* 주민번호 «온전한» 꼴만 센다 — 뒷자리가 가려진 것(●·*·x)은 안 센다. 붙여 쓴 13자리도 센다(계좌일 수도 있다고 밝힌다) */
  function rrnCount(text) {
    var t = s(text), n = 0, m;
    var a = /(^|[^0-9])(\d{6})\s?[-–—]\s?([1-8]\d{6})(?![0-9])/g;
    while ((m = a.exec(t))) n++;
    var b = /(^|[^0-9])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[1-8]\d{6})(?![0-9])/g;
    var nb = 0; while ((m = b.exec(t))) nb++;
    return { dashed: n, joined: nb };
  }
  /* 서명·날인 칸 — 글자로는 «찍혔는지» 모른다(도장은 그림이다). 칸이 있다는 것만 알리고 확인을 부탁한다 */
  function signSpots(text) {
    var m = s(text).match(/\(\s*(?:서명|인|날인|서명\s*또는\s*인)\s*\)|서명\s*[:：]\s*$|날인\s*[:：]/gm);
    return m ? m.length : 0;
  }
  /* 안 채운 칸 같은 곳 — 「   년   월   일」·「○○○」·「OOO」·「(   )」 */
  function blankSpots(text) {
    var t = s(text), n = 0;
    n += (t.match(/(?:^|[^\d])\s{2,}년\s{2,}월\s{2,}일/g) || []).length;
    n += (t.match(/[○◯]{2,}|O{3,}|0{3}-0{3,4}-0{4}/g) || []).length;
    n += (t.match(/\(\s{3,}\)/g) || []).length;
    return n;
  }
  /* 올해가 아닌 해가 이름에 박혀 있나 — 작년 파일을 그대로 내는 실수 */
  function oldYear(name, year) {
    var m = s(name).match(/(20\d{2})/g); if (!m) return '';
    var y = String(year);
    return m.indexOf(y) >= 0 ? '' : m[m.length - 1];
  }

  /* files: [{name, size, text|null, textErr}] · o: {need:[kind], year, due:'YYYY-MM-DD', today:'YYYY-MM-DD'} */
  function checkFiles(files, o) {
    o = o || {};
    var need = (o.need && o.need.length) ? o.need : NEED_DEFAULT;
    var rows = (files || []).map(function (f) {
      var k = kindOf(f.name, f.text), rr = rrnCount(f.text);
      var r = { name: s(f.name), size: Number(f.size) || 0, kind: k, kindName: kindName(k),
        readable: f.text != null, rrn: rr.dashed, rrnJoined: rr.joined,
        sign: f.text != null ? signSpots(f.text) : 0, blank: f.text != null ? blankSpots(f.text) : 0,
        oldYear: oldYear(f.name, o.year), why: s(f.textErr) };
      r.warn = [];
      if (r.rrn) r.warn.push('주민번호 ' + r.rrn + '곳이 «뒷자리까지» 보입니다 — 공고가 요구하지 않으면 가리세요');
      if (r.rrnJoined) r.warn.push('붙여 쓴 13자리 숫자 ' + r.rrnJoined + '곳 — 주민번호인지 확인하세요(계좌번호일 수도)');
      if (r.oldYear) r.warn.push('파일 이름에 ' + r.oldYear + '년이 적혀 있습니다 — 작년 파일이 아닌지 확인하세요');
      if (r.blank) r.warn.push('안 채운 칸 같은 곳 ' + r.blank + '곳(「   년   월   일」·「○○○」 등)');
      r.info = [];
      if (r.sign) r.info.push('서명·날인 칸 ' + r.sign + '곳 — 찍었는지 눈으로 확인하세요(도장은 그림이라 글자로는 모릅니다)');
      if (!r.readable) r.info.push(r.why || '글자를 읽지 못했습니다 — 눈으로 확인하세요');
      return r;
    });
    var have = {}; rows.forEach(function (r) { if (r.kind) have[r.kind] = (have[r.kind] || 0) + 1; });
    var missing = need.filter(function (k) { return !have[k]; }).map(kindName);
    var total = rows.reduce(function (a, r) { return a + r.size; }, 0);
    var top = [];
    if (missing.length) top.push('빠진 서류: ' + missing.join(', '));
    if (total > 20 * 1024 * 1024) top.push('첨부가 모두 ' + Math.round(total / 1048576) + 'MB — 메일로 안 갈 수 있습니다(20MB 넘음)');
    if (o.due && o.today) {
      if (o.today > o.due) top.push('마감일(' + o.due + ')이 지났습니다');
      else if (o.today === o.due) top.push('오늘이 마감일입니다');
    }
    var warnN = rows.reduce(function (a, r) { return a + r.warn.length; }, 0);
    return { rows: rows, missing: missing, need: need, have: have, total: total, top: top,
      ok: !missing.length && !warnN && !top.length };
  }

  return { safeKey: safeKey, WHO: WHO, PICK: PICK, DONE: DONE, LEARN: LEARN, isRecruit: isRecruit, isMailNotice: isMailNotice, isReply: isReply, outcome: outcome,
    classify: classify, collect: collect, plan: plan, applyAuto: applyAuto,
    KINDS: KINDS, NEED_DEFAULT: NEED_DEFAULT, kindOf: kindOf, kindName: kindName,
    rrnCount: rrnCount, signSpots: signSpots, blankSpots: blankSpots, oldYear: oldYear, checkFiles: checkFiles };
});
