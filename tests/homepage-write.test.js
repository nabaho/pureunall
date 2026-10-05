/* 홈페이지를 «서버가» 고칠 때 — 얼굴 사진이 날아가지 않는가.
   2026-08-30 에 이 길을 접은 까닭이 「사진이 조용히 지워진다」였다.
   그래서 이 검사는 «사진이 실린 숨은 칸»을 끝까지 따라간다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

/* ── 휴지통으로 내리기 ── 2026-09-14 정찰로 확인한 뒤 지은 길 ─────────────
   이 게시판에는 「비공개」 자리가 없다. procDocumentManageCheckedDocument 가
   할 수 있는 것은 이동·복사·삭제·휴지통 넷이고, 그중 «휴지통»만 쓴다. */
test('★★★ 나가는 type 은 «trash» 하나다 — delete 가 섞이면 되살릴 수 없다', () => {
  assert.equal(W.내리는type, 'trash');
  const r = W.휴지통몸통([193], 'tok');
  const p = new URLSearchParams(r.몸통);
  assert.equal(p.get('type'), 'trash', '★★★ 지우는 쪽으로 갔다');
  /* 몸통 어디에도 delete·move·copy 라는 글자가 없어야 한다 */
  W.절대안쓰는type.forEach((못된것) => assert.ok(r.몸통.indexOf(못된것) < 0,
    '★★★ 몸통에 「' + 못된것 + '」이 들어 있다: ' + r.몸통));
});

test('★★★ 「delete」를 들고 있는 줄은 «막는 목록» 하나뿐이다', () => {
  /* 주석을 걷고 «줄 단위»로 본다 — 잘 쓴 주석이 검사를 통과시키면 안 되고,
     한 파일에 delete 가 두 자리에 있으면 언젠가 그중 하나가 보내진다. */
  const 소스 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'homepage-write.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const 든줄 = 소스.split(/\r?\n/).filter(줄 => /["']delete["']/.test(줄));
  assert.equal(든줄.length, 1, '★★★ 「delete」가 여러 자리에 있습니다:\n' + 든줄.join('\n'));
  assert.match(든줄[0], /절대안쓰는type/,
    '★★★ 「delete」가 «막는 목록»이 아닌 곳에 있습니다 — 한 글자가 되살림을 가릅니다: ' + 든줄[0]);
});

test('내릴 글 번호를 cart 에 담는다 — 문서 관리 화면의 체크상자 이름이다', () => {
  const p = new URLSearchParams(W.휴지통몸통([193, 281], 'tok').몸통);
  assert.deepEqual(p.getAll('cart'), ['193', '281']);
  assert.equal(p.get('module'), 'document');
  assert.equal(p.get('act'), 'procDocumentManageCheckedDocument');
  assert.equal(p.get('_rx_csrf_token'), 'tok');
});

test('★ 못된 글 번호는 «거른다» — 하나도 안 남으면 보내지 않는다', () => {
  const r = W.휴지통몸통([193, 'abc', -1, 0, 1.5, '2 OR 1=1'], 'tok');
  assert.deepEqual(new URLSearchParams(r.몸통).getAll('cart'), ['193'],
    '못된 번호가 섞여 들어갔다');
  assert.equal(W.휴지통몸통([], 'tok').ok, false, '빈 목록인데 보내려 했다');
  assert.equal(W.휴지통몸통(['abc'], 'tok').ok, false);
});

test('확인표가 없어도 몸통은 짓는다 — 머리글로도 보내기 때문이다', () => {
  const r = W.휴지통몸통([193], '');
  assert.equal(r.ok, true);
  assert.equal(new URLSearchParams(r.몸통).get('_rx_csrf_token'), null);
});

