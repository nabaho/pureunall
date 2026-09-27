'use strict';
/* 💾 한글 서류를 쓰는 동안의 자동 저장 (대표 지시 2026-09-26)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「한글문서 작성중에는 1분마다 자동 저장하게 해라 그렇게 해야 된다.」

   ■ 재어 보고 안 것
     자동 저장은 «이미» 30초마다 돌고 있었다(rhAutoSaveStart, 2026-08-29 d46e4b8).
     1분보다 잦다. 그런데 «담겼다»는 딱지(#rhDraftInfo)는 위 줄(#rhUploadBar)에만
     있고, 한글 서식은 «작업 모드»로 열리며 그 모드는 위 줄을 통째로 감춘다
     (body.rh-work-on #rhUploadBar{display:none!important}).
     → 대표 화면에는 담겼다는 말이 «아무 데도» 없었다. 그래서 없는 줄 아셨다.

   여기서 못 박는 것:
     ① 사이가 «1분을 넘지 않는다»
     ② 편집 중일 때만 담는다
     ③ 겹쳐 돌지 않는다(수 MB 를 내보내는 일이다)
     ④ 내보내기가 걸려도 «담는 일»은 그대로 간다
     ⑤ 화면이 가려지는 순간 담는다(브라우저가 타이머를 늦춘다 — 폰은 멈춘다)
     ⑥ 듣는 사람은 한 번만 붙는다
     ⑦ 담기면 «시각»을 말한다 — 그것도 «기둥에도»
     ⑧ 못 담으면 조용히 넘기지 않는다(붉은 딱지 + 알림은 처음 한 번만)
     ⑨ 딱지를 그리는 곳은 «한 곳»이다

   ⚠ 글자만 찾는 검사로는 이 규칙을 못 지킨다 — vm 에 올려 실제로 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(SRC);

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다 — 이름이 바뀌었나요?');
  let i = src.indexOf('{', head + decl.length), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}

/* 가짜 화면 — 딱지 두 자리(위 줄 · 작업 모드 기둥)를 그대로 흉내 낸다 */
function 세상(opt) {
  opt = opt || {};
  const 딱지 = [
    { textContent: '', style: { color: '' } },
    { textContent: '30초마다 저절로 담깁니다', style: { color: '' } }
  ];
  const card = { style: { display: opt.편집중 === false ? 'none' : '' } };
  const 들은것 = [];
  const 틱 = [];
  const 알림 = [];
  const 담긴 = [];

  const ctx = {
    console, JSON, String, Number, Array, Object, Error, Date, Math, Boolean,
    Uint8Array, ArrayBuffer, Promise,
    document: {
      getElementById: (id) => (id === 'rcEditCard' ? card : null),
      querySelectorAll: (q) => (q === '[data-savetag]' ? 딱지 : []),
      addEventListener: (ev, fn) => { 들은것.push({ ev, fn }); },
      visibilityState: 'visible'
    },
    setInterval: (fn, ms) => { 틱.push({ fn, ms }); return 틱.length; },
    clearInterval: () => {},
    toast: (m, ms) => { 알림.push({ m: String(m), ms }); },
    /* 담는 일 자체는 다른 검사(kcareer-draft-base)가 본다 — 여기서는 «불렸나»만 */
    rhDraftSave: () => { 담긴.push(Date.now()); if (opt.담기실패) throw new Error('quota'); },
    exportEditedHwpx: async () => {
      if (opt.내보내기실패) throw new Error('편집기 아직');
      return opt.바이트 || null;
    },
    _rhDoc: { name: '양식_채움.hwpx', ext: 'hwpx', bytes: new Uint8Array([1, 2, 3]) },
    _카드: card, _딱지: 딱지, _들은것: 들은것, _틱: 틱, _알림: 알림, _담긴: 담긴
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);

  /* ⚠ 사이(RH_AUTO_MS)는 «소스에 적힌 그대로» 가져온다 — 여기 다시 적으면
     소스를 늘려도 검사가 모른다 */
  const 사이줄 = CODE.match(/var\s+RH_AUTO_MS\s*=\s*\d+\s*;/);
  assert.ok(사이줄, 'RH_AUTO_MS 를 찾지 못했습니다');
  vm.runInContext(사이줄[0], ctx);
  vm.runInContext('var _rhAutoT=null, _rhAutoBusy=false, _rhAutoBound=false; var _rhSaveFail=0;', ctx);

  ['function rhSaveTag(', 'function rhEditing(',
   'async function rhAutoTick(', 'function rhAutoSaveStart(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  return ctx;
}

/* ══════ ① 사이 ══════ */
test('★★ 담는 사이가 «1분을 넘지 않는다» — 대표 지시는 1분이다', () => {
  const ctx = 세상({});
  const ms = vm.runInContext('RH_AUTO_MS', ctx);
  assert.ok(ms > 0, '사이가 0 이하입니다');
  assert.ok(ms <= 60000, '★ ' + ms + 'ms 는 1분을 넘습니다 — 대표 지시를 어깁니다');
});

test('★ 타이머가 그 사이로 걸린다 — 값만 있고 안 쓰면 소용없다', () => {
  const ctx = 세상({});
  vm.runInContext('rhAutoSaveStart()', ctx);
  assert.equal(ctx._틱.length, 1, '타이머가 안 걸렸습니다');
  assert.equal(ctx._틱[0].ms, vm.runInContext('RH_AUTO_MS', ctx),
    '★ 타이머가 RH_AUTO_MS 가 아닌 다른 값으로 걸렸습니다');
  assert.ok(ctx._틱[0].ms <= 60000, '★ 걸린 사이가 1분을 넘습니다');
});

/* ══════ ② 편집 중일 때만 ══════ */
test('편집 중이 아니면 담지 않는다 — 안 여는 서류를 30초마다 쓰면 안 된다', async () => {
  const ctx = 세상({ 편집중: false });
  const 됐나 = await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(됐나, false, '편집 중이 아닌데 담았습니다');
  assert.equal(ctx._담긴.length, 0, '★ 편집 중이 아닌데 담겼습니다');
});

test('편집 중이면 담는다', async () => {
  const ctx = 세상({});
  const 됐나 = await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(됐나, true, '편집 중인데 안 담았습니다');
  assert.equal(ctx._담긴.length, 1, '★ 편집 중인데 안 담겼습니다');
});

/* ══════ ③ 겹쳐 돌지 않는다 ══════ */
test('★★ 겹쳐 돌지 않는다 — 앞엣것이 도는 동안 들어온 것은 쉰다', async () => {
  const ctx = 세상({});
  /* 내보내기를 «붙잡아» 앞엣것이 끝나지 않게 한다 */
  let 풀기;
  ctx.exportEditedHwpx = () => new Promise((res) => { 풀기 = () => res(null); });
  const 첫째 = vm.runInContext('rhAutoTick()', ctx);
  const 둘째 = await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(둘째, false, '★ 앞엣것이 도는 중인데 둘째가 들어갔습니다');
  assert.equal(ctx._담긴.length, 0, '아직 담길 때가 아닙니다');
  풀기();
  await 첫째;
  assert.equal(ctx._담긴.length, 1, '앞엣것이 끝나고 담겨야 합니다');
  /* 끝났으면 빗장이 풀려야 한다 — 안 풀리면 그 뒤로 영영 안 담는다 */
  assert.equal(vm.runInContext('_rhAutoBusy', ctx), false, '★ 빗장이 안 풀렸습니다');
  ctx.exportEditedHwpx = async () => null;   /* 붙잡아 두던 것은 놓는다 */
  await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(ctx._담긴.length, 2, '★ 그 뒤로 영영 안 담깁니다');
});

test('★ 담다가 걸려도 빗장은 풀린다 — 한 번 걸리고 영영 안 담기면 안 된다', async () => {
  const ctx = 세상({ 담기실패: true });
  await assert.rejects(() => vm.runInContext('rhAutoTick()', ctx));
  assert.equal(vm.runInContext('_rhAutoBusy', ctx), false, '★ 빗장이 안 풀렸습니다');
});

/* ══════ ④ 내보내기가 걸려도 담는다 ══════ */
test('★ 편집기를 못 읽어도 «담는 일»은 그대로 간다 — 올린 원본이라도 남겨야 한다', async () => {
  const ctx = 세상({ 내보내기실패: true });
  const 됐나 = await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(됐나, true);
  assert.equal(ctx._담긴.length, 1, '★ 내보내기가 걸렸다고 담기를 건너뛰었습니다');
});

test('편집기에서 읽으면 그것으로 갈아 끼운다', async () => {
  const ctx = 세상({ 바이트: new Uint8Array([9, 9, 9, 9, 9]) });
  await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(vm.runInContext('_rhDoc.bytes.length', ctx), 5,
    '★ 편집기에서 읽은 것이 안 들어갔습니다');
  assert.equal(vm.runInContext('_rhDoc.name', ctx), '양식_채움.hwpx', '이름이 바뀌었습니다');
});

test('빈 것이 오면 갈아 끼우지 않는다 — 있던 것을 지우면 안 된다', async () => {
  const ctx = 세상({ 바이트: new Uint8Array([]) });
  await vm.runInContext('rhAutoTick()', ctx);
  assert.equal(vm.runInContext('_rhDoc.bytes.length', ctx), 3,
    '★ 빈 것으로 덮어썼습니다');
});

/* ══════ ⑤ 화면이 가려지면 ══════ */
test('★★ 화면이 가려지는 순간 담는다 — 브라우저가 타이머를 늦춘다(폰은 멈춘다)', async () => {
  const ctx = 세상({});
  vm.runInContext('rhAutoSaveStart()', ctx);
  const 들은 = ctx._들은것.filter((x) => x.ev === 'visibilitychange');
  assert.equal(들은.length, 1, '★ 가려지는 것을 듣지 않습니다 — 마지막 30초를 잃습니다');
  ctx.document.visibilityState = 'hidden';
  들은[0].fn();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ctx._담긴.length, 1, '★ 가려졌는데 안 담겼습니다');
});

