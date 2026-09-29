/* 카카오로 로그인 — 서버 쪽 판단
   ─────────────────────────────────────────────────────────────────────────
   대표 지시(2026-09-27): "로그인기능을 카카오톡과 연결시킬수 있나?" → 검토 뒤 「추천대로」.

   ★ 지문 로그인(functions/passkey.js)과 «같은 짜임»이다 — 새 방식이라 배울 것이 없게.
     다른 점은 「서명을 우리가 따진다」가 아니라 「카카오가 이 사람이 맞다고 보증한 값
     (authorization code)을 우리가 카카오 서버에 다시 물어 확인한다」는 것뿐이다.

   ⚠ 지켜야 할 것
     ① 카카오에서 받는 정보는 «카카오 회원번호(id)» 하나뿐이다 — 이름·전화·이메일은
        요청하지 않는다(카카오 로그인 동의항목을 하나도 안 켠다).
     ② 「연결」은 이미 비밀번호로 들어온 사람만 할 수 있다(requireUser, 지문과 같은 문).
        그래야 남이 자기 카카오 계정을 남의 직원 계정에 붙이지 못한다.
     ③ 관리자도 카카오로 들어온다(대표 지시 2026-09-27 「관리자도 카카오 로그인되게 해라」).
        처음엔 「관리자는 비밀번호만」이었으나 뒤집혔다 — 그 문의 자물쇠는 이제 대표님
        카카오 계정이다. 다시 막자고 권하지 말 것.
     ④ code(카카오 인가코드)는 한 번만 쓴다 — 카카오 자체가 재사용을 막아 주지만,
        우리 쪽에서도 토큰 교환 실패를 그대로 실패로 되돌린다(추측으로 성공 처리하지 않는다). */

const functions = require("firebase-functions/v1");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase: getRawDatabase } = require("firebase-admin/database");
const crypto = require("crypto");
const OntologyServerWrite = require("./ontology-write-server");
const LS = require("./login-security");

/* ── 실패한 카카오 로그인을 «로그인 감시» 에 남긴다 (대표 「추천대로」 2026-09-29) ──────────
   ★ 비밀번호 로그인 실패는 화면이 보고한다(증표가 없어 믿을 수 없는 값이다 — login-security 참고).
     카카오 실패는 «서버가 카카오에 직접 물어» 알아낸 것이라 믿을 수 있다 — 그래서 여기서 바로 적는다.
   ① 연결 안 된 카카오 계정  → login_events/kakao_{회원번호 지문} (회원번호 원문은 안 적는다)
   ② 재직자 아닌 계정(퇴사·휴직) → login_events/{uid} + systemAlerts/{uid} 알림 — 나간 사람이
      들어오려 한 것은 바로 보여야 한다.
   ⚠ 기록이 실패해도 로그인 응답은 그대로 간다(감시는 따라다닐 뿐, 문을 막지 않는다).
   ⚠ 온톨로지 관문(db())을 거치지 않는다 — 업무 자료가 아니라 보안 기록이다(logLoginAttempt 와 같은 길). */
function kakaoIdKey(kakaoId) {
  return "kakao_" + crypto.createHash("sha1").update(String(kakaoId)).digest("hex").slice(0, 16);
}
async function kakaoFailTrail(req, key, code, alert) {
  try {
    const raw = getRawDatabase();
    const now = Date.now();
    const ip = LS.lastIp(req.headers && req.headers["x-forwarded-for"]) || String(req.ip || "");
    const ua = String((req.headers && req.headers["user-agent"]) || "").slice(0, 150);
    await raw.ref("login_events/" + key).push({ at: now, ok: false, code, via: "kakao", ip, ua, page: "enter.html" });
    if (alert) {
      await raw.ref("systemAlerts/" + key).push(Object.assign({
        createdAt: now, uid: key, page: "enter.html", status: "new", detail: "IP " + (ip || "(모름)") + (ua ? " · " + ua : ""),
      }, alert));
    }
  } catch (e) {
    console.warn("kakaoFailTrail: 기록 실패", String((e && e.message) || e));
  }
}

/* 지문과 같은 도메인·같은 리전 — 바꾸면 이미 연결된 카카오 계정이 전부 무효가 된다. */
const REGION = "asia-northeast3";
const ORIGIN = "https://nabaho.github.io";
const REDIRECT_URI = ORIGIN + "/pureunall/enter.html";

