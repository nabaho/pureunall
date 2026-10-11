'use strict';
/* 포털 뉴스레터 ⚠ → «왜 떴는지» 팝업
   (대표 지시 2026-10-11 「경고표시 뭐냐 이런 경고표시는 어떻게 되는지 알수 있어야 된다. 클릭하면 왜 경고가 나왔는지
    팝업 나오게 해달라」 → 목업 → 「추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① 서버 경고판은 줄마다 {종류·말·까닭·때} 를 적는다 — 말들·경고수는 예전 그대로(줄들 에서 뽑는다)
        · AI 교정이 올린 줄은 ai 로 따로 · 최대 5줄 · 반송은 건수(수)를 달고 · 실시간DB 가 못 받는 값(undefined)이 없다
     ② ⚠ 를 누르면 팝업이 열리고, 타일 전체를 누른 것(앱 열기)은 같이 돌지 않는다
     ③ 팝업은 줄마다 칩·제목·«왜 떴나요»·«어떻게 하나요» — 시각은 서울 시각(10/11(일) 18:00)
     ④ 옛 경고판(줄들 없음 · 말들 만 있음)도 그린다
     ⑤ 까닭 글은 AI 가 쓴 것 — textContent 로만 넣는다(마크업으로 읽히지 않는다)
     ⑥ 닫기: 단추·바깥·ESC, 포커스는 ⚠ 로 돌아간다 · 「열기」는 타일을 누른 것과 «똑같이» · Tab 은 창 안에서 돈다
   ⚠ 포털 코드는 vm 에 «실제로» 올려 돌린다 — 글자만 찾는 검사는 템플릿 안 코드가 지워져도 초록이다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');
const { 가짜칸, 가짜문서, 발사, 클래스로 } = require('./helpers/fake-dom.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 포털 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8')).replace(/\r\n/g, '\n');
const 함수 = (src, 머리) => { const i = src.indexOf(머리); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

/* 포털의 팝업 코드 한 덩어리 — 종류표(var 뉴스레터종류)부터 뉴스레터경고달기 끝까지.
   즉시 실행 함수 «안»이라 두 칸 들여 있다 — 끝도 두 칸 들인 } 로 찾는다. */
const 덩어리 = (() => {
  const 시작 = 포털.indexOf('var 뉴스레터종류');
  assert.ok(시작 > 0, '팝업 코드(var 뉴스레터종류)가 없다');
  const 머리 = 포털.indexOf('function 뉴스레터경고달기', 시작);
  assert.ok(머리 > 시작, 'function 뉴스레터경고달기 가 없다');
  return 포털.slice(시작, 포털.indexOf('\n  }\n', 머리) + 4);
})();
const 모달아이디 = ['nlWarnModal', 'nlwTitle', 'nlwSub', 'nlwBody', 'nlwClose', 'nlwOk', 'nlwGo'];

/* 포털 코드를 돌려 «경고판 값»으로 배지를 달게 한다 */
async function 띄우기(값) {
  const 붙은것 = [];
  const 칸 = new 가짜칸('a');
  칸.href = 'pu-news.html?sso=1';
  칸.appendChild = (x) => { 붙은것.push(x); return x; };
  const 문서 = 가짜문서(모달아이디, 칸);
  칸._문서 = 문서;
  문서._칸들.nlWarnModal.style.display = 'none';
  const 짐 = { document: 문서, db: { ref: () => ({ once: () => Promise.resolve({ val: () => 값 }) }) } };
  짐.$ = (id) => 문서.getElementById(id);
  vm.createContext(짐);
  vm.runInContext(덩어리 + '\n뉴스레터경고달기();', 짐);
  await new Promise((r) => setImmediate(r));
  return { 칸, 붙은것, 문서, 배지: 붙은것[0], 모달: 문서._칸들.nlWarnModal, 짐 };
}
const 칸글 = (문서, id) => 문서._칸들[id].textContent;
const 줄들보기 = (문서) => 문서._칸들.nlwBody.children;

