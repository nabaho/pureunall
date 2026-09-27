/* 「전문 보기」를 «그 자리에서» 편다 (대표 지시 2026-09-18)
   ═══════════════════════════════════════════════════════════════════════════
   「판례 전문보기 클릭하면 이렇게 창으로 넘어간다. 그러면 읽고 보는게 더힘들다.
     전문보기하면 처음화면에서 전문으로 다 내려오게만 만들어야된다.
     캡쳐1 화면에서 모두 보이는것이다 새창으로 안가고」

   ⚠⚠ 이 파일의 급소는 «문을 좁게 두는 것»이다. newsFull 은 로그인 없는 자리에서
     남의 서버를 부르는 문이라, 갈래와 번호를 느슨하게 받으면 우리 주소로 아무 데나
     부르게 하는 문이 된다(SSRF). 그래서 갈래는 둘뿐이고 번호는 숫자뿐이다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
/* ⚠ .js 파일은 stripJs 다 — stripComments 는 «통째 HTML 문서»용이라
     태그가 없으면 주석을 한 글자도 안 걷는다(문지기가 그 자리에서 운다). */
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const NF = require('../functions/news-full.js');
const NV = require('../functions/news-view.js');
const Core = require('../js/pu-news-core.js');
const Tpl = require('../js/pu-news-tpl.js');

/* ══════ ① 문은 «좁다» ══════ */

test('★★★ 여는 문은 법제처 둘(prec·expc)뿐이다', () => {
  assert.equal(NF.갈래고르기('prec'), 'prec');
  assert.equal(NF.갈래고르기('expc'), 'expc');
  /* ⚠ 앞뒤 빈칸은 털어 준다(prec 는 열린다) — 그 밖은 하나도 안 받는다 */
  ['law', 'admrul', 'ordin', 'PREC', '', null, undefined, 'prec;law', 'prec,expc', '../prec']
    .forEach((t) => assert.equal(NF.갈래고르기(t), '',
      '「' + String(t) + '」 을 열어 준다 — 남의 서버로 아무 데나 부르는 문이 된다'));
});

test('★★★ 번호는 «숫자만» 받는다', () => {
  assert.ok(NF.읽기({ t: 'prec', id: '622111' }).ok);
  assert.ok(NF.읽기({ t: 'expc', id: '1' }).ok);
  ['', ' ', 'abc', '62 2111', '622111&x=1', '../../etc', '1e5', '-1', '1.5',
    '1234567890123', 'ID=1'].forEach((id) => {
    assert.ok(!NF.읽기({ t: 'prec', id: id }).ok,
      '「' + id + '」 을 번호로 받는다 — 주소에 끼면 남의 서버를 부른다');
  });
  assert.ok(!NF.읽기({ t: 'law', id: '1' }).ok, '엉뚱한 갈래를 받는다');
  assert.ok(!NF.읽기(null).ok, '물음이 없는데 받는다');
});

