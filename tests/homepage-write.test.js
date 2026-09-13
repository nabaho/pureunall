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
    경력: '現 푸른노무법인대표', content: 사진, 확인표: 'la58UxFVPgFmF8ud' }, 고칠것 || {});
  /* ⚠★ 확인표는 «숨은 칸»이 아니라 쪽 머리의 meta 다 — 2026-09-13 실측.
       처음엔 숨은 칸으로 흉내 냈고, 그래서 검사는 다 통과했는데 진짜 홈페이지에서는
       「확인표가 없습니다」로 막혔다. 흉내가 진짜와 다르면 검사가 아무것도 안 지킨다. */
  return [
    (o.확인표 === null ? '' : '<meta name="csrf-token" content="' + o.확인표 + '" />'),
    '<form action="/index.php" method="post">',
    '<input type="hidden" name="mid" value="people_board">',
    '<input type="hidden" name="act" value="procBoardInsertDocument">',
    '<input type="hidden" name="document_srl" value="' + o.srl + '">',
    '<table><tbody>',
    '<tr><th>제목<span>*</span></th><td><input type="text" name="title" value="홍길동"></td></tr>',
    '<tr><th>직책1</th><td><input type="text" name="extra_vars1" value="' + o.직책1 + '"></td></tr>',
    '<tr><th>직책2</th><td><input type="text" name="extra_vars2" value="' + o.직책2 + '"></td></tr>',
    '<tr><th>메인 설명</th><td><textarea name="extra_vars3">한 줄</textarea></td></tr>',
    '<tr><th>경력사항</th><td><textarea name="extra_vars4">' + o.경력 + '</textarea></td></tr>',
    '<tr><th>메인 이미지</th><td><input type="file" name="extra_vars5"></td></tr>',
    '</tbody></table>',
    (o.content === null ? '' : '<textarea name="content">' + o.content + '</textarea>'),
    '<select name="status"><option value="SECRET">비공개</option>'
      + '<option value="PUBLIC" selected>공개</option></select>',
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
  assert.equal(r.칸.status, 'PUBLIC', 'select 는 «골라진» 것을 읽어야 한다');
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
  assert.equal(p.get('document_srl'), '190');
});

/* ── 확인표(CSRF) ── 2026-09-13 첫 시도가 막힌 바로 그 자리 ────────────── */
test('★ 확인표는 쪽 머리의 meta 에서 뽑는다 — 숨은 칸이 아니다', () => {
  assert.equal(W.확인표뽑기(화면()), 'la58UxFVPgFmF8ud');
  assert.equal(W.확인표뽑기('<meta name="csrf-token" content="abc" />'), 'abc');
  assert.equal(W.확인표뽑기('<html><body>아무것도 없음</body></html>'), '');
});

test('★ 확인표가 meta 에만 있어도 «막지 않는다»', () => {
  const 막 = W.막을까(W.칸읽기(화면()), 190);
  assert.equal(막.ok, true,
    '멀쩡한 화면을 막았다(2026-09-13 실제로 그랬다): ' + 막.걸린것.join(' / '));
});

test('확인표가 아예 없으면 막는다 — 어차피 저장이 안 된다', () => {
  const 막 = W.막을까(W.칸읽기(화면({ 확인표: null })), 190);
  assert.equal(막.ok, false);
  assert.ok(막.걸린것.join(' ').includes('확인표'));
});

/* ── 로그인 ── 아이디·비밀번호만 보내면 안 들어가진다 ─────────────────── */
function 로그인쪽(고칠것) {
  const o = Object.assign({ 확인표: 'tok-login', user_id: true }, 고칠것 || {});
  return [
    (o.확인표 === null ? '' : '<meta name="csrf-token" content="' + o.확인표 + '" />'),
    '<form action="/index.php?act=dispBoardWrite"><input type="text" name="search_keyword"></form>',
    '<form action="/index.php?act=procMemberLogin" method="post">',
    '<input type="hidden" name="error_return_url" value="/index.php?mid=people_board">',
    '<input type="hidden" name="mid" value="people_board">',
    '<input type="hidden" name="ruleset" value="@login">',
    '<input type="hidden" name="module" value="member">',
    '<input type="hidden" name="act" value="procMemberLogin">',
    '<input type="hidden" name="success_return_url" value="/index.php?mid=people_board">',
    '<input type="hidden" name="xe_validator_id" value="modules/message/skins/default/">',
    (o.user_id ? '<input type="text" name="user_id" value="">' : ''),
    '<input type="password" name="password" value="">',
    '</form>'
  ].join('\n');
}

