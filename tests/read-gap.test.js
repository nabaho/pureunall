'use strict';
/* 「앱이 읽는 자리」와 「규칙이 읽기를 주는 자리」가 어긋나면 그 화면은 통째로 안 열린다.

   ★ 왜 이 검사가 있나 (2026-09-20 전수점검)
     실시간DB 는 «읽는 자리나 그 위»에 '.read' 가 있어야 열어 준다.
     아래 칸에만 적어 두면 부모를 통째로 읽는 화면은 permission_denied 다.
     실제로 둘이 걸렸다 —
       · docs-esign.html 의 사건 목록(`esign/cases`) — 장애알림 9건, 아무도 못 열었다
       · pu-news.html 의 공용 수신거부(`config/mailBlock`) — 아예 없는 자리였다
     둘 다 «조용히» 실패했다. 하나는 화면에 빨간 줄만 남고, 하나는 `.catch` 가
     빈 표로 바꿔 「막은 사람이 없다」처럼 보이게 했다.

   ★ 이 검사가 보는 것은 «규칙»이지 «지금 값»이 아니다 —
     어떤 자리를 쓰든, 읽는 자리 위에 읽기가 있기만 하면 통과한다.

   ⚠ 이 검사가 울면: 규칙 만들개(scripts/make-firebase-rules.js)에 그 자리의 '.read'
     를 더하거나, 앱이 «읽을 수 있는 자리»를 읽도록 고친다. 검사를 고치지 말 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
/* ⚠ 주석을 먼저 걷는다 — 안 걷으면 «주석 안에 보존해 둔 죽은 코드»가 걸려
     있지도 않은 고장을 알린다(pu-erp.html 에 그런 자리가 실제로 있다).
     집안 규칙: 소스를 글자로 보는 검사는 주석부터 걷는다. */
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const rules = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')
).rules;

/* 그 경로(또는 그 위)에 '.read' 가 하나라도 있나 */
function 읽기있나(경로) {
  const 칸들 = String(경로).split('/').filter(Boolean);
  let 자리 = rules;
  let 있다 = !!(자리 && 자리['.read']);
  for (const 칸 of 칸들) {
    if (!자리 || typeof 자리 !== 'object') return 있다;
    let 다음 = 자리[칸];
    if (다음 === undefined) {
      const 아무열쇠 = Object.keys(자리).find((k) => k.startsWith('$'));
      if (아무열쇠 === undefined) return 있다;   // 규칙 나무에 그 갈래가 없다
      다음 = 자리[아무열쇠];
    }
    자리 = 다음;
    if (자리 && 자리['.read']) 있다 = true;
  }
  return 있다;
}

/* 앱이 «통째로 한 번에» 읽는 자리 모으기 —
   ref('어디') 바로 뒤에 .once( 또는 .on( 이 붙은 것만 본다(쓰기만 하는 자리는 뺀다). */
function 통째로읽는자리() {
  const 파일들 = cp
    .execSync('git ls-files "*.html" "js/*.js"', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e8 })
    .split('\n')
    .map((s) => s.replace(/^"|"$/g, ''))
    .filter(Boolean)
    .filter((f) => !f.startsWith('tests/'));
  const 찾은것 = [];
  for (const f of 파일들) {
    let 글;
    try { 글 = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'), f); } catch (e) { continue; }
    const 훑개 = /\.ref\(\s*['"]([A-Za-z0-9_/-]+)['"]\s*\)\s*(?:\r?\n\s*)?\.(?:once|on)\s*\(/g;
    let m;
    while ((m = 훑개.exec(글))) {
      const 길 = m[1].replace(/^\/+|\/+$/g, '');
      if (!길) continue;
      찾은것.push({ 길, 어디: f + ':' + 글.slice(0, m.index).split('\n').length });
    }
  }
  return 찾은것;
}

test('앱이 통째로 읽는 자리에는 «그 위 어딘가에» 읽기 규칙이 있다', () => {
  const 자리들 = 통째로읽는자리();
  assert.ok(자리들.length >= 20, '읽는 자리를 못 찾았다면 훑개가 헛돈 것이다 — 찾은 수: ' + 자리들.length);
  const 막힌것 = 자리들.filter((x) => !읽기있나(x.길));
  assert.deepEqual(
    막힌것.map((x) => '/' + x.길 + ' ← ' + x.어디),
    [],
    '규칙이 읽기를 안 주는 자리를 앱이 읽고 있다 — 그 화면은 permission_denied 로 조용히 막힌다'
  );
});

test('전자서명 사건 목록은 읽을 수 있다 — 아래 칸에만 적어 두면 목록이 안 열린다', () => {
  assert.ok(읽기있나('esign/cases'), 'esign/cases 를 통째로 읽을 길이 없다');
});

test('공용 수신거부 명단은 기업정보함이 «쓰는 그 자리»를 읽는다', () => {
  const 뉴스 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8');
  const 명함 = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
  const 쓰는자리 = /DB_ROOT\s*\+\s*['"]\/config\/mailBlock/.test(명함);
  assert.ok(쓰는자리, '기업정보함이 수신거부를 담는 자리가 바뀌었다 — 읽는 쪽도 함께 봐야 한다');
  const 읽는자리 = (뉴스.match(/\.ref\(\s*['"]([A-Za-z0-9_/-]*config\/mailBlock)['"]/) || [])[1];
  assert.equal(읽는자리, 'pucards/config/mailBlock',
    '뉴스레터가 읽는 자리와 기업정보함이 쓰는 자리가 다르면 수신거부가 조용히 새어 나간다');
  assert.ok(읽기있나(읽는자리), '읽는 자리에 읽기 규칙이 없다');
});