test('★★ 주소는 «우리가» 짓는다 — 받은 글자를 주소에 안 끼운다', () => {
  const 받 = NF.받을주소('prec', '622111');
  const 봄 = NF.법제처주소('prec', '622111');
  assert.match(받, /^https:\/\/www\.law\.go\.kr\//, '법제처 밖으로 나간다');
  assert.match(받, /target=prec/);
  assert.match(받, /type=XML/, '받아 읽을 것은 XML 이다');
  assert.match(봄, /type=HTML/, '사람이 볼 것은 서식 있는 쪽이다');
  assert.match(NF.받을주소('expc', '7'), /target=expc/);
  assert.match(NF.법제처주소('expc', '7'), /target=expc/);
});

/* ══════ ② 받아 온 것을 «칸»으로 ══════ */

function 판례XML(더할것) {
  return '<PrecService>'
    + '<사건명><![CDATA[단체교섭청구의소]]></사건명>'
    + '<법원명>대법원</법원명><사건번호>2018다296229</사건번호>'
    + '<선고일자>20260521</선고일자>'
    + '<판시사항><![CDATA[사용자의 범위가 유지되는지 여부(적극)]]></판시사항>'
    + '<판결요지><![CDATA[[다수의견] 종전 법리가 유지되어야 한다.]]></판결요지>'
    + '<참조조문><![CDATA[헌법 제33조 제1항]]></참조조문>'
    + (더할것 || '') + '</PrecService>';
}

test('★★★ 판례는 판시사항·판결요지·참조조문·전문을 «그 이름 그대로» 편다', () => {
  const r = NF.풀기('prec', 판례XML('<판례내용><![CDATA[<p>주 문<br/>상고를 기각한다.</p>]]></판례내용>'));
  assert.ok(r.ok, '못 풀었다');
  const 이름들 = r.칸들.map((k) => k.이름);
  assert.deepEqual(이름들, ['판시사항', '판결요지', '참조조문', '판결 전문']);
  assert.match(r.제목, /단체교섭청구의소/, '무엇을 보고 있는지 안 적는다');
  assert.match(r.인용, /대법원 2018다296229 \(2026\. 5\. 21\.\)/, '인용을 법조 관례대로 안 적는다');
  /* 태그는 벗기되 «줄은 살린다» — 판결문은 줄이 뜻을 나른다 */
  const 전 = r.칸들[3].글;
  assert.ok(전.indexOf('<p>') < 0, '태그가 글자로 남았다');
  assert.match(전, /주 문\n상고를 기각한다/, '<br> 을 줄로 안 살렸다');
});

test('★★ 행정해석은 «다른 칸»이다 — 질의요지·회답·이유', () => {
  const xml = '<Expc><안건명><![CDATA[압류 제외 임금의 범위]]></안건명>'
    + '<해석기관명>법제처</해석기관명><안건번호>24-0835</안건번호>'
    + '<해석일자>20241210</해석일자>'
    + '<질의요지><![CDATA[간접노무비가 들어가는지]]></질의요지>'
    + '<회답><![CDATA[들어갑니다.]]></회답>'
    + '<이유><![CDATA[그 까닭은 다음과 같습니다.]]></이유></Expc>';
  const r = NF.풀기('expc', xml);
  assert.ok(r.ok, '못 풀었다');
  assert.deepEqual(r.칸들.map((k) => k.이름), ['질의요지', '회답', '이유']);
  assert.match(r.인용, /법제처 24-0835 \(2024\. 12\. 10\.\)/);
});

test('★★ 빈 칸은 «안 만든다» — 이름만 있고 아래가 비면 못 받아 온 줄 안다', () => {
  const r = NF.풀기('prec', '<PrecService><판시사항><![CDATA[한 줄]]></판시사항>'
    + '<판결요지><![CDATA[ ]]></판결요지><참조조문></참조조문></PrecService>');
  assert.ok(r.ok);
  assert.deepEqual(r.칸들.map((k) => k.이름), ['판시사항'], '빈 칸까지 만들었다');
});

test('★★★ 한 칸도 못 건지면 «못 준다»고 한다 — 빈 상자를 펴지 않는다', () => {
  [['prec', ''], ['prec', '<html>로그인이 필요합니다</html>'], ['prec', '<PrecService></PrecService>'],
    ['law', 판례XML()]].forEach(([g, x]) => {
    const r = NF.풀기(g, x);
    assert.ok(!r.ok, '못 받았는데 편다 (' + g + ')');
    assert.ok(NF.까닭말[r.까닭], '까닭에 «사람에게 할 말»이 없다: ' + r.까닭);
  });
});

test('★★ 너무 길면 자르고 «잘렸다»고 밝힌다 — 숨기면 끝난 줄 안다', () => {
  const 긴 = 'ㄱ'.repeat(NF.칸한도 + 500);
  const r = NF.풀기('prec', 판례XML('<판례내용><![CDATA[' + 긴 + ']]></판례내용>'));
  assert.ok(r.ok);
  const 전 = r.칸들[r.칸들.length - 1];
  assert.equal(전.글.length, NF.칸한도, '한도대로 안 잘랐다');
  assert.ok(전.잘림, '잘라 놓고 안 밝힌다');
  assert.ok(r.잘림, '잘린 칸이 있는데 통째로는 안 밝힌다');
  /* 짧으면 자르지도, 밝히지도 않는다 */
  assert.ok(!NF.풀기('prec', 판례XML()).잘림, '안 잘랐는데 잘렸다고 한다');
});

/* ══════ ③ 편지가 달아 두는 «표» ══════ */

function 판례편지(링크) {
  const d = { 열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 지역뉴스: [], 안: { news: [], policy: [], hr: [],
      case: [{ 갈래: '판례', 딱지: '[판례]', 제목: '판례 하나', 우리말: '우리 정리',
        인용: '대법원 2026다1', 링크: 링크 }] } };
  return Tpl.편지짓기(d, { 회사이름: '푸른노무법인' },
    { 요약: false, 미리보기: true, 넓이: Tpl.전문넓이 }).서식;
}

test('★★★ 편지가 «무엇을·몇 번»을 표로 달아 둔다', () => {
  const h = 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111');
  assert.match(h, /data-full="prec:622111"/, '표가 없다 — 웹 쪽이 무엇을 펴야 할지 모른다');
  const e = 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=expc&type=HTML&ID=340383');
  assert.match(e, /data-full="expc:340383"/);
});

test('★★ 법제처가 아닌 주소에는 «안» 단다', () => {
  ['https://www.scourt.go.kr/x?ID=1', 'https://evil.example.com/a?target=prec&ID=1', ''].forEach((u) => {
    assert.ok(판례편지(u).indexOf('data-full=') < 0, '엉뚱한 주소에 표를 달았다: ' + u);
  });
});

test('★ 손잡이 글귀가 «무엇이 열리는지» 알린다 — 화살표는 ↗', () => {
  /* ⚠⚠ 여기는 «뒤집힌» 자리다. 지운 것이 아니라 적어 둔다.
       2026-09-18 → ↓ 로 두었다. 웹 전문 보기에서는 그 자리에서 «아래로 펴지»므로
         ↓ 가 그 움직임을 그린다고 보았다.
       2026-09-20 대표 검증 지시 뒤 → ↗ 로 바꾼다. 까닭은 «메일»이다:
         ① 메일에는 자바스크립트가 없다. 펴지지 않고 «쪽이 열린다».
         ② 같은 편지 안에서 ↓ 는 이미 «내려받기» 뜻으로 굳었다 —
            자료 단추가 「내려받기 ↓」, 요약 표시가 「⬇ 내려받기」다.
            받는 분은 파일이 받아지는 줄 알고 누르신다.
         ③ 웹 쪽 띠(전문보기띠)는 그전부터 ↗ 였다 — 한 편지에 두 약속이 있었다.
     ★ 안 바뀐 것 — 화살표만 바뀌었다. data-full 로 «그 자리에서 펴는» 움직임과
       자바스크립트가 없을 때 링크로 가는 물러섬은 그대로다. */
  const h = 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111');
  assert.match(h, />전문 보기 ↗</, '★ 화살표 약속이 어긋났다 — ↓ 는 내려받기 뜻이다');
  assert.ok(!/전문 보기 ↓/.test(h), '★ ↓ 가 남아 있다 — 파일이 받아지는 줄 알고 누르신다');
  /* ⚠ 링크는 살려 둔다 — 자바스크립트가 없으면 옛날처럼 법제처로 가야 한다 */
  assert.match(h, /<a href="https:\/\/www\.law\.go\.kr[^"]*"[^>]*data-full=/,
    '링크를 없앴다 — 자바스크립트가 없으면 아무 데도 못 간다');
});

