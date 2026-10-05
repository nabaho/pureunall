'use strict';
/* 📦 제출 꾸러미 — ① 한 파일을 줄마다 쪽으로 나누기 ② 메일 10MB 를 넘으면 저절로 줄이기
   (대표 승인 2026-10-05 「둘 다 목업대로」 · 줄이기는 「넘으면 저절로」)
   ⚠ 이 저장소엔 pdf-lib 이 없다(화면은 cdnjs 에서 받는다) — 그래서 PDF 는 «가짜 문서»로 돌리되,
     화면의 진짜 함수(_pkRowPdf·_pkShrinkToLimit)를 그대로 떼어 돌린다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../js/kcareer-pack.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(head) { const i = SRC.indexOf(head); assert.ok(i > 0, head + ' 없음'); return SRC.slice(i, SRC.indexOf('\n}', i) + 2); }
const 목록 = (r) => (r.idx ? r.idx.join(',') : r.all ? '전체' : 'ERR');

test('① 쪽 적기 — 1-2 · 3 · 1,3,5-6 · 4~5 · 비우면 전체', () => {
  assert.equal(목록(P.parsePages('1-2')), '0,1');
  assert.equal(목록(P.parsePages('3')), '2');
  assert.equal(목록(P.parsePages('1, 3, 5-6')), '0,2,4,5');
  assert.equal(목록(P.parsePages('4~5쪽')), '3,4');
  assert.equal(목록(P.parsePages('')), '전체');
  assert.equal(목록(P.parsePages('전체')), '전체');
  assert.equal(목록(P.parsePages('1-3', 3)), '전체', '모든 쪽을 고르면 전체와 같다(원본 그대로 넣을 수 있게)');
});

test('★ 잘못 적은 쪽은 «넣지 않고» 알린다 — 없는 쪽을 조용히 건너뛰면 빠진 서류가 나간다', () => {
  assert.ok(P.parsePages('3-1').err);
  assert.ok(P.parsePages('가나').err);
  assert.ok(P.parsePages('7', 5).err, '5쪽짜리에 7쪽');
  assert.ok(!P.parsePages('7').err, '쪽 수를 모를 때는 범위만 본다');
  const r = P.checkRow({}, [{ ext: 'pdf', pages: '7', total: 5, pdf: { pages: 5 } }]);
  assert.equal(r[0].level, 'miss', '점검이 빨갛게 알려야 합니다');
  const ok = P.checkRow({}, [{ ext: 'pdf', pages: '1-2', total: 5, pdf: { pages: 5 } }]);
  assert.ok(ok.some((x) => /2쪽/.test(x.text)));
});

test('같은 파일을 다음 줄에 넣으면 «안 쓴 첫 쪽»을 미리 적는다', () => {
  assert.equal(P.nextPages(['1-2']), '3');
  assert.equal(P.nextPages(['1-2', '4-5']), '6');
  assert.equal(P.nextPages([]), '');
});

/* 가짜 PDF — 쪽 번호만 들고 다닌다 */
function 세상(파일들) {
  const out = { pages: [] };
  const ctx = {
    console, Array, Error, String, Number, Math, Uint8Array, window: {},
    KcareerPack: P,
    PDFLib: { PDFName: { of: (n) => n }, PDFDocument: { create: async () => ({
      copyPages: async (src, arr) => arr.map((q) => ({ q, src: src.이름, node: { Annots: () => null } })),
      addPage(p) { if (p && p.q != null) out.pages.push(p.src + '#' + (p.q + 1)); else { out.pages.push('A4'); return { drawImage() {} }; } },
      embedJpg: async (x) => x, embedPng: async (x) => x,
      save: async () => 'saved' }) } },
    _pkBytes: async (f) => 파일들[f.name],
    /* ⚠ 화면은 «바이트»만 넘긴다 — 가짜 바이트가 쪽 수·이름을 들고 다닌다 */
    _pkPdfInfo: async (b) => ({ doc: { getPageCount: () => b.쪽, 이름: b.이름 }, fontless: [], sigFields: 0, formFields: 0 }),
    _pkRasterPages: async () => ({}), _attJpgOf: async (c) => c
  };
  vm.createContext(ctx);
  vm.runInContext(떼기('async function _pkRowPdf('), ctx);
  return { ctx, out };
}

test('★★ 줄마다 고른 쪽만 들어간다 — 신청서 한 파일을 1-2 · 3 · 4-5 로', async () => {
  const 파일 = { '신청서.pdf': { name: '신청서.pdf', bytes: { 쪽: 5, 이름: '신청서.pdf' } } };
  const { ctx, out } = 세상(파일);
  ctx.r = { files: [{ name: '신청서.pdf', pages: '4-5' }] };
  await vm.runInContext('_pkRowPdf(r)', ctx);
  assert.deepEqual(out.pages.slice(), ['신청서.pdf#4', '신청서.pdf#5']);
});

