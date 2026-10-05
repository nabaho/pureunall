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
/* 정찰 기록의 판 — 정찰에 무엇을 더 보게 하면 올린다. 화면(pu-home.html 자동정찰판)이 판이 다르면
   저절로 다시 정찰한다 — 대표께 단추를 찾게 하지 않는다. ⚠ 화면의 값과 «같아야» 한다(검사가 본다). */
const 정찰판 = 2;
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
  return { ok: false, 실패: 실패, 내릴것: [], 보낼것: [], 연결확인: [], 멈춤: "", 지문: "", 올릴것: [] };
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

  /* ══ 2단계 — 새 거래처 로고 «올리기» (2026-10-05) ══
     네 가지가 «다» 있어야 올린다: 사람이 «올림»으로 표시 · 공개 동의(날짜) · 로고 그림 · 거래 중.
     ★ 공개 동의가 먼저다 — 고객사 이름·로고를 홈페이지에 싣는 것은 그 회사가 허락한 뒤의 일이다.
     ★ 이미 로고와 이었거나(boardSrl) 한 번 내린 회사는 다시 올리지 않는다 — 두 장이 걸린다. */
  const 올릴것 = [];
  Object.keys(partners).forEach((id) => {
    const p = partners[id] || {};
    if (p.posted !== true || 번호(p.boardSrl) || p.takenDown || p.uploadedAt) return;
    if (!(p.consent && typeof p.consent === "object" && String(p.consent.date || "").trim())) return;
    if (!(p.logo && Number(p.logo.bytes) > 0)) return;
    const c = 회사[String(id)];
    if (!c || String(c.status || "") !== "active") return;
    올릴것.push({ 종류: "새거래처", 게시판: 게시판.자문사, companyId: String(id) });
  });

  /* ══ 3단계 — 새 노무사 «올리기» (2026-10-05) ══
     다 있어야 올린다: 글 번호 없음 · 직원 번호(sid)로 이은 재직(active) 노무사 · 사진 · 경력 ·
     대표의 «올리기 허락»(publishOk — 그때 화면이 지은 경력 글을 함께 담는다).
     ★ 사람 소개는 공개되는 글이다 — 반쪽(사진·경력 없음)은 올리지 않고, 대표가 본 것만 올린다.
     ⚠ 한 번 보낸 사람(uploadedAt)은 글 번호를 못 받았어도 다시 안 올린다 — 두 장이 걸린다. */
  Object.keys(members).forEach((k) => {
    const m = members[k] || {};
    if (번호(m.srl) || m.takenDown || m.uploadedAt || m.offSite) return;
    const 노무사 = m.kind === "labor"
      || (m.kind !== "staff" && /노무사/.test(String(m.position1 || "") + " " + String(m.position2 || "")));
    if (!노무사 || !m.sid) return;
    const p = 사람[String(m.sid)];
    if (!p || String(p.status || "") !== "active") return;
    if (!(m.photo && Number(m.photo.bytes) > 0)) return;
    if (!(Array.isArray(m.careers) && m.careers.some((c) => String(c || "").trim()))) return;
    if (!(m.publishOk && typeof m.publishOk === "object" && String(m.publishOk.경력글 || "").trim())) return;
    올릴것.push({ 종류: "새구성원", 게시판: 게시판.구성원, key: k, sid: String(m.sid) });
  });

  return { ok: true, 실패: "", 내릴것: 내릴것, 보낼것: 멈춤 ? [] : 내릴것.slice(),
           연결확인: 연결확인, 멈춤: 멈춤, 지문: 지문(내릴것), 올릴것: 올릴것 };
}

/* 기록에 남기는 한 줄 — 이름은 «안» 담는다. sid·companyId·글 번호만.
   이름은 화면이 우리 자료(구성원·업체관리)에서 붙인다. 기록이 사람 이름을 모으면
   누가 언제 나갔는지가 홈페이지 자리 밖으로 따로 쌓인다. */
function 기록줄(x) {
  return { 종류: x.종류, 게시판: x.게시판, srl: x.srl, sid: x.sid || "", companyId: x.companyId || "" };
}

/* 한 번 돈다 — 서버 함수(매달·지금 돌리기·승인)가 «도구»만 넣어 부른다.
   도구 = { 읽기(path), 쓰기(path,값), 덧붙이기(path,값), 내리기(목록)→[{…, 됐나, 까닭}],
            지금()→ms, 달(ms)→"YYYY-MM", 누가 }
   ★ 읽기·쓰기·내리기를 도구로 받아서, 검사가 서버 없이도 실제로 돌려 본다.
   방식: 보기(아무것도 안 씀) · 돌리기(멈춤이면 0건) · 승인(멈춘 «그 목록»만 내림) */
