'use strict';
// 사진첩 — 구글로 보내기 전에 주민번호를 가린다 · node --test tests/photos-rrn-mask-send.test.js
//
// 대표 지시 2026-09-27 「주민번호 가리고 구글로 보내라」
//   (2026-08-17 「원본을 그대로 보낸다 — 이대로 감수한다」를 뒤집었다.
//    그 뒤에 신분증·등본·통장·자동이체·근로계약서가 사진첩에 들어왔다.)
//
// 이 검사가 지키는 것
//   ①★★ 구글로 나가는 «사진» 길이 셋 다 가림을 지난다 — 한 곳이라도 빠지면 그리로 샌다
//   ②★★ 가리지 못하면 «안 보낸다» — 던지지도 않는다(올리기 줄이 멈춘다)
//   ③★  가림 칸이 이름까지 덮지 않는다 — 그러면 자동 판독이 쓸모없어진다
//   ④★★ 번호가 연달아 나와도(등본) 하나도 안 빠뜨린다 — ③을 고치다 생기기 쉬운 구멍
//   ⑤   숫자만 읽으라고 묶지 않는다 · 급여데이터함과 같은 판 도구를 쓴다
//   ⑥   실패는 기억하지 않는다 — 두 번째에 되면 가린 사본을 보내야 옳다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const MASK_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-rrn-mask.js'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } }
  return src.slice(i, j);
}
const bare = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* 가림 부품을 진짜로 싣는다 */
function maskLib() {
  const b = { console, Math, Number, String, Array, Object, RegExp };
  b.globalThis = b;
  vm.createContext(b);
  vm.runInContext(MASK_SRC, b);
  return b.PuRrnMask;
}
const RM = maskLib();

/* 낱말을 가로로 늘어놓고, 칸이 덮는 낱말을 돌려준다 */
function covered(texts) {
  const W = texts.length * 100;
  const words = texts.map((t, i) => ({ text: t, x0: i * 100, y0: 0, x1: i * 100 + 90, y1: 40 }));
  return RM.boxesFromWords(words, W, 40).map(b => texts.filter((t, i) => {
    const cx = (i * 100 + 45) / W;
    return cx >= b.x && cx <= b.x + b.w;
  }).join(' '));
}

/* ══════════ ③④ 가림 칸 ══════════ */

test('★ 이름 뒤에 번호가 오면 «번호만» 가린다 — 이름은 구글이 읽어야 한다', () => {
  assert.deepEqual(Array.from(covered(['HONG', 'GILDONG', '900101-1234567'])), ['900101-1234567']);
});

test('조각난 번호(900101 · - · 1234567)는 조각을 모두 가린다', () => {
  assert.deepEqual(Array.from(covered(['900101', '-', '1234567'])), ['900101 - 1234567']);
});

test('조각 앞의 이름은 덜어 내고 조각은 모두 남긴다', () => {
  assert.deepEqual(Array.from(covered(['HONG', '900101-', '1234567'])), ['900101- 1234567']);
});

test('★★ 등본처럼 번호가 연달아 나와도 «둘 다» 가린다', () => {
  const got = Array.from(covered(['홍길동', '900101-1234567', '김철수', '800202-2345678']));
  assert.deepEqual(got, ['900101-1234567', '800202-2345678'],
    '번호 하나를 빠뜨렸습니다 — 앞뒤를 덜다가 앞 사람 번호를 통째로 덜어 낸 것입니다');
});

test('★★ 번호 둘이 바로 붙어 있어도 하나도 안 빠뜨린다', () => {
  const got = Array.from(covered(['900101-1234567', '800202-2345678', 'x'])).join(' ');
  assert.ok(got.indexOf('900101-1234567') >= 0, '앞 번호가 안 가려졌습니다: ' + got);
  assert.ok(got.indexOf('800202-2345678') >= 0, '뒤 번호가 안 가려졌습니다: ' + got);
});

test('하이픈 없는 13자리도 가린다', () => {
  assert.deepEqual(Array.from(covered(['900101', '1234567', '서울'])), ['900101 1234567']);
});

test('번호가 없으면 아무것도 안 가린다', () => {
  assert.deepEqual(Array.from(covered(['HONG', 'GILDONG', 'Seoul'])), []);
});

