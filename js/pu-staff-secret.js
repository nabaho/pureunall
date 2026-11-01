/* 직원(근로자명부)의 주민번호·계좌번호·예금주 — «대표만» 읽는 금고 (대표 승인 2026-11-01, 개인정보 2단계)
   설계·시안: status/2026-11-01-pii-stage2.md

   ■ 왜 따로 두나
     근로자명부(data/user_accounts)는 재무 권한자가 «한 덩어리»로 통째 읽는다. 규칙은 덩어리 안의 «칸 하나»만
     막지 못한다. 그래서 그 셋을 덩어리에서 떼어 staff_secret/{사번}/{rrn|account|holder} 에 둔다.
     보안규칙이 그 자리를 대표(총괄관리자)만 읽고 쓰게 서버에서 막는다.
   ■ 값은 «잠가서» 둔다 (enc:v1: — 백업과 같은 AES-GCM, 열쇠는 backup_key/v1 · js/pu-rrn-seal.js)
     규칙이 막아 줘도 서버·백업 사본에는 글자가 남기 때문이다(안전성 확보조치 기준 제7조③).
   ■ 명부에는 «있다»는 표시와 쓸모 있는 파생값만 남는다
     hasRrn·hasAccount(값 없음), birthDate·gender(주민번호에서 뽑아 «비어 있을 때만» 채움) —
     그래서 급여의 나이·65세 판정, 증명서의 생년월일은 금고 없이 돈다.
   ■ 볼 때마다 기록한다 — staff_secret/{사번}/_log/{id} = {by, byName, at, act, field}
     규칙이 «새로 쓰기만» 허용한다(고치거나 지울 수 없다). 값은 기록에 넣지 않는다.
   ■ 저장 입구에서 뗀다 — pu-erp.html 의 dbSet·dbUpsert·dbPatch·dbUpsertMany 맨 앞(사건 근로자 worker_secret 과 같은 자리).
     ⚠ 「칸이 없다」와 「빈칸이다」는 다르다. 없음 = 모름(이 사람은 못 읽었다) → 손대지 않는다.
       빈칸 = 대표가 지웠다 → 금고 칸을 지운다. 그래서 대표가 아닌 사람이 명부를 저장해도 금고는 그대로다. */
