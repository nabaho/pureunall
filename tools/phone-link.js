#!/usr/bin/env node
/* 「폰 연결 켜기」 — PC 의 pureunall 폴더에 Remote Control 문을 연다 (대표 지시 2026-10-22 「만들어줘」)
 *
 * ■ 왜 있나
 *   폰·웹의 Claude(클라우드 방)는 대표 PC 에 손이 닿지 않는다. PC 쪽에서 «먼저» 문을 열어야
 *   폰의 Claude 앱이 PC 의 Claude Code 에 일을 시킬 수 있다(예: 에고라이트 설치).
 *   그 문이 `claude remote-control`(서버 모드)이다 — 이것을 «두 번 누르기»로 줄인다.
 *   (멈춘 방 여럿을 되살리는 것은 멈춘방-열기.bat · tools/rc-open.js 다 — 하는 일이 다르다.)
 *
 * ■ 쓰기 — 저장소 맨 위의 폰연결-켜기.bat 을 두 번 누른다
 *   1  지금 켜기 (5초 안에 안 고르면 이것)
 *   2  바탕화면에 단추 만들기
 *   3  윈도 켤 때 저절로 켜기 — 켬
 *   4  윈도 켤 때 저절로 켜기 — 끔
 *   node tools/phone-link.js --start        고르지 않고 바로 켠다(바탕화면 단추·시작프로그램이 부른다)
 *   node tools/phone-link.js --dry --start  아무것도 안 하고 «할 일»만 찍는다(검사가 이 길로 본다)
 *
 * ■ 일부러 그렇게 한 것
 *   · `--spawn same-dir` — 폰에서 연 방이 이 폴더에서 바로 일한다. worktree 로 하면 저장소 «안»에
 *     작업 폴더가 생기는데, pureunall_auto.bat 이 `git add -A` 로 그것까지 main 에 올린다.
 *   · 권한 방식을 건드리지 않는다(--permission-mode 를 안 준다) — 허락이 필요한 일은 폰에 그대로 묻는다.
 *   · 자동 켜기는 «고른 사람만» — 기본(1번)은 지금 한 번 켜기다. 자동으로 켜 두면 PC 가 켜져 있는 동안
 *     늘 문이 열려 있기 때문이다.
 *   · 시작프로그램으로 켜졌는데 망이 아직 안 붙어 곧바로 꺼지면 잠시 뒤 다시 켠다(횟수 한도 있음).
 *     정상 종료(0)는 다시 켜지 않는다 — 사람이 끈 것을 되살리면 안 된다.
 *   · 바로가기는 PowerShell -EncodedCommand 로 만든다 — 한글 이름·경로가 cmd 코드페이지를 거치며 깨지지 않게.
 *   · 결정은 순수 함수(계획·다시켤까·서버인자·바로가기스크립트)로 떼어 둔다 — CI 는 리눅스라
 *     윈도우 길을 밟을 수 없다(tools/rc-open.js 가 데인 자리). 검사는 이 함수들을 직접 본다.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BAT = path.join(ROOT, '폰연결-켜기.bat');
const 윈도우 = process.platform === 'win32';

/* 폰의 세션 목록에 보일 이름. 띄어쓰기·한글을 넣지 않는다 —
   shell:true 는 인자를 따옴표 없이 이어 붙이고, 한글은 코드페이지를 탄다. */
const 세션이름 = 'pureunall-PC';
const 바로가기 = {
  시작: 'pureunall-phone-link.lnk',   // 시작프로그램 폴더 — 켬·끔이 «같은 이름»을 써야 끔이 먹는다
  바탕: '푸른 폰연결.lnk',
};
const 다시켜기 = { 한도: 5, 기다림초: 30 };

/* `claude` 뒤에 붙일 인자 — 서버 모드 한 줄을 여기 하나로 둔다 */
function 서버인자() {
  return ['remote-control', '--name', 세션이름, '--spawn', 'same-dir'];
}

