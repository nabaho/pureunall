/* 카카오로 로그인 — 화면 쪽
   ─────────────────────────────────────────────────────────────────────────
   ★ 여기서 하는 일은 «심부름» 뿐이다. 진짜 판단은 서버(functions/kakao.js)가 한다 —
     카카오가 준 인가코드를 화면이 직접 풀지 않고, 서버가 카카오 서버에 다시 물어 확인한다.
   ★ 지문(js/pu-passkey.js)과 같은 짜임 — 심부름 함수 이름·모양을 그대로 따른다. */
(function (global) {
  'use strict';

  var BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net';
  var STATE_KEY = 'pu_kakao_state';   // 로그인 중인지 연결 중인지 · 되돌아올 화면(sessionStorage, 새로고침엔 죽어도 됨)

  /* 서버가 «JSON 이 아닌» 답을 보냈을 때 — 지문과 같은 말투로 왜 그런지 말해 준다. */
  function whyNotJson(path, st, text) {
    var head = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    var why =
      st === 404 ? '서버에 이 기능이 아직 올라가지 않았습니다 (배포가 필요합니다)' :
      st === 403 ? '서버가 요청을 막았습니다' :
      st === 401 ? '서버가 로그인을 요구했습니다' :
      (st >= 500) ? '서버에서 오류가 났습니다' :
      st === 0 ? '서버에 닿지 못했습니다' :
      '서버가 알 수 없는 답을 보냈습니다';
    return why + ' [' + path + ' ' + (st || '연결실패') + (head ? ' · ' + head : '') + ']';
  }

  function call(path, opts, body, idToken) {
    var method = (opts && opts.method) || 'POST';
    /* 본문 없는 GET 에 JSON 헤더를 붙이면 브라우저가 OPTIONS 사전 요청을 보낸다.
       카카오 주소를 받는 첫 단계는 GET 한 번이면 된다. POST 의 JSON·인증 헤더는 유지한다. */
    var headers = method === 'GET' ? {} : { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = 'Bearer ' + idToken;
    var qs = (opts && opts.query) ? ('?' + opts.query) : '';
    var st = 0;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 10000) : 0;
    return fetch(BASE + '/' + path + qs, {
      method: method, headers: headers, body: method === 'GET' ? undefined : JSON.stringify(body || {}),
      signal: ctl ? ctl.signal : undefined
    }).catch(function (e) {
      throw new Error(e && e.name === 'AbortError' ? '카카오 서버 응답이 늦습니다 — 다시 시도해 주세요' : whyNotJson(path, 0, (e && e.message) || ''));
    }).then(function (r) {
      st = r.status;
      return r.text();
    }).then(function (t) {
      var j = null;
      try { j = JSON.parse(t); } catch (e) { /* 아래에서 까닭을 말한다 */ }
      if (!j) throw new Error(whyNotJson(path, st, t));
      if (!j.ok) { var e = new Error(j.error || '실패했습니다'); e.needLink = j.needLink === true; throw e; }
      return j;
    }).finally(function(){ if(timer) clearTimeout(timer); });
  }

  /* 카카오로 보내기 전에 「무엇을 하려던 참이었나」를 남겨 둔다 — 카카오는 우리 화면을
     완전히 떠났다 돌아오는 것이라, 돌아온 뒤 자바스크립트 상태가 하나도 안 남는다.
     ⚠ sessionStorage 다 — 새 탭·새로고침에 죽어도 된다(다시 누르면 그만이다). */
  function goToKakao(mode, sid, ask) {
    /* state 는 서버가 서명해 만들고, 실제 code 교환 때 서버가 1회 사용을 기록한다.
       화면에서만 비교하면 함수 주소를 직접 부르는 요청은 검사를 건너뛸 수 있다. */
    var q = 'mode=' + encodeURIComponent(mode) + (ask ? '&prompt=login' : '');
    return call('kakaoAuthUrl', { method: 'GET', query: q }).then(function (j) {
      if (!j.state || !/^(login|link)\.\d{13}\.[A-Za-z0-9_-]{30,40}\.[A-Za-z0-9_-]{40,50}$/.test(String(j.state))) {
        throw new Error('카카오 요청번호를 받지 못했습니다');
      }
      try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ mode: mode, sid: sid || '', nonce: j.state, at: Date.now() })); } catch (e) {}
      global.location.href = j.url;
    });
  }
  /* 로그인 화면에서 — 아직 아무도 로그인하지 않은 상태로 카카오에 간다.
     opts.ask 가 참이면 카카오가 «이미 로그인돼 있어도» 다시 묻는다 — 처음 쓰는 기기(공용 PC 등)에서
     브라우저에 남은 남의 카카오 로그인으로 들어가지 않게 한다(2026-09-28). */
  function goLogin(opts) { warm(); return goToKakao('login', '', !!(opts && opts.ask)); }
  /* 로그인 서버 «미리 깨우기» (2026-09-29 대표 「로그인 되는데 좀 빨리 넘어가게」) — 사람이 카카오 화면을
     거치는 동안 서버가 깨어나 DB 연결까지 맺어 둔다. 답은 안 기다린다(돌아오든 말든 그만이다).
     ⚠ 1분에 한 번만 — 로그인 화면을 여러 번 열어도 서버를 두드리지 않는다. */
  var _warmAt = 0;
  function warm() {
    var now = Date.now(); if (now - _warmAt < 60000) return; _warmAt = now;
    try { fetch(BASE + '/kakaoLoginFinish?warm=1', { method: 'GET', mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(function () {}); } catch (e) {}
  }
  /* 이 브라우저의 카카오 로그인까지 끊는 주소 — 포털 로그아웃이 카카오로 들어온 사람일 때 쓴다 */
  function logoutUrl() { return call('kakaoAuthUrl', { method: 'GET', query: 'kind=logout' }).then(function (j) { return j.url; }); }
  /* 내 정보 화면에서 — 이미 비밀번호로 들어온 사람이 자기 계정에 잇는다 */
  function goLink(sid) { return goToKakao('link', sid); }

  /* 카카오가 돌려보낸 뒤 — 주소에 code 가 있으면 아까 무엇을 하려던 참이었는지 꺼낸다.
     ⚠ 한 번 꺼내면 지운다 — 새로고침으로 같은 code 를 또 보내면 카카오가 이미 거절한다
       (인가코드는 1회용), 그 실패 메시지가 반복해서 뜨는 것만 막는다. */
  var _returnState = '';
  function pending() {
    var url = new URL(global.location.href);
    var code = url.searchParams.get('code');
    var err = url.searchParams.get('error');
    var backState = url.searchParams.get('state') || '';
    if (!code && !err) return null;
    url.searchParams.delete('code'); url.searchParams.delete('state'); url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    try { global.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash); } catch (e) {}
    var raw = null;
    try { raw = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY); } catch (e) {}
    var st = null; try { st = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (err) return { error: err === 'access_denied' ? '취소되었습니다' : ('카카오 오류: ' + err) };
    if (!st || !st.mode) return { error: '무엇을 하려던 참인지 잊었습니다 — 다시 눌러 주세요' };
    /* 이 탭이 보낸 값과 다르면 «내가 시작한 것이 아니다» — code 를 서버에 넘기지 않는다 */
    if (!st.nonce || st.nonce !== backState) return { error: '요청이 맞지 않습니다 — 다시 눌러 주세요' };
    _returnState = backState;
    return { code: code, mode: st.mode, sid: st.sid || '' };
  }

  /* 이미 로그인한 사람이 자기 카카오 계정을 잇는다 */
  function link(code, sid, idToken) {
    var state = _returnState; _returnState = '';
    return call('kakaoLink', {}, { code: code, state: state, sid: sid }, idToken).then(function () { return true; });
  }
  /* targetUid 를 주면 «남의» 연결을 끊는다 — 서버가 관리자인지 다시 확인한다(관리자 설정 화면용) */
  function unlink(idToken, targetUid) { return call('kakaoUnlink', {}, { uid: targetUid || '' }, idToken).then(function () { return true; }); }
  /* 카카오로 로그인 — 인증표와 그 사람의 최소 포털 정보를 함께 받는다. */
  function loginFinish(code) {
    var state = _returnState; _returnState = '';
    return call('kakaoLoginFinish', {}, { code: code, state: state })
      .then(function (j) { return { token: j.token, profile: j.profile || null }; });
  }

  global.PuKakao = {
    goLogin: goLogin,
    warm: warm,
    logoutUrl: logoutUrl,
    goLink: goLink,
    pending: pending,
    link: link,
    unlink: unlink,
    loginFinish: loginFinish
  };
})(window);
