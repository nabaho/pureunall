/* 유료 AI 통제 — 대표 지시 2026-11-05 「유료 API 통제 — 추천대로」
   ① 판독: 사람이 누른 것도 한도의 MANUAL_CEIL 배에서 멈춘다(예전엔 끝이 없었다)
   ② AI 지우개(photoEdit): 같은 지갑에 무게를 달아 세고, 한도·사람별 하루 몫으로 막는다
   ⚠ 숫자(1.2배·20장·무게 15)는 «규칙»이 아니라 조절값이다 — 검사는 «관계»만 본다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const PE = require(path.join(R, 'functions', 'photo-edit.js'));
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));

function photoEditSrc() {
  const at = IDX.indexOf('exports.photoEdit =');
  assert.ok(at > 0, 'photoEdit 를 못 찾았습니다');
  const end = IDX.indexOf('exports.', at + 20);
  return IDX.slice(at, end > 0 ? end : undefined);
}

test('판정: 한도 아래면 누구도 안 막는다', () => {
  const m = { known: true, spent: 100, limit: 50000, over: false };
  assert.strictEqual(DR.budgetGate(m, false).block, false);
  assert.strictEqual(DR.budgetGate(m, true).block, false);
});

test('판정: 한도를 넘으면 자동은 막고, 사람이 누른 것은 여유 안에서 통과', () => {
  const m = { known: true, spent: 50000, limit: 50000, over: true };
  assert.strictEqual(DR.budgetGate(m, false).block, true);
  assert.strictEqual(DR.budgetGate(m, true).block, false);
});

test('★ 판정: 여유(MANUAL_CEIL 배)를 넘으면 사람이 누른 것도 막는다 — 끝이 있어야 한도다', () => {
  assert.ok(DR.MANUAL_CEIL > 1, '여유가 1배 이하면 «급한 서류»를 못 읽습니다');
  const limit = 50000;
  const ceil = Math.round(limit * DR.MANUAL_CEIL);
  const g = DR.budgetGate({ known: true, spent: ceil, limit: limit, over: true }, true);
  assert.strictEqual(g.block, true, '★ 사람이 누른 판독이 끝없이 통과합니다');
  assert.strictEqual(g.hard, true);
  assert.strictEqual(DR.budgetGate({ known: true, spent: ceil - 1, limit: limit, over: true }, true).block, false);
});

test('판정: 한도 0(설정 안 함)이면 여유 문턱이 «0원에서 막기»가 되지 않는다', () => {
  assert.strictEqual(DR.budgetGate({ known: true, spent: 10, limit: 0, over: false }, true).block, false);
});

test('★ AI 지우개는 부르기 «전»에 지갑과 사람별 하루 몫을 본다', () => {
  const fn = photoEditSrc();
  const 지갑 = fn.indexOf('aiMonthSpend(');
  const 하루 = fn.indexOf('EDIT_DAY_PER_USER');
  const 부름 = fn.indexOf('callEdit(');
  assert.ok(지갑 > 0 && 지갑 < 부름, '★ AI 지우개가 이번 달 한도를 안 봅니다 — 가장 비싼 모델에 상한이 없습니다');
  assert.ok(하루 > 0 && 하루 < 부름, '★ 한 사람이 되풀이 눌러 달 몫을 다 태울 수 있습니다');
  assert.match(fn.slice(0, 부름), /!\s*몫\.known/, '★ 셈을 못 읽은 채 그림 모델을 부릅니다');
});

test('★ AI 지우개는 요금이 붙은 만큼(billed × 무게) 같은 지갑에 센다', () => {
  const fn = photoEditSrc();
  assert.match(fn, /bumpReadTally\(\s*["']photoedit["']\s*,\s*["']n["']\s*,\s*r\.billed\s*\*\s*PE\.EDIT_READ_WEIGHT\s*\)/,
    '★ 편집이 지갑에 안 잡히면 한도가 편집 요금을 못 봅니다');
  assert.ok(PE.EDIT_READ_WEIGHT > 1, '그림 1장은 판독 1번보다 비쌉니다');
  assert.ok(DR.APPS.indexOf('photoedit') >= 0, '셈 자리가 «other» 로 섞입니다');
});

test('★ callEdit 는 200 으로 답한 수만 센다 — 재시도(429)는 요금이 아니다', async () => {
  const calls = [];
  const fake = async function () {
    calls.push(1);
    if (calls.length === 1) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] }) };
  };
  const r = await PE.callEdit(fake, 'k', 'AAAA', 'image/png', [0, 0], '');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.billed, 1);
});

test('사람별 하루 셈 자리는 규칙에 없는 최상위(서버만) — 브라우저가 못 고친다', () => {
  const p = PE.userDayPath('2026-11-05', 'u.x');
  assert.match(p, /^ai_user_day\//);
  assert.ok(!/\./.test(p.split('/')[2]), 'uid 의 «.» 이 DB 열쇠를 깹니다');
  const RULES = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8');
  assert.ok(!/rules\.ai_user_day\b/.test(RULES), '이 자리를 브라우저에 열면 하루 몫을 스스로 지울 수 있습니다');
});
