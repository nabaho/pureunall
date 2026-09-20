/* TypeSafe(Jev) 검토 — 여러 앱이 «나눠 쓰는» 공용 단추 (2026-09-20)
 *
 * 대표 지시 「통합시스템 전체에서 사용할 수 있는게 어떤가」로 이알피(pu-erp.html)
 * 안에만 있던 것을 이 파일로 뽑았다 — pu-gate.js·pu-backup.js 와 같은 길이다:
 * 규칙 하나를 여기 한 곳에 두고, 쓰는 화면은 <script src="js/pu-typesafe.js?v=1">
 * 한 줄만 추가한다.
 *
 * ⚠⚠ 지금은 **pu-erp.html 만** 이 파일을 부른다. 다른 앱에 실제로 붙이는 것은
 *   대표 판단 셋(이름·업체명도 가릴지 · 국외 보관을 받아들일지 · 전 직원이 쓸지
 *   관리자만 쓸지)이 끝난 뒤의 별도 걸음이다 — 이 파일을 만든 것 자체가
 *   «켰다»는 뜻이 아니다. 붙이려는 화면에 script 태그만 추가하면 된다
 *   (server(functions/typesafe-evaluate.js)는 프로젝트 전체 로그인 사용자를
 *   받으므로 이미 준비돼 있다 — requireReader 는 앱을 가리지 않는다).
 *
 * 서버가 하는 일(가리기·하루 문·실패 갈래)은 functions/typesafe-evaluate.js 를 보라.
 * 이 파일은 «화면»만 맡는다 — 창을 만들고, 로그인 전엔 감추고, 실패를 사람 말로 바꾼다.
 *
 * ── 로그인 판정은 호스트 화면이 더 정확히 알 수도 있다 ──────────────────────
 *   `firebase.auth().currentUser` 만으로는 부족한 화면이 있다(예: 통합 로그인은
 *   됐는데 직원표에 짝이 없어 그 화면에 머무는 동안에도 currentUser 는 «있다»).
 *   그런 화면은 `window.PU_TYPESAFE_IS_LOGGED_IN = function(){ return 진짜로그인여부; }`
 *   를 정의해 넘겨주면 이 파일이 그것을 먼저 따른다. 안 정의하면 파이어베이스
 *   로그인 여부로 판단한다 — 어차피 서버가 진짜 자격을 다시 검사하므로, 단추가
 *   한순간 잘못 보여도 저장·발송 같은 사고는 나지 않는다(화면 표시일 뿐이다).
 *
 * 쓰는 법:
 *   <script src="js/pu-typesafe.js?v=1"></script>
 *   (붙이면 끝 — 왼쪽 아래에 단추가 뜨고, 눌러야 창이 열린다)
 */
