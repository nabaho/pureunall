/* 푸른 캘린더 — 「직원별 업무」·「분석」 탭은 여기 없다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「직원별업무와 분석은 필요없다 여기 넣지 마라」

   ★ 무엇이 있었나
     법인대시보드를 캘린더로 옮기며(2026-09-18) 「직원별 업무」·「분석」 두 탭은
     아직 이알피에 있다는 안내 탭(laterHtml)으로 자리만 잡아 뒀다. 이제 아예
     필요 없다는 지시라 탭 자체를 없앴다 — 이알피 옆 메뉴에는 그대로 있다.

   ⚠ 되돌리지 말 것 — 「대시보드 화면도 다음 걸음에 옮기자」는 생각이 들어도
     이 지시가 있었다는 것부터 확인할 것. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

test('① TABS 에 「직원별 업무」·「분석」이 없다', () => {
  const m = 캘린더.match(/var TABS = \[[\s\S]*?\n\];/);
  assert.ok(m, 'TABS 배열을 못 찾았습니다');
  assert.strictEqual(/직원별 업무|분석/.test(m[0]), false,
    'TABS 에 「직원별 업무」/「분석」이 남아 있습니다: ' + m[0]);
  assert.strictEqual(/workload|analytics/.test(m[0]), false,
    'TABS 에 workload/analytics 열쇠가 남아 있습니다: ' + m[0]);
});

test('② 「다음 걸음에 옮긴다」는 안내(laterHtml)를 부르는 자리가 없다', () => {
  /* ⚠ 함수 자체가 죽었는데 부르는 자리만 지우면 이름 없는 죽은 함수가 남는다 —
     둘 다 없어야 한다. */
  assert.strictEqual(캘린더.indexOf('function laterHtml(') >= 0, false,
    'laterHtml 함수가 아직 정의돼 있습니다(부르는 곳이 없으면 죽은 코드입니다)');
  assert.strictEqual(캘린더.indexOf('laterHtml(tab)') >= 0, false,
    'laterHtml 을 부르는 자리가 남아 있습니다');
});

test('③ 남은 탭 넷은 모두 «준비된» 탭이다 — render() 의 else 갈래가 죽지 않는다', () => {
  const m = 캘린더.match(/var TABS = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'TABS 배열을 못 찾았습니다');
  const 줄들 = m[1].split('\n').filter((l) => l.indexOf('{ v:') >= 0);
  assert.strictEqual(줄들.length, 4, '탭이 넷이 아닙니다: ' + 줄들.length);
  줄들.forEach((l) => {
    assert.match(l, /ready:true/, '준비 안 된(아직 이알피용) 탭이 남아 있습니다: ' + l.trim());
  });
});
