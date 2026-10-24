'use strict';
/* 폰 미러 (tools/phone-mirror.js · 폰미러-켜기.bat) — 대표 지시 2026-10-24
   「내 컴퓨터에 폰을 미러링으로 연결하고 푸른 통합시스템 UI 고칠 수 있게 해 달라」

   ★ 못 박는 것 — 규칙
     ① 폰을 «누르지도 치지도» 않는다 — adb input · CDP Input.* · 클릭이 코드에 없다(누르는 것은 사람)
     ② 폰 크롬에 보내는 명령은 «재기·찍기» 둘뿐(Runtime.evaluate · Page.captureScreenshot)이고, 돌리는 코드는 measure.js 뿐
     ③ 푸른 화면만 잰다 — 은행·메일 같은 다른 탭은 고르지 않는다
     ④ 갈무리 자리는 저장소에 안 올라간다(.gitignore) — 고객 화면이 그대로 찍힌다
     ⑤ 기기 상태를 바르게 읽는다 — 허용 안 누름·안 꽂음을 갈라 말한다
     ⑥ .bat 은 ASCII 이고 이 도구만 부른다 (한글 .bat 은 cmd 코드페이지에서 깨진다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'tools', 'phone-mirror.js'), 'utf8');
const CODE = stripJs(SRC);
const M = require('../tools/phone-mirror.js');

test('①★★ 폰을 누르거나 치지 않는다', () => {
  assert.doesNotMatch(CODE, /['"]input['"]/, '★ adb shell input(누르기·글자 넣기)을 씁니다');
  assert.doesNotMatch(CODE, /Input\.\w+/, '★ CDP Input.*(누르기·글자 넣기)을 씁니다');
  assert.doesNotMatch(CODE, /\.click\(|dispatchEvent|\.submit\(/, '★ 폰 화면의 단추를 누릅니다');
  assert.doesNotMatch(CODE, /['"]shell['"]/, '★ adb shell 로 폰에 명령을 보냅니다 — 갈무리는 exec-out screencap 하나면 됩니다');
});

test('②★★ 폰 크롬에는 «재기·찍기»만 — 돌리는 코드는 measure.js 뿐', () => {
  const 명령 = (CODE.match(/cdp한번\([^,]+,\s*'([^']+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]);
  assert.ok(명령.length >= 1, 'CDP 명령을 못 찾았습니다 — 이 검사가 헛돕니다');
  명령.forEach((m) => assert.ok(['Runtime.evaluate', 'Page.captureScreenshot'].includes(m), '★ 허락 밖의 CDP 명령: ' + m));
  /* Runtime.evaluate 에 넘기는 식은 measure.js 를 읽은 것으로만 만든다 */
  assert.match(CODE, /readFileSync\(MEASURE/, 'measure.js 를 읽지 않습니다');
  assert.match(CODE, /MEASURE = path\.join\(__dirname, 'phone-audit', 'measure\.js'\)/, '재는 자가 phone-audit 의 measure.js 가 아닙니다');
  assert.doesNotMatch(CODE, /Runtime\.evaluate', \{ expression: (?!식)/, '★ measure.js 밖의 코드를 폰 탭에서 돌립니다');
});

test('③★ 푸른 화면만 잰다', () => {
  assert.equal(M.허용주소('https://nabaho.github.io/pureunall/pu-erp.html?sso=1'), true);
  assert.equal(M.허용주소('https://nabaho.github.io/pureunall'), true);
  assert.equal(M.허용주소('http://localhost:8080/pu-erp.html'), true);
  assert.equal(M.허용주소('https://nabaho.github.io/other/'), false, '같은 집의 다른 저장소');
  assert.equal(M.허용주소('https://nabaho.github.io.evil.com/pureunall/'), false, '이름을 흉내 낸 주소');
  assert.equal(M.허용주소('http://nabaho.github.io/pureunall/'), false, 'https 가 아니다');
  assert.equal(M.허용주소('https://mail.daum.net/'), false);
  assert.equal(M.허용주소('chrome://newtab'), false);
  const 고름 = M.탭고르기([
    { type: 'page', url: 'https://www.kebhana.com/', title: '은행' },
    { type: 'page', url: 'https://nabaho.github.io/pureunall/pu-erp.html', title: '이알피' },
    { type: 'service_worker', url: 'https://nabaho.github.io/pureunall/pu-sw.js' },
  ]);
  assert.equal(고름.tab.title, '이알피');
  assert.equal(고름.다른탭수, 1);
  assert.equal(M.탭고르기([{ type: 'page', url: 'https://www.kebhana.com/' }]).tab, null, '★ 푸른 탭이 없으면 아무것도 안 고른다');
});

test('④★ 갈무리 자리는 저장소에 안 올라간다', () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gi, /^tools\/phone-mirror\/out\/?$/m, '★ 고객 화면 갈무리가 저장소에 올라갈 수 있습니다');
  assert.match(CODE, /OUT = path\.join\(__dirname, 'phone-mirror', 'out'\)/, '갈무리 자리가 .gitignore 의 자리와 다릅니다');
  assert.match(M.사진이름(new Date(2026, 9, 24, 9, 5, 7)), /^폰-20261024-090507\.png$/);
});

test('⑤ 기기 상태를 바르게 읽는다', () => {
  const 목록 = M.기기읽기('List of devices attached\nR3CT80ABC  device usb:1-1 product:x model:SM_S928N device:y\n\n');
  assert.deepEqual(목록, [{ serial: 'R3CT80ABC', state: 'device', model: 'SM_S928N' }]);
  assert.equal(M.기기판정(목록).ok, true);
  const 안허용 = M.기기판정(M.기기읽기('List of devices attached\nR3CT80ABC\tunauthorized\n'));
  assert.equal(안허용.ok, false); assert.match(안허용.why, /허용/);
  const 없음 = M.기기판정(M.기기읽기('List of devices attached\n\n'));
  assert.equal(없음.ok, false); assert.match(없음.why, /USB/);
  assert.ok(M.adb후보({ LOCALAPPDATA: '/없는/자리' }).includes('adb'), 'PATH 의 adb 를 먼저 본다');
  assert.equal(M.계획(['--dry', '--shot']).일, '--shot');
  assert.equal(M.계획([]).일, '--menu');
});

test('⑥ .bat 은 ASCII 이고 이 도구만 부른다', () => {
  const bat = fs.readFileSync(path.join(ROOT, '폰미러-켜기.bat'), 'utf8');
  assert.ok(!/[^\x00-\x7F]/.test(bat), '★ .bat 에 한글이 있습니다 — cmd 코드페이지에서 깨집니다');
  const 부름 = (bat.match(/^node .*/gm) || []);
  assert.ok(부름.length >= 5);
  부름.forEach((줄) => assert.match(줄, /^node tools\\phone-mirror\.js --\w+/, '다른 것을 부릅니다: ' + 줄));
});
