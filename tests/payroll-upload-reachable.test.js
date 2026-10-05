'use strict';
/* 급여 자료를 «올릴 수 있는 길»이 화면에 있나 (2026-10-06)
 *
 * ■ 무슨 일이 있었나
 *   3칸 화면(2026-10-05)으로 바꾸면서 옛 왼쪽 메뉴를 「도구」로 줄였는데, 「데이터 다시 올리기」
 *   단추는 «급여 처리 전체 화면»에만 있었고 그 화면은 도구에 없었다. 그래서 새 급여 자료
 *   (payroll_all.json)를 올릴 단추를 아무 데서도 찾을 수 없었다 — 대표가 「어떻게 해야되는지
 *   모르겠다」고 해서 드러났다. 화면을 다 그려 봐도 오류는 안 나서 검사로는 안 잡혔던 자리다.
 *
 * ■ 못 박는 것
 *   ① 「도구」에 설정 카드가 있다 ② 설정 카드 화면을 «실제로 그리면» 급여 올리기·설정 카드 올리기
 *   단추가 둘 다 나온다.
 * 실행: node --test tests/payroll-upload-reachable.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');
function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
function cutVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=[\\s\\S]*?;\\r?\\n'));
  assert.ok(m, name + ' 가 없습니다');
  return m[0];
}

test('★ 「도구」에서 설정 카드로 갈 수 있다', () => {
  const sb = {}; vm.createContext(sb);
  new vm.Script(cutVar('TOOLS') + 'globalThis.T = TOOLS;').runInContext(sb);
  assert.ok(Array.from(sb.T).some(t => t.id === 'cards'), '도구에 설정 카드가 없습니다');
});

test('★★ 설정 카드 화면을 그리면 급여 올리기·설정 카드 올리기 단추가 둘 다 있다', () => {
  const sb = { console, JSON, Object, String, Array };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  new vm.Script([
    'function dbGet(k, fb){ return fb; }',
    'function esc(s){ return String(s == null ? "" : s); }',
    'function cardsView(){ return []; } function cardField(){ return ""; }',
    'function taxWatchBanner(){ return ""; } function builtinTaxSince(){ return ""; }',
    'var PuSimpleTax = { tables: [] };',
    cut('screenCards'),
    'globalThis.H = screenCards();',
  ].join('\n')).runInContext(sb);
  assert.ok(sb.H.indexOf('onclick="importPayroll()"') >= 0, '★ 급여 자료(payroll_all.json)를 올릴 단추가 없습니다');
  assert.ok(sb.H.indexOf('onclick="importCards()"') >= 0, '설정 카드를 올릴 단추가 없습니다');
});
