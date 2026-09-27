import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import evaluator from "../../functions/typesafe-evaluate.js";

const { clean, evaluate } = evaluator;
const KEY = String(process.env.TYPESAFE_API_KEY || "").trim();
const TOOL_NAME = "jev_review";

function failure(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function confidence(answers) {
  const values = Object.values(answers || {})
    .map((answer) => Number(answer && answer.confidence))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

async function review(text) {
  if (!KEY) return failure("TYPESAFE_API_KEY 환경값이 없습니다. API 키를 대화나 파일에 넣지 말고 Windows 사용자 환경 변수에만 저장한 뒤 Codex·Claude Code를 다시 여세요.");

  const result = await evaluate(fetch, KEY, clean(text));
  if (!result.ok) return failure(result.error || "Jev 판단을 받지 못했습니다.");

  const answer = {
    제안임: true,
    안내: "이 결과는 사람이 확인할 업무 분류 제안입니다. 저장·전송·수정·자동 실행은 하지 않습니다.",
    가린정보종류: result.maskedKinds,
    평균신뢰도: confidence(result.answers),
    판단: result.answers,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
    structuredContent: answer,
  };
}

const server = new McpServer(
  { name: "pureun-jev-review", version: "1.0.0" },
  { instructions: "Jev는 짧은 업무 내용의 분류·위험·검토 필요 여부만 제안합니다. 결과를 근거 없이 자동 실행하거나 원문을 저장하지 마세요." },
);

server.registerTool(
  TOOL_NAME,
  {
    title: "Jev 업무 검토",
    description: "민감 식별번호를 먼저 가린 뒤 긴급도, 분류, 기한, 영향, 노무·계약 위험, 개인정보 주의, 누락 정보, 첫 조치를 읽기 전용으로 제안합니다.",
    inputSchema: {
      내용: z.string().min(1).max(4000).describe("검토할 업무 내용. 주민번호·계좌번호 등은 가려서 보내는 것이 좋습니다."),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ 내용 }) => review(내용),
);

const transport = new StdioServerTransport();
await server.connect(transport);
