"use strict";

const crypto = require("node:crypto");

const REPO = "nabaho/pureunall";
const MAX_TEXT = 6000;
/* ⚠ 여기 빠진 낱말은 「낮음」으로 분류돼 **사람 눈 없이 배포된다.**
   2026-09-11 실측: 돈을 세는 말이 통째로 빠져 있었다 — 「2025년 사건의 성공보수가
   2026년에 입금됐는데 매칭이 안 된다」는 건의가 «낮은 위험»으로 떨어진다.
   돈 계산이 틀리면 장부가 틀리고, 그 틀림은 조용히 오래 간다. */
const HIGH_RISK = /(firebase|보안\s*규칙|권한|로그인|인증|급여|성과급|삭제|복원|백업|잠금|결제|메일|개인정보|주민|계좌|database|rules|auth|입금|출금|거래내역|자문료|미수금|세금계산서|계산서|마감|성과|이관|보수|정산|환불|부가세)/i;

function cleanText(value, maxLength) {
  return String(value == null ? "" : value)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength || MAX_TEXT);
}

function redactSensitive(value) {
  return cleanText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 삭제]")
    .replace(/\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b/g, "[주민번호 삭제]")
    .replace(/\b(?:01[016789]|02|0[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}\b/g, "[전화번호 삭제]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[금융번호 삭제]");
}

function riskLevel(input) {
  const requested = cleanText(input && input.risk, 20).toLowerCase();
  if (requested === "high") return "high";
  if (requested === "low") return HIGH_RISK.test(`${input.title || ""}\n${input.content || ""}\n${input.instruction || ""}`) ? "high" : "low";
  return HIGH_RISK.test(`${input.title || ""}\n${input.content || ""}\n${input.instruction || ""}`) ? "high" : "low";
}