test('★ 쪽을 안 정하면 예전 그대로 «원본 바이트» — 글자·크기 보존', async () => {
  const 원본 = { 쪽: 3, 이름: 'a.pdf' };
  const { ctx, out } = 세상({ 'a.pdf': { name: 'a.pdf', bytes: 원본 } });
  ctx.r = { files: [{ name: 'a.pdf' }] };
  const r = await vm.runInContext('_pkRowPdf(r)', ctx);
  assert.strictEqual(r.bytes, 원본);
  assert.equal(out.pages.length, 0);
});

test('★ 없는 쪽은 만들 때도 멈춘다 — 점검을 건너뛰어도 빠진 채 나가지 않게', async () => {
  const { ctx } = 세상({ 'a.pdf': { name: 'a.pdf', bytes: { 쪽: 3, 이름: 'a.pdf' } } });
  ctx.r = { files: [{ name: 'a.pdf', pages: '3-4' }] };
  await assert.rejects(vm.runInContext('_pkRowPdf(r)', ctx), /3쪽까지만/);
  ctx.r = { files: [{ name: '사진.jpg', pages: '2' }] };
  ctx._pkBytes = async () => ({ name: '사진.jpg', bytes: 'J' });
  await assert.rejects(vm.runInContext('_pkRowPdf(r)', ctx), /1쪽까지만/, '그림은 한 쪽뿐');
});

test('② 10MB 를 넘으면 무거운 PDF 부터 줄이고, 한도 밑이면 멈춘다', async () => {
  assert.deepEqual(P.shrinkOrder([{ ext: 'pdf', size: 3e6 }, { ext: 'pdf', size: 2e6 }]), [], '한도 안이면 손대지 않는다');
  assert.deepEqual(P.shrinkOrder([{ ext: 'pdf', size: 4e6 }, { ext: 'zip', size: 9e6 }, { ext: 'pdf', size: 6e6 }]), [2, 0],
    '무거운 PDF 먼저 · PDF 가 아닌 것은 못 줄인다');
  const MB = 1048576, 줄인것 = [];
  const ctx = { console, KcareerPack: P,
    _pkShrinkPdf: async (b) => { 줄인것.push(b.length); return new Uint8Array(Math.floor(b.length / 3)); } };
  vm.createContext(ctx);
  vm.runInContext(떼기('async function _pkShrinkToLimit('), ctx);
  ctx.made = [{ ext: 'pdf', bytes: new Uint8Array(4 * MB) }, { ext: 'pdf', bytes: new Uint8Array(7 * MB) }, { ext: 'pdf', bytes: new Uint8Array(1 * MB) }];
  const r = await vm.runInContext('_pkShrinkToLimit(made)', ctx);
  assert.deepEqual(줄인것, [7 * MB], '가장 무거운 하나만 줄이면 한도 밑이다 — 가벼운 서류는 손대지 않는다');
  assert.equal(r.n, 1);
  assert.ok(r.after <= P.MAIL_LIMIT && r.before > P.MAIL_LIMIT);
  /* 줄인 것이 더 크면 원래 것을 둔다 */
  ctx._pkShrinkPdf = async (b) => new Uint8Array(b.length + 10);
  ctx.made = [{ ext: 'pdf', bytes: new Uint8Array(11 * MB) }];
  const r2 = await vm.runInContext('_pkShrinkToLimit(made)', ctx);
  assert.equal(r2.n, 0); assert.equal(vm.runInContext('made[0].bytes.length', ctx), 11 * MB);
});

test('배선 — 만들기는 합본·zip «전에» 줄이고, 줄일 땐 그림 쪽만 그린다', () => {
  const build = 떼기('async function packBuild(').replace(/\/\*[\s\S]*?\*\//g, '');
  const a = build.indexOf('_pkShrinkToLimit(made)'), b = build.indexOf('pkWhole'), c = build.indexOf('new JSZip');
  assert.ok(a > 0 && a < b && a < c, '★ 줄이기 전에 합본·zip 을 만들면 무거운 그대로 나갑니다');
  const sh = 떼기('async function _pkShrinkPdf(');
  assert.match(sh, /_pkImagePages\(/, '글자만 있는 쪽까지 그림으로 바꾸면 글자를 고를 수 없게 됩니다');
  assert.match(떼기('function _pkImagePages('), /'\/Image'/);
  assert.match(떼기('function packDraw('), /packSetPages\(/, '파일 딱지에 「쪽」이 있어야 합니다');
  assert.match(SRC, /kcareer-pack\.js\?v=\d+/);
});
