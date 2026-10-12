"use strict";

/* 🗂 공공데이터 «공용 자리» pubdata — 한 번 받아 모든 프로그램이 읽는다 (대표 「진행」 2026-10-11, 구조 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   pubdata/co/{사업자번호}/nps     국민연금 — 후보(cand)·지금(now)·월별 가입자(hist)
   pubdata/co/{사업자번호}/ei      고용·산재 상시인원 — { at, rows, gy, sj, n }
   pubdata/co/{사업자번호}/eiHist  고용 상시인원 월별 기록
   pubdata/co/{사업자번호}/nts     국세청 사업 상태 — { state, at, end }
   pubdata/common/holidays/{연도}  공휴일 — { at, list:[{date,name,kind}] } (한국천문연구원 특일)
   pubdata_req/{사업자번호}         화면의 «받아 달라» 요청 — 서버가 받아 쓰고 지운다

   ★ 쓰기는 서버만(규칙 '.write': false). 화면은 읽기만 하고, 새로 받고 싶으면 pubdata_req 에 요청을 남긴다.
   ★ 사람이 정한 것(국민연금 「이 사업장 맞음」 pick · 「없음」 none)은 공공데이터가 아니다 —
     그대로 기업정보함(pucards/coInfo)에 둔다. 서버는 거기서 읽기만 한다.
   ⚠ 보험료 금액은 어디에도 안 적는다(nps-monthly.js nowOf 가 애초에 담지 않는다).
   ⚠ 옮기는 동안(2026-10 ~ 11월 중순) 서버는 옛 자리 pucards/coInfo 에도 «같이» 쓴다 — 옛 화면이 안 끊기게.
     OLD_TOO 를 false 로 바꾸는 것이 5단계(옛 자리 쓰기 멈춤)다. */

const PUB = "pubdata";
const OLD_TOO = true;
const digits = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");

/* 회사 한 곳의 갈래(nps·ei·eiHist·nts) 아래 칸 → 새 자리 + (옮기는 동안) 옛 자리 */
function coPaths(no, sub) {
  const n = digits(no);
  if (n.length !== 10) return [];
  const out = [PUB + "/co/" + n + "/" + sub];
  if (OLD_TOO) out.push("pucards/coInfo/" + n + "/" + sub);
  return out;
}
/* update 묶음에 같은 값을 두 자리에 넣는다 */
function put(u, no, sub, val) { coPaths(no, sub).forEach((p) => { u[p] = val; }); return u; }

/* ── 📅 공휴일 — 한국천문연구원 특일 정보(공휴일 정보 조회) ── */
const HOLI_URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
function holiKind(name) {
  const s = String(name || "");
  if (/^대체/.test(s)) return "대체공휴일";
  if (/선거/.test(s)) return "선거일";
  if (/^임시/.test(s)) return "임시공휴일";   /* 이알피 HOLIDAY_KINDS 와 같은 낱말 */
  return "법정공휴일";
}
function holiRows(items) {
  return [].concat(items || []).filter((it) => it && it.locdate && String(it.isHoliday || "Y") === "Y").map((it) => {
    const d = String(it.locdate);
    return { date: d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8), name: String(it.dateName || "").trim(), kind: holiKind(it.dateName) };
  }).sort((a, b) => a.date.localeCompare(b.date));
}
function kstYear(t) { return new Date((t || Date.now()) + 9 * 3600000).getUTCFullYear(); }

/* 올해·내년을 받는다. 받은 것이 0건이면 «그 해를 지우지 않는다»(아직 발표 전이거나 공단 쪽 오류) */
async function holidaysOnce(db, fetchFn, svc, now) {
  const out = { years: {}, failed: 0 };
  const y0 = kstYear(now);
  for (const y of [y0, y0 + 1]) {
    try {
      const res = await fetchFn(HOLI_URL + "?serviceKey=" + encodeURIComponent(svc) + "&_type=json&numOfRows=100&solYear=" + y);
      if (!res.ok) throw new Error("천문연 답 " + res.status);
      const j = await res.json();
      const b = j && j.response && j.response.body;
      const list = holiRows(b && b.items && b.items.item);
      out.years[y] = list.length;
      if (list.length) await db.ref(PUB + "/common/holidays/" + y).set({ at: now || Date.now(), src: "kasi", list });
    } catch (e) {
      out.failed++;
      console.warn("pubdata 공휴일 실패:", y, String((e && e.message) || e).slice(0, 120));
    }
  }
  return out;
}

/* ── «받아 달라» 요청 ──
   화면이 pubdata_req/{번호} = { at, k:'ei'|'nps' } 를 남기면 서버가 그 회사만 받아 쓰고 요청을 지운다.
   ⚠ 하루 안에 이미 받은 갈래는 다시 묻지 않는다 — 직원 여럿이 같은 회사를 열어도 공단 한도를 안 쓴다. */
const REQ_SKIP_MS = 86400000;
function reqKinds(req, cur, now) {
  const k = String((req && req.k) || "");
  const want = k === "nps" ? ["nps"] : k === "ei" ? ["ei"] : ["ei", "nps"];
  const t = now || Date.now();
  return want.filter((w) => {
    const at = w === "ei" ? cur && cur.ei && cur.ei.at : cur && cur.nps && (cur.nps.now ? cur.nps.now.at : cur.nps.candAt);
    return !(at && t - Number(at) < REQ_SKIP_MS);
  });
}

/* ── 🏛 국세청 상태 옮겨 적기 (2026-10-12 대표 「진행」) ──
   기업정보함은 국세청에 «그 자리에서» 묻고 답을 보며 사람이 판단한다(새 번호 확인·영업 중 확인·등록증 대조).
   그 흐름은 그대로 두고, 기업 상세(pucards/coInfo/{번호})에 상태가 적히면 서버가 공용 자리로 «그대로» 옮긴다.
   ★ 우리가 고치지 않는다 — 국세청이 준 말과 확인한 날을 그대로 옮긴다.
   ⚠ 상태가 지워지면 공용 자리는 그대로 둔다(마지막으로 안 사실). 번호 아닌 열쇠(이름 열쇠)는 건너뛴다. */
const NTS_FIELDS = { ntsState: 1, ntsAt: 1, ntsEndDt: 1 };
function ntsMirrorOf(no, info) {
  const n = digits(no);
  if (n.length !== 10 || String(no) !== n) return null;
  const i = info || {};
  if (!i.ntsState) return null;
  const v = { state: String(i.ntsState), at: String(i.ntsAt || "") };
  if (i.ntsEndDt) v.end = String(i.ntsEndDt);
  const u = {}; u[PUB + "/co/" + n + "/nts"] = v;
  return u;
}

module.exports = { NTS_FIELDS, ntsMirrorOf, PUB, OLD_TOO, coPaths, put, holiKind, holiRows, holidaysOnce, kstYear, reqKinds, REQ_SKIP_MS, digits };