function normalizeImageIndexes(value, imageCount) {
  const max = Math.max(0, Number(imageCount) || 0);
  return [...new Set((Array.isArray(value) ? value : [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < max))]
    .slice(0, 3);
}

/* ══ 공개 글에 건의 내용이 한 조각도 없는지 «스스로» 확인한다 ═══════════════
   ⚠ 가림망(redactSensitive)에 기대지 않는다. 그것이 지우는 것은 이메일·주민·전화·
     금융번호 넷뿐이라 **실명·업체명·사건번호는 그대로 남았다**(2026-09-11 실측).
     그래서 «가리는» 대신 «아예 안 싣는» 쪽으로 바꿨고, 이 함수가 그것을 지킨다.
   ★ 12글자 창으로 본다 — 한두 낱말은 우연히 겹칠 수 있지만 열두 글자가 겹치는 것은
     우연이 아니다. 공백은 지우고 견준다(줄바꿈만 달라도 못 찾으면 소용없다). */
const LEAK_WINDOW = 12;
function assertNoLeak(publicText, sources) {
  const 공개 = String(publicText || "").replace(/\s+/g, "");
  (Array.isArray(sources) ? sources : []).forEach(function (raw) {
    const s = String(raw || "").replace(/\s+/g, "");
    for (let i = 0; i + LEAK_WINDOW <= s.length; i += 1) {
      if (공개.indexOf(s.slice(i, i + LEAK_WINDOW)) >= 0) {
        throw new Error("공개 이슈에 건의 내용이 들어갔습니다 — 올리지 않습니다.");
      }
    }
  });
  return true;
}

/* ══ 공개 GitHub 이슈 — **건의 내용을 한 글자도 싣지 않는다** ═════════════════
   대표 지시 2026-09-11 「깃허브에는 모두 공개하면 안된다 데이터들 개인정보가 많이 있다」

   ★★ 예전에는 건의 원문과 대표 지시를 그대로 실었다. 저장소는 PUBLIC 이고 이슈도
      켜져 있다 — 실제 건의가 「○○○ 님 임금체불사건(사건번호 …)」이었다.
      가림망은 그 이름도 사건번호도 못 지웠다.
   ★ 이제 공개되는 것은 «건의 ID·위험도·자동배포 여부» 뿐이다. 내용은 이미 있던
     보호된 통로(AUTOMATION_BRIDGE_KEY → bridgeTask)로만 간다 — 통로는 처음부터
     지어져 있었고, 잘못은 «양쪽 모두»로 보낸 것이었다.
   ⚠ 제목에도 건의 제목을 쓰지 않는다. 제목 한 줄에 업체명이 들어가는 일이 흔하다.
   ⚠ 「- 건의 ID: `…`」 줄의 «모양»을 바꾸지 말 것 — scripts/fetch-autodev-task.mjs
     가 이 줄에서 ID 를 읽어 보호된 통로를 연다. */
function buildIssue(input) {
  const level = riskLevel(input);
  const suggestionId = cleanText(input.suggestionId, 120).replace(/[^A-Za-z0-9_-]/g, "");
  const selectedCount = normalizeImageIndexes(input.imageIndexes, input.imageCount).length;
  const autoDeploy = level === "low" && input.autoDeploy === true;
  const title = `[자동개발] 건의 ${suggestionId || "미상"}`;
  const body = [
    "## 대표 승인형 자동개발",
    "",
    `- 건의 ID: \`${suggestionId}\``,
    `- 위험도: \`${level}\``,
    `- 검사 통과 후 자동배포: \`${autoDeploy ? "yes" : "no"}\``,
    `- 비공개 참고 캡처: \`${selectedCount}개\``,
    "",
    "---",
    "**이 이슈에는 건의 내용이 들어 있지 않습니다.**",
    "건의 원문·대표 개발 지시·참고 캡처는 GitHub에 올리지 않고,",
    "보호된 자동화 연결을 통해 실행 중에만 전달합니다.",
    "올라갈 코드에 사람 이름·업체명·번호가 섞이면 밀어 올리기 전에 멈춥니다",
    "(scripts/autodev-privacy-gate.js).",
  ].join("\n");
  /* 스스로 확인한다 — 나중에 누가 여기 한 줄을 되살려 놓아도 그 자리에서 막힌다 */
  assertNoLeak(title + "\n" + body, [input.title, input.content, input.instruction]);
  return {
    title,
    body,
    labels: ["ai-ready", level === "high" ? "risk-high" : "risk-low"],
    level,
    autoDeploy,
    suggestionId,
  };
}

function validateExecute(input) {
  /* ⚠ 예전에는 「개인정보 공개 여부를 확인했다」는 대표의 «체크»를 요구했다.
     그것은 사람 눈에 기댄 방어였고, 실제 건의는 체크할 수 없는 것이었다.
     이제 공개되는 글에 건의 내용이 아예 없으므로 확인할 것이 없다 — 대신
     buildIssue 의 assertNoLeak 가 «기계로» 지킨다. 체크칸을 되살리지 말 것. */
  if (!input) throw new Error("요청이 비었습니다.");
  if (!cleanText(input.suggestionId, 120)) throw new Error("건의 ID가 없습니다.");
  if (!cleanText(input.title, 140)) throw new Error("건의 제목이 없습니다.");
  if (!cleanText(input.instruction, MAX_TEXT)) throw new Error("대표 개발 지시를 입력해 주세요.");
  return true;
}

function createRollbackCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashRollbackCode(code, salt) {
  return crypto.createHash("sha256").update(`${salt}:${String(code || "")}`).digest("hex");
}

function safeGithubNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error("GitHub 번호가 올바르지 않습니다.");
  return number;
}

async function githubRequest(token, route, options) {
  if (!token) throw new Error("GITHUB_AUTOMATION_TOKEN 비밀값이 없습니다.");
  const response = await fetch(`https://api.github.com${route}`, {
    method: (options && options.method) || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pureunall-development-automation",
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { message: text }; }
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${(data && data.message) || "요청 실패"}`);
  return data;
}

module.exports = {
  REPO,
  cleanText,
  redactSensitive,
  assertNoLeak,
  LEAK_WINDOW,
  riskLevel,
  normalizeImageIndexes,
  buildIssue,
  validateExecute,
  createRollbackCode,
  hashRollbackCode,
  safeGithubNumber,
  githubRequest,
};
