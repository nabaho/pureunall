"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./typesafe-evaluate");

/* 메일 자동분류가 실제로 묻는 모양과 같은 결 — 칸 하나를 고르게 한다 */
const QS = { bin: { type: "choice", instructions: "Which folder fits?", criteria: { "가": "folder 가", "나": "folder 나" } } };

test("Jev 전송 전 식별번호와 연락처를 가린다", () => {
  const got = T.redact("홍길동 님 900101-1234567 010-1234-5678 test@example.com 123-45-67890");
  assert.match(got.text, /\[주민번호\]/);
  assert.match(got.text, /\[전화번호\]/);
  assert.match(got.text, /\[이메일\]/);
  assert.match(got.text, /\[사업자번호\]/);
  assert.doesNotMatch(got.text, /900101|1234-5678|example\.com/);
});

test("Jev 응답은 제안값만 돌려주고 열쇠는 담지 않는다", async () => {
  const got = await T.evaluate(async () => ({ ok: true, status: 200, json: async () => ({ answers: { bin: { choice: "가" } }, usage: { input_tokens: 1 } }) }), "비밀열쇠", "로그인이 자꾸 멈춥니다", QS);
  assert.equal(got.ok, true);
  assert.equal(got.answers.bin.choice, "가");
  assert.equal(JSON.stringify(got).includes("비밀열쇠"), false);
});

/* 2026-11-22 포털 「TypeSafe 검토」 단추를 걷어내며 기본 물음(9가지)도 없앴다.
   그 뒤로는 «무엇을 물을지» 없이 부르면 글이 업체로 나가면 안 된다 — 빈 물음으로 글만 남기는 셈이다. */
test("물음(qs) 없이 부르면 업체에 아무것도 보내지 않는다", async () => {
  for (const qs of [undefined, null, {}, [], "bin"]) {
    let sent = 0;
    const got = await T.evaluate(async () => { sent++; return { ok: true, status: 200, json: async () => ({}) }; }, "열쇠", "글", qs);
    assert.equal(sent, 0, "물음 없이 업체를 불렀습니다: " + JSON.stringify(qs));
    assert.equal(got.ok, false);
    assert.ok(got.why, "까닭표가 있어야 부른 쪽이 무엇이 빠졌는지 압니다.");
  }
  assert.equal("questions" in T, false, "걷어낸 기본 물음이 되살아났습니다.");
});

test("보내는 몸통에는 부른 쪽이 준 물음이 그대로 실린다", async () => {
  let body = null;
  await T.evaluate(async (url, o) => { body = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ answers: {} }) }; }, "열쇠", "글", QS);
  assert.deepEqual(body.questions, QS);
});

/* ── 왜 못 받았나를 «갈라» 말하는가 (2026-09-20) ────────────────────────────────
   이 연결은 배포된 뒤 «한 번도 안 불린» 채였다. 처음 눌러 보는 사람이 열쇠 문제와
   대기자 명단과 업체 장애를 못 가리면 시험 자체가 쓸모없다.
   ⚠ 값(문구)을 못 박지 않는다 — 「서로 다른가」와 「무엇을 가리키는가」만 본다. */
test("실패한 까닭이 서로 다르면 다른 말이 나온다", () => {
  const 갈래 = [401, 403, 404, 400, 429, 503].map((s) => T.failureOf(s, {}));
  갈래.forEach((r) => {
    assert.equal(r.ok, false);
    assert.ok(r.why, "까닭표(why)가 있어야 화면이 «무엇을 하라»고 말할 수 있습니다.");
    assert.ok(r.error && r.error.length > 5, "사람이 읽을 말이 있어야 합니다.");
  });
  const 열쇠 = 갈래[0], 길 = 갈래[2], 한도 = 갈래[4], 장애 = 갈래[5];
  assert.equal(갈래[1].why, 열쇠.why, "401 과 403 은 둘 다 열쇠 갈래입니다.");
  assert.notEqual(열쇠.why, 한도.why);
  assert.notEqual(열쇠.why, 장애.why);
  assert.notEqual(길.why, 장애.why);
  assert.notEqual(열쇠.error, 장애.error, "열쇠 문제와 업체 장애가 같은 말이면 가릴 수 없습니다.");
  /* 열쇠 갈래는 «대기자 명단»을 짚어 줘야 한다 — Jev 는 아직 명단 단계다. */
  assert.match(열쇠.error, /열쇠|명단/);
  /* 업체가 한도라고 하면 우리도 한도(429)로 돌려줘야 화면이 「조금 뒤」라고 말한다. */
  assert.equal(한도.status, 429);
});

test("업체가 곁들인 한마디는 싣되 통째로는 안 흘린다", () => {
  const 긴말 = "오".repeat(500);
  const r = T.failureOf(401, { error: { message: 긴말 } });
  assert.ok(r.hint && r.hint.length < 긴말.length, "업체 말은 잘라서 실어야 합니다.");
  const 없음 = T.failureOf(401, {});
  assert.equal("hint" in 없음, false, "곁들일 말이 없으면 빈 칸을 만들지 않습니다.");
});

test("업체에 닿지도 못한 것은 또 다른 갈래다", async () => {
  const got = await T.evaluate(async () => { throw new Error("getaddrinfo ENOTFOUND"); }, "열쇠", "글", QS);
  assert.equal(got.ok, false);
  assert.equal(got.why, "network");
  assert.notEqual(got.why, T.failureOf(503, {}).why, "닿지 못한 것과 업체가 아픈 것은 다릅니다.");
});
