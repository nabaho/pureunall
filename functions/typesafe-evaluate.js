"use strict";

/* Jev 는 결정만 돌려준다. 원문·열쇠·자동처리 권한은 이 대리인 밖으로 나가지 않는다.
   ★ 2026-11-22 — 포털 「✨ TypeSafe 검토」 단추(9가지 업무 검토 물음 · 사람별 하루 30번 셈)를 대표 지시로 걷어냈다.
     지금 이 모듈을 쓰는 곳은 받은메일함 자동분류(mail-ai-classify.js) «하나»다 — 물음(qs)은 부르는 쪽이 준다. */
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

/* qs — 무엇을 물을지는 «부르는 쪽»이 정한다(2026-09-26 메일 자동분류가 처음 바꿔 끼웠다).
   ⚠ 2026-11-22 단추와 함께 기본 물음(긴급도·경로… 9가지)을 걷어냈다 — 물음 없이 부르면
     업체에 «아무것도 보내지 않고» 돌려보낸다(빈 물음으로 글만 미국 서버에 남기지 않는다).
     열쇠·가리기·실패 갈래는 이 한 길을 탄다. */
function hasQuestions(qs) {
  return !!qs && typeof qs === "object" && !Array.isArray(qs) && Object.keys(qs).length > 0;
}

async function evaluate(fetchFn, key, text, qs) {
  if (!hasQuestions(qs)) return { ok: false, why: "noQuestions", status: 400, error: "무엇을 물을지(qs)가 없습니다 — 업체에 보내지 않았습니다." };
  const masked = redact(text);
  if (!masked.text) return { ok: false, why: "empty", status: 400, error: "판단할 내용이 없습니다." };
  let response;
  try {
    response = await fetchFn("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ state: masked.text, model: "jev-latest", questions: qs }),
    });
  } catch (e) { return unreachable(e); }
  let body = {};
  try { body = await response.json(); } catch (_) { /* 응답 본문이 없을 수 있다 */ }
  if (!response.ok) return failureOf(response.status, body);
  return { ok: true, maskedKinds: masked.maskedKinds, answers: body.answers || {}, usage: body.usage || {} };
}

module.exports = { MAX_TEXT, clean, redact, evaluate, hasQuestions,
  FAILURES, failureOf, unreachable };
