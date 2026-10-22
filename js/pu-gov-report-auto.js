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
       (사람이 «발송함» 으로 저장한 서명 줄도 사람 손이다 — 자동이 회신을 완료로 바꾸지 않는다. 계획서 그대로.)
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
  var SIGN_RE = /서명|날인|직인|인감|스캔|signed/i;
  var ATTACH_RE = /사진|회의록|결과물|산출물|증빙|명단|참석|출석|결과보고|활동일지/;
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

  /* 첨부 하나의 단계 — sign(서명·날인본) · attach(사진·회의록 같은 별첨) · null(모름 → 자동 처리 안 함).
     첨부 이름이나 메일 제목에 SIGN_RE 가 걸리면 sign(둘 다 걸려도 sign), 제목에 [서명요청:rid] 꼬리표가 있어도 sign(회신) */
  function stepOf(att, subject) {
    var name = str(att && typeof att === 'object' ? att.name : att), sub = str(subject);
    var tag = TAG_RE.exec(sub);
    if ((tag && tag[1] === '서명요청') || SIGN_RE.test(name) || SIGN_RE.test(sub)) return 'sign';
    if (ATTACH_RE.test(name) || ATTACH_RE.test(sub)) return 'attach';
    return null;
  }

  /* «자동이 쓸 수 있는 줄» — 기록이 없거나, «없음»인데 사람이 남긴 흔적(처리자·연결·메모·날짜·방식·확인·회차 기록)이 하나도 없는 줄.
     계획서 식은 by·link·note 셋이다 — 날짜·방식·확인·회차 기록은 사람만 적을 수 있으므로 같은 쪽(쓰지 않는 쪽)으로 더 조였다 */
  function usable(rec) {
    if (!rec) return true;
    if (!obj(rec)) return false;
    return rec.st === 'none' && !str(rec.by) && !rec.link && !str(rec.note)
      && !str(rec.sentAt) && !str(rec.gotAt) && !str(rec.how) && !rec.ack && !rec.rd;
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
  /* 한 첨부가 갈 줄 하나 — { key, why } 또는 까닭만 { why }. o = { plan, step, n, recs, att:{name}, subject, multi } */
  function decide(o) {
    o = obj(o) ? o : {};
    var recs = obj(o.recs) ? o.recs : {};
    var all = Track.keysFor(o.plan, o.step, o.n);
    if (!all.length) return { why: '이 단계의 서류 줄이 없습니다' };
    var targets = all.filter(function (k) { return usable(has(recs, k.key) ? recs[k.key] : null); });
    if (!targets.length) return { why: '쓸 수 있는 서류 줄이 없습니다(이미 기록됨)' };
    var name = str(o.att && o.att.name), sub = str(o.subject), hay = squash(name + ' ' + sub);
    function pick(k, why) { return { key: k.key, why: why }; }
    if (!o.multi && all.some(function (k) { return k.round > 0; })) {
      /* 회차마다 줄이 있는 단계 — 회차 번호가 못 박아야 한다. 번호가 있으면(이름 먼저, 없으면 제목) 그 줄 아니면 안 쓴다(엉뚱한 회차로 새지 않게) */
      var ns = roundsIn(name);
      if (!ns.length) ns = roundsIn(sub);
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
    var named = scored(targets, hay);
    if (named.length === 1) return pick(named[0], '줄 이름 일치');
    if (named.length > 1) return { why: '줄 이름이 맞는 줄이 둘 이상입니다' };
    /* 쓸 수 있는 줄이 하나뿐이면 그 줄 — 사업이 하나일 때만. 회차 줄이 남은 하나인 것은 어느 회차인지 몰라 안 쓴다(그 단계에 줄이 그것뿐일 때만) */
    if (!o.multi && targets.length === 1 && (targets[0].round === 0 || all.length === 1)) return pick(targets[0], '쓸 수 있는 줄이 하나');
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
  function nextRec(c, att, step, now) {
    var lk = Inbox.linkFrom(c, att.name);
    if (!lk) return null;
    var entry = { st: 'done', gotAt: c.day, how: 'mail', note: noteFor(att.name), link: lk };
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
    var linked = {};
    Object.keys(track).forEach(function (co) {
      var rs = obj(track[co]) ? track[co] : {};
      Object.keys(rs).forEach(function (rid) {
        var its = obj(rs[rid]) ? rs[rid] : {};
        Object.keys(its).forEach(function (k) { var lk = its[k] && its[k].link; if (lk && typeof lk.key === 'string' && lk.key) linked[lk.key] = 1; });
      });
    });

    /* 3) 받은 메일 줄 + 연결된 메일과 «같은 메일»표 */
    var rows = Inbox.mailRows(o.folders, o.msgs).filter(function (r) { return !r.out; });
    var linkedSig = {};
    rows.forEach(function (r) {
      var k = Inbox.linkKey.make({ slug: r.slug, uid: r.uid });
      if (k && has(linked, k)) linkedSig[sigOf(r)] = 1;
    });
    var sigByKey = {};
    rows.forEach(function (r) { var k = Inbox.linkKey.make({ slug: r.slug, uid: r.uid }); if (k) sigByKey[k] = sigOf(r); });

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
      if (c.priv) { skip('priv'); return; }
      if (Object.keys(m.cos).length > 1) { skip('multiCo'); return; }
      var tag = TAG_RE.exec(c.s);
      if (tag && tag[1] === '제출') { skip('submitTag'); return; }
      var pin = (tag && tag[1] === '서명요청') ? tag[2] : '';
      if (!c.atts.length) { skip('noAtt'); return; }
      /* 같은 메일의 첨부는 이름이 서명·별첨 말을 직접 가진 것부터 — 꼬리표만 보고 sign 이 된 엉뚱한 첨부가 줄을 먼저 차지하지 않게 */
      var atts = c.atts.map(function (a, i) { return { name: str(a.name), i: i, strong: SIGN_RE.test(a.name) || ATTACH_RE.test(a.name) }; })
        .sort(function (a, b) { return ((b.strong ? 1 : 0) - (a.strong ? 1 : 0)) || (a.i - b.i); });
      atts.forEach(function (att) {
        if (!att.name) { skip('noStep'); return; }
        var step = stepOf(att.name, c.s);
        if (!step) { skip('noStep'); return; }
        if (pin && !m.pairs.some(function (x) { return x.p.rid === pin; })) { miss(m, att, '꼬리표의 서류를 찾지 못했습니다'); return; }
        var cands = m.pairs.filter(function (x) {
          if (pin && x.p.rid !== pin) return false;
          var w = Inbox.windowOf(x.p.firstDate, x.p.lastDate);
          if (!w || c.day < w.from || c.day > w.to) return false;       // 그 사업 기간(−30일~+90일) 밖의 메일은 그 사업 것으로 보지 않는다
          return x.plan.key === TECH_KEY || Track.keysFor(x.plan, step, x.n).length > 0;
        });
        if (!cands.length) { skip('noLine'); return; }
        var multi = !pin && cands.length > 1, hits = [], whys = [], techHit = false;
        cands.forEach(function (x) {
          var d = decide({ plan: x.plan, step: step, n: x.n, recs: recsOf(x.p.coId, x.p.rid), att: att, subject: c.s, multi: multi });
          if (x.plan.key === TECH_KEY) { if (d.key) techHit = true; return; }
          if (d.key) hits.push({ x: x, d: d }); else whys.push(d.why);
        });
        if (techHit) { skip('tech'); return; }
        if (hits.length > 1) { miss(m, att, '여러 사업에 후보가 있어 정할 수 없습니다'); return; }
        if (!hits.length) {
          if (cands.every(function (x) { return x.plan.key === TECH_KEY; })) { skip('tech'); return; }
          miss(m, att, cands.length > 1 ? '사업이 둘 이상이라 줄을 정할 수 없습니다' : (whys[0] || '줄을 정할 수 없습니다'), cands.length === 1 ? cands[0].p.rid : '');
          return;
        }
        var x = hits[0].x, key = hits[0].d.key, base = Track.recOf(track, x.p.coId, x.p.rid);
        var next = nextRec(c, att, step, now);
        if (!next) { miss(m, att, '쓸 줄을 만들 수 없습니다', x.p.rid); return; }
        var cl = claimed[x.p.coId + '\u0001' + x.p.rid] || (claimed[x.p.coId + '\u0001' + x.p.rid] = {});
        cl[key] = 1;
        actions.push({ coId: x.p.coId, rid: x.p.rid, typeId: x.p.typeId, key: key, step: step, mailKey: c.key, name: att.name, day: c.day,
          why: hits[0].d.why + (pin ? ' · 서명요청 꼬리표' : ''), next: next, prev: has(base, key) ? clone(base[key]) : null });
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