const 점검때 = 1791709205829;   /* 2026-10-11(일) 18:00:05 서울 — 이번 오탐이 실제로 기록된 때 */
const 실제값 = {
  경고수: 2, 열쇠: '2026-10-w2', 회차이름: '2026년 10월 2주차', 탭: 'watch',
  말들: ['🤖 근로기준법 제55조 조문 내용 반복', '월요일에 나갈 확정본이 없습니다'],
  줄들: [
    { 종류: 'ai', 말: '🤖 근로기준법 제55조 조문 내용 반복', 까닭: "법제처 원문 조문에서 '① ①', '② ②'와 같이 번호가 중복 기재되어 있습니다.", 때: 점검때 },
    { 종류: 'block', 말: '월요일에 나갈 확정본이 없습니다', 까닭: '금요일 준비가 확정본을 못 만들었습니다', 때: 0 }
  ]
};

/* ───────────────────────── ① 서버 ───────────────────────── */

test('① 서버 경고판 — 줄마다 {종류·말·까닭·때}, 말들·경고수는 줄들 에서 뽑는다', () => {
  const w = { 열쇠: '2026-10-w2', 점검: { 때: 점검때, 항목들: [
    { 수준: 'you', 제목: '🤖 근로기준법 제55조 조문 내용 반복', 설명: "법제처 원문 조문에서 '① ①'…", ai: true },
    { 수준: 'block', 제목: '월요일에 나갈 확정본이 없습니다', 설명: '금요일 준비가 확정본을 못 만들었습니다' },
    { 수준: 'you', 제목: '링크가 열리지 않습니다', 설명: '정책 「예시」 — 404' },
    { 수준: 'ok', 제목: '받는 곳 179곳' }, { 수준: 'fix', 제목: '다시 함' }] } };
  const 판 = W.경고판짓기(w, {}, { 회차이름: '2026년 10월 2주차' });
  assert.strictEqual(판.경고수, 3, '정상·고친 것은 안 센다');
  assert.deepStrictEqual(판.줄들.map((x) => x.종류), ['ai', 'block', 'you'], 'AI 교정 줄은 ai, 안 나감은 block, 나머지 확인은 you');
  assert.deepStrictEqual(판.말들, 판.줄들.map((x) => x.말), '말들 이 줄들 과 어긋났다(예전 화면·검사가 말들 을 읽는다)');
  assert.match(판.줄들[0].까닭, /① ①/, 'AI 가 적은 설명(까닭)이 안 실렸다 — 팝업이 «왜»를 못 보인다');
  assert.strictEqual(판.줄들[0].때, 점검때, '점검한 때가 안 실렸다');
  assert.strictEqual(판.회차이름, '2026년 10월 2주차');
  assert.strictEqual(판.탭, 'watch');
});

test('① 보내기 전 막힘(발송·포기)과 보낸 뒤 전달 실패도 종류가 갈린다', () => {
  const 전 = W.경고판짓기({ 열쇠: 'k', 발송: { 상태: 'block', 말: '오늘 뉴스레터가 안 나갔습니다 — 확정본 상태 «거는중»', 때: 111 },
    포기: { 상태: 'block', 말: 'AI 초안을 못 채웠습니다', 때: 222 } }, {});
  assert.deepStrictEqual(전.줄들.map((x) => [x.종류, x.때]), [['send', 111], ['giveup', 222]]);
  const 후 = W.경고판짓기({ 열쇠: 'k', 발송: { 상태: 'ok' }, 전달경보: { 상태: 'block', 말: '3통이 못 나갔습니다', 때: 333 },
    점검: { 항목들: [{ 수준: 'you', 제목: '지난주 일' }] } }, {});
  assert.deepStrictEqual(후.줄들.map((x) => [x.종류, x.말, x.때]), [['delivery', '3통이 못 나갔습니다', 333]], '보낸 뒤엔 그 주 점검 항목을 안 센다');
});

