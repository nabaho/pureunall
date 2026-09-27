'use strict';
/* ✍ 아무 칸이나 고치기 (대표 지시 2026-09-13)
   ─────────────────────────────────────────────────────────────
   대표 물음: 「필요하면 직접 타이핑이 가능해야 되는데 그건 왜 안 되나
   그리고 타이핑하면서 불필요한 부분은 삭제하면 되는데 이게 왜 안 되나」

   ■ 왜 안 됐나 — 실측
     글자가 든 칸은 «옆칸이나 윗칸이 우리가 아는 라벨일 때»만 고칠 자리로 잡았다.
     그래서 같은 표라도 말만 낯설면 칠 수 있는 칸이 절반으로 줄었다:
       「성 명 | 홍길동」      → 홍길동을 고칠 수 있다 (성명을 안다)
       「부르는 이름 | 홍길동」 → 못 고친다            (부르는 이름을 모른다)
     즉 «사전이 모르는 서식일수록» 손으로 칠 길도 함께 막혔다 — 가장 필요한 때에.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 켜면 표의 모든 칸을 칠 수 있다 — 사전이 몰라도
     ② 기본은 꺼짐이다 — 늘 켜 두면 서식 문구 위에 입력칸이 얹힌다
     ③ 켜도 «자동 채우기»는 그 칸을 안 건드린다 — 기관 문구가 덮이면 안 된다
     ④ 친 값이 실제로 들어가고, «비우면 비워진다»(삭제가 되어야 한다)
     ⑤ 목록 표(학력·경력) 줄은 그대로 목록이 맡는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments, stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const M = require(path.join(R, 'js', 'kcareer-formmap.js'));
const X = require(path.join(R, 'js', 'kcareer-hwpxfill.js'));
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

function p(t) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0">'
    + '<hp:run charPrIDRef="0"><hp:t>' + (t || '') + '</hp:t></hp:run></hp:p>';
}
function tc(t) {
  return '<hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:subList>' + p(t) + '</hp:subList></hp:tc>';
}
function tr(c) { return '<hp:tr>' + c.join('') + '</hp:tr>'; }
function 표(rows) {
  return '<hs:sec><hp:p><hp:run><hp:tbl id="0" rowCnt="' + rows.length + '" colCnt="4" borderFillIDRef="3">'
    + rows.join('') + '</hp:tbl></hp:run></hp:p></hs:sec>';
}
/* 우리 사전이 «모르는» 말로 된 서식 — 이것이 문제의 자리다 */
const 낯선말 = 표([
  tr([tc('부르는 이름'), tc('홍길동'), tc('세상에 나온 날'), tc('')]),
  tr([tc('닿을 수 있는 곳'), tc(''), tc('전자우편함'), tc('')]),
  tr([tc('그동안 한 일'), tc('가나상사 노무고문으로 일함'), tc('덧붙일 말'), tc('')])
]);

test('① 켜면 표의 «모든 칸»을 칠 수 있다 — 사전이 몰라도', () => {
  const 그냥 = M.scan(낯선말).slots.length;
  const 켜고 = M.scan(낯선말, { all: true }).slots.length;
  assert.equal(켜고, 12, '표의 열두 칸이 모두 자리가 되어야 합니다 (지금 ' + 켜고 + ')');
  assert.ok(켜고 > 그냥, '켜도 늘어난 것이 없습니다 (' + 그냥 + ' → ' + 켜고 + ')');
});

test('②★ 기본은 «꺼짐» — 켜지 않으면 오늘까지와 똑같다', () => {
  const a = M.scan(낯선말).slots.map((s) => s.id).join(',');
  const b = M.scan(낯선말, {}).slots.map((s) => s.id).join(',');
  const c = M.scan(낯선말, { all: false }).slots.map((s) => s.id).join(',');
  assert.equal(a, b, '옵션을 빈 것으로 줬는데 달라졌습니다');
  assert.equal(a, c, 'all:false 인데 달라졌습니다');
  assert.ok(M.scan(낯선말).slots.length < 12, '켜지 않았는데 모든 칸이 자리가 됐습니다');
});

