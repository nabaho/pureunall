/* 홈페이지를 «서버가» 고칠 때 — 얼굴 사진이 날아가지 않는가.
   2026-08-30 에 이 길을 접은 까닭이 「사진이 조용히 지워진다」였다.
   그래서 이 검사는 «사진이 실린 숨은 칸»을 끝까지 따라간다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../functions/homepage-write');

/* 진짜 고치는 화면을 닮게 만든 한 장 — 캡처(2026-09-13)의 그 모양이다.
   ⚠ 예시 이름은 늘 홍길동이다(진짜 의뢰인·직원 이름을 검사에 넣지 않는다). */
const 사진 = '<div class="photo"><img src="/files/attach/images/2026/01/20/abc.jpg"></div>';
function 화면(고칠것) {
  const o = Object.assign({ srl: 190, 직책1: '대표', 직책2: '공인노무사',
    경력: '現 푸른노무법인대표', content: 사진 }, 고칠것 || {});
  return [
    '<form action="/index.php" method="post">',
    '<input type="hidden" name="mid" value="people_board">',
    '<input type="hidden" name="act" value="procBoardInsertDocument">',
    '<input type="hidden" name="document_srl" value="' + o.srl + '">',
    '<input type="hidden" name="_rx_csrf_token" value="tok-123">',
    '<table><tbody>',
    '<tr><th>제목<span>*</span></th><td><input type="text" name="title" value="홍길동"></td></tr>',
    '<tr><th>직책1</th><td><input type="text" name="extra_vars1" value="' + o.직책1 + '"></td></tr>',
    '<tr><th>직책2</th><td><input type="text" name="extra_vars2" value="' + o.직책2 + '"></td></tr>',
    '<tr><th>메인 설명</th><td><textarea name="extra_vars3">한 줄</textarea></td></tr>',
    '<tr><th>경력사항</th><td><textarea name="extra_vars4">' + o.경력 + '</textarea></td></tr>',
    '<tr><th>메인 이미지</th><td><input type="file" name="extra_vars5"></td></tr>',
    '</tbody></table>',
    (o.content === null ? '' : '<textarea name="content">' + o.content + '</textarea>'),
    '<select name="status"><option value="0">숨김</option><option value="1" selected>공개</option></select>',
    '<input type="checkbox" name="notify" value="Y">',
    '<input type="submit" value="등록">',
    '</form>'
  ].join('\n');
}

test('숨은 칸(content)까지 빠짐없이 읽는다 — 여기가 사진이 사는 곳이다', () => {
  const r = W.칸읽기(화면());
  assert.equal(r.칸.content, 사진, '사진이 든 숨은 칸을 못 읽었다');
  assert.equal(r.칸.extra_vars4, '現 푸른노무법인대표');
  assert.equal(r.칸.extra_vars3, '한 줄', 'textarea 를 못 읽었다');
  assert.equal(r.칸.status, '1', 'select 는 «골라진» 것을 읽어야 한다');
  assert.ok(!Object.prototype.hasOwnProperty.call(r.칸, 'notify'),
    '안 켜진 체크상자를 보내면 안 켠 것이 켜진 채 저장된다');
  assert.ok(!Object.prototype.hasOwnProperty.call(r.칸, 'extra_vars5'),
    '파일 칸은 글자로 보내면 안 된다 — 보내면 붙어 있던 사진이 떨어진다');
});

test('보내는 몸통에 숨은 칸이 그대로 실린다', () => {
  const r = W.칸읽기(화면());
  const 몸 = W.몸통(r.칸, r.여럿);
  const p = new URLSearchParams(몸);
  assert.equal(p.get('content'), 사진, '몸통에서 사진이 빠졌다 — 이대로면 지워진다');
  assert.equal(p.get('_rx_csrf_token'), 'tok-123');
  assert.equal(p.get('document_srl'), '190');
});

test('숨은 칸이 안 오면 «아무것도» 안 보낸다', () => {
  const r = W.칸읽기(화면({ content: null }));
  const 막 = W.막을까(r, 190);
  assert.equal(막.ok, false, '사진 칸이 없는데 보내려 했다');
  assert.ok(막.걸린것.join(' ').includes('사진'), '왜 막았는지 사람 말로 알려야 한다');
});

test('로그인이 풀려 딴 화면이 와도 안 보낸다', () => {
  const 로그인화면 = '<form><input type="text" name="user_id"><input type="password" name="password"></form>';
  const 막 = W.막을까(W.칸읽기(로그인화면), 190);
  assert.equal(막.ok, false);
});

test('부른 글과 화면의 글 번호가 다르면 안 보낸다', () => {
  const 막 = W.막을까(W.칸읽기(화면({ srl: 203 })), 190);
  assert.equal(막.ok, false, '엉뚱한 사람 글을 고칠 뻔했다');
});

test('멀쩡한 화면이면 보낸다', () => {
  const 막 = W.막을까(W.칸읽기(화면()), 190);
  assert.equal(막.ok, true, 막.걸린것.join(' / '));
});

test('갈아끼워도 숨은 칸은 손대지 않는다', () => {
  const h = 화면();
  const r = W.칸읽기(h);
  const 새 = W.갈아끼우기(r, { 경력사항: '現 새 자리', 직책1: '부대표' }, h);
  assert.equal(새.칸.content, 사진, '갈아끼우다 사진을 건드렸다');
  assert.equal(새.칸.extra_vars4, '現 새 자리');
  assert.equal(새.칸.extra_vars1, '부대표', '이름표 「직책1」로 칸을 못 찾았다');
  assert.equal(새.칸.extra_vars2, '공인노무사', '안 준 칸을 건드렸다');
});

test('안 바뀐 것은 «바뀐 것»에 안 넣는다 — 헛 이력이 남는다', () => {
  const h = 화면();
  const 새 = W.갈아끼우기(W.칸읽기(h), { 직책1: '대표' }, h);
  assert.equal(새.바뀐것.length, 0);
});

test('이름표를 못 찾으면 «짐작해서» 쓰지 않는다', () => {
  const h = 화면().replace('<th>직책1</th>', '<th>맡은자리</th>');
  const 새 = W.갈아끼우기(W.칸읽기(h), { 직책1: '부대표' }, h);
  assert.equal(새.칸.extra_vars1, '대표', '못 찾았는데 딴 칸에 썼다');
  assert.ok(새.못찾은것.includes('직책1'), '못 찾았으면 못 찾았다고 알려야 한다');
});

test('이름표가 파일 칸을 가리키면 안 쓴다', () => {
  assert.equal(W.이름표로칸찾기(화면(), '메인 이미지'), '',
    '파일 칸에 글자를 쓰면 붙어 있던 사진이 떨어진다');
});

test('&amp; 를 되돌려야 사진 주소가 안 깨진다', () => {
  const 주소 = '<img src="/f.php?a=1&amp;b=2">';
  const r = W.칸읽기('<textarea name="content">' + 주소 + '</textarea>');
  assert.equal(r.칸.content, '<img src="/f.php?a=1&b=2">');
  /* &amp;lt; 를 먼저 풀면 < 가 되어 태그가 하나 생긴다 */
  assert.equal(W.글자되돌리기('&amp;lt;b&amp;gt;'), '&lt;b&gt;');
});

test('고치는 주소는 글 번호 하나만 받는다', () => {
  assert.ok(String(W.고치는주소(190)).includes('document_srl=190'));
  ['', null, -1, 1.5, '190 OR 1=1', 'abc'].forEach((못된것) => {
    assert.equal(W.고치는주소(못된것), null, '못된 글 번호(' + 못된것 + ')를 받아 줬다');
  });
});