/* ══════ ④ 웹 껍데기가 «그 자리에» 편다 ══════ */

/* ★★ 껍데기의 손잡이를 «실제로 눌러» 본다.
   ⚠ 글자로만 보면(「/newsFull 이 적혀 있다」) 두 갈래 가운데 하나만 살아 있어도
     통과한다 — 2026-09-18 이빨 확인에서 «주소에서 읽는 길»이 그렇게 빠져나갔다.
   ★ 그래서 가짜 쪽을 하나 세우고, 눌렀을 때 «어느 주소를 부르는지»를 본다. */
function 눌러보기(쪽, 손잡이) {
  const 부른것 = [];
  const 붙인것 = [];
  const 손 = Object.assign({
    getAttribute: function (k) { return this['attr_' + k] == null ? null : this['attr_' + k]; },
    closest: function () { return null; },
    parentNode: { appendChild: function (x) { 붙인것.push(x); } },
    textContent: ''
  }, 손잡이);
  const 짐 = {
    document: {
      _클릭: null,
      addEventListener: function (t, f, c) { if (t === 'click' && c === true) this._클릭 = f; },
      createElement: function () {
        return { className: '', innerHTML: '', style: {}, appendChild: function () {} };
      },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      documentElement: { style: {} }
    },
    window: { addEventListener: function () {}, scrollY: 0, scrollTo: function () {} },
    location: { hash: '', pathname: '/newsView', search: '' },
    history: { replaceState: function () {} },
    fetch: function (u) {
      부른것.push(u);
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, 말: '시험' }); } });
    }
  };
  짐.window.document = 짐.document;
  vm.createContext(짐);
  const m = /<script>([\s\S]*?)<\/script>/.exec(쪽);
  assert.ok(m, '껍데기에 스크립트가 없다');
  vm.runInContext(m[1], 짐);
  assert.ok(짐.document._클릭, '훑는 쪽(capture)에서 잡는 손잡이가 없다');
  let 막았나 = false;
  /* ★ 한 번 더 누를 수 있게 «누르기»를 돌려준다 — 폈다 접는 것은 두 번 눌러야 안다. */
  function 누르기() {
    짐.document._클릭({
      target: { closest: function (sel) { return sel === 'a[href]' ? 손 : null; } },
      preventDefault: function () { 막았나 = true; },
      stopPropagation: function () {}
    });
  }
  누르기();
  return { 부른것: 부른것, 막았나: 막았나, 손: 손, 누르기: 누르기 };
}

