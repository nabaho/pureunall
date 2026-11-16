/* «Firebase 배포» 작업 — 함수마다 «정말 올라갔나» 대조 (2026-11-16 대표 「남은거 모두해라」)
   ■ 지키는 규칙
     ① 로그에 그 함수의 «Successful» 줄이 없으면 안 올라간 것이다 — 종료코드 0 이어도(2026-11-15 실행 43715591212)
     ② 경고 뒤에 Successful 이 오면 올라간 것이다(같은 실행의 newsFullPage)
     ③ 이름은 «정확히» 본다 — newsFull 이 newsFullPage 줄에 걸리지 않는다
     ④ 바뀐 것 없어 건너뛴 것은 올라간 쪽으로 치되 따로 센다
     ⑤ 이상한 이름은 받지 않는다(표준출력이 다음 배포 이름이 된다)
     ⑥ 작업 파일 — 대조 → 안 올라간 것만 한 번 더 → 그래도 남으면 빨갛게 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../scripts/firebase-deploy-verify.js');

const E = '\x1b';
/* 2026-11-15 실행 로그와 같은 모양(색 표지째) */
const 로그 = [
  E + '[36m' + E + '[1mi  functions:' + E + '[22m' + E + '[39m updating Node.js 22 (1st Gen) function weeklyNewsletterPrepare(asia-northeast3)...',
  E + '[36m' + E + '[1mi  functions:' + E + '[22m' + E + '[39m updating Node.js 22 (1st Gen) function newsletterSundayRefill(asia-northeast3)...',
  E + '[33m' + E + '[1m⚠  functions:' + E + '[22m' + E + '[39m failed to update function projects/pureun-erp/locations/asia-northeast3/functions/weeklyNewsletterPrepare',
  E + '[33m' + E + '[1m⚠  functions:' + E + '[22m' + E + '[39m failed to update function projects/pureun-erp/locations/asia-northeast3/functions/newsFullPage',
  E + '[32m' + E + '[1m✔ ' + E + '[22m' + E + '[39m ' + E + '[1m' + E + '[32mfunctions[newsView(asia-northeast3)]' + E + '[39m' + E + '[22m Successful update operation.',
  E + '[32m' + E + '[1m✔ ' + E + '[22m' + E + '[39m ' + E + '[1m' + E + '[32mfunctions[newsFullPage(asia-northeast3)]' + E + '[39m' + E + '[22m Successful update operation.',
  E + '[32m' + E + '[1m✔ ' + E + '[22m' + E + '[39m ' + E + '[1m' + E + '[32mfunctions[newsDocsPull(asia-northeast3)]' + E + '[39m' + E + '[22m Successful create operation.',
  'functions[dailyDocsCollect(asia-northeast3)] Skipped (No changes detected)'
].join('\n');

test('① Successful 줄이 없으면 안 올라간 것 — 경고만 있었던 것 · 아예 말이 없던 것', () => {
  const r = V.verify('weeklyNewsletterPrepare,newsletterSundayRefill,newsView', 로그);
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing.sort(), ['newsletterSundayRefill', 'weeklyNewsletterPrepare']);
  assert.deepEqual(r.done, ['newsView']);
});

test('② 경고 뒤에 Successful 이 오면 올라간 것 · create 도 올라간 것', () => {
  const r = V.verify('newsFullPage,newsDocsPull', 로그);
  assert.deepEqual(r.done, ['newsFullPage', 'newsDocsPull']);
  assert.equal(r.missing.length, 0);
});

test('③ 이름은 정확히 — newsFull 은 newsFullPage 줄에 걸리지 않는다', () => {
  assert.deepEqual(V.verify('newsFull', 로그).missing, ['newsFull']);
});

test('④ 바뀐 것 없어 건너뛴 것은 따로 센다(안 올라감이 아니다)', () => {
  const r = V.verify('dailyDocsCollect', 로그);
  assert.deepEqual(r.skipped, ['dailyDocsCollect']);
  assert.equal(r.missing.length, 0);
});

test('⑤ 이상한 이름·빈 이름은 받지 않는다', () => {
  assert.equal(V.verify('', 로그).ok, false);
  assert.equal(V.verify('a;rm -rf /', 로그).ok, false);
  assert.equal(V.verify('$(id)', 로그).ok, false);
});

test('⑤ 명령줄 — 안 올라간 것을 표준출력에 · 종료코드 2', () => {
  const { spawnSync } = require('node:child_process');
  const 자리 = path.join(require('node:os').tmpdir(), 'deploy-verify-' + process.pid + '.log');
  fs.writeFileSync(자리, 로그);
  try {
    const 안됨 = spawnSync(process.execPath, [require.resolve('../scripts/firebase-deploy-verify.js'), 'newsView,weeklyNewsletterPrepare', 자리], { encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_STEP_SUMMARY: '' }) });
    assert.equal(안됨.status, 2);
    assert.equal(안됨.stdout, 'weeklyNewsletterPrepare');
    const 됨 = spawnSync(process.execPath, [require.resolve('../scripts/firebase-deploy-verify.js'), 'newsView', 자리], { encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_STEP_SUMMARY: '' }) });
    assert.equal(됨.status, 0);
    assert.equal(됨.stdout, '');
  } finally { fs.unlinkSync(자리); }
});

test('⑥ 작업 파일 — 배포 뒤 대조 · 안 올라간 것만 거르개를 거쳐 한 번 더 · 남으면 빨갛게', () => {
  const WF = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'firebase-deploy.yml'), 'utf8').replace(/\r\n/g, '\n');
  const 단계 = WF.slice(WF.indexOf('- name: ② 서버 함수 배포'), WF.indexOf('- name: ③'));
  assert.match(단계, /firebase deploy --only "\$ONLY"[^\n]*\| tee "\$RUNNER_TEMP\/deploy1\.log"/, '첫 배포 로그를 남기지 않는다');
  assert.match(단계, /firebase-deploy-verify\.js "\$FN_INPUT" "\$RUNNER_TEMP\/deploy1\.log"/, '★★ 첫 배포를 함수마다 대조하지 않는다');
  assert.match(단계, /firebase-deploy-check\.js "\$LEFT"/, '다시 올릴 이름이 거르개를 안 거친다');
  assert.match(단계, /firebase-deploy-verify\.js "\$LEFT" "\$RUNNER_TEMP\/deploy2\.log"/, '다시 올린 것을 대조하지 않는다');
  assert.match(단계, /exit 1\s*$/, '★★ 두 번 올려도 안 된 것이 있는데 빨갛게 안 끝난다');
});
