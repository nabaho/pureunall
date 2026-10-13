/* 회생광고 — 금융위 기업기본정보로 대표자·연락처 채우기.
   지키는 것: ① 이름 + 시·군·구가 모두 맞는 «하나»만 같은 회사 ② 이름만 같으면 쓰지 않는다(다른 지역 동명 회사)
   ③ 같은 이름·같은 지역이 여럿이면 채우지 않는다 ④ 못 찾음은 14일 뒤 다시, 호출 실패는 저장하지 않는다
   실행: node --test functions/rehab-fsc.test.js  (예시는 모두 지어낸 이름이다) */
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./rehab-fsc");
const CO = "주식회사 가나";   // 지어낸 이름

const notice = (name, address, extra) => Object.assign({ id: "c000221_1", debtorName: name, address: address || "서울 서초구 매헌로 16, 1312호", noticeDate: "2026-10-08" }, extra || {});
const row = (name, addr, extra) => Object.assign({ corpNm: name, enpBsadr: addr, enpRprFnm: "홍길동", enpTlno: "02-123-4567", enpFxno: "02-123-4568", enpHmpgUrl: "www.gana.co.kr", bzno: "1234567890", crno: "1101110000001" }, extra || {});

test("① 이름이 같고 시·군·구도 같은 하나는 «found» — 대표자·전화·팩스·홈페이지·사업자번호를 가져온다", () => {
  const r = F.pick(notice(CO), [row(CO, "서울특별시 서초구 양재동 1")]);
  assert.equal(r.status, "found");
  assert.equal(r.f.ceo, "홍길동");
  assert.equal(r.f.phone, "02-123-4567");
  assert.equal(r.f.fax, "02-123-4568");
  assert.equal(r.f.homepage, "http://www.gana.co.kr");
  assert.equal(r.f.bizNo, "1234567890");
});

test("② 이름만 같고 지역이 다르면 «none» — 다른 회사의 대표자를 붙이지 않는다", () => {
  const r = F.pick(notice(CO, "경기 고양시 일산동구 위시티1로 6"), [row(CO, "경상남도 창원시 팔용동 23-6")]);
  assert.equal(r.status, "none");
  assert.match(r.why, /지역이 다름/);
  assert.equal(r.f, undefined);
});

test("③ (주)·주식회사·띄어쓰기가 달라도 같은 이름으로 본다", () => {
  const r = F.pick(notice("주식회사 가 나"), [row("(주)가나", "서울 서초구 방배동 1")]);
  assert.equal(r.status, "found");
});

test("④ 이름이 다른 줄만 오면 «none» — 부분 일치로 채우지 않는다", () => {
  const r = F.pick(notice(CO), [row(CO + "다", "서울 서초구 방배동 1")]);
  assert.equal(r.status, "none");
});

test("⑤ 같은 이름·같은 지역이 사업자번호가 다른 둘이면 «none» — 모호하면 채우지 않는다", () => {
  const r = F.pick(notice(CO), [row(CO, "서울 서초구 A동", { bzno: "1111111111" }), row(CO, "서울 서초구 B동", { bzno: "2222222222" })]);
  assert.equal(r.status, "none");
  assert.match(r.why, /둘 이상/);
});

test("⑥ 같은 사업자번호가 두 줄로 와도(중복 행) «found» 하나다", () => {
  const r = F.pick(notice(CO), [row(CO, "서울 서초구 A동"), row(CO, "서울 서초구 A동")]);
  assert.equal(r.status, "found");
});

test("⑦ 빈 값·이상한 값은 버린다 — 전화 「-」, 홈페이지 「없음」, 사업자번호 9자리", () => {
  assert.equal(F.phoneOf("-"), "");
  assert.equal(F.phoneOf("02-12"), "");
  assert.equal(F.homeOf("없음"), "");
  assert.equal(F.homeOf("a b.com"), "");
  assert.equal(F.homeOf("https://x.co.kr"), "https://x.co.kr");
  const r = F.pick(notice(CO), [row(CO, "서울 서초구 A", { enpTlno: "-", enpHmpgUrl: "", bzno: "123456789" })]);
  assert.equal(r.f.phone, "");
  assert.equal(r.f.homepage, "");
  assert.equal(r.f.bizNo, "");
});

