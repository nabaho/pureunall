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

async function evaluate(fetchFn, key, text) {
  const masked = redact(text);
  if (!masked.text) return { ok: false, status: 400, error: "판단할 내용이 없습니다." };
  const response = await fetchFn("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ state: masked.text, model: "jev-latest", questions: questions() }),
  });
  let body = {};
  try { body = await response.json(); } catch (_) { /* 응답 본문이 없을 수 있다 */ }
  if (!response.ok) return { ok: false, status: response.status || 502, error: "Jev 판단을 받지 못했습니다." };
  return { ok: true, maskedKinds: masked.maskedKinds, answers: body.answers || {}, usage: body.usage || {} };
}

module.exports = { MAX_TEXT, clean, redact, questions, evaluate };
