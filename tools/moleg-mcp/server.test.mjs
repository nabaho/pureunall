import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const mcpServer = require("./server.js");
const core = require("./moleg-core.js");

test("① moleg-law MCP initialize · 필수 도구 · 전 심판채널 무누락(all == 전체 채널) 검증", async () => {
  const initRes = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } }
  });
  assert.equal(initRes.result.protocolVersion, "2024-11-05");
  assert.equal(initRes.result.serverInfo.name, "moleg-law");

  const listRes = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });
  const names = listRes.result.tools.map((t) => t.name);
  for (const reqTool of [
    "moleg_search_law",
    "moleg_get_law_article",
    "moleg_search_precedent",
    "moleg_search_tribunal",
    "moleg_list_tribunals",
    "moleg_search_interpretation",
    "moleg_search_ordinance_admrul",
    "moleg_get_document",
    "moleg_unified_search"
  ]) {
    assert.ok(names.includes(reqTool), "필수 MCP 도구 누락: " + reqTool);
  }

  const trbListCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "moleg_list_tribunals", arguments: {} }
  }, { env: {} });
  assert.equal(trbListCall.result.isError, false);
  const trbPayload = JSON.parse(trbListCall.result.content[0].text);
  const ids = trbPayload.tribunals.map((x) => x.id);
  assert.ok(ids.length >= 20);
  /* tribunal='all' 그룹이 등록된 전체 심판·재결 채널과 차집합 없이 100% 일치해야 함 */
  const allSet = new Set(trbPayload.groups.all);
  const missingFromAll = ids.filter((id) => !allSet.has(id));
  assert.deepEqual(missingFromAll, [], "all 그룹에서 누락된 심판채널이 없어야 합니다");

  for (const reqId of ["decc", "decc_acrc", "decc_acr_spc", "decc_local", "nlrc", "iaciac", "eiac", "adap", "local_adap", "tt", "kipo_trb", "kmst", "oclt", "hira_trb", "ftc", "ppc", "acr", "nhrck", "fsc", "sfc", "kcc", "ecc", "baiPvcs"]) {
    assert.ok(ids.includes(reqId), "누락된 심판기관 코드: " + reqId);
  }
});

test("② inputSchema 엄격 검증 · 비숫자 seq 차단 · 전체 상위 네트워크 실패 시 isError=true 반환 검증", async () => {
  const badLimit = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 20,
    method: "tools/call",
    params: { name: "moleg_search_law", arguments: { query: "근로기준법", limit: "bad" } }
  });
  assert.equal(badLimit.result.isError, true);
  assert.match(badLimit.result.content[0].text, /숫자/);

  const badExtraProp = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 21,
    method: "tools/call",
    params: { name: "moleg_search_law", arguments: { query: "근로기준법", unexpected: true } }
  });
  assert.equal(badExtraProp.result.isError, true);
  assert.match(badExtraProp.result.content[0].text, /허용되지 않은 인자/);

  const badSeq = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 22,
    method: "tools/call",
    params: { name: "moleg_get_document", arguments: { target: "decc", seq: "abc123" } }
  });
  assert.equal(badSeq.result.isError, true);
  assert.match(badSeq.result.content[0].text, /순수 숫자/);

  const alwaysFailFetch = async () => {
    throw new Error("network unreachable");
  };
  for (const [toolName, toolArgs] of [
    ["moleg_search_tribunal", { tribunal: "decc_acrc", query: "영업정지" }],
    ["moleg_search_precedent", { query: "통상임금" }],
    ["moleg_search_interpretation", { query: "평균임금" }],
    ["moleg_search_ordinance_admrul", { query: "생활임금" }]
  ]) {
    const failCall = await mcpServer.dispatchRpcMessage({
      jsonrpc: "2.0",
      id: 30,
      method: "tools/call",
      params: { name: toolName, arguments: toolArgs }
    }, { fetchFn: alwaysFailFetch, env: {} });
    assert.equal(failCall.result.isError, true, toolName + " 전체 네트워크 실패 시 isError:true 여야 합니다");
  }

  /* fetchTextBounded 바이트 상한 초과 차단 확인 */
  await assert.rejects(
    () => core.fetchTextBounded(async () => ({
      ok: true,
      status: 200,
      url: "https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=1",
      text: async () => "x".repeat(10000)
    }), "https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=1", { maxBytes: 4096 }),
    /상한/
  );
});

