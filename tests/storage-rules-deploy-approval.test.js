'use strict';
/* 창고 올리개의 안전장치 — 「보조 함수가 달라집니다」를 «승인된 고침» 하나만 지나가게.

   ★★ 왜 필요했나 — 안전장치가 «더하기»만 허락하고 있었다. 보조 함수를 한 글자라도
     고치면 무조건 멈추므로, `isStaff()` 를 **조이는** 일조차 할 수가 없었다.
     그러면 다음 사람이 결국 `--force` 를 만든다 — 올리개가 스스로 「만들지 말라」고
     적어 둔 그것이다. 그래서 우회로 대신 «적어 두고 지나가는» 길을 낸다.

   ★ 이것은 --force 가 아니다. 옛 몸도 새 몸도 «글자까지» 맞아야 지나간다 —
     승인한 그 고침 하나만 지나가고, 그 뒤의 어떤 흔들림도 다시 멈춘다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { 승인읽기, 함수바뀜 } = require('../scripts/storage-rules-deploy.js');

const 옛 = "return request.auth != null && request.auth.token.email != null;";
const 새 = "return request.auth != null && request.auth.token.email != null && request.auth.token.email.matches('.*@pureun[.]kr');";

const 승인글 = [
  '# 주석은 지나간다',
  '[isStaff]',
  '왜: 가입만 한 사람이 통과했다',
  '옛: ' + 옛,
  '새: ' + 새,
  ''
].join('\n');

test('① 승인 파일을 읽는다 — 이름·왜·옛·새', () => {
  const a = 승인읽기(승인글);
  assert.equal(a.isStaff.옛, 옛);
  assert.equal(a.isStaff.새, 새);
  assert.match(a.isStaff.왜, /가입/);
});

test('② 빈 글이어도 터지지 않는다 (승인 파일이 없을 수 있다)', () => {
  assert.deepEqual(승인읽기(''), {});
  assert.deepEqual(승인읽기(null), {});
});

test('③ ★ 승인이 «없으면» 멈춘다 — 이것이 본래 안전장치다', () => {
  const r = 함수바뀜({ isStaff: 옛 }, { isStaff: 새 }, {});
  assert.equal(r.멈출까.length, 1);
  assert.match(r.멈출까[0], /달라집니다/);
  assert.equal(r.지나간것.length, 0);
});

test('④ 옛·새가 «둘 다» 맞으면 지나간다 — 그리고 지나간 것을 돌려준다', () => {
  const r = 함수바뀜({ isStaff: 옛 }, { isStaff: 새 }, 승인읽기(승인글));
  assert.deepEqual(r.멈출까, []);
  assert.equal(r.지나간것.length, 1);
  assert.equal(r.지나간것[0].이름, 'isStaff');
  assert.match(r.지나간것[0].왜, /가입/);
});

test('⑤ ★★ 새 몸이 한 글자라도 흔들리면 «다시» 멈춘다 — 승인은 그 고침 하나뿐이다', () => {
  const 흔들린것 = 새.replace("'.*@pureun[.]kr'", "'.*@pureun[.]kr.*'");
  const r = 함수바뀜({ isStaff: 옛 }, { isStaff: 흔들린것 }, 승인읽기(승인글));
  assert.equal(r.멈출까.length, 1, '뒤에 «아무거나»를 붙인 것이 그냥 지나갔습니다.');
  assert.match(r.멈출까[0], /승인/);
});

test('⑥ 옛 몸이 안 맞으면 멈춘다 — 콘솔이 그 사이 딴 것으로 바뀐 것이다', () => {
  const r = 함수바뀜({ isStaff: 'return request.auth != null;' }, { isStaff: 새 }, 승인읽기(승인글));
  assert.equal(r.멈출까.length, 1);
  assert.match(r.멈출까[0], /승인/);
});

test('⑦ 함수가 «사라지면» 승인이 있어도 멈춘다', () => {
  const r = 함수바뀜({ isStaff: 옛 }, {}, 승인읽기(승인글));
  assert.equal(r.멈출까.length, 1);
  assert.match(r.멈출까[0], /사라집니다/);
});

test('⑧ 안 바뀐 함수는 아무 말도 안 한다', () => {
  const r = 함수바뀜({ isStaff: 옛, okImage: 'return true;' },
                     { isStaff: 옛, okImage: 'return true;' }, {});
  assert.deepEqual(r.멈출까, []);
  assert.deepEqual(r.지나간것, []);
});

test('⑨ ★ 승인 파일에만 있고 실제로는 «안 바뀐» 함수는 지나간 것으로 세지 않는다', () => {
  const r = 함수바뀜({ isStaff: 옛 }, { isStaff: 옛 }, 승인읽기(승인글));
  assert.deepEqual(r.멈출까, []);
  assert.equal(r.지나간것.length, 0, '안 바뀐 것을 「고쳤다」고 적으면 기록이 거짓이 됩니다.');
});
