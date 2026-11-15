'use strict';
/* 뉴스레터 — 법제처가 공개 열쇠(OC=test)를 거절한 뒤 · 자동화 점검 화면이 «현재»를 읽던 일 (2026-11-15)
   ═══════════════════════════════════════════════════════════════════════════
   대표 화면: 「뉴스레터에 경고가 나왔다 뭔지 확인하고 개선해달라」 — 포털 ⚠ 2 를 눌러 왔는데
   자동화 점검 화면은 「보내기 전 점검 기다림 · 아직 점검이 돌지 않았습니다」였다.

   ■ 그날 실측으로 드러난 것
     ① 화면이 newsletter/watch 의 «맨 끝 열쇠»를 읽었다. 거기엔 회차(2026-11-w3) 말고 포털 경고판 «현재»도
        있는데, 한글 열쇠는 숫자 열쇠 «뒤»에 선다 — 늘 «현재»(요약)를 읽어 점검·발송·전달 칸이 비었다.
     ② 법제처 DRF 가 OC=test 를 «200 + 사용자 정보 검증에 실패»로 거절한다. 판례 모으개는 이것을 0건으로
        읽고 조용히 넘어갔다(탈 칸 비어 있음) — 10월 9일 뒤로 새 판례가 한 건도 없었다.
     ③ 편지 「전문 보기」(newsFullPage)가 502 «받아 오지 못했습니다», 그 아래 «법제처에서 원문 보기»도
        DRF 서식 쪽이라 「국가법령정보 공동활용 페이지 접속에 실패하였습니다」.
     ④ 일요일 링크 점검은 코드(200)만 보고 «모두 열림».

   ■ 이 검사가 지키는 «규칙»
     ① 화면은 서버(포털 경고판)와 «같은 회차 잣대»로 고른다
     ② 사람에게 보내는 법제처 주소에는 열쇠(OC)가 없다 — 옛 꼴은 같은 한 건의 공개 쪽으로 바꾼다
     ③ 거절 몸은 «못 읽음»이다 — 모으개는 탈로 남기고, 링크 점검은 깨짐으로 친다
     ④ 점검은 «못 모은 까닭»을 함께 보인다
     ⑤ 전문 쪽은 못 받아 오면 공개 쪽으로 곧장 보낸다(우리가 지은 주소로만) */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');
const { stripJs } = require('./strip-comments.js');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NP = require('../functions/news-prec.js');
const NF = require('../functions/news-full.js');
const W = require('../functions/news-watch.js');