test('③★ 켜도 «자동 채우기»는 그 칸을 안 건드린다 — 기관 문구가 덮이면 안 된다', () => {
  const 지도 = M.guess(M.scan(낯선말, { all: true }), { fields: { name: '홍길동', phone: '010-0000-0000' } });
  지도.slots.filter((s) => s.kind === '아무칸').forEach((s) => {
    assert.equal(s.guess, '', '「' + s.text + '」 칸을 자동으로 채우려 합니다');
  });
  /* 끝까지 — 고른 것 없이 적용하면 한 글자도 안 바뀌어야 한다 */
  const picks = {};
  지도.slots.forEach((s) => { if (s.guess) picks[s.id] = s.guess; });
  const r = M.apply(낯선말, { picks: picks, lists: {}, data: { fields: { name: '홍길동' } } });
  assert.ok(r.xml.indexOf('부르는 이름') >= 0, '서식 문구가 사라졌습니다');
  assert.ok(r.xml.indexOf('그동안 한 일') >= 0, '서식 문구가 사라졌습니다');
});

test('③-2★★ 서식 문구 «위»에 값이 박히지 않는다 — 옆칸이 아는 라벨이어도', () => {
  /* ⚠ 이것이 가장 위험한 모양이다. 「성 명 | 생년월일」처럼 라벨이 나란히 있으면,
     「생년월일」 칸의 왼쪽이 「성 명」(우리가 아는 말)이라 빗장이 없으면
     서식 문구 «생년월일» 위에 홍길동이 박힌다. 그러면 서류가 못 쓰게 된다. */
  const 라벨줄 = 표([
    tr([tc('성 명'), tc('생년월일'), tc('연락처'), tc('이메일')]),
    tr([tc(''), tc(''), tc(''), tc('')])
  ]);
  const 지도 = M.guess(M.scan(라벨줄, { all: true }),
    { fields: { name: '홍길동', birth: '1980.01.01', phone: '010-0000-0000', email: 'a@example.com' } });
  지도.slots.filter((s) => s.kind === '아무칸').forEach((s) => {
    assert.equal(s.guess, '', '서식 문구 「' + s.text + '」 칸에 값을 넣으려 합니다');
  });
  const picks = {};
  지도.slots.forEach((s) => { if (s.guess) picks[s.id] = s.guess; });
  const r = M.apply(라벨줄, { picks: picks, lists: {}, data: 지도 && { fields: { name: '홍길동', birth: '1980.01.01', phone: '010-0000-0000', email: 'a@example.com' } } });
  ['성 명', '생년월일', '연락처', '이메일'].forEach((L) => {
    assert.ok(r.xml.indexOf(L) >= 0, '서식 문구 「' + L + '」이 덮였습니다');
  });
});

test('④★ 손으로 친 값이 실제로 들어간다 — 사전이 모르는 칸에도', () => {
  const 지도 = M.scan(낯선말, { all: true });
  /* 「그동안 한 일」 옆의 값 칸 — 보통 때는 자리로 안 잡히던 곳이다 */
  const 자리 = 지도.slots.filter((s) => s.text === '가나상사 노무고문으로 일함')[0];
  assert.ok(자리, '그 칸이 자리로 안 잡혔습니다');
  const r = M.apply(낯선말, { values: { [자리.id]: '가나도청 노무고문' }, data: { fields: {} } });
  assert.ok(r.xml.indexOf('가나도청 노무고문') >= 0, '친 값이 안 들어갔습니다');
  assert.ok(r.xml.indexOf('가나상사 노무고문으로 일함') < 0, '옛 글자가 남아 있습니다');
});

test('⑤★ 비우면 «비워진다» — 이것이 「불필요한 부분 삭제」다', () => {
  const 지도 = M.scan(낯선말, { all: true });
  const 자리 = 지도.slots.filter((s) => s.text === '가나상사 노무고문으로 일함')[0];
  const r = M.apply(낯선말, { values: { [자리.id]: '' }, data: { fields: {} } });
  assert.ok(r.xml.indexOf('가나상사 노무고문으로 일함') < 0,
    '비웠는데 글자가 그대로 남아 있습니다 — 지우기가 안 됩니다');
  assert.ok(r.xml.indexOf('부르는 이름') >= 0, '옆 칸까지 지웠습니다');
});