test("⑧ 결과가 없으면 «자료 없음» none", () => {
  assert.equal(F.pick(notice(CO), []).why, "자료 없음");
});

test("⑨ plan — 안 본 곳과 «못 찾은 지 14일 지난 곳»만, 최신 공고부터, 상한까지", () => {
  const now = Date.UTC(2026, 9, 12);
  const N = {
    a: notice("가", "서울 A", { id: "a", noticeDate: "2026-10-01" }),
    b: notice("나", "서울 A", { id: "b", noticeDate: "2026-10-08" }),
    c: notice("다", "서울 A", { id: "c", noticeDate: "2026-10-05" }),
    d: notice("라", "서울 A", { id: "d", noticeDate: "2026-10-07" }),
    e: notice("마", "서울 A", { id: "e", noticeDate: "2026-10-06", _deleted: true }),
  };
  const fsc = { a: { status: "found", at: now }, c: { status: "none", at: now - 20 * 864e5 }, d: { status: "none", at: now - 2 * 864e5 } };
  assert.deepEqual(F.plan(N, fsc, now, 60).map((n) => n.id), ["b", "c"]);
  assert.deepEqual(F.plan(N, fsc, now, 1).map((n) => n.id), ["b"]);
});

test("⑩ lookup — 정상 응답은 판정하고, HTTP·결과코드 오류는 throw(저장하지 않게)", async () => {
  const ok = (body, st) => async () => ({ ok: st !== 500, status: st || 200, json: async () => body });
  const body = { response: { header: { resultCode: "00" }, body: { items: { item: [row(CO, "서울 서초구 A")] } } } };
  assert.equal((await F.lookup({ notice: notice(CO), key: "K", fetchFn: ok(body) })).status, "found");
  await assert.rejects(() => F.lookup({ notice: notice(CO), key: "K", fetchFn: ok({}, 500) }), /금융위 답 500/);
  await assert.rejects(() => F.lookup({ notice: notice(CO), key: "K", fetchFn: ok({ response: { header: { resultCode: "30" } } }) }), /금융위 오류 30/);
  /* 항목이 하나뿐일 때 배열이 아니라 객체로 오는 모양도 읽는다 */
  const one = { response: { header: { resultCode: "00" }, body: { items: { item: row(CO, "서울 서초구 A") } } } };
  assert.equal((await F.lookup({ notice: notice(CO), key: "K", fetchFn: ok(one) })).status, "found");
});

test("⑪ lookup 이 부르는 주소에 열쇠는 들어가고, 저장 줄에는 열쇠가 없다", async () => {
  let asked = "";
  const fetchFn = async (u) => { asked = u; return { ok: true, status: 200, json: async () => ({ response: { header: { resultCode: "00" }, body: { items: { item: [] } } } }) }; };
  const res = await F.lookup({ notice: notice(CO), key: "SECRETKEY", fetchFn });
  assert.ok(asked.includes("serviceKey=SECRETKEY") && asked.includes(encodeURIComponent("주식회사 가나")));
  assert.ok(!JSON.stringify(F.record(notice(CO), res, 1)).includes("SECRETKEY"));
});

test("⑫ record — 찾음은 칸을, 못 찾음은 까닭을 담고 출처를 적는다", () => {
  const f = F.record(notice(CO), { status: "found", f: { ceo: "홍길동", phone: "", fax: "", homepage: "", bizNo: "", name: "", address: "" } }, 5);
  assert.equal(f.src, "금융위 기업기본정보");
  assert.equal(f.ceo, "홍길동");
  assert.equal(f.docKind, "rehabFsc");
  const n = F.record(notice(CO), { status: "none", why: "자료 없음" }, 5);
  assert.equal(n.status, "none");
  assert.equal(n.why, "자료 없음");
  assert.equal(n.ceo, undefined);
});