test('★ 다시 보일 때는 담지 않는다 — 아무 일도 없었는데 수 MB 를 쓴다', async () => {
  const ctx = 세상({});
  vm.runInContext('rhAutoSaveStart()', ctx);
  const 들은 = ctx._들은것.filter((x) => x.ev === 'visibilitychange')[0];
  ctx.document.visibilityState = 'visible';
  들은.fn();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ctx._담긴.length, 0, '★ 보일 때도 담았습니다');
});

/* ══════ ⑥ 듣는 사람은 한 번만 ══════ */
test('★ 두 번 불러도 듣는 사람은 하나 — 다시 부를 때마다 붙으면 쌓인다', () => {
  const ctx = 세상({});
  vm.runInContext('rhAutoSaveStart(); rhAutoSaveStart(); rhAutoSaveStart();', ctx);
  const 들은 = ctx._들은것.filter((x) => x.ev === 'visibilitychange');
  assert.equal(들은.length, 1, '★ 듣는 사람이 ' + 들은.length + ' 명 쌓였습니다');
});

/* ══════ ⑦ 담기면 시각을 말한다 — 두 자리 모두 ══════ */
test('★★ 담기면 «모든» 딱지가 시각을 말한다 — 작업 모드 기둥에도', () => {
  const ctx = 세상({});
  vm.runInContext('rhSaveTag("💾 담김 · 17:26:05", false)', ctx);
  assert.equal(ctx._딱지.length, 2, '딱지 자리가 둘이 아닙니다');
  ctx._딱지.forEach((el, i) => {
    assert.match(el.textContent, /담김/, '★ ' + (i + 1) + '번째 딱지가 안 바뀌었습니다');
  });
});

