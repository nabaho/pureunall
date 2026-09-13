'use strict';
/* 서고 원본 — 「못 담았다 / 못 열었다」의 «까닭»을 바르게 말한다.

   ★★ 왜 고쳤나 — 2026-09-13 에 창고 규칙이 콘솔에 올라갔다(PR #1258). 그런데 화면은
     `storage/unauthorized` 를 여전히 **「창고 규칙이 아직 올라가지 않아…」**로 적고 있었다.
     이제 그 말은 «틀린 안내»다 — 이미 올라간 규칙을 또 올리러 가게 만든다.
     이 저장소가 STATUS 에 적어 둔 그대로, **어긋난 안내는 없는 것보다 나쁘다.**

   ★ 규칙이 올라간 지금 `unauthorized` 의 진짜 까닭은 둘이다.
     ① 파일이 25MB 를 넘는다   ② 로그인 계정이 @pureun.kr 이 아니다(같은 날 조였다).
     ①은 «올리기 전에» 알 수 있으므로 미리 막고, ②는 이름을 대어 말한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'js', 'pu-rules-casebook.js'));
const HTML = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8');
const 규칙글 = fs.readFileSync(path.join(ROOT, 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8');

test('① ★★ 화면이 아는 크기 한도가 창고 규칙의 수와 «같다»', () => {
  const m = /match \/casebook\/[^\n]*\n[\s\S]{0,400}?request\.resource\.size < (\d+) \* 1024 \* 1024/.exec(규칙글);
  assert.ok(m, '창고 규칙에서 서고 칸의 크기 한도를 못 읽었습니다 — 규칙이 바뀌었습니까?');
  const 규칙MB = Number(m[1]);
  assert.equal(CB.FILE_MAX, 규칙MB * 1024 * 1024,
    'FILE_MAX 와 창고 규칙의 한도가 어긋났습니다 — 두 곳의 수가 다르면 조용히 깨집니다.');
});

test('② ★ 경계가 규칙과 «같은 쪽»이다 — 규칙이 `<` 라 딱 맞는 크기는 막힌다', () => {
  assert.equal(CB.fileTooBig(CB.FILE_MAX - 1).ok, true, '한도 바로 아래가 막혔습니다');
  assert.equal(CB.fileTooBig(CB.FILE_MAX).ok, false, '한도와 «같은» 크기는 규칙이 막습니다');
  assert.equal(CB.fileTooBig(CB.FILE_MAX + 1).ok, false);
});

test('③ 크기를 모르면 «막지 않는다» — 모른다고 미리 실패시키면 멀쩡한 것이 안 올라간다', () => {
  assert.equal(CB.fileTooBig(null).ok, true);
  assert.equal(CB.fileTooBig(undefined).ok, true);
  assert.equal(CB.fileTooBig(NaN).ok, true);
});

test('④ 너무 크면 «몇 MB인지» 말한다 — 숫자가 없으면 무엇을 줄여야 할지 모른다', () => {
  const r = CB.fileTooBig(30 * 1024 * 1024);
  assert.equal(r.ok, false);
  assert.match(r.why, /30/, '실제 크기를 안 말합니다: ' + r.why);
  assert.match(r.why, /25/, '한도를 안 말합니다: ' + r.why);
});

test('⑤ ★★★ 「규칙이 아직 올라가지 않아」를 «더는 말하지 않는다»', () => {
  const 말들 = [
    CB.origWhy('storage/unauthorized', { 일: '담기' }),
    CB.origWhy('storage/unauthorized', { 일: '열기' }),
    CB.origWhy('storage/unauthorized', { 일: '받기', size: 30 * 1024 * 1024 }),
    CB.origWhy('storage/object-not-found', { 일: '열기' }),
    CB.origWhy('storage/unknown', { 일: '담기', message: '까닭 모름' })
  ];
  말들.forEach(function (s) {
    assert.ok(!/규칙이 아직/.test(s),
      '이미 올라간 규칙을 또 올리라고 합니다: ' + s);
  });
});

test('⑥ 권한이 막히면 «계정»을 짚는다 — 지금 그것이 가장 흔한 까닭이다', () => {
  const s = CB.origWhy('storage/unauthorized', { 일: '담기' });
  assert.match(s, /pureun\.kr/, '어느 계정이라야 하는지 안 말합니다: ' + s);
});

test('⑦ 권한이 막혔는데 파일이 «한도를 넘었으면» 그쪽을 먼저 말한다', () => {
  const s = CB.origWhy('storage/unauthorized', { 일: '담기', size: 30 * 1024 * 1024 });
  assert.match(s, /25/, '크기가 까닭인데 계정을 탓합니다: ' + s);
});

test('⑧ 파일이 없으면 그렇게 말한다', () => {
  const s = CB.origWhy('storage/object-not-found', { 일: '열기' });
  assert.match(s, /없습니다/);
  assert.ok(!/pureun\.kr/.test(s), '엉뚱한 까닭을 댑니다: ' + s);
});

test('⑨ 모르는 까닭은 «삼키지 않는다» — 원문을 그대로 붙인다', () => {
  const s = CB.origWhy('storage/quota-exceeded', { 일: '담기', message: '창고가 가득 찼습니다' });
  assert.match(s, /창고가 가득 찼습니다/, '까닭을 삼켰습니다: ' + s);
});

test('⑩ ★ 올리기 «전에» 크기를 본다 — 25MB 를 다 올려 보고 실패하면 시간과 통신이 버려진다', () => {
  const i = HTML.indexOf('async function cbPutOrig');
  assert.ok(i > 0, 'cbPutOrig 를 못 찾았습니다');
  const 몸 = HTML.slice(i, HTML.indexOf('\n}', i));
  const 검사자리 = 몸.indexOf('fileTooBig');
  const 올리는자리 = 몸.indexOf('.put(');
  assert.ok(검사자리 > 0, 'cbPutOrig 가 크기를 안 봅니다');
  assert.ok(검사자리 < 올리는자리, '크기를 «올린 뒤에» 봅니다 — 올리기 전이라야 합니다');
});

test('⑪ ★★ rules.html 에 옛 문구가 한 곳도 안 남았다 — 세 자리 전부', () => {
  const 남은것 = HTML.split('\n')
    .map(function (l, i) { return { n: i + 1, l: l }; })
    .filter(function (x) { return /규칙이 아직 올라가지 않아/.test(x.l); });
  assert.deepEqual(남은것.map(function (x) { return x.n; }), [],
    '옛 문구가 남았습니다 — 담기·열기·받기 세 자리를 다 고쳐야 합니다.');
});

test('⑫ 세 자리가 모두 «한 곳»(CB.origWhy)에서 까닭을 고른다 — 흩뿌리면 또 어긋난다', () => {
  const 쓴횟수 = (HTML.match(/CB\.origWhy\(/g) || []).length;
  assert.ok(쓴횟수 >= 3, 'origWhy 를 쓰는 자리가 ' + 쓴횟수 + '곳뿐입니다 (담기·열기·받기 셋이라야 합니다)');
});
