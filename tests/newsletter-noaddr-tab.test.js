/* 주소 없는 곳 — 제 탭 · 비슷한 명함 창 · 표 머리 틀고정 (대표 지시 2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   「명함이 없는경우도 있지만 명함이 있을경우 기업정보함에서 찾기보다 팝업창으로
    유사찾기 기능 만들어달라. 그리고 받는명단 왼쪽에 ㅁ 와 넘버링 해라 그리고 캡쳐2
    틀고정, 그리고 주소가 없어 못보내는곳은 별도로 탭을 만들어 달라. 거기서 정리하고
    찾을 수 있게」

   ★ 못 박는 것은 «규칙»이다:
     ① 닮음 — 같은 이름 > 품기 > 두 글자 겹침. 남남은 안 딸려 온다. 한 글자 이름은 같을 때만.
     ② 창은 «후보»만 준다 — 「같은 이름」이 아닌 것을 담을 때는 한 번 더 묻는다.
     ③ 담는 곳은 업체관리 자료 한 곳(명함을사업장에) — update 만, 못 찾으면 멈춘다.
     ④ 주소 없는 곳은 제 탭 — 체크칸·번호·찾기·칩, 받는 명단의 체크(.chk)와 안 섞인다.
     ⑤ 사업장 표의 제목줄+머리줄은 thead «한 덩이»로 붙는다(px 로 박지 않는다).
   ■ 화면 함수는 «실제로 돌려» 본다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripByName } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const Core = require('../js/pu-news-core.js');
const ROOT = path.join(__dirname, '..');
const 화면 = stripByName('pu-news.html',
  fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n'));

const 명함 = (c, n, e, ti, k) => ({ k: k || 'card', c, n, e, ti: ti || '' });

/* ═══ ① 닮음 ══════════════════════════════════════════════════════════════ */

test('★★ 닮음 — 같은 이름 1 · 품기 0.8~0.9 · 두 글자 겹침은 그 밑', () => {
  assert.equal(Core.회사닮음('㈜한진철관', '한진철관(주)'), 1, '㈜·(주)를 빼면 같은 이름이다');
  const 품 = Core.회사닮음('한진철관', '한진철관산업');
  assert.ok(품 >= 0.8 && 품 < 1, '한쪽이 다른 쪽을 품으면 0.8~0.9 여야 한다: ' + 품);
  const 겹 = Core.회사닮음('푸른건설', '푸른종합건설');
  assert.ok(겹 >= 0.4 && 겹 < 0.8, '「푸른건설」↔「푸른종합건설」은 비슷한 후보여야 한다: ' + 겹);
  assert.ok(Core.회사닮음('푸른건설', '대한건설') < 0.4,
    '★★ 「건설」만 같은 남남이 딸려 온다 — 후보가 쓰레기로 찬다');
});

test('★★ 한 글자 이름(「㈜감」)은 «같을 때만» — 「감」이 든 회사가 다 딸려 오면 안 된다', () => {
  assert.equal(Core.회사닮음('㈜감', '감나무농원'), 0);
  assert.equal(Core.회사닮음('㈜감', '감'), 1);
});

test('★ 비슷한명함찾기 — 사람 명함만 · 주소 꼴 · 이미 쓰는 주소 빼고 · 닮은 차례', () => {
  const 것 = Core.비슷한명함찾기('푸른건설', [
    명함('푸른종합건설', '박담당', 'park@a.kr', '과장'),
    명함('푸른건설㈜', '김대표', 'ceo@b.kr', '대표이사'),
    명함('푸른건설', '사업자', 'biz@b.kr', '', 'biz'),       /* 사업자등록증 — 사람 아님 */
    명함('푸른건설', '주소틀림', 'not-an-email'),
    명함('푸른건설', '이미씀', 'Used@b.kr'),
    명함('대한건설', '남남', 'x@c.kr'),
  ], { 이미: ['used@b.kr'] });
  assert.deepEqual(것.map((x) => x.이름), ['김대표', '박담당'], '고른 것·차례가 틀렸다');
  assert.equal(것[0].같은이름, true);
  assert.equal(것[0].누구, '대표자', '대표 직책이면 대표자 자리로 권해야 한다');
  assert.equal(것[1].같은이름, false);
  assert.equal(것[1].누구, '담당자');
});

test('같은 주소 명함이 여러 장이면 «가장 닮은» 한 장만', () => {
  const 것 = Core.비슷한명함찾기('한진철관', [
    명함('한진철관산업', '홍', 'h@a.kr'),
    명함('한진철관', '홍', 'H@a.kr'),
  ]);
  assert.equal(것.length, 1);
  assert.equal(것[0].같은이름, true);
});

