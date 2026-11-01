'use strict';
/* 직원 경력 — 본인 동의를 받은 분만 새 사이트에 (대표 승인 2026-11-01 직원 소개 2단계 A안, 사진 제외)
   ★ 여기서 못 박는 것
     ① 동의(받은 날)가 없으면 경력은 새 사이트로 «안 간다» — 이름·직급만 간다.
     ② 경력은 «눌러서 여는 창»으로 붙는다 — 상자 모양(이름·직급 두 칸)은 그대로, 창은 새 사이트가 여는 마크업.
     ③ 다시 그릴 때 지난 창을 걷는다 — 첫 직원의 경력이 모두에게 복사되지 않는다.
     ④ 화면 저장은 «받은 날» 없는 동의를 받지 않는다.
     ⑤ 목록의 「올라감」은 경력까지 같아야 붙는다.
   ★ 직원 수는 쪽에서 읽어 쓴다. 이름은 지어낸 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'pu-site-people.js'));
const P = globalThis.PuSitePeople;
const 원본 = fs.readFileSync(path.join(__dirname, '..', 'site', 'people', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8').replace(/\r\n/g, '\n');
const 주석뺀 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
function fnSource(name) {
  const m = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, name + ' 를 찾지 못했습니다');
  let depth = 0;
  for (let i = html.indexOf('{', m.index); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (!depth) return html.slice(m.index, i + 1); }
  }
  assert.fail(name + ' 끝을 찾지 못했습니다');
}

const 경력 = ['現 푸른노무법인 차장', '前 ○○세무회계 사무원'];

test('★★ 동의(받은 날)가 없으면 경력은 새 사이트로 안 간다', () => {
  const 줄 = P.올릴직원([
    { key: 'a', kind: 'staff', name: '김예시', position1: '사무장', order: 1, careers: 경력 },
    { key: 'b', kind: 'staff', name: '이샘플', position1: '차장', order: 2, careers: 경력, careerConsent: { at: '2026-11-01', how: '서면' } },
    { key: 'c', kind: 'staff', name: '박보기', position1: '과장', order: 3, careers: 경력, careerConsent: { at: '', how: '구두' } }
  ]);
  assert.deepEqual(줄[0].경력, [], '★★ 동의 없는 직원의 경력이 새 사이트로 갑니다');
  assert.deepEqual(줄[1].경력, 경력);
  assert.deepEqual(줄[2].경력, [], '★ 받은 날 없는 동의로 경력이 나갑니다');
});

test('★ 경력은 «눌러서 여는 창»으로 붙고, 상자 두 칸은 그대로다', () => {
  const 새 = P.직원그리기(원본, [{ 이름: '이샘플', 직급: '차장', 경력: 경력 }, { 이름: '김예시', 직급: '사무장', 경력: [] }]);
  const 읽은 = P.직원읽기(새);
  assert.deepEqual(읽은[0], { 이름: '이샘플', 직급: '차장', 경력: 경력 });
  assert.deepEqual(읽은[1].경력, [], '경력 없는 직원에게도 창이 붙었습니다');
  /* 새 사이트 레이아웃 JS 가 여는 꼴 — bh_modal_toggle + data-target 이 가리키는 bh_modal */
  const 표 = /class="bh_modal_toggle" data-target="([^"]+)"/.exec(새);
  assert.ok(표, '★ 창을 여는 손잡이가 없습니다 — 눌러도 안 열립니다');
  assert.match(새, new RegExp('class="bh bh_modal ' + 표[1] + '"'), '★ 손잡이가 가리키는 창이 없습니다');
  assert.equal((새.match(/class="bh_modal_toggle"/g) || []).length, 1, '경력 있는 직원 수만큼만 창이 붙어야 합니다');
  assert.equal(P.사람읽기(새).length, P.사람읽기(원본).length, '★ 직원 창이 노무사 카드 수를 바꿨습니다');
});

test('★★ 다시 그릴 때 지난 창을 걷는다 — 첫 직원의 경력이 모두에게 복사되지 않는다', () => {
  const 한번 = P.직원그리기(원본, [{ 이름: '이샘플', 직급: '차장', 경력: 경력 }, { 이름: '김예시', 직급: '사무장', 경력: [] }]);
  const 두번 = P.직원그리기(한번, [{ 이름: '김예시', 직급: '사무장', 경력: [] }, { 이름: '박보기', 직급: '과장', 경력: [] }]);
  assert.ok(두번.indexOf('pu_staff_more') < 0, '★★ 본(첫 상자)에 남은 지난 창이 새 상자들에 복사됐습니다');
  assert.equal(P.직원그리기(한번, P.직원읽기(한번)), 한번, '경력 창이 있는 쪽을 다시 그리면 달라집니다');
});

test('★ 창 안의 경력·이름은 글자로 들어간다(꺾쇠가 태그가 되지 않는다)', () => {
  const 새 = P.직원그리기(원본, [{ 이름: '<i>최가상</i>', 직급: '주임', 경력: ['<script>x</script> 前 경력'] }]);
  assert.ok(새.indexOf('<script>x</script>') < 0, '★ 경력의 꺾쇠가 태그로 들어갔습니다');
  assert.deepEqual(P.직원읽기(새)[0].경력, ['<script>x</script> 前 경력']);
});

test('★★ 화면 저장은 «받은 날» 없는 동의를 받지 않는다', () => {
  const s = 주석뺀(fnSource('saveDraft'));
  assert.match(s, /d\.consentOk && !\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test/, '★★ 받은 날 없는 동의를 그대로 저장합니다');
  assert.match(s, /next\.careerConsent = !d\.consentOk \? null/, '★ 동의를 끄면 기록이 남아 경력이 계속 나갑니다');
});

test('★ 목록의 「올라감」은 경력까지 같아야 붙는다 — 판단은 부품(올릴직원)이 만든 모양으로', () => {
  const s = 주석뺀(fnSource('직원사이트딱지'));
  assert.match(s, /PuSitePeople\.올릴직원\(/, '★ 화면이 올라갈 모양을 따로 짐작합니다 — 부품과 갈라집니다');
  assert.match(s, /경력/, '★ 경력을 고쳐도 「올라감」으로 남습니다');
});
