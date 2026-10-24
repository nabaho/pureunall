"use strict";

/* 방문 사업장 안내 문자 — 화면·서버가 «맞물려 있는가» (2026-10-15)
   값(문구·번호)이 아니라 규칙을 본다: 화면은 열쇠만 보낸다 · 진짜 번호는 DB·화면에 없다 ·
   서버 함수 이름·비밀값 목록이 화면 주소와 맞는다 · 새 색을 만들지 않는다. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const UI_SRC = read("js/pu-visit-sms.js");
const SRV_SRC = read("functions/visit-sms.js");
const IDX = read("functions/index.js");
const GOV = read("gov-consulting.html");
const UI = require("../js/pu-visit-sms.js");

/* 주석을 벗긴 본문 — 주석에 적힌 말이 검사를 헛통과시키지 않게 */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"\\])\/\/.*$/gm, "$1");

test("화면은 열쇠만 보낸다 — 번호·문구 필드를 본문에 싣지 않는다", () => {
  const body = strip(UI_SRC);
  const i = body.indexOf("JSON.stringify(");
  assert.ok(i > 0, "서버 요청 본문을 못 찾음");
  const call = body.slice(i, i + 160);
  assert.match(call, /keys/);
  assert.doesNotMatch(call, /\b(to|phone|text|tel|number)\s*:/i, "번호·문구를 화면이 보내고 있다");
});

test("서버 주소의 함수 이름이 실제 내보낸 함수와 같다", () => {
  const m = /cloudfunctions\.net\/(\w+)/.exec(UI.FN_URL);
  assert.ok(m, "함수 주소를 못 읽음");
  assert.ok(new RegExp("exports\\." + m[1] + "\\s*=").test(IDX), "화면이 부르는 함수가 index.js 에 없다: " + m[1]);
});

test("서버: 번호는 queue 에 가려서만 적고, 화면 입력으로 번호를 받지 않는다", () => {
  const body = strip(SRV_SRC);
  assert.match(body, /phoneMasked:\s*maskPhone\(/, "queue 줄이 번호를 가리지 않는다");
  assert.doesNotMatch(body, /phone:\s*row\.phone/, "진짜 번호를 queue 에 적고 있다");
  assert.doesNotMatch(body, /\bo\.(to|phone|text)\b/, "호출자가 준 번호·문구를 쓰고 있다");
});

test("서버: 원본 자리(scal_scheds·scal_cos·data/companies)에는 쓰지 않는다", () => {
  const body = strip(SRV_SRC);
  const writes = body.match(/db\.ref\([^)]*\)\.(set|update|remove|push|transaction)\(/g) || [];
  writes.forEach((w) => assert.doesNotMatch(w, /scal_scheds|scal_cos|data\/companies|scal_staff/, "원본에 쓰고 있다: " + w));
  assert.ok(writes.length > 0, "쓰기 호출을 못 찾음(검사가 헛돈다)");
});

test("새 최상위 DB 자리를 만들지 않는다 — scal_env 아래에만 쓴다", () => {
  const m = /const ROOT = "([^"]+)"/.exec(SRV_SRC);
  assert.ok(m, "ROOT 를 못 찾음");
  assert.match(m[1], /^scal_env\//);
  assert.equal(UI.ROOT, m[1], "화면과 서버의 저장 자리가 다르다");
});

test("index.js: 예약 함수는 서울 시각·승인 함수는 직원만, 비밀값 선언은 없다", () => {
  const i = IDX.indexOf("exports.visitSmsPrepare");
  assert.ok(i > 0);
  const j = IDX.indexOf("exports.visitSmsSend");
  assert.ok(j > i);
  assert.match(IDX.slice(i, j), /\.pubsub\.schedule\(/);
  assert.match(IDX.slice(i, j), /timeZone\("Asia\/Seoul"\)/);
  const send = IDX.slice(j);
  assert.match(send, /requireStaff\(req\)/, "직원 확인 없이 부를 수 있다");
  /* 폰 길(기본)은 비밀값이 필요 없다 — 선언하면 비밀값이 없을 때 배포가 «통째로» 멈춘다.
     솔라피로 바꿀 때만 다시 선언한다(index.js 머리말). */
  assert.doesNotMatch(IDX.slice(i), /secrets:\s*(VISIT_SMS_SECRETS|\[\s*"SOLAPI)/, "비밀값을 선언하면 폰 길만 쓸 때도 배포가 멈춘다");
});

test("컨설팅일정이 띠를 싣는다 — 캐시 번호가 붙고, 놓을 자리가 있다", () => {
  assert.match(GOV, /<script src="js\/pu-visit-sms\.js\?v=\d+"><\/script>/);
  assert.match(GOV, /id="visitSmsBar"/);
  assert.match(GOV, /PuVisitSms\.init\(/);
});

test("화면: 새 색을 만들지 않는다 — 색 글자(#…·rgb)가 없다", () => {
  const body = strip(UI_SRC);
  assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, "색 글자가 들어 있다");
  assert.doesNotMatch(body, /\brgba?\(/);
});

test("화면 로직: 관리자는 전부, 직원은 자기 일정만 본다", () => {
  const q = { a: { attId: "a1", status: "ready" }, b: { attId: "a3", status: "ready" } };
  assert.equal(UI.rowsFor(q, { id: "a1", isAdmin: false }).length, 1);
  assert.equal(UI.rowsFor(q, { id: "zz", isAdmin: false }).length, 0);
  assert.equal(UI.rowsFor(q, { id: "zz", isAdmin: true }).length, 2);
  assert.equal(UI.rowsFor(q, null).length, 0);
});

test("화면 로직: 보낼 수 있는 것은 대기·실패뿐 — 발송됨·번호 확인 필요는 못 누른다", () => {
  const rows = [{ status: "ready" }, { status: "failed" }, { status: "sent" }, { status: "skip" }, { status: "sending" }];
  assert.equal(UI.sendable(rows).length, 2);
  const c = UI.countBy(rows);
  assert.equal(c.sent, 1);
  assert.equal(c.skip, 1);
});

test("화면 줄: 한 줄이다(줄바꿈 없음) · 눌러 보낼 수 없는 줄은 체크박스가 막힌다 · 글자는 이스케이프", () => {
  const html = UI.rowHtml({ key: "k", coName: "<b>가</b>", contactName: "나", phoneMasked: "010-****-1234", status: "skip", why: "번호 없음" }, true);
  assert.doesNotMatch(html, /<br|<div/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /<b>가<\/b>/);
  const ok = UI.rowHtml({ key: "k", coName: "가", status: "ready" }, true);
  assert.match(ok, /checked/);
  assert.doesNotMatch(ok, /disabled/);
});
