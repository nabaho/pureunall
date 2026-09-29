'use strict';
/* 📂 작성 중 서류를 «찾는 문» (대표 지적 2026-09-29 「저장이 어디에 되어 있는지 … 못찾는다」)
   ─────────────────────────────────────────────────────────────
   실측: 「💾 작성 중 저장」은 «「📂 작성 중」에서 이어서 합니다»라고 말했는데,
   그 딱지는 위 줄(#rhUploadBar)에 있고 작업 모드는 그 줄을 통째로 감춘다.
   그래서 담긴 것을 여는 문이 «화면 어디에도» 없었다.

   못 박는 것:
     ① 여는 단추는 작업 모드에서 보이는 기둥(rh-workonly)에 있고, 감춰지는 줄 «밖»이다
     ② 누르면 목록을 «열고» 그 자리로 옮겨 간다
     ③ 목록판 자체도 감춰지는 줄 밖이다 — 안이면 열어도 안 보인다
     ④ 저장 안내는 그 단추 이름을 말한다 — 안 보이는 딱지를 가리키지 않는다
     ⑤ 어디에 담기는지(이 PC 안) 말한다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* 여는 태그 자리에서 짝이 맞는 </div> 까지 */
function divBlock(src, at) {
  let depth = 0, i = at;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = at;
  let m;
  while ((m = re.exec(src))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return src.slice(at, re.lastIndex);
  }
  return src.slice(at);
}

test('① 여는 단추는 작업 모드 기둥에 있고, 감춰지는 위 줄 밖이다', () => {
  const at = html.indexOf('id="rhDraftRailBtn"');
  assert.ok(at > 0, '「📂 작성 중 서류 보기」 단추가 있어야 한다');
  const bar = divBlock(html, html.indexOf('<div class="toolbar" id="rhUploadBar"'));
  assert.ok(!bar.includes('rhDraftRailBtn'), '감춰지는 줄 안에 두면 작업 중에 안 보인다');
  const rail = html.lastIndexOf('<div class="rh-workonly"', at);
  assert.ok(rail > 0 && divBlock(html, rail).includes('rhDraftRailBtn'), '작업 모드에서 보이는 칸 안이어야 한다');
  assert.match(html.slice(at, at + 400), /onclick="rhDraftShow\(\)"/);
});

test('② 누르면 목록을 열고 그 자리로 옮겨 간다', () => {
  const fn = /function rhDraftShow\(\)\{[\s\S]*?\n\}/.exec(html);
  assert.ok(fn, 'rhDraftShow 가 있어야 한다');
  assert.match(fn[0], /classList\.remove\('hide'\)/);
  assert.match(fn[0], /rhDraftDraw\(\)/);
  assert.match(fn[0], /scrollIntoView/);
});

test('③ 목록판은 감춰지는 줄 밖이다', () => {
  const bar = divBlock(html, html.indexOf('<div class="toolbar" id="rhUploadBar"'));
  assert.ok(!bar.includes('id="rhDraftPanel"'));
  assert.doesNotMatch(html, /body\.rh-work-on[^{]*#rhDraftPanel/, '작업 모드가 목록판을 감추면 안 된다');
});

test('④ 저장 안내는 보이는 단추 이름을 말하고, 단추 수도 함께 센다', () => {
  const fn = /async function rhDraftNow\(quiet\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.match(fn, /작성 중 서류 보기/);
  const chk = /function rhDraftCheck\(\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.match(chk, /rhDraftNRail/);
});

test('⑤ 어디에 담기는지 말한다 — 이 PC 안', () => {
  const at = html.indexOf('id="rhDraftRailBtn"');
  assert.match(html.slice(at, at + 400), /이 PC/);
  const panel = html.slice(html.indexOf('id="rhDraftPanel"'), html.indexOf('id="rhDraftPanel"') + 800);
  assert.match(panel, /이 PC/);
});
