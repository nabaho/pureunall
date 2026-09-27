"use strict";

/* Jev 는 결정만 돌려준다. 원문·열쇠·자동처리 권한은 이 대리인 밖으로 나가지 않는다. */
const MAX_TEXT = 4000;

function clean(text) {
  return String(text == null ? "" : text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT);
}

/* 이름은 완벽하게 기계로 가릴 수 없으므로, 이 첫 판은 번호·연락처·계좌처럼
   확실히 알아볼 수 있는 식별자를 먼저 지운다. 결과는 저장하지 않고 응답으로만 준다. */
function redact(text) {
  const kinds = [];
  let out = clean(text);
  const masks = [
    ["주민번호", /\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b/g, "[주민번호]"],
    ["사업자번호", /\b\d{3}\s*-\s*\d{2}\s*-\s*\d{5}\b/g, "[사업자번호]"],
    ["전화번호", /\b(?:01[016789]|02|0[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}\b/g, "[전화번호]"],
    ["이메일", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일]"],
    ["계좌번호", /\b(?:\d[ -]?){13,19}\b/g, "[계좌번호]"],
  ];
  masks.forEach(([kind, re, replacement]) => {
    if (re.test(out)) kinds.push(kind);
    re.lastIndex = 0;
    out = out.replace(re, replacement);
  });
  return { text: out, maskedKinds: kinds };
}

function questions() {
  return {
    urgency: { type: "noul", instructions: "Is this request urgent or time-sensitive?" },
    route: {
      type: "choice", instructions: "Which internal work queue should review this?",
      criteria: {
        "인사·노무": "Employment, payroll, personnel, or labor-law matter",
        "계약·사건": "Contract, client case, dispute, or filing matter",
        "시스템·자료": "ERP fault, account, data, access, or technical matter",
        "일반 문의": "General question or request not covered above",
      },
    },
    human_review: { type: "noul", instructions: "Should a human review this before any action is taken?" },
    deadline: {
      type: "choice", instructions: "What response timeframe does this request need?",
      criteria: {
        "오늘": "Needs action today or within 24 hours",
        "3일 이내": "Needs action within three days",
        "이번 주": "Needs action this week but not today",
        "일반": "No clear near-term deadline",
      },
    },
    impact: {
      type: "choice", instructions: "How broad is the likely impact if this is not handled?",
      criteria: {
        "한 사람·한 업체": "Affects one person or one client company",
        "여러 업체": "Affects multiple client companies or workers",
        "시스템 전체": "Affects shared ERP, access, or a system-wide process",
      },
    },
    legal_wage_risk: {
      type: "choice", instructions: "How much labor-law, payroll, or contractual risk needs expert attention?",
      criteria: {
        "높음": "Could create material legal, payroll, filing, or contractual risk",
        "보통": "Needs routine professional review but is not clearly high risk",
        "낮음": "Appears administrative or low risk",
      },
    },
    privacy_security: { type: "noul", instructions: "Does this request require privacy or information-security caution?" },
    info_missing: { type: "noul", instructions: "Is essential information missing before a person can act on this request?" },
    first_action: {
      type: "choice", instructions: "What is the safest first human action?",
      criteria: {
        "담당자 확인": "Confirm facts or ownership with the responsible person",
        "자료 요청": "Request missing documents, details, or evidence",
        "즉시 대응": "Take prompt human action to prevent a deadline or operational issue",
        "일반 답변": "A normal informational response is the appropriate first step",
      },
    },
  };
}

/* ══ 왜 못 받았나를 «갈라» 말한다 (2026-09-20) ═══════════════════════════════
   첫 판은 실패를 전부 「Jev 판단을 받지 못했습니다」 한 마디로 뭉뚱그렸다.
   그런데 이 연결은 «한 번도 안 불린» 채로 배포돼 있었다 — 처음 눌러 보는 사람이
   ㉠ 열쇠가 틀린 것인지 ㉡ 대기자 명단이 아직 안 풀린 것인지 ㉢ 업체가 잠시 아픈
   것인지 가릴 수가 없다. 셋은 **할 일이 전혀 다르다**(㉠ 열쇠 다시 넣기 ·
   ㉡ 기다리기 · ㉢ 조금 뒤 다시). 한 마디로 뭉치면 셋 다 못 한다.
   ⚠ 뭉뚱그린 안내는 없는 것보다 나쁘다 — 읽은 사람이 엉뚱한 곳을 고친다. */
const FAILURES = [
  { why: "key", from: 401, to: 403, status: 502,
    error: "업체가 열쇠를 거절했습니다 — 열쇠가 틀렸거나, Jev 대기자 명단이 아직 안 풀렸습니다." },
  { why: "route", from: 404, to: 404, status: 502,
    error: "업체 쪽에 그 길이 없습니다 — 주소나 모델 이름이 바뀌었을 수 있습니다." },
  { why: "shape", from: 400, to: 400, status: 502,
    error: "보낸 모양을 업체가 거절했습니다 — 묻는 방식이 바뀌었을 수 있습니다." },
  { why: "shape", from: 422, to: 422, status: 502,
    error: "보낸 모양을 업체가 거절했습니다 — 묻는 방식이 바뀌었을 수 있습니다." },
  { why: "vendorQuota", from: 429, to: 429, status: 429,
    error: "업체 쪽 한도에 걸렸습니다 — 조금 뒤에 다시 눌러 주세요." },
  { why: "vendorDown", from: 500, to: 599, status: 502,
    error: "업체 서버가 답하지 못했습니다 — 조금 뒤에 다시 눌러 주세요." },
];

/* 업체가 곁들인 한마디 — 처음 시험할 때 이것 한 줄이 열쇠인지 명단인지 가른다.
   ⚠ 길이를 자른다: 업체가 우리가 보낸 글을 되비쳐 줄 수도 있어 통째로 흘리지 않는다. */
function hintOf(body) {
  const b = (body && typeof body === "object") ? body : {};
  const raw = b.error && typeof b.error === "object" ? (b.error.message || b.error.type) : b.error;
  return clean(raw || b.message || b.detail || "").slice(0, 160);
}

function failureOf(status, body) {
  const s = Number(status) || 0;
  const hit = FAILURES.find((f) => s >= f.from && s <= f.to);
  const hint = hintOf(body);
  const out = hit
    ? { ok: false, why: hit.why, status: hit.status, error: hit.error, vendorStatus: s }
    : { ok: false, why: "unknown", status: 502, vendorStatus: s,
        error: "Jev 판단을 받지 못했습니다 (업체 응답 " + (s || "없음") + ")." };
  if (hint) out.hint = hint;
  return out;
}

/* 업체에 닿지도 못했다 — 위의 어느 갈래도 아니다(응답 자체가 없다). */
function unreachable(e) {
  return { ok: false, why: "network", status: 504, vendorStatus: 0,
    error: "업체 서버에 닿지 못했습니다 — 우리 서버와 Jev 사이 길 문제입니다.",
    hint: clean((e && e.message) || "").slice(0, 160) };
}

/* ══ 하루에 몇 번까지 (2026-09-20) ══════════════════════════════════════════
   여태 한도가 «없었다» — 로그인한 직원 누구나 무제한으로 부를 수 있었다.
   ⚠ 막는 까닭은 요금이 아니다(글 백만 자에 0.042달러라 사실상 0원이다).
     막는 까닭은 **사람 이름·업체명·주소가 든 글이 미국 업체로 나가는 것**이고,
     공식 API 직접 호출에는 「안 남기기」 선택이 없어 보낸 글이 그쪽에 남는다.
     그래서 한도는 «아껴 쓰기»가 아니라 «샌 양을 셀 수 있게» 하는 문이다.
   ★ 사람마다 와 전체 를 «갈라» 센다 — 합치면 한 사람이 다 태운 날과 여럿이
     고루 쓴 날이 같아 보인다(ai_read_tally 가 n 과 quota 를 가른 것과 같은 까닭). */
const PERSON_DAY_LIMIT = 30;
const ALL_DAY_LIMIT = 200;

/* 세는 자리 — 담는 것은 «숫자뿐»이다. 보낸 글도, 받은 판단도 한 글자도 안 담는다.
   ⚠ 규칙을 안 붙였다 — 이 저장소의 뿌리에는 $other 가 «없어» 이름 없는 최상위
     자리는 브라우저에 통째로 막힌다. 서버(관리자 SDK)만 지나간다. */
function tallyPaths(uid, ymd) {
  const who = String(uid || "").replace(/[.#$/[\]]/g, "") || "_unknown";
  return ["typesafe_tally/" + ymd + "/" + who, "typesafe_tally/" + ymd + "/_all"];
}

/* 남은 횟수 — 둘 가운데 «적은 쪽»이 진짜 남은 것이다. */
function leftOf(mine, all) {
  const m = Math.max(0, PERSON_DAY_LIMIT - (Math.max(0, Number(mine) || 0)));
  const a = Math.max(0, ALL_DAY_LIMIT - (Math.max(0, Number(all) || 0)));
  return { left: Math.min(m, a), mine: m, all: a, over: Math.min(m, a) <= 0 };
}

function overLimitError(seen) {
  return { ok: false, why: "dayLimit", status: 429, left: 0,
    error: seen.mine <= 0
      ? ("오늘 쓸 수 있는 " + PERSON_DAY_LIMIT + "번을 다 썼습니다 — 내일 다시 쓸 수 있습니다.")
      : ("오늘 사무실 전체 몫 " + ALL_DAY_LIMIT + "번을 다 썼습니다 — 내일 다시 쓸 수 있습니다.") };
}

/* qs — 물음 모양을 바꿔 끼운다(2026-09-26, 메일 자동분류가 처음 쓴다).
   ⚠ 안 주면 예전 그대로 questions() 다. 업무 검토용 물음(긴급도·경로…)과
     메일함 분류용 물음(어느 칸인가)은 «묻는 것 자체»가 다르다 — 여기를 하나로
     묶어 두면 딴 일이 하나를 고칠 때 서로 발을 밟는다. 열쇠·가리기·실패 갈래는
     «같은 길»을 타야 두 군데가 어긋나지 않는다(대표 결정 「이알피와 같은 기준」). */
async function evaluate(fetchFn, key, text, qs) {
  const masked = redact(text);
  if (!masked.text) return { ok: false, why: "empty", status: 400, error: "판단할 내용이 없습니다." };
  let response;
  try {
    response = await fetchFn("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ state: masked.text, model: "jev-latest", questions: qs || questions() }),
    });
  } catch (e) { return unreachable(e); }
  let body = {};
  try { body = await response.json(); } catch (_) { /* 응답 본문이 없을 수 있다 */ }
  if (!response.ok) return failureOf(response.status, body);
  return { ok: true, maskedKinds: masked.maskedKinds, answers: body.answers || {}, usage: body.usage || {} };
}

module.exports = { MAX_TEXT, clean, redact, questions, evaluate,
  FAILURES, failureOf, unreachable,
  PERSON_DAY_LIMIT, ALL_DAY_LIMIT, tallyPaths, leftOf, overLimitError };
