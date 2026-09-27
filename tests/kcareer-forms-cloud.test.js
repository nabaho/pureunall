'use strict';
/* ☁ 기관 양식 원본을 창고에 둔다 — 다른 PC 에서도 열리게 (대표 지시 2026-09-21 「그것도 해라」)
   ─────────────────────────────────────────────────────────────
   ■ 무엇이 문제였나
     양식 보관함은 «목록»만 서버로 가고 «파일»은 그 PC 의 브라우저(IndexedDB)에만 있었다.
     그래서 다른 PC 로 로그인하면 양식 딱지는 보이는데 「원본을 찾을 수 없습니다」가 떴다.

   ■ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다
     ①★ 담는 길은 «한 곳»이다 — 세 길(＋올리기·되돌리기·서식 올리며 보관)이 모두 그리로.
        하나라도 빠지면 «그 길로 담은 양식만» 다른 PC 에서 안 열린다.
     ②★ 레코드에는 «자리(경로)»만 적는다 — 내려받기 «주소»는 시한이 있어 죽는다.
     ③★ 창고 자리는 사람마다 따로다 — 고친 양식에는 값이 적혀 있을 수 있다.
     ④★ 올리기가 실패해도 담기는 «성공»이다 — 이 PC 에서는 그대로 쓰여야 한다.
     ⑤★ 이 PC 에 없으면 «창고에서 데려온다» — 이것이 없으면 고친 것이 헛일이다.
     ⑥★ 창고 규칙이 그 자리를 덮는다 — 안 덮이면 올리기가 통째로 막힌다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(RAW);
const 규칙 = fs.readFileSync(path.join(R, 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8');

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}

test('①★ 양식을 담는 길이 «한 곳»이다 — 세 길이 모두 그리로 온다', () => {
  assert.match(CODE, /async function cvFormPut\(/, '담는 한 곳이 없습니다');
  const 한곳 = cutFn(CODE, 'async function cvFormPut(');
  assert.match(한곳, /saveFileUnified\(/, '이 PC 에 안 담습니다');
  assert.match(한곳, /kcFormUpload\(/, '창고에 안 올립니다');
  assert.match(한곳, /set\(\s*'cvforms'/, '목록에 안 넣습니다');

  /* 세 길이 모두 cvFormPut 을 부르는가 — 하나라도 제 손으로 담으면 어긋난다 */
  [['async function cvAddForm(', '＋ 양식 올리기'],
   ['async function hwpViewSaveToLib(', '고친 것 되돌리기'],
   ['async function importTemplateFile(', '서식 올리며 보관']].forEach(([decl, 뭐]) => {
    const fn = cutFn(CODE, decl);
    assert.match(fn, /cvFormPut\(/, '★ 「' + 뭐 + '」가 담는 한 곳을 안 씁니다.\n'
      + '  이 길로 담은 양식만 다른 PC 에서 안 열립니다 — 몇 달 뒤에야 드러납니다.');
    assert.ok(!/set\(\s*'cvforms'/.test(fn),
      '★ 「' + 뭐 + '」가 목록을 제 손으로 고칩니다 — cvFormPut 한 곳으로 모으세요');
  });
});

test('②★ 레코드에 «주소»가 아니라 «자리»를 적는다', () => {
  /* 내려받기 주소(getDownloadURL)는 시한이 있다. 적어 두면 얼마 뒤 죽어서
     「어제는 됐는데 오늘은 안 된다」가 된다. 열 때마다 자리로 주소를 새로 얻는다. */
  const 한곳 = cutFn(CODE, 'async function cvFormPut(');
  assert.match(한곳, /stPath\s*=/, '자리를 안 적습니다');
  assert.ok(!/getDownloadURL/.test(한곳), '★ 담을 때 주소를 얻고 있습니다 — 그 주소는 시한이 있습니다');

  const 올리기 = cutFn(CODE, 'async function kcFormUpload(');
  assert.ok(!/getDownloadURL/.test(올리기), '★ 올리개가 주소를 돌려줍니다 — 자리를 돌려주세요');
  const 데려오기 = cutFn(CODE, 'async function kcFormFromCloud(');
  assert.match(데려오기, /getDownloadURL\(\)/, '열 때 주소를 얻지 않습니다');
});

