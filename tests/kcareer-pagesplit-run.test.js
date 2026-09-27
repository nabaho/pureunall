'use strict';
/* 여러 장 PDF 가르기를 «실제로 돌려» 본다 (대표 지시 2026-09-12)
   ────────────────────────────────────────────────────────────────────────
   ⚠ 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 — 그래서 앱의 `_ocrSplitPdf` 를
     vm 에 올리고, 가짜 판독기가 여러 가지로 답하게 해 «무엇이 담기는지»를 본다.
   ⚠ 여기서 꼭 못박는 것:
     ① 열 장 묶음 → 열 건, 그리고 «줄마다 제 쪽 그림»이 붙는다
        (원본 PDF 를 모든 줄에 붙이면 「잘못 붙은 원본 찾기」가 곧바로 경고한다)
     ② 한 서류면 가르지 않고 옛 길로 넘긴다(원본 PDF 통째 첨부)
     ③ 못 알아들으면 아무것도 담지 않고 옛 길로 — 되던 것이 멈추면 안 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const MOD = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-pagesplit.js'), 'utf8');

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

function 무대(답) {
  const 담긴 = [], 알림 = [];
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    toast: function (m) { 알림.push(m); },
    aiReady: function () { return true; },
    _geminiOCR: async function (prompt, b64, mt, imgs) {
      ctx._물음 = prompt; ctx._보낸장수 = (imgs || []).length;
      return 답 === undefined ? null : { parsed: 답 };
    },
    saveOCRRecord: async function (page, fields, file, ext, b64) {
      담긴.push({ page: page, fields: fields, name: file.name, size: file.size, ext: ext, b64: b64 });
      return 'ID-' + 담긴.length;
    },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  ctx.KcareerPageSplit = ctx.KcareerPageSplit || ctx.window.KcareerPageSplit;
  vm.runInContext([떼기('async function _ocrSplitPdf('), 떼기('function _splitPageName(')]
    .join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx: ctx, 담긴: 담긴, 알림: 알림 };
}

function 쪽그림(n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push('PAGE' + i + 'AAAA');
  return out;
}
const 파일 = { name: '위촉장 스캔 묶음.pdf', size: 999999 };

async function 돌려(m, 쪽수) {
  m.ctx._pay = { pages: 쪽그림(쪽수), b64: 'PAGE1AAAA', mt: 'image/jpeg', asImage: true };
  m.ctx._file = 파일;
  m.ctx._tally = function (r) { return !!r; };
  return await vm.runInContext(
    '_ocrSplitPdf("wiccok", _file, _pay, "사전", _tally)', m.ctx);
}

/* ══════ ★★★ 대표가 바라시는 것 ══════ */

test('★★★ 위촉장 열 장이 한 PDF 로 들어오면 «열 건»이 담긴다', async () => {
  const docs = [];
  for (let i = 1; i <= 10; i++) docs.push({ pages: [i], org: '기관' + i, titleVal: '위원' });
  const m = 무대({ docs: docs });
  const r = await 돌려(m, 10);
  assert.ok(r && r.split, '★★★ 가르지 않았습니다 — 아홉 건이 사라집니다');
  assert.equal(m.담긴.length, 10, '★★★ 담긴 것이 ' + m.담긴.length + '건뿐입니다');
  assert.equal(m.담긴[0].fields.org, '기관1');
  assert.equal(m.담긴[9].fields.org, '기관10');
});

