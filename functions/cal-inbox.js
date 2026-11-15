"use strict";

/* 📥 받은 메일 → «일정 자동 등록 + 후보함» (푸른 캘린더 · 구글 공용 달력)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-24 → 2026-11-11 · 2026-11-15 확대:
   「회의·강의·기관 조사 등 참여 요청 공문이 메일로 오면 반드시 확인해 날짜·시간·회의내용·주소·담당자 연락처를
     푸른캘린더와 구글캘린더에 자동으로 입력하고, 기존에 동일한 시간 회의가 있으면 고쳐서 내용을 채워 넣어라.」

   ★ 하는 일
     ① 받은메일함에 «이번 회차에 새로 온» 줄 가운데 일정이 있어 보이는 것만 골라, 본문 앞부분과
        첨부 공문(.pdf·.hwp·.hwpx·.docx)의 글(주민번호·계좌는 가린 뒤)을 AI(Gemini)에게 보내 초안을 뽑는다.
     ② 날짜가 확정된 회의·강의·조사·방문 등 일정(오늘 이후 · [마감] 제외)은 푸른캘린더(data/my_schedules/v)와
        구글 공용 달력(GCAL_CAL_ID)에 곧바로 넣는다.
        · 같은 날·같은 시작 시각(또는 시간 미기재였으나 같은 기관·회의명)의 기존 대표 일정이 이미 있으면
          새 줄을 덧만들지 않고 «기존 일정을 고쳐» 시간·종료시각·주소(장소)·담당자 연락처·회의내용을 채운다.
     ③ 제출 기한([마감])이나 지난 날짜 건은 저절로 달력에 넣지 않고 후보함(cal_inbox/cand, status:'new')에 남겨
        사람이 확인하게 한다. 자동 등록된 건은 status:'added' · autoAdded:true 로 기록된다.
   ★★ 본문·첨부 원본은 «저장하지 않는다» — 그 자리에서 읽어 AI 에 보내고 버린다.
   ★ AI 의 답을 다시 걸러내는 규칙은 화면(캡처 기능)과 «한 벌»이다
     (js/pu-cal-capture.js → functions/cal-lib/ 사본 · scripts/sync-cal-lib.js · tests/cal-inbox.test.js).
   ⚠ 실패해도 절대 던지지 않는다 — 일정 등록이 실패해도 메일 동기화는 멀쩡해야 한다.
   ⚠ 한 회차·하루 한도 + 이번 달 AI 요금 한도(readDoc 과 같은 셈)를 넘으면 멈춘다. */

const DR = require("./doc-read");
const MB = require("./mail-box");
const NI = require("./mail-new-inquiry");
const CAP = require("./cal-lib/pu-cal-capture");
const REDACT = require("./rules-collect-redact");
const GPROXY = require("./gcal-proxy");
const GARCH = require("./gcal-archive");

const MAIL_ROOT = "pucards";
const ROOT = "cal_inbox";
const APP = CAP.APP;                         /* 'cal' — 사용량 셈이 «푸른캘린더» 칸으로 쌓인다 */
const KEEP_DAYS = 30;                        /* 후보는 30일 뒤 지운다 */
const OWNER_SID = "P-001";
const DEFAULTS = { on: false, autoAdd: false, perRunMax: 8, dayLimit: 40 };

/* 본문 앞부분 — 글(text/plain)은 6KB, html 은 꼬리표가 많아 14KB. 글자로는 3,500자까지만 쓴다 */
const BODY_TEXT_BYTES = 6000;
const BODY_HTML_BYTES = 14000;
const BODY_CHARS = 3500;
/* 첨부 공문 — 4MB 이하 문서 최대 2개까지만 그 자리에서 읽어 주민번호·계좌·신분증을 가린 «글만» 뽑고 원본 바이트는 버린다 */
const ATT_MAX_FILES = 2;
const ATT_MAX_BYTES = 4 * 1024 * 1024;
const ATT_TEXT_CHARS = 3500;
const SAFETY_MS = 20000;                     /* 마감까지 이만큼은 남아야 AI 를 부른다 */

/* ── 일정이 있어 보이는 메일만 AI 에 보낸다 ────────────────────────────────
   ⚠ 광고·자동발송(noreply 등)은 AI 에 안 보낸다 — mail-new-inquiry 와 같은 잣대. */
const SCHED_WORDS = /개최|일시|일정|회의|보고회|미팅|방문|강의|특강|강연|강사|교육|세미나|설명회|워크숍|워크샵|간담회|심의|위원회|인사위원회|자문위원회|징계|심사|조사|기관\s*조사|출석|청문|조정|심판|모니터링|점검|면담|행사|연수|총회|공청회|마감|제출|기한|참석|초대|발표|포럼|컨퍼런스/;
const DATE_CUE = /\d{1,2}\s*월\s*\d{1,2}\s*일|(^|[^\d])\d{1,2}\/\d{1,2}([^\d]|$)|\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2}|내일|모레|다음\s*주|이번\s*주|\d{1,2}\s*:\s*\d{2}|오[전후]\s*\d{1,2}\s*시|\d{1,2}\s*시(?!간)/;

