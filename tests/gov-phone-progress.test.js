/* 정부컨설팅 폰 «회차 진행 보기» (대표 결정 2026-10-08)
   「폰에서는 직접 작업하지 않고 진행상황 확인만 한다 — 몇 차례 진행중이었는지 확인한다」
   ★ 규칙
     · 「13/15」의 13 은 «오늘까지 한» 회차다 — 앞으로 잡아 둔 일정은 따로 센다.
       (왼쪽 목록의 「다음 14회차」는 둘을 섞어 «몇 번 했나»를 알 수 없었다)
     · 남은 회차가 있는데 잡아 둔 일정이 하나도 없으면 「잡힌 일 없음」.
     · 폰에서 열면 진행 목록이 먼저, 기본은 «내 담당».
     · 보기 전용 — 이 화면 길에서 저장하지 않는다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { stripComments } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const S = stripComments(SRC);

function cut(name) {
  const a = S.indexOf('function ' + name + '(');
  assert.ok(a >= 0, name + ' 이 없다');
  let i = S.indexOf('{', a), d = 0;
  for (; i < S.length; i++) { if (S[i] === '{') d++; else if (S[i] === '}' && --d === 0) break; }
  return S.slice(a, i + 1);
}
const box = {};
vm.createContext(box);
vm.runInContext(cut('progCalc') + ';this.progCalc=progCalc;', box);
const calc = (...a) => JSON.parse(JSON.stringify(box.progCalc(...a)));

const T = '2026-10-08';
const s = (date, isField, round) => ({ date, isField, round });

test('한 것은 오늘까지, 잡아 둔 것은 내일부터 — 둘을 섞지 않는다', () => {
  const P = calc([s('2026-09-01', true, 1), s('2026-10-08', false, 2), s('2026-10-15', true, 3)], T, 15, false);
  assert.strictEqual(P.done, 2);
  assert.strictEqual(P.plan, 1);
  assert.strictEqual(P.field, 1);
  assert.strictEqual(P.office, 1);
  assert.strictEqual(P.last.date, '2026-10-08');
  assert.strictEqual(P.next.date, '2026-10-15');
  assert.strictEqual(P.full, false);
});

test('남은 회차가 있는데 잡아 둔 일정이 없으면 「잡힌 일 없음」', () => {
  assert.strictEqual(calc([s('2026-09-01', true, 1)], T, 15, false).noNext, true);
  assert.strictEqual(calc([s('2026-09-01', true, 1), s('2026-11-01', true, 2)], T, 15, false).noNext, false);
  // 종료된 컨설팅·전체 회차를 모르는 것은 경고하지 않는다
  assert.strictEqual(calc([s('2026-09-01', true, 1)], T, 15, true).noNext, false);
  assert.strictEqual(calc([s('2026-09-01', true, 1)], T, 0, false).noNext, false);
});

test('다 했으면 완료 — 날짜가 섞여 들어와도 마지막·다음을 바르게 고른다', () => {
  const P = calc([s('2026-09-03', true, 3), s('2026-09-01', true, 1), s('2026-09-02', false, 2)], T, 3, false);
  assert.strictEqual(P.full, true);
  assert.strictEqual(P.last.round, 3);
  assert.strictEqual(P.next, null);
});

test('폰에서 열면 진행 목록이 먼저, 기본은 «내 담당»', () => {
  assert.match(S, /if\(window\.innerWidth<=768\)showTab\('prog'\)/);
  assert.match(S, /let _mpMine=true/);
  assert.match(SRC, /id="tabProg"[^>]*>|class="[^"]*m-only[^"]*" id="tabProg"/);
});

test('진행 보기는 저장하지 않는다', () => {
  for (const fn of ['renderProg', 'bindProg', 'progCalc']) {
    const body = cut(fn);
    assert.ok(!/\b(setScheds|setCos|setEnv|lsSet|localStorage|fbPush\w*|_fbDB|\.ref\()/.test(body), fn + ' 안에서 저장한다');
  }
});
