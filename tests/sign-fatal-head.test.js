'use strict';
/* 전자위임장(sign.html) — 못 여는 링크일 때 «서로 반대되는 말»을 하지 않는다
   (2026-10-04 폰 화면 점검에서 찾음)

   ★ 무엇이 잘못됐었나
     링크가 잘못되면 아래에는 「잘못된 접속 주소입니다」가 뜨는데, 머리말은
     「사건 정보를 불러오는 중…」이 그대로 남았다. 받는 분(근로자)은 폰에서
     아직 불러오는 줄 알고 계속 기다린다. 이 화면은 우리 직원이 아니라
     «사업장 근로자»가 보는 곳이라 더 그렇다.

   ★ 보는 것: fatal() 이 아랫말과 «머리말을 함께» 고치는가. 문구는 안 박는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 글 = fs.readFileSync(path.join(ROOT, 'sign.html'), 'utf8');

/* fatal 함수만 떼어 가짜 화면에서 돌린다 */
function fatal돌리기(msg) {
  const 시작 = 글.indexOf('function fatal(');
  assert.ok(시작 > 0, 'sign.html 에 fatal() 이 없다');
  let i = 글.indexOf('{', 시작), 깊이 = 0, 끝 = i;
  for (; 끝 < 글.length; 끝++) {
    if (글[끝] === '{') 깊이++;
    else if (글[끝] === '}') { 깊이--; if (깊이 === 0) { 끝++; break; } }
  }
  const 몸 = 글.slice(시작, 끝);
  const 칸 = {
    fatalMsg: { textContent: '' },
    caseTitle: { textContent: '사건 정보를 불러오는 중…' }
  };
  const 보인단계 = [];
  const 상자 = {
    $: (id) => 칸[id] || null,
    showStep: (n) => 보인단계.push(n)
  };
  vm.createContext(상자);
  vm.runInContext(몸 + '\nfatal(' + JSON.stringify(msg) + ');', 상자);
  return { 칸, 보인단계 };
}

test('★ 못 여는 링크면 머리말도 함께 바뀐다 — 「불러오는 중…」이 남으면 근로자가 계속 기다린다', () => {
  const { 칸, 보인단계 } = fatal돌리기('잘못된 접속 주소입니다. 안내받은 링크로 다시 접속해 주세요.');
  assert.match(칸.fatalMsg.textContent, /잘못된 접속 주소/);
  assert.deepEqual(보인단계, ['err']);
  assert.ok(!/불러오는 중/.test(칸.caseTitle.textContent),
    '머리말에 「불러오는 중…」이 그대로 남았다 — 화면이 서로 반대되는 말을 한다');
  assert.ok(칸.caseTitle.textContent.trim().length > 0, '머리말이 빈 칸이 되면 그것대로 어색하다');
});

test('머리말 칸이 없어도 터지지 않는다 — 화면 모양이 바뀌어도 안내는 떠야 한다', () => {
  const 시작 = 글.indexOf('function fatal(');
  const 몸 = 글.slice(시작, 글.indexOf('\n}', 시작) + 2);
  const 칸 = { fatalMsg: { textContent: '' } };
  const 상자 = { $: (id) => 칸[id] || null, showStep: () => {} };
  vm.createContext(상자);
  assert.doesNotThrow(() => vm.runInContext(몸 + '\nfatal("x");', 상자));
});
