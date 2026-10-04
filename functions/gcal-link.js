/* 구글 캘린더 «늘 연결» — 서버가 사람마다 구글 갱신 열쇠를 들고 있다
   ─────────────────────────────────────────────────────────────────────────
   대표 지시(2026-10-04): 「항상 구글로 로그인되어 있어야 한다 그래야 혼란이 없다」 → 「진행」.

   ★ 왜 서버가 들고 있나
     예전엔 구글 로그인 표(access token)를 «창 메모리»에만 두었다(js/pu-gcal-auth.js).
     그래서 새로 고침 · 다른 앱 갔다 오기 · 폰 · 한 시간 지남 — 넷 중 하나만 있어도 풀렸다.
     구글이 정한 «오래 가는» 길은 하나다: 처음 한 번 동의받을 때 «갱신 열쇠(refresh token)» 를
     받아 두고, 그것으로 한 시간짜리 표를 그때그때 새로 받는 것. 갱신 열쇠는 비밀이라
     브라우저에 둘 수 없다 — 그래서 서버가 들고, 화면은 «한 시간짜리 표»만 받아 간다.
   ★ 짜임은 카카오 로그인(functions/kakao.js)과 같다 — 서명한 state · 재직자만 · 서버 전용 자리.

   ⚠ 지켜야 할 것
     ① 갱신 열쇠는 gcal_tokens/{uid} — 보안규칙에 «자리가 없다». 뿌리에 규칙이 없으므로
        화면(관리자 포함)은 읽지도 쓰지도 못한다. 관리자 SDK(이 파일)만 다룬다.
        ⚠ 이 자리에 규칙을 «새로 만들지» 말 것 — 만드는 순간 누군가 읽을 수 있게 될 수 있다.
     ② 화면에 돌려주는 것은 «한 시간짜리 표»와 «구글 메일 주소»뿐이다. 갱신 열쇠는 절대 안 내보낸다.
     ③ 권한은 달력 일정(calendar.events) 하나 — 메일·드라이브 권한을 받지 않는다.
        사람이 동의 화면에서 달력 칸을 끄고 오면(구글의 «골라 동의») 연결하지 않고 그렇다고 말한다.
     ④ 재직(uid_roles/{uid}.status === "active")인 사람만. 퇴사·휴직하면 다음 표 요청 때
        그 열쇠를 지우고, 매일 새벽 4시에도 한 번 훑어 지운다(gcalTokenSweep).
     ⑤ 구글이 「그 열쇠는 이제 안 된다(invalid_grant)」고 하면 — 본인이 구글에서 권한을 거뒀거나
        비밀번호를 바꾼 것이다 — 열쇠를 지우고 화면에 «다시 연결»을 알린다(추측으로 성공 처리하지 않는다).
     ⑥ OAuth 동의 화면이 «테스트» 상태면 구글이 갱신 열쇠를 7일 만에 죽인다(구글 규칙).
        그때도 ⑤ 길로 «다시 연결»이 뜬다 — 대표님이 콘솔에서 «프로덕션»으로 바꿔야 끝난다.

   서버 비밀값: GCAL_OAUTH_SECRET — 구글 콘솔 OAuth 클라이언트(아래 CLIENT_ID)의 «클라이언트 보안 비밀번호».
   tests/gcal-link.test.js 가 위 약속을 하나씩 되돌려 보며 지킨다. */

const functions = require("firebase-functions/v1");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const crypto = require("crypto");

/* 카카오·지문과 같은 리전 */
const REGION = "asia-northeast3";
const ORIGIN = "https://nabaho.github.io";
/* ⚠ 구글 콘솔 OAuth 클라이언트의 «승인된 리디렉션 URI» 에 이 주소가 들어 있어야 한다 */
const REDIRECT_URI = ORIGIN + "/pureunall/pu-cal.html";
/* 화면(pu-cal.html GCAL_OAUTH_ID)과 같은 클라이언트 — 클라이언트 번호는 비밀이 아니다 */
const CLIENT_ID = "30712196914-1qc61a41ptmo6u7hbk71i70g00k3a8lk.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const DB_TOK = "gcal_tokens";     // {uid} = { rt, email, sid, at, usedAt } — 서버만(규칙 자리 없음)
const DB_STATE = "gcal_states";   // {state지문} = { at } — 한 번 쓴 연결 요청표(서버만)
const STATE_TTL_MS = 10 * 60 * 1000;
const SECRETS = ["GCAL_OAUTH_SECRET"];

