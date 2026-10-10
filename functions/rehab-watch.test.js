/* 회생광고 수집 모듈 — 법원에 실제로 묻지 않고 «가짜 응답»으로 규칙을 본다.
   지키는 것: ① 포괄적 금지명령만 담는다 ② 기간 밖은 버린다 ③ 이미 있는 사건은 상세를 다시 안 부른다
   ④ 대표자·주민번호 같은 칸은 레코드에 들어가지 않는다 ⑤ 법원 하나가 실패해도 나머지는 돈다
   실행: node --test functions/rehab-watch.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("./rehab-watch");

function row(over) {
  return Object.assign({ cortCd: "000221", csNo: "20260130005163", jdbnCd: "5012", btprtNm: " 주식회사 가나 ",
    pbancBgngYmd: "20261008", inetPbancDvsCd: "45", inetPbancSeq: 4, jdbnCdNm: "제12부",
    csNoNm: "2026간회합 5163", pbancTitlNm: "포괄적 금지명령 공고" }, over || {});
}
const DETAIL = { data: { rtnMap: {
  csBasInf: { csNm: "간이회생" },
  btprtDebtrInf: { btprtNm: "주 식 회 사 가 나", btprtDlvrZpcd: "06771", btprtDlvrAddr: "서울 서초구 매헌로 16, 1312호",
    btprtEnrrno: "110111-1234567", rprsntNm: "홍길동" },
} } };

function fakePost(lists, calls) {
  return async (url, body) => {
    calls.push(url);
    if (url === W.VIEW) return DETAIL;
    const c = body.dma_search.cortCd, p = body.dma_pageInfo.pageNo;
    if (lists[c] instanceof Error) throw lists[c];
    return { data: { dlt_pbancLst: (lists[c] || [])[p - 1] || [] } };
  };
}

test("① 포괄적 금지명령 공고만 담고, 다른 공고는 버린다", async () => {
  const calls = [];
  const lists = { "000221": [[row(), row({ csNo: "20260130005164", pbancTitlNm: "관계인집회기일 변경공고" })]] };
  const r = await W.run({ post: fakePost(lists, calls), sinceYmd: "2026-10-01", courts: ["000221"], nowMs: 1 });
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].debtorName, "주식회사 가나");
  assert.equal(r.added[0].caseType, "간이회생");
  assert.equal(r.added[0].zip, "06771");
  assert.equal(r.added[0].noticeDate, "2026-10-08");
  assert.ok(r.added[0].id && /^c\d+_\d+$/.test(r.added[0].id), "영구 ID 는 법원코드+사건번호");
});

test("② 기간 밖 공고는 담지 않고, 기간을 벗어나면 다음 쪽을 부르지 않는다", async () => {
  const calls = [];
  const full = Array.from({ length: 100 }, (_, i) => row({ csNo: String(1000 + i), pbancBgngYmd: i < 50 ? "20261008" : "20260901" }));
  const lists = { "000221": [full, [row({ csNo: "999" })]] };
  const r = await W.run({ post: fakePost(lists, calls), sinceYmd: "2026-10-01", courts: ["000221"], nowMs: 1 });
  assert.equal(r.added.length, 50);
  assert.equal(calls.filter((u) => u === W.LIST).length, 1, "둘째 쪽을 부르면 안 된다");
});

test("③ 이미 담긴 사건은 상세를 다시 부르지 않는다", async () => {
  const calls = [];
  const key = W.noticeKey(row());
  const r = await W.run({ post: fakePost({ "000221": [[row()]] }, calls), existing: { [key]: { id: key } },
    sinceYmd: "2026-10-01", courts: ["000221"], nowMs: 1 });
  assert.equal(r.added.length, 0);
  assert.equal(r.found, 1);
  assert.equal(calls.filter((u) => u === W.VIEW).length, 0);
});

test("④ 대표자·주민번호 같은 칸은 레코드에 들어가지 않는다", async () => {
  const r = await W.run({ post: fakePost({ "000221": [[row()]] }, []), sinceYmd: "2026-10-01", courts: ["000221"], nowMs: 1 });
  const s = JSON.stringify(r.added[0]);
  assert.ok(!/110111|홍길동|Enrrno|rprsnt/.test(s), "개인정보 칸이 새어 들어왔다: " + s);
  assert.ok(!Object.prototype.hasOwnProperty.call(r.added[0], "companyName"), "업체명을 관계 열쇠 칸에 두지 않는다");
});

test("⑤ 법원 하나가 실패해도 다른 법원은 계속 돈다", async () => {
  const lists = { "000221": new Error("HTTP 500"), "000249": [[row({ cortCd: "000249" })]] };
  const r = await W.run({ post: fakePost(lists, []), sinceYmd: "2026-10-01", courts: ["000221", "000249"], nowMs: 1 });
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].court, "000221");
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].courtName, "수원회생법원");
});

test("⑥ 저장 묶음은 새 공고와 회차 기록을 한 번에 담는다", () => {
  const upd = W.updatesOf({ checked: 3, found: 1, added: [{ id: "c1_2" }], errors: [] }, "2026-10-10", "t");
  assert.ok(upd["notices/c1_2"]);
  assert.equal(upd["runs/2026-10-10"].added, 1);
});
