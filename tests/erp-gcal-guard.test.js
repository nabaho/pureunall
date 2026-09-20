/* ══ 【4걸음 알림 — 살린다】 ════════════════════════════════════
   ★ 여쭌 결과 «옮긴다»(대표 지시 2026-09-20). 구글 쓰기 얼개는 공용 모듈
     js/pu-gcal-auth.js 로 옮겼고, 이알피는 그것을 부른다 — 그래서 이 파일은 4걸음
     뒤에도 «살아 있다»(이알피의 길이 끝까지 도는지 그대로 본다).
     ⚠ 토큰 받는 자리를 대시보드 밖으로 뺐다 — 안 그러면 보수총액 Gmail 발송이 함께 죽는다.
     같은 규칙을 모듈 쪽에서 재는 검사: tests/gcal-auth.test.js
   (캘린더를 한 곳으로 모으기 — status/2026-09-20-cal-tests-move.md)
   ════════════════════════════════════════════════════════════════════ */
'use strict';
// 구글 캘린더 — 로그인 확인과 실패 처리 — node --test tests/erp-gcal-guard.test.js
//
// 왜: ① 로그인 전에 부르면 'Bearer undefined' 가 나갔다. Gmail 쪽은 미리 확인하는데
//        캘린더만 안 했다 — 사람에게는 아무 말도 없이 그냥 실패했다.
//     ② 구글이 돌려준 401·404 의 «본문»이 그대로 콜백으로 넘어갔다. 부른 쪽은 그것을
//        성공한 자료로 받는다 — 삭제 화면은 안 지워졌는데도 「🗑️ 삭제됨」이라고 말했다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name){
  const i = app.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾지 못했다');
  let d = 0, j = i;
  for(;;j++){ if(app[j] === '{') d++; else if(app[j] === '}'){ d--; if(!d){ j++; break; } } }
  return app.slice(i, j);
}

function load(opts){
  opts = opts || {};
  const box = {
    toasts: [], calls: [], cbArgs: [],
    showToast(m){ box.toasts.push(m); },
    gcalHasToken(){ return !!opts.token; },
    window: { _gcalToken: opts.token ? 'tok' : undefined },
    Error, Promise, JSON, String,
    fetchT(url, o){
      box.calls.push({ url:url, auth:(o.headers||{}).Authorization });
      const r = opts.reply || { status:200, ok:true, body:{ id:'ev1' } };
      return Promise.resolve({
        status: r.status, ok: r.ok !== false,
        json(){ return Promise.resolve(r.body); }
      });
    }
  };
  /* ★ 2026-09-20 — 대답을 해석하는 «셈»이 공용 모듈(js/pu-gcal-auth.js)로 옮겨졌다.
     그래서 상자에 그 모듈을 «진짜로» 넣어 준다. 흉내 낸 가짜를 넣으면 이알피가
     실제로 무엇을 받는지 못 보게 된다 — 그러면 이 검사가 헛돈다.
     ⚠ 모듈은 fetchT 가 아니라 fetch 를 쓴다(창 밖에서도 돌게). 여기서 이어 준다. */
  const PuGcalAuth = require(require('node:path').join(__dirname, '..', 'js', 'pu-gcal-auth.js'));
  box.PuGcalAuth = {
    hasToken: () => !!opts.token,
    apiCall: (m, p, b) => PuGcalAuth.apiCall(m, p, b, {
      fetch: (url, o) => box.fetchT(url, o)
    })
  };
  /* 모듈이 토큰을 보게 한다 — 판정은 위 hasToken 이 하지만 머리글에 실제로 실린다 */
  globalThis._gcalToken = opts.token ? 'tok' : '';
  globalThis._gcalExpiry = opts.token ? (Date.now() + 600000) : 0;
  vm.createContext(box);
  vm.runInContext(grab('gcalApiCall') + '\nthis.f = gcalApiCall;', box);
  return box;
}
const flush = () => new Promise(r => setImmediate(() => setImmediate(r)));

/* ── ① 로그인 확인 ── */
test('★ 로그인 전에는 아예 부르지 않는다', async () => {
  const b = load({ token:false });
  b.f('DELETE', '/x', null, function(){ b.cbArgs.push('불렸음'); });
  await flush();
  assert.equal(b.calls.length, 0, "'Bearer undefined' 를 보내면 안 된다");
  assert.deepEqual(Array.from(b.cbArgs), [], '실패는 cb 를 «안 부르는 것»으로 알린다');
});

test('무엇을 해야 하는지 말해 준다', async () => {
  const b = load({ token:false });
  b.f('GET', '/x', null, function(){});
  await flush();
  assert.equal(b.toasts.length, 1);
  assert.match(b.toasts[0], /구글 로그인이 필요합니다/);
  assert.match(b.toasts[0], /\[구글 로그인\]을 눌러 주세요/, '어디를 눌러야 하는지까지');
});

