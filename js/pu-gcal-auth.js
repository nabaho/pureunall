/* 구글에 «쓰는» 길 — 로그인과 API 부르기를 한 곳에서 (2026-09-20)
   ────────────────────────────────────────────────────────────────────────
   구글 달력을 «읽는» 것은 열쇠(API key) 하나로 된다. 그러나 «지우고 고치는» 것은
   그 사람 자격으로 해야 해서 구글 로그인(OAuth)이 필요하다.

   ★ 왜 파일로 뺐나 (캘린더를 한 곳으로 모으기 3걸음-나)
     이 길이 이알피의 «법인 대시보드 안»에만 있었다. 4걸음에서 그 화면을 걷어내면
     두 가지가 함께 죽는다 —
       ① 우리 일정을 지울 때 구글 쪽 일정도 지우는 일(지금 이어진 근태가 30건이다)
       ② 보수총액신고 «Gmail 자동발송» — 같은 토큰을 빌려 쓰고 있었다
     ②는 달력과 아무 상관없는 기능인데 달력 화면에 얹혀 있었다. 그래서 토큰을 받아
     두는 자리까지 통째로 여기로 옮긴다.

   ★ 지켜야 할 것 — 이알피가 데어 가며 얻은 규칙들(tests/erp-gcal-guard)
     ① 로그인 전에는 «아예 부르지 않는다» — 'Bearer undefined' 가 나가면
        아무 말 없이 실패한다
     ② 401·404 의 «본문»을 자료인 척 넘기지 않는다 — 넘기면 부른 쪽이 성공으로
        읽어 「🗑️ 삭제됨」 같은 거짓말을 한다
     ③ 200 인데 본문에 error 가 있으면 «실패»다
     ④ 204(지움)는 본문이 없어도 «성공»이다
     ⑤ 토큰이 살아 있는지는 «한 곳»에서 본다(만료 1분 전부터는 죽은 것으로)
     ⑦ 답이 안 오면 20초에 끊는다 — 이알피의 fetchT 가 하던 일이다. 안 끊으면
        「지우는 중…」이 영영 안 끝나고 사람은 지워졌는지 아닌지 모른다

   ⚠ 되돌아올 주소(redirect_uri)는 구글 콘솔에 «등록된 것»이어야 한다.
     등록 안 된 주소로 보내면 구글이 redirect_uri_mismatch 로 막는다.
     새 화면에서 로그인을 쓰려면 그 화면 주소를 콘솔에 먼저 넣어야 한다.

   tests/gcal-auth.test.js 가 위 다섯을 하나씩 되돌려 보며 지킨다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuGcalAuth = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BASE = 'https://www.googleapis.com/calendar/v3';
  /* 이알피의 fetchT 와 같은 20초 — 밖으로 나가는 부름은 끊을 수 있어야 한다 */
  var TIMEOUT_MS = 20000;
  /* 토큰은 «창»에 둔다 — 이알피가 그렇게 써 왔고, 두 화면이 같은 창을 본다.
     ⚠ 저장소에 넣지 않는다. 남의 PC 에 남으면 그 사람 자격이 남는다. */
  function store() { return (typeof window !== 'undefined') ? window : globalThis; }

  /* ⑤ 살아 있는 토큰이 있나 — 만료 1분 전부터는 «없는 것»으로 본다
     (부르는 도중에 만료되면 그 부름이 통째로 버려진다) */
  function hasToken() {
    var w = store();
    return !!(w._gcalToken && Date.now() < ((w._gcalExpiry || 0) - 60000));
  }
  function token() { return hasToken() ? store()._gcalToken : ''; }

  /* 구글에서 돌아왔을 때 주소 꼬리(#access_token=…)에서 토큰을 꺼낸다.
     받았으면 true. 주소는 깨끗이 지운다 — 토큰이 주소창·방문기록에 남지 않게. */
  function capture(loc, hist) {
    var w = store();
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc || !loc.hash || loc.hash.indexOf('access_token=') < 0) return false;
    try {
      var p = new URLSearchParams(loc.hash.replace('#', '?').slice(1));
      var tok = p.get('access_token');
      if (!tok) return false;
      var exp = parseInt(p.get('expires_in') || '3600', 10);
      w._gcalToken = tok;
      w._gcalExpiry = Date.now() + exp * 1000;
      hist = hist || (typeof history !== 'undefined' ? history : null);
      if (hist && hist.replaceState) hist.replaceState(null, '', loc.pathname);
      return true;
    } catch (e) { return false; }
  }

  /* 구글 로그인 화면으로 보낸다.
     ⚠ redirect 는 «구글 콘솔에 등록된» 주소여야 한다. 지금 주소를 그대로 쓰되,
       https 가 아니면(로컬에서 열었을 때) 등록해 둔 배포 주소로 보낸다. */
  function signInUrl(opt) {
    var o = opt || {};
    var loc = o.location || (typeof location !== 'undefined' ? location : {});
    var redirect = (loc.protocol === 'https:')
      ? String(loc.origin + loc.pathname).replace(/\/+$/, '')
      : o.fallbackRedirect;
    return 'https://accounts.google.com/o/oauth2/v2/auth?'
      + 'client_id=' + encodeURIComponent(o.clientId)
      + '&redirect_uri=' + encodeURIComponent(redirect)
      + '&response_type=token'
      + '&scope=' + encodeURIComponent(o.scope)
      + '&include_granted_scopes=true';
  }

  /* 구글 달력 API 를 부른다 — 성공하면 값을, 실패하면 «거절»한다.
     ⚠ 실패를 값으로 돌려주지 않는다(②). 부른 쪽이 then 만 쓰면 성공한 줄 안다. */
  function apiCall(method, path, body, opt) {
    var o = opt || {};
    if (!hasToken()) {
      return Promise.reject(new Error('구글 로그인이 필요합니다'));
    }
    var f = o.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.reject(new Error('부를 길이 없습니다'));
    var 보낼것 = {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    };
    /* ⑦ 시간 제한 — 답이 안 오면 끊는다.
       ⚠ 이알피는 밖으로 나가는 부름을 모두 fetchT(20초)로 감쌌다. 이리로 옮기면서
         그 울타리를 벗어났다 — 여기서 다시 세운다. 안 세우면 구글이 대답을 안 할 때
         「지우는 중…」이 영영 안 끝나고, 사람은 지워졌는지 아닌지 모른 채 기다린다.
       ⚠ 끊긴 것은 «실패»다 — 값으로 넘기지 않는다(②와 같은 까닭). */
    var 제한 = o.timeoutMs || TIMEOUT_MS;
    var 끊개 = (typeof AbortController !== 'undefined' && 제한) ? new AbortController() : null;
    var 시계 = null;
    if (끊개) {
      보낼것.signal = 끊개.signal;
      시계 = setTimeout(function () { 끊개.abort(); }, 제한);
    }
    var 끄기 = function () { if (시계) { clearTimeout(시계); 시계 = null; } };
    return f(BASE + path, 보낼것).then(function (r) {
      끄기();
      return r;
    }, function (e) {
      끄기();
      if (e && e.name === 'AbortError') {
        throw new Error(Math.round(제한 / 1000) + '초 안에 구글이 답하지 않았습니다');
      }
      throw e;
    }).then(function (r) {
      if (r.status === 204) return {};                        /* ④ 지웠다 — 본문이 없다 */
      return r.json().then(function (j) {
        /* ③ 200 인데 본문에 error 가 있어도 실패다 */
        if (!r.ok || (j && j.error)) {
          throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
        }
        return j;
      }, function () {
        if (!r.ok) throw new Error('HTTP ' + r.status);       /* ⑥ 본문을 못 읽어도 상태는 알린다 */
        return {};
      });
    });
  }

  /* 구글 일정을 «다른 날로» 옮긴다 (2026-09-21, 끌어 옮기기).
     ★ 먼저 그 일정을 받아 와야 한다 — 시각을 그대로 두고 «날짜만» 바꾸려면
       지금 몇 시인지 알아야 하기 때문이다. 종일 일정이면 날짜만 있다.
     ⚠ 종일 일정의 end 는 «다음 날»이다(구글 규칙). 하루 더해 주지 않으면
       옮긴 일정이 길이 0 이 되어 화면에서 사라진다.
     ⚠ 참석자에게 알림을 보내지 않는다(sendUpdates=none) — 우리가 자리를 옮긴 것을
       바깥 사람에게 일일이 알릴 일이 아니다. */
  function moveEvent(calId, eventId, newDate, opt) {
    if (!calId || !eventId) return Promise.reject(new Error('옮길 일정을 찾지 못했습니다'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(newDate || ''))) {
      return Promise.reject(new Error('옮길 날짜가 올바르지 않습니다'));
    }
    var 길 = '/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(eventId);
    return apiCall('GET', 길, null, opt).then(function (ev) {
      if (!ev || !ev.start) throw new Error('구글에서 그 일정을 찾지 못했습니다');
      var 고칠것;
      if (ev.start.date) {
        고칠것 = { start: { date: newDate }, end: { date: addDay(newDate) } };
      } else {
        var s = ev.start.dateTime ? String(ev.start.dateTime).slice(11, 16) : '09:00';
        var e = (ev.end && ev.end.dateTime) ? String(ev.end.dateTime).slice(11, 16) : '10:00';
        고칠것 = {
          start: { dateTime: newDate + 'T' + s + ':00', timeZone: 'Asia/Seoul' },
          end: { dateTime: newDate + 'T' + e + ':00', timeZone: 'Asia/Seoul' }
        };
      }
      return apiCall('PATCH', 길 + '?sendUpdates=none', 고칠것, opt);
    }).then(function (r) {
      if (!r || !r.id) throw new Error('구글이 옮겼다고 대답하지 않았습니다');
      return { moved: true, id: r.id };
    });
  }
  /* 종일 일정의 끝날 — 하루 뒤. UTC 로만 센다(지역 시간이면 하루 밀린다). */
  function addDay(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + 86400000);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2)
      + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  /* 이어진 구글 일정을 지운다. 이어진 것이 없으면 «할 일이 없다»(성공으로 본다). */
  function deleteEvent(calId, eventId, opt) {
    if (!eventId || !calId) return Promise.resolve({ skipped: true });
    return apiCall('DELETE',
      '/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(eventId)
      + '?sendUpdates=none', null, opt)
      .then(function () { return { deleted: true }; });
  }

  return {
    hasToken: hasToken, token: token, capture: capture,
    signInUrl: signInUrl, apiCall: apiCall, deleteEvent: deleteEvent, moveEvent: moveEvent
  };
});
