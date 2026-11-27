/* 떠 있는 「백업·복구」 알약이 옆줄 맨 아래 줄을 «덮던» 것 (대표 화면 2026-09-06)
   「백업복구로 글자가 가려졌다 이부분 어떻게 해결하나」

   ★ 그 알약은 js/pu-backup.js 가 left:12px · bottom:58px 에 붙박아 둔다. 메일 창의
     옆줄 맨 아래 줄(‹ 기업정보함으로 · 🔒 개인 폴더 열기 · ⚙ 환경설정)이 바로 거기다.
     「‹ 기업정보함으로」가 「…으로」로 잘려 보였다.
   ⚠ 덮는 것은 곧 «못 누르는 것»이다 — 손가락이 알약을 먼저 만난다.
     2026-08-21 에 「전체 비우기」가 같은 알약에 가려 「…체 비우기」로 보였던 것과 같은 일.

   지키는 것.
   ① 메일 창에서는 알약을 비켜 둔다
   ② 그러면서 «길을 없애지 않는다» — 같은 창으로 가는 줄을 옆줄에 넣는다
   ③ 창을 두 벌로 짓지 않는다 — 알약을 그대로 누른다
   ④ 알약이 없는 사람에게는 그 줄도 안 그린다
   ⑤ (2026-11-19 바뀜) 기업정보함 PC 옆줄에서도 같은 길이다 — 대표 화면(2026-11-18, 1903px 크롬)에서
      남색 옆줄 맨 아래 「🔒 개인 폴더 열기」를 같은 알약이 덮고 있었다.
      옛 ⑤ 「메일 창에서만 — 기업정보함에서는 알약이 그대로」가 바로 그 겹침을 남겨 두었다.
      알약은 «그 줄이 보일 때만» 비킨다 — 옆줄을 접었거나·직원이거나·폰 차림이면 그대로 뜬다.
      포털·다른 앱은 이 파일과 상관없이 알약이 그대로다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');
const bare = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
const bottom = sliceFn(app, 'function pcSideBottomHtml(').replace(/\/\*[\s\S]*?\*\//g, ' ');

test('★★ 메일 창에서는 알약을 «비켜 둔다» — 안 비키면 맨 아래 줄을 못 누른다', () => {
  assert.match(bare, /body\.mailview #pu-backup-admin-button\{display:none!important\}/,
    '알약이 메일 창에서도 그대로 떠 있습니다 — 옆줄 맨 아래 줄을 덮습니다');
});

test('★★ 그러면서 «길을 없애지 않는다» — 옆줄에 같은 창으로 가는 줄이 있다', () => {
  assert.match(bottom, /mbBackupOpen\(\)/,
    '알약만 감추고 갈 길을 안 냈습니다 — 메일 창에서 백업·복구로 갈 수가 없습니다');
  assert.match(bottom, /백업·복구/, '무엇으로 가는 줄인지 안 적혀 있습니다');
});

test('★★ 창을 «두 벌로» 짓지 않는다 — 알약을 그대로 누른다', () => {
  const f = sliceFn(app, 'function mbBackupOpen(').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(f, /getElementById\('pu-backup-admin-button'\)/, '알약을 안 찾습니다');
  assert.match(f, /\.click\(\)/, '알약을 안 누릅니다 — 창을 새로 지으면 언젠가 한쪽만 고칩니다');
  assert.ok(!/innerHTML|showPanel|createElement/.test(f),
    '백업 창을 여기서 새로 짓습니다: ' + f);
});

test('★★ 알약이 없으면 «알려 주고» 끝난다 — 눌러도 아무 일 없으면 고장으로 읽힌다', () => {
  const f = sliceFn(app, 'function mbBackupOpen(').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(f, /if\(!b\) return toast\(/, '알약이 없을 때 조용히 지나갑니다');
});

test('★★ 그 줄은 «대표»일 때만 그린다 — 알약이 없는 직원에게 막히는 줄을 보이지 않는다', () => {
  assert.match(bottom, /state\.isAdmin\s*\?\s*`<button[^`]*mbBackupOpen\(\)/,
    '백업 줄이 대표 여부와 상관없이 그려집니다');
});

/* ══════ 진짜로 그려 본다 ══════ */
function draw(view, isAdmin){
  const ctx = { Object, String, Number, Array,
    state: { view: view, groups: {}, isAdmin: !!isAdmin, privOpen: false } };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function pcSideBottomHtml('), ctx);
  return ctx.pcSideBottomHtml();
}

test('★★ 메일 창에서 «나가는 길»과 «백업 길»이 함께 있다', () => {
  const h = draw('mail', true);
  assert.match(h, /기업정보함으로/, '메일 창에 갇힙니다');
  assert.match(h, /환경설정/, '설정으로 갈 길이 없습니다');
  assert.match(h, /백업·복구/, '백업·복구로 갈 길이 없습니다');
});

/* 기업정보함 PC 옆줄의 갈래들 — 명함 목록·사업자·기업 상세·근로자 · 자료함(메일 도구).
   대표 화면 2026-11-18: 이 옆줄 맨 아래 「🔒 개인 폴더 열기」를 알약이 덮었다. */
const CARD_VIEWS = ['list', 'co', 'wk', 'mat'];

test('★★ 기업정보함 옆줄에도 «백업 줄»이 있다 — 거기서도 알약이 맨 아래 줄을 덮었다 (2026-11-18)', () => {
  for (const v of CARD_VIEWS) {
    const h = draw(v, true);
    assert.match(h, /백업·복구/, v + ' 화면에서 백업·복구로 갈 줄이 없습니다 — 알약을 비키면 길이 끊깁니다');
    assert.match(h, /환경설정/, v + ' 화면에서 설정으로 갈 길이 없습니다');
    assert.match(h, /개인 폴더/, v + ' 화면에서 개인 폴더 줄이 사라졌습니다');
  }
});

test('★★ 알약이 없는 직원에게는 «안 그린다»', () => {
  const h = draw('mail', false);
  assert.ok(h.indexOf('백업·복구') < 0, '눌러도 막히는 줄을 보여 줍니다');
  assert.match(h, /기업정보함으로/, '직원이 메일 창에 갇힙니다');
  for (const v of CARD_VIEWS) {
    assert.ok(draw(v, false).indexOf('백업·복구') < 0, v + ' 화면에서 직원에게 막히는 줄을 보여 줍니다');
  }
});

/* ══════ 알약은 «그 줄이 보일 때만» 비킨다 ══════
   ⚠ 이름(class)을 박지 않는다 — 그린 줄에서 «백업 줄에만 붙은 이름»을 떠서, 그 이름으로
     알약을 감추는 CSS 가 있는지 본다. 둘 중 하나만 바뀌면(이름을 지우거나 CSS 를 지우면)
     알약이 다시 떠서 줄과 겹치거나, 줄 없이 알약만 사라진다. */
function backupOnlyClass(h){
  const btns = [...h.matchAll(/<button class="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
    .map(m => ({ cls: m[1].split(/\s+/).filter(Boolean), text: m[2] }));
  const mine = btns.find(b => /백업·복구/.test(b.text));
  assert.ok(mine, '그린 옆줄에서 백업 줄을 못 찾았습니다');
  const others = new Set(btns.filter(b => b !== mine).flatMap(b => b.cls));
  return mine.cls.filter(c => !others.has(c));
}
function pillHideSelectors(){
  return [...bare.matchAll(/([^{}]*#pu-backup-admin-button)\s*\{\s*display:none!important\s*\}/g)]
    .map(m => m[1].trim());
}

test('★★ 기업정보함 옆줄에서는 «그 줄이 있을 때» 알약을 비킨다 — 안 비키면 개인 폴더 줄을 못 누른다', () => {
  const own = backupOnlyClass(draw('list', true));
  assert.ok(own.length >= 1,
    '백업 줄에만 붙은 이름(class)이 없습니다 — CSS 가 «줄이 있을 때»를 알아볼 길이 없습니다');
  const sels = pillHideSelectors().filter(s => own.some(c => s.indexOf(':has(') >= 0 && s.indexOf('.' + c) > s.indexOf(':has(')));
  assert.ok(sels.length >= 1,
    '백업 줄이 있을 때 알약을 감추는 CSS 가 없습니다 — 알약이 옆줄 맨 아래를 그대로 덮습니다');
  for (const s of sels) {
    assert.match(s, /\bbody\.pc\b/, 'PC 차림이 아닐 때도 알약을 감춥니다(폰은 공용 앱바 몫): ' + s);
    assert.match(s, /:not\(\.sidehidden\)/,
      '옆줄을 접어도 알약을 감춥니다 — 그때는 백업 줄도 안 보여 길이 끊깁니다: ' + s);
  }
});

test('★★ 메일 창 규칙과 기업정보함 규칙이 «둘 다» 살아 있다 — 한쪽을 지우면 그 창에서 다시 겹친다', () => {
  const sels = pillHideSelectors();
  assert.ok(sels.some(s => /body\.mailview/.test(s)), '메일 창 규칙이 사라졌습니다');
  assert.ok(sels.some(s => /body\.pc/.test(s) && /:has\(/.test(s)), '기업정보함 규칙이 사라졌습니다');
});