/* ── 사진 넣기 ── 2026-09-14. 파일 칸은 글자로 못 보내므로 multipart 로 간다 ── */
/* 보낸 multipart 를 도로 풀어 본다 — 「보냈다」가 아니라 «무엇이 실렸나»를 본다 */
function 풀기(경계, 몸통) {
  const s = 몸통.toString('binary');
  const 조각 = s.split('--' + 경계).slice(1, -1);
  const 칸 = {}, 파일 = [];
  조각.forEach((t) => {
    const 끝 = t.indexOf('\r\n\r\n');
    const 머리 = t.slice(0, 끝);
    const 몸 = t.slice(끝 + 4, t.length - 2);
    const 이름 = (/name="([^"]*)"/.exec(머리) || [])[1];
    const 파일이름 = (/filename="([^"]*)"/.exec(머리) || [])[1];
    if (파일이름 !== undefined) {
      파일.push({ 이름: 이름, 파일이름: 파일이름,
                  종류: (/Content-Type:\s*([^\r\n]+)/i.exec(머리) || [])[1],
                  크기: Buffer.from(몸, 'binary').length });
    } else {
      (칸[이름] = 칸[이름] || []).push(Buffer.from(몸, 'binary').toString('utf8'));
    }
  });
  return { 칸: 칸, 파일: 파일 };
}

test('★ 사진 칸은 이름표 「메인 이미지」의 «파일 칸»으로 찾는다', () => {
  assert.equal(W.파일칸찾기(화면(), '메인 이미지'), 'extra_vars5');
  /* 글자 칸 이름표로는 안 나온다 — 파일 칸만 본다 */
  assert.equal(W.파일칸찾기(화면(), '경력사항'), '');
  assert.equal(W.파일칸찾기(화면(), '없는이름표'), '');
});

test('★★★ 사진을 보낼 때도 «글자 칸을 하나도 안 빠뜨린다»', () => {
  const r = W.칸읽기(화면());
  const 지음 = W.사진몸통(r.칸, r.여럿, 'extra_vars5',
    { 종류: 'image/jpeg', 바이트: Buffer.from([1, 2, 3, 4, 5]) });
  const 푼것 = 풀기(지음.경계, 지음.몸통);
  /* 받은 칸이 전부 실렸나 — 하나라도 빠지면 그 칸이 빈 채로 저장된다 */
  Object.keys(r.칸).forEach((k) => assert.ok(푼것.칸[k],
    '★★★ 「' + k + '」 칸이 안 실렸습니다 — 그 칸이 빈 채로 저장됩니다'));
  assert.equal(푼것.칸.content[0], 사진, '★★★ 사진을 넣다가 숨은 칸을 잃었습니다');
  assert.equal(푼것.칸.extra_vars4[0], '現 푸른노무법인대표', '★★★ 경력을 잃었습니다');
});

test('★★ 사진은 «파일»로 실린다 — 글자로 보내면 붙어 있던 사진이 떨어진다', () => {
  const r = W.칸읽기(화면());
  const 바이트 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const 지음 = W.사진몸통(r.칸, r.여럿, 'extra_vars5', { 종류: 'image/jpeg', 바이트: 바이트 });
  const 푼것 = 풀기(지음.경계, 지음.몸통);
  assert.equal(푼것.파일.length, 1, '★★ 파일 조각이 하나가 아닙니다');
  assert.equal(푼것.파일[0].이름, 'extra_vars5');
  assert.equal(푼것.파일[0].종류, 'image/jpeg');
  assert.equal(푼것.파일[0].크기, 바이트.length, '★★ 사진 바이트가 바뀌었습니다');
  assert.ok(!푼것.칸.extra_vars5, '★★ 사진 칸이 «글자»로도 실렸습니다');
});

test('★ 파일 이름은 «우리가» 짓는다 — 한글·따옴표가 머리글을 깨뜨린다', () => {
  const r = W.칸읽기(화면());
  const 지음 = W.사진몸통(r.칸, r.여럿, 'extra_vars5',
    { 종류: 'image/png', 바이트: Buffer.from([1]), 이름: '내 사진".png' });
  assert.match(지음.파일이름, /^photo-\d+\.png$/, '올린 이름을 그대로 썼습니다: ' + 지음.파일이름);
  assert.ok(지음.몸통.toString('utf8').indexOf('내 사진') < 0);
});

test('★ 경계 글자가 몸통 안에 없다 — 있으면 조각이 엉뚱하게 갈린다', () => {
  const r = W.칸읽기(화면());
  const 지음 = W.사진몸통(r.칸, r.여럿, 'extra_vars5',
    { 종류: 'image/jpeg', 바이트: Buffer.from([1, 2, 3]) });
  const 본문 = 지음.몸통.toString('binary');
  /* 경계는 «조각을 가르는 자리»에만 나온다 — 칸 값 안에 섞여 있으면 안 된다 */
  const 나온수 = 본문.split('--' + 지음.경계).length - 1;
  const 칸수 = Object.keys(r.칸).length;
  assert.equal(나온수, 칸수 + 2, '경계 수가 조각 수와 안 맞습니다');
});

