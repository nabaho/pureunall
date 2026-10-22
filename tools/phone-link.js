#!/usr/bin/env node
/* 「폰 연결 켜기」 — PC 의 pureunall 폴더에 Remote Control 문을 연다 (대표 지시 2026-10-22 「만들어줘」)
 *
 * ■ 왜 있나
 *   폰·웹의 Claude(클라우드 방)는 대표 PC 에 손이 닿지 않는다. PC 쪽에서 «먼저» 문을 열어야
 *   폰의 Claude 앱이 PC 의 Claude Code 에 일을 시킬 수 있다(예: 에고라이트 설치).
 *   그 문이 `claude remote-control`(서버 모드)이다 — 이것을 «두 번 누르기»로 줄인다.
 *   (멈춘 방 여럿을 되살리는 것은 멈춘방-열기.bat · tools/rc-open.js 다 — 하는 일이 다르다.)
 *
 * ■ 화면 같이 보기 (대표 지시 2026-10-22 「노트북에서 370-6 메일 보낼 때 니가 작업하는 것 화면 같이 보고 싶다」)
 *   `--chrome` 을 붙여 연다 — 폰에서 연 방도 이 PC 의 «보이는» 크롬 창에서 움직인다(Claude in Chrome).
 *   준비가 됐는지는 5번(준비 점검)이 하나씩 잰다. 쓰는 규칙은 CLAUDE.md 「화면 같이 보기」 절.
 *   ★ 「노트북 크롬창에도 팝업 열려야 된다 반드시」(같은 날) — `--front` 가 크롬 창을 맨 앞으로 띄운다
 *     (안 떠 있으면 켜고, 내려가 있으면 올린다). .claude/settings.json 의 PreToolUse 훅이 크롬 도구를 쓰기
 *     «직전마다» 부른다 — AI 가 잊어도 뜬다. 끄려면 환경변수 PUREUN_CHROME_FRONT=0.
 *
 * ■ 쓰기 — 저장소 맨 위의 폰연결-켜기.bat 을 두 번 누른다
 *   1  지금 켜기 (5초 안에 안 고르면 이것)
 *   2  바탕화면에 단추 만들기
 *   3  윈도 켤 때 저절로 켜기 — 켬
 *   4  윈도 켤 때 저절로 켜기 — 끔
 *   5  준비 점검 — 이 PC(노트북)에서 화면 같이 보기·폰 연결이 되는지 하나씩 잰다
 *   node tools/phone-link.js --start        고르지 않고 바로 켠다(바탕화면 단추·시작프로그램이 부른다)
 *   node tools/phone-link.js --check        준비 점검만
 *   node tools/phone-link.js --front        크롬 창을 맨 앞으로(훅이 부른다 — 늘 0 으로 끝나 도구를 막지 않는다)
 *   node tools/phone-link.js --dry --start  아무것도 안 하고 «할 일»만 찍는다(검사가 이 길로 본다)
 *
 * ■ 일부러 그렇게 한 것
 *   · `--spawn same-dir` — 폰에서 연 방이 이 폴더에서 바로 일한다. worktree 로 하면 저장소 «안»에
 *     작업 폴더가 생기는데, pureunall_auto.bat 이 `git add -A` 로 그것까지 main 에 올린다.
 *   · 권한 방식을 건드리지 않는다(--permission-mode 를 안 준다) — 허락이 필요한 일은 폰에 그대로 묻는다.
 *   · `--chrome` 은 옛 판 claude 가 모르는 인자다 — 판을 재서 모자라면 빼고 켜며 그렇다고 말한다.
 *     판을 못 읽으면 붙인다(요즘 판은 다 된다). 크롬이 안 떠 있어도 claude 는 그냥 켜진다(공식 문서).
 *   · 자동 켜기는 «고른 사람만» — 기본(1번)은 지금 한 번 켜기다. 자동으로 켜 두면 PC 가 켜져 있는 동안
 *     늘 문이 열려 있기 때문이다.
 *   · 시작프로그램으로 켜졌는데 망이 아직 안 붙어 곧바로 꺼지면 잠시 뒤 다시 켠다(횟수 한도 있음).
 *     정상 종료(0)는 다시 켜지 않는다 — 사람이 끈 것을 되살리면 안 된다.
 *   · 바로가기는 PowerShell -EncodedCommand 로 만든다 — 한글 이름·경로가 cmd 코드페이지를 거치며 깨지지 않게.
 *   · 점검은 «잴 수 있는 것만» 됨/안됨으로 말한다. 확장의 로그인처럼 밖에서 못 재는 것은 «모름»으로 두고
 *     사람이 볼 자리를 적는다 — 안 잰 것을 됨으로 찍지 않는다.
 *   · 결정은 순수 함수(계획·다시켤까·서버인자·크롬쓸까·확장찾기·바로가기스크립트)로 떼어 둔다 —
 *     CI 는 리눅스라 윈도우 길을 밟을 수 없다(tools/rc-open.js 가 데인 자리). 검사는 이 함수들을 직접 본다.
 */
