'use strict';
/* 「제발 한번에 할 수 있게 니가 만들어라」 (대표 지시 2026-09-18)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     대표님이 명령 프롬프트를 여시고 `git pull` 을 치셨다. 돌아온 것은 —
        fatal: not a git repository (or any of the parent directories): .git
     `C:\Users\fair0` 에 계셨기 때문이다. 이알피 폴더가 어디인지는 아무도 안 알려 줬다.
     내가 「git pull 하고 node … 하세요」라고만 적었다. **사람에게 폴더를 찾게 한 것이다.**
   ■ 그래서
     ① 두 번 누르면 되는 것(.bat) — 자기가 어디 있는지 스스로 안다(%~dp0)
     ② 폴더를 모를 때 «찾아서» 하는 것(.ps1) — 처음 한 번을 위한 것

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① .bat 은 «자기 자리»에서 폴더를 잡는다 — 사람에게 찾게 하지 않는다
     ② 실패하면 창을 세운다(pause) — 안 세우면 메시지가 번쩍하고 사라진다
     ③ 두 길이 «같은 것»을 부른다 — 어긋나면 한쪽만 고쳐진다
     ④ 찾기는 «이알피 폴더인지»까지 본다 — pu-erp.html 한 장만 보고 엉뚱한 데로 가지 않는다
     ⑤ 배포본에 안 나간다 — 개발용이다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BAT = fs.readFileSync(path.join(ROOT, 'scripts', '나스-올리기.bat'), 'utf8');
const PS1 = fs.readFileSync(path.join(ROOT, 'scripts', '나스-올리기-찾아서.ps1'), 'utf8');

test('①★★ .bat 은 «자기 자리»에서 폴더를 잡는다 — 사람에게 찾게 하지 않는다', () => {
  assert.match(BAT, /cd \/d "%~dp0\.\."/,
    '★★ 이것이 없으면 어디서 두 번 눌렀느냐에 따라 「not a git repository」가 난다.\n' +
    '  2026-09-18 대표님이 C:\\Users\\fair0 에서 보신 그 메시지다.');
  assert.match(BAT, /echo 폴더: %CD%/, '★ 어느 폴더에서 도는지 안 보이면 잘못돼도 모른다');
});

test('②★★ 실패하면 창을 세운다 — 안 세우면 메시지가 번쩍하고 사라진다', () => {
  /* 두 번 눌러 연 창은 끝나는 순간 닫힌다. 오류를 사람이 «읽을» 틈이 있어야 한다. */
  const 실패대목 = BAT.split('if errorlevel 1');
  assert.ok(실패대목.length >= 3, '★ 실패를 안 보는 자리가 있다(git pull · 올리기 둘 다 봐야 한다)');
  실패대목.slice(1).forEach((조각, i) => {
    const 끝 = 조각.indexOf('exit /b');
    assert.ok(끝 > -1 && /pause/.test(조각.slice(0, 끝)),
      '★★ ' + (i + 1) + '번째 실패에서 pause 없이 닫힌다 — 무엇이 잘못됐는지 영영 못 본다');
  });
  assert.match(PS1, /Read-Host/, '★ 찾아서 도는 쪽도 끝에 세워야 한다');
});

test('③★ 두 길이 «같은 것»을 부른다 — 어긋나면 한쪽만 고쳐진다', () => {
  assert.match(BAT, /nas-backup-deploy\.js --deploy/);
  assert.match(PS1, /nas-backup-deploy\.js --deploy/);
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'nas-backup-deploy.js')),
    '★★ 두 길이 부르는 그 파일이 없다 — 두 번 눌러도 아무 일이 안 난다');
  /* 깃발이 어긋나면 «보여만» 주고 끝난다 — 사람은 올린 줄 안다 */
  assert.ok(/--deploy/.test(BAT) && /--deploy/.test(PS1),
    '★★ --deploy 가 빠지면 보여만 주고 끝나는데 화면은 「끝났습니다」라고 한다');
});

test('④ 찾기는 «이알피 폴더인지»까지 본다 — 한 장만 보고 엉뚱한 데로 가지 않는다', () => {
  assert.match(PS1, /Filter 'pu-erp\.html'/);
  assert.match(PS1, /Join-Path \$_\.DirectoryName 'scripts'/,
    '★ 내려받기 폴더에 있는 pu-erp.html 한 장을 저장소로 잘못 보면 git pull 이 또 터진다');
  assert.match(PS1, /USERPROFILE/, '★ 흔한 자리부터 봐야 몇 분을 안 기다린다');
});

test('⑤ 배포본에 안 나간다 — 개발용이다', () => {
  const gate = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  assert.match(gate, /\bscripts\b/,
    '★★ scripts 폴더가 지우는 목록에 없으면 이 파일들이 인터넷에 함께 올라간다');
});