test('★★ 그림이 아닌 것은 받지 않는다', () => {
  assert.equal(W.사진받을까('image/jpeg', 1000).ok, true);
  assert.equal(W.사진받을까('image/png', 1000).ok, true);
  assert.equal(W.사진받을까('image/webp', 1000).ok, true);
  ['application/pdf', 'text/html', 'application/x-msdownload', '', null]
    .forEach((못된것) => assert.equal(W.사진받을까(못된것, 1000).ok, false,
      '★★ 그림이 아닌 것을 받았습니다: ' + 못된것));
});

test('★ 너무 크거나 빈 사진은 받지 않는다 — 까닭도 말한다', () => {
  const 큰것 = W.사진받을까('image/jpeg', W.사진최대 + 1);
  assert.equal(큰것.ok, false);
  assert.match(큰것.why, /너무 큽니다/);
  assert.equal(W.사진받을까('image/jpeg', 0).ok, false);
  assert.equal(W.사진받을까('image/jpeg', W.사진최대).ok, true, '한도 «까지»는 받아야 합니다');
});

test('고치는 주소는 글 번호 하나만 받는다', () => {
  assert.ok(String(W.고치는주소(190)).includes('document_srl=190'));
  ['', null, -1, 1.5, '190 OR 1=1', 'abc'].forEach((못된것) => {
    assert.equal(W.고치는주소(못된것), null, '못된 글 번호(' + 못된것 + ')를 받아 줬다');
  });
});

/* ══════ 자동 내리기(2026-10-05) — 손댈 수 있는 게시판은 «둘뿐», 그 글이 «그 게시판 것»일 때만 ══════ */
test('게시판글주소 — 허용 목록 밖 게시판·잘못된 번호는 null', () => {
  assert.ok(W.게시판글주소('partner_board', 185));
  assert.ok(W.게시판글주소('people_board', 7));
  assert.ok(String(W.게시판글주소('partner_board', 185)).endsWith('/partner_board/185'));
  ['notice', 'admin', '', null, 'people_board/../admin'].forEach((못된것) => {
    assert.equal(W.게시판글주소(못된것, 185), null, '허용 밖 게시판(' + 못된것 + ')을 받아 줬다');
  });
  ['', null, 0, -1, 1.5, '1;x', '185 OR 1=1'].forEach((못된것) => {
    assert.equal(W.게시판글주소('partner_board', 못된것), null, '못된 글 번호(' + 못된것 + ')를 받아 줬다');
  });
});

test('자동 내리기 게시판 목록에는 구성원·자문사현황만 있다', () => {
  assert.ok(W.내릴게시판.includes('people_board'));
  assert.ok(W.내릴게시판.includes('partner_board'));
  assert.ok(W.내릴게시판.every(b => /^(people|partner)_board$/.test(b)),
    '공지사항·상담문의 같은 게시판이 끼면 그 글이 자동으로 휴지통에 갈 길이 생깁니다: ' + W.내릴게시판);
});

test('게시판확인 — 관리자로 열어 200 이고 옮겨 보내지 않을 때만 ok', () => {
  assert.equal(W.게시판확인(200, ''), 'ok');
  assert.equal(W.게시판확인(200, null), 'ok');
  /* 라이믹스는 남의 게시판 주소로 열면 제 게시판으로 옮겨 보낸다(2026-10-05 실측) */
  assert.equal(W.게시판확인(301, '/partner_board/185'), '다른게시판');
  assert.equal(W.게시판확인(302, '/people_board/9'), '다른게시판');
  assert.notEqual(W.게시판확인(200, '/partner_board/185'), 'ok');
  [403, 404, 500, 0].forEach((s) => assert.notEqual(W.게시판확인(s, ''), 'ok', s + ' 를 ok 로 봤다'));
});
/* ══════ 자동 올리기 정찰(2026-10-05) — «채워진 칸 이름»만, 값은 절대 안 돌려준다 ══════ */
test('채운칸들 — 값이 든 칸의 «이름»만 돌려준다(값은 없다)', () => {
  const h = '<input type="text" name="title" value="가나상사"><input type="text" name="extra_vars1" value="">'
    + '<input type="hidden" name="content" value="&lt;p&gt;&lt;img src=&quot;/files/a.png&quot;&gt;&lt;/p&gt;">'
    + '<textarea name="memo">비밀메모</textarea><textarea name="empty"></textarea>'
    + '<input type="password" name="pw" value="secret">';
  const r = W.채운칸들(h);
  assert.ok(r.채운칸.includes('title'));
  assert.ok(r.채운칸.includes('memo'));
  assert.ok(!r.채운칸.includes('extra_vars1'));
  assert.ok(!r.채운칸.includes('empty'));
  const 글 = JSON.stringify(r);
  ['가나상사', '비밀메모', 'secret', 'a.png'].forEach(값 =>
    assert.ok(!글.includes(값), '★ 값이 새어 나왔다: ' + 값));
});

