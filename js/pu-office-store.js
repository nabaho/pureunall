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
  var OK_EXT = ['hwp', 'hwpx', 'xlsx', 'xls', 'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic'];

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function okDocFile(name, size) {
    if (OK_EXT.indexOf(extOf(name)) < 0) return { ok: false, why: '올릴 수 없는 종류입니다 (한글·엑셀·PDF·워드·사진만)' };
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
  /* 규칙(pu_docs/originals/$id/byName ≤60, from/$f ≤200)이 «색인 쓰기 자체»를
     거절하면, 창고에는 이미 파일이 올라간 뒤라 고아가 남는다 — 여기서 미리 잘라
     규칙이 거절할 일을 없앤다(대표가 회사명·양식명을 길게 적어도 그대로 담긴다). */
  function clampStr(v, max) { return typeof v === 'string' ? v.slice(0, max) : v; }
  function clampFrom(o) {
    if (!o || typeof o !== 'object') return o;
    var r = {};
    Object.keys(o).forEach(function (k) { r[k] = clampStr(o[k], 200); });
    return r;
  }
  function originalRecord(o) {
    return clean({ name: o.name, size: o.size, type: o.type || '', sha256: o.sha256, path: o.path,
      at: o.at, by: o.by, byName: clampStr(o.byName || '', 60), from: clampFrom(o.from), secret: o.secret ? true : undefined });
  }
  function isDenied(e) {
    var s = String((e && (e.code || '')) + ' ' + (e && e.message || ''));
    return /permission[_ ]denied|storage\/unauthorized/i.test(s);
  }

  var deps = { db: null, storage: null, uid: '', name: '', secretFetch: null };
  function init(o) {
    o = o || {};
    deps.db = o.db || null;
    deps.storage = o.storage || null;
    deps.uid = o.uid || '';
    deps.name = o.name || '';
    /* 🔒 서명본 받기 — 서버 함수 puDocSecret(총괄관리자만)을 부르는 길을 화면이 넘긴다 (설계 2026-10-03 §3.1) */
    deps.secretFetch = typeof o.secretFetch === 'function' ? o.secretFetch : null;
  }
  function needDb() { if (!deps.db) throw new Error('실시간DB가 연결되지 않았습니다'); }

  /* opts.secret — 🔒 서명본: 창고 pu_docs/secret/… (창고 규칙이 «아무도 직접 못 읽음»), 기록에 secret:true.
     여는 길은 서버 함수뿐이다(secretBlob). ⚠ 같은 파일이 이미 보통 자리에 있으면 그것을 다시 쓴다(해시) —
     이미 직원에게 열려 있던 파일이라 새로 막을 것이 없다. */
  function putOriginal(file, from, opts) {
    var secret = !!(opts && opts.secret);
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
        var p = ROOT + (secret ? '/secret/' : '/originals/') + fileId + '/' + safeFileName(file.name);
        return deps.storage.ref(p).put(file.bytes, { contentType: file.type || 'application/octet-stream' })
          .then(function () {
            return deps.db.ref(ROOT + '/originals/' + fileId).set(originalRecord({
              name: String(file.name).slice(0, 200), size: file.size, type: String(file.type || '').slice(0, 120),
              sha256: h, path: p, at: Date.now(), by: deps.uid, byName: deps.name, from: from, secret: secret }));
          })
          .then(function () {
            return deps.db.ref(ROOT + '/hash/' + h).set(fileId).then(function () {
              return { fileId: fileId, sha256: h, reused: false };
            }, function (setErr) {
              /* ⚠ 겹쳐 쓰기 — 다른 탭·사람이 같은 순간 같은 해시로 먼저 hash/{h} 를
                 심었으면(규칙이 «새로 쓰기만» 이라 우리 것은 거절된다) 진 게 아니다.
                 다시 읽어 그 fileId 를 쓰면 된다 — 우리가 창고에 올린 것은 고아로
                 남지만(정직하게 감수), 화면은 먼저 심긴 쪽을 그대로 쓰면 된다. */
              return deps.db.ref(ROOT + '/hash/' + h).once('value').then(function (s2) {
                var have2 = s2.val();
                if (have2) return { fileId: have2, sha256: h, reused: true };
                throw setErr;
              });
            });
          });
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
  function isSecret(rec) { return !!(rec && rec.secret); }
  /* 이미 보관함에 있는 파일인지(해시) — 폴더 가져오기 미리 보기용 */
  function hasHash(h) { needDb(); return deps.db.ref(ROOT + '/hash/' + h).once('value').then(function (s) { return !!s.val(); }); }
  /* 🔒 서명본 바이트 — 서버가 총괄관리자인지 보고 내준다. 아니면 서버가 거절(403) */
  function secretBlob(fileId) {
    if (!deps.secretFetch) return Promise.reject(new Error('🔒 서명본을 여는 길이 연결되지 않았습니다'));
    return deps.secretFetch(fileId);
  }
  function fileUrl(rec) {
    if (isSecret(rec)) return Promise.reject(Object.assign(new Error('🔒 서명본은 대표·관리자만 열 수 있습니다'), { code: 'secret' }));
    if (!deps.storage) return Promise.reject(new Error('파일 창고가 연결되지 않았습니다'));
    return deps.storage.ref(rec.path).getDownloadURL();
  }
  /* 이름을 살려 내려받는다 — 다른 출처 주소에는 download 속성이 안 먹어서 한 번 받아 둔다.
     못 받으면(CORS 등) 새 창으로 연다. */
  function saveBlob(blob, name) {
    var a = w.document.createElement('a');
    a.href = w.URL.createObjectURL(blob); a.download = name || 'file';
    w.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { w.URL.revokeObjectURL(a.href); }, 5000);
  }
  function download(fileId, name) {
    return getOriginal(fileId).then(function (rec) {
      if (!rec) throw new Error('보관함에 없는 파일입니다');
      if (isSecret(rec)) return secretBlob(fileId).then(function (b) { saveBlob(b, name || rec.name); });
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

  /* co/{열쇠} 를 고칠 때 계약 기록 수(r)·사업자번호(bz)를 떨어뜨리지 않는다 */
  function keepCo(cur, next) {
    if (cur && cur.r != null && next.r == null) next.r = cur.r;
    if (cur && cur.bz && !next.bz) next.bz = cur.bz;
    return next;
  }

  /* ══ 계약 기록 (설계 2026-10-03 §3) — 파일 없는 줄: 언제·무슨 계약·얼마·지급일·EDI ══
     pu_docs/co_recs/{열쇠}/{id} = { date, kind, amount, payDay, tax, edi, staff, contact, bizNo, note, docId, src, at, by, byName }
     src: 'import'(엑셀 명단) | 'manual'(손으로). 지워도 파일(co_docs·originals)은 그대로. */
  var REC_KEYS = ['date', 'kind', 'amount', 'payDay', 'tax', 'edi', 'staff', 'contact', 'bizNo', 'note', 'docId'];
  function recRecord(o) {
    var r = { src: o.src === 'import' || o.src === 'folder' ? o.src : 'manual', at: Date.now(), by: deps.uid, byName: clampStr(deps.name, 60) };
    REC_KEYS.forEach(function (k) {
      var v = o[k];
      if (v == null || v === '') return;
      if (k === 'amount') { v = Math.round(+v); if (!isFinite(v) || v < 0) return; }
      /* ⚠ docId 는 푸시 열쇠(20자) — 12자로 자르면 카드와 끊긴다(2026-10-05 폴더 가져오기 230줄이 끊겼다). 규칙 상한 40 */
      else v = String(v).slice(0, k === 'note' ? 200 : k === 'contact' ? 80 : k === 'docId' ? 40 : k === 'kind' ? 20 : k === 'staff' ? 30 : 12);
      r[k] = v;
    });
    if (!r.kind) r.kind = '기타';
    return r;
  }
  function listCoRecs(key) {
    needDb();
    return deps.db.ref(ROOT + '/co_recs/' + key).once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (id) { var d = v[id]; d.id = id; return d; })
        .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0); });
    });
  }
  /* 여러 줄 한 번에 — rows: [{coName, bizNo?, date, kind, …}]. 같은 회사·계약일·종류가 이미 있으면 건너뛴다.
     onProgress(i, n) 로 진행을 알린다. 반환 { added, skipped, cos } */
  function importCoRecs(rows, onProgress) {
    needDb();
    var by = {};
    (rows || []).forEach(function (r) {
      var key = coKey(r.coName); if (!key) return;
      (by[key] = by[key] || { name: String(r.coName).trim().slice(0, 120), bz: '', rows: [] }).rows.push(r);
      if (r.bizNo && !by[key].bz) by[key].bz = String(r.bizNo).slice(0, 12);
    });
    var keys = Object.keys(by), done = 0, added = 0, skipped = 0;
    return keys.reduce(function (p, key) {
      return p.then(function () {
        var g = by[key];
        return listCoRecs(key).then(function (have) {
          /* 겹침 — 파일에 붙은 줄은 «같은 파일»일 때만(같은 날 같은 종류 계약서가 둘일 수 있다), 파일 없는 줄은 날짜·종류 */
          var sigOf = function (x) { return x.docId ? 'doc|' + x.docId : (x.date || '-') + '|' + (x.kind || '-'); };
          var seen = {}; have.forEach(function (h) { seen[sigOf(h)] = 1; });
          var up = {}, n = 0;
          g.rows.forEach(function (r) {
            var rec = recRecord(r), sig = sigOf(rec);
            if (seen[sig]) { skipped++; return; }
            seen[sig] = 1; n++;
            up[deps.db.ref(ROOT + '/co_recs/' + key).push().key] = rec;
          });
          if (!n) return;
          return deps.db.ref(ROOT + '/co_recs/' + key).update(up).then(function () {
            added += n;
            return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
              return clean(keepCo(cur, { name: (cur && cur.name) || g.name, n: (cur && cur.n) || 0, r: ((cur && cur.r) || 0) + n,
                bz: (cur && cur.bz) || g.bz || undefined, lastAt: Date.now() }));
            });
          });
        }).then(function () { done++; if (onProgress) onProgress(done, keys.length); });
      });
    }, Promise.resolve()).then(function () { return { added: added, skipped: skipped, cos: keys.length }; });
  }
  function updateCoRec(key, id, patch) {
    needDb();
    var cur = {}; REC_KEYS.forEach(function (k) { if (k in patch) cur[k] = patch[k]; });
    var r = recRecord(Object.assign({ src: 'manual' }, cur)), out = {};
    REC_KEYS.forEach(function (k) { if (k in patch) out[k] = r[k] == null ? null : r[k]; });
    return deps.db.ref(ROOT + '/co_recs/' + key + '/' + id).update(out);
  }
  function removeCoRec(key, id) {
    needDb();
    return deps.db.ref(ROOT + '/co_recs/' + key + '/' + id).remove().then(function () {
      return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
        if (!cur) return cur;
        return keepCo(cur, { name: cur.name, n: cur.n || 0, r: Math.max(0, (cur.r || 0) - 1), lastAt: cur.lastAt || Date.now() });
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
      src: o.src === 'photo' ? 'photo' : o.src === 'folder' ? 'folder' : 'upload', at: Date.now(), by: deps.uid, byName: clampStr(deps.name, 60),
      secret: o.secret ? true : undefined }))
      .then(function () {
        return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
          return keepCo(cur, { name: (cur && cur.name) || name.slice(0, 120), n: ((cur && cur.n) || 0) + 1, lastAt: Date.now() });
        });
      })
      .then(function () { return { coKey: key, docId: docId }; });
  }
  function updateCoDoc(key, docId, patch) {
    needDb();
    return deps.db.ref(ROOT + '/co_docs/' + key + '/' + docId).update(clean({
      title: patch.title == null ? undefined : String(patch.title).slice(0, 120),
      date: patch.date == null ? undefined : String(patch.date).slice(0, 10) }));
  }
  function unlinkCoDoc(key, docId) {
    needDb();
    return deps.db.ref(ROOT + '/co_docs/' + key + '/' + docId).remove().then(function () {
      return deps.db.ref(ROOT + '/co/' + key).transaction(function (cur) {
        if (!cur) return cur;
        return keepCo(cur, { name: cur.name, n: Math.max(0, (cur.n || 0) - 1), lastAt: cur.lastAt || Date.now() });
      });
    });
  }
  function listCo() {
    needDb();
    return deps.db.ref(ROOT + '/co').once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (k) { return { key: k, name: v[k].name || k, n: v[k].n || 0, r: v[k].r || 0, bz: v[k].bz || '', lastAt: v[k].lastAt || 0 }; })
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
  /* ══ 📬 서명본 대기 (대표 「추천대로」 2026-10-07) — 계약서를 보냈거나(메일) 채워 받은(받기) 회사 ══
     pu_docs/await/{coKey} = { name, bz?, at, how:'메일'|'받기', names[], by, byName, remindAt?, got?, gotDoc? }
     회사마다 한 줄(가장 최근 보냄). 다시 보내면 got 이 지워져 다시 대기로. 서명본을 올리면 got·gotDoc 이 찍혀 「최근 회수」로.
     ⚠ 받는 주소는 남기지 않는다(보낸 서류와 같은 원칙). 기업정보함(pucards)은 건드리지 않는다. */
  function awaitRecord(o) {
    o = o || {};
    var r = { name: clampStr(String(o.coName || '').trim(), 120), at: Number(o.at) || Date.now(), how: o.how === '받기' ? '받기' : '메일',
      names: (o.names || []).map(function (v) { return String(v || '').slice(0, 200); }).filter(Boolean).slice(0, 20),
      by: deps.uid, byName: clampStr(deps.name, 60) };
    var bz = String(o.bz || '').replace(/\D/g, '');
    if (bz.length >= 10) r.bz = bz.slice(0, 12);
    if (!r.names.length) delete r.names;
    return r;
  }
  function markAwait(o) {
    needDb();
    var key = coKey(o && o.coName);
    if (!key) return Promise.reject(new Error('회사 이름이 없습니다'));
    return deps.db.ref(ROOT + '/await/' + key).set(clean(awaitRecord(o))).then(function () { return key; });
  }
  function listAwait() {
    needDb();
    return deps.db.ref(ROOT + '/await').once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (k) {
        var d = v[k] || {}, names = d.names;
        if (names && !Array.isArray(names)) names = Object.keys(names).map(function (i) { return names[i]; });
        return { key: k, name: d.name || k, bz: d.bz || '', at: d.at || 0, how: d.how || '메일', names: names || [], byName: d.byName || '',
          remindAt: d.remindAt || 0, got: d.got || 0, gotDoc: d.gotDoc || '' };
      });
    });
  }
  function remindAwait(key) { needDb(); return deps.db.ref(ROOT + '/await/' + key).update({ remindAt: Date.now() }); }
  function gotAwait(key, docId) {
    needDb();
    return deps.db.ref(ROOT + '/await/' + key).once('value').then(function (s) {
      if (!s.exists()) return;   // 대기 목록에 없던 회사 — 적을 것 없음
      return deps.db.ref(ROOT + '/await/' + key).update(clean({ got: Date.now(), gotDoc: docId ? String(docId).slice(0, 40) : undefined }));
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
    fileUrl: fileUrl, download: download, isSecret: isSecret, secretBlob: secretBlob, saveBlob: saveBlob, hasHash: hasHash,
    addCoDoc: addCoDoc, updateCoDoc: updateCoDoc, unlinkCoDoc: unlinkCoDoc,
    listCo: listCo, listCoDocs: listCoDocs, probe: probe,
    awaitRecord: awaitRecord, markAwait: markAwait, listAwait: listAwait, remindAwait: remindAwait, gotAwait: gotAwait,
    keepCo: keepCo, recRecord: recRecord, listCoRecs: listCoRecs, importCoRecs: importCoRecs, updateCoRec: updateCoRec, removeCoRec: removeCoRec
  };
})(typeof window !== 'undefined' ? window : this);
