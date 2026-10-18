'use strict';
/* 폰 화면 공통 규칙 (대표 지시 2026-10-18 「폰화면관리」)

   ★ 왜 이 검사가 있나
     폰 정리를 앱마다 따로 해 왔다 — 10/17 하루에만 여섯 앱. 그런데 «어느 앱이 폰에서
     어떤지»를 한 번에 볼 길이 없었고, 같은 흠(떠 있는 단추가 목록을 덮는다)이 앱마다
     따로 숨겨지고 있었다. 그래서 ① 모든 앱을 폰 폭에서 «로그인한 채» 재는 도구를 두고
     (tools/phone-audit) ② 공통 흠은 공용 부품에서 한 번에 고쳤다. 이 검사는 그 둘이
     «조용히 헐거워지지 않게» 지킨다.

   ★ 무엇을 지키나 — 지금 px 값이 아니라 규칙이다
     ① 점검 도구가 포털 앱을 하나도 안 빠뜨린다 (새 앱은 저절로 점검에 든다)
     ② 포털 앱마다 점검용 지어낸 자료(seeds/<key>.js)가 있다 — 자료가 없으면 표가 깨져도 못 본다
     ③ 점검용 자료에 실제 사람·연락처가 섞이지 않는다
     ④ 폰에서 숨긴 떠 있는 단추는 «다른 길»이 반드시 있다(숨기기만 하면 못 누른다)
     ⑤ 「새 버전 있음」·확인 중·결과 알림은 폰에서도 숨기지 않는다

   실행: node --test tests/phone-screen-rules.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const TOOL = path.join(ROOT, 'tools', 'phone-audit');

/* 포털 타일 열쇠 — 도구와 «따로» 읽는다(같은 코드로 읽으면 둘이 같이 틀려도 못 잡는다) */
function 포털열쇠() {
  const enter = 읽기('enter.html');
  const at = enter.search(/\bAPPS\s*=\s*\[/);
  assert.ok(at >= 0, 'enter.html 에서 APPS 목록을 못 찾았습니다');
  const 덩이 = enter.slice(at, enter.indexOf('];', at));
  return [...new Set([...덩이.matchAll(/key:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]))];
}

test('① 점검 도구가 포털 앱을 하나도 안 빠뜨린다', async () => {
  const { portalApps } = await import(pathToFileURL(path.join(TOOL, 'run.mjs')).href);
  const 도구 = portalApps().map((a) => a.key);
  const 빠짐 = 포털열쇠().filter((k) => !도구.includes(k));
  assert.deepEqual(빠짐, [], '폰 점검 도구가 이 앱들을 안 잽니다: ' + 빠짐.join(', '));
  assert.ok(도구.includes('portal'), '포털 첫 화면도 폰에서 재야 합니다');
  /* 주소도 맞아야 한다 — 열쇠만 같고 엉뚱한 파일을 열면 헛잰다 */
  for (const a of portalApps()) {
    if (a.key === 'portal') continue;
    const 파일 = a.url.split('?')[0];
    assert.ok(fs.existsSync(path.join(ROOT, 파일)), a.key + ' 의 주소(' + a.url + ')에 파일이 없습니다');
  }
});

test('② 포털 앱마다 점검용 지어낸 자료가 있다 — 새 앱도 seeds/<key>.js 를 만든다', () => {
  const 없음 = 포털열쇠().filter((k) => !fs.existsSync(path.join(TOOL, 'seeds', k + '.js')));
  assert.deepEqual(없음, [],
    '폰 점검용 자료가 없는 앱: ' + 없음.join(', ') +
    ' — 빈 화면으로는 표·목록이 폰에서 깨지는지 알 수 없습니다. tools/phone-audit/README.md 를 보고 만드십시오.');
});

test('② 점검용 자료 파일은 도구가 읽는 꼴이다 (data · views)', () => {
  const seed = require(path.join(TOOL, 'seed.js'));
  for (const [k, s] of Object.entries(seed.apps)) {
    assert.equal(typeof s, 'object', k + ': module.exports 가 객체가 아닙니다');
    if (s.data !== undefined) assert.equal(typeof s.data, 'object', k + ': data 는 객체여야 합니다');
    for (const v of s.views || []) {
      assert.ok(v && typeof v.name === 'string' && v.name, k + ': views 에 이름 없는 화면이 있습니다');
      assert.equal(typeof v.run, 'function', k + ':' + v.name + ' — run(page) 이 없습니다');
    }
  }
});

test('③ 점검용 자료에 주민번호·실제 전화번호 꼴이 없다', () => {
  const dir = path.join(TOOL, 'seeds');
  const 파일 = ['seed.js'].map((f) => path.join(TOOL, f))
    .concat(fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f)) : []);
  for (const f of 파일) {
    const s = fs.readFileSync(f, 'utf8');
    /* 주민번호 꼴(앞 6자리-뒤 7자리, 뒤 첫 자리 1~4) */
    assert.doesNotMatch(s, /\b\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?[1-4]\d{6}\b/,
      path.basename(f) + ': 주민번호 꼴이 있습니다 — 점검 자료는 지어낸 것만 씁니다');
    /* 휴대폰 번호 — 지어낸 것은 010-0000-xxxx 처럼 «0000» 가운데로 쓴다 */
    const 폰 = [...s.matchAll(/\b01[016789]-?(\d{3,4})-?\d{4}\b/g)].filter((m) => !/^0+$/.test(m[1]));
    assert.deepEqual(폰.map((m) => m[0]), [],
      path.basename(f) + ': 실제처럼 보이는 휴대폰 번호가 있습니다 — 가운데를 0000 으로 지어내십시오');
  }
});