test('★★★ 편지의 «표»를 보고 그 판례를 받아 온다', () => {
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  const r = 눌러보기(쪽, { 'attr_data-full': 'prec:622111', attr_href: 'https://n.kr/딴데' });
  assert.equal(r.부른것[0], '/newsFull?t=prec&id=622111', '엉뚱한 자리를 부른다');
  assert.ok(r.막았나, '눌러도 그대로 나간다 — 새 창으로 넘어간다');
});

test('★★★ 폈다 «접으면» 처음 글귀로 돌아온다 — 화살표가 바뀌지 않는다', () => {
  /* ⚠⚠ 2026-09-20 살아 있는 쪽에서 「전문 보기 ↗」 둘과 「전문 보기 ↓」 하나가
       함께 잡혔다. 껍데기가 접을 때 돌려놓는 글귀를 «글자로 박아» 두었던 탓이다
       (편지는 ↗ 로 바뀌었는데 여기만 ↓ 로 되돌려 놓았다).
     ★ 같은 손잡이가 폈다 접었다고 모양이 바뀌면, 받는 분은 «다른 것»으로 읽는다.
     ⚠ 값(↗)이 아니라 «처음 글귀를 그대로 돌려놓는가»를 본다 — 편지 쪽 글귀가
       또 바뀌어도 이 검사는 그대로 맞는다. */
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  const 처음글귀 = '전문 보기 ↗';
  const r = 눌러보기(쪽, { 'attr_data-full': 'prec:622111', attr_href: 'https://n.kr/딴데',
    textContent: 처음글귀 });

  assert.equal(r.손.textContent, '접기 ↑', '★ 폈는데 「접기」로 안 바뀐다');
  r.누르기();                                   /* 접는다 */
  assert.equal(r.손.textContent, 처음글귀,
    '★★★ 접었더니 처음 글귀가 아니다 («' + r.손.textContent + '») — 화살표가 바뀌었다');
  r.누르기();                                   /* 다시 편다 */
  assert.equal(r.손.textContent, '접기 ↑', '★ 다시 폈는데 「접기」로 안 바뀐다');
});