(function (global) {
  'use strict';

  var ROOT = 'staff_secret';
  /* 명부 칸 → 금고 칸 */
  var MAP = { rrn: 'rrn', accountNo: 'account', accountHolder: 'holder' };
  var USER_FIELDS = Object.keys(MAP);
  /* 표시 칸 — 값 대신 «있다»만. 예금주는 계좌와 한 묶음이라 따로 표시하지 않는다. */
  var FLAG = { rrn: 'hasRrn', accountNo: 'hasAccount' };
  var VAULT_FIELDS = ['rrn', 'account', 'holder'];
  var CACHE_MS = 60 * 1000;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  /* ── 주민번호에서 뽑는 파생값(생년월일·성별) ───────────────────────────── */
  function century(g) {
    return (g === '1' || g === '2' || g === '5' || g === '6') ? '19'
      : (g === '3' || g === '4' || g === '7' || g === '8') ? '20'
      : (g === '9' || g === '0') ? '18' : '';
  }
  function birthFromRrn(v) {
    var d = digits(v);
    if (d.length < 7) return '';
    var c = century(d.charAt(6));
    if (!c) return '';
    var m = parseInt(d.slice(2, 4), 10), day = parseInt(d.slice(4, 6), 10);
    if (!(m >= 1 && m <= 12) || !(day >= 1 && day <= 31)) return '';
    return c + d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4, 6);
  }
  function genderFromRrn(v) {
    var d = digits(v);
    if (d.length < 7) return '';
    var g = d.charAt(6);
    if (!century(g)) return '';
    return (g === '1' || g === '3' || g === '5' || g === '7' || g === '9') ? 'M' : 'F';
  }

  /* ── 떼기 ───────────────────────────────────────────────────────────── */
  /* 객체 하나에서 셋을 뗀다. opts.explicitClear — dbPatch 처럼 «빈 값을 보낸 것 자체가 지우기»일 때 */
  function strip(obj, opts) {
    var has0 = USER_FIELDS.some(function (f) { return has(obj, f); });
    if (!has0) return { obj: obj, secrets: null, any: false };
    var c = Object.assign({}, obj), s = {}, n = 0;
    USER_FIELDS.forEach(function (f) {
      if (!has(c, f)) return;
      var v = c[f] == null ? '' : String(c[f]).trim();
      var flag = FLAG[f] || (f === 'accountHolder' ? 'hasAccount' : '');
      /* 빈칸은 «있던 것을 지웠다»일 때만 지우기로 보낸다. 새 줄의 빈칸은 보낼 것이 없다 */
      if (v || (opts && opts.explicitClear) || (flag && obj[flag] === true)) { s[MAP[f]] = v; n++; }
      if (FLAG[f]) c[FLAG[f]] = !!v;
      delete c[f];
    });
    if (s.rrn) {
      if (!String(c.birthDate || '').trim()) { var b = birthFromRrn(s.rrn); if (b) c.birthDate = b; }
      if (!String(c.gender || '').trim()) { var g = genderFromRrn(s.rrn); if (g) c.gender = g; }
    }
    return { obj: c, secrets: n ? s : null, any: true };
  }

  /* 한 사람 — sid 가 있어야 금고에 둘 자리가 있다 */
  function splitUser(u) {
    if (!u || typeof u !== 'object' || !u.sid) return { user: u, secrets: null, any: false };
    var r = strip(u);
    return { user: r.obj, secrets: r.secrets, any: r.any };
  }

  /* 명부 통째 — {list, secrets:{사번:{칸:값}}, any} */
  function splitList(list) {
    var secrets = {}, any = false;
    var out = (list || []).map(function (u) {
      var r = splitUser(u);
      if (r.any) any = true;
      if (r.secrets) secrets[String(u.sid)] = r.secrets;
      return r.user;
    });
    return { list: out, secrets: secrets, any: any };
  }

  /* 칸 몇 개만 — dbPatch 용 */
  function splitPatch(fields) {
    if (!fields || typeof fields !== 'object') return { fields: fields, secrets: null, any: false };
    var r = strip(fields, { explicitClear: true });
    return { fields: r.obj, secrets: r.secrets, any: r.any };
  }

  /* 금고 값 → 사람 객체에 붙인다(창 상태에만 — 저장하면 다시 떼어진다). 원본은 안 바꾼다. */
  function merge(user, vault) {
    if (!user || !vault || !user.sid || !vault[user.sid]) return user;
    var v = vault[user.sid], c = null;
    USER_FIELDS.forEach(function (f) {
      var x = v[MAP[f]];
      if (x != null && x !== '' && user[f] == null) { c = c || Object.assign({}, user); c[f] = x; }
    });
    return c || user;
  }

  /* ── 화면 글자 ──────────────────────────────────────────────────────── */
  function maskRrn(v) {
    var d = digits(v);
    if (d.length < 7) return d ? '●●●●●●' : '';
    return d.slice(0, 6) + '-' + d.charAt(6) + '●●●●●●';
  }
  function maskAccount(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    var d = digits(s);
    return d.length <= 4 ? '●●●●' : '●●●-●●●-' + d.slice(-4);
  }

  /* 목록에서 가리는 연락처·이메일·주소 — 직원을 눌러 상세로 들어가면 그대로 보인다(2026-11-01 시안).
     «가린 글자만 보고는 못 알아보게» 하되 «누구 것인지 가늠은 되게» 앞이나 끝을 남긴다. */
  function maskPhone(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    var m = /^(\d{2,3})[-\s.]?(\d{3,4})[-\s.]?(\d{4})$/.exec(s);
    return m ? m[1] + '-****-' + m[3] : s.replace(/\d(?=\d{3})/g, '*');
  }
  function maskEmail(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    var at = s.indexOf('@');
    if (at < 1) return s.charAt(0) + '***';
    return s.charAt(0) + '**' + s.slice(at);
  }
  function maskAddress(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    var t = s.split(/\s+/);
    return t.length <= 2 ? t[0] + ' ***' : t.slice(0, 2).join(' ') + ' ***';
  }

  /* ── 서버 ───────────────────────────────────────────────────────────── */
  var cache = null;          /* {at, map} — 가져오기 등이 되풀이 읽지 않게 */
  var keyProvider = function (db) { return global.PuRrnSeal.keyFor(db.ref('backup_key/v1')); };
  function setKeyProvider(fn) { keyProvider = fn; }

  function denied(e) { return !!(e && /permission|denied/i.test(String(e.code || e.message || e))); }
  function logId() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function unsealField(v, key) {
    return (typeof v === 'string' && global.PuRrnSeal.isSealed(v)) ? global.PuRrnSeal.unsealOne(v, key) : Promise.resolve(v);
  }

  /* 한 사람의 금고를 풀어 읽는다 — {ok:true,map:{rrn,account,holder}} | {ok:false,denied:true} | {ok:false,error} */
  function readOne(db, sid) {
    if (!db || !sid) return Promise.resolve({ ok: false, error: '인자' });
    return db.ref(ROOT + '/' + sid).once('value').then(function (snap) {
      var raw = (snap && snap.val()) || {};
      var need = VAULT_FIELDS.filter(function (f) { return typeof raw[f] === 'string' && raw[f]; });
      if (!need.length) return { ok: true, map: {} };
      return keyProvider(db).then(function (key) {
        return Promise.all(need.map(function (f) { return unsealField(raw[f], key); })).then(function (vals) {
          var map = {}; need.forEach(function (f, i) { map[f] = vals[i]; });
          return { ok: true, map: map };
        });
      });
    }).catch(function (e) {
      return denied(e) ? { ok: false, denied: true } : { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* 전원의 금고 — {ok:true,map:{사번:{rrn,account,holder}}}. 가져오기처럼 «사람을 맞춰 볼» 때만 쓴다 */
  function readAll(db) {
    if (cache && (Date.now() - cache.at) < CACHE_MS) return Promise.resolve({ ok: true, map: cache.map });
    if (!db) return Promise.resolve({ ok: false, error: '연결 없음' });
    return db.ref(ROOT).once('value').then(function (snap) {
      var raw = (snap && snap.val()) || {};
      var sids = Object.keys(raw);
      var cells = [];
      sids.forEach(function (sid) {
        VAULT_FIELDS.forEach(function (f) { if (typeof raw[sid][f] === 'string' && raw[sid][f]) cells.push([sid, f, raw[sid][f]]); });
      });
      if (!cells.length) { cache = { at: Date.now(), map: {} }; return { ok: true, map: {} }; }
      return keyProvider(db).then(function (key) {
        return Promise.all(cells.map(function (c) { return unsealField(c[2], key); })).then(function (vals) {
          var map = {};
          cells.forEach(function (c, i) { (map[c[0]] = map[c[0]] || {})[c[1]] = vals[i]; });
          cache = { at: Date.now(), map: map };
          return { ok: true, map: map };
        });
      });
    }).catch(function (e) {
      return denied(e) ? { ok: false, denied: true } : { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* 쓰기 — secretsBySid = {사번:{rrn?,account?,holder?}} (빈 문자열 = 지우기). 한 번의 update 로 값과 기록을 함께.
     who = {sid, name} — 기록에만 쓴다. 잠그지 못하면 «쓰지 않는다» (평문으로 두는 길은 없다). */
  function write(db, secretsBySid, who) {
    var sids = Object.keys(secretsBySid || {});
    if (!db || !sids.length) return Promise.resolve({ ok: true, n: 0 });
    var cells = [];
    sids.forEach(function (sid) {
      VAULT_FIELDS.forEach(function (f) {
        if (!has(secretsBySid[sid], f)) return;
        cells.push([sid, f, String(secretsBySid[sid][f] == null ? '' : secretsBySid[sid][f]).trim()]);
      });
    });
    if (!cells.length) return Promise.resolve({ ok: true, n: 0 });
    var needKey = cells.some(function (c) { return c[2]; });
    return (needKey ? keyProvider(db) : Promise.resolve(null)).then(function (key) {
      return Promise.all(cells.map(function (c) {
        return c[2] ? global.PuRrnSeal.sealOne(c[2], key) : Promise.resolve(null);
      }));
    }).then(function (sealed) {
      var paths = {}, at = Date.now();
      cells.forEach(function (c, i) {
        paths[ROOT + '/' + c[0] + '/' + c[1]] = sealed[i];     /* null = 지우기 */
        paths[ROOT + '/' + c[0] + '/_log/' + logId()] = {
          by: (who && who.sid) || '', byName: (who && who.name) || '', at: at, act: c[2] ? 'save' : 'clear', field: c[1]
        };
      });
      return db.ref().update(paths).then(function () { cache = null; return { ok: true, n: cells.length }; });
    }).catch(function (e) {
      return { ok: false, denied: denied(e), error: String((e && e.message) || e) };
    });
  }

  /* 볼 때 남기는 기록 — 값은 넣지 않는다. 실패하면 «보여 주지 않는 쪽»으로 부르는 쪽이 결정한다 */
  function logView(db, sid, field, who) {
    if (!db || !sid) return Promise.resolve({ ok: false, error: '인자' });
    var p = {};
    p[ROOT + '/' + sid + '/_log/' + logId()] = { by: (who && who.sid) || '', byName: (who && who.name) || '', at: Date.now(), act: 'view', field: field };
    return db.ref().update(p).then(function () { return { ok: true }; }, function (e) {
      return { ok: false, denied: denied(e), error: String((e && e.message) || e) };
    });
  }

  var api = {
    ROOT: ROOT, MAP: MAP, USER_FIELDS: USER_FIELDS, FLAG: FLAG, VAULT_FIELDS: VAULT_FIELDS,
    birthFromRrn: birthFromRrn, genderFromRrn: genderFromRrn,
    strip: strip, splitUser: splitUser, splitList: splitList, splitPatch: splitPatch, merge: merge,
    maskRrn: maskRrn, maskAccount: maskAccount, maskPhone: maskPhone, maskEmail: maskEmail, maskAddress: maskAddress,
    readOne: readOne, readAll: readAll, write: write, logView: logView,
    setKeyProvider: setKeyProvider, _resetCache: function () { cache = null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuStaffSecret = api;
})(typeof window !== 'undefined' ? window : globalThis);
