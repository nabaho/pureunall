'use strict';
/* AI 비용 정리 (2026-11-19 대표 「지금」 — 비용표 «코드 정리 5가지»)
   실행: node --test tests/ai-cost-cleanup.test.js

   ① 종료된 모델을 안 부른다 — 사진 지우개 둘째 모델(gemini-2.5-flash-image-preview, 2026-01-15 종료)
   ② 두 번 부르기 막기 — 경력관리(Gemini 가 읽은 뒤 Vision·Claude 또 부름) · 사진첩(같은 사진 Vision 두 번)
   ③ 출력 상한 — 부르는 쪽이 안 정하면 서버가 기본 상한을 건다
   ④ 기금 지식 챗봇 — 질문마다 자동으로 부르는 길은 가벼운 모델(Haiku 5.5)부터
   ⑤ 달 금액을 «횟수 × ₩4» 대신 실제 토큰 원화로 — 서버·화면이 같은 식

   ⚠ 단가(0.30·2.50 …)와 환율 1400 은 «값 자체가 규칙»이다 — 구글 공식 단가표(2026-11-19 원문)와
     대표 보고서의 어림 기준이라 그대로 박는다(검사고정-허용). 단가가 바뀌면 함께 고친다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const PE = require(path.join(R, 'functions', 'photo-edit.js'));
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));
const KC = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8').replace(/\r\n/g, '\n');
const PH = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const FUND = fs.readFileSync(path.join(R, 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const RULES = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8');

function loadBilling() {
  const box = { window: undefined };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-billing.js'), 'utf8'), box);
  return box.PuBilling;
}
const PB = loadBilling();

/* ══ ① 종료된 모델 ══ */
test('① 사진 지우개가 종료된 모델(-image-preview)을 부르지 않는다', () => {
  assert.ok(PE.MODELS.length >= 1, '그림 고치는 모델이 하나도 없습니다');
  PE.MODELS.forEach((m) => assert.ok(!/image-preview$/.test(m), '종료된 모델을 부릅니다: ' + m));
});

/* ══ ② 두 번 부르기 ══ */
test('② 경력관리 — Vision·Claude 는 Gemini 가 «못 읽었을 때만» 부른다', () => {
  const at = KC.indexOf('images:annotate?key=${gvKey}');
  assert.ok(at > 0, 'Vision 부름 자리를 못 찾았다');
  const line = KC.slice(KC.lastIndexOf('\n', at), at);
  assert.match(line, /if\(gvKey&&!isPDF&&!_ocrGot\(parsed\)\)/, '★ Gemini 가 읽은 뒤에도 Vision·Claude 를 또 부릅니다(요금 두세 번)');
});

