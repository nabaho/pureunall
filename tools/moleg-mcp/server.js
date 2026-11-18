#!/usr/bin/env node
"use strict";
/* 법제처(law.go.kr) 국가법령정보센터 및 전 행정심판·특별심판·위원회 재결례 공식 MCP 서버 (Stdio JSON-RPC 2.0)
 *
 * - 외부 npm 의존성 0개 (순수 Node.js 내장 모듈만 사용하여 별도 npm install 없이 즉시 기동)
 * - 판례·헌재·행정심판·특별심판·위원회결정·유권해석·조례·행정규칙은 법제처(https://www.law.go.kr) 공식 원문 SSR/DRF 직결 조회
 * - 현행 국가법령(5,773편) 조문은 LAW_OC 설정 시 법제처 DRF API 직결, 미설정 시 P박스와 동일한 국가법령 공개 미러(legalize-kr) 사용
 * - 프레임 크기 상한(1MB)·배치 크기 상한(10건)·동시 실행 상한(4건)·엄격한 inputSchema 타입 검증 및 개인정보 차단 적용
 */

const core = require("./moleg-core.js");

const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_BATCH_SIZE = 10;
const MAX_CONCURRENT_RPC = 4;
const MAX_QUEUE_SIZE = 32;

const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07"
]);

