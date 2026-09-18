'use strict';
/* 「닿지 못했습니다」의 «어느 쪽인가»를 우리가 알아낸다 (대표 화면 2026-09-18 둘째)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     대표님이 나스 인증서를 브라우저에 받으신 «뒤에도» 연결 테스트가 실패했다.
     그런데 화면이 내놓은 것은 ①인증서 ②CORS ③사무실 밖 ④수동 백업 —
     **네 가지를 늘어놓고 고르라**는 것이었다. ①을 이미 하신 분께 같은 넷을 또 보이는 것은
     안내가 아니다. 실행 로그에 똑같은 넷이 두 번 찍혀 있었다(5:55:54 · 5:55:59).
   ■ 까닭
     브라우저의 fetch 는 인증서를 안 믿어도, CORS 가 막아도, 사무실 밖이어도
     **똑같이 'Failed to fetch'** 다. 우리 코드가 아무것도 모르니 사람에게 떠넘겼다.
   ■ 가르는 길 — 표시 둘
     ① mode:'no-cors' 로 한 번 더 두드린다 — 응답이 «오면»(opaque) TLS 도 서버도 멀쩡하다
        → 막은 것은 CORS 하나다. (opaque 는 읽을 수 없지만 «왔다»는 사실만 쓰면 된다)
     ② 얼마나 «빨리» 튕겼는가 — 브라우저가 막은 것은 몇 백 ms, 없는 서버는 끝까지 기다린다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 두드릴 때 mode 는 'no-cors' 다 — 아니면 CORS 가 또 막아 아무것도 못 가린다
     ② 응답이 오면 «CORS 하나»라고 말한다 — 인증서를 다시 의심하지 않는다
     ③ 빨리 튕기면 «서버는 거기 있다»고 말한다 — 사무실 밖 이야기를 꺼내지 않는다
     ④ 오래 기다렸으면 «사무실 밖»을 먼저 말한다
     ⑤ 가른 뒤에는 남은 것만 말한다 — 어느 갈래도 넷을 다시 늘어놓지 않는다
     ⑥ 사설망(PNA) 줄이 CORS 안내에 «함께» 있다 — 한 줄만 넣으면 넣고도 막힌다
     ⑦ 되짚기가 실패해도 연결 테스트를 망가뜨리지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

function load(fetchImpl) {
  const src = [
    'var NAS_FAST_FAIL_MS = 3000;',
    'function nasBaseOf(cfg){ return "https://192.168.0.21:5001"; }',
    'function fetchT(u, o, ms){ return __fetch(u, o, ms); }',
    cutFn(ERP, 'function nasReachProbe('),
    cutFn(ERP, 'function nasReachVerdict('),
  ].join('\n');
  const calls = [];
  const ctx = {
    __fetch: (u, o, ms) => { calls.push({ u, o, ms }); return fetchImpl(u, o, ms); },
    Date, Math, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, calls };
}

test('①★★ 두드릴 때 mode 는 no-cors 다 — 아니면 CORS 가 또 막아 아무것도 못 가린다', async () => {
  const { ctx, calls } = load(() => Promise.resolve({}));
  await ctx.nasReachProbe({});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].o.mode, 'no-cors',
    '★★ 보통 fetch 로 두드리면 CORS 가 또 막는다 — 그러면 되짚기가 늘 「못 닿음」이라 답해 쓸모가 없다');
  assert.equal(calls[0].o.credentials, 'omit', '★ 비밀번호·쿠키를 들려 보낼 까닭이 없다');
  assert.match(calls[0].u, /^https:\/\/192\.168\.0\.21:5001\//, '★ 설정된 주소로 두드려야 한다');
});

test('②★ 응답이 오면 «CORS 하나»라고 말한다 — 인증서를 다시 의심하지 않는다', async () => {
  const { ctx } = load(() => Promise.resolve({}));
  const r = await ctx.nasReachProbe({});
  assert.equal(r.kind, 'cors');
  const msg = ctx.nasReachVerdict(r, 'https://192.168.0.21:5001', 'https://nabaho.github.io');
  assert.match(msg, /이미 믿고/, '★★ 인증서를 하신 분께 또 인증서를 말하면 대표 화면이 그대로 되풀이된다');
  assert.match(msg, /사용자 정의 헤더/, '★ 어디를 눌러야 하는지가 없으면 원인만 알고 못 고친다');
  assert.match(msg, /https:\/\/nabaho\.github\.io/, '★ 지금 이 화면의 주소를 넣어 줘야 한다 — 옛 주소를 박으면 시킨 대로 해도 안 된다');
  assert.doesNotMatch(msg, /사무실 «밖»/, '★ 가른 뒤에 안 해당하는 갈래를 또 말하면 가른 뜻이 없다');
});

test('③★ 빨리 튕기면 «서버는 거기 있다» — 사무실 밖 이야기를 꺼내지 않는다', async () => {
  const { ctx } = load(() => Promise.reject(new Error('Failed to fetch')));
  const r = await ctx.nasReachProbe({});
  assert.equal(r.kind, 'blocked', '★ 즉시 튕긴 것을 「없는 서버」라 하면 사무실 안에서 밖을 찾게 만든다');
  const msg = ctx.nasReachVerdict(r, 'https://192.168.0.21:5001', 'https://nabaho.github.io');
  assert.match(msg, /거기 있습니다/);
  assert.match(msg, /인증서/);
  assert.match(msg, /사설망/, '★ 크롬의 사설망 차단이 이 갈래의 절반이다');
  assert.match(msg, /chrome:\/\/flags/, '★★ 「사설망 차단입니다」로 끝내면 받는 사람은 끌 자리를 못 찾는다 — 붙여넣을 것을 준다');
  assert.doesNotMatch(msg, /사무실 «밖»/);
});

test('④ 오래 기다렸으면 «사무실 밖»을 먼저 말한다', async () => {
  let now = 1000;
  const { ctx } = load(() => { now += 12000; return Promise.reject(new Error('timeout')); });
  ctx.Date = Object.assign(function () { return new Date(now); }, { now: () => now });
  vm.runInContext('Date = __D;', Object.assign(ctx, { __D: ctx.Date }));
  const r = await ctx.nasReachProbe({});
  assert.equal(r.kind, 'silent', '★ 12초를 기다린 것을 「브라우저가 막았다」고 하면 엉뚱한 곳을 뒤진다');
  const msg = ctx.nasReachVerdict(r, 'https://192.168.0.21:5001', 'https://x');
  assert.match(msg, /사무실 «밖»/);
  assert.match(msg, /백업 파일 다운로드/, '★ 어느 쪽이든 늘 되는 길은 남겨 둔다');
  assert.doesNotMatch(msg, /이미 믿고/);
});

test('⑤★ 가른 뒤에는 «한 갈래»만 말한다 — 셋을 다시 늘어놓지 않는다', () => {
  const { ctx } = load(() => Promise.resolve({}));
  const 갈래 = [{ kind: 'cors', ms: 300 }, { kind: 'blocked', ms: 200 }, { kind: 'silent', ms: 12000 }];
  갈래.forEach(r => {
    const msg = ctx.nasReachVerdict(r, 'https://192.168.0.21:5001', 'https://x');
    const 번호 = (msg.match(/[①②③④]/g) || []).length;
    assert.ok(번호 <= 2, '★★ 가르고 나서도 번호가 셋 넘게 붙으면 대표 화면과 똑같다 (' + r.kind + ' → ' + 번호 + '개)');
    assert.match(msg, /^🔎/, '★ 되짚은 결과임이 눈에 보여야 앞의 나열과 안 섞인다');
  });
});

test('⑥★ CORS 안내에 사설망(PNA) 줄이 «함께» 있다 — 한 줄만 넣으면 넣고도 막힌다', () => {
  const guide = ERP.slice(ERP.indexOf('NAS 연결 실패 시 해결 방법 (CORS)'));
  const head = guide.slice(0, guide.indexOf('[방법 2]'));
  assert.match(head, /Access-Control-Allow-Origin/);
  assert.match(head, /Access-Control-Allow-Private-Network: true/,
    '★★ 크롬은 «공개 사이트 → 사설망» 을 CORS 와 따로 막는다 — 첫 줄만 시키면 「시킨 대로 했는데 안 된다」가 된다');
});

test('⑦ 되짚기가 실패해도 연결 테스트를 망가뜨리지 않는다', () => {
  const t = cutFn(ERP, 'function doTest(');
  assert.match(t, /nasReachProbe\(cfg\)/, '★ 연결 테스트가 되짚지 않으면 이 길은 아무도 안 쓴다');
  assert.match(t, /nasReachProbe\(cfg\)[\s\S]{0,200}\.catch\(function\(\)\{\}\)/,
    '★★ 되짚다 터지면 연결 테스트 전체가 깨진다 — 덧붙이는 말이 본 일을 망치면 안 된다');
  assert.ok(t.indexOf("addLog('❌ 연결 실패") < t.indexOf('nasReachProbe'),
    '★ 실패했다는 말이 먼저 나와야 한다 — 되짚기는 그 다음이다');
  const 문 = t.indexOf("err.message !== 'Failed to fetch'");
  assert.ok(문 > -1 && 문 < t.indexOf('nasReachProbe') && /return;/.test(t.slice(문, t.indexOf('nasReachProbe'))),
    '★ 로그인 거절(아이디·비밀번호 틀림)에까지 「못 닿았다」를 되짚으면 엉뚱한 말을 한다');
});

test('⑧★★ 갈래마다 «지금 바로 되는 길»을 함께 준다 — 원인만 알려 주고 끝내지 않는다', () => {
  const { ctx } = load(() => Promise.resolve({}));
  [{ kind: 'cors', ms: 300 }, { kind: 'blocked', ms: 200 }, { kind: 'silent', ms: 12000 }].forEach(r => {
    const msg = ctx.nasReachVerdict(r, 'https://192.168.0.21:5001', 'https://x');
    assert.match(msg, /지금 바로 되는 길/,
      '★★ 원인을 알아도 할 일이 없으면 받는 사람은 그대로 멈춘다 (' + r.kind + ')');
    assert.match(msg, /백업 파일 다운로드/, '★ 늘 되는 길은 화면에 «있는 단추» 이름으로 말해야 찾는다');
  });
});
