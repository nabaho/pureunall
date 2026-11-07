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

/* ═══ 2026-11-02 기업정보함 길(안전형) — basis:"cards" ═══ */
const KA = "가나상사";   // 지어낸 이름
const cardsOf = (rows) => M.buildIndex({ erpCompanies: { v: [] }, erpContracts: { v: [] }, cardsIdx: rows });
const bizRow = (name, addr, email, extra) => Object.assign({ k: "biz", c: name, ad: addr, e: email, ceo: "홍길동" }, extra || {});
const cardRow = (name, addr, emails) => ({ k: "card", c: name, ad: addr, em: emails, n: "김담당" });

test("⑪ 기업정보함(사업자등록증)에 이름 + 시·군·구가 같고 회사 메일이 있으면 대상이다 — 근거는 cards", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", KA, "서울 서초구 매헌로 16") },
    index: cardsOf({ k1: bizRow(KA, "서울 서초구 서초대로 1", "Info@Gana.co.kr") }) });
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].email, "info@gana.co.kr");
  assert.equal(p.candidates[0].basis, "cards");
});

test("⑫ 기업정보함에 이름만 같고 주소가 다르면 «후보» — 보내지 않는다(다른 회사일 수 있다)", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", KA, "서울 서초구 1") },
    index: cardsOf({ k1: bizRow(KA, "부산 해운대구 센텀로 1", "info@gana.co.kr") }) });
  assert.equal(p.candidates.length, 0);
  assert.ok(p.skipped.some((s) => s.id === "a" && /후보/.test(s.reason)));
});

test("⑬ 개인 웹메일(gmail·naver·daum …)은 뺀다 — 회사 메일과 섞여 있으면 회사 메일만, 개인뿐이면 보내지 않는다", () => {
  const mixed = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", KA, "서울 서초구 1") },
    index: cardsOf({ k1: cardRow(KA, "서울 서초구 1", ["boss@gmail.com", "kim@Gana.co.kr", "x@naver.com"]) }) });
  assert.equal(mixed.candidates.length, 1);
  assert.equal(mixed.candidates[0].email, "kim@gana.co.kr");
  const only = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", KA, "서울 서초구 1") },
    index: cardsOf({ k1: cardRow(KA, "서울 서초구 1", ["boss@gmail.com", "x@daum.net"]) }) });
  assert.equal(only.candidates.length, 0);
  assert.ok(only.skipped.some((s) => s.id === "a" && /개인 메일/.test(s.reason)));
});

test("⑭ 주소가 다른 항목의 메일은 쓰지 않는다 — 같은 이름의 두 항목 중 «주소가 맞는 쪽» 메일만", () => {
  const p = A.plan({ nowMs: NOW, settings: { enabled: true },
    notices: { a: notice("a", KA, "서울 서초구 1") },
    index: cardsOf({ k1: bizRow(KA, "서울 서초구 2", "right@gana.co.kr"), k2: bizRow(KA, "부산 해운대구 1", "wrong@other.co.kr") }) });
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].email, "right@gana.co.kr");
});

test("⑮ 거래중인 곳은 기업정보함에 있어도 근거가 trade 이고 거래처 메일을 쓴다", () => {
  const index = M.buildIndex({ erpCompanies: { v: [erp(KA, "서울 서초구 1", "erp@gana.co.kr")] }, erpContracts: { v: [] },
    cardsIdx: { k1: bizRow(KA, "서울 서초구 1", "card@gana.co.kr") } });
  const p = A.plan({ nowMs: NOW, settings: { enabled: true }, notices: { a: notice("a", KA, "서울 서초구 1") }, index });
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].basis, "trade");
  assert.equal(p.candidates[0].email, "erp@gana.co.kr");
});

test("⑯ 기업정보함 길에도 같은 거름이 적용된다 — 수신거부·이미 보냄·대표 제외, 홈페이지에서 읽은 메일은 안 씀", () => {
  const index = cardsOf({ k1: bizRow(KA, "서울 서초구 1", "info@gana.co.kr") });
  const base = { nowMs: NOW, settings: { enabled: true }, notices: { a: notice("a", KA, "서울 서초구 1") }, index };
  assert.equal(A.plan(Object.assign({}, base, { optout: { [A.emailKey("info@gana.co.kr")]: { at: 1 } } })).candidates.length, 0);
  assert.equal(A.plan(Object.assign({}, base, { sent: { a: { email: "info@gana.co.kr", at: NOW - 1000 } } })).candidates.length, 0);
  assert.equal(A.plan(Object.assign({}, base, { marks: { a: { status: "skip" } } })).candidates.length, 0);
  const noMail = A.plan({ nowMs: NOW, settings: { enabled: true }, notices: { a: notice("a", KA, "서울 서초구 1") },
    index: cardsOf({ k1: bizRow(KA, "서울 서초구 1", "") }), info: { a: { email: "scraped@site.kr" } } });
  assert.equal(noMail.candidates.length, 0);
});

