/* tools/phone-link.js · 폰연결-켜기.bat — 「두 번 누르면 폰의 Claude 앱이 이 PC 에 닿는다」 (대표 지시 2026-10-22)
 *
 * ⚠ CLAUDE.md 규칙: «지금 값»을 박지 않는다. 다시 켜는 횟수·기다리는 초·화면 문장은 글자로 안 박는다.
 *
 * ■ 무엇을 못 박나 — 규칙
 *   ① 문은 «서버 모드» 하나로, 이 폴더에서(same-dir) 연다 — worktree 면 pureunall_auto.bat 이 작업 폴더까지 main 에 올린다
 *   ② 권한을 건너뛰는 인자를 넣지 않는다 — 허락이 필요한 일은 폰에 그대로 묻는다
 *   ③ 자동 켜기는 «고른 사람만» — 5초 뒤 저절로 고르는 것은 «지금 한 번 켜기»다
 *   ④ 다시 켜기는 시작프로그램이 켠 것이 오류로 꺼졌을 때만, 한도 안에서만 — 사람이 끈 것은 안 되살린다
 *   ⑤ 시작프로그램 켬·끔은 같은 바로가기를 가리킨다 — 어긋나면 «끔»을 눌러도 아침마다 켜진다
 *   ⑥ .bat 는 ASCII, 한글은 node 가 chcp 65001 뒤에 찍는다(멈춘방-열기.bat 과 같은 까닭)
 *   ⑦ 화면 같이 보기 — 크롬을 붙여 열되, 옛 판 claude 가 확실할 때만 뺀다(모르는 인자로 문이 안 열리지 않게)
 *   ⑧ 준비 점검은 크롬·엣지의 «어느 프로필»에 깔린 확장도 찾는다 — Default 만 보면 Profile 1 에 깐 사람이 «안됨»을 받는다
 *   ⑨ 크롬 창 띄우기(--front)는 내려간 창을 되살리고, 잠깐 «늘 위»로 올렸으면 «반드시 푼다» — 안 풀면 크롬이 영영 맨 위에 박힌다.
 *      그리고 무슨 일이 있어도 0 으로 끝난다 — 훅이 실패하면 크롬 일이 막힐 수 있다
 *   ⑩ .claude/settings.json 훅이 «크롬 도구에만» 걸려 --front 를 부르고, 뒤에서 돈다(크롬 일을 늦추지 않는다)
 * ★ 결정은 순수 함수로 떼어 두었다 — CI 는 리눅스라 윈도우 길(where·powershell·창)을 밟을 수 없다.
 * 실행: node --test tests/phone-link.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'phone-link.js');
const BATP = path.join(ROOT, '폰연결-켜기.bat');
const P = require(TOOL);
const batRaw = fs.readFileSync(BATP);
/* .bat 의 주석(rem)은 걷어 낸 뒤 본다 — 설명에 적힌 글자로 통과하지 않게(rc-open.test.js ㉠) */
const bat = batRaw.toString('utf8').split(/\r?\n/).filter((l) => !/^\s*rem\b/i.test(l)).join('\n');

test('① 서버 모드로, 이 폴더에서 연다', () => {
  const a = P.서버인자();
  assert.equal(a[0], 'remote-control', '★ claude remote-control(서버 모드)이 아닙니다');
  const i = a.indexOf('--spawn');
  assert.ok(i > 0, '★ --spawn 이 없으면 처음 켤 때 묻고, 답에 따라 worktree 가 될 수 있습니다');
  assert.equal(a[i + 1], 'same-dir',
    '★ worktree 로 열면 저장소 안 작업 폴더를 pureunall_auto.bat 의 git add -A 가 main 에 올립니다');
  /* shell:true 는 인자를 따옴표 없이 잇는다 — 띄어쓰기가 든 인자는 둘로 쪼개진다 */
  for (const x of a) assert.doesNotMatch(x, /\s/, '★ 띄어쓰기가 든 인자: ' + x);
});

