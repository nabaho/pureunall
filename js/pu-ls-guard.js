/* 푸른 저장 공간 감시 — localStorage 에 «못 적었다»를 삼키지 않고 알린다 (2026-10-07)

   ── 왜 생겼나
     nabaho.github.io 의 모든 앱이 localStorage «한 주소 몫 약 5MB»를 함께 쓴다.
     2026-10-07 대표 크롬이 한도(5,242,346자)까지 차서 경력관리가 목록을 못 적었다(QuotaExceededError).
     그런데 앱마다 쓰는 자리가 수십 곳이고, 그 상당수가 try{ … }catch(e){} 로 실패를 «조용히» 삼킨다.
     자리마다 고치면 다음에 새로 생기는 자리에서 또 샌다. 그래서 «쓰기 한 곳»(Storage.prototype.setItem)에서 본다.

   ── 무엇을 하나
     ① 쓰기는 «예전 그대로» 한다 — 실패하면 예전처럼 던진다(부르는 쪽 처리는 바뀌지 않는다).
     ② 공간 부족으로 실패한 열쇠를 적어 두고 잠깐(1.5초) 기다린다.
        그 사이 같은 열쇠가 다시 적히거나(자리를 비우고 다시 쓰기) 지워지면(«없어도 되는» 것) 넘어간다.
        → 앱이 스스로 수습한 것까지 알리면 «잔소리»가 되어 아무도 안 읽는다(2026-09 장애알림의 교훈).
     ③ 끝내 못 적은 것이 남으면 화면 아래에 한 줄 알린다 — 10분에 한 번, 다른 앱 알림과도 한 번만
        (window.__puQuotaToldAt 를 함께 본다 — 이알피 erpQuotaNotice 가 같은 시각을 적는다).
     ④ 무엇이 공간을 먹는지 «열쇠 이름과 크기만» 함께 보인다. 값(자료)은 화면·콘솔에 안 찍는다.

   ⚠ 이 파일은 «알리기만» 한다 — 지우거나 옮기지 않는다. 큰 것을 옮기는 일은 js/pu-big-store.js 가 한다.
   ⚠ 경력관리(kcareer.html)에는 싣지 않았다 — 다른 방이 따로 다룬다(그 방이 원하면 한 줄 실으면 된다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root && root.window === root) api.install(root);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TELL_GAP = 10 * 60 * 1000;

  function isQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || e.code === 22 || e.code === 1014 || /quota|exceeded/i.test(String(e.message || '')));
  }

  /* 열쇠 → 사람이 알아볼 이름. 모르는 것은 열쇠 그대로 */
  var LABELS = [
    ['pureun_v6_', '이알피 '], ['pureun_rules_', '규정관리 '], ['cm3_', '경력관리 '], ['p_', '정부컨설팅 '],
    ['pucards', '기업정보함 '], ['pumail', '메일함 '], ['puphotos', '사진첩 ']
  ];
  function label(k) {
    k = String(k);
    for (var i = 0; i < LABELS.length; i++) if (k.indexOf(LABELS[i][0]) === 0) return LABELS[i][1] + k.slice(LABELS[i][0].length);
    return k;
  }
  function kb(n) { return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }

  function install(w, opts) {
    opts = opts || {};
    if (!w || w.PuLsGuard) return w && w.PuLsGuard;
    var S = w.Storage, LS = null;
    try { LS = w.localStorage; } catch (_) { LS = null; }
    if (!S || !S.prototype || !LS) return null;
    var origSet = S.prototype.setItem, origRemove = S.prototype.removeItem, origGet = S.prototype.getItem;
    var WAIT = opts.wait != null ? opts.wait : 1500;
    var failed = {}, timer = null, shown = 0;

    function usage() {
      var rows = [];
      try {
        for (var i = 0; i < LS.length; i++) {
          var k = LS.key(i); if (k == null) continue;
          var v = origGet.call(LS, k) || '';
          rows.push({ key: k, chars: k.length + v.length });
        }
      } catch (_) {}
      rows.sort(function (a, b) { return b.chars - a.chars; });
      return rows;
    }

    function toast(text) {
      var d = w.document; if (!d || !d.createElement || !d.body) return;
      try {
        var old = d.getElementById('pu-ls-guard'); if (old && old.parentNode) old.parentNode.removeChild(old);
        var box = d.createElement('div');
        box.id = 'pu-ls-guard';
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;'
          + 'max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:10px 36px 10px 14px;'
          + 'background:#fffbeb;border:1px solid #fde68a;color:#854d0e;border-radius:10px;'
          + 'font:13px/1.5 system-ui,-apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.12)';
        box.textContent = text;
        var x = d.createElement('button');
        x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', '닫기');
        x.style.cssText = 'position:absolute;top:4px;right:6px;border:0;background:transparent;color:#854d0e;font-size:18px;cursor:pointer;padding:2px 6px';
        x.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); };
        box.appendChild(x);
        d.body.appendChild(box);
        (w.setTimeout || setTimeout)(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 15000);
      } catch (_) {}
    }

    function tell(keys) {
      var now = Date.now();
      if (now - (Number(w.__puQuotaToldAt) || 0) < TELL_GAP) return;
      w.__puQuotaToldAt = now;
      shown++;
      var top = usage().slice(0, 3).map(function (r) { return label(r.key) + ' ' + kb(r.chars); });
      var app = '';
      try { app = String((w.document && w.document.title) || '').split(/[|·—-]/)[0].trim(); } catch (_) {}
      /* ⚠ 크기(5MB 등)는 안 적는다 — 브라우저마다 다르다(크롬 약 5백만 자, 이 앱 창 브라우저는 5천만 자) */
      toast('⚠ 이 브라우저 저장 공간(푸른 통합 프로그램이 함께 씀)이 가득 차 '
        + (app ? '«' + app + '»의 ' : '') + '내용 일부를 이 PC에 저장하지 못했습니다. 관리자에게 알려 주세요.'
        + (top.length ? ' 큰 것: ' + top.join(' · ') : ''));
      try {
        if (w.console && w.console.warn) w.console.warn('[저장 공간] 이 PC에 못 적은 열쇠: ' + keys.join(', ')
          + ' — 큰 것: ' + usage().slice(0, 8).map(function (r) { return r.key + ' ' + kb(r.chars); }).join(', '));
      } catch (_) {}
    }

    function check() {
      timer = null;
      var keys = Object.keys(failed);
      failed = {};
      if (keys.length) tell(keys);
    }

    /* ── 차기 «전에» 알린다 (대표 지시 2026-10-08 「용량이 계속 차면 … 지우는 것 반복하지 않고 싶다」) ──
       ① 작은 칸(localStorage)이 60%, 큰 칸(IndexedDB 등)이 80% 를 넘으면
       ② 어느 앱이 작은 칸에 100KB 넘는 덩어리를 쓰면 — 다시 찬다면 원인은 이것 하나다(STATUS «되풀이된 실수» 11)
       → 관리자 «장애 알림»(js/pu-health.js 의 PUHealth.report → 서버 systemAlerts)에 올린다. 새 알림 길을 만들지 않는다.
       ⚠ 잔소리가 되지 않게 같은 알림은 «이 PC 에서 하루 한 번»(pu_storage_watch_v1 에 적어 둔다).
       ⚠ 알림에는 열쇠 이름·크기·화면 이름만 — 값(자료)은 안 싣는다.
       ⚠ 문턱 숫자는 «규칙»이다: 60% 면 아직 두 배 가까운 여유가 있어 «그 기능만 옮기기»를 할 시간이 있다. */
    var LS_LIMIT = 5242880;          // 크롬 localStorage 한도(글자) — 2026-10-07 대표 크롬이 5,242,346자에서 막혔다
    var WARN_LS = opts.warnLs != null ? opts.warnLs : 0.6;
    var WARN_BIG = opts.warnBig != null ? opts.warnBig : 0.8;
    var BIG_WRITE = opts.bigWrite != null ? opts.bigWrite : 100 * 1024;
    var WATCH_KEY = 'pu_storage_watch_v1';
    var bigNoted = {};
    function watchRead() { try { return JSON.parse(origGet.call(LS, WATCH_KEY) || '{}') || {}; } catch (_) { return {}; } }
    function watchWrite(o) { try { origSet.call(LS, WATCH_KEY, JSON.stringify(o)); } catch (_) {} }
    function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function pageName() { try { return String(w.location && w.location.pathname || '').split('/').pop() || 'enter.html'; } catch (_) { return ''; } }
    /* 오늘 이 PC 에서 처음이면 true — 그리고 «했다»를 적는다 */
    function firstToday(tag) {
      var o = watchRead(); o.told = o.told || {};
      if (o.told[tag] === today()) return false;
      o.told[tag] = today();
      watchWrite(o);
      return true;
    }
    function report(kind, message, detail) {
      try { if (w.console && w.console.warn) w.console.warn('[저장 공간] ' + message + ' — ' + detail); } catch (_) {}
      try { if (w.PUHealth && typeof w.PUHealth.report === 'function') w.PUHealth.report(kind, { message: message }, { detail: detail }); } catch (_) {}
    }
    function noteBigWrite(k, chars) {
      if (k === WATCH_KEY || bigNoted[k]) return;
      bigNoted[k] = 1;                                   // 한 화면에서는 한 번만 센다(저장마다 일하지 않게)
      var o = watchRead(); o.big = o.big || {};
      o.big[k] = { chars: chars, page: pageName(), at: Date.now() };
      watchWrite(o);
      if (firstToday('big:' + k)) {
        (w.setTimeout || setTimeout)(function () {
          report('storage-bigwrite', '저장 공간 미리 알림 — 작은 칸(localStorage)에 큰 덩어리: ' + label(k),
            kb(chars) + ' · ' + pageName() + ' · 이 기능은 큰 칸(js/pu-big-store.js)으로 옮길 것');
        }, 0);
      }
    }
    function checkPressure() {
      return storageInfo().then(function (info) {
        var out = { lsPct: info.lsChars / LS_LIMIT, bigPct: (info.quota ? info.usage / info.quota : null), told: [] };
        if (out.lsPct >= WARN_LS && firstToday('ls')) {
          out.told.push('ls');
          report('storage-pressure', '저장 공간 미리 알림 — 작은 칸(localStorage) ' + Math.round(WARN_LS * 100) + '% 넘음',
            Math.round(out.lsPct * 100) + '% · 큰 것: ' + usage().slice(0, 3).map(function (r) { return label(r.key) + ' ' + kb(r.chars); }).join(' · '));
        }
        if (out.bigPct != null && out.bigPct >= WARN_BIG && firstToday('idb')) {
          out.told.push('idb');
          report('storage-pressure', '저장 공간 미리 알림 — 큰 칸(IndexedDB 등) ' + Math.round(WARN_BIG * 100) + '% 넘음',
            Math.round(out.bigPct * 100) + '% · ' + kb(info.usage) + ' / ' + kb(info.quota) + ' · 이 PC 디스크 여유가 줄었는지 볼 것');
        }
        return out;
      }, function () { return null; });
    }

    S.prototype.setItem = function (k, v) {
      try {
        var r = origSet.apply(this, arguments);
        if (this === LS) {
          delete failed[String(k)];                      // 다시 적혔다 — 수습됐다
          var n = (typeof v === 'string') ? v.length : String(v).length;
          if (n > BIG_WRITE) noteBigWrite(String(k), n);
        }
        return r;
      } catch (e) {
        /* 공간 재기용 시험 쓰기(probe)는 «넘치는지 보려고» 일부러 크게 쓴다 — 알릴 일이 아니다 */
        if (this === LS && isQuota(e) && !/probe/i.test(String(k))) {
          failed[String(k)] = Date.now();
          if (!timer) timer = (w.setTimeout || setTimeout)(check, WAIT);
          try { if (w.dispatchEvent && w.CustomEvent) w.dispatchEvent(new w.CustomEvent('pu:ls-quota', { detail: { key: String(k) } })); } catch (_) {}
        }
        throw e;                                         // 부르는 쪽 처리는 예전 그대로
      }
    };
    S.prototype.removeItem = function (k) {
      if (this === LS) delete failed[String(k)];         // «없어도 되는» 것이라 비웠다
      return origRemove.apply(this, arguments);
    };

    /* ── «이 사이트 자료는 지우지 말라» (대표 지시 2026-10-07 「지우지 말라 … 안지워도 되게」) ──
       크롬은 디스크가 모자라면 오래 안 쓴 사이트의 IndexedDB 를 스스로 비울 수 있다(«지워도 되는» 칸).
       navigator.storage.persist() 로 «지우지 않는» 칸으로 바꿔 달라고 한다. 한 주소에 한 번 허락되면
       통합 프로그램 전부(같은 nabaho.github.io)가 함께 지켜진다.
       ⚠ 크롬은 묻는 창 없이 스스로 정한다(즐겨찾기·앱 설치·자주 씀이면 허락). 거절되면 다음에 열 때 또 청한다.
       2026-10-07 대표 크롬 실측: 이미 허락돼 있었다(persisted:true), 한도 약 10.8GB. */
    var persistState = null;
    function persist() {
      try {
        var st = w.navigator && w.navigator.storage;
        if (!st || typeof st.persisted !== 'function' || typeof st.persist !== 'function') return Promise.resolve(null);
        return st.persisted().then(function (p) { return p ? true : st.persist(); })
          .then(function (ok) { persistState = !!ok; return persistState; }, function () { return null; });
      } catch (_) { return Promise.resolve(null); }
    }
    /* 지금 얼마나 쓰고 얼마까지 되나 — 화면(이알피 저장 공간 칸)과 콘솔이 쓴다. 값(자료)은 안 본다 */
    function storageInfo() {
      var lsChars = usage().reduce(function (a, r) { return a + r.chars; }, 0);
      var st = w.navigator && w.navigator.storage;
      var est = (st && typeof st.estimate === 'function') ? st.estimate().catch(function () { return null; }) : Promise.resolve(null);
      var per = (st && typeof st.persisted === 'function') ? st.persisted().catch(function () { return null; }) : Promise.resolve(null);
      return Promise.all([est, per]).then(function (r) {
        return { lsChars: lsChars, usage: r[0] ? r[0].usage : null, quota: r[0] ? r[0].quota : null, persisted: r[1] };
      });
    }
    var persisting = persist();
    /* 켠 뒤 잠시 있다가 한 번 잰다 — 화면 뜨는 길을 비켜서(로그인·첫 동기화 뒤). 하루 한 번만 알린다(firstToday) */
    if (opts.pressureDelay !== false) {
      (w.setTimeout || setTimeout)(function () { checkPressure(); }, opts.pressureDelay || 20000);
    }

    var api = {
      usage: usage,
      label: label,
      persist: persist,
      persisting: persisting,
      persisted: function () { return persistState; },
      storageInfo: storageInfo,
      checkPressure: checkPressure,
      /* 이 PC 에서 본 큰 덩어리 기록 — 이알피 시스템 헬스가 보여 준다(열쇠 이름·크기·화면만) */
      watch: function () { return watchRead(); },
      shownCount: function () { return shown; },
      _check: check
    };
    w.PuLsGuard = api;
    return api;
  }

  return { install: install, isQuota: isQuota, label: label };
});