test('⑥★ 서식 문구(라벨) 칸도 켜면 고칠 수 있다 — 꺼져 있을 때는 못 고친다', () => {
  const 라벨있는표 = 표([
    tr([tc('성 명'), tc(''), tc('생년월일'), tc('')])
  ]);
  const 꺼짐 = M.scan(라벨있는표).slots.filter((s) => s.text === '성 명');
  assert.equal(꺼짐.length, 0, '꺼져 있는데 서식 문구가 고칠 자리가 됐습니다');
  const 켜짐 = M.scan(라벨있는표, { all: true }).slots.filter((s) => s.text === '성 명');
  assert.equal(켜짐.length, 1, '켰는데도 서식 문구를 못 고칩니다');
  assert.equal(켜짐[0].kind, '아무칸');
});

test('⑦★ 목록 표(학력·경력) 줄은 그대로 목록이 맡는다 — 낱개 칸으로 흩어지면 안 된다', () => {
  const 목록표 = 표([
    tr([tc('기 간'), tc('학 교 명'), tc('전 공'), tc('학 위')]),
    tr([tc(''), tc(''), tc(''), tc('')]),
    tr([tc(''), tc(''), tc(''), tc('')])
  ]);
  const m = M.scan(목록표, { all: true });
  assert.ok(m.lists.length >= 1, '목록 표를 못 알아봤습니다');
  /* 목록이 맡은 줄의 칸이 낱개 자리로도 올라오면 두 곳이 같은 칸을 고치게 된다 */
  const 목록줄자리 = m.slots.filter((s) => s.row >= m.lists[0].head && s.row < m.lists[0].end);
  assert.deepEqual(목록줄자리, [], '목록 줄의 칸이 낱개 자리로도 올라왔습니다');
});

test('⑧★ 넣는 쪽(apply)은 «늘» 모든 칸을 훑는다 — 좁게 훑으면 친 값이 조용히 사라진다', () => {
  const 소스 = stripJs(fs.readFileSync(path.join(R, 'js', 'kcareer-formmap.js'), 'utf8'));
  const head = 소스.indexOf('function apply(');
  assert.notEqual(head, -1, 'apply 를 찾지 못했습니다');
  let i = 소스.indexOf('{', head), depth = 0;
  for (; i < 소스.length; i++) { if (소스[i] === '{') depth++; else if (소스[i] === '}') { depth--; if (!depth) break; } }
  const fn = 소스.slice(head, i + 1);
  assert.match(fn, /scan\(\s*xml\s*,\s*\{\s*all:\s*true\s*\}\s*\)/,
    '넣는 쪽이 좁게 훑습니다 — 「아무 칸이나」로 친 값이 「그런 자리가 없습니다」로 사라집니다');
});

test('⑨ 화면에서 켜고 끌 수 있고, 서식을 새로 올리면 꺼진다', () => {
  assert.match(CODE, /var\s+_rhAnyCell\s*=\s*false/, '기본이 꺼짐이 아닙니다');
  assert.match(CODE, /function rhToggleAnyCell\(/, '켜고 끄는 길이 없습니다');
  assert.match(CODE, /id="kfM4"/, '단추가 없습니다');
  /* 두 길(칸 지도·입력판)이 «함께» 이 값을 봐야 한다 — 한쪽만 보면 화면과 결과가 어긋난다 */
  const n = (CODE.match(/scan\(xml,\{all:_rhAnyCell\}\)/g) || []).length;
  assert.equal(n, 2, '칸 지도와 입력판 두 곳이 모두 이 값을 봐야 합니다 (지금 ' + n + '곳)');
  /* 새 서식이면 꺼야 한다 — 남의 서식 설정이 따라오면 문구 위에 입력칸이 얹힌 채 열린다 */
  assert.match(CODE, /_rhAnyCell=false;\s*if\(typeof rhAnyCellUI==='function'\)/,
    '새 서식을 올릴 때 꺼지지 않습니다');
});

test('⑩ 주민등록번호는 여전히 «골라야» 나간다 — 이 변경이 그 문을 열면 안 된다', () => {
  assert.ok(X.FIELD_FILL_KEYS.indexOf('rrn') < 0, '주민등록번호가 자동 채움에 들어갔습니다');
  const 주민표 = 표([tr([tc('주민등록번호'), tc(''), tc('성 명'), tc('')])]);
  const 지도 = M.guess(M.scan(주민표, { all: true }), { fields: { name: '홍길동' }, secrets: { rrn: '000000-0000000' } });
  지도.slots.forEach((s) => assert.notEqual(s.guess, 'rrn', '주민등록번호가 저절로 짚였습니다'));
});
