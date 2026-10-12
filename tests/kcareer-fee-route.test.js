'use strict';
/* 협회 지급 확인 서류는 «기본으로» 회의·비용관리 저장 서류로 (대표 지시 2026-10-12)
   규칙만 못 박는다: 내용(지급확인서·상담비 …)을 보고 정하고 · 사람이 고른 것이 이기며 · 저장 단추가 그 판정을 거친다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
test('돈 받은 확인 서류의 낱말은 비용으로, 이력서 낱말은 아니다', () => {
  const m = SRC.match(/var RH_FEE_WORDS=(\/[^\n]*\/);/); assert.ok(m, '낱말 목록');
  const re = eval(m[1]);
  ['노무상담비 지급확인서 및 개인정보 동의서', '강사료 지급 확인', '원고료 지급금액 300,000원'].forEach((t) => assert.ok(re.test(t), t));
  ['이력서 학력 경력 자격', '프로필 위촉 위원', '위임장'].forEach((t) => assert.ok(!re.test(t), t));
});
test('저장 단추가 판정을 거치고, 사람이 고른 것·이미 다른 보관함이면 건드리지 않는다', () => {
  const f = strip(떼기('async function rhAutoSaveDomain('));
  assert.ok(/_rhModeTouched/.test(f) && /v!=='resume'/.test(f), '사람이 고른 것이 이긴다');
  assert.ok(/return 'feedoc'/.test(f));
  assert.ok(/await rhAutoSaveDomain\(rhSaveDomain\(\)\)/.test(strip(SRC)), '저장 단추가 판정을 부른다');
  assert.ok(/id="rhModeSel" onchange="_rhModeTouched=true;/.test(SRC), '고르개를 만지면 기억');
});

test('협회 서류에 한정 — 「협회」가 없으면 지급 낱말이 있어도 비용으로 보내지 않는다', () => {
  const f = strip(떼기('async function rhAutoSaveDomain('));
  assert.ok(/\/협회\/\.test\(글\)\s*&&\s*RH_FEE_WORDS\.test\(글\)/.test(f), '협회 + 지급 낱말 둘 다');
});
