'use strict';
/* 판독 — 무료로 «글자»를 먼저 뽑아 사진 대신 그 글자를 AI 에 넘긴다.
   실행: node --test tests/*.test.js

   대표 지시 2026-09-13: 「무료버전 먼저 사용하게 안 되나?」

   ── 왜 ─────────────────────────────────────────────────────────
   판독 요금은 «사진»이 비싸다. Vision 의 글자 뽑기는 달마다 1,000장이 무료이고
   Gemini 의 몫과 «따로» 돈다. 무료로 글자를 뽑아 그 글자를 AI 에 넘기면
   **답의 정확도는 그대로 두고** 값만 내려간다.
   (칸 채우기는 지금처럼 AI 가 한다 — 규칙으로 짜지 않는다. 규칙으로 짜면
    서류마다 생김새가 달라 «틀린 값을 자신 있게» 채운다.)

   ── 이 검사가 못 박는 것 ──────────────────────────────────────────
     ① 부르는 쪽이 «켜야만» 이 길로 간다 (기본 끔) — 표가 뜻인 서류가 엉키면 안 된다
     ② 글자가 «충분할 때만» 바꾼다 — 몇 글자만 나온 흐린 사진은 사진으로 보낸다
     ③ 무료가 실패하거나 몫이 다 되면 «그냥 사진으로 간다» — 막지 않는다
     ④ 물음(프롬프트)은 그대로 살린다 — 그것이 사라지면 AI 가 무엇을 할지 모른다
     ⑤ 지문은 «원래 보낼 것»으로 뜬다 — 아니면 같은 사진이 와도 또 읽는다
     ⑥ 경력관리가 실제로 켜 두었다 (비용이 튄 그 화면)                              */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8').replace(/\r\n/g, '\n');
const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* 실제로 돌려 본다 — 글자만 찾으면 꺼 버려도 통과한다.
   ⚠ 이 파일은 window.PuDocRead 에 붙는다(module.exports 가 아니다) —
     다른 판독 검사들이 쓰는 그 방식 그대로 vm 으로 싣는다. */
const vm = require('node:vm');
function load(){
  const sandbox = { window: {}, console: console, setTimeout: setTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8'),
    { filename: 'pu-doc-read.js' }).runInContext(sandbox);
  return sandbox.window.PuDocRead;
}

/* ══════ ① 켜야만 간다 ══════ */

test('★★ 부르는 쪽이 켜야만 무료 길로 간다 — 기본은 끔이다', async () => {
  const fn = cutFn(src, 'function slimByVision(parts, opts)');
  assert.match(fn, /if \(!\(opts && opts\.freeFirst\)\) return Promise\.resolve\(parts\)/,
    '★★ 기본으로 켜져 있습니다 — 표가 뜻인 서류(급여명세서·근로계약서)의 값이 엉킵니다');
});

test('★★ 사진이 없으면 아무 일도 안 한다', () => {
  const fn = cutFn(src, 'function slimByVision(parts, opts)');
  assert.match(fn, /if \(!imgs\.length\) return Promise\.resolve\(parts\)/,
    '★ 글자뿐인 요청에 무료 판독을 부릅니다 — 몫만 축납니다');
});

/* ══════ ② 충분할 때만 ══════ */

test('★★ 글자가 «충분할 때만» 바꾼다 — 흐린 사진은 사진으로 보낸다', () => {
  const fn = cutFn(src, 'function slimByVision(parts, opts)');
  assert.match(fn, /FREE_MIN_CHARS_PER_IMG \* imgs\.length/,
    '★★ 몇 글자만 나와도 글자로 바꿉니다 — 사진을 봤으면 읽었을 것을 못 읽습니다');
  assert.match(bare, /FREE_MIN_CHARS_PER_IMG\s*=\s*\d+/, '★ 문턱이 없습니다');
  const 문턱 = Number((bare.match(/FREE_MIN_CHARS_PER_IMG\s*=\s*(\d+)/) || [])[1]);
  assert.ok(문턱 >= 50, '★ 문턱이 ' + 문턱 + '자뿐입니다 — 너무 낮으면 흐린 사진이 글자 길로 샙니다');
});

/* ══════ ③ 넘어지면 사진으로 ══════ */

test('★★ 무료가 실패하거나 몫이 다 되면 «그냥 사진으로 간다»', () => {
  const fn = cutFn(src, 'function slimByVision(parts, opts)');
  assert.match(fn, /\.catch\(function \(\) \{ return parts; \}\)/,
    '★★ 무료 판독이 넘어지면 판독 전체가 죽습니다 — 무료는 «덤»이지 조건이 아닙니다');
});

/* ══════ ④ 물음은 살린다 ══════ */