/* ═══ ② 창 — 후보만 준다 · 담기는 한 곳 ═══════════════════════════════════ */

function 짐만들기(사업장들, 명함들) {
  const 쓴것 = [];
  const 요소 = {};
  const $ = (id) => (요소[id] = 요소[id] || { value: '', textContent: '', innerHTML: '',
    classList: { add() {}, remove() {} } });
  const 짐 = {
    App: { 사업장들, 명함들, 설정: { 범위: '자문중' }, 빈곳고름: {}, 빈곳명함: '', 빈곳찾기: '', 유사: null },
    Core, $, 요소, 쓴것, 알림: [], 물음: [], 그림: 0,
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    db: { ref: (p) => ({ update: async (v) => { 쓴것.push({ p, v, 꼴: 'update' }); },
                         set: async (v) => { 쓴것.push({ p, v, 꼴: 'set' }); } }) },
    window: { confirm: (m) => { 짐.물음.push(m); return 짐.답 !== false; } },
    오늘: () => '2026-09-27',
  };
  짐.toast = (m) => 짐.알림.push(m);
  짐.render = () => { 짐.그림++; };
  짐.기업정보함에서찾기 = (q) => { 짐.연곳 = q; };
  vm.createContext(짐);
  ['async function 명함을사업장에(', 'function 유사창열기(', 'function 유사창닫기(',
   'function 유사찾기다시(', 'function 유사창그리기(', 'function 유사고름(', 'function 유사자리(',
   'function 유사창셈(', 'async function 유사담기(', 'async function 유사직접넣기(',
   'function 빈곳줄들(', 'function 빈곳거르기(', 'function 빈곳표줄(', 'function 주소없는곳화면(',
   'function 빈곳찾기(', 'function 빈곳칩(']
    .forEach((d) => vm.runInContext(cutFn(화면, d), 짐));
  return 짐;
}

const 두곳 = () => ({
  c1: { id: 'c1', name: '㈜한진철관', status: 'active', typeCode: 'advisory', ceo: '이형석',
        contacts: [{ name: '있던분', email: 'old@hj.kr' }] },
  c2: { id: 'c2', name: '다다정밀', status: 'active', ceo: '손영호' },
});

test('★★★ 「같은 이름」이 아닌 명함을 담을 때는 «한 번 더 묻는다» — 아니라면 안 쓴다', async () => {
  const 짐 = 짐만들기(두곳(), [명함('한진철관산업', '박과장', 'park@hj.kr', '과장')]);
  vm.runInContext("유사창열기('c1')", 짐);
  assert.equal(짐.App.유사.것들.length, 1, '품는 이름의 명함을 못 찾았다');
  vm.runInContext("유사고름(0, true)", 짐);
  짐.답 = false;
  await vm.runInContext('유사담기()', 짐);
  assert.equal(짐.물음.length, 1, '★★★ 비슷하기만 한 명함을 묻지도 않고 담는다');
  assert.equal(짐.쓴것.length, 0, '★★★ 아니라고 했는데 업체관리에 썼다');
});

test('★★★ 담기는 업체관리에 «update» 로 — 담당자는 «더하고» 있던 분을 지우지 않는다', async () => {
  const 짐 = 짐만들기(두곳(), [명함('한진철관', '박과장', 'park@hj.kr', '과장')]);
  vm.runInContext("유사창열기('c1')", 짐);
  vm.runInContext("유사고름(0, true)", 짐);
  await vm.runInContext('유사담기()', 짐);
  assert.equal(짐.물음.length, 0, '같은 이름인데 괜히 묻는다');
  assert.equal(짐.쓴것.length, 1);
  assert.equal(짐.쓴것[0].꼴, 'update', '★★★ set 으로 통째 쓴다 — 다른 방이 고치던 것을 덮는다');
  assert.equal(짐.쓴것[0].p, 'data/companies/v/c1');
  assert.deepEqual(짐.쓴것[0].v.contacts.map((c) => c.email), ['old@hj.kr', 'park@hj.kr'],
    '★★★ 있던 담당자를 지웠다');
  assert.equal(짐.App.유사, null, '담은 뒤 창이 안 닫혔다');
});

test('★★ 대표자는 한 장만 — 둘을 고르면 뒤엣것이 말없이 덮는다', async () => {
  const 짐 = 짐만들기(두곳(), [명함('한진철관', '가', 'a@hj.kr', '대표이사'),
                               명함('한진철관', '나', 'b@hj.kr', '대표')]);
  vm.runInContext("유사창열기('c1'); 유사고름(0, true); 유사고름(1, true)", 짐);
  await vm.runInContext('유사담기()', 짐);
  assert.equal(짐.쓴것.length, 0, '★★ 대표자 둘을 그대로 썼다');
  assert.match(짐.알림.join(' '), /대표자는 한 장만/);
});

