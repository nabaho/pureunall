'use strict';
/* 폰에 뜨는 띠 — 「자꾸 데이터가 업데이트 해야한다」 (대표 제보 2026-09-12)
   ─────────────────────────────────────────────────────────────────────
   ■ 뿌리 하나가 셋을 낳았다
     앱이 「이 기기가 클라우드보다 적다/낡았다」를 곧바로 **「자료가 지워졌다」**로 읽었다.
     폰처럼 «아직 한 번도 받아 오지 않은 기기»에서는 그것이 **정상**인데도:
       · fbWatch    — base 가 없으면 «무조건» 띄운다 (PC 가 2.5초마다 저장 → 계속 되살아남)
       · fbCheckLoss— 폰 185건 vs 클라우드 709건 → 「브라우저 자료가 지워졌을 수 있습니다」
       · fbAutoPush — base 가 없으면 올리지도 않는다 → 스스로 벗어날 수가 없다
       · 게다가 「닫기」는 아무것도 기억하지 않아 곧바로 되살아났다

   ■ 여기서 못 박는 것
     ① 한 번도 맞춰 본 적 없는 기기는 «잃을» 것이 없다 → 손실 경보를 띄우지 않는다
     ② 클라우드가 내 바탕보다 새것이면 내가 적은 까닭은 그것으로 설명된다 → 손실이 아니다
     ③ 그래도 «진짜 손실»(맞춰 봤고, 클라우드도 새것이 아닌데 크게 적다)은 그대로 잡는다
        — 위촉장 197→79 사고를 잡아낸 그 띠다. 절대 약해지면 안 된다.
     ④ 「닫기」를 기억한다
   ⚠ 잣대를 «기기»(폰/PC)로 만들지 않았다 — 폰이라서가 아니라 «안 맞춰 봤기 때문»이다.
     기기로 가르면 「폰에서는 자료가 사라져도 안 알려 준다」가 되어 더 나쁘다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../js/kcareer-notices.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* 대표 실물 숫자 — 클라우드 709건(2026-09-12 실측), 시드만 있는 폰 185건 */
const 클라우드 = 709, 시드 = 185;

/* ══════════ ① 폰 — 아직 한 번도 받아 오지 않았다 ══════════ */

test('★★★ 한 번도 받아 온 적 없는 기기에 «자료가 지워졌다»고 하지 않는다', () => {
  /* 이것이 대표가 폰에서 본 거짓 경보다. 시드만 있는 폰은 «잃은» 것이 아니라 «안 받은» 것이다. */
  const r = N.decide({ base: null, cloudAt: 1789113407290, here: 시드,
                       cloud: 클라우드, deleted: 0 });
  assert.equal(r.loss.show, false,
    '★★ 한 번도 안 맞춰 본 기기에 손실 경보를 띄웁니다 — 거짓입니다');
  /* 대신 «받아 오라»고는 말해야 한다 — 아무 말도 안 하면 폰이 영영 낡은 채로 남는다 */
  assert.equal(r.newer.show, true, '받아 오라는 안내까지 없애면 안 됩니다');
  assert.equal(r.newer.kind, 'first', '처음인 기기에는 처음이라고 말해야 합니다');
});

test('★★ 처음인 기기에는 «무엇을 해야 하는지» 다르게 말한다', () => {
  /* 「다른 기기에서 저장된 더 최신 기록이 있습니다」는 처음 여는 폰에게는 뜻이 안 통한다 */
  assert.notEqual(N.newerText('first'), N.newerText('newer'), '말이 같으면 가른 뜻이 없습니다');
  assert.match(N.newerText('first'), /한 번도/, '처음이라는 것을 밝혀야 합니다');
  assert.match(N.newerText('newer'), /다른 기기/, '뒤처진 기기에는 예전 말 그대로');
});

/* ══════════ ② 맞춰 봤지만 뒤처진 기기 ══════════ */