test('★ 로그인 몸통은 «받은 칸»을 그대로 쓴다 — ruleset 을 빠뜨리면 안 들어가진다', () => {
  const r = W.로그인몸통(로그인쪽(), 'hong', 'pw1234');
  assert.equal(r.ok, true, r.why);
  const p = new URLSearchParams(r.몸통);
  ['error_return_url', 'mid', 'ruleset', 'module', 'act', 'success_return_url', 'xe_validator_id']
    .forEach((k) => assert.ok(p.get(k) !== null, '로그인에 ' + k + ' 이 빠졌다'));
  assert.equal(p.get('ruleset'), '@login');
  assert.equal(p.get('user_id'), 'hong');
  assert.equal(p.get('password'), 'pw1234');
  assert.equal(p.get('_rx_csrf_token'), 'tok-login', '확인표가 몸통에 안 실렸다');
  assert.equal(r.확인표, 'tok-login');
});

test('★ 로그인 칸 밖의 «찾기 칸»이 섞여 들어가지 않는다', () => {
  const p = new URLSearchParams(W.로그인몸통(로그인쪽(), 'hong', 'pw').몸통);
  assert.equal(p.get('search_keyword'), null, '딴 폼의 칸을 함께 보냈다');
});

test('★ 비밀번호는 «남기는 기록»에 안 들어간다', () => {
  const r = W.로그인몸통(로그인쪽(), 'hong', 'pw1234');
  assert.ok(r.칸이름들.indexOf('password') < 0, '기록에 비밀번호 칸이 남는다');
  assert.ok(r.칸이름들.indexOf('user_id') >= 0);
  assert.ok(JSON.stringify(r.칸이름들).indexOf('pw1234') < 0, '기록에 비밀번호 값이 샜다');
});

