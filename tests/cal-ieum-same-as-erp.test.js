/* 푸른 캘린더의 이음센터 화면이 이알피와 어긋나지 않는다
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이 검사가 있는가
     같은 자료를 두 앱이 각각 세면, 한쪽만 고쳐도 아무도 모른다.
     이음센터는 특히 그렇다 — 「누가 몇 번 나갔나」가 외부 노무사·변호사에게
     보내는 근무표와 이어져 있어서, 숫자가 갈리면 밖으로 틀린 것이 나간다.

   ★ 무엇을 지키나
     ① 밖으로 나가는 주소(개인 링크)의 «뿌리»가 두 앱에서 같다
        — 다르면 받은 사람의 링크가 안 열린다. 그 사람은 제 폰을 탓한다.
     ② 「이음 근무」를 가리키는 코드가 같다 (eum-work)
     ③ 외부인·내부인을 가르는 규칙이 같다 (externalId 가 있으면 외부)
     ④ 변호사를 가르는 규칙이 같다 (직책에 「변호사」가 들어가면 변호사)
     ⑤ 그만둔 사람을 «지우지 않는다» — 기록이 있으면 회색으로 남긴다

   ⚠ 이 검사는 «규칙»을 본다. 글자 크기·색·줄 순서는 안 본다(다듬어도 안 깨지게). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const ROOT = path.join(__dirname, '..');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const 캘린더원문 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
/* 주석에 적어 둔 설명이 검사를 통과시키면 안 된다 */
const 캘린더 = 주석걷기(캘린더원문);
const 이알피코드 = 주석걷기(이알피);

// ── ① 밖으로 나가는 주소 ──────────────────────────────────────────────
test('개인 링크의 뿌리 주소가 이알피와 같다 — 다르면 받은 링크가 안 열린다', () => {
  const 뽑기 = (src) => {
    const m = src.match(/IEUM_VIEW_BASE\s*=\s*'([^']+)'/);
    assert.ok(m, 'IEUM_VIEW_BASE 를 못 찾았습니다');
    return m[1];
  };
  assert.strictEqual(뽑기(캘린더), 뽑기(이알피코드));
});

