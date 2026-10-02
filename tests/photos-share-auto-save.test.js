'use strict';
/* 공유받은 사진을 «확인 화면 없이» 바로 담는다 (대표 지시 2026-10-02 「없애라」)
   「폰에서 바로 사진첩으로 명함 등 서류를 바로 보낼 수 있게」

   공유 → 푸른사진첩을 고른 것이 이미 「이것을 담아라」다. 확인 화면은 한 번 더 누르기였다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 로그인돼 있고 막힐 일이 없으면 «확인 화면 없이» 담는다
     ② 저장이 막힐 판이면 확인 화면을 «그대로» 띄운다 — 받은 사진은 이미 임시함에서
        꺼냈으므로, 막힌 채 저장을 부르면 말없이 사라진다
        (로그인 풀림 · 다른 직원 사진을 보는 중)
     ③ 담는다고 «말한다» — 아무 화면도 없이 조용히 올라가면 된 줄 모른다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const F = cutFn(SRC, 'function shareAutoOk(') + '\n' + cutFn(SRC, 'function takeShared(');

/* 진짜 takeShared 를 돌린다 — 임시함에서 한 장이 나온다고 꾸미고 무엇이 불리는지 본다 */
async function 받기(opts) {
  const 기록 = [];
  const ctx = {
    console, Promise, String,
    URL: { createObjectURL: () => 'blob:x' },
    shareShots: [],
    shareFlag: () => '1', clearShareFlag() {},
    drainShareIdb: () => Promise.resolve([{ blob: {}, name: 'card.jpg', type: 'image/jpeg' }]),
    firebase: { auth: () => ({ currentUser: opts.로그인 ? { uid: 'u' } : null }) },
    viewingOnlyOther: () => !!opts.남의사진,
    toast: (m) => 기록.push('알림:' + m),
    shareSave: () => { 기록.push('저장'); },
    renderShareRev: () => { 기록.push('확인화면'); },
    $: () => ({ style: {} }),
    alert() {}
  };
  vm.createContext(ctx);
  vm.runInContext(F + '\ntakeShared();', ctx);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  return 기록;
}

test('①★★ 로그인돼 있으면 확인 화면 없이 바로 담는다', async () => {
  const r = await 받기({ 로그인: true });
  assert.ok(r.includes('저장'), '★★ 담지 않았다 — 여전히 「저장」을 사람이 눌러야 한다');
  assert.ok(!r.includes('확인화면'), '★★ 확인 화면을 띄웠다 — 대표께서 없애라 하신 그 단계다');
});

test('②★★ 로그인이 풀렸으면 확인 화면을 띄운다 — 바로 저장하면 사진이 말없이 사라진다', async () => {
  const r = await 받기({ 로그인: false });
  assert.ok(!r.includes('저장'),
    '★★ 로그인 없이 저장을 불렀다 — 저장은 거절되고, 임시함에서 이미 꺼낸 사진은 사라진다');
  assert.ok(r.includes('확인화면'), '★★ 확인 화면도 안 띄웠다 — 받은 사진이 어디에도 안 남는다');
});

test('②-2 ★★ 다른 직원 사진을 보는 중이면 확인 화면을 띄운다', async () => {
  const r = await 받기({ 로그인: true, 남의사진: true });
  assert.ok(!r.includes('저장'), '★★ 남의 사진을 보는 중에 저장을 불렀다 — addFiles 가 거절해 사진이 사라진다');
  assert.ok(r.includes('확인화면'));
});

test('③★ 담는다고 «말한다» — 아무 화면 없이 조용히 올라가면 된 줄 모른다', async () => {
  const r = await 받기({ 로그인: true });
  const i = r.findIndex(x => /^알림:/.test(x));
  assert.ok(i > -1, '★ 아무 말도 없이 담았다');
  assert.match(r[i], /1장/, '★ 몇 장인지 말하지 않는다');
});
