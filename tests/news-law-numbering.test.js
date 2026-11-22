'use strict';
/* 법제처 조문 변환 — 번호 겹침(① ①) 오탐 (대표 물음 2026-10-11 「경고표시 뭐냐 … 지금은 문제 해결해라」)

   포털 뉴스레터 칸의 ⚠ 1 은 「🤖 근로기준법 제55조 조문 내용 반복」 이었다.
   편지는 멀쩡했다(우리글·안 전체에서 「① ①」 0건). 일요일 18시 AI 교정이 편지에 나온 «법 이름 + 조문»을 법제처에서 받아
   AI 에게 «원문»으로 건네는데, 우리 변환이 XML 의 번호 칸(<항번호>①)과 내용 칸(<항내용>① 사용자는…)을 둘 다 살려
   「제55조(휴일) ① ① 사용자는 … ② ② …」 로 만들었고, AI 가 그것을 「번호 중복」이라고 올린 것이다.

   ★ 2026-11-16 — 법제처 DRF 가 OC=test 를 거절해 원문을 국가법령정보센터 «공개 쪽»(lsInfoR.do)에서 읽게 됐다.
     공개 쪽은 번호를 «한 번만» 적는다(번호 칸이 따로 없다). 그래도 규칙은 그대로 지킨다 — 아래 검사는
     2026-11-16 실측한 공개 쪽 모양(제55조·제2조)을 줄여 가짜 fetch 로 돌린다.

   ■ 이 검사가 지키는 «규칙»
     ① 항·호·목 번호가 «한 번만» 나온다
     ② 번호는 살아 있고 차례(항 → 호 → 목 → 다음 호)가 그대로다
     ③ 원문에 화면 군더더기(아이콘 줄·「<개정 …>」 표지)가 섞이지 않는다 — AI 가 그것을 편지와 견주지 않게
     ④ AI 교정 지시는 «원문 쪽 글자 모양은 지적하지 말고 편지만» 보라고 한다
   ⚠ 변환 함수를 «바깥으로 빼지» 않는다 — news-ai-review.test.js 가 함수 본문을 잘라 실제로 돌리므로, 고침도 그 함수 안에 있어야 한다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../functions/news-watch.js');
const 서버원 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');

/* 서버의 법조문원문 을 «그대로» 꺼내 가짜 fetch 로 돌린다 */
function 읽는이(가짜fetch) {
  const i = 서버원.indexOf('async function 법조문원문');
  assert.ok(i > 0, '법조문원문 이 없다');
  const 몸 = 서버원.slice(i, 서버원.indexOf('\n}\n', i) + 2);
  return new Function('fetch', 몸 + '; return 법조문원문;')(가짜fetch);
}
const 문 = '<input type="hidden" id="lsiSeq" value="285279" /><input type="hidden" id="frm_efYd" name="efYd" value="20261008" />'
  + '<input type="hidden" id="lsNm" value="근로기준법" />';
/* 공개 쪽 법 전문 — 조 하나를 표지째 */
const 법전문 = (조, 의, 안) => '<a name="J' + 조 + ':' + 의 + '" id="J' + 조 + ':' + 의 + '"></a> <div class="pgroup"> <ul class="lawico01">'
  + ' <li> <a title="조문체계도 팝업으로 이동" href="#AJAX"> <img alt="조문체계도버튼" src="/LSW/a.svg" /> </a> </li></ul>'
  + ' <div class="lawcon">' + 안 + '<p></p> </div> </div> <a name="J' + (조 + 1) + ':0" id="J' + (조 + 1) + ':0"></a> <div>다음 조</div>';
async function 원문(전문, 조 = 55) {
  const 가짜 = async (u) => ({ ok: true, text: async () => (/lsLinkProc\.do/.test(u) ? 문 : 전문) });
  const r = await 읽는이(가짜)([{ 법: '근로기준법', 조, 의: 0 }]);
  assert.strictEqual(r.length, 1, '조문을 못 읽었다');
  return r[0].원문;
}
const 겹침 = /([①-⑳㉑-㉟])\s*\1/;