test('② 권한을 건너뛰는 인자를 넣지 않는다', () => {
  const a = P.서버인자().join(' ');
  assert.doesNotMatch(a, /permission-mode|bypass|dangerously|skip-permissions/i,
    '★ 폰에서 허락을 묻지 않고 PC 에서 아무 일이나 하게 됩니다');
});

test('③ 5초 뒤 저절로 고르는 것은 «지금 켜기» — 자동 켜기가 아니다', () => {
  const d = /choice\b[^\n]*\/d\s+(\d)/i.exec(bat);
  assert.ok(d, 'choice 의 기본값을 못 찾았습니다');
  /* if errorlevel N goto 이름 → 이름 아래의 node 줄이 하는 일 */
  const 갈래 = {};
  for (const m of bat.matchAll(/if\s+errorlevel\s+(\d)\s+goto\s+(\w+)/gi)) 갈래[m[1]] = m[2];
  /* errorlevel 은 «N 이상» — 기본 숫자 이하에서 가장 큰 갈래가 잡는다. 없으면 그 아래 :start 로 흘러간다 */
  const 잡는것 = Object.keys(갈래).map(Number).filter((n) => n <= Number(d[1])).sort((x, y) => y - x)[0];
  const 표 = 잡는것 ? 갈래[잡는것] : 'start';
  const 몸 = new RegExp(':' + 표 + '\\s*\\n\\s*node\\s+tools\\\\phone-link\\.js\\s+(--[\\w-]+)', 'i').exec(bat);
  assert.ok(몸, '기본 갈래(:' + 표 + ')의 node 줄을 못 찾았습니다');
  assert.equal(몸[1], '--start', '★ 아무것도 안 고르면 ' + 몸[1] + ' 를 합니다 — 기본은 «지금 한 번 켜기»여야 합니다');
  assert.equal(P.계획([]).무엇, '메뉴', '인자 없이 부르면 고르는 화면이어야 합니다');
});

test('④ 다시 켜기는 «저절로 켠 것 · 오류 · 한도 안»일 때만', () => {
  assert.equal(P.다시켤까(1, 0, true), true, '시작프로그램이 켰는데 망이 늦어 꺼지면 다시 켜야 합니다');
  assert.equal(P.다시켤까(0, 0, true), false, '★ 정상 종료(사람이 끈 것)를 되살립니다');
  assert.equal(P.다시켤까(1, 0, false), false, '★ 사람이 바탕 단추로 켠 것까지 몰래 되살립니다 — 오류를 보여야 합니다');
  assert.equal(P.다시켤까(1, 1e6, true), false, '★ 한도 없이 되살립니다 — 로그인이 풀리면 창이 끝없이 돕니다');
  /* 시작프로그램 바로가기만 --auto 를 단다 */
  assert.match(P.바로가기스크립트('자동켬'), /--auto/, '★ 시작프로그램이 켠 것을 «저절로»로 알리지 않습니다');
  assert.doesNotMatch(P.바로가기스크립트('바탕단추'), /--auto/, '★ 바탕 단추가 «저절로»로 켭니다');
  assert.equal(P.계획(['--start', '--auto']).자동, true);
  assert.equal(P.계획(['--start']).자동, false);
});

test('⑤ 시작프로그램 켬·끔은 같은 바로가기를 가리킨다', () => {
  const 켬 = P.바로가기스크립트('자동켬');
  const 끔 = P.바로가기스크립트('자동끔');
  const 이름 = (s) => /GetFolderPath\('(\w+)'\)\)\s+'([^']+)'/.exec(s);
  assert.ok(이름(켬) && 이름(끔), '바로가기 자리를 못 읽었습니다');
  assert.equal(이름(켬)[1], 'Startup', '★ 자동 켜기가 시작프로그램 폴더가 아닙니다');
  assert.deepEqual(이름(끔).slice(1), 이름(켬).slice(1), '★ «끔»이 다른 바로가기를 지웁니다 — 아침마다 계속 켜집니다');
  assert.match(끔, /Remove-Item/);
  assert.doesNotMatch(끔, /CreateShortcut/, '★ «끔»이 바로가기를 만듭니다');
  for (const 종류 of ['자동켬', '바탕단추']) {
    assert.match(P.바로가기스크립트(종류), /Arguments = '--start/, '★ ' + 종류 + ' 바로가기가 고르는 화면에서 멈춥니다(--start 없음)');
  }
  /* 경로에 작은따옴표가 있어도 PowerShell 글이 안 깨진다 */
  const s = P.바로가기스크립트('자동켬', { bat: "/x/a'b/x.bat", root: "/x/a'b" });
  assert.match(s, /'\/x\/a''b\/x\.bat'/, '★ 작은따옴표가 든 경로가 PowerShell 글을 끊습니다');
});

