/* Pureunall shared fault detection and administrator notification runtime. */
(function (window) {
  'use strict';
  if (!window || !window.document || window.PUHealth) return;

  var STORE_KEY = 'pu_health_pending_v1';
  var DEDUPE_KEY = 'pu_health_dedupe_v1';
  var SETTLE_KEY = 'pu_health_settle_v1';
  var MAX_PENDING = 30;
  var DEDUPE_MS = 10 * 60 * 1000;
  var boundApps = [];
  var flushing = false;
  var adminAlerts = [];

  /* ── 장애 알림은 «화면에 띄우지 않고» 저절로 «처리 완료»로 정리한다 (대표 지시 2026-11-22) ──
     「시스템 장애 알림 관련 모두 처리 완료 버튼 안 눌러도 자동으로 정리되게,
       앞으로 다른 전체 프로그램에 이 창 안 뜨게 다 만들어 달라.」

     ★ 무엇이 있었나 — 어느 프로그램에서든 오류가 한 번 나면 왼쪽 아래에 빨간
       「⚠ 장애 알림 N」 단추가 떴고, 누르면 «시스템 장애 알림» 창이 열려 건마다
       「처리 완료」를 눌러야 했다(2026-10-04 「모두 처리 완료」 단추를 달았지만 «누르는 일»은 그대로).
     ★ 이제 규칙은 셋이다.
       ① 이 파일은 어느 화면에도 단추·창을 «스스로» 만들지 않는다 — 떠 있는 빨간 단추는 없다.
          창(renderAdminPanel)은 포털 [⚙ 설정]의 「열어보기」(openAdminPanel)를 사람이 눌렀을 때만 뜬다.
       ② 이 화면에서 난 오류는 서버에 «처음부터 처리 완료»(status=resolved·resolvedBy='auto')로 적는다.
          ⚠ 기록을 없애지 않는다 — 나중에 «무슨 오류가 났었나»를 볼 길(서버 systemAlerts)은 남는다.
       ③ 서버가 적은 알림(새 기기 로그인·카카오 실패·뉴스레터·취업규칙 모으기 등 status=new)과
          이미 쌓인 것은, 총괄관리자 화면이 열릴 때 «조용히» 처리 완료로 바꾼다(settleOpen).
          한 건씩 누르던 것과 «같은 세 칸»(status·resolvedAt·resolvedBy)만 바꾸고 지우지 않는다.
     ⚠ 이 규칙을 되돌려 «늘 떠 있는 단추»를 다시 만들지 않는다 — 앱바(js/pu-appbar.js)가 정리하는
       떠 있는 단추를 화면마다 따로 만들면 겹치고 가린다. 검사: tests/health-auto-settle.test.js */

  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, max || 700);
  }

  function readJson(key, fallback) {
    try { return JSON.parse(window.localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  function fingerprint(kind, message, page) {
    var text = kind + '|' + message + '|' + page;
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36);
  }

  /* ── 장애가 «아닌» 잔소리 (2026-09-16, 대표 제보 「계속 깜빡이며 경고가 반복된다」) ──
     ★ 무슨 일이 있었나 — 대표 화면의 빨간 「장애 알림 7」이 켤 때마다 다시 켜졌다.
       열린 7건을 서버에서 읽어 보니 «전부» 기금 화면이 10분마다 올린
       「ResizeObserver loop completed with undelivered notifications.」였다(누적 69건).
       이것은 크롬이 «이번 칸에 그림을 한 번 더 그린다»고 알려 주는 말이지 고장이 아니다.
       그런데 오류 그물(window.error)이 이것을 장애로 세어 10분마다 새 건을 만들었다.
     ★ 「Script error.」도 같다 — 다른 출처의 스크립트가 낸 오류를 브라우저가 «내용 없이»
       알려 주는 말이다(37건). 무엇이 났는지 알 길이 없어 처리할 것도 없다.
     ⚠ 두 곳에서 «함께» 거른다 — 새로 올릴 때(enqueue)와 읽어 셀 때(flattenAlerts).
       올릴 때만 거르면 이미 서버에 쌓인 것이 계속 남는다. 읽을 때만 거르면
       서버에는 영영 쌓인다. */
  var NOISE = [
    /ResizeObserver loop/i,
    /^Script error\.?$/i
  ];
  function isNoise(message) {
    var m = String(message == null ? '' : message).trim();
    for (var i = 0; i < NOISE.length; i++) { if (NOISE[i].test(m)) return true; }
    return false;
  }

  function enqueue(kind, error, extra) {
    extra = extra || {};
    var message = safeText(error && (error.message || error.reason) || error || '알 수 없는 오류');
    if (isNoise(message)) return false;           /* 잔소리는 장애가 아니다 — 세지도 올리지도 않는다 */
    var page = window.location.pathname.split('/').pop() || 'enter.html';
    var id = fingerprint(kind, message, page);
    var dedupe = readJson(DEDUPE_KEY, {});
    if (dedupe[id] && Date.now() - dedupe[id] < DEDUPE_MS) return false;
    dedupe[id] = Date.now();
    Object.keys(dedupe).forEach(function (key) { if (Date.now() - dedupe[key] > 24 * 60 * 60 * 1000) delete dedupe[key]; });
    writeJson(DEDUPE_KEY, dedupe);

    /* 여기 status 'new' 는 «아직 서버에 못 올린 대기 표시»일 뿐이다 — 서버에 적을 때(flush)
       «처리 완료»로 바꿔 적는다(판단은 한 곳에서만). 화면에는 아무것도 띄우지 않는다. */
    var pending = readJson(STORE_KEY, []);
    pending.push({
      localId: Date.now().toString(36) + id,
      kind: safeText(kind, 40),
      message: message,
      detail: safeText(extra.detail || error && error.stack || '', 900),
      page: safeText(page, 100),
      createdAt: Date.now(),
      status: 'new'
    });
    writeJson(STORE_KEY, pending.slice(-MAX_PENDING));
    flush();
    return true;
  }

  function activeApp() {
    for (var i = 0; i < boundApps.length; i++) {
      try { if (boundApps[i].auth().currentUser) return boundApps[i]; } catch (_) {}
    }
    return null;
  }

  /* 지금 로그인한 사람의 «이름» — 포털의 PuWhoami → Firebase 표시이름 순. 이메일 꼴이면 이름이 아니다. */
  function myName(user) {
    var me = window.PuWhoami && window.PuWhoami.get && window.PuWhoami.get();
    var n = String((me && me.name) || (user && user.displayName) || '').trim();
    return n.indexOf('@') >= 0 ? '' : n;
  }

  /* 자동으로 «처리 완료»를 적는 사람 표시 — 한 건씩 누른 사람(uid)과 구별된다 */
  var AUTO_BY = 'auto';

  function flush() {
    if (flushing || window.navigator.onLine === false) return Promise.resolve(false);
    var app = activeApp();
    if (!app) return Promise.resolve(false);
    var user = app.auth().currentUser;
    var pending = readJson(STORE_KEY, []);
    if (!pending.length) return Promise.resolve(false);
    flushing = true;
    var chain = Promise.resolve();
    pending.slice().forEach(function (event) {
      chain = chain.then(function () {
        /* name — «누구 것인지» 남길 이름. 로그인 이메일은 적지 않는다(대표 결정 2026-10-25 「이름만 있어야한다」)
           ★ 처음부터 «처리 완료»로 적는다 — 이 업데이트 «전에» 대기줄에 들어 있던 것(status 'new')도 같다.
             서버 규칙은 본인 알림을 새로 쓰는 것을 허락하고 status 는 new|resolved 만 본다 — 규칙은 그대로다. */
        var record = Object.assign({}, event, {
          status: 'resolved', resolvedAt: Date.now(), resolvedBy: AUTO_BY,
          uid: user.uid, email: safeText(user.email, 150), name: safeText(myName(user), 60)
        });
        delete record.localId;
        return app.database().ref('systemAlerts/' + user.uid + '/' + event.localId).set(record).then(function () {
          var latest = readJson(STORE_KEY, []).filter(function (item) { return item.localId !== event.localId; });
          writeJson(STORE_KEY, latest);
        });
      });
    });
    return chain.then(function () { flushing = false; return true; }, function () { flushing = false; return false; });
  }

  /* 열린(status new) 알림 목록. includeNoise 가 참이면 잔소리도 함께 — 정리할 때는 «전부» 처리 완료로 바꾼다. */
  function flattenAlerts(value, includeNoise) {
    var list = [];
    Object.keys(value || {}).forEach(function (uid) {
      Object.keys(value[uid] || {}).forEach(function (id) {
        var item = value[uid][id] || {};
        if (item.status !== 'new') return;
        if (!includeNoise && isNoise(item.message)) return;   /* 예전에 쌓인 잔소리도 창에는 세지 않는다 */
        /* ★ 서버 «키»(uid·id)가 늘 이긴다 — 본문에 같은 이름의 칸을 적어 넣어도 덮이지 않는다.
           본문이 이기면 «처리 완료»가 엉뚱한 자리(없는 번호)로 가서 묶음 전체가 거절된다. */
        list.push(Object.assign({}, item, { uid: uid, id: id }));
      });
    });
    return list.sort(function (a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); });
  }

  /* 장애 이력은 오래될수록 커진다. 관리자 탭마다 전체 루트를 실시간 구독하면
     오류 한 건이 생길 때마다 과거 이력까지 다시 내려온다. 평소에는 읽지 않고,
     «정리할 때(몇 시간에 한 번)»와 «사람이 창을 열 때»만 한 번씩 가져온다. */
  function waitForRetry() {
    return new Promise(function (resolve) { window.setTimeout(resolve, 180); });
  }

  /* 로그인 직후에는 화면은 먼저 열렸지만 RTDB 인증 토큰 전달이나 연결 복구가
     아직 끝나지 않아 첫 읽기만 실패할 수 있다. 토큰을 한 번 새로 받고 연결을
     깨운 뒤 딱 한 번만 재시도한다. 권한 오류도 무한 반복하지 않는다. */
  function readAdminAlerts(app) {
    function readOnce() { return app.database().ref('systemAlerts').once('value'); }
    return readOnce().catch(function (firstError) {
      var refresh = Promise.resolve();
      try {
        var user = app.auth().currentUser;
        if (user && typeof user.getIdToken === 'function') {
          refresh = Promise.resolve(user.getIdToken(true)).catch(function () {});
        }
      } catch (_) {}
      try {
        var db = app.database();
        if (db && typeof db.goOnline === 'function') db.goOnline();
      } catch (_) {}
      return refresh.then(waitForRetry).then(readOnce).catch(function (retryError) {
        throw retryError || firstError;
      });
    });
  }

  /* 「열어보기」 — 포털 [⚙ 설정]의 줄이 부르는 «사람이 여는 문». 화면 어디에도 단추가 없다.
     ★ 결과(아직 정리 전인 건수)를 돌려준다 — 부르는 쪽이 「불러오는 중…」 을 끝낼 수 있다. */
  function showAdminPanel(app) {
    app = app || activeApp();
    if (!app) return Promise.resolve(false);
    return readAdminAlerts(app).then(function (alertsSnapshot) {
      adminAlerts = flattenAlerts(alertsSnapshot.val());
      renderAdminPanel(app);
      return adminAlerts.length;
    }).catch(function (error) {
      /* 못 읽었으면 «없는 것»이 아니라 «모르는 것» — 부르는 쪽이 실패로 알린다. 여기서 창을 띄우지 않는다. */
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('[PUHealth] 장애 알림 조회 실패:', safeText(error && (error.code || error.message) || error, 160));
      }
      throw error;
    });
  }

  /* 「처리 완료」로 한꺼번에 쓸 칸들 — 한 건씩 누르던 것과 «같은 세 칸»(status·resolvedAt·resolvedBy)만 바꾼다.
     ⚠ 알림 자체는 지우지 않는다(기록은 남는다). null 을 쓰면 «지우는 것»이다 — 절대 쓰지 않는다. */
  function resolveAllPatch(items, now, me) {
    var up = {};
    (items || []).forEach(function (it) {
      if (!it || !it.uid || !it.id) return;
      var p = 'systemAlerts/' + it.uid + '/' + it.id + '/';
      up[p + 'status'] = 'resolved'; up[p + 'resolvedAt'] = now; up[p + 'resolvedBy'] = me;
    });
    return up;
  }

  /* ── 쌓인 알림을 «조용히» 처리 완료로 (총괄관리자 화면이 열릴 때) ──
     ★ 얼마나 자주 — 잘 됐으면 6시간에 한 번, 못 했으면 30분 뒤에 다시. 장애 이력 전체를 읽는 일이라
       화면을 열 때마다 하면 읽는 양만 늘어난다(rtdb-cost-guards 의 뜻). 시작 «전에» 시각을 적어 둬
       탭을 여러 개 열어도 한꺼번에 읽지 않는다.
     ★ 묶음 하나가 규칙에 걸려 통째로 거절돼도 나머지는 정리된다 — 걸린 묶음은 건별로 다시 쓴다.
     ★ 모든 오류는 삼킨다 — 정리가 실패한 것을 새 장애로 다시 적으면 같은 알림이 늘어나는 순환이 된다.
     ⚠ 지우지 않는다 · 이미 처리된 것·잔소리 거르기와 무관하게 «열린 것 전부»가 대상이다. */
  var SETTLE_EVERY_MS = 6 * 60 * 60 * 1000;
  var SETTLE_RETRY_MS = 30 * 60 * 1000;
  var SETTLE_CHUNK = 100;

  function settleDue(now) {
    var rec = readJson(SETTLE_KEY, null);
    if (!rec || typeof rec.at !== 'number') return true;
    return now - rec.at >= (rec.ok ? SETTLE_EVERY_MS : SETTLE_RETRY_MS);
  }

  /* 이 묶음에서 «하나라도» 쓰였으면 true — 전부 거절됐으면(통신 끊김·권한) false */
  function writeSettled(app, part) {
    var db = app.database();
    return db.ref().update(resolveAllPatch(part, Date.now(), AUTO_BY)).then(function () { return true; }, function () {
      return part.reduce(function (chain, item) {
        return chain.then(function (okSoFar) {
          return db.ref().update(resolveAllPatch([item], Date.now(), AUTO_BY)).then(function () { return true; }, function () { return okSoFar; });
        });
      }, Promise.resolve(false));
    });
  }

  function settleOpen(app) {
    app = app || activeApp();
    if (!app) return Promise.resolve(0);
    var now = Date.now();
    if (!settleDue(now)) return Promise.resolve(0);
    writeJson(SETTLE_KEY, { at: now, ok: false });
    return readAdminAlerts(app).then(function (snapshot) {
      var items = flattenAlerts(snapshot.val(), true);
      var anyOk = false;
      var chain = Promise.resolve();
      for (var i = 0; i < items.length; i += SETTLE_CHUNK) {
        (function (part) { chain = chain.then(function () { return writeSettled(app, part).then(function (ok) { if (ok) anyOk = true; }); }); })(items.slice(i, i + SETTLE_CHUNK));
      }
      return chain.then(function () {
        /* 하나라도 쓰였거나 정리할 것이 없었으면 «잘 끝남»(6시간 뒤). 전부 거절됐으면 «못 함»(30분 뒤 다시) */
        writeJson(SETTLE_KEY, { at: Date.now(), ok: !items.length || anyOk });
        return items.length;
      });
    }).catch(function () { return 0; });
  }

  function renderAdminPanel(app) {
    var old = window.document.getElementById('pu-health-panel');
    if (old) old.remove();
    var panel = window.document.createElement('div');
    panel.id = 'pu-health-panel';
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0f172acc;padding:20px;display:grid;place-items:center;font-family:system-ui,sans-serif;';
    var box = window.document.createElement('div');
    box.style.cssText = 'width:min(680px,100%);max-height:min(720px,90vh);overflow:auto;background:#fff;border-radius:16px;padding:18px;color:#172033;box-shadow:0 20px 60px #0005;';
    var title = window.document.createElement('div');
    title.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:17px;margin-bottom:12px;';
    title.innerHTML = '<span></span><span style="display:flex;gap:6px;align-items:center">'
      + '<button type="button" data-all="1" style="border:0;background:#17365f;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700">모두 처리 완료</button>'
      + '<button type="button" aria-label="닫기" style="border:0;background:#eef2f7;border-radius:8px;padding:6px 10px;cursor:pointer">닫기</button></span>';
    var titleText = title.querySelector('span');
    title.querySelector('[aria-label="닫기"]').onclick = function () { panel.remove(); };
    /* 「모두 처리 완료」 — 한 건씩 누르던 것을 한 번에 (대표 지시 2026-10-04 「처리완료 한번에 모두 클릭하는 버튼 만들어라」).
       ★ 창에 그린 30건이 아니라 «열린 장애 알림 전부»를 바꾼다 — 화면 밖 것이 남으면 창에 계속 걸린다.
       ★ 한 번의 update 로 쓴다 — 반쯤 되고 멈추는 일이 없다(전부 되거나 전부 안 된다).
       ⚠ 지우지 않는다 — 한 건씩과 같이 status 만 resolved 로 바꾼다. 기록은 남는다.
       (이제는 저절로 정리되므로 이 창에는 보통 아무것도 없다 — 정리 전의 것이 남았을 때를 위한 «손으로 하는 길».) */
    var allBtn = title.querySelector('[data-all]');
    if (!adminAlerts.length) allBtn.style.display = 'none';
    allBtn.onclick = function () {
      var items = adminAlerts.slice();
      if (!items.length) return;
      if (!window.confirm('장애 알림 ' + items.length + '건을 모두 «처리 완료»로 바꿉니다.\n(지우지 않습니다 — 기록은 남습니다)')) return;
      allBtn.disabled = true; allBtn.textContent = '처리 중…';
      app.database().ref().update(resolveAllPatch(items, Date.now(), app.auth().currentUser.uid)).then(function () {
        adminAlerts = adminAlerts.filter(function (x) { return !items.some(function (y) { return y.uid === x.uid && y.id === x.id; }); });
        panel.remove();
      }).catch(function () {
        // 못 바꿨으면 다시 누를 수 있어야 한다 — 영영 잠긴 단추를 남기지 않는다
        allBtn.disabled = false; allBtn.textContent = '처리 실패 — 다시';
      });
    };
    box.appendChild(title);
    if (!adminAlerts.length) {
      var empty = window.document.createElement('p'); empty.textContent = '처리할 장애 알림이 없습니다.'; box.appendChild(empty);
    }
    // 창에 실제로 그려 넣은 줄 수 — 마지막 한 줄을 처리하면 «닫기»만 남은 빈 창을 남기지 않는다.
    // adminAlerts 는 서버 청취기가 뒤늦게 갱신하므로 세어서 쓸 수 없다.
    var shown = adminAlerts.slice(0, 30);
    var left = shown.length;
    titleText.textContent = '시스템 장애 알림 (' + adminAlerts.length + ')';
    shown.forEach(function (item) {
      var row = window.document.createElement('div');
      row.style.cssText = 'border:1px solid #dce3ec;border-radius:10px;padding:11px;margin:8px 0;font-size:12px;line-height:1.5;';
      var when = new Date(Number(item.createdAt || 0)).toLocaleString('ko-KR');
      row.innerHTML = '<b>' + escapeHtml(item.page) + '</b> · ' + escapeHtml(item.kind) + '<br>' + escapeHtml(item.message) + '<br><small>' + escapeHtml(when) + ' · ' + escapeHtml(item.name || '이름 미확인') + '</small> ';
      var resolve = window.document.createElement('button');
      resolve.type = 'button'; resolve.textContent = '처리 완료';
      resolve.style.cssText = 'float:right;border:0;border-radius:7px;background:#17365f;color:#fff;padding:5px 9px;cursor:pointer;';
      resolve.onclick = function () {
        resolve.disabled = true;
        app.database().ref('systemAlerts/' + item.uid + '/' + item.id).update({ status: 'resolved', resolvedAt: Date.now(), resolvedBy: app.auth().currentUser.uid }).then(function () {
          row.remove();
          adminAlerts = adminAlerts.filter(function (x) { return !(x.uid === item.uid && x.id === item.id); });
          left -= 1;
          if (left <= 0) { panel.remove(); return; }   // 다 처리했으면 창도 함께 닫는다
          titleText.textContent = '시스템 장애 알림 (' + left + ')';
        }).catch(function () {
          // 못 지웠으면 다시 누를 수 있어야 한다 — 영영 잠긴 단추를 남기지 않는다
          resolve.disabled = false;
          resolve.textContent = '처리 실패 — 다시';
        });
      };
      row.appendChild(resolve); box.appendChild(row);
    });
    panel.onclick = function (event) { if (event.target === panel) panel.remove(); };
    panel.appendChild(box); window.document.body.appendChild(panel);
  }

  function escapeHtml(value) {
    var div = window.document.createElement('div'); div.textContent = String(value || ''); return div.innerHTML;
  }

  /* 총괄관리자(isAdmin)로 확인되면 쌓인 알림을 조용히 정리한다 — 화면에는 아무것도 만들지 않는다. */
  function monitorAdmin(app, user) {
    app.database().ref('uid_roles/' + user.uid).once('value').then(function (snapshot) {
      var role = snapshot.val() || {};
      if (!role.isAdmin) return;
      settleOpen(app);
    }).catch(function () {});
  }

  function bindApp(app) {
    if (!app || boundApps.indexOf(app) >= 0 || !app.auth || !app.database) return;
    boundApps.push(app);
    app.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      flush();
      monitorAdmin(app, user);
    });
  }

  function install() {
    if (!window.firebase) return false;
    (window.firebase.apps || []).forEach(bindApp);
    var original = window.firebase.initializeApp;
    if (typeof original === 'function' && !original.__puHealthWrapped) {
      var wrapped = function () { var app = original.apply(window.firebase, arguments); bindApp(app); return app; };
      wrapped.__puHealthWrapped = true;
      window.firebase.initializeApp = wrapped;
    }
    window.addEventListener('error', function (event) { enqueue('javascript', event.error || event.message, { detail: event.filename + ':' + event.lineno }); });
    window.addEventListener('unhandledrejection', function (event) { enqueue('promise', event.reason); });
    window.addEventListener('pu:save-state', function (event) { if (event.detail && event.detail.state === 'failed') enqueue('save', event.detail.error || '저장 자동복구 실패', event.detail); });
    window.addEventListener('online', flush);
    return true;
  }

  /* openAdminPanel — 사람이 직접 들여다보는 유일한 문. 포털 [⚙ 설정] 안의 「시스템 장애 알림」 줄이 이것을 부른다. */
  window.PUHealth = { install: install, report: enqueue, flush: flush, openAdminPanel: showAdminPanel, _readAdminAlerts: readAdminAlerts, _resolveAllPatch: resolveAllPatch, _flattenAlerts: flattenAlerts, _isNoise: isNoise, _settleOpen: settleOpen };
  install();
})(typeof window !== 'undefined' ? window : null);
