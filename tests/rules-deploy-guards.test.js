'use strict';
/* 규칙 올리개의 안전장치 넷 (2026-09-13 대표 지시 「넷 고쳐」)
 *
 * ★★ 왜 — 종전 올리개는 «사라지는 규칙»만 막았다. 그래서
 *   ① 로그인이 풀려도 조용히 낡은 사본으로 물러서고,
 *   ② 권한이 «넓어지는» 고침이 긴 목록에 한 줄로 흘러가고,
 *   ③ 올린 뒤 정말 올라갔는지 확인하지 않고 새 기준을 남기고,
 *   ④ 콘솔을 못 읽은 채로도 올렸다.
 *
 * ⚠ 여기서는 «글자가 있나»를 세지 않는다 — 판단하는 함수를 직접 돌려 본다.
 *   그래서 배선이 끊기면(함수는 그대로인데 main 이 안 부르면) 맨 아래 두 검사가 잡는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const R = require('../scripts/rules-deploy.js');
const ROOT = path.join(__dirname, '..');

/* ══ ① 왜 못 읽었는지 가린다 ═══════════════════════════════════════ */

test('① 로그인이 풀린 것을 «딴 까닭»과 가른다', () => {
  assert.equal(R.까닭가리기('Error: Command requires authentication, please run firebase login'), '로그인');
  assert.equal(R.까닭가리기('Error: Failed to authenticate, have you run firebase login?'), '로그인');
  assert.equal(R.까닭가리기("Error: Failed to get Firebase project pureun-erp"), '로그인');
});

test('① 못 찾음·권한·그물도 따로 가린다 — 고치는 법이 저마다 다르다', () => {
  assert.equal(R.까닭가리기("spawnSync firebase ENOENT"), '없음');
  assert.equal(R.까닭가리기("HTTP Error: 403, PERMISSION_DENIED"), '권한');
  assert.equal(R.까닭가리기("getaddrinfo ENOTFOUND firebaseio.com"), '그물');
  assert.equal(R.까닭가리기("무슨 말인지 모르겠는 오류"), '딴까닭');
});

/* ══ ② 헐거워졌나 ═════════════════════════════════════════════════ */

test('② && 를 맨 바깥에서만 가른다 — 괄호 안의 && 는 안 자른다', () => {
  assert.deepEqual(R.조각들('a && b'), ['a', 'b']);
  assert.deepEqual(R.조각들('a && (b && c)'), ['a', 'b && c']);
  assert.deepEqual(R.조각들('(x || y) && z'), ['x || y', 'z']);
});

test('② true 가 되면 «헐거워짐» — 누구나 읽는다', () => {
  assert.equal(R.느슨해졌나("auth != null", 'true'), '헐거워짐');
  assert.equal(R.느슨해졌나("auth != null", true), '헐거워짐');
});

test('② false 였다가 아니게 되면 «헐거워짐» — 아무도 → 누군가', () => {
  assert.equal(R.느슨해졌나(false, "auth != null"), '헐거워짐');
  assert.equal(R.느슨해졌나("auth != null", false), '조임');
});

test('★ ② 조건이 «빠지면» 헐거워짐 · «더해지면» 조임 — 괄호 속을 안 봐도 늘 맞다', () => {
  const 넓 = "auth != null";
  const 좁 = "auth != null && root.child('uid_roles').child(auth.uid).child('status').val() === 'active'";
  assert.equal(R.느슨해졌나(넓, 좁), '조임');       /* 2026-09-12 PR #1225 가 한 일 */
  assert.equal(R.느슨해졌나(좁, 넓), '헐거워짐');   /* 그것을 되돌리면 */
});

test('② 아는 척하지 않는다 — 가릴 수 없으면 «판단못함»', () => {
  assert.equal(R.느슨해졌나("a || b", "c || d"), '판단못함');
});

test('② .indexOn 같은 칸은 넓고 좁고가 «없다»', () => {
  assert.equal(R.허락칸인가('/data/companies/.read'), true);
  assert.equal(R.허락칸인가('/data/companies/.write'), true);
  assert.equal(R.허락칸인가('/x/$k/.validate'), true);
  assert.equal(R.허락칸인가('/companies/.indexOn'), false);
});

test('★ ② «새로 생기는» 칸이 누구나 읽는 것이면 헐거워짐으로 센다 — 없던 자리는 원래 아무도 못 읽는다', () => {
  const 갈래 = R.갈래나누기({
    added: [{ p: '/새칸/.read', v: 'true' }, { p: '/딴칸/.read', v: "auth != null" }],
    changed: []
  });
  assert.equal(갈래.헐거워짐.length, 1);
  assert.equal(갈래.헐거워짐[0].p, '/새칸/.read');
  assert.equal(갈래.헐거워짐[0].새자리, true);
});