test('★★ 물음(프롬프트)을 살려서 보낸다 — 사라지면 AI 가 무엇을 할지 모른다', async () => {
  const M = load();
  assert.ok(M && M._slimByVisionForTest, '무료 길을 꺼낼 수 없습니다');
  /* Vision 이 넉넉한 글자를 준 것처럼 꾸민다 */
  const 긴글 = 'ㄱ'.repeat(M.FREE_MIN_CHARS_PER_IMG + 50);
  M.init({
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200,
        json: function () { return Promise.resolve({ ok: true, text: 긴글 }); } });
    },
    getToken: function () { return Promise.resolve('t'); },
    readDocUrl: 'https://x/readDoc'
  });
  const parts = [{ text: '이 서류를 읽어라' },
    { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }];
  const out = await M._slimByVisionForTest(parts, { freeFirst: true });
  const texts = out.filter(function (p) { return typeof p.text === 'string'; });
  assert.ok(texts.some(function (p) { return p.text.indexOf('이 서류를 읽어라') >= 0; }),
    '★★ 물음이 사라졌습니다 — AI 가 무엇을 하라는지 모릅니다');
  assert.ok(texts.some(function (p) { return p.text.indexOf(긴글) >= 0; }),
    '★★ 뽑은 글자를 안 보냅니다');
  assert.equal(out.filter(function (p) { return p.inline_data; }).length, 0,
    '★★ 사진을 그대로 또 보냅니다 — 값이 안 내려갑니다');
});

test('★★ 글자가 모자라면 «사진 그대로» 보낸다', async () => {
  const M = load();
  M.init({
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200,
        json: function () { return Promise.resolve({ ok: true, text: '짧다' }); } });
    },
    getToken: function () { return Promise.resolve('t'); },
    readDocUrl: 'https://x/readDoc'
  });
  const parts = [{ text: '읽어라' }, { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }];
  const out = await M._slimByVisionForTest(parts, { freeFirst: true });
  assert.equal(out, parts, '★★ 몇 글자만 나왔는데 글자 길로 갔습니다 — 사진을 봤으면 읽었을 것을 못 읽습니다');
});

test('★ 안 켜면 손대지 않는다', async () => {
  const M = load();
  const parts = [{ text: '읽어라' }, { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }];
  const out = await M._slimByVisionForTest(parts, {});
  assert.equal(out, parts, '★★ 켜지도 않았는데 무료 길로 갔습니다');
});

/* ══════ ⑤ 지문은 원래 것으로 ══════ */

test('★★ 지문은 «원래 보낼 것»으로 뜬다 — 아니면 같은 사진이 와도 또 읽는다', () => {
  const fn = cutFn(src, 'function askProxy(parts, opts)');
  const 지문자리 = fn.indexOf('partsFingerprint(parts)');
  const 무료자리 = fn.indexOf('slimByVision');
  assert.ok(지문자리 > 0 && 무료자리 > 0, '★ 두 길이 다 있어야 합니다');
  assert.ok(지문자리 < 무료자리,
    '★★ 글자로 바꾼 «뒤»에 지문을 뜹니다 — 같은 사진이 와도 지문이 달라 또 읽습니다');
});

/* ══════ ⑥ 켜 둔 화면 ══════ */

test('★★ 경력관리가 실제로 켜 두었다 — 비용이 튄 그 화면이다', () => {
  const kc = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
  assert.match(kc, /freeFirst:\s*true/,
    '★★ 켠 화면이 없습니다 — 길만 만들고 아무도 안 씁니다');
  /* opts 가 판독 층까지 «끊기지 않고» 가는지 */
  assert.match(bare, /return runRawParts\(parts, opts\)/,
    '★★ readWithPrompt 가 opts 를 안 넘깁니다 — 화면이 켜도 중간에서 끊깁니다');
  assert.match(bare, /askProxy\(parts, opts\)/,
    '★★ runRawParts 가 opts 를 안 넘깁니다 — 켜는 길이 문 앞에서 끊깁니다');
});

test('판독 층을 고쳤으니 «부르는 화면 전부»의 캐시 번호가 올라가 있다', () => {
  const 화면 = fs.readdirSync(R).filter(function (n) { return /\.html$/.test(n); })
    .map(function (n) {
      const m = fs.readFileSync(path.join(R, n), 'utf8').match(/js\/pu-doc-read\.js\?v=(\d+)/);
      return m ? { n: n, v: Number(m[1]) } : null;
    }).filter(Boolean);
  assert.ok(화면.length >= 5, '★ 판독 층을 부르는 화면이 ' + 화면.length + '개뿐입니다');
  화면.forEach(function (f) {
    assert.ok(f.v >= 42,   // 검사고정-허용: 이 변경이 들어간 판
      '★★ ' + f.n + ' 의 캐시 번호가 ' + f.v + ' 입니다 — 그 화면만 옛 판독 층을 씁니다');
  });
});
