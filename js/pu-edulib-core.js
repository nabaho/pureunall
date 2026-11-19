/* ═══════════════════════════════════════════════════════════════════════
   법정교육자료함 — 화면과 상관없는 «셈»만 모은 곳 (2026-11-19)

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
  var SCHEMA = 1;
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
    return y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31;
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
      if (k === 'cat') v = C.catByKey(v).key;
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

  /* 거르기 — f: { q, cat, year, kind, status, store, legal } */
  function filter(items, f) {
    f = f || {};
    var q = str(f.q).trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return live(items).filter(function (it) {
      if (f.cat && it.cat !== f.cat) return false;
      if (f.year) {
        if (f.year === 'none') { if (yearOf(it.lectureDate)) return false; }
        else if (yearOf(it.lectureDate) !== f.year) return false;
      }
      if (f.kind && it.kind !== f.kind) return false;
      if (f.status && it.status !== f.status) return false;
      if (f.store && it.store !== f.store) return false;
      if (f.legal && !C.catByKey(it.cat).legal) return false;
      if (words.length) {
        var hay = [it.title, it.fileName, it.venue, it.note, C.catByKey(it.cat).label,
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
      return { key: c.key, label: c.label, legal: c.legal, law: c.law, n: 0, cloud: 0, review: 0, latest: '', bytes: 0 };
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
      cats: cats.filter(function (c) { return c.n > 0 || c.legal; }),
      years: yearList,
      matrix: matrix
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

  return {
    ENTITY: ENTITY, NOTE_ENTITY: NOTE_ENTITY, SCHEMA: SCHEMA,
    STATUS: STATUS, STORE: STORE, KIND_LABEL: KIND_LABEL,
    yearOf: yearOf, okDate: okDate, newId: newId,
    makeItem: makeItem, patchOf: patchOf, live: live,
    filter: filter, sortByDate: sortByDate, group: group, dashboard: dashboard,
    findSame: findSame, fmtBytes: fmtBytes, storagePathOf: storagePathOf
  };
});