test('덜어 내는 것은 «숫자가 없는» 낱말뿐이다 — 숫자 낱말은 번호 조각일 수 있다', () => {
  const src = bare(grab(MASK_SRC, 'boxesFromWords'));
  assert.ok(/noDigit\(a\)/.test(src) && /noDigit\(b - 1\)/.test(src),
    '앞뒤를 덜 때 숫자 유무를 안 봅니다 — 번호 조각을 덜어 낼 수 있습니다');
});

/* ══════════ ① 문 셋 ══════════ */

test('★★ 구글 AI 덩이(imgChunkMakers)는 가린 뒤에 보낸다', () => {
  const src = bare(grab(H, 'imgChunkMakers'));
  const m = src.indexOf('rrnMaskAll(');
  const r = src.indexOf('PuDocRead.read(');
  assert.ok(m >= 0 && r > m, '가리기 전에 보냅니다');
});

test('★★ 구글 Vision(freeReadAsk)은 사진을 가린 뒤에 보낸다', () => {
  const src = bare(grab(H, 'freeReadAsk'));
  const m = src.indexOf('rrnMaskAll(');
  const r = src.indexOf('PuDocRead.freeRead(');
  assert.ok(m >= 0 && r > m, '가리기 전에 보냅니다');
});

test('★★ 한 장 길(readDocChunked)도 가린 뒤에 보낸다', () => {
  const src = bare(grab(H, 'readDocChunked'));
  const m = src.indexOf('rrnMaskAll(');
  const r = src.indexOf('PuDocRead.read(');
  assert.ok(m >= 0 && r > m, '가리기 전에 보냅니다');
});

