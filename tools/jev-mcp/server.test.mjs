import test from "node:test";
import assert from "node:assert/strict";
import evaluator from "../../functions/typesafe-evaluate.js";

test("Jev MCP가 쓰는 공용 가림기가 주민번호·계좌번호를 가린다", () => {
  const masked = evaluator.redact("주민번호 900101-1234567, 계좌 123-456-78901234");
  assert.match(masked.text, /\[주민번호\]/);
  assert.match(masked.text, /\[계좌번호\]/);
  assert.deepEqual(masked.maskedKinds, ["주민번호", "계좌번호"]);
});

test("Jev MCP 입력은 ERP와 같은 4천 글자 한도를 쓴다", () => {
  assert.equal(evaluator.clean("가".repeat(4500)).length, evaluator.MAX_TEXT);
});
