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

test("업무 제안은 기한·영향·위험·주의·자료·첫 조치를 나누어 묻는다", () => {
  const q = T.questions();
  ["deadline", "impact", "legal_wage_risk", "privacy_security", "info_missing", "first_action"].forEach((key) => {
    assert.ok(q[key], key + " 질문이 있어야 합니다.");
  });
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
  const got = await T.evaluate(async () => { throw new Error("getaddrinfo ENOTFOUND"); }, "열쇠", "글");
  assert.equal(got.ok, false);
  assert.equal(got.why, "network");
  assert.notEqual(got.why, T.failureOf(503, {}).why, "닿지 못한 것과 업체가 아픈 것은 다릅니다.");
});

/* ── 하루 문 (2026-09-20) ──────────────────────────────────────────────────
   ⚠ 숫자(30·200)를 못 박지 않는다 — 「사람 몫과 전체 몫을 갈라 세는가」,
     「적은 쪽이 이기는가」, 「다 쓰면 막는가」라는 규칙만 본다. */
test("하루 몫은 사람 몫과 전체 몫을 갈라 세고, 적은 쪽이 이긴다", () => {
  assert.ok(T.PERSON_DAY_LIMIT > 0 && T.ALL_DAY_LIMIT > 0, "한도가 있어야 합니다.");
  assert.ok(T.ALL_DAY_LIMIT >= T.PERSON_DAY_LIMIT, "전체 몫이 한 사람 몫보다 작으면 뜻이 없습니다.");

  const 넉넉 = T.leftOf(0, 0);
  assert.equal(넉넉.over, false);
  assert.equal(넉넉.left, T.PERSON_DAY_LIMIT, "아무도 안 썼으면 내 몫이 그대로 남습니다.");

  /* 전체가 다 찼으면 내가 한 번도 안 썼어도 막힌다 — 갈라 세지 않으면 이걸 못 잡는다. */
  const 전체동남 = T.leftOf(0, T.ALL_DAY_LIMIT);
  assert.equal(전체동남.over, true);

  /* 내 몫만 다 썼으면 전체가 비어 있어도 막힌다. */
  const 내것동남 = T.leftOf(T.PERSON_DAY_LIMIT, 0);
  assert.equal(내것동남.over, true);
  assert.notEqual(T.overLimitError(전체동남).error, T.overLimitError(내것동남).error,
    "내 몫이 찬 것과 사무실 몫이 찬 것은 다른 말이어야 합니다.");
  assert.equal(T.overLimitError(내것동남).status, 429);
});

test("세는 자리는 날짜·사람별로 갈라지고, 열쇠로 못 쓸 글자는 걷어 낸다", () => {
  const [내것, 전체] = T.tallyPaths("uid-1", "2026-09-20");
  assert.ok(내것.includes("2026-09-20") && 전체.includes("2026-09-20"), "날짜가 자리에 들어가야 날마다 새로 셉니다.");
  assert.notEqual(내것, 전체, "사람 자리와 전체 자리가 같으면 갈라 셀 수가 없습니다.");
  /* 실시간DB 열쇠에 못 쓰는 글자가 섞이면 «조용히» 안 써진다 — 그러면 한도가 없는 것과 같다. */
  const [더러운것] = T.tallyPaths("a.b#c$d[e]", "2026-09-20");
  assert.doesNotMatch(더러운것.split("/").pop(), /[.#$[\]]/);
  const [빈것] = T.tallyPaths("", "2026-09-20");
  assert.ok(빈것.split("/").pop().length > 0, "누군지 몰라도 셀 자리는 있어야 합니다.");
});