test('⑥ .bat 는 ASCII, 한글은 node 가 UTF-8 로 찍는다', () => {
  assert.ok(batRaw.every((b) => b < 0x80), '★ .bat 에 ASCII 밖 글자가 있습니다 — cmd 코드페이지에서 깨집니다');
  assert.match(bat, /^\s*chcp 65001/m, '★ chcp 65001 이 없으면 node 가 찍는 한글이 깨집니다');
  assert.match(bat, /^\s*cd \/d "%~dp0"/m, '★ 제 폴더로 안 들어가면 엉뚱한 폴더에 문을 엽니다');
  assert.match(bat, /if \/i "%~1"=="--start" goto start/i, '★ 바로가기(--start)가 고르는 화면에서 멈춥니다');
});

test('--dry 는 아무것도 안 하고 «할 일»만 찍는다', () => {
  const out = execFileSync(process.execPath, [TOOL, '--dry', '--start'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.match(out, /\[dry\] claude remote-control/, '켤 명령을 안 찍습니다');
});

test('⑦ 화면 같이 보기 — 크롬을 붙이되, 옛 판이 «확실할 때만» 뺀다', () => {
  assert.ok(P.서버인자().includes('--chrome'), '★ 폰에서 연 방이 이 PC 의 크롬을 못 씁니다 — 화면 같이 보기가 안 됩니다');
  assert.ok(!P.서버인자({ 크롬: false }).includes('--chrome'), '★ 옛 판인데도 --chrome 을 붙여 문이 안 열립니다');
  assert.equal(P.크롬쓸까('0.0.1 (Claude Code)'), false, '★ 옛 판에 --chrome 을 붙입니다');
  assert.equal(P.크롬쓸까('999.0.0 (Claude Code)'), true);
  assert.equal(P.크롬쓸까(P.크롬.최소판), true, '최소판 그 자체는 됩니다');
  assert.equal(P.크롬쓸까(null), true, '판을 못 읽으면 붙입니다 — 요즘 판은 다 됩니다');
  /* 판은 «수»로 견준다 — 글자로 견주면 2.1.10 이 2.1.9 보다 작다고 나온다 */
  assert.equal(P.판넘나('2.1.10', '2.1.9'), true, '★ 판을 글자로 견줍니다');
  assert.equal(P.판넘나('2.0.99', '2.1.0'), false);
  assert.equal(P.판넘나('abc', '2.1.0'), null, '못 읽은 판을 됨/안됨으로 찍습니다 — «모름»이어야 합니다');
});

test('⑧ 준비 점검은 어느 프로필에 깐 확장이든 찾는다', () => {
  const os = require('node:os');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'phonelink-'));
  const 크롬 = path.join(base, 'Chrome', 'User Data');
  const 엣지 = path.join(base, 'Edge', 'User Data');
  fs.mkdirSync(path.join(크롬, 'Default', 'Extensions', 'someother'), { recursive: true });
  fs.mkdirSync(path.join(엣지, 'Profile 2', 'Extensions', P.크롬.확장ID), { recursive: true });
  try {
    assert.equal(P.확장찾기([크롬]), null, '★ 다른 확장만 있는데 «됨»이라 합니다');
    assert.equal(P.확장찾기([path.join(base, '없는곳'), 크롬, 엣지]), path.join(엣지, 'Profile 2'),
      '★ Default 가 아닌 프로필·엣지에 깐 확장을 못 찾습니다');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('메뉴의 모든 갈래에 갈 자리가 있다', () => {
  const 번호 = /choice\s+\/c\s+(\d+)/i.exec(bat);
  assert.ok(번호, 'choice 를 못 찾았습니다');
  const 갈곳 = [...bat.matchAll(/goto\s+(\w+)/gi)].map((m) => m[1].toLowerCase());
  for (const g of new Set(갈곳)) {
    assert.match(bat, new RegExp('^:' + g + '\\b', 'im'), '★ :' + g + ' 자리가 없습니다 — 그 번호를 누르면 끝으로 새어 나갑니다');
  }
  /* errorlevel 갈래 수 = 고를 수 있는 번호 수 - 1 (1번은 아래로 흘러 :start) */
  const 갈래 = [...bat.matchAll(/if\s+errorlevel\s+\d\s+goto/gi)].length;
  assert.equal(갈래, 번호[1].length - 1, '★ 고를 수 있는 번호와 갈래 수가 어긋납니다 — 어떤 번호는 엉뚱한 일을 합니다');
  assert.match(bat, /:check\s*\n\s*node\s+tools\\phone-link\.js\s+--check/i, '★ 준비 점검 번호가 점검을 안 부릅니다');
});

test('⑨ 크롬 창 띄우기 — 되살리고, 올렸으면 풀고, 늘 0 으로 끝난다', () => {
  const ps = P.앞으로스크립트();
  assert.match(ps, /IsIconic\(\$h\)\)\s*\{\s*\[void\]\[PuWin\]::ShowWindowAsync\(\$h,\s*9\)/, '★ 최소화된 크롬을 되살리지 않습니다');
  const 올림 = ps.indexOf('[IntPtr](-1)');
  const 풂 = ps.indexOf('[IntPtr](-2)');
  assert.ok(올림 > 0, '맨 위로 올리는 자리가 없습니다');
  assert.ok(풂 > 올림, '★ 크롬을 «늘 위»로 올리고 풀지 않습니다 — 다른 창이 영영 크롬 밑에 깔립니다');
  assert.match(ps, /'already'/, '★ 이미 맨 앞인 크롬을 또 건드립니다 — 크롬 일마다 깜빡입니다');
  assert.match(ps, /Start-Process chrome/, '★ 크롬이 안 떠 있으면 켜지 않습니다 — Claude in Chrome 이 붙을 곳이 없습니다');
  assert.equal(P.계획(['--front']).무엇, '앞으로');
  for (const env of [{}, { PUREUN_CHROME_FRONT: '0' }]) {
    const r = require('node:child_process').spawnSync(process.execPath, [TOOL, '--front'],
      { encoding: 'utf8', env: Object.assign({}, process.env, env) });
    assert.equal(r.status, 0, '★ --front 가 0 이 아닌 값으로 끝납니다 — 훅이 크롬 일을 막을 수 있습니다');
  }
});

test('⑩ 훅은 크롬 도구에만 걸려 --front 를 부르고, 뒤에서 돈다', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 걸이 = ((cfg.hooks || {}).PreToolUse || []).filter((h) => (h.hooks || []).some((x) => /phone-link\.js["']?\s+--front/.test(x.command || '')));
  assert.ok(걸이.length >= 1, '★ 크롬 도구를 쓰기 전에 크롬 창을 띄우는 훅이 없습니다 — AI 가 잊으면 안 뜹니다');
  for (const h of 걸이) {
    const re = new RegExp('^(?:' + h.matcher + ')$');
    assert.ok(re.test('mcp__claude-in-chrome__navigate') && re.test('mcp__claude-in-chrome__computer'),
      '★ 훅이 Claude in Chrome 도구에 안 걸립니다');
    for (const 남 of ['Bash', 'Edit', 'mcp__github__create_pull_request']) {
      assert.ok(!re.test(남), '★ 훅이 크롬과 상관없는 ' + 남 + ' 에도 걸립니다 — 일마다 크롬이 튀어나옵니다');
    }
    for (const x of h.hooks) {
      assert.notEqual(x.onFailure, 'block', '★ 띄우기가 실패하면 크롬 일까지 막습니다');
      assert.equal(x.async, true, '★ 훅이 앞에서 돌아 크롬 일 하나하나를 늦춥니다');
    }
  }
});
