/* 폰 화면 점검용 «가짜 파이어베이스» (compat 판 흉내)
 *
 * ★ 무엇에 쓰나 — tools/phone-audit/run.mjs 가 앱을 폰 크기로 «로그인한 채» 그려 보려고 쓴다.
 *   진짜 로그인은 비밀번호가 있어야 해서 못 한다(비밀번호는 안 넣는다). 그래서 gstatic 의
 *   firebase-*-compat.js 를 이 파일로 바꿔 끼운다 — 앱 코드는 한 줄도 안 바뀐다.
 * ⚠ 개발용이다 — tools/ 는 배포에서 지운다(deploy-pages.yml).
 * ⚠ 자료는 모두 지어낸 것이다(window.__PA_SEED__). 실제 고객·직원 정보를 넣지 말 것.
 *
 * 흉내 내는 것: initializeApp · auth(로그인된 한 사람) · database(메모리 안 나무, on/once/
 *   set/update/push/remove/transaction/질의) · storage(빈 창고) · appCheck · messaging(없음).
 */
(function (w) {
  'use strict';
  if (w.firebase && w.firebase.__fake) return;

  var SEED = w.__PA_SEED__ || {};
  var USER = w.__PA_USER__ || { uid: 'pa-uid-1', email: 'p001@pureun.kr', displayName: '점검용' };
  var LOG = w.__PA_LOG__ = w.__PA_LOG__ || { reads: {}, writes: 0, missing: [] };

  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  var ROOT = clone(SEED) || {};

  function parts(p) { return String(p || '').split('/').filter(Boolean); }
  function getAt(p) {
    var cur = ROOT, ks = parts(p);
    for (var i = 0; i < ks.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[ks[i]];
    }
    return cur === undefined ? null : cur;
  }
  function prune(o) {
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) {
        if (o[k] === null || o[k] === undefined) delete o[k];
        else if (typeof o[k] === 'object') { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; }
      });
    }
    return o;
  }
  function resolveSV(v) {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      if (v['.sv'] && typeof v['.sv'] === 'object' && 'increment' in v['.sv']) return v;
      var o = Array.isArray(v) ? [] : {};
      Object.keys(v).forEach(function (k) { o[k] = resolveSV(v[k]); });
      return o;
    }
    return v;
  }
  function setAt(p, v) {
    v = resolveSV(clone(v));
    var ks = parts(p);
    if (!ks.length) { ROOT = (v && typeof v === 'object') ? v : {}; changed(''); return; }
    var cur = ROOT;
    for (var i = 0; i < ks.length - 1; i++) {
      if (cur[ks[i]] == null || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    var last = ks[ks.length - 1];
    if (v && typeof v === 'object' && v['.sv'] && v['.sv'].increment != null) {
      v = (Number(cur[last]) || 0) + Number(v['.sv'].increment);
    }
    if (v === null || v === undefined) delete cur[last]; else cur[last] = v;
    prune(ROOT);
    LOG.writes++;
    changed(p);
  }

  /* ── 지켜보는 이들 ── */
  var listeners = []; // {path, event, cb, query}
  function isAnc(a, b) { // a 가 b 의 조상이거나 같다
    var pa = parts(a), pb = parts(b);
    if (pa.length > pb.length) return false;
    for (var i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return false;
    return true;
  }
  function changed(p) {
    listeners.slice().forEach(function (l) {
      if (!(isAnc(l.path, p) || isAnc(p, l.path))) return;
      if (l.event === 'value') fire(l);
      else if (l.event === 'child_added' || l.event === 'child_changed' || l.event === 'child_removed') {
        var before = l.seen || {};
        var now = childMap(l.path, l.query);
        Object.keys(now).forEach(function (k) {
          if (!(k in before)) { if (l.event === 'child_added') l.cb(snap(join(l.path, k), now[k])); }
          else if (JSON.stringify(before[k]) !== JSON.stringify(now[k]) && l.event === 'child_changed') l.cb(snap(join(l.path, k), now[k]));
        });
        Object.keys(before).forEach(function (k) {
          if (!(k in now) && l.event === 'child_removed') l.cb(snap(join(l.path, k), before[k]));
        });
        l.seen = clone(now) || {};
      }
    });
  }
  function fire(l) {
    var v = queryVal(l.path, l.query);
    setTimeout(function () { try { l.cb(snap(l.path, v, l.query)); } catch (e) { console.error(e); } }, 0);
  }
  function join(a, b) { return parts(a).concat(parts(b)).join('/'); }

  function childMap(p, q) {
    var v = queryVal(p, q);
    return (v && typeof v === 'object') ? v : {};
  }
  function queryVal(p, q) {
    var v = getAt(p);
    LOG.reads[p] = (LOG.reads[p] || 0) + 1;
    if (v == null && LOG.missing.indexOf(p) < 0 && LOG.missing.length < 400) LOG.missing.push(p);
    if (!q || !v || typeof v !== 'object') return clone(v);
    var ks = Object.keys(v);
    function keyOf(k) {
      if (q.by === 'child') { var c = v[k] && typeof v[k] === 'object' ? getIn(v[k], q.child) : null; return c; }
      if (q.by === 'value') return v[k];
      return k;
    }
    ks.sort(function (a, b) {
      var x = keyOf(a), y = keyOf(b);
      if (x == null && y != null) return -1; if (y == null && x != null) return 1;
      if (x < y) return -1; if (x > y) return 1; return a < b ? -1 : a > b ? 1 : 0;
    });
    if (q.eq !== undefined) ks = ks.filter(function (k) { return keyOf(k) === q.eq; });
    if (q.start !== undefined) ks = ks.filter(function (k) { var x = keyOf(k); return x != null && x >= q.start; });
    if (q.end !== undefined) ks = ks.filter(function (k) { var x = keyOf(k); return x != null && x <= q.end; });
    if (q.first) ks = ks.slice(0, q.first);
    if (q.last) ks = ks.slice(-q.last);
    var o = {}; ks.forEach(function (k) { o[k] = v[k]; });
    return clone(o);
  }
  function getIn(o, path) {
    var ks = parts(path), cur = o;
    for (var i = 0; i < ks.length; i++) { if (cur == null || typeof cur !== 'object') return null; cur = cur[ks[i]]; }
    return cur === undefined ? null : cur;
  }

  function snap(p, v, q) {
    var key = parts(p).slice(-1)[0] || null;
    var s = {
      key: key,
      ref: null,
      val: function () { return clone(v); },
      exportVal: function () { return clone(v); },
      toJSON: function () { return clone(v); },
      exists: function () { return v !== null && v !== undefined; },
      child: function (c) { return snap(join(p, c), getIn(v, c)); },
      hasChild: function (c) { return getIn(v, c) != null; },
      hasChildren: function () { return !!(v && typeof v === 'object' && Object.keys(v).length); },
      numChildren: function () { return v && typeof v === 'object' ? Object.keys(v).length : 0; },
      forEach: function (cb) {
        if (!v || typeof v !== 'object') return false;
        var ks = Object.keys(v);
        for (var i = 0; i < ks.length; i++) if (cb(snap(join(p, ks[i]), v[ks[i]])) === true) return true;
        return false;
      },
      getPriority: function () { return null; }
    };
    s.ref = ref(p);
    return s;
  }

  var pushN = 0;
  function pushId() {
    pushN++;
    return '-PA' + Date.now().toString(36) + ('000' + pushN).slice(-4);
  }

  function thenable(ref, pr) { ref.then = pr.then.bind(pr); ref.catch = pr.catch.bind(pr); return ref; }

  function ref(p, q) {
    p = parts(p).join('/');
    var r = {
      key: parts(p).slice(-1)[0] || null,
      path: { toString: function () { return '/' + p; } },
      toString: function () { return 'https://pa-fake.firebaseio.test/' + p; },
      child: function (c) { return ref(join(p, c)); },
      get parent() { var ks = parts(p); return ks.length ? ref(ks.slice(0, -1).join('/')) : null; },
      get root() { return ref(''); },
      on: function (ev, cb, errCb, ctx) {
        if (typeof errCb === 'object' && errCb) { ctx = errCb; errCb = null; }
        var l = { path: p, event: ev, cb: ctx ? cb.bind(ctx) : cb, orig: cb, query: q };
        listeners.push(l);
        if (p === '.info/connected') { setTimeout(function () { l.cb(snap(p, true)); }, 0); return cb; }
        if (p === '.info/serverTimeOffset') { setTimeout(function () { l.cb(snap(p, 0)); }, 0); return cb; }
        if (ev === 'value') fire(l);
        else if (ev === 'child_added') {
          var m = childMap(p, q); l.seen = clone(m) || {};
          setTimeout(function () { Object.keys(m).forEach(function (k) { try { l.cb(snap(join(p, k), m[k])); } catch (e) { console.error(e); } }); }, 0);
        } else { l.seen = clone(childMap(p, q)) || {}; }
        return cb;
      },
      off: function (ev, cb) {
        listeners = listeners.filter(function (l) {
          if (l.path !== p) return true;
          if (ev && l.event !== ev) return true;
          if (cb && l.orig !== cb) return true;
          return false;
        });
      },
      once: function (ev, cb) {
        var v = (p === '.info/connected') ? true : queryVal(p, q);
        var s;
        if (ev === 'child_added') {
          var m = (v && typeof v === 'object') ? v : {};
          var ks = Object.keys(m);
          s = ks.length ? snap(join(p, ks[0]), m[ks[0]]) : null;
        } else s = snap(p, v, q);
        if (typeof cb === 'function') setTimeout(function () { if (s) cb(s); }, 0);
        return Promise.resolve(s);
      },
      get: function () { return Promise.resolve(snap(p, queryVal(p, q), q)); },
      set: function (v, cb) { setAt(p, v); if (typeof cb === 'function') setTimeout(function () { cb(null); }, 0); return Promise.resolve(); },
      setWithPriority: function (v) { setAt(p, v); return Promise.resolve(); },
      setPriority: function () { return Promise.resolve(); },
      update: function (o, cb) {
        Object.keys(o || {}).forEach(function (k) { setAt(join(p, k), o[k]); });
        if (typeof cb === 'function') setTimeout(function () { cb(null); }, 0);
        return Promise.resolve();
      },
      remove: function (cb) { setAt(p, null); if (typeof cb === 'function') setTimeout(function () { cb(null); }, 0); return Promise.resolve(); },
      push: function (v, cb) {
        var c = ref(join(p, pushId()));
        var pr = (v === undefined) ? Promise.resolve(c) : c.set(v, cb).then(function () { return c; });
        return thenable(c, pr);
      },
      transaction: function (fn, cb) {
        var cur = getAt(p);
        var nv;
        try { nv = fn(clone(cur)); } catch (e) { return Promise.reject(e); }
        var committed = nv !== undefined;
        if (committed) setAt(p, nv);
        var res = { committed: committed, snapshot: snap(p, getAt(p)) };
        if (typeof cb === 'function') setTimeout(function () { cb(null, committed, res.snapshot); }, 0);
        return Promise.resolve(res);
      },
      onDisconnect: function () {
        var noop = function () { return Promise.resolve(); };
        return { set: noop, update: noop, remove: noop, cancel: noop, setWithPriority: noop };
      },
      orderByChild: function (c) { return ref(p, Object.assign({}, q, { by: 'child', child: c })); },
      orderByKey: function () { return ref(p, Object.assign({}, q, { by: 'key' })); },
      orderByValue: function () { return ref(p, Object.assign({}, q, { by: 'value' })); },
      orderByPriority: function () { return ref(p, Object.assign({}, q, { by: 'key' })); },
      equalTo: function (v) { return ref(p, Object.assign({}, q, { eq: v })); },
      startAt: function (v) { return ref(p, Object.assign({}, q, { start: v })); },
      startAfter: function (v) { return ref(p, Object.assign({}, q, { start: v })); },
      endAt: function (v) { return ref(p, Object.assign({}, q, { end: v })); },
      endBefore: function (v) { return ref(p, Object.assign({}, q, { end: v })); },
      limitToFirst: function (n) { return ref(p, Object.assign({}, q, { first: n })); },
      limitToLast: function (n) { return ref(p, Object.assign({}, q, { last: n })); },
      isEqual: function (o) { return o && o.toString() === r.toString(); },
      keepSynced: function () {}
    };
    r.ref = r;
    return r;
  }

  var db = {
    ref: function (p) { return ref(p || ''); },
    refFromURL: function (u) { return ref(String(u).replace(/^https?:\/\/[^/]+\/?/, '')); },
    goOnline: function () {}, goOffline: function () {},
    useEmulator: function () {}
  };

  /* ── 로그인된 한 사람 ── */
  var user = {
    uid: USER.uid, email: USER.email, displayName: USER.displayName, emailVerified: true,
    isAnonymous: false, providerData: [{ providerId: 'password', email: USER.email }],
    phoneNumber: null, photoURL: null, metadata: { creationTime: '', lastSignInTime: '' },
    getIdToken: function () { return Promise.resolve('pa-fake-token'); },
    getIdTokenResult: function () { return Promise.resolve({ token: 'pa-fake-token', claims: USER.claims || {}, expirationTime: new Date(Date.now() + 3600e3).toISOString() }); },
    reload: function () { return Promise.resolve(); },
    updatePassword: function () { return Promise.resolve(); },
    reauthenticateWithCredential: function () { return Promise.resolve(); },
    updateProfile: function () { return Promise.resolve(); },
    multiFactor: { enrolledFactors: [] },
    toJSON: function () { return { uid: USER.uid, email: USER.email }; }
  };
  var authCbs = [];
  var auth = {
    currentUser: user,
    languageCode: 'ko',
    onAuthStateChanged: function (cb) { authCbs.push(cb); setTimeout(function () { cb(user); }, 0); return function () {}; },
    onIdTokenChanged: function (cb) { setTimeout(function () { cb(user); }, 0); return function () {}; },
    setPersistence: function () { return Promise.resolve(); },
    signOut: function () { return Promise.resolve(); },
    signInWithEmailAndPassword: function () { return Promise.resolve({ user: user }); },
    signInWithCustomToken: function () { return Promise.resolve({ user: user }); },
    signInAnonymously: function () { return Promise.resolve({ user: user }); },
    getRedirectResult: function () { return Promise.resolve({ user: null }); },
    signInWithPopup: function () { return Promise.resolve({ user: user }); },
    signInWithRedirect: function () { return Promise.resolve(); },
    useDeviceLanguage: function () {},
    fetchSignInMethodsForEmail: function () { return Promise.resolve(['password']); },
    sendPasswordResetEmail: function () { return Promise.resolve(); },
    authStateReady: function () { return Promise.resolve(); }
  };

  /* ── 빈 창고 ── */
  function sref(p) {
    p = parts(p).join('/');
    var task = function () {
      var pr = Promise.resolve({ ref: sref(p), metadata: { fullPath: p }, state: 'success' });
      var t = { on: function (ev, a, b, c) { setTimeout(function () { if (typeof c === 'function') c(); }, 0); return function () {}; },
        cancel: function () {}, pause: function () {}, resume: function () {}, snapshot: { ref: sref(p), bytesTransferred: 1, totalBytes: 1 } };
      t.then = pr.then.bind(pr); t.catch = pr.catch.bind(pr);
      return t;
    };
    return {
      fullPath: p, name: parts(p).slice(-1)[0] || '', bucket: 'pa-fake',
      child: function (c) { return sref(join(p, c)); },
      get parent() { return sref(parts(p).slice(0, -1).join('/')); },
      get root() { return sref(''); },
      put: task, putString: task,
      getDownloadURL: function () { return Promise.reject(Object.assign(new Error('없음(점검용)'), { code: 'storage/object-not-found' })); },
      getMetadata: function () { return Promise.reject(Object.assign(new Error('없음(점검용)'), { code: 'storage/object-not-found' })); },
      updateMetadata: function () { return Promise.resolve({}); },
      listAll: function () { return Promise.resolve({ items: [], prefixes: [] }); },
      list: function () { return Promise.resolve({ items: [], prefixes: [] }); },
      delete: function () { return Promise.resolve(); }
    };
  }
  var storage = { ref: function (p) { return sref(p || ''); }, refFromURL: function (u) { return sref(String(u).replace(/^gs:\/\/[^/]+\/?/, '')); }, setMaxUploadRetryTime: function () {}, setMaxOperationRetryTime: function () {} };

  var apps = [];
  function makeApp(cfg, name) {
    var a = {
      name: name || '[DEFAULT]', options: cfg || {},
      auth: function () { return auth; },
      database: function () { return db; },
      storage: function () { return storage; },
      appCheck: function () { return firebase.appCheck(); },
      messaging: function () { return firebase.messaging(); },
      delete: function () { return Promise.resolve(); }
    };
    return a;
  }

  var firebase = {
    __fake: true,
    SDK_VERSION: 'pa-fake',
    apps: apps,
    initializeApp: function (cfg, name) {
      var found = apps.filter(function (a) { return a.name === (name || '[DEFAULT]'); })[0];
      if (found) return found;
      var a = makeApp(cfg, name); apps.push(a); return a;
    },
    app: function (name) {
      var a = apps.filter(function (x) { return x.name === (name || '[DEFAULT]'); })[0];
      if (!a) { a = makeApp({}, name); apps.push(a); }
      return a;
    },
    auth: function () { return auth; },
    database: function () { return db; },
    storage: function () { return storage; },
    appCheck: function () { return { activate: function () {}, setTokenAutoRefreshEnabled: function () {}, getToken: function () { return Promise.resolve({ token: 'pa' }); }, onTokenChanged: function () { return function () {}; } }; },
    messaging: function () { return { getToken: function () { return Promise.reject(new Error('점검용')); }, onMessage: function () {}, deleteToken: function () { return Promise.resolve(); } }; },
    functions: function () { return { httpsCallable: function () { return function () { return Promise.reject(new Error('점검용')); }; } }; }
  };
  firebase.auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  firebase.auth.EmailAuthProvider = { credential: function () { return {}; }, PROVIDER_ID: 'password' };
  firebase.auth.GoogleAuthProvider = function () { this.addScope = function () {}; this.setCustomParameters = function () {}; };
  firebase.auth.OAuthProvider = firebase.auth.GoogleAuthProvider;
  firebase.database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' }, increment: function (n) { return { '.sv': { increment: n } }; } };
  firebase.database.Reference = function () {};
  firebase.database.Reference.prototype = {};
  firebase.database.enableLogging = function () {};
  firebase.appCheck.ReCaptchaV3Provider = function () {};
  firebase.appCheck.ReCaptchaEnterpriseProvider = function () {};
  firebase.messaging.isSupported = function () { return false; };
  firebase.storage.TaskEvent = { STATE_CHANGED: 'state_changed' };
  firebase.storage.TaskState = { SUCCESS: 'success', RUNNING: 'running' };

  w.firebase = firebase;
  w.__PA_DB__ = { get: getAt, set: setAt, root: function () { return ROOT; } };
})(window);
