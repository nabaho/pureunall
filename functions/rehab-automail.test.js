/* 회생광고 자동 발송 계획 — 인터넷·메일 없이 «가짜 자료»로 규칙만 본다.
   지키는 것: ① 계약·거래중이고 이름+시·군·구가 같은 곳만 ② 메일은 «우리 이알피 자료»에서만(홈페이지에서 읽은 메일은 안 씀)
   ③ 수신거부·이미 보냄·최근 같은 주소 제외 ④ 하루 상한 ⑤ 기본값은 꺼짐 ⑥ 밤에는 다음 날 아침으로 ⑦ 광고 표기
   실행: node --test functions/rehab-automail.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("./rehab-automail");
const M = require("./rehab-match");
const fs = require("fs");
const path = require("path");

const GA = "주식회사 가나";
const NOW = Date.parse("2026-10-12T10:00:00+09:00");   // 월요일 오전 10시(서울)
const notice = (id, name, addr, date) => ({ id: id, debtorName: name, address: addr, noticeDate: date || "2026-10-10" });
const erp = (name, addr, email, extra) => Object.assign({ id: "e-" + name, name: name, address: addr, email: email, status: "active" }, extra || {});
const idx = (companies, contracts) => M.buildIndex({ erpCompanies: { v: companies }, erpContracts: { v: contracts || [] }, cardsIdx: {} });

test("① 계약·거래중 + 이름·시군구 같음 + 우리 자료 메일이 있으면 대상이 된다", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", "주식회사 가나", "서울 서초구 매헌로 16") },
    index: idx([erp(GA, "서울 서초구 서초대로 1", "Boss@Ganada.co.kr")]) });
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].email, "boss@ganada.co.kr");
});

test("② 이름만 같은 «후보»·거래 종료·우리 자료에 없는 곳은 대상이 아니다", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", "주식회사 가나", "부산 해운대구 1"), b: notice("b", "주식회사 다라", "서울 서초구 1"), c: notice("c", "주식회사 마바", "서울 서초구 1") },
    index: idx([erp(GA, "서울 서초구 1", "a@a.kr"), erp("주식회사 다라", "서울 서초구 1", "b@b.kr", { status: "closed" })]) });
  assert.equal(p.candidates.length, 0);
  assert.ok(p.skipped.some((s) => s.id === "a" && /후보/.test(s.reason)));
  assert.ok(p.skipped.some((s) => s.id === "b"));
});

test("③ 거래처 메일이 없으면 보내지 않는다 — 홈페이지에서 읽은 메일은 쓰지 않는다", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", "주식회사 가나", "서울 서초구 1") },
    index: idx([erp(GA, "서울 서초구 1", "")]),
    info: { a: { email: "scraped@site.kr" } } });
  assert.equal(p.candidates.length, 0);
  assert.match(p.skipped[0].reason, /거래처 메일이 없음/);
});

test("④ 수신거부·이미 보냄·최근 같은 주소·대표 제외는 건너뛴다", () => {
  const base = { nowMs: NOW, settings: { enabled: true }, index: idx([erp(GA, "서울 서초구 1", "a@a.kr")]) };
  const n = { a: notice("a", "주식회사 가나", "서울 서초구 1") };
  assert.equal(A.plan(Object.assign({ notices: n, optout: { [A.emailKey("a@a.kr")]: 1 } }, base)).candidates.length, 0);
  assert.equal(A.plan(Object.assign({ notices: n, sent: { a: { email: "a@a.kr", at: NOW - 1000 } } }, base)).candidates.length, 0);
  assert.equal(A.plan(Object.assign({ notices: n, sent: { zz: { email: "a@a.kr", at: NOW - 5 * 864e5 } } }, base)).candidates.length, 0, "같은 주소 30일 안");
  assert.equal(A.plan(Object.assign({ notices: n, sent: { zz: { email: "a@a.kr", at: NOW - 40 * 864e5 } } }, base)).candidates.length, 1, "30일 지나면 가능");
  assert.equal(A.plan(Object.assign({ notices: n, marks: { a: { status: "skip" } } }, base)).candidates.length, 0);
});

test("⑤ 하루 상한 — 오늘 보낸 수를 뺀 만큼만 건다", () => {
  const names = ["가", "나", "다", "라", "마", "바", "사"].map((x) => "주식회사 " + x + x);
  const notices = {}, comps = [];
  names.forEach((nm, i) => { notices["n" + i] = notice("n" + i, nm, "서울 서초구 1"); comps.push(erp(nm, "서울 서초구 1", "m" + i + "@x.kr")); });
  const p = A.plan({ nowMs: NOW, settings: { enabled: true, dailyCap: 3 }, notices, index: idx(comps), sent: { old: { email: "o@o.kr", at: NOW - 3600e3 } } });
  assert.equal(p.candidates.length, 7);
  assert.equal(p.room, 2);
  assert.equal(p.toSend.length, 2);
});

test("⑥ 기본값은 꺼짐이고, 상한은 1~30 안으로 고른다", () => {
  assert.equal(A.cleanSettings(undefined).enabled, false);
  assert.equal(A.cleanSettings({ enabled: "true" }).enabled, false, "문자열 true 는 켜짐이 아니다");
  assert.equal(A.cleanSettings({ enabled: true, dailyCap: 999 }).dailyCap, 5);
  assert.equal(A.cleanSettings({ enabled: true, dailyCap: 12 }).dailyCap, 12);
});

test("⑦ 때 — 낮에는 지금, 밤·새벽에는 다음 오전 8시 30분(서울)", () => {
  assert.equal(A.nextSendAt(NOW), NOW);
  const night = Date.parse("2026-10-12T22:10:00+09:00");
  assert.equal(A.nextSendAt(night), Date.parse("2026-10-13T08:30:00+09:00"));
  const dawn = Date.parse("2026-10-12T03:00:00+09:00");
  assert.equal(A.nextSendAt(dawn), Date.parse("2026-10-12T08:30:00+09:00"));
});

test("⑧ 대기열 한 줄 — 제목 (광고), 본문 수신거부, 예약 발송기가 읽는 모양", () => {
  const row = A.queueRow({ id: "a", name: "주식회사 가나", email: "a@a.kr", toName: "주식회사 가나", ceo: "홍길동" }, NOW, NOW);
  assert.equal(row.state, "waiting");
  assert.equal(row.by, "rehab-auto");
  assert.match(row.payload.subject, /^\(광고\)/);
  assert.match(row.payload.body, /수신거부/);
  assert.equal(row.payload.to, "a@a.kr");
  assert.deepEqual(row.payload.files, []);
});

test("⑨ functions 의 사본이 js 원본과 같다(두 곳에서 따로 고치지 않게)", () => {
  ["rehab-match.js", "rehab-letter.js"].forEach((f) => {
    const a = fs.readFileSync(path.join(__dirname, f), "utf8");
    const b = fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
    assert.equal(a, b, f + " 사본이 원본과 다르다 — js/" + f + " 를 functions/ 로 복사하세요");
  });
});

test("⑩ 파산 공고(kind: bankruptcy)도 회생과 같이 대상이 되고, 파산용 (광고) 메일이 나간다", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: Object.assign(notice("a", GA, "서울 서초구 1"), { kind: "bankruptcy" }) },
    index: idx([erp(GA, "서울 서초구 1", "a@a.kr")]) });
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].kind, "bankruptcy");
  const row = A.queueRow(p.candidates[0], NOW, NOW);
  assert.match(row.payload.subject, /^\(광고\) \[푸른노무법인\] 파산절차 중/);
  assert.ok(!/재기컨설팅|12만원/.test(row.payload.body));
});