/* 2026-11-16 실측 모양 그대로(제55조) */
const 제55조 = 법전문(55, 0,
  '<p class="pty1_p4"> <input name="joNoList" id="Y005500" type="checkbox" value="55:0:005500:1" /> <span class="bl"><label for="Y005500"> 제55조(<a class="oneView" href="javascript:;">휴일</a>) </label> </span>'
  + ' ① 사용자는 근로자에게 1주에 평균 1회 이상의 유급휴일을 보장하여야 한다. <span class="sfon">&lt;개정 2018. 3. 20.&gt;</span> </p>'
  + ' <p class="pty1_de2_1">② 사용자는 근로자에게 대통령령으로 정하는 휴일을 유급으로 보장하여야 한다. 다만, 근로자대표와 서면으로 합의한 경우 특정한 근로일로 대체할 수 있다. <span class="sfon">&lt;신설 2018. 3. 20.&gt;</span> </p>');

test('① 실제 제55조 모양 — 항 번호가 한 번만 나온다', async () => {
  const 글 = await 원문(제55조);
  assert.doesNotMatch(글, 겹침, '번호가 겹쳤다(AI 가 «번호 중복» 오탐을 올린다): ' + 글.slice(0, 70));
  assert.strictEqual((글.match(/①/g) || []).length, 1);
  assert.strictEqual((글.match(/②/g) || []).length, 1);
  /* 번호는 살아 있고 문장은 이어진다 */
  assert.match(글, /^제55조\(휴일\) ① 사용자는 근로자에게 1주에 평균 1회 이상의 유급휴일을 보장하여야 한다\./);
  assert.match(글, /② 사용자는 근로자에게 대통령령으로 정하는 휴일을 유급으로 보장하여야 한다\./);
});

test('② 호·목도 한 번씩 — 차례(항 → 호 → 목 → 다음 호)가 그대로다', async () => {
  const 글 = await 원문(법전문(2, 0,
    '<p class="pty1_p4"> <span class="bl"><label> 제2조(<a class="oneView">정의</a>) </label></span> ① 이 법에서 사용하는 용어의 뜻은 다음과 같다. </p>'
    + ' <p class="pty1_de2h">1. “근로자”란 직업의 종류와 관계없이 임금을 목적으로 근로를 제공하는 사람을 말한다. </p>'
    + ' <p class="pty1_de3">가. 첫째 목 </p>'
    + ' <p class="pty1_de2h">2. “사용자”란 사업주를 말한다. </p>'), 2);
  assert.doesNotMatch(글, /1\.\s+1\./, '호 번호가 겹쳤다');
  assert.doesNotMatch(글, /2\.\s+2\./, '호 번호가 겹쳤다');
  assert.doesNotMatch(글, /가\.\s+가\./, '목 번호가 겹쳤다');
  const 차례 = ['① 이 법에서', '1. “근로자”란', '가. 첫째 목', '2. “사용자”란'].map((s) => 글.indexOf(s));
  assert.ok(차례.every((n) => n >= 0), '번호가 사라졌다: ' + 글);
  assert.deepStrictEqual(차례.slice().sort((a, b) => a - b), 차례, '차례가 흐트러졌다: ' + 글);
  assert.ok(글.indexOf('다음 조') < 0, '다음 조까지 붙여 읽었다');
});

test('③ 화면 군더더기(아이콘 줄·「<개정 …>」 표지)는 원문에 섞이지 않는다', async () => {
  const 글 = await 원문(제55조);
  assert.ok(!/개정|신설|조문체계도|<|>/.test(글), '원문에 화면 군더더기가 섞였다: ' + 글);
});

test('④ 교정 지시 — 원문 쪽 글자 모양은 지적하지 말고 «편지»만 보라고 못 박는다', async () => {
  const 글 = await 원문(제55조);
  const 지 = W.교정지시('【이번 주 한마디(우리가 씀)】\n주휴일은 …', [{ 이름: '근로기준법 제55조', 원문: 글 }]);
  assert.match(지, /글자 모양은 지적하지 마라/, '원문 쪽 번호·띄어쓰기 지적을 막는 말이 없다');
  assert.match(지, /«편지»가 원문과 다른 곳만 올려라/);
  assert.match(지, /3\) «편지»의 분명한 오탈자/, '오탈자·반복은 «편지» 것만 본다');
  /* 이미 있던 못 박기는 그대로 */
  assert.match(지, /원문이 없는 것은 판단하지 마라/);
  assert.match(지, /기억으로 조문·판례를 말하지 마라/);
  /* AI 가 실제로 읽는 글에 겹침이 없다 */
  assert.doesNotMatch(지, 겹침, 'AI 에게 건네는 글에 번호가 겹쳐 있다');
});
