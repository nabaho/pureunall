'use strict';
/* ☁ 처음 여는 브라우저는 «저절로» 받아 온다 (대표 지시 2026-10-05 「데이터가 분리되지 않게」)
   실제 일: 크롬·에지 둘 다 클라우드 580건을 한 번도 안 받아 와 처음 깔린 185건만 보고 있었다.
   못 박는 것:
     ① 잃을 것 0 = 이 기기 목록의 기록이 모두 클라우드에 있거나 클라우드가 지웠다고 적은 것
     ② 하나라도 이 기기에만 있으면 저절로 받지 않는다(사람이 고른다)
     ③ 처음 여는 기기의 두 문(fbWatch·fbAutoPush)이 모두 fbFirstSync 로 간다 · 받는 길은 kcApplyRestore 한 곳
     ④ 도장 목록은 «합쳐» 오간다(그림은 본인 창고로 — 2026-10-09) · 기기 이름표에 브라우저 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../js/kcareer-notices.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const J = JSON.stringify;
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 잃을 것 0 — 클라우드에 있거나, 클라우드가 지운 것', () => {
  const here = { wiccok: J([{ id: 'W1' }, { id: 'C0002' }]), profile_info: J({ name: '기본' }) };
  const cloud = { wiccok: J([{ id: 'W1' }, { id: 'W9' }]), _tomb: J({ C0002: 1 }) };
  const r = N.firstPullLoss(here, cloud, [], '_tomb');
  assert.equal(r.safe, true, '★ 처음 깔린 기록을 클라우드가 지웠으면 잃는 것이 아니다(2026-10-05 실제 21건)');
});

test('② 이 기기에만 있는 기록이 있으면 저절로 받지 않는다', () => {
  const r = N.firstPullLoss({ cert: J([{ id: 'C1' }, { id: 'NEW' }]) }, { cert: J([{ id: 'C1' }]) }, [], '_tomb');
  assert.equal(r.safe, false);
  assert.deepEqual(r.lost, [{ key: 'cert', id: 'NEW' }]);
  assert.equal(N.firstPullLoss({ rh_drafts: J([{ id: 'D' }]) }, {}, ['rh_drafts'], '_tomb').safe, true, '안 오가는 열쇠(FB_SKIP)는 받아도 그대로라 셈하지 않는다');
});

test('③ 두 문이 모두 fbFirstSync — 받는 길은 kcApplyRestore 한 곳', () => {
  assert.ok(/kind==='first'\)\{ fbFirstSync\(\); return; \}/.test(떼기('function fbWatch(')), 'fbWatch');
  assert.ok(/(_fbBase|base)==null && cloudAt\)\{ fbFirstSync\(\)/.test(떼기('function fbAutoPush(')), 'fbAutoPush');
  const f = 떼기('function fbFirstSync(');
  assert.ok(/KcareerNotices\.firstPullLoss\(fbGatherLS\(\), v\.ls, FB_SKIP\.concat\(FB_UNION\), TOMB_KEY\)/.test(f), '잣대 한 곳');
  assert.ok(/kcApplyRestore\(v\.ls, 'pull'\)/.test(f) && /fbSetBase\(v\.at\)/.test(f), '받는 길 한 곳 · 받은 뒤 자동 올리기가 시작되게 기준을 둔다');
  assert.ok(f.indexOf('r.safe') < f.indexOf('kcApplyRestore'), '★ 잃을 것을 먼저 본다 — 순서가 바뀌면 이 기기에만 있는 기록이 사라진다');
  assert.ok(/KC_SAFE/.test(f) && /kcNoPush\(\)/.test(f), '안전 모드·직원 보기 전용에서는 하지 않는다');
});

test('④ 도장 목록은 합쳐 오간다 · 기기 이름표에 브라우저', () => {
  const skip = SRC.match(/var FB_SKIP=\[([\s\S]*?)\];/)[1];
  /* 2026-10-09 대표 제보 「왜 도장이 사라졌나」 — 이 기기에만 두니 브라우저를 바꾸면 없었다.
     이제 그림은 본인 창고로, 목록은 «덮지 않고 합친다» (자세한 검사: kcareer-own-files.test.js) */
  assert.ok(!/'stamps'/.test(skip), '도장 목록은 오간다');
  assert.ok(/var FB_UNION=\[[^\]]*'stamps'/.test(SRC), '★ 덮지 않고 합친다 — 1개인 기기가 4개인 기기를 지우면 안 된다');
  const lab = 떼기('function fbDeviceLabel(');
  assert.ok(/Edg/.test(lab) && /크롬/.test(lab), '「PC」만으로는 어느 브라우저가 올렸는지 모른다');
  assert.ok(/<script src="js\/kcareer-notices\.js\?v=\d+"><\/script>/.test(SRC));
});

test('⑤ 더 새 기록이 오면 — 안 올라간 고침이 없고 잃을 것이 없을 때만 받아 온다', () => {
  assert.ok(/kind==='newer'\)\{ fbNewerSync\(\); return; \}/.test(떼기('function fbWatch(')), 'fbWatch');
  assert.ok(/cloudAt>(_fbBase|base)\)\{ fbNewerSync\(\)/.test(떼기('function fbAutoPush(')), 'fbAutoPush — 올리기가 막힌 그 자리');
  const f = 떼기('function fbNewerSync(');
  assert.ok(/_fbpending|_fbPendingNow\(\)/.test(f) && f.indexOf('pending') < f.indexOf('kcApplyRestore'), '★ 안 올라간 고침이 있으면 받지 않는다 — 덮으면 그 고침이 사라진다');
  assert.ok(/\.modal-ov\.open/.test(f), '창이 열려 있으면 새로고침하지 않는다');
  assert.ok(f.indexOf('r.safe') < f.indexOf('kcApplyRestore'), '잃을 것을 먼저 본다');
  assert.ok(!/_fbDoPush/.test(f), '받기만 한다');
  /* 표시는 일련번호로(2026-10-07) — 고칠 때마다 새 번호, 올리기는 «모을 때 본 번호»일 때만 지운다 */
  assert.ok(/_fbPendingMark\(\)/.test(떼기('function fbScheduleAuto(')), '고치면 표시');
  assert.ok(/(localStorage\.setItem|LS\.set)\(NS\+'_fbpending'/.test(떼기('function _fbPendingMark(')), '표시는 이 기기에');
  assert.ok(/_fbPendingClear\(seq\)/.test(떼기('function _fbDoPush(')), '올라가면 지움(그 사이 고친 것은 남긴다)');
  const skip = SRC.match(/var FB_SKIP=\[([\s\S]*?)\];/)[1];
  assert.ok(/'_fbpending'/.test(skip), '그 표시는 기기마다 — 클라우드로 올리면 다른 기기가 못 받는다');
});