test('채운칸들 — 본문(숨은 content)에 그림이 들어 있는지는 «예/아니오»로만', () => {
  const 있음 = W.채운칸들('<input type="hidden" name="content" value="&lt;img src=&quot;/x.png&quot;&gt;">');
  const 없음 = W.채운칸들('<input type="hidden" name="content" value="&lt;p&gt;글&lt;/p&gt;">');
  assert.equal(있음.본문에그림, true);
  assert.equal(없음.본문에그림, false);
});

test('자동 정찰 자리는 «정해 둔 목록»뿐이고, 모두 읽기 화면(disp…)이다', () => {
  const 자리 = W.자동정찰자리(185);
  assert.ok(Object.keys(자리).length >= 3);
  Object.keys(자리).forEach(k => {
    const u = 자리[k];
    assert.ok(u.startsWith('https://xn--o80bs5mdnbm0bf80anms.kr/'), k + ' 가 우리 홈페이지가 아닙니다: ' + u);
    assert.ok(!/act=proc/i.test(u), k + ' 가 «하는» 주소(proc)입니다: ' + u);
  });
  assert.ok(!JSON.stringify(W.자동정찰자리('1;x')).includes('1;x'), '못된 글 번호를 주소에 넣었다');
});
/* ══════ 3단계 — 새 노무사 글 짓기 (2026-10-05) ══════
   «새 글 쓰기» 화면은 2026-10-05 정찰로 본 모양을 그대로 본뜬다(칸 이름·숨은 칸·파일 칸). */
function 새글화면(더) {
  const o = Object.assign({ mid: 'people_board', srl: '', 확인표: 'tok123', 경력칸: true }, 더 || {});
  return [
    (o.확인표 ? '<meta name="csrf-token" content="' + o.확인표 + '" />' : ''),
    '<form action="/index.php" method="post">',
    '<input type="hidden" name="error_return_url" value="/index.php?mid=people_board&act=dispBoardWrite">',
    '<input type="hidden" name="act" value="procBoardInsertDocument">',
    '<input type="hidden" name="mid" value="' + o.mid + '">',
    '<input type="hidden" name="content" value="">',
    '<input type="hidden" name="document_srl" value="' + o.srl + '">',
    '<input type="hidden" name="_saved_doc_title" value="">',
    '<input type="hidden" name="comment_status" value="ALLOW">',
    '<select name="is_notice"><option value="N">일반</option><option value="Y">공지</option></select>',
    '<table><tbody>',
    '<tr><th>제목</th><td><input type="text" name="title" value=""></td></tr>',
    '<tr><th>직책1</th><td><input type="text" name="extra_vars1" value=""></td></tr>',
    '<tr><th>직책2</th><td><input type="text" name="extra_vars2" value=""></td></tr>',
    '<tr><th>메인설명</th><td><textarea name="extra_vars3"></textarea></td></tr>',
    (o.경력칸 ? '<tr><th>경력사항</th><td><textarea name="extra_vars4"></textarea></td></tr>' : ''),
    '<tr><th>메인 이미지</th><td><input type="file" name="extra_vars5"></td></tr>',
    '</tbody></table>',
    '<input type="text" name="title_color" value="">',
    '<input type="checkbox" name="title_bold" value="Y">',
    '<input type="file" name="Filedata">',
    '</form>'
  ].join('\n');
}
const 새사람 = { 이름: '홍길동', 직책1: '', 직책2: '공인노무사', 메인설명: '노동사건 대리', 경력글: '現 가나상사 자문\n前 다라산업 인사팀' };
const 새사진 = { 종류: 'image/jpeg', 바이트: Buffer.from([0xff, 0xd8, 1, 2]) };