test('★★★ 표가 없는 «옛 회차»는 주소에서 읽는다', () => {
  /* 이미 담아 둔 전문에는 표가 없다. 그것까지 되어야 다시 안 담고도 펴진다. */
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  const r = 눌러보기(쪽, {
    attr_href: 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=expc&type=HTML&ID=340383'
  });
  assert.equal(r.부른것[0], '/newsFull?t=expc&id=340383', '주소에서 못 읽는다 — 옛 회차는 못 편다');
});

test('★★ 법제처가 아닌 링크는 «건드리지 않는다» — 원문은 그대로 나간다', () => {
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  const r = 눌러보기(쪽, { attr_href: 'https://www.labortoday.co.kr/news/1' });
  assert.equal(r.부른것.length, 0, '기사 링크까지 가로챈다');
  assert.ok(!r.막았나, '기사 링크를 막았다 — 원문으로 못 간다');
});

test('★★ 편 글의 모양 규칙이 있다', () => {
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  assert.match(쪽, /\.full\{/, '편 글의 모양 규칙이 없다');
});

test('★★★ 판례 «표» 안에 펴지 않는다 — 74px 딱지 칸으로 쪼그라든다', () => {
  /* 2026-09-18 실측으로 겪었다. appendChild 로 붙이면 <table> 안으로 들어가
     딱지 칸 폭이 된다. 표 «다음»에 끼워야 칸 폭을 다 쓴다. */
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  assert.match(쪽, /insertBefore\(칸,t\.nextSibling\)/, '표 안에 붙인다 — 폭이 쪼그라든다');
});

test('★★ 못 받아 오면 «법제처에서 보기»로 물러선다', () => {
  const 쪽 = NV.쪽('제목', 판례편지('https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111'));
  assert.match(쪽, /catch\(function\(err\)/, '못 받아 온 때를 안 다룬다');
  assert.match(쪽, /법제처에서 보기/, '물러설 길을 안 보여 준다');
});

test('★★★ 서버 문은 «우리 자료»를 하나도 안 읽는다', () => {
  /* 로그인 없는 자리다. 받는 분 주소가 든 회차를 건드릴 일이 아예 없어야 한다. */
  const 몸 = stripJs(fs.readFileSync(path.join(ROOT, 'functions/news-full.js'), 'utf8'));
  ['getDatabase', 'newsletter/', 'firebase-admin', '받는이'].forEach((말) => {
    assert.ok(몸.indexOf(말) < 0, 'news-full 이 「' + 말 + '」 을 만진다');
  });
  const idx = stripJs(fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8'));
  const i = idx.indexOf('exports.newsFull');
  assert.ok(i > 0, 'newsFull 을 내보내지 않는다');
  const 몫 = idx.slice(i, idx.indexOf('\nexports.', i + 10));
  assert.ok(몫.indexOf('getDatabase') < 0, 'newsFull 이 우리 자료를 읽는다');
  assert.match(몫, /NF\.읽기\(req\.query\)/, '물음을 안 걸러 받는다');
  /* ⚠ 2026-09-20 에 하루(86400) → 한 시간(3600)으로 줄였다. 하루로 굳혀 두었더니
       쪽 «모양»을 고쳐 배포해도 이미 갈무리된 것이 하루까지 그대로 나왔다
       (실측 age=15056 으로 옛 모양). 지키는 규칙은 그대로다 — «매번 다시 받지
       않는다»(법제처 OC 가 시험 계정이라 한도가 있다). 값이 아니라 그것을 본다.
       tests/newsletter-full-fresh.test.js 가 「너무 길지 않은가」를 따로 못 박는다. */
  const 굳 = /max-age=(\d+)/.exec(몫);
  assert.ok(굳 && Number(굳[1]) > 0,
    '갈무리를 아예 안 한다 — 같은 판례를 매번 법제처에서 다시 받는다');
  assert.match(몫, /public/, '갈무리를 «공용»으로 안 한다 — 가장자리가 안 붙잡는다');
});
