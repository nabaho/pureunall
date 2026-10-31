"use strict";
/* 새 사이트 지킴이 — 퇴사자를 저절로 빼고, 올리는 길이 막히면 알린다
   ═══════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-31 「앞으로 이런 문제 없게 자동으로 프로그램 되게 해라」 → 「둘 다 (추천)」.
   그날 겪은 일:
     · 퇴사한 분이 새 사이트 구성원 쪽에 그대로 있었다 — 「새 사이트에 올리기」를 사람이 눌러야만 빠졌다.
     · 서버의 GitHub 열쇠가 언젠가 죽어 있었는데 아무도 몰랐다(401).
     · 올리는 길(publishSite)은 단추가 생긴 2026-08-31 부터 한 번도 성공한 적이 없었다(400, #2826).
   그래서 두 가지를 한다:
     ① 매달 1일 자동 연결(monthlyHomepageAuto) 끝에 새 사이트 구성원 쪽도 다시 만들어 올린다.
     ② 매일 아침 열쇠로 두 저장소를 읽어 본다 — 막히면 홈페이지 관리 화면 맨 위에 띠가 뜬다.

   ★ 누구를 올릴지는 화면의 «새홈페이지에갈사람»과 같은 잣대다(안 올림·내린 표시·퇴사는 빼고, 사유 있는 남기기는 올린다).
     ⚠ 단 하나 다르다 — 화면은 직원과 안 이은 구성원을 «이름»으로 명부에서 찾아 퇴사 딱지를 붙이지만,
       서버는 이름으로 맞추지 않는다(온톨로지 규칙). 안 이은 사람은 «그대로 둔다» — 「연결없음」으로 세어 알리고,
       화면의 「자동 연결 — 아직 안 이은 구성원 글」 할 일이 잇게 한다.
   ★ 쪽을 그리는 부품은 화면과 «같은 코드»다 — functions/site-people/ 는 js/pu-site-people.js 의 글자 그대로 사본이다
     (scripts/sync-site-people.js · tests/site-people-in-sync.test.js).
   ⚠ 기록에는 이름을 담지 않는다(homepage-auto.js 기록줄과 같은 까닭) — 숫자와 글 번호만. */
require("./site-people/pu-site-people.js");
const PSP = globalThis.PuSitePeople;
const HA = require("./homepage-auto");

/* 한 번에 이보다 많이 빠지게 되면 «올리지 않고» 멈춘다 — 명부를 잘못 읽은 날 쪽이 텅 비지 않게.
   한 달에 두세 명 나가는 일은 있어도 넷은 드물다(대표 승인 목업 2026-10-31 「3명 넘게 빠지면 멈춤」). */
const 빠짐문턱 = 3;
/* 열쇠 점검이 이보다 오래 안 돌았으면 «점검이 멈췄다»고 알린다 — 매일 도는 것이라 하루 이틀 빠지는 것은 봐준다 */
const 점검늦음ms = 3 * 24 * 60 * 60 * 1000;
/* 우리 저장소(pureunall) 안의 사본 자리 — 화면의 「새 사이트에 올리기」와 같은 자리.
   새 사이트 저장소 안의 자리는 site-publish.홈페이지자리 가 만든다(앞의 site/ 를 뗀다). */
const 사본자리 = "site/people/index.html";

function 목록으로(raw) {
  let l = (raw && raw.v !== undefined) ? raw.v : raw;
  if (l && !Array.isArray(l) && typeof l === "object") l = Object.keys(l).map((k) => l[k]);
  return Array.isArray(l) ? l.filter((x) => x && typeof x === "object") : null;
}

/* 이 구성원이 새 사이트에 가나 — 사람표는 sid → 명부 한 줄 */
function 갈사람(m, 사람표) {
  const r = m || {};
  if (r.offSite || r.takenDown) return false;
  if (HA.남기기있나(r.keepOnSite)) return true;
  const p = r.sid ? 사람표[String(r.sid)] : null;
  if (!p) return true;                                  // 안 이었거나 명부에 없음 — 이름으로 맞추지 않고 그대로 둔다
  return String(p.status || "") !== "retired";          // 휴직은 퇴사가 아니다
}