const 뿌리 = path.join(__dirname, '..');
/* ⚠ 윈도우에서 꺼내면 줄 끝이 \r\n 이다 — 함수 끝(\n}\n)을 찾으려면 맞춰 둔다 */
const 화면 = 주석걷기(fs.readFileSync(path.join(뿌리, 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n'));
const 서버 = stripJs(fs.readFileSync(path.join(뿌리, 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
function 내보낸몸(이름) {
  const i = 서버.indexOf('exports.' + 이름 + ' ');
  assert.ok(i >= 0, 이름 + ' 이 없다');
  const j = 서버.indexOf('\nexports.', i + 10);
  return 서버.slice(i, j < 0 ? undefined : j);
}
function 서버함수(머리) {
  const i = 서버.indexOf(머리);
  assert.ok(i >= 0, '「' + 머리 + '」 를 못 찾았다');
  return 서버.slice(i, 서버.indexOf('\n}\n', i) + 2);
}

const 옛판 = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622955';
const 옛해 = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=expc&type=HTML&ID=329741';

/* ═══ ① 화면은 서버와 같은 회차 잣대 ═══════════════════════════════════ */

test('★★★ ① 자동화 점검 화면은 포털 경고판(서버)과 «같은 회차 잣대»로 고른다 — «현재»를 회차로 읽지 않는다', () => {
  const 읽기 = 함수몸(화면, '감시읽기');
  assert.ok(읽기, '감시읽기 를 못 찾았다');
  const 판 = 서버함수('async function 뉴스레터경고판갱신');
  const m = /\.filter\(\(k\) => (\/\^[^\n]*?\$\/)\.test\(k\)\)/.exec(판);
  assert.ok(m, '서버 경고판의 회차 잣대를 못 찾았다(이 검사의 그물이 헐거워졌다)');
  assert.ok(읽기.indexOf(m[1]) >= 0,
    '★★★ 화면이 서버와 다른 잣대로 회차를 고른다 — «현재»(경고판 요약)를 회차로 읽으면 점검·발송·전달 칸이 텅 빈다');
  /* 잣대가 실제로 «현재»를 걸러 내는가 — 실제 열쇠 모양으로 */
  const 잣대 = new RegExp(m[1].slice(1, -1));
  const 열쇠들 = ['2026-10-w4', '2026-11-w2', '2026-11-w3', '현재'];
  assert.strictEqual(열쇠들.filter((k) => 잣대.test(k)).sort().pop(), '2026-11-w3');
  assert.ok(!/limitToLast\(1\)/.test(읽기), '★★ 맨 끝 하나만 읽는다 — 맨 끝은 «현재»다');
  /* «현재» 안에도 열쇠 칸이 있다 — 고른 열쇠가 마지막에 덮어야 한다 */
  assert.match(읽기, /Object\.assign\(\{\},\s*v\[k\],\s*\{\s*열쇠:\s*k\s*\}\)/,
    '고른 열쇠를 기록 «뒤»에 덮지 않는다 — 기록 안의 다른 열쇠가 이긴다');
});

/* ═══ ② 사람에게 보내는 법제처 주소 ═══════════════════════════════════ */

test('★★★ ② 옛 꼴(DRF·OC=test) 법제처 주소는 같은 한 건의 «공개 쪽»으로 — 열쇠가 없다', () => {
  assert.strictEqual(C.법제처사람주소(옛판), NP.보는주소('622955'),
    '판례 — 모으개가 새로 담는 꼴과 같아야 한 열쇠로 견준다');
  assert.strictEqual(C.법제처사람주소(옛해), NP.해석보는주소('329741'));
  [옛판, 옛해, NP.보는주소('1'), NP.해석보는주소('1'), NF.법제처주소('prec', '1'), NF.법제처주소('expc', '1')]
    .forEach((u) => assert.ok(!/OC=/.test(C.법제처사람주소(u)), '★★ 사람이 볼 주소에 열쇠가 남았다: ' + u));
  /* 판례·해석 한 건 주소만 바꾼다 — 그 밖은 받은 그대로 */
  ['https://www.moel.go.kr/a.do?ID=1', 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&MST=1',
    'https://www.law.go.kr/', '', NP.보는주소('7')].forEach((u) => assert.strictEqual(C.법제처사람주소(u), u));
  /* 옛 꼴로 «보낸» 판례와 새 꼴로 «모은» 같은 판례는 한 열쇠 — 다시 보내지 않게 */
  assert.strictEqual(C.실은열쇠({ 링크: 옛판 }), C.실은열쇠({ 링크: NP.보는주소('622955') }));
});

test('★★ ② 편지 — 옛 꼴은 공개 쪽으로 걸고, 새 꼴(공개 쪽)도 「전문 보기」가 우리 쪽으로 간다', () => {
  const 판례 = (링크) => ({ 갈래: '판례', 딱지: '[판례]', 제목: '어느 판례', 인용: '대법원 2024도5902 (2026. 6. 25.)', 링크 });
  const 짓기 = (설, 링크) => T.편지짓기({ 회차: C.회차('2026-11-12'), 안: { case: [판례(링크)] }, 우리글: '' },
    설, { 미리보기: true }).서식;
  /* 우리 쪽(newsFullPage)을 지을 수 없을 때 — 법제처로 바로 가는 손잡이에 열쇠가 없어야 한다 */
  const 맨 = 짓기({ 회사이름: '푸른노무법인' }, 옛판);
  assert.ok(/전문 보기/.test(맨), '(재기 값) 「전문 보기」가 사라졌다');
  assert.ok(맨.indexOf('OC=test') < 0, '★★ 옛 법제처 주소(받는 분 눈에 «접속 실패» 쪽)가 그대로 걸린다');
  /* 새 꼴로 모은 판례도 우리 쪽으로 편다 */
  const 우리 = 짓기({ 회사이름: '푸른노무법인', 추적밑주소: 'https://asia-northeast3-pureun-erp.cloudfunctions.net' },
    NP.보는주소('622955'));
  assert.match(우리, /newsFullPage\?t=prec&amp;id=622955/, '★★ 공개 쪽 꼴로 모은 판례가 우리 쪽(newsFullPage)으로 안 간다');
  assert.match(우리, /data-full="prec:622955"/, '★ 웹 전문 보기가 무엇을 펼지 모른다');
  assert.match(짓기({ 회사이름: '푸른노무법인', 추적밑주소: 'https://x.test' }, NP.해석보는주소('329741')),
    /newsFullPage\?t=expc&amp;id=329741/, '★★ 공개 쪽 꼴 행정해석이 우리 쪽으로 안 간다');
});

/* ═══ ③ 거절은 «못 읽음» ═══════════════════════════════════════════════ */

test('★★★ ③ 거절 몸을 알아본다 — 200 이어도 «사용자 정보 검증에 실패»는 못 읽은 것', () => {
  assert.ok(NP.거절인가('<Response><result>사용자 정보 검증에 실패하였습니다.</result></Response>'));
  assert.ok(NP.거절인가('<p>국가법령정보 공동활용 페이지 접속에 실패하였습니다.</p>'));
  assert.ok(!NP.거절인가('<PrecSearch><totalCnt>3</totalCnt><prec id="1"></prec></PrecSearch>'));
  assert.ok(!NP.거절인가(''));
});

test('★★★ ③ 판례·해석 모으개 — «모두 거절»이면 0건이 아니라 탈로 남긴다', () => {
  ['async function 판례거리모으기', 'async function 해석거리모으기'].forEach((머리) => {
    const 몸 = 서버함수(머리);
    assert.ok(!/쪽받기\(판례부품\.(해석)?목록주소/.test(몸),
      '★★★ ' + 머리 + ' — 목록을 거절 확인 없이 받는다. 거절이 «0건»으로 조용히 넘어간다');
    assert.match(몸, /\bthrow\b/, '★★ ' + 머리 + ' — 모두 거절이어도 던지지 않는다. 탈 칸이 비어 까닭을 모른다');
  });
  assert.ok(서버.indexOf('판례부품.거절인가(') >= 0, '★★ 서버가 법제처 거절을 안 가린다');
  /* 던진 것은 모아담기가 탈로 남긴다 — 그 길은 그대로여야 한다 */
  const 담기 = 서버함수('async function 자료판례모아담기');
  assert.match(담기, /homepage\/newsPrec"\)\.update\(\{ 탈:/, '(그물) 판례 탈을 남기는 길이 사라졌다');
});

test('★★★ ③ 링크 점검 — 법제처 «200 인데 실패 쪽»은 깨짐, 다른 집은 몸을 안 읽는다', async () => {
  let 다른집몸 = false;
  const fetchFn = async (u) => {
    if (/law\.go\.kr/.test(u)) {
      return { status: 200, text: async () => (/\/DRF\//.test(u)
        ? '<p>국가법령정보 공동활용 페이지 접속에 실패하였습니다.</p>' : '<p>판시사항</p>') };
    }
    return { status: 200, text: async () => { 다른집몸 = true; return ''; }, body: { cancel: async () => {} } };
  };
  const r = await W.링크재기([{ 주소: 옛판 }, { 주소: NP.보는주소('622955') }, { 주소: 'https://x.test/a' }], fetchFn);
  assert.strictEqual(r[0].상태, '깨짐', '★★★ 실패 쪽을 «열림»이라 한다 — 2026-11-15 점검이 「모두 열림」이라 했던 그 일');
  assert.strictEqual(r[1].상태, '됨');
  assert.strictEqual(r[2].상태, '됨');
  assert.ok(!다른집몸, '★ 법제처가 아닌 곳의 몸까지 읽는다 — 파일이 수백 MB 일 수 있다');
});

test('★★ ③ 링크 점검 — 몸은 «마지막으로 닿은 곳»이 법제처일 때만, 앞부분만 읽는다(보안 검토)', async () => {
  /* 법제처 주소로 시작했어도 다른 집으로 넘겨졌으면 몸을 안 읽는다 */
  let 읽음 = false;
  const 넘김 = await W.링크재기([{ 주소: 옛판 }], async () => ({ status: 200, url: 'https://other.test/x',
    text: async () => { 읽음 = true; return ''; }, body: { cancel: async () => {} } }));
  assert.strictEqual(넘김[0].상태, '됨');
  assert.ok(!읽음, '★★ 넘겨진 다른 집의 몸까지 읽는다');
  /* 아주 큰 몸이어도 한도까지만 읽고 끊는다 */
  let 읽은조각 = 0, 끊음 = false;
  const 큰몸 = { getReader: () => ({
    read: async () => { 읽은조각++; return { done: false, value: new Uint8Array(16 * 1024) }; },
    cancel: async () => { 끊음 = true; } }) };
  const 큰 = await W.링크재기([{ 주소: NP.보는주소('1') }], async () => ({ status: 200, url: NP.보는주소('1'), body: 큰몸 }));
  assert.strictEqual(큰[0].상태, '됨');
  assert.ok(읽은조각 > 0 && 읽은조각 < 64, '★★ 몸을 끝없이 읽는다 — 한도에서 끊지 않는다(' + 읽은조각 + '조각)');
  assert.ok(끊음, '★ 다 읽지 않은 몸을 닫지 않는다');
});

test('★★★ ③ 웹 전문 보기 — 못 펴면 «우리 전문 쪽»으로 물러선다(옛 DRF 주소로 보내지 않는다)', async () => {
  const NV = require('../functions/news-view.js');
  const vm = require('node:vm');
  const 쪽 = NV.쪽('제목', '<p>편지</p>');
  const m = /<script>([\s\S]*?)<\/script>/.exec(쪽);
  assert.ok(m, '껍데기에 스크립트가 없다');
  const 부른것 = [], 만든것 = [];
  const 짐 = {
    document: {
      _클릭: null,
      addEventListener(t, f, c) { if (t === 'click' && c === true) this._클릭 = f; },
      createElement() { const e = { className: '', innerHTML: '', style: {}, appendChild() {} }; 만든것.push(e); return e; },
      getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
      documentElement: { style: {} }
    },
    window: { addEventListener() {}, scrollY: 0, scrollTo() {} },
    location: { hash: '', pathname: '/newsView', search: '' },
    history: { replaceState() {} },
    fetch(u) { 부른것.push(u); return Promise.resolve({ json: () => Promise.resolve({ ok: false, 말: '시험' }) }); }
  };
  짐.window.document = 짐.document;
  vm.createContext(짐);
  vm.runInContext(m[1], 짐);
  /* 표(data-full) 없는 옛 회차 — 손잡이 주소가 새 꼴(공개 쪽)이어도 알아본다 */
  const 손 = { attr_href: NP.보는주소('622955'), textContent: '전문 보기 ↗',
    getAttribute(k) { return this['attr_' + k] == null ? null : this['attr_' + k]; },
    closest() { return null; }, parentNode: { appendChild() {} } };
  짐.document._클릭({ target: { closest: (s) => (s === 'a[href]' ? 손 : null) }, preventDefault() {}, stopPropagation() {} });
  assert.strictEqual(부른것[0], '/newsFull?t=prec&id=622955', '★★ 공개 쪽 꼴 주소에서 판례를 못 읽는다');
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  const 칸 = 만든것.find((e) => /class="err"/.test(e.innerHTML));
  assert.ok(칸, '못 받아 온 때의 칸이 없다');
  assert.match(칸.innerHTML, /href="\/newsFullPage\?t=prec&amp;id=622955"/,
    '★★★ 물러설 곳이 우리 전문 쪽이 아니다 — 옛 회차는 DRF(접속 실패) 주소로 간다');
  assert.ok(칸.innerHTML.indexOf('OC=') < 0, '★★ 물러설 곳에 거절되는 열쇠가 남았다');
});

test('★★ ③ 편지 링크 점검은 받는 분이 «실제로 가는» 주소(공개 쪽)를 잰다', () => {
  const l = W.편지링크들({ 안: { case: [{ 제목: 'p', 링크: 옛판 }] } });
  assert.deepStrictEqual(l.map((x) => x.주소), [C.법제처사람주소(옛판)]);
});

/* ═══ ④ 못 모은 까닭 ═══════════════════════════════════════════════════ */

test('★★★ ④ 점검 — 판례를 «못 모은 까닭»을 함께 보인다(한 까닭은 한 줄)', () => {
  const 열쇠 = '2026-10-w2';
  const 기본 = { now: Date.parse('2026-10-11T18:00:00+09:00'), 열쇠, 설정: { 자동발송: true },
    확정본: { 회차열쇠: 열쇠, 상태: '준비', to: [{}] },
    회차: { 우리글: '한마디', 안: { news: [{ 제목: 'n', 우리말: '썼다' }], policy: [{ 제목: 'p', 링크: 'https://x.test/p' }],
      case: [{ 링크: 'p1', 제목: '판례' }] } },
    금요일기록: { 알림: [] }, 브리핑: { 모은날: '2026-10-11' } };
  const 탈 = '법제처 공동활용(DRF)이 열쇠를 거절했습니다';
  const 까닭줄 = (판) => 판.항목들.filter((x) => x.수준 === 'you' && String(x.설명 || '').indexOf(탈) >= 0);
  const 묵은 = W.점검하기(Object.assign({}, 기본, { 판례모음: { p1: { 모은날: '2026-09-07' } }, 판례탈: 탈 }));
  assert.strictEqual(까닭줄(묵은).length, 1, '★★★ 3주 넘게 묵었는데 까닭이 안 보이거나, 한 까닭이 두 줄로 뜬다');
  const 새 = W.점검하기(Object.assign({}, 기본, { 판례모음: { p9: { 모은날: '2026-10-10' } }, 판례탈: 탈 }));
  assert.strictEqual(까닭줄(새).length, 1, '★★ 3주가 안 됐다고 «못 모으고 있다»를 숨긴다 — 그동안 같은 판례가 나간다');
  const 멀쩡 = W.점검하기(Object.assign({}, 기본, { 판례모음: { p9: { 모은날: '2026-10-10' } } }));
  assert.strictEqual(멀쩡.항목들.filter((x) => x.수준 === 'you').length,
    W.점검하기(Object.assign({}, 기본, { 판례모음: { p9: { 모은날: '2026-10-10' } }, 판례탈: '' })).항목들
      .filter((x) => x.수준 === 'you').length, '탈이 없는데 줄이 늘었다');
  /* 서버가 탈을 실제로 읽어 넘긴다 */
  const 몸 = 내보낸몸('newsletterWatchSunday');
  assert.match(몸, /homepage\/newsPrec\/탈/, '★★ 일요일 점검이 판례 탈을 안 읽는다');
  assert.match(몸, /판례탈:/, '★★ 일요일 점검이 판례 탈을 점검하기에 안 넘긴다');
});

/* ═══ ⑤ 전문 쪽 ═════════════════════════════════════════════════════════ */

test('★★★ ⑤ 전문 쪽 — 못 받아 오면 오류 쪽이 아니라 공개 쪽으로 곧장(우리가 지은 주소로만)', () => {
  const 몸 = 내보낸몸('newsFullPage');
  assert.ok(!/status\(502\)/.test(몸), '★★★ 못 받아 오면 아직 502 오류 쪽이다 — 받는 분이 한 번 더 눌러야 한다');
  assert.ok((몸.match(/res\.redirect\(302,\s*[\w가-힣]+\)/g) || []).length >= 2,
    '★★ 못 받은 두 길(빈 답·끊김) 가운데 공개 쪽으로 안 보내는 길이 있다');
  /* 보낼 곳은 «숫자만 받은 번호»로 우리가 지은 주소 — 받은 글자를 그대로 보내면 아무 데나 보내는 문이 된다 */
  const 지음 = /const ([\w가-힣]+) = NF\.법제처주소\(q\.갈래, q\.번호\)/.exec(몸);
  assert.ok(지음, '★★★ 보낼 곳을 우리가 짓지 않는다');
  assert.ok((몸.match(/res\.redirect\(302,\s*([\w가-힣]+)\)/g) || []).every((s) => s.indexOf(지음[1]) >= 0),
    '★★★ 우리가 지은 주소가 아닌 곳으로 보낸다');
  assert.match(NF.법제처주소('prec', '1'), /^https:\/\/www\.law\.go\.kr\/LSW\//);
});