test('★★★ 받아 온 뒤 PC 가 더 담았을 뿐인데 «지워졌다»고 하지 않는다', () => {
  /* 폰이 어제 받아 왔고(base=어제) 오늘 PC 가 20건을 더 담았다.
     폰은 689건, 클라우드는 709건 — 폰이 적다. 그러나 잃은 것이 아니다. */
  const 어제 = 1789000000000, 오늘 = 1789113407290;
  const r = N.decide({ base: 어제, cloudAt: 오늘, here: 689, cloud: 709, deleted: 0 });
  assert.equal(r.loss.show, false,
    '★★ 뒤처진 것뿐인데 손실 경보를 띄웁니다 — 이것도 거짓입니다');
  assert.equal(r.newer.show, true, '뒤처졌다는 것은 알려야 합니다');
  assert.equal(r.newer.kind, 'newer');
});

/* ══════════ ③ ★ 진짜 손실은 그대로 잡는다 ══════════ */

test('★★★ 진짜 «자료가 지워진» 기기는 여전히 잡는다 — 위촉장 197→79 사고', () => {
  /* 맞춰 본 적이 있고(base 있음), 클라우드가 «새것도 아닌데»(cloudAt <= base)
     내 것만 크게 줄었다 → 브라우저 자료가 지워진 것이다. 이 띠가 그 사고를 잡았다. */
  const 때 = 1789113407290;
  const r = N.decide({ base: 때, cloudAt: 때, here: 79, cloud: 197, deleted: 0 });
  assert.equal(r.loss.show, true,
    '★★★ 진짜 손실을 못 잡습니다 — 이 띠를 약하게 하면 안 됩니다');
});

test('★★ 「내가 지운 것」은 손실이 아니다 — 2026-09-03 규칙 그대로', () => {
  const 때 = 1789113407290;
  /* 클라우드 709, 이 기기 700, 내가 지운 것 9 → 차이가 설명된다 */
  const r = N.decide({ base: 때, cloudAt: 때, here: 700, cloud: 709, deleted: 9 });
  assert.equal(r.loss.show, false, '★ 내가 지운 것을 손실이라 합니다 — 지운 중복이 되살아납니다');
  assert.equal(r.stale.show, true, '대신 클라우드가 낡았다고 알려야 합니다');
});

test('클라우드 건수를 «못 읽으면» 숫자 이야기를 하지 않는다', () => {
  const r = N.decide({ base: 1, cloudAt: 2, here: 10, cloud: null, deleted: 0 });
  assert.equal(r.loss.show, false, '못 읽고서 손실이라 하면 안 됩니다');
  assert.equal(r.stale.show, false, '못 읽고서 낡았다고 하면 안 됩니다');
  assert.equal(r.newer.show, true, '시각 비교는 건수와 상관없이 됩니다');
  /* ⚠ 위만 보면 빗장을 빼도 통과한다 — 뒤처졌다는 사실이 이미 손실을 막아 주기 때문이다
     (고장넣기 2026-09-12 에 실제로 안 걸렸다). «뒤처지지도 않은» 경우라야 빗장이 홀로 일한다.
     빗장이 없으면 cloud 가 null 이라 NaN 셈을 지나 손실로 떨어진다. */
  const r2 = N.decide({ base: 10, cloudAt: 10, here: 10, cloud: null, deleted: 0 });
  assert.equal(r2.loss.show, false,
    '★ 클라우드 건수를 못 읽었는데 「자료가 지워졌을 수 있습니다」라고 합니다');
  assert.equal(r2.stale.show, false, '★ 못 읽었는데 낡았다고 합니다');
});

/* ══════════ ④ 「닫기」를 기억한다 ══════════ */

