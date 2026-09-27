/* ══ 사무관리서류 — 원본 보관함·기업별 계약서 저장 층 (대표 지시 2026-09-26) ══
   「계약서원본이 계속 보관되어야 하고 … 사진첩에서 정리된 계약서등에 대해서 기업마다
    별도로 관리할 수 있게도 해달라」
   설계: docs/superpowers/specs/2026-09-27-사무관리서류-개편-design.md §4·§5

   ■ 자리
     창고 pu_docs/originals/{fileId}/{파일명}   원본 — 새로 쓰기만(덮어쓰기·지우기는 규칙이 막는다)
     RTDB pu_docs/originals/{fileId}           색인 — 새로 쓰기만
     RTDB pu_docs/hash/{sha256}                같은 파일 찾기 → fileId
     RTDB pu_docs/co/{coKey}                   회사
     RTDB pu_docs/co_docs/{coKey}/{docId}      회사↔파일 연결 (지우기 = 연결만 끊기)

   ⚠ 쓰는 차례 — 창고 → 색인 → 해시. 해시가 «마지막»이어야 중간에 끊겨도
     다음 시도가 없는 색인을 가리키지 않는다(창고에 고아 파일 하나는 감수한다).
   ⚠ 이알피가 양식 첨부(base64)를 직접 연다 — 보관함은 «옮기기»가 아니라 «사본»이다. */
