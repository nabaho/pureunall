"use strict";
/* 홈페이지 방문 통계 — 순수 셈 (firebase-admin 없이 검사에서 바로 돌린다)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-11-18 「외부트래픽이나 홈페이지 방문자 등 검색자 숫자등을 확인할 수 있는 시스템 만들어줘 우선 목업」
   → 목업 → 2026-11-19 「추천대로」(자체 집계 · 개인정보처리방침 함께 고침).

   ★ «숫자만» 센다 — 날짜별로 방문·쪽 보기·상담 전화 누름, 어느 쪽(쪽 이름)·어디서(유입 갈래)·무엇으로(폰/PC).
     IP 주소·브라우저 정보·쿠키·사람마다의 기록은 남기지 않는다. 그래서 «누가» 왔는지는 이 자료로 알 수 없다.
   ★ 받는 값은 모두 «정해 둔 모양»만 — 쪽 이름은 영문 소문자·숫자·밑줄, 유입·기기·행동은 정해 둔 낱말만.
     모양이 틀리면 통째로 버린다(남이 아무 값이나 보내 자료를 부풀리지 못하게).
   ★ 하루 쪽 이름 갈래는 한도가 있다 — 넘으면 «other» 로 모은다(쓰레기 쪽 이름으로 자료가 끝없이 불지 않게).
   ★ 너무 잦은 요청은 버린다(숨돌리기) — IP 는 «함수 메모리에만» 잠깐 두고 적지 않는다.
   쓰는 곳: functions/index.js siteHit(받기) · 홈페이지 site/assets/js/pu-count.js(보내기) · pu-home.html openStats(보기). */

/* 우리 홈페이지만 받는다 — 미리보기·로컬·남의 사이트에서 온 것은 안 센다 */
const 받는출처 = Object.freeze(["https://pureunlabor.co.kr", "https://www.pureunlabor.co.kr"]);
/* 유입 갈래 — 홈페이지 pu-count.js 가 나눈 그대로. 여기 없는 값은 버린다 */
const 유입갈래 = Object.freeze(["naver", "naverx", "google", "daum", "bing", "kakao", "sns", "erp", "direct", "other", "self"]);
const 기기갈래 = Object.freeze(["m", "pc"]);
const 행동갈래 = Object.freeze(["view", "tel"]);
const 쪽꼴 = /^[a-z0-9_]{1,30}$/;
const 쪽한도 = 60;            // 하루에 따로 셀 쪽 이름 갈래 수 — 넘으면 other
const 본문한도 = 400;         // 받는 글자 수 — 우리 알림은 100자 남짓이다

/* 보낸 글 → 셀 것. 모양이 하나라도 틀리면 { ok:false } */
function 받기(body) {
  let b = body;
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") {
    if (b.length > 본문한도) return { ok: false, 까닭: "너무 김" };
    try { b = JSON.parse(b); } catch (e) { return { ok: false, 까닭: "모양 틀림" }; }
  }
  if (!b || typeof b !== "object" || Array.isArray(b)) return { ok: false, 까닭: "모양 틀림" };
  const 쪽 = String(b.p == null ? "" : b.p);
  const 곳 = String(b.r == null ? "" : b.r);
  const 기기 = String(b.d == null ? "" : b.d);
  const 행동 = String(b.e == null ? "view" : b.e);
  if (!쪽꼴.test(쪽)) return { ok: false, 까닭: "쪽 이름" };
  if (유입갈래.indexOf(곳) < 0) return { ok: false, 까닭: "유입" };
  if (기기갈래.indexOf(기기) < 0) return { ok: false, 까닭: "기기" };
  if (행동갈래.indexOf(행동) < 0) return { ok: false, 까닭: "행동" };
  /* 새 방문은 «쪽 보기»에서만, 그리고 우리 홈페이지 안에서 옮겨 다닌 것(self)은 새 방문이 아니다 */
  const 새방문 = 행동 === "view" && 곳 !== "self" && (b.v === 1 || b.v === true || b.v === "1");
  return { ok: true, 쪽: 쪽, 곳: 곳, 기기: 기기, 행동: 행동, 새방문: 새방문 };
}

/* 서울 날짜 「2026-11-19」 — 하루의 경계는 한국 시간 자정 */
function 서울날(ms) {
  const d = new Date(Number(ms) + 9 * 60 * 60 * 1000);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

function 수(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

/* 그날 칸(cur) + 한 번 → 새 칸. 거래(transaction) 안에서 부른다 — 받은 칸을 고치지 않고 새로 만든다.
   모양: { pv: 쪽 보기, v: 방문, tel: 전화 누름, p: {쪽: 보기}, r: {유입: 방문}, d: {기기: 방문} } */
function 셈더하기(cur, hit) {
  const c = (cur && typeof cur === "object") ? cur : {};
  const out = {
    pv: 수(c.pv), v: 수(c.v), tel: 수(c.tel),
    p: Object.assign({}, (c.p && typeof c.p === "object") ? c.p : {}),
    r: Object.assign({}, (c.r && typeof c.r === "object") ? c.r : {}),
    d: Object.assign({}, (c.d && typeof c.d === "object") ? c.d : {})
  };
  if (!hit || !hit.ok) return out;
  if (hit.행동 === "tel") { out.tel += 1; return out; }
  out.pv += 1;
  let 쪽 = hit.쪽;
  if (!(쪽 in out.p) && Object.keys(out.p).length >= 쪽한도) 쪽 = "other";
  out.p[쪽] = 수(out.p[쪽]) + 1;
  if (hit.새방문) {
    out.v += 1;
    out.r[hit.곳] = 수(out.r[hit.곳]) + 1;
    out.d[hit.기기] = 수(out.d[hit.기기]) + 1;
  }
  return out;
}

/* 사람이 아닌 것(검색 로봇·미리보기 긁개)은 안 센다 */
function 봇인가(ua) {
  return /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|kakaotalk-scrap|daumoa|yeti|bingpreview|python|curl|wget|java\//i
    .test(String(ua || ""));
}

/* 너무 잦은 요청 거르기 — 한 곳(IP)에서 10분에 120번까지, 함수 한 벌이 1분에 3,000번까지.
   ⚠ IP 는 이 메모리에만 잠깐 있다(적지 않는다). 함수가 다시 뜨면 다 잊는다. */
const 창 = 10 * 60 * 1000, 한곳한도 = 120, 전체한도 = 3000;
const 곳들 = new Map();
let 전체 = { 시작: 0, 수: 0 };
function 숨돌리기(ip, now) {
  const t = Number(now) || Date.now();
  if (t - 전체.시작 > 60 * 1000) 전체 = { 시작: t, 수: 0 };
  if (++전체.수 > 전체한도) return false;
  const 열쇠 = String(ip || "?").slice(0, 64);
  const 지금 = 곳들.get(열쇠);
  if (!지금 || t - 지금.시작 > 창) { 곳들.set(열쇠, { 시작: t, 수: 1 }); }
  else if (++지금.수 > 한곳한도) return false;
  if (곳들.size > 5000) {           // 오래된 것부터 비운다 — 메모리가 끝없이 늘지 않게
    for (const [k, v] of 곳들) { if (t - v.시작 > 창) 곳들.delete(k); }
    if (곳들.size > 5000) 곳들.clear();
  }
  return true;
}
function 숨돌리기비우기() { 곳들.clear(); 전체 = { 시작: 0, 수: 0 }; }

module.exports = { 받는출처, 유입갈래, 기기갈래, 행동갈래, 쪽한도, 받기, 서울날, 셈더하기, 봇인가, 숨돌리기, 숨돌리기비우기 };
