/* ═══════════════════════════════════════════════════════════════════════
   강의 이력(EduLecture) — «누가·언제·어디서·무슨 강의» 셈 (대표 지시 2026-11-27)
   「특정 일에 누가 강의를 했다, 어디서 강의를 한지 정확하게 확인을 하고 강의 자료 등을 체크해서
     별도로 자료함에 누가 언제 강의했는지만 간략하게 어떤 강의 내용으로 체크하게 해달라.
     그리고 어떤 강의인지 그 관련돼서는 캘린더에서도 찾아도 된다.」 → 대표 선택 「추정으로 두고 확인」

   화면(js/pu-edulib-app.js) · 서버 메일 자동 저장(functions/edulib-mail-sweep.js — 사본 functions/edulib-core/) · 검사가 함께 쓴다.
   그래서 DOM·Firebase 를 모른다. 고칠 곳은 늘 js/ 쪽이고, 고친 뒤 node scripts/sync-edulib-core.js 를 돌린다.

   ★ 기록 한 건 = 강의 «한 번»(edulib/lectures/{id}). 쓰인 자료는 itemIds 로 잇는다(자료 기록은 건드리지 않는다).
   ★ 저절로 만든 기록은 늘 «추정»(status:'auto')이다 — 무엇을 보고 짐작했는지(cal·mail·guess)를 함께 적고, 사람이 «확인»(status:'ok')한다.
     사람이 확인한 기록은 서버·일괄 가져오기가 다시 고치지 않는다.
   ★ 강의자(lecturerSid)는 «사번»만 — 사람 이름으로 짐작해 잇지 않는다(온톨로지 「이름으로 추정한 관계는 저장하지 않는다」).
     저절로 채우는 길은 하나뿐: 캘린더 일정을 «만든 사람의 메일»을 관리자가 이어 둔 표(data/gcal_mail_sid)에서 찾은 사번.
     일정 글에 직원 이름이 보이면 화면이 «고르기 단추»로만 내민다(누르는 것은 사람).
   ★ 장소는 «글»이다(사업장 이름을 열쇠로 쓰지 않는다 — companyId 를 이름으로 짐작해 넣지 않는다).
   ★ 같은 강의는 한 기록 — 열쇠가 «캘린더 일정 id»(또는 일정을 못 찾았으면 «메일 id»)에서 정해진다(lec_c… / lec_m…).
     서버가 몇 번 돌아도, 관리자가 «캘린더에서 가져오기»를 몇 번 눌러도 같은 자리라 겹치지 않는다.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var C = root.PuEduLibClassify || (typeof require === 'function' ? require('./pu-edulib-classify.js') : null);
  var api = factory(C);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuEduLibLecture = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 개체 이름은 온톨로지 사전(PuOntology.TERMS.entityTypes)에 먼저 올라 있어야 한다 — 없으면 관문이 저장을 거절한다 */
  var ENTITY = 'EduLecture';
  var SCHEMA = (typeof self !== 'undefined' && self.PuOntology && +self.PuOntology.VERSION) || 1;
  var STATUS = { auto: '추정', ok: '확인' };
  /* 칸 길이 상한 — 규칙(scripts/make-firebase-rules.js edulib/lectures)과 같은 값 */
  var MAX = { title: 200, venue: 120, note: 500, sid: 40, calSummary: 300, calLocation: 300, mailSubject: 300, id: 200, items: 30 };
  var WINDOW_BEFORE = 14;     /* 메일 보낸 날보다 이만큼 «앞선» 일정까지 — 강의 뒤에 자료를 보내 주는 일 */
  var WINDOW_AFTER = 45;      /* 메일 보낸 날 «뒤» 이만큼까지 — 강의 전에 자료를 미리 보내는 일 */

  /* 강의 일정으로 볼 말 / 강의가 아닌 일정(우리가 «듣는» 교육·교육청·휴가 등) */
  var EVENT_RX = /강의|교육|특강|연수|세미나|워크숍|워크샵|설명회|간담회|교안|강연/;
  var NOT_EVENT_RX = /수강|교육청|교육부|교육지원청|휴가|연차|반차|생일|결혼|장례|조문/;
  /* 맞추기에 쓰지 않는 흔한 말 — 어느 강의에나 나오는 말로는 «같은 강의»를 가릴 수 없다 */
  var STOP = ('교육 강의 특강 자료 교안 강의안 강의자료 교육자료 송부 보내 보냅니다 드립니다 드려요 안내 관련 요청 회신 참고 첨부 최종 수정 수정본 원본 '
    + '푸른 노무 법인 노무법인 푸른노무법인 노무사 예방 예방교육 직장 직장내 법정 의무 의무교육 법정교육 실시 진행 온라인 오프라인 대면 비대면 '
    + '오전 오후 시간 장소 대상 전체 직원 근로자 관리자 임원 신입 사원 담당자 주식회사 유한회사 사단법인 재단법인 센터 본사 지사 '
    + '성희롱 괴롭힘 장애인 인식 인식개선 개선 개인정보 보호 산업안전 안전 보건 산업안전보건 퇴직연금 연금 노동법 노동 인권 노동인권 중대재해 '
    + '중대재해처벌법 중처법 근로기준법 기준법 청소년 고용 평등 남녀고용평등 노사 노사관계 임금 근로시간 시간외 리더십 소통 문화 조직').split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  function str(v) { return v == null ? '' : String(v); }
  function cut(v, n) { return str(v).replace(/\s+/g, ' ').trim().slice(0, n); }
  function okYmd(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  function okTime(t) { return /^\d{2}:\d{2}$/.test(str(t)); }
  function dayNo(ymd) { var t = Date.parse(str(ymd) + 'T00:00:00Z'); return isFinite(t) ? Math.round(t / 864e5) : NaN; }
  function ymdOfDay(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function addDays(ymd, n) { var d = dayNo(ymd); return isFinite(d) ? ymdOfDay(d + n) : ''; }

  /* 화면·서버가 같은 열쇠를 만든다 — 해시 두 벌(32비트씩)을 이어 16자리 */
  function fnv(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function hex16(s) { s = str(s); return ('0000000' + fnv(s, 0x811c9dc5).toString(16)).slice(-8) + ('0000000' + fnv(s, 0x01c9dc58).toString(16)).slice(-8); }
  function idOfCal(calId) { return 'lec_c' + hex16('cal|' + calId); }
  function idOfMail(mailId) { return 'lec_m' + hex16('mail|' + mailId); }
  function newId(now) {
    var r = ''; for (var i = 0; i < 8; i++) r += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36));
    return 'lec_h' + (now || Date.now()).toString(36) + r;   /* 사람이 «＋ 강의 기록»으로 적은 것 */
  }

  /* 캘린더 만든이 메일 → 표 열쇠 — 푸른캘린더(pu-cal.html gcalMailKey)와 같은 꼴 */
  function mailKey(m) { return str(m).trim().toLowerCase().replace(/[.#$\[\]\/]/g, ','); }
  /* 만든이 메일을 관리자가 이어 둔 사번 — 표에 없으면 '' (명부 이름으로 짐작하지 않는다) */
  function sidOfCreator(creator, mailMap) {
    var k = mailKey(creator);
    var v = k && mailMap && typeof mailMap === 'object' ? mailMap[k] : '';
    return typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';
  }

  function isLectureEvent(ev) {
    if (!ev || typeof ev !== 'object' || !ev.id || !okYmd(ev.date) || ev.googleDeleted) return false;
    var t = str(ev.summary) + ' ' + str(ev.location);
    return EVENT_RX.test(t) && !NOT_EVENT_RX.test(t);
  }

  /* 맞추기 낱말 — 한글·영문·숫자 두 글자 이상, 숫자만인 것·흔한 말은 뺀다 */
  function words(s) {
    var out = [], seen = {};
    (str(s).toLowerCase().match(/[0-9a-zㄱ-ㆎ가-힣]+/g) || []).forEach(function (w) {
      w = w.replace(/(에서|으로|에게|님|의|은|는|이|가|을|를|과|와|도)$/, '');
      if (w.length < 2 || /^\d+$/.test(w) || STOPSET[w] || seen[w]) return;
      if (/^\d+(년|월|일|시|분|차|회|기|명)$/.test(w)) return;
      seen[w] = 1; out.push(w);
    });
    return out;
  }

  /* 일정 하나가 «이 자료의 강의»일 점수 — ctx: { date(메일 보낸 날), exactDate(파일 이름의 날짜), subject, fileName, cat }
     ★ 이름(업체·기관) 같은 «드문 낱말»이 겹치거나, 파일 이름의 날짜와 일정 날짜가 같아야 한다 — 같은 주제(괴롭힘 등)·가까운 날만으로는 잇지 않는다 */
  function scoreEvent(ev, ctx) {
    if (!isLectureEvent(ev)) return null;
    var evText = (str(ev.summary) + ' ' + str(ev.location)).toLowerCase();
    var mailText = (str(ctx.subject) + ' ' + str(ctx.fileName).replace(/\.[^.]+$/, '')).toLowerCase();
    var hits = {};
    words(mailText).forEach(function (w) { if (evText.indexOf(w) >= 0) hits[w] = 1; });
    words(evText).forEach(function (w) { if (mailText.indexOf(w) >= 0) hits[w] = 1; });
    var nHit = Object.keys(hits).length;
    var exact = okYmd(ctx.exactDate) && ev.date === ctx.exactDate;
    var diff = okYmd(ctx.date) ? dayNo(ev.date) - dayNo(ctx.date) : NaN;
    var inWin = isFinite(diff) && diff >= -WINDOW_BEFORE && diff <= WINDOW_AFTER;
    if (!exact && !inWin) return null;
    if (!nHit && !exact) return null;
    var sc = Math.min(nHit, 3) * 3;
    if (exact) sc += 4;
    if (ctx.cat && ctx.cat !== 'etc' && C && C.catOfText(evText) === ctx.cat) sc += 2;
    if (inWin) sc += diff >= 0 && diff <= 14 ? 2 : diff > 14 ? 1 : 0;
    if (sc < 4) return null;
    return { score: sc, hits: Object.keys(hits).slice(0, 5), exact: exact, diff: isFinite(diff) ? diff : null };
  }
  /* 가장 맞는 일정 — 점수가 같은 다른 일정이 있으면 «모름»(null) — 틀리게 잇는 것보다 사람이 고르는 편이 낫다 */
  function matchEvent(events, ctx) {
    var best = null, second = -1;
    (events || []).forEach(function (ev) {
      var s = scoreEvent(ev, ctx || {});
      if (!s) return;
      if (!best || s.score > best.score) { if (best) second = Math.max(second, best.score); best = { ev: ev, score: s.score, hits: s.hits, exact: s.exact, diff: s.diff }; }
      else second = Math.max(second, s.score);
    });
    if (!best || second === best.score) return null;
    return best;
  }
  /* 자료 한 건 → 맞추기 단서 */
  function ctxOfItem(it) {
    it = it || {}; var src = it.source || {};
    var lect = str(it.lectureDate);
    return { date: okYmd(src.mailDate) ? src.mailDate : (okYmd(lect) ? lect : ''), exactDate: it.dateFrom === 'name' && okYmd(lect) ? lect : '',
      subject: str(src.mailSubject), fileName: str(it.fileName), cat: str(it.cat) };
  }
  /* 맞출 일정을 찾을 날 범위(서버가 캘린더 보관함을 이 범위로 한 번 읽는다) */
  function windowOf(dates) {
    var ds = (dates || []).filter(okYmd).sort();
    if (!ds.length) return null;
    return { from: addDays(ds[0], -WINDOW_BEFORE), to: addDays(ds[ds.length - 1], WINDOW_AFTER) };
  }

  /* 일정 글에서 «장소» 짐작 — 첫 낱말 가운데 시각·강의 말·흔한 말이 아닌 것(추정으로만 쓴다) */
  function venueGuess(summary) {
    var s = str(summary).replace(/[\[(（【][^\])）】]{0,30}[\])）】]/g, ' ');
    var ws = s.split(/[\s,·/|]+/).filter(Boolean);
    for (var i = 0; i < ws.length && i < 4; i++) {
      var w = ws[i].replace(/[^0-9A-Za-zㄱ-ㆎ가-힣㈜()&.-]/g, '');
      if (w.length < 2 || /^\d/.test(w) || EVENT_RX.test(w) || STOPSET[w.toLowerCase()]) continue;
      return w.slice(0, 40);
    }
    return '';
  }

  function itemsMap(ids) {
    var o = {}, n = 0;
    (ids || []).forEach(function (id) { id = str(id); if (/^[A-Za-z0-9_-]{1,60}$/.test(id) && !o[id] && n < MAX.items) { o[id] = true; n++; } });
    return o;
  }

  /* 새 기록 — o: { id, date, time, lecturerSid, venue, title, cat, note, itemIds[], cal{}, mail{}, status, guess{} } */
  function makeLecture(o, who, now) {
    now = now || Date.now();
    o = o || {};
    var cal = o.cal && o.cal.id ? { id: cut(o.cal.id, MAX.id), summary: cut(o.cal.summary, MAX.calSummary), location: cut(o.cal.location, MAX.calLocation),
      date: okYmd(o.cal.date) ? o.cal.date : '', time: okTime(o.cal.time) ? o.cal.time : '' } : null;
    var mail = o.mail && o.mail.id ? { id: cut(o.mail.id, MAX.id), subject: cut(o.mail.subject, MAX.mailSubject), date: okYmd(o.mail.date) ? o.mail.date : '' } : null;
    var g = o.guess && typeof o.guess === 'object' ? o.guess : {};
    var r = {
      id: str(o.id) || newId(now),
      entityType: ENTITY,
      schemaVersion: SCHEMA,
      date: okYmd(o.date) ? o.date : '',
      time: okTime(o.time) ? o.time : '',
      lecturerSid: /^[A-Za-z0-9_-]{0,40}$/.test(str(o.lecturerSid)) ? str(o.lecturerSid) : '',
      venue: cut(o.venue, MAX.venue),
      title: cut(o.title, MAX.title),
      cat: C ? C.catByKey(o.cat).key : str(o.cat),
      note: cut(o.note, MAX.note),
      itemIds: itemsMap(o.itemIds),
      status: STATUS[o.status] ? o.status : 'auto',
      guess: { date: cut(g.date, 20), lecturer: cut(g.lecturer, 20), venue: cut(g.venue, 20), score: Math.max(0, Math.min(99, +g.score || 0)) },
      createdAt: now,
      updatedAt: now,
      createdBy: str(who && who.uid).slice(0, 64),
      revision: 1
    };
    if (cal) r.cal = cal;
    if (mail) r.mail = mail;
    return r;
  }

  /* 캘린더 일정 하나 → 추정 기록(관리자 «캘린더에서 가져오기»·서버 자동 저장이 같이 쓴다) */
  function fromEvent(ev, o) {
    o = o || {};
    var sid = sidOfCreator(ev.creator, o.mailMap);
    var loc = cut(ev.location, MAX.venue);
    var vg = loc ? '' : venueGuess(ev.summary);
    return makeLecture({
      id: idOfCal(ev.id), date: ev.date, time: ev.allDay ? '' : ev.time, lecturerSid: sid,
      venue: loc || vg, title: o.title || cut(ev.summary, MAX.title), cat: o.cat || (C ? C.catOfText(str(ev.summary)) : 'etc'),
      itemIds: o.itemIds || [], status: 'auto',
      cal: { id: ev.id, summary: ev.summary, location: ev.location, date: ev.date, time: ev.allDay ? '' : ev.time },
      mail: o.mail || null,
      guess: { date: 'cal', lecturer: sid ? 'cal-creator' : '', venue: loc ? 'cal-location' : vg ? 'cal-summary' : '', score: o.score || 0 }
    }, o.who, o.now);
  }
  /* 맞는 일정이 없는 메일 자료 → 추정 기록(날짜는 파일 이름의 날짜, 없으면 메일 보낸 날) */
  function fromMailItem(it, o) {
    o = o || {}; it = it || {};
    var src = it.source || {};
    var lect = str(it.lectureDate);
    var byName = it.dateFrom === 'name' && okYmd(lect);
    return makeLecture({
      id: idOfMail(src.mailId), date: byName ? lect : (okYmd(src.mailDate) ? src.mailDate : (okYmd(lect) ? lect : '')),
      title: str(it.title) || str(it.fileName).replace(/\.[^.]+$/, ''), cat: it.cat, itemIds: [it.id], status: 'auto',
      mail: { id: src.mailId, subject: src.mailSubject, date: src.mailDate },
      guess: { date: byName ? 'name' : 'mail', lecturer: '', venue: '', score: 0 }
    }, o.who, o.now);
  }
  /* 추정 기록에 자료 하나 더 잇기 — 이미 이었거나·사람이 확인했거나·지웠으면 null(고치지 않는다) */
  function linkItem(rec, itemId, who, now) {
    if (!rec || rec._deleted || rec.status === 'ok') return null;
    itemId = str(itemId);
    var cur = rec.itemIds && typeof rec.itemIds === 'object' ? rec.itemIds : {};
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(itemId) || cur[itemId] || Object.keys(cur).length >= MAX.items) return null;
    var nx = Object.assign({}, rec);
    nx.itemIds = Object.assign({}, cur); nx.itemIds[itemId] = true;
    nx.updatedAt = now || Date.now();
    nx.revision = (+rec.revision || 0) + 1;
    if (who && who.uid) nx.updatedBy = str(who.uid).slice(0, 64);
    return nx;
  }

  /* 사람이 고칠 수 있는 칸 */
  var EDITABLE = { date: 1, time: 1, lecturerSid: 1, venue: 1, title: 1, cat: 1, note: 1, status: 1 };
  function patchOf(cur, ch) {
    var p = {};
    Object.keys(ch || {}).forEach(function (k) {
      if (!EDITABLE[k]) return;
      var v = ch[k];
      if (k === 'date' && v && !okYmd(v)) return;
      if (k === 'time' && v && !okTime(v)) return;
      if (k === 'lecturerSid' && !/^[A-Za-z0-9_-]{0,40}$/.test(str(v))) return;
      if (k === 'status' && !STATUS[v]) return;
      if (k === 'venue') v = cut(v, MAX.venue);
      if (k === 'title') v = cut(v, MAX.title);
      if (k === 'note') v = cut(v, MAX.note);
      if (k === 'cat') v = (cur && v === cur.cat) ? v : (C ? C.catByKey(v).key : str(v));
      v = typeof v === 'string' ? v.trim() : v;
      if (cur && str(cur[k]) === str(v)) return;
      p[k] = v;
    });
    return Object.keys(p).length ? p : null;
  }

  function live(list) { return (list || []).filter(function (r) { return r && !r._deleted; }); }
  /* 보이는 순서 — 날짜 늦은 것 먼저(같으면 시각) · 날짜 모름은 맨 뒤 */
  function sortLectures(list) {
    return list.slice().sort(function (a, b) {
      var da = str(a.date), db = str(b.date);
      if (da !== db) { if (!da) return 1; if (!db) return -1; return da < db ? 1 : -1; }
      var ta = str(a.time), tb = str(b.time);
      return ta < tb ? 1 : ta > tb ? -1 : 0;
    });
  }
  function itemIdsOf(rec) { return rec && rec.itemIds && typeof rec.itemIds === 'object' ? Object.keys(rec.itemIds).filter(function (k) { return rec.itemIds[k]; }) : []; }
  /* 자료 하나가 쓰인 강의들(지운 기록 빼고, 늦은 것 먼저) */
  function lecturesOfItem(itemId, list) { return sortLectures(live(list).filter(function (r) { return itemIdsOf(r).indexOf(itemId) >= 0; })); }
  /* 일정 글에 보이는 «재직 직원 이름» — 화면이 고르기 단추로만 내민다(저장하지 않는다) */
  function namesInText(text, people) {
    var t = str(text);
    return (people || []).filter(function (p) { return p && p.sid && str(p.name).length >= 2 && t.indexOf(p.name) >= 0; });
  }

  return {
    ENTITY: ENTITY, SCHEMA: SCHEMA, STATUS: STATUS, MAX: MAX, WINDOW_BEFORE: WINDOW_BEFORE, WINDOW_AFTER: WINDOW_AFTER,
    idOfCal: idOfCal, idOfMail: idOfMail, newId: newId, mailKey: mailKey, sidOfCreator: sidOfCreator,
    isLectureEvent: isLectureEvent, words: words, scoreEvent: scoreEvent, matchEvent: matchEvent, ctxOfItem: ctxOfItem, windowOf: windowOf,
    venueGuess: venueGuess, makeLecture: makeLecture, fromEvent: fromEvent, fromMailItem: fromMailItem, linkItem: linkItem,
    patchOf: patchOf, live: live, sortLectures: sortLectures, itemIdsOf: itemIdsOf, lecturesOfItem: lecturesOfItem, namesInText: namesInText,
    addDays: addDays, okYmd: okYmd
  };
});