const SERVER_INSTRUCTIONS = [
  "대한민국 법제처 국가법령정보센터(law.go.kr) 및 중앙행정심판위원회·특별행정심판원·독립위원회 전체 재결·결정례 조회 MCP 서버입니다.",
  "1) 의뢰인 실명·주민등록번호·연락처·계좌번호 등 개인정보는 절대 검색어에 넣지 말고 법령명·조문·사건번호·법리 쟁점어만 전달하세요.",
  "2) 행정심판·소청·노동위·산재재심사·고용보험심사·조세심판·해양안전심판·특허심판·중토위·공정위·개인정보위·인권위·권익위·금융위·방통위·환경분쟁조정위·감사원 사건은 moleg_search_tribunal 도구로 통합 또는 기관별 정밀 조회할 수 있습니다.",
  "3) 판례·재결·해석·조례·행정규칙 결과는 모두 법제처(www.law.go.kr) 실존 공식 원문이며 officialUrl로 검증 가능한 원문 링크가 함께 제공됩니다."
].join("\n");

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const TOOLS = [
  {
    name: "moleg_search_law",
    description: "대한민국 현행 국가법령(법률·시행령·시행규칙 5,773편) 및 노동·공무원·군인·민사·세법 등 연결법률을 검색합니다. 약칭(근기법, 산재법, 행심법, 국공법 등) 자동 변환을 지원합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 60, description: "검색할 법령명·약칭 또는 쟁점어 (예: 근로기준법, 행정심판법, 국가공무원법, 통상임금, 영업비밀)" },
        category: {
          type: "string",
          enum: ["all", "priority", "public_mil", "labor_std", "union", "safety_comp", "equality", "non_regular", "social_ins", "admin_civil", "general"],
          description: "법령 분야 필터 (기본값: all)"
        },
        includeConnected: { type: "boolean", description: "관련 연결법률(민법·행정소송법·공무원법 등) 함께 반환 여부 (기본값: true)" },
        limit: { type: "integer", minimum: 1, maximum: 60, description: "최대 반환 건수 (1~60, 기본값: 20)" }
      },
      additionalProperties: false
    }
  },
  {
    name: "moleg_get_law_article",
    description: "특정 대한민국 현행 법령(법률·시행령·시행규칙)의 특정 조문(예: 제23조, 제76조의2) 원문 또는 전체 조문 목차·본문을 조회합니다 (LAW_OC 설정 시 법제처 DRF API 직결, 미설정 시 국가법령 공개 미러 사용).",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        lawName: { type: "string", maxLength: 120, description: "법령명 또는 약칭 (예: 근로기준법, 행정심판법, 산업재해보상보험법, 국가공무원법)" },
        subType: {
          type: "string",
          enum: ["법률", "본법", "시행령", "시행규칙", "대통령령", "총리령", "부령"],
          description: "하위 법령 구분 (예: 법률, 시행령, 시행규칙 · 생략 시 본법 우선)"
        },
        articleNo: { type: "string", maxLength: 40, description: "조회할 조문 번호 (예: 제23조, 23, 제76조의2 · 생략 시 법령 개요 및 전체 목차·본문 미리보기 반환)" },
        maxChars: { type: "integer", minimum: 1000, maximum: 40000, description: "전체 본문 미리보기 최대 글자 수 (1000~40000, 기본값: 12000)" }
      },
      required: ["lawName"],
      additionalProperties: false
    }
  },
  {
    name: "moleg_search_precedent",
    description: "법제처 국가법령정보센터에서 대법원 판례, 고등·지방·행정법원 하급심 판례, 헌법재판소 결정례를 실시간 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "검색할 법리 쟁점어 또는 사건번호 (예: 통상임금 재직조건, 2020다247190, 요양불승인)" },
        scope: {
          type: "string",
          enum: ["all", "supreme", "lower", "constitutional"],
          description: "조회 범위: all(전체), supreme(대법원), lower(하급심), constitutional(헌법재판소)"
        },
        court: { type: "string", maxLength: 40, description: "법원명 필터 (예: 서울행정법원, 서울고등법원, 서울중앙지방법원, 대법원)" },
        dateFrom: { type: "string", maxLength: 12, description: "선고 시작일 (YYYY-MM-DD, 선택)" },
        dateTo: { type: "string", maxLength: 12, description: "선고 종료일 (YYYY-MM-DD, 선택)" },
        limit: { type: "integer", minimum: 2, maximum: 20, description: "최대 반환 건수 (2~20, 기본값: 8)" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "moleg_search_tribunal",
    description: "중앙행정심판위원회 재결례를 비롯하여 전국 시·도 및 교육청 행심위, 중앙·지방노동위원회, 산재재심사위원회, 고용보험심사위원회, 인사혁신처·지방 소청심사위원회, 조세심판원, 특허심판원, 해양안전심판원, 중앙토지수용위원회, 건강보험분쟁조정위원회, 공정거래위원회, 개인정보보호위원회, 국민권익위원회, 국가인권위원회, 금융위·증선위, 방통위, 중앙환경분쟁조정위원회, 감사원 등 전 심판·재결·결정 채널 사건을 실시간 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "검색할 쟁점어·처분명 또는 사건·재결번호 (예: 영업정지, 환수처분, 부당해고, 요양불승인, 감봉, 구직급여, 퇴직금, 하도급 · 생략 시 preset 기준 조회)" },
        tribunal: {
          type: "string",
          enum: [
            "all", "admin_appeal", "labor_sanjae", "civil_public", "special_tribunal", "committee", "audit_consult",
            "decc", "decc_acrc", "decc_acr_spc", "decc_local",
            "nlrc", "iaciac", "eiac",
            "adap", "local_adap",
            "tt", "kipo_trb", "kmst", "oclt", "hira_trb",
            "nhrck", "ftc", "ppc", "acr", "kcc", "fsc", "sfc", "ecc",
            "baiPvcs"
          ],
          description: "심판·재결 기관 또는 그룹 코드 (기본값: all 전체 채널 통합, 중앙행심 단독은 decc_acrc, 시도·교육청행심은 decc_local, 노동위는 nlrc, 산재재심사위는 iaciac, 고용보험심사위는 eiac, 공무원소청은 adap, 조세심판원은 tt, 해양안전심판원은 kmst, 중토위는 oclt, 공정위는 ftc, 개인정보위는 ppc, 권익위고충은 acr, 인권위는 nhrck)"
        },
        localOrg: {
          type: "string",
          maxLength: 60,
          description: "시·도 및 교육청 행정심판(decc_local) 조회 시 특정 위원회 지정 (예: 경기도행정심판위원회, 부산광역시행정심판위원회, 경기도교육청행정심판위원회)"
        },
        preset: {
          type: "string",
          enum: ["all", "admin_disp", "labor_sanjae", "civil_public", "tax_land_marine", "fair_rights"],
          description: "query 미지정 시 사용할 쟁점 프리셋 (기본값: all)"
        },
        limit: { type: "integer", minimum: 2, maximum: 25, description: "최대 반환 건수 (2~25, 기본값: 10)" }
      },
      additionalProperties: false
    }
  },
  {
    name: "moleg_list_tribunals",
    description: "현재 MCP에 연결된 대한민국 행정심판·특별행정심판·위원회 심판·재결 채널 목록, 전국 시·도/교육청 행정심판위원회 명단, 기관 코드(tribunal) 및 Open API / 공식원문 SSR 연결 상태를 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "moleg_search_interpretation",
    description: "법제처 법령해석례(expc), 고용노동부·국방부·인사혁신처·행안부·교육부 등 39개 중앙부처 유권해석·질의회시(cgmExpc), 법제처 자치법규 의견제시(ordc), 감사원 사전컨설팅 의견서(baiPvcs)를 실시간 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "검색할 질의회시 번호 또는 법령해석 쟁점어 (예: 평균임금 퇴직금, 휴일대체, 연차유급휴가, 법제처 26-0209)" },
        source: {
          type: "string",
          enum: ["all", "moleg", "ministry", "ordinance_opinion", "bai"],
          description: "해석 기관 구분: all(전체), moleg(법제처 법령해석), ministry(고용노동부 등 중앙부처 질의회시), ordinance_opinion(법제처 조례 의견제시), bai(감사원 사전컨설팅)"
        },
        limit: { type: "integer", minimum: 2, maximum: 20, description: "최대 반환 건수 (2~20, 기본값: 10)" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "moleg_search_ordinance_admrul",
    description: "전국 243개 지방자치단체 조례·규칙(자치법규) 및 고용노동부·중앙부처 훈령·예규·고시·지침(행정규칙)을 실시간 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "검색할 조례·고시·예규·지침명 또는 키워드 (예: 생활임금 조례, 근로감독관 집무규정, 업무상 질병 판정지침)" },
        kind: {
          type: "string",
          enum: ["all", "ordinance", "admrul"],
          description: "구분: all(조례+행정규칙), ordinance(지자체 조례·규칙), admrul(부처 훈령·예규·고시)"
        },
        limit: { type: "integer", minimum: 2, maximum: 20, description: "최대 반환 건수 (2~20, 기본값: 10)" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "moleg_get_document",
    description: "법제처 공식 원문 URL(https://www.law.go.kr/LSW/...InfoP.do?...) 또는 문서 종류(target)와 일련번호(seq)로 판례·행정심판재결·특별심판·위원회결정·유권해석 단건 전문을 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        officialUrl: { type: "string", maxLength: 300, description: "법제처 공식 원문 URL (예: https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=273779)" },
        target: {
          type: "string",
          enum: ["prec", "detc", "decc", "specialDecc", "adap", "tt", "kmst", "nlrc", "iaciac", "eiac", "ftc", "ppc", "acr", "nhrck", "oclt", "ecc", "fsc", "kcc", "expc", "cgmExpc", "ordc", "ordin", "admrul", "baiPvcs"],
          description: "officialUrl 대신 일련번호로 조회할 때의 대상 구분"
        },
        seq: { type: "string", maxLength: 20, description: "법제처 문서 일련번호 (순수 숫자 문자열)" },
        code: { type: "string", maxLength: 30, description: "특별행정심판(trbClsCd: 360101 조세, 360103 해양, 360106 소청 등) 또는 중앙부처해석(ofiClsCd) 보조 코드" },
        maxChars: { type: "integer", minimum: 1000, maximum: 40000, description: "본문 최대 반환 글자 수 (1000~40000, 기본값: 15000)" }
      },
      additionalProperties: false
    }
  },
  {
    name: "moleg_unified_search",
    description: "단일 쟁점어에 대해 ① 현행 국가법령·연결법률, ② 대법원·하급심·헌재 판례, ③ 중앙행정심판·노동위·산재재심사위·소청심사위 재결례, ④ 법제처·고용노동부 유권해석 4대 법원을 한 번에 통합 조회합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "통합 조회할 법률 쟁점어 (예: 통상임금, 부당해고, 요양불승인, 영업정지, 징계감봉)" },
        limitPerCategory: { type: "integer", minimum: 2, maximum: 8, description: "분야별 최대 조회 건수 (2~8, 기본값: 4)" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "moleg_auto_discover",
    description: "무료 법률·심판 사이트의 홈페이지 개편·메뉴 변경·복합 질의로 일반 조회가 어려울 때, 약칭 확장·핵심어 분해·대체 공식 엔드포인트 우회·자율 DOM/JSON 파서 및 공공도메인(.go.kr) 정밀 탐색 경로를 총동원하여 실존 공식 원문을 자동 복구 탐색합니다.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 50, description: "자동 복구 탐색할 쟁점어·문장 또는 사건·문서번호" },
        limit: { type: "integer", minimum: 2, maximum: 25, description: "최대 반환 건수 (2~25, 기본값: 12)" }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

function validateToolArguments(schema, rawArgs) {
  if (rawArgs === undefined || rawArgs === null) {
    rawArgs = {};
  }
  if (typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return "도구 인자(arguments)는 JSON 객체여야 합니다.";
  }
  const props = (schema && schema.properties) || {};
  const reqList = Array.isArray(schema && schema.required) ? schema.required : [];

  if (schema && schema.additionalProperties === false) {
    for (const k of Object.keys(rawArgs)) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) {
        return "허용되지 않은 인자입니다: " + k;
      }
    }
  }

  for (const rk of reqList) {
    if (rawArgs[rk] === undefined || rawArgs[rk] === null || rawArgs[rk] === "") {
      return "필수 인자가 누락되었습니다: " + rk;
    }
  }

  for (const [k, v] of Object.entries(rawArgs)) {
    if (v === undefined) continue;
    const spec = props[k];
    if (!spec) continue;
    if (spec.type === "string") {
      if (typeof v !== "string") {
        return k + " 인자는 문자열(string)이어야 합니다.";
      }
      if (spec.maxLength !== undefined && v.length > spec.maxLength) {
        return k + " 인자 길이는 최대 " + spec.maxLength + "자 이하여야 합니다.";
      }
    }
    if (spec.type === "integer") {
      if (typeof v !== "number" || !Number.isInteger(v)) {
        return k + " 인자는 정수(숫자)여야 합니다.";
      }
      if (spec.minimum !== undefined && v < spec.minimum) {
        return k + " 인자는 최소 " + spec.minimum + " 이상이어야 합니다.";
      }
      if (spec.maximum !== undefined && v > spec.maximum) {
        return k + " 인자는 최대 " + spec.maximum + " 이하여야 합니다.";
      }
    }
    if (spec.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return k + " 인자는 유한한 숫자(number)여야 합니다.";
      }
      if (spec.minimum !== undefined && v < spec.minimum) {
        return k + " 인자는 최소 " + spec.minimum + " 이상이어야 합니다.";
      }
      if (spec.maximum !== undefined && v > spec.maximum) {
        return k + " 인자는 최대 " + spec.maximum + " 이하여야 합니다.";
      }
    }
    if (spec.type === "boolean" && typeof v !== "boolean") {
      return k + " 인자는 불리언(boolean)이어야 합니다.";
    }
    if (Array.isArray(spec.enum) && !spec.enum.includes(v)) {
      return k + " 인자 값이 허용 목록에 없습니다: " + String(v);
    }
  }
  return "";
}