function looksScheduly(row) {
  const e = String((row && row.e) || "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 1) return false;
  const s = String((row && row.s) || "");
  if (!s.trim()) return false;
  if (NI.AD_RE.test(s) || /^\s*[\[(]\s*광고\s*[\])]/.test(s)) return false;
  if (NI.BOT_RE.test(e.slice(0, at))) return false;
  const an = Array.isArray(row && row.an) ? row.an.join(" ") : "";
  const blob = s + " " + an;
  return SCHED_WORDS.test(blob) || DATE_CUE.test(blob + " " + String((row && row.p) || ""));
}

function clampInt(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function loadGate(db) {
  let v = {};
  try { v = (await db.ref(MAIL_ROOT + "/config/calInbox").once("value")).val() || {}; }
  catch (e) {
    console.warn("calInbox 설정을 못 읽었습니다(꺼진 채로 봅니다):", String((e && e.message) || e));
    return { on: false, autoAdd: false, perRunMax: DEFAULTS.perRunMax, dayLimit: DEFAULTS.dayLimit };
  }
  return {
    on: v.on === true,
    autoAdd: v.autoAdd === true,
    perRunMax: clampInt(v.perRunMax, DEFAULTS.perRunMax, 1, 30),
    dayLimit: clampInt(v.dayLimit, DEFAULTS.dayLimit, 1, 300),
  };
}

/* 이번 달 AI 요금 한도 — index.js 의 aiMonthSpend 와 «같은 셈» */
async function monthOver(db) {
  try {
    const [n, b] = await Promise.all([db.ref(DR.aiMonthPath()).once("value"), db.ref(DR.AI_BUDGET_PATH).once("value")]);
    const budget = DR.aiBudgetOf(b.val());
    const spent = DR.aiSpentWon(n.val(), budget.wonPerRead);
    return budget.limit > 0 && spent >= budget.limit;
  } catch (e) {
    console.warn("cal-inbox 달 요금을 못 읽었습니다(막지 않습니다):", String((e && e.message) || e));
    return false;
  }
}

async function dayUsed(db, ymd) {
  try { return Number((await db.ref("ai_read_tally/" + ymd + "/" + APP + "/n").once("value")).val()) || 0; }
  catch (e) { return 0; }
}

async function bumpTally(db, ymd) {
  try {
    await Promise.all(DR.tallyPaths(APP, ymd || null, "n").map((p) => db.ref(p).transaction((cur) => (Number(cur) || 0) + 1)));
  } catch (e) { console.warn("cal-inbox 판독 셈 적기 실패(후보는 계속):", String((e && e.message) || e)); }
}

function replyText(json) {
  const parts = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
  return parts.map((p) => (p && p.text) || "").join("").replace(/```json|```/g, "").trim();
}

/* 본문 앞부분을 더 받는다 */
async function fetchBodyText(client, g) {
  const tp = g && g.tp;
  if (!client || !tp || !tp.part) return "";
  try {
    const maxLen = tp.html ? BODY_HTML_BYTES : BODY_TEXT_BYTES;
    let buf = null;
    for await (const m of client.fetch(String(g.row.u), { uid: true, bodyParts: [{ key: tp.part, start: 0, maxLength: maxLen }] }, { uid: true })) {
      const bp = m.bodyParts;
      buf = !bp ? null : (typeof bp.get === "function" ? bp.get(tp.part) : bp[tp.part]);
    }
    return buf ? MB.previewFrom(buf, tp, BODY_CHARS) : "";
  } catch (e) {
    console.warn("cal-inbox 본문을 못 받았습니다(미리보기로 갑니다):", String((e && e.message) || e).slice(0, 160));
    return "";
  }
}

function attExt(name) {
  const m = /\.([a-z0-9]{2,6})$/i.exec(String(name || "").trim());
  return m ? m[1].toLowerCase() : "";
}

async function drainLimited(stream, maxBytes) {
  if (!stream) return null;
  if (Buffer.isBuffer(stream)) return stream.length <= maxBytes ? stream : null;
  if (stream instanceof Uint8Array) return stream.byteLength <= maxBytes ? Buffer.from(stream) : null;
  const chunks = [];
  let total = 0;
  for await (const ch of stream) {
    const b = Buffer.isBuffer(ch) ? ch : Buffer.from(ch);
    total += b.length;
    if (total > maxBytes) return null;
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

/* 첨부 공문(.pdf·.hwp·.hwpx·.docx)에서 글을 뽑는다 — 본문에 "붙임과 같이 개최"만 적힌 공공기관 공문 대응.
   ⚠ 비식별화 전 원본 문서 바이트(inline_data)는 절대 외부 AI 로 보내지 않는다(스캔 PDF 등은 건너뜀). */
async function fetchAttExtra(client, g) {
  const out = { text: "" };
  if (!client || typeof client.download !== "function" || !g || !g.row) return out;
  const atts = Array.isArray(g.atts) ? g.atts : [];
  const targets = atts.filter((a) => {
    if (!a || !a.part) return false;
    const ext = attExt(a.name);
    if (!/^(pdf|hwp|hwpx|docx)$/.test(ext)) return false;
    const sz = Number(a.size || 0);
    return !(sz > ATT_MAX_BYTES);
  }).slice(0, ATT_MAX_FILES);
  if (!targets.length) return out;

  const chunks = [];
  for (const a of targets) {
    try {
      const d = await client.download(String(g.row.u), String(a.part), { uid: true });
      const buf = await drainLimited(d && d.content, ATT_MAX_BYTES);
      if (!buf || !buf.length) continue;
      const ext = attExt(a.name);
      const parsed = await REDACT.readScheduleText(buf, ext);
      if (parsed && parsed.ok && parsed.text) {
        chunks.push("[첨부문서: " + CAP.scrubText(String(a.name || ext)).slice(0, 120) + "]\n" + CAP.scrubText(parsed.text).slice(0, ATT_TEXT_CHARS));
      }
    } catch (e) {
      console.warn("cal-inbox 첨부 읽기 실패(계속):", attExt(a && a.name), String((e && e.message) || e).slice(0, 120));
    }
  }
  out.text = chunks.join("\n\n");
  return out;
}

function ymdOfMs(ms, fallback) {
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  return DR.ymdKST(ms);
}

function candId(slug, u, i) {
  return String(slug || "").slice(-8).replace(/[^A-Za-z0-9]/g, "x") + "_" + Number(u) + "_" + i;
}

function recordOf(row, slug, i, d, now, baseYmd) {
  return {
    id: candId(slug, row.u, i),
    at: now,
    status: "new",
    base: baseYmd,
    mail: {
      slug: String(slug || ""), u: Number(row.u) || 0,
      e: String(row.e || "").slice(0, 160), f: String(row.f || "").slice(0, 120),
      s: String(row.s || "").slice(0, 160), d: Number(row.d) || 0,
    },
    ev: {
      title: d.title, date: d.date, endDate: d.endDate, time: d.time, endTime: d.endTime,
      place: d.place, contact: d.contact, note: d.note,
    },
    missing: d.missing || [],
    warns: d.warns || [],
  };
}

/* ── 자동 달력 등록 & 동일 시간 기존 일정 병합 (2026-11-15 대표 지시) ── */
const GENERIC_TITLE_RE = /^(회의|미팅|강의|특강|교육|세미나|위원회|인사위원회|인사관리위원회|조사|기관조사|출석|면담|상담|방문|출장|심의|일정|행사|간담회|설명회)$/;
const KW_STOP = new Set([
  "회의", "미팅", "강의", "특강", "교육", "세미나", "설명회", "간담회", "워크숍", "워크샵",
  "위원회", "개최", "알림", "안내", "참석", "요청", "협조", "공문", "제출", "일정", "관련",
  "컨설팅", "보고회", "중간보고회", "최종보고회", "착수보고회", "선정", "심사", "심의", "출석",
]);

function stripUrls(s) {
  return String(s || "")
    .replace(/https?:\/\/\S+/gi, "[링크제거]")
    .replace(/\bwww\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}\S*/gi, "[링크제거]")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeDraft(d) {
  const src = d || {};
  return Object.assign({}, src, {
    title: stripUrls(src.title),
    place: stripUrls(src.place),
    contact: stripUrls(src.contact),
    note: stripUrls(src.note),
  });
}

/* 발신자 검증 — ① 수신 메일서버(daum.net·hanmail.net·kakao.com)의 Authentication-Results 헤더가 존재하고,
   ② From 도메인과 정렬(organizational domain 일치)된 DMARC 통과 또는 정렬된 SPF/DKIM 통과가 확인되며,
   ③ 공공·교육·연구기관 도메인(.go.kr·korea.kr·.or.kr·.ac.kr·.re.kr) 또는 우리 거래처·명함·공단연락처·직원 명단에 등록된 발신자만 자동 달력 반영한다.
   헤더 누락·외부 위조 헤더·타 도메인 SPF/DKIM 통과·미등록 발신자는 달력을 저절로 고치지 않고 후보함(status:'new')에만 남긴다. */
const TRUSTED_MX_RE = /(?:^|\.)(daum\.net|hanmail\.net|kakao\.com)$/i;
const KR_SLD = new Set([
  "co", "go", "or", "ac", "re", "ne", "pe", "es", "ms", "hs", "kg", "sc", "mil",
  "seoul", "busan", "daegu", "incheon", "gwangju", "daejeon", "ulsan", "sejong",
  "gyeonggi", "gangwon", "chungbuk", "chungnam", "jeonbuk", "jeonnam", "gyeongbuk", "gyeongnam", "jeju",
]);
const CCTLD_PUBLIC_SLD = new Set([
  "co", "com", "org", "or", "net", "ne", "gov", "go", "edu", "ac", "mil",
  "re", "pe", "ltd", "plc", "me", "lg", "ad", "ed", "gr", "id", "asn", "nhs", "sch", "mod", "gob", "nic",
]);
const MULTI_TENANT_SUFFIX = new Set([
  "eu.org", "github.io", "gitlab.io", "bitbucket.io", "appspot.com", "web.app", "firebaseapp.com",
  "pages.dev", "workers.dev", "vercel.app", "netlify.app", "herokuapp.com",
  "cloudfront.net", "amazonaws.com", "azurewebsites.net", "onrender.com", "blogspot.com", "wordpress.com",
]);

function domPartOf(v) {
  const s = String(v || "").trim().replace(/^<|>$/g, "").replace(/^["']|["']$/g, "");
  const at = s.lastIndexOf("@");
  const raw = (at >= 0 ? s.slice(at + 1) : s).toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!raw) return "";
  try {
    const u = require("node:url");
    const asc = typeof u.domainToASCII === "function" ? u.domainToASCII(raw) : raw;
    return String(asc || "").toLowerCase();
  } catch (_) {
    return raw;
  }
}

function isBarePublicHost(d) {
  if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return true;
  if (MULTI_TENANT_SUFFIX.has(d)) return true;
  const parts = d.split(".");
  if (parts.length < 2) return true;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld === "kr" && KR_SLD.has(sld) && parts.length < 3) return true;
  if (tld.length === 2 && tld !== "kr" && CCTLD_PUBLIC_SLD.has(sld) && parts.length < 3) return true;
  return false;
}

/* Public Suffix List 의 PRIVATE 구역(eu.org 등)까지 포함한 타 테넌트 도메인 우회를 원천 차단하기 위해
   모든 도메인에서 «정확히 같은 호스트(exact host match)»만 정렬 통과로 인정한다(fail-closed).
   서브도메인 불일치 건은 자동 달력 수정 대신 후보함(status:'new')에 남겨 사람이 확인한다. */
function domAligned(cand, fromDom) {
  const ca = domPartOf(cand);
  const fb = domPartOf(fromDom);
  if (isBarePublicHost(ca) || isBarePublicHost(fb)) return false;
  return ca === fb;
}

function hasAlignedMailAuth(authHdr, fromDom) {
  const raw = String(authHdr || "").replace(/\r?\n[ \t]+/g, " ").trim();
  if (!raw || !fromDom) return false;
  if (/^received-spf\s*:\s*(fail|softfail|permerror|temperror)\b/im.test(raw)) return false;
  const blocks = [];
  raw.split(/\r?\n/).forEach((line) => {
    const m = /^authentication-results\s*:\s*(.+)$/i.exec(line.trim());
    if (m) blocks.push(m[1].trim());
  });
  if (!blocks.length) return false;

  /* 수신 서버(Daum/Kakao MX)가 맨 위에 덧붙인 최상단 Authentication-Results 블록 하나만 신뢰한다.
     아래쪽에 공격자가 미리 끼워 넣은 두 번째 헤더로는 실패 결과를 덮어쓸 수 없다. */
  const topBlk = blocks[0];
  const segs = topBlk.split(";").map((x) => x.trim()).filter(Boolean);
  if (segs.length < 2) return false;
  const authServ = segs[0].replace(/\s*\([^)]*\)/g, "").split(/[/:;\s]/)[0].toLowerCase();
  if (!TRUSTED_MX_RE.test(authServ)) return false;

  const clauses = segs.slice(1);
  let dmarcFail = false;
  let spfAligned = false;
  let dkimAligned = false;
  let dmarcExplicitAligned = false;

  for (const cl of clauses) {
    if (/\bdmarc\s*=\s*(fail|quarantine|reject|permerror|temperror)\b/i.test(cl)) {
      dmarcFail = true;
    }
    if (/\bspf\s*=\s*pass\b/i.test(cl)) {
      const mf = /\b(?:smtp\.mailfrom|envelope-from)\s*=\s*([^\s;()]+)/i.exec(cl);
      if (mf && domAligned(mf[1], fromDom)) spfAligned = true;
    }
    if (/\bdkim\s*=\s*pass\b/i.test(cl)) {
      const dd = /\bheader\.d\s*=\s*([^\s;()]+)/i.exec(cl);
      const di = /\bheader\.i\s*=\s*([^\s;()]+)/i.exec(cl);
      const cand = (dd && dd[1]) || (di && di[1]) || "";
      if (cand && domAligned(cand, fromDom)) dkimAligned = true;
    }
    if (/\bdmarc\s*=\s*pass\b/i.test(cl)) {
      const hf = /\bheader\.from\s*=\s*([^\s;()]+)/i.exec(cl);
      if (hf && domAligned(hf[1], fromDom)) dmarcExplicitAligned = true;
    }
  }
  if (dmarcFail) return false;
  return !!(spfAligned || dkimAligned || dmarcExplicitAligned);
}

async function loadTrustedSenders(db, readCompanies) {
  const addrs = {}, doms = {}, keys = {};
  try {
    const [cos, items, users, mailCo, mailWho, agency] = await Promise.all([
      readCompanies ? readCompanies().then((v) => ({ val: () => v })) : db.ref("data/companies/v").once("value"),
      db.ref(MAIL_ROOT + "/items").once("value"),
      db.ref("data/user_accounts/v").once("value"),
      db.ref(MAIL_ROOT + "/config/mailCo").once("value"),
      db.ref(MAIL_ROOT + "/config/mailWho").once("value"),
      db.ref("pu_docs/agency/list").once("value"),
    ]);
    NI.collectEmails(cos.val(), addrs, doms);
    NI.collectEmails(items.val(), addrs, doms);
    NI.collectEmails(users.val(), addrs, doms);
    NI.collectEmails(agency.val(), addrs, doms);
    [mailCo, mailWho].forEach((s) => { Object.keys(s.val() || {}).forEach((k) => { keys[k] = 1; }); });
  } catch (e) {
    console.warn("cal-inbox 발신자 대조표 읽기 실패(공공기관 도메인만 허용):", String((e && e.message) || e).slice(0, 120));
  }
  return { addrs, doms, keys };
}

function isTrustedSender(row, authHdr, trusted) {
  const e = String((row && row.e) || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return false;
  const d = e.slice(at + 1);
  if (!hasAlignedMailAuth(authHdr, d)) return false;
  if (d && NI.PUB_TAIL.test(d)) return true;
  if (!trusted) return false;
  if (trusted.addrs[e] || trusted.keys[NI.whoKey(e)]) return true;
  if (!d || NI.PUB_DOM.indexOf(d) >= 0) return false;
  return !!(trusted.doms[d] || trusted.keys[NI.whoKey("@" + d)]);
}

function isAutoSchedulable(d, today) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return false;
  if (String(d.date) < String(today || "")) return false;
  const t = String(d.title || "").trim();
  if (!t || /^\[마감\]/.test(t)) return false;
  return true;
}

function hmNorm(v) {
  const s = String(v || "").trim();
  if (!/^\d{2}:\d{2}/.test(s)) return "";
  const hm = s.slice(0, 5);
  return hm === "00:00" ? "" : hm;
}

function stripTimePrefix(title) {
  return String(title || "")
    .replace(/^\s*\d{3,4}(?:\s*[-~]\s*\d{3,4})?\s+/, "")
    .replace(/^\s*\d{1,2}:\d{2}(?:\s*[-~]\s*\d{1,2}:\d{2})?\s+/, "")
    .trim();
}

function withTimePrefix(time, endTime, bodyTitle) {
  const core = stripTimePrefix(bodyTitle) || String(bodyTitle || "").trim();
  const st = hmNorm(time);
  if (!st) return core;
  const p1 = st.replace(":", "");
  const et = hmNorm(endTime);
  const p2 = et ? "-" + et.replace(":", "") : "";
  return (p1 + p2 + " " + core).trim();
}

function keywordsOf(title) {
  const core = stripTimePrefix(title);
  const toks = core.split(/[^가-힣A-Za-z0-9]+/).map((w) => w.trim()).filter(Boolean);
  return toks.filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !/^\d+년$|^\d+회$|^\d+차$/.test(w) && !KW_STOP.has(w));
}

function sameTopic(aTitle, bTitle) {
  const ka = keywordsOf(aTitle);
  const kb = new Set(keywordsOf(bTitle));
  return ka.some((w) => kb.has(w));
}

function mergeLineField(oldVal, newVal, sep) {
  const a = String(oldVal || "").trim();
  const b = stripUrls(newVal);
  if (!b) return a;
  if (!a) return b;
  const an = a.replace(/\s+/g, "");
  const bn = b.replace(/\s+/g, "");
  if (an === bn || an.includes(bn)) return a;
  if (bn.includes(an)) return b;
  return (a + (sep || " · ") + b).slice(0, 300);
}

function buildMailNote(note, row) {
  const lines = [];
  const n = stripUrls(note);
  if (n) lines.push(n);
  const subj = stripUrls((row && row.s) || "");
  const from = stripUrls((row && (row.f || row.e)) || "");
  if (subj) lines.push("[메일 자동입력] " + subj + (from ? " (" + from + ")" : ""));
  return lines.join("\n").slice(0, 3500);
}

/* 기존 일정(cur)과 메일에서 뽑은 초안(d)을 합쳐 빈칸·부족한 내용을 채운다.
   ⚠ 사람이 이미 적어 둔 시작·종료 시각(c.time·c.endTime)은 보존하고 비어 있을 때만 메일 값으로 채운다. */
function mergeEventFields(cur, d, row) {
  const c = cur || {};
  const sd = sanitizeDraft(d);
  const time = hmNorm(c.time) || hmNorm(sd.time);
  const endTime = time ? (hmNorm(c.endTime) || hmNorm(sd.endTime)) : "";
  const endDate = String(c.endDate || sd.endDate || "");
  const oldCore = stripTimePrefix(c.title);
  const newCore = stripTimePrefix(sd.title);
  let core = oldCore;
  if (!oldCore || GENERIC_TITLE_RE.test(oldCore.replace(/\s+/g, ""))) {
    core = newCore || oldCore;
  } else if (newCore) {
    const on = oldCore.replace(/\s+/g, "");
    const nn = newCore.replace(/\s+/g, "");
    if (nn.includes(on)) core = newCore;
    else if (on.includes(nn)) core = oldCore;
    else core = (oldCore + " (" + newCore + ")").slice(0, 160);
  }
  const title = withTimePrefix(time, endTime, core).slice(0, 300);
  const place = mergeLineField(c.place, sd.place, " / ");
  const contact = mergeLineField(c.contact, sd.contact, " / ");

  const oldNote = String(c.note || "").trim();
  const addNote = buildMailNote(sd.note, row);
  let note = oldNote;
  if (addNote) {
    const addLines = addNote.split("\n").filter((ln) => ln.trim() && !oldNote.includes(ln.trim()));
    if (addLines.length) note = (oldNote ? oldNote + "\n" : "") + addLines.join("\n");
  }
  return {
    date: String(c.date || sd.date || ""),
    endDate: endDate > String(c.date || sd.date || "") ? endDate : "",
    time: time,
    endTime: endTime,
    title: title || String(sd.title || c.title || "").slice(0, 300),
    place: place,
    contact: contact,
    note: note.slice(0, 3800),
    sid: OWNER_SID,
  };
}

function gcalItemToFields(item, mailSid) {
  if (!item || item.status === "cancelled") return null;
  const st = item.start || {};
  const en = item.end || {};
  let date = "", time = "", endTime = "", endDate = "";
  if (st.dateTime) {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(st.dateTime));
    if (m) { date = m[1]; time = hmNorm(m[2]); }
    const me = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(en.dateTime || ""));
    if (me) { if (me[1] > date) endDate = me[1]; endTime = hmNorm(me[2]); }
  } else if (st.date) {
    date = String(st.date).slice(0, 10);
  }
  if (!date) return null;
  const sp = GPROXY.splitDesc(item.description || "");
  const sid = GPROXY.ownerOf(item, mailSid) || "";
  return {
    gcalId: String(item.id || ""),
    raw: item,
    sid: sid,
    date: date,
    endDate: endDate,
    time: time,
    endTime: endTime,
    title: String(item.summary || "").trim(),
    place: String(item.location || "").trim(),
    contact: sp.contact || "",
    note: sp.note || "",
  };
}

