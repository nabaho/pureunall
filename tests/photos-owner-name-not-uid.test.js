'use strict';
/* 사진첩 사람 목록에 «번호»가 이름 대신 뜨던 것 (대표 지시 2026-10-06 「에러났다 고쳐라」)

   ★ 무엇이 잘못됐었나 (실측)
     사람 고르기 창에 「HVp8SMqMGVO8aUzH6SNYU6aTQVE3」(28자 번호)가 그대로 떴다.
     그 번호의 주인은 사번 A-001(최기운) — 직원 명단에는 이름이 있는데,
     사진첩 owners 에 적힌 이름이 «빈 글자»였다(puphotos/owners/{uid}.name = "").
       ① owners 가 비면 그 자리에 번호를 넣었다        (name || uid)
       ② 직원 명단이 이름을 넣으려 해도 「이미 있다」며 막혔다 (if (ownerNames[uid]) return)
          — 번호도 «있는 것»으로 셌다.
     그래서 두 장치가 서로 부딪쳐 진짜 이름이 영영 못 들어왔다.

   ★ 더 나쁜 자리: 보유기준 점검 담당자 고르개는 «고른 줄의 글자»를 담당자 이름으로
     그대로 저장한다 — 번호가 뜨면 번호가 이름으로 저장된다.

   ⚠ 글자(「(이름 모름)」)를 박지 않는다 — 「번호가 이름으로 나오지 않는가 · 진짜 이름이
     번호에 안 막히는가」만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const 사진첩 = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
const UID = 'HVp8SMqMGVO8aUzH6SNYU6aTQVE3';          /* 실제 모양의 번호 — 이름이 아니다 */

/* 이름표 함수들을 «실제로» 돌린다 */
function 싣기(직원명단) {
  const 상자 = {
    PuPhotoStore: { listStaff: () => Promise.resolve(직원명단) },
    console: { warn() {} },
    Promise, Object, String,
  };
  vm.createContext(상자);
  vm.runInContext('var ownerNames = {};', 상자);
  ['function ownerNameReal(', 'function ownerNameOf(', 'function mergeStaffNames('].forEach((앞) => {
    vm.runInContext(cutFn(사진첩, 앞), 상자);
  });
  return 상자;
}

test('★ 이름이 빈 사람은 직원 명단의 진짜 이름이 들어온다 — 번호가 이름을 막지 않는다', async () => {
  const 상자 = 싣기({ [UID]: { sid: 'A-001', name: '최기운' } });
  /* 사진첩 owners 의 이름이 «빈 글자»인 사람 — 화면이 이렇게 채운다(번호를 안 넣는다) */
  vm.runInContext("ownerNames['" + UID + "'] = '';", 상자);
  await vm.runInContext('mergeStaffNames()', 상자);
  assert.equal(vm.runInContext("ownerNameOf('" + UID + "')", 상자), '최기운');
});

test('★ 이름 자리에 번호가 «이미» 들어가 있어도 진짜 이름이 덮는다 (옛 코드가 남긴 모양)', async () => {
  const 상자 = 싣기({ [UID]: { sid: 'A-001', name: '최기운' } });
  vm.runInContext("ownerNames['" + UID + "'] = '" + UID + "';", 상자);
  await vm.runInContext('mergeStaffNames()', 상자);
  assert.equal(vm.runInContext("ownerNameOf('" + UID + "')", 상자), '최기운',
    '번호를 「있는 이름」으로 세면 진짜 이름이 영영 못 들어온다');
});

test('★ 이름을 끝내 모르면 번호를 내지 않는다', () => {
  const 상자 = 싣기({});
  vm.runInContext("ownerNames['" + UID + "'] = '';", 상자);
  const 글 = vm.runInContext("ownerNameOf('" + UID + "')", 상자);
  assert.notEqual(글, UID, '번호가 그대로 화면에 나온다');
  assert.ok(!글.includes(UID.slice(0, 8)), '번호 조각이 새어 나온다');
  assert.ok(글.trim().length > 0, '빈 글자가 되면 줄이 안 보인다');
  /* 번호가 이름 자리에 «들어 있어도» 이름으로 안 센다 */
  vm.runInContext("ownerNames['" + UID + "'] = '" + UID + "';", 상자);
  assert.notEqual(vm.runInContext("ownerNameOf('" + UID + "')", 상자), UID);
});