function setCors(req, res) {
  const origin = String((req && req.headers && req.headers.origin) || "");
  if (origin === ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.set("Cache-Control", "no-store");
}
function bad(res, code, msg, extra) { res.status(code).json(Object.assign({ ok: false, error: msg }, extra || {})); }

async function requireUser(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try { return await getAuth().verifyIdToken(m[1], true); } catch (e) { return null; }
}
function pathSafe(s) { return String(s || "").replace(/[.#$/[\]]/g, "_").slice(0, 200); }

/* 서버 비밀값 — 앞뒤 빈칸·줄바꿈을 걷는다(카카오 때 줄바꿈이 섞여 들어간 일이 있었다).
   구글 클라이언트 비밀번호는 «GOCSPX-» 로 시작한다. 모양이 아니면 구글로 보내지 않고 여기서 말한다. */
const SECRET_BAD = "구글 연결용 서버 비밀값(GCAL_OAUTH_SECRET)이 아직 없거나 모양이 틀립니다 — 관리자에게 알려 주세요";
function secretOf() {
  const k = String(process.env.GCAL_OAUTH_SECRET || "").trim();
  return /^[A-Za-z0-9_-]{20,}$/.test(k) ? k : "";
}

/* 재직자인가 — 카카오 연결과 같은 잣대 */
async function roleOf(uid) {
  return (await getDatabase().ref("uid_roles/" + pathSafe(uid)).once("value")).val() || {};
}
function isActive(role) { return !!role && role.status === "active"; }

/* ── 연결 요청표(state) — 위조·재사용·남의 것 막기 ──
   카카오와 같이 서버 비밀값으로 서명한다. 거기에 «누가 요청했나(uid 지문)» 를 함께 묶는다 —
   남이 받아 둔 code 를 내 계정에 붙이지 못하게. 발급 때는 DB 에 안 쓰고, 쓸 때 한 번만 표시한다. */
function uidTag(uid) { return crypto.createHash("sha256").update("pureun-gcal:" + String(uid)).digest("base64url").slice(0, 16); }
function issueState(uid, secret) {
  const payload = "gl." + Date.now() + "." + uidTag(uid) + "." + crypto.randomBytes(18).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}
async function takeState(state, uid, secret) {
  const raw = String(state || "");
  const p = raw.split(".");
  if (p.length !== 5 || p[0] !== "gl" || !/^\d{13}$/.test(p[1]) || p[2] !== uidTag(uid) || !secret) return false;
  const payload = p.slice(0, 4).join(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let got;
  try { got = Buffer.from(p[4], "base64url"); } catch (_) { return false; }
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return false;
  const age = Date.now() - Number(p[1]);
  if (age < 0 || age > STATE_TTL_MS) return false;
  const key = crypto.createHash("sha256").update(raw).digest("hex");
  const r = await getDatabase().ref(DB_STATE + "/" + key).transaction((cur) => cur ? undefined : { at: Date.now() }, undefined, false);
  return !!(r && r.committed === true);
}

/* 구글 토큰 창구에 묻는다 — 실패는 그대로 던진다(⑤: «그런 셈 쳐 주기» 없음) */
async function googleToken(params) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) {
    const e = new Error((j && (j.error_description || j.error)) || ("구글 토큰 요청 실패 HTTP " + r.status));
    e.googleError = (j && j.error) || "";
    throw e;
  }
  return j;
}
/* 받은 표가 «달력 일정» 권한을 정말 갖고 있나(③) — 골라 동의에서 달력을 끄고 올 수 있다 */
function hasCalendarScope(scope) { return String(scope || "").split(/\s+/).indexOf(SCOPE) >= 0; }

/* 구글 메일 주소 — 따로 권한(email)을 받지 않는다. 기본 달력의 이름이 곧 그 사람 메일이다. */
async function googleEmail(accessToken) {
  try {
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=summary",
      { headers: { Authorization: "Bearer " + accessToken } });
    const j = await r.json().catch(() => null);
    return (r.ok && j && typeof j.summary === "string") ? j.summary.slice(0, 120) : "";
  } catch (e) { return ""; }
}

function tokenReply(res, j, email) {
  res.json({ ok: true, access_token: j.access_token,
    expires_at: Date.now() + Math.max(60, Number(j.expires_in || 3600)) * 1000, email: email || "" });
}

/* ── ① 연결 주소 — 서명한 state 를 붙여 준다 ───────────────────────────────── */
exports.gcalAuthUrl = functions.region(REGION).runWith({ secrets: SECRETS }).https.onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
  const user = await requireUser(req);
  if (!user) return bad(res, 401, "먼저 푸른 통합시스템에 로그인해 주세요");
  const secret = secretOf();
  if (!secret) return bad(res, 500, SECRET_BAD);
  /* ★ access_type=offline + prompt=consent — 이 둘이 있어야 구글이 «갱신 열쇠» 를 준다.
     prompt=consent 가 없으면 예전에 동의한 사람에게는 갱신 열쇠를 다시 안 준다. */
  const url = "https://accounts.google.com/o/oauth2/v2/auth"
    + "?client_id=" + encodeURIComponent(CLIENT_ID)
    + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI)
    + "&response_type=code"
    + "&scope=" + encodeURIComponent(SCOPE)
    + "&access_type=offline&prompt=consent&include_granted_scopes=true"
    + "&state=" + encodeURIComponent(issueState(user.uid, secret));
  res.json({ ok: true, url });
});

