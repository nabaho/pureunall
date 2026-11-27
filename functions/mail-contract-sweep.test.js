"use strict";
/* 푸른메일함 전체(받은·내게쓴·보낸·보관·업무함) 정기 자동 검토 검사
   ⚠ 공개 저장소 규칙 준수: 모든 상호·인명·이메일·사업자번호는 지어낸 값이다. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const MCS = require("./mail-contract-sweep");
const OntologyServerWrite = require("./ontology-write-server");

const NOW = Date.parse("2026-11-18T11:00:00+09:00");

function makeFakeDb(initial) {
  const tree = JSON.parse(JSON.stringify(initial || {}));
  const getAt = (p) =>
    String(p || "")
      .split("/")
      .filter(Boolean)
      .reduce((cur, k) => (cur == null ? undefined : cur[k]), tree);
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
        once: async () => ({
          val: () => {
            const v = getAt(cleanPath);
            return v === undefined ? null : JSON.parse(JSON.stringify(v));
          },
        }),
        limitToLast: () => node,
        set: async (v) => { setAt(cleanPath, v); },
        update: async (patch) => {
          Object.entries(patch || {}).forEach(([k, v]) => {
            const full = cleanPath ? cleanPath + "/" + k : k;
            setAt(full, v);
          });
        },
      };
      return node;
    },
  };
  return { rawDb, wrappedDb: OntologyServerWrite.wrapDatabase(rawDb, { program: "functions-test" }) };
}

test("① 스케줄 및 서버 함수 배선 — 매일 09·11·13·15·17·18시(Asia/Seoul) + 수동 즉시 실행 등록", () => {
  const idx = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(idx, /exports\.mailContractSweep\s*=/);
  assert.match(idx, /exports\.runMailContractSweep\s*=/);
  assert.match(idx, /\.pubsub\.schedule\(["']0 0,9,11,13,15,17,18 \* \* \*["']\)/); // 검사고정-허용: 대표 지시 평일 09~18시+24시(00시) 및 주말·공휴일 24시 전용 스케줄 규칙 검증
  assert.match(idx, /\.timeZone\(["']Asia\/Seoul["']\)/);
});

test("② 메일함 대상 판별 — 받은·내게쓴·보낸·보관·업무함은 포함하고 스팸·휴지통·임시·광고함은 제외한다", () => {
  assert.equal(MCS.isEligibleFolder("INBOX-4a1e411c", { kind: "inbox", name: "INBOX" }), true);
  assert.equal(MCS.isEligibleFolder("내게쓴편지함-1a83d1bc", { kind: "tome", name: "내게쓴편지함" }), true);
  assert.equal(MCS.isEligibleFolder("Sent Messages-6d8c6b35", { kind: "sent", name: "Sent Messages" }), true);
  assert.equal(MCS.isEligibleFolder("Archive-2516a4af", { kind: "archive", name: "Archive" }), true);
  assert.equal(MCS.isEligibleFolder("1_자문사답변-0ec540f8", { kind: "custom", name: "1.자문사답변" }), true);
  assert.equal(MCS.isEligibleFolder("11_ 계약서류및종료-51c937c4", { kind: "custom", name: "11. 계약서류및종료" }), true);
  assert.equal(MCS.isEligibleFolder("Drafts-d2223164", { kind: "drafts", name: "Drafts" }), false);
  assert.equal(MCS.isEligibleFolder("Deleted-fabb15e9", { kind: "trash", name: "Deleted" }), false);
  assert.equal(MCS.isEligibleFolder("기타광고-075dd2c8", { kind: "custom", name: "기타광고" }), false);
  assert.equal(MCS.isEligibleFolder("뉴스레터 발송분-b9da8984", { kind: "custom", name: "뉴스레터 발송분" }), false);
});

test("③ 상호 추출 및 srcMails 정규화 — 앞머리 상호·다단 밑줄 첨부명·폴더 별칭을 정확히 처리한다", () => {
  assert.equal(
    MCS.extractCoFromSubj("가나수산_위임약정서(체불임금 진정 사건 대리)", ["가나수산_위임약정서(체불임금 진정 사건 대리)_261118.pdf"], "푸른노무법인"),
    "가나수산"
  );
  assert.equal(
    MCS.extractCoFromSubj("[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건", ["푸른노무법인_견적서_산업안전 컨설팅_다라사회서비스원.pdf"], ""),
    "다라사회서비스원"
  );
  assert.equal(
    MCS.extractCoFromSubj("[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건", ["견적서_인사노무컨설팅_마바학습원_261106.pdf"], ""),
    "마바학습원"
  );
  assert.equal(MCS.canonSrcMailKey("Sent|176075"), MCS.canonSrcMailKey("Sent Messages-6d8c6b35|176075"));
  assert.equal(MCS.canonSrcMailKey({ folder: "Sent", msgId: "176075" }), MCS.canonSrcMailKey("Sent Messages-6d8c6b35:176075"));
  assert.equal(MCS.canonSrcMailKey({ folder: "INBOX", msgId: "175518" }), MCS.canonSrcMailKey("INBOX-4a1e411c|175518"));
  assert.equal(MCS.canonSrcMailKey("내게쓴편지함-1a83d1bc|176464"), "tome|176464");
});

test("④ 내게쓴메일함·받은메일함·보낸메일함 전체 검토 — 견적서·계약서를 계약관리 큐에 정확히 올리고 중복·오탐·해지는 차단한다", async () => {
  const { rawDb, wrappedDb } = makeFakeDb({
    mailbox: {
      folders: {
        "INBOX-4a1e411c": { kind: "inbox", name: "INBOX" },
        "내게쓴편지함-1a83d1bc": { kind: "tome", name: "내게쓴편지함" },
        "Sent Messages-6d8c6b35": { kind: "sent", name: "Sent Messages" },
        "1_자문사답변-0ec540f8": { kind: "custom", name: "1.자문사답변" },
      },
      msgs: {
        "내게쓴편지함-1a83d1bc": {
          "501": {
            u: "501",
            d: NOW - 3600e3,
            e: "370-6@daum.net",
            t: "370-6@daum.net",
            f: "푸른노무법인",
            s: "가나수산_위임약정서(체불임금 진정 사건 대리)",
            a: 1,
            an: ["가나수산_위임약정서(체불임금 진정 사건 대리)_261118.pdf"],
          },
          "502": {
            u: "502",
            d: NOW - 7200e3,
            e: "370-6@daum.net",
            t: "370-6@daum.net",
            f: "푸른노무법인",
            s: "[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건",
            a: 1,
            an: ["견적서_인사노무컨설팅_마바학습원_261118.pdf"],
          },
        },
        "Sent Messages-6d8c6b35": {
          "601": {
            u: "601",
            d: NOW - 5000e3,
            t: "ceo@newprospect.example",
            tn: "사아테크",
            s: "[푸른노무법인] 사아테크 사내근로복지기금 설립 견적서 송부의 건",
            a: 1,
            an: ["사내근로복지기금 설립 견적서(사아테크).pdf"],
          },
          "602": {
            u: "602",
            d: NOW - 6000e3,
            t: "hr@already.example",
            s: "[푸른노무법인] 기등록기관 컨설팅 견적서 송부의 건",
            a: 1,
            an: ["견적서_기등록기관.pdf"],
          },
        },
        "INBOX-4a1e411c": {
          "701": {
            u: "701",
            d: NOW - 4000e3,
            e: "hr@verifiedco.example",
            f: "자차시스템 인사팀",
            s: "[자차시스템] 2026년 노무진단 위임계약서 날인본 송부",
            a: 1,
            an: ["2026_노무진단_위임계약서_자차시스템.pdf"],
          },
          "702": {
            u: "702",
            d: NOW - 3000e3,
            e: "unknown@outside.example",
            f: "외부담당자",
            s: "[카타물류] 위임계약서 송부드립니다",
            a: 1,
            an: ["위임계약서_카타물류.pdf"],
          },
          "703": {
            u: "703",
            d: NOW - 2000e3,
            e: "hr@verifiedco.example",
            s: "RE: 양식 검토 요청의 건(수습평가기간 연장합의서)",
            a: 1,
            an: ["수습평가기간 연장합의서.pdf"],
          },
        },
        "1_자문사답변-0ec540f8": {
          "801": {
            u: "801",
            d: NOW - 1000e3,
            e: "hr@closedco.example",
            s: "자문계약 종료 의 건_하거디티(주)",
            a: 1,
            an: ["자문계약서_하거디티_날인본.pdf"],
          },
        },
      },
    },
    data: {
      user_dir: {
        v: [
          { sid: "P-001", name: "김대표", role: "admin", status: "active" },
          { sid: "P-004", name: "박담당", role: "staff", status: "active" },
        ],
      },
      companies: {
        v: {
          coVer: {
            id: "coVer",
            name: "자차시스템",
            bizNo: "123-82-15423",
            status: "active",
            email: "hr@verifiedco.example",
            managerMain: "P-004",
          },
          coClosed: {
            id: "coClosed",
            name: "하거디티(주)",
            bizNo: "123-81-00999",
            status: "closed",
          },
        },
      },
      contracts: {
        v: {
          ctAlready: {
            id: "ctAlready",
            contractNo: "계약-2026-010",
            companyName: "기등록기관",
            status: "consult",
            srcMails: [{ folder: "Sent", msgId: "602" }],
          },
        },
      },
      cases: { v: {} },
      consultings: { v: {} },
      funds: { v: {} },
      other_projects: { v: {} },
      finance_income: { v: {} },
      contract_requests: {},
    },
    pucards: { config: { mailWhoMsg: {} }, coInfo: {} },
  });

  const aiResponses = {
    "내게쓴편지함-1a83d1bc|501": {
      isOurEngagementContract: true,
      signedByClient: true,
      company: "가나수산",
      ceo: "김의뢰",
      bizno: "",
      docName: "위임약정서",
      scope: "체불임금 진정 사건 대리",
      signDate: "2026-11-18",
      retainer: "110만원",
      success: "15%",
      managerName: "박담당",
    },
    "INBOX-4a1e411c|701": {
      isOurEngagementContract: true,
      signedByClient: true,
      company: "자차시스템",
      ceo: "이자차",
      bizno: "123-82-15423",
      docName: "위임계약서",
      scope: "2026년 인사노무 진단",
      signDate: "2026-11-18",
      fee: "3,300,000원",
      vat: "포함",
      managerName: "박담당",
    },
    "INBOX-4a1e411c|702": {
      isOurEngagementContract: true,
      signedByClient: true,
      company: "카타물류",
      ceo: "최카타",
      bizno: "123-82-15423",
      docName: "위임계약서",
      scope: "인사노무 컨설팅",
      signDate: "2026-11-18",
      fee: "110만원",
    },
  };

  let currentDownloading = "";
  const seenAiParts = [];
  const beforeIssues = OntologyServerWrite.getIssues().length;
  const res = await MCS.runSweep(
    {
      getDatabase: () => wrappedDb,
      getSelfEmail: async () => "370-6@daum.net",
      downloadContractAttachment: async (slug, uid) => {
        currentDownloading = slug + "|" + uid;
        return { name: "계약서.pdf", mime: "application/pdf", buf: Buffer.from("PDF-DATA") };
      },
      extractPdfText: async () => "위임약정서 본문 텍스트 샘플입니다. 위임인 주민번호 900101-1234567 수임인 노무법인.",
      callContractAi: async (parts) => {
        seenAiParts.push(parts);
        return {
          text: JSON.stringify(aiResponses[currentDownloading] || { isOurEngagementContract: false }),
        };
      },
    },
    { now: NOW, days: 30, skipSync: true }
  );
  const afterIssues = OntologyServerWrite.getIssues().length;
  assert.equal(afterIssues, beforeIssues, "온톨로지 서버 저장 감시 경고가 발생하지 않아야 한다");
  assert.ok(seenAiParts.length > 0, "비식별 텍스트에 대해 AI 판독이 수행된다");
  for (const callParts of seenAiParts) {
    for (const p of callParts) {
      assert.equal(p.inline_data, undefined, "원본 문서 바이너리(inline_data)는 절대 외부 AI로 보내지 않는다");
      assert.ok(!String(p.text || "").includes("1234567"), "외부 AI로 나가는 텍스트에는 주민번호 뒷자리가 반드시 가려져 있어야 한다");
    }
  }

  assert.equal(res.quoteQueued, 2, "내게쓴메일함 견적(502) + 보낸메일함 견적(601) 2건이 큐에 올라가고 기반영(602)은 제외된다");
  assert.equal(res.contractQueued, 3, "내게쓴메일함 계약(501) + 검증 수신 계약(701) + 미검증 수신 계약(702) 3건이 큐에 올라간다");

  const reqs = rawDb.tree.data.contract_requests;
  const reqTomeCt = reqs["mcsc-내게쓴편지함-1a83d1bc_501"];
  assert.ok(reqTomeCt, "내게쓴메일함 위임약정서 요청 생성");
  assert.equal(reqTomeCt.targetStatus, "review", "사업자번호·등록업체가 미확인된 내게쓴메일함 계약서는 계약협의(review)로 안전 등록");
  assert.equal(reqTomeCt.company.name, "가나수산");
  assert.equal(reqTomeCt.managerMain, "P-004");
  assert.equal(reqTomeCt.mailMeta.dir, "tome");

  const reqTomeQuote = reqs["mcsq-내게쓴편지함-1a83d1bc_502"];
  assert.ok(reqTomeQuote, "내게쓴메일함 견적서 요청 생성");
  assert.equal(reqTomeQuote.companyName, "마바학습원");
  assert.equal(reqTomeQuote.deferLink, true, "미등록 신규 사업장 견적은 연결 보류(deferLink)로 올려 걸린 요청에 막히지 않게 한다");
  assert.equal(reqTomeQuote.companyId, "");

  const reqSentQuote = reqs["mcsq-Sent_Messages-6d8c6b35_601"];
  assert.ok(reqSentQuote, "보낸메일함 견적서 요청 생성");
  assert.equal(reqSentQuote.companyName, "사아테크");
  assert.equal(reqSentQuote.deferLink, true);
  assert.equal(reqSentQuote.inferredKind, "fund");
  assert.ok(reqSentQuote.quoteScope && reqSentQuote.quoteScope.includes("사내근로복지기금"), "견적 과업명이 자동 추출된다");
  assert.ok(reqSentQuote.quoteSummary && reqSentQuote.quoteSummary.includes("사내근로복지기금"), "견적 송부 내용이 자동 정리된다");

  const reqRecvSigned = reqs["mcsc-INBOX-4a1e411c_701"];
  assert.ok(reqRecvSigned, "검증된 거래처 수신 날인 계약서 요청 생성");
  assert.equal(reqRecvSigned.targetStatus, "signed");
  assert.equal(reqRecvSigned.companyId, "coVer");

  const reqRecvUnverified = reqs["mcsc-INBOX-4a1e411c_702"];
  assert.ok(reqRecvUnverified, "미등록 발신처 수신 계약서도 누락 없이 수집하되 계약협의(review)로 격리");
  assert.equal(reqRecvUnverified.targetStatus, "review");
  assert.equal(reqRecvUnverified.companyId, "", "미검증 발신처는 타사 사업자번호가 적혀 있어도 companyId 연결 차단");
  assert.equal(reqRecvUnverified.company.bizNo, "");
  assert.ok(reqRecvUnverified.checkReq && reqRecvUnverified.checkReq.note, "담당자 진행확인 표시 자동 부착");

  /* 같은 상태에서 2회차 실행 시 이미 처리된 메일은 AI/큐 재호출 없이 모두 건너뛴다 */
  const res2 = await MCS.runSweep(
    {
      getDatabase: () => wrappedDb,
      getSelfEmail: async () => "370-6@daum.net",
      downloadContractAttachment: async () => { throw new Error("재다운로드 금지"); },
      callContractAi: async () => { throw new Error("AI 재호출 금지"); },
    },
    { now: NOW + 7200e3, days: 30, skipSync: true }
  );
  assert.equal(res2.quoteQueued, 0);
  assert.equal(res2.contractQueued, 0);
  assert.equal(res2.aiReads, 0);
});

