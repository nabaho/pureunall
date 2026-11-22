'use strict';
// 앱이 «은퇴한» Claude 모델을 부르지 않는다 — node --test tests/ai-models-not-retired.test.js
//
// 왜(2026-11-19): 푸른이알피 상담 AI 요약은 claude-sonnet-4-20250514 하나만 썼는데 그 모델이 2026-06-15 에
//   은퇴해 다섯 달 동안 «늘» 실패했다. 업무관리·기금관리의 두 번째(폴백) 모델도 같은 것이라 폴백이 죽어 있었다.
//   아무도 몰랐다 — 그래서 은퇴 목록과 대조하는 검사를 둔다.
// 은퇴 목록은 Anthropic 모델 문서(platform.claude.com/docs/en/about-claude/models/overview)의 «Retired» 표.
//   은퇴는 되돌아오지 않는 사실이라 값을 박는다. 새로 은퇴하는 모델이 생기면 여기에 더한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const RETIRED = [   // 검사고정-허용: 은퇴는 되돌아오지 않는 사실(Anthropic 모델 문서의 Retired 표)이라 이름 자체가 규칙이다
  'claude-opus-4-1-20250805', 'claude-opus-4-1', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514',
  'claude-3-haiku-20240307', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
  'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620', 'claude-3-sonnet-20240229', 'claude-2.1', 'claude-2.0',
];

/* 배포되는 앱만 본다 — 최상위 *.html · js/*.js · functions/*.js. 문서·계획서·검사는 옛 이름을 «기록»으로 적어도 된다 */
function appFiles() {
  const out = [];
  fs.readdirSync(ROOT).filter((f) => /\.html$/.test(f)).forEach((f) => out.push(f));
  ['js', 'functions'].forEach((d) => {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter((f) => /\.m?js$/.test(f)).forEach((f) => out.push(d + '/' + f));
  });
  return out;
}

/* 부르는 자리만 본다 — 주석에 «예전에 쓰던 이름»을 남기는 것은 괜찮다 */
function modelLiterals(src) {
  const hits = [];
  const re = /model\s*:\s*['"](claude-[0-9a-z.-]+)['"]/g;
  let m;
  while ((m = re.exec(src))) hits.push(m[1]);
  const list = src.match(/AI_MODELS\s*=\s*\[([^\]]*)\]/g) || [];
  list.forEach((l) => (l.match(/['"](claude-[0-9a-z.-]+)['"]/g) || []).forEach((q) => hits.push(q.slice(1, -1))));
  return hits;
}

test('★ 배포되는 앱이 은퇴한 Claude 모델을 부르지 않는다', () => {
  const bad = [];
  let seen = 0;
  appFiles().forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    modelLiterals(src).forEach((m) => {
      seen++;
      if (RETIRED.indexOf(m) >= 0) bad.push(f + ' → ' + m);
    });
  });
  assert.ok(seen >= 1, 'AI 모델을 고르는 자리를 하나도 못 찾았다 — 찾는 꼴이 낡았는지 보라');
  assert.deepEqual(bad, [], '은퇴한 모델을 부른다(늘 실패한다):\n  ' + bad.join('\n  '));
});

test('찾는 꼴이 실제 앱 모양을 잡는다 (검사가 헛돌지 않게)', () => {
  assert.deepEqual(modelLiterals("var AI_MODELS=['claude-a-1','claude-b-2'];"), ['claude-a-1', 'claude-b-2']);
  assert.deepEqual(modelLiterals("model:'claude-x-9',"), ['claude-x-9']);
  assert.deepEqual(modelLiterals("// 예전: claude-sonnet-4-20250514"), [], '주석 속 이름은 부르는 자리가 아니다');
});