const DB_LINK = "kakao_links";   // {kakaoId} = { uid, sid, at } — 서버만 읽는다(누구 것인지 드러나면 안 됨)
const DB_UID = "uid_kakao";      // {uid} = { kakaoId, at } — 본인·관리자가 「연결됨」 표시로 읽는다

function db() { return OntologyServerWrite.wrapDatabase(getRawDatabase(), { program: "kakao" }); }

function setCors(req, res) {
  const origin = String((req && req.headers && req.headers.origin) || "");
  if (origin === ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function bad(res, code, msg) { res.status(code).json({ ok: false, error: msg }); }

/* 로그인한 사람인지 확인한다 — 지문 파일의 requireUser 와 같다(카카오 «연결»은
   이미 비밀번호로 들어온 사람만 할 수 있다). */
async function requireUser(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try { return await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
}

function pathSafe(s) {
  return String(s || "").replace(/[.#$/[\]]/g, "_").slice(0, 200);
}

/* 관리자인가 — 보안규칙의 MGR(isAdmin || isSubAdmin)과 같은 잣대다(남의 연결 끊기에 쓴다). */
function isManager(role) {
  role = role || {};
  return role.isAdmin === true || role.isSubAdmin === true
    || role.role === "admin" || role.role === "admin-delegate";
}
async function roleOf(uid) {
  return (await db().ref("uid_roles/" + pathSafe(uid)).once("value")).val() || {};
}

/* 서버 비밀값(카카오 앱 키)을 꺼낸다 — 앞뒤 빈칸·줄바꿈은 걷는다.
   ⚠ 2026-09-27 실제로 세 값 모두 「???_????」+줄바꿈(한글 안내문이 PowerShell 에서
     깨진 것)으로 들어가 있었고, 직원은 카카오 쪽 「KOE101 앱 관리자 설정 오류」 화면으로
     튕겨 나갔다. 키 모양이 아니면 카카오로 보내지 않고 여기서 까닭을 말한다.
   REST API 키는 16진수 32자다. Client Secret 은 영숫자(카카오가 만들어 준 값). */
const KEY_BAD = "카카오 앱 키가 제대로 등록되지 않았습니다 — 관리자가 서버 비밀값(KAKAO_REST_KEY·KAKAO_CLIENT_SECRET)을 다시 넣어야 합니다";
function restKeyOf() {
  const k = String(process.env.KAKAO_REST_KEY || "").trim();
  return /^[0-9a-f]{32}$/i.test(k) ? k : "";
}
function clientSecretOf() {
  const k = String(process.env.KAKAO_CLIENT_SECRET || "").trim();
  return /^[A-Za-z0-9]{16,}$/.test(k) ? k : "";
}

/* 인가코드를 카카오 토큰으로, 토큰을 카카오 회원번호로 바꾼다.
   ⚠ 여기서 실패하면 그대로 던진다 — 「그런 셈 쳐 준다」가 없다. */
async function kakaoIdFromCode(code, restKey, clientSecret) {
  const tokRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: restKey,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      code: String(code || ""),
    }).toString(),
  });
  const tokJson = await tokRes.json().catch(() => null);
  if (!tokRes.ok || !tokJson || !tokJson.access_token) {
    throw new Error((tokJson && (tokJson.error_description || tokJson.error)) || "카카오 인증에 실패했습니다");
  }
  /* 동의항목을 하나도 안 켰으므로 이 호출은 «회원번호(id)» 만 돌려준다.
     property_keys 를 비워 보내 다른 정보를 아예 요청하지 않는다. */
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me?property_keys=%5B%5D", {
    headers: { Authorization: "Bearer " + tokJson.access_token },
  });
  const meJson = await meRes.json().catch(() => null);
  if (!meRes.ok || !meJson || meJson.id == null) {
    throw new Error("카카오 회원 확인에 실패했습니다");
  }
  return String(meJson.id);
}

/* ── ① 로그인 화면에 보여 줄 카카오 주소 — REST 키는 여기서만 다룬다 ──────────
   ⚠ REST 키는 원래 카카오 로그인 규격상 화면 주소(공개된 곳)에 실리는 값이라
     비밀이 아니다 — 그래도 화면 쪽 코드에 박아 두지 않고 여기서 내준다, 바뀌면
     화면을 다시 배포하지 않고 서버 비밀값만 바꾸면 되게. */