test('새 노무사 글 — 아는 칸만 채우고 받은 칸은 그대로 보낸다(사진은 메인 이미지 파일 칸으로)', () => {
  const r = W.새구성원몸통(새글화면(), 새사람, 새사진);
  assert.equal(r.ok, true, r.why);
  const 글 = r.몸통.toString('utf8');
  assert.match(글, /name="title"\r\n\r\n홍길동\r\n/);
  assert.match(글, /name="extra_vars2"\r\n\r\n공인노무사\r\n/);
  assert.match(글, /name="extra_vars4"\r\n\r\n現 가나상사 자문\n前 다라산업 인사팀\r\n/);
  assert.match(글, /name="act"\r\n\r\nprocBoardInsertDocument\r\n/);
  assert.match(글, /name="_rx_csrf_token"\r\n\r\ntok123\r\n/);
  assert.match(글, /name="comment_status"\r\n\r\nALLOW\r\n/, '받은 칸을 빠뜨렸습니다');
  assert.match(글, /name="extra_vars5"; filename="photo-\d+\.jpg"/);
});

test('새 노무사 글 — 본문(content)이 비면 이름 한 줄을 넣는다(빈 본문은 홈페이지가 안 받는다)', () => {
  const 글 = W.새구성원몸통(새글화면(), 새사람, 새사진).몸통.toString('utf8');
  assert.match(글, /name="content"\r\n\r\n<p>홍길동<\/p>\r\n/);
});

test('새 노무사 글 — 이름에 꺾쇠가 있으면 본문에 그대로 안 넣는다', () => {
  const 글 = W.새구성원몸통(새글화면(), Object.assign({}, 새사람, { 이름: '홍<b>길동' }), 새사진).몸통.toString('utf8');
  assert.ok(!글.includes('<p>홍<b>'), '꺾쇠를 거르지 않았습니다');
});

test('새 노무사 글 — 안전하지 않으면 짓지 않는다', () => {
  const 경우 = [
    [새글화면({ mid: 'notice' }), '다른 게시판'],
    [새글화면({ srl: '190' }), '새 글이 아니라 고치는 화면'],
    [새글화면({ 확인표: '' }), '확인표 없음'],
    [새글화면({ 경력칸: false }), '경력 칸 없음(화면이 바뀜)'],
    ['<html>로그인</html>', '로그인 화면']
  ];
  경우.forEach(([h, 뜻]) => assert.equal(W.새구성원몸통(h, 새사람, 새사진).ok, false, 뜻));
  assert.equal(W.새구성원몸통(새글화면(), Object.assign({}, 새사람, { 이름: ' ' }), 새사진).ok, false, '이름 없음');
  assert.equal(W.새구성원몸통(새글화면(), Object.assign({}, 새사람, { 경력글: '' }), 새사진).ok, false, '경력 없음');
  assert.equal(W.새구성원몸통(새글화면(), 새사람, { 종류: 'text/html', 바이트: Buffer.from('x') }).ok, false, '그림 아님');
});

test('새 글 번호 읽기 — 옮겨 보낸 주소나 답 글자에서 글 번호를 찾는다', () => {
  assert.equal(W.새글번호(302, '/people_board/321', ''), 321);
  assert.equal(W.새글번호(302, 'https://x.kr/index.php?mid=people_board&document_srl=322', ''), 322);
  assert.equal(W.새글번호(200, '', '<script>location.href="/people_board/323"</script>'), 323);
  assert.equal(W.새글번호(200, '', '<html>오류</html>'), 0);
  assert.equal(W.새글번호(302, '/notice/5', ''), 0, '다른 게시판 번호를 받았다');
});
/* ══════ 2차 정찰(2026-10-05) — 2·4단계를 지을 «모양»만, 값은 절대 안 남긴다 ══════ */
test('편집기단서 — 하는 동작(proc) 이름·편집기/올리기 숫자 속성·스크립트 이름만 돌려준다', () => {
  const h = '<div class="xefu-container" data-editor-sequence="3" data-upload-target-srl="0" data-secret="비밀값"></div>'
    + '<script src="/modules/editor/tpl/js/editor.js?v=1"></script><script>var x="act=procFileUpload";'
    + 'var y = "procEditorCall"; var t = "토큰abc";</script>';
  const r = W.편집기단서(h);
  assert.ok(r.행위들.includes('procFileUpload'));
  assert.ok(r.숫자속성['data-editor-sequence'].includes('3'));
  assert.ok(r.숫자속성['data-upload-target-srl'].includes('0'));
  assert.ok(r.스크립트.some(s => s.includes('editor.js')));
  const 글 = JSON.stringify(r);
  ['비밀값', '토큰abc'].forEach(v => assert.ok(!글.includes(v), '값이 새었다: ' + v));
});

