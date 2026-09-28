'use strict';
/* 저장 이름 = «해 + 올린 신청서 이름 + 날짜» (대표 지시 2026-09-28)
   ─────────────────────────────────────────────────────────────
   「문서 저장시에 업로드했던 지원신청서의 이름을 가지고 와서 0000년 00000 신청서 0000. 00. —
    날짜 등으로 저장해라」
   ■ 무엇이 문제였나 — 한글 편집기 「저장」 창에 «양식» 두 글자만 떴다.
     편집기는 우리가 열 때 넘긴 이름(loadFile 의 두 번째 값)을 저장 이름으로 쓴다.
   ⚠ 앱의 진짜 rhSaveName 을 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
const 줄 = SRC.match(/var RH_PLAIN_NAME=[^\n]*\n/);
const ctx = { Date, String, Math };
vm.createContext(ctx);
vm.runInContext((줄 ? 줄[0] : '') + 떼기('function rhSaveName(') + '\n' + 떼기('function rhUploadName('), ctx);
const 날 = new Date(2026, 8, 28);          /* 2026-09-28 */
const 이름 = (a, b) => { ctx.__a = [a, b, 날]; return vm.runInContext('rhSaveName(__a[0],__a[1],__a[2])', ctx); };

test('★★★ 올린 신청서 이름으로 «해 + 이름 + 날짜»가 된다', () => {
  assert.equal(이름('[한국기계연구원] 위원 신청서.hwp', ''), '2026년 [한국기계연구원] 위원 신청서 2026. 09. 28.hwpx');
});

test('★★ 「양식」처럼 뭉뚱그린 이름이면 서류에서 찾은 제목을 쓴다 — 대표 화면에 「양식」만 떴다', () => {
  assert.equal(이름('양식.hwpx', '위원 위촉 신청서'), '2026년 위원 위촉 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('', '위원 위촉 신청서'), '2026년 위원 위촉 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('양식', ''), '2026년 양식 2026. 09. 28.hwpx', '제목도 없으면 이름이라도 남긴다');
  assert.equal(이름('신청서.hwp', '다른 제목'), '2026년 신청서 2026. 09. 28.hwpx', '★ 제대로 된 이름을 제목으로 덮었습니다');
});

test('★★★ 다시 올려 저장해도 해·날짜가 «쌓이지» 않는다', () => {
  const 한번 = 이름('위원 신청서.hwp', '');
  assert.equal(이름(한번, ''), 한번, '★★★ 해나 날짜가 두 번 붙었습니다: ' + 이름(한번, ''));
  assert.equal(이름('위원 신청서_채움_날인.hwpx', ''), '2026년 위원 신청서 2026. 09. 28.hwpx', '꼬리를 안 걷습니다');
  assert.equal(이름('위원 신청서_작성.hwpx', ''), '2026년 위원 신청서 2026. 09. 28.hwpx');
});

test('★ 이름 앞에 해가 있으면 «그 해»를 쓴다 — 그 서류의 해다', () => {
  assert.equal(이름('2025 서산시 노동인권 강사 신청서.hwp', ''), '2025년 서산시 노동인권 강사 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('2027년 위원 신청서.hwpx', ''), '2027년 위원 신청서 2026. 09. 28.hwpx');
});

test('★ 파일 이름에 못 쓰는 글자는 걸러 낸다', () => {
  const n = 이름('위원/신청서: 1차?.hwp', '');
  assert.ok(!/[\\/:*?"<>|]/.test(n.replace(/\.hwpx$/, '')), '못 쓰는 글자가 남았습니다: ' + n);
});

test('★★ 올린 이름은 «처음 올린 것»이 먼저다 — 한글에서 고쳐 온 파일 이름이 아니다', () => {
  ctx._rhOrig = { name: '처음 신청서.hwp' }; ctx._rhBase = { name: '고쳐 온 것.hwpx' }; ctx._rhDoc = { name: 'x.hwpx' };
  assert.equal(vm.runInContext('rhUploadName()', ctx), '처음 신청서.hwp');
  ctx._rhOrig = null;
  assert.equal(vm.runInContext('rhUploadName()', ctx), '고쳐 온 것.hwpx');
  ctx._rhBase = null;
  assert.equal(vm.runInContext('rhUploadName()', ctx), 'x.hwpx');
});

test('★★★ 세 저장 길이 모두 이 이름을 쓴다 — 편집기 저장창 · 내보내기 · 보관함 완성본', () => {
  assert.match(떼기('async function rhHwpEdOpen('), /_hwpEdCreate\(box, bytes, rhSaveName\(/,
    '★★★ 편집기에 옛 이름을 넘깁니다 — 저장 창에 「양식」이 뜹니다');
  assert.match(떼기('async function rhHwpOut('), /name=rhSaveName\(rhUploadName\(\)/, '★★ 내보내기 이름이 다릅니다');
  assert.match(떼기('async function confirmResumeSave('), /genName=rhSaveName\(/, '★ 보관함 완성본 이름이 다릅니다');
});
