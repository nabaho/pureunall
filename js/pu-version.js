/* Pureunall deployed-version watcher. Applies verified releases automatically while idle. */
(function (window) {
  'use strict';
  if (!window || !window.document || window.PUVersion) return;
  var CHECK_MS = 5 * 60 * 1000;
  var SESSION_KEY = 'pu_loaded_release_v1';
  /* 갈아타기를 한 번 했는데도 옛 코드가 오면 «그만둔다» — 안 그러면 무한히 새로 연다 */
  var APPLIED_KEY = 'pu_applied_release_v1';
  var NOTICE_KEY = 'pu_updated_notice_v1';
  var IDLE_MS = 30 * 1000;
  /* 새 판이 나오는지 두드려 보는 횟수와 간격 (3·6·12·24초 — 다 해서 45초쯤) */
  var PROBE_TRIES = 4;
  var PROBE_WAIT_MS = 3000;
  var checking = false;
  var pendingVersion = null;
  var applyTimer = null;
  var lastActivity = Date.now();
  var saveBlocked = false;

  /* ══ 부팅 폭풍 감지 (대표 제보 2026-09-17 「계속 돈이 새고 있다」) ══════════════════
     ■ 무엇이 있었나
       서버 통신 기록(database:profile 165초)에 이알피 8번·기업정보함 9번·업무관리 8번이
       «처음부터 다시 켜진» 자국이 있었다 — 한 PC, 약 20초마다. 켤 때마다 자문수입 917KB·
       명함 색인 1.2MB·업무 3.3MB 를 전부 다시 받으니 시간당 500MB(≈₩700)가 나갔고,
       화면은 그때마다 얼어붙어 «깜빡임»으로 보였다. 새벽에도 같은 자국이 있었다.
       서버 쪽 판 표식(version.json·ETag·pu-release)은 모두 안정이었다 — 즉 «바깥»에서
       탭을 되풀이 새로고침하는 무언가(확장·탭 돌리기·자동 새로고침)가 있을 가능성이 크다.
     ■ 여기서 하는 일 — 추측하지 않고 «앱이 스스로 말하게» 한다
       같은 탭에서 이어지는 sessionStorage 에 부팅 시각을 남겨, 3분 안에 3번 넘게 켜지면
       ① 콘솔에 «직전 부팅에서 몇 초·새로고침 종류(reload/navigate)·어디서 왔나»를 찍고
       ② 화면 위에 띠를 띄워 사람에게 알린다(원인이 바깥이면 사람만 끌 수 있다)
       ③ window.PU_BOOT.storm 을 세워 앱이 «무거운 받기를 멈출» 근거로 쓴다(이알피가 쓴다).
     ⚠ 이 파일은 모든 앱이 싣는다 — 여기 한 곳에 두면 전부에 붙는다. 실패해도 앱을 세우지
       않게 전부 try 로 감싼다.
     ⚠ navigation type 이 'reload' 면 브라우저·확장이 새로고침한 것, 'navigate' 인데 온 곳이
       우리 화면이면 앱 코드가 다시 연 것이다 — 이 한 글자가 원인의 «안팎»을 가른다. */
  var BOOT_KEY = 'pu_boot_log_v1';
  var BOOT_STORM_N = 3, BOOT_STORM_MS = 3 * 60 * 1000;
  function bootNavType() {
    try { var e = window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]; return (e && e.type) || ''; } catch (_) { return ''; }
  }
  function noteBoot() {
    try {
      var now = Date.now(), arr = [];
      try { arr = JSON.parse(window.sessionStorage.getItem(BOOT_KEY) || '[]'); } catch (_) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr = arr.filter(function (t) { return typeof t === 'number' && now - t < BOOT_STORM_MS; });
      var prev = arr.length ? arr[arr.length - 1] : 0;
      arr.push(now);
      try { window.sessionStorage.setItem(BOOT_KEY, JSON.stringify(arr.slice(-12))); } catch (_) {}
      var nav = bootNavType();
      var since = prev ? Math.round((now - prev) / 1000) : null;
      var from = '';
      try { from = window.document.referrer ? window.document.referrer.replace(window.location.origin, '') : ''; } catch (_) {}
      var storm = arr.length >= BOOT_STORM_N;
      window.PU_BOOT = { count: arr.length, since: since, type: nav, from: from, storm: storm };
      if (window.console && console.info) {
        console.info('[부팅] ' + (nav || '?') + (since != null ? ' · 직전 부팅에서 ' + since + '초' : ' · 이 탭의 첫 부팅')
          + ' · 이 탭에서 3분 안 ' + arr.length + '번' + (from ? ' · 온 곳 ' + from : ''));
      }
      if (storm) {
        if (window.console && console.warn) {
          console.warn('★★ 이 탭이 3분 안에 ' + arr.length + '번 다시 켜졌습니다 (' + (nav === 'reload' ? '브라우저·확장이 새로고침' : nav === 'navigate' ? '주소로 다시 열림' : nav || '종류 모름') + ').'
            + ' 켤 때마다 자료를 전부 다시 받아 요금이 나갑니다 — 자동 새로고침 확장·탭 돌리기를 확인하세요.');
        }
        mountStormBanner(arr.length, since, nav);
      }
    } catch (_) {}
  }
  function mountStormBanner(n, since, nav) {
    function mount() {
      try {
        if (!window.document.body || window.document.getElementById('pu-boot-storm')) return;
        var bar = window.document.createElement('div');
        bar.id = 'pu-boot-storm';
        bar.setAttribute('role', 'alert');
        bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483646;background:#991b1b;color:#fff;' +
          'padding:9px 14px;font:700 13px/1.45 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
        var msg = window.document.createElement('span');
        msg.style.cssText = 'flex:1;min-width:0';
        msg.textContent = '⚠ 이 탭이 3분 안에 ' + n + '번 다시 켜졌습니다' + (since != null ? ' (마지막은 ' + since + '초 전, ' + (nav === 'reload' ? '브라우저·확장이 새로고침' : '주소로 다시 열림') + ')' : '') +
          '. 켤 때마다 자료를 전부 다시 받아 요금이 나갑니다 — 브라우저의 자동 새로고침 확장이나 탭 돌리기를 꺼 주세요.';
        var x = window.document.createElement('span');
        x.setAttribute('role', 'button'); x.tabIndex = 0;
        x.textContent = '닫기';
        x.style.cssText = 'flex:none;cursor:pointer;background:rgba(255,255,255,.18);border-radius:6px;padding:4px 10px;';
        x.addEventListener('click', function () { if (bar.parentNode) bar.parentNode.removeChild(bar); });
        bar.appendChild(msg); bar.appendChild(x);
        window.document.body.appendChild(bar);
      } catch (_) {}
    }
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  }

  /* 배포할 때 scripts/write-version.js 가 <head> 에 찍어 둔다. 로컬에는 없다. */
  function docRelease() {
    try {
      var m = window.document.querySelector('meta[name="pu-release"]');
      var v = m && m.getAttribute('content');
      return (v && v !== 'local') ? v : '';
    } catch (_) { return ''; }
  }

  function versionUrl() {
    var script = Array.prototype.slice.call(window.document.scripts).find(function (item) { return /(?:^|\/)pu-version\.js(?:\?|$)/.test(item.src || ''); });
    return new URL('../version.json', script && script.src || window.location.href).toString();
  }

  function showUpdatedNotice() {
    var shouldShow = false;
    try {
      shouldShow = window.sessionStorage.getItem(NOTICE_KEY) === '1';
      if (shouldShow) window.sessionStorage.removeItem(NOTICE_KEY);
    } catch (_) {}
    if (!shouldShow) return;
    function mount() {
      if (!window.document.body) return;
      var notice = window.document.createElement('div');
      notice.id = 'pu-version-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = '새 버전으로 업데이트되었습니다';
      notice.style.cssText = 'position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 24px);box-sizing:border-box;padding:10px 15px;border-radius:999px;background:#18794e;color:#fff;box-shadow:0 8px 28px #0004;font:800 13px/1.3 system-ui,sans-serif;white-space:nowrap;';
      window.document.body.appendChild(notice);
      window.setTimeout(function () { if (notice.parentNode) notice.parentNode.removeChild(notice); }, 1000);
    }
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  }

  /* 실제로 갈아끼우는 부분 — 기다렸다 하는 길(applyWhenIdle)과 사람이 눌러서
     바로 하는 길(applyNow)이 함께 쓴다. 한 곳에 둬야 한쪽만 고치는 일이 없다. */
  /* ── 갈아타기 전에 «그 판이 실제로 나오는지» 두드려 본다 (대표 제보 2026-08-24) ──
     ★ 무슨 일이 있었나
       새 판이 올라오면 이 코드가 곧바로 화면을 새로 열었다(?v=새커밋). 그런데
       깃허브 페이지는 배포를 «갈아 끼우는 동안» 잠깐 오류를 낸다. 하필 그 틈에
       열면 깃허브 오류 화면(분홍 유니콘)이 뜨고, 거기서는 우리 코드가 아예 안 도니
       «스스로 빠져나올 수가 없다» — 사람이 직접 새로고침해야 했다.
       (2026-08-24 오후 4:34, PR #397 배포 직후 실제로 그랬다)
     ★ 그래서: 먼저 한 번 받아 보고, 제대로 나올 때만 옮겨 간다.
       안 나오면 3·6·12·24초 뒤 다시 두드린다. 그래도 안 되면 «그냥 있던 화면에
       머문다» — 옛 판이라도 도는 화면이, 갇힌 오류 화면보다 낫다.
     ⚠ cache 를 끄지 않는다. 여기서 받아 둔 것을 곧바로 이어지는 이동이 다시 쓴다
       (끄면 같은 파일을 두 번 받는다). */
  function probeThenGo(target, tries) {
    window.fetch(target, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('not ready ' + r.status);
      window.location.replace(target);
    }).catch(function () {
      if (tries >= PROBE_TRIES) return;              // 조용히 물러선다 — 화면은 그대로 돈다
      window.setTimeout(function () { probeThenGo(target, tries + 1); },
        PROBE_WAIT_MS * Math.pow(2, tries));
    });
  }

  function doApply(version) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, version.sha);
      window.sessionStorage.setItem(APPLIED_KEY, version.sha);
      window.sessionStorage.setItem(NOTICE_KEY, '1');
    } catch (_) {}
    var url = new URL(window.location.href);
    url.searchParams.set('v', version.shortSha || String(version.sha).slice(0, 8));
    var target = url.toString();
    /* fetch 가 없는 아주 옛 브라우저에서는 예전처럼 그냥 간다 */
    if (typeof window.fetch !== 'function') { window.location.replace(target); return; }
    probeThenGo(target, 0);
  }

  function applyWhenIdle() {
    if (!pendingVersion) return;
    if (saveBlocked || Date.now() - lastActivity < IDLE_MS) {
      applyTimer = window.setTimeout(applyWhenIdle, 5000);
      return;
    }
    var version = pendingVersion;
    pendingVersion = null;
    doApply(version);
  }

  /* 사람이 「새로보기」를 눌렀을 때 — 손을 놓기를 기다리지 않고 곧바로 간다.
     ⚠ 저장 중일 때만은 예외다. 저장이 끝나기 전에 새로 열면 쓰던 것이 날아간다.
        그때는 예약만 해 두고(원래 길이 이어받는다) 거짓을 돌려준다. */
  function applyNow() {
    if (!pendingVersion || saveBlocked) return false;
    var version = pendingVersion;
    pendingVersion = null;
    doApply(version);
    return true;
  }

  function scheduleApply(version) {
    pendingVersion = version;
    if (applyTimer) window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(applyWhenIdle, 1000);
  }

  function check() {
    if (checking) return Promise.resolve(false);
    checking = true;
    return window.fetch(versionUrl() + '?t=' + Date.now(), { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('version unavailable');
      return response.json();
    }).then(function (version) {
      if (!version || !version.sha) return false;
      /* ── 「내가 지금 무슨 판인가」는 문서에 찍힌 것이 진짜다 ──
         (대표 보고 2026-08-17 "피시에서는 업데이트되었는데 폰에서는 안 된다")
         예전에는 sessionStorage 만 봤다. 그런데 **새 탭은 그게 비어 있고**,
         그때 서버가 말하는 판을 그대로 「내 판」으로 적어 버렸다. 그래서 폰이
         캐시에 있던 **옛 화면**을 열어도 단추는 「최신」이라고 답했다 —
         옛 코드를 돌리면서 최신이라고 적힌 화면이 그것이다.
         배포할 때 찍어 두는 <meta name="pu-release"> 를 먼저 본다. */
      var stamped = docRelease();
      if (stamped) {
        try { window.sessionStorage.setItem(SESSION_KEY, stamped); } catch (_) {}
        if (stamped === version.sha) return false;          // 진짜 최신
        /* 이미 이 판으로 갈아탔는데도 옛 코드가 온다 = 브라우저·CDN 이 옛 파일을
           준다. 여기서 또 새로 열면 **무한 고리**가 된다 — 자동으로는 그만두고
           단추만 띄운다(사람이 누르면 그때 간다). */
        var applied = '';
        try { applied = window.sessionStorage.getItem(APPLIED_KEY) || ''; } catch (_) {}
        if (applied === version.sha) { pendingVersion = version; return true; }
        scheduleApply(version);
        return true;
      }
      /* 찍힌 것이 없으면(로컬에서 열어 볼 때) 예전 방식 그대로 */
      var loaded = '';
      try { loaded = window.sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) {}
      if (!loaded) {
        try { window.sessionStorage.setItem(SESSION_KEY, version.sha); } catch (_) {}
        return false;
      }
      if (loaded !== version.sha) { scheduleApply(version); return true; }
      return false;
    }).catch(function () { return false; }).then(function (result) { checking = false; return result; });
  }

  ['pointerdown', 'keydown', 'input'].forEach(function (name) {
    window.addEventListener(name, function () { lastActivity = Date.now(); }, { passive: true });
  });
  /* ── 어떤 저장 상태가 갈아타기를 막는가 ──
     2026-08-16 교착: 저장 오류가 폭주하면 「다시 시도·대기줄」 신호가 쉼 없이 이어져
     saveBlocked 가 «영원히» 켜진 채였다 — 그래서 옛 탭이 몇 시간째 새 버전으로 못
     갈아탔고, 그 새 버전이 바로 폭주를 고치는 코드였다. 서로 물고 있는 교착이다.
     ⚠ 'queued'(대기줄에 넣음)는 막지 않는다 — 대기줄은 localStorage 에 있어 화면을
       새로 열어도 «그대로 남아 다시 나간다». 막을 이유가 애초에 없었다.
     ⚠ 'saving'/'retrying' 도 3분 넘게 이어지면 놓아 준다 — 3분째 안 끝난 저장은
       앞으로도 안 끝난다. 실패하면 어차피 대기줄로 가고, 대기줄은 살아남는다. */
  var BLOCK_MAX_MS = 3 * 60 * 1000;
  var blockedSince = 0;
  function isBlockingState(state) { return state === 'saving' || state === 'retrying'; }
  function blockedTooLong(since, now, max) { return !!since && (now - since) >= max; }
  window.addEventListener('pu:save-state', function (event) {
    var state = event.detail && event.detail.state;
    var wantBlock = isBlockingState(state);
    if (wantBlock && blockedTooLong(blockedSince, Date.now(), BLOCK_MAX_MS)) wantBlock = false;
    if (wantBlock && !blockedSince) blockedSince = Date.now();
    if (!wantBlock) blockedSince = 0;
    saveBlocked = wantBlock;
    if (!saveBlocked && pendingVersion) scheduleApply(pendingVersion);
  });

  /* ══════ 「새로보기」 단추 (대표 지시 2026-08-09) ══════
     자동 갈아끼우기는 원래 있었지만 **대표님이 그걸 알 수도, 재촉할 수도 없었다.**
     "업데이트 된 거 확인할 수 있게" 라는 말씀이 그 뜻이다. 보이게만 만든다.

     ⚠ 앱마다 만들지 않고 여기 한 곳에 둔다 — 이 파일을 사진첩·기업정보함·이알피·
        업무관리·기금이 모두 싣는다. 한 번 넣으면 전부에 붙는다.
     ⚠ 자리: 오른쪽 아래인데 **조금 위(96px)** 다. 그 아래는 이미 붐빈다 —
        기업정보함 ＋ 단추, 포털 📷 단추가 바닥에 붙어 있다. */
  var fab = null, fabState = '', pressTimer = null, longFired = false;

  function shortOf(sha) { return String(sha || '').slice(0, 8); }
  function loadedSha() {
    try { return window.sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  function setFab(state, text) {
    if (!fab) return;
    fabState = state;
    var color = state === 'has' ? '#1e40af' : (state === 'busy' ? '#64748b' : '#15803d');
    var bg = state === 'has' ? '#1e40af' : 'rgba(255,255,255,.94)';
    var fg = state === 'has' ? '#fff' : '#475569';
    fab.style.background = bg;
    fab.style.color = fg;
    fab.style.borderColor = state === 'has' ? '#1e40af' : 'rgba(10,20,60,.16)';
    fab.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;flex:none;background:' +
      (state === 'has' ? '#fde047' : color) + '"></span><span>' + text + '</span>';
  }

  function onPress() {
    if (longFired) { longFired = false; return; }
    if (fabState === 'busy') return;
    setFab('busy', '확인 중…');
    check().then(function (hasNew) {
      if (hasNew) {
        setFab('has', '새 버전 · 여는 중');
        if (!applyNow()) setFab('has', '저장 끝나면 바로');   // 저장 중이면 기다린다
        return;
      }
      setFab('ok', '최신입니다');
      window.setTimeout(function () { if (fabState === 'ok') setFab('ok', '최신'); }, 1600);
    }).catch(function () {
      setFab('ok', '확인 실패');
      window.setTimeout(function () { if (fabState === 'ok') setFab('ok', '최신'); }, 1600);
    });
  }

  /* 길게 누르면 지금 버전을 보여 준다 — 문제 생겼을 때 알려주시기 좋게 */
  function onLong() {
    longFired = true;
    var sha = shortOf(loadedSha());
    setFab(fabState === 'has' ? 'has' : 'ok', sha ? '지금 ' + sha : '버전 모름');
    window.setTimeout(function () { if (!pendingVersion) setFab('ok', '최신'); else setFab('has', '새 버전 있음'); }, 2500);
  }

  function mountFab() {
    if (fab || !window.document.body) return;
    fab = window.document.createElement('button');
    fab.id = 'pu-version-fab';
    fab.type = 'button';
    fab.title = '새로보기 — 눌러서 최신인지 확인 (길게 누르면 지금 버전)';
    fab.setAttribute('aria-label', '새로보기');
    fab.style.cssText = 'position:fixed;right:14px;bottom:96px;z-index:2147483000;' +
      'display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(10,20,60,.16);' +
      'border-radius:999px;padding:6px 12px;font:800 11.5px/1.3 system-ui,-apple-system,sans-serif;' +
      'cursor:pointer;box-shadow:0 3px 10px rgba(20,30,80,.14);backdrop-filter:blur(8px);' +
      '-webkit-backdrop-filter:blur(8px);white-space:nowrap;';
    fab.addEventListener('click', onPress);
    fab.addEventListener('pointerdown', function () {
      longFired = false;
      pressTimer = window.setTimeout(onLong, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) {
      fab.addEventListener(n, function () { if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = null; } });
    });
    fab.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.document.body.appendChild(fab);
    setFab('ok', '최신');
  }

  function mountWhenReady() {
    if (window.document.readyState === 'loading') {
      window.document.addEventListener('DOMContentLoaded', mountFab, { once: true });
    } else mountFab();
  }

  window.PUVersion = { check: check, applyNow: applyNow, _url: versionUrl, _noteBoot: noteBoot };
  noteBoot();
  showUpdatedNotice();
  mountWhenReady();
  /* 저절로 새 버전을 찾았을 때도 단추가 알려 준다 — 누르지 않아도 눈에 띈다 */
  check().then(function (hasNew) { if (hasNew) setFab('has', '새 버전 있음 · 누르기'); });
  /* 뒤에서 도는 확인도 단추에 반영한다 — 안 그러면 「최신」이라고 적힌 채
     저절로 새 버전이 잡혀 화면이 바뀌어 버린다(무슨 일인지 알 수 없다). */
  function bgCheck() {
    return check().then(function (hasNew) {
      if (hasNew && fabState !== 'busy') setFab('has', '새 버전 있음 · 누르기');
      return hasNew;
    });
  }
  window.setInterval(bgCheck, CHECK_MS);
  window.addEventListener('focus', bgCheck);
})(typeof window !== 'undefined' ? window : null);