test("③ moleg_search_law 약칭·연결법률 · 개인정보 차단 · SSRF 차단 · LAW_OC 조문 직결 검증", async () => {
  const lawCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: { name: "moleg_search_law", arguments: { query: "근기법", limit: 5 } }
  });
  assert.equal(lawCall.result.isError, false);
  const parsed = JSON.parse(lawCall.result.content[0].text);
  assert.ok(parsed.totalIndexedFiles >= 5000);
  assert.equal(parsed.laws[0].title, "근로기준법");

  const piiCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "moleg_search_tribunal", arguments: { query: "홍길동 900101-1234567 영업정지" } }
  });
  assert.equal(piiCall.result.isError, true);
  assert.match(piiCall.result.content[0].text, /개인정보/);

  const ssrfCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: { name: "moleg_get_document", arguments: { officialUrl: "https://evil.example.com/LSW/deccInfoP.do?deccSeq=1" } }
  });
  assert.equal(ssrfCall.result.isError, true);
  assert.match(ssrfCall.result.content[0].text, /허용되지 않은 URL/);

  /* LAW_OC 설정 시 법제처 DRF(law.go.kr) 직접 조문 조회 검증 */
  const drfLawFetch = async (url) => {
    const s = String(url);
    if (s.includes("lawSearch.do")) {
      return { ok: true, status: 200, url: s, text: async () => JSON.stringify({ LawSearch: { totalCnt: "1", law: [{ 법령명한글: "행정심판법", 법령ID: "001356", 법령일련번호: "260001", 시행일자: "20260101" }] } }) };
    }
    return {
      ok: true,
      status: 200,
      url: s,
      text: async () => JSON.stringify({
        법령: {
          기본정보: { 법령명_한글: "행정심판법", 법령ID: "001356", 소관부처: "국민권익위원회", 시행일자: "20260101" },
          조문: { 조문단위: [{ 조문여부: "조문", 조문번호: "13", 조문제목: "청구인 적격", 조문내용: "제13조(청구인 적격) 취소심판은 처분의 취소 또는 변경을 구할 법률상 이익이 있는 자가 청구할 수 있다." }] }
        }
      })
    };
  };
  const drfArtCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: { name: "moleg_get_law_article", arguments: { lawName: "행정심판법", articleNo: "제13조" } }
  }, { fetchFn: drfLawFetch, env: { LAW_OC: "test_oc" } });
  assert.equal(drfArtCall.result.isError, false);
  const drfArtJson = JSON.parse(drfArtCall.result.content[0].text);
  assert.equal(drfArtJson.channel, "law.go.kr_drf_api");
  assert.equal(drfArtJson.article.no, "제13조");
});

test("④ Stdio 자식 프로세스 개행 JSON-RPC · Content-Length · 과대 배치 거부 검증", async () => {
  const serverPath = path.join(__dirname, "server.js");

  const ndOut = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString("utf8");
      const lines = stdout.trim().split("\n").filter(Boolean);
      if (lines.length >= 3) {
        child.kill();
        resolve(lines.map((l) => JSON.parse(l)));
      }
    });
    child.on("error", reject);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }) + "\n");
    const hugeBatch = Array.from({ length: 15 }, (_, i) => ({ jsonrpc: "2.0", id: 100 + i, method: "ping" }));
    child.stdin.write(JSON.stringify(hugeBatch) + "\n");
  });
  const initFrame = ndOut.find((x) => x.id === 1);
  const pingFrame = ndOut.find((x) => x.id === 2);
  const batchErrFrame = ndOut.find((x) => x.error && x.error.code === -32600);
  assert.equal(initFrame.result.protocolVersion, "2025-03-26");
  assert.deepEqual(pingFrame.result, {});
  assert.ok(batchErrFrame);

  const clOut = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    child.stdout.on("data", (c) => {
      buf += c.toString("utf8");
      if (buf.includes("\r\n\r\n") && buf.includes('"serverInfo"')) {
        child.kill();
        resolve(buf);
      }
    });
    child.on("error", reject);
    const body = JSON.stringify({ jsonrpc: "2.0", id: 99, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    child.stdin.write("Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body);
  });
  assert.match(clOut, /^Content-Length:\s*\d+\r\n\r\n/);
  assert.match(clOut, /"moleg-law"/);
});