async function 돌기(방식, 받은지문, 도구) {
  const 지금 = 도구.지금(), 달 = 도구.달(지금);
  const 설정 = (await 도구.읽기("homepage/auto/config")) || {};
  /* ⚠ 끄면 «아무것도» 하지 않는다 — 세지도, 기록하지도 않는다 */
  if (설정.off === true) return { ok: true, 방식: 방식, 달: 달, 꺼짐: true, 내림: [], 못내림: [], 올림: [], 못올림: [] };

  const 고른것 = 고르기({
    roster: await 도구.읽기("data/user_dir"),
    companies: await 도구.읽기("data/companies"),
    members: await 도구.읽기("homepage/members"),
    partners: await 도구.읽기("homepage/partners")
  });
  const 결과 = Object.assign({ 방식: 방식, 달: 달, 내림: [], 못내림: [], 올림: [], 못올림: [] }, 고른것);
  if (방식 === "보기") return 결과;

  let 보낼것 = 고른것.보낼것;
  if (방식 === "승인") {
    /* ★ 사람이 본 목록과 지금 목록이 «같을 때만» 내린다. 그사이 누가 퇴사 처리를
         되돌렸다면 그분 글이 내려가면 안 된다. */
    if (!고른것.ok || !고른것.내릴것.length || 고른것.지문 !== String(받은지문 || "")) {
      결과.ok = false;
      결과.실패 = 결과.실패 || "그사이 내릴 것이 바뀌었습니다 — 다시 보고 눌러 주십시오";
      return 결과;
    }
    보낼것 = 고른것.내릴것;
    결과.멈춤 = "";
  }

  if (고른것.ok && 보낼것.length) {
    const 답 = await 도구.내리기(보낼것);
    for (const x of 답) {
      if (x.됐나) {
        결과.내림.push(기록줄(x));
        const 표시 = { at: 지금, by: 도구.누가, 달: 달 };
        if (x.key) await 도구.쓰기("homepage/members/" + x.key + "/takenDown", 표시);
        if (x.companyId) await 도구.쓰기("homepage/partners/" + x.companyId + "/takenDown", 표시);
        /* 사람이 누른 내리기와 «같은 자리»에 남긴다 — 글 번호 하나로 무슨 일이 있었는지 다 보이게 */
        await 도구.덧붙이기("homepage/writeLog/" + x.srl, { at: 지금, by: 도구.누가, 저장됨: true,
          바뀐것: [{ 이름: "홈페이지에서", 옛: "보임", 새: "휴지통 (되살릴 수 있음)" }], 까닭: x.종류 });
      } else {
        결과.못내림.push(Object.assign(기록줄(x), { 까닭: x.까닭 || "까닭 모름" }));
      }
    }
  }
  /* ── 올리기 (2단계 새 거래처 · 3단계 새 노무사) ──
     ★ 매달 «돌리기»에서만 올린다. «승인»은 멈춘 내리기를 허락하는 것이지 올리기가 아니다.
     ★ 올린 뒤 받은 «새 글 번호»를 그 회사(boardSrl)·그 사람(srl)에 이어 둔다 —
       그래야 다음에 계약이 끝나거나 퇴사하면 같은 길로 저절로 내려간다.
     ⚠ 글 번호를 못 받았으면 «올림»으로 치지 않는다. 잇지 못한 글은 나중에 못 내린다. */
  const 올릴것 = 고른것.올릴것 || [];
  if (방식 === "돌리기" && 고른것.ok && 올릴것.length) {
    if (typeof 도구.올리기 !== "function") {
      결과.올리기안됨 = "올릴 것이 " + 올릴것.length + "건 있으나 올리는 길이 아직 없습니다";
    } else {
      const 답 = await 도구.올리기(올릴것);
      for (const x of 답) {
        const 새번호 = 번호(x.srl);
        /* ★ 보내기가 «됐으면» 글 번호를 못 받았어도 «올린 표시»를 남긴다 —
             안 남기면 다음 달에 같은 글을 또 올린다(홈페이지에 두 장). */
        if (x.됐나) {
          const 표시 = { at: 지금, by: 도구.누가, 달: 달 };
          if (x.companyId) await 도구.쓰기("homepage/partners/" + x.companyId + "/uploadedAt", 표시);
          if (x.key) await 도구.쓰기("homepage/members/" + x.key + "/uploadedAt", 표시);
        }
        if (x.됐나 && 새번호) {
          const 줄 = Object.assign(기록줄(x), { srl: 새번호 });
          결과.올림.push(줄);
          if (x.companyId) await 도구.쓰기("homepage/partners/" + x.companyId + "/boardSrl", 새번호);
          if (x.key) await 도구.쓰기("homepage/members/" + x.key + "/srl", String(새번호));
          await 도구.덧붙이기("homepage/writeLog/" + 새번호, { at: 지금, by: 도구.누가, 저장됨: true,
            바뀐것: [{ 이름: "홈페이지에", 옛: "없음", 새: "새 글로 올림" }], 까닭: x.종류 });
        } else {
          결과.못올림.push(Object.assign(기록줄(x), { 까닭: x.됐나 ? "새 글 번호를 못 받음" : (x.까닭 || "까닭 모름") }));
        }
      }
    }
  }

  await 도구.덧붙이기("homepage/auto/runs/" + 달, {
    at: 지금, by: 도구.누가, 방식: 방식, ok: 고른것.ok, 실패: 고른것.실패 || "",
    멈춤: 결과.멈춤 || "", 지문: 고른것.지문 || "",
    후보: 고른것.내릴것.map(기록줄),
    내림: 결과.내림, 못내림: 결과.못내림, 연결확인수: 고른것.연결확인.length,
    올림: 결과.올림, 못올림: 결과.못올림, 올리기안됨: 결과.올리기안됨 || ""
  });
  return 결과;
}

module.exports = { 멈춤문턱, 정찰판, 게시판, 고르기, 지문, 남기기있나, 돌기 };
