'use strict';
/* 창고 규칙 — «기준이 낡으면 올리지 않는다» (2026-09-13 대표 지시 「넷 고쳐」)
 *
 * ★★ 왜 — 창고 규칙은 읽을 길이 없다. `firebase` 에 `storage:rules:get` 같은 것이
 *   없어서(2026-09-13 에 다시 확인했다) 「지금 콘솔에 무엇이 있나」를 우리는 모른다.
 *   아는 것은 「마지막으로 사람이 옮겨 적어 준 것」뿐이다.
 *
 *   그래서 남는 위험 하나 — 누가 콘솔에서 손으로 고치고 그 내용을 파일로 안 남기면,
 *   다음 배포가 그 손질을 «말없이 덮는다». 우리는 덮은 줄도 모른다.
 *
 * ★ 할 수 있는 정직한 일은 하나다: 기준이 며칠 된 것인지 세어 말하고, 너무
 *   오래됐으면 올리지 않는 것. 올릴 때마다 새 기준을 남기므로, 날수가 커진다는
 *   말은 「오래 아무도 안 올렸다」는 뜻이고 — 그동안 콘솔이 어찌 됐는지 모른다.
 *
 * ⚠⚠ 저장소의 docs/ 를 «건드리지 않는다». 처음에 진짜 기준 파일을 잠시 치웠다가
 *   되돌리는 식으로 짰더니, node --test 가 파일들을 «동시에» 돌리는 바람에 그 사이
 *   남의 검사(storage-rules-deploy.test.js)가 그 파일을 찾다가 ENOENT 로 넘어졌다.
 *   검사는 제 방에서만 놀아야 한다 — 그래서 임시 자리에 사본을 세우고 거기서 돌린다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const S = require('../scripts/storage-rules-deploy.js');
const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

test('① 기준 파일 이름에서 날짜를 읽는다 (윈도우 역슬래시 길도)', () => {
  assert.equal(S.기준날짜('docs/firebase-storage-콘솔원문-2026-09-13.txt'), '2026-09-13');
  assert.equal(S.기준날짜('docs\\firebase-storage-콘솔원문-2026-08-01.txt'), '2026-08-01');
  assert.equal(S.기준날짜('docs/딴것.txt'), null);
  assert.equal(S.기준날짜(null), null);
});

test('② 며칠 된 것인지 센다', () => {
  assert.equal(S.며칠됐나('2026-09-13', '2026-09-13'), 0);
  assert.equal(S.며칠됐나('2026-08-01', '2026-09-13'), 43);
  assert.equal(S.며칠됐나(null, '2026-09-13'), null);
  assert.equal(S.며칠됐나('말이안되는날짜', '2026-09-13'), null);
});

test('★ ③ 날수가 기준을 넘으면 막고, 안 넘으면 안 막는다 — 경계에서 «넘을 때만»', () => {
  assert.equal(S.낡아서막나(S.기준낡음날수 - 1), null);
  assert.equal(S.낡아서막나(S.기준낡음날수), null, '딱 맞는 날은 아직 괜찮아야 합니다.');
  assert.ok(S.낡아서막나(S.기준낡음날수 + 1), '하루 넘었는데 안 막습니다.');
  assert.equal(S.낡아서막나(S.기준낡음날수 + 1).날수, S.기준낡음날수 + 1);
});

test('③ 날짜를 못 읽으면 여기서는 «안» 막는다 — 막을 일은 다른 안전장치가 한다', () => {
  assert.equal(S.낡아서막나(null), null);
});

test('③ 날수를 늘려 피하지 못하게, 값이 터무니없이 크지 않다', () => {
  assert.ok(S.기준낡음날수 >= 7 && S.기준낡음날수 <= 60,
    '기준낡음날수 가 ' + S.기준낡음날수 + '일입니다 — 너무 길면 안전장치가 없는 것과 같습니다.');
});

/* ══ ★★ 배선 — 스크립트를 «정말 돌려» 본다 ═══════════════════════════
   위 검사는 판단하는 함수만 잰다. main 이 그 함수를 안 부르면 다 통과하면서
   낡은 기준으로 올라간다. 그래서 «사본 방»에 낡은 기준을 세우고 진짜로 돌린다. */