test("⑤ [회귀방지] deccInfoP URL 분류(M3) · unifiedSearch 4대법원 공정배분(M2) · 판례 날짜/법원 검증(M4) · 시행령 정확매칭(M7) · JSON-RPC 규격(L1~L5)", async () => {
  /* M3: deccInfoP.do URL이 eccInfoP.do 부분문자열과 혼동되지 않고 decc(중앙행심)로 정확히 파싱되어야 함 + L5: 4,000자 초과 전문 보존 */
  const longReason = "처분사유에 비하여 달성하려는 공익보다 청구인이 입게 될 불이익이 현저히 크다. ".repeat(140);
  const deccDocCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 501,
    method: "tools/call",
    params: {
      name: "moleg_get_document",
      arguments: {
        officialUrl: "https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=273779",
        maxChars: 12000
      }
    }
  }, {
    env: {},
    fetchFn: async (u) => ({
      ok: true,
      status: 200,
      url: String(u),
      text: async () => "<div id=\"conTop\">영업정지처분 취소청구<br>[국민권익위원회 2026-10301, 2026. 8. 18., 인용]<br>【주문】<br>처분을 취소한다.<br>【이유】<br>" + longReason + "</div>"
    })
  });
  assert.equal(deccDocCall.result.isError, false);
  const deccDoc = JSON.parse(deccDocCall.result.content[0].text);
  assert.equal(deccDoc.caseNo, "중앙행심 2026-10301");
  assert.match(deccDoc.court, /중앙행정심판위원회/);
  assert.ok(deccDoc.body.length > 4500, "moleg_get_document 단건 조회는 4,000자에서 조기 절단되지 않아야 합니다");

  /* M2: unifiedSearch 호출 시 앞선 판례 채널이 상세 예산을 독식하지 않고 판례·재결·유권해석 4대 법원이 모두 채워져야 함 */
  const unifiedMockFetch = async (url) => {
    const s = String(url);
    if (s.includes("precSc.do")) {
      return { ok: true, status: 200, url: s, text: async () => [1, 2, 3, 4].map((n) => `<a onclick="precView('${100 + n}')">임금 [대법원 2024. 12. 19. 선고 2020다24719${n}]</a><a onclick="precView('${200 + n}')">임금 [서울고등법원 2024. 5. 10. 선고 2023나100${n}]</a>`).join("") };
    }
    if (s.includes("detcSc.do")) {
      return { ok: true, status: 200, url: s, text: async () => [1, 2, 3, 4].map((n) => `<a onclick="detcView('${300 + n}')">위헌소원 [2022헌바10${n}, 2024. 6. 27.]</a>`).join("") };
    }
    if (s.includes("deccSc.do")) {
      return { ok: true, status: 200, url: s, text: async () => `<a onclick="deccView('401','Y')">환수처분 취소 [국민권익위원회 2025-10401, 2025. 9. 1., 인용]</a><a onclick="nlrcView('402')">부당해고 [2025부해402, 2025. 9. 2., 노동위원회]</a>` };
    }
    if (s.includes("cgmExpcSc.do")) {
      return { ok: true, status: 200, url: s, text: async () => `<a onclick="cgmExpcView('501','241100')">통상임금 산정 기준 [고용노동부 임금근로시간과-501, 2025. 4. 10.]</a>` };
    }
    if (s.includes("expcSc.do")) {
      return { ok: true, status: 200, url: s, text: async () => `<a onclick="expcView('601')">퇴직급여 산정 [법제처 25-0601, 2025. 5. 20.]</a>` };
    }
    if (s.includes("precInfoP.do")) {
      return { ok: true, status: 200, url: s, text: async () => "<div id=\"conTop\">임금<br>[대법원 2024. 12. 19. 선고 2020다247190 판결]<br>【판결요지】<br>소정근로의 대가로서 정기적·일률적으로 지급되는 임금은 통상임금에 해당한다.</div>" };
    }
    if (s.includes("detcInfoP.do")) {
      return { ok: true, status: 200, url: s, text: async () => "<div id=\"conTop\">근로기준법 위헌소원<br>[2022헌바101, 2024. 6. 27.]<br>【결정요지】<br>입법재량의 한계를 일탈하지 아니하여 헌법에 위반되지 아니한다.</div>" };
    }
    if (s.includes("deccInfoP.do") || s.includes("nlrcInfoP.do")) {
      return { ok: true, status: 200, url: s, text: async () => "<div id=\"conTop\">처분 취소<br>[국민권익위원회 2025-10401, 2025. 9. 1., 인용]<br>【주문】<br>처분을 취소한다. 재량권 일탈·남용이 인정된다.</div>" };
    }
    if (s.includes("cgmExpcInfoP.do") || s.includes("expcInfoP.do")) {
      return { ok: true, status: 200, url: s, text: async () => "<div id=\"conTop\">통상임금 질의회시<br>[고용노동부 임금근로시간과-501, 2025. 4. 10.]<br>【회답】<br>소정근로 대가성이 인정되는 정기상여금은 통상임금에 산입하여야 합니다.</div>" };
    }
    return { ok: false, status: 404, url: s, text: async () => "" };
  };
  const uniRes = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 502,
    method: "tools/call",
    params: { name: "moleg_unified_search", arguments: { query: "통상임금", limitPerCategory: 4 } }
  }, { env: {}, fetchFn: unifiedMockFetch });
  assert.equal(uniRes.result.isError, false);
  const uniPayload = JSON.parse(uniRes.result.content[0].text);
  assert.ok(uniPayload.statutes.length >= 1, "법령 결과 존재");
  assert.ok(uniPayload.precedents.length >= 1, "판례 결과 존재");
  assert.ok(uniPayload.tribunals.length >= 1, "심판·재결 결과 존재");
  assert.ok(uniPayload.interpretations.length >= 1, "유권해석 결과 존재(예산 고갈 없음)");

  /* M4: scope='all'에서도 잘못된 날짜 형식이나 역전된 기간은 즉시 오류 반환 + L1: count === docs.length */
  const badDateCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 503,
    method: "tools/call",
    params: { name: "moleg_search_precedent", arguments: { query: "통상임금", scope: "all", dateFrom: "2025-13-45" } }
  }, { env: {}, fetchFn: unifiedMockFetch });
  assert.equal(badDateCall.result.isError, true);
  assert.match(badDateCall.result.content[0].text, /선고 시작일/);

  const countAlignCall = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 504,
    method: "tools/call",
    params: { name: "moleg_search_precedent", arguments: { query: "통상임금", scope: "all", limit: 2 } }
  }, { env: {}, fetchFn: unifiedMockFetch });
  assert.equal(countAlignCall.result.isError, false);
  const countAlignData = JSON.parse(countAlignCall.result.content[0].text);
  assert.equal(countAlignData.count, countAlignData.docs.length, "count는 실제 반환된 docs 배열 길이와 일치해야 합니다");

  /* M7 + L9: subType='시행령' 요청 시 DRF가 본법만 반환하면 본법을 잘못 돌려주지 않고 시행령 미러로 폴백하며 배열 항내용도 정상 조합 */
  const decreeFallbackFetch = async (url) => {
    const s = String(url);
    if (s.includes("lawSearch.do")) {
      return { ok: true, status: 200, url: s, text: async () => JSON.stringify({ LawSearch: { totalCnt: "1", law: [{ 법령명한글: "근로기준법", 법령ID: "001872", 법령일련번호: "260999" }] } }) };
    }
    if (s.includes("raw.githubusercontent.com")) {
      return { ok: true, status: 200, url: s, text: async () => "---\n법령명: 근로기준법 시행령\n시행일자: 2025-02-23\n---\n### 제6조(통상임금)\n① 법과 이 영에서 통상임금이란 근로자에게 정기적이고 일률적으로 소정근로 또는 총근로에 대하여 지급하기로 정한 금액을 말한다.\n" };
    }
    return { ok: false, status: 404, url: s, text: async () => "" };
  };
  const decreeRes = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 505,
    method: "tools/call",
    params: { name: "moleg_get_law_article", arguments: { lawName: "근로기준법", subType: "시행령", articleNo: "제6조" } }
  }, { env: { LAW_OC: "test_oc" }, fetchFn: decreeFallbackFetch });
  assert.equal(decreeRes.result.isError, false);
  const decreeJson = JSON.parse(decreeRes.result.content[0].text);
  assert.match(decreeJson.title, /시행령/, "시행령 요청 시 본법이 잘못 반환되면 안 됩니다");
  assert.equal(decreeJson.article.no, "제6조");

  /* L2 + L4: 소수점·범위초과 limit 차단, 객체 id(-32600), 미등록 도구(-32602), 미래 protocolVersion 협상("2025-06-18") */
  const floatLimit = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 506,
    method: "tools/call",
    params: { name: "moleg_search_law", arguments: { query: "근기법", limit: 2.5 } }
  });
  assert.equal(floatLimit.result.isError, true);
  assert.match(floatLimit.result.content[0].text, /정수/);

  const zeroLimit = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 507,
    method: "tools/call",
    params: { name: "moleg_search_law", arguments: { query: "근기법", limit: 0 } }
  });
  assert.equal(zeroLimit.result.isError, true);

  const badObjId = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: { nested: 1 },
    method: "ping"
  });
  assert.equal(badObjId.error.code, -32600);
  assert.equal(badObjId.id, null);

  const unknownTool = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 508,
    method: "tools/call",
    params: { name: "nonexistent_tool", arguments: {} }
  });
  assert.ok(unknownTool.error && unknownTool.error.code === -32602);

  const futureVer = await mcpServer.dispatchRpcMessage({
    jsonrpc: "2.0",
    id: 509,
    method: "initialize",
    params: { protocolVersion: "2099-01-01" }
  });
  assert.equal(futureVer.result.protocolVersion, "2025-06-18");
});