test('★★★ 줄마다 «제 쪽 그림»이 붙는다 — 같은 원본을 여러 줄에 붙이면 안 된다', async () => {
  /* ⚠ 원본 PDF 를 모든 줄에 붙이면 「🔎 잘못 붙은 원본 찾기」가 곧바로
     「같은 파일이 N개 줄에 붙어 있습니다」라고 경고한다. 실제로 그렇게 만들면 안 된다. */
  const m = 무대({ docs: [
    { pages: [1], org: '가', titleVal: '위원' },
    { pages: [2], org: '나', titleVal: '위원' },
    { pages: [3], org: '다', titleVal: '위원' }] });
  await 돌려(m, 3);
  assert.equal(m.담긴[0].b64, 'PAGE1AAAA', '★★★ 1번 줄에 1쪽이 안 붙었습니다');
  assert.equal(m.담긴[1].b64, 'PAGE2AAAA', '★★★ 2번 줄에 2쪽이 안 붙었습니다');
  assert.equal(m.담긴[2].b64, 'PAGE3AAAA');
  const 이름 = m.담긴.map(function (x) { return x.name; });
  assert.equal(new Set(이름).size, 3, '★★★ 세 줄에 «같은 이름»이 붙었습니다');
  assert.match(이름[1], /2쪽/, '몇 쪽에서 나왔는지 이름에 남겨야 합니다');
  assert.match(이름[0], /^위촉장 스캔 묶음/, '어느 묶음에서 나왔는지도 남아야 합니다');
  m.담긴.forEach(function (x) { assert.equal(x.ext, 'jpg', '쪽은 그림으로 붙습니다'); });
});

test('★★ 여러 쪽짜리 서류는 «첫 쪽»이 붙고 이름에 쪽 범위가 남는다', async () => {
  const m = 무대({ docs: [
    { pages: [1], org: '가', titleVal: '위원' },
    { pages: [2, 3], org: '나', titleVal: '위원' }] });
  await 돌려(m, 3);
  assert.equal(m.담긴.length, 2);
  assert.equal(m.담긴[1].b64, 'PAGE2AAAA', '첫 쪽이 붙어야 합니다');
  assert.match(m.담긴[1].name, /2~3쪽/, '★★ 몇 쪽짜리였는지 안 남으면 나중에 아무도 모릅니다');
});

/* ══════ ★★ 가르면 «안 되는» 때 ══════ */

test('★★★ 한 서류면 가르지 않고 옛 길로 넘긴다 — 2장짜리 증명서를 둘로 만들면 안 된다', async () => {
  const m = 무대({ docs: [{ pages: [1, 2], org: '충청남도', titleVal: '위원' }] });
  const r = await 돌려(m, 2);
  assert.ok(r && r.one, '★★★ 한 서류인데 갈랐습니다');
  assert.equal(r.split, undefined);
  assert.equal(m.담긴.length, 0, '★★★ 여기서 담으면 원본 PDF 통째 첨부 길을 잃습니다');
  assert.equal(r.one.org, '충청남도', '읽은 값은 그대로 넘겨야 합니다(두 번 부르면 요금 두 배)');
});

test('★★★ 못 알아들으면 아무것도 담지 않고 null — 옛 길이 그대로 돌아간다', async () => {
  for (const 답 of [{ org: '충청남도', titleVal: '위원' }, { docs: [] }, '그냥 글', null]) {
    const m = 무대(답);
    const r = await 돌려(m, 4);
    assert.equal(r, null, '★★★ 이상한 답(' + JSON.stringify(답) + ')에 뭔가 담았습니다');
    assert.equal(m.담긴.length, 0);
  }
});

test('★★ 판독이 통째로 안 되면 조용히 물러선다 — 터지면 그 파일이 통째로 날아간다', async () => {
  const m = 무대(undefined);          /* _geminiOCR 가 null */
  const r = await 돌려(m, 3);
  assert.equal(r, null);
  assert.equal(m.담긴.length, 0);
});

test('★ 판독이 터져도 물러선다', async () => {
  const m = 무대({ docs: [{ pages: [1], org: '가', titleVal: '위원' }] });
  m.ctx._geminiOCR = async function () { throw new Error('망 끊김'); };
  const r = await 돌려(m, 3);
  assert.equal(r, null, '★ 터진 채로 두면 그 파일이 통째로 날아갑니다');
});

/* ══════ 어떻게 묻는가 ══════ */

test('★★ 판독은 «한 번만» 부르고, 쪽 그림을 «다» 보낸다', async () => {
  const m = 무대({ docs: [{ pages: [1], org: '가', titleVal: '위원' },
                          { pages: [2], org: '나', titleVal: '위원' }] });
  await 돌려(m, 6);
  assert.equal(m.ctx._보낸장수, 6, '★★ 쪽 그림을 다 보내야 뒤쪽 서류를 봅니다');
  assert.match(m.ctx._물음, /사전/, '부르는 쪽 사전을 그대로 안고 가야 합니다');
  assert.match(m.ctx._물음, /docs/, '★★ 갈라 달라고 못 박아야 합니다');
  assert.match(m.ctx._물음, /6쪽/, '몇 쪽인지 알려 줘야 쪽 번호가 맞습니다');
});