test('★★ 못 담으면 «붉게» 말한다 — 조용히 넘기면 하던 일을 통째로 잃는다', () => {
  const ctx = 세상({});
  vm.runInContext('rhSaveTag("⚠ 못 담았습니다", true)', ctx);
  ctx._딱지.forEach((el) => {
    assert.match(el.style.color, /red/, '★ 붉게 말하지 않습니다 — 성한 것과 구분이 안 됩니다');
  });
  vm.runInContext('rhSaveTag("💾 담김 · 17:26:05", false)', ctx);
  ctx._딱지.forEach((el) => {
    assert.ok(!/red/.test(el.style.color), '★ 다시 담겼는데 붉은 채로 남았습니다');
  });
});

test('딱지를 그리다 걸려도 담는 일은 안 멈춘다', () => {
  const ctx = 세상({});
  ctx.document.querySelectorAll = () => { throw new Error('없는 화면'); };
  assert.doesNotThrow(() => vm.runInContext('rhSaveTag("가", false)', ctx),
    '★ 딱지 때문에 담기가 멈춥니다');
});

/* ══════ ⑧⑨ 소스의 «모양» ══════ */
test('★★ 담기가 걸리면 알림은 «처음 한 번»만 — 30초마다 뜨면 일을 못 한다', () => {
  const save = cutFn(CODE, 'function rhDraftSave(');
  assert.match(save, /catch/, 'rhDraftSave 에 걸림 처리가 없습니다');
  const 걸림 = save.slice(save.lastIndexOf('catch'));
  assert.match(걸림, /rhSaveTag\([^)]*true\s*\)/,
    '★ 못 담았을 때 «붉은» 딱지를 안 그립니다 — 조용히 넘어갑니다');
  assert.match(걸림, /if\s*\(\s*!\s*_rhSaveFail\s*\)\s*toast\(/,
    '★ 알림이 «처음 한 번»으로 묶여 있지 않습니다 — 30초마다 뜹니다');
  assert.match(걸림, /_rhSaveFail\s*\+\+/, '★ 걸린 횟수를 세지 않습니다');
  assert.match(save, /_rhSaveFail\s*=\s*0/,
    '★ 다시 담겨도 «처음»으로 되돌리지 않습니다 — 그 뒤로는 영영 안 알립니다');
});