/* ── ② 연결 — 구글에서 돌아온 code 를 갱신 열쇠로 바꿔 서버에 둔다 ────────────── */
exports.gcalLink = functions.region(REGION).runWith({ secrets: SECRETS }).https.onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
  const user = await requireUser(req);
  if (!user) return bad(res, 401, "먼저 푸른 통합시스템에 로그인해 주세요");
  const secret = secretOf();
  if (!secret) return bad(res, 500, SECRET_BAD);
  const code = String((req.body && req.body.code) || "");
  const state = String((req.body && req.body.state) || "");
  if (!code) return bad(res, 400, "구글에서 받은 연결 번호(code)가 없습니다");
  if (!await takeState(state, user.uid, secret)) {
    return bad(res, 400, "구글 연결 요청이 만료됐거나 이미 쓰였습니다 — 다시 눌러 주세요");
  }
  const role = await roleOf(user.uid);
  if (!isActive(role)) return bad(res, 403, "재직 중인 직원 계정만 구글을 연결할 수 있습니다");

  let j;
  try {
    j = await googleToken({ grant_type: "authorization_code", code, client_id: CLIENT_ID,
      client_secret: secret, redirect_uri: REDIRECT_URI });
  } catch (e) {
    return bad(res, 400, "구글 연결에 실패했습니다: " + String((e && e.message) || e));
  }
  if (!hasCalendarScope(j.scope)) {
    return bad(res, 400, "구글 동의 화면에서 «캘린더 일정» 칸이 꺼져 있었습니다 — 다시 눌러 그 칸을 켜 주세요");
  }
  /* ⚠ 갱신 열쇠가 없으면 «늘 연결» 이 안 된다 — 성공인 척하지 않는다 */
  if (!j.refresh_token) {
    return bad(res, 400, "구글이 오래 가는 열쇠를 주지 않았습니다 — 구글 계정 › 보안 › 제3자 앱에서 푸른 캘린더를 지운 뒤 다시 연결해 주세요");
  }
  const email = await googleEmail(j.access_token);
  /* ⚠ 다른 구글 계정으로 «바꿔» 연결하면 옛 열쇠를 구글에 돌려준다(쓰지 않는 열쇠를 남기지 않는다) */
  const ref = getDatabase().ref(DB_TOK + "/" + pathSafe(user.uid));
  const prev = (await ref.once("value")).val();
  await ref.set({ rt: j.refresh_token, email, sid: pathSafe(role.sid || ""), at: Date.now(), usedAt: Date.now() });
  if (prev && prev.rt && prev.rt !== j.refresh_token) {
    fetch(REVOKE_URL + "?token=" + encodeURIComponent(prev.rt), { method: "POST" }).catch(() => {});
  }
  tokenReply(res, j, email);
});

/* ── ③ 한 시간짜리 표 — 화면이 열릴 때와 끝나기 5분 전에 부른다 ─────────────────
   돌려주는 것: { ok:true, access_token, expires_at, email } 또는 { ok:false, need:"link", why }
   ⚠ «연결 안 됨» 은 200 + need:"link" 다. 진짜 고장(서버 비밀값 없음 등)과 갈라야
     화면이 고장에 «연결하세요» 창을 띄우지 않는다. */