test('① 같은 말은 한 번 · 빈 말은 뺀다 · 다섯 줄까지(경고수는 전부) · 실시간DB 가 받는 값만', () => {
  const 항목들 = Array.from({ length: 7 }, (_, i) => ({ 수준: 'you', 제목: '일' + i }))
    .concat([{ 수준: 'you', 제목: '일0' }, { 수준: 'you', 제목: '' }]);
  const 판 = W.경고판짓기({ 열쇠: 'k', 점검: { 때: 5, 항목들 } }, {});
  assert.strictEqual(판.경고수, 7, '같은 말·빈 말까지 세어 숫자가 부풀었다');
  assert.strictEqual(판.줄들.length, 5);
  assert.strictEqual(판.말들.length, 5);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(판)), 판, 'undefined 가 들어 있다 — 실시간DB set 이 던진다');
});

test('① 반송·수신거부는 건수(수)를 달고 마지막 줄로 — 반송만 있으면 탭이 bounce', () => {
  const 열림 = (n) => { const o = {}; for (let i = 0; i < n; i++) o['b' + i] = { 갈래: '서버거부', 상태: '열림' }; return o; };
  const 혼합 = W.경고판짓기({ 열쇠: 'k', 점검: { 때: 5, 항목들: [{ 수준: 'you', 제목: '확인할 것' }] } }, 열림(3));
  assert.strictEqual(혼합.경고수, 4, '확인 1 + 반송 3');
  assert.deepStrictEqual(혼합.줄들.map((x) => x.종류), ['you', 'bounce']);
  assert.strictEqual(혼합.줄들[1].수, 3);
  assert.strictEqual(혼합.탭, 'watch');
  const 반송만 = W.경고판짓기({ 열쇠: 'k' }, 열림(2));
  assert.strictEqual(반송만.탭, 'bounce');
  assert.strictEqual(반송만.경고수, 2);
  const 회차없음 = W.경고판짓기(null, 열림(2));
  assert.deepStrictEqual([회차없음.경고수, 회차없음.탭, 회차없음.줄들.length, 회차없음.줄들[0].수], [2, 'bounce', 1, 2]);
  const 깨끗 = W.경고판짓기(null, {});
  assert.deepStrictEqual([깨끗.경고수, 깨끗.줄들.length], [0, 0]);
  assert.ok(!('회차이름' in 깨끗), '이름이 없으면 칸도 안 만든다');
});

