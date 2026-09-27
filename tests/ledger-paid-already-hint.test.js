'use strict';
/* 「이미 받음으로 적힌 건」 안내 — 후보가 하나도 없을 때만
   (건의 2026-09-10 김보람 「2025년도 수임 사건 2026년도에 보수 이체되었을 경우 매칭이 안됩니다」
    대표 지시 2026-09-14 「넣어」)

   ■ 무엇이 문제였나 — 고장이 아니라 «아무 말도 안 해 준» 것이다
     매칭 후보는 erpUnpaidParts 가 고른다. 거기서는
       if(it[flagKey] || it[dateKey]) return true;   // 날짜만 찍혀도 «다 받은 것»
     이라서, 지난 건을 넣으며 입금일을 «함께» 적으면 그 건은 후보에서 사라진다.

   ■ ★★ 실측 2026-09-14 (임금체불-2025-001 · 성공보수 6,000,000 · 신유정)
     · 지금 그대로 → 후보 []
     · 성공보수 입금일만 빼고 → 후보 ["성공보수 6,000,000원"]
     통장 줄(2026-02-02 18:42:48 · 6,000,000)은 «있었다». 그런데 화면에는 후보도 없고
     🔁 표시(자문수입에 «확정된» 기록을 보는 것)도 없었다 — 그 기록이 아직 없었으니까.
     그래서 「왜 안 되지」만 남았다. 이 안내가 그 빈자리를 채운다.

   ■ 이 검사가 지키는 것
     ① 후보가 «하나도 없을 때»만 본다 — 진짜 후보를 밀어내지 않는다
     ② 「이미 받음」으로 적힌 것만 본다 — 안 받은 것은 이미 후보로 뜬다
     ③ %(요율)·0원은 뺀다 · 부가세 별도면 ×1.1 도 견준다 · 날짜 창이 있다
     ④ ★★ 안내«만» 한다 — 자료를 건드리면 돈이 두 번 잡힌다
     ⑤ 할 일까지 적는다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments, stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = stripComments(src);
const 찾기 = stripJs(cutFn(src, 'function erpPaidAlreadyHint('));

test('① ★★ 후보가 «하나도 없을 때»만 본다 — 진짜 후보를 밀어내지 않는다', function () {
  const 묶음 = stripJs(cutFn(src, 'function erpBuildSugChunk('));
  assert.match(묶음, /if\(!_sg\.length\) out\.paidHint\[row\._k\] = erpPaidAlreadyHint\(/,
    '★★ 후보가 있어도 이 안내를 계산합니다 — 진짜 후보를 밀어냅니다');
  /* 그릇이 없으면 화면이 그 자리에서 죽는다 */
  const 초기 = stripJs(cutFn(src, 'function erpBuildSugInit('));
  assert.match(초기, /paidHint:\{\}/, '★ 그릇(paidHint)을 안 만듭니다');
});

test('② ★★ 「이미 받음」으로 적힌 것만 본다', function () {
  /* 안 받은 것은 이미 매칭 후보로 뜬다 — 여기서 또 보여 주면 두 번 뜬다 */
  assert.match(찾기, /if\(!\(it\[flagKey\] \|\| it\[dateKey\]\)\) return;/,
    '★★ 아직 «안 받은» 것까지 이 안내로 보여 줍니다 — 같은 것이 두 자리에 뜹니다');
});

test('③ ★ 셈에서 빼야 할 것을 뺀다 — %·0원·먼 날짜, 그리고 부가세', function () {
  assert.match(찾기, /successFeeType === 'percent'/,
    '★★ 성공보수 %(요율)를 금액으로 셉니다 — 요율에는 부가세도 금액도 없습니다');
  assert.match(찾기, /if\(fee <= 0\) return;/, '★ 0원도 셉니다');
  assert.match(찾기, /it\[vatKey\] \? fee : Math\.round\(fee \* 1\.1\)/,
    '★★ 부가세 별도인 건을 못 찾습니다 — 통장에 들어온 돈은 ×1.1 입니다');
  assert.match(찾기, /if\(gap === null \|\| gap > win\) return;/,
    '★★ 날짜를 안 봅니다 — 금액만 같으면 «아무 때나» 이어 버립니다');
});

test('④ ★★ 안내«만» 한다 — 자료를 건드리지 않는다', function () {
  /* 이미 받은 것을 또 확정하면 돈이 두 번 잡힌다. 이 자리는 «읽기»뿐이어야 한다. */
  assert.ok(!/dbSet\(|dbPatch\(|dbUpsert\(|dbRemove\(/.test(찾기),
    '★★ 안내하는 자리에서 자료를 씁니다 — 이미 받은 것을 또 잡으면 돈이 두 번 셉니다');
  assert.match(찾기, /dbGet\(S\[0\], \[\]\)/, '★ 자료를 읽는 자리가 바뀌었습니다');
});

test('⑤ ★ 무엇을 하면 되는지까지 적는다', function () {
  const at = bare.indexOf("'✅ 이미 받음으로 적힌 건 — '");
  assert.ok(at > 0, '★★ 화면에 안 그립니다 — 찾아 놓고 말하지 않습니다');
  const 둘레 = bare.slice(Math.max(0, at - 900), at + 200);
  assert.match(둘레, /처리됨/,
    '★★ 「그래서 어떻게 하라」가 없습니다 — 이 방에서 여러 번 밟은 자리입니다');
  assert.match(둘레, /두 번 잡힙니다|두 번 셉니다/,
    '★★ 다시 확정하면 안 된다는 말이 없습니다 — 돈이 두 번 잡힙니다');
});