test("⑤ 평일 09~18·24시 및 주말·공휴일 24시 전용 스케줄 가드 + 견적 첨부 요약 금액 비공개 검증", async () => {
  const holMap = { "2026-10-05": "대체공휴일(개천절)" };
  // 1) 토요일 낮 11시 → 건너뜀
  const satNoon = Date.parse("2026-11-21T11:00:00+09:00");
  assert.equal(MCS.shouldSkipScheduledDaytime(satNoon, holMap).skip, true);
  // 2) 일요일 낮 15시 → 건너뜀
  const sunAfternoon = Date.parse("2026-11-22T15:00:00+09:00");
  assert.equal(MCS.shouldSkipScheduledDaytime(sunAfternoon, holMap).skip, true);
  // 3) 월요일이지만 대체공휴일 낮 09시 → 건너뜀
  const holMorning = Date.parse("2026-10-05T09:00:00+09:00");
  assert.equal(MCS.shouldSkipScheduledDaytime(holMorning, holMap).skip, true);
  // 4) 주말·공휴일 24시(=00:00 KST) → 실행 허용
  const sunMidnight = Date.parse("2026-11-22T00:00:00+09:00");
  const holMidnight = Date.parse("2026-10-05T00:00:00+09:00");
  assert.equal(MCS.shouldSkipScheduledDaytime(sunMidnight, holMap).skip, false);
  assert.equal(MCS.shouldSkipScheduledDaytime(holMidnight, holMap).skip, false);
  // 5) 평일 낮 13시 → 실행 허용
  const wedAfternoon = Date.parse("2026-11-18T13:00:00+09:00");
  assert.equal(MCS.shouldSkipScheduledDaytime(wedAfternoon, holMap).skip, false);

  // runSweep 이 공휴일 낮 자동 스케줄에서는 동기화·스캔 없이 즉시 반환하지만 수동 실행은 허용
  const { rawDb } = makeFakeDb({ pubdata: { common: { holidays: { "2026": { list: [{ date: "2026-10-05", name: "대체공휴일" }] } } } } });
  let syncCalled = 0;
  const skippedRes = await MCS.runSweep(
    {
      getDatabase: () => rawDb,
      syncBefore: async () => { syncCalled++; },
    },
    { now: holMorning, trigger: "schedule" }
  );
  assert.ok(skippedRes.skippedScheduleWindow, "공휴일 낮 스케줄은 즉시 건너뛴다");
  assert.equal(syncCalled, 0, "건너뛸 때 IMAP 동기화를 부르지 않는다");

  // 견적 첨부 요약 시 금액·요율 숫자는 제거되고 과업·일정 내용은 유지된다
  const qSummary = MCS.buildAutoQuoteSummary({
    subj: "[푸른노무법인] 가나기관 취업규칙 정비 컨설팅 견적서 송부의 건",
    attNames: ["견적서_취업규칙정비_가나기관.pdf"],
    bodyPreview: "안녕하세요.\n요청하신 취업규칙 개정 및 노사협의회 규정 정비 견적 2000만원 안내를 송부드립니다. 공급가액 3,300,000원(부가세 포함)입니다.",
    attText: "건명: 2026년 취업규칙 및 인사규정 정비 컨설팅\n과업범위: 현행 규정 적법성 검토 및 개정안 작성\n수행기간: 2026-11-20 ~ 2026-12-31\n합계금액: 금 3,300,000원 (성공보수 15%)",
    coName: "가나기관",
    toAddrs: ["hr@gana.example"],
  });
  assert.ok(qSummary.scope.includes("취업규칙 정비 컨설팅"));
  assert.ok(qSummary.summary.includes("현행 규정 적법성 검토"));
  assert.ok(qSummary.summary.includes("2026년"));
  assert.ok(qSummary.summary.includes("2026-11-20"));
  assert.ok(!/3,300,000|3300000|2000만원|2000|15%|hr@gana\.example/.test(qSummary.summary), "견적 금액(2000만원 포함)·요율·원문 이메일은 요약 기록으로 새지 않는다");
});

