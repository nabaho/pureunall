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

/* ── 검토 2026-11-09 반영 ── */
test('⑦ 우리가 업체에 견적을 «달라고» 보낸 메일은 우리 견적이 아니다 — 「견적서 요청」처럼 견적 다음에 «서»가 껴도 거른다', () => {
  for (const s of ['[푸른노무법인] ○○ 견적서 요청의 건', '견적서 요청드립니다', '견적서 의뢰드립니다', '견적 요청드립니다', '견적의뢰의 건']) {
    assert.ok(!D.isOurQuote(s, []), '우리 견적으로 읽었다: ' + s);
    assert.strictEqual(D.docOf(s, []), '', s);
  }
  /* 거꾸로 — 우리가 «요청받아 보내는» 견적서는 그대로 우리 견적이다 */
  assert.ok(D.isOurQuote('[푸른노무법인] 요청하신 견적서 송부의 건', []));
  assert.ok(D.isOurQuote('[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건', ['견적서_가나기관.pdf']));
});

test('⑦ 비교견적서 «제출»도 남이 낸 것이다 — 우리 견적(bundle)으로 잘못 읽지 않는다', () => {
  assert.ok(!D.isOurQuote('비교견적서 제출', []));
  assert.strictEqual(D.compareHint('비교견적서 제출', []), 'reply');
  assert.strictEqual(D.compareHint('RE: [다라노무법인] 비교견적서 제출의 건', []), 'reply');
});

test('③ 금액이 든 글자를 가린다 — 제목·첨부 이름(「견적서_400만원.pdf」)이 직원 모두가 읽는 곳으로 가기 전에', () => {
  const t = D.scrubMoney;
  assert.strictEqual(t('견적서_400만원.pdf'), '견적서_○○.pdf');
  assert.strictEqual(t('견적서 4,000,000원 송부'), '견적서 ○○ 송부');
  assert.strictEqual(t('1.2억 컨설팅'), '○○ 컨설팅');
  assert.strictEqual(t('견적서(120만 원).hwp'), '견적서(○○).hwp');
  assert.strictEqual(t('월 50만원 자문'), '월 ○○ 자문');
  assert.strictEqual(t('자문료 3,500,000'), '자문료 ○○');
  assert.strictEqual(t('2천만원'), '○○');
  assert.strictEqual(t('300원'), '○○');
});

test('③ 금액이 아닌 숫자(날짜·쪽수·개월·인원)는 건드리지 않는다', () => {
  const t = D.scrubMoney;
  for (const keep of ['견적서_가나기관_261106.pdf', '견적서_2026-11-06.pdf', '쪽수 12쪽', '컨설팅 3개월 30인', '직무분석 컨설팅 견적서 송부의 건', '원본.pdf', '2026년 자문계약서']) {
    assert.strictEqual(t(keep), keep, keep);
  }
  assert.strictEqual(t(null), '');
  assert.strictEqual(t(undefined), '');
});

/* ── 검토 2026-11-09 (Codex·Antigravity) — 금액 가리기의 빈틈: 원화 기호·코드·한글 금액·조사·쉼표 없는 숫자 ── */
test('③ ★ 가려야 하는 금액 표기 — ₩·KRW·한글 금액·원 뒤 조사·쉼표 없는 7자리·날짜 모양이 아닌 6자리', () => {
  const t = D.scrubMoney;
  const cases = [['견적서 ₩4000000.pdf', '견적서 ○○.pdf'], ['견적서 KRW 4000000.pdf', '견적서 ○○.pdf'], ['견적서 4000000KRW', '견적서 ○○'],
    ['견적서 금액 사백만원.pdf', '견적서 금액 ○○.pdf'], ['삼천오백만 원', '○○'], ['천만원 견적', '○○ 견적'],
    ['견적서 4000000원의 건', '견적서 ○○의 건'], ['금 5000000원정', '금 ○○정'], ['자문료 3500000원입니다', '자문료 ○○입니다'],
    ['4000000.pdf', '○○.pdf'], ['500000.pdf', '○○.pdf'], ['견적서_1.2억.pdf', '견적서_○○.pdf'], ['4천만원의 건', '○○의 건'], ['01012345678', '○○']];
  for (const [a, b] of cases) assert.strictEqual(t(a), b, a);
});
test('③ 금액이 아닌 글자는 두고 — 낱말 속 단위(3천안공장·10만기일)·사원·구원·공원·날짜(261106)·전화번호·쪽수', () => {
  const t = D.scrubMoney;
  for (const keep of ['3천안공장 방문', '10만기일 안내', '신입 사원 교육', '구원 요청', '공원 안전점검', '261106 견적', '견적서_가나기관_261106.pdf', '041-556-0035', '쪽수 12쪽', '일 년 계약']) {
    assert.strictEqual(t(keep), keep, keep);
  }
});
test('⑦ 요청받아 «견적서를 붙여 답한» 메일은 우리 견적이다 — 「RE: 견적서 요청드립니다」+ 견적서 첨부', () => {
  assert.ok(D.isOurQuote('RE: 견적서 요청드립니다', ['견적서_가나기관.pdf']));
  assert.strictEqual(D.docOf('RE: 견적서 요청드립니다', ['푸른노무법인_견적서.pdf']), 'quote');
  assert.ok(D.isOurQuote('RE: 견적 요청드립니다', ['푸른노무법인_견적서.pdf']));
  /* 견적요청서 모양 첨부만 있으면 우리가 달라고 보낸 것 — 거른다 */
  assert.ok(!D.isOurQuote('RE: 견적서 요청드립니다', ['견적요청서.pdf']));
  assert.ok(!D.isOurQuote('○○ 견적서 요청의 건', ['견적 요청서_푸른.hwp']));
  assert.ok(!D.isOurQuote('견적서 요청드립니다', []));
  /* 비교견적서 요청·작성은 첨부가 있어도 남의 견적(강한 제외) */
  assert.ok(!D.isOurQuote('RE: 비교견적서 작성 요청', ['견적서_가나기관.pdf']));
});
