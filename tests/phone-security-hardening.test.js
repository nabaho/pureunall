'use strict';
/* 폰·모바일 전 구간 보안 점검 회귀 검사 (2026-11-11)
   실행: node --test tests/phone-security-hardening.test.js

   ■ 지키는 규칙
     ① 패스키 서버 함수(functions/passkey.js)는 로그인 시작·마무리에서 재직 상태를 다시 확인하고,
        분실·퇴사 시 관리자도 등록 기기를 조회·회수할 수 있다.
     ② 하나문자 다리(hanaMessageBridge + Android 앱)는 퇴사·권한 회수 시 403 으로 막고
        폰 안의 연결키·업무방 목록·문자 대기열·임시파일·주기 훑기를 한꺼번에 비우며, 8자리 연결번호 무차별 대입을 잠근다.
     ③ 푸시 알림(firebase-messaging-sw.js · push-admins · suggestion-push)은 같은 출처 /pureunall/ 만 열고
        중지·퇴직(retired·inactive 등) 관리자 계정을 제외한다.
     ④ 전체 로그아웃·계정 전환(pu-authsync.js · enter.html)은 빠른 복원 캐시와 공유 임시함(Cache·IndexedDB)을 비우고,
        포털 빠른 복원 사본을 영구 localStorage 에 남기지 않는다.
     ⑤ 푸른카메라(pu-camera.html)는 로그아웃·계정 전환·옆 탭 로그아웃 때 미리보기 줄과 메모를 즉시 비운다.
     ⑥ 모바일 외부 링크 화면(sign · sign-contract · ieum-view · clinic-intake)은 리퍼러·검색 색인을 막고,
        평문 민감정보 전역 노출과 외부 추적 이미지 삽입을 차단한다.
     ⑦ 폰 미러 도구(tools/phone-mirror.js)는 측정 직후 로컬 디버그 포트 포워딩을 반드시 닫는다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function cutBlock(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + ' 를 찾지 못했습니다');
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  assert.fail(head + ' 닫는 괄호가 없습니다');
}

/* ══ ① 패스키 서버 재직 확인 및 관리자 기기 회수 ══ */
test('★★ 패스키 로그인·기기 관리 — 퇴사·중지 계정은 막고 관리자 회수는 허용한다', async () => {
  const { makeStaffGate } = require('../functions/staff-gate.js');
  const passkeySrc = read('functions/passkey.js');
  const normSrc = cutBlock(passkeySrc, 'function normSid(s)');
  const activeSrc = cutBlock(passkeySrc, 'async function activeSidOk(');
  const manageSrc = cutBlock(passkeySrc, 'async function canManageDevices(');

  const roles = {
    U_ACT: { sid: 'P001', status: 'active' },
    U_RET: { sid: 'P002', status: 'retired' },
    U_ADM: { sid: 'P900', status: 'active', isAdmin: true },
    U_OTHER: { sid: 'P003', status: 'active' },
  };
  const gate = makeStaffGate({
    getDatabase: () => ({
      ref: (p) => ({
        once: async () => {
          const uid = String(p).replace(/^uid_roles\//, '');
          return { val: () => roles[uid] || null };
        },
      }),
    }),
  });
  const ctx = { STAFF_GATE: gate, String };
  vm.createContext(ctx);
  vm.runInContext(`${normSrc}\n${activeSrc}\n${manageSrc}`, ctx);

  assert.equal(await ctx.activeSidOk('U_ACT', 'p-001', gate), true, '재직 본인 사번은 통과해야 합니다');
  assert.equal(await ctx.activeSidOk('U_ACT', 'P999', gate), false, '사번이 다르면 막아야 합니다');
  assert.equal(await ctx.activeSidOk('U_RET', 'P002', gate), false, '퇴사 계정은 패스키 로그인에서 막혀야 합니다');

  const credsOfRet = [{ uid: 'U_RET', credId: 'c1' }];
  assert.equal(await ctx.canManageDevices({ uid: 'U_ADM', firebase: { sign_in_provider: 'password' } }, 'P002', credsOfRet, gate), true,
    '관리자는 퇴사자·분실폰 패스키를 조회·삭제할 수 있어야 합니다');
  assert.equal(await ctx.canManageDevices({ uid: 'U_OTHER', firebase: { sign_in_provider: 'password' } }, 'P002', credsOfRet, gate), false,
    '일반 직원은 남의 패스키를 볼 수 없어야 합니다');
  assert.equal(await ctx.canManageDevices({ uid: 'U_RET', firebase: { sign_in_provider: 'password' } }, 'P002', credsOfRet, gate), false,
    '퇴사 계정은 기기 관리도 막혀야 합니다');

  const barePasskey = stripJs(passkeySrc);
  const finishBody = barePasskey.slice(
    barePasskey.indexOf('exports.passkeyLoginFinish'),
    barePasskey.indexOf('exports.passkeyDevices')
  );
  const chkAt = finishBody.indexOf('activeSidOk(hit.uid, sid)');
  const tokAt = finishBody.indexOf('createCustomToken(');
  assert.ok(chkAt > 0 && chkAt < tokAt, '커스텀 토큰 발급 전에 재직 확인을 거쳐야 합니다');
});

/* ══ ② 하나문자 다리 서버·앱 권한 회수 및 연결번호 잠금 ══ */
test('★★ 하나문자 다리 — 권한 회수·퇴사 계정의 폰 요청을 403 으로 막고 기기를 비활성화한다', async () => {
  const idx = read('functions/index.js');
  const roleFn = cutBlock(idx, 'async function hanaStaffRoleOk(db, uid)');
  const reqFn = cutBlock(idx, 'async function requireHanaDevice(req, body)');

  const hanaHash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const hanaDeviceKey = (id) => hanaHash('dev:' + id).slice(0, 32);
  const hanaSafeEqual = (a, b) => a === b;

  const updates = [];
  const state = {
    roles: {
      U_FIN: { status: 'active', fin: true },
      U_LEFT: { status: 'retired', fin: true },
      U_NOFIN: { status: 'active', fin: false, isAdmin: false },
    },
    devices: {},
  };
  for (const u of ['U_FIN', 'U_LEFT', 'U_NOFIN']) {
    state.devices[u] = { [hanaDeviceKey('dev1')]: { tokenHash: hanaHash('secret-tok'), disabled: false } };
  }
  const fakeDb = {
    ref(p) {
      return {
        once: async () => {
          const mRole = /^uid_roles\/(.+)$/.exec(p);
          if (mRole) return { val: () => state.roles[mRole[1]] || null };
          const mDev = /^hanaSmsBridge\/devices\/([^/]+)\/([^/]+)$/.exec(p);
          if (mDev) return { val: () => (state.devices[mDev[1]] || {})[mDev[2]] || null };
          return { val: () => null };
        },
        update: async (u) => { updates.push([p, u]); },
        child: (c) => ({ set: async (v) => { updates.push([p + '/' + c, v]); } }),
      };
    },
  };
  const ctx = { getDatabase: () => fakeDb, hanaHash, hanaDeviceKey, hanaSafeEqual, String, Error, Date };
  vm.createContext(ctx);
  vm.runInContext(`${roleFn}\n${reqFn}`, ctx);

  const req = { headers: { authorization: 'Device secret-tok' } };
  const ok = await ctx.requireHanaDevice(req, { uid: 'U_FIN', deviceId: 'dev1' });
  assert.equal(ok.uid, 'U_FIN');

  for (const badUid of ['U_LEFT', 'U_NOFIN']) {
    await assert.rejects(
      ctx.requireHanaDevice(req, { uid: badUid, deviceId: 'dev1' }),
      (e) => e.status === 403,
      badUid + ' 기기가 계속 통과하면 안 됩니다'
    );
  }
  assert.ok(updates.some(([, u]) => u && u.disabled === true && u.lastReject && u.lastReject.reason === 'role_revoked'),
    '권한이 회수된 기기는 disabled 처리와 사유 기록이 남아야 합니다');

  const pairBranch = cutBlock(stripJs(idx), 'if (action === "pairClaim") {');
  assert.match(pairBranch, /HANA_PAIR_MAX_FAILS/, '연결번호 무차별 대입 제한이 있어야 합니다');
  assert.match(pairBranch, /hanaStaffRoleOk\(db,\s*pair\.uid\)/, '연결 시점에도 재직·재무 권한을 확인해야 합니다');
});

test('★★ 안드로이드 하나문자 앱 — 401/403 및 연결 지우기 시 업무방·문자대기열·임시파일까지 비운다', () => {
  const javaDir = 'android/hana-sms-bridge/app/src/main/java/kr/pureun/hanabridge/';
  const secure = stripJs(read(javaDir + 'SecureStore.java'));
  const upload = stripJs(read(javaDir + 'HanaUploadWorker.java'));
  const sweep = stripJs(read(javaDir + 'HanaSweepWorker.java'));
  const kakao = stripJs(read(javaDir + 'KakaoUploadWorker.java'));
  const main = stripJs(read(javaDir + 'MainActivity.java'));

  const clearAll = cutBlock(secure, 'static void clearAll(');
  assert.match(clearAll, /clearConnection\(context\)/);
  assert.match(clearAll, /KakaoRooms\.clear\(context\)/);
  assert.match(clearAll, /KakaoUploadWorker\.clearPending\(context\)/);
  assert.match(clearAll, /VisitSmsSender\.clear\(context\)/);
  assert.match(clearAll, /HanaSweepWorker\.cancel\(context\)/);

  assert.match(upload, /catch\s*\(UnauthorizedException[\s\S]{0,120}?SecureStore\.clearAll\(context\)/);
  assert.match(sweep, /catch\s*\(HanaUploadWorker\.UnauthorizedException[\s\S]{0,140}?SecureStore\.clearAll\(context\)/);
  assert.match(kakao, /catch\s*\(HanaUploadWorker\.UnauthorizedException[\s\S]{0,160}?SecureStore\.clearAll\(context\)/);
  assert.match(kakao, /matches\("\^\[A-Za-z0-9\._-\]/, '카톡 임시파일 이름 경로 이탈 방지가 있어야 합니다');
  assert.match(main, /SecureStore\.clearAll\(this\)/);
  assert.match(main, /IMPORTANT_FOR_AUTOFILL_NO/, '일회용 연결번호 입력칸 자동완성 저장을 막아야 합니다');
});

/* ══ ③ 푸시 알림 주소 검증 및 중지·퇴직 관리자 제외 ══ */
test('★★ 웹푸시 서비스워커 — 같은 출처 /pureunall/ 만 열고 외부 주소는 기본 포털로 되돌린다', () => {
  const swSrc = read('firebase-messaging-sw.js');
  const fnSrc = cutBlock(swSrc, 'function safePortalUrl(');
  const ctx = {
    PORTAL_URL: '/pureunall/enter.html?sg=1',
    self: { location: { origin: 'https://nabaho.github.io' } },
    URL, String,
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx);

  assert.equal(ctx.safePortalUrl('/pureunall/pu-cards.html?mailbox=1'), 'https://nabaho.github.io/pureunall/pu-cards.html?mailbox=1');
  assert.equal(ctx.safePortalUrl('https://evil.example/phish'), 'https://nabaho.github.io/pureunall/enter.html?sg=1');
  assert.equal(ctx.safePortalUrl('//evil.example/pureunall/enter.html'), 'https://nabaho.github.io/pureunall/enter.html?sg=1');
  assert.equal(ctx.safePortalUrl('javascript:alert(1)'), 'https://nabaho.github.io/pureunall/enter.html?sg=1');
  assert.equal(ctx.safePortalUrl('/other-repo/index.html'), 'https://nabaho.github.io/pureunall/enter.html?sg=1');
});

test('★ 관리자 푸시 대상 — retired·inactive·suspended 계정은 빼고 active·기존 관리자만 남긴다', async () => {
  const { adminUids } = require('../functions/push-admins.js');
  const SGP = require('../functions/suggestion-push.js');
  const roles = {
    U_ACT: { isAdmin: true, status: 'active' },
    U_LEGACY: { isAdmin: true },
    U_RET: { isAdmin: true, status: 'retired' },
    U_INACT: { isAdmin: true, status: 'inactive' },
    U_RES: { isAdmin: true, status: 'resigned' },
  };
  const db = {
    ref(p) {
      return {
        once: async () => {
          if (p === 'uid_roles') {
            return {
              forEach(cb) { Object.keys(roles).forEach((k) => cb({ key: k, val: () => roles[k] })); },
            };
          }
          const m = /^uid_roles\/(.+)$/.exec(p);
          return { val: () => (m ? roles[m[1]] : null) };
        },
      };
    },
  };
  const uids = await adminUids(db);
  assert.deepEqual(uids.sort(), ['U_ACT', 'U_LEGACY']);

  const rRet = await SGP.onWatchNotice(
    { val: () => ({ kind: 'human', text: '점검' }) },
    { params: { id: 'S1', nid: 'N1' }, auth: { uid: 'U_RET' } },
    { db, messaging: { sendEachForMulticast: async () => ({ successCount: 0, failureCount: 0, responses: [] }) }, catName: {} }
  );
  assert.equal(rRet.skipped, 'not-trusted');
});

/* ══ ④ 전체 로그아웃·공유 임시함 정리 및 포털 빠른 복원 검증 ══ */
test('★★ PuAuthSync·공유 워커 — 로그아웃 시 공유 캐시·IndexedDB·빠른복원 키를 모두 비운다', () => {
  const src = read('js/pu-authsync.js');
  const deletedCaches = [];
  const deletedIdbs = [];
  const local = {
    pu_auth_uid: 'U1',
    pureun_v6_autologin_sid: 'P001',
    pu_portal_fast_acct: '{"uid":"U1"}',
    pu_auth_hint: '1',
    pu_sid_guard_known: '1',
  };
  const session = {
    pureun_v6_session_sid: 'P001',
    pu_portal_fast_acct: '{"uid":"U1"}',
    pu_auth_hint: '1',
    pu_open_camera: '{"mode":"card"}',
  };
  const g = {
    PU_AUTHSYNC_GRACE_MS: 0,
    caches: { delete: (n) => { deletedCaches.push(n); } },
    indexedDB: { deleteDatabase: (n) => { deletedIdbs.push(n); } },
    localStorage: { getItem: (k) => local[k] || null, setItem: (k, v) => { local[k] = String(v); }, removeItem: (k) => { delete local[k]; } },
    sessionStorage: { getItem: (k) => session[k] || null, setItem: (k, v) => { session[k] = String(v); }, removeItem: (k) => { delete session[k]; } },
    document: { createElement: () => ({ style: {}, appendChild() {} }), body: { appendChild() {} }, addEventListener() {} },
    location: { replace() {}, reload() {} },
    addEventListener() {}, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Date, String, Number, Object, console,
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(src, g);
  g.PuAuthSync.broadcastLogout();

  assert.equal(local.pu_portal_fast_acct, undefined);
  assert.equal(session.pu_portal_fast_acct, undefined);
  assert.equal(session.pu_open_camera, undefined);
  assert.deepEqual(deletedCaches, ['pucards-share']);
  ['pu-photos-share', 'pu-paydata-share', 'pu-viewer-share', 'pu-handoff'].forEach((dbName) => {
    assert.ok(deletedIdbs.includes(dbName), dbName + ' 공유함을 비워야 합니다');
  });

  assert.match(stripJs(read('pu-sw.js')), /await caches\.delete\('pucards-share'\);\s*var cache = await caches\.open\('pucards-share'\)/);
  assert.match(stripJs(read('pu-cards-sw.js')), /await caches\.delete\('pucards-share'\);\s*const cache = await caches\.open\('pucards-share'\)/);
});

test('★★ 포털 빠른 복원(_instantReturnFromApp) — 영구 localStorage 저장을 금하고 계정 불일치·퇴사·만료를 차단한다', () => {
  const enter = read('enter.html');
  const bareEnter = stripJs(enter);
  assert.doesNotMatch(bareEnter, /localStorage\.setItem\(['"]pu_portal_fast_acct['"]/,
    '빠른 복원 프로필을 영구 localStorage 에 저장하면 안 됩니다');

  const fnSrc = cutBlock(enter, 'function _instantReturnFromApp()');
  function runRestore(sessionAcct, localUid, logoutAt) {
    const session = { pu_auth_hint: '1', pu_portal_fast_acct: JSON.stringify(sessionAcct) };
    const local = {};
    if (localUid) local.pu_auth_uid = localUid;
    if (logoutAt) local.pu_auth_logout_at = String(logoutAt);
    let rendered = 0;
    const ctx = {
      _handled: false, _portalReady: false, _portalUid: '', _kkLoginStarting: false,
      window: {},
      sessionStorage: { getItem: (k) => session[k] || null, removeItem: (k) => { delete session[k]; } },
      localStorage: { getItem: (k) => local[k] || null },
      renderPortal: () => { rendered++; },
      $: () => ({ style: {} }),
      _rmBootSplash: () => {},
      JSON, Number, String, Date,
    };
    vm.createContext(ctx);
    vm.runInContext(`(${fnSrc})();`, ctx);
    return { rendered, kept: !!session.pu_portal_fast_acct };
  }

  const now = Date.now();
  assert.equal(runRestore({ uid: 'U1', acct: { sid: 'P001', status: 'active' }, at: now }, 'U1', 0).rendered, 1, '본인 재직 사본은 즉시 복원되어야 합니다');
  const switched = runRestore({ uid: 'U1', acct: { sid: 'P001', status: 'active' }, at: now }, 'U2', 0);
  assert.equal(switched.rendered, 0, '옆 탭에서 다른 계정으로 바뀌었으면 앞사람 타일을 그리면 안 됩니다');
  assert.equal(switched.kept, false, '불일치 사본은 즉시 지워야 합니다');
  assert.equal(runRestore({ uid: 'U1', acct: { sid: 'P001', status: 'retired' }, at: now }, 'U1', 0).rendered, 0, '비재직 사본은 복원하면 안 됩니다');
  assert.equal(runRestore({ uid: 'U1', acct: { sid: 'P001', status: 'active' }, at: now - 13 * 3600 * 1000 }, 'U1', 0).rendered, 0, '오래된 사본은 폐기해야 합니다');
});

/* ══ ⑤ 푸른카메라 로그아웃·계정 전환 시 미리보기 줄 즉시 소거 ══ */
test('★★ 푸른카메라 — 로그아웃·옆 탭 로그아웃 때 찍어 둔 미리보기와 메모를 즉시 비운다', async () => {
  const cam = read('pu-camera.html');
  const part = cam.match(/<script data-part="app"[^>]*>([\s\S]*?)<\/script>/)[1];
  const el = {};
  const mk = (id) => (el[id] = el[id] || {
    id, style: {}, textContent: '', innerHTML: '', value: '', disabled: false,
    classList: { add() {}, remove() {} }, videoWidth: 1920, videoHeight: 1080, addEventListener() {},
  });
  const local = { pu_auth_uid: 'U1' };
  let authCb = null, signedOut = 0;
  const ctx = {
    console: { warn() {} },
    Date, Math, Number, String, Object, Array, JSON, Promise,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    localStorage: { getItem: (k) => local[k] || null },
    document: { hidden: false, getElementById: mk, addEventListener() {}, createElement: () => ({
      width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,QUJD',
    }) },
    window: { addEventListener() {} },
    location: { href: '' },
    navigator: { mediaDevices: { getUserMedia: () => Promise.reject(new Error('없음')), enumerateDevices: () => Promise.resolve([]) } },
    PuPhotoStore: {
      init() {}, signIn: () => Promise.resolve({ name: '권형하' }),
      uploadSpec: () => ({ maxEdge: 1600, quality: 0.85, thumbEdge: 240 }),
      newId: () => 'p1', myName: () => '권형하', photoYear: () => '2026',
      savePhoto: () => Promise.resolve(), deletePhoto: () => Promise.resolve(),
    },
    firebase: {
      initializeApp() {}, database: () => ({}), storage: () => ({}),
      auth: () => ({ onAuthStateChanged: (cb) => { authCb = cb; }, signOut: () => { signedOut++; return Promise.resolve(); } }),
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(part, ctx);

  authCb({ uid: 'U1', email: 'p001@pureun.kr' });
  await new Promise((r) => setImmediate(r));
  vm.runInContext('memo = "현장메모"; shoot();', ctx);
  await new Promise((r) => setImmediate(r));
  assert.equal(vm.runInContext('shots.length', ctx), 1);

  local.pu_auth_logout_at = String(Date.now() + 100);
  const kicked = vm.runInContext('syncCameraLogoutFromPortal()', ctx);
  assert.equal(kicked, true, '포털 로그아웃 신호를 받으면 카메라 세션도 끊어야 합니다');
  assert.equal(vm.runInContext('shots.length', ctx), 0, '앞사람 사진 미리보기가 남으면 안 됩니다');
  assert.equal(vm.runInContext('memo', ctx), '', '앞사람 메모가 남으면 안 됩니다');
  assert.equal(el.stripRow.innerHTML, '');
  assert.equal(signedOut, 1);
});

/* ══ ⑥ 모바일 외부 링크 화면 리퍼러·전역 노출·이미지 출처 차단 ══ */
test('★★ 외부 링크 화면 — no-referrer·noindex 를 갖추고 평문 전역 노출·외부 추적 이미지를 막는다', () => {
  for (const f of ['sign.html', 'sign-contract.html', 'ieum-view.html', 'clinic-intake.html']) {
    const html = read(f);
    assert.match(html, /<meta name="referrer" content="no-referrer">/i, f + ' 에 no-referrer 가 없습니다');
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/i, f + ' 에 noindex 가 없습니다');
  }
  const signJs = stripJs(read('sign.html'));
  assert.doesNotMatch(signJs, /window\._myCopy/, '전자위임장 평문 제출본을 전역 window 에 노출하면 안 됩니다');

  const contractHtml = read('sign-contract.html');
  const safePageFn = cutBlock(contractHtml, 'function safePageSrc(');
  const ctx = { location: { origin: 'https://nabaho.github.io' }, URL, String };
  vm.createContext(ctx);
  vm.runInContext(safePageFn, ctx);

  assert.ok(ctx.safePageSrc('data:image/png;base64,QUJD') !== '');
  assert.ok(ctx.safePageSrc('https://firebasestorage.googleapis.com/v0/b/pureun-erp/o/a.png') !== '');
  assert.equal(ctx.safePageSrc('https://evil.example/pixel.png'), '');
  assert.equal(ctx.safePageSrc('javascript:alert(1)'), '');
  assert.equal(ctx.safePageSrc('data:image/svg+xml;base64,PHN2Zz4='), '');
});

/* ══ ⑦ 폰 미러 디버그 통로 즉시 해제 ══ */
test('★ 폰 미러(tools/phone-mirror.js) — 측정 뒤 로컬 디버그 포트 포워딩을 finally 에서 제거한다', () => {
  const mirror = stripJs(read('tools/phone-mirror.js'));
  const fn = cutBlock(mirror, 'async function 재기(');
  assert.match(fn, /finally\s*\{[\s\S]*?'forward',\s*'--remove'/, '측정 뒤 tcp:9222 포워딩을 닫아야 합니다');
  const measureTab = cutBlock(mirror, 'async function 탭재기(');
  assert.match(measureTab, /127\\\.0\\\.0\\\.1\|localhost/, '로컬 디버그 웹소켓 주소인지 확인해야 합니다');
});
