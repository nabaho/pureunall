'use strict';
/* 문서뷰어 «최근 연 파일»(js/pu-viewer-recent.js) — 파일 내용은 절대 안 담는다 (대표 결정 2026-10-25 「최근 파일은 이름만」)
 *
 * ■ 지키는 것
 *   ① 담는 칸은 이름·크기·형식·때·열쇠뿐이다 — 내용(바이트·글)을 넘겨도 걸러진다
 *   ② 같은 파일을 다시 열면 맨 위로 올리고 중복으로 쌓지 않는다
 *   ③ 개수 한도가 있다(값은 상수를 따라간다)
 *   ④ 고른 줄만 «목록에서» 뺀다
 *   ⑤ 저장소가 막혀 있어도(사생활 보호 창 등) 죽지 않는다
 * node --test tests/pu-viewer-recent.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const R = require(path.join(__dirname, '..', 'js', 'pu-viewer-recent.js'));
const 허용칸 = ['id', 'name', 'size', 'kind', 'at'];

test('① 내용 칸을 넘겨도 담기지 않는다 — 허용된 칸만 남는다', () => {
  const list = R.add([], { name: '급여대장.xlsx', size: 123, kind: 'xlsx', buf: new Uint8Array([1, 2, 3]), content: '주민번호 000000-0000000', data: 'x' }, 1000);
  assert.equal(list.length, 1);
  Object.keys(list[0]).forEach((k) => assert.ok(허용칸.includes(k), '허용되지 않은 칸이 담겼습니다: ' + k));
  assert.ok(!JSON.stringify(list).includes('주민번호'), '내용이 목록에 들어갔습니다');
});

test('① 저장된 옛 값에 내용 칸이 섞여 있어도 읽을 때 걸러진다', () => {
  const dirty = [{ id: 'a', name: 'x.pdf', size: 1, kind: 'pdf', at: 5, buf: 'AAAA', text: '비밀' }];
  const clean = R.sanitize(dirty);
  Object.keys(clean[0]).forEach((k) => assert.ok(허용칸.includes(k), k));
});

test('② 같은 이름·크기를 다시 열면 맨 위로 — 중복으로 쌓지 않는다', () => {
  let l = R.add([], { name: 'a.pdf', size: 10, kind: 'pdf' }, 1);
  l = R.add(l, { name: 'b.pdf', size: 20, kind: 'pdf' }, 2);
  l = R.add(l, { name: 'a.pdf', size: 10, kind: 'pdf' }, 3);
  assert.equal(l.length, 2);
  assert.equal(l[0].name, 'a.pdf');
  assert.equal(l[1].name, 'b.pdf');
});

test('② 이름이 같아도 크기가 다르면 다른 파일이다', () => {
  let l = R.add([], { name: 'a.pdf', size: 10, kind: 'pdf' }, 1);
  l = R.add(l, { name: 'a.pdf', size: 11, kind: 'pdf' }, 2);
  assert.equal(l.length, 2);
});

test('③ 개수 한도를 넘으면 오래된 것부터 밀려난다', () => {
  assert.ok(R.MAX_ITEMS >= 5);
  let l = [];
  for (let i = 0; i < R.MAX_ITEMS + 7; i++) l = R.add(l, { name: 'f' + i + '.pdf', size: i + 1, kind: 'pdf' }, i + 1);
  assert.equal(l.length, R.MAX_ITEMS);
  assert.equal(l[0].name, 'f' + (R.MAX_ITEMS + 6) + '.pdf', '가장 새것이 맨 위');
});

test('④ 고른 줄(id)만 목록에서 뺀다', () => {
  let l = R.add([], { name: 'a.pdf', size: 1, kind: 'pdf' }, 1);
  l = R.add(l, { name: 'b.pdf', size: 2, kind: 'pdf' }, 2);
  l = R.add(l, { name: 'c.pdf', size: 3, kind: 'pdf' }, 3);
  const left = R.removeIds(l, [l[1].id]);
  assert.deepEqual(left.map((r) => r.name), ['c.pdf', 'a.pdf']);
  assert.equal(R.removeIds(l, []).length, 3, '아무것도 안 고르면 그대로');
});

test('이름이 없거나 이상한 줄은 버린다 · 이름이 아주 길면 자른다', () => {
  assert.deepEqual(R.sanitize([null, 5, {}, { name: '' }]), []);
  const long = R.add([], { name: 'ㄱ'.repeat(5000) + '.pdf', size: 1, kind: 'pdf' }, 1);
  assert.ok(long[0].name.length <= 200);
});

test('⑤ 저장소가 막혀 있어도(접근하면 던진다) 죽지 않는다', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.deepEqual(R.load(), []);
    assert.equal(R.save([{ name: 'a', size: 1 }]), false);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage;
  }
});

test('저장했다가 읽으면 같은 것이 나온다', () => {
  const mem = {};
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } } });
  try {
    const l = R.add([], { name: 'a.hwpx', size: 7, kind: 'hwpx' }, 9);
    assert.equal(R.save(l), true);
    assert.deepEqual(R.load().map((r) => r.name), ['a.hwpx']);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage;
  }
});
