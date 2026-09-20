/* 이음센터 «공개 일정»은 한 곳에서 만든다 — 캘린더 한 곳으로 모으기 2걸음
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「0부터 순서대로」 → 2걸음.

   ★ 여기서 고친 진짜 고장
     외부 변호사에게 드리는 공유 링크가 읽는 자리(ieum_public)를 «만드는 일»이
     이알피에만 걸려 있었다. 그런데 이음 근무를 «푸른 캘린더에서도» 고치게 되면서
     (1걸음), 캘린더에서 고친 것은 공개 뷰에 안 따라갔다 — 이알피 이음센터 화면을
     열어야만 다시 발행됐다. 외부 사람 눈에는 옛 일정이 그대로 떠 있었다.

   ★ 지키려는 것
     ① 만드는 셈이 «한 곳»(js/pu-ieum-public.js)이다 — 두 앱이 그것을 부른다
     ② 담기는 것은 이름·날짜·구분 셋뿐이다 — 연락처·사번은 절대 안 담는다
     ③ 캘린더에서 이음 근무를 고치면 «저절로» 다시 발행한다
     ④ 링크 재발급은 되돌릴 수 없으니 한 번 묻는다 · 관리자만 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pu-ieum-public.js'));
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

const 본보기 = {
  attendance: [
    { id: 'a1', type: 'eum-work', date: '2026-09-24', externalId: 'x-law' },
    { id: 'a2', type: 'eum-work', date: '2026-09-24', sid: 'P-001' },
    { id: 'a3', type: 'eum-work', date: '2026-09-25', externalId: 'x-nomu' },
    { id: 'a4', type: 'leave', date: '2026-09-26', sid: 'P-001' },          // 연차는 안 담는다
    { id: 'a5', type: 'eum-work', date: '2024-01-02', sid: 'P-001' },       // 너무 옛것
    { id: 'a6', type: 'eum-work', date: '2026-09-27', externalId: 'x-없음' } // 없는 사람
  ],
  users: [{ sid: 'P-001', name: '홍길동', phone: '010-0000-0000' }],
  externals: [
    { id: 'x-law', name: '김변호', role: '변호사', shareKey: 'kkk111', contact: '010-1111-2222' },
    { id: 'x-nomu', name: '이노무', role: '노무사', shareKey: 'nnn222', contact: '010-3333-4444' },
    { id: 'x-old', name: '박퇴장', role: '변호사', shareKey: 'ooo333', active: false }
  ],
  year: 2026
};

test('① 만드는 셈이 «한 곳»이다 — 이알피가 그 파일을 부른다', () => {
  assert.match(ERP, /<script src="js\/pu-ieum-public\.js\?v=\d+"><\/script>/,
    '이알피가 공개 일정 만들개를 안 싣습니다');
  assert.match(CAL, /<script src="js\/pu-ieum-public\.js\?v=\d+"><\/script>/,
    '푸른 캘린더가 공개 일정 만들개를 안 싣습니다');
  assert.match(ERP, /PuIeumPublic\.publish\(/, '이알피가 만들개를 안 부릅니다');
  assert.match(CAL, /PuIeumPublic\.publish\(/, '푸른 캘린더가 만들개를 안 부릅니다');
});

test('②★ 이알피 안에 «옛 셈»이 남아 있지 않다 — 남으면 두 벌이 되어 갈린다', () => {
  const i = ERP.indexOf('function ieumPublishPublic(');
  assert.ok(i > 0, 'ieumPublishPublic 을 못 찾았습니다');
  const 몸 = ERP.slice(i, ERP.indexOf('\nfunction ', i + 10));
  assert.strictEqual(/roster\[r\.date\]\s*=/.test(몸), false,
    '이알피가 아직 제 손으로 roster 를 만듭니다 — 만들개와 두 벌이 됩니다');
  assert.strictEqual(/people\[x\.shareKey\]/.test(몸), false,
    '이알피가 아직 제 손으로 people 을 만듭니다');
});

test('③ 담기는 것은 이름·날짜·구분 셋뿐 — 연락처·사번은 안 담는다', () => {
  const r = P.build(본보기);
  const 글 = JSON.stringify(r);
  assert.strictEqual(/010-/.test(글), false, '★ 연락처가 공개 자료에 들어갔습니다: ' + 글);
  assert.strictEqual(/P-001/.test(글), false, '★ 사번이 공개 자료에 들어갔습니다: ' + 글);
  assert.strictEqual(/x-law|x-nomu/.test(글), false, '★ 외부인원 번호가 들어갔습니다: ' + 글);
  /* 한 줄에 있는 칸도 둘뿐이어야 한다 */
  const 첫줄 = r.roster['2026-09-24'][0];
  assert.deepStrictEqual(Object.keys(첫줄).sort(), ['k', 'n'], '칸이 늘었습니다: ' + JSON.stringify(첫줄));
});

