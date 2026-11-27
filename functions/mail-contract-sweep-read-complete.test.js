"use strict";
/* 메일 자동검토 «계약서를 빠짐없이 읽기» 검사 (대표 지시 2026-11-27)
   — 계약서 첨부가 3개(통장사본·사업자등록증·위임계약서) 든 메일에서 AI 판독이 비어도
     ① 계약서 이름이 통장사본이 되지 않고 ② 본문에서 읽은 금액이 채워지고 ③ «확인 필요» 표시가 붙고
     ④ 일시적 AI 실패는 곧장 굳히지 않고 다시 읽는지 본다.
   ⚠ 공개 저장소 규칙: 모든 상호·인명·이메일·금액은 지어낸 값이다. */
const test = require("node:test");
const assert = require("node:assert/strict");
const MCS = require("./mail-contract-sweep");
const OntologyServerWrite = require("./ontology-write-server");

const NOW = Date.parse("2026-11-26T11:00:00+09:00");
const SLUG = "Sent Messages-6d8c6b35";
const SEEN_KEY = "Sent_Messages-6d8c6b35_177";
const REQ_KEY = "mcsc-" + SEEN_KEY;
const ATT_NAMES = ["통장사본_푸른노무법인_230925.pdf", "사업자등록증_푸른노무법인.pdf", "위임계약서_산업안전컨설팅_가나상사_261125.pdf"];
const CONTRACT_TEXT = "위임계약서 제1조(목적) 위험성평가 및 작업중지명령 해제 대응 컨설팅을 위임한다. 제3조(수수료) 컨설팅 수수료는 금 3,300,000원(부가세 포함)으로 한다. 제4조(기간) 계약체결일로부터 2개월.";