async function executeToolCall(name, args, runtimeOpts) {
  const toolDef = TOOL_MAP.get(String(name || ""));
  if (!toolDef) {
    throw new Error("알 수 없는 도구입니다: " + String(name));
  }
  const schemaErr = validateToolArguments(toolDef.inputSchema, args);
  if (schemaErr) {
    throw new Error(schemaErr);
  }

  switch (name) {
    case "moleg_list_tribunals":
      return await core.listTribunals(runtimeOpts && runtimeOpts.env);
    case "moleg_search_law":
      return await core.searchLaws(args, runtimeOpts);
    case "moleg_get_law_article":
      return await core.getLawArticle(args, runtimeOpts);
    case "moleg_search_precedent":
      return await core.searchPrecedents(args, runtimeOpts);
    case "moleg_search_tribunal":
      return await core.searchTribunals(args, runtimeOpts);
    case "moleg_search_interpretation":
      return await core.searchInterpretations(args, runtimeOpts);
    case "moleg_search_ordinance_admrul":
      return await core.searchOrdinanceAndAdmrul(args, runtimeOpts);
    case "moleg_get_document":
      return await core.getOfficialDocument(args, runtimeOpts);
    case "moleg_unified_search":
      return await core.unifiedSearch(args, runtimeOpts);
    case "moleg_auto_discover":
      return await core.autoDiscover(args, runtimeOpts);
    default:
      throw new Error("알 수 없는 도구입니다: " + String(name));
  }
}

