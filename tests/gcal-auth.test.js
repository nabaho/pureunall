/* 구글에 «쓰는» 길 — 공용 모듈 js/pu-gcal-auth.js (3걸음-나)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 — 3걸음 끝에 여쭌 「구글 쓰기를 옮길까 없앨까」에 «옮긴다».

   ★ 왜 옮겼나
     이 길이 이알피 «법인 대시보드 안»에만 있었다. 4걸음에서 그 화면을 걷어내면
     두 가지가 함께 죽는다 —
       ① 우리 일정을 지울 때 구글 쪽 일정도 지우는 일 (지금 이어진 근태 30건)
       ② 보수총액신고 «Gmail 자동발송» — 달력과 상관없는데 같은 토큰을 빌려 썼다
     그래서 토큰 받는 자리까지 통째로 공용 모듈로 뺐다.

   ★ 여기 옮겨 온 규칙들은 이알피가 «데어 가며» 얻은 것이다
     (tests/erp-gcal-guard.test.js 가 이알피 쪽에서 지키던 것 — 4걸음에 그 파일은
      사라지고 이 파일이 그 자리를 잇는다)
       ① 로그인 전에는 아예 안 부른다 — 'Bearer undefined' 가 나가면 조용히 실패한다
       ② 401·404 «본문»을 자료인 척 넘기지 않는다 — 「🗑️ 삭제됨」 거짓말의 원인
       ③ 200 인데 본문에 error 가 있어도 실패다
       ④ 204(지움)는 본문이 없어도 성공이다
       ⑤ 토큰 판정은 한 곳에서 — 만료 1분 전부터는 죽은 것으로 본다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));

function 토큰놓기(남은ms) {
  globalThis._gcalToken = 남은ms ? 'tok-123' : '';
  globalThis._gcalExpiry = 남은ms ? (Date.now() + 남은ms) : 0;
}
function 가짜fetch(응답) {
  const 부름 = [];
  const f = function (url, opt) { 부름.push({ url: url, opt: opt }); return Promise.resolve(응답); };
  f.부름 = 부름;
  return f;
}
const 몸 = (status, json) => ({
  status: status, ok: status >= 200 && status < 300,
  json: function () { return json instanceof Error ? Promise.reject(json) : Promise.resolve(json); }
});

/* ── ⑤ 토큰 판정 ── */

test('⑤ 토큰이 없으면 «없다»', () => {
  토큰놓기(0);
  assert.strictEqual(A.hasToken(), false);
});

test('⑤ 만료 «1분 전»부터는 죽은 것으로 본다 — 부르는 도중 만료되면 그 부름이 버려진다', () => {
  토큰놓기(30 * 1000);            // 30초 남음 → 죽은 것
  assert.strictEqual(A.hasToken(), false, '만료 직전인데 살아 있다고 합니다');
  토큰놓기(10 * 60 * 1000);       // 10분 남음 → 살아 있음
  assert.strictEqual(A.hasToken(), true, '멀쩡한 토큰을 죽었다고 합니다');
});

/* ── ① 로그인 전에는 아예 안 부른다 ── */

test('①★ 로그인 전에는 부르지 않는다 — 부르면 Bearer undefined 가 나간다', async () => {
  토큰놓기(0);
  const f = 가짜fetch(몸(200, {}));
  await assert.rejects(() => A.apiCall('DELETE', '/x', null, { fetch: f }),
    /구글 로그인/, '로그인 전인데 거절하지 않습니다');
  assert.strictEqual(f.부름.length, 0, '★ 로그인 전인데 구글을 불렀습니다');
});

/* ── ②③④⑥ 대답을 어떻게 보나 ── */

test('②★ 401 의 본문을 «자료인 척» 넘기지 않는다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch(몸(401, { error: { message: '자격이 없습니다' } }));
  await assert.rejects(() => A.apiCall('DELETE', '/x', null, { fetch: f }), /자격이 없습니다/,
    '★ 실패를 «값»으로 돌려주면 부른 쪽이 성공으로 읽어 「삭제됨」이라고 말합니다');
});

test('③★ 200 인데 본문에 error 가 있어도 실패로 본다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch(몸(200, { error: { message: '지울 수 없습니다' } }));
  await assert.rejects(() => A.apiCall('DELETE', '/x', null, { fetch: f }), /지울 수 없습니다/);
});

test('④ 204(지웠다)는 본문이 없어도 성공이다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch({ status: 204, ok: true, json: () => Promise.reject(new Error('본문 없음')) });
  const r = await A.apiCall('DELETE', '/x', null, { fetch: f });
  assert.deepStrictEqual(r, {}, '지웠는데 실패로 봅니다');
});