test('★★ 사진을 내보내는 부름은 «모두» 가림 문 안에 있다 — 새 길이 생기면 여기서 걸린다', () => {
  const code = bare(H);
  const calls = (code.match(/PuDocRead\.(read|freeRead)\(/g) || []).length;
  const gated = ['imgChunkMakers', 'freeReadAsk', 'readDocChunked']
    .map(n => (bare(grab(H, n)).match(/PuDocRead\.(read|freeRead)\(/g) || []).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(calls, gated,
    '가림 문 밖에서 사진을 내보내는 부름이 ' + (calls - gated) + '곳 있습니다 — 그리로 원본이 나갑니다');
});

test('글자 길(readDocText)은 판독 층의 지우개가 이미 지운다', () => {
  const dr = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8');
  assert.ok(bare(grab(dr, 'readDocText')).indexOf('rrnScrub(') >= 0,
    '글자 길의 지우개가 빠졌습니다 — PDF 글자로 번호가 나갑니다');
});

/* ══════════ ② 못 가리면 안 보낸다 ══════════ */

/* 문 셋을 «진짜 코드 그대로» 돌리되, 가림과 보내기만 흉내 낸다 */
function gates(maskOk) {
  const sent = { read: 0, free: 0 };
  const b = {
    console, Promise, Object, Array, String, Math, Error,
    READ_CHUNK_IMG: 10, READ_CHUNK_TXT: 30,
    chunkOf: (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; },
    docTextOf: () => '', safeSrc: t => t, freeOcrPref: () => true,
    runReadChunks: mk => mk[0](), textChunkMakers: () => [],
    rrnMaskAll: list => maskOk ? Promise.resolve(list.map(x => 'MASKED:' + x))
      : Promise.reject(new Error('도구 고장')),
    PuDocRead: {
      read: () => { sent.read++; return Promise.resolve({ kind: 'other', fields: {} }); },
      freeRead: () => { sent.free++; return Promise.resolve(null); }
    }
  };
  b.window = b;                                 // freeReadTry 가 window.PuDocRead 를 본다
  vm.createContext(b);
  vm.runInContext(['rrnFail', 'imgChunkMakers', 'freeReadTry', 'freeReadAsk', 'readDocChunked']
    .map(n => grab(H, n)).join('\n'), b);
  b._sent = sent;
  return b;
}

test('★★ 가리지 못하면 구글 AI 로도 Vision 으로도 «한 장도» 안 나간다', async () => {
  const b = gates(false);
  const r1 = await b.imgChunkMakers(['img'])[0]();
  const r2 = await b.freeReadAsk({ imgs: ['img'], app: 'photos' });
  const r3 = await b.readDocChunked([], { full: 'img' });
  assert.equal(b._sent.read, 0, '가리지 못했는데 구글 AI 로 보냈습니다');
  assert.equal(b._sent.free, 0, '가리지 못했는데 Vision 으로 보냈습니다');
  assert.match(String(r1.error), /주민번호를 가리지 못해/);
  assert.equal(r2, null);
  assert.match(String(r3.error), /주민번호를 가리지 못해/);
});

test('★ 가리지 못해도 «던지지 않는다» — 던지면 올리기 줄이 「읽는 중」에 멈춘다', async () => {
  const b = gates(false);
  await assert.doesNotReject(() => b.imgChunkMakers(['img'])[0]());
  await assert.doesNotReject(() => b.readDocChunked([], { full: 'img' }));
});

test('가린 것은 «가린 사본»을 보낸다 — 원본을 섞어 보내지 않는다', async () => {
  const b = gates(true);
  let got = null;
  b.PuDocRead.read = img => { got = img; return Promise.resolve({ kind: 'other', fields: {} }); };
  await b.imgChunkMakers(['A'])[0]();
  assert.equal(got, 'MASKED:A');
});

test('실패의 답은 판독 층 fail() 과 «같은 모양»이다', () => {
  const b = gates(false);
  const r = b.rrnFail(new Error('x'));
  ['kind', 'fields', 'bizNoOk', 'ntsChecked', 'ntsState', 'ntsFound', 'error'].forEach(k => {
    assert.ok(k in r, '칸이 빠졌습니다: ' + k);
  });
});

/* ══════════ ⑥ 실패는 기억하지 않는다 ══════════ */

test('실패는 기억하지 않는다 — 두 번째에 되면 가린 사본을 보내야 옳다', async () => {
  let n = 0;
  const b = { Promise, Map, String, Error, RRN_MEMO_MAX: 8,
    rrnMaskOne: () => { n++; return n === 1 ? Promise.reject(new Error('처음엔 실패')) : Promise.resolve('MASKED'); } };
  vm.createContext(b);
  vm.runInContext(H.match(/const _rrnMemo = new Map\(\);/)[0].replace('const', 'var') + '\n'
    + grab(H, 'rrnMasked'), b);
  await assert.rejects(() => b.rrnMasked('X'));
  await new Promise(r => setImmediate(r));
  assert.equal(await b.rrnMasked('X'), 'MASKED', '한 번 실패한 것을 기억해 영영 실패합니다');
});

test('성공은 기억한다 — 같은 사진을 두 번 기다리지 않는다', async () => {
  let n = 0;
  const b = { Promise, Map, String, Error, RRN_MEMO_MAX: 8,
    rrnMaskOne: () => { n++; return Promise.resolve('MASKED'); } };
  vm.createContext(b);
  vm.runInContext(H.match(/const _rrnMemo = new Map\(\);/)[0].replace('const', 'var') + '\n'
    + grab(H, 'rrnMasked'), b);
  await b.rrnMasked('X'); await b.rrnMasked('X');
  assert.equal(n, 1, '같은 사진을 두 번 가렸습니다');
});

/* ══════════ ⑤ 도구 ══════════ */

test('숫자만 읽으라고 묶지 않는다 — 글자를 숫자로 우겨 넣어 엉뚱한 곳을 잡는다', () => {
  assert.equal(bare(grab(H, 'rrnMaskOne')).indexOf('whitelist'), -1);
});

test('글자인식 도구가 급여데이터함·판독 층과 «같은 판»이다', () => {
  const mine = (H.match(/const RRN_OCR_LIB = '([^']+)'/) || [])[1];
  const pd = fs.readFileSync(path.join(ROOT, 'pu-paydata.html'), 'utf8');
  const dr = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8');
  assert.ok(mine, 'RRN_OCR_LIB 가 없습니다');
  assert.ok(pd.indexOf(mine) >= 0, '급여데이터함과 판이 다릅니다 — 같은 페이지에 두 판이 실립니다');
  assert.ok(dr.indexOf(mine) >= 0, '판독 층과 판이 다릅니다');
});

test('창고 주소는 받아서 같은 출처 blob 으로 연다 — 안 그러면 칠한 사본을 못 꺼낸다', () => {
  const src = bare(grab(H, 'rrnOpen'));
  assert.ok(/fetch\(/.test(src) && /createObjectURL/.test(src), '창고 주소를 그대로 엽니다');
  assert.ok(/revokeObjectURL/.test(bare(grab(H, 'rrnMaskOne'))), 'blob 을 안 풀어 줍니다 — 사진이 메모리에 남습니다');
});
