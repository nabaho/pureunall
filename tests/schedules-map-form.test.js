/* 일정(my_schedules)은 «지도형»으로 담긴다 — 그래야 푸른 캘린더가 고칠 수 있다
   ═══════════════════════════════════════════════════════════════════════════
   캘린더를 한 곳(푸른 캘린더)으로 모으는 0걸음. 대표 지시 2026-09-20 「0부터 순서대로」.

   ★ 무엇이 문제였나
     열아홉 표는 진작 «지도형»(번호가 열쇠)으로 옮겼는데 일정만 «배열»로 남아 있었다.
     푸른 캘린더의 저장 관문(js/pu-cal-write.js ④)은 배열 표에 칸별로 쓰면 표가 깨지므로
     쓰지 않고 「푸른이알피에서 고쳐 주세요」로 돌려보낸다. 그래서 일정만은 푸른 캘린더에서
     고칠 수가 없었다 — 이알피 달력을 걷어내면 «아무 데서도» 못 고치게 된다.

   ★ 지키려는 것 (값이 아니라 규칙)
     ① 일정 표가 «건별 저장 목록(DIFF_KEYS)»에 들어 있다
        → dbSet 이 저장할 때 지도형으로 올린다(arrayToIdMap)
     ② 지도형으로 바꿔도 «읽는 쪽»이 그대로 읽는다 — 이알피와 푸른 캘린더 둘 다
     ③ 저장 관문이 지도형일 때 «통과»하고 배열일 때 «막는다»
   ⚠ 이 검사는 25·열아홉 같은 «지금 숫자»를 안 본다. 건수는 늘고 줄기 마련이다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* 실제 자료와 «같은 꼴»의 본보기 — 이름은 늘 홍길동·가나상사 */
const 본보기 = [
  { id: 'sch-aaa111', date: '2026-09-21', sid: 'P-001', title: '가나상사 면담', type: 'meet' },
  { id: 'sch-bbb222', date: '2026-09-22', sid: 'P-003', title: '다라산업 방문', note: '오전' },
  { id: 'sch-ccc333', date: '2026-10-01', sid: 'P-001', title: '홍길동 상담' }
];

test('① 일정 표가 건별 저장 목록에 들어 있다 — 없으면 서버에 배열로 남는다', () => {
  const m = ERP.match(/var DIFF_KEYS = \[([^\]]*)\]/);
  assert.ok(m, 'DIFF_KEYS 를 못 찾았습니다');
  assert.ok(/'my_schedules'/.test(m[1]),
    '일정(my_schedules)이 건별 저장 목록에 없습니다 — 그러면 dbSet 이 배열로 올리고,'
    + ' 푸른 캘린더는 「이알피에서 고치세요」로 돌려보냅니다.');
});

test('② 저장할 때 «모두 번호가 있으면» 지도형으로 바꿔 올린다', () => {
  /* 값이 아니라 «길»을 본다 — DIFF_KEYS 에 든 표 + 전부 번호 있음 → arrayToIdMap.
     ⚠ 긴 정규식으로 한 줄을 통째 맞추지 않는다(안쪽 괄호에 걸려 헛돈다).
       그 줄을 «찾아» 세 가지가 함께 있는지만 본다. */
  const 줄 = ERP.split('\n').filter((l) => /var fbValue\s*=/.test(l) && /arrayToIdMap/.test(l));
  assert.strictEqual(줄.length, 1, '지도형으로 바꿔 올리는 줄을 못 찾았습니다(또는 여러 곳입니다): ' + 줄.length);
  const s = 줄[0];
  assert.ok(/DIFF_KEYS\.indexOf\(k\)\s*>=\s*0/.test(s), '건별 저장 목록을 안 봅니다: ' + s.trim());
  assert.ok(/Array\.isArray\(v\)/.test(s), '배열일 때만 바꾸는 조건이 없습니다: ' + s.trim());
  assert.ok(/\.every\(/.test(s), '«모두 번호가 있는지»를 안 봅니다 — 번호 없는 건이 섞이면 표가 깨집니다: ' + s.trim());
});

test('③ 지도형으로 바꿔도 이알피가 그대로 읽는다', () => {
  const 상자 = { console, Object, Array, JSON, String };
  vm.createContext(상자);
  vm.runInContext(함수몸(ERP, 'function arrayToIdMap(arr){'), 상자);
  vm.runInContext(함수몸(ERP, 'function _fbStableId(x){'), 상자);
  vm.runInContext(함수몸(ERP, 'function normalizeFbValue(v){'), 상자);
  상자.__arr = 본보기;
  vm.runInContext('var __map = arrayToIdMap(__arr); var __back = normalizeFbValue(__map);', 상자);
  assert.strictEqual(Object.keys(상자.__map).length, 본보기.length, '지도로 바꿀 때 건수가 달라졌습니다');
  assert.ok(Array.isArray(상자.__back), '되읽었더니 배열이 아닙니다');
  assert.strictEqual(상자.__back.length, 본보기.length, '되읽었더니 건수가 달라졌습니다');
  const 정렬 = (a) => [...a].sort((x, y) => x.id < y.id ? -1 : 1);
  assert.deepStrictEqual(정렬(상자.__back), 정렬(본보기), '되읽은 내용이 달라졌습니다');
});

test('④ 지도형으로 바꿔도 푸른 캘린더가 그대로 읽는다', () => {
  const PuCalRead = require(path.join(ROOT, 'js', 'pu-cal-read.js'));
  const map = {}; 본보기.forEach((x) => { map[x.id] = x; });
  const back = PuCalRead.normalize(map);
  assert.ok(Array.isArray(back), '푸른 캘린더가 지도형을 배열로 못 폅니다 — 달력이 빕니다');
  const 정렬 = (a) => [...a].sort((x, y) => x.id < y.id ? -1 : 1);
  assert.deepStrictEqual(정렬(back), 정렬(본보기), '되읽은 내용이 달라졌습니다');
});

test('⑤ 저장 관문 — 지도형이면 통과, 배열이면 막는다', () => {
  global.PuWork = require(path.join(ROOT, 'js', 'pu-work-core.js'));
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  const map = {}; 본보기.forEach((x) => { map[x.id] = x; });
  function 판정(형) {
    W.attach({ ref: () => ({ update: () => Promise.resolve() }) },
      { lockedMonths: () => [], formOf: () => 형, who: () => '검사' });
    return W.check('my_schedules', 본보기[0].id, { title: '바뀐 제목' }, 본보기[0].date);
  }
  const 배열판정 = 판정(본보기);
  assert.strictEqual(배열판정.ok, false, '배열인데도 쓰겠다고 합니다 — 표가 깨집니다');
  assert.strictEqual(배열판정.code, 'array_form', '막는 까닭이 «배열이라서»가 아닙니다: ' + 배열판정.code);
  assert.strictEqual(판정(map).ok, true,
    '지도형인데도 막습니다 — 옮긴 보람이 없습니다: ' + JSON.stringify(판정(map)));
});
