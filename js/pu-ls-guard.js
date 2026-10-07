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
      toast('⚠ 이 브라우저 저장 공간(통합 프로그램이 함께 쓰는 약 5MB)이 가득 차 '
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

    S.prototype.setItem = function (k, v) {
      try {
        var r = origSet.apply(this, arguments);
        if (this === LS) delete failed[String(k)];       // 다시 적혔다 — 수습됐다
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

    var api = {
      usage: usage,
      label: label,
      shownCount: function () { return shown; },
      _check: check
    };
    w.PuLsGuard = api;
    return api;
  }

  return { install: install, isQuota: isQuota, label: label };
});