test('③★ 창고 자리가 «사람마다 따로»다 — 글자가 아니라 «돌려서» 본다', () => {
  /* ⚠ 처음엔 「fbUid 라는 글자가 있나」로 봤는데 «이빨이 없었다» —
     자리를 만드는 줄에서 사람 번호를 빼도, 바로 위 「번호가 없으면 물러난다」 줄에
     그 이름이 남아 있어 그대로 통과했다(2026-09-21 고장넣기로 잡음).
     그래서 실제로 돌려서 «나온 자리»를 본다. */
  const vm = require('node:vm');
  const ctx = { fbUid: 'UID9zq' };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function kcFormPath('), ctx);

  const 자리 = vm.runInContext("kcFormPath('CVFORM1')", ctx);
  assert.ok(자리.indexOf('UID9zq') >= 0,
    '★ 나온 자리에 사람 번호가 없습니다(' + 자리 + ') — 온 식구 양식이 한 자리에 섞입니다');
  assert.ok(자리.indexOf('kcareer_forms/') === 0,
    '자리 이름이 바뀌었습니다(' + 자리 + ') — 창고 규칙이 덮는 곳과 어긋납니다');
  assert.ok(자리.indexOf('CVFORM1') >= 0, '양식 번호가 자리에 안 들어갑니다 — 서로 덮어씁니다');

  /* 두 사람의 자리가 «달라야» 한다 */
  const ctx2 = { fbUid: 'UID-다른사람' };
  vm.createContext(ctx2);
  vm.runInContext(cutFn(CODE, 'function kcFormPath('), ctx2);
  assert.notEqual(vm.runInContext("kcFormPath('CVFORM1')", ctx2), 자리,
    '★ 사람이 달라도 자리가 같습니다 — 남의 양식을 덮어씁니다');

  /* 로그인 전에는 빈 자리 — 안 그러면 「undefined」라는 자리에 쌓인다 */
  const ctx3 = { fbUid: null };
  vm.createContext(ctx3);
  vm.runInContext(cutFn(CODE, 'function kcFormPath('), ctx3);
  assert.equal(vm.runInContext("kcFormPath('CVFORM1')", ctx3), '',
    '★ 로그인 전에도 자리를 만듭니다 — 주인 없는 자리에 쌓입니다');
});

test('④★ 창고에 못 올려도 «담기는 성공»한다', () => {
  /* 인터넷이 끊겼거나 규칙이 아직 안 올라갔을 때, 담기 자체가 실패하면
     대표는 양식을 아예 못 넣는다. 이 PC 에서는 쓰이고 자리만 안 적혀야 한다. */
  const 올리기 = cutFn(CODE, 'async function kcFormUpload(');
  assert.match(올리기, /catch/, '올리기 실패를 안 받아냅니다');
  assert.match(올리기, /return\s*''/, '실패했을 때 빈 자리를 안 돌려줍니다');

  const 한곳 = cutFn(CODE, 'async function cvFormPut(');
  const 담기줄 = 한곳.indexOf('saveFileUnified(');
  const 올림줄 = 한곳.indexOf('kcFormUpload(');
  assert.ok(담기줄 >= 0 && 올림줄 > 담기줄,
    '★ 창고에 먼저 올리고 있습니다 — 못 올리면 이 PC 에도 안 담깁니다');
  assert.match(한곳, /if\s*\(\s*자리\s*\)/, '자리가 비었을 때를 안 가립니다');
});

test('⑤★ 이 PC 에 없으면 창고에서 데려온다 — 없으면 고친 것이 헛일이다', () => {
  const 찾기 = cutFn(CODE, 'async function getFileAsync(');
  assert.match(찾기, /kcFormFromCloud\(/,
    '★ 이 PC 에 없을 때 창고를 안 봅니다 — 다른 PC 에서 옛날 그대로 안 열립니다');

  const 데려오기 = cutFn(CODE, 'async function kcFormFromCloud(');
  assert.match(데려오기, /saveFileUnified\(/,
    '데려온 것을 이 PC 에 안 담습니다 — 열 때마다 다시 받습니다');
  assert.match(데려오기, /stPath/, '자리가 적힌 줄만 골라야 합니다');
});

test('⑥★ 창고 규칙이 그 자리를 덮는다 — 안 덮이면 올리기가 통째로 막힌다', () => {
  assert.match(규칙, /match\s*\/kcareer_forms\/\{uid\}\/\{file\}/,
    '★ 창고 규칙에 양식 자리가 없습니다 — 맨 아래 「전부 거부」에 걸려 한 장도 안 올라갑니다');

  /* 읽기가 «본인만»인가 — 고친 양식에는 성명 같은 값이 적혀 있을 수 있다 */
  const 칸 = 규칙.slice(규칙.indexOf('match /kcareer_forms/'));
  const 끝 = 칸.indexOf('\n    }');
  const 속 = 칸.slice(0, 끝 > 0 ? 끝 : 400);
  assert.match(속, /allow read:\s*if signedIn\(\) && request\.auth\.uid == uid/,
    '★ 읽기가 본인만이 아닙니다 — 고친 양식에 적힌 값이 남에게 보입니다');
  assert.ok(!/isStaff\(\)/.test(속), '★ 전 직원에게 열려 있습니다');

  /* 올리개의 점검 목록에도 적혀 있어야 한다 — 안 적으면 규칙이 사라져도 안 걸린다 */
  const 올리개 = fs.readFileSync(path.join(R, 'scripts', 'storage-rules-deploy.js'), 'utf8');
  assert.match(올리개, /kcareer_forms\/UID\//,
    '★ 올리개의 「앱이 쓰는 자리」에 양식이 빠졌습니다 — 규칙이 사라져도 안 멈춥니다');
});

test('⑦ 완전삭제하면 창고에서도 비운다 — 아무도 못 꺼내는 파일이 쌓이지 않게', () => {
  const 비우기 = cutFn(CODE, 'function kcTrashPurge(');
  assert.match(비우기, /stPath/, '★ 창고에 올린 양식이 영영 남습니다 — 요금만 나갑니다');
  assert.match(비우기, /\.delete\(\)/, '창고에서 안 지웁니다');
  /* ⚠ 휴지통에 «있는 동안»은 지우면 안 된다 — 되살릴 수 있어야 한다 */
  const 담기 = cutFn(CODE, 'function kcTrashPut(');
  assert.ok(!/stPath/.test(담기) || !/delete\(\)/.test(담기),
    '★ 휴지통에 넣을 때 창고를 지우고 있습니다 — 되살려도 원본이 없습니다');
});

test('⑧★ 창고 SDK 가 실려 있다 — 없으면 이 기능 전체가 조용히 안 돈다', () => {
  assert.match(RAW, /firebase-storage-compat\.js/,
    '★ firebase-storage-compat 가 없습니다 — firebase.storage 가 없어 늘 실패로 떨어집니다');
  /* 남의 창고를 보지 않는가 */
  const 창고 = cutFn(CODE, 'function kcFormStorage(');
  assert.match(CODE, /KC_FORM_BUCKET\s*=\s*'gs:\/\/pureun-erp-hrphotos'/,
    '창고 이름이 바뀌었습니다 — 규칙을 올린 창고와 같아야 합니다');
  assert.match(창고, /KC_FORM_BUCKET/, '창고를 지정하지 않습니다');
  assert.match(창고, /return null/, '창고를 못 얻었을 때 물러나지 않습니다');
});
