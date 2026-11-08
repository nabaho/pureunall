'use strict';
/* 우리 견적서·계약서 메일 감지 «한 벌» (견적·계약 자동화 계획 3 · 작업 1)
   Review Focus — ⑥ 비교견적 낱말은 낱말만으로 가르지 않는다 ⑧ 감지기 사본이 어긋나지 않는다(사본 시험은 따로).
   제목·회사는 모두 지어낸 것이다(실제 고객사 이름을 쓰지 않는다). */
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/pu-quote-detect.js');

test('우리 견적만 — 남의 견적(비교견적 요청·견적 의뢰·물품 견적)은 거른다', () => {
  assert.ok(D.isOurQuote('[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', ['견적서_인사노무컨설팅_가나기관_261106.pdf']));
  assert.ok(D.isOurQuote('[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건 (비교견적서 2부 추가)', []));
  assert.ok(D.isOurQuote('자료 송부', ['푸른노무법인_견적서_가나기관.pdf']), '제목에 없어도 첨부 이름에 견적이 있으면 우리 견적');
  assert.ok(!D.isOurQuote('[푸른노무법인] 비교견적서 요청의 건', []));
  assert.ok(!D.isOurQuote('RE: 비교견적서 작성 요청', ['견적서_가나기관.pdf']));
  assert.ok(!D.isOurQuote('RE: RE: 견적의뢰를 요청합니다. (다라상사)', []));
  assert.ok(!D.isOurQuote('RE: [푸른노무법인] 루나랩 모션 데스크 상품 견적 요청드립니다.', []));
  assert.ok(!D.isOurQuote('안녕하세요 자료 보냅니다', ['소개서.pdf']));
});

test('우리 계약서만 — 근로계약서는 아니다', () => {
  assert.ok(D.isOurContract('[푸른노무법인] 2026년 자문계약서 송부의 건', []));
  assert.ok(D.isOurContract('계약 송부', ['위임 계약서_가나상사.hwpx']));
  assert.ok(!D.isOurContract('[푸른노무법인] 가나병원 근로계약서 송부드립니다.', []));
  assert.ok(!D.isOurContract('점심 약속', []));
});

test('한 메일이 견적도 계약서도 말하면 계약서가 이긴다(메일 하나에 기록 하나)', () => {
  assert.strictEqual(D.docOf('[푸른노무법인] 위임계약서 송부의 건', ['위임계약서_가나기관.pdf', '견적서_가나기관.pdf']), 'contract');
  assert.strictEqual(D.docOf('[푸른노무법인] 견적서 송부의 건', ['견적서_가나기관.pdf']), 'quote');
  assert.strictEqual(D.docOf('안녕하세요', []), '');
});

test('첨부 이름 읽기 — 배열·열쇠 지도·JSON 글자·잘못된 값 모두 던지지 않는다', () => {
  assert.deepStrictEqual(D.namesOf(['a.pdf', '', 'b.hwp']), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(D.namesOf({ 1: 'b.hwp', 0: 'a.pdf' }), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(D.namesOf('["a.pdf","b.hwp"]'), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(D.namesOf('깨진 글자'), []);
  assert.deepStrictEqual(D.namesOf(null), []);
  assert.deepStrictEqual(D.namesOf(undefined), []);
});

test('★ 비교견적 단서 — 낱말만으로 가르지 않고 «우리 견적서인지»를 먼저 본다', () => {
  /* 우리 견적서에 비교견적서가 붙어 나가는 메일(고객에게 낼 묶음) */
  assert.strictEqual(D.compareHint('[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건 (비교견적서 2부 추가)',
    ['견적서_가나기관.pdf', '다라법인_비교견적서_가나기관.pdf']), 'bundle');
  /* 우리 견적서 + 첨부 이름에만 비교견적 */
  assert.strictEqual(D.compareHint('견적서 송부', ['견적서_가나기관.pdf', '마바법인_비교견적서.pdf']), 'bundle');
  /* 우리가 다른 법인에 «달라고» 보낸 요청 — 우리 견적이 아니다 */
  assert.strictEqual(D.compareHint('[푸른노무법인] 비교견적서 요청의 건', []), 'asked');
  assert.strictEqual(D.compareHint('RE: 비교견적서 작성 요청', ['견적서_가나기관.pdf']), 'asked');
  /* 비교견적서 회신 글 */
  assert.strictEqual(D.compareHint('RE: [다라노무법인] - 비교견적서 회신의 건', []), 'reply');
  /* 비교견적과 상관 없음 */
  assert.strictEqual(D.compareHint('[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', ['견적서_가나기관.pdf']), '');
  assert.strictEqual(D.compareHint('점심 약속', []), '');
  assert.strictEqual(D.compareHint('', null), '');
});

test('비교견적 «요청»은 우리 견적이 아니므로 docOf 는 빈 값이다(카드를 만들지 않는다)', () => {
  assert.strictEqual(D.docOf('[푸른노무법인] 비교견적서 요청의 건', []), '');
  assert.strictEqual(D.compareHint('[푸른노무법인] 비교견적서 요청의 건', []), 'asked');
});

test('받는 주소 줄 → 소문자 주소 목록 (이름 <주소> 모양·중복·빈 값)', () => {
  assert.deepStrictEqual(D.addrsOf('Hong@Gana.Example, 홍길동 <hong2@gana.example>;Hong@gana.example'),
    ['hong@gana.example', 'hong2@gana.example']);
  assert.deepStrictEqual(D.addrsOf(''), []);
  assert.deepStrictEqual(D.addrsOf(null), []);
  assert.deepStrictEqual(D.addrsOf('주소 없음'), []);
  assert.strictEqual(D.domainOf('hong@Gana.Example'), 'gana.example');
  assert.strictEqual(D.domainOf('주소 없음'), '');
});

test('서버가 쓰는 모듈이므로 금액·본문을 읽는 낱말이 없다 — 제목·첨부 이름·받는 주소만 다룬다', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'pu-quote-detect.js'), 'utf8');
  assert.ok(!/금액|amount|\.body|\.p\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), '코드에 금액·본문을 읽는 줄이 있다');
});