test('⑥ 본문을 못 읽어도 «상태 번호»라도 알려 준다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch(몸(500, new Error('깨진 본문')));
  await assert.rejects(() => A.apiCall('DELETE', '/x', null, { fetch: f }), /HTTP 500/,
    '무엇이 잘못됐는지 아무 말도 안 합니다');
});

test('⑦ 부를 때 자격을 함께 보낸다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch(몸(200, { ok: 1 }));
  await A.apiCall('GET', '/calendars/x/events', null, { fetch: f });
  assert.match(f.부름[0].url, /^https:\/\/www\.googleapis\.com\/calendar\/v3\//, '엉뚱한 곳에 부릅니다');
  assert.strictEqual(f.부름[0].opt.headers.Authorization, 'Bearer tok-123', '자격을 안 보냅니다');
});

/* ── 이어진 일정 지우기 ── */

test('⑧ 이어진 것이 없으면 «할 일이 없다» — 억지로 부르지 않는다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch(몸(204, {}));
  const r = await A.deleteEvent('cal@x', '', { fetch: f });
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(f.부름.length, 0, '이어진 것이 없는데 구글을 불렀습니다');
});

test('⑨ 이어진 것은 그 번호로 지운다 — 알림은 안 보낸다', async () => {
  토큰놓기(10 * 60 * 1000);
  const f = 가짜fetch({ status: 204, ok: true, json: () => Promise.reject(new Error('')) });
  const r = await A.deleteEvent('cal@x', 'ev-99', { fetch: f });
  assert.strictEqual(r.deleted, true);
  assert.match(f.부름[0].url, /\/calendars\/cal%40x\/events\/ev-99/, '엉뚱한 일정을 지웁니다');
  assert.match(f.부름[0].url, /sendUpdates=none/, '참석자에게 알림이 나갑니다');
  assert.strictEqual(f.부름[0].opt.method, 'DELETE');
});

/* ── 토큰 받아 두기 ── */

test('⑩ 구글에서 돌아오면 주소 꼬리에서 토큰을 꺼내고, 주소를 «지운다»', () => {
  토큰놓기(0);
  const hist = { 부름: [], replaceState: function (a, b, c) { this.부름.push(c); } };
  const ok = A.capture({ hash: '#access_token=abc&expires_in=3600', pathname: '/pureunall/pu-cal.html' }, hist);
  assert.strictEqual(ok, true, '토큰을 못 꺼냈습니다');
  assert.strictEqual(A.hasToken(), true);
  assert.deepStrictEqual(hist.부름, ['/pureunall/pu-cal.html'],
    '★ 주소를 안 지웠습니다 — 토큰이 주소창·방문기록에 남습니다');
});

test('⑪ 꼬리에 토큰이 없으면 아무 일도 안 한다', () => {
  토큰놓기(0);
  assert.strictEqual(A.capture({ hash: '', pathname: '/x' }, { replaceState: function () {} }), false);
  assert.strictEqual(A.capture({ hash: '#tab=cal', pathname: '/x' }, { replaceState: function () {} }), false);
});

/* ── 두 앱이 «같은 한 곳»을 쓴다 ── */

test('⑫★ 이알피와 푸른 캘린더가 같은 모듈을 싣는다 — 두 벌이 되면 규칙이 갈린다', () => {
  ['pu-erp.html', 'pu-cal.html'].forEach((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(s, /<script src="js\/pu-gcal-auth\.js\?v=\d+"><\/script>/, f + ' 가 모듈을 안 싣습니다');
  });
});

test('⑬★ 이알피가 토큰을 «화면 밖»에서 받는다 — 대시보드와 함께 죽으면 Gmail 도 죽는다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const i = s.indexOf('PuGcalAuth.capture()');
  const j = s.indexOf('function CorpDashboard(');
  assert.ok(i > 0, '이알피가 토큰을 안 받습니다');
  assert.ok(i < j, '★ 토큰 받는 자리가 아직 법인 대시보드 «안»입니다 — '
    + '4걸음에서 그 화면을 지우면 보수총액 Gmail 자동발송이 함께 죽습니다');
});

test('⑭ 이알피 안에 «옛 셈»이 남지 않았다 — 남으면 두 벌이 된다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const i = s.indexOf('function gcalApiCall(');
  const 몸통 = s.slice(i, s.indexOf('\n  function ', i + 10));
  assert.strictEqual(/status===204/.test(몸통), false, '이알피가 아직 제 손으로 대답을 해석합니다');
  assert.match(몸통, /PuGcalAuth\.apiCall\(/, '이알피가 공용 모듈을 안 씁니다');
});
