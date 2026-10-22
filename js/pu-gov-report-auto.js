'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 받은 메일 서류 «자동 연결·완료» 결정의 순수 함수 (브라우저 window.PuGovReportAuto / Node 겸용)
   (대표 지시 2026-10-22 「자동으로 진행했던 사업 매일 매일 메일 주고 받은 것들 서류들 메일함에서 가지고 올 수 있게 — 완전히 자동화」
    · 선택 «전부 자동 완료» · 계획 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 1)
   무엇을 하나
     · 업체 주소로 받은 «첨부 있는 메일»을 → 어느 업체·어느 사업의 어느 서류 줄에 «완료»로 기록할지 정한다.
       화면의 전역 «받은 서류 확인»(gov-report.html grGlobalCompute)과 같은 짜임 — 업체·사업 쌍(pairs) → 주소(addrsFor) → 후보(candidates) →
       연결 안 된 것 — 을 서버에서도 돌릴 수 있게 순수 함수로 옮겼다. 쓰는 것은 서버·화면 몫 — 이 모듈은 «이렇게 쓸 것»만 돌려준다.
   안전 규칙(전부 자동이라 엄격하게 — 모호하면 «쓰지 않는 쪽»)
     · 사람 손이 닿은 줄은 절대 안 덮는다(usable) — 기록이 없는 줄, 또는 «없음»인데 처리자·연결·메모·날짜·방식이 하나도 없는 줄에만 쓴다.
       한 가지 예외 — 서명 단계에서 사람이 «서명 요청 발송»(doing + 발송일, 회신일·연결 없음)으로 저장한 줄은, 발송일 이후에 받은 메일이면
       자동이 «회신 받음»(done)으로 이어받는다(발송일·방식·확인은 그대로, 옛 줄은 prev 로 돌려준다).
     · 한 첨부 → 한 줄. 줄을 하나로 정할 수 없으면(같은 점수·두 사업에 후보) 아무 데도 안 쓰고 unmatched 로 남긴다. 같은 줄은 두 번 쓰지 않는다.
     · 개인 자료(PRIV_RE)·기술보호 사업·우리 주소·종결 사업·서류 틀 없는 사업은 안 본다. 기술보호 사업이 있는 업체는 «줄 이름이 맞을 때만» 쓴다.
     · 이미 연결된 메일, 다른 폴더로 옮겨 열쇠만 바뀐 같은 메일(보낸 사람·시각·제목·첨부 이름이 같음)은 다시 처리하지 않는다.
     · 결과에 메일 주소·본문·제목을 넣지 않는다(업체 id·rid·줄 키·메일 열쇠·첨부 이름·날짜·짧은 까닭만).
   입력은 바꾸지 않고, 결과는 입력과 객체를 나눠 쓰지 않는다. DOM·전역·입출력 없음.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Docs = isNode ? require('./pu-gov-report-docs.js') : root.PuGovReportDocs;
  var Track = isNode ? require('./pu-gov-report-track.js') : root.PuGovReportTrack;
  var Inbox = isNode ? require('./pu-gov-report-inbox.js') : root.PuGovReportInbox;
  var Nav = isNode ? require('./pu-gov-report-nav.js') : root.PuGovReportNav;
  var Send = isNode ? require('./pu-gov-report-send.js') : root.PuGovReportSend;

  var WINDOW_DAYS = 45, MAX_ACTIONS = 100, MAX_UNMATCHED = 100, AUTO_BY = '자동';
  var MAX_ROUND = 60;                                  // Track.keysFor 의 회차 상한과 같다
  /* 서명 낱말 — «스캔» 단독은 서명이 아니다(견적서 스캔도 있다). «인감» 단독도 아니다(인감증명서) — 날인 동작(인감 날인·인감 도장)과 함께일 때만.
     영문 signed 는 낱말 경계 — unsigned·designed·resigned·consigned 는 아니고 _signed·-signed·signed.pdf·signed_contract 는 맞다 */
  var SIGN_RE = /서명|날인|직인|인감\s*도장|(^|[^a-z])signed/i;
  var ATTACH_RE = /사진|회의록|결과물|산출물|증빙|명단|참석|출석|결과보고|활동일지/;
  /* 안내 성격 말 — 서명 낱말이 있어도 서명본이 아니다(안내문·양식·견본·«서명란 없는» 같은 반대 뜻·증명서·인증서). 별첨 낱말(사진·회의록)에는 적용하지 않는다.
     NOTICE_HARD 는 언제나 막는다. NOTICE_SOFT(안내·공지·요청)는 «서명본·서명완료·날인본·날인완료·signed» 처럼 완료 말이 같이 있으면 풀어 준다
     (일터상생혁신 «참여 안내서(서명)» 의 서명본 «참여 안내서 서명본.pdf» 가 «안내» 때문에 영영 안 쓰이지 않게) */
  var NOTICE_HARD = /양식|서식|견본|샘플|예시|없는|미서명|미날인|증명서|인증서|문의|제출서류 목록|체크리스트/;
  var NOTICE_SOFT = /안내|공지|요청/;
  var DONE_WORD = /서명본|서명완료|서명 완료|날인본|날인완료|날인 완료|(^|[^a-z])signed/i;
  /* 주민·외국인등록번호 꼴(6자리 + 없음·-·공백·_ + 뒷자리 첫 숫자 1~8 + 6자리) — 앞뒤가 숫자가 아닐 때만. 첨부 이름·제목에 있으면 개인 자료로 본다 */
  var JUMIN_RE = /(^|[^0-9])[0-9]{6}[-\s_]?[1-8][0-9]{6}([^0-9]|$)/;
  var TAG_RE = Send.TAG_RE;                            // [서명요청:rid] · [제출:rid] — 보내기 모듈 것을 그대로
  var NOTE_HEAD = '자동 처리 — 메일 «', NOTE_TAIL = '»';
  var NOTE_MAX = 200;                                  // 규칙(scal_docs note)과 같다 — Track.NOTE_MAX
  var TECH_KEY = 'techguard';
  var CLAIMED = { st: 'done', by: AUTO_BY, at: 0 };    // 이번 실행에서 이미 고른 줄 표시 — usable 이 거짓이 되게

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  /* 서명본 이름 — 서명 낱말이 있고 안내 성격 말이 없다(안내·공지·요청은 «서명본» 같은 완료 말이 함께면 푼다) */
  function isNotice(name) { return NOTICE_HARD.test(name) || (NOTICE_SOFT.test(name) && !DONE_WORD.test(name)); }
  function isSignName(name) { return SIGN_RE.test(name) && !isNotice(name); }
  /* 첨부 하나의 단계 — sign(서명·날인본) · attach(사진·회의록 같은 별첨) · null(모름 → 자동 처리 안 함).
     단계는 첨부 «이름»의 낱말이 정한다(SIGN_RE 가 먼저 — 둘 다 걸려도 sign). 제목에만 낱말이 있으면 null(일상 메일 «RE: 결과보고서 송부»가 완료로 찍히지 않게).
     단 제목에 [서명요청:rid] 꼬리표가 있고 이름이 별첨 낱말도 아니면 sign «후보»(회신) — 어느 첨부가 서명본인지는 plan 이 메일 전체를 보고 정한다 */
  function stepOf(att, subject) {
    var name = str(att && typeof att === 'object' ? att.name : att), tag = TAG_RE.exec(str(subject));
    if (isSignName(name)) return 'sign';
    if (ATTACH_RE.test(name)) return 'attach';
    return (tag && tag[1] === '서명요청') ? 'sign' : null;
  }

  /* «자동이 쓸 수 있는 줄» — 기록이 없거나, «없음»인데 사람이 남긴 흔적(처리자·연결·메모·날짜·방식·확인·회차 기록)이 하나도 없는 줄.
     계획서 식은 by·link·note 셋이다 — 날짜·방식·확인·회차 기록은 사람만 적을 수 있으므로 같은 쪽(쓰지 않는 쪽)으로 더 조였다 */
  function usable(rec, step) {
    if (!rec) return true;
    if (!obj(rec)) return false;
    if (step === 'sign' && waiting(rec)) return true;
    return rec.st === 'none' && !str(rec.by) && !rec.link && !str(rec.note)
      && !str(rec.sentAt) && !str(rec.gotAt) && !str(rec.how) && !rec.ack && !rec.rd;
  }
  /* «발송함·회신 대기» 줄 — 사람이 서명 요청을 보냈다고 저장했고(doing + 발송일) 아직 회신·연결이 없다. 서명 단계에서만 자동이 «회신 받음» 으로 이어받을 수 있다
     (수정 라운드 1, 대표 «전부 자동 완료» 취지). done·blocked·na·발송일 없는 doing·회신일이나 연결이 있는 줄은 계속 사람 손이다 */
  function waiting(rec) {
    return obj(rec) && rec.st === 'doing' && isDay(rec.sentAt) && !str(rec.gotAt) && !rec.link;
  }

  /* ── 줄 고르기 ── */
  function squash(v) { return str(v).replace(/[\s()\[\]{}（）［］]/g, '').toLowerCase(); }
  /* 글 속의 «N회차»·«N차»(1~60) — 서로 다른 번호들 */
  function roundsIn(text) {
    var re = /([0-9]+)\s*(?:회차|차)/g, m, out = [];
    while ((m = re.exec(str(text)))) {
      var v = +m[1];
      if (v >= 1 && v <= MAX_ROUND && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }
  /* 줄 이름에서 회차 꼬리표(« N회차»)를 뗀 것 */
  function bareName(k) { return squash(str(k.name).replace(/\s*[0-9]+회차$/, '')); }
  /* 줄 이름이 첨부 이름·제목에 들어 있는 줄들(점수 2). 너무 짧은 이름(1자)은 아무 데나 걸리므로 안 본다 */
  function scored(keys, hay) {
    return keys.filter(function (k) { var b = bareName(k); return b.length >= 2 && hay.indexOf(b) >= 0; });
  }
  /* 첨부 이름이 그 단계의 낱말을 직접 가졌는가 */
  function directWord(step, name) { return step === 'sign' ? isSignName(name) : (step === 'attach' ? ATTACH_RE.test(name) : false); }
  /* 그 단계에 «이름이 맞는 줄» 을 가진 사업인가 — 줄을 사람이 채웠는지와 상관없이(사업을 고르는 데 쓴다) */
  function nameHit(plan, step, n, att, subject) {
    var hay = squash(str(att && att.name) + ' ' + str(subject));
    return scored(Track.keysFor(plan, step, n), hay).length > 0;
  }
  /* 한 첨부가 갈 줄 하나 — { key, why } 또는 까닭만 { why }.
     o = { plan, step, n, recs, att:{name}, subject, multi, day?, direct? } — day = 메일 날짜(발송함 줄 판정), direct = 첨부 이름이 단계 낱말을 «직접» 가졌다는 보증(없으면 이름으로 계산) */
  function decide(o) {
    o = obj(o) ? o : {};
    var recs = obj(o.recs) ? o.recs : {};
    var all = Track.keysFor(o.plan, o.step, o.n);
    if (!all.length) return { why: '이 단계의 서류 줄이 없습니다' };
    /* 발송함 줄은 «발송일 다음 날부터 받은 메일» 일 때만(같은 날은 보낸 메일 사본·자동 응답일 수 있다 · 메일 날짜 day 를 안 주면 대상 아님) */
    var targets = all.filter(function (k) {
      var r = has(recs, k.key) ? recs[k.key] : null;
      if (!usable(r, o.step)) return false;
      return !waiting(r) || (isDay(o.day) && str(o.day) > r.sentAt);
    });
    if (!targets.length) return { why: '쓸 수 있는 서류 줄이 없습니다(이미 기록됨)' };
    var name = str(o.att && o.att.name), sub = str(o.subject), hay = squash(name + ' ' + sub);
    var direct = typeof o.direct === 'boolean' ? o.direct : directWord(o.step, name);
    function pick(k, why) { return { key: k.key, why: why }; }
    var ns = roundsIn(name);
    if (!ns.length) ns = roundsIn(sub);
    /* 회차 줄은 회차 번호가 이름·제목에 «딱 하나» 있고 그 번호의 줄일 때만 대상이다(번호 없이 남은 회차에 쓰지 않는다 — 두 사업일 때도) */
    function eligible(k) { return k.round === 0 || (ns.length === 1 && k.round === ns[0]); }
    if (!o.multi && all.some(function (k) { return k.round > 0; })) {
      /* 회차마다 줄이 있는 단계 — 번호가 있으면(이름 먼저, 없으면 제목) 그 줄 아니면 안 쓴다(엉뚱한 회차로 새지 않게) */
      if (ns.length > 1) return { why: '회차 번호가 여럿이라 정할 수 없습니다' };
      if (ns.length === 1) {
        var hits = targets.filter(function (k) { return k.round === ns[0]; });
        if (hits.length === 1) return pick(hits[0], ns[0] + '회차');
        if (hits.length > 1) {
          var sc = scored(hits, hay);
          return sc.length === 1 ? pick(sc[0], ns[0] + '회차 · 줄 이름') : { why: ns[0] + '회차 줄이 둘 이상이라 정할 수 없습니다' };
        }
        /* 그 회차 줄이 없거나 사람 손 — 다른 회차 줄로는 안 샌다. 회차 없는 줄(once)이 이름으로 딱 맞으면 그 줄(「2차 수정 수행계획서」처럼 «차» 가 회차가 아닐 수 있다) */
        var once = scored(targets.filter(function (k) { return k.round === 0; }), hay);
        return once.length === 1 ? pick(once[0], '줄 이름 일치') : { why: ns[0] + '회차 서류 줄을 쓸 수 없습니다' };
      }
    }
    var named = scored(targets.filter(eligible), hay);
    if (named.length === 1) return pick(named[0], '줄 이름 일치');
    if (named.length > 1) return { why: '줄 이름이 맞는 줄이 둘 이상입니다' };
    /* 쓸 수 있는 줄이 하나뿐이면 그 줄 — 사업이 하나이고, 첨부 이름이 그 단계 낱말을 직접 가졌을 때만(제목만 보고 «줄이 하나라서» 쓰지 않는다).
       회차 줄은 번호 없이는 안 쓴다 */
    if (!o.multi && direct && targets.length === 1 && targets[0].round === 0) return pick(targets[0], '쓸 수 있는 줄이 하나');
    return { why: o.multi ? '사업이 둘 이상이라 줄 이름이 맞아야 합니다' : '줄을 하나로 정할 수 없습니다' };
  }
  function pickKey(o) {
    var d = decide(o);
    return d.key ? { key: d.key, why: d.why } : null;
  }

  /* 쓸 줄 — 상태 완료 · 받은 날 · 방식 메일 · 처리자 «자동» · 메모(≤200자) · 연결(메일 열쇠 + 첨부 이름). 보낸 날(sentAt)은 건드리지 않는다.
     at 은 now(ms)가 있으면 그것, 없으면 0 — 서버가 쓸 때 찍는다 */
  function noteFor(name) {
    var room = NOTE_MAX - NOTE_HEAD.length - NOTE_TAIL.length;
    return NOTE_HEAD + str(name).slice(0, room) + NOTE_TAIL;
  }
  function nextRec(c, att, step, now, prev) {
    var lk = Inbox.linkFrom(c, att.name);
    if (!lk) return null;
    var entry = { st: 'done', gotAt: c.day, how: 'mail', note: noteFor(att.name), link: lk };
    if (step === 'sign' && waiting(prev)) {
      /* 발송함 줄을 이어받는다 — 발송일·방식·확인·회차 기록은 옛 줄 것 그대로, 옛 메모는 «옛 메모 · 자동 처리 …» 로(200자 안에서 옛 메모를 자른다) */
      entry = { st: 'done', sentAt: prev.sentAt, gotAt: c.day, link: lk };
      if (prev.how) entry.how = prev.how;
      if (prev.ack === true) entry.ack = true;
      if (prev.rd) entry.rd = clone(prev.rd);
      var auto = noteFor(att.name), room = NOTE_MAX - auto.length - 3, old = str(prev.note);
      entry.note = (old && room > 0) ? old.slice(0, room) + ' · ' + auto : auto;
    }
    if (Track.validate(entry, step)) return null;
    return Track.patchFor(entry, AUTO_BY, now);
  }

  /* 종결 사업(화면 grClosedTypes(year, false) 와 같다) — 종결 사업이 이어진 일정 사업 id. 같은 일정 사업에 종결 아닌 이알피 사업이 있으면 종결로 안 본다 */
  function closedTypes(docs, input, state, year) {
    var cl = Nav.closedTypeIds({ biz: docs.biz, tmap: docs.tmap, input: input, year: year, state: state }), live = {};
    Docs.visibleTypes(docs.biz).forEach(function (t) {
      if (Nav.closedFor(state, t.code, year)) return;
      var id = Docs.linkOf(t.code, docs.tmap, input.types);
      if (id) live[id] = 1;
    });
    Object.keys(cl).forEach(function (id) { if (has(live, id)) delete cl[id]; });
    return cl;
  }
  /* 메일이 «같은 메일»인지 알아보는 표 — 폴더를 옮기면 열쇠(폴더:번호)는 바뀌어도 보낸 사람·시각·제목·첨부 이름은 그대로다 */
  function sigOf(r) { return [r.from, r.d, r.s, r.an.join('\u0001')].join('\u0002'); }

  /* 주소 → 그 주소가 적힌 «서로 다른 업체» 수 — 업체관리(data/companies)와 이알피 계약 연락처 전체에서 센다.
     화면의 addrsFor 는 «먼저 적힌 업체가 임자» 로 가리지만, 자동은 두 업체 이상에 나오는 주소를 아예 안 쓴다(어느 업체 서류인지 모르는데 완료로 찍지 않는다).
     같은 업체인지는 사업자번호(10자리 이상)나 이름(PuCoThread.norm)이 같으면 같은 업체로 묶는다(업체관리 한 줄 + 그 업체의 계약 = 한 업체) */
  function addrOwners(companies, cons) {
    var CT = root.PuCoThread, parent = Object.create(null), recs = [];
    function find(t) { while (parent[t] !== t) { parent[t] = parent[parent[t]]; t = parent[t]; } return t; }
    function tokensOf(name, bizNo, i) {
      var t = [], b = str(bizNo).replace(/\D/g, ''), n = CT.norm(name);
      if (b.length >= 10) t.push('b:' + b);
      if (n) t.push('n:' + n);
      if (!t.length) t.push('r:' + i);
      t.forEach(function (x) { if (!(x in parent)) parent[x] = x; });
      for (var j = 1; j < t.length; j++) parent[find(t[j])] = find(t[0]);
      return t;
    }
    Docs.rowsOf(companies).forEach(function (co) { recs.push({ srcs: [co], t: tokensOf(co.name, co.bizNo, recs.length) }); });
    Docs.rowsOf(cons).forEach(function (c) {
      if (c._deleted === true) return;
      var cc = obj(c.company) ? c.company : {};
      recs.push({ srcs: [c, cc], t: tokensOf(cc.name || c.companyName, cc.bizNo || c.bizNo, recs.length) });
    });
    var owners = Object.create(null);
    recs.forEach(function (r) {
      var g = find(r.t[0]);
      r.srcs.forEach(function (s) {
        Object.keys(CT.addrsOf(s)).forEach(function (e) { (owners[e] || (owners[e] = Object.create(null)))[g] = 1; });
      });
    });
    return function shared(e) { return !!owners[e] && Object.keys(owners[e]).length > 1; };
  }

  /* 결정 전체. o = { today, now?, input, docs:{biz,cons,tmap}, companies, state, track, folders, msgs, years? } — 모양은 화면 grLoad·grReadInbox 가 만드는 것과 같다.
     track 이 객체가 아니거나 state 를 안 주면(undefined) 아무것도 안 한다(기록을 못 읽은 채 «기록 없음»으로 오해해 사람 줄을 덮지 않도록). state 가 null 이면 빈 노드 */
  function plan(o) {
    var out = { actions: [], unmatched: [], skipped: {}, scanned: 0, more: false };
    var sk = out.skipped;
    function skip(k, n) { sk[k] = (sk[k] || 0) + (n == null ? 1 : n); }
    o = obj(o) ? o : {};
    var today = str(o.today), win = isDay(today) ? Inbox.sinceWindow(today, WINDOW_DAYS) : null;
    if (!win) { skip('badToday'); return out; }
    if (!obj(o.track)) { skip('noTrack'); return out; }
    if (o.state === undefined || (o.state !== null && !obj(o.state))) { skip('noState'); return out; }
    var state = obj(o.state) ? o.state : {}, track = o.track;
    var input = obj(o.input) ? o.input : {}, docs = obj(o.docs) ? o.docs : {};
    var now = (typeof o.now === 'number' && isFinite(o.now) && o.now > 0) ? o.now : 0;
    var thisYear = today.slice(0, 4);
    var years = Array.isArray(o.years) ? o.years.map(str).filter(function (y) { return /^[0-9]{4}$/.test(y); }) : [thisYear, String(+thisYear - 1)];
    years = years.filter(function (y, i) { return years.indexOf(y) === i; });

    /* 1) 업체·사업 쌍 — 종결·서류 틀 없는 사업은 뺀다(grGlobalCompute 와 같은 차례) */
    var infos = [];
    years.forEach(function (year) {
      var closed = closedTypes(docs, input, state, year), used = new Set();
      Docs.visibleTypes(docs.biz).forEach(function (erp) {
        var typeId = Docs.linkOf(erp.code, docs.tmap, input.types);
        if (!typeId || used.has(typeId)) return;
        used.add(typeId);
        if (has(closed, typeId)) return;
        var pl = Docs.planFor(erp.name);
        if (pl === Docs.NONE) return;
        Docs.pairs(input, typeId, year).forEach(function (p) {
          infos.push({ p: p, erp: erp, plan: pl, n: Math.max(+p.rounds || 0, +p.planned || 0) });
        });
      });
    });

    /* 2) 연결된 메일 — 어느 업체·어느 줄이든 link.key 가 같으면 연결된 것 */
    var linked = {}, linkedDN = {};   // linkedDN = 연결된 «메일 날짜 + 첨부 이름» — 폴더를 옮겨 열쇠가 바뀐 같은 첨부를 알아본다
    Object.keys(track).forEach(function (co) {
      var rs = obj(track[co]) ? track[co] : {};
      Object.keys(rs).forEach(function (rid) {
        var its = obj(rs[rid]) ? rs[rid] : {};
        Object.keys(its).forEach(function (k) {
          var lk = its[k] && its[k].link;
          if (!lk || typeof lk.key !== 'string' || !lk.key) return;
          linked[lk.key] = 1;
          if (isDay(lk.date) && str(lk.name)) linkedDN[co + '\u0001' + lk.date + '\u0001' + str(lk.name)] = 1;   // 업체별 — 다른 업체의 같은 이름 첨부와 섞이지 않는다
        });
      });
    });

    /* 3) 받은 메일 줄 + 연결된 메일과 «같은 메일»표 */
    var rows = Inbox.mailRows(o.folders, o.msgs).filter(function (r) { return !r.out; });
    var linkedSig = {};
    rows.forEach(function (r) {
      var k = Inbox.linkKey.make({ slug: r.slug, uid: r.uid });
      if (k && has(linked, k)) linkedSig[sigOf(r)] = 1;
    });
    var sigByKey = {}, fromByKey = {};
    rows.forEach(function (r) { var k = Inbox.linkKey.make({ slug: r.slug, uid: r.uid }); if (k) { sigByKey[k] = sigOf(r); fromByKey[k] = r.from; } });
    var sharedAddr = addrOwners(o.companies, docs.cons);

    /* 4) 쌍마다 주소 → 후보. 한 메일에 걸린 쌍들을 모은다 */
    var mails = Object.create(null), capped = false;
    infos.forEach(function (x) {
      var p = x.p;
      var cons = Docs.consFor({ consultings: docs.cons, co: p.co, code: x.erp.code, typeId: p.typeId, tmap: docs.tmap, biz: docs.biz });
      var addrs = Inbox.addrsFor({ companies: o.companies, cons: cons, name: p.coName, bizNo: String((p.co && p.co.bizNo) || '') });
      var r = Inbox.candidates(rows, { addrs: addrs, win: win, tech: false });
      if (r.noAddr) { skip('noAddr'); return; }
      if (r.more) capped = true;
      r.list.forEach(function (c) {
        if (!c.key) return;
        var m = mails[c.key] || (mails[c.key] = { c: c, pairs: [], cos: {} });
        m.pairs.push(x);
        m.cos[p.coId] = 1;
      });
    });
    if (capped) skip('capped');

    /* 5) 오래된 메일부터 */
    var list = Object.keys(mails).map(function (k) { return mails[k]; }).sort(function (a, b) {
      return (a.c.d - b.c.d) || (a.c.key < b.c.key ? -1 : (a.c.key > b.c.key ? 1 : 0));
    });
    out.scanned = list.length;

    var claimed = {}, seenSig = {}, actions = [], unmatched = [];
    function recsOf(coId, rid) {
      var base = Track.recOf(track, coId, rid), cl = claimed[coId + '\u0001' + rid];
      if (!cl) return base;
      var m = Object.assign({}, base);
      Object.keys(cl).forEach(function (k) { m[k] = CLAIMED; });
      return m;
    }
    function miss(m, att, why, rid) {
      unmatched.push({ coId: Object.keys(m.cos)[0], rid: rid || '', mailKey: m.c.key, name: att.name, day: m.c.day, why: why });
    }

    list.forEach(function (m) {
      var c = m.c, sig = sigByKey[c.key] || '';
      if (has(linked, c.key)) { skip('linked'); return; }
      if (sig && (has(linkedSig, sig) || has(seenSig, sig))) { skip('dup'); return; }
      if (sig) seenSig[sig] = 1;
      if (sharedAddr(fromByKey[c.key])) { skip('sharedAddr'); return; }
      if (c.priv || JUMIN_RE.test(c.s) || c.atts.some(function (a) { return JUMIN_RE.test(a.name); })) { skip('priv'); return; }
      if (Object.keys(m.cos).length > 1) { skip('multiCo'); return; }
      var tag = TAG_RE.exec(c.s);
      if (tag && tag[1] === '제출') { skip('submitTag'); return; }
      var pin = (tag && tag[1] === '서명요청') ? tag[2] : '';
      if (!c.atts.length) { skip('noAtt'); return; }
      /* 같은 메일의 첨부 처리 순서 — 서명 낱말 → 별첨 낱말 → 나머지(꼬리표만 보고 sign 후보가 된 첨부는 맨 뒤) */
      var rank = function (n) { return isSignName(n) ? 0 : (ATTACH_RE.test(n) ? 1 : 2); };
      var atts = c.atts.map(function (a, i) { return { name: str(a.name), i: i }; })
        .sort(function (a, b) { return (rank(a.name) - rank(b.name)) || (a.i - b.i); });
      /* 꼬리표 회신에서 서명본 고르기 — 서명 낱말 첨부가 있으면 그것들만, 없으면 «낱말 없는 PDF/이미지» 가 하나뿐일 때 그 하나 */
      var hasSignWord = atts.some(function (a) { return isSignName(a.name); });
      var weak = atts.filter(function (a) { return !SIGN_RE.test(a.name) && !ATTACH_RE.test(a.name) && !isNotice(a.name) && /^(pdf|img)$/.test(Inbox.kindOf(a.name)); });
      var weakPick = (pin && !hasSignWord && weak.length === 1) ? weak[0] : null;
      atts.forEach(function (att) {
        if (!att.name) { skip('noStep'); return; }
        if (has(linkedDN, Object.keys(m.cos)[0] + '\u0001' + c.day + '\u0001' + att.name)) { skip('dupLinked'); return; }
        var step = stepOf(att.name, c.s), direct;
        if (!step) {
          if (SIGN_RE.test(att.name)) miss(m, att, '서명 낱말이 있으나 안내성 이름');   // 서명 낱말이 있는데 단계가 없으면 안내성 이름뿐이다
          else if (SIGN_RE.test(c.s) || ATTACH_RE.test(c.s)) miss(m, att, '제목에만 낱말');
          else skip('noStep');
          return;
        }
        if (step === 'sign' && !isSignName(att.name)) {   // 꼬리표만으로 sign 후보가 된 첨부
          if (att !== weakPick) { miss(m, att, '꼬리표 회신 — 서명본을 정할 수 없습니다'); return; }
          direct = true;
        }
        if (pin && !m.pairs.some(function (x) { return x.p.rid === pin; })) { miss(m, att, '꼬리표의 서류를 찾지 못했습니다'); return; }
        var cands = m.pairs.filter(function (x) {
          if (pin && x.p.rid !== pin) return false;
          var w = Inbox.windowOf(x.p.firstDate, x.p.lastDate);
          if (!w || c.day < w.from || c.day > w.to) return false;       // 그 사업 기간(−30일~+90일) 밖의 메일은 그 사업 것으로 보지 않는다
          return x.plan.key === TECH_KEY || Track.keysFor(x.plan, step, x.n).length > 0;
        });
        if (!cands.length) { skip('noLine'); return; }
        /* 기술보호 사업이 후보에 끼어 미배정이 되면 why 앞에 표시 — 기술보호 메일은 수동 길로 보낸다(화면이 알아보게) */
        var techTag = cands.some(function (x) { return x.plan.key === TECH_KEY; }) ? '[기술보호] ' : '';
        var multi = !pin && cands.length > 1, hits = [], whys = [], techHit = false;
        if (multi) {
          /* 사업이 둘 이상 — «그 단계에 이름이 맞는 줄을 가진 사업» 이 정확히 하나일 때만 그 사업(줄을 사람이 채웠는지와 상관없이 센다 —
             한쪽 줄이 차 있다고 «남은 쪽» 에 쓰지 않는다). 간단형 틀은 줄 이름이 모두 «업체 서명본» 이라 이름으로 사업을 못 가른다 → 꼬리표 rid 일치 외에는 안 쓴다 */
          var named = cands.filter(function (x) { return nameHit(x.plan, step, x.n, att, c.s); });
          if (named.length !== 1) { miss(m, att, techTag + (named.length ? '여러 사업에 같은 이름의 줄이 있어 정할 수 없습니다' : '사업이 둘 이상이라 줄을 정할 수 없습니다')); return; }
          cands = named;
        }
        cands.forEach(function (x) {
          var d = decide({ plan: x.plan, step: step, n: x.n, recs: recsOf(x.p.coId, x.p.rid), att: att, subject: c.s, multi: multi, day: c.day, direct: direct });
          if (x.plan.key === TECH_KEY) { if (d.key) techHit = true; return; }
          if (d.key) hits.push({ x: x, d: d }); else whys.push(d.why);
        });
        if (techHit) { skip('tech'); return; }
        if (hits.length > 1) { miss(m, att, techTag + '여러 사업에 후보가 있어 정할 수 없습니다'); return; }
        if (!hits.length) {
          if (cands.every(function (x) { return x.plan.key === TECH_KEY; })) { skip('tech'); return; }
          miss(m, att, techTag + (cands.length > 1 ? '사업이 둘 이상이라 줄을 정할 수 없습니다' : (whys[0] || '줄을 정할 수 없습니다')), cands.length === 1 ? cands[0].p.rid : '');
          return;
        }
        var x = hits[0].x, key = hits[0].d.key, base = Track.recOf(track, x.p.coId, x.p.rid);
        var prevRec = has(base, key) ? base[key] : null;
        var next = nextRec(c, att, step, now, prevRec);
        if (!next) { miss(m, att, '쓸 줄을 만들 수 없습니다', x.p.rid); return; }
        var cl = claimed[x.p.coId + '\u0001' + x.p.rid] || (claimed[x.p.coId + '\u0001' + x.p.rid] = {});
        cl[key] = 1;
        actions.push({ coId: x.p.coId, rid: x.p.rid, typeId: x.p.typeId, key: key, step: step, mailKey: c.key, name: att.name, day: c.day,
          why: hits[0].d.why + (pin ? ' · 서명요청 꼬리표' : '') + (step === 'sign' && waiting(prevRec) ? ' · 발송함 줄 회신' : ''),
          next: next, prev: prevRec ? clone(prevRec) : null });
      });
    });

    if (actions.length > MAX_ACTIONS) out.more = true;
    if (capped) out.more = true;
    out.actions = actions.slice(0, MAX_ACTIONS);
    if (unmatched.length > MAX_UNMATCHED) skip('unmatchedCut', unmatched.length - MAX_UNMATCHED);
    out.unmatched = unmatched.slice(0, MAX_UNMATCHED);
    return out;
  }

  var api = { WINDOW_DAYS: WINDOW_DAYS, MAX_ACTIONS: MAX_ACTIONS, MAX_UNMATCHED: MAX_UNMATCHED, AUTO_BY: AUTO_BY, SIGN_RE: SIGN_RE, ATTACH_RE: ATTACH_RE,
    TAG_RE: TAG_RE, stepOf: stepOf, usable: usable, pickKey: pickKey, plan: plan };
  if (isNode) module.exports = api;
  else root.PuGovReportAuto = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