function makeFakeDb(initial) {
  const tree = JSON.parse(JSON.stringify(initial || {}));
  const getAt = (p) => String(p || "").split("/").filter(Boolean).reduce((cur, k) => (cur == null ? undefined : cur[k]), tree);
  const setAt = (p, val) => {
    const keys = String(p || "").split("/").filter(Boolean);
    if (!keys.length) return;
    let cur = tree;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]] || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    if (val === null) delete cur[keys[keys.length - 1]];
    else cur[keys[keys.length - 1]] = JSON.parse(JSON.stringify(val));
  };
  const rawDb = {
    tree,
    ref(p) {
      const cleanPath = String(p || "").replace(/^\/+|\/+$/g, "");
      const node = {
        once: async () => ({ val: () => { const v = getAt(cleanPath); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
        limitToLast: () => node,
        set: async (v) => { setAt(cleanPath, v); },
        update: async (patch) => { Object.entries(patch || {}).forEach(([k, v]) => setAt(cleanPath ? cleanPath + "/" + k : k, v)); },
      };
      return node;
    },
  };
  return { rawDb, wrappedDb: OntologyServerWrite.wrapDatabase(rawDb, { program: "functions-test" }) };
}

function freshDb() {
  return makeFakeDb({
    mailbox: {
      folders: { [SLUG]: { kind: "sent", name: "Sent Messages" } },
      msgs: {
        [SLUG]: {
          "177": {
            u: "177",
            d: NOW - 3600e3,
            t: "ganasangsa@hanmail.example",
            tn: "가나상사",
            s: "[푸른노무법인] 위험성평가 및 작업중지명령 해제 대응 컨설팅 위임계약서 송부의 건",
            a: 3,
            an: ATT_NAMES,
          },
        },
      },
    },
    data: {
      user_dir: { v: [{ sid: "P-001", name: "김대표", role: "admin", status: "active" }] },
      companies: { v: {} },
      contracts: { v: {} },
      cases: { v: {} },
      consultings: { v: {} },
      funds: { v: {} },
      other_projects: { v: {} },
      finance_income: { v: {} },
      contract_requests: {},
    },
    pucards: { config: { mailWhoMsg: {} }, coInfo: {} },
  });
}

function depsFor(wrappedDb, ai, downloads) {
  return {
    getDatabase: () => wrappedDb,
    getSelfEmail: async () => "self@pureun.example",
    downloadContractAttachment: async () => { downloads.n++; return { name: ATT_NAMES[2], mime: "application/pdf", buf: Buffer.from("PDF") }; },
    extractPdfText: async () => CONTRACT_TEXT,
    callContractAi: ai,
  };
}
const OPTS = { now: NOW, days: 30, skipSync: true };

test("① 계약서 파일 이름 고르기 — 통장사본·사업자등록증·견적서는 건너뛰고 «계약·약정·위임» 이름을 먼저 고른다", () => {
  assert.equal(MCS.pickBestContractAttachmentName(ATT_NAMES), ATT_NAMES[2]);
  assert.equal(MCS.pickBestContractAttachmentName(["통장사본_푸른노무법인.pdf", "사업자등록증_푸른노무법인.pdf"]), "", "계약서가 아닌 첨부만 있으면 못 고른다(첫 번째로 때우지 않는다)");
  assert.equal(MCS.pickBestContractAttachmentName(["견적서_컨설팅_가나상사.pdf", "서류 한 장.pdf"]), "서류 한 장.pdf", "이름에 계약 말이 없으면 읽을 수 있는 첫 서류");
  assert.equal(MCS.pickBestContractAttachmentName(["메모.txt"]), "", "읽을 수 없는 확장자는 고르지 않는다");
  assert.equal(MCS.pickBestContractAttachmentName(null), "");
  assert.equal(MCS.pickBestContractAttachmentName(["서류 한 장.pdf", "자문계약서_가나상사.pdf"]), "자문계약서_가나상사.pdf", "뒤에 있어도 «계약» 이름이 먼저");
});

test("② 본문 금액 읽기 — «컨설팅 수수료는 금 ○○원(부가세 …)» 총액을 fee 로 읽고 지연이자·송금 수수료는 잡지 않는다", () => {
  const a = MCS.extractContractFeesFromText(CONTRACT_TEXT);
  assert.equal(a.fee, "3,300,000원 (부가세 포함)");
  assert.equal(a.vat, "부가세 포함");
  const b = MCS.extractContractFeesFromText("컨설팅 수수료: 1,000만원 (VAT 별도)");
  assert.equal(b.fee, "1,000만원 (부가세 별도)");
  assert.equal(b.vat, "부가세 별도");
  const b2 = MCS.extractContractFeesFromText("용역대금은 일금 일천만원정(₩10,000,000) 별도로 한다.");
  assert.equal(b2.fee, "10,000,000원", "한글 금액 뒤 («₩숫자») 병기만 읽는다");
  const c = MCS.extractContractFeesFromText("송금 수수료는 의뢰인이 부담한다. 지연 시 연 12%의 이자를 가산한다.");
  assert.equal(c.fee, "", "금액이 «원» 으로 붙지 않은 수수료 말은 잡지 않는다");
  const d = MCS.extractContractFeesFromText("착수금은 금 500,000원으로 한다. 성공보수는 10%로 한다.");
  assert.equal(d.retainer, "500,000원");
  assert.equal(d.success, "10%");
  assert.equal(d.fee, "");
});

test("③ 끊긴 AI 답 살리기 — 닫는 중괄호가 없어도 끝까지 읽힌 칸은 살리고, 칸이 모자라면 버린다", () => {
  assert.deepEqual(MCS.parseAiJson('{"company":"가나상사","docName":"위임계약서"}'), { company: "가나상사", docName: "위임계약서" });
  const cut = MCS.parseAiJson('```json\n{"isOurEngagementContract": true, "signedByClient": false, "company": "가나상사", "docName": "위임계약서", "scope": "컨설팅 (중대');
  assert.equal(cut.company, "가나상사");
  assert.equal(cut.docName, "위임계약서");
  assert.equal(cut.isOurEngagementContract, true);
  assert.equal(cut._partial, true, "살린 객체에는 «일부만 읽음» 표시");
  assert.equal(cut.scope, undefined, "끊긴 칸은 지어내지 않는다");
  assert.equal(MCS.parseAiJson('{"company":"가나상사","docName"'), null, "칸이 3개 미만이면 믿지 않는다");
  assert.equal(MCS.parseAiJson("답할 수 없습니다"), null);
  assert.equal(MCS.parseAiJson(""), null);
});

test("④ 확인 필요 문구 — 무엇을 못 읽었는지 말한다", () => {
  assert.match(MCS.metaFallbackNote("ai_empty_meta", "보낸메일함"), /AI 판독이 되지 않아 금액·유형·기간/);
  assert.match(MCS.metaFallbackNote("contract_meta", "보낸메일함"), /내려받지 못해/);
  assert.match(MCS.metaFallbackNote("anything", "보낸메일함"), /금액·유형·당사자/);
});

test("⑤ AI 판독이 비어도 서류 이름·금액·확인 표시를 지킨다 — 두 번은 다시 읽고 세 번째에 폴백", async () => {
  const { rawDb, wrappedDb } = freshDb();
  const downloads = { n: 0 };
  const deps = depsFor(wrappedDb, async () => null, downloads);

  await MCS.runSweep(deps, OPTS);
  assert.equal(rawDb.tree.data.contract_requests[REQ_KEY], undefined, "1회차: 곧장 카드로 굳히지 않는다");
  let seen = rawDb.tree.data.app_config.mailContractSweepSeen[SEEN_KEY];
  assert.equal(seen.out, "ai_retry");
  assert.equal(seen.n, 1);

  await MCS.runSweep(deps, OPTS);
  assert.equal(rawDb.tree.data.contract_requests[REQ_KEY], undefined, "2회차도 다시 읽는다");
  seen = rawDb.tree.data.app_config.mailContractSweepSeen[SEEN_KEY];
  assert.equal(seen.out, "ai_retry");
  assert.equal(seen.n, 2);

  await MCS.runSweep(deps, OPTS);
  const req = rawDb.tree.data.contract_requests[REQ_KEY];
  assert.ok(req, "3회차: 그래도 비면 제목·첨부명 카드로 폴백");
  assert.equal(req.contractFields.docName, ATT_NAMES[2], "서류 이름은 통장사본이 아니라 읽은 위임계약서 파일");
  assert.doesNotMatch(req.contractFields.docName, /통장사본|사업자등록증/);
  assert.equal(req.contractFields.fileName, ATT_NAMES[2].replace(/\.pdf$/, ""));
  assert.equal(req.contractFields.fee, "3,300,000원 (부가세 포함)", "본문에서 읽은 금액을 비워 두지 않는다");
  assert.ok(req.checkReq && /AI 판독이 되지 않아/.test(req.checkReq.note), "읽지 못한 카드는 «확인 필요»");
  assert.equal(rawDb.tree.data.app_config.mailContractSweepSeen[SEEN_KEY].out, "ai_empty_meta");

  const before = downloads.n;
  await MCS.runSweep(deps, OPTS);
  assert.equal(downloads.n, before, "굳은 뒤에는 다시 읽지 않는다");
});

test("⑥ AI 가 성공해도 금액을 비웠으면 본문에서 읽은 금액으로 채우고, 서류 파일 이름을 함께 넘긴다", async () => {
  const { rawDb, wrappedDb } = freshDb();
  const deps = depsFor(wrappedDb, async () => ({
    text: JSON.stringify({ isOurEngagementContract: true, signedByClient: false, company: "가나상사", docName: "위임계약서", scope: "위험성평가 컨설팅", fee: "", deposit: "", retainer: "" }),
  }), { n: 0 });
  await MCS.runSweep(deps, OPTS);
  const req = rawDb.tree.data.contract_requests[REQ_KEY];
  assert.ok(req, "요청 생성");
  assert.equal(req.contractFields.fee, "3,300,000원 (부가세 포함)");
  assert.equal(req.contractFields.docName, "위임계약서");
  assert.equal(req.contractFields.fileName, ATT_NAMES[2].replace(/\.pdf$/, ""), "문서 제목이 «위임계약서» 뿐이어도 파일 이름의 사업 이름을 유형 판단에 쓸 수 있게");
  assert.doesNotMatch(String((req.checkReq && req.checkReq.note) || ""), /일부만|AI 판독|내려받지/, "충분히 읽었으면 «못 읽음» 문구를 달지 않는다(담당 확인 문구는 별개)");
});

test("⑦ AI 답이 끊겨 일부만 읽힌 경우 — 읽힌 칸은 살리고 «일부만 읽음» 확인 표시를 단다", async () => {
  const { rawDb, wrappedDb } = freshDb();
  const deps = depsFor(wrappedDb, async () => ({
    text: '{"isOurEngagementContract": true, "signedByClient": false, "company": "가나상사", "docName": "위임계약서", "scope": "위험성평가 및 작업중지명령 해제 대응 컨설',
  }), { n: 0 });
  await MCS.runSweep(deps, OPTS);
  const req = rawDb.tree.data.contract_requests[REQ_KEY];
  assert.ok(req, "끊긴 답이라도 요청 생성");
  assert.equal(req.company.name, "가나상사");
  assert.equal(req.contractFields.fee, "3,300,000원 (부가세 포함)", "끊겨 못 읽은 금액은 본문에서 보강");
  assert.ok(req.checkReq && /일부만 읽었습니다/.test(req.checkReq.note));
});

test("⑧ 계약서 원문을 못 내려받아도 서류 이름은 계약서 첨부 이름 — 통장사본이 아니다", async () => {
  const { rawDb, wrappedDb } = freshDb();
  const deps = {
    getDatabase: () => wrappedDb,
    getSelfEmail: async () => "self@pureun.example",
    downloadContractAttachment: async () => null,
    extractPdfText: async () => "",
    callContractAi: async () => null,
  };
  await MCS.runSweep(deps, OPTS);
  const req = rawDb.tree.data.contract_requests[REQ_KEY];
  assert.ok(req, "내려받기 실패 메일은 제목·첨부명 카드");
  assert.equal(req.contractFields.docName, ATT_NAMES[2]);
  assert.ok(req.checkReq && /내려받지 못해/.test(req.checkReq.note));
});