test('★★★ 「닫기」를 누르면 «그대로 잠잠하다» — PC 가 저장할 때마다 되살아나던 것', () => {
  /* ⚠ 이것이 «자꾸»의 정체다. 예전 fbHideNotice 는 display:none 만 했고,
     fbWatch 가 at 이 바뀔 때마다(=PC 가 저장할 때마다, 2.5초) 다시 띄웠다. */
  const 때 = 1789113407290;
  const 닫은뒤 = N.decide({ base: 1, cloudAt: 때, here: 10, cloud: null, dismissedAt: 때 });
  assert.equal(닫은뒤.newer.show, false, '★★ 닫았는데 그대로 다시 뜹니다');
  /* 그런데 «더 새것»이 오면 다시 알려야 한다 — 영영 입을 막으면 안 된다 */
  const 더새것 = N.decide({ base: 1, cloudAt: 때 + 1, here: 10, cloud: null, dismissedAt: 때 });
  assert.equal(더새것.newer.show, true, '★ 새 저장이 와도 영영 알리지 않습니다');
});

test('닫은 적이 없으면 그대로 뜬다', () => {
  const r = N.decide({ base: 1, cloudAt: 9, here: 10, cloud: null, dismissedAt: null });
  assert.equal(r.newer.show, true);
});

/* ══════════ ⑤ 뒤처지지 않았으면 조용하다 ══════════ */

test('클라우드가 내 바탕과 같으면 아무 띠도 안 뜬다 — 조용한 것이 정상이다', () => {
  const 때 = 1789113407290;
  const r = N.decide({ base: 때, cloudAt: 때, here: 709, cloud: 709, deleted: 0 });
  assert.equal(r.newer.show, false);
  assert.equal(r.loss.show, false);
  assert.equal(r.stale.show, false);
});

test('클라우드가 아예 비었으면 «받아 오라»고 하지 않는다', () => {
  const r = N.decide({ base: null, cloudAt: 0, here: 185, cloud: null });
  assert.equal(r.newer.show, false, '받아 올 것이 없는데 받아 오라고 합니다');
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.doesNotThrow(function () { N.decide(); });
  assert.doesNotThrow(function () { N.decide({}); });
  assert.doesNotThrow(function () { N.decide({ base: null, cloud: null }); });
  const r = N.decide({});
  assert.equal(r.newer.show, false);
  assert.equal(r.loss.show, false);
});

/* ══════════ ⑥ 앱이 이 자를 «실제로» 쓴다 ══════════ */

test('★★ 앱이 모듈을 싣고 세 자리에서 모두 쓴다', () => {
  assert.match(SRC, /kcareer-notices\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  assert.match(SRC, /KcareerNotices\.decide\(/, '★ 잣대를 안 씁니다');
  /* 세 곳이 같은 자를 써야 한다 — 갈라지면 띠마다 다른 말을 한다 */
  const n = (SRC.match(/KcareerNotices\.decide\(/g) || []).length;
  assert.ok(n >= 2, '★ 한 곳에서만 씁니다(' + n + ') — 손실 띠와 최신 띠가 갈라집니다');
});

test('★★★ 손실 띠가 «맞춰 본 적 없는 기기»에서는 안 뜨게 이어져 있다', () => {
  /* fbCheckLoss 가 모듈을 거치지 않고 제 잣대로 판단하면 폰에 다시 거짓 경보가 뜬다 */
  const i = SRC.indexOf('function fbCheckLoss(');
  assert.ok(i > 0, 'fbCheckLoss 를 못 찾았습니다');
  const fn = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10));
  assert.match(fn, /KcareerNotices\.decide\(/,
    '★★ fbCheckLoss 가 제 잣대로 판단합니다 — 폰에 거짓 경보가 다시 뜹니다');
  /* 옛 셈이 남아 있으면 두 벌이다 */
  assert.ok(!/cloud\.total - del <= here\.total \+ 5/.test(fn),
    '★ 옛 셈이 남아 있습니다 — 두 벌이 되면 한쪽만 고쳐집니다');
});

test('★★ 「닫기」가 «기억»으로 이어져 있다', () => {
  assert.match(SRC, /_fbDismissAt/, '★ 닫은 것을 기억하지 않습니다 — 곧바로 되살아납니다');
  const i = SRC.indexOf('function fbHideNotice(');
  const fn = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10));
  assert.match(fn, /_fbDismissAt/, '★ fbHideNotice 가 기억을 안 남깁니다');
});

