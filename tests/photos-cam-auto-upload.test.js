'use strict';
/* 폰에서 찍은 명함이 «저절로» 올라가 기업정보함에 들어가게 (대표 지시 2026-09-29)
   ─────────────────────────────────────────────────────────────────────────
   「폰에서 찍은 명함 자동 업로드 되게 해라. 그리고 기업정보함에 들어가게 해라」

   ■ 코드를 읽어 보니 «길은 있었는데 두 군데서 끊겨» 있었다
     올리기가 끝나면 폰에서도 곧바로 읽고(queueRead), 검증을 통과한 명함은 기업정보함으로
     간다(sendCards). 그 길에 사람이 개입할 일이 없다. 끊긴 곳은 둘이다.

     ① 완료 → 검토 화면 → 올리기 — 명함 한 장에 «세 번» 눌러야 올라갔다.
        검토 화면이 하는 일은 「기본값 그대로 올리기」 하나인데(전부 고른 채·갈래=서류).
     ② 기업정보함에서 📷 로 왔으면 올린 «뒤» 곧바로 기업정보함으로 돌아갔다 —
        그런데 addFiles 는 줄에 넣는 데까지만 기다린다. 그 직후 주소를 바꾸면
        올리는 도중이 끊기고, 올라가도 그 뒤의 «읽기 → 기업정보함 넣기»가 통째로 끊긴다.
        폰에서는 「열면 저절로 읽기」가 꺼져 있어 올라간 뒤에도 안 읽힌 채 남는다.
        코드 주석은 「다 올린 뒤 돌려보낸다」였는데 실제로는 «줄에 넣은 뒤»였다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 명함·서류는 «문제가 없으면» 검토 없이 바로 올린다
     ② 흐리거나 작은 장이 하나라도 있으면 종전처럼 검토 화면을 연다(다시 찍을지 사람이 정한다)
     ③ 일반사진은 그대로다 — 이 판에서 건드리지 않는다
     ④ 검토를 건너뛰어도 갈래(camUpKind)는 «서류»로 정해 준다 — 안 정하면 명함이 사진으로 담겨 판독을 건너뛴다
     ⑤ 돌아가기 «전에» 올리기·읽기가 끝나기를 기다린다
     ⑥ 그러나 «무한정»은 아니다 — 영영 못 떠나면 안 된다
     ⑦ 「올리기가 끝났다」의 잣대는 state 하나가 아니다(알림 안에서 읽기를 줄 세우는 틈) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const F = {
  finish: cutFn(SRC, 'function finishCamShots('),
  auto: cutFn(SRC, 'function camAutoUploadOk('),
  unsettled: cutFn(SRC, 'function camUnsettled('),
  wait: cutFn(SRC, 'function camWaitSettled('),
  upload: cutFn(SRC, 'async function camUpload(')
};
const SETTLE_MAX = (SRC.match(/const CAM_SETTLE_MAX_MS = (\d+);/) || [])[1];

/* 가짜 시계 — 실제로 기다리지 않고 «시간을 감아» 본다 */
function 시계() {
  let now = 1000000; const q = [];
  return {
    now: () => now,
    setTimeout: (fn, ms) => { q.push({ at: now + ms, fn }); },
    감기: (ms) => {
      const to = now + ms;
      for (;;) {
        q.sort((a, b) => a.at - b.at);
        if (!q.length || q[0].at > to) break;
        const t = q.shift(); now = t.at; t.fn();
      }
      now = to;
    }
  };
}

/* 완료 단추를 «실제로 눌러 본다» — 무엇이 불렸는지 순서대로 적는다 */
function 완료누르기(opts) {
  const 기록 = [];
  const ctx = {
    console, Promise, Date,
    camShots: opts.shots, camQuickMode: !!opts.quick, camUpKind: opts.staleKind || 'photo',
    frameOn: () => !!opts.문서모드,
    camUpload: () => { 기록.push('올리기(갈래=' + ctx.camUpKind + ')'); },
    openCamReview: () => { 기록.push('검토화면'); },
    setCamUpKind: (k) => { ctx.camUpKind = k; 기록.push('갈래=' + k); }
  };
  vm.createContext(ctx);
  vm.runInContext(F.auto + '\n' + F.finish + '\nfinishCamShots();', ctx);
  return 기록;
}
const 멀쩡 = () => ({ sel: true, small: false, blurry: false });

test('①★★ 명함·서류 모드에서 문제가 없으면 검토 화면 없이 바로 올린다', () => {
  const r = 완료누르기({ 문서모드: true, shots: [멀쩡(), 멀쩡()] });
  assert.ok(r.some(x => /^올리기/.test(x)), '★★ 올리지 않았다 — 여전히 「올리기」를 사람이 눌러야 한다');
  assert.ok(!r.includes('검토화면'), '★★ 문제가 없는데 검토 화면을 열었다 — 세 번 누르는 그대로다');
});

