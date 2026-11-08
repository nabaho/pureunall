"use strict";
/* 🔒 서명본·견적서 열기 권한 (견적·계약 자동화 계획 1 · 작업 5)
   원래는 총괄관리자만 열었다. 견적 길로 올린 🔒 원본(from.kind === 'quote')은 재무와 그 건의 «확정» 담당자도 연다.
   ⚠ 아무 🔒 파일이나 견적 기록에 끼워 열 수 없다 — 견적 길 파일이어야 하고, 그 견적이 그 파일을 가리켜야 한다. */
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("./doc-secret-access");

const QFILE = { secret: true, from: { kind: "quote" }, by: "u9" };
const quote = (fileId) => ({ fileId, by: "u9" });

test("총괄관리자는 어떤 🔒 파일이든 연다", () => {
  assert.equal(A.canOpenSecret({ role: { isAdmin: true }, uid: "a", fileId: "f1", file: { secret: true, from: { kind: "form" } } }), true);
});
test("재무 + 그 파일을 가리키는 견적 + 견적 길 파일 → 연다", () => {
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: QFILE, quote: quote("f1"), amt: null }), true);
});
test("재무라도 견적 기록이 없으면 못 연다", () => {
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: QFILE, quote: null }), false);
});
test("확정 담당자(owner === uid)는 연다", () => {
  assert.equal(A.canOpenSecret({ role: {}, uid: "u7", fileId: "f1", file: QFILE, quote: quote("f1"), amt: { owner: "u7" } }), true);
});
test("추정 담당(owner 가 빈칸)은 못 연다 — 빈 uid 와 빈 owner 가 «같다»고 열리면 안 된다", () => {
  assert.equal(A.canOpenSecret({ role: {}, uid: "u7", fileId: "f1", file: QFILE, quote: quote("f1"), amt: { owner: "" } }), false);
  assert.equal(A.canOpenSecret({ role: {}, uid: "", fileId: "f1", file: QFILE, quote: quote("f1"), amt: { owner: "" } }), false);
});
test("다른 사람이 확정 담당이면 못 연다", () => {
  assert.equal(A.canOpenSecret({ role: {}, uid: "u7", fileId: "f1", file: QFILE, quote: quote("f1"), amt: { owner: "u8" } }), false);
});
test("견적이 가리키는 파일이 다르면 못 연다(fileId 끼워 넣기)", () => {
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: QFILE, quote: quote("f2") }), false);
});
test("★ 견적 길로 올린 파일이 아니면(서명본·위임장 등) 재무·담당자도 못 연다", () => {
  const other = { secret: true, from: { kind: "form" } };
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: other, quote: quote("f1") }), false);
  assert.equal(A.canOpenSecret({ role: {}, uid: "u7", fileId: "f1", file: other, quote: quote("f1"), amt: { owner: "u7" } }), false);
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: { secret: true }, quote: quote("f1") }), false);
});
test("★★ 남이 올린 견적 원본을 자기 견적 기록에 끼워 넣어도 못 연다(담당을 자기로 해도, 재무라도)", () => {
  /* 파일은 u9(총괄)가 올렸고, 악의 직원 evil 이 자기 견적 기록(by: evil)에 그 파일 번호를 적고 자기를 담당으로 뒀다 */
  const evilQuote = { fileId: "f1", by: "evil" };
  assert.equal(A.canOpenSecret({ role: {}, uid: "evil", fileId: "f1", file: QFILE, quote: evilQuote, amt: { owner: "evil" } }), false);
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "evil", fileId: "f1", file: QFILE, quote: evilQuote }), false);
  /* 파일 기록이나 견적 기록에 만든 사람이 없어도 열지 않는다 */
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: { secret: true, from: { kind: "quote" } }, quote: quote("f1") }), false);
  assert.equal(A.canOpenSecret({ role: { fin: true }, uid: "f", fileId: "f1", file: QFILE, quote: { fileId: "f1" } }), false);
  /* 총괄관리자는 늘 연다 */
  assert.equal(A.canOpenSecret({ role: { isAdmin: true }, uid: "a", fileId: "f1", file: QFILE, quote: evilQuote }), true);
});
test("부관리자(isSubAdmin 만)·일반 직원·역할 없음은 못 연다", () => {
  assert.equal(A.canOpenSecret({ role: { isSubAdmin: true }, uid: "s", fileId: "f1", file: QFILE, quote: quote("f1") }), false);
  assert.equal(A.canOpenSecret({ role: null, uid: "x", fileId: "f1", file: QFILE, quote: quote("f1"), amt: { owner: "y" } }), false);
  assert.equal(A.canOpenSecret({ role: null, uid: "x", fileId: "f1", file: QFILE, quote: quote("f1"), amt: null }), false);
  assert.equal(A.canOpenSecret({}), false);
});
test("isAdmin 은 정확히 true 일 때만(문자열 'true' 는 아니다)", () => {
  assert.equal(A.canOpenSecret({ role: { isAdmin: "true" }, uid: "a", fileId: "f1", file: QFILE }), false);
});
test("fin 도 정확히 true 일 때만", () => {
  assert.equal(A.canOpenSecret({ role: { fin: 1 }, uid: "f", fileId: "f1", file: QFILE, quote: quote("f1") }), false);
});