test('로그인 칸이 아니면 «짐작해서» 밀어 넣지 않는다', () => {
  const r = W.로그인몸통(로그인쪽({ user_id: false }), 'hong', 'pw');
  assert.equal(r.ok, false);
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

/* ── 퇴사자 내리기 ── 지우는 것이 아니라 «감추는» 것이다 ───────────────── */
test('★ 「비공개」는 고르개의 «보이는 글자»로 찾는다 — 칸 이름을 짐작하지 않는다', () => {
  const 자리 = W.비공개자리(화면());
  assert.equal(자리.ok, true, 자리.why);
  assert.equal(자리.이름, 'status');
  assert.equal(자리.값, 'SECRET');
});

test('★ 내려도 얼굴 사진·경력은 그대로 둔다 — 지우는 것이 아니다', () => {
  const h = 화면();
  const 새 = W.갈아끼우기(W.칸읽기(h), { 비공개: true }, h);
  assert.equal(새.칸.status, 'SECRET', '비공개로 안 바뀌었다');
  assert.equal(새.칸.content, 사진, '내리면서 사진을 지웠다');
  assert.equal(새.칸.extra_vars4, '現 푸른노무법인대표', '내리면서 경력을 지웠다');
  assert.equal(새.바뀐것.length, 1);
  assert.equal(새.바뀐것[0].새, '비공개');
});

test('「비공개」 자리를 못 찾으면 «아무것도» 안 건드린다', () => {
  const h = 화면().replace(/<select[\s\S]*?<\/select>/, '');
  const 새 = W.갈아끼우기(W.칸읽기(h), { 비공개: true }, h);
  assert.equal(새.바뀐것.length, 0, '못 찾았는데 딴 칸을 건드렸다');
  assert.ok(새.못찾은것.join(' ').includes('비공개'), '못 찾았다고 알려야 한다');
});

/* ★ 2026-09-13 — 고르개가 없고 «비밀글 딸깍 칸»만 있는 화면에서 안 내려갔다.
     즐겨찾기 단추는 딸깍 칸까지 보는데 서버는 고르개만 보고 멈춰 있었다. */
test('★ 고르개가 없으면 «비밀글» 딸깍 칸을 본다', () => {
  const h = 화면().replace(/<select[\s\S]*?<\/select>/, '')
    + '<tr><th>비밀글</th><td><input type="checkbox" name="is_secret" value="Y"></td></tr>';
  const 자리 = W.비공개자리(h);
  assert.equal(자리.ok, true, 자리.why);
  assert.equal(자리.이름, 'is_secret');
  assert.equal(자리.값, 'Y');
  const 새 = W.갈아끼우기(W.칸읽기(h), { 비공개: true }, h);
  assert.equal(새.칸.is_secret, 'Y', '딸깍 칸에 표시가 안 됐다');
  assert.equal(새.칸.content, 사진, '내리면서 사진을 지웠다');
});

test('딸깍 칸 이름이 secret 이 아니어도 «둘레 딱지»로 찾는다', () => {
  const h = 화면().replace(/<select[\s\S]*?<\/select>/, '')
    + '<tr><th>비공개</th><td><input type="checkbox" name="x_flag" value="1"></td></tr>';
  assert.equal(W.비공개자리(h).이름, 'x_flag');
});

test('★ 못 찾았으면 «이 화면에 무엇이 있는지»를 함께 알려 준다', () => {
  /* 「못 찾았습니다」 한 줄만 오면 무엇을 고쳐야 할지 알 길이 없다 */
  const h = '<select name="lang"><option value="ko">한국어</option></select>'
    + '<input type="checkbox" name="notify" value="Y">';
  const 자리 = W.비공개자리(h);
  assert.equal(자리.ok, false);
  assert.match(자리.why, /lang/, '어떤 고르개가 있었는지 안 알려 준다');
  assert.match(자리.why, /notify/, '어떤 딸깍 칸이 있었는지 안 알려 준다');
});

test('「비공개」 자리가 둘이면 단정하지 않는다', () => {
  const h = 화면() + '<select name="x"><option value="9">비공개</option></select>';
  assert.equal(W.비공개자리(h).ok, false, '어느 것인지 모르는데 골랐다');
});

test('이미 비공개면 «바뀐 것»에 안 넣는다', () => {
  const h = 화면().replace('<option value="PUBLIC" selected>', '<option value="PUBLIC">')
    .replace('<option value="SECRET">', '<option value="SECRET" selected>');
  const 새 = W.갈아끼우기(W.칸읽기(h), { 비공개: true }, h);
  assert.equal(새.바뀐것.length, 0);
});

test('비공개를 «안 준 때»는 건드리지 않는다', () => {
  const h = 화면();
  const 새 = W.갈아끼우기(W.칸읽기(h), { 경력사항: '現 새 자리' }, h);
  assert.equal(새.칸.status, 'PUBLIC', '안 시켰는데 내렸다');
});

/* ── 정찰 ── 칸 «이름»만 본다. 값이 새면 안 된다 ────────────────────── */
test('★★ 정찰은 값을 한 글자도 안 담는다', () => {
  const r = W.정찰(화면());
  const 전부 = JSON.stringify(r);
  ['現 푸른노무법인대표', '홍길동', '공인노무사', 사진, 'la58UxFVPgFmF8ud']
    .forEach(값 => assert.ok(전부.indexOf(값) < 0,
      '★★ 정찰 답에 «값»이 들어 있습니다(' + 값.slice(0, 20) + ') — 화면과 기록에 샙니다'));
});

test('정찰이 사진(파일) 칸과 이름표 짝을 알려 준다', () => {
  const r = W.정찰(화면());
  assert.ok(r.파일칸.includes('extra_vars5'), '사진 넣을 칸을 못 찾았다');
  /* 이름표는 다듬어져 온다(「메인 이미지」→「메인이미지」) — 띄어쓰기로 맞추지 않는다 */
  assert.ok(r.이름표.some(t => /메인\s*이미지 → extra_vars5 \(파일\)/.test(t)),
    '이름표와 칸을 못 이었다: ' + r.이름표.join(' | '));
  assert.ok(r.넓은칸.includes('extra_vars4'));
  assert.ok(r.숨은칸.includes('document_srl'));
  assert.equal(r.확인표있나, true);
});

/* ★ 2026-09-13 — 구성원 게시판에는 「비공개」 칸이 «없다»(고르개 is_notice,
     딸깍 title_bold 뿐). 그러면 내리는 길이 어디 있는지 찾아야 하는데,
     그 답은 「이 화면에서 할 수 있는 일(act)」 목록에 있다. */
test('★ 정찰이 «할 수 있는 일(act)» 이름을 모은다 — 부르지는 않는다', () => {
  const h = 화면() + '<a href="/index.php?mid=x&act=dispBoardDelete&document_srl=1">삭제</a>'
    + '<a href="/index.php?act=dispDocumentAdminList">문서 관리</a>';
  const r = W.정찰(h);
  assert.ok(r.행위들.includes('procBoardInsertDocument'));
  assert.ok(r.행위들.includes('dispBoardDelete'));
  assert.ok(r.행위들.includes('dispDocumentAdminList'));
  /* 같은 이름이 여러 번 나와도 한 번만 */
  assert.equal(r.행위들.filter(x => x === 'dispBoardDelete').length, 1);
});

test('읽는 주소도 글 번호 하나만 받는다', () => {
  assert.ok(String(W.읽는주소(190)).includes('document_srl=190'));
  ['', null, -1, 'abc', '1 OR 1=1'].forEach(못된것 =>
    assert.equal(W.읽는주소(못된것), null, '못된 글 번호(' + 못된것 + ')를 받아 줬다'));
});

test('정찰의 고르개는 «보기 글자»를 담는다 — 그것이 칸의 뜻이다', () => {
  const r = W.정찰(화면());
  assert.ok(r.고르개.some(t => /status\[/.test(t) && /비공개/.test(t)),
    '고르개의 뜻을 못 알려 준다: ' + r.고르개.join(' | '));
});

test('고치는 주소는 글 번호 하나만 받는다', () => {
  assert.ok(String(W.고치는주소(190)).includes('document_srl=190'));
  ['', null, -1, 1.5, '190 OR 1=1', 'abc'].forEach((못된것) => {
    assert.equal(W.고치는주소(못된것), null, '못된 글 번호(' + 못된것 + ')를 받아 줬다');
  });
});