test('이미 진짜 이름이 있으면 직원 명단이 덮지 않는다 — 사람이 적어 둔 이름표가 먼저다', async () => {
  const 상자 = 싣기({ [UID]: { sid: 'A-001', name: '직원명단이름' } });
  vm.runInContext("ownerNames['" + UID + "'] = '본인이 적은 이름';", 상자);
  await vm.runInContext('mergeStaffNames()', 상자);
  assert.equal(vm.runInContext("ownerNameOf('" + UID + "')", 상자), '본인이 적은 이름');
});

test('이름이 없고 사번만 있으면 사번을 낸다 — 번호보다 낫다', async () => {
  const 상자 = 싣기({ [UID]: { sid: 'A-001', name: '' } });
  vm.runInContext("ownerNames['" + UID + "'] = '';", 상자);
  await vm.runInContext('mergeStaffNames()', 상자);
  assert.equal(vm.runInContext("ownerNameOf('" + UID + "')", 상자), 'A-001');
});

/* ── 소스 — 번호를 이름처럼 내던 자리가 «다시 생기지 않는다» ───────────────── */

function 주석걷기(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }

test('★ 이름표를 채울 때 번호를 이름 자리에 넣지 않는다', () => {
  const 글 = 주석걷기(사진첩);
  assert.ok(!/ownerNames\[[^\]]+\]\s*=\s*[^;]*\|\|\s*(k|uid|u)\s*[;)]/.test(글),
    'ownerNames[…] = … || 번호 — 번호가 이름 자리로 들어간다');
  assert.ok(!/owners\[k\]\s*&&\s*owners\[k\]\.name\)\s*\|\|\s*k\b/.test(글),
    'owners[k].name || k — 이름이 비면 번호가 글자로 뜬다');
});

test('★ 이름을 «보여 주는» 자리는 모두 ownerNameOf 를 거친다 — 번호 폴백이 없다', () => {
  const 글 = 주석걷기(사진첩);
  const 남은 = 글.match(/ownerNames\[[^\]]+\]\s*\|\|\s*[a-z]\w*/g) || [];
  assert.deepEqual(남은, [], '이름 뒤에 번호를 폴백으로 붙인 자리가 남았다: ' + 남은.join(' , '));
});

test('★ 보유기준 점검 담당자 고르개 — 이름을 모르는 사람은 목록에 안 넣는다', () => {
  /* 이 고르개는 «고른 줄의 글자»를 담당자 이름으로 그대로 저장한다(setRetOwner) —
     번호가 뜨면 번호가 이름으로 저장된다. */
  const 자리 = 사진첩.indexOf('— 담당자 정하기 —');
  assert.ok(자리 > 0, '담당자 고르개를 못 찾았다');
  const 근처 = 사진첩.slice(Math.max(0, 자리 - 900), 자리 + 600);
  assert.match(근처, /\.filter\(function \(k\) \{ return !!ownerNameReal\(k\); \}\)/,
    '이름을 모르는 사람을 «거르지» 않으면 번호(또는 이름 모름)가 담당자 이름으로 저장된다');
  assert.match(근처, /esc\(ownerNameReal\(k\)\)/, '줄 글자는 진짜 이름이어야 한다');
  assert.match(근처, /mergeStaffNames\(\)/, '직원 명단이 이름을 채운 «뒤에» 그려야 한다');
});

test('관리자 고르개는 이름이 채워진 뒤 «줄 글자만» 바꿔 쓴다 — 고르던 값이 튀지 않는다', () => {
  const 몸 = cutFn(사진첩, 'function relabelOwnerOptions(');
  assert.ok(몸, 'relabelOwnerOptions 가 없다');
  assert.ok(!/innerHTML\s*=/.test(몸), '고르개를 통째로 다시 만들면 고르던 값이 튄다');
  assert.match(사진첩, /mergeStaffNames\(\)\.then\(relabelOwnerOptions\)/, '이름이 채워진 뒤 줄 글자를 안 바꾼다');
});