test('로그인돼 있으면 그대로 부른다', async () => {
  const b = load({ token:true });
  b.f('GET', '/x', null, function(d){ b.cbArgs.push(d); });
  await flush();
  assert.equal(b.calls.length, 1);
  assert.equal(b.calls[0].auth, 'Bearer tok');
  assert.equal(b.cbArgs[0].id, 'ev1');
});

/* ── ② 실패를 성공으로 넘기지 않는다 ── */
test('★ 401 본문을 자료인 척 넘기지 않는다 (「삭제됨」 거짓말의 원인)', async () => {
  const b = load({ token:true, reply:{ status:401, ok:false, body:{ error:{ code:401, message:'Invalid Credentials' } } } });
  b.f('DELETE', '/x', null, function(){ b.cbArgs.push('불렸음'); });
  await flush();
  assert.deepEqual(Array.from(b.cbArgs), [], '부르면 그 뒤 줄이 성공인 양 이어진다');
  assert.match(b.toasts[0], /구글 캘린더 오류/);
  assert.match(b.toasts[0], /Invalid Credentials/, '구글이 한 말을 그대로 전한다');
});

test('★ 200 인데 본문에 error 가 있어도 실패로 본다', async () => {
  const b = load({ token:true, reply:{ status:200, ok:true, body:{ error:{ message:'quota' } } } });
  b.f('GET', '/x', null, function(){ b.cbArgs.push('불렸음'); });
  await flush();
  assert.deepEqual(Array.from(b.cbArgs), []);
  assert.match(b.toasts[0], /quota/);
});

test('메시지가 없으면 상태 번호라도 알려 준다', async () => {
  const b = load({ token:true, reply:{ status:404, ok:false, body:{} } });
  b.f('GET', '/x', null, function(){});
  await flush();
  assert.match(b.toasts[0], /HTTP 404/);
});

test('지웠을 때(204)는 본문이 없어도 성공이다', async () => {
  const b = load({ token:true, reply:{ status:204, ok:true, body:null } });
  b.f('DELETE', '/x', null, function(d){ b.cbArgs.push(d); });
  await flush();
  assert.equal(b.cbArgs.length, 1, '204 를 실패로 보면 삭제가 안 된 것처럼 된다');
  assert.deepEqual(Object.keys(b.cbArgs[0]), []);
});

/* ── 부른 쪽이 기다리는 곳은 따로 막는다 ── */
test('★ 일정 옮기기는 스스로 확인하고 «못 했다»고 알린다', () => {
  // gcalApiCall 은 실패하면 cb 를 안 부르는데, 여기는 부른 쪽이 cb 를 기다린다
  const m = grab('moveGcalEventToDate');
  assert.match(m, /if\(!gcalHasToken\(\)\)\{/);
  assert.match(m, /일정은 옮기지 못했습니다/);
  assert.match(m, /cb && cb\(false\); return;/);
  assert.ok(m.indexOf('if(!gcalHasToken()){') < m.indexOf("gcalApiCall('GET'"), '부르기 전에 막아야 한다');
});

test('ERP 쪽 삭제는 구글 로그인과 상관없이 이어진다', () => {
  // 구글에 안 붙은 건까지 못 지우면 더 나쁘다 — 종전 판단을 그대로 둔다
  const d = grab('gcalDeleteIfLinked');
  assert.match(d, /if\(!gcalAuthed \|\| !gcalEventId \|\| !GCAL_CAL_ID\) \{ cb && cb\(\); return; \}/);
});

/* ── 다른 데는 이미 하고 있었다 ── */
test('Gmail 은 원래 확인하고 있었다 (같은 방식으로 맞춘 것)', () => {
  assert.match(app, /if\(!window\._gcalToken \|\| Date\.now\(\) >= \(window\._gcalExpiry\|\|0\)-60000\)\{/);
  assert.match(app, /Google 로그인 필요 - 인증 후 다시 실행하세요/);
});

test('토큰 판정은 한 곳에서 (만료까지 함께 본다)', () => {
  /* ★ 2026-09-20 — 판정하는 «셈»이 공용 모듈(js/pu-gcal-auth.js)로 옮겨졌다.
     예전에는 여기서 그 한 줄을 글자 그대로 박아 두었는데, 옮기고 나니 깨졌다.
     지킬 것은 «그 줄의 생김새»가 아니라 «판정이 한 곳인가»다 —
     지금은 두 앱(이알피·푸른 캘린더)이 같은 모듈을 부르므로 더 잘 지켜진다.
     만료 1분 전 처리까지 실제로 돌려 보는 검사는 tests/gcal-auth.test.js ⑤ 에 있다. */
  assert.match(app, /function gcalHasToken\(\)\{[^}]*PuGcalAuth\.hasToken\(\)/,
    '토큰 판정을 이알피가 따로 합니다 — 공용 모듈에 맡겨야 두 앱이 안 갈립니다');
  assert.match(grab('gcalApiCall'), /if\(!gcalHasToken\(\)\)\{/, '따로 판정하면 어긋난다');
});