test('★ 서류가 아닌 쪽은 건너뛰고 «그렇다고 말한다»', async () => {
  const m = 무대({ docs: [{ pages: [1], org: '가', titleVal: '위원' },
                          { pages: [3], org: '나', titleVal: '위원' }] });
  await 돌려(m, 3);
  assert.equal(m.담긴.length, 2);
  assert.match(m.알림.join(' '), /건너뛰었습니다/, '★ 조용히 넘기면 「왜 2건뿐이냐」가 됩니다');
});

test('★ 몇 건을 찾았는지 먼저 알려 준다 — 열 건이 한꺼번에 늘면 놀란다', async () => {
  const m = 무대({ docs: [{ pages: [1], org: '가', titleVal: '위원' },
                          { pages: [2], org: '나', titleVal: '위원' }] });
  await 돌려(m, 2);
  assert.match(m.알림.join(' '), /서류 2건/, '몇 건인지 말해야 합니다');
});

test('★★ 뚜껑까지 찬 묶음이면 «더 있을 수 있다»고 말한다', async () => {
  const n = require('../js/kcareer-pagesplit.js').MAX_PAGES;
  const docs = [];
  for (let i = 1; i <= n; i++) docs.push({ pages: [i], org: '기관' + i, titleVal: '위원' });
  const m = 무대({ docs: docs });
  await 돌려(m, n);
  assert.match(m.알림.join(' '), /나눠서 넣어/, '★★ 말 안 하면 뒤쪽 서류가 조용히 사라집니다');
});

/* ══════ 앱에 이어져 있나 ══════ */

test('★★ 앱이 모듈을 싣고 ocrDrop 에서 가른다', () => {
  assert.match(SRC, /kcareer-pagesplit\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  const i = SRC.indexOf('async function ocrDrop(');
  const fn = SRC.slice(i, SRC.indexOf('/* ===== 원본 일괄매칭', i));
  assert.match(fn, /_ocrSplitPdf\(page,file,pay,prompt,tally\)/, '★★ ocrDrop 이 가르지 않습니다');
  assert.match(fn, /if\(_sp && _sp\.split\) continue;/, '★★ 갈라 담고도 또 담으면 두 배가 됩니다');
  assert.match(fn, /if\(_sp && _sp\.one\) parsed=_sp\.one;/,
    '★★ 한 서류일 때 읽은 값을 버리면 판독을 두 번 부릅니다');
  /* ⚠ 여러 장 묶음일 때만 가른다 — 한 장짜리까지 거치면 괜히 느려진다 */
  assert.match(fn, /pay\.pages\.length>1/, '★ 한 장짜리는 예전 길로 가야 합니다');
});

test('★★ 쪽 뚜껑은 «여기서만» 연다 — 「다시 읽기」는 4쪽 그대로다(요금·시간)', () => {
  assert.match(SRC, /async function _ocrPayload\(b64,ext,max\)/, '쪽 수를 밖에서 정할 수 있어야 합니다');
  assert.match(SRC, /_pdfPagesJpeg\(b64, max\)/, '받은 값을 써야 합니다');
  const i = SRC.indexOf('async function ocrDrop(');
  const fn = SRC.slice(i, SRC.indexOf('/* ===== 원본 일괄매칭', i));
  assert.match(fn, /_ocrPayload\(b64,ext,_maxPg\)/, '★★ 뚜껑을 안 열면 앞 4쪽만 읽습니다');
  const r = SRC.slice(SRC.indexOf('async function reOcrForm('), SRC.indexOf('async function extractTextForm('));
  assert.match(r, /_ocrPayload\(f\.base64,ext\)/, '★★ 「다시 읽기」까지 뚜껑을 열면 요금이 셋 배가 됩니다');
});