(function (w) {
  'use strict';

  var ROOT = 'pu_docs';
  var MAX_BYTES = 25 * 1024 * 1024;
  var OK_EXT = ['hwp', 'hwpx', 'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic'];

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function okDocFile(name, size) {
    if (OK_EXT.indexOf(extOf(name)) < 0) return { ok: false, why: '올릴 수 없는 종류입니다 (한글·PDF·워드·사진만)' };
    if (!(size > 0)) return { ok: false, why: '빈 파일입니다' };
    if (size >= MAX_BYTES) return { ok: false, why: '25MB 를 넘습니다' };
    return { ok: true };
  }
  function coKey(name) {
    return String(name || '')
      .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .replace(/[.#$\[\]\/]/g, '_');
  }
  function safeFileName(name) {
    return String(name || 'file').replace(/[\/\\#?\[\]*]/g, '_').slice(0, 120);
  }
  function sha256Hex(u8) {
    var c = w.crypto && w.crypto.subtle;
    if (!c) return Promise.reject(new Error('이 브라우저는 파일 지문(SHA-256)을 만들지 못합니다'));
    return Promise.resolve(c.digest('SHA-256', u8)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function dataUrlToBytes(dataUrl) {
    var b64 = String(dataUrl || '').split(',')[1] || '';
    var bin = w.atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  /* 선택 필드는 있을 때만 붙인다 — RTDB 는 undefined 를 거절한다 */
  function clean(o) {
    var r = {};
    Object.keys(o || {}).forEach(function (k) {
      var v = o[k];
      if (v === undefined || v === null) return;
      r[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? clean(v) : v;
    });
    return r;
  }
  function originalRecord(o) {
    return clean({ name: o.name, size: o.size, type: o.type || '', sha256: o.sha256, path: o.path,
      at: o.at, by: o.by, byName: o.byName || '', from: o.from });
  }
  function isDenied(e) {
    var s = String((e && (e.code || '')) + ' ' + (e && e.message || ''));
    return /permission[_ ]denied|storage\/unauthorized/i.test(s);
  }

  var deps = { db: null, storage: null, uid: '', name: '' };
  function init(o) {
    o = o || {};
    deps.db = o.db || null;
    deps.storage = o.storage || null;
    deps.uid = o.uid || '';
    deps.name = o.name || '';
  }
  function needDb() { if (!deps.db) throw new Error('실시간DB가 연결되지 않았습니다'); }

  function putOriginal(file, from) {
    var chk = okDocFile(file && file.name, file && file.size);
    if (!chk.ok) return Promise.reject(new Error(chk.why));
    if (!deps.storage) return Promise.reject(new Error('파일 창고가 연결되지 않았습니다'));
    if (!deps.uid) return Promise.reject(new Error('로그인한 계정을 알 수 없습니다'));
    needDb();
    return sha256Hex(file.bytes).then(function (h) {
      return deps.db.ref(ROOT + '/hash/' + h).once('value').then(function (s) {
        var have = s.val();
        if (have) return { fileId: have, sha256: h, reused: true };
        var fileId = deps.db.ref(ROOT + '/originals').push().key;
        var p = ROOT + '/originals/' + fileId + '/' + safeFileName(file.name);
        return deps.storage.ref(p).put(file.bytes, { contentType: file.type || 'application/octet-stream' })
          .then(function () {
            return deps.db.ref(ROOT + '/originals/' + fileId).set(originalRecord({
              name: String(file.name).slice(0, 200), size: file.size, type: String(file.type || '').slice(0, 120),
              sha256: h, path: p, at: Date.now(), by: deps.uid, byName: deps.name, from: from }));
          })
          .then(function () { return deps.db.ref(ROOT + '/hash/' + h).set(fileId); })
          .then(function () { return { fileId: fileId, sha256: h, reused: false }; });
      });
    });
  }
  function getOriginal(fileId) {
    needDb();
    return deps.db.ref(ROOT + '/originals/' + fileId).once('value').then(function (s) {
      var v = s.val(); if (!v) return null; v.id = fileId; return v;
    });
  }
  function listOriginals() {
    needDb();
    return deps.db.ref(ROOT + '/originals').once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (id) { var r = v[id]; r.id = id; return r; })
        .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    });
  }
  function fileUrl(rec) {
    if (!deps.storage) return Promise.reject(new Error('파일 창고가 연결되지 않았습니다'));
    return deps.storage.ref(rec.path).getDownloadURL();
  }
  /* 이름을 살려 내려받는다 — 다른 출처 주소에는 download 속성이 안 먹어서 한 번 받아 둔다.
     못 받으면(CORS 등) 새 창으로 연다. */
  function download(fileId, name) {
    return getOriginal(fileId).then(function (rec) {
      if (!rec) throw new Error('보관함에 없는 파일입니다');
      return fileUrl(rec).then(function (url) {
        return w.fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
          .then(function (blob) {
            var a = w.document.createElement('a');
            a.href = w.URL.createObjectURL(blob); a.download = name || rec.name || 'file';
            w.document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { w.URL.revokeObjectURL(a.href); }, 5000);
          }, function () { w.open(url, '_blank', 'noopener'); });
      });
    });
  }

  function addCoDoc(o) {
    needDb();
    var name = String((o && o.coName) || '').trim();
    var key = coKey(name);
    if (!key) return Promise.reject(new Error('회사 이름을 넣어 주세요'));
    var ref = deps.db.ref(ROOT + '/co_docs/' + key).push();
    var docId = ref.key;
    return ref.set(clean({ fileId: o.fileId, title: String(o.title || '계약서').slice(0, 120), date: String(o.date || '').slice(0, 10),
      src: o.src === 'photo' ? 'photo' : 'upload', at: Date.now(), by: deps.uid, byName: deps.name }))
      .then(function () {
        return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
          return { name: (cur && cur.name) || name.slice(0, 120), n: ((cur && cur.n) || 0) + 1, lastAt: Date.now() };
        });
      })
      .then(function () { return { coKey: key, docId: docId }; });
  }
  function updateCoDoc(key, docId, patch) {
    needDb();
    return deps.db.ref(ROOT + '/co_docs/' + key + '/' + docId).transaction(function (cur) {
      var updates = clean({
        title: patch.title == null ? undefined : String(patch.title).slice(0, 120),
        date: patch.date == null ? undefined : String(patch.date).slice(0, 10) });
      return Object.assign({}, cur || {}, updates);
    });
  }
  function unlinkCoDoc(key, docId) {
    needDb();
    return deps.db.ref(ROOT + '/co_docs/' + key + '/' + docId).remove().then(function () {
      return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
        if (!cur) return cur;
        return { name: cur.name, n: Math.max(0, (cur.n || 0) - 1), lastAt: cur.lastAt || Date.now() };
      });
    });
  }
  function listCo() {
    needDb();
    return deps.db.ref(ROOT + '/co').once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (k) { return { key: k, name: v[k].name || k, n: v[k].n || 0, lastAt: v[k].lastAt || 0 }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    });
  }
  function listCoDocs(key) {
    needDb();
    return deps.db.ref(ROOT + '/co_docs/' + key).once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (id) { var d = v[id]; d.id = id; return d; })
        .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0); });
    });
  }
  /* 규칙이 게시됐는지 — 읽기가 막히면 'denied'. 그 밖의 오류는 그대로 던진다 */
  function probe() {
    needDb();
    return deps.db.ref(ROOT + '/co').limitToFirst(1).once('value')
      .then(function () { return 'ok'; }, function (e) { if (isDenied(e)) return 'denied'; throw e; });
  }

  w.PuOfficeStore = {
    ROOT: ROOT, MAX_BYTES: MAX_BYTES,
    coKey: coKey, okDocFile: okDocFile, safeFileName: safeFileName, sha256Hex: sha256Hex,
    dataUrlToBytes: dataUrlToBytes, originalRecord: originalRecord, isDenied: isDenied,
    init: init, putOriginal: putOriginal, getOriginal: getOriginal, listOriginals: listOriginals,
    fileUrl: fileUrl, download: download,
    addCoDoc: addCoDoc, updateCoDoc: updateCoDoc, unlinkCoDoc: unlinkCoDoc,
    listCo: listCo, listCoDocs: listCoDocs, probe: probe
  };
})(typeof window !== 'undefined' ? window : this);
