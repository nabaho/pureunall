'use strict';
/* 「중복서류도 아닌데 갑자기 계속 사라진다」 (대표 지시 2026-09-14)

   ■ 무엇이 사라졌나 — 실측
   지운 기록(dellog)을 세어 보니 **179장**이 「중복」이라는 까닭으로 스스로 지워져 있었다.
     · 사업자등록증 113 · 명함 65 · 사진 1
     · 직원 넷 모두에게서(권형하 71 · 김보람 78 · 박은비 29 · 신욱임 1)
     · 그중 **44장**은 사흘도 아닌 «몇 달 전» 기록과 겹쳤다는 이유였다
     · 되살려진 것은 **한 장도 없다** — 사라진 줄을 몰랐기 때문이다

   ■ 왜 그랬나 — «서류»를 «사람 기록»으로 판정했다
   등록 층(js/pu-doc-file.js)이 주는 redundant 는 «기업정보함 기록에 새로 채울 칸이
   없었다»는 뜻이다. 겹침 열쇠는 명함·서식이 «휴대폰», 사업자등록증이 «사업자번호»라,
     · 같은 담당자가 낸 **다른 서식**
     · 같은 회사의 **다른 서류**, 또는 해가 바뀌어 다시 받은 사업자등록증
   이 모두 「이미 있다」로 잡힌다. 그 사람·그 회사가 이미 온전히 들어 있으면 채울 칸이
   없으니 redundant 가 참이 되고 — **사진이 사라졌다.** 서류는 아무 잘못이 없다.
   증빙은 5년 보관인데 그것이 말없이 지워졌다.

   ■ 못 박는 규칙 셋
   ① 겹친다고 **스스로 지우지 않는다** — 치우는 것은 사람이 누른다
   ② 「겹친다」고 말하는 것은 **명함뿐** — 서식·등록증은 이미 있는 것이 정상이다
   ③ **안 한 일을 했다고 적지 않는다** — 「휴지통으로 보냈습니다」는 이제 거짓말이다

   실행: node --test tests/photos-dup-no-autodelete.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments, stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const app = stripComments(raw);

/* ══════ ① 스스로 지우지 않는다 ══════ */

