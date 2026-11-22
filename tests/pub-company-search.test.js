"use strict";

/* 🔍 무료 공공 기업검색 + 나이스비즈(폰 미러·웹) 연결 검사
   - functions/pub-company-search.js (금융위 + 국세청 + 고용·산재 + Open DART/NICE 슬롯)
   - js/pu-pub-search.js (빈 칸만 채우기 규칙 + 안전 URL + 상세 바)
   - functions/index.js (서울 리전 + 토큰·재직자 관문)
   - pu-cards.html (스크립트·버튼 배선) */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const S = require("../functions/pub-company-search");
const UI = require("../js/pu-pub-search");

test("① 회사명 검색 — 금융위 중복 제거 + 국세청 사업상태 일괄 결합", async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || "GET" });
    if (url.includes("getCorpOutline_V2")) {
      return {
        ok: true,
        json: async () => ({
          response: {
            header: { resultCode: "00" },
            body: {
              items: {
                item: [
                  { corpNm: "주식회사 테스트", bzno: "123-45-67890", enpRprFnm: "", enpBsadr: "" },
                  {
                    corpNm: "주식회사 테스트",
                    bzno: "1234567890",
                    crno: "1101111234567",
                    enpRprFnm: "홍길동",
                    enpTlno: "02-1234-5678",
                    enpFxno: "-",
                    enpHmpgUrl: "test.co.kr",
                    enpBsadr: "서울특별시 강남구",
                    enpDtadr: "테헤란로 1",
                    enpEstbDt: "20200102",
                    sicNm: "소프트웨어 개발업",
                    enpEmpeCnt: "25",
                    smenpYn: "Y",
                  },
                ],
              },
            },
          },
        }),
      };
    }
    if (url.includes("nts-businessman/v1/status")) {
      return {
        ok: true,
        json: async () => ({
          data: [{ b_no: "1234567890", b_stt: "계속사업자", tax_type: "부가가치세 일반과세자", end_dt: "" }],
        }),
      };
    }
    throw new Error("unexpected url: " + url);
  };

  const r = await S.searchPublicCompany({
    query: "테스트",
    keys: { ntsKey: "SECRET_NTS_KEY" },
    fetchFn,
  });

  assert.equal(r.ok, true);
  assert.equal(r.mode, "name");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].ceo, "홍길동");
  assert.equal(r.items[0].bizNo, "1234567890");
  assert.equal(r.items[0].fax, "");
  assert.equal(r.items[0].homepage, "http://test.co.kr");
  assert.equal(r.items[0].estDate, "2020-01-02");
  assert.equal(r.items[0].sme, true);
  assert.equal(r.items[0].nts.state, "계속사업자");
  assert.equal(r.items[0].nts.cls, "ok");
  assert.equal(r.integrations.dart.configured, false);
  assert.equal(r.integrations.nice.configured, false);
  assert.equal(calls.length, 2);
});

test("② 사업자번호 10자리 검색 — 국세청 + 고용·산재 + 금융위 보조 조회 결합", async () => {
  const fetchFn = async (url) => {
    if (url.includes("nts-businessman/v1/status")) {
      return {
        ok: true,
        json: async () => ({
          data: [{ b_no: "1248100998", b_stt: "계속사업자", tax_type: "부가가치세 일반과세자", end_dt: "" }],
        }),
      };
    }
    if (url.includes("getGySjBoheomBsshItem")) {
      return {
        ok: true,
        json: async () => ({
          response: {
            body: {
              items: {
                item: [
                  { saeopjangNm: "샘플기업(주)", opaBoheomFg: "2", sangsiInwonCnt: "42", gyEopjongNm: "제조업", addr: "경기도 수원시" },
                  { saeopjangNm: "샘플기업(주)", opaBoheomFg: "1", sangsiInwonCnt: "45", sjEopjongNm: "제조업", addr: "경기도 수원시" },
                ],
              },
            },
          },
        }),
      };
    }
    if (url.includes("getCorpOutline_V2")) {
      return {
        ok: true,
        json: async () => ({
          response: {
            header: { resultCode: "00" },
            body: {
              items: {
                item: [{ corpNm: "샘플기업(주)", bzno: "1248100998", enpRprFnm: "김대표", enpBsadr: "경기도 수원시" }],
              },
            },
          },
        }),
      };
    }
    throw new Error("unexpected url: " + url);
  };

  const r = await S.searchPublicCompany({
    query: "124-81-00998",
    keys: { ntsKey: "SECRET_NTS_KEY", dartKey: "DART_K", niceKey: "NICE_K" },
    fetchFn,
  });

  assert.equal(r.ok, true);
  assert.equal(r.mode, "bizNo");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].ceo, "김대표");
  assert.equal(r.items[0].ei.gy, 42);
  assert.equal(r.items[0].ei.sj, 45);
  assert.equal(r.items[0].nts.state, "계속사업자");
  assert.equal(r.integrations.dart.configured, true);
  assert.equal(r.integrations.nice.configured, true);
});