test('④ 누가 어느 무리인가 — 변호사·그 밖 외부·우리 직원', () => {
  const r = P.build(본보기);
  const 스물넷 = r.roster['2026-09-24'];
  assert.strictEqual(스물넷.length, 2, '그 날 두 사람이어야 합니다');
  assert.deepStrictEqual(스물넷.map((x) => x.n + ':' + x.k).sort(), ['김변호:law', '홍길동:in']);
  assert.strictEqual(r.roster['2026-09-25'][0].k, 'ex', '노무사는 ex 여야 합니다');
});

test('⑤ 안 담는 것 — 연차·너무 옛것·없는 사람', () => {
  const r = P.build(본보기);
  assert.ok(!r.roster['2026-09-26'], '연차를 담았습니다');
  assert.ok(!r.roster['2024-01-02'], '지지난해 것을 담았습니다');
  assert.ok(!r.roster['2026-09-27'], '없는 외부인원의 근무를 담았습니다');
});

test('⑥ 링크 목록 — 지금 일하는 사람만, 열쇠가 있는 사람만', () => {
  const r = P.build(본보기);
  assert.deepStrictEqual(Object.keys(r.people).sort(), ['kkk111', 'nnn222'],
    '그만둔 사람 링크가 남아 있습니다: ' + JSON.stringify(r.people));
  assert.deepStrictEqual(r.people.kkk111, { name: '김변호' }, '이름 말고 다른 것이 들어갔습니다');
});

test('⑦ 올리는 자리는 ieum_public 한 곳 · 언제 올렸는지 함께 적는다', async () => {
  let 자리 = '', 값 = null;
  await P.publish({ ref: (p) => ({ set: (v) => { 자리 = p; 값 = v; return Promise.resolve(); } }) }, 본보기);
  assert.strictEqual(자리, 'ieum_public', '엉뚱한 자리에 올립니다: ' + 자리);
  assert.ok(값.roster && 값.people, '만든 것을 안 올립니다');
  assert.strictEqual(typeof 값.updatedAt, 'number', '언제 올렸는지를 안 적습니다');
});

test('⑧★ 캘린더에서 이음 근무를 고치면 «저절로» 다시 발행한다', () => {
  /* 이것이 이번에 고친 고장이다 — 안 걸면 외부 사람 눈에 옛 일정이 그대로 뜬다 */
  assert.match(CAL, /if\(store === "attendance_records"\) 발행예약\(\);/,
    '넣고 고친 뒤 다시 발행하지 않습니다');
  assert.match(CAL, /if\(st === "attendance_records"\) 발행예약\(\);/,
    '지운 뒤 다시 발행하지 않습니다');
  /* 이알피처럼 «모아서 한 번» — 잇따라 고칠 때마다 올리지 않는다 */
  const i = CAL.indexOf('function 발행예약(){');
  assert.ok(i > 0, '발행예약 을 못 찾았습니다');
  const 몸 = CAL.slice(i, CAL.indexOf('\nfunction ', i + 10));
  assert.match(몸, /clearTimeout/, '모아서 한 번 올리지 않습니다 — 고칠 때마다 올라갑니다');
});

test('⑨ 링크 재발급 — 되돌릴 수 없으니 묻고, 관리자만', () => {
  const i = CAL.indexOf('function 링크발급(extId){');
  assert.ok(i > 0, '링크발급 을 못 찾았습니다');
  const 몸 = CAL.slice(i, CAL.indexOf('\nfunction ', i + 10));
  assert.match(몸, /잇기할수있나\(\)/, '관리자인지 안 봅니다');
  assert.match(몸, /confirm\(/, '재발급 전에 안 묻습니다 — 지금 링크가 조용히 죽습니다');
  assert.match(몸, /PuCalWrite\.save\("external_staff"/, '저장 문을 안 지납니다');
  assert.match(몸, /PuIeumPublic\.newShareKey\(\)/, '열쇠를 제 손으로 짓습니다 — 만들개 것을 쓰세요');
  assert.match(몸, /발행하기\(true\)/, '발급 뒤 공개 자료를 안 올립니다 — 새 링크가 안 열립니다');
});

test('⑩ 지난해 것부터 담는다 — 연말·연초에 지난달이 사라지지 않게', () => {
  const r = P.build({
    attendance: [{ id: 'a', type: 'eum-work', date: '2025-12-30', sid: 'P-001' }],
    users: [{ sid: 'P-001', name: '홍길동' }], externals: [], year: 2026
  });
  assert.ok(r.roster['2025-12-30'], '지난해 12월 것이 빠졌습니다 — 1월에 지난달을 못 봅니다');
});
