/* TypeSafe(Jev) 검토 — 여러 앱이 «나눠 쓰는» 공용 단추 (2026-09-20)
 *
 * 대표 지시 「통합시스템 전체에서 사용할 수 있는게 어떤가」로 이알피(pu-erp.html)
 * 안에만 있던 것을 이 파일로 뽑았다 — pu-gate.js·pu-backup.js 와 같은 길이다:
 * 규칙 하나를 여기 한 곳에 두고, 쓰는 화면은 <script src="js/pu-typesafe.js?v=1">
 * 한 줄만 추가한다.
 *
 * ★ 2026-09-23 대표 지시 「푸른통합시스템 전체로 적용해서 캡쳐3화면(포털)으로
 *   옮기고 연결해줘」 → 목업 ①안 「빼고 포털로만」. 이제 **enter.html(포털)만**
 *   이 파일을 부른다 — 이알피 왼쪽 아래 단추는 뺐다. 포털은 떠 있는 단추 자리를
 *   한 곳에서만 정하므로, 떠 있지 않고 「업무 시스템」 줄 오른쪽(로그인 후 바로가기 왼쪽)에 선다
 *   (호스트가 PU_TYPESAFE_MOUNT 로 자리를 알려 준다 — 아래 addButton).
 *   대표 판단 셋(관리자만 · 우리 목록만 가림 · 국외보관 확인란)은 그대로다.
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
  var host, box, input, result, runBtn, status, ack;

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

  /* ══ 창을 마우스로 옮긴다 (대표 지시 2026-09-23 「팝업창 마우스로 이동가능하게 해줘」) ══
     ★ 자리를 «transform» 으로 옮긴다. 이 창은 host 의 flex 가 가운데로 세워 주는데,
       position/left/top 으로 옮기면 그 가운데 세우기와 싸운다 — 창 크기가 바뀌거나
       글이 길어질 때마다 어긋난다. transform 은 «세워진 자리에서 얼마나 밀지»만 말하므로
       가운데 세우기를 그대로 두고 얹을 수 있다.
     ★ 마우스·손가락을 따로 적지 않는다 — pointer 하나로 둘 다 받는다.
     ⚠ 옮긴 자리를 «기억한다». 열 때마다 가운데로 돌아가면, 가리는 것을 보려고
       옮긴 사람이 열 때마다 다시 옮겨야 한다.
     ⚠ 다만 열 때·창 크기가 바뀔 때 «화면 안으로 도로 당긴다» — 작은 화면으로 옮겨 가면
       창이 밖에 나가 영영 못 잡는다. 그것이 제일 나쁘다. */
  var _dx = 0, _dy = 0;
  function 자리적용() {
    if (!box) return;
    box.style.transform = (_dx || _dy) ? ('translate(' + _dx + 'px,' + _dy + 'px)') : '';
  }
  /* 화면 밖으로 못 나가게 당긴다. 잣대는 «창의 지금 자리»다 —
     얼마나 밀었는지만 보면 창 크기가 바뀐 뒤에는 틀린 답이 나온다. */
  function 안으로당기기() {
    if (!box || !host || host.style.display === 'none') return;
    var 여백 = 8;
    var r = box.getBoundingClientRect();
    var W = w.innerWidth || d.documentElement.clientWidth;
    var H = w.innerHeight || d.documentElement.clientHeight;
    if (r.width > W - 2 * 여백) { _dx = 0; } else {
      if (r.left < 여백) _dx += 여백 - r.left;
      else if (r.right > W - 여백) _dx -= r.right - (W - 여백);
    }
    /* 세로는 «머리줄이 보이는가»로 본다 — 머리줄을 잡아야 다시 옮길 수 있다.
       창이 화면보다 길 수 있으므로 아래쪽은 바닥이 아니라 머리줄을 기준으로 막는다. */
    if (r.top < 여백) _dy += 여백 - r.top;
    else if (r.top > H - 48) _dy -= r.top - (H - 48);
    자리적용();
  }
  function 끌기달기(손잡이, 닫기단추) {
    var 잡았나 = false, sx = 0, sy = 0, bx = 0, by = 0, id = null;
    손잡이.addEventListener('pointerdown', function (e) {
      /* 닫기 단추에서 시작한 것은 끌기가 아니다 — 누르려다 1px 흔들려도 안 닫히면 안 된다 */
      if (닫기단추 && (e.target === 닫기단추 || 닫기단추.contains(e.target))) return;
      if (e.button != null && e.button !== 0) return;      // 왼쪽 단추만
      잡았나 = true; id = e.pointerId;
      sx = e.clientX; sy = e.clientY; bx = _dx; by = _dy;
      try { 손잡이.setPointerCapture(id); } catch (_) {}
      손잡이.style.userSelect = 'none';                     // 끄는 동안 글자가 잡히지 않게
      e.preventDefault();
    });
    손잡이.addEventListener('pointermove', function (e) {
      if (!잡았나 || (id != null && e.pointerId !== id)) return;
      _dx = bx + (e.clientX - sx); _dy = by + (e.clientY - sy);
      자리적용();
    });
    function 놓기(e) {
      if (!잡았나 || (id != null && e && e.pointerId !== id)) return;
      잡았나 = false;
      try { 손잡이.releasePointerCapture(id); } catch (_) {}
      손잡이.style.userSelect = '';
      안으로당기기();
    }
    손잡이.addEventListener('pointerup', 놓기);
    손잡이.addEventListener('pointercancel', 놓기);
  }
  try { w.addEventListener('resize', 안으로당기기); } catch (_) {}

  function make() {
    if (host) return;
    host = d.createElement('div');
    host.id = 'pu-typesafe-review';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(15,23,42,.46);align-items:center;justify-content:center;padding:18px;box-sizing:border-box;';
    box = d.createElement('section');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'TypeSafe 검토');
    box.style.cssText = 'width:min(560px,100%);max-height:min(700px,calc(100vh - 36px));overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.35);padding:20px;box-sizing:border-box;color:#1e293b;font-family:inherit;';
    var head = d.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:start;'
      + 'cursor:move;touch-action:none;';   /* ← 여기를 잡고 창을 옮긴다 (대표 지시 2026-09-23) */
    /* 호스트가 이름 목록을 안 들고 있으면(포털) 누를 때 스스로 읽어 온다 — 그 사실을
       창에서도 밝힌다(「가린다」고만 적고 어디서 읽는지 숨기지 않는다). */
    var selfLoad = typeof w.PU_TYPESAFE_LOCAL_REDACT !== 'function';
    var title = d.createElement('div'); title.innerHTML = '<strong style="font-size:19px">✨ TypeSafe 검토</strong><div style="margin-top:5px;font-size:12px;color:#64748b">주민번호·사업자번호·전화·이메일·계좌와, 직원명부·업체관리에 있는 이름은 가린 뒤 보냅니다. 저장·발송·자동처리는 하지 않습니다.<br>⚠ <b>목록에 없는 사람 이름·주소는 가려지지 않습니다</b> — 미국 업체 서버로 갑니다. 하루 30번까지.'
      + (selfLoad ? '<br>「제안 받기」를 누를 때 직원·업체 목록을 한 번 읽어 와서 가립니다.' : '') + '</div>';
    var x = d.createElement('button'); x.type = 'button'; x.textContent = '닫기'; x.style.cssText = 'border:0;background:#f8fafc;border-radius:8px;padding:7px 10px;color:#475569;font-weight:700;cursor:pointer;'; x.onclick = close;
    head.appendChild(title); head.appendChild(x); box.appendChild(head);
    끌기달기(head, x);
    var label = d.createElement('label'); label.textContent = '검토할 내용'; label.style.cssText = 'display:block;margin-top:17px;font-size:13px;font-weight:700;'; box.appendChild(label);
    input = d.createElement('textarea'); input.maxLength = MAX; input.placeholder = '문의·메모·오류 내용을 붙여넣으세요.\n예: 계약 마감이 오늘인데 담당자 확인이 필요합니다.';
    input.style.cssText = 'display:block;width:100%;height:142px;resize:vertical;box-sizing:border-box;margin-top:7px;padding:11px;border:1px solid #cbd5e1;border-radius:10px;font:14px/1.55 inherit;color:#1e293b;'; box.appendChild(input);
    /* ── 국외 보관 확인란 (2026-09-20 대표 결정 「안내문 만들고 쓴다」) ────────────
       미국 업체 서버에 글이 남는다는 것을, 안내만 하고 넘어가지 않는다 — 사람이
       «확인했다»고 스스로 표시해야 다음 단추가 눌린다. 안내글을 읽었는지까지는
       못 보장하지만, 최소한 «몰랐다」는 못 하게 한다.
       ⚠ 열 때마다 다시 확인란을 비운다(아래 openDialog) — 한 번 체크했다고 다음
         번(다른 내용을 넣을 때)까지 넘어가면 확인의 뜻이 없어진다. */
    var ackRow = d.createElement('label'); ackRow.style.cssText = 'display:flex;gap:7px;align-items:flex-start;margin-top:11px;font-size:12px;color:#475569;line-height:1.5;cursor:pointer;';
    ack = d.createElement('input'); ack.id = 'pu-typesafe-ack'; ack.type = 'checkbox'; ack.style.cssText = 'margin-top:2px;flex:none;';
    var ackText = d.createElement('span'); ackText.textContent = '근로자 등 외부인의 개인정보(이름·연락처·주소 등)를 넣지 않았고, 이 글이 미국 업체 서버로 전송된다는 것을 확인했습니다.';
    ackRow.appendChild(ack); ackRow.appendChild(ackText); box.appendChild(ackRow);
    var bottom = d.createElement('div'); bottom.style.cssText = 'display:flex;align-items:center;gap:9px;margin-top:12px;';
    runBtn = d.createElement('button'); runBtn.id = 'pu-typesafe-run-btn'; runBtn.type = 'button'; runBtn.textContent = '제안 받기'; runBtn.disabled = true; runBtn.style.cssText = 'border:0;border-radius:9px;background:#2563eb;color:#fff;padding:10px 15px;font-weight:800;cursor:pointer;opacity:.5;';
    ack.onchange = function () { runBtn.disabled = !ack.checked; runBtn.style.opacity = ack.checked ? '1' : '.5'; };
    status = d.createElement('span'); status.id = 'pu-typesafe-status'; status.style.cssText = 'font-size:12px;color:#64748b;'; bottom.appendChild(runBtn); bottom.appendChild(status); box.appendChild(bottom);
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
  /* 이름 목록으로 가리는 셈 — 2026-09-23 이알피(typeSafeLocalRedact)에서 이리로 옮겼다.
     ⚠ 긴 이름부터 바꾼다 — 짧은 이름이 긴 이름(예: 업체명 일부)을 먼저 망가뜨리면
       「[업체1]상사」처럼 반쪽만 가려진 채 나간다.
     같은 값은 같은 표로(「[직원1]이 물었는데 [직원1]에게」) — 문맥이 유지된다.
     한 글자 이름은 후보에서 뺀다 — 흔한 글자를 지우면 문장이 망가진다. */
  function redactNames(text, staff, companies) {
    var out = String(text == null ? '' : text);
    var 후보 = [], seen = {};
    function 담기(list, 갈래) {
      (Array.isArray(list) ? list : []).forEach(function (v) {
        v = v == null ? '' : String(v).trim();
        if (v.length < 2 || seen[갈래 + ':' + v]) return;
        seen[갈래 + ':' + v] = true;
        후보.push({ value: v, 갈래: 갈래 });
      });
    }
    담기(staff, '직원'); 담기(companies, '업체');
    후보.sort(function (a, b) { return b.value.length - a.value.length; });
    var placeholderOf = {}, seq = { 직원: 0, 업체: 0 }, hit = { 직원: 0, 업체: 0 };
    후보.forEach(function (c) {
      if (out.indexOf(c.value) < 0) return;
      var key = c.갈래 + ':' + c.value;
      if (!placeholderOf[key]) { seq[c.갈래] += 1; placeholderOf[key] = '[' + c.갈래 + seq[c.갈래] + ']'; }
      out = out.split(c.value).join(placeholderOf[key]);
      hit[c.갈래] += 1;
    });
    var kinds = [];
    if (hit.직원) kinds.push('직원 이름 ' + hit.직원 + '건');
    if (hit.업체) kinds.push('업체명 ' + hit.업체 + '건');
    return { text: out, localMaskedKinds: kinds };
  }

  /* 서버 저장 모양(data/{표}/v)은 배열이거나 {번호: 항목} 지도다 — 둘 다 이름만 뽑는다. */
  function namesOf(v) {
    if (!v || typeof v !== 'object') return [];
    return Object.keys(v).map(function (k) { var x = v[k]; return x && x.name; })
      .filter(function (n) { return typeof n === 'string'; });
  }
  /* 포털처럼 목록을 안 들고 있는 화면 — 「제안 받기」를 누를 때 한 번 읽는다.
     ⚠ 페이지를 닫을 때까지 메모리에만 둔다(브라우저 저장소에 안 남긴다).
     ⚠ 실패는 기억하지 않는다 — 다음에 누르면 다시 읽어 본다. */
  var _namesPromise = null;
  function loadNameLists() {
    if (_namesPromise) return _namesPromise;
    _namesPromise = new Promise(function (resolve, reject) {
      try {
        if (!w.firebase || typeof firebase.database !== 'function') throw new Error('no db');
        var db = firebase.database();
        Promise.all([db.ref('data/user_accounts/v').once('value'), db.ref('data/companies/v').once('value')])
          .then(function (s) { resolve({ staff: namesOf(s[0].val()), companies: namesOf(s[1].val()) }); }, reject);
      } catch (e) { reject(e); }
    });
    _namesPromise.catch(function () { _namesPromise = null; });
    return _namesPromise;
  }

  /* 호스트가 가려 주면(PU_TYPESAFE_LOCAL_REDACT) 그것을 쓰고, 아니면 스스로 목록을 읽어 가린다.
     ⚠ 목록을 못 읽어도 검토는 막지 않는다(2026-09-20 결정 그대로) — 대신 namesMissed 로
       «이름은 못 가렸다»를 결과에 밝힌다. 가렸다고 착각하게 두지 않는다. */
  async function localRedact(text) {
    if (typeof w.PU_TYPESAFE_LOCAL_REDACT === 'function') {
      try {
        var r = w.PU_TYPESAFE_LOCAL_REDACT(text);
        if (r && typeof r.text === 'string') return { text: r.text, localMaskedKinds: (r.localMaskedKinds || []) };
      } catch (_) { /* 가리기가 죽어도 판단 자체는 막지 않는다 */ }
      return { text: text, localMaskedKinds: [], namesMissed: true };
    }
    try {
      var lists = await loadNameLists();
      return redactNames(text, lists.staff, lists.companies);
    } catch (_) {
      return { text: text, localMaskedKinds: [], namesMissed: true };
    }
  }

  async function run() {
    /* 방어선 — 단추가 disabled 인 동안은 클릭 자체가 안 되지만, 혹시 다른 경로로
       불려도(프로그램으로 호출 등) 확인 없이 나가지 않게 한 번 더 본다. */
    if (!ack || !ack.checked) { status.textContent = '위 확인란에 체크해야 이용할 수 있습니다.'; return; }
    var text = String(input.value || '').trim();
    if (!text) { status.textContent = '검토할 내용을 입력해 주세요.'; input.focus(); return; }
    var user = w.firebase && firebase.auth && firebase.auth().currentUser;
    if (!user) { status.textContent = '로그인 후 이용해 주세요.'; return; }
    runBtn.disabled = true; runBtn.style.opacity = '.65'; status.textContent = '개인정보를 가린 뒤 제안을 받는 중…'; result.style.display = 'none';
    try {
      /* ⚠ 서버로 부르기 «전»에 가려야 뜻이 있다 — 부른 뒤에 가리면 이미 나간 뒤다. */
      var local = await localRedact(text);
      text = local.text;
      var token = await user.getIdToken();
      var resp = await fetchTimeout(FN_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text }) }, 30000);
      var data = await resp.json().catch(function () { return {}; });
      if (!resp.ok || !data.ok) throw failure(data, resp.status);
      var a = data.answers || {};
      var urgency = answerOf(a.urgency), route = answerOf(a.route), review = answerOf(a.human_review);
      var deadline = answerOf(a.deadline), impact = answerOf(a.impact), risk = answerOf(a.legal_wage_risk);
      var privacy = answerOf(a.privacy_security), missing = answerOf(a.info_missing), first = answerOf(a.first_action);
      var 가린것 = local.localMaskedKinds.concat(data.maskedKinds || []);
      result.innerHTML = '<strong style="color:#1e293b">검토 제안</strong><br>· 긴급·기한 민감: <b>' + yesNo(urgency) + '</b><br>· 응답 시점: <b>' + esc(deadline || '판단 결과 없음') + '</b><br>· 검토 경로: <b>' + esc(route || '판단 결과 없음') + '</b><br>· 영향 범위: <b>' + esc(impact || '판단 결과 없음') + '</b><br>· 노무·임금·계약 위험: <b>' + esc(risk || '판단 결과 없음') + '</b><br>· 개인정보·보안 주의: <b>' + yesNo(privacy) + '</b><br>· 추가 자료 필요: <b>' + yesNo(missing) + '</b><br>· 권장 첫 조치: <b>' + esc(first || '판단 결과 없음') + '</b><br>· 사람 확인 필요: <b>' + yesNo(review) + '</b><br>· 평균 판단 신뢰도: <b>' + confidenceOf(a) + '</b>' + (가린것.length ? '<div style="margin-top:7px;color:#64748b">가린 항목: ' + esc(가린것.join(', ')) + '</div>' : '') + (local.namesMissed ? '<div style="margin-top:7px;color:#b45309">⚠ 직원·업체 목록을 못 읽어 이름은 가리지 못했습니다 — 번호만 가린 채 보냈습니다.</div>' : '') + '<div style="margin-top:8px;color:#64748b">이 결과는 참고용입니다. 실제 저장·발송·상태 변경은 직접 확인 후 처리하세요.</div>';
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

  /* 열 때마다 확인란을 다시 비운다 — 지난번에 체크했던 것이 이번 내용에도
     그대로 이어지면, 확인란을 두는 뜻(«이번 글은 괜찮은지» 매번 묻기)이 없어진다. */
  function openDialog() {
    make();
    if (ack) { ack.checked = false; if (typeof ack.onchange === 'function') ack.onchange(); }
    host.style.display = 'flex';
    /* 지난번에 옮겨 둔 자리를 그대로 쓰되, 그 사이 화면이 작아졌으면 안으로 당긴다 */
    자리적용(); 안으로당기기();
    input.focus();
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
    var pill = 'border:1px solid #bfdbfe;border-radius:999px;background:#fff;color:#1e40af;padding:8px 12px;font-weight:700;font-size:12px;font-family:inherit;box-shadow:0 4px 14px rgba(30,64,175,.15);cursor:pointer;';
    b.onclick = openDialog;
    /* 호스트가 자리를 알려 주면(포털 「업무 시스템」 줄) 거기 «떠 있지 않게» 선다 —
       PU_TYPESAFE_MOUNT() 는 { parent, before } 를 돌려준다. 안 알려 주면 예전처럼 왼쪽 아래에 뜬다. */
    var at = null;
    try { if (typeof w.PU_TYPESAFE_MOUNT === 'function') at = w.PU_TYPESAFE_MOUNT(); } catch (_) { at = null; }
    if (at && at.parent) {
      b.style.cssText = pill + 'display:inline-flex;align-items:center;white-space:nowrap;';
      at.parent.insertBefore(b, at.before || null);
      /* 호스트가 단추를 옮겨 다니게 하는 화면(포털의 폰 ⋯ 안)이 알아차릴 수 있게 알린다 */
      try { d.dispatchEvent(new CustomEvent('pu-typesafe-mounted')); } catch (_) {}
    } else {
      b.style.cssText = 'position:fixed;left:14px;bottom:64px;z-index:8998;' + pill;
      d.body.appendChild(b);
    }
    refreshVisibility();
    try {
      if (w.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) { lookUpAdminIfNeeded(user); refreshVisibility(); });
      }
    } catch (_) {}
  }

  w.PuTypeSafe = {
    open: openDialog,
    /* 이름 목록으로 가리는 셈 — 검사(tests/typesafe-local-redact.test.js)가 값으로 돌려 본다 */
    redactNames: redactNames,
    /* 호스트 화면이 «진짜 로그인» 여부를 더 정확히 알게 됐을 때 부른다
       (PU_TYPESAFE_IS_LOGGED_IN 을 바꾼 직후). 안 불러도 파이어베이스
       로그인 변화에는 스스로 반응한다. */
    refresh: refreshVisibility
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', addButton); else addButton();
})(window, document);
