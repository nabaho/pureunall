/* 푸른 캘린더가 이알피와 «같은 뜻으로» 읽는다
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이 검사가 있는가
     푸른 캘린더(pu-cal.html)는 제 자료를 갖지 않고 이알피가 쓰는 칸을 그대로 읽는다.
     그 칸의 생김새가 셋(배열 · 번호-지도 · 이름-열쇠 지도)이라, 펴는 셈이 조금만
     달라도 **번호가 사라진다** — 2026-09-16 에 실제로 겪은 자리다.
     번호를 잃은 항목은 한 건이 표를 통째 저장에 가두고, 두 기기가 서로를 덮는다.

   ★ 어떻게 지키는가 — 이알피의 해석기를 «소스에서 떼어 와» 나란히 돌린다.
     그래서 이알피 쪽만 고쳐도 여기서 걸린다. 규칙을 적어 두는 것이 아니라
     둘을 실제로 맞대 본다.

   ⚠ 걸리면 지울 것이 아니라 고칠 것이다 — 이알피를 고쳤으면 js/pu-cal-read.js 도
     같이 고친다. 어느 쪽이 옳은지는 이알피가 기준이다(그쪽이 쓰는 쪽이다). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PuCalRead = require(path.join(ROOT, 'js', 'pu-cal-read.js'));
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 이름 붙은 함수 하나의 몸만 떼어 온다 (중괄호를 센다 — 글자 수로 자르지 않는다) */
function cutFn(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '이알피에서 못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* 이알피의 해석기를 상자에서 돌린다.
   ⚠ 상자 «안에서 만들어진» 배열은 겉이 같아도 deepStrictEqual 이 튕긴다 —
     그래서 견줄 때는 JSON 글자로 맞댄다. */
const box = { JSON, Object, Array, String };
vm.createContext(box);
vm.runInContext(cutFn(SRC, 'function _fbStableId(x){'), box);
vm.runInContext(cutFn(SRC, 'function normalizeFbValue(v){'), box);
vm.runInContext('function __erp(v){ return normalizeFbValue(v); }', box);

const 이알피 = (v) => JSON.stringify(box.__erp(v));
const 캘린더 = (v) => JSON.stringify(PuCalRead.normalize(v));

/* 실제로 서버에 있는 꼴들. 이름은 늘 홍길동·가나상사로 쓴다. */
const 자료들 = {
  '옛 배열': [{ id: 'a1', sid: 'S001', date: '2026-09-15', type: 'leave' }],
  '번호-지도': { a1: { id: 'a1', date: '2026-09-15', type: 'leave' }, a2: { id: 'a2', date: '2026-09-16', type: 'trip' } },
  '칸만 든 자국(본문에 번호 없음)': { a1: { date: '2026-09-15', type: 'leave' } },
  '번호 섞임': [{ id: 'a1', type: 'leave' }, { type: 'trip', date: '2026-09-17' }],
  '이름-열쇠 지도(사번키)': { S001: { rate: 0.3 }, S002: { rate: 0.25 } },
  '연도-열쇠 지도': { 2025: { total: 15 }, 2026: { total: 16 } },
  '자리번호 열쇠': { 0: { id: 'a1' }, 1: { id: 'a2' } },
  '같은 번호 두 번': [{ id: 'a1', v: 1 }, { id: 'a1', v: 2 }],
  '빈 객체': {},
  '빈 배열': [],
  '널': null,
  '숫자': 7,
  '글자': '가나상사',
  '가운데 빈 칸': [{ id: 'a1' }, null, { id: 'a2' }],
  '번호가 열쇠와 다름': { a1: { id: 'zzz', date: '2026-09-15' } },
  'code 가 열쇠': { cons: { code: 'cons', label: '컨설팅' } }
};

Object.keys(자료들).forEach((이름) => {
  test('같은 뜻으로 읽는다 — ' + 이름, () => {
    assert.strictEqual(
      캘린더(자료들[이름]), 이알피(자료들[이름]),
      '푸른 캘린더와 이알피가 이 자료를 다르게 폅니다 — js/pu-cal-read.js 를 이알피에 맞추세요'
    );
  });
});

test('지어 붙이는 번호도 이알피와 같다 — 다르면 같은 항목이 두 앱에서 다른 번호가 된다', () => {
  const 것 = { sid: 'S001', date: '2026-09-15', type: 'leave' };
  assert.strictEqual(PuCalRead.stableId(것), box._fbStableId(것));
});

test('못 읽은 칸을 «빈 것»으로 주지 않는다 — 빈 배열은 「없다」는 거짓말이다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-read.js'), 'utf8');
  const 몸 = cutFn(src, 'function readMany(keys)');
  assert.ok(/failed/.test(몸), '못 읽은 칸을 따로 알려 주지 않습니다');
  assert.ok(!/out\[k\]\s*=\s*\[\]/.test(몸), '못 읽은 칸에 빈 배열을 넣고 있습니다');
});

test('큰 표를 value 로 지켜보지 않는다 — 한 건 바뀔 때 목록 전체가 내려온다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-read.js'), 'utf8');
  const 몸 = cutFn(src, 'function watch(key, onChange)');
  assert.ok(!/\.on\(\s*['"]value['"]/.test(몸), "watch 가 'value' 로 지켜보고 있습니다 — child_ 로 바꾸세요");
  assert.ok(/child_added/.test(몸) && /child_changed/.test(몸) && /child_removed/.test(몸),
    '바뀐 한 건만 받는 길(child_added/changed/removed)이 없습니다');
});