/* 지금 쪽 + 우리 자료 → 무엇을 올릴지. 쓰지 않는다(검사가 그대로 돌려 본다). */
function 고르기(지금쪽, members, roster) {
  const 명부 = 목록으로(roster);
  /* ⚠ 비어 있는 명부는 «못 읽은 것»이다 — 그대로 믿으면 아무도 퇴사로 안 보이거나(괜찮다) 반대로 잘못 읽힌다 */
  if (!명부 || !명부.length) return { ok: false, 실패: "푸른ERP 직원 명부를 읽지 못했습니다" };
  if (!String(지금쪽 || "").trim()) return { ok: false, 실패: "새 사이트의 지금 구성원 쪽을 읽지 못했습니다" };
  const 사람표 = {};
  명부.forEach((p) => { if (p.sid) 사람표[String(p.sid)] = p; });

  const 묶음 = (members && typeof members === "object") ? members : {};
  const 키들 = Object.keys(묶음);
  const 뺀수 = 키들.filter((k) => !(묶음[k] || {}).offSite && !갈사람(묶음[k], 사람표)).length;
  const 연결없음수 = 키들.filter((k) => {
    const m = 묶음[k] || {};
    return 갈사람(m, 사람표) && !HA.남기기있나(m.keepOnSite) && !(m.sid && 사람표[String(m.sid)]);
  }).length;
  const ours = 키들.filter((k) => 갈사람(묶음[k], 사람표))
    .map((k) => Object.assign({}, 묶음[k], { key: k }));

  const 고른것 = PSP.올릴사람(지금쪽, ours);
  const 지금인원 = PSP.사람읽기(지금쪽).length;
  const 결과 = { ok: true, 실패: "", 멈춤: "", 인원: 고른것.갈것.length, 지금인원: 지금인원,
                 뺀수: 뺀수, 못간수: 고른것.못갈것.length, 연결없음수: 연결없음수, 바뀜: false, 새쪽: "" };
  if (!고른것.갈것.length) return Object.assign(결과, { ok: false, 실패: "올릴 사람이 없습니다 — 글 번호와 사진이 맞는 사람이 하나도 없음" });
  if (지금인원 - 고른것.갈것.length > 빠짐문턱) {
    결과.멈춤 = "한 번에 " + (지금인원 - 고른것.갈것.length) + "명이 빠지게 되어 올리지 않았습니다 — 「새 사이트에 올리기」로 확인해 주십시오";
    return 결과;
  }
  결과.새쪽 = PSP.쪽그리기(지금쪽, 고른것.갈것);
  결과.바뀜 = 결과.새쪽 !== 지금쪽;
  return 결과;
}

/* 한 번 돈다 — 도구 = { 읽기(path), 쓰기(path,값), 쪽읽기()→html, 올리기(html,note)→{commit}, 지금()→ms, 누가 }
   ★ 결과는 늘 homepage/auto/newsite 에 남긴다 — 화면이 이것을 보고 «새 사이트» 줄과 띠를 그린다.
   ⚠ 끄면(homepage/auto/config.off) 아무것도 안 한다 — 자동 연결 전체를 끄는 스위치와 같은 것을 따른다. */
async function 돌기(도구) {
  const 지금 = 도구.지금();
  const 설정 = (await 도구.읽기("homepage/auto/config")) || {};
  if (설정.off === true) return { ok: true, 꺼짐: true };
  let 기록;
  try {
    const 고른것 = 고르기(await 도구.쪽읽기(),
      await 도구.읽기("homepage/members"), await 도구.읽기("data/user_dir"));
    기록 = { at: 지금, by: 도구.누가 || "", ok: 고른것.ok, 실패: 고른것.실패 || "", 멈춤: 고른것.멈춤 || "",
             올림: false, 바뀜: !!고른것.바뀜, 인원: 고른것.인원 || 0, 뺀수: 고른것.뺀수 || 0,
             못간수: 고른것.못간수 || 0, 연결없음수: 고른것.연결없음수 || 0, commit: "" };
    if (고른것.ok && !고른것.멈춤 && 고른것.바뀜) {
      const 답 = await 도구.올리기(고른것.새쪽, "구성원 " + 고른것.인원 + "명 (매달 자동)");
      기록.올림 = true;
      기록.commit = (답 && 답.commit && 답.commit.sha) ? String(답.commit.sha).slice(0, 7) : "";
    }
  } catch (e) {
    기록 = Object.assign(기록 || { at: 지금, by: 도구.누가 || "" }, { ok: false, 올림: false,
      실패: String((e && e.message) || e).slice(0, 200) });
  }
  await 도구.쓰기("homepage/auto/newsite", 기록);
  return 기록;
}

/* 매일 아침 열쇠 점검 — 도구 = { 읽어보기(이름)→Promise (두 저장소의 구성원 쪽을 열쇠로 읽는다), 쓰기, 지금 }
   ★ 읽기만 한다. 쓰는 권한까지는 써 보지 않고는 알 수 없어서, 쓰다 막힌 것은 매달 올리기 기록(newsite)이 알린다. */
async function 열쇠점검(도구) {
  const 지금 = 도구.지금();
  let 기록 = { at: 지금, ok: true, 까닭: "" };
  for (const 이름 of ["새 사이트", "우리 사본"]) {
    try { await 도구.읽어보기(이름); }
    catch (e) { 기록 = { at: 지금, ok: false, 까닭: 이름 + " — " + String((e && e.message) || e).slice(0, 160) }; break; }
  }
  await 도구.쓰기("homepage/auto/keyCheck", 기록);
  return 기록;
}

module.exports = { 빠짐문턱, 점검늦음ms, 사본자리, 갈사람, 고르기, 돌기, 열쇠점검 };
