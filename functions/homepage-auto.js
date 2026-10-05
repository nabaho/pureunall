"use strict";
/* 홈페이지 월간 자동 연결 — «무엇을 내릴지» 고르는 순수 로직
   ═══════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-05 「입퇴사 자동으로 니가 정리하고 … 계약종료시 로고 삭제하고
   완전자동으로」 → 「1개월에 1번씩만 자동화 하면된다」.
   설계: docs/superpowers/specs/2026-10-05-홈페이지-월간-자동연결-design.md

   ★ 고르는 규칙은 여기 «한 곳»에만 둔다. 매달 도는 서버, 「지금 한 번 돌리기」,
     화면의 「미리 보기」가 모두 이 파일을 쓴다 — 규칙이 두 벌이 되면 하나는 검사가 안 지킨다.
   ★ 이름으로 잇지 않는다(온톨로지 규칙). sid / companyId 로 «사람이 확인해 이어 둔»
     글만 고른다. 이름이 한 사람과만 맞아도 기계가 혼자 잇지 않는다 — 동명이인·오타면
     남의 글이 내려간다.
   ⚠ 휴직(leave)은 퇴사가 아니다. retired 만 내린다(대표 확인 2026-10-04).
   ⚠ 지우지 않는다. 내리는 것은 언제나 휴지통이다(homepage-write.내리는type). */

/* 한 번에 이보다 많이 내려야 하면 «하나도» 내리지 않고 사람에게 묻는다.
   2026-09-29 업체 190건이 «사라진 것처럼» 보인 일이 있었다 — 그런 날 그대로 믿으면
   로고가 한꺼번에 내려가 홈페이지가 빈다. 한 달 치가 모이면 4건쯤은 정상이라 5다
   (대표 결정 2026-10-05 「추천대로」). */
const 멈춤문턱 = 5;
const 게시판 = { 구성원: "people_board", 자문사: "partner_board" };

/* RTDB 날값을 배열로 — {u, v:[…]} 꼴·객체 꼴·배열 꼴을 모두 받는다 */
function 목록으로(raw) {
  let l = (raw && raw.v !== undefined) ? raw.v : raw;
  if (l && !Array.isArray(l) && typeof l === "object") l = Object.keys(l).map((k) => l[k]);
  return Array.isArray(l) ? l.filter((x) => x && typeof x === "object") : null;
}
function 번호(n) { const x = Number(n); return Number.isInteger(x) && x > 0 ? x : 0; }
/* 사유가 있는 남기기만 남기기다 — js/pu-home-diff.js keepOnSiteReason 과 같은 잣대.
   사유 없는 예외는 나중에 왜 남겼는지 알 수 없다. */
function 남기기있나(k) { return !!(k && typeof k === "object" && String(k.why || "").trim()); }
/* 내릴 목록의 지문 — 「모두 내려도 됩니다」를 누른 «그 목록»만 내리게 한다 */
function 지문(목록) {
  return (목록 || []).map((x) => x.게시판 + ":" + x.srl).sort().join(",");
}
function 빈결과(실패) {
  return { ok: false, 실패: 실패, 내릴것: [], 보낼것: [], 연결확인: [], 멈춤: "", 지문: "" };
}
/* 같은 글 번호를 몇 곳이 쓰나 — 둘 이상이면 그 번호의 글은 «남의 글»일 수 있다 */
function 번호셈(묶음, 칸) {
  const 셈 = {};
  Object.keys(묶음).forEach((k) => {
    const s = 번호((묶음[k] || {})[칸]);
    if (s) 셈[s] = (셈[s] || 0) + 1;
  });
  return 셈;
}

function 고르기(자료) {
  const d = 자료 || {};
  const 명부 = 목록으로(d.roster);
  const 업체 = 목록으로(d.companies);
  /* ⚠ 비어 있는 것도 «못 읽은 것»으로 본다 — 자료가 한꺼번에 비어 보이는 날
       모두 퇴사·종료로 읽혀 홈페이지를 통째로 비우게 된다. */
  if (!명부 || !명부.length) return 빈결과("푸른ERP 직원 명부를 읽지 못했습니다");
  if (!업체 || !업체.length) return 빈결과("푸른ERP 업체관리를 읽지 못했습니다");

  const 사람 = {};
  명부.forEach((p) => { if (p.sid) 사람[String(p.sid)] = p; });
  const 회사 = {};
  업체.forEach((c) => { if (c.id && !c._deleted) 회사[String(c.id)] = c; });

  const 내릴것 = [], 연결확인 = [];

  /* ── 구성원 소개 글 ↔ 직원(sid) ── */
  const members = (d.members && typeof d.members === "object") ? d.members : {};
  const 구성원번호 = 번호셈(members, "srl");
  Object.keys(members).forEach((k) => {
    const m = members[k] || {};
    const srl = 번호(m.srl);
    if (!srl || m.takenDown) return;
    if (!m.sid) { 연결확인.push({ 종류: "구성원", key: k, srl: srl, 까닭: "직원과 이어지지 않음" }); return; }
    const p = 사람[String(m.sid)];
    if (!p) { 연결확인.push({ 종류: "구성원", key: k, srl: srl, 까닭: "명부에서 찾지 못함" }); return; }
    if (String(p.status || "") !== "retired") return;     // 재직·휴직은 그대로
    if (남기기있나(m.keepOnSite)) return;
    if (구성원번호[srl] > 1) { 연결확인.push({ 종류: "구성원", key: k, srl: srl, 까닭: "글 번호가 겹침" }); return; }
    내릴것.push({ 종류: "퇴사", 게시판: 게시판.구성원, srl: srl, key: k, sid: String(m.sid) });
  });

  /* ── 자문사현황 로고 글 ↔ 업체(companyId) ── */
  const partners = (d.partners && typeof d.partners === "object") ? d.partners : {};
  const 로고번호 = 번호셈(partners, "boardSrl");
  Object.keys(partners).forEach((id) => {
    const p = partners[id] || {};
    const srl = 번호(p.boardSrl);
    if (!srl || p.takenDown) return;
    const c = 회사[String(id)];
    if (!c) { 연결확인.push({ 종류: "자문사", companyId: id, srl: srl, 까닭: "업체관리에서 찾지 못함" }); return; }
    if (String(c.status || "") !== "closed") return;
    if (남기기있나(p.keep)) return;
    if (로고번호[srl] > 1) { 연결확인.push({ 종류: "자문사", companyId: id, srl: srl, 까닭: "글 번호가 겹침" }); return; }
    내릴것.push({ 종류: "계약종료", 게시판: 게시판.자문사, srl: srl, companyId: String(id) });
  });

  내릴것.sort((a, b) => (a.게시판 < b.게시판 ? -1 : a.게시판 > b.게시판 ? 1 : a.srl - b.srl));
  const 멈춤 = 내릴것.length > 멈춤문턱
    ? "한 번에 " + 내릴것.length + "건 — " + 멈춤문턱 + "건이 넘어 하나도 내리지 않았습니다" : "";
  return { ok: true, 실패: "", 내릴것: 내릴것, 보낼것: 멈춤 ? [] : 내릴것.slice(),
           연결확인: 연결확인, 멈춤: 멈춤, 지문: 지문(내릴것) };
}

module.exports = { 멈춤문턱, 게시판, 고르기, 지문, 남기기있나 };
