#!/usr/bin/env node
/* 옵시디언 자동 정리를 «주기적으로 저절로» 돌게 등록한다 (대표 PC 에서 직접 한 번 실행)

   node tools/obsidian-sync/auto.js --vault "D:\푸른업무"            # 30분마다 (윈도우 작업 스케줄러에 등록)
   node tools/obsidian-sync/auto.js --vault "D:\푸른업무" --every 15
   node tools/obsidian-sync/auto.js --vault "D:\푸른업무" --dry-run  # 등록하지 않고 명령만 보여 줌
   node tools/obsidian-sync/auto.js --remove                         # 등록 해제

   sync.js 는 바뀐 세션만 다시 쓰므로 자주 돌아도 가볍다(바뀐 게 없으면 파일 크기·시각만 본다).
   ⚠ 이 PC 의 설정을 바꾸는 일이라 «사람이 이 명령을 쳐야만» 등록된다 — 저장소 코드가 스스로 등록하지 않는다.
   ⚠ 윈도우 전용으로 확인 없이 쓴 부분은 schtasks 인자 조립이다(검사는 조립까지만 — 실제 등록은 대표 PC 에서 처음 도는 것이다).
   윈도우가 아니면 crontab 한 줄만 알려 준다(등록은 안 한다). */
const path = require('path');
const { execFileSync } = require('child_process');
const { assertVaultSafe } = require('./sync.js');

const TASK = '푸른-옵시디언-정리';
const SYNC = path.join(__dirname, 'sync.js');

function parse(argv) {
  const a = { every: 30 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--vault') a.vault = argv[++i];
    else if (k === '--every') a.every = Number(argv[++i]);
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--remove') a.remove = true;
    else throw new Error('모르는 옵션: ' + k);
  }
  if (!a.remove) {
    if (!(a.every >= 5 && a.every <= 1440)) throw new Error('--every 는 5~1440(분) 사이로 주세요');
    assertVaultSafe(a.vault);
  }
  return a;
}

/* schtasks 인자 — /TR 은 «따옴표가 든 한 덩어리»여야 한다 */
function createArgs(a, node) {
  const run = '"' + node + '" "' + SYNC + '" --vault "' + path.resolve(a.vault) + '"';
  return ['/Create', '/F', '/SC', 'MINUTE', '/MO', String(a.every), '/TN', TASK, '/TR', run];
}
function removeArgs() { return ['/Delete', '/F', '/TN', TASK]; }
function cronLine(a, node) {
  return '*/' + a.every + ' * * * * "' + node + '" "' + SYNC + '" --vault "' + path.resolve(a.vault) + '"';
}

function main() {
  const a = parse(process.argv.slice(2));
  const node = process.execPath;
  if (process.platform !== 'win32') {
    console.log(a.remove ? 'crontab -e 에서 옵시디언 정리 줄을 지우세요.' : 'crontab -e 에 아래 한 줄을 넣으세요(자동 등록은 윈도우에서만 합니다):\n' + cronLine(a, node));
    return;
  }
  const args = a.remove ? removeArgs() : createArgs(a, node);
  if (a.dryRun) { console.log('schtasks ' + args.map((x) => (/\s/.test(x) ? '"' + x + '"' : x)).join(' ')); return; }
  execFileSync('schtasks', args, { stdio: 'inherit' });
  console.log(a.remove ? '등록을 해제했습니다.' : '등록했습니다 — ' + a.every + '분마다 돕니다. 지금 한 번 돌려 보려면: schtasks /Run /TN ' + TASK);
}

module.exports = { parse, createArgs, removeArgs, cronLine, TASK };
if (require.main === module) {
  try { main(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
