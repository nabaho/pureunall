"use strict";
/* 📮 주소 → 우편번호 — «한 곳으로 딱 떨어질 때만» 넣는다 (대표 지시 2026-10-17)
   ★ 이 검사가 못 박는 것은 규칙이다: 우편번호가 갈리면 비운다 · 적어 둔 도로명·번호와
     다른 곳은 버린다 · 카카오에는 주소 글자만 간다. 우편번호 숫자 자체는 시험용 가짜다. */

const test = require("node:test");
const assert = require("node:assert/strict");
const Z = require("./zip-lookup");

/* 카카오 address.json 의 documents 한 줄 꼴 */
function doc(road, main, sub, zip, name) {
  return { address_name: name || "", road_address: { road_name: road, main_building_no: main, sub_building_no: sub, zone_no: zip,
    address_name: (name || "") + " " + road + " " + main + (sub ? "-" + sub : "") } };
}

test("도로명+번호 열쇠는 pu-addr.js 의 key() 와 같은 꼴 — 부번 0·빈칸은 안 붙인다", () => {
  assert.equal(Z.roadKeyOf({ road_name: "평신1로", main_building_no: "595", sub_building_no: "8" }), "평신1로 595-8");
  assert.equal(Z.roadKeyOf({ road_name: "중앙로", main_building_no: "10", sub_building_no: "" }), "중앙로 10");
  assert.equal(Z.roadKeyOf({ road_name: "중앙로", main_building_no: "10", sub_building_no: "0" }), "중앙로 10");
  assert.equal(Z.roadKeyOf(null), "");
});

test("★ 한 곳만 걸리면 그 우편번호를 준다", () => {
  const r = Z.pickZip([doc("평신1로", "595", "8", "11111")], "평신1로 595-8");
  assert.equal(r.zip, "11111");
});

test("★ 여러 곳이어도 우편번호가 하나로 같으면 준다", () => {
  const r = Z.pickZip([doc("가나로", "1", "", "22222", "갑"), doc("가나로", "1", "", "22222", "을")], "");
  assert.equal(r.zip, "22222");
});

test("★★ 우편번호가 갈리면 비운다 — 틀린 것을 넣느니 안 넣는다", () => {
  const r = Z.pickZip([doc("중앙로", "10", "", "33333", "갑시"), doc("중앙로", "10", "", "44444", "을시")], "");
  assert.equal(r.zip, "");
  assert.equal(r.n, 2);
});

test("★★ 적어 둔 도로명·번호와 다른 곳만 걸리면 비운다 (틀린 구 이름에 끌려간 다른 동네)", () => {
  const r = Z.pickZip([doc("다른길", "27", "", "55555")], "가나1길 27");
  assert.equal(r.zip, "");
});

test("★ 섞여 걸리면 적어 둔 도로명·번호와 같은 곳만 본다", () => {
  const r = Z.pickZip([doc("다른길", "27", "", "55555"), doc("가나1길", "27", "", "66666")], "가나1길 27");
  assert.equal(r.zip, "66666");
});

test("우편번호 칸이 없거나 다섯 자리가 아닌 결과는 안 쓴다", () => {
  assert.equal(Z.pickZip([{ address_name: "지번만", road_address: null }], "").zip, "");
  assert.equal(Z.pickZip([doc("가나로", "1", "", "123")], "").zip, "");
  assert.equal(Z.pickZip([], "").zip, "");
});

test("★ 찾을 말로 하나도 없을 때만 다듬은 통째로 한 번 더 묻는다", async () => {
  const asked = [];
  const get = async (q) => { asked.push(q); return q === "통째" ? [doc("가나로", "1", "", "77777")] : []; };
  const r = await Z.lookupZip({ q: "짧은말", key: "", alt: "통째", get });
  assert.equal(r.zip, "77777");
  assert.deepEqual(asked, ["짧은말", "통째"]);

  /* 첫 물음에서 «갈려서» 비었으면 다시 묻지 않는다 — 통째로 물으면 더 넓게 걸릴 뿐이다 */
  const asked2 = [];
  const get2 = async (q) => { asked2.push(q); return [doc("중앙로", "10", "", "33333"), doc("중앙로", "10", "", "44444")]; };
  const r2 = await Z.lookupZip({ q: "짧은말", key: "", alt: "통째", get: get2 });
  assert.equal(r2.zip, "");
  assert.deepEqual(asked2, ["짧은말"]);
});

test("받은 글자는 길이를 자른다 — 카카오에 긴 글을 그대로 넘기지 않는다", () => {
  const c = Z.cleanInput({ q: "가".repeat(500), key: " 가나로  1 ", alt: null });
  assert.ok(c.q.length <= 120);
  assert.equal(c.key, "가나로 1");
  assert.equal(c.alt, "");
});

test("★ 카카오에는 주소 글자만 가고, 열쇠는 머리글에만 실린다", async () => {
  let seenUrl = "", seenHeaders = null;
  const fakeFetch = async (url, opt) => { seenUrl = url; seenHeaders = opt.headers; return { ok: true, json: async () => ({ documents: [] }) }; };
  await Z.kakaoGetter("시험열쇠", fakeFetch)("충남 서산시 평신1로 595-8");
  const u = new URL(seenUrl);
  assert.equal(u.hostname, "dapi.kakao.com");
  assert.deepEqual(Array.from(u.searchParams.keys()).sort(), ["query", "size"]);
  assert.ok(seenUrl.indexOf("시험열쇠") < 0, "열쇠가 주소줄에 실렸다");
  assert.equal(seenHeaders.Authorization, "KakaoAK 시험열쇠");
});

test("카카오가 거절하면 오류에 상태만 싣는다 — 열쇠는 안 싣는다", async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(Z.kakaoGetter("시험열쇠", fakeFetch)("가나로 1"), (e) => e.status === 403 && String(e.message).indexOf("시험열쇠") < 0);
});
