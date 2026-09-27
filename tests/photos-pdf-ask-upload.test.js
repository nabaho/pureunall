'use strict';
/* 「이대로 올리기」를 누르면 **진짜로 올라가나** (대표 물음 2026-09-10)
   실행: node --test tests/photos-pdf-ask-upload.test.js

   ■ 무슨 일이 있었나
   여러 쪽 PDF 를 고르면 「한 문서로 / 쪽마다 따로」를 묻는 창이 뜬다(2026-08-24).
   그 창에서 **무엇을 눌러도** 「올리기를 취소했습니다」가 뜨고 한 장도 안 올라갔다.

   까닭은 한 줄이었다 — 「이대로 올리기」가 창을 닫는데, 창을 닫는 함수가
   「닫혔으면 올리지 않는다」를 지키려고 **취소 약속을 부른다.** 그래서 done(null) 이
   먼저 불리고, 뒤이은 done(고른값) 은 이미 끝난 약속이라 조용히 버려졌다.

   ★ **창이 생긴 날부터 그랬다.** 한 쪽짜리 파일은 이 창을 안 거쳐 멀쩡했기에
     열여덟 날 동안 아무도 못 알아챘다. 그 사이 여러 쪽 스캔은 한 장도 안 담겼다.

   ■ 그래서 이 검사는 «글자»가 아니라 «답»을 본다
   진짜 함수를 그대로 싣고, 사람처럼 단추를 눌러 **무엇이 돌아오는지** 본다.
   글자로만 보면(「_pdfAskCancel = null 이 있나」) 같은 함정을 다른 모양으로 또 판다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');

/* 아주 작은 가짜 화면 — 창이 실제로 하는 일(단추 이름·보임·비우기)만 흉내낸다 */
function fakeDom() {
  const els = {};
  const mk = function (id) {
    return {
      id: id, style: {}, textContent: '', innerHTML: '', disabled: false, onclick: null,
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; }
    };
  };
  return {
    els: els,
    $: function (id) { return (els[id] = els[id] || mk(id)); }
  };
}

/* 진짜 코드를 그대로 싣는다 — 대역을 만들면 화면과 다른 것을 보게 된다 */
function loadAsk() {
  const dom = fakeDom();
  const ctx = {
    console, Object, Array, String, Boolean, Promise, JSON,
    $: dom.$,
    esc: function (s) { return String(s); },
    showKindDelBtn: function () { },
    _pdfAskPick: null, _pdfAskCancel: null
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(app, 'function askPdfSplit(').replace('function ', 'globalThis.askPdfSplit = function '),
    cutFn(app, 'function pdfAskSet(').replace('function ', 'globalThis.pdfAskSet = function '),
    cutFn(app, 'function showKindPopup(').replace('function ', 'globalThis.showKindPopup = function '),
    cutFn(app, 'function closeKindPopup(').replace('function ', 'globalThis.closeKindPopup = function ')
  ].join('\n'), ctx);
  return { ctx: ctx, dom: dom };
}

/* ⚠ 이 창의 고장 가운데 하나는 «약속이 영영 안 풀리는» 것이다. 그대로 기다리면
     검사가 실패하는 것이 아니라 **멈춘다** — 그러면 CI 가 멎고, 멎은 검사는 무엇이
     틀렸는지 한 마디도 안 해 준다. 실제로 되돌림 검사를 돌리다 그렇게 멈췄다.
   ★ 그래서 기다림에 «끝»을 둔다. 안 풀리면 «실패»한다. */
function 기다리기(p, 무슨일) {
  return Promise.race([p, new Promise(function (_, no) {
    setTimeout(function () {
      no(new Error('★ ' + 무슨일 + ' — 3초가 지나도 답이 없습니다.\n' +
        '  기다리던 약속이 영영 안 풀린 것입니다. 화면에서는 올리기가 조용히 멎고\n' +
        '  아무 말도 안 나옵니다(무엇이 잘못됐는지 알 길이 없는 가장 나쁜 고장입니다).'));
    }, 3000).unref();
  })]);
}

