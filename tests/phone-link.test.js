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