(function (w, d) {
  'use strict';
  if (w.PuTypeSafe) return;

  var FN_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/typeSafeEvaluate';
  var MAX = 4000;
  var host, box, input, result, runBtn, status;

  /* 호스트 화면의 fetchT(있으면 그것)에 기대지 않는다 — 이 파일은 어느 화면에
     붙어도 혼자 돌아야 한다. 30초 안에 안 오면 스스로 끊는다. */
  function fetchTimeout(url, opts, ms) {
    opts = opts || {};
    var wait = ms || 30000;
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, wait);
    var o = {};
    for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k]; }
    o.signal = ac.signal;
    return fetch(url, o).then(function (r) { clearTimeout(timer); return r; },
      function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error(Math.round(wait / 1000) + '초 안에 답이 오지 않았습니다');
        throw e;
      });
  }

  function answerOf(v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    return String(v.choice != null ? v.choice : (v.value != null ? v.value : (v.score != null ? v.score : (v.noul != null ? v.noul : ''))));
  }
  function yesNo(v) {
    var n = Number(v); if (!isNaN(n)) return n >= .5 ? '예' : '아니오';
    return /true|yes|예/i.test(String(v)) ? '예' : '아니오';
  }
  function confidenceOf(a) {
    var vals = Object.keys(a || {}).map(function (k) { return Number(a[k] && a[k].confidence); }).filter(function (v) { return !isNaN(v); });
    if (!vals.length) return '제공되지 않음';
    var n = Math.round((vals.reduce(function (sum, v) { return sum + v; }, 0) / vals.length) * 100);
    return n + '%';
  }
  function esc(s) { var el = d.createElement('div'); el.textContent = String(s); return el.innerHTML; }
  function close() { if (host) host.style.display = 'none'; }

  function make() {
    if (host) return;
    host = d.createElement('div');
    host.id = 'pu-typesafe-review';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(15,23,42,.46);align-items:center;justify-content:center;padding:18px;box-sizing:border-box;';
    box = d.createElement('section');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'TypeSafe 검토');
    box.style.cssText = 'width:min(560px,100%);max-height:min(700px,calc(100vh - 36px));overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.35);padding:20px;box-sizing:border-box;color:#1e293b;font-family:inherit;';
    var head = d.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:start;';
    var title = d.createElement('div'); title.innerHTML = '<strong style="font-size:19px">✨ TypeSafe 검토</strong><div style="margin-top:5px;font-size:12px;color:#64748b">주민번호·사업자번호·전화·이메일·계좌와, 직원명부·업체관리에 있는 이름은 가린 뒤 보냅니다. 저장·발송·자동처리는 하지 않습니다.<br>⚠ <b>목록에 없는 사람 이름·주소는 가려지지 않습니다</b> — 미국 업체 서버로 갑니다. 하루 30번까지.</div>';
    var x = d.createElement('button'); x.type = 'button'; x.textContent = '닫기'; x.style.cssText = 'border:0;background:#f8fafc;border-radius:8px;padding:7px 10px;color:#475569;font-weight:700;cursor:pointer;'; x.onclick = close;
    head.appendChild(title); head.appendChild(x); box.appendChild(head);
    var label = d.createElement('label'); label.textContent = '검토할 내용'; label.style.cssText = 'display:block;margin-top:17px;font-size:13px;font-weight:700;'; box.appendChild(label);
    input = d.createElement('textarea'); input.maxLength = MAX; input.placeholder = '문의·메모·오류 내용을 붙여넣으세요.\n예: 계약 마감이 오늘인데 담당자 확인이 필요합니다.';
    input.style.cssText = 'display:block;width:100%;height:142px;resize:vertical;box-sizing:border-box;margin-top:7px;padding:11px;border:1px solid #cbd5e1;border-radius:10px;font:14px/1.55 inherit;color:#1e293b;'; box.appendChild(input);
    var bottom = d.createElement('div'); bottom.style.cssText = 'display:flex;align-items:center;gap:9px;margin-top:12px;';
    runBtn = d.createElement('button'); runBtn.type = 'button'; runBtn.textContent = '제안 받기'; runBtn.style.cssText = 'border:0;border-radius:9px;background:#2563eb;color:#fff;padding:10px 15px;font-weight:800;cursor:pointer;';
    status = d.createElement('span'); status.style.cssText = 'font-size:12px;color:#64748b;'; bottom.appendChild(runBtn); bottom.appendChild(status); box.appendChild(bottom);
    result = d.createElement('div'); result.style.cssText = 'display:none;margin-top:15px;padding:13px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.7;'; box.appendChild(result);
    runBtn.onclick = run;
    host.addEventListener('click', function (e) { if (e.target === host) close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && host.style.display !== 'none') close(); });
    host.appendChild(box); d.body.appendChild(host);
  }

  /* 서버가 갈라 준 까닭(why)을 «무엇을 하면 되는지»로 바꾼다.
     ⚠ 모르는 까닭이 와도 글은 그대로 보인다 — 새 갈래가 생겨도 조용히 삼키지 않는다. */
  var NEXT = {
    key: '대표님께 알려 주세요 — 열쇠를 다시 넣거나, Jev 대기자 명단이 풀릴 때까지 기다려야 합니다.',
    route: '개발 쪽에 알려 주세요 — 업체가 주소나 모델 이름을 바꿨습니다.',
    shape: '개발 쪽에 알려 주세요 — 묻는 방식을 맞춰야 합니다.',
    vendorQuota: '조금 뒤에 다시 눌러 주세요.',
    vendorDown: '조금 뒤에 다시 눌러 주세요 — 우리 쪽 문제가 아닙니다.',
    network: '잠시 뒤 다시 눌러 주세요. 되풀이되면 알려 주세요.',
    dayLimit: '내일 다시 쓸 수 있습니다.',
    noKey: '대표님께 알려 주세요 — 서버 금고에 열쇠가 없습니다.',
    adminOnly: '지금은 관리자만 쓸 수 있습니다 — 대표님께 요청해 주세요.'
  };
  function failure(data, httpStatus) {
    var e = new Error((data && data.error) || ('서버 응답 ' + httpStatus));
    if (data && data.why && NEXT[data.why]) e.puNext = NEXT[data.why];
    if (data && data.hint) e.puHint = data.hint;
    return e;
  }

  /* ── 우리가 아는 이름·업체명을 먼저 가린다 (2026-09-20 대표 결정 「우리 목록만」) ──
     서버(functions/typesafe-evaluate.js)는 번호(주민번호·전화·계좌 등)만 가린다 —
     그건 모양이 정해져 있어 기계가 확실히 찾을 수 있어서다. 이름·회사 이름은 그런
     모양이 없어 서버 혼자서는 다 못 가린다. 대신 «우리가 이미 아는» 직원 명부·
     업체관리 이름은 호스트 화면(이알피)이 확실히 가려서 넘겨줄 수 있다.
     ⚠ 안 정의한 화면(다른 앱)은 그냥 건너뛴다 — 번호만 가려진 채로 나간다.
     ⚠★ 「다 가린다」는 뜻이 아니다 — 목록에 없는 사람(외부인·의뢰인)의 이름은
       이 길로 못 잡는다. 화면에 그대로 안내한다(위 창 머리글 참고). */
  function localRedact(text) {
    if (typeof w.PU_TYPESAFE_LOCAL_REDACT !== 'function') return { text: text, localMaskedKinds: [] };
    try {
      var r = w.PU_TYPESAFE_LOCAL_REDACT(text);
      if (r && typeof r.text === 'string') return { text: r.text, localMaskedKinds: (r.localMaskedKinds || []) };
    } catch (_) { /* 가리기가 죽어도 판단 자체는 막지 않는다 — 원문 그대로 진행 */ }
    return { text: text, localMaskedKinds: [] };
  }

  async function run() {
    var text = String(input.value || '').trim();
    if (!text) { status.textContent = '검토할 내용을 입력해 주세요.'; input.focus(); return; }
    var user = w.firebase && firebase.auth && firebase.auth().currentUser;
    if (!user) { status.textContent = '로그인 후 이용해 주세요.'; return; }
    /* ⚠ 서버로 부르기 «전»에 가려야 뜻이 있다 — 부른 뒤에 가리면 이미 나간 뒤다. */
    var local = localRedact(text);
    text = local.text;
    runBtn.disabled = true; runBtn.style.opacity = '.65'; status.textContent = '개인정보를 가린 뒤 제안을 받는 중…'; result.style.display = 'none';
    try {
      var token = await user.getIdToken();
      var resp = await fetchTimeout(FN_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text }) }, 30000);
      var data = await resp.json().catch(function () { return {}; });
      if (!resp.ok || !data.ok) throw failure(data, resp.status);
      var a = data.answers || {};
      var urgency = answerOf(a.urgency), route = answerOf(a.route), review = answerOf(a.human_review);
      var deadline = answerOf(a.deadline), impact = answerOf(a.impact), risk = answerOf(a.legal_wage_risk);
      var privacy = answerOf(a.privacy_security), missing = answerOf(a.info_missing), first = answerOf(a.first_action);
      var 가린것 = local.localMaskedKinds.concat(data.maskedKinds || []);
      result.innerHTML = '<strong style="color:#1e293b">검토 제안</strong><br>· 긴급·기한 민감: <b>' + yesNo(urgency) + '</b><br>· 응답 시점: <b>' + esc(deadline || '판단 결과 없음') + '</b><br>· 검토 경로: <b>' + esc(route || '판단 결과 없음') + '</b><br>· 영향 범위: <b>' + esc(impact || '판단 결과 없음') + '</b><br>· 노무·임금·계약 위험: <b>' + esc(risk || '판단 결과 없음') + '</b><br>· 개인정보·보안 주의: <b>' + yesNo(privacy) + '</b><br>· 추가 자료 필요: <b>' + yesNo(missing) + '</b><br>· 권장 첫 조치: <b>' + esc(first || '판단 결과 없음') + '</b><br>· 사람 확인 필요: <b>' + yesNo(review) + '</b><br>· 평균 판단 신뢰도: <b>' + confidenceOf(a) + '</b>' + (가린것.length ? '<div style="margin-top:7px;color:#64748b">가린 항목: ' + esc(가린것.join(', ')) + '</div>' : '') + '<div style="margin-top:8px;color:#64748b">이 결과는 참고용입니다. 실제 저장·발송·상태 변경은 직접 확인 후 처리하세요.</div>';
      result.style.display = 'block';
      status.textContent = '저장하지 않은 제안 결과입니다.' + (data.left != null ? ' · 오늘 ' + data.left + '번 남음' : '');
    } catch (e) {
      status.textContent = '';
      /* ⚠ 실패는 «왜 그런지»까지 보인다 — 열쇠 문제와 잠깐 아픈 것은 할 일이 다르다.
         곁들인 한마디(hint)는 업체가 보낸 말이라 우리 글이 아니다. */
      result.innerHTML = '<strong style="color:#991b1b">검토를 받지 못했습니다</strong><br>'
        + esc(String((e && e.message) || e))
        + (e && e.puNext ? '<div style="margin-top:7px">→ ' + esc(e.puNext) + '</div>' : '')
        + (e && e.puHint ? '<div style="margin-top:7px;color:#64748b">업체가 보낸 말: ' + esc(e.puHint) + '</div>' : '');
      result.style.display = 'block';
    }
    finally { runBtn.disabled = false; runBtn.style.opacity = '1'; }
  }

  /* 로그인 여부 — 호스트가 더 정확한 답을 알려 주면 그것을 먼저 따른다(위 머리글 참고). */
  function isLoggedIn() {
    if (typeof w.PU_TYPESAFE_IS_LOGGED_IN === 'function') {
      try { return !!w.PU_TYPESAFE_IS_LOGGED_IN(); } catch (_) { return false; }
    }
    try { return !!(w.firebase && firebase.auth && firebase.auth().currentUser); } catch (_) { return false; }
  }

  /* ── 관리자만 (2026-09-20 대표 지시 「관리자만 일단쓴다」) ────────────────────
     ⚠ 로그인 여부와 «반대로» 다룬다 — 모르면 안 보여 준다(fail-closed).
       로그인 판정은 몰라도 안전(그저 단추가 안 보일 뿐)하지만, 관리자 판정을
       몰라서 «보여 주는» 쪽으로 잘못 넘어가면 권한 없는 사람이 단추를 보게 된다.
     호스트가 PU_TYPESAFE_IS_ADMIN 을 정의해 두면 그것을 먼저 따른다(이알피가 그렇다 —
     이미 아는 CURRENT_USER.isAdmin 을 바로 넘겨줘, 아래 서버 왕복이 필요 없다).
     안 정의한 화면은 이 부품이 스스로 uid_roles/{uid} 를 읽어 알아낸다
     (js/pu-backup.js 가 관리자 단추를 보일 때 쓰는 것과 같은 자리·같은 뜻).
     ★ 서버(functions/index.js typeSafeIsAdmin)도 «같은 자리»를 다시 본다 — 여기 판정은
       화면 표시일 뿐이고, 진짜 자격은 매번 서버가 다시 검사한다. */
  var _adminKnownUid = null, _adminKnownValue = false;
  function adminOverride() {
    if (typeof w.PU_TYPESAFE_IS_ADMIN !== 'function') return null;
    try { return !!w.PU_TYPESAFE_IS_ADMIN(); } catch (_) { return false; }
  }
  function isAdmin() {
    var o = adminOverride();
    if (o !== null) return o;
    var user = w.firebase && firebase.auth && firebase.auth().currentUser;
    return !!user && _adminKnownUid === user.uid && _adminKnownValue;
  }
  /* 호스트가 안 알려 주는 화면만 스스로 읽는다 — 한 uid 당 한 번, 결과가 오면 다시 그린다. */
  function lookUpAdminIfNeeded(user) {
    if (typeof w.PU_TYPESAFE_IS_ADMIN === 'function') return;   // 호스트가 이미 안다
    if (!user || _adminKnownUid === user.uid) return;
    try {
      if (!w.firebase || typeof firebase.database !== 'function') { _adminKnownUid = user.uid; _adminKnownValue = false; return; }
      var uid = user.uid;
      firebase.database().ref('uid_roles/' + uid).once('value').then(function (snap) {
        var role = snap.val() || {};
        _adminKnownUid = uid; _adminKnownValue = !!(role.isAdmin || role.isSubAdmin);
        refreshVisibility();
      }, function () { _adminKnownUid = uid; _adminKnownValue = false; refreshVisibility(); });  // 못 읽으면 «아니다»
    } catch (_) { _adminKnownUid = user.uid; _adminKnownValue = false; }
  }

  function css() {
    if (d.getElementById('pu-typesafe-css')) return;
    var st = d.createElement('style'); st.id = 'pu-typesafe-css';
    /* ⚠ 이 파일 «자신»의 클래스만 쓴다 — 호스트 화면의 body 클래스(예: pe-logged-out)에
       기대면 그 화면을 안 쓰는 다른 앱에 붙였을 때 항상 감춰진 채로 남는다. */
    st.textContent = 'body.pu-typesafe-hidden #pu-typesafe-review-button{display:none!important}'
      + 'body.pu-typesafe-hidden #pu-typesafe-review{display:none!important}';
    (d.head || d.documentElement).appendChild(st);
  }

  function refreshVisibility() {
    try { d.body.classList.toggle('pu-typesafe-hidden', !(isLoggedIn() && isAdmin())); } catch (_) {}
  }

  function addButton() {
    css();
    if (d.getElementById('pu-typesafe-review-button')) return;
    var b = d.createElement('button'); b.id = 'pu-typesafe-review-button'; b.type = 'button'; b.textContent = '✨ TypeSafe 검토';
    b.title = '개인정보를 가린 뒤 제안만 받습니다 (관리자 전용)';
    b.style.cssText = 'position:fixed;left:14px;bottom:64px;z-index:8998;border:1px solid #bfdbfe;border-radius:999px;background:#fff;color:#1e40af;padding:8px 12px;font:700 12px inherit;box-shadow:0 4px 14px rgba(30,64,175,.15);cursor:pointer;';
    b.onclick = function () { make(); host.style.display = 'flex'; input.focus(); };
    d.body.appendChild(b);
    refreshVisibility();
    try {
      if (w.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) { lookUpAdminIfNeeded(user); refreshVisibility(); });
      }
    } catch (_) {}
  }

  w.PuTypeSafe = {
    open: function () { make(); host.style.display = 'flex'; input.focus(); },
    /* 호스트 화면이 «진짜 로그인» 여부를 더 정확히 알게 됐을 때 부른다
       (PU_TYPESAFE_IS_LOGGED_IN 을 바꾼 직후). 안 불러도 파이어베이스
       로그인 변화에는 스스로 반응한다. */
    refresh: refreshVisibility
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', addButton); else addButton();
})(window, document);