function matchesExisting(ev, d) {
  if (!ev || ev._deleted || ev.externalId) return false;
  if (String(ev.date || "") !== String(d.date || "")) return false;
  if (String(ev.sid || "") !== OWNER_SID) return false;
  const t1 = hmNorm(ev.time);
  const t2 = hmNorm(d.time);
  if (t1 && t2 && t1 === t2) return true;
  if ((!t1 || !t2) && sameTopic(ev.title, d.title)) return true;
  return false;
}

async function initSchedCtx(db, fetchFn) {
  const ctx = { loaded: false, map: {}, gcalOk: false, at: "", nameOf: () => "", mailSid: {}, gcalByDate: {} };
  try {
    ctx.map = (await db.ref("data/my_schedules/v").once("value")).val() || {};
    ctx.loaded = true;
  } catch (e) { ctx.map = {}; }

  const hasSecret = !!String(process.env.GCAL_OAUTH_SECRET || "").trim();
  if (!hasSecret || typeof fetchFn !== "function") return ctx;
  try {
    const roles = (await db.ref("uid_roles").once("value")).val() || {};
    const uid = Object.keys(roles).find((u) => roles[u] && String(roles[u].sid) === OWNER_SID && String(roles[u].status) === "active");
    if (!uid) return ctx;
    const tok = (await db.ref("gcal_tokens/" + uid).once("value")).val();
    if (!tok || !tok.rt) return ctx;
    let linkMod = null;
    try { linkMod = require("./gcal-link")._test; } catch (_) { linkMod = null; }
    const proxy = GPROXY({
      functions: { region: () => ({ runWith: () => ({ database: { ref: () => ({ onWrite: () => null }) }, https: { onRequest: () => null } }) }) },
      getDatabase: () => db,
      fetch: fetchFn,
      secretOf: (linkMod && linkMod.secretOf) || (() => String(process.env.GCAL_OAUTH_SECRET || "").trim()),
      clientId: (linkMod && linkMod.CLIENT_ID) || "30712196914-1qc61a41ptmo6u7hbk71i70g00k3a8lk.apps.googleusercontent.com",
    });
    ctx.at = await proxy.ownerAccess(db);
    const ud = (await db.ref("data/user_dir/v").once("value")).val() || {};
    const nm = {};
    (Array.isArray(ud) ? ud : Object.values(ud)).forEach((u) => { if (u && u.sid) nm[u.sid] = String(u.name || ""); });
    ctx.nameOf = (sid) => nm[sid] || "";
    ctx.mailSid = (await db.ref("data/gcal_mail_sid/v").once("value")).val() || {};
    ctx.gcalOk = !!ctx.at;
  } catch (e) {
    console.warn("cal-inbox 구글 달력 연결 확인 실패(내부 일정표로만 진행):", String((e && e.message) || e).slice(0, 160));
  }
  return ctx;
}

