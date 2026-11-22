/* ═══════════════════════════════════════════════════════════════════════
   강의자료 — 화면과 상관없는 «셈»만 모은 곳 (2026-11-19)

   거르기 · 묶기(종류별/연도별) · 대시보드 숫자 · 새 기록 만들기 · 같은 파일 찾기.
   화면(pu-edulib.html)과 검사(tests/edulib.test.js)가 함께 쓴다 — 그래서 DOM·Firebase 를 모른다.

   ★ 기록 한 건 = 강의자료 파일 «하나». 원본 파일은 바꾸지 않고 그대로 둔다(대표 지시 「가급적 원본을 유지」).
     원본이 어디 있는지는 store 로 말한다:
       store:'cloud' — 자료함 창고(Storage)에 원본을 올렸다(누구나 내려받기·나란히 보기)
       store:'pc'    — 원본은 아직 PC 에만 있다(목록·분류만 먼저 올림, 나중에 «원본 올리기»)
       store:'mail'  — 원본은 푸른 메일함 첨부에 있다(관리자만 열 수 있다)
   ★ 강의일은 «추정»일 수 있다 — dateFrom 이 name·folder·mail 이면 추정, manual 이면 사람이 정한 것.
     파일 수정일(mtime)은 강의일로 쓰지 않는다.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory(root.PuEduLibClassify || (typeof require === 'function' ? require('./pu-edulib-classify.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuEduLibCore = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 개체 이름은 온톨로지 사전(PuOntology.TERMS.entityTypes)에 먼저 올라 있어야 한다 — 없으면 관문이 저장을 거절한다 */
  var ENTITY = 'EduMaterial';
  var NOTE_ENTITY = 'EduReviewNote';
  var CAT_ENTITY = 'EduCategory';                /* 사람이 더한 강의 종류(/edulib/cats) — 2026-11-21 「＋ 추가기능」 */
  /* 자동 정리한 «내용»(문서의 목차·첫 글) 상한 — 서버 메일 자동 정리(functions/edulib-mail-sweep.js)와 같은 값을 쓴다 */
  var SUMMARY_MAX = 1200;
  /* 자료 구조 판 — 온톨로지 사전의 판(PuOntology.VERSION)을 따른다. 저장할 때는 공용 관문(prepareRecord)이
     schemaVersion·contractVersion·revision·시각을 «다시» 찍으므로, 여기 값은 관문을 거치기 전 모양을 맞추는 것뿐이다. */
  var SCHEMA = (typeof self !== 'undefined' && self.PuOntology && +self.PuOntology.VERSION) || 1;
  var STATUS = { review: '검토 대기', ok: '참고 가능', old: '옛 자료' };
  var STORE = { cloud: '자료함', pc: 'PC에만', mail: '메일함' };
  var KIND_LABEL = { doc: '문서', video: '영상', audio: '소리', image: '그림', archive: '압축', other: '기타' };

  function str(v) { return v == null ? '' : String(v); }
  function yearOf(d) { var m = str(d).match(/^(\d{4})/); return m ? m[1] : ''; }

  /* 강의일 모양 — YYYY / YYYY-MM / YYYY-MM-DD 만 받는다(빈 값 허용) */
  function okDate(d) {
    d = str(d);
    if (!d) return true;
    var m = d.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    if (!m) return false;
    var y = +m[1], mo = m[2] ? +m[2] : 1, da = m[3] ? +m[3] : 1;
    var dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();          /* 그 달의 날수 — 2026-02-31 은 받지 않는다 */
    return y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && da >= 1 && da <= dim;
  }

  function newId(now) {
    var t = (now || Date.now()).toString(36);
    var r = '';
    for (var i = 0; i < 8; i++) r += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36));
    return 'edu_' + t + r;
  }

  /* 새 기록 — 원본 파일의 이름·크기·형식은 바꾸지 않고 그대로 적는다 */
  function makeItem(o, who, now) {
    now = now || Date.now();
    var name = str(o.fileName);
    var ext = C.extOf(name);
    var cat = C.catByKey(o.cat).key;
    var it = {
      id: o.id || newId(now),
      entityType: ENTITY,
      schemaVersion: SCHEMA,
      title: str(o.title).trim() || name.replace(/\.[^.]+$/, ''),
      fileName: name,
      ext: ext,
      kind: C.kindOf(ext),
      size: Math.max(0, +o.size || 0),
      sha256: str(o.sha256),
      cat: cat,
      lectureDate: okDate(o.lectureDate) ? str(o.lectureDate) : '',
      dateFrom: str(o.dateFrom),
      venue: str(o.venue).trim(),
      note: str(o.note).trim(),
      summary: str(o.summary).replace(/\s+/g, ' ').trim().slice(0, SUMMARY_MAX),
      status: STATUS[o.status] ? o.status : 'review',
      pii: !!o.pii,
      store: STORE[o.store] ? o.store : 'pc',
      storagePath: str(o.storagePath),
      source: o.source && typeof o.source === 'object' ? {
        kind: str(o.source.kind) || 'upload',
        path: str(o.source.path),
        mailId: str(o.source.mailId),
        mailSubject: str(o.source.mailSubject),
        mailDate: str(o.source.mailDate),
        mtime: str(o.source.mtime)
      } : { kind: 'upload', path: '', mailId: '', mailSubject: '', mailDate: '', mtime: '' },
      createdAt: now,
      updatedAt: now,
      createdBy: str(who && who.uid),          /* 사번(sid) — 이름은 보일 때 바꾼다(이름을 열쇠로 저장하지 않는다) */
      revision: 1
    };
    return it;
  }

  /* 고칠 수 있는 칸만 고친다 — 원본 파일 정보(fileName·size·sha256·storagePath)는 못 바꾼다 */
  var EDITABLE = { title: 1, cat: 1, lectureDate: 1, dateFrom: 1, venue: 1, note: 1, status: 1, pii: 1 };
  function patchOf(cur, changes, now) {
    var p = {};
    Object.keys(changes || {}).forEach(function (k) {
      if (!EDITABLE[k]) return;
      var v = changes[k];
      /* 지금 종류 그대로면 그대로 — 사람이 더한 종류 목록을 아직 못 읽은 순간에 «기타»로 바뀌지 않게 */
      if (k === 'cat') v = (cur && v === cur.cat) ? v : C.catByKey(v).key;
      if (k === 'lectureDate' && !okDate(v)) return;
      if (k === 'status' && !STATUS[v]) return;
      if (k === 'pii') v = !!v;
      if (typeof v === 'string') v = v.trim();
      if (cur && cur[k] === v) return;
      p[k] = v;
    });
    if (!Object.keys(p).length) return null;
    p.updatedAt = now || Date.now();
    p.revision = ((cur && +cur.revision) || 0) + 1;
    return p;
  }

  function live(items) {
    return (items || []).filter(function (it) { return it && !it._deleted; });
  }

  /* 거르기 — f: { q, cat, year, kind, status, store, legal }
     legal: '' 전체 · 'legal'(또는 예전 true) 법정교육 자료만 · 'other' 법정교육 외 자료만 */
  function filter(items, f) {
    f = f || {};
    var q = str(f.q).trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return live(items).filter(function (it) {
      if (f.cat && it.cat !== f.cat) return false;
      if (f.year) {
        if (f.year === 'none') { if (yearOf(it.lectureDate)) return false; }
        else if (/^~\d{4}$/.test(f.year)) { var yy = yearOf(it.lectureDate); if (!yy || yy > f.year.slice(1)) return false; }   /* «~2014» = 2014년까지(대시보드의 «그 이전» 칸) */
        else if (yearOf(it.lectureDate) !== f.year) return false;
      }
      if (f.kind && it.kind !== f.kind) return false;
      if (f.status && it.status !== f.status) return false;
      if (f.store && it.store !== f.store) return false;
      if (f.legal === 'other') { if (C.catByKey(it.cat).legal) return false; }
      else if (f.legal && !C.catByKey(it.cat).legal) return false;
      if (words.length) {
        var hay = [it.title, it.fileName, it.venue, it.note, it.summary, C.catByKey(it.cat).label,
          it.source && it.source.path, it.source && it.source.mailSubject].join(' ').toLowerCase();
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      }
      return true;
    });
  }

  /* 강의일 늦은 것 먼저 — 날짜 없는 것은 맨 뒤, 같으면 제목 */
  function sortByDate(list, asc) {
    return list.slice().sort(function (a, b) {
      var da = str(a.lectureDate), db = str(b.lectureDate);
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (da !== db) return asc ? (da < db ? -1 : 1) : (da < db ? 1 : -1);
      return str(a.title).localeCompare(str(b.title), 'ko');
    });
  }

  /* 묶기 — by:'cat' | 'year' | '' → [{ key, label, items }] (종류 순서는 규칙 표 순서) */
  function group(list, by) {
    if (!by) return [{ key: '', label: '', items: list }];
    var map = {}, order = [];
    list.forEach(function (it) {
      var k = by === 'cat' ? it.cat : (yearOf(it.lectureDate) || 'none');
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(it);
    });
    if (by === 'cat') {
      var idx = {}; C.CATS.forEach(function (c, i) { idx[c.key] = i; });
      order.sort(function (a, b) { return (idx[a] == null ? 99 : idx[a]) - (idx[b] == null ? 99 : idx[b]); });
    } else {
      order.sort(function (a, b) { if (a === 'none') return 1; if (b === 'none') return -1; return a < b ? 1 : -1; });
    }
    return order.map(function (k) {
      return { key: k, label: by === 'cat' ? C.catByKey(k).label : (k === 'none' ? '강의일 모름' : k + '년'), items: map[k] };
    });
  }

  /* 대시보드 숫자 — 종류마다 건수·최근 강의일·창고에 올린 건수·검토 대기, 그리고 연도×종류 표 */
  function dashboard(items) {
    var L = live(items);
    var cats = C.CATS.map(function (c) {
      return { key: c.key, label: c.label, legal: c.legal, law: c.law, custom: !!c.custom, n: 0, cloud: 0, review: 0, latest: '', bytes: 0 };
    });
    var byKey = {}; cats.forEach(function (c) { byKey[c.key] = c; });
    var years = {}, matrix = {};
    L.forEach(function (it) {
      var c = byKey[it.cat] || byKey.etc;
      c.n++; c.bytes += +it.size || 0;
      if (it.store === 'cloud') c.cloud++;
      if (it.status === 'review') c.review++;
      if (str(it.lectureDate) > c.latest) c.latest = str(it.lectureDate);
      var y = yearOf(it.lectureDate) || 'none';
      years[y] = 1;
      var row = matrix[y] || (matrix[y] = {});
      row[c.key] = (row[c.key] || 0) + 1;
    });
    var yearList = Object.keys(years).sort(function (a, b) { if (a === 'none') return 1; if (b === 'none') return -1; return a < b ? 1 : -1; });
    return {
      total: L.length,
      cloud: L.filter(function (it) { return it.store === 'cloud'; }).length,
      review: L.filter(function (it) { return it.status === 'review'; }).length,
      /* 사람이 더한 종류는 아직 0건이어도 보인다 — 더하자마자 «어디 갔나»가 되지 않게 */
      cats: cats.filter(function (c) { return c.n > 0 || c.legal || c.custom; }),
      years: yearList,
      matrix: matrix
    };
  }

  /* 법정교육 자료 / 법정교육 외 자료 — 한눈에·자료함이 «같은 잣대»(종류의 법정 표시 하나)로 나눈다 (대표 지시 2026-11-22
     「법정교육 자료, 그리고 법정교육 외 자료라고 하고 그렇게 분리하고 … 자료함에도 그렇게 분리해서」).
     ⚠ 이름으로 짐작하지 않는다 — 종류 표(classify CATS·사람이 더한 종류)의 legal 만 본다. 순서는 늘 법정 먼저. */
  var LEGAL_SIDES = [{ key: 'legal', label: '법정교육 자료' }, { key: 'other', label: '법정교육 외 자료' }];
  function sideOf(catKey) { return C.catByKey(catKey).legal ? 'legal' : 'other'; }
  /* dashboard().cats → [{ key, label, cats, kinds, n, bytes, cloud, review }] × 2(법정·법정 외) */
  function splitLegal(cats) {
    return LEGAL_SIDES.map(function (s) {
      var cs = (cats || []).filter(function (c) { return (c.legal ? 'legal' : 'other') === s.key; });
      var t = { key: s.key, label: s.label, cats: cs, kinds: cs.length, n: 0, bytes: 0, cloud: 0, review: 0 };
      cs.forEach(function (c) { t.n += c.n || 0; t.bytes += c.bytes || 0; t.cloud += c.cloud || 0; t.review += c.review || 0; });
      return t;
    });
  }
  /* group(list,'cat') 의 묶음 → [{ key, label, groups, n }] × 2 — 자료함 카드·표가 두 덩어리로 나눠 그린다 */
  function splitGroups(groups) {
    return LEGAL_SIDES.map(function (s) {
      var gs = (groups || []).filter(function (g) { return sideOf(g.key) === s.key; });
      return { key: s.key, label: s.label, groups: gs, n: gs.reduce(function (a, g) { return a + g.items.length; }, 0) };
    });
  }

  /* 대시보드 «종류 × 연도» 표의 연도 칸 — 최근 max 해만 따로 세우고, 그보다 옛날은 «~YYYY» 한 칸으로 모은다.
     years: dashboard().years(늦은 해 먼저, 'none' 맨 뒤) → { cols:[옛날→최근 열쇠], olderKey, older:[모은 해], none:bool } */
  function yearCols(years, max) {
    max = max || 12;
    var ys = (years || []).filter(function (y) { return /^\d{4}$/.test(y); });
    var recent = ys.slice(0, max), older = ys.slice(max);
    var cols = recent.slice().reverse();
    var olderKey = older.length ? '~' + older[0] : '';
    if (olderKey) cols.unshift(olderKey);
    return { cols: cols, olderKey: olderKey, older: older, none: (years || []).indexOf('none') >= 0 };
  }

  /* 새 강의 종류 기록 — 이름·법정 여부·근거·찾을 낱말만. 열쇠(id)가 곧 종류 열쇠다(자료 기록의 cat 칸) */
  function newCatId(now) {
    var t = (now || Date.now()).toString(36), r = '';
    for (var i = 0; i < 6; i++) r += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36));
    return 'cat_' + t + r;
  }
  function makeCat(o, who, now) {
    now = now || Date.now();
    var label = str(o.label).replace(/\s+/g, ' ').trim().slice(0, 40);
    return {
      id: o.id || newCatId(now),
      entityType: CAT_ENTITY,
      schemaVersion: SCHEMA,
      label: label,
      legal: !!o.legal,
      law: str(o.law).trim().slice(0, 60),
      words: C.cleanWords(o.words, label),
      createdAt: now,
      updatedAt: now,
      createdBy: str(who && who.uid),
      revision: 1
    };
  }

  /* 같은 파일 찾기 — 지문(sha256)이 같으면 «같은 파일», 없으면 이름+크기가 같을 때 «같아 보임» */
  function findSame(items, f) {
    var L = live(items);
    if (f.sha256) {
      var hit = L.filter(function (it) { return it.sha256 && it.sha256 === f.sha256; });
      if (hit.length) return { how: 'sha256', items: hit };
    }
    var nm = str(f.fileName).toLowerCase(), sz = +f.size || 0;
    var near = L.filter(function (it) { return str(it.fileName).toLowerCase() === nm && (+it.size || 0) === sz; });
    return near.length ? { how: 'name+size', items: near } : null;
  }

  function fmtBytes(n) {
    n = +n || 0;
    if (n >= 1073741824) return (n / 1073741824).toFixed(1) + 'GB';
    if (n >= 1048576) return (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + 'MB';
    if (n >= 1024) return Math.round(n / 1024) + 'KB';
    return n + 'B';
  }

  /* 창고 경로 — 기록 id 폴더 아래에 원본 이름 그대로. 경로를 깨는 글자만 바꾼다(원본 이름은 기록에 그대로 남는다) */
  function storagePathOf(id, fileName) {
    var safe = str(fileName).replace(/[\\/#?\[\]*\u0000-\u001f]/g, '_').slice(0, 180) || 'file';
    return 'edulib/' + id + '/' + safe;
  }

  /* ───────── 비슷한 강의 — 내용 지문 (대표 지시 2026-11-22 「기존 강의를 바꾼 게 있다 그러면 마지막에 언제 강의랑 유사하다 그런 표시도」) ─────────
     슬라이드·문서 글을 «낱말 두 개씩 짝»(shingle)으로 쪼개 MinHash 32개로 줄인다 — 같은 자리 값이 같은 비율 ≈ 두 글의 겹침(자카드 유사도).
     ★ 지문은 edulib/sims/{자료 id} 에 따로 둔다 — 자료 기록의 «고친 때»를 바꾸지 않는다. 글 자체는 저장하지 않는다(숫자 지문뿐).
     ★ 글이 적은 자료(그림 위주)는 mh:'' 로 «비교 안 함»을 남긴다 — 다시 받아 다시 세지 않게.
     ★ 이름이 비슷한 것은 보지 않는다 — 내용만. 똑같은 파일(지문 sha256 같음)은 넣을 때 이미 걸러진다. */
  var SIM_ENTITY = 'EduSimilarity', SIM_V = 1, SIM_K = 32, SIM_MIN = 0.5, SIM_MIN_SHINGLES = 12;
  var SIM_SEEDS = (function () {
    var s = [], x = 0x2545f491;
    for (var i = 0; i < SIM_K; i++) { x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0; s.push(x); }
    return s;
  })();
  function fnv1a(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function mix(h, seed) { h = (h ^ seed) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
  /* 낱말 — 한글·영문·숫자 덩어리(2글자 이상, 숫자만은 뺀다 — 쪽 번호·연도가 «같은 강의»를 만들지 않게) */
  function simWords(lines) {
    var t = str((lines || []).join('\n'));
    try { t = t.normalize('NFKC'); } catch (e) {}
    return (t.toLowerCase().match(/[0-9a-z\u3131-\u318e\uac00-\ud7a3]+/g) || []).filter(function (w) { return w.length >= 2 && !/^\d+$/.test(w); });
  }
  function simShingles(lines) {
    var w = simWords(lines), set = Object.create(null), out = [];
    for (var i = 0; i + 1 < w.length; i++) { var k = w[i] + ' ' + w[i + 1]; if (!set[k]) { set[k] = 1; out.push(k); } }
    return out;
  }
  /* lines(문단 글 목록) → { mh:'8자리 16진수 × 32', n:짝 수 } · 글이 적으면 { mh:'', n } */
  function simSig(lines) {
    var sh = simShingles(lines);
    if (sh.length < SIM_MIN_SHINGLES) return { mh: '', n: sh.length };
    var mins = []; for (var k = 0; k < SIM_K; k++) mins.push(0xffffffff);
    sh.forEach(function (s) { var h = fnv1a(s); for (var j = 0; j < SIM_K; j++) { var v = mix(h, SIM_SEEDS[j]); if (v < mins[j]) mins[j] = v; } });
    return { mh: mins.map(function (v) { return ('0000000' + v.toString(16)).slice(-8); }).join(''), n: sh.length };
  }
  function okMh(mh) { return typeof mh === 'string' && mh.length === SIM_K * 8 && /^[0-9a-f]+$/.test(mh); }
  /* 두 지문의 겹침(0~1) — 같은 자리 값이 같은 비율 */
  function simScore(a, b) {
    if (!okMh(a) || !okMh(b)) return 0;
    var eq = 0; for (var i = 0; i < a.length; i += 8) if (a.substr(i, 8) === b.substr(i, 8)) eq++;
    return eq / SIM_K;
  }
  /* ⚠ sourceKind 와 sourceId 는 «함께» — 하나만 있으면 온톨로지 저장 관문이 저장을 거부한다(source_pair_incomplete · 2026-11-22 검토에서 찾음).
     why: '' 보통 · 'unreadable' 파일을 못 열었다(암호·손상) — 둘 다 mh:'' 이면 다시 받지 않는다 */
  function makeSim(itemId, sig, who, now, why) {
    now = now || Date.now();
    var r = { id: itemId, entityType: SIM_ENTITY, schemaVersion: SCHEMA, sourceKind: ENTITY, sourceId: itemId, v: SIM_V, mh: okMh(sig && sig.mh) ? sig.mh : '',
      n: Math.max(0, +(sig && sig.n) || 0), by: str(who).slice(0, 64), createdAt: now, updatedAt: now };
    if (why === 'unreadable') r.why = why;
    return r;
  }
  /* id 와 비슷한 다른 자료 — 지운 것·지문 없는 것은 뺀다. 점수 높은 순(같으면 늦은 강의 먼저) */
  function similarOf(id, items, sims, min) {
    var me = sims && sims[id]; if (!me || !okMh(me.mh)) return [];
    min = min == null ? SIM_MIN : min;
    var out = [];
    live(items).forEach(function (it) {
      if (!it || it.id === id) return;
      var o = sims[it.id]; if (!o || !okMh(o.mh)) return;
      var sc = simScore(me.mh, o.mh);
      if (sc >= min) out.push({ id: it.id, score: sc, date: str(it.lectureDate) });
    });
    return out.sort(function (a, b) { return b.score - a.score || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); });
  }
  /* «마지막으로 비슷했던 예전 강의» — 비슷한 것 가운데 강의일이 이 자료보다 앞선 것의 «가장 늦은 것».
     이 자료의 강의일을 모르면 가장 비슷한 것. 앞선 것이 없으면 null(이 자료가 처음 만든 강의). */
  function lastSimilar(it, items, sims) {
    if (!it) return null;
    var cands = similarOf(it.id, items, sims);
    if (!cands.length) return null;
    var d = str(it.lectureDate);
    if (!d) return cands[0];
    var earlier = cands.filter(function (x) { return x.date && x.date < d; });
    if (!earlier.length) return null;
    return earlier.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.score - a.score; })[0];
  }
  /* 목록 표시용 — 모든 자료의 «마지막 비슷한 예전 강의»를 한 번에(자료·지문이 바뀔 때 화면이 한 번 다시 센다) */
  function lastSimilarAll(items, sims) {
    var out = Object.create(null);
    live(items).forEach(function (it) { var x = lastSimilar(it, items, sims); if (x) out[it.id] = x; });
    return out;
  }

  return {
    ENTITY: ENTITY, NOTE_ENTITY: NOTE_ENTITY, CAT_ENTITY: CAT_ENTITY, SCHEMA: SCHEMA, SUMMARY_MAX: SUMMARY_MAX,
    SIM_ENTITY: SIM_ENTITY, SIM_V: SIM_V, SIM_K: SIM_K, SIM_MIN: SIM_MIN,
    simWords: simWords, simShingles: simShingles, simSig: simSig, simScore: simScore, okMh: okMh, makeSim: makeSim,
    similarOf: similarOf, lastSimilar: lastSimilar, lastSimilarAll: lastSimilarAll,
    yearCols: yearCols, newCatId: newCatId, makeCat: makeCat,
    LEGAL_SIDES: LEGAL_SIDES, sideOf: sideOf, splitLegal: splitLegal, splitGroups: splitGroups,
    STATUS: STATUS, STORE: STORE, KIND_LABEL: KIND_LABEL,
    yearOf: yearOf, okDate: okDate, newId: newId,
    makeItem: makeItem, patchOf: patchOf, live: live,
    filter: filter, sortByDate: sortByDate, group: group, dashboard: dashboard,
    findSame: findSame, fmtBytes: fmtBytes, storagePathOf: storagePathOf
  };
});