test('본문모양 — 태그·속성 «이름»과 주소 «모양»만(글자·숫자는 가린다)', () => {
  const 값 = '<p><img src="/files/attach/images/2025/11/27/abc123.png" alt="가나상사" data-file-srl="555" /></p><p>비밀문장</p>';
  const r = W.본문모양(값);
  assert.ok(r.태그.some(t => /^img\[/.test(t) && t.includes('data-file-srl')));
  assert.ok(r.주소모양.some(s => /files\/attach\/images\/9+\/9+\/9+\/w+\.png/.test(s)), JSON.stringify(r.주소모양));
  const 글 = JSON.stringify(r);
  ['가나상사', '비밀문장', 'abc123', '555', '2025'].forEach(v => assert.ok(!글.includes(v), '값이 새었다: ' + v));
});

test('이름자리모양 — 이름은 안 남기고 «몇 번째 이름이 몇 번, 어떤 모양 안에» 있는지만', () => {
  const 값 = '<div class="staff"><span class="nm">홍길동</span> <span class="tt">사무장</span></div><p>홍길동</p>';
  const r = W.이름자리모양(값, ['홍길동', '없는사람']);
  assert.equal(r[0].수, 2);
  assert.equal(r[1].수, 0);
  const 글 = JSON.stringify(r);
  ['홍길동', '사무장', '없는사람'].forEach(v => assert.ok(!글.includes(v), '값이 새었다: ' + v));
  assert.ok(r[0].모양[0].includes('<span class="nm">'), '이름을 둘러싼 태그 모양이 안 보입니다: ' + r[0].모양[0]);
});
/* ══════ 2단계 — 새 거래처 로고 글 짓기 (2026-10-05) ══════
   절차는 라이믹스 공개 파일(common/js/plugins/jquery.fileupload/js/main.js)이 하는 그대로다:
   ① 새 글 화면의 편집기 번호(data-editor-sequence) ② procFileUpload 로 그림 올리기
   ③ 받은 upload_target_srl 을 글 번호로 새 글 저장(본문 = 라이믹스가 짓는 img 꼴) */
function 로고새글화면(더) {
  const o = Object.assign({ mid: 'partner_board', srl: '', 확인표: 'tok9', 순번: '4' }, 더 || {});
  return [
    (o.확인표 ? '<meta name="csrf-token" content="' + o.확인표 + '" />' : ''),
    '<form action="/index.php" method="post">',
    '<input type="hidden" name="act" value="procBoardInsertDocument">',
    '<input type="hidden" name="mid" value="' + o.mid + '">',
    '<input type="hidden" name="content" value="">',
    '<input type="hidden" name="document_srl" value="' + o.srl + '">',
    '<input type="hidden" name="comment_status" value="ALLOW">',
    '<select name="is_notice"><option value="N">일반</option></select>',
    '<table><tbody><tr><th>제목</th><td><input type="text" name="title" value=""></td></tr></tbody></table>',
    '<div class="xefu-container" data-editor-sequence="' + o.순번 + '" data-upload-target-srl=""></div>',
    '<input type="file" name="Filedata">',
    '</form>'
  ].join('\n');
}
const 로고그림 = { 종류: 'image/png', 바이트: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };

test('편집기번호 — 새 글 화면의 data-editor-sequence 를 읽는다', () => {
  assert.equal(W.편집기번호(로고새글화면({ 순번: '7' })), 7);
  assert.equal(W.편집기번호('<div>없음</div>'), 0);
});

test('로고 올리기 몸통 — 라이믹스 업로드 부품이 싣는 칸 그대로(editor_sequence·upload_target_srl=0·mid·act)', () => {
  const r = W.로고올리기몸통(4, 'partner_board', 로고그림, 'tok9');
  assert.equal(r.ok, true, r.why);
  const 글 = r.몸통.toString('utf8');
  assert.match(글, /name="editor_sequence"\r\n\r\n4\r\n/);
  assert.match(글, /name="upload_target_srl"\r\n\r\n0\r\n/);
  assert.match(글, /name="mid"\r\n\r\npartner_board\r\n/);
  assert.match(글, /name="act"\r\n\r\nprocFileUpload\r\n/);
  assert.match(글, /name="Filedata"; filename="logo-\d+\.png"/);
});

test('로고 올리기 몸통 — 허용 게시판·그림·번호가 아니면 짓지 않는다', () => {
  assert.equal(W.로고올리기몸통(4, 'notice', 로고그림, 'tok9').ok, false);
  assert.equal(W.로고올리기몸통(0, 'partner_board', 로고그림, 'tok9').ok, false);
  assert.equal(W.로고올리기몸통(4, 'partner_board', { 종류: 'text/html', 바이트: Buffer.from('x') }, 'tok9').ok, false);
  assert.equal(W.로고올리기몸통(4, 'partner_board', 로고그림, '').ok, false);
});

test('올리기 답 풀기 — 파일 번호·글 번호·우리 첨부 주소일 때만 믿는다', () => {
  const 좋은 = JSON.stringify({ error: 0, file_srl: 901, upload_target_srl: 900, download_url: '/files/attach/images/2026/10/05/abc.png' });
  const r = W.올리기답풀기(좋은);
  assert.equal(r.ok, true);
  assert.equal(r.file_srl, 901); assert.equal(r.upload_target_srl, 900);
  [
    JSON.stringify({ error: -1, message: 'x' }),
    JSON.stringify({ error: -1, message: 'x', file_srl: 901, upload_target_srl: 900, download_url: '/files/attach/images/a.png' }),
    JSON.stringify({ error: 0, file_srl: 901, upload_target_srl: 900, download_url: 'https://evil.example/x.png' }),
    JSON.stringify({ error: 0, file_srl: 901, upload_target_srl: 900, download_url: '/files/attach/images/a.png" onerror="x' }),
    JSON.stringify({ error: 0, file_srl: 0, upload_target_srl: 900, download_url: '/files/attach/images/a.png' }),
    '<html>오류</html>'
  ].forEach(s => assert.equal(W.올리기답풀기(s).ok, false, s));
});

test('로고 새 글 — 받은 칸 그대로·글 번호는 올리기 답의 번호·본문은 라이믹스 img 꼴·제목은 회사 이름', () => {
  const 올림 = { file_srl: 901, upload_target_srl: 900, download_url: '/files/attach/images/2026/10/05/abc.png' };
  const r = W.로고새글몸통(로고새글화면(), '가나상사', 올림);
  assert.equal(r.ok, true, r.why);
  const p = new URLSearchParams(r.몸통);
  assert.equal(p.get('document_srl'), '900');
  assert.equal(p.get('title'), '가나상사');
  assert.equal(p.get('act'), 'procBoardInsertDocument');
  assert.equal(p.get('_rx_csrf_token'), 'tok9');
  assert.equal(p.get('comment_status'), 'ALLOW', '받은 칸을 빠뜨렸습니다');
  assert.match(p.get('content'), /<img src="\/files\/attach\/images\/2026\/10\/05\/abc\.png" alt="가나상사" editor_component="image_link" data-file-srl="901" \/>/);
});

test('로고 새 글 — 회사 이름의 꺾쇠·따옴표는 거른다, 안전하지 않으면 짓지 않는다', () => {
  const 올림 = { file_srl: 901, upload_target_srl: 900, download_url: '/files/attach/images/a.png' };
  const r = W.로고새글몸통(로고새글화면(), '가나"><script>', 올림);
  assert.ok(!new URLSearchParams(r.몸통).get('content').includes('<script>'));
  assert.equal(W.로고새글몸통(로고새글화면({ mid: 'people_board' }), '가나상사', 올림).ok, false, '다른 게시판');
  assert.equal(W.로고새글몸통(로고새글화면({ srl: '185' }), '가나상사', 올림).ok, false, '고치는 화면');
  assert.equal(W.로고새글몸통(로고새글화면({ 확인표: '' }), '가나상사', 올림).ok, false, '확인표 없음');
  assert.equal(W.로고새글몸통(로고새글화면(), ' ', 올림).ok, false, '이름 없음');
});