"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./typesafe-evaluate");

test("Jev 전송 전 식별번호와 연락처를 가린다", () => {
  const got = T.redact("홍길동 님 900101-1234567 010-1234-5678 test@example.com 123-45-67890");
  assert.match(got.text, /\[주민번호\]/);
  assert.match(got.text, /\[전화번호\]/);
  assert.match(got.text, /\[이메일\]/);
  assert.match(got.text, /\[사업자번호\]/);
  assert.doesNotMatch(got.text, /900101|1234-5678|example\.com/);
});

test("Jev 응답은 제안값만 돌려주고 열쇠는 담지 않는다", async () => {
  const got = await T.evaluate(async () => ({ ok: true, status: 200, json: async () => ({ answers: { urgency: { noul: 0.9 } }, usage: { input_tokens: 1 } }) }), "비밀열쇠", "로그인이 자꾸 멈춥니다");
  assert.equal(got.ok, true);
  assert.equal(got.answers.urgency.noul, 0.9);
  assert.equal(JSON.stringify(got).includes("비밀열쇠"), false);
});