function 사본방에서돌리기(인자, 기준날) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-'));
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'js'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'storage-rules-deploy.js'),
    path.join(tmp, 'scripts', 'storage-rules-deploy.js'));
  fs.copyFileSync(path.join(ROOT, 'js', 'pu-photo-store.js'), path.join(tmp, 'js', 'pu-photo-store.js'));

  /* 올릴 것과 승인 파일은 그대로 나르고, 기준은 «날짜만» 바꿔 하나만 둔다 */
  const 기준들 = fs.readdirSync(DOCS).filter(function (f) {
    return /^firebase-storage-콘솔원문-\d{4}-\d{2}-\d{2}\.txt$/.test(f);
  }).sort();
  fs.readdirSync(DOCS)
    .filter(function (f) { return /^firebase-storage-/.test(f) && 기준들.indexOf(f) < 0; })
    .forEach(function (f) { fs.copyFileSync(path.join(DOCS, f), path.join(tmp, 'docs', f)); });
  fs.copyFileSync(path.join(DOCS, 기준들[기준들.length - 1]),
    path.join(tmp, 'docs', 'firebase-storage-콘솔원문-' + 기준날 + '.txt'));

  let out = '', code = 0;
  try {
    out = cp.execFileSync(process.execPath,
      [path.join(tmp, 'scripts', 'storage-rules-deploy.js')].concat(인자),
      { cwd: tmp, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); code = e.status; }
  return { out: out, code: code, tmp: tmp };
}

test('★★ 배선 — 기준이 낡았으면 미리보기에서 «며칠 됐는지» 말한다', () => {
  const r = 사본방에서돌리기([], '2020-01-01');
  assert.match(r.out, /일 전|일 된/, '기준이 몇 날 된 것인지 말하지 않습니다.');
  assert.match(r.out, /덮습니다/, '낡은 기준이 무엇을 뜻하는지 말하지 않습니다.');
  assert.equal(r.code, 0, '미리보기는 막지 않아야 합니다(보여만 주는 단계).');
});

test('★★ 배선 — 기준이 낡았는데 --deploy 하면 «올리지 않고» 멈춘다 (종료코드 3)', () => {
  const r = 사본방에서돌리기(['--deploy'], '2020-01-01');
  assert.equal(r.code, 3, '낡은 기준으로 올리려 했습니다(종료코드 ' + r.code + ').');
  assert.match(r.out, /올리지 않았습니다/);
  assert.match(r.out, /firebase-storage-콘솔원문-/, '어떻게 풀어야 하는지 길을 알려 주지 않습니다.');
  assert.doesNotMatch(r.out, /올리는 중/, '실제로 창고에 올리러 갔습니다.');
});

/* ★★★ 이빨 — «막히지 않는 쪽»도 재야 한다. 늘 막히기만 하면 위 검사는
     「무조건 멈추는 코드」로도 통과한다.
   ⚠⚠ 여기서 --deploy 를 쓰지 «말 것». 한 번 그렇게 짰다가 검사가 진짜로
     창고에 올리러 갔다(36초 걸렸다 — 그래서 알았다). 검사는 배포를 하지 않는다.
     낡음 경고가 «안 나오는 것»으로 같은 갈래를 잰다. */
test('★★★ 이빨 확인 — 기준이 «오늘» 것이면 낡았다고 하지 않는다 (올리지는 않는다)', () => {
  const 오늘 = new Date().toISOString().slice(0, 10);
  const r = 사본방에서돌리기([], 오늘);
  assert.match(r.out, /오늘/, '기준이 오늘 것이라고 말하지 않습니다.');
  assert.doesNotMatch(r.out, /일이 넘습니다|말없이 덮습니다/,
    '기준이 오늘 것인데도 낡았다고 합니다 — 위 검사가 헛돌고 있습니다.');
  assert.equal(r.code, 0);
});

test('★★ 검사가 «올리러 가지» 않는다 — 이 파일 어디에도 --deploy 로 진짜 배포가 없다', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  /* --deploy 를 넘기는 곳은 «막히는 것을 재는» 한 자리뿐이어야 한다.
     막히면 firebase 를 부르기 전에 멈추므로 안전하다. */
  const 넘기는곳 = (src.match(/사본방에서돌리기\(\[['"]--deploy['"]\]/g) || []).length;
  assert.equal(넘기는곳, 1,
    '--deploy 를 ' + 넘기는곳 + '곳에서 넘깁니다 — 막히지 않는 쪽에 넘기면 진짜로 올라갑니다.');
});

test('★★ 저장소의 기준 파일을 건드리지 않았다 — 검사는 제 방에서만 논다', () => {
  const 것들 = fs.readdirSync(DOCS).filter(function (f) {
    return /^firebase-storage-콘솔원문-\d{4}-\d{2}-\d{2}\.txt$/.test(f);
  });
  assert.ok(것들.length > 0, '기준 파일이 사라졌습니다.');
  assert.ok(것들.indexOf('firebase-storage-콘솔원문-2020-01-01.txt') < 0,
    '검사가 만든 가짜 기준이 저장소에 남았습니다 — 다음 배포가 이것을 기준으로 삼습니다.');
});
