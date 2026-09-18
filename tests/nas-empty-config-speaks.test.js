'use strict';
/* 비밀번호가 빈 채로 「활성화됨」이라 했다 (대표 화면 2026-09-18 넷째)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     화면 맨 위에 스스로 재고 답하는 칸을 붙였는데(#1420), 대표님 화면에는 **그 칸이 아예 안 떴다.**
     같은 화면에서 **NAS 비밀번호 칸이 비어 있었다** — 저장된 설정에 비밀번호가 없다.
     걸러내기가 「설정이 없으면 안 잰다」로 조용히 물러섰고, 화면은 아무 말도 안 했다.
   ■ 더 아픈 것
     그 위 초록 띠는 그대로 「주 1회 자동 백업 활성화됨」이라 하고 있었다.
     비밀번호가 없어 **한 번도 돌 수가 없었는데** 활성화됐다고 한다.
     조용한 것이 거짓말이 되는 자리다 — 이 저장소가 여러 번 밟았다.
   ■ 그리고 왜 비어 있었나
     넣고 「연결 테스트」만 누른 뒤 「💾 설정 저장」을 안 누르면 그대로 사라진다.
     화면이 그 사실을 «미리» 말해야 한다.

   ★ 못 박는 것
     ① 빈 칸이면 «무엇이» 비었는지 이름으로 말한다 — 조용히 물러서지 않는다
     ② 넣은 뒤 «저장»까지 눌러야 한다는 것도 함께 적는다
     ③ 빈 칸일 때는 나스를 두드리지 않는다 — 빈 계정으로 로그인하지 않는다
     ④ 자동 백업 띠가 «활성화됨»이라 하지 않는다 — 돌 수가 없는 상태다
     ⑤ 저장 안 된 변경이 있으면 단추가 그것을 말한다
     ⑥ 어느 경우든 «지금 바로 되는 길»은 남는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
/* ⚠ 조각이므로 stripComments 가 아니라 stripJs 다 — 주석 속 낱말이 코드로 읽히면 안 된다 */
const NAS = stripJs(cutFn(ERP, 'function NasBackupSettings('));
const EFF = NAS.slice(NAS.indexOf('useEffect(function'), NAS.indexOf('function 안저장됨('));

test('①★★ 빈 칸이면 «무엇이» 비었는지 이름으로 말한다 — 조용히 물러서지 않는다', () => {
  assert.match(EFF, /빈칸\.push\('NAS 비밀번호'\)/,
    '★★ 대표님 화면이 바로 이것이었다 — 비밀번호가 비었는데 화면은 아무 말도 안 했다');
  assert.match(EFF, /빈칸\.push\('NAS 아이디'\)/);
  assert.match(EFF, /빈칸\.push\('NAS 내부 IP 주소'\)/);
  assert.match(EFF, /set진단\([\s\S]{0,400}?빈칸\.join/,
    '★ 이름을 모아 놓고 화면에 안 쓰면 모은 뜻이 없다');
  assert.match(EFF, /칸이 비어 있습니다/);
});

test('②★ 넣은 뒤 «저장»까지 눌러야 한다는 것을 함께 적는다', () => {
  assert.match(EFF, /설정 저장/, '★★ 넣고 「연결 테스트」만 누르면 그대로 사라진다 — 그것이 빈 채로 굳은 까닭일 수 있다');
  assert.match(EFF, /사라지고/, '★ 「저장하세요」만으로는 왜 그래야 하는지가 없다');
});

test('③ 빈 칸일 때는 나스를 두드리지 않는다', () => {
  assert.ok(EFF.indexOf('빈칸.length') < EFF.indexOf('doTest()'),
    '★ 빈 계정으로 로그인하면 로그만 더럽히고 답도 틀린다');
  assert.match(EFF, /if\(빈칸\.length\)\{[\s\S]{0,600}?return;/,
    '★ 말만 하고 그대로 두드리면 두 가지 답이 겹쳐 뜬다');
});

test('④★★ 자동 백업 띠가 «활성화됨»이라 하지 않는다 — 돌 수가 없는 상태다', () => {
  const 띠시작 = NAS.indexOf('var 못돎 =');
  assert.ok(띠시작 > -1, '★ 자동 백업 띠를 못 찾았다 — 검사가 빈 글자를 보고 있다');
  const 띠 = NAS.slice(띠시작, NAS.indexOf('📡 NAS 연결 설정'));
  assert.match(띠, /var 못돎 = !cfg\.host \|\| !cfg\.user \|\| !cfg\.pass;/,
    '★ 띠가 «돌 수 있는 상태인지»를 안 보면 언제나 활성화됐다고 한다');
  assert.match(띠, /돌 수가 없습니다/, '★★ 한 번도 돌 수 없었는데 「활성화됨」이라 하는 것은 거짓말이다');
  /* 「활성화됨」은 «못돎이 아닐 때»만 나와야 한다 */
  const i = 띠.indexOf("'주 1회 자동 백업 활성화됨'");
  assert.ok(i > -1 && 띠.lastIndexOf('못돎 ?', i) > -1 && 띠.lastIndexOf('못돎 ?', i) > i - 400,
    '★ 「활성화됨」이 조건 없이 나오면 고친 뜻이 없다');
  assert.match(띠, /설정 저장」을 누르셔야/, '★ 무엇을 해야 켜지는지가 없으면 끄라는 말만 남는다');
});

test('⑤★ 저장 안 된 변경이 있으면 단추가 그것을 말한다', () => {
  assert.match(NAS, /function 안저장됨\(\)/);
  assert.match(NAS, /안저장됨\(\) \?[\s\S]{0,120}?아직 저장 안 됨/,
    '★★ 넣기만 하고 떠나면 사라지는데 화면이 조용하면 다음에 또 같은 자리에 선다');
  const f = cutFn(NAS, 'function 안저장됨(');
  assert.match(f, /'pass'/, '★ 비밀번호가 빠지면 정작 사라지는 칸을 못 본다');
  assert.match(f, /catch/, '★ 여기서 터지면 설정 화면이 안 뜬다');
});

test('⑥ 어느 경우든 «지금 바로 되는 길»은 남는다', () => {
  assert.match(EFF, /백업 파일 다운로드/,
    '★ 빈 칸이라고 아무 길도 안 주면 받는 사람은 그대로 멈춘다');
});