test('②★★ 흐리거나 작은 장이 하나라도 있으면 «검토 화면»을 연다 — 다시 찍을지 사람이 정한다', () => {
  ['blurry', 'small'].forEach(k => {
    const bad = Object.assign(멀쩡(), { [k]: true });
    const r = 완료누르기({ 문서모드: true, shots: [멀쩡(), bad] });
    assert.deepEqual(r, ['검토화면'],
      '★★ ' + k + ' 장이 섞였는데 그대로 올렸다 — 흐린 명함이 올라가 읽기에 AI 요금만 나가고 값이 틀어진다');
  });
});

test('②-2 사람이 뺀 장(sel=false)이 있어도 검토 화면을 연다 — 뺀 뜻을 무시하지 않는다', () => {
  const r = 완료누르기({ 문서모드: true, shots: [멀쩡(), Object.assign(멀쩡(), { sel: false })] });
  assert.deepEqual(r, ['검토화면']);
});

test('③★★ 일반사진 모드는 그대로다 — 바로 올리지 않는다', () => {
  const r = 완료누르기({ 문서모드: false, shots: [멀쩡()] });
  assert.deepEqual(r, ['검토화면'],
    '★★ 일반사진까지 바로 올렸다 — 이 판은 명함·서류만 건드린다');
});

test('③-2 빠른 촬영(포털 단추)은 종전 그대로 바로 올린다', () => {
  const r = 완료누르기({ quick: true, 문서모드: false, shots: [멀쩡()] });
  assert.ok(r.some(x => /^올리기/.test(x)) && !r.includes('검토화면'));
});

test('④★★ 검토를 건너뛰어도 갈래를 «서류»로 정해 준다 — 안 정하면 명함이 사진으로 담긴다', () => {
  /* openCamReview 가 하던 일이다. 건너뛰면 지난 촬영의 값이 남는다.
     「사진」으로 담기면 판독을 건너뛰어(readSkipWhy) 명함이 기업정보함에 안 간다 —
     에러도 안 나는 가장 조용한 길이다. 일부러 낡은 값('photo')을 깔아 놓고 본다. */
  const r = 완료누르기({ 문서모드: true, shots: [멀쩡()], staleKind: 'photo' });
  const 올림 = r.find(x => /^올리기/.test(x));
  assert.equal(올림, '올리기(갈래=doc)',
    '★★ 낡은 갈래(photo)로 올렸다 — 명함이 사진으로 담겨 판독을 건너뛴다');
  assert.ok(r.indexOf('갈래=doc') < r.indexOf(올림), '★ 갈래는 올리기 «앞»에 정해야 한다');
});

/* ══════ 돌아가기 전에 기다린다 ══════ */
function 기다림판(초기) {
  const clk = 시계();
  const toasts = [];
  const ctx = {
    console, Promise, Math,
    Date: { now: clk.now }, setTimeout: clk.setTimeout,
    upJobs: 초기.jobs || [], readQ: [], readBusy: !!초기.reading,
    readingNow: () => !!(ctx.readBusy || ctx.readQ.length),
    toast: (m) => toasts.push(String(m))
  };
  vm.createContext(ctx);
  vm.runInContext('var CAM_SETTLE_MAX_MS = ' + (SETTLE_MAX || 90000) + ';\n' + F.unsettled + '\n' + F.wait, ctx);
  return { ctx, clk, toasts };
}
async function 결과(p) { let r; p.then(v => { r = v; }); await Promise.resolve(); await Promise.resolve(); return () => r; }

test('⑤★★ 올리는 중이면 «떠나지 않는다» — 올린 뒤에야 끝난다', async () => {
  const job = { _fromCam: true, state: 'up' };
  const { ctx, clk } = 기다림판({ jobs: [job] });
  const 답 = await 결과(ctx.camWaitSettled(90000));
  clk.감기(2000);
  await Promise.resolve();
  assert.equal(답(), undefined, '★★ 올리는 중인데 끝났다고 답했다 — 그 순간 떠나면 올리기가 끊긴다');
  job.state = 'done'; job._hideAt = 1;
  clk.감기(1000); await Promise.resolve(); await Promise.resolve();
  assert.equal(답(), true, '★ 다 올라갔는데 안 끝났다 — 영영 못 떠난다');
});

test('⑤-2 ★★ 올렸어도 «읽는 중»이면 기다린다 — 읽기가 끊기면 기업정보함에 못 간다', async () => {
  const job = { _fromCam: true, state: 'done', _hideAt: 1 };
  const { ctx, clk } = 기다림판({ jobs: [job], reading: true });
  const 답 = await 결과(ctx.camWaitSettled(90000));
  clk.감기(3000); await Promise.resolve();
  assert.equal(답(), undefined,
    '★★ 읽는 중인데 떠났다 — 「읽기 → 기업정보함 넣기」가 통째로 끊긴다(폰에서는 나중에 다시 읽어 주지도 않는다)');
  ctx.readBusy = false;
  clk.감기(1000); await Promise.resolve(); await Promise.resolve();
  assert.equal(답(), true);
});