test("견적 번호 모양 — 경로를 바꿔 끼우는 글자는 거른다", () => {
  assert.equal(A.isQid("-OaBcDeFgHiJkLmNoPq"), true);
  assert.equal(A.isQid("abc"), false);
  assert.equal(A.isQid("../pu_docs/secret"), false);
  assert.equal(A.isQid("a/b/c/d/e/f/g/h/i/j"), false);
  assert.equal(A.isQid(undefined), false);
  assert.equal(A.isQid("x".repeat(41)), false);
});
test("거절 문구 — 견적 길을 아는 사람에게만 알리는 말", () => {
  assert.match(A.DENY_MESSAGE, /대표·관리자·재무·담당자/);
});

/* ── puDocSecret 이 이 판정을 «거쳐서만» 비관리자에게 파일을 내주는지(글자로 지킨다) ──
   본문은 관리자 SDK·저장소가 있어야 돌아서 단위로 못 돌린다. 연결이 풀리면 여기서 걸린다. */
const fs = require("node:fs");
const path = require("node:path");
const IDX = fs.readFileSync(path.join(__dirname, "index.js"), "utf8").replace(/\r\n/g, "\n");
const BODY = (() => {
  const i = IDX.indexOf("exports.puDocSecret = functions");
  const j = IDX.indexOf("exports.puDocSecretMove", i);
  assert.ok(i > 0 && j > i, "puDocSecret 본문을 못 찾았습니다");
  return IDX.slice(i, j);
})();

test("puDocSecret — 판정 모듈을 불러 쓴다", () => {
  assert.match(IDX, /const SECRET_ACCESS = require\("\.\/doc-secret-access"\)/);
  assert.match(BODY, /SECRET_ACCESS\.canOpenSecret\(/);
});
test("puDocSecret — 비관리자는 견적 번호가 없으면 파일을 읽기도 전에 거절", () => {
  const noQid = BODY.indexOf("role.isAdmin !== true && !qid");
  const readRec = BODY.indexOf('db.ref("pu_docs/originals/"');
  assert.ok(noQid > 0 && readRec > 0 && noQid < readRec, "견적 번호 없는 비관리자 거절이 파일 기록 읽기보다 앞이어야 한다");
});
test("puDocSecret — 비관리자 판정은 파일을 내주는(download) 앞에서 끝난다", () => {
  assert.ok(BODY.indexOf("SECRET_ACCESS.canOpenSecret(") < BODY.indexOf(".download()"));
});
test("puDocSecret — 🔒 파일·경로 검사는 그대로(secret === true · pu_docs/secret/{id}/)", () => {
  assert.match(BODY, /rec\.secret !== true/);
  assert.match(BODY, /"pu_docs\/secret\/" \+ fileId \+ "\/"/);
});
test("puDocSecret — 견적 번호는 모양 검사를 거친 것만 DB 경로에 끼운다", () => {
  assert.match(BODY, /SECRET_ACCESS\.isQid\(qid\)/);
  assert.ok(BODY.indexOf("SECRET_ACCESS.isQid(qid)") < BODY.indexOf('db.ref("pu_quotes/" + qid)'));
});
test("puDocSecret — 연 기록(secret_log)에 견적 번호도 남긴다", () => {
  assert.match(BODY, /logRow\.qid = qid/);
  assert.match(BODY, /pu_docs\/secret_log"\)\.push\(logRow\)/);
});