/* ═══ 2026-11-07 보낸 기록 — 나간 순간의 날짜+시각을 그 공고의 발송 기록에 ═══ */
test("⑰ 대기열 줄 이름에서 공고번호를 꺼낸다 — rehab-<공고번호>-<시각>, 다른 모양은 빈 값", () => {
  assert.equal(A.noticeIdOfQueue("rehab-c000221_20262920001133-mh3k9a"), "c000221_20262920001133");
  assert.equal(A.noticeIdOfQueue("rehab-c000221_1-0"), "c000221_1");
  assert.equal(A.noticeIdOfQueue("news-123"), "");
  assert.equal(A.noticeIdOfQueue(""), "");
  assert.equal(A.noticeIdOfQueue(null), "");
});

test("⑱ 보낸 기록 한 줄 — 서울 날짜·시각, 방법 메일, 받는 주소, 기계가 적었다는 표시", () => {
  const e = A.sentEntry({ payload: { to: "a@gana.co.kr" } }, Date.parse("2026-11-07T18:05:30+09:00"));
  assert.equal(e.d, "2026-11-07");
  assert.equal(e.t, "18:05");
  assert.equal(e.m, "메일");
  assert.equal(e.auto, true);
  assert.match(e.n, /a@gana\.co\.kr/);
  /* UTC 로는 전날인 서울 새벽도 서울 날짜로 */
  const e2 = A.sentEntry({ payload: { to: "x@y.kr" } }, Date.parse("2026-11-07T00:09:00+09:00"));
  assert.equal(e2.d, "2026-11-07");
  assert.equal(e2.t, "00:09");
});

test("⑲ 표시 갱신 — 기록을 «쌓고» 발송 완료로 올리며, 사람이 적은 칸은 건드리지 않는다", () => {
  const prev = { id: "n1", status: "send", autoQueued: true, revision: 3, contact: { ceo: "홍길동" }, memo: "메모", sendLog: [{ d: "2026-11-01", m: "우편", n: "직접" }] };
  const e = A.sentEntry({ payload: { to: "a@gana.co.kr" } }, NOW);
  const u = A.markUpdate(prev, e, NOW, "n1", 5);
  assert.equal(u.status, "sent");
  assert.equal(u.sentAt, NOW);
  assert.equal(u.autoQueued, false);
  assert.equal(u.revision, 4);
  assert.equal(u.sendLog.length, 2);
  assert.equal(u.sendLog[0].m, "우편");      // 사람이 적은 옛 기록이 그대로
  assert.equal(u.sendLog[1].auto, true);
  assert.equal(u.contact, undefined);         // 쓸 칸만 돌려준다 — 연락처·메모는 안 건드림
  assert.equal(u.memo, undefined);
});

test("⑳ 이미 «발송 완료»면 완료 시각을 덮지 않고, 기록은 30건까지만 쌓는다", () => {
  const log = Array.from({ length: 35 }, (_, i) => ({ d: "2026-10-01", m: "우편", n: String(i) }));
  const u = A.markUpdate({ id: "n1", status: "sent", sentAt: 111, sendLog: log }, A.sentEntry({ payload: { to: "a@a.kr" } }, NOW), NOW, "n1", 5);
  assert.equal(u.sentAt, undefined);
  assert.equal(u.status, undefined);
  assert.equal(u.sendLog.length, 30);
  assert.equal(u.sendLog[29].auto, true);
});

test("㉑ 표시가 아직 없는 공고는 공용 관문이 요구하는 기본 칸을 함께 만든다", () => {
  const u = A.markUpdate(null, A.sentEntry({ payload: { to: "a@a.kr" } }, NOW), NOW, "c000221_9", 5);
  assert.equal(u.id, "c000221_9");
  assert.equal(u.entityType, "Task");
  assert.equal(u.taskKind, "rehabOutreach");
  assert.equal(u.sourceKind, "rehabNotice");
  assert.equal(u.sourceId, "c000221_9");
  assert.equal(u.contractVersion, 5);
  assert.equal(u.revision, 1);
  assert.equal(u.status, "sent");
});

test("㉒ 기록이 객체({0:…})로 저장돼 있어도 읽어 이어 붙인다", () => {
  const u = A.markUpdate({ id: "n1", sendLog: { 0: { d: "2026-10-01", m: "전화", n: "a" } } }, A.sentEntry({ payload: { to: "a@a.kr" } }, NOW), NOW, "n1", 5);
  assert.equal(u.sendLog.length, 2);
  assert.equal(u.sendLog[0].m, "전화");
});