const ROWS = [{ name: 'scan0007', pages: 2, hint: { split: false, why: '글자층이 없는 스캔입니다' } }];

test('★★★ 「이대로 올리기」를 누르면 «올라간다» — 이 하나 때문에 열여덟 날 동안 못 올렸다', async () => {
  const { ctx, dom } = loadAsk();
  const p = ctx.askPdfSplit(ROWS);
  assert.equal(dom.els.kindPopup.style.display, 'flex', '★ 창이 안 떴습니다');
  dom.els.kindPopupOk.onclick();                       // 사람이 「이대로 올리기」를 누른다
  const ans = await 기다리기(p, '「이대로 올리기」를 눌렀다');
  assert.notEqual(ans, null,
    '★★★ 「이대로 올리기」를 눌렀는데 «취소»가 돌아옵니다.\n' +
    '  부르는 쪽은 이 값이 null 이면 「올리기를 취소했습니다」를 띄우고 한 장도 안 올립니다.\n' +
    '  → 창을 닫기 «전»에 취소 약속(_pdfAskCancel)을 내려놓아야 합니다.');
  assert.deepEqual(Object.keys(ans), ['scan0007'], '고른 결과가 파일 이름별로 와야 합니다');
});

test('권하는 쪽이 기본값으로 돌아온다 — 글자층 없는 스캔은 「한 문서로」', async () => {
  const { ctx, dom } = loadAsk();
  const p = ctx.askPdfSplit(ROWS);
  dom.els.kindPopupOk.onclick();
  assert.equal((await 기다리기(p, '「이대로 올리기」를 눌렀다'))['scan0007'], false, '★ 한 문서로 권했는데 쪽마다 따로 올립니다');
});

test('업체가 여럿으로 보이면 「쪽마다 따로」가 기본이다 — 업체가 사라지면 안 된다', async () => {
  const { ctx, dom } = loadAsk();
  const p = ctx.askPdfSplit([{ name: '모음', pages: 4,
    hint: { split: true, why: '사업자번호가 3가지 보입니다' } }]);
  dom.els.kindPopupOk.onclick();
  assert.equal((await 기다리기(p, '「이대로 올리기」를 눌렀다'))['모음'], true, '★ 여러 업체를 한 문서로 묶으면 뒤쪽 업체가 사라집니다');
});

test('★ 「올리지 않기」·바깥 클릭·ESC 로 닫으면 «올리지 않는다» — 반쯤 올라가면 치우기가 더 일이다', async () => {
  const { ctx, dom } = loadAsk();
  const p = ctx.askPdfSplit(ROWS);
  ctx.closeKindPopup();                                // 취소·ESC·바깥 클릭이 지나는 길
  assert.equal(await 기다리기(p, '창을 닫았다'), null,
    '★ 창을 닫았는데 올라갑니다 — 안 올리겠다고 한 것이 안 듣습니다');
});

test('★ 창을 닫아도 «약속이 반드시 풀린다» — 안 풀리면 올리기가 영원히 멎은 채 말이 없다', async () => {
  const { ctx, dom } = loadAsk();
  let 끝났나 = false;
  ctx.askPdfSplit(ROWS).then(function () { 끝났나 = true; });
  ctx.closeKindPopup();
  await new Promise(function (r) { setTimeout(r, 0); });
  assert.equal(끝났나, true, '★ 기다리던 약속이 안 풀렸습니다 — 화면이 조용히 멈춥니다');
});

test('한 창을 여러 일에 돌려 쓰므로, 닫을 때 단추 이름을 «되돌린다»', async () => {
  const { ctx, dom } = loadAsk();
  const p = ctx.askPdfSplit(ROWS);
  assert.equal(dom.els.kindPopupCancel.textContent, '올리지 않기');
  dom.els.kindPopupOk.onclick();
  await 기다리기(p, '「이대로 올리기」를 눌렀다');
  assert.equal(dom.els.kindPopupCancel.textContent, '취소',
    '★ 분류를 고치는 창에도 「올리지 않기」가 남습니다');
});