function isValidRpcId(idVal) {
  return idVal === null || typeof idVal === "string" || (typeof idVal === "number" && Number.isFinite(idVal));
}

async function dispatchRpcMessage(msg, runtimeOpts) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0") {
    const fallbackId = msg && Object.prototype.hasOwnProperty.call(msg, "id") && isValidRpcId(msg.id) ? msg.id : null;
    return {
      jsonrpc: "2.0",
      id: fallbackId,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" }
    };
  }

  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
  if (hasId && !isValidRpcId(msg.id)) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid JSON-RPC id (must be string, finite number, or null)" }
    };
  }
  const method = String(msg.method || "");
  if (msg.params !== undefined && (typeof msg.params !== "object" || msg.params === null || Array.isArray(msg.params))) {
    if (!hasId) return null;
    return {
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32602, message: "Invalid params: object expected" }
    };
  }
  const params = msg.params || {};

  if (!hasId) {
    return null;
  }

  try {
    if (method === "initialize") {
      const clientVer = String(params.protocolVersion || "2025-06-18");
      const negotiated = SUPPORTED_PROTOCOL_VERSIONS.has(clientVer) ? clientVer : "2025-06-18";
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: negotiated,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: "moleg-law",
            version: "1.0.0"
          },
          instructions: SERVER_INSTRUCTIONS
        }
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id: msg.id, result: {} };
    }

    if (method === "tools/list") {
      return { jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } };
    }

    if (method === "resources/list") {
      return { jsonrpc: "2.0", id: msg.id, result: { resources: [] } };
    }

    if (method === "resources/templates/list") {
      return { jsonrpc: "2.0", id: msg.id, result: { resourceTemplates: [] } };
    }

    if (method === "prompts/list") {
      return { jsonrpc: "2.0", id: msg.id, result: { prompts: [] } };
    }

    if (method === "tools/call") {
      const toolName = String(params.name || "");
      if (!TOOL_MAP.has(toolName)) {
        return {
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32602, message: "Unknown tool: " + toolName }
        };
      }
      const rawToolArgs = params.arguments === undefined ? {} : params.arguments;
      try {
        const out = await executeToolCall(toolName, rawToolArgs, runtimeOpts);
        return {
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(out, null, 2)
              }
            ],
            isError: false
          }
        };
      } catch (toolErr) {
        return {
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [
              {
                type: "text",
                text: "오류: " + String((toolErr && toolErr.message) || toolErr)
              }
            ],
            isError: true
          }
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: "Method not found: " + method }
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32603, message: String((err && err.message) || err) }
    };
  }
}

