/* 한글 서식 쪽번호 — 모든 쪽 아래 가운데 «- 1 -» (대표 지시 2026-10-09 「모든 페이지에 넘버링 항상」)
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 기금명·금액 금지. 여기 자료는 전부 가짜다.
 *
 * 넣는 모양은 한글 2024 자동화로 «쪽 번호 매기기»를 넣고 HWPX 로 저장해 뜬 것과 같다.
 * 앱이 넣은 파일을 rhwp 로 .hwp·.hwpx 로 다시 저장해도, 한글로 열어 PDF 로 뽑아도 쪽마다 «- n -» 하나였다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const pn = new Function(grabFn('_hwpPageNum') + '; return _hwpPageNum;')();

const SEC = '<hs:sec><hp:p id="1" paraPrIDRef="0"><hp:run charPrIDRef="3"><hp:secPr id=""><hp:pagePr/></hp:secPr>'
  + '<hp:ctrl><hp:colPr id="" type="NEWSPAPER"/></hp:ctrl></hp:run><hp:run charPrIDRef="3"><hp:t>가나다 서식</hp:t></hp:run></hp:p></hs:sec>';
const MARK = '<hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar="-"/>';

test('★★ 구역 정의가 든 run 바로 뒤에 쪽번호 run 하나 — 한글이 저장한 모양 그대로, 두 번 넣지 않는다', () => {
  const x = pn(SEC);
  assert.ok(x.includes('<hp:colPr id="" type="NEWSPAPER"/></hp:ctrl></hp:run>'
    + '<hp:run charPrIDRef="0"><hp:ctrl>' + MARK + '</hp:ctrl><hp:t/></hp:run><hp:run charPrIDRef="3"><hp:t>가나다'), x);
  assert.equal(x.split('<hp:pageNum').length - 1, 1);
  assert.equal(pn(x), x, '다시 돌려도 그대로');
  assert.equal(pn('<hs:sec><hp:p><hp:run><hp:t>구역 정의 없음</hp:t></hp:run></hp:p></hs:sec>'), '<hs:sec><hp:p><hp:run><hp:t>구역 정의 없음</hp:t></hp:run></hp:p></hs:sec>');
});

test('★ 꼬리말에 쪽 번호 필드가 있는 틀은 새로 넣지 않는다', () => {
  const foot = SEC.replace('<hp:t>가나다 서식</hp:t>', '<hp:ctrl><hp:footer><hp:autoNum num="1" numType="PAGE"/></hp:footer></hp:ctrl>');
  assert.equal(pn(foot), foot);
});

test('★★ 틀이 꺼 둔 쪽번호를 푼다 — 위치 «없음» → 아래 가운데, 감추기 → 보이기, 새 번호로 시작 → 걷기', () => {
  const tpl = SEC.replace('</hp:ctrl></hp:run>', '</hp:ctrl><hp:ctrl><hp:pageNum pos="NONE" formatType="DIGIT" sideChar="-"/></hp:ctrl>'
    + '<hp:ctrl><hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/></hp:ctrl></hp:run>')
    .replace('<hp:t>가나다 서식</hp:t>', '<hp:ctrl><hp:newNum num="0" numType="PAGE"/></hp:ctrl><hp:t>가나다 서식</hp:t>');
  const x = pn(tpl);
  assert.ok(x.includes('<hp:pageNum pos="BOTTOM_CENTER"'), '위치 없음 → 아래 가운데');
  assert.ok(x.includes('hidePageNum="0"') && !x.includes('hidePageNum="1"'), '감춘 쪽도 번호');
  assert.ok(!x.includes('<hp:newNum'), '한 문서 안에서 1, 2, 3… 차례대로');
  assert.equal(x.split('<hp:pageNum').length - 1, 1, '틀의 것을 살리고 새로 넣지 않는다');
  assert.ok(x.includes('<hp:t>가나다 서식</hp:t>'), '글은 그대로');
});

test('★ 한글로 나가는 두 길에 붙어 있다 — 틀 채우기(hwpTplFill)·화면 서식 → 한글(docToHwpx)', () => {
  assert.match(grabFn('hwpTplFill'), /o\.xml=_hwpPageNum\(o\.xml\)/);
  assert.match(SRC, /HWPXDOC\.begin\('gov',\{pageNum:true\}\)/);
});
