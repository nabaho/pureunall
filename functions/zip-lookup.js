/* 📮 주소 → 우편번호 (대표 지시 2026-10-17 「우편번호찾기 기능있는데 자동으로 니가 찾아서 항상 입력해라」)
   ─────────────────────────────────────────────────────────────────────────
   다음 우편번호 «위젯»은 결과를 코드로 못 읽는다 — 그래서 여태 사람이 한 번은 눌러야 했다.
   카카오 주소검색(REST)은 서버에 이미 있는 KAKAO_REST_KEY(카카오 로그인용) 하나로 된다
   (2026-10-17 실측: 「충남 서산시 대산읍 평신1로 595-8」 → 31900, 한 건).

   ⚠★ «한 곳으로 딱 떨어질 때만» 돌려준다. 찾은 곳들의 우편번호가 갈리면 빈 값이다 —
     틀린 우편번호를 넣느니 안 넣는다(화면의 🔍 우편번호 찾기 단추가 그대로 남는다).
   ⚠ 적어 둔 «도로명+번호»(key)가 오면 그것과 같은 곳만 본다 — 사진 판독이 틀린 구 이름
     때문에 다른 동네가 걸려도 버린다(js/pu-addr.js 머리말과 같은 까닭).
   ⚠ 카카오에는 주소 글자만 보낸다. 열쇠는 요청 머리글에만 — 오류 글에 싣지 않는다.
   ⚠ 아무것도 저장하지 않는다 — 넣는 것은 화면이고, 남기는 것은 사람의 «저장»이다. */

/* 카카오 도로명 주소 → 「평신1로 595-8」 (js/pu-addr.js 의 key() 와 같은 꼴) */
function roadKeyOf(ra) {
  if (!ra || !ra.road_name || !ra.main_building_no) return "";
  const sub = String(ra.sub_building_no || "");
  return ra.road_name + " " + ra.main_building_no + (sub && sub !== "0" ? "-" + sub : "");
}

/* 찾은 곳들 → { zip, road, n, why }. zip 이 빈 글자면 «넣지 말라»는 뜻이다. */
function pickZip(docs, key) {
  const withZip = (docs || []).filter((d) => d && d.road_address && /^\d{5}$/.test(String(d.road_address.zone_no || "")));
  let pool = withZip;
  if (key) {
    pool = withZip.filter((d) => roadKeyOf(d.road_address) === key);
    if (!pool.length) return { zip: "", road: "", n: withZip.length, why: withZip.length ? "도로명·번호가 다른 곳만 찾음" : "못 찾음" };
  }
  const zips = Array.from(new Set(pool.map((d) => String(d.road_address.zone_no))));
  if (zips.length !== 1) return { zip: "", road: "", n: pool.length, why: pool.length ? "우편번호가 여럿" : "못 찾음" };
  return { zip: zips[0], road: String(pool[0].road_address.address_name || ""), n: pool.length, why: "" };
}

/* 찾을 말 q 로 먼저, 하나도 없으면 alt(다듬은 주소 통째)로 한 번 더. get(말) → 찾은 곳들 */
async function lookupZip({ q, key, alt, get }) {
  const first = pickZip(await get(q), key);
  if (first.zip || first.n || !alt || alt === q) return first;
  return pickZip(await get(alt), key);
}

/* 받은 글자 다듬기 — 사람이 주는 값이 아니어도(화면이 만든다) 길이는 막는다 */
function cleanInput(body) {
  const s = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 120);
  return { q: s(body && body.q), key: s(body && body.key), alt: s(body && body.alt) };
}

function kakaoGetter(restKey, fetchFn = fetch, timeoutMs = 8000) {
  return async function get(query) {
    const r = await fetchFn("https://dapi.kakao.com/v2/local/search/address.json?" + new URLSearchParams({ query, size: "10" }).toString(),
      { headers: { Authorization: "KakaoAK " + restKey }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) { const e = new Error("카카오 주소검색 " + r.status); e.status = r.status; throw e; }
    const j = await r.json();
    return (j && j.documents) || [];
  };
}

module.exports = { roadKeyOf, pickZip, lookupZip, cleanInput, kakaoGetter };