/* ── 떠 있는 단추 — 공용 앱바가 폰에서 정리한다 ── */
const 앱바 = 읽기('js/pu-appbar.js');
const 버전 = 읽기('js/pu-version.js');

function 폰CSS() {
  /* 앱바가 붙이는 폰 꾸밈 한 벌 — 문자열로 이어 붙여 두었으므로 따옴표 안만 모은다 */
  const at = 앱바.indexOf("'pu-appbar-phone-css'");
  assert.ok(at >= 0, '앱바의 폰 꾸밈(pu-appbar-phone-css)을 못 찾았습니다');
  const 끝 = 앱바.indexOf('document.head.appendChild', at);
  /* 폰 구간 조건은 이름 붙인 값(PHONE_MQ)으로 이어 붙인다 — 그 값을 제자리에 넣어 읽는다 */
  const mq = (/var PHONE_MQ = '([^']+)'/.exec(앱바) || [])[1] || '';
  const 덩이 = 앱바.slice(at, 끝).replace(/\bPHONE_MQ\b/g, "'" + mq + "'");
  return [...덩이.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]).join('');
}

test('④ 폰에서 숨긴 떠 있는 단추는 손잡이 목록에 «누를 줄»이 있다', () => {
  const css = 폰CSS();
  assert.match(css, /@media[^{]*max-width/, '폰 구간에서만 걸어야 합니다 — PC 는 그대로 둡니다');
  const 숨긴 = [...css.matchAll(/#([a-z0-9-]+)[^{,]*\{[^}]*display:\s*none/g)].map((m) => m[1]);
  assert.ok(숨긴.length >= 1, '폰에서 정리하는 떠 있는 단추가 없습니다');
  const 줄 = /function phoneRows[\s\S]*?\n  }\n/.exec(앱바);
  assert.ok(줄, '숨긴 단추를 대신 누르는 줄(phoneRows)이 없습니다');
  for (const id of 숨긴) {
    assert.ok(줄[0].includes("'" + id + "'"),
      '#' + id + ' 를 폰에서 숨기면서 손잡이 목록에 누를 줄을 안 두었습니다 — 그 일을 폰에서 할 길이 없어집니다');
  }
  /* 목록을 열 때 그 줄들을 실제로 붙이는가 */
  assert.match(앱바, /function openPop[\s\S]*?phoneRows\(pop\)/, '목록을 열 때 폰 줄을 안 붙입니다');
});

test('⑤ 「새 버전 있음」·확인 중·결과는 폰에서도 숨기지 않는다', () => {
  const css = 폰CSS();
  /* 최신 단추는 «평소(ok)»일 때만 숨긴다 — 상태 없이 통째로 숨기면 새 버전을 영영 모른다 */
  const 버전규칙 = [...css.matchAll(/([^{}]*#pu-version-fab[^{}]*)\{[^}]*display:\s*none/g)].map((m) => m[1]);
  for (const sel of 버전규칙) {
    assert.match(sel, /\[data-state="ok"\]/, '「최신」 단추를 상태와 상관없이 숨겼습니다: ' + sel.trim());
  }
  /* 상태를 겉에 적어야 위 규칙이 가려 낼 수 있다 */
  assert.match(버전, /setAttribute\('data-state',\s*state\)/, '최신 단추가 상태를 겉에 안 적습니다');
  /* 눌렀을 때의 결과(최신입니다·확인 실패)는 평소와 다른 상태로 알린다 — 같으면 폰에서 안 보인다 */
  const 누름 = /function onPress\(\)[\s\S]*?\n  }\n/.exec(버전);
  assert.ok(누름, 'onPress 를 못 찾았습니다');
  /* 잠시 뒤 평소로 «되돌리는» 줄(setTimeout 안)은 뺀다 — 그건 알린 «다음» 일이다 */
  const 바로 = 누름[0].replace(/setTimeout\(function \(\) \{[^}]*\}/g, '');
  const 결과상태 = [...바로.matchAll(/setFab\('([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(결과상태.length >= 2, '누른 뒤 상태가 안 바뀝니다');
  assert.ok(!결과상태.includes('ok'),
    '누른 결과를 평소(ok) 상태로 알리면 폰에서는 숨겨져 «눌러도 아무 반응 없는» 단추가 됩니다');
});