test('넣을 자리는 사람이 바꿀 수 있다 — 대표 직책이 아니어도 대표자 칸으로', async () => {
  const 짐 = 짐만들기(두곳(), [명함('한진철관', '가', 'a@hj.kr', '실장')]);
  vm.runInContext("유사창열기('c1'); 유사자리(0, '대표자'); 유사고름(0, true)", 짐);
  await vm.runInContext('유사담기()', 짐);
  assert.equal(짐.쓴것[0].v.ceoEmail, 'a@hj.kr');
});

test('★★★ 업체관리에서 사업장을 못 찾으면 «멈춘다» — 빈 것으로 담당자 목록을 덮지 않는다', async () => {
  const 짐 = 짐만들기({}, []);
  await assert.rejects(() => vm.runInContext(
    "명함을사업장에('없는곳', { 이름:'a', 직책:'', 주소:'a@a.kr' }, '담당자')", 짐));
  assert.equal(짐.쓴것.length, 0);
});

test('★★ 명함담기(받는 명단)와 유사담기(창)는 «같은 길»(명함을사업장에)로 쓴다', () => {
  assert.ok(cutFn(화면, 'async function 명함담기(').indexOf('명함을사업장에(') >= 0,
    '명함담기 가 제 길로 따로 쓴다 — 한쪽만 고쳐져 어긋난다');
  assert.ok(cutFn(화면, 'async function 유사담기(').indexOf('명함을사업장에(') >= 0);
});

test('★★ 직접 넣기 — 빈 주소·틀린 꼴은 막고, 차 있는 주담당은 «덮지 않고» 목록에 더한다', async () => {
  const 곳 = 두곳(); 곳.c2.primaryContactEmail = 'main@dd.kr';
  const 짐 = 짐만들기(곳, []);
  vm.runInContext("유사창열기('c2')", 짐);
  짐.요소.simWho.value = '담당자'; 짐.요소.simMail.value = '';
  await vm.runInContext('유사직접넣기()', 짐);
  짐.요소.simMail.value = 'nope';
  await vm.runInContext('유사직접넣기()', 짐);
  assert.equal(짐.쓴것.length, 0, '★★ 빈 주소·틀린 꼴을 썼다');
  짐.요소.simMail.value = 'new@dd.kr';
  await vm.runInContext('유사직접넣기()', 짐);
  assert.equal(짐.쓴것.length, 1);
  assert.ok(!('primaryContactEmail' in 짐.쓴것[0].v), '★★ 차 있던 주담당 주소를 덮었다');
  assert.deepEqual(짐.쓴것[0].v.contacts.map((c) => c.email), ['new@dd.kr']);
});

/* ═══ ④ 주소 없는 곳 탭 ═══════════════════════════════════════════════════ */

function 탭짐() {
  const 짐 = 짐만들기(두곳(), []);
  짐.명단셈 = () => ({ 주소없는곳: [{ id: 'c2', name: '다다정밀', 대표자: '손영호' },
                                  { id: 'c1', name: '㈜한진철관', 대표자: '이형석' }] });
  짐.명함후보 = () => ({ 대표자: [{ 사업장: 'c1' }], 담당자: [{ 사업장: 'c1' }] });
  return 짐;
}

test('★★★ 탭 — 줄마다 체크칸과 번호, 머리와 몸통의 열 수가 같다', () => {
  const 짐 = 탭짐();
  const h = vm.runInContext('주소없는곳화면()', 짐);
  const 머리 = h.slice(h.indexOf('<tr><th class="ck">'), h.indexOf('</thead>'));
  const 몸 = h.slice(h.indexOf('<tbody id="naBody">'), h.indexOf('</tbody>'));
  const 첫줄 = 몸.slice(몸.indexOf('<tr>'), 몸.indexOf('</tr>'));
  assert.equal((머리.match(/<th/g) || []).length, (첫줄.match(/<td/g) || []).length,
    '★★★ 머리와 줄의 칸 수가 다르다 — 표가 한 칸씩 밀린다');
  assert.match(첫줄, /class="chk3"/, '★★★ 줄에 체크칸이 없다');
  assert.match(첫줄, /<td class="n">1<\/td>/, '★★★ 번호가 없다');
  assert.ok(!/class="chk"/.test(h),
    '★★ 받는 명단의 .chk 를 쓴다 — 주소가 없는 줄이 고른것엑셀·수신거부에 섞인다');
});