function startStdioServer() {
  let rawBuf = Buffer.alloc(0);
  let framingMode = "ndjson";
  let activeCount = 0;
  const waitQueue = [];

  function runWithConcurrencyLimit(taskFn, fallbackId) {
    return new Promise((resolve) => {
      if (activeCount >= MAX_CONCURRENT_RPC && waitQueue.length >= MAX_QUEUE_SIZE) {
        resolve({
          jsonrpc: "2.0",
          id: isValidRpcId(fallbackId) ? fallbackId : null,
          error: { code: -32000, message: "Server busy: request queue limit (" + MAX_QUEUE_SIZE + ") exceeded" }
        });
        return;
      }
      const execute = () => {
        activeCount++;
        Promise.resolve()
          .then(taskFn)
          .catch((e) => ({
            jsonrpc: "2.0",
            id: isValidRpcId(fallbackId) ? fallbackId : null,
            error: { code: -32603, message: String((e && e.message) || e) }
          }))
          .then((res) => {
            activeCount--;
            if (waitQueue.length > 0) {
              const next = waitQueue.shift();
              next();
            }
            resolve(res);
          });
      };
      if (activeCount < MAX_CONCURRENT_RPC) execute();
      else waitQueue.push(execute);
    });
  }

  function writeFrame(obj) {
    if (!obj) return;
    const payload = JSON.stringify(obj);
    if (framingMode === "content-length") {
      const byteLen = Buffer.byteLength(payload, "utf8");
      process.stdout.write("Content-Length: " + byteLen + "\r\n\r\n" + payload);
    } else {
      process.stdout.write(payload + "\n");
    }
  }

  function handleParsedJson(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      writeFrame({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" }
      });
      return;
    }

    if (Array.isArray(parsed)) {
      if (!parsed.length || parsed.length > MAX_BATCH_SIZE) {
        writeFrame({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid batch size (1.." + MAX_BATCH_SIZE + ")" }
        });
        return;
      }
      Promise.all(parsed.map((item) => {
        const fid = item && typeof item === "object" && !Array.isArray(item) && Object.prototype.hasOwnProperty.call(item, "id") ? item.id : null;
        return runWithConcurrencyLimit(() => dispatchRpcMessage(item), fid);
      })).then((resArr) => {
        const filtered = resArr.filter(Boolean);
        if (filtered.length) writeFrame(filtered);
      });
      return;
    }

    const singleId = parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "id") ? parsed.id : null;
    runWithConcurrencyLimit(() => dispatchRpcMessage(parsed), singleId).then((res) => {
      if (res) writeFrame(res);
    });
  }

  function drainBuffer() {
    while (rawBuf.length > 0) {
      if (rawBuf[0] === 0x0d || rawBuf[0] === 0x0a) {
        let skip = 0;
        while (skip < rawBuf.length && (rawBuf[skip] === 0x0d || rawBuf[skip] === 0x0a)) skip++;
        rawBuf = rawBuf.subarray(skip);
        if (!rawBuf.length) break;
      }

      const asciiHead = rawBuf.subarray(0, Math.min(rawBuf.length, 32)).toString("ascii");
      if (/^Content-Length:/i.test(asciiHead)) {
        framingMode = "content-length";
        const sepIdx = rawBuf.indexOf("\r\n\r\n");
        const altSepIdx = sepIdx < 0 ? rawBuf.indexOf("\n\n") : -1;
        const headerEnd = sepIdx >= 0 ? sepIdx : altSepIdx;
        const sepLen = sepIdx >= 0 ? 4 : 2;
        if (headerEnd < 0) {
          if (rawBuf.length > 4096) {
            rawBuf = Buffer.alloc(0);
            writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Header too large" } });
          }
          break;
        }

        const headerStr = rawBuf.subarray(0, headerEnd).toString("ascii");
        const m = /Content-Length:\s*(\d+)/i.exec(headerStr);
        if (!m) {
          rawBuf = rawBuf.subarray(headerEnd + sepLen);
          writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Content-Length header" } });
          continue;
        }
        const bodyLen = Number(m[1]);
        if (!Number.isSafeInteger(bodyLen) || bodyLen < 0 || bodyLen > MAX_FRAME_BYTES) {
          rawBuf = Buffer.alloc(0);
          writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Frame exceeds max allowed bytes (" + MAX_FRAME_BYTES + ")" } });
          break;
        }
        if (rawBuf.length < headerEnd + sepLen + bodyLen) break;
        const bodyStr = rawBuf.subarray(headerEnd + sepLen, headerEnd + sepLen + bodyLen).toString("utf8");
        rawBuf = rawBuf.subarray(headerEnd + sepLen + bodyLen);
        handleParsedJson(bodyStr);
        continue;
      }

      const nlIdx = rawBuf.indexOf(0x0a);
      if (nlIdx < 0) {
        if (rawBuf.length > MAX_FRAME_BYTES) {
          rawBuf = Buffer.alloc(0);
          writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Frame exceeds max allowed bytes (" + MAX_FRAME_BYTES + ")" } });
        }
        break;
      }
      if (nlIdx > MAX_FRAME_BYTES) {
        rawBuf = rawBuf.subarray(nlIdx + 1);
        writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Frame exceeds max allowed bytes (" + MAX_FRAME_BYTES + ")" } });
        continue;
      }
      const lineStr = rawBuf.subarray(0, nlIdx).toString("utf8").replace(/\r$/, "").trim();
      rawBuf = rawBuf.subarray(nlIdx + 1);
      if (!lineStr) continue;
      handleParsedJson(lineStr);
    }
  }

  process.stdin.on("data", (chunk) => {
    const bufChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (rawBuf.length + bufChunk.length > MAX_FRAME_BYTES * 2) {
      rawBuf = Buffer.alloc(0);
      writeFrame({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Input buffer overflow" } });
      return;
    }
    rawBuf = Buffer.concat([rawBuf, bufChunk]);
    drainBuffer();
  });

  process.stdin.on("error", () => {});
  process.stdin.resume();
}

if (require.main === module) {
  startStdioServer();
}

module.exports = {
  MAX_FRAME_BYTES,
  MAX_BATCH_SIZE,
  MAX_CONCURRENT_RPC,
  TOOLS,
  validateToolArguments,
  dispatchRpcMessage,
  executeToolCall,
  startStdioServer
};
