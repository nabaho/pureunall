/* GitHub «Firebase 배포» 작업 (.github/workflows/firebase-deploy.yml · 2026-10-31 대표 「니가 직접 하면 안되나 … 한번에 하게 가능하게」)
   클라우드 방의 Claude 가 규칙 게시·서버 함수 배포·매일 정리 스위치를 한 번에 부르는 길이다. 운영 서버에 닿는 길이라 울타리를 못 박는다.
   ★ 못 박는 것:
     ① 수동 실행(workflow_dispatch)만 · main 에서만 · 읽기 권한만 — push·PR·예약으로는 안 돈다
     ② 입력 식은 run: 안에 없다(env 로만) — 입력 글이 셸 명령이 되지 않게
     ③ 규칙은 rules-deploy.js --deploy 로만 — `deploy --only database` 를 직접 부르지 않는다 · 우회 깃발 없음
     ④ 함수는 거르개가 내준 이름으로만 — 이름 없이 전체 배포 없음
     ⑤ 열쇠는 비밀에서만, 끝에 지운다 · 비밀이 없으면 멈춘다
     ⑥ 거르개 — 있는 이름만 · 이상한 글자·빈 것·너무 많은 것은 거절 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../scripts/firebase-deploy-check.js');

const ROOT = path.join(__dirname, '..');
const WF = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'firebase-deploy.yml'), 'utf8').replace(/\r\n/g, '\n');
const LINES = WF.split('\n');
const code = (l) => !/^\s*#/.test(l);
/* run: 블록 안의 줄들 — `run: |` 다음, 그 run 보다 깊이 들여 쓴 줄 */
function runBlocks() {
  const out = [];
  LINES.forEach((l, i) => {
    const m = /^(\s*)(?:- )?run:\s*(\|)?\s*(.*)$/.exec(l);
    if (!m) return;
    if (!m[2]) { out.push(m[3]); return; }
    const ind = m[1].length;
    for (let j = i + 1; j < LINES.length; j++) {
      const t = LINES[j];
      if (t.trim() && (t.length - t.trimStart().length) <= ind) break;
      out.push(t);
    }
  });
  return out.join('\n');
}

test('① 수동 실행만 · main 에서만 · 읽기 권한만', () => {
  const on = WF.slice(WF.indexOf('\non:'), WF.indexOf('\npermissions:'));
  assert.match(on, /workflow_dispatch:/);
  ['push:', 'pull_request', 'schedule:', 'workflow_run', 'issue', 'repository_dispatch'].forEach((k) =>
    assert.ok(!on.includes(k), '수동 실행 말고 다른 깨우는 길이 있다: ' + k));
  assert.match(WF, /if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.match(WF, /permissions:\n\s+contents:\s*read\n/);
  assert.ok(!/contents:\s*write|pull-requests:\s*write|id-token:\s*write/.test(WF), '쓰기 권한을 달았다');
});

test('② 입력 식은 run: 안에 없다 — env·if 로만', () => {
  const runs = runBlocks();
  assert.ok(!/\$\{\{/.test(runs), 'run: 안에 ${{ }} 식이 있다 — 입력 글이 셸 명령이 될 수 있다');
  LINES.filter(code).filter((l) => l.includes('${{ inputs.')).forEach((l) =>
    assert.match(l, /^\s*(if:|[A-Z_]+:)/, '입력 식이 env·if 말고 다른 자리에 있다: ' + l.trim()));
});

test('③ 규칙은 rules-deploy.js --deploy 로만 · 직접 database 배포·우회 깃발 없음', () => {
  const runs = runBlocks();
  assert.match(runs, /node scripts\/rules-deploy\.js --deploy/);
  assert.ok(!/--only\s+["']?database/.test(runs), '규칙을 rules-deploy.js 를 거치지 않고 올린다');
  assert.ok(!/rules-deploy\.js --deploy\s+--/.test(runs), 'rules-deploy.js 에 다른 깃발을 붙였다');
  // --force 는 스위치 한 칸 덮어쓰기의 «확인 창 넘기기» 한 곳에서만
  const forces = runs.split('\n').filter((l) => /--force\b/.test(l) && code(l));
  assert.equal(forces.length, 1);
  assert.match(forces[0], /database:set \/rules_mgmt\/library\/auto\/cfg /);
});

test('④ 함수는 거르개가 내준 이름으로만 — 전체 배포 없음', () => {
  const runs = runBlocks();
  assert.match(runs, /node scripts\/firebase-deploy-check\.js "\$FN_INPUT"/);
  assert.match(runs, /firebase deploy --only "\$ONLY"/);
  assert.ok(!/firebase deploy(?![^\n]*--only)/.test(runs), '--only 없는 firebase deploy 가 있다');
  assert.ok(!/--only\s+["']?functions["']?(\s|$)/.test(runs), '함수 전체 배포가 있다');
});

test('⑤ 열쇠는 비밀에서만, 끝에 지운다 · 없으면 멈춘다 · 찍지 않는다', () => {
  assert.match(WF, /secrets\.FIREBASE_SERVICE_ACCOUNT/);
  assert.match(WF, /if:\s*always\(\)\n\s+run:\s*rm -f "\$RUNNER_TEMP\/sa\.json"/);
  assert.match(WF, /배포 열쇠가 없습니다[\s\S]{0,200}exit 1/);
  assert.ok(!/echo\s+"?\$SA_JSON|cat\s+"?\$RUNNER_TEMP\/sa\.json/.test(runBlocks()), '열쇠를 로그에 찍는다');
  assert.ok(!fs.readdirSync(ROOT).some((f) => /service.?account|sa\.json/i.test(f)), '저장소에 열쇠 파일이 있다');
});

test('⑥ 거르개 — 있는 이름만 · 이상한 글자·빈 것·너무 많은 것은 거절', () => {
  const src = 'exports.collectRulesMail = functions\nexports.collectRulesMailAsk = functions\nexports.gcalAuthUrl    = x;\n';
  const ok = C.check('collectRulesMail, collectRulesMailAsk,collectRulesMail', src);
  assert.equal(ok.ok, true);
  assert.equal(ok.only, 'functions:collectRulesMail,functions:collectRulesMailAsk');
  assert.ok(C.exportsOf(src).has('gcalAuthUrl'));
  assert.equal(C.check('', src).ok, false, '빈 이름(= 전체 배포)을 받았다');
  assert.equal(C.check('nope', src).ok, false, '없는 함수를 받았다');
  assert.equal(C.check('collectRulesMail;rm -rf /', src).ok, false, '셸 글자를 받았다');
  assert.equal(C.check('a$(id)', src).ok, false);
  assert.equal(C.check(Array(C.MAX + 1).fill('collectRulesMail').map((x, i) => x + (i ? '' : '')).join(','), src).ok, false, '한도를 넘겼다');
  // 지금 저장소의 index.js 에 매일 정리가 붙은 두 함수가 있다
  const real = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.equal(C.check('collectRulesMail,collectRulesMailAsk', real).ok, true);
});
