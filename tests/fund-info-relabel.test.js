'use strict';
/* 기금 정보 화면 — 이름표를 한글 원본 서식 용어로, 자리를 서식 차례로 (대표 지시 2026-09-27)
 *
 *   「한글 화일의 이름을 기준으로 캡쳐의 용어나 단어를 변경할 수 있나」
 *   「주사무소를 기금법인 명칭 아래에 넣는것은 어떤가? 그리고 관할연락에서,
 *    1 관할지방고용노동청, 2 관할등기소 3 관할세무서 로 순서 변경 해달라.」
 *   「소재지는 한줄로 만들면 안되나?」
 *
 * ⚠ 이 파일은 «자리·이름표»만 본다 — 값이 어디서 오는지(HWP_TPL_VALUES 등)는
 *   tests/fund-hwp-*.test.js 가 맡는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}
function fieldsArr() {
  const box = {};
  new Function(grabDecl('FIELDS') + ';this.F=FIELDS;').call(box);
  return box.F;
}
function keyOrder(arr) { return arr.map((c) => c[0]); }
function labelOf(arr, key) { return (arr.filter((c) => c[0] === key)[0] || [])[1]; }

/* ══ ① 이름표 — 한글 원본 서식(설립인가신청서 별지 제7호 등)이 쓰는 말 ══ */

test('★★ 이름표가 한글 원본 서식의 말과 같다', () => {
  const F = fieldsArr();
  const want = {
    name: '기금법인 명칭', chairman: '대표자 성명', inka_no: '기금인가번호', inka_date: '인가일자',
    labor_office: '관할 지방고용노동청', phone: '전화번호', address: '주사무소 소재지',
    meeting_date: '설립준비위원회 회의일'
  };
  Object.keys(want).forEach((k) => {
    assert.equal(labelOf(F, k), want[k], '★ ' + k + ' 이름표가 서식 말과 다르다');
  });
});

/* ══ ② 자리 — 서식 차례(명칭→주사무소 소재지→전화번호), 관할은 노동청·등기소·세무서 ══ */

test('★★ 주사무소 소재지·전화번호가 «기본» 묶음(담당보다 앞)으로 옮겨졌다', () => {
  const order = keyOrder(fieldsArr());
  const iRegion = order.indexOf('region'), iAddress = order.indexOf('address'),
    iPhone = order.indexOf('phone'), iManager = order.indexOf('manager');
  assert.ok(iRegion >= 0 && iAddress >= 0 && iPhone >= 0 && iManager >= 0, '칸이 하나라도 없다');
  assert.ok(iRegion < iAddress && iAddress < iManager,
    '★ 소재지가 「기본」 묶음(담당보다 앞) 밖에 있다');
  assert.ok(iRegion < iPhone && iPhone < iManager,
    '★ 전화번호가 「기본」 묶음 밖에 있다');
});

test('★★ 관할 세 칸이 «관할 지방고용노동청 → 관할등기소 → 관할세무서» 차례다', () => {
  const order = keyOrder(fieldsArr());
  const iLabor = order.indexOf('labor_office'), iReg = order.indexOf('registry_office'),
    iTax = order.indexOf('tax_office');
  assert.ok(iLabor >= 0 && iReg >= 0 && iTax >= 0, '관할 칸이 하나라도 없다');
  assert.ok(iLabor < iReg && iReg < iTax,
    '★ 대표 지시(노동청·등기소·세무서 차례)와 다르다');
});

/* ══ ③ 묶음 머리 — 「관할·연락」이 「관할」로, 머리 칸도 labor_office로 옮겨졌다 ══ */

test('★★ 「관할」 묶음 머리는 labor_office 다 — tax_office 가 아니다', () => {
  const box = {};
  new Function(grabDecl('INFO_SECS') + ';this.S=INFO_SECS;').call(box);
  assert.equal(box.S.labor_office, '관할', '★ 묶음 이름이 「관할」이 아니다');
  assert.equal(box.S.tax_office, undefined,
    '★ tax_office 가 여전히 묶음 머리다 — 소재지·전화번호를 옮기면서 관할엔 세 칸만 남았다');
});

/* ══ ④ 접는 묶음 머리 — 묶음 이름을 두 번 적지 않는다 ══ */

test('★ 접는 묶음의 안내가 묶음 이름을 되풀이하지 않는다', () => {
  const box = {};
  new Function(grabDecl('INFO_SECS') + ';' + grabDecl('INFO_FOLD')
    + ';this.SECS=INFO_SECS;this.FOLD=INFO_FOLD;').call(box);
  Object.keys(box.FOLD).forEach((k) => {
    const label = box.SECS[k], fold = String(box.FOLD[k]);
    assert.ok(label, '★ ' + k + ' 이 묶음 머리가 아니다');
    /* 머리 렌더는 g.label+' · '+g.fold — fold 가 label 로 «시작»하면
       「사무소 임대차 · 사무소 임대차 — …」처럼 겹친다(2026-09-27 이전 실제 버그). */
    assert.ok(fold.indexOf(label) !== 0,
      '★ ' + k + ' 의 접기 안내(' + fold + ')가 묶음 이름(' + label + ')으로 시작해 '
      + '「' + label + ' · ' + label + ' — …」처럼 겹친다');
  });
});

/* ══ ⑤ 소재지 — 우편번호·검색·도로명주소가 «한 줄»(가로 flex, 세로로 쌓지 않는다) ══ */

test('★★ 소재지(_addrStack) CSS 가 «한 줄»이다 — 세로로 쌓지 않는다', () => {
  const m = SRC.match(/\.addrstack\{[^}]*\}/);
  assert.ok(m, '.addrstack 규칙이 없다');
  assert.ok(!/flex-direction:\s*column/.test(m[0]),
    '★ .addrstack 이 아직 세로(column)다 — 한 줄로 바뀌지 않았다');
  assert.match(m[0], /display:\s*flex/, '.addrstack 이 flex 가 아니다');
});