test('★★ 딱지를 그리는 곳은 «한 곳»(rhSaveTag) — 화면마다 따로 그리면 한쪽만 고쳐진다', () => {
  const save = cutFn(CODE, 'function rhDraftSave(');
  assert.ok(!/getElementById\(['"]rhDraftInfo['"]\)/.test(save),
    '★ rhDraftSave 가 딱지를 «직접» 그립니다 — 기둥 딱지가 빠집니다');
  assert.match(save, /rhSaveTag\(/, 'rhDraftSave 가 딱지를 안 그립니다');
});

test('★★ 딱지 자리가 «작업 모드 기둥에도» 있다 — 위 줄은 그 모드에서 감춰진다', () => {
  const 자리 = SRC.match(/data-savetag/g) || [];
  assert.ok(자리.length >= 2,
    '★ 딱지 자리가 ' + 자리.length + '곳뿐입니다 — 작업 모드에서는 아무 데도 안 보입니다');
  /* 그 자리가 정말 «기둥»(rh-workonly) 안이어야 한다 — 위 줄 안에 둘을 넣으면 헛일이다 */
  const 기둥 = SRC.match(/class="rh-workonly"[\s\S]{0,400}?<\/div>\s*<\/div>/g) || [];
  assert.ok(기둥.some((b) => /data-savetag/.test(b)),
    '★ 기둥(rh-workonly) 안에 딱지가 없습니다 — 작업 모드에서 안 보입니다');
});

test('★ 위 줄은 작업 모드에서 감춰진다 — 이 검사가 「왜 기둥에도 두는가」의 까닭이다', () => {
  assert.match(CODE, /body\.rh-work-on[^{]*#rhUploadBar[^}]*display:none/,
    '위 줄을 감추는 규칙이 사라졌습니다 — 그러면 기둥 딱지의 까닭도 달라집니다');
  assert.match(SRC, /id="rhDraftInfo"[^>]*data-savetag/,
    '위 줄 딱지에서 data-savetag 가 빠졌습니다');
});

test('★ 편집 중인지는 «한 곳»(rhEditing)에서 가른다', () => {
  const tick = cutFn(CODE, 'async function rhAutoTick(');
  assert.match(tick, /rhEditing\(\)/, '★ rhAutoTick 이 제 나름대로 가릅니다');
  const ed = cutFn(CODE, 'function rhEditing(');
  assert.match(ed, /rcEditCard/, 'rhEditing 이 편집 카드를 안 봅니다');
});