test('★★ 명함이 있는 곳은 «창»이 먼저 — 짙은 단추가 유사창열기 를 부른다', () => {
  const 짐 = 탭짐();
  const 몸 = vm.runInContext('빈곳표줄(빈곳줄들())', 짐);
  const 한진 = 몸.split('</tr>').find((r) => r.indexOf('한진철관') >= 0);
  assert.match(한진, /명함 2장/, '명함 장수가 안 보인다');
  assert.match(한진, /class="mini on" onclick="유사창열기\('c1'\)"/, '★★ 명함이 있는데 창 단추가 먼저가 아니다');
  assert.match(한진, /빈곳기업정보함\('c1'\)/, '기업정보함으로 가는 길이 사라졌다');
  const 다다 = 몸.split('</tr>').find((r) => r.indexOf('다다정밀') >= 0);
  assert.match(다다, /명함 없음/);
  assert.match(다다, /유사창열기\('c2'\)/, '명함이 없는 곳도 비슷한 명함은 찾을 수 있어야 한다');
});

test('★★ 찾기·칩으로 거른다 — 띄어쓰기는 빼고 견준다, 번호는 다시 1번부터', () => {
  const 짐 = 탭짐();
  짐.App.빈곳찾기 = '한진 철관';
  let 몸 = vm.runInContext('빈곳표줄(빈곳거르기(빈곳줄들()))', 짐);
  assert.ok(몸.indexOf('한진철관') >= 0 && 몸.indexOf('다다정밀') < 0, '찾는 말로 못 거른다');
  assert.match(몸, /<td class="n">1<\/td>/);
  짐.App.빈곳찾기 = ''; 짐.App.빈곳명함 = '없음';
  몸 = vm.runInContext('빈곳표줄(빈곳거르기(빈곳줄들()))', 짐);
  assert.ok(몸.indexOf('다다정밀') >= 0 && 몸.indexOf('한진철관') < 0, '「명함 없음」 칩이 안 거른다');
});

test('★ 찾는 말을 칠 때 화면 전체를 다시 그리지 않는다 — 커서가 날아간다', () => {
  const 짐 = 탭짐();
  vm.runInContext("빈곳찾기('다다')", 짐);
  assert.equal(짐.그림, 0, '★ 글자마다 render() 를 부른다 — 치는 도중에 찾는 칸이 새로 생긴다');
  assert.match(짐.요소.naBody.innerHTML, /다다정밀/);
  assert.equal(String(짐.요소.naCnt.textContent), '1');
});

test('★ 명함을 아직 못 읽었으면 「명함 없음」이라 하지 않는다', () => {
  const 짐 = 탭짐();
  짐.명함후보 = () => null;
  const 몸 = vm.runInContext('빈곳표줄(빈곳줄들())', 짐);
  assert.ok(몸.indexOf('명함 없음') < 0, '읽기 전인데 「명함 없음」이라 한다 — 거짓이다');
  assert.match(몸, /명함 읽는 중/);
});

test('★ 탭이 있고, 받는 명단과 같은 껍데기(위를 얼리고 .whorest 만 구른다)를 쓴다', () => {
  assert.match(화면, /<button data-t="noaddr">/, '주소 없는 곳 탭 단추가 없다');
  assert.match(화면, /if\(App\.tab==='noaddr'\)\{[^}]*주소없는곳화면\(\)/, 'render 가 탭을 안 그린다');
  assert.match(화면, /classList\.toggle\('who', App\.tab==='who' \|\| App\.tab==='noaddr'\)/,
    '얼리는 껍데기를 안 쓴다 — 표가 잘리거나 위가 사라진다');
  const 명단 = cutFn(화면, 'function 명단화면(');
  assert.ok(명단.indexOf("App.tab='noaddr'") >= 0, '받는 명단에서 새 탭으로 가는 길이 없다');
});

/* ═══ ⑤ 표 머리 틀고정 ══════════════════════════════════════════════════════ */

test('★★ 사업장 표 — 제목줄과 머리줄이 thead «한 덩이»로 붙는다', () => {
  assert.match(화면, /table\.list\.fz>thead\{position:sticky;top:0/, '★★ thead 를 붙이는 규칙이 없다');
  const 명단 = cutFn(화면, 'function 명단화면(');
  assert.match(명단, /<table class="list fz"><thead><tr><th class="cap" colspan="\$\{[^}]+\}">🏢 사업장/,
    '★★ 사업장 제목줄이 thead 안에 없다 — 머리줄만 붙고 제목은 올라가 버린다');
  assert.ok(!/colspan="99"/.test(명단), '제목 칸을 99 칸으로 벌렸다 — 보이지 않는 빈 열이 생긴다');
});