async function gcalEventsOnDate(ctx, fetchFn, ymd) {
  if (!ctx.gcalOk) return [];
  if (ctx.gcalByDate[ymd]) return ctx.gcalByDate[ymd];
  try {
    const url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GARCH.CAL_ID)
      + "/events?singleEvents=true&maxResults=100"
      + "&timeMin=" + encodeURIComponent(ymd + "T00:00:00+09:00")
      + "&timeMax=" + encodeURIComponent(ymd + "T23:59:59+09:00");
    const r = await fetchFn(url, { headers: { Authorization: "Bearer " + ctx.at } });
    const j = await r.json().catch(() => null);
    const items = (r.ok && j && Array.isArray(j.items)) ? j.items : [];
    ctx.gcalByDate[ymd] = items;
    return items;
  } catch (e) {
    ctx.gcalByDate[ymd] = [];
    return [];
  }
}

async function gcalPostNew(ctx, fetchFn, rec, id) {
  if (!ctx.gcalOk) return "";
  try {
    const ev = GPROXY.eventOf(rec, id, ctx.nameOf);
    if (!ev) return "";
    const body = GPROXY.bodyOf(ev);
    const r = await fetchFn("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GARCH.CAL_ID) + "/events?sendUpdates=none", {
      method: "POST",
      headers: { Authorization: "Bearer " + ctx.at, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.id) {
      if (ctx.gcalByDate[rec.date]) ctx.gcalByDate[rec.date].push(j);
      return String(j.id);
    }
  } catch (e) {
    console.warn("cal-inbox 구글 달력 새 일정 넣기 실패(내부 일정표에는 남김):", String((e && e.message) || e).slice(0, 160));
  }
  return "";
}

async function gcalPutMerged(ctx, fetchFn, eid, curRaw, merged) {
  if (!ctx.gcalOk || !eid) return false;
  try {
    let raw = curRaw;
    if (!raw) {
      const gr = await fetchFn("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GARCH.CAL_ID) + "/events/" + encodeURIComponent(eid), {
        headers: { Authorization: "Bearer " + ctx.at },
      });
      raw = await gr.json().catch(() => null);
      if (!gr.ok || !raw || !raw.id) return false;
    }
    const body = GPROXY.mergedEvent(raw, merged, ctx.nameOf);
    const r = await fetchFn("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GARCH.CAL_ID) + "/events/" + encodeURIComponent(eid) + "?sendUpdates=none", {
      method: "PUT",
      headers: { Authorization: "Bearer " + ctx.at, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.id) {
      const list = ctx.gcalByDate[merged.date];
      if (Array.isArray(list)) {
        const idx = list.findIndex((x) => x && x.id === eid);
        if (idx >= 0) list[idx] = j;
      }
      return true;
    }
  } catch (e) {
    console.warn("cal-inbox 구글 달력 일정 고치기 실패:", String((e && e.message) || e).slice(0, 160));
  }
  return false;
}

async function gcalDeleteEvent(ctx, fetchFn, eid) {
  if (!ctx.gcalOk || !eid) return false;
  try {
    const r = await fetchFn("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GARCH.CAL_ID) + "/events/" + encodeURIComponent(eid) + "?sendUpdates=none", {
      method: "DELETE",
      headers: { Authorization: "Bearer " + ctx.at },
    });
    return !!(r && (r.ok || r.status === 204 || r.status === 410));
  } catch (e) {
    console.warn("cal-inbox 구글 달력 보상 삭제 실패:", String((e && e.message) || e).slice(0, 160));
    return false;
  }
}