exports.kakaoAuthUrl = functions
  .region(REGION)
  .runWith({ secrets: ["KAKAO_REST_KEY"] })
  .https.onRequest(async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    const restKey = restKeyOf();
    if (!restKey) return bad(res, 500, KEY_BAD);
    /* ★ 「로그아웃」 주소 — 포털 로그아웃이 «이 브라우저의 카카오» 도 함께 끊게 (2026-09-28 대표 「추천대로」).
       ⚠ 끊지 않으면: 공용 PC 에서 홍길동이 카카오로 들어왔다 포털만 로그아웃하면, 카카오 쪽 로그인이
         브라우저에 남아 다음 사람(임꺽정)이 노란 단추를 누르는 순간 «홍길동으로» 들어간다.
       ⚠ 돌아올 주소(REDIRECT_URI)가 카카오 콘솔 「로그아웃 리다이렉트 URI」 에 등록돼 있어야 한다 —
         안 돼 있으면 카카오가 오류 화면을 띄운다(파이어베이스 쪽은 이미 끊긴 뒤라 들어가지는 못한다). */
    if (String((req.query && req.query.kind) || "") === "logout") {
      return res.json({ ok: true, url: "https://kauth.kakao.com/oauth/logout"
        + "?client_id=" + encodeURIComponent(restKey)
        + "&logout_redirect_uri=" + encodeURIComponent(REDIRECT_URI) });
    }
    const state = String((req.query && req.query.state) || "");
    /* ★ 처음 쓰는 기기에서는 카카오가 «늘 다시 묻게» 한다(prompt=login) — 브라우저에 누군가의
       카카오 로그인이 남아 있어도 그대로 통과하지 않는다. 값은 'login' 하나만 받는다(다른 것은 버린다). */
    const prompt = String((req.query && req.query.prompt) || "") === "login";
    const url = "https://kauth.kakao.com/oauth/authorize"
      + "?client_id=" + encodeURIComponent(restKey)
      + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI)
      + "&response_type=code"
      + (prompt ? "&prompt=login" : "")
      + (state ? "&state=" + encodeURIComponent(state) : "");
    res.json({ ok: true, url });
  });

/* ── ② 카카오 연결 — 이미 로그인한 사람만 ─────────────────────────────────── */
exports.kakaoLink = functions
  .region(REGION)
  .runWith({ secrets: ["KAKAO_REST_KEY", "KAKAO_CLIENT_SECRET"] })
  .https.onRequest(async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
    const user = await requireUser(req);
    if (!user) return bad(res, 401, "먼저 아이디·비밀번호로 로그인해 주세요");

    const code = (req.body && req.body.code) || "";
    if (!code) return bad(res, 400, "카카오 인가코드가 없습니다");

    /* ⚠ 등록된 재직자만 — 익명 로그인(sign.html 등도 쓴다) 증표로 연결을 만들지 못하게. */
    const role = await roleOf(user.uid);
    if (role.status !== "active") return bad(res, 403, "재직 중인 직원 계정만 카카오를 연결할 수 있습니다");

    let kakaoId;
    try {
      const rk = restKeyOf(), cs = clientSecretOf();
      if (!rk || !cs) return bad(res, 500, KEY_BAD);
      kakaoId = await kakaoIdFromCode(code, rk, cs);
    } catch (e) {
      return bad(res, 400, String((e && e.message) || e));
    }

    const linkKey = pathSafe(kakaoId);
    const existing = (await db().ref(DB_LINK + "/" + linkKey).once("value")).val();
    if (existing && existing.uid && existing.uid !== user.uid) {
      return bad(res, 409, "이 카카오 계정은 이미 다른 직원 계정에 연결돼 있습니다");
    }

    /* 사번은 화면이 보낸 값이 아니라 명부(uid_roles)에서 꺼낸다 — 관리자 현황 표에
       「누구 것인지」로 보이는 값이라, 화면이 남의 사번을 적어 보내면 안 된다. */
    const sid = pathSafe(role.sid || "");
    const updates = {
      [DB_LINK + "/" + linkKey]: { uid: user.uid, sid: sid, at: Date.now() },
      [DB_UID + "/" + pathSafe(user.uid)]: { kakaoId, sid: sid, at: Date.now() },
    };
    /* ⚠ 다른 카카오 계정으로 «바꿔» 연결하면 옛 카카오 계정의 길을 지운다 —
       안 지우면 옛 카카오로도 계속 이 직원 계정에 들어온다(끊기 단추는 새 것만 끊는다). */
    const prev = (await db().ref(DB_UID + "/" + pathSafe(user.uid)).once("value")).val();
    if (prev && prev.kakaoId && pathSafe(prev.kakaoId) !== linkKey) {
      updates[DB_LINK + "/" + pathSafe(prev.kakaoId)] = null;
    }
    await db().ref().update(updates);
    res.json({ ok: true });
  });