test('⑦★★ state 가 done 이어도 알림 안의 「_hideAt」이 없으면 아직이다 — 읽기가 줄에 서기 전 틈', async () => {
  /* 대기열은 done 을 적고 기기에서 지운 «뒤에야» 알림을 준다. 알림 안에서 _hideAt 을
     적고 곧바로 읽기를 줄에 넣는다. state 만 보면 done 인데 읽기는 아직 줄에도 안 선 틈이
     있고, 그 틈에 떠나면 읽기가 시작도 못 하고 끊긴다. */
  const job = { _fromCam: true, state: 'done' };           // _hideAt 없음
  const { ctx, clk } = 기다림판({ jobs: [job] });
  const 답 = await 결과(ctx.camWaitSettled(90000));
  clk.감기(1000); await Promise.resolve();
  assert.equal(답(), undefined,
    '★★ done 만 보고 끝났다고 했다 — 읽기가 줄에 서기 «전»에 떠나면 읽기가 시작도 못 한다');
});

test('⑥★★ 그러나 «무한정»은 아니다 — 정한 때가 지나면 답하고 떠난다', async () => {
  const job = { _fromCam: true, state: 'retry' };           // 신호 약함 — 계속 다시 시도 중
  const { ctx, clk } = 기다림판({ jobs: [job] });
  const 답 = await 결과(ctx.camWaitSettled(5000));
  clk.감기(6000); await Promise.resolve(); await Promise.resolve();
  assert.equal(답(), false, '★★ 끝내 안 끝나는데 영영 붙잡았다 — 사람이 화면에 갇힌다');
  assert.ok(Number(SETTLE_MAX) >= 30000 && Number(SETTLE_MAX) <= 180000,
    '★ 기다리는 한도(' + SETTLE_MAX + 'ms)가 어처구니없다 — 너무 짧으면 읽기 전에 떠나고 너무 길면 갇힌 듯하다');
});

test('⑥-2 막힘(fail)은 «끝난 것»으로 센다 — 권한 거절은 기다려도 안 풀린다', async () => {
  const job = { _fromCam: true, state: 'fail' };
  const { ctx } = 기다림판({ jobs: [job] });
  const 답 = await 결과(ctx.camWaitSettled(90000));
  assert.equal(답(), true, '★★ 막힌 장 때문에 영영 못 떠난다 — 그 장은 배송표에 「막힘」으로 남는다');
});

test('⑤-3 올릴 것도 읽을 것도 없으면 «기다리지 않고» 곧바로 간다', async () => {
  const { ctx } = 기다림판({ jobs: [] });
  const 답 = await 결과(ctx.camWaitSettled(90000));
  assert.equal(답(), true, '★ 할 일이 없는데 기다렸다 — 괜히 느려진다');
});

test('⑧ 단계가 «바뀔 때만» 알린다 — 0.4초마다 같은 말을 띄우면 화면이 깜빡인다', async () => {
  const job = { _fromCam: true, state: 'up' };
  const { ctx, clk, toasts } = 기다림판({ jobs: [job] });
  ctx.camWaitSettled(90000);
  clk.감기(4000);
  assert.equal(toasts.length, 1, '★★ 같은 알림이 ' + toasts.length + '번 떴다 — 깜빡임의 원인이 된다');
  job.state = 'done'; job._hideAt = 1; ctx.readBusy = true;
  clk.감기(2000);
  assert.equal(toasts.length, 2, '★ 올리기 → 읽기로 단계가 바뀌었는데 안 알렸다');
  assert.match(toasts[1], /읽/, '★ 읽는 단계라고 말하지 않는다');
});

test('⑨★★ camUpload 가 «돌아가기 전에» 기다린다 — 그리고 종전 줄은 그대로다', () => {
  const bare = stripJs(F.upload);
  const 기다림 = bare.indexOf('await camWaitSettled(');
  const 돌아감 = bare.indexOf('camGoBack()');
  const 올림 = bare.indexOf('await addFiles(');
  assert.ok(기다림 > -1, '★★ 돌아가기 전에 기다리지 않는다 — 올리는 도중에 떠나 끊긴다');
  assert.ok(올림 < 기다림 && 기다림 < 돌아감,
    '★★ 순서가 틀렸다: 올리기(줄에 넣기) → 끝나길 기다림 → 돌아감 이어야 한다');
  /* 이 줄은 여러 검사가 글자 그대로 지킨다 — 건드리면 그쪽이 «기능이 멀쩡한데» 깨진다 */
  assert.ok(F.upload.indexOf('if (camReturnTo) { camDiscard(); camGoBack(); }') > -1,
    '★ 종전의 돌아가기 줄이 바뀌었다 — 다른 검사가 이 줄을 지키고 있다');
  assert.match(bare, /if \(camReturnTo\) await camWaitSettled\(/,
    '★★ 기다림이 «기업정보함에서 온 경우»에만 걸려야 한다 — 사진첩 단독 촬영은 화면에 남으므로 기다릴 까닭이 없다');
});
