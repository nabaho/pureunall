/* 정부사업신청 — 🏢 푸른노무법인 지원사업(진행 사업) 판정 모듈
   (브라우저 window.GovPursue / Node module.exports 겸용, DOM·통신 없음 — 기록 모양과 거르기만 다룬다)

   대표 지시 2026-11-22 「정부사업 신청에서 컨설턴트 모집이나 연구사업 일을 진행한다면 … 푸른노무법인에서 사업 진행
   아니면 컨설턴트 모집 지원과 관련되는 클릭을 만들어 주고 … 진행했다면 정부사업 신청에서는 푸른노무법인 지원사업으로
   표시를 해주고 사업 신청서 그리고 관련되는 서식을 다 끌어오고 모으고」 → 대표 결정(같은 날):
     ① 법인으로 진행하는 것은 경력관리의 기존 «🏢 사업관리»에 담는다(새 메뉴를 짓지 않는다)
     ② 정부사업신청에는 별도 탭 + 공고 줄 딱지
     ③ 서식은 «이름과 내려받기 링크»만 모은다(파일은 사람이 받아 사업관리에 올린다)

   ★ 기록 한 줄 = «이 공고를 우리가 진행한다»는 사람의 결정 하나. gov/{uid}/pursue/{id} (GovSync 'pursue' 칸).
     - 열쇠는 영구 id(PS-…). 같은 공고는 (src, ref) 로 한 줄만 — src 는 'feed'(공고 모아보기) · 'hit'(모집 글).
     - 공고 목록 줄은 기한이 지나면 정리되므로(ageOut) 제목·기관·마감을 «베껴» 둔다 — 탭이 원본 없이도 그려지게.
     - 사람 이름·업체명을 열쇠로 쓰지 않는다. 경력관리 사업과는 이 id(govRef)로만 잇는다.
   ⚠ 지우지 않는다 — 그만두면 state 「그만둠」(보기 「그만둔 것」에서 «사람이» 되살린다). 기계가 상태를 바꾸지 않는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovPursue = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /* 진행 갈래 둘 — 법인 사업(경력관리 사업관리) · 개인 지원(경력관리 지원 작업함, 예전의 📝 지원 준비) */
  var KINDS = {
    corp:   { icon: '🏢', tag: '푸른 진행', name: '푸른노무법인 지원사업', to: '경력관리 🏢 사업관리' },
    person: { icon: '👤', tag: '지원 준비', name: '컨설턴트 지원', to: '경력관리 지원 작업함' }
  };
  var STATES = ['진행', '그만둠'];
  var SRC = { feed: 1, hit: 1 };
  var FILES_MAX = 20;

  function s(v) { return v == null ? '' : String(v).trim(); }
  function keyOf(src, ref) { return s(src) + ':' + s(ref); }
  /* 원문 링크·서식 링크 — http(s) 만, 아이디·비밀번호가 박힌 주소는 버린다(공고 원문을 그대로 믿지 않는다).
     ⚠ 브라우저의 URL 해석기로 본다 — 글자 검사만 하면 «\» 같은 비표준 모양의 아이디 박힌 주소를 놓친다(보안 검토 2026-11-22). 정규화한 주소를 돌려준다 */
  function safeUrl(v) {
    var u = s(v); if (!/^https?:\/\/[^\s"'<>\\]+$/i.test(u)) return '';
    if (typeof URL !== 'function') return /^https?:\/\/[^\/?#]*@/i.test(u) ? '' : u;
    try {
      var p = new URL(u);
      return (/^https?:$/.test(p.protocol) && !p.username && !p.password && p.hostname) ? p.href : '';
    } catch (e) { return ''; }
  }
  function cleanFiles(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (f) {
      var u = safeUrl(f && f.url); if (!u || seen[u] || out.length >= FILES_MAX) return; seen[u] = 1;
      out.push({ name: s(f.name).slice(0, 120) || ('첨부 ' + (out.length + 1)), url: u });
    });
    return out;
  }
  function newId(now, rnd) {
    var t = Date.parse(now); if (!isFinite(t)) t = 0;
    var r = (typeof rnd === 'number' ? rnd : Math.random()).toString(36).slice(2, 8) || '0';
    return 'PS-' + t.toString(36) + '-' + r;
  }
  function find(list, src, ref) {
    var k = keyOf(src, ref), a = list || [];
    for (var i = 0; i < a.length; i++) if (a[i] && keyOf(a[i].src, a[i].ref) === k) return i;
    return -1;
  }
  function byId(list, id) {
    var a = list || [];
    for (var i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return i;
    return -1;
  }

  /* 표시하기 — o: { kind, src, ref, srcName, no, title, org, url, openDt, closeDt, prc }
     같은 공고가 이미 있으면 그 줄을 고친다(갈래를 바꾸고 「진행」으로 — 사람이 다시 누른 것이다). → { list, rec, isNew } */
  function mark(list, o, now, rnd) {
    var a = (list || []).slice();
    o = o || {};
    if (!KINDS[o.kind] || !SRC[o.src] || !s(o.ref)) return { list: a, rec: null, isNew: false };
    var i = find(a, o.src, o.ref), rec;
    rec = i >= 0 ? JSON.parse(JSON.stringify(a[i]))
      : { id: newId(now, rnd), entityType: 'Project', schemaVersion: 1, createdAt: now, src: o.src, ref: s(o.ref), files: [] };
    rec.kind = o.kind;
    rec.state = '진행';
    [['srcName', 40], ['no', 60], ['title', 300], ['org', 200], ['openDt', 30], ['closeDt', 30]].forEach(function (f) {
      var v = s(o[f[0]]).slice(0, f[1]); if (v) rec[f[0]] = v;
    });
    var u = safeUrl(o.url); if (u) rec.url = u;
    var p = Number(o.prc) || 0; if (p > 0) rec.prc = p;
    if (!Array.isArray(rec.files)) rec.files = [];
    rec.updatedAt = now;
    if (i >= 0) a[i] = rec; else a.unshift(rec);
    return { list: a, rec: rec, isNew: i < 0 };
  }
  function patch(list, id, fn, now) {
    var a = (list || []).slice(), i = byId(a, id);
    if (i < 0) return { list: a, rec: null };
    var rec = JSON.parse(JSON.stringify(a[i]));
    if (fn(rec) === false) return { list: a, rec: null };
    rec.updatedAt = now; a[i] = rec;
    return { list: a, rec: rec };
  }
  /* 그만둠 ↔ 진행 — 사람이 누를 때만 */
  function setState(list, id, state, now) {
    if (STATES.indexOf(state) < 0) return { list: (list || []).slice(), rec: null };
    return patch(list, id, function (r) { if (r.state === state) return false; r.state = state; }, now);
  }
  /* 모은 서식 — 못 모았으면 까닭(err)을 남긴다(«서식 없음»과 «못 찾음»을 가른다) */
  function setFiles(list, id, files, err, now) {
    return patch(list, id, function (r) { r.files = cleanFiles(files); r.filesAt = now; r.filesErr = s(err).slice(0, 200); }, now);
  }
  function setHand(list, id, now) { return patch(list, id, function (r) { r.handAt = now; }, now); }

  /* 공고 줄 딱지용 — 「진행」인 것만 */
  function index(list) {
    var m = {};
    (list || []).forEach(function (r) { if (r && r.state === '진행') m[keyOf(r.src, r.ref)] = r; });
    return m;
  }

  /* 마감 → 'YYYY-MM-DD'(진짜 날짜만) · 남은 날 */
  function ymd(v) {
    var m = s(v).match(/(\d{4})[-.\/]?(\d{2})[-.\/]?(\d{2})/); if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
    return (t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d) ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }
  function days(rec, today) {
    var c = ymd(rec && rec.closeDt), t = ymd(today);
    if (!c || !t) return null;
    return Math.round((Date.parse(c + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 86400000);
  }

  /* 탭에 보일 줄 — o: { view:'live'|'past'|'off'|'all', kind:''|'corp'|'person', q, today }
     live = 진행 중 + 마감 안 지남(마감 모름 포함) · past = 진행 중인데 마감 지남 · off = 그만둠 */
  var VIEWS = ['live', 'past', 'off', 'all'];
  function visible(list, o) {
    o = o || {};
    var v = VIEWS.indexOf(o.view) >= 0 ? o.view : 'live', q = s(o.q).toLowerCase();
    var rows = (list || []).filter(function (r) {
      if (!r || !KINDS[r.kind]) return false;
      if (o.kind && r.kind !== o.kind) return false;
      var d = days(r, o.today), on = r.state !== '그만둠';
      if (v === 'live' && !(on && (d == null || d >= 0))) return false;
      if (v === 'past' && !(on && d != null && d < 0)) return false;
      if (v === 'off' && on) return false;
      if (q && [r.title, r.org, r.srcName, r.no].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var up = function (a, b) { return s(b.updatedAt).localeCompare(s(a.updatedAt)); };
    if (v === 'past') rows.sort(function (a, b) { return ymd(b.closeDt).localeCompare(ymd(a.closeDt)) || up(a, b); });
    else if (v === 'off') rows.sort(up);
    else rows.sort(function (a, b) {
      var da = days(a, o.today), db = days(b, o.today);
      var ka = da == null ? 1e9 : (da < 0 ? 1e6 - da : da), kb = db == null ? 1e9 : (db < 0 ? 1e6 - db : db);
      return ka - kb || up(a, b);
    });
    return rows;
  }
  function counts(list, today) {
    var c = { live: 0, past: 0, off: 0, all: 0, corp: 0, person: 0 };
    (list || []).forEach(function (r) {
      if (!r || !KINDS[r.kind]) return;
      c.all++;
      if (r.state === '그만둠') { c.off++; return; }
      var d = days(r, today);
      if (d != null && d < 0) c.past++; else { c.live++; c[r.kind]++; }
    });
    return c;
  }

  /* 경력관리 사업관리로 넘길 것 — 공개 공고의 사실만(개인정보 없음). 받는 쪽이 «채워서 열기»만 하고 저장은 사람이 누른다 */
  /* ⚠ uid(보낸 계정) · tok(일회용 표 — 주소 ?go=biz&t= 로도 간다)를 함께 — 받는 탭이 «같은 계정 · 자기 표»인 것만 쓴다
       (계정을 바꿨거나 탭이 여럿일 때 남의 넘김을 집어 쓰지 않게, 보안 검토 2026-11-22) */
  function bizHandoff(rec, at, uid, tok) {
    rec = rec || {};
    return { v: 1, at: at, uid: s(uid), tok: s(tok), pursueId: s(rec.id), title: s(rec.title), org: s(rec.org), url: safeUrl(rec.url), no: s(rec.no),
             src: s(rec.srcName), openDt: s(rec.openDt), closeDt: s(rec.closeDt), prc: Number(rec.prc) || 0,
             files: cleanFiles(rec.files) };
  }

  return { KINDS: KINDS, STATES: STATES, VIEWS: VIEWS, FILES_MAX: FILES_MAX,
           keyOf: keyOf, safeUrl: safeUrl, cleanFiles: cleanFiles, mark: mark, setState: setState, setFiles: setFiles,
           setHand: setHand, index: index, ymd: ymd, days: days, visible: visible, counts: counts, bizHandoff: bizHandoff };
});
