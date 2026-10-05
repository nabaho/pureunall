'use strict';
/* ☁ 처음 여는 브라우저는 «저절로» 받아 온다 (대표 지시 2026-10-05 「데이터가 분리되지 않게」)
   실제 일: 크롬·에지 둘 다 클라우드 580건을 한 번도 안 받아 와 처음 깔린 185건만 보고 있었다.
   못 박는 것:
     ① 잃을 것 0 = 이 기기 목록의 기록이 모두 클라우드에 있거나 클라우드가 지웠다고 적은 것
     ② 하나라도 이 기기에만 있으면 저절로 받지 않는다(사람이 고른다)
     ③ 처음 여는 기기의 두 문(fbWatch·fbAutoPush)이 모두 fbFirstSync 로 간다 · 받는 길은 kcApplyRestore 한 곳
     ④ 도장 목록은 이 기기에만(그림이 안 오가므로) · 기기 이름표에 브라우저 */
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
  assert.ok(/_fbBase==null && cloudAt\)\{ fbFirstSync\(\)/.test(떼기('function fbAutoPush(')), 'fbAutoPush');
  const f = 떼기('function fbFirstSync(');
  assert.ok(/KcareerNotices\.firstPullLoss\(fbGatherLS\(\), v\.ls, FB_SKIP, TOMB_KEY\)/.test(f), '잣대 한 곳');
  assert.ok(/kcApplyRestore\(v\.ls, 'pull'\)/.test(f) && /fbSetBase\(v\.at\)/.test(f), '받는 길 한 곳 · 받은 뒤 자동 올리기가 시작되게 기준을 둔다');
  assert.ok(f.indexOf('r.safe') < f.indexOf('kcApplyRestore'), '★ 잃을 것을 먼저 본다 — 순서가 바뀌면 이 기기에만 있는 기록이 사라진다');
  assert.ok(/KC_SAFE/.test(f) && /kcNoPush\(\)/.test(f), '안전 모드·직원 보기 전용에서는 하지 않는다');
});

test('④ 도장 목록은 이 기기에만 · 기기 이름표에 브라우저', () => {
  const skip = SRC.match(/var FB_SKIP=\[([\s\S]*?)\];/)[1];
  assert.ok(/'stamps'/.test(skip), '★ 목록만 오가면 그림 없는 빈 도장이 생긴다(2026-10-05 에지 3개)');
  const lab = 떼기('function fbDeviceLabel(');
  assert.ok(/Edg/.test(lab) && /크롬/.test(lab), '「PC」만으로는 어느 브라우저가 올렸는지 모른다');
  assert.ok(/<script src="js\/kcareer-notices\.js\?v=\d+"><\/script>/.test(SRC));
});
