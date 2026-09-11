'use strict';
/* 자동개발을 «켰다» — 켠 뒤에도 지켜야 할 것 (대표 지시 2026-09-11 「자동개발도 켜달라」)

   2026-08-13 에 잠가 두었던 것을 열었다. 이 검사는 «켠 상태»와 «안전장치»를 함께 못 박는다.
   ⚠ 켜는 것 자체보다 «켠 채로 안전한가»가 중요하다 — AI 가 운영 코드를 고치는 기능이다. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'functions/index.js'), 'utf8').replace(/\r\n/g, '\n');
const ENTER = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
/* ⚠⚠ stripComments(ENTER) 를 통째로 쓰지 «말 것» — 2026-09-11 실측: 그렇게 하면
   자동개발 구역(sgDevBox)이 통째로 사라진다(origin/main 에서도 그렇다).
   그 상태로 「…이 없다」를 물으면 **늘 통과한다** — 아무것도 안 지키는 검사가 된다.
   그래서 «그 구역만» 잘라 내고, 거기서 주석을 걷는다. */
function 자동개발구역(){
  const from = ENTER.indexOf('id="sgDevBox"');
  const to = ENTER.indexOf("id='sgRollbackConfirm'") >= 0
    ? ENTER.indexOf("id='sgRollbackConfirm'") : ENTER.indexOf('sgRollbackConfirm');
  assert.ok(from > 0 && to > from, '자동개발 구역을 못 찾았습니다');
  return stripComments('<script>' + ENTER.slice(from, to) + '</script>');
}
const bare = 자동개발구역();
const CLIENT = fs.readFileSync(path.join(R, 'js/pu-dev-automation.js'), 'utf8');

test('① ★★ 서버 함수가 «내보내진다» — 잠가 두면 화면 단추가 헛돈다', function () {
  assert.match(APP, /exports\.developmentAutomation\s*=\s*functions/,
    '★★ 자동개발 함수가 안 내보내집니다 — 단추를 눌러도 서버에 닿지 못합니다');
  assert.ok(!/_parkedDevelopmentAutomation/.test(APP),
    '★ 잠가 두던 이름이 남아 있습니다 — 두 벌이 되면 어느 것이 도는지 알 수 없습니다');
  /* 화면이 부르는 주소와 함수 이름이 맞아야 한다 */
  assert.match(CLIENT, /cloudfunctions\.net\/developmentAutomation/,
    '★★ 화면이 부르는 주소와 서버 함수 이름이 다릅니다');
});

test('② ★★ 비밀값 둘을 그대로 요구한다 — 빠지면 배포가 통째로 멈춘다', function () {
  const seg = APP.slice(APP.indexOf('exports.developmentAutomation'), APP.indexOf('exports.developmentAutomation') + 400);
  assert.match(seg, /secrets:\s*\["GITHUB_AUTOMATION_TOKEN",\s*"AUTOMATION_BRIDGE_KEY"\]/,
    '★★ 비밀값 선언이 바뀌었습니다 — 이 함수가 못 오르면 메일·건의 알림까지 못 올립니다');
});

test('③ ★★ 화면이 「꺼져 있다」고 거짓말하지 않는다', function () {
  assert.ok(!/지금은 꺼져 있습니다/.test(bare),
    '★★ 켰는데 화면은 꺼져 있다고 합니다 — 어긋난 안내는 없는 것보다 나쁩니다');
  assert.ok(!/아래 버튼을 눌러도 동작하지 않습니다/.test(bare), '★ 옛 안내가 남아 있습니다');
  assert.match(bare, /자동개발 <span class="sg-section-state">켜짐<\/span>/,
    '★ 접힘 머리가 아직 「꺼둠」입니다');
});

test('④ ★ 유료라는 것을 «누르기 전에» 말한다', function () {
  assert.match(bare, /요금이 나갑니다/,
    '★ 한 번 누를 때마다 돈이 나가는데 그 말이 없습니다');
});

test('⑤ ★★ 자동배포는 기본으로 «꺼둔다» — 켜면 사람 눈 없이 운영에 올라간다', function () {
  assert.match(bare, /id="sgDevAutoDeploy"'\+\(automation\.autoDeploy===true\?' checked':''\)/,
    '★★ 자동배포가 기본으로 켜져 있습니다 — AI 가 쓴 코드가 확인 없이 배포됩니다');
  /* 자동병합은 이 표가 붙었을 때만 돈다 — 그 조건이 사라지면 위 기본값이 뜻을 잃는다 */
  const MERGE = fs.readFileSync(path.join(R, '.github/workflows/autodev-auto-merge.yml'), 'utf8');
  assert.match(MERGE, /grep -qx 'auto-deploy-approved'/,
    '★★ 자동병합이 「자동배포 승인」 표를 안 봅니다 — 무엇이든 병합됩니다');
});

test('⑥ ★★ 켜도 새는 곳은 그대로 막혀 있다', function () {
  const DEV = fs.readFileSync(path.join(R, 'functions/dev-automation.js'), 'utf8');
  const WF = fs.readFileSync(path.join(R, '.github/workflows/codex-issue-implementation.yml'), 'utf8');
  assert.match(DEV, /assertNoLeak\(title/, '★★ 공개 이슈 자기검사가 사라졌습니다');
  assert.match(WF, /scripts\/autodev-privacy-gate\.js/, '★★ 공개 전 검문이 사라졌습니다');
  assert.ok(!/id="sgDevPrivacy"/.test(bare), '★ 사람 눈에 기댄 체크칸이 되살아났습니다');
});