/* ══ 승인 파일 ════════════════════════════════════════════════════ */

test('승인 파일이 «경로» 머리를 읽는다 — 창고 쪽 파서는 함수 이름만 읽어 못 쓴다', () => {
  const 표 = R.승인읽기('[/data/companies/.read]\n왜: 까닭\n옛: a\n새: b\n');
  assert.ok(표['/data/companies/.read']);
  assert.equal(표['/data/companies/.read'].옛, 'a');
  assert.equal(표['/data/companies/.read'].새, 'b');
  assert.equal(표['/data/companies/.read'].왜, '까닭');
});

test('승인 파일이 없거나 비어도 터지지 않는다', () => {
  assert.deepEqual(R.승인읽기(''), {});
  assert.deepEqual(R.승인읽기(null), {});
});

test('★ 옛·새가 «둘 다» 맞아야 지나간다 — 한쪽만 맞으면 다시 멈춘다', () => {
  const 헐 = [{ p: '/x/.read', a: '옛몸', b: '새몸' }];
  assert.equal(R.승인안된것(헐, { '/x/.read': { 옛: '옛몸', 새: '새몸' } }).length, 0);
  assert.equal(R.승인안된것(헐, { '/x/.read': { 옛: '옛몸', 새: '딴몸' } }).length, 1);
  assert.equal(R.승인안된것(헐, { '/x/.read': { 옛: '딴몸', 새: '새몸' } }).length, 1);
  assert.equal(R.승인안된것(헐, {}).length, 1);
});

test('승인은 «그 자리»에만 듣는다 — 딴 자리가 같은 몸으로 바뀌어도 안 지나간다', () => {
  const 헐 = [{ p: '/딴자리/.read', a: '옛몸', b: '새몸' }];
  assert.equal(R.승인안된것(헐, { '/x/.read': { 옛: '옛몸', 새: '새몸' } }).length, 1);
});

/* ══ ③④ 올려도 되나 ══════════════════════════════════════════════ */

test('★ ④ 콘솔을 못 읽었으면 «올리지 않는다» (종료코드 3)', () => {
  const r = R.올리기막을까닭({ 살아있는것을읽었나: false, 못지나갈것: [] });
  assert.ok(r, '못 읽었는데도 올리려 합니다 — 낡은 사본으로 콘솔을 덮습니다.');
  assert.equal(r.코드, 3);
});

test('★ ② 승인 없이 넓어지면 «올리지 않는다» (종료코드 4)', () => {
  const r = R.올리기막을까닭({ 살아있는것을읽었나: true, 못지나갈것: [{ p: '/x/.read' }] });
  assert.ok(r);
  assert.equal(r.코드, 4);
});

test('둘 다 괜찮으면 안 막는다', () => {
  assert.equal(R.올리기막을까닭({ 살아있는것을읽었나: true, 못지나갈것: [] }), null);
});

test('★ ③ 올린 뒤 다시 읽은 것이 하나라도 어긋나면 잡는다', () => {
  assert.equal(R.올린뒤어긋남({ gone: [], added: [], changed: [] }), false);
  assert.equal(R.올린뒤어긋남({ gone: ['/x'], added: [], changed: [] }), true);
  assert.equal(R.올린뒤어긋남({ gone: [], added: [{ p: '/x' }], changed: [] }), true);
  assert.equal(R.올린뒤어긋남({ gone: [], added: [], changed: [{ p: '/x' }] }), true);
});

/* ══ ★★ 배선 — 함수가 아니라 «스크립트를 정말 돌려» 본다 ═══════════
   위 검사는 판단하는 함수만 잰다. main 이 그 함수를 «안 부르면» 다 통과하면서
   앱은 그대로 뚫린다. 그래서 가짜 firebase 를 PATH 앞에 놓고 진짜로 돌린다. */

/* ⚠⚠ 저장소의 docs/ 를 «건드리지 않는다». 처음엔 진짜 자리에서 돌렸는데,
     올리개는 돌 때마다 docs/rules-paste.json 과 전체-적용본.json 을 다시 쓴다.
     node --test 는 파일들을 «동시에» 돌리므로, 그 사이 rules-paste-copy.test.js 가
     한 파일은 고쳐지기 전에, 다른 파일은 고쳐진 뒤에 읽어 「둘이 다르다」로 넘어졌다.
     검사는 제 방에서만 놀아야 한다 — 그래서 사본 방을 세우고 거기서 돌린다. */