async function txWriteSchedule(db, key, computeFn, now) {
  let latest = null;
  const res = await db.ref("data/my_schedules/v/" + key).transaction((cur) => {
    const next = computeFn(cur);
    latest = next === undefined ? cur : next;
    return next;
  });
  if (res && res.committed === false) return null;
  const saved = (res && res.snapshot && typeof res.snapshot.val === "function") ? res.snapshot.val() : latest;
  await db.ref("data/my_schedules/u").set(now);
  return saved;
}

async function queueGcalResync(db, key, job) {
  try { await db.ref(ROOT + "/resync/" + key).set(job); } catch (_) { /* 기록 실패 시 다음 동기화에서 재확인 */ }
}

async function clearGcalResync(db, key) {
  try { await db.ref(ROOT + "/resync/" + key).set(null); } catch (_) { /* 무시 */ }
}

async function readSchedSafe(db, key) {
  try {
    const snap = await db.ref("data/my_schedules/v/" + key).once("value");
    return { ok: true, val: snap.val() };
  } catch (_) {
    return { ok: false, val: undefined };
  }
}

/* 충돌 복구 PUT/DELETE 도중 또 다른 사용자 수정이나 삭제가 끼어들어도 수렴할 때까지(최대 3회)
   동일하게 최신 revision · _deleted 를 재검증하고, 끝내 수렴 못 하거나 요청이 실패하면 지속 재동기화 큐(cal_inbox/resync)로 넘긴다.
   ⚠ RTDB 읽기 실패(!rd.ok)는 절대 삭제(null)로 오인하지 않는다 — 외부 PUT/DELETE 및 큐 해제를 즉시 중단하고 기존 eid 를 보존해 큐에 저장한다. */
async function reconcileConflictToGcal(db, ctx, fetchFn, key, eid, isNewPost, now) {
  let pendingNewPost = !!isNewPost;
  let pendingEid = String(eid || "");
  const keepEid = () => String(pendingEid || (ctx.map[key] && ctx.map[key].gcalEventId) || "");
  const keepRev = () => Number((ctx.map[key] && ctx.map[key].revision) || 0);

  for (let attempt = 0; attempt < 3; attempt++) {
    const rd = await readSchedSafe(db, key);
    if (!rd.ok) {
      await queueGcalResync(db, key, {
        key: key, eid: keepEid(), isNewPost: pendingNewPost, action: "reconcile", rev: keepRev(), at: now,
      });
      return { ok: false, reason: "rtdb_read_failed", converged: false };
    }
    const cur = rd.val;

    if (!cur || typeof cur !== "object" || cur._deleted) {
      if (cur && typeof cur === "object") ctx.map[key] = cur; else delete ctx.map[key];
      const delId = String((cur && cur.gcalEventId) || pendingEid || "");
      if (!delId || !ctx.gcalOk) {
        await clearGcalResync(db, key);
        return { ok: false, reason: "deleted_during_gcal", converged: true };
      }
      const delOk = await gcalDeleteEvent(ctx, fetchFn, delId);
      const afterRd = await readSchedSafe(db, key);
      if (!afterRd.ok) {
        await queueGcalResync(db, key, {
          key: key, eid: delId, isNewPost: false, action: "reconcile", rev: Number((cur && cur.revision) || 0), at: now,
        });
        return { ok: false, reason: "rtdb_read_failed", converged: false };
      }
      const after = afterRd.val;
      if (delOk && (!after || typeof after !== "object" || after._deleted)) {
        if (after && typeof after === "object") ctx.map[key] = after; else delete ctx.map[key];
        await clearGcalResync(db, key);
        return { ok: false, reason: "deleted_during_gcal", converged: true };
      }
      pendingNewPost = false;
      pendingEid = delId;
      continue;
    }

    const targetRev = Number(cur.revision) || 0;
    const targetObj = Object.assign({}, cur);
    if (pendingNewPost && pendingEid && (!targetObj.gcalEventId || targetObj.gcalEventId !== pendingEid)) {
      const orphanId = pendingEid;
      pendingNewPost = false;
      pendingEid = "";
      if (ctx.gcalOk) {
        const orphanDelOk = await gcalDeleteEvent(ctx, fetchFn, orphanId);
        if (!orphanDelOk) await queueGcalResync(db, key + "__orphan_" + orphanId, { key: key, eid: orphanId, action: "delete_orphan", at: now });
      }
    }

    if (!targetObj.gcalEventId || !ctx.gcalOk) {
      const afterRd = await readSchedSafe(db, key);
      if (!afterRd.ok) {
        await queueGcalResync(db, key, {
          key: key, eid: keepEid(), isNewPost: pendingNewPost, action: "reconcile", rev: targetRev, at: now,
        });
        return { ok: false, reason: "rtdb_read_failed", converged: false };
      }
      const after = afterRd.val;
      if (after && typeof after === "object" && !after._deleted && Number(after.revision) === targetRev && !after.gcalEventId) {
        ctx.map[key] = after;
        await clearGcalResync(db, key);
        return { ok: false, reason: "concurrent_revision", converged: true };
      }
      continue;
    }

    const putOk = await gcalPutMerged(ctx, fetchFn, targetObj.gcalEventId, null, targetObj);
    const afterRd = await readSchedSafe(db, key);
    if (!afterRd.ok) {
      await queueGcalResync(db, key, {
        key: key, eid: String(targetObj.gcalEventId || pendingEid || ""), isNewPost: false, action: "reconcile", rev: targetRev, at: now,
      });
      return { ok: false, reason: "rtdb_read_failed", converged: false };
    }
    const after = afterRd.val;
    if (putOk && after && typeof after === "object" && !after._deleted
        && Number(after.revision) === targetRev && after.gcalEventId === targetObj.gcalEventId) {
      ctx.map[key] = after;
      await clearGcalResync(db, key);
      return { ok: false, reason: "concurrent_revision", converged: true };
    }
    pendingEid = String((after && after.gcalEventId) || targetObj.gcalEventId || pendingEid || "");
  }

  const lastRd = await readSchedSafe(db, key);
  if (!lastRd.ok) {
    await queueGcalResync(db, key, {
      key: key, eid: keepEid(), isNewPost: pendingNewPost, action: "reconcile", rev: keepRev(), at: now,
    });
    return { ok: false, reason: "rtdb_read_failed", converged: false };
  }
  const lastVal = lastRd.val;
  if (lastVal && typeof lastVal === "object") ctx.map[key] = lastVal; else delete ctx.map[key];
  const finalDel = !lastVal || typeof lastVal !== "object" || !!lastVal._deleted;
  await queueGcalResync(db, key, {
    key: key,
    eid: String((lastVal && lastVal.gcalEventId) || pendingEid || ""),
    isNewPost: pendingNewPost,
    action: finalDel ? "delete" : "put",
    rev: Number((lastVal && lastVal.revision) || 0),
    at: now,
  });
  return { ok: false, reason: finalDel ? "deleted_during_gcal" : "concurrent_revision", converged: false };
}