test('★★ 겹침을 알아낸 자리에서 사진을 «지우지 않는다» — 179장이 그렇게 사라졌다', () => {
  const fn = stripJs(cutFn(raw, 'function noteRedundant('));
  assert.ok(!/deletePhoto\(/.test(fn),
    '★★ 자동 삭제가 되살아났습니다. 「겹친다」의 판정은 «기업정보함 기록에 채울 칸이\n' +
    '  있나»지 «서류가 같은가»가 아닙니다 — 같은 사람이 낸 다른 서식, 같은 회사의\n' +
    '  다른 서류가 그 판정에 걸립니다.');
  assert.match(fn, /dupNotes\.push\(/, '★ 겹친다는 사실을 아무 데도 안 남깁니다');
});

/* 실제로 돌려 본다 — 글자만 보면 「안 지우는 척하고 다른 함수로 지우는」 것을 못 잡는다 */
function runNote(mine) {
  const calls = { del: 0, render: 0 };
  const ctx = {
    Promise, Object, Array, console,
    dupNotes: [],
    isMinePhoto: function () { return mine; },
    PuPhotoStore: { deletePhoto: function () { calls.del++; return Promise.resolve(); } },
    PuDocFile: { whenText: function () { return '2026-09-14 17:54'; } },
    gridItems: [], viewerId: '',
    renderDupBox: function () { calls.render++; },
    renderGridBar: function () { }, renderGrid: function () { },
    closeViewer: function () { }, refreshTrashCount: function () { }
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(raw, 'function noteRedundant(') +
    '\n;this.go = noteRedundant;', ctx);
  return ctx.go('p1', '2026', { dupAt: 1, dupWho: '김철수 · (주)부성엘엔디' })
    .then(function () { return { calls: calls, notes: JSON.parse(JSON.stringify(ctx.dupNotes)) }; });
}

test('★★ 내 사진이어도 «지우지 않고» 알리기만 한다', async () => {
  const r = await runNote(true);
  assert.equal(r.calls.del, 0,
    '★★ 겹쳤다는 이유로 사진을 지웠습니다 — 이것이 179장이 사라진 그 길입니다.');
  assert.equal(r.notes.length, 1, '★ 겹친다는 사실을 안 남기면 사람이 알 수가 없습니다');
  assert.equal(r.notes[0].gone, false, '★ 치우지도 않고 치웠다고 적습니다');
  assert.ok(r.calls.render > 0, '★ 화면에 안 그리면 아무도 못 봅니다');
});

test('★ 남의 사진은 «치우기 단추조차» 안 띄운다', async () => {
  const r = await runNote(false);
  assert.equal(r.calls.del, 0);
  assert.equal(r.notes.length, 0,
    '★ 남의 사진에 치우기 단추를 띄우면, 눌러도 서버가 막고 그 사람은 까닭을 모릅니다');
});

/* ══════ ② 「겹친다」고 말하는 것은 명함뿐 ══════ */

test('★★ 서식·사업자등록증은 «겹쳤다고 말하지 않는다» — 사라진 113장이 등록증이었다', () => {
  const j = app.indexOf('noteRedundant(id, year, res)');
  assert.ok(j > 0, '★ 겹침을 알리는 곳을 찾을 수 없습니다');
  const line = app.slice(Math.max(0, j - 200), j + 40);
  assert.match(line, /res\.redundant && read\.kind === 'card'/,
    "★★ 갈래를 안 가리면 **새 서류를 낼 때마다 겹쳤다고 말합니다.**\n" +
    '  그 사람·그 회사가 기업정보함에 이미 있는 것은 서식·등록증에서는 «정상»입니다.');
});

/* ══════ ③ 안 한 일을 했다고 적지 않는다 ══════ */

test('★★ 「휴지통으로 보냈습니다」는 이제 거짓말이다 — 사람이 헛걸음한다', () => {
  const fn = stripJs(cutFn(raw, 'function renderDupBox('));
  assert.ok(!/장을 휴지통으로 보냈습니다/.test(fn),
    '★★ 안 보냈는데 보냈다고 적고 있습니다 — 사람이 사진을 찾으러 휴지통에 갑니다.');
  assert.match(fn, /사진은 그대로 둡니다/, '★ 그대로 두었다는 말이 없습니다');
  assert.match(fn, /PuDocFile\.whenText\(/, '★ 무엇과 겹쳤는지 안 보여 줍니다');
});

test('★★ 치우는 길은 «사람이 누르는» 단추 하나 — 까닭을 적고 휴지통으로', () => {
  const fn = stripJs(cutFn(raw, 'function dropDup('));
  assert.match(fn, /PuPhotoStore\.deletePhoto\(/, '★ 휴지통을 안 거치고 지웁니다');
  assert.match(fn, /겹침 —/, '★ 왜 치웠는지 지운 기록에 안 남깁니다');
  assert.match(fn, /사람이 치움/,
    '★★ 「사람이 치웠다」를 안 적으면, 다음에 세어 볼 때 자동 삭제와 구분이 안 됩니다 —\n' +
    '  179장을 찾아낸 것이 바로 그 «까닭 글»이었습니다.');
  assert.match(app, /onclick="dropDup\(/, '★ 사람이 누를 단추가 없습니다');
});

test('★★ 알리는 함수가 «치우기를 부르지 않는다» — 이름만 바꾼 자동 삭제가 되면 안 된다', () => {
  const fn = stripJs(cutFn(raw, 'function noteRedundant('));
  assert.ok(!/dropDup\(/.test(fn),
    '★★ 알리자마자 치우면 이름만 바뀐 자동 삭제입니다.');
});
