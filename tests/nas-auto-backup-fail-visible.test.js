'use strict';
/* 자동 백업이 «조용히» 실패하던 자리 (2026-09-18, 나스를 막 연결한 뒤)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     7일 자동 백업은 아무도 안 볼 때 돈다. 그 실패를 `catch(){}` 가 통째로 삼켰다 —
     코드 주석에도 「⚠ 남은 일: 실패를 설정 화면 기록에라도 남길 것」이라 적혀 있었다.
     그 사이 설정 화면은 초록 띠로 「주 1회 자동 백업 활성화됨」이라고만 말한다.
     **한 장도 안 올라갔어도 사람은 백업이 있는 줄 안다.**
     백업은 «없는 것»보다 «없는 줄 모르는 것»이 나쁘다 — 정작 필요할 때 없다.
   ■ 하나 더
     실패하면 성공 시각을 안 남기므로 앱을 열 때마다 저장소 4MB 를 풀어 글자로 만들고
     나스에 붙어 보고 또 실패했다. 사무실 밖에서는 그것이 «늘»이다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 실패를 기록에 남긴다 (삼키지 않는다)
     ② 성공도 남긴다 — 「마지막에 됐는가」를 화면이 읽어야 한다
     ③ 실패 뒤엔 하루 쉰다 — 앱 열 때마다 되풀이하지 않는다
     ④ 「지금 초기화」는 물러서기 기록도 푼다 — 안 그러면 눌러도 안 돈다
     ⑤ 실패했으면 초록 「활성화됨」이라 말하지 않는다
     ⑥ 까닭은 사람 말로 적는다 — 'Failed to fetch' 로는 아무도 못 고친다
     ⑦ 깨진 기록에 넘어지지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 도우미들만 떼어 가짜 localStorage 위에서 실제로 돌려 본다 */
function load() {
  const store = {};
  const src = [
    "var NAS_AUTO_KEY = 'pureun_v6_nas_auto_backup';",
    "var NAS_AUTO_TRY_KEY = 'pureun_v6_nas_auto_try';",
    "var NAS_AUTO_RETRY_MS = 24 * 60 * 60 * 1000;",
    cutFn(ERP, 'function nasAutoWhy('),
    cutFn(ERP, 'function nasAutoNote('),
    cutFn(ERP, 'function nasAutoLastTry('),
    cutFn(ERP, 'function nasAutoClear('),
  ].join('\n');
  const ctx = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, store };
}