test('★ 백업 재촉은 «손대지 않았다» — 197건 사고를 막은 띠다', () => {
  /* ⚠ 일부러 그대로 둔다: last_backup 은 클라우드로 함께 오가므로(FB_SKIP 에 없다)
     폰이 한 번 받아 오면 저절로 멎는다. 약하게 고칠 까닭이 없다. */
  const i = SRC.indexOf('function checkBackupReminder(');
  assert.ok(i > 0, 'checkBackupReminder 를 못 찾았습니다');
  const fn = SRC.slice(i, SRC.indexOf('\n}', i));
  assert.match(fn, /days!=null && days<14/, '백업 재촉 잣대를 바꾸지 않았습니다');
  assert.match(fn, /total<20/, '갓 시작한 사람을 귀찮게 하지 않는 빗장도 그대로');
  /* last_backup 이 정말 함께 오가는지 — 안 그러면 폰에서 영영 멎지 않는다 */
  const skip = SRC.slice(SRC.indexOf('var FB_SKIP='), SRC.indexOf('];', SRC.indexOf('var FB_SKIP=')));
  assert.ok(!/last_backup/.test(skip),
    '★ last_backup 을 FB_SKIP 에 넣으면 폰의 백업 재촉이 영영 안 멎습니다');
});

test('★ 클라우드에 «시각이 없어도» 한 번도 안 맞춘 기기에 손실이라 하지 않는다', () => {
  /* ⚠ 위의 폰 검사는 cloudAt 이 있어서 「뒤처짐」이 손실을 막아 주었다.
     시각이 비어 있으면(counts 만 있고 at 이 없는 클라우드) 막아 줄 것이 «맞춰 본 적 있나»
     하나뿐이다 — 그 빗장이 홀로 일하는 자리다(고장넣기 2026-09-12 에 안 걸렸다). */
  const r = N.decide({ base: null, cloudAt: 0, here: 시드, cloud: 클라우드, deleted: 0 });
  assert.equal(r.everSynced, false, '이 검사는 «한 번도 안 맞춘» 기기라야 뜻이 있습니다');
  assert.equal(r.behind, false, '시각이 없으면 뒤처졌다고도 못 합니다 — 그래서 빗장이 홀로 일합니다');
  assert.equal(r.loss.show, false,
    '★★ 한 번도 안 맞춘 기기에 「자료가 지워졌을 수 있습니다」라고 합니다');
});

test('★★ 「닫기」 링크가 «사람이 눌렀다»고 알린다 — 안 알리면 기억이 안 남는다', () => {
  /* fbHideNotice 는 «사람이 눌렀을 때만» 기억한다. 링크가 그것을 안 넘기면
     기억하는 코드가 있어도 한 번도 안 불린다 — 있으나 마나가 된다. */
  const i = SRC.indexOf("id=\"fbNotice\"");
  assert.ok(i > 0, 'fbNotice 띠를 못 찾았습니다');
  const 띠 = SRC.slice(i, i + 700);
  assert.match(띠, /fbHideNotice\(true\)/,
    '★ 「닫기」가 사람이 눌렀다고 안 알립니다 — PC 가 저장할 때마다 다시 뜹니다');
});

test('★★ 띠 글자를 «갈아 끼운다» — 처음인 기기에 맞는 말이 실제로 찍혀야 한다', () => {
  /* 말을 가르는 자(newerText)가 있어도 화면에 안 찍으면 아무 소용이 없다 */
  const i = SRC.indexOf('function fbShowNotice(');
  assert.ok(i > 0, 'fbShowNotice 를 못 찾았습니다');
  const fn = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10));
  assert.match(fn, /KcareerNotices\.newerText\(/,
    '★ 띠 글자를 갈아 끼우지 않습니다 — 처음 여는 폰이 무엇을 할지 모릅니다');
  assert.match(fn, /fbNoticeMsg/, '★ 글자를 넣을 자리를 안 찾습니다');
});