'use strict';
const fs = require('fs');
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

/* Claude in Chrome — 공식 문서(code.claude.com/docs/en/chrome · remote-control)에서 옮긴 값 */
const 크롬 = {
  최소판: '2.1.273',                              // remote-control 에 --chrome 이 생긴 판
  확장ID: 'fcoeoabgfenejglbffodgkkbkcdhcgfn',      // 크롬 웹 스토어의 «Claude» 확장
  메시지호스트: 'com.anthropic.claude_code_browser_extension',   // claude --chrome 을 처음 켜면 등록된다
  확장주소: 'https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn',
};

/* `claude` 뒤에 붙일 인자 — 서버 모드 한 줄을 여기 하나로 둔다. 뜻.크롬 === false 일 때만 크롬을 뺀다 */
function 서버인자(뜻) {
  const a = ['remote-control', '--name', 세션이름, '--spawn', 'same-dir'];
  if (!뜻 || 뜻.크롬 !== false) a.push('--chrome');
  return a;
}

/* 「2.1.300 (Claude Code)」 같은 글에서 판을 읽는다. 못 읽으면 null */
function 판읽기(글) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(글 || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/* 판이 최소 이상인가 — 둘 중 하나라도 못 읽으면 null(모름) */
function 판넘나(판, 최소) {
  const a = 판읽기(판), b = 판읽기(최소);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
/* --chrome 을 붙일까 — 모자란 것이 «확실할 때만» 뺀다 */
function 크롬쓸까(판글) { return 판넘나(판글, 크롬.최소판) !== false; }

/* 크롬·엣지 «User Data» 폴더들 아래 프로필(Default·Profile N)마다 확장이 깔렸는지 본다 */
function 확장찾기(사용자자료들) {
  for (const ud of 사용자자료들) {
    let 프로필들 = [];
    try { 프로필들 = fs.readdirSync(ud); } catch (e) { continue; }
    for (const p of 프로필들) {
      if (fs.existsSync(path.join(ud, p, 'Extensions', 크롬.확장ID))) return path.join(ud, p);
    }
  }
  return null;
}

/* 무엇을 할지 — 인자만 보고 정한다(창·플랫폼은 안 본다) */
function 계획(argv) {
  const 있나 = function (f) { return argv.indexOf(f) >= 0; };
  const 마른것 = 있나('--dry');
  if (있나('--menu')) return { 무엇: '메뉴', 마른것: 마른것 };
  if (있나('--check')) return { 무엇: '점검', 마른것: 마른것 };
  if (있나('--front')) return { 무엇: '앞으로', 마른것: 마른것 };
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

/* 크롬(없으면 엣지) 창을 맨 앞으로 — 윈도 PowerShell.
   · 이미 맨 앞이면 건드리지 않는다(크롬 일마다 부르니 깜빡이지 않게)
   · 내려가 있으면(최소화) 되살리고, 잠깐 «늘 위»로 올렸다가 바로 푼다 — 윈도는 뒤에서 앞을 빼앗는 것을 막아서
     SetForegroundWindow 하나로는 작업표시줄만 깜빡일 때가 있다. 푸는 것을 빼먹으면 크롬이 영영 맨 위에 박힌다.
   · 안 떠 있으면 켠다 — Claude in Chrome 은 크롬이 떠 있어야 붙는다 */
function 앞으로스크립트() {
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    'Add-Type -TypeDefinition @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class PuWin {',
    '  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int n);',
    '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);',
    '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
    '}',
    '"@',
    "$ps = @(Get-Process chrome, msedge | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object { if ($_.ProcessName -eq 'chrome') { 0 } else { 1 } })",
    "if ($ps.Count -eq 0) { try { Start-Process chrome -ErrorAction Stop } catch { Start-Process msedge }; 'started'; exit }",
    '$fgPid = [uint32]0; [void][PuWin]::GetWindowThreadProcessId([PuWin]::GetForegroundWindow(), [ref]$fgPid)',
    "if ($ps.Id -contains $fgPid) { 'already'; exit }",
    '$h = $ps[0].MainWindowHandle',
    'if ([PuWin]::IsIconic($h)) { [void][PuWin]::ShowWindowAsync($h, 9) }',
    '[void][PuWin]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 3)',
    '[void][PuWin]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 3)',
    '[void][PuWin]::SetForegroundWindow($h)',
    "'raised'",
  ].join('\n');
}

/* 훅이 부른다 — 무슨 일이 있어도 0 으로 끝난다(훅이 실패하면 크롬 일 자체가 막힐 수 있다) */
function 앞으로(마른것) {
  if (process.env.PUREUN_CHROME_FRONT === '0') return 0;
  if (마른것) { console.log('[dry] 크롬 창을 맨 앞으로'); return 0; }
  try {
    if (윈도우) {
      spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', 인코딩(앞으로스크립트())],
        { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    } else if (process.platform === 'darwin') {
      spawnSync('osascript', ['-e', 'tell application "Google Chrome" to activate'], { timeout: 8000 });
    }
  } catch (e) { /* 띄우기는 «덤»이다 — 못 띄워도 크롬 일은 계속한다 */ }
  return 0;
}

function 인코딩(script) { return Buffer.from(script, 'utf16le').toString('base64'); }

function 잠깐(초) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 초 * 1000); }

/* 명령 하나를 돌려 첫 줄을 받는다. shell:true — claude 는 claude.cmd 일 수 있다. 인자는 고정값뿐이다. */
function 돌려보기(cmd, args, 덧) {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', shell: true, timeout: 30000 }, 덧 || {}));
  const out = String(r.stdout || '').trim().split(/\r?\n/)[0] || '';
  return { ok: r.status === 0, out: out };
}

function claude판() {
  const r = 돌려보기('claude', ['--version']);
  return r.ok ? r.out : null;
}

function 메뉴() {
  console.log('');
  console.log('==============================================');
  console.log('   폰 연결 켜기 — 폰의 Claude 앱으로 이 PC 에 일 시키기');
  console.log('==============================================');
  console.log('   1  지금 켜기            (5초 안에 안 고르면 이것)');
  console.log('   2  바탕화면에 단추 만들기');
  console.log('   3  윈도 켤 때 저절로 켜기 — 켬');
  console.log('   4  윈도 켤 때 저절로 켜기 — 끔');
  console.log('   5  준비 점검            (화면 같이 보기·폰 연결이 되는지 하나씩)');
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

/* ── 준비 점검 — 잰 것만 됨/안됨, 못 잰 것은 모름 ── */
function 점검하기(마른것) {
  if (마른것) { console.log('[dry] 준비 점검 — node·git·claude 판·저장소 최신·크롬·확장·메시지 호스트·자동 켜기'); return 0; }
  const 줄 = [];
  const 적기 = function (이름, 됨, 덧, 고칠) { 줄.push({ 이름: 이름, 됨: 됨, 덧: 덧 || '', 고칠: 고칠 || '' }); };

  적기('Node.js', true, process.version);

  const git = 돌려보기('git', ['--version']);
  적기('Git', git.ok, git.out, 'https://git-scm.com 에서 설치');

  const 판 = claude판();
  if (!판) {
    적기('Claude Code', false, '', 'https://claude.com/claude-code 에서 설치한 뒤, 명령창에서 claude → /login');
  } else {
    const 넘 = 판넘나(판, 크롬.최소판);
    적기('Claude Code 판', 넘, 판, '명령창에서 claude update (화면 같이 보기는 ' + 크롬.최소판 + ' 이상)');
  }

  if (git.ok) {
    /* 비공개 저장소라 로그인 창이 뜰 수 있다 — 묻지 않게 막고, 못 읽으면 «모름» */
    const 받기 = 돌려보기('git', ['-C', '"' + ROOT + '"', 'fetch', '--quiet', 'origin', 'main'],
      { env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
    if (!받기.ok) {
      적기('pureunall 최신', null, '원격을 못 읽음', '인터넷·GitHub 로그인을 보고 git pull');
    } else {
      const 뒤 = 돌려보기('git', ['-C', '"' + ROOT + '"', 'rev-list', '--count', 'HEAD..origin/main']);
      const n = Number(뒤.out);
      적기('pureunall 최신', 뒤.ok ? n === 0 : null, 뒤.ok ? (n === 0 ? '최신' : n + '개 뒤처짐') : '', '이 폴더에서 git pull');
    }
  }

  if (!윈도우) {
    적기('크롬·확장 점검', null, '윈도가 아니라 건너뜀', '크롬에 «Claude» 확장을 깔고 claude --chrome 으로 한 번 켜기');
  } else {
    const L = process.env.LOCALAPPDATA || '';
    const PF = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], L].filter(Boolean);
    const 크롬실행 = PF.map(function (p) { return path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe'); })
      .concat(PF.map(function (p) { return path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe'); }))
      .filter(function (p) { return fs.existsSync(p); });
    적기('크롬(또는 엣지)', 크롬실행.length > 0, 크롬실행[0] || '', 'https://www.google.com/chrome 에서 설치');

    const 프로필 = 확장찾기([
      path.join(L, 'Google', 'Chrome', 'User Data'),
      path.join(L, 'Microsoft', 'Edge', 'User Data'),
    ]);
    적기('Claude in Chrome 확장', !!프로필, 프로필 ? path.basename(프로필) + ' 프로필' : '', 크롬.확장주소 + ' 에서 «Chrome에 추가»');

    const 호스트 = ['Google\\Chrome', 'Microsoft\\Edge'].some(function (b) {
      return spawnSync('reg', ['query', 'HKCU\\Software\\' + b + '\\NativeMessagingHosts\\' + 크롬.메시지호스트],
        { encoding: 'utf8' }).status === 0;
    });
    적기('Claude Code ↔ 크롬 연결', 호스트, '', '명령창에서 claude --chrome 을 한 번 켠 뒤 크롬을 껐다 켜기');

    const 시작 = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 바로가기.시작);
    적기('윈도 켤 때 폰 연결(선택)', null, fs.existsSync(시작) ? '켜져 있음' : '꺼져 있음', '쓰려면 3번');
  }
  적기('확장 로그인', null, '밖에서는 못 잼',
    '크롬 오른쪽 위 퍼즐 → Claude → 대표님 claude.ai 계정·같은 조직으로 로그인(/status 의 Organization 과 같아야 함)');

  console.log('');
  console.log('==============================================');
  console.log('   준비 점검 — 화면 같이 보기 · 폰 연결');
  console.log('==============================================');
  let 안됨 = 0;
  줄.forEach(function (r) {
    const 표 = r.됨 === true ? '[됨]  ' : r.됨 === false ? '[안됨]' : '[모름]';
    if (r.됨 === false) 안됨 += 1;
    console.log(표 + ' ' + r.이름 + (r.덧 ? '  — ' + r.덧 : ''));
    if (r.됨 !== true && r.고칠) console.log('        → ' + r.고칠);
  });
  console.log('');
  console.log(안됨 === 0
    ? '안 된 것이 없습니다. [모름] 줄만 눈으로 확인하시면 화면 같이 보기 준비가 끝났습니다.'
    : '안 된 것 ' + 안됨 + '개 — 위의 → 를 하고 이 점검(5번)을 다시 돌리십시오.');
  return 안됨 === 0 ? 0 : 1;
}

function 켜기(자동, 마른것) {
  const 판 = 마른것 ? null : claude판();
  const 크롬붙임 = 크롬쓸까(판);
  const 인자 = 서버인자({ 크롬: 크롬붙임 });
  console.log('폴더 : ' + ROOT);
  if (마른것) { console.log('[dry] claude ' + 인자.join(' ')); return 0; }

  if (!판) {
    const 찾기 = spawnSync(윈도우 ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
    if (찾기.status !== 0) {
      console.log('이 PC 에서 claude 명령을 못 찾았습니다. Claude Code 를 먼저 설치하십시오: https://claude.com/claude-code');
      return 1;
    }
  }
  console.log('');
  console.log('폰 연결을 켭니다. 이 창을 닫으면 연결도 꺼집니다(최소화는 괜찮습니다).');
  console.log('폰의 Claude 앱 → Code 에 「' + 세션이름 + '」 이 뜹니다. 스페이스바를 누르면 QR 이 나옵니다.');
  console.log('처음 한 번은 「Remote Control 쓸까요?」「이 폴더를 믿을까요?」에 y 로 답하십시오.');
  if (크롬붙임) {
    console.log('크롬 연결을 함께 켭니다 — 폰에서 시킨 브라우저 일은 이 PC 의 크롬 창에서 보이게 움직입니다.');
    앞으로(false);   // 크롬이 떠 있어야 확장이 붙는다 — 켜 두고 앞으로
  } else {
    console.log('⚠ claude 판(' + 판 + ')이 낮아 크롬 연결 없이 켭니다. 화면 같이 보기를 쓰려면 claude update 뒤 다시 켜십시오.');
  }
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
  console.log('  · 무엇이 빠졌는지 모르겠으면 → 이 파일을 다시 열어 5번(준비 점검)');
  return 1;
}

function main() {
  const 할일 = 계획(process.argv.slice(2));
  let 코드 = 0;
  if (할일.무엇 === '메뉴') 메뉴();
  else if (할일.무엇 === '점검') 코드 = 점검하기(할일.마른것);
  else if (할일.무엇 === '앞으로') 코드 = 앞으로(할일.마른것);
  else if (할일.무엇 === '켜기') 코드 = 켜기(할일.자동, 할일.마른것);
  else 코드 = 바로가기하기(할일.무엇, 할일.마른것);
  process.exitCode = 코드;
}

if (require.main === module) main();

module.exports = { 계획, 다시켤까, 서버인자, 판넘나, 크롬쓸까, 확장찾기, 바로가기스크립트, 앞으로스크립트, 바로가기, 다시켜기, 크롬 };