/* 무엇을 할지 — 인자만 보고 정한다(창·플랫폼은 안 본다) */
function 계획(argv) {
  const 있나 = function (f) { return argv.indexOf(f) >= 0; };
  const 마른것 = 있나('--dry');
  if (있나('--menu')) return { 무엇: '메뉴', 마른것: 마른것 };
  if (있나('--desktop')) return { 무엇: '바탕단추', 마른것: 마른것 };
  if (있나('--startup-on')) return { 무엇: '자동켬', 마른것: 마른것 };
  if (있나('--startup-off')) return { 무엇: '자동끔', 마른것: 마른것 };
  if (있나('--start')) return { 무엇: '켜기', 마른것: 마른것, 자동: 있나('--auto') };
  return { 무엇: '메뉴', 마른것: 마른것 };
}

/* 꺼진 뒤 다시 켤까 — 시작프로그램이 켠 것(자동)만, 오류로 꺼졌을 때만, 한도 안에서만 */
function 다시켤까(종료코드, 횟수, 자동) {
  if (!자동) return false;
  if (종료코드 === 0) return false;
  return 횟수 < 다시켜기.한도;
}

/* PowerShell 작은따옴표 글자 */
function ps글(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

/* 바로가기를 만들거나 지우는 PowerShell — 종류: 바탕단추 · 자동켬 · 자동끔 */
function 바로가기스크립트(종류, 자리) {
  const bat = (자리 && 자리.bat) || BAT;
  const root = (자리 && 자리.root) || ROOT;
  const 폴더 = 종류 === '바탕단추' ? 'Desktop' : 'Startup';
  const 이름 = 종류 === '바탕단추' ? 바로가기.바탕 : 바로가기.시작;
  const 자리식 = '$p = Join-Path ([Environment]::GetFolderPath(' + ps글(폴더) + ')) ' + ps글(이름);
  if (종류 === '자동끔') {
    return 자리식 + '; if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p; "removed" } else { "none" }';
  }
  /* 바탕 단추는 사람이 누른 것, 시작프로그램은 저절로 켠 것 — 저절로 켠 것만 다시 켜기를 한다 */
  const 인자 = 종류 === '자동켬' ? '--start --auto' : '--start';
  return 자리식 +
    '; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($p)' +
    '; $s.TargetPath = ' + ps글(bat) +
    '; $s.Arguments = ' + ps글(인자) +
    '; $s.WorkingDirectory = ' + ps글(root) +
    '; $s.Save(); "saved"';
}

function 인코딩(script) { return Buffer.from(script, 'utf16le').toString('base64'); }

function 잠깐(초) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 초 * 1000); }

function 메뉴() {
  console.log('');
  console.log('==============================================');
  console.log('   폰 연결 켜기 — 폰의 Claude 앱으로 이 PC 에 일 시키기');
  console.log('==============================================');
  console.log('   1  지금 켜기            (5초 안에 안 고르면 이것)');
  console.log('   2  바탕화면에 단추 만들기');
  console.log('   3  윈도 켤 때 저절로 켜기 — 켬');
  console.log('   4  윈도 켤 때 저절로 켜기 — 끔');
  console.log('==============================================');
  console.log('번호를 누르십시오:');
}