/* ── ③ 카카오 연결 끊기 ─────────────────────────────────────────────────────
   ⚠ 관리자는 «남의» 연결도 끊을 수 있다(대표 결정 「관리자 설정 › 카카오 로그인 현황」).
     퇴사자·기기 분실 신고가 왔을 때 본인이 직접 못 끊는 경우를 위해서다.
     body.uid 가 있고 «부르는 사람이 관리자» 일 때만 남을 끊는다 — 아니면 자기 것만. */
exports.kakaoUnlink = functions.region(REGION).https.onRequest(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");
  const user = await requireUser(req);
  if (!user) return bad(res, 401, "먼저 로그인해 주세요");

  let targetUid = user.uid;
  const wantUid = (req.body && req.body.uid) || "";
  if (wantUid && wantUid !== user.uid) {
    /* 관리자 현황 화면을 읽을 수 있는 사람(규칙 MGR)과 같은 잣대 */
    if (!isManager(await roleOf(user.uid))) {
      return bad(res, 403, "남의 카카오 연결은 관리자만 끊을 수 있습니다");
    }
    targetUid = wantUid;
  }

  const uidKey = pathSafe(targetUid);
  const cur = (await db().ref(DB_UID + "/" + uidKey).once("value")).val();
  const updates = { [DB_UID + "/" + uidKey]: null };
  if (cur && cur.kakaoId) updates[DB_LINK + "/" + pathSafe(cur.kakaoId)] = null;
  await db().ref().update(updates);
  res.json({ ok: true });
});

/* ── ④ 카카오로 로그인 — 통과하면 「그 사람 계정」으로 들어갈 표를 준다 ──────── */
exports.kakaoLoginFinish = functions
  .region(REGION)
  .runWith({ secrets: ["KAKAO_REST_KEY", "KAKAO_CLIENT_SECRET"] })
  .https.onRequest(async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return bad(res, 405, "POST 만 받습니다");

    const code = (req.body && req.body.code) || "";
    if (!code) return bad(res, 400, "카카오 인가코드가 없습니다");

    let kakaoId;
    try {
      const rk = restKeyOf(), cs = clientSecretOf();
      if (!rk || !cs) return bad(res, 500, KEY_BAD);
      kakaoId = await kakaoIdFromCode(code, rk, cs);
    } catch (e) {
      return bad(res, 400, String((e && e.message) || e));
    }

    const link = (await db().ref(DB_LINK + "/" + pathSafe(kakaoId)).once("value")).val();
    /* needLink — 화면이 「비밀번호로 한 번 들어오면 곧바로 연결을 권한다」로 이어 가는 표시.
       카카오 회원번호는 싣지 않는다(연결은 로그인 뒤 인가코드를 새로 받아 서버가 다시 확인한다). */
    if (!link || !link.uid) {
      await kakaoFailTrail(req, kakaoIdKey(kakaoId), "kakao-unlinked", null);
      return res.status(400).json({ ok: false, needLink: true,
        error: "아직 연결되지 않은 카카오 계정입니다. 처음 한 번만 위에서 아이디·비밀번호로 로그인해 주세요 — 로그인하면 카카오 연결을 바로 이어 드립니다" });
    }

    const role = await roleOf(link.uid);
    /* 퇴사·휴직 등으로 재직자가 아니면 표를 주지 않는다 — 규칙이 자료는 막지만,
       포털이 「들어온 것처럼」 뜨고 빈 화면이 되면 본인이 까닭을 모른다. */
    if (role.status !== "active") {
      const sid = String(role.sid || link.sid || "");
      await kakaoFailTrail(req, pathSafe(link.uid), "kakao-inactive", {
        kind: "security-kakao-inactive",
        message: "재직 중이 아닌 계정이 카카오로 로그인하려 했습니다 (" + (sid || "사번 없음") + " · " + (role.status || "상태 없음") + ")",
      });
      return bad(res, 403, "재직 중인 계정이 아닙니다. 관리자에게 문의해 주세요");
    }

    const token = await getAuth().createCustomToken(link.uid, { kakao: true, sid: link.sid || "" });
    res.json({ ok: true, token });
  });