test("⑥ 계약협의·상담접수 진행 중 상대방 작성 계약서 회신(스캔본 PDF 포함)은 계약확정(signed)으로 올리고 빈 서식 안내는 제외한다", async () => {
  assert.equal(
    MCS.extractCoFromSubj("RE: [푸른노무법인] 사내근로복지기금 설립 위임계약서 송부의 건", ["계약서_가나테크_푸른 노무법인.pdf"], "가나테크"),
    "가나테크",
    "첨부파일명에 띄어쓰기가 있는 수임인 표기(푸른 노무법인)는 제외하고 의뢰인 상호를 정확히 추출한다"
  );

  const { rawDb, wrappedDb } = makeFakeDb({
    mailbox: {
      folders: {
        "INBOX-4a1e411c": { kind: "inbox", name: "INBOX" },
        "8_기금함-e74c6afc": { kind: "custom", name: "8.기금함" },
        "Sent Messages-6d8c6b35": { kind: "sent", name: "Sent Messages" },
      },
      msgs: {
        "Sent Messages-6d8c6b35": {
          "910": {
            u: "910",
            d: NOW - 86400e3,
            t: "ganatech@hanmail.example",
            tn: "가나테크",
            s: "[푸른노무법인] 사내근로복지기금 설립 위임계약서 송부의 건",
            a: 1,
            an: ["위임계약서_(주)가나테크.pdf"],
          },
        },
        "8_기금함-e74c6afc": {
          "911": {
            u: "911",
            d: NOW - 1800e3,
            e: "ganatech@hanmail.example",
            f: "가나테크",
            s: "RE: [푸른노무법인] 사내근로복지기금 설립 위임계약서 송부의 건",
            b: "안녕하세요 노무사님 계약서 송부드립니다. 감사합니다.",
            a: 1,
            an: ["계약서_가나테크_푸른 노무법인.pdf"],
          },
        },
        "INBOX-4a1e411c": {
          "911": {
            u: "911",
            d: NOW - 1800e3,
            e: "ganatech@hanmail.example",
            f: "가나테크",
            s: "RE: [푸른노무법인] 사내근로복지기금 설립 위임계약서 송부의 건",
            b: "안녕하세요 노무사님 계약서 송부드립니다. 감사합니다.",
            a: 1,
            an: ["계약서_가나테크_푸른 노무법인.pdf"],
          },
          "912": {
            u: "912",
            d: NOW - 1200e3,
            e: "mgr@daraorg.example",
            f: "다라기관",
            s: "[다라기관] 용역 계약 안내",
            b: "계약체결 서류 목록과 서식 보내드립니다. 계약서는 스캔본으로 넣어주시고 착수 진행 바랍니다.",
            a: 1,
            an: ["3.(서식)용역표준계약서.hwp"],
          },
        },
      },
    },
    data: {
      user_dir: {
        v: [{ sid: "P-001", name: "김대표", role: "admin", status: "active" }],
      },
      companies: { v: {} },
      contracts: {
        v: {
          ctConsultEmpty: {
            id: "ctConsultEmpty",
            contractNo: "계약-2026-206",
            companyName: "가나테크",
            status: "consult",
            kinds: ["fund"],
            amounts: { fund: 0 },
            managerMain: "P-001",
            company: { name: "가나테크", email: "master@ganatech.example" },
            srcMails: ["Sent Messages-6d8c6b35|910"],
          },
          ctDaraReview: {
            id: "ctDaraReview",
            contractNo: "계약-2026-208",
            companyName: "다라기관",
            status: "review",
            kinds: ["consulting"],
            amounts: { consulting: 1230000 },
            managerMain: "P-001",
            company: { name: "다라기관", email: "mgr@daraorg.example" },
          },
        },
      },
      cases: { v: {} },
      consultings: { v: {} },
      funds: { v: {} },
      other_projects: { v: {} },
      finance_income: { v: {} },
      contract_requests: {},
    },
    pucards: { config: { mailWhoMsg: {} }, coInfo: {} },
  });

  await MCS.runSweep(
    {
      getDatabase: () => wrappedDb,
      getSelfEmail: async () => "self@pureun.example",
      downloadContractAttachment: async (slug, uid) => {
        if (slug === "INBOX-4a1e411c" && uid === "911") return null; /* 업무폴더로 이동되어 INBOX 거울은 비어 있는 상태 */
        if (slug === "8_기금함-e74c6afc" && uid === "911") {
          return { name: "계약서_가나테크_푸른 노무법인.pdf", mime: "application/pdf", buf: Buffer.from("SCANNED-IMAGE-PDF") };
        }
        return { name: "3.(서식)용역표준계약서.hwp", mime: "application/octet-stream", buf: Buffer.from("BLANK-FORM") };
      },
      extractPdfText: async () => "", /* 스캔본 PDF라 추출 텍스트 없음 */
      callContractAi: async () => ({
        text: JSON.stringify({
          isOurEngagementContract: true,
          signedByClient: false,
          company: "다라기관",
          docName: "(서식)용역표준계약서",
          scope: "용역 서식 안내",
        }),
      }),
    },
    { now: NOW, days: 30, skipSync: true }
  );

  const reqs = rawDb.tree.data.contract_requests;
  const replyReq = reqs["mcsc-8_기금함-e74c6afc_911"];
  assert.ok(replyReq, "스캔본 PDF 회신이라도 진행 중 계약 상대방 이메일이 검증되면 누락 없이 요청 생성");
  assert.equal(replyReq.targetStatus, "signed", "상대방 작성 계약서 회신은 계약확정(signed)으로 승격 요청");
  assert.equal(replyReq.openContractVerified, true);
  assert.equal(replyReq.mergeEmptyOpen, true);
  assert.equal(replyReq.signedByClient, true);
  assert.equal(replyReq.inferredKind, "fund");
  assert.equal(reqs["mcsc-INBOX-4a1e411c_911"], undefined, "동일 메일의 INBOX 빈 거울은 중복 요청을 만들지 않는다");

  const blankFormReq = reqs["mcsc-INBOX-4a1e411c_912"];
  if (blankFormReq) {
    assert.notEqual(blankFormReq.targetStatus, "signed", "고객사가 빈 서식을 보내며 날인을 요청한 메일은 계약확정으로 올리지 않는다");
  }
});