async function drainGcalResync(db, ctx, fetchFn, now) {
  let jobs = null;
  try { jobs = (await db.ref(ROOT + "/resync").once("value")).val(); } catch (_) { jobs = null; }
  if (!jobs || typeof jobs !== "object") return 0;
  const keys = Object.keys(jobs).slice(0, 10);
  if (!keys.length) return 0;
  let done = 0;
  for (const rk of keys) {
    const j = jobs[rk];
    if (!j || typeof j !== "object") { await clearGcalResync(db, rk); continue; }
    if (j.action === "delete_orphan" && j.eid) {
      if (ctx.gcalOk && await gcalDeleteEvent(ctx, fetchFn, j.eid)) {
        await clearGcalResync(db, rk);
        done++;
      }
      continue;
    }
    const targetKey = String(j.key || rk);
    const rr = await reconcileConflictToGcal(db, ctx, fetchFn, targetKey, String(j.eid || ""), !!j.isNewPost, now);
    if (rr && rr.converged) done++;
  }
  return done;
}

async function rollbackIfUnchanged(db, ctx, fetchFn, key, expectedRev, beforeTx, fallbackEid, now) {
  let rolled = false;
  try {
    const res = await db.ref("data/my_schedules/v/" + key).transaction((cur) => {
      if (!cur || typeof cur !== "object" || cur._deleted || Number(cur.revision) !== Number(expectedRev)) return;
      rolled = true;
      return beforeTx;
    });
    if (res && res.committed && rolled) {
      await db.ref("data/my_schedules/u").set(now);
      if (beforeTx) ctx.map[key] = beforeTx; else delete ctx.map[key];
      return;
    }
  } catch (_) {
    await queueGcalResync(db, key, {
      key: key, eid: String(fallbackEid || (beforeTx && beforeTx.gcalEventId) || ""), isNewPost: false, action: "reconcile", rev: Number(expectedRev) || 0, at: now,
    });
    return;
  }
  await reconcileConflictToGcal(db, ctx, fetchFn, key, fallbackEid, false, now);
}

/* Google PUT/POST 완료 시점에 로컬 RTDB 의 _deleted · revision · 예약 토큰을 원자적으로 재검증한다.
   - 진행 도중 삭제·수정이 끼어들면 복구 요청까지 동일한 수렴·보상 경로(reconcileConflictToGcal)로 처리한다.
   - 완료 시점 RTDB 트랜잭션 자체가 일시 오류로 실패해도 삭제와 혼동하지 않고 기존 eid 를 보존해 큐에 저장한다. */
async function finalizeAfterGcal(db, ctx, fetchFn, key, expectedRev, opToken, eid, isNewPost, now) {
  let conflict = "";
  let stamped = null;
  try {
    stamped = await txWriteSchedule(db, key, (cur) => {
      if (!cur || typeof cur !== "object" || cur._deleted) {
        conflict = "deleted";
        return;
      }
      if (Number(cur.revision) !== Number(expectedRev) || (opToken && cur.mailCandId !== opToken)) {
        conflict = "revision";
        return;
      }
      if (isNewPost) {
        if (cur.gcalEventId && cur.gcalEventId !== eid) {
          conflict = "gcal_changed";
          return;
        }
        return Object.assign({}, cur, { gcalEventId: eid, movedToGcal: true, gcalProxyAt: now, gcalEditAt: now });
      }
      return Object.assign({}, cur, { gcalEditAt: now });
    }, now);
  } catch (_) {
    await queueGcalResync(db, key, {
      key: key, eid: String(eid || (ctx.map[key] && ctx.map[key].gcalEventId) || ""), isNewPost: !!isNewPost, action: "reconcile", rev: Number(expectedRev) || 0, at: now,
    });
    return { ok: false, reason: "rtdb_tx_failed" };
  }

  if (!conflict && stamped) {
    ctx.map[key] = stamped;
    await clearGcalResync(db, key);
    return { ok: true, saved: stamped };
  }
  return reconcileConflictToGcal(db, ctx, fetchFn, key, eid, isNewPost, now);
}

