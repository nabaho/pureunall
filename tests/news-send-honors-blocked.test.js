/* 뉴스레터 자동 발송 — 봉인 «뒤»에 막은 주소는 안 보낸다 (2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   금요일에 봉인한 확정본은 월요일에 그대로 나간다. 그 사이 반송·수신거부로 막은 주소가
   봉인된 받는 줄에 남아 있으면 «거부한 분께 또» 간다. 발송 직전에 한 번 더 거른다.
   ⚠ 예시는 가짜다(가나상사·홍길동). */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../js/pu-news-core.js');
const { stripJs } = require('./strip-comments.js');

test('★★ 막은 명단의 세 가지 열쇠 모양을 다 본다 — 그대로 · 밑줄 · 쉼표', () => {
  assert.ok(C.막은주소인가('hong@gana.example', { 'hong@gana.example': 1 }));
  assert.ok(C.막은주소인가('Hong@Gana.example', { 'hong@gana_example': { email: 'hong@gana.example' } }));
  assert.ok(C.막은주소인가('hong@gana.example', { 'hong@gana,example': 1 }));
  assert.ok(!C.막은주소인가('kim@gana.example', { 'hong@gana_example': 1 }));
  assert.ok(!C.막은주소인가('', { '': 1 }));
});

test('★★ 봉인한 받는 줄에서 막은 주소만 빼고, 나머지 줄은 «그대로» 둔다', () => {
  const 줄 = [{ email: 'hong@gana.example', company: '가나상사', track: 't1' },
    { email: 'kim@nara.example', company: '나라상사', track: 't2' }];
  const r = C.막은주소거르기(줄, { 'hong@gana_example': { email: 'hong@gana.example' } });
  assert.deepStrictEqual(r.뺀, ['hong@gana.example'], '막은 주소가 그대로 나갑니다');
  assert.strictEqual(r.남김.length, 1);
  assert.strictEqual(r.남김[0], 줄[1], '남는 줄이 바뀌면 추적번호·지역뉴스가 흐트러집니다');
});

test('★★ 명단다듬기도 같은 잣대를 쓴다 — 두 곳이 다른 잣대를 갖지 않게', () => {
  const d = C.명단다듬기([{ email: 'hong@gana.example' }, { email: 'kim@nara.example' }], { 'hong@gana,example': 1 });
  assert.deepStrictEqual(d.ok.map((x) => x.email), ['kim@nara.example']);
});

test('★★ 월요일 자동 발송이 걸기 직전에 막은 명단을 읽어 거른다', () => {
  const src = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
  const i = src.indexOf('exports.weeklyNewsletterSend ');
  const 몸 = src.slice(i, src.indexOf('\nexports.', i + 10));
  const 거름 = 몸.indexOf('NCore.막은주소거르기(ready.to');
  const 걸기 = 몸.indexOf('MB.validateBulk(ready)');
  assert.ok(거름 > 0, '자동 발송이 봉인 뒤 막은 주소를 거르지 않습니다');
  assert.ok(걸기 > 거름, '거르기가 걸기(validateBulk)보다 뒤에 있어 소용이 없습니다');
  assert.match(몸, /newsletter\/blocked/);
});