function 사본방세우기() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'rdep-'));
  fs.mkdirSync(path.join(방, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(방, 'docs'), { recursive: true });
  ['rules-deploy.js', 'make-firebase-rules.js'].forEach(function (f) {
    fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(방, 'scripts', f));
  });
  fs.readdirSync(path.join(ROOT, 'docs'))
    .filter(function (f) { return /^firebase-rules-/.test(f) || f === 'rules-paste.json'; })
    .forEach(function (f) {
      fs.copyFileSync(path.join(ROOT, 'docs', f), path.join(방, 'docs', f));
    });
  return 방;
}

function 가짜firebase로돌리기(인자, 가짜내용) {
  const 방 = 사본방세우기();
  const 길방 = fs.mkdtempSync(path.join(os.tmpdir(), 'fbfake-'));
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(길방, 'firebase.cmd'), '@echo off\r\n' + 가짜내용.cmd + '\r\nexit /b 1\r\n');
  }
  fs.writeFileSync(path.join(길방, 'firebase'), '#!/bin/sh\n' + 가짜내용.sh + '\nexit 1\n', { mode: 0o755 });
  const env = Object.assign({}, process.env);
  env.PATH = 길방 + path.delimiter + env.PATH;
  env.Path = env.PATH;
  let out = '', code = 0;
  try {
    out = cp.execFileSync(process.execPath, [path.join(방, 'scripts', 'rules-deploy.js')].concat(인자),
      { cwd: 방, encoding: 'utf8', env: env, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); code = e.status; }
  return { out: out, code: code, 방: 방 };
}

const 로그인풀림 = {
  cmd: 'echo Error: Command requires authentication, please run firebase login 1>&2',
  sh: 'echo "Error: Command requires authentication, please run firebase login" 1>&2'
};

test('★★ 배선 — 로그인이 풀리면 «크게» 말한다 (조용히 물러서지 않는다)', () => {
  const r = 가짜firebase로돌리기([], 로그인풀림);
  assert.match(r.out, /못 읽었습니다/, '콘솔을 못 읽었는데 그렇다고 말하지 않습니다.');
  assert.match(r.out, /로그인/, '로그인이 풀린 것을 짚어 주지 않습니다 — 고칠 방법을 모릅니다.');
  assert.match(r.out, /사본/, '무엇을 기준으로 견줬는지 밝히지 않습니다.');
});

test('★★ 배선 — 콘솔을 못 읽은 채 --deploy 하면 «올리지 않고» 멈춘다', () => {
  const r = 가짜firebase로돌리기(['--deploy'], 로그인풀림);
  assert.equal(r.code, 3, '못 읽었는데도 올리려 했습니다(종료코드 ' + r.code + '). 사본으로 콘솔을 덮습니다.');
  assert.match(r.out, /올리지 않습니다/);
  assert.doesNotMatch(r.out, /올리는 중/, '실제로 firebase deploy 까지 갔습니다.');
});

test('★★ 검사가 저장소의 규칙 파일을 «건드리지 않는다» — 사본 방에서만 돈다', () => {
  const 전 = ['docs/rules-paste.json', 'docs/firebase-rules-전체-적용본.json']
    .map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); });
  const r = 가짜firebase로돌리기([], 로그인풀림);
  assert.ok(r.방.indexOf(os.tmpdir()) === 0, '사본 방이 임시 자리가 아닙니다: ' + r.방);
  const 후 = ['docs/rules-paste.json', 'docs/firebase-rules-전체-적용본.json']
    .map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); });
  assert.deepEqual(후, 전,
    '검사가 저장소의 규칙 파일을 다시 썼습니다 — 동시에 도는 남의 검사가 그 틈에 넘어집니다.');
});

test('★★ 우회로를 만들지 않았다 — 읽는 깃발은 --deploy «하나»뿐이다', () => {
  /* ⚠ 글(주석)에서 --force 를 찾으면 안 된다 — 이 파일은 「--force 를 만들지 말 것」이라고
     «적어 두는» 파일이라 제 주석에 걸린다(2026-09-13 에 실제로 걸렸다).
     깃발은 argv 를 읽어야 쓸 수 있으므로, «읽는 곳»을 센다. */
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'rules-deploy.js'), 'utf8');
  const 읽는깃발 = [];
  const re = /process\.argv[\s\S]{0,40}?(['"])(--[^'"]+)\1/g;
  let m;
  while ((m = re.exec(src))) 읽는깃발.push(m[2]);
  assert.deepEqual(읽는깃발, ['--deploy'],
    '읽는 깃발이 --deploy 말고 또 있습니다: ' + 읽는깃발.join(', ')
    + '\n  안전장치를 비켜 가는 길을 만들지 말 것 — 막히면 만들개나 승인 파일을 고칩니다.');
});