test('② 사진첩 — 무료 판독으로 이미 Vision 에 보낸 사진은 서버 «무료 글자 먼저»를 끈다', () => {
  const mk = cutFn(PH, 'function imgChunkMakers(');
  assert.match(mk, /Object\.assign\(\{ freeFirst: true \}, opts \|\| \{\}\)/,
    '★ 부르는 쪽이 freeFirst:false 를 줘도 덮어써 버립니다');
  const ran = cutFn(PH, 'function freeOcrRan(');
  ['noFree', 'freeOcrPref()', 'PuDocRead.freeRead', 'length === 1'].forEach((w) =>
    assert.ok(ran.indexOf(w) >= 0, 'freeOcrRan 이 freeReadTry 와 같은 조건을 안 봅니다: ' + w));
  const tryFn = cutFn(PH, 'function freeReadTry(');
  assert.match(tryFn, /length !== 1/, 'freeReadTry 의 «한 장만» 조건이 바뀌었으면 freeOcrRan 도 함께 고친다');
  const calls = PH.match(/imgChunkMakers\(imgs, [^\n]*freeOcrRan\([^\n]*/g) || [];
  assert.ok(calls.length >= 1, '올릴 때 판독이 freeOcrRan 을 안 봅니다');
  assert.match(PH, /const 덤 = freeOcrRan\('', imgs, opt\) \? \{ freeFirst: false \} : \{\};/, '다시 판독 길이 freeOcrRan 을 안 봅니다');
});

/* ══ ③ 출력 상한 ══ */
test('③ 부르는 쪽이 출력 상한을 안 정해도 서버가 기본 상한을 건다', () => {
  const b = DR.geminiBody([{ text: '안녕' }]);
  assert.equal(b.generationConfig.maxOutputTokens, DR.MAX_OUTPUT_TOKENS, '★ 상한 없이 나가면 모델 최대까지 출력(=요금)이 나올 수 있습니다');
  assert.equal(DR.geminiBody([{ text: 'x' }], { maxOutputTokens: 1500 }).generationConfig.maxOutputTokens, 1500, '정한 값은 그대로');
});

/* ══ ④ 기금 지식 챗봇 ══ */
test('④ 기금 지식 챗봇은 가벼운 모델 목록으로, 서식 고치기는 그대로', () => {
  const quick = (FUND.match(/var AI_MODELS_QUICK=\[([^\]]*)\]/) || [])[1];
  assert.ok(quick, 'AI_MODELS_QUICK 이 없습니다');
  assert.match(quick, /^'claude-haiku-/, '★ 질문마다 자동으로 부르는 길이 가장 싼 모델부터가 아닙니다');
  const ask = cutFn(FUND, 'function askFundBotAi(');
  assert.match(ask, /aiCall\([^)]*\{models:AI_MODELS_QUICK\}\)/, '★ 지식 챗봇이 비싼 기본 목록을 씁니다');
  const call = cutFn(FUND, 'function aiCall(');
  assert.match(call, /opts\.models/, 'aiCall 이 모델 목록을 받지 않습니다');
  assert.match(call, /model:models\[i\]/);
  assert.match(call, /if\(i<models\.length-1\)/, '다음 모델로 넘어갈 때도 같은 목록을 봐야 한다');
});

/* ══ ⑤ 실제 토큰 원화 ══ */
test('⑤ 답 하나의 원화 — 입력·출력·생각 토큰과 모델 단가로 (검사고정-허용: 구글 단가·환율)', () => {
  /* 2.5 Flash: 입력 1만 × $0.30 + (출력 1천 + 생각 1천) × $2.50 = $0.008 → ₩11.2 */
  assert.equal(DR.wonOfUsage({ modelVersion: 'gemini-2.5-flash', usageMetadata: { promptTokenCount: 10000, candidatesTokenCount: 1000, thoughtsTokenCount: 1000 } }), 11.2);
  /* 2.5 Flash-Lite 가 2.5 Flash 로 잘못 잡히지 않는다: 1만 × 0.10 + 2천 × 0.40 = $0.0018 → ₩2.52 */
  assert.equal(DR.wonOfUsage({ modelVersion: 'gemini-2.5-flash-lite', usageMetadata: { promptTokenCount: 10000, candidatesTokenCount: 2000 } }), 2.52);
  /* 음성은 음성 단가: 6만 음성 × $1.00 + 1천 글 × $0.30 = $0.0603 → ₩84.42 */
  assert.equal(DR.wonOfUsage({ modelVersion: 'gemini-2.5-flash', usageMetadata: { promptTokenCount: 61000, promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 60000 }, { modality: 'TEXT', tokenCount: 1000 }] } }), 84.42);
  /* modelVersion 이 없으면 부른 모델 이름으로, 모르는 모델이면 2.5 Flash 값으로 */
  assert.equal(DR.wonOfUsage({ usageMetadata: { promptTokenCount: 10000 } }, 'gemini-2.5-flash'), 4.2);
  assert.equal(DR.wonOfUsage({ modelVersion: 'gemini-9-unknown', usageMetadata: { promptTokenCount: 10000 } }), 4.2);
  /* 셈이 없으면 null — «0원»으로 쌓지 않는다 */
  assert.equal(DR.wonOfUsage({}), null);
  assert.equal(DR.wonOfUsage(null), null);
});