test('① 서버가 회차 이름을 읽어 경고판에 싣는다', () => {
  const 갱신 = 함수(서버, 'async function 뉴스레터경고판갱신');
  assert.match(갱신, /newsletter\/issues\/" \+ 열쇠 \+ "\/회차\/이름/, '회차 이름을 안 읽는다 — 팝업 머리말이 열쇠(2026-10-w2)로 나온다');
  assert.match(갱신, /경고판짓기\([^;]*회차이름/, '읽은 이름을 경고판짓기 에 안 넘긴다');
});

/* ───────────────────────── ② ③ 팝업 ───────────────────────── */

test('② 문제가 없으면 아무것도 안 단다 · 있으면 «⚠ n» 이 단추 모양(role·tabindex·aria)으로 달린다', async () => {
  const 없음 = await 띄우기({ 경고수: 0 });
  assert.strictEqual(없음.붙은것.length, 0, '문제가 없는데 표시를 단다');
  const 있음 = await 띄우기(실제값);
  assert.strictEqual(있음.붙은것.length, 1);
  assert.strictEqual(있음.배지.textContent, '⚠ 2');
  assert.strictEqual(있음.배지.getAttribute('role'), 'button', '키보드·화면읽개가 단추로 못 읽는다');
  assert.strictEqual(있음.배지.getAttribute('tabindex'), '0');
  assert.match(있음.배지.getAttribute('aria-label'), /2건/);
  assert.match(있음.칸.title, /근로기준법 제55조 조문 내용 반복/, '마우스를 올리면 제목은 예전처럼 보인다');
  assert.match(있음.칸.title, /⚠ 를 누르면 까닭이 보입니다/, '눌러 보라는 안내가 없다');
  assert.match(있음.칸.href, /tab=watch/, '타일은 예전처럼 자동화 점검으로 간다');
  assert.strictEqual(있음.모달.style.display, 'none', '누르기 전에 팝업이 열려 있다');
});

test('② ⚠ 를 누르면 팝업이 열리고 타일(앱 열기)은 같이 안 돈다', async () => {
  const { 배지, 모달, 칸, 문서 } = await 띄우기(실제값);
  const e = 발사(배지, 'click');
  assert.strictEqual(e.막음, true, '링크로 가는 것을 못 막는다(폰에서 곧바로 앱이 열린다)');
  assert.strictEqual(e.멈춤, true, '타일의 클릭 처리(앱 열기)가 같이 돈다');
  assert.strictEqual(모달.style.display, 'flex');
  assert.strictEqual(칸.눌림, 0, '팝업을 여는데 타일이 눌렸다');
  assert.strictEqual(문서.activeElement, 문서._칸들.nlwOk, '열면 포커스가 창 안으로 들어가야 한다');
});

test('③ 팝업 내용 — 제목·머리말·줄마다 칩/제목/왜 떴나요/어떻게 하나요/시각', async () => {
  const { 배지, 문서 } = await 띄우기(실제값);
  발사(배지, 'click');
  assert.strictEqual(칸글(문서, 'nlwTitle'), '뉴스레터 — 확인할 것 2건');
  assert.strictEqual(칸글(문서, 'nlwSub'), '2026년 10월 2주차', '머리말은 사람이 읽는 회차 이름');
  const 줄 = 줄들보기(문서);
  assert.strictEqual(줄.length, 2);
  /* 첫 줄 — AI 교정이 올린 것 */
  assert.match(줄[0].className, /\bit\b.*\bamber\b/, 'AI 교정 줄은 amber(확인 필요)');
  assert.strictEqual(클래스로(줄[0], 'chip')[0].textContent, '🤖 AI 교정이 올림');
  assert.strictEqual(클래스로(줄[0], 'when')[0].textContent, '10/11(일) 18:00', '시각은 서울 시각 «월/일(요일) 시:분»');
  assert.strictEqual(클래스로(줄[0], 't')[0].textContent, '🤖 근로기준법 제55조 조문 내용 반복');
  const 라벨0 = 클래스로(줄[0], 'l').map((x) => x.textContent), 글0 = 클래스로(줄[0], 'p').map((x) => x.textContent);
  assert.deepStrictEqual(라벨0, ['왜 떴나요', '어떻게 하나요']);
  assert.match(글0[0], /번호가 중복 기재되어 있습니다/, '«왜»가 서버가 적은 까닭 그대로 나와야 한다');
  assert.match(글0[1], /틀릴 수도 있어 사람이 보고 판단/, 'AI 줄은 «틀릴 수도 있다»고 알려야 한다');
  assert.match(글0[1], /발송은 막지 않습니다/);
  /* 둘째 줄 — 안 나감(red), 시각 없음 */
  assert.match(줄[1].className, /\bred\b/);
  assert.strictEqual(클래스로(줄[1], 'when').length, 0, '시각이 0 인데 시각 칸을 그렸다');
  assert.match(클래스로(줄[1], 'p')[1].textContent, /월요일에 편지가 나가지 않습니다/);
  assert.match(칸글(문서, 'nlwGo'), /^자동화 점검 열기/);
});

test('③ 종류마다 칩·색·안내가 있다 — 모르는 종류(__proto__ 따위)는 «확인 필요»로', async () => {
  const 종류들 = ['ai', 'you', 'block', 'send', 'giveup', 'delivery', 'bounce'];
  const { 배지, 문서 } = await 띄우기({ 경고수: 종류들.length, 열쇠: 'k', 줄들: 종류들.map((k) => ({ 종류: k, 말: k + ' 말', 까닭: '', 때: 0 })) });
  발사(배지, 'click');
  const 줄 = 줄들보기(문서);
  assert.strictEqual(줄.length, 종류들.length);
  const 톤 = 줄.map((r) => r.className.replace(/^it /, ''));
  assert.deepStrictEqual(톤, ['amber', 'amber', 'red', 'red', 'red', 'red', 'gray']);
  줄.forEach((r, i) => {
    assert.ok(클래스로(r, 'chip')[0].textContent.length > 1, 종류들[i] + ' 의 칩이 비었다');
    assert.ok(클래스로(r, 'p').pop().textContent.length > 20, 종류들[i] + ' 의 «어떻게 하나요» 안내가 비었다');
    assert.strictEqual(클래스로(r, 'l').length, 1, '까닭이 비면 «왜 떴나요»를 그리지 않는다(빈 칸 금지)');
  });
  const 낯선 = await 띄우기({ 경고수: 2, 열쇠: 'k', 줄들: [{ 종류: '__proto__', 말: 'a', 까닭: '', 때: 0 }, { 종류: 'constructor', 말: 'b', 까닭: '', 때: 0 }] });
  발사(낯선.배지, 'click');
  assert.deepStrictEqual(줄들보기(낯선.문서).map((r) => r.className), ['it amber', 'it amber']);
});

test('④ 옛 경고판(줄들 없음)도 그린다 — 말들 만으로 «확인 필요» 줄 · 실시간DB 가 객체로 준 말들도', async () => {
  const 옛 = await 띄우기({ 경고수: 2, 열쇠: '2026-10-w2', 말들: ['오늘 뉴스레터가 안 나갔습니다', '링크가 열리지 않습니다'], 탭: 'watch' });
  발사(옛.배지, 'click');
  assert.strictEqual(칸글(옛.문서, 'nlwSub'), '2026-10-w2', '회차 이름이 없으면 열쇠로');
  const 줄 = 줄들보기(옛.문서);
  assert.deepStrictEqual(줄.map((r) => 클래스로(r, 't')[0].textContent), ['오늘 뉴스레터가 안 나갔습니다', '링크가 열리지 않습니다']);
  assert.ok(줄.every((r) => 클래스로(r, 'chip')[0].textContent === '⚠ 확인 필요'));
  assert.ok(줄.every((r) => 클래스로(r, 'l').length === 1), '까닭을 모르는데 «왜 떴나요»를 그렸다');
  const 객체 = await 띄우기({ 경고수: 2, 열쇠: 'k', 말들: { 0: '하나', 1: '둘' } });
  assert.match(객체.칸.title, /하나\n· 둘/, '객체로 온 말들 로 제목 풍선이 깨졌다');
  발사(객체.배지, 'click');
  assert.strictEqual(줄들보기(객체.문서).length, 2);
});

test('③ «외 n건» — 다섯 줄을 넘는 경고수는 머리말이 알려 준다(반송 건수는 수로 센다)', async () => {
  const 넘침 = await 띄우기({ 경고수: 7, 열쇠: 'k', 줄들: Array.from({ length: 5 }, (_, i) => ({ 종류: 'you', 말: '일' + i, 까닭: '', 때: 0 })) });
  발사(넘침.배지, 'click');
  assert.match(칸글(넘침.문서, 'nlwSub'), /외 2건은 자동화 점검에서 볼 수 있습니다/);
  const 맞음 = await 띄우기({ 경고수: 4, 열쇠: 'k', 줄들: [{ 종류: 'you', 말: 'a', 까닭: '', 때: 0 }, { 종류: 'bounce', 말: '반송·수신거부 검토 3건', 까닭: '', 때: 0, 수: 3 }] });
  발사(맞음.배지, 'click');
  assert.doesNotMatch(칸글(맞음.문서, 'nlwSub'), /외 \d+건/, '반송 3건(수 3)을 한 줄로만 세어 «외 2건»이 거짓으로 뜬다');
  const 반송탭 = await 띄우기({ 경고수: 2, 열쇠: 'k', 탭: 'bounce', 줄들: [{ 종류: 'bounce', 말: '반송·수신거부 검토 2건', 까닭: '', 때: 0, 수: 2 }] });
  발사(반송탭.배지, 'click');
  assert.match(칸글(반송탭.문서, 'nlwGo'), /^반송·거부 열기/, '반송만 있는데 자동화 점검으로 보낸다');
});

test('⑤ AI 가 쓴 글은 textContent 로만 — 마크업이 살아나지 않는다', async () => {
  const 위험 = '<img src=x onerror=alert(1)> <b>굵게</b> & "따옴표"';
  /* 가짜 DOM 은 innerHTML 에 쓰면 «던진다» — 코드가 그 길을 쓰면 여기서 터진다 */
  const { 배지, 문서 } = await 띄우기({ 경고수: 1, 열쇠: 'k', 줄들: [{ 종류: 'ai', 말: '제목 ' + 위험, 까닭: 위험, 때: 0 }] });
  발사(배지, 'click');
  const 줄 = 줄들보기(문서)[0];
  assert.strictEqual(클래스로(줄, 't')[0].textContent, '제목 ' + 위험, '글이 가공됐다');
  assert.strictEqual(클래스로(줄, 'p')[0].textContent, 위험);
  /* 소스에도 innerHTML 이 없다 */
  assert.ok(!/innerHTML/.test(덩어리), '팝업 코드가 innerHTML 을 쓴다 — AI 글이 마크업으로 읽힌다');
});

/* ───────────────────────── ⑥ 닫기·열기·포커스 ───────────────────────── */

test('⑥ 닫기 — 단추 둘·바깥 누르기, 포커스는 ⚠ 로 돌아간다(창 안을 누르면 안 닫힌다)', async () => {
  const { 배지, 모달, 문서 } = await 띄우기(실제값);
  for (const id of ['nlwOk', 'nlwClose']) {
    발사(배지, 'click');
    assert.strictEqual(모달.style.display, 'flex');
    발사(문서._칸들[id], 'click');
    assert.strictEqual(모달.style.display, 'none', id + ' 이 안 닫는다');
    assert.strictEqual(문서.activeElement, 배지, '닫은 뒤 포커스가 ⚠ 로 안 돌아간다(키보드 사용자가 길을 잃는다)');
  }
  발사(배지, 'click');
  발사(모달, 'click', { target: 문서._칸들.nlwBody });
  assert.strictEqual(모달.style.display, 'flex', '창 안쪽을 눌렀는데 닫힌다');
  발사(모달, 'click', { target: 모달 });
  assert.strictEqual(모달.style.display, 'none', '바깥(어두운 곳)을 눌러도 안 닫힌다');
  /* 다시 열면 내용이 «쌓이지 않고» 새로 그려진다 */
  발사(배지, 'click'); 발사(배지, 'click');
  assert.strictEqual(줄들보기(문서).length, 2, '열 때마다 줄이 늘어난다');
  const 듣는이 = 문서._칸들.nlwOk._듣는이.click.length;
  assert.strictEqual(듣는이, 1, '열 때마다 닫기 단추에 듣는이를 또 건다(한 번만 묶어야 한다)');
});

test('⑥ 키보드 — Enter·Space 로 열고 다른 키는 안 연다 · Tab 은 창 안에서 돈다', async () => {
  const { 배지, 모달, 문서 } = await 띄우기(실제값);
  const 다른 = 발사(배지, 'keydown', { key: 'a' });
  assert.strictEqual(모달.style.display, 'none');
  assert.strictEqual(다른.막음, false);
  발사(배지, 'keydown', { key: 'Enter' });
  assert.strictEqual(모달.style.display, 'flex', 'Enter 로 안 열린다');
  발사(문서._칸들.nlwClose, 'click');
  발사(배지, 'keydown', { key: ' ' });
  assert.strictEqual(모달.style.display, 'flex', 'Space 로 안 열린다');
  /* Tab 돌기 — 처음(닫기 ✕)과 끝(열기) */
  const 처음 = 문서._칸들.nlwClose, 끝 = 문서._칸들.nlwGo;
  문서.activeElement = 끝;
  const t1 = 발사(모달, 'keydown', { key: 'Tab' });
  assert.strictEqual(t1.막음, true); assert.strictEqual(문서.activeElement, 처음, '끝에서 Tab 하면 처음으로 돌아야 한다');
  const t2 = 발사(모달, 'keydown', { key: 'Tab', shiftKey: true });
  assert.strictEqual(t2.막음, true); assert.strictEqual(문서.activeElement, 끝, '처음에서 Shift+Tab 하면 끝으로 돌아야 한다');
  문서.activeElement = 문서._칸들.nlwOk;
  assert.strictEqual(발사(모달, 'keydown', { key: 'Tab' }).막음, false, '가운데서는 그냥 지나가야 한다');
});

test('⑥ 「자동화 점검 열기」는 타일을 누른 것과 똑같이 — 한 앱 한 창 규칙(타일 클릭 처리)을 그대로 탄다', async () => {
  const { 배지, 모달, 칸, 문서 } = await 띄우기(실제값);
  발사(배지, 'click');
  const 포커스 = 배지.포커스받음;
  발사(문서._칸들.nlwGo, 'click');
  assert.strictEqual(모달.style.display, 'none');
  assert.strictEqual(칸.눌림, 1, '타일을 누른 것처럼 열지 않는다 — 앱 열기 규칙을 건너뛴다');
  assert.strictEqual(배지.포커스받음, 포커스, '앱으로 가는데 포커스를 ⚠ 로 돌리려 한다');
});

test('⑥ ESC — 공용 keydown 처리기가 뉴스레터 팝업도 닫는다(다른 창이 안 열려 있을 때)', async () => {
  const 시작 = 포털.indexOf("document.addEventListener('keydown', function(e){\n    if(e.key !== 'Escape') return;");
  assert.ok(시작 > 0, 'ESC 공용 처리기를 못 찾았다');
  const 처리기 = 포털.slice(시작, 포털.indexOf('\n  });\n', 시작) + 7);
  assert.match(처리기, /nlWarnModal/, 'ESC 가 뉴스레터 팝업을 모른다');
  const { 배지, 모달, 문서 } = await 띄우기(실제값);
  발사(배지, 'click');
  /* 공용 처리기가 건드리는 다른 창들 — 모두 닫힌 채로 */
  const 다른창 = (이름) => ({ style: { display: 'none' }, focus() { this.포커스 = true; } });
  const 짐 = Object.assign(Object.create(null), {
    document: { addEventListener: (종류, 함수) => { 짐.__keydown = 함수; } },
    $: (id) => (id === 'nlWarnModal' ? 모달 : 다른창(id)),
    billCloseModal() {}, sgClosePending() {}, sgCloseModal() {},
    뉴스레터경고닫기: (포커스) => { 모달.style.display = 'none'; if (포커스) 배지.focus(); }
  });
  vm.createContext(짐);
  vm.runInContext(처리기, 짐);
  짐.__keydown({ key: 'Enter' });
  assert.strictEqual(모달.style.display, 'flex', 'ESC 가 아닌 키에 닫힌다');
  짐.__keydown({ key: 'Escape' });
  assert.strictEqual(모달.style.display, 'none', 'ESC 로 안 닫힌다');
  assert.strictEqual(문서.activeElement, 배지, 'ESC 로 닫은 뒤 포커스가 ⚠ 로 안 돌아간다');
});

test('③ 시각 말 — 서울 시각 «월/일(요일) 시:분» · 0 이면 비운다', async () => {
  const { 짐 } = await 띄우기({ 경고수: 0 });
  assert.strictEqual(vm.runInContext('뉴스레터경고때말(' + 점검때 + ')', 짐), '10/11(일) 18:00');
  assert.strictEqual(vm.runInContext('뉴스레터경고때말(0)', 짐), '');
  assert.strictEqual(vm.runInContext('뉴스레터경고때말(undefined)', 짐), '');
  /* 자정 근처 — UTC 로는 전날, 서울로는 다음 날 */
  assert.strictEqual(vm.runInContext('뉴스레터경고때말(' + Date.UTC(2026, 9, 11, 15, 5) + ')', 짐), '10/12(월) 00:05');
});