test('https 가 아니면 배포 주소로 물러선다 — nullxxx 같은 주소를 내보내지 않는다', () => {
  assert.match(캘린더, /location\.protocol\s*===\s*["']https:["']/,
    '지금 주소를 그대로 쓰고 있습니다 — 파일로 열면 못 쓰는 링크가 나옵니다');
  assert.match(캘린더, /IEUM_VIEW_BASE/, '물러설 자리가 없습니다');
});

test('링크는 열쇠를 «감싸서» 붙인다 — 열쇠에 이상한 글자가 있어도 주소가 안 깨진다', () => {
  assert.match(캘린더, /encodeURIComponent\(\s*x\.shareKey\s*\)/);
});

// ── ②③④ 가르는 규칙 ─────────────────────────────────────────────────
test('「이음 근무」를 가리키는 코드가 같다', () => {
  assert.match(캘린더, /["']eum-work["']/, '캘린더가 eum-work 를 안 씁니다');
  assert.match(이알피코드, /["']eum-work["']/);
});

test('외부인은 externalId 로 가른다 — 두 앱이 같은 눈으로 본다', () => {
  assert.match(캘린더, /externalId/, '캘린더가 외부인을 안 가릅니다');
  // 사람 열쇠: 외부면 externalId, 아니면 사번 — 이알피와 같은 차례여야 한다
  assert.match(캘린더, /r\.externalId\s*\|\|\s*r\.sid/,
    '사람 열쇠를 외부→내부 차례로 안 고르고 있습니다');
  assert.match(이알피코드, /r\.externalId\s*\|\|\s*r\.sid/);
});

test('변호사는 직책에 「변호사」가 들어가는지로 가른다', () => {
  const 꼴 = /indexOf\(\s*["']변호사["']\s*\)\s*>=?\s*0/;
  assert.match(캘린더, 꼴, '캘린더가 변호사를 안 가릅니다');
  assert.match(이알피코드, 꼴);
});

test('내부 노무사는 직급·직책에 「노무사」가 들어가면 늘 넣는다', () => {
  assert.match(캘린더, /indexOf\(\s*["']노무사["']\s*\)\s*>=?\s*0/);
});

// ── ⑤ 그만둔 사람 ─────────────────────────────────────────────────────
/* ⚠ 글자만 보면 이빨이 없다 — 실제로 겪었다(2026-09-18).
     「left:true」가 두 군데(내부·외부)에 있어서, 한쪽을 지워도 검사가 통과했다.
     그래서 이 함수를 «떼어 와 실제로 돌린다». */
const vm = require('node:vm');
function 사람목록(자료) {
  const i = 캘린더원문.indexOf('function ieumPeople()');
  assert.ok(i >= 0, 'ieumPeople 을 못 찾았습니다');
  let d = 0, 끝 = -1;
  for (let k = 캘린더원문.indexOf('{', i); k < 캘린더원문.length; k++) {
    if (캘린더원문[k] === '{') d++;
    else if (캘린더원문[k] === '}') { d--; if (d === 0) { 끝 = k + 1; break; } }
  }
  const 몸 = 캘린더원문.slice(i, 끝);
  const 상자 = {
    D: 자료,
    arr: (v) => (Array.isArray(v) ? v : []),
    users: () => (Array.isArray(자료.user_accounts) ? 자료.user_accounts : []),
    colorOf: () => null,
    String, Object, Array, JSON
  };
  vm.createContext(상자);
  vm.runInContext(몸 + '\nvar __r = ieumPeople();', 상자);
  // 상자 «안에서» 만들어진 것이라 겉이 같아도 deepEqual 이 튕긴다 — 글자로 맞댄다
  return JSON.parse(JSON.stringify(상자.__r));
}

test('그만둔 사람을 지우지 않는다 — 내부·외부 «둘 다»', () => {
  const 사람들 = 사람목록({
    user_accounts: [
      { sid: 'S001', name: '홍길동', role: '노무사', status: 'active' },
      { sid: 'S009', name: '김퇴사', role: '노무사', status: 'retired' }
    ],
    external_staff: [
      { id: 'x1', name: '이순신', role: '변호사' },
      { id: 'x9', name: '강종료', role: '노무사', active: false }
    ],
    attendance_records: [
      { type: 'eum-work', sid: 'S009', date: '2025-03-04' },
      { type: 'eum-work', externalId: 'x9', date: '2025-05-06' }
    ],
    ieum_notes: {}
  });
  const 이름 = 사람들.map((p) => p.name);
  assert.ok(이름.indexOf('김퇴사') >= 0, '그만둔 «내부» 직원이 사라졌습니다 — 지나간 근무가 셈에서 빠집니다');
  assert.ok(이름.indexOf('강종료') >= 0, '끝난 «외부» 인원이 사라졌습니다');
  사람들.filter((p) => p.name === '김퇴사' || p.name === '강종료')
    .forEach((p) => assert.strictEqual(p.left, true, p.name + ' 에 그만둔 표시가 없습니다'));
});

test('기록이 «없는» 사람까지 끌어오지는 않는다 — 명단이 부풀면 아무 뜻이 없다', () => {
  const 사람들 = 사람목록({
    user_accounts: [{ sid: 'S008', name: '박옛사람', role: '컨설턴트', status: 'retired' }],
    external_staff: [{ id: 'x8', name: '최종료', role: '노무사', active: false }],
    attendance_records: [],
    ieum_notes: {}
  });
  assert.deepStrictEqual(사람들.map((p) => p.name), [],
    '이음 근무 기록이 없는 그만둔 사람까지 넣고 있습니다');
});

test('변호사와 외부 노무사를 갈라 놓는다', () => {
  const 사람들 = 사람목록({
    user_accounts: [],
    external_staff: [{ id: 'x1', name: '이순신', role: '변호사' }, { id: 'x2', name: '강감찬', role: '노무사' }],
    attendance_records: [], ieum_notes: {}
  });
  const 지도 = {}; 사람들.forEach((p) => { 지도[p.name] = p.kind; });
  assert.strictEqual(지도['이순신'], 'law');
  assert.strictEqual(지도['강감찬'], 'ex');
});

test('그만둔 사람은 기본으로 숨기되 «몇 명인지»는 늘 보인다', () => {
  assert.match(캘린더, /showLeft/, '펼치는 길이 없습니다');
  assert.match(캘린더, /그만둔 사람/, '몇 명인지 알려 주지 않습니다');
});

// ── 이 화면이 «읽기»임을 숨기지 않는다 ────────────────────────────────
test('고치는 자리는 이알피로 보낸다 — «못 한다»가 아니라 «저기서 한다»', () => {
  // 글자열 안에 든 값이라 따옴표가 벗어남표와 함께 온다 — 값만 본다.
  assert.match(캘린더, /data-erp=\\?["']dash\/ieum/,
    '이음 화면에서 이알피로 가는 길이 없습니다');
});

test('링크 복사가 안 될 때 «됐다»고 하지 않는다', () => {
  const i = 캘린더.indexOf('function copyLink');
  assert.ok(i >= 0, 'copyLink 가 없습니다');
  const 몸 = 캘린더.slice(i, i + 700);
  assert.match(몸, /복사가 안 됩니다|직접 복사/,
    '복사 실패를 알리지 않습니다 — 말만 뜨고 안 붙는 것이 가장 나쁩니다');
});

// ── 셈이 맞는가 (범위) ────────────────────────────────────────────────
test('범위는 월·연·전체 셋이고, 월은 앞 7글자로 가른다', () => {
  const i = 캘린더.indexOf('function inScope');
  assert.ok(i >= 0, 'inScope 가 없습니다');
  const 몸 = 캘린더.slice(i, i + 420);
  // 검사고정-허용: 4 와 7 은 «지금 값»이 아니라 날짜 꼴(YYYY-MM-DD)의 자리다.
  assert.match(몸, /slice\(0\s*,\s*4\)/, '연을 앞 4글자로 안 봅니다');
  assert.match(몸, /slice\(0\s*,\s*7\)/, '월을 앞 7글자로 안 봅니다');
  assert.match(몸, /["']all["']/, '전체 범위가 없습니다');
});