test('⑤ 달 금액 = (n − wn) × 단가 + won — 서버와 화면이 «같은 금액»', () => {
  const cases = [
    { n: 0 }, { n: 100 }, { n: 100, wn: 40, won: 520.5 }, { n: 10, wn: 10, won: 3.3 },
    { n: 5, wn: 9, won: 100 },            // wn 이 n 보다 크면 n 으로 자른다(음수 금액 없음)
    { n: 12500, wn: 0, won: 0 }, { n: 12500, wn: 2000, won: 30000 }, { n: 'x', won: -5 }
  ];
  [4, 0, 7].forEach((w) => cases.forEach((c) => {
    const 서버 = DR.aiSpentWonOf(c, w);
    const 화면 = PB.aiSpentWonOf(c, w);
    assert.equal(화면, 서버, JSON.stringify(c) + ' 단가 ' + w + ' — 화면 ₩' + 화면 + ' · 서버 ₩' + 서버 + ' 갈라졌습니다');
  }));
  /* 원화가 없으면 예전 식과 같다(옛 달 기록이 그대로 읽힌다) */
  [0, 1, 310, 7500].forEach((n) => assert.equal(DR.aiSpentWonOf({ n: n }, 4), DR.aiSpentWon(n, 4)));
  /* 단가 0 은 «무료로 쓰는 중» — 원화가 쌓여도 금액 0 */
  assert.equal(DR.aiSpentWonOf({ n: 10, wn: 10, won: 50 }, 0), 0);
  /* 화면 요약도 같은 식을 쓴다 */
  const s = PB.aiSummarize(null, { _all: { n: 100, wn: 40, won: 520 } });
  assert.equal(s.spent, DR.aiSpentWonOf({ n: 100, wn: 40, won: 520 }, 4));
  assert.equal(s.reads, 100, '판독 «횟수»는 그대로 n 이다');
});

test('⑤ 원화 셈은 달 자리까지 올라가고, 서버 규칙에 칸이 있다', () => {
  ['won', 'wn'].forEach((k) => {
    assert.ok(DR.TALLY_KINDS.indexOf(k) >= 0, k + ' 갈래가 없습니다 — 모르는 갈래는 n 으로 떨어져 횟수가 부풀려집니다');
    const ps = DR.tallyPaths('erp', '2026-11-19', k);
    assert.ok(ps.some((p) => p === 'ai_read_tally/2026-11/_all/' + k), '★ 달 자리에 안 올라가면 달 금액이 원화를 못 봅니다: ' + k);
  });
  const 셈규칙 = RULES.slice(RULES.indexOf('rules.ai_read_tally'), RULES.indexOf('rules.ai_read_tally') + 1500);
  assert.match(셈규칙, /won:\s*\{/);
  assert.match(셈규칙, /wn:\s*\{/);
});

test('⑤ 서버 — Gemini 판독을 센 자리마다 원화도 세고, 달 한도는 원화 섞인 식으로 본다', () => {
  const nBumps = IDX.match(/await bumpReadTally\([^,\n]+, r\.ok \? "n" : \(DR\.dailyQuotaGone\(r\.why\) \? "quota" : "n"\)\);/g) || [];
  assert.ok(nBumps.length >= 1, 'Gemini 판독 셈 자리를 못 찾았다');
  const pairs = IDX.match(/await bumpReadTally\(([^,\n]+), r\.ok \? "n" : \(DR\.dailyQuotaGone\(r\.why\) \? "quota" : "n"\)\);\s*await bumpSpend\(\1, r\);/g) || [];
  assert.equal(pairs.length, nBumps.length, '★ 원화를 안 세는 Gemini 판독 자리가 있습니다 — 그 판독은 ₩4 로만 잡힙니다');
  const fn = cutFn(IDX, 'async function aiMonthSpend(');
  assert.match(fn, /DR\.aiMonthAllPath\(\)/, '★ 달 «_all» 통째를 안 읽으면 원화 칸(won·wn)을 못 봅니다');
  assert.match(fn, /DR\.aiSpentWonOf\(/, '★ 서버가 화면과 다른 식으로 셉니다');
  /* 캘린더 메일함은 제 손으로 한도를 본다 — 같은 식이어야 한다(2026-11-19 독립 검토 «낮음» 지적) */
  const CAL = stripJs(fs.readFileSync(path.join(R, 'functions', 'cal-inbox.js'), 'utf8'));
  const mo = cutFn(CAL, 'async function monthOver(');
  assert.match(mo, /DR\.aiMonthAllPath\(\)/, '★ 캘린더 메일함이 원화 칸을 안 봅니다');
  assert.match(mo, /DR\.aiSpentWonOf\(/, '★ 캘린더 메일함이 서버·화면과 다른 식으로 셉니다');
  assert.match(CAL, /await bumpTally\(db, today\);\s*await bumpSpend\(db, today, r\);/, '★ 캘린더 메일함 판독이 원화를 안 셉니다');
  const bs = cutFn(IDX, 'async function bumpSpend(');
  assert.match(bs, /if \(!r \|\| !r\.ok\) return;/, '실패한 판독은 원화로 세지 않는다');
  assert.match(bs, /if \(won === null\) return;/, '셈을 못 냈으면 쌓지 않는다(그 판독은 횟수×단가로)');
});