async function upsertSchedule(db, ctx, fetchFn, rec, d0, row, now) {
  const d = sanitizeDraft(d0);
  const schedId = "mail_" + rec.id;
  if (ctx.map[schedId]) {
    const wasDel = !!ctx.map[schedId]._deleted;
    return { ok: !wasDel, mode: wasDel ? "deleted" : "exists", schedId: schedId };
  }

  /* 1) 우리 일정표(data/my_schedules/v)에서 같은 날 · 같은 시각(또는 같은 회의 주제) 찾기
        — 로컬 RTDB 에서 최신 상태(_deleted 무덤 여부·revision)를 먼저 원자적으로 예약·갱신한 뒤 구글에 반영하고 완료 시 재검증한다. */
  const hitKey = Object.keys(ctx.map).find((k) => matchesExisting(ctx.map[k], d)) || "";
  if (hitKey) {
    try {
      const liveSnap = await db.ref("data/my_schedules/v/" + hitKey).once("value");
      const liveVal = liveSnap.val();
      if (!liveVal || liveVal._deleted) {
        if (liveVal) ctx.map[hitKey] = liveVal; else delete ctx.map[hitKey];
        return { ok: false, reason: "deleted" };
      }
    } catch (_) { /* 읽기 실패 시 아래 트랜잭션에서 한 번 더 막는다 */ }

    let beforeTx = null;
    let saved = await txWriteSchedule(db, hitKey, (cur) => {
      beforeTx = (cur && typeof cur === "object") ? Object.assign({}, cur) : null;
      if (!cur || typeof cur !== "object" || cur._deleted) return;
      if (cur.sid && String(cur.sid) !== OWNER_SID) return;
      const m = mergeEventFields(cur, d, row);
      return Object.assign({}, cur, m, {
        mailCandId: rec.id,
        updatedAt: now,
        revision: (Number(cur.revision) || 0) + 1,
      });
    }, now);
    if (!saved) return { ok: false, reason: "tx_aborted" };

    if (saved.gcalEventId && ctx.gcalOk) {
      const gcalOk = await gcalPutMerged(ctx, fetchFn, saved.gcalEventId, null, saved);
      if (!gcalOk) {
        await rollbackIfUnchanged(db, ctx, fetchFn, hitKey, saved.revision, beforeTx, saved.gcalEventId, now);
        return { ok: false, reason: "gcal_put_failed" };
      }
      const fin = await finalizeAfterGcal(db, ctx, fetchFn, hitKey, saved.revision, rec.id, saved.gcalEventId, false, now);
      if (!fin.ok) return { ok: false, reason: fin.reason };
      saved = fin.saved;
    } else if (!saved.gcalEventId && ctx.gcalOk) {
      const newGid = await gcalPostNew(ctx, fetchFn, saved, hitKey);
      if (newGid) {
        const fin = await finalizeAfterGcal(db, ctx, fetchFn, hitKey, saved.revision, rec.id, newGid, true, now);
        if (!fin.ok) return { ok: false, reason: fin.reason };
        saved = fin.saved;
      } else {
        const finNoGid = await finalizeAfterGcal(db, ctx, fetchFn, hitKey, saved.revision, rec.id, "", false, now);
        if (!finNoGid.ok) return { ok: false, reason: finNoGid.reason };
        saved = finNoGid.saved;
      }
    } else {
      ctx.map[hitKey] = saved;
    }
    return { ok: true, mode: "updated", schedId: hitKey, gcalEventId: saved.gcalEventId || "" };
  }

  /* 2) 구글 공용 달력에만 직접 적혀 있던 기존 대표(OWNER_SID) 일정에서도 같은 시각(또는 같은 주제) 찾기
        — 이미 _deleted 무덤 표식이 달린 gcalEventId 는 건너뛰고, 로컬 예약 트랜잭션 성공 뒤에만 구글 PUT 을 수행한다. */
  const gItems = await gcalEventsOnDate(ctx, fetchFn, d.date);
  for (const item of gItems) {
    const gf = gcalItemToFields(item, ctx.mailSid);
    if (!gf || !matchesExisting(gf, d)) continue;
    const anyKey = Object.keys(ctx.map).find((k) => ctx.map[k] && ctx.map[k].gcalEventId === gf.gcalId) || "";
    if (anyKey && ctx.map[anyKey]._deleted) continue;
    const linkedKey = anyKey || schedId;
    try {
      const preLink = await db.ref("data/my_schedules/v/" + linkedKey).once("value");
      if (preLink.exists()) {
        const pv = preLink.val() || {};
        ctx.map[linkedKey] = pv;
        if (pv._deleted || (!anyKey && pv.gcalEventId && pv.gcalEventId !== gf.gcalId)) continue;
      }
    } catch (_) { /* 트랜잭션에서 재검증 */ }

    const merged = mergeEventFields(gf, d, row);
    let beforeTx = null;
    let saved = await txWriteSchedule(db, linkedKey, (cur) => {
      beforeTx = (cur && typeof cur === "object") ? Object.assign({}, cur) : null;
      if (cur && cur._deleted) return;
      if (!anyKey && cur) return;
      const baseRow = (cur && typeof cur === "object") ? cur : { id: linkedKey, sid: OWNER_SID, createdAt: now, sourceKind: "mail", sourceId: rec.id };
      const m = cur ? mergeEventFields(cur, d, row) : merged;
      return Object.assign({}, baseRow, m, {
        id: linkedKey,
        movedToGcal: true,
        gcalEventId: gf.gcalId,
        mailCandId: rec.id,
        updatedAt: now,
        revision: (Number(baseRow.revision) || 0) + 1,
      });
    }, now);
    if (!saved) return { ok: false, reason: "tx_aborted" };

    const putOk = await gcalPutMerged(ctx, fetchFn, gf.gcalId, gf.raw, saved);
    if (!putOk) {
      await rollbackIfUnchanged(db, ctx, fetchFn, linkedKey, saved.revision, beforeTx, gf.gcalId, now);
      return { ok: false, reason: "gcal_put_failed" };
    }
    const fin = await finalizeAfterGcal(db, ctx, fetchFn, linkedKey, saved.revision, rec.id, gf.gcalId, false, now);
    if (!fin.ok) return { ok: false, reason: fin.reason };
    saved = fin.saved;
    return { ok: true, mode: "updated", schedId: linkedKey, gcalEventId: gf.gcalId };
  }

  /* 3) 겹치는 일정이 없으면 로컬 RTDB 에 먼저 원자적으로 예약한 뒤에만 구글 POST 를 보내고, 중간에 삭제·수정되면 보상 처리한다 */
  try {
    const preSnap = await db.ref("data/my_schedules/v/" + schedId).once("value");
    if (preSnap.exists()) {
      const curVal = preSnap.val() || {};
      ctx.map[schedId] = curVal;
      const wasDel = !!curVal._deleted;
      return { ok: !wasDel, mode: wasDel ? "deleted" : "exists", schedId: schedId };
    }
  } catch (_) { /* 읽기 실패 시 아래 트랜잭션에서 한 번 더 막는다 */ }

  const fresh = {
    id: schedId,
    sid: OWNER_SID,
    title: withTimePrefix(d.time, d.endTime, d.title).slice(0, 300),
    date: d.date,
    endDate: d.endDate || "",
    time: hmNorm(d.time),
    endTime: hmNorm(d.time) ? hmNorm(d.endTime) : "",
    place: String(d.place || "").slice(0, 300),
    contact: String(d.contact || "").slice(0, 200),
    note: buildMailNote(d.note, row),
    sourceKind: "mail",
    sourceId: rec.id,
    mailCandId: rec.id,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
  let saved = await txWriteSchedule(db, schedId, (cur) => {
    if (cur) return;   /* 이미 있거나 _deleted 무덤 표식이 있으면 구글 POST 전에 즉시 중단한다 */
    return fresh;
  }, now);
  if (!saved) return { ok: false, reason: "already_exists_or_deleted" };

  if (ctx.gcalOk) {
    const gid = await gcalPostNew(ctx, fetchFn, saved, schedId);
    const fin = await finalizeAfterGcal(db, ctx, fetchFn, schedId, saved.revision, rec.id, gid, !!gid, now);
    if (!fin.ok) return { ok: false, reason: fin.reason };
    saved = fin.saved;
  } else {
    ctx.map[schedId] = saved;
  }
  return { ok: true, mode: "created", schedId: schedId, gcalEventId: saved.gcalEventId || "" };
}

/* 30일 지난 후보를 지운다(한 번에 쉰 건까지) */
async function prune(db, now) {
  try {
    const cutoff = now - KEEP_DAYS * 86400000;
    const snap = await db.ref(ROOT + "/cand").orderByChild("at").endAt(cutoff).limitToFirst(50).once("value");
    const v = snap.val() || {};
    const up = {};
    Object.keys(v).forEach((k) => { up[ROOT + "/cand/" + k] = null; });
    if (Object.keys(up).length) await db.ref().update(up);
    return Object.keys(up).length;
  } catch (e) {
    console.warn("cal-inbox 옛 후보 정리 실패(계속):", String((e && e.message) || e));
    return 0;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   받은메일함(kind:'inbox')에 «이번 회차에 새로 쌓인 줄»에서 일정을 뽑아 달력·후보함에 반영한다.
   ══════════════════════════════════════════════════════════════════════════ */
async function extractFromNewMail(deps, o) {
  o = o || {};
  const out = { ran: false, tried: 0, made: 0, skipped: 0 };
  try {
    const held = Array.isArray(o.held) ? o.held : [];
    if (!held.length) return out;
    const db = deps.getDatabase();

    const gate = await loadGate(db);
    if (!gate.on) return out;

    const now = Number(o.now) || Date.now();
    const fetchFn = o.fetchFn || global.fetch;
    let schedCtx = null;

    /* 지난 회차에서 충돌 복구가 끝내 수렴하지 못해 큐(cal_inbox/resync)에 남은 작업이 있으면 먼저 처리한다 */
    if (gate.autoAdd) {
      try {
        const rsSnap = await db.ref(ROOT + "/resync").once("value");
        if (rsSnap.exists()) {
          schedCtx = await initSchedCtx(db, fetchFn);
          out.resynced = await drainGcalResync(db, schedCtx, fetchFn, now);
        }
      } catch (_) { /* 다음 회차에 재시도 */ }
    }

    const picks = held.filter((g) => g && g.row && g.row.u && looksScheduly(g.row));
    if (!picks.length) return out;

    const key = String(process.env.GEMINI_KEY || "").trim();
    if (!key || key === "unset") { console.warn("cal-inbox AI 열쇠(GEMINI_KEY)가 없습니다 — 건너뜁니다"); return out; }

    const today = DR.ymdKST(now);
    const state = { at: now, tried: 0, made: 0, autoCreated: 0, autoUpdated: 0 };

    if (await monthOver(db)) {
      out.ran = true; out.skipped = picks.length; out.paused = "budget";
      await db.ref(ROOT + "/state").set(Object.assign(state, { paused: "budget" })).catch(() => {});
      return out;
    }
    let left = gate.dayLimit - await dayUsed(db, today);
    if (left <= 0) {
      out.ran = true; out.skipped = picks.length; out.paused = "day";
      await db.ref(ROOT + "/state").set(Object.assign(state, { paused: "day" })).catch(() => {});
      return out;
    }

    out.ran = true;
    const slug = String(o.slug || "");
    let trustedSenders = null;

    for (const g of picks) {
      if (Date.now() + SAFETY_MS > Number(o.deadline || Infinity)) break;
      if (out.tried >= gate.perRunMax || left <= 0) break;
      const row = g.row;
      /* 이미 뽑은 메일이면 다시 안 부른다(같은 회차를 두 번 돌려도 요금이 두 번 나가지 않게) */
      try { if ((await db.ref(ROOT + "/cand/" + candId(slug, row.u, 0)).once("value")).exists()) continue; } catch (e) { /* 모르면 진행 */ }

      let text = await fetchBodyText(o.client, g);
      if (!text) text = String(row.p || "");
      const attExtra = await fetchAttExtra(o.client, g);
      if (attExtra.text) text = (text ? text + "\n\n" : "") + attExtra.text;
      text = CAP.scrubText(text);                                /* 주민번호 꼴은 보내기 전에 가린다 */

      const baseYmd = ymdOfMs(Number(row.d), today);
      const from = CAP.scrubText((String(row.f || "").trim() + " <" + String(row.e || "").trim() + ">").trim());
      const prompt = CAP.promptForMail(today, { from: from, subject: CAP.scrubText(String(row.s || "")), ymd: baseYmd, text: text });
      if (REDACT.RAW_RE.test(prompt) || (REDACT.SPACED_RRN_RE && REDACT.SPACED_RRN_RE.test(prompt))) {
        console.warn("cal-inbox 가리지 못한 주민번호 꼴이 남아 AI 전송을 중단합니다");
        continue;
      }
      const parts = [{ text: prompt }];

      out.tried++; left--;
      let r;
      try { r = await DR.callGemini(fetchFn, key, parts, [1500], { temperature: 0, maxOutputTokens: 1500 }); }
      catch (e) { console.warn("cal-inbox 판독 실패:", String((e && e.message) || e).slice(0, 200)); continue; }
      await bumpTally(db, today);
      if (!r || !r.ok) { console.warn("cal-inbox AI 가 답하지 않았습니다:", r && r.status, String((r && r.why) || "").slice(0, 120)); continue; }

      const norm = CAP.normalize(replyText(r.json), today);
      if (!norm.ok || !norm.drafts.length) continue;

      /* ★ 날짜를 못 찾은 초안은 후보로 안 만든다(2026-10-31) — 걸러낸 «뒤의 순서»로 열쇠를 매긴다 */
      const keep = norm.drafts.filter((d) => d.date);
      out.nodate = (out.nodate || 0) + (norm.drafts.length - keep.length);
      if (!keep.length) continue;

      let senderOk = false;
      if (gate.autoAdd && keep.some((d) => isAutoSchedulable(d, today))) {
        if (!trustedSenders) trustedSenders = await loadTrustedSenders(db, o.readCompanies);
        senderOk = isTrustedSender(row, g.authHdr, trustedSenders);
      }

      const up = {};
      for (let i = 0; i < keep.length; i++) {
        const d = sanitizeDraft(keep[i]);
        const rec = recordOf(row, slug, i, d, now, baseYmd);
        if (gate.autoAdd && senderOk && isAutoSchedulable(d, today)) {
          try {
            if (!schedCtx) schedCtx = await initSchedCtx(db, fetchFn);
            const auto = await upsertSchedule(db, schedCtx, fetchFn, rec, d, row, now);
            if (auto && auto.ok) {
              rec.status = "added";
              rec.autoAdded = true;
              rec.autoMode = auto.mode;
              rec.schedId = auto.schedId;
              if (auto.gcalEventId) rec.gcalEventId = auto.gcalEventId;
              if (auto.mode === "updated") out.autoUpdated = (out.autoUpdated || 0) + 1;
              else if (auto.mode === "created") out.autoCreated = (out.autoCreated || 0) + 1;
            }
          } catch (e) {
            console.warn("cal-inbox 달력 자동등록 실패(후보함에 남깁니다):", String((e && e.message) || e).slice(0, 160));
          }
        }
        up[ROOT + "/cand/" + rec.id] = rec;
      }
      await db.ref().update(up);
      out.made += keep.length;
    }

    out.skipped = picks.length - out.tried;
    state.tried = out.tried; state.made = out.made;
    state.autoCreated = out.autoCreated || 0; state.autoUpdated = out.autoUpdated || 0;
    if (out.tried) {
      await db.ref(ROOT + "/state").set(state).catch(() => {});
      await prune(db, now);
    }
    return out;
  } catch (e) {
    console.warn("cal-inbox 실패(동기화는 계속합니다):", String((e && e.message) || e).slice(0, 200));
    return out;
  }
}

async function flushPendingResync(deps, o) {
  o = o || {};
  try {
    if (Date.now() + SAFETY_MS > Number(o.deadline || Infinity)) return 0;
    const db = deps.getDatabase();
    const rsSnap = await db.ref(ROOT + "/resync").once("value");
    if (!rsSnap.exists()) return 0;
    const now = Number(o.now) || Date.now();
    const fetchFn = o.fetchFn || global.fetch;
    const ctx = await initSchedCtx(db, fetchFn);
    if (!ctx.gcalOk) return 0;
    return await drainGcalResync(db, ctx, fetchFn, now);
  } catch (e) {
    console.warn("cal-inbox 재동기화 큐 처리 실패(다음 회차 재시도):", String((e && e.message) || e).slice(0, 160));
    return 0;
  }
}

module.exports = {
  ROOT, APP, KEEP_DAYS, DEFAULTS, SCHED_WORDS, DATE_CUE,
  looksScheduly, loadGate, monthOver, dayUsed, replyText, fetchBodyText, fetchAttExtra,
  candId, recordOf, stripUrls, isTrustedSender, isAutoSchedulable, mergeEventFields, prune, flushPendingResync, extractFromNewMail,
};