test("③ 단건 고용·산재 상세 조회 및 API 열쇠 마스킹", async () => {
  const secret = "TOP_SECRET_KEY_999";
  const failFetch = async () => { throw new Error("network error with " + secret); };
  const r = await S.searchPublicCompany({
    detailBizNo: "123-45-67890",
    keys: { ntsKey: secret },
    fetchFn: failFetch,
  });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "detail");
  assert.ok(r.warnings.length >= 1);
  assert.ok(!JSON.stringify(r).includes(secret), "★ 응답·경고에 API 열쇠가 노출되면 안 됩니다");

  const noKey = await S.searchPublicCompany({ query: "삼성", keys: {}, fetchFn: failFetch });
  assert.equal(noKey.ok, false);
});

test("④ 기업정보함 반영(buildCoInfoPatch) — 빈 칸만 채우고 기존 입력은 절대 덮어쓰지 않는다", () => {
  const item = {
    name: "새회사",
    bizNo: "1234567890",
    ceo: "공공대표",
    address: "서울시 강남구",
    phone: "02-1111-2222",
    homepage: "javascript:alert(1)",
    nts: { state: "계속사업자", endDt: "" },
  };
  const existing = {
    ceo: "사람이적은대표",
    src: { ceo: "직접입력" },
  };
  const res = UI.buildCoInfoPatch(item, existing, 1700000000000);
  assert.equal(res.bizNo, "1234567890");
  assert.equal(res.patch.ceo, undefined, "★ 사람이 적어 둔 대표자를 덮어쓰면 안 됩니다");
  assert.equal(res.patch.company, "새회사");
  assert.equal(res.patch.address, "서울시 강남구");
  assert.equal(res.patch.homepage, undefined, "★ http/https 밖 주소는 저장하지 않습니다");
  assert.equal(res.patch.ntsState, "계속사업자");
  assert.equal(res.patch.ntsEndDt, null, "★ 종료일이 비면 이전 종료일을 지울 수 있게 null 이어야 합니다");
  assert.equal(res.patch.src.ceo, "직접입력");
  assert.equal(res.patch.src.address, "금융위 기업기본정보");
});

test("⑤ 상세 연결 바(detailBarHtml) — 인라인 onclick 없이 data-* 속성 + 특수문자 안전 이스케이프", () => {
  const html = UI.detailBarHtml({ name: "엘앤피('L&P')<script>", bizno: "123-45-67890" });
  assert.ok(!html.includes("<script>"), "★ HTML 이스케이프가 누락되었습니다");
  assert.doesNotMatch(html, /\bonclick=/i, "★ 인라인 onclick 문자열 조립을 쓰면 XSS/구문오류 위험이 있습니다");
  assert.match(html, /data-pubco-act="open"/);
  assert.match(html, /data-pubco-act="copy"/);
  assert.match(html, /data-pubco-act="nice"/);
});

test("⑥ UID별 호출 속도 제한(createRateLimiter) 동작", () => {
  const allow = S.createRateLimiter(2, 1000);
  assert.equal(allow("u1", 100), true);
  assert.equal(allow("u1", 200), true);
  assert.equal(allow("u1", 300), false, "★ 한도 초과 시 차단해야 합니다");
  assert.equal(allow("u2", 300), true, "다른 UID는 독립적으로 허용");
  assert.equal(allow("u1", 1200), true, "윈도우가 지나면 다시 허용");
});

test("⑦ 서버(functions/index.js) 및 화면(pu-cards.html) 배선 규칙", () => {
  const idxSrc = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
  const start = idxSrc.indexOf("exports.pubCompanySearch");
  assert.ok(start > 0, "functions/index.js 에 pubCompanySearch 가 없습니다");
  const block = idxSrc.slice(start, start + 1800);
  assert.match(block, /\.region\(MAIL_REGION\)/, "★ 서울 리전(MAIL_REGION)이 아닙니다");
  assert.match(block, /maxInstances/, "★ 동시 실행 상한(maxInstances)이 없습니다");
  assert.match(block, /verifyIdToken/, "★ 로그인 토큰 검증이 없습니다");
  assert.match(block, /STAFF_GATE\.assertActive/, "★ 재직자 관문(STAFF_GATE)이 없습니다");
  assert.match(block, /429/, "★ UID별 호출 제한(429)이 없습니다");

  const uiSrc = fs.readFileSync(path.join(ROOT, "js", "pu-pub-search.js"), "utf8");
  assert.doesNotMatch(uiSrc, /onclick="PuPubSearch\./, "★ js/pu-pub-search.js 에 인라인 onclick 조립이 남아 있습니다");

  const cardsSrc = fs.readFileSync(path.join(ROOT, "pu-cards.html"), "utf8");
  assert.match(cardsSrc, /js\/pu-pub-search\.js/, "pu-cards.html 에 pu-pub-search.js 스크립트가 없습니다");
  assert.match(cardsSrc, /PuPubSearch\.open\(/, "pu-cards.html 에 공공 기업검색 열기 버튼이 없습니다");
  assert.match(cardsSrc, /PuPubSearch\.detailBarHtml\(/, "pu-cards.html 상세 패널에 연결 바가 없습니다");
});