function 바로가기하기(종류, 마른것) {
  const script = 바로가기스크립트(종류);
  if (마른것) { console.log('[dry] powershell -NoProfile -EncodedCommand <' + script + '>'); return 0; }
  if (!윈도우) { console.log('바로가기는 윈도에서만 만듭니다.'); return 1; }
  const r = spawnSync('powershell', ['-NoProfile', '-EncodedCommand', 인코딩(script)], { encoding: 'utf8' });
  const 결과 = String(r.stdout || '').trim();
  if (r.status !== 0) { console.log('바로가기를 못 만들었습니다: ' + String(r.stderr || '').trim()); return 1; }
  if (종류 === '바탕단추') {
    console.log('바탕화면에 「' + 바로가기.바탕.replace(/\.lnk$/, '') + '」 단추를 만들었습니다. 그것을 두 번 누르면 켜집니다.');
  } else if (종류 === '자동켬') {
    console.log('윈도를 켤 때마다 폰 연결이 저절로 켜집니다.');
    console.log('');
    console.log('⚠ 아직 한 번도 켜 보지 않았다면 먼저 1번(지금 켜기)으로 켜서, 처음 묻는 것에 y 로 답해 두십시오');
    console.log('  (Remote Control 쓸까요? · 이 폴더를 믿을까요?). 답해 두지 않으면 아침에 그 질문에서 멈춥니다.');
    console.log('⚠ PC 가 켜져 있는 동안 늘 폰에서 이 PC 의 Claude 에 일을 시킬 수 있습니다.');
    console.log('  들어올 수 있는 것은 대표님 claude.ai 계정으로 로그인한 기기뿐입니다. 더 단단히 하려면');
    console.log('  claude.ai → 설정 → 계정 → 「신뢰할 수 있는 기기 요구(Require trusted devices)」를 켜십시오.');
    console.log('  끄려면 이 파일을 다시 열어 4번.');
  } else {
    console.log(결과 === 'removed' ? '자동 켜기를 껐습니다.' : '자동 켜기가 원래 꺼져 있었습니다.');
  }
  return 0;
}

function 켜기(자동, 마른것) {
  const 인자 = 서버인자();
  console.log('폴더 : ' + ROOT);
  if (마른것) { console.log('[dry] claude ' + 인자.join(' ')); return 0; }

  const 찾기 = spawnSync(윈도우 ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (찾기.status !== 0) {
    console.log('이 PC 에서 claude 명령을 못 찾았습니다. Claude Code 를 먼저 설치하십시오: https://claude.com/claude-code');
    return 1;
  }
  console.log('');
  console.log('폰 연결을 켭니다. 이 창을 닫으면 연결도 꺼집니다(최소화는 괜찮습니다).');
  console.log('폰의 Claude 앱 → Code 에 「' + 세션이름 + '」 이 뜹니다. 스페이스바를 누르면 QR 이 나옵니다.');
  console.log('처음 한 번은 「Remote Control 쓸까요?」「이 폴더를 믿을까요?」에 y 로 답하십시오.');
  console.log('');

  let 횟수 = 0;
  for (;;) {
    /* shell:true — npm 으로 깐 claude 는 claude.cmd 라 셸 없이는 못 부른다. 인자는 위의 고정값뿐이다. */
    const r = spawnSync('claude', 인자, { cwd: ROOT, stdio: 'inherit', shell: true });
    const 코드 = r.status === null ? 1 : r.status;
    if (코드 === 0) return 0;
    if (!다시켤까(코드, 횟수, 자동)) break;
    횟수 += 1;
    console.log('');
    console.log('연결이 꺼졌습니다(코드 ' + 코드 + '). ' + 다시켜기.기다림초 + '초 뒤 다시 켭니다 — ' + 횟수 + '/' + 다시켜기.한도);
    잠깐(다시켜기.기다림초);
  }
  console.log('');
  console.log('폰 연결이 켜지지 않았습니다. 위에 찍힌 글을 보십시오. 흔한 까닭:');
  console.log('  · 로그인이 안 됨 → 명령창에서 claude 를 켜고 /login');
  console.log('  · 「disabled by your organization\'s policy」 → claude.ai 관리자 설정 → Claude Code 에서 Remote Control 켜기');
  console.log('  · 인터넷이 아직 안 붙음 → 붙은 뒤 바탕화면 단추를 다시 누르기');
  return 1;
}

function main() {
  const 할일 = 계획(process.argv.slice(2));
  let 코드 = 0;
  if (할일.무엇 === '메뉴') 메뉴();
  else if (할일.무엇 === '켜기') 코드 = 켜기(할일.자동, 할일.마른것);
  else 코드 = 바로가기하기(할일.무엇, 할일.마른것);
  process.exitCode = 코드;
}

if (require.main === module) main();

module.exports = { 계획, 다시켤까, 서버인자, 바로가기스크립트, 바로가기, 다시켜기 };
