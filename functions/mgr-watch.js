"use strict";

/* 🔎 담당 점검 — 서버가 10분마다 (2026-10-07 기업정보함 점검 ③)
   ═══════════════════════════════════════════════════════════════════════════
   「담당자가 지정되었는데 잘못 되거나 변경할 경우 검토할 수 있게 해라」(대표 승인 2026-10-03)

   ★ 왜 서버가 하나 — 예전에는 기업정보함 화면(대표님 PC · 메일 화면이 열려 있을 때만)이 셌다.
     화면을 안 열면 이알피에서 담당이 바뀌어도 아무도 못 잡았고, 화면이 들고 있는 업체 목록은
     로그인 때 한 번 읽은 «옛것»이라 1분마다 같은 옛 자료를 견주고 있었다(점검 B4).
   ★ 셈은 «한 벌»이다 — functions/mgr-watch-core/ 는 js/pu-mgr-watch-core.js 의 글자 그대로 사본이다
     (scripts/sync-mgr-watch-core.js · tests/mgr-watch-core-in-sync.test.js).

   ⚠ 쓰는 곳은 pucards/config/mgrSeen · mgrChange 둘뿐이다 — 이알피 업체 기록(data/companies)은 «읽기만».
   ⚠ 업무 시간에만(07~21시) — 밤에는 이알피를 아무도 안 고친다. 아침 첫 회차가 밤사이 것을 잡는다.
   ⚠ 업체가 너무 적게 읽히면(읽기 실패·옛 꼴) 그 회차를 건너뛴다 — 「다 끝난 업체」로 보고 기준을
     비우면 다음 회차에 모든 업체가 «처음»이 되어 바뀐 것을 놓친다. */

const core = require("./mgr-watch-core/pu-mgr-watch-core.js");

const CONFIG = "pucards/config";
const MIN_COS = 50;     /* 업체관리는 378곳(2026-10-07) — 이보다 크게 적으면 읽기를 못 믿는다 */

function asList(v) {
  const w = (v && v.v !== undefined) ? v.v : v;
  if (Array.isArray(w)) return w.filter(Boolean);
  if (w && typeof w === "object") return Object.keys(w).map((k) => w[k]).filter(Boolean);
  return [];
}

function make(deps) {
  async function watchOnce(now) {
    const db = deps.getDatabase();
    const [cosS, seenS, chS] = await Promise.all([
      db.ref("data/companies").once("value"),
      db.ref(CONFIG + "/mgrSeen").once("value"),
      db.ref(CONFIG + "/mgrChange").once("value"),
    ]);
    const cos = asList(cosS.val());
    if (cos.length < MIN_COS) {
      console.warn("담당 점검: 업체가 " + cos.length + "곳만 읽혔습니다 — 이번 회차는 건너뜁니다");
      return { skipped: true, cos: cos.length };
    }
    const p = core.plan(seenS.val() || {}, chS.val() || {}, cos, now || Date.now());
    const up = {};
    Object.keys(p.up).forEach((k) => { up[CONFIG + "/" + k] = p.up[k]; });
    if (Object.keys(up).length) await db.ref().update(up);
    if (p.n || p.first) console.log("담당 점검: 바뀐 업체 " + p.n + "곳" + (p.first ? " (처음 — 기준만 적음)" : ""));
    return { n: p.n, first: p.first, wrote: Object.keys(up).length };
  }

  const mgrWatch = deps.functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    .pubsub.schedule("*/10 7-21 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => { await watchOnce(); return null; });

  return { mgrWatch, watchOnce };
}

module.exports = make;
module.exports.asList = asList;