test('①★★ 실패를 «삼키지» 않는다 — catch 가 기록을 남긴다', () => {
  /* 자동 백업 갈래의 catch 를 글자로 본다 — 빈 catch 로 돌아가면 그 자리에서 걸린다 */
  const auto = ERP.slice(ERP.indexOf('// ── NAS 자동 백업 (7일 주기'));
  const head = auto.slice(0, auto.indexOf('}, []);'));
  assert.match(head, /\.catch\(function\s*\([^)]+\)\s*\{[^}]*nasAutoNote\(\s*false/,
    '★★ 이 catch 가 비어 있던 것이 바로 「백업되는 줄 알았는데 한 장도 없다」가 되는 길이다');
  const { ctx, store } = load();
  ctx.nasAutoNote(false, '나스에 못 닿았습니다');
  const v = ctx.nasAutoLastTry();
  assert.equal(v.ok, false);
  assert.match(v.why, /못 닿았/, '★ 까닭이 없으면 기록이 있어도 못 고친다');
  assert.ok(typeof v.at === 'number' && v.at > 0, '★ 언제인지 없으면 「지금도 그런가」를 모른다');
  assert.ok(store['pureun_v6_nas_auto_try'], '★ 남긴 자리가 없다');
});

test('② 성공도 남긴다 — 화면이 「마지막에 됐는가」를 읽어야 한다', () => {
  const auto = ERP.slice(ERP.indexOf('// ── NAS 자동 백업 (7일 주기'));
  assert.match(auto.slice(0, auto.indexOf('}, []);')), /nasAutoNote\(\s*true/,
    '★ 성공을 안 남기면 실패 기록이 영영 안 지워져 초록으로 못 돌아온다');
  const { ctx } = load();
  ctx.nasAutoNote(false, '안 됨');
  ctx.nasAutoNote(true, '');
  assert.equal(ctx.nasAutoLastTry().ok, true);
});

test('③★ 실패 뒤엔 하루 쉰다 — 앱 열 때마다 4MB 를 풀지 않는다', () => {
  const auto = ERP.slice(ERP.indexOf('// ── NAS 자동 백업 (7일 주기'));
  const head = auto.slice(0, auto.indexOf('var _run ='));
  assert.match(head, /nasAutoLastTry\(\)/, '★ 지난 시도를 안 보면 물러설 수가 없다');
  assert.match(head, /!\s*\w+\.ok[\s\S]{0,80}NAS_AUTO_RETRY_MS/,
    '★★ 실패했을 때«만» 쉬어야 한다 — 성공했을 때도 쉬면 7일 주기가 망가진다');
  /* 물러서기는 «받기 전»에 있어야 한다 — 뒤면 이미 4MB 를 풀어 놓은 뒤다 */
  assert.ok(head.indexOf('NAS_AUTO_RETRY_MS') < auto.indexOf('JSON.stringify(data'),
    '★★ 무거운 일 뒤에서 물러서면 물러선 뜻이 없다');
});

test('④★ 「지금 초기화」는 물러서기 기록도 푼다 — 안 그러면 눌러도 안 돈다', () => {
  const { ctx, store } = load();
  store['pureun_v6_nas_auto_backup'] = '123';
  ctx.nasAutoNote(false, '안 됨');
  ctx.nasAutoClear();
  assert.equal(ctx.nasAutoLastTry(), null, '★★ 시도 기록이 남으면 「즉시 실행」이 하루를 더 쉰다 — 눌러도 아무 일이 없다');
  assert.equal(store['pureun_v6_nas_auto_backup'], undefined);
  /* 화면의 단추가 실제로 그 길을 쓰는지 */
  /* ⚠ 자리를 «주석»으로 잡지 않는다 — 2026-09-18 좌우 배치를 하며 그 주석이 사라져 검사가 깨졌다 */
  const btn = ERP.slice(ERP.indexOf('var 못돎 ='), ERP.indexOf('지금 초기화 (즉시 실행)'));
  assert.match(btn, /nasAutoClear\(\)/, '★ 단추가 열쇠 하나만 지우면 물러서기가 그대로 남는다');
});

test('⑤★★ 실패했으면 초록 「활성화됨」이라 말하지 않는다', () => {
  const banner = ERP.slice(ERP.indexOf('var 시도 = nasAutoLastTry()'), ERP.indexOf('지금 초기화 (즉시 실행)'));
  assert.match(banner, /nasAutoLastTry\(\)/, '★ 띠가 지난 시도를 안 읽으면 늘 초록이다');
  assert.match(banner, /실패했습니다/, '★★ 한 장도 안 올라갔는데 「활성화됨」만 보이면 화면이 거짓말한다');
  /* 색도 갈려야 한다 — 글자만 바뀌고 초록 바탕이면 눈에 안 들어온다 */
  assert.match(banner, /#fef2f2/, '★ 실패인데 초록 바탕이면 사람은 넘어간다');
  assert.match(banner, /아직 한 번도 성공한 적 없습니다|마지막 성공/,
    '★ 「그럼 마지막으로 된 게 언제인가」에 답하지 않으면 무엇을 잃었는지 모른다');
});

test('⑥ 까닭은 사람 말로 적는다 — 「Failed to fetch」 로는 아무도 못 고친다', () => {
  const { ctx } = load();
  const w = ctx.nasAutoWhy(new Error('Failed to fetch'));
  assert.doesNotMatch(w, /Failed to fetch/, '★ 영어 그대로면 대표님이 읽고 하실 것이 없다');
  assert.match(w, /인증서|사무실|CORS/, '★ 무엇을 볼지 말해 줘야 고친다');
  assert.ok(ctx.nasAutoWhy(null).length > 0, '★ 빈 오류에도 할 말은 있어야 한다');
});

test('⑦ 깨진 기록에 넘어지지 않는다 — 여기서 터지면 이알피가 안 뜬다', () => {
  const { ctx, store } = load();
  store['pureun_v6_nas_auto_try'] = '{깨진';
  assert.equal(ctx.nasAutoLastTry(), null);
  store['pureun_v6_nas_auto_try'] = '"글자"';
  assert.equal(ctx.nasAutoLastTry(), null);
  store['pureun_v6_nas_auto_try'] = '{"ok":false}';
  assert.equal(ctx.nasAutoLastTry(), null, '★ 시각 없는 기록을 받으면 «언제»가 NaN 이 되어 화면에 Invalid Date 가 뜬다');
});
