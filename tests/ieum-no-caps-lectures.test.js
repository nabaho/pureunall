/* 이음센터 «연간 한도»·«이음강의 기록»은 없앴다 — 되살리지 말 것
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「정리 지워라」.

   ★ 왜 없앴나
     캘린더를 한 곳(푸른 캘린더)으로 모으는 2걸음에서 「이 둘을 옮길까요, 아니면
     안 쓰는 것으로 보고 지울까요」를 여쭈었고 «지워라» 를 고르셨다.
     근거: 서버의 `ieum_caps` · `ieum_lectures` 두 자리가 **둘 다 비어 있었다**(실측).
     만들어만 두고 아무도 한 번도 안 쓴 기능이, 인원 현황 표에서 넉 줄(법률상담 잔여 ·
     이음강의 · 이음강의 잔여 · 강의 이력)을 차지하고 늘 「—」만 보여 주고 있었다.

   ★ 이 검사가 지키는 것
     ① 두 자리를 다시 읽거나 쓰지 않는다 (이알피·푸른 캘린더 둘 다)
     ② 표에 그 칸들이 다시 생기지 않는다
     ③ 「법률상담」 셈 자체는 살아 있다 — 그것은 캘린더 일정에서 «저절로» 세는 것이라
        한도와 상관없다(같이 지워 버리면 안 된다)
   ⚠ 되살리려면 이 검사를 지우는 것으로 끝내지 말 것 — «쓸 사람»이 있는지부터 확인한다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
/* ⚠ 주석을 먼저 걷는다 — 「왜 없앴는지」를 적어 둔 글이 «쓰는 것»으로 잡히면
   까닭을 적는 일이 벌 받는 셈이 된다(color-palette-apps 가 같은 데서 데었다). */
const ERP = stripComments(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8'));
const CAL = stripComments(fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8'));

test('① 두 자리를 더 이상 읽거나 쓰지 않는다', () => {
  ['ieum_caps', 'ieum_lectures'].forEach((키) => {
    assert.strictEqual(ERP.indexOf(키) >= 0, false, '이알피가 아직 ' + 키 + ' 를 씁니다');
    assert.strictEqual(CAL.indexOf(키) >= 0, false, '푸른 캘린더가 아직 ' + 키 + ' 를 씁니다');
  });
});

test('② 딸려 있던 셈·손잡이도 남지 않았다 — 반쯤 지우면 죽은 코드가 된다', () => {
  ['capOf', 'lecUsed', 'saveCap', 'addLecture', 'removeLecture', 'lecModal', 'myLecs']
    .forEach((이름) => {
      assert.strictEqual(ERP.indexOf(이름) >= 0, false, '이알피에 ' + 이름 + ' 가 남아 있습니다');
    });
  ['capOf', 'lecUsed', 'barCellHtml', 'remBadgeHtml'].forEach((이름) => {
    assert.strictEqual(CAL.indexOf(이름) >= 0, false, '푸른 캘린더에 ' + 이름 + ' 가 남아 있습니다');
  });
});

/* 이음센터 인원 현황 함수 «안»만 잘라 본다.
   ⚠ 파일 전체에서 「잔여」를 찾으면 안 된다 — 휴가 잔여·연차 잔여 같은 «딴 화면»의
     멀쩡한 칸이 일곱 곳 걸린다(처음에 그렇게 짰다가 헛돌았다). */
function 이음표(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('③ 표에 그 칸이 다시 생기지 않았다', () => {
  /* ⚠ 2026-09-20(4걸음) — 이알피 쪽 이음 표(IeumPeopleTab)가 화면과 함께 사라졌다.
     표는 이제 푸른 캘린더 한 곳이다. 이알피는 «다시 생기지 않았는가»만 본다. */
  const 캘표 = 이음표(CAL, 'function peopleHtml(){');
  assert.strictEqual(/이음강의/.test(캘표), false, '푸른 캘린더 표에 「이음강의」가 다시 생겼습니다');
  /* 「잔여」는 한도가 있어야 뜻이 있는 칸이다 — 한도를 없앴으니 함께 없어야 한다 */
  assert.strictEqual(/잔여/.test(캘표), false, '푸른 캘린더 이음 표에 「잔여」 칸이 남아 있습니다');
  assert.strictEqual(/function IeumPeopleTab\(/.test(ERP), false,
    '이알피에 이음 인원 표가 다시 생겼습니다 — 표는 푸른 캘린더 한 곳입니다');
});

test('④★ 「법률상담」 셈은 살아 있다 — 한도와 함께 지워 버리면 안 된다', () => {
  /* 법률상담은 변호사의 이음센터 «일정»을 저절로 센 것이라 한도와 상관없다.
     한도를 걷어내며 이것까지 지우면 변호사 근무가 화면에서 통째로 사라진다. */
  /* ⚠ 2026-09-20(4걸음) — 세는 자리가 푸른 캘린더 한 곳이 됐다(이알피 표는 사라졌다). */
  assert.match(CAL, /법률상담/, '푸른 캘린더에서 법률상담 칸이 사라졌습니다');
  /* 셈은 따로 함수를 두지 않고 표를 그리면서 바로 센다 —
     변호사(isLaw)면 그 사람의 이음 근무 수를 «회»로 적는다. 그 갈래가 살아 있는지 본다. */
  assert.match(CAL, /isLaw/, '변호사를 가르는 자리가 사라졌습니다');
  assert.match(CAL, /lawcnt/, '법률상담 횟수를 적는 칸이 사라졌습니다');
});

test('⑤ 비고는 남는다 — 이것은 실제로 쓰고 있는 자료다', () => {
  /* external_staff.note 에 「2·4주 금 (3/13 선호)」 같은 실제 기록이 들어 있다.
     한도·강의와 함께 쓸어버리지 않았는지 본다. */
  /* ⚠ 2026-09-20(4걸음) — 비고를 «고치는 곳»도 푸른 캘린더로 옮겼다(2걸음-다).
     이알피에는 이제 이 자료를 다루는 화면이 없다 — 자료 자체는 그대로 살아 있다. */
  assert.match(CAL, /ieum_notes/, '푸른 캘린더가 비고를 안 읽습니다');
  assert.match(CAL, /function saveNote\(/, '비고를 고치는 길이 사라졌습니다');
  assert.match(CAL, /function openNote\(/, '비고를 여는 길이 사라졌습니다');
});