exports.gcalToken = functions.region(REGION).runWith({ secrets: SECRETS }).https.onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
  const user = await requireUser(req);
  if (!user) return bad(res, 401, "먼저 푸른 통합시스템에 로그인해 주세요");
  const secret = secretOf();
  if (!secret) return bad(res, 500, SECRET_BAD);
  const ref = getDatabase().ref(DB_TOK + "/" + pathSafe(user.uid));
  const rec = (await ref.once("value")).val();
  if (!rec || !rec.rt) return res.json({ ok: false, need: "link", why: "none" });
  /* ④ 퇴사·휴직 — 열쇠를 지우고 더 주지 않는다 */
  if (!isActive(await roleOf(user.uid))) {
    await ref.remove();
    fetch(REVOKE_URL + "?token=" + encodeURIComponent(rec.rt), { method: "POST" }).catch(() => {});
    return res.json({ ok: false, need: "link", why: "inactive" });
  }
  let j;
  try {
    j = await googleToken({ grant_type: "refresh_token", refresh_token: rec.rt, client_id: CLIENT_ID, client_secret: secret });
  } catch (e) {
    /* ⑤ 구글이 그 열쇠를 버렸다 — 지우고 «다시 연결» */
    if (e && e.googleError === "invalid_grant") {
      await ref.remove();
      return res.json({ ok: false, need: "link", why: "revoked" });
    }
    return bad(res, 502, "구글이 답하지 않습니다 — 잠시 뒤 다시 시도합니다");
  }
  ref.update({ usedAt: Date.now() }).catch(() => {});
  tokenReply(res, j, rec.email || "");
});

/* ── ④ 연결 끊기 — 본인 것만. 구글에도 열쇠를 돌려준다 ───────────────────────── */
exports.gcalUnlink = functions.region(REGION).https.onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
  const user = await requireUser(req);
  if (!user) return bad(res, 401, "먼저 푸른 통합시스템에 로그인해 주세요");
  const ref = getDatabase().ref(DB_TOK + "/" + pathSafe(user.uid));
  const rec = (await ref.once("value")).val();
  await ref.remove();
  if (rec && rec.rt) await fetch(REVOKE_URL + "?token=" + encodeURIComponent(rec.rt), { method: "POST" }).catch(() => {});
  res.json({ ok: true });
});

/* ── ⑤ 매일 새벽 4시 — 퇴사·휴직한 사람의 열쇠를 지운다(④) ─────────────────────
   표를 다시 청할 때도 지우지만, 다시는 안 여는 사람의 열쇠가 남으면 안 된다. */
exports.gcalTokenSweep = functions.region(REGION).pubsub.schedule("0 4 * * *").timeZone("Asia/Seoul")
  .onRun(async () => {
    const all = (await getDatabase().ref(DB_TOK).once("value")).val() || {};
    let 지움 = 0;
    for (const uid of Object.keys(all)) {
      if (isActive(await roleOf(uid))) continue;
      const rt = all[uid] && all[uid].rt;
      await getDatabase().ref(DB_TOK + "/" + uid).remove();
      if (rt) await fetch(REVOKE_URL + "?token=" + encodeURIComponent(rt), { method: "POST" }).catch(() => {});
      지움++;
    }
    /* 한 번 쓴 연결 요청표는 하루 지나면 쓸모없다 */
    const st = (await getDatabase().ref(DB_STATE).once("value")).val() || {};
    const 옛날 = Date.now() - 24 * 3600 * 1000;
    const 치울 = {};
    Object.keys(st).forEach((k) => { if (!st[k] || Number(st[k].at || 0) < 옛날) 치울[k] = null; });
    if (Object.keys(치울).length) await getDatabase().ref(DB_STATE).update(치울);
    console.log("gcalTokenSweep: 퇴사·휴직 열쇠", 지움, "개 지움 · 요청표", Object.keys(치울).length, "개 치움");
    return null;
  });

/* 검사용 — 순수 셈만 내보낸다 */
exports._test = { issueState, uidTag, hasCalendarScope, secretOf, REDIRECT_URI, SCOPE, CLIENT_ID };
