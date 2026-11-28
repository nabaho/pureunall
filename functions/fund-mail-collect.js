"use strict";

/* 📬 푸른메일함 기금 서류 상시 자동 수집 · 관리기금 자동 적재 (2026-11-18)
   ═══════════════════════════════════════════════════════════════════════════
   · /mailbox/msgs/{slug}/{uid} 에 새 수신 메일이 들어오는 즉시 동작한다(폴링 비용 0).
   · 메일함(IMAP)은 읽기 전용으로만 열며 읽음 표시(\Seen)·이동·삭제를 절대 건드리지 않는다.
   · 심층 방어 원칙:
     1) 100% fail-closed 본문 검사: 스캔 PDF, 300쪽 초과 PDF(truncated), 내장 이미지 포함 문서,
        대용량/일부 누락 XML 문서, 20만 자 초과 CSV, 구형 바이너리(.hwp/.xls)는 모두 unreadable=true 로 판정해
        closing_blobs 원본 바이너리 저장을 생략하고 메일함 원본 실시간 열람 메타만 남긴다.
        XML 태그로 분할된 주민등록번호까지 빈 문자열 결합본으로 함께 탐지한다.
     2) 최상단 Authentication-Results + 도메인 정렬(alignment) 검증: 수신 서버(daum/hanmail/kakao)가 찍은
        맨 위 헤더 한 줄만 파싱하며 From 도메인과 DMARC/DKIM/SPF 도메인이 정렬될 때만 trusted:true 로 인정한다.
     3) 미등록 외부 발신 메일 격리 및 분리 쿼터 트랜잭션: 일반 받은편지함의 미등록 발신 메일은 IMAP 첨부 다운로드와
        정상 쿼터(trusted_quota)·체크리스트(site_doc_chk)·백업보관함(closing_blobs)을 일절 건드리지 않고
        분리된 untrusted_quota 안에서 검토 대기 알림만 남긴다. */

const zlib = require("zlib");
const crypto = require("crypto");

const NS = "fund_erp";
const MAX_DOC_BYTES = Math.floor(4.5 * 1024 * 1024);   // 단일 문서 상한 (4.5MB)
const MAX_RAW_ATT_BYTES = 10 * 1024 * 1024;            // 개별 첨부 다운로드 상한 (10MB)
const MAX_TOTAL_ATT_BYTES = 20 * 1024 * 1024;          // 한 메일 첨부 다운로드 총합 상한 (20MB)
const MAX_ATT_COUNT = 15;                              // 한 메일 첨부 최대 개수
const MAX_ZIP_ENTRIES = 20;
const MAX_ZIP_TOTAL_OUT = 6 * 1024 * 1024;             // ZIP 전체 해제 상한 (6MB)
const MAX_TRUSTED_DAILY_DOCS = 30;                     // 기금당 신뢰/전용폴더 일일 상한
const MAX_UNTRUSTED_DAILY_NOTES = 10;                  // 기금당 미등록 외부메일 알림 일일 상한
const DIR_CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

const DOC_EXT_RE = /\.(pdf|hwp|hwpx|xlsx|xls|docx|csv|png|jpe?g|webp)$/i;
const ARCHIVE_BLOB_EXT_RE = /\.(pdf|hwpx|xlsx|docx|csv)$/i;
const SKIP_FOLDER_RE = /^(?:Sent|Drafts|Trash|Spam|Junk|Deleted|보낸편지함|임시보관함|휴지통|스팸편지함|내게쓴메일함|기타광고|뉴스레터|쇼핑|소셜|프로모션|카페편지함|이력서|13_|12_|청구서|국민건강고용산재)/i;
const DEDICATED_FUND_FOLDER_RE = /(?:^8_|사내.*근로복지기금|공동.*근로복지기금|근로복지기금|복지기금)/i;
const GENERAL_INBOX_FOLDER_RE = /^(?:INBOX|받은편지함|1_자문사답변)/i;
const FUND_CLUE_RE = /기금|복지기금|출연|운영상황|기본재산|재산목록|별지\s*제?\s*(?:7|10|11|14|15)호|설립인가|고유번호증|협의회\s*회의록|정관/;
const DEFAULT_AUTHSERV_RE = /(?:^|\.)(?:daum\.net|hanmail\.net|kakao\.com|kakaocorp\.com)$/i;

const GENERIC_CO_NAMES = new Set([
  "주식회사", "유한회사", "사단법인", "재단법인", "푸른노무법인", "근로복지공단", "고용노동부", "국세청", "세무서", "등기소"
]);

const _dirCacheByDb = new WeakMap();

function safeKey(s) {
  return String(s == null ? "" : s).replace(/[.#$/\[\]\s]/g, "_").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48);
}

function hashId(s) {
  return crypto.createHash("sha1").update(String(s || "")).digest("hex").slice(0, 16);
}

/* 한글 슬러그 충돌 방지를 위해 해시 조각을 결합한 고유 키 생성 */
function makeMailSeenKey(slug, uid) {
  const s = String(slug || "");
  const u = String(uid || "");
  return "ms_" + safeKey(s).slice(0, 20) + "_" + hashId(s).slice(0, 10) + "_" + safeKey(u).slice(0, 24);
}

function makeMailArchiveId(slug, uid) {
  const s = String(slug || "");
  const u = String(uid || "");
  return "ml_" + hashId(s).slice(0, 10) + "_" + safeKey(u).slice(0, 24);
}

function normName(s) {
  return String(s == null ? "" : s)
    .replace(/\(주\)|주식회사|㈜|\(유\)|유한회사|\(사\)|사단법인|\(재\)|재단법인|\(가칭\)|가칭/g, "")
    .replace(/[\s()\[\]{}·,.\-_/]/g, "")
    .toLowerCase();
}

function buildSelfEmailSet(primaryEmail) {
  const out = new Set();
  const em = String(primaryEmail || "").trim().toLowerCase();
  if (!em || !em.includes("@")) return out;
  out.add(em);
  const [local, domain] = em.split("@");
  if (local && (domain === "daum.net" || domain === "hanmail.net")) {
    out.add(local + "@daum.net");
    out.add(local + "@hanmail.net");
  }
  return out;
}

function fundNameVariants(fund) {
  const out = new Set();
  const add = (raw) => {
    const k = normName(raw);
    if (k.length >= 4) out.add(k);
    const kShort = k.replace(/근로복지기금/g, "복지기금");
    if (kShort.length >= 4) out.add(kShort);
  };
  add(fund && fund.name);
  add(fund && fund.short_name);
  const base = normName(String((fund && (fund.name || fund.short_name)) || "").replace(/(?:사내|공동)?\s*근로\s*복지\s*기금.*$/g, ""));
  if (base.length >= 2 && (fund && fund.fund_type === "사내")) {
    out.add(base + "사내근로복지기금");
    out.add(base + "사내복지기금");
  }
  return [...out];
}

function isFundCollectableFolder(slug) {
  const s = String(slug || "").trim();
  if (!s || SKIP_FOLDER_RE.test(s)) return false;
  return DEDICATED_FUND_FOLDER_RE.test(s) || GENERAL_INBOX_FOLDER_RE.test(s);
}

function isDedicatedFundFolder(slug) {
  return DEDICATED_FUND_FOLDER_RE.test(String(slug || "").trim());
}

function toKstDateStr(msOrStr) {
  if (typeof msOrStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(msOrStr)) return msOrStr.slice(0, 10);
  const n = Number(msOrStr);
  const d = new Date((Number.isFinite(n) && n > 0 ? n : Date.now()) + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function hasRawRrn(text) {
  const s = String(text == null ? "" : text);
  const re = /(?:^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\s*[-~–—.\s]?\s*([1-8]\d{6})(?!\d)/g;
  return re.test(s);
}

function maskPiiText(text) {
  return String(text == null ? "" : text)
    .replace(/(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\s*[-~–—.\s]?\s*([1-8])\d{6}(?!\d)/g, "$1$2-$3******")
    .replace(/\b\d{2}-\d{2}-\d{6}-\d{2}\b/g, "[개인정보차단]");
}

function isSensitiveIdentityDoc(fileName, textSample) {
  const rawNm = String(fileName || "");
  const nm = rawNm.replace(/\s+/g, "");
  if (hasRawRrn(rawNm)) {
    return { blocked: true, reason: "파일명 내 주민등록번호 형식 감지(바이너리 미보관)" };
  }
  if (/인감증명|본인서명사실|주민등록|등초본|가족관계증명|신분증|운전면허|여권사본/.test(nm) && !/법인등기|등기사항전부|법인인감카드/.test(nm)) {
    return { blocked: true, reason: "개인 신분·인감 서류(바이너리 미보관)" };
  }
  if (textSample) {
    const ts = String(textSample);
    const compact = ts.replace(/\s+/g, "");
    if (/인감증명서|인감증명법|본인서명사실확인서|주민등록표|주민등록등본|주민등록초본/.test(compact) && !/기금출연확인서/.test(compact)) {
      return { blocked: true, reason: "본문 내 신분·인감 증명서 감지(바이너리 미보관)" };
    }
    if (hasRawRrn(ts)) {
      return { blocked: true, reason: "본문 내 마스킹 전 주민등록번호 감지(바이너리 미보관)" };
    }
  }
  return { blocked: false, reason: "" };
}

function classifyFundMailDoc(fileName, mailSubject) {
  const nm = String(fileName || "");
  const sb = String(mailSubject || "");
  const both = nm + " " + sb;

  let arch = ["fund_master_doc", "기금·사업장 기본서류"];
  if (/운영상황|결산서|결산보고|별지\s*제?\s*15호/.test(nm)) {
    arch = ["closing_report", "결산·운영상황보고서"];
  } else if (/사업계획|예산서|운영계획|추정재무|추정손익/.test(nm)) {
    arch = ["business_plan", "사업계획·예산서"];
  } else if (/감사보고|외부감사|회계감사|검토보고/.test(nm)) {
    arch = ["audit_report", "감사·검토보고서"];
  } else if (/회의록|의사록|의결서/.test(nm)) {
    arch = ["council_minutes", "협의회·총회 회의록"];
  } else if (/기본재산|별지\s*제?\s*10호|재산목록|정관|출연확인|출연약정|주식평가|가치평가|평가보고|인가증|인가서/.test(nm)) {
    arch = ["basic_asset_change", "기본재산·정관·신고서"];
  } else if (/재무상태표|손익계산서|재무제표|시산표|원장|분개장|잔액증명|잔고증명|거래내역|원천징수/.test(nm)) {
    arch = ["financial_stmt", "재무제표·원장"];
  }

  let sdcKind = "";
  const rules = [
    ["bizreg", /사업자\s*등록/],
    ["smecert", /중소기업\s*확인|중견기업\s*확인|소상공인\s*확인/],
    ["corpreg", /등기사항|등기부|법인\s*등기/],
    ["wrep", /재직\s*증명|근로\s*계약|경력\s*증명/],
    ["contrib", /출연\s*확인|출연\s*약정|송금\s*영수|이체\s*확인|입금\s*확인|기본재산.*변경|재산\s*목록|주식\s*평가|평가\s*보고/],
    ["rel", /주주\s*명부|출자\s*명세|특수\s*관계/],
    ["fin", /재무\s*제표|재무\s*상태표|손익\s*계산서|표준\s*재무/],
    ["ei", /고용\s*보험|가입자\s*명부|4대\s*보험|피보험자/],
    ["inseal", /인감\s*증명|취임\s*승낙/],
    ["jumin", /주민\s*등록|초본|등\s*초본/],
    ["idcard", /신분증|운전\s*면허|여권\s*사본|개인\s*인감\s*도장/],
    ["tax_wh", /원천\s*징수/],
    ["bank_tx", /잔액\s*증명|잔고\s*증명|거래\s*내역|통장|계좌/],
    ["welfare_ev", /수혜자|지급\s*명단|목적\s*사업\s*증빙|대부\s*명세|차용증/],
    ["match", /참여\s*신청|출연\s*협약/]
  ];
  for (let i = 0; i < rules.length; i++) {
    if (rules[i][1].test(nm)) { sdcKind = rules[i][0]; break; }
  }
  if (!sdcKind) {
    for (let j = 0; j < rules.length; j++) {
      if (rules[j][1].test(sb)) { sdcKind = rules[j][0]; break; }
    }
  }

  const isEventDoc = /기본재산|별지\s*제?\s*10호|재산목록|회의록|의사록|정관|출연확인|주식평가|평가보고|취임승낙|해산|탈퇴/.test(both);
  return { kind: arch[0], kindLabel: arch[1], sdcKind, isEventDoc };
}

function mapSdcKindToDocIds(sdcKind, fundType, isSetup, hasActiveEvent) {
  if (!sdcKind) return [];
  const isIntra = fundType === "사내";
  const out = [];
  if (sdcKind === "bizreg") {
    if (isSetup) out.push("inka_bizreg");
    else if (!isIntra) out.push("sub_bizreg");
    else out.push("inka_bizreg");
  } else if (sdcKind === "corpreg") {
    if (isSetup) out.push("inka_corpreg");
    else if (!isIntra) out.push("sub_corpreg");
    else out.push("inka_corpreg");
  } else if (sdcKind === "smecert" && !isIntra) {
    out.push("sub_smecert");
  } else if (sdcKind === "wrep") {
    out.push("inka_wrep");
  } else if (sdcKind === "contrib") {
    if (hasActiveEvent) out.push("chg_contrib");
    else if (!isIntra && !isSetup) out.push("sub_contrib");
    else if (isIntra && !isSetup) out.push("chg_contrib");
  } else if (sdcKind === "fin") {
    out.push("ops_fin");
    if (!isIntra) out.push("sub_fin");
  } else if (sdcKind === "ei" && !isIntra) {
    out.push("sub_fin");
  } else if (sdcKind === "bank_tx") {
    out.push("ops_bank");
  } else if (sdcKind === "tax_wh") {
    out.push("ops_wht");
  } else if (sdcKind === "welfare_ev") {
    out.push("ops_ev");
  } else if (sdcKind === "rel" && !isIntra) {
    out.push("sub_rel");
  } else if (sdcKind === "match" && !isIntra) {
    out.push("inka_match");
  } else if (sdcKind === "inseal") {
    out.push(isSetup ? "reg_inseal" : "chg_officer");
  } else if (sdcKind === "jumin") {
    out.push(isSetup ? "reg_jumin" : "chg_officer");
  } else if (sdcKind === "idcard") {
    out.push(isSetup ? "reg_id" : "chg_officer");
  }
  return [...new Set(out)];
}

function inferArchiveYear(fileName, mailSubject, mailDateStr, kind) {
  const m = /(?:^|[^\d])(20[1-3]\d)\s*(?:년|년도|\s|$|[_.\-(])/.exec(String(fileName || ""))
    || /(?:^|[^\d])(20[1-3]\d)\s*(?:년|년도|귀속)/.exec(String(mailSubject || ""));
  if (m) return Number(m[1]);
  const d = /^\d{4}-\d{2}/.test(String(mailDateStr || "")) ? String(mailDateStr) : toKstDateStr(Date.now());
  const yr = Number(d.slice(0, 4));
  const mo = Number(d.slice(5, 7));
  if (kind === "closing_report" && mo >= 1 && mo <= 4) return yr - 1;
  return yr;
}

function buildFundDirectory(fundsMap, sitesByFund) {
  const funds = {};
  const byEmail = {};
  const byCoKey = {};
  const variantList = [];

  Object.keys(fundsMap || {}).forEach((fid) => {
    const f = fundsMap[fid];
    if (!f || f.deleted_at || f.lifecycle === "해산") return;
    funds[fid] = f;
    fundNameVariants(f).forEach((v) => variantList.push({ variant: v, fid }));

    const sm = (sitesByFund && sitesByFund[fid]) || {};
    Object.keys(sm).forEach((sid) => {
      const st = sm[sid];
      if (!st || st.deleted_at) return;
      const ck = normName(st.name);
      if (ck.length >= 3 && !GENERIC_CO_NAMES.has(ck)) {
        (byCoKey[ck] = byCoKey[ck] || []).push({ fid, sid, name: st.name || "" });
      }
      const contacts = Array.isArray(st.contacts)
        ? st.contacts
        : (st.contacts && typeof st.contacts === "object" ? Object.values(st.contacts) : []);
      contacts.forEach((c) => {
        const em = String((c && c.email) || "").trim().toLowerCase();
        if (em && em.includes("@")) {
          (byEmail[em] = byEmail[em] || []).push({ fid, sid });
        }
      });
    });
  });

  variantList.sort((a, b) => b.variant.length - a.variant.length);
  return { funds, sitesByFund: sitesByFund || {}, byEmail, byCoKey, variantList };
}

async function getFundDirectoryCached(db) {
  const now = Date.now();
  const cached = _dirCacheByDb.get(db);
  if (cached && now - cached.at < DIR_CACHE_TTL_MS) return cached.dir;
  const [fundsSnap, sitesSnap] = await Promise.all([
    db.ref(NS + "/funds").once("value"),
    db.ref(NS + "/sites").once("value")
  ]);
  const dir = buildFundDirectory(fundsSnap.val() || {}, sitesSnap.val() || {});
  _dirCacheByDb.set(db, { at: now, dir });
  return dir;
}

function matchFundFromMail(msg, slug, dir, selfEmails, attNames) {
  if (!msg || !dir || !dir.funds) return null;
  const fromEmail = String(msg.e || "").trim().toLowerCase();
  if (fromEmail && selfEmails && selfEmails.has(fromEmail)) return null;

  const subj = String(msg.s || "");
  const fromName = String(msg.f || "");
  const attJoined = (attNames || []).join(" ");
  const textNorm = normName(subj + " " + fromName + " " + attJoined);
  const dedicated = isDedicatedFundFolder(slug);
  const hasFundClue = dedicated || FUND_CLUE_RE.test(subj + " " + fromName + " " + attJoined);

  let matchedFid = "";
  let matchedSid = "";
  let via = "";

  for (let i = 0; i < dir.variantList.length; i++) {
    const it = dir.variantList[i];
    if (textNorm.includes(it.variant)) {
      matchedFid = it.fid;
      via = "fund_name";
      break;
    }
  }

  if (!matchedFid && fromEmail && dir.byEmail[fromEmail] && hasFundClue) {
    const hits = dir.byEmail[fromEmail];
    const uniqFids = [...new Set(hits.map((h) => h.fid))];
    if (uniqFids.length === 1) {
      matchedFid = uniqFids[0];
      matchedSid = hits[0].sid || "";
      via = "contact_email";
    } else {
      for (let j = 0; j < hits.length; j++) {
        const st = ((dir.sitesByFund[hits[j].fid] || {})[hits[j].sid]) || {};
        const ck = normName(st.name);
        if (ck.length >= 2 && textNorm.includes(ck)) {
          matchedFid = hits[j].fid;
          matchedSid = hits[j].sid;
          via = "contact_email+site";
          break;
        }
      }
    }
  }

  if (!matchedFid && hasFundClue) {
    const coKeys = Object.keys(dir.byCoKey).sort((a, b) => b.length - a.length);
    for (let k = 0; k < coKeys.length; k++) {
      const ck = coKeys[k];
      const owners = dir.byCoKey[ck];
      const uniqFids = [...new Set(owners.map((o) => o.fid))];
      if (uniqFids.length === 1 && textNorm.includes(ck)) {
        matchedFid = uniqFids[0];
        matchedSid = owners[0].sid || "";
        via = "unique_company";
        break;
      }
    }
  }

  if (!matchedFid || !dir.funds[matchedFid]) return null;

  const fSites = dir.sitesByFund[matchedFid] || {};
  const activeSids = Object.keys(fSites).filter((s) => fSites[s] && !fSites[s].deleted_at);
  const knownContact = !!(fromEmail && dir.byEmail[fromEmail] && dir.byEmail[fromEmail].some((h) => h.fid === matchedFid));

  if (!matchedSid && knownContact) {
    const hit = dir.byEmail[fromEmail].find((h) => h.fid === matchedFid);
    if (hit) matchedSid = hit.sid;
  }
  if (!matchedSid) {
    for (let m = 0; m < activeSids.length; m++) {
      const ck = normName(fSites[activeSids[m]].name);
      if (ck.length >= 2 && textNorm.includes(ck)) {
        matchedSid = activeSids[m];
        break;
      }
    }
  }
  if (!matchedSid && activeSids.length === 1) {
    matchedSid = activeSids[0];
  }

  return { fid: matchedFid, sid: matchedSid || "", via, knownContact, fund: dir.funds[matchedFid] };
}

function _domainAligned(candDom, fromDom) {
  const c = String(candDom || "").trim().toLowerCase().replace(/^@+/, "").replace(/[>;,\s].*$/, "");
  const f = String(fromDom || "").trim().toLowerCase();
  if (!c || !f || !f.includes(".")) return false;
  return c === f || c.endsWith("." + f);
}

/* 최상단 Authentication-Results 1줄만 추출 + 수신 서버 authserv-id 확인 + From 도메인 정렬 검증 */
function isAuthResultsPass(authHeaderRaw, fromEmail, authServRe) {
  const raw = String(authHeaderRaw || "");
  if (!raw) return false;
  const fromEm = String(fromEmail || "").trim().toLowerCase();
  const atIdx = fromEm.lastIndexOf("@");
  const fromDom = atIdx > 0 ? fromEm.slice(atIdx + 1) : "";
  if (!fromDom) return false;

  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let topLine = "";
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/^authentication-results\s*:/i.test(ln)) {
      topLine = ln.replace(/^authentication-results\s*:\s*/i, "").trim();
      break;
    }
  }
  if (!topLine && lines.length === 1 && !/^[a-z0-9-]+:/i.test(lines[0])) {
    topLine = lines[0];
  }
  if (!topLine) return false;

  const semi = topLine.indexOf(";");
  if (semi <= 0) return false;
  const authServId = topLine.slice(0, semi).trim().split(/\s+/)[0].toLowerCase();
  const servRe = authServRe || DEFAULT_AUTHSERV_RE;
  if (!servRe.test(authServId)) return false;

  const rest = topLine.slice(semi + 1);
  if (/\b(?:spf|dkim|dmarc)\s*=\s*(?:fail|softfail|permerror|temperror)\b/i.test(rest)) return false;

  const dmarcM = /\bdmarc\s*=\s*pass\b([^;]*)/i.exec(rest);
  if (dmarcM) {
    const hf = /\bheader\.from\s*=\s*([^\s;]+)/i.exec(dmarcM[1] || "");
    if (hf && _domainAligned(hf[1], fromDom)) return true;
  }

  const dkimRe = /\bdkim\s*=\s*pass\b([^;]*)/gi;
  let dm;
  while ((dm = dkimRe.exec(rest)) !== null) {
    const hd = /\bheader\.d\s*=\s*([^\s;]+)/i.exec(dm[1] || "") || /\bheader\.i\s*=\s*[^\s;@]*@([^\s;]+)/i.exec(dm[1] || "");
    if (hd && _domainAligned(hd[1], fromDom)) return true;
  }

  const spfM = /\bspf\s*=\s*pass\b([^;]*)/i.exec(rest);
  if (spfM) {
    const mf = /\bsmtp\.mailfrom\s*=\s*(?:[^\s;@]*@)?([^\s;>]+)/i.exec(spfM[1] || "");
    if (mf && _domainAligned(mf[1], fromDom)) return true;
  }

  return false;
}

function decodeZipFileName(rawBytes, gpFlag) {
  const isUtf8 = !!(gpFlag & 0x0800);
  const utf8 = Buffer.from(rawBytes).toString("utf8");
  if (isUtf8 && !utf8.includes("\uFFFD")) return utf8;
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("euc-kr").decode(rawBytes);
  } catch (_) {
    return utf8;
  }
}

function extractZipEntries(zipBuf) {
  const buf = Buffer.isBuffer(zipBuf) ? zipBuf : Buffer.from(zipBuf || []);
  let eocdOff = -1;
  const minOff = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOff = i; break; }
  }
  if (eocdOff < 0) return [];
  const totalEntries = buf.readUInt16LE(eocdOff + 10);
  const cdOff = buf.readUInt32LE(eocdOff + 16);
  if (cdOff >= buf.length) return [];

  const out = [];
  let pos = cdOff;
  let totalOut = 0;
  const limit = Math.min(totalEntries, MAX_ZIP_ENTRIES);

  for (let idx = 0; idx < limit && pos + 46 <= buf.length; idx++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const gpFlag = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const fnLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const rawName = buf.subarray(pos + 46, pos + 46 + fnLen);
    pos += 46 + fnLen + extraLen + commentLen;

    const fullPath = decodeZipFileName(rawName, gpFlag).replace(/\\/g, "/");
    if (!fullPath || fullPath.endsWith("/") || fullPath.includes("__MACOSX/")) continue;
    const baseName = fullPath.split("/").pop().trim();
    if (!baseName || baseName.startsWith(".") || !DOC_EXT_RE.test(baseName)) continue;
    if (uncompSize > MAX_DOC_BYTES || compSize > MAX_RAW_ATT_BYTES) continue;
    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) continue;

    const lFnLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lFnLen + lExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) continue;

    const slice = buf.subarray(dataStart, dataEnd);
    let data = null;
    try {
      if (method === 0) {
        data = Buffer.from(slice);
      } else if (method === 8) {
        data = zlib.inflateRawSync(slice, { maxOutputLength: Math.min(MAX_DOC_BYTES, MAX_ZIP_TOTAL_OUT - totalOut) });
      }
    } catch (_) {
      data = null;
    }
    if (!data || !data.length || data.length > MAX_DOC_BYTES) continue;
    totalOut += data.length;
    if (totalOut > MAX_ZIP_TOTAL_OUT) break;
    out.push({ name: baseName, zipEntry: fullPath, buf: data });
  }
  return out;
}

function guessMime(fileName, fallback) {
  const ext = (String(fileName || "").match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const map = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".hwp": "application/x-hwp",
    ".hwpx": "application/hwp+zip",
    ".csv": "text/csv"
  };
  return map[ext] || fallback || "application/octet-stream";
}

const META_XML_SKIP_RE = /(?:^|\/)(?:docProps\/|_rels\/|\[Content_Types\]\.xml$|styles\.xml$|settings\.xml$|webSettings\.xml$|fontTable\.xml$|theme\/|Contents\/header\.xml$|META-INF\/)/i;
const SAFE_PREVIEW_THUMB_RE = /^(?:Preview\/PrvImage\.[^/]+|docProps\/thumbnail\.[^/]+)$/i;
const EMBEDDED_MEDIA_RE = /(?:^|\/)(?:BinData|media|embeddings|oleObject)\/|\.(?:png|jpe?g|gif|bmp|tiff?|webp|emf|wmf|bin|pdf)$/i;

function decodeXmlEntities(s) {
  return String(s || "")
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d{1,7});/g, (_, dec) => {
      const cp = parseInt(dec, 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/* 100% fail-closed 본문 텍스트 추출기 */
async function extractDocTextSample(buf, ext, pdfExtractor) {
  if (!buf || !buf.length) return { text: "", unreadable: true };
  if (ext === ".csv") {
    if (buf.length > 200000) return { text: "", unreadable: true };
    const t = Buffer.from(buf).toString("utf8");
    return { text: t, unreadable: t.replace(/\s+/g, "").length === 0 };
  }
  if (ext === ".hwpx" || ext === ".docx" || ext === ".xlsx") {
    try {
      let eocd = -1;
      for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) return { text: "", unreadable: true };
      const totalCnt = buf.readUInt16LE(eocd + 10);
      if (totalCnt <= 0 || totalCnt > 120) return { text: "", unreadable: true };

      let p = buf.readUInt32LE(eocd + 16);
      let spacedOut = "";
      let joinedOut = "";
      let bodyChars = 0;
      let outLen = 0;

      for (let idx = 0; idx < totalCnt; idx++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return { text: "", unreadable: true };
        const mth = buf.readUInt16LE(p + 10);
        const cSz = buf.readUInt32LE(p + 20);
        const uSz = buf.readUInt32LE(p + 24);
        const fL = buf.readUInt16LE(p + 28);
        const eL = buf.readUInt16LE(p + 30);
        const cmL = buf.readUInt16LE(p + 32);
        const lOff = buf.readUInt32LE(posCheck(p + 42));
        const nm = buf.subarray(p + 46, p + 46 + fL).toString("utf8").replace(/\\/g, "/");
        p += 46 + fL + eL + cmL;

        if (nm.endsWith("/")) continue;
        if (!SAFE_PREVIEW_THUMB_RE.test(nm) && EMBEDDED_MEDIA_RE.test(nm)) return { text: "", unreadable: true };
        if (!/\.(?:xml|rels)$/i.test(nm)) continue;
        if (cSz > 4 * 1024 * 1024 || uSz > 6 * 1024 * 1024 || lOff + 30 > buf.length) {
          return { text: "", unreadable: true };
        }
        const dStart = lOff + 30 + buf.readUInt16LE(lOff + 26) + buf.readUInt16LE(lOff + 28);
        if (dStart + cSz > buf.length) return { text: "", unreadable: true };
        const sl = buf.subarray(dStart, dStart + cSz);
        const raw = mth === 0 ? sl : (mth === 8 ? zlib.inflateRawSync(sl, { maxOutputLength: 6 * 1024 * 1024 }) : null);
        if (!raw) return { text: "", unreadable: true };
        outLen += raw.length;
        if (outLen > 8 * 1024 * 1024) return { text: "", unreadable: true };

        const xmlStr = raw.toString("utf8");
        const sp = decodeXmlEntities(xmlStr.replace(/<[^>]+>/g, " "));
        const jn = decodeXmlEntities(xmlStr.replace(/<[^>]+>/g, ""));
        spacedOut += " " + sp;
        joinedOut += "\n" + jn;
        if (!META_XML_SKIP_RE.test(nm)) {
          bodyChars += jn.replace(/\s+/g, "").length;
        }
      }
      return { text: spacedOut + "\n" + joinedOut, unreadable: bodyChars < 5 };
    } catch (_) {
      return { text: "", unreadable: true };
    }
  }
  if (ext === ".pdf") {
    try {
      const latin = Buffer.from(buf).toString("latin1");
      /* 혼합 PDF(텍스트 표지 + 스캔 신분증 이미지 페이지) 방어: PDF 내장 Image XObject 가 있으면 fail-closed */
      if (/\/Subtype\s*\/Image\b/.test(latin)) return { text: "", unreadable: true };
      const readFn = pdfExtractor || ((b) => require("./rules-collect-pdf").pdfText(b));
      const res = await readFn(buf);
      if (!res || res.truncated) return { text: "", unreadable: true };
      const t = String(res.text || "");
      const pages = Math.max(1, Number(res.pages || 1));
      const nonWs = t.replace(/\s+/g, "").length;
      return { text: t, unreadable: nonWs < 10 || nonWs / pages < 10 };
    } catch (_) {
      return { text: "", unreadable: true };
    }
  }
  return { text: "", unreadable: true };
}

function posCheck(n) { return n; }

function buildAutoSaveUpdates(params) {
  const { fid, sid, fund, slug, uid, msg, docs, activeEvents, existingSiteChk, nowDate, trustedSender, allowAutoBlob } = params;
  const up = {};
  const blobWrites = [];
  const dateStr = toKstDateStr(msg.d || nowDate);
  const mailId = makeMailArchiveId(slug, uid);
  const isSetup = fund && fund.setup_stage === "설립준비";
  const activeEvList = Object.keys(activeEvents || {})
    .filter((eid) => activeEvents[eid] && activeEvents[eid].status !== "완료")
    .map((eid) => Object.assign({ _id: eid }, activeEvents[eid]));

  const savedDocs = [];
  const yearsTouched = new Set();
  const maskedFrom = maskPiiText(msg.f || "");
  const maskedSubj = maskPiiText(msg.s || "");
  const maskedSummary = maskPiiText(msg.p || "");

  (docs || []).forEach((doc, idx) => {
    const rawNm = String(doc.name || ("첨부" + (idx + 1))).trim();
    const nm = maskPiiText(rawNm);
    const dot = nm.lastIndexOf(".");
    const ext = dot >= 0 ? nm.slice(dot).toLowerCase() : "";
    const cls = classifyFundMailDoc(nm, msg.s || "");
    const yr = inferArchiveYear(nm, msg.s || "", dateStr, cls.kind);
    const docId = "ma_" + hashId(slug + "|" + uid + "|" + (doc.part || "") + "|" + (doc.zipEntry || rawNm));

    const sec = isSensitiveIdentityDoc(rawNm, doc.textSample || "");
    let skipReason = "";
    if (sec.blocked) skipReason = sec.reason;
    else if (!allowAutoBlob) skipReason = "미등록 발신자(검토 후 백업)";
    else if (doc.unreadable || !ARCHIVE_BLOB_EXT_RE.test(nm)) skipReason = "스캔·바이너리 문서(메일함 원본 즉시 열람)";

    const canBlob = !skipReason && doc.buf && doc.buf.length > 0 && doc.buf.length <= MAX_DOC_BYTES;
    const mime = guessMime(nm, doc.mime);

    /* 1) 본문 개인정보 안전 검증을 통과한 신뢰 발신 문서는 closing_blobs 에 개별 저장 */
    if (canBlob) {
      yearsTouched.add(yr);
      const meta = {
        name: nm,
        kind: cls.kind,
        kind_label: cls.kindLabel,
        ext,
        mime,
        size: doc.buf.length,
        src: "mail_auto",
        mail_slug: String(slug),
        mail_uid: String(uid),
        mail_part: String(doc.part || ""),
        zip_entry: maskPiiText(doc.zipEntry || ""),
        uploaded_at: dateStr,
        uploaded_by: "메일자동수집"
      };
      blobWrites.push({
        path: NS + "/closing_blobs/" + fid + "/" + yr + "/" + docId,
        value: Object.assign({}, meta, { data_b64: Buffer.from(doc.buf).toString("base64") })
      });
      up[NS + "/closing/" + fid + "/" + yr + "/archive_docs/" + docId] = meta;
    }

    /* 2) 진행중 변경 이벤트 자동 연결 (allowAutoBlob 이고 민감 신분서류가 아닌 경우만) */
    if (!sec.blocked && allowAutoBlob && cls.isEventDoc && activeEvList.length) {
      activeEvList.forEach((ev) => {
        up[NS + "/events/" + fid + "/" + ev._id + "/mail_docs/" + docId] = {
          docId,
          yr,
          name: nm,
          kind: cls.kind,
          kind_label: cls.kindLabel,
          size: doc.buf ? doc.buf.length : 0,
          has_blob: !!canBlob,
          date_str: dateStr,
          from: maskedFrom,
          mail_slug: String(slug),
          mail_uid: String(uid),
          mail_part: String(doc.part || ""),
          zip_entry: maskPiiText(doc.zipEntry || "")
        };
      });
    }

    /* 3) 사업장 제출서류 체크리스트 입수 표시:
          allowAutoBlob 가 true 일 때만 반영하며, 기존 확인완료(ok) 또는 기존 trusted:true 참조를 미인증 메일로 덮어쓰지 않음 */
    if (allowAutoBlob && sid && cls.sdcKind && (!sec.blocked || ["inseal", "jumin", "idcard"].includes(cls.sdcKind))) {
      const sdcIds = mapSdcKindToDocIds(cls.sdcKind, fund && fund.fund_type, isSetup, activeEvList.length > 0);
      sdcIds.forEach((sdcDocId) => {
        const prev = ((existingSiteChk || {})[sid] || {})[sdcDocId] || null;
        if (prev && prev.ok) return;
        if (prev && prev.mail && prev.mail.trusted === true && !trustedSender) return;
        const cell = Object.assign({}, prev || {}, {
          recv: true,
          recv_at: dateStr,
          recv_via: "mail",
          mail: {
            slug: String(slug),
            uid: String(uid),
            part: String(doc.part || ""),
            attName: nm,
            zipEntry: maskPiiText(doc.zipEntry || ""),
            date: dateStr,
            trusted: !!trustedSender
          }
        });
        if (sec.blocked) cell.sensitive_note = sec.reason;
        up[NS + "/site_doc_chk/" + fid + "/" + sid + "/" + sdcDocId] = cell;
      });
    }

    /* 4) 기금 메일 자동보관함 색인 기록 */
    up[NS + "/mail_auto_inbox/" + fid + "/" + docId] = {
      docId,
      yr,
      sid: sid || "",
      name: nm,
      kind: cls.kind,
      kind_label: cls.kindLabel,
      sdc_kind: cls.sdcKind || "",
      size: doc.buf ? doc.buf.length : 0,
      has_blob: !!canBlob,
      blocked_reason: skipReason,
      trusted: !!trustedSender,
      date_str: dateStr,
      subject: maskedSubj,
      from: maskedFrom,
      email: String(msg.e || ""),
      mail_slug: String(slug),
      mail_uid: String(uid),
      mail_part: String(doc.part || ""),
      zip_entry: maskPiiText(doc.zipEntry || ""),
      saved_at: nowDate || dateStr
    };

    savedDocs.push({ docId, name: nm, yr, kind: cls.kind, canBlob: !!canBlob, blocked: sec.blocked });
  });

  yearsTouched.forEach((yr) => {
    up[NS + "/closing/" + fid + "/" + yr + "/archive_mails/" + mailId] = {
      subject: maskedSubj,
      date_str: dateStr,
      from: maskedFrom,
      email: String(msg.e || ""),
      att_names: (docs || []).map((d) => maskPiiText(d.name || "")),
      source: "imap",
      slug: String(slug),
      uid: String(uid),
      summary: maskedSummary
    };
  });

  return { updates: up, blobWrites, savedDocs };
}

async function reserveDailyQuota(db, bucketKind, fid, todayStr, maxLimit, wantCount) {
  const qRef = db.ref(NS + "/mail_auto_seen/" + bucketKind + "/" + fid + "/" + todayStr);
  let allowed = 0;
  const res = await qRef.transaction((cur) => {
    const used = Number(cur || 0);
    if (used >= maxLimit) return;
    allowed = Math.min(wantCount, maxLimit - used);
    return used + allowed;
  });
  return res && res.committed ? allowed : 0;
}

/* 단일 신규 메일 처리 진입점 */
async function collectSingleMail(deps, slug, uid, msg) {
  if (!msg || !(Number(msg.a) > 0)) return { status: "skip_no_att" };
  if (!isFundCollectableFolder(slug)) return { status: "skip_folder" };

  const db = deps.db;
  const selfEmail = String((deps.getSelfEmail && (await deps.getSelfEmail())) || "").trim().toLowerCase();
  const selfEmails = buildSelfEmailSet(selfEmail);
  if (msg.e && selfEmails.has(String(msg.e).trim().toLowerCase())) {
    return { status: "skip_self" };
  }

  const seenKey = makeMailSeenKey(slug, uid);
  const seenRef = db.ref(NS + "/mail_auto_seen/msgs/" + seenKey);
  const existingSeen = (await seenRef.once("value")).val();
  if (existingSeen && (existingSeen.st === "done" || existingSeen.st === "skipped_quota")) {
    return { status: "already_done", fid: existingSeen.fid || "" };
  }
  if (existingSeen && existingSeen.st === "error" && Date.now() - Number(existingSeen.at || 0) < ERROR_RETRY_COOLDOWN_MS) {
    return { status: "cooldown_after_error", fid: existingSeen.fid || "" };
  }

  const dir = await getFundDirectoryCached(db);
  const dedicated = isDedicatedFundFolder(slug);
  const fromLower = String(msg.e || "").trim().toLowerCase();
  const isRegisteredEmail = !!(fromLower && dir.byEmail[fromLower]);
  let match = matchFundFromMail(msg, slug, dir, selfEmails, []);

  /* 제목만으로 매칭이 안 됐는데 전용 폴더도 아니고 등록된 담당자 이메일도 아니면 다운로드 없이 즉시 종료 */
  if (!match && !dedicated && !isRegisteredEmail) {
    return { status: "skip_unmatched" };
  }

  /* 동시 실행 선점 트랜잭션 — 무거운 IMAP 첨부 다운로드 전에 먼저 선점한다 */
  const claim = await seenRef.transaction((cur) => {
    if (cur && (cur.st === "done" || cur.st === "skipped_quota")) return;
    if (cur && cur.st === "working" && Date.now() - Number(cur.at || 0) < 180000) return;
    if (cur && cur.st === "error" && Date.now() - Number(cur.at || 0) < ERROR_RETRY_COOLDOWN_MS) return;
    return { st: "working", at: Date.now(), fid: (match && match.fid) || "" };
  });
  if (!claim.committed) return { status: "already_claimed" };

  const todayStr = toKstDateStr(Date.now());

  try {
    /* ★ 미등록 외부인이 일반 받은편지함(INBOX 등)으로 기금명만 넣어 보낸 경우:
       IMAP 첨부 바이트를 아예 내려받지 않고(자원 소모 차단) 분리된 untrusted_quota 안에서 검토 대기 알림만 기록한다 */
    if (match && !dedicated && !match.knownContact) {
      const okUntrusted = await reserveDailyQuota(db, "untrusted_quota", match.fid, todayStr, MAX_UNTRUSTED_DAILY_NOTES, 1);
      if (okUntrusted <= 0) {
        await seenRef.set({ st: "skipped_quota", at: Date.now(), fid: match.fid, bucket: "untrusted" });
        return { status: "skip_untrusted_quota", fid: match.fid };
      }
      const docId = "ma_" + hashId(slug + "|" + uid + "|untrusted_notice");
      const dateStr = toKstDateStr(msg.d || todayStr);
      const upNotice = {};
      upNotice[NS + "/mail_auto_inbox/" + match.fid + "/" + docId] = {
        docId,
        yr: Number(dateStr.slice(0, 4)),
        sid: match.sid || "",
        name: maskPiiText(msg.s || "외부 수신 첨부메일"),
        kind: "fund_master_doc",
        kind_label: "미등록발신 검토대기",
        sdc_kind: "",
        size: 0,
        has_blob: false,
        blocked_reason: "미등록 발신자(메일함에서 원본 확인)",
        trusted: false,
        date_str: dateStr,
        subject: maskPiiText(msg.s || ""),
        from: maskPiiText(msg.f || ""),
        email: String(msg.e || ""),
        mail_slug: String(slug),
        mail_uid: String(uid),
        mail_part: "",
        zip_entry: "",
        saved_at: todayStr
      };
      upNotice[NS + "/mail_auto_seen/msgs/" + seenKey] = { st: "done", at: Date.now(), fid: match.fid, via: match.via, untrusted: true, count: 1 };
      upNotice[NS + "/mail_auto_seen/by_fund/" + match.fid + "/" + seenKey] = { at: Date.now(), count: 1, date_str: dateStr };
      await db.ref().update(upNotice);
      return { status: "saved_untrusted_notice", fid: match.fid, trustedSender: false, savedDocs: [{ docId, canBlob: false }] };
    }

    /* match 가 이미 확정된 경우에는 IMAP 다운로드 전에 일일 신뢰 쿼터 여유가 있는지 먼저 확인 */
    if (match) {
      const usedNow = Number((await db.ref(NS + "/mail_auto_seen/trusted_quota/" + match.fid + "/" + todayStr).once("value")).val() || 0);
      if (usedNow >= MAX_TRUSTED_DAILY_DOCS) {
        await seenRef.set({ st: "skipped_quota", at: Date.now(), fid: match.fid, bucket: "trusted" });
        return { status: "skip_daily_quota", fid: match.fid };
      }
    }

    const fetchRes = await deps.fetchAttachments(slug, uid);
    const rawAtts = Array.isArray(fetchRes) ? fetchRes : ((fetchRes && fetchRes.atts) || []);
    const authHeader = (!Array.isArray(fetchRes) && fetchRes && fetchRes.authResults) || "";
    if (!rawAtts.length) {
      await seenRef.set({ st: "done", at: Date.now(), fid: (match && match.fid) || "", count: 0 });
      return { status: "skip_empty_atts" };
    }

    if (!match) {
      match = matchFundFromMail(msg, slug, dir, selfEmails, rawAtts.map((a) => a.name));
    }
    if (!match) {
      await seenRef.set({ st: "done", at: Date.now(), fid: "", count: 0 });
      return { status: "skip_unmatched_after_att" };
    }

    const authOk = isAuthResultsPass(authHeader, msg.e || "", deps.authServRe);
    const trustedSender = !!(match.knownContact && authOk);
    const allowAutoBlob = !!(trustedSender || dedicated);

    /* 원자적 일일 쿼터 예약 (트랜잭션) */
    const quotaBucket = allowAutoBlob ? "trusted_quota" : "untrusted_quota";
    const quotaLimit = allowAutoBlob ? MAX_TRUSTED_DAILY_DOCS : MAX_UNTRUSTED_DAILY_NOTES;
    const reserved = await reserveDailyQuota(db, quotaBucket, match.fid, todayStr, quotaLimit, Math.min(rawAtts.length * 4, 15));
    if (reserved <= 0) {
      await seenRef.set({ st: "skipped_quota", at: Date.now(), fid: match.fid, bucket: quotaBucket });
      return { status: "skip_daily_quota", fid: match.fid };
    }

    const expanded = [];
    for (let i = 0; i < rawAtts.length && expanded.length < reserved; i++) {
      const a = rawAtts[i];
      const nm = String(a.name || "").trim();
      if (!nm || !a.buf) continue;
      if (/\.zip$/i.test(nm)) {
        const zItems = extractZipEntries(a.buf);
        for (let z = 0; z < zItems.length && expanded.length < reserved; z++) {
          const extZ = (zItems[z].name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
          const exZ = await extractDocTextSample(zItems[z].buf, extZ, deps.pdfExtractor);
          expanded.push({
            name: zItems[z].name,
            part: a.part || "",
            zipEntry: zItems[z].zipEntry,
            mime: guessMime(zItems[z].name, ""),
            buf: zItems[z].buf,
            textSample: exZ.text,
            unreadable: exZ.unreadable
          });
        }
      } else if (DOC_EXT_RE.test(nm) && a.buf.length <= MAX_DOC_BYTES) {
        const ext = (nm.match(/\.[^.]+$/) || [""])[0].toLowerCase();
        const ex = await extractDocTextSample(a.buf, ext, deps.pdfExtractor);
        expanded.push({
          name: nm,
          part: a.part || "",
          zipEntry: "",
          mime: a.mime || guessMime(nm, ""),
          buf: a.buf,
          textSample: ex.text,
          unreadable: ex.unreadable
        });
      }
    }

    if (!expanded.length) {
      await seenRef.set({ st: "done", at: Date.now(), fid: match.fid, count: 0 });
      return { status: "no_supported_docs", fid: match.fid };
    }

    const [evSnap, chkSnap] = await Promise.all([
      db.ref(NS + "/events/" + match.fid).once("value"),
      match.sid ? db.ref(NS + "/site_doc_chk/" + match.fid).once("value") : Promise.resolve({ val: () => ({}) })
    ]);

    const built = buildAutoSaveUpdates({
      fid: match.fid,
      sid: match.sid,
      fund: match.fund,
      slug,
      uid,
      msg,
      docs: expanded,
      activeEvents: evSnap.val() || {},
      existingSiteChk: chkSnap.val() || {},
      nowDate: todayStr,
      trustedSender,
      allowAutoBlob
    });

    for (let b = 0; b < built.blobWrites.length; b++) {
      await db.ref(built.blobWrites[b].path).set(built.blobWrites[b].value);
    }

    /* 실제 저장 건수가 선점치보다 적으면 차액 환급 */
    const unused = reserved - built.savedDocs.length;
    if (unused > 0) {
      await db.ref(NS + "/mail_auto_seen/" + quotaBucket + "/" + match.fid + "/" + todayStr)
        .transaction((cur) => Math.max(0, Number(cur || 0) - unused))
        .catch(() => null);
    }

    built.updates[NS + "/mail_auto_seen/msgs/" + seenKey] = {
      st: "done",
      at: Date.now(),
      fid: match.fid,
      sid: match.sid || "",
      via: match.via,
      count: built.savedDocs.length
    };
    built.updates[NS + "/mail_auto_seen/by_fund/" + match.fid + "/" + seenKey] = {
      at: Date.now(),
      count: built.savedDocs.length,
      date_str: toKstDateStr(msg.d || Date.now())
    };

    await db.ref().update(built.updates);
    return { status: "saved", fid: match.fid, sid: match.sid, via: match.via, trustedSender, savedDocs: built.savedDocs };
  } catch (err) {
    await seenRef.set({ st: "error", at: Date.now(), fid: (match && match.fid) || "", err: String((err && err.message) || err).slice(0, 160) }).catch(() => null);
    throw err;
  }
}

const MAIL_QUEUE_PATH = "fund_mail_queue";
const MAX_QUEUE_BATCH = 25;
const MAX_QUEUE_ATTEMPTS = 3;
const MAX_FAILED_QUEUE_AGE_MS = 7 * 24 * 3600 * 1000;

function makeMailQueueTicket(slug, uid, msg, now) {
  const m = (msg && typeof msg === "object") ? msg : {};
  return {
    slug: String(slug || ""),
    uid: String(uid || ""),
    msg: {
      s: String(m.s || "").slice(0, 200),
      f: String(m.f || "").slice(0, 120),
      e: String(m.e || "").slice(0, 160),
      p: String(m.p || "").slice(0, 120),
      d: m.d || 0,
      a: Number(m.a) || 0
    },
    queuedAt: Number(now) || Date.now(),
    attempts: 0
  };
}

function groupQueueByFolder(queueMap, now, maxBatch) {
  const tsNow = Number(now) || Date.now();
  const limit = Math.max(1, Number(maxBatch) || MAX_QUEUE_BATCH);
  const src = (queueMap && typeof queueMap === "object") ? queueMap : {};
  const list = [];
  Object.keys(src).forEach((key) => {
    const t = src[key];
    if (!t || typeof t !== "object") return;
    if (t.st === "failed") return;
    if (Number(t.retryAfter || 0) > tsNow) return;
    const slug = String(t.slug || "");
    const uid = String(t.uid || "");
    if (!slug || !uid) return;
    list.push({
      key,
      slug,
      uid,
      msg: t.msg || {},
      queuedAt: Number(t.queuedAt || 0),
      attempts: Number(t.attempts || 0)
    });
  });
  list.sort((a, b) => a.queuedAt - b.queuedAt || a.key.localeCompare(b.key));
  const picked = list.slice(0, limit);
  const byFolder = Object.create(null);
  const folderOrder = [];
  picked.forEach((item) => {
    if (!byFolder[item.slug]) {
      byFolder[item.slug] = [];
      folderOrder.push(item.slug);
    }
    byFolder[item.slug].push(item);
  });
  return { folderOrder, byFolder, count: picked.length };
}

async function fetchAttachmentsWithClient(client, mailUid, pickPartsFn, drainFn, limits) {
  const maxAtts = (limits && limits.maxAttCount) || MAX_ATT_COUNT;
  const maxRaw = (limits && limits.maxRawAttBytes) || MAX_RAW_ATT_BYTES;
  const maxTotal = (limits && limits.maxTotalAttBytes) || MAX_TOTAL_ATT_BYTES;
  const head = await client.fetchOne(
    String(mailUid),
    { uid: true, bodyStructure: true, headers: ["authentication-results"] },
    { uid: true }
  );
  if (!head) return { atts: [], authResults: "" };
  const authResults = head.headers ? head.headers.toString("utf8") : "";
  const parts = pickPartsFn(head.bodyStructure, null, 0);
  const out = [];
  let totalBytes = 0;
  for (const att of (parts.atts || []).slice(0, maxAtts)) {
    const sz = Number(att && att.size) || 0;
    if (!att || !att.part || sz > maxRaw) continue;
    if (totalBytes + sz > maxTotal) break;
    try {
      const d = await client.download(String(mailUid), att.part, { uid: true });
      const buf = await drainFn(d.content, Math.min(maxRaw, maxTotal - totalBytes));
      totalBytes += buf.length;
      out.push({ name: att.name || "", part: att.part, mime: att.mime || "", buf });
    } catch (_) {
      continue;
    }
    if (totalBytes >= maxTotal) break;
  }
  return { atts: out, authResults };
}

/* 큐 배치 직렬 처리기:
   - 큐가 비어 있으면 IMAP 연결 없이 즉시 반환한다.
   - 폴더(slug)마다 실제로 첨부 다운로드가 필요한 첫 건에서만 withFolder 세션을 지연 오픈해
     동일 폴더 내 나머지 티켓을 단일 IMAP 세션으로 순차 처리한다. */
async function drainFundMailQueueBatch(deps, opts) {
  const db = deps && deps.db;
  const tsNow = (opts && Number(opts.now)) || (deps && typeof deps.now === "function" && deps.now()) || Date.now();
  const maxBatch = (opts && Number(opts.maxBatch)) || MAX_QUEUE_BATCH;
  const fetchLimit = maxBatch * 2;
  const queueSnap = await db.ref(MAIL_QUEUE_PATH).orderByKey().limitToFirst(fetchLimit).once("value");
  let queueMap = (queueSnap && queueSnap.val && queueSnap.val()) || null;
  let grouped = groupQueueByFolder(queueMap, tsNow, maxBatch);
  if (grouped.count < maxBatch && queueMap && Object.keys(queueMap).length >= fetchLimit) {
    const fullSnap = await db.ref(MAIL_QUEUE_PATH).once("value");
    queueMap = (fullSnap && fullSnap.val && fullSnap.val()) || null;
    grouped = groupQueueByFolder(queueMap, tsNow, maxBatch);
  }
  if (queueMap && typeof queueMap === "object") {
    const expiredFailed = Object.keys(queueMap).filter((k) => {
      const t = queueMap[k];
      if (!t || typeof t !== "object" || t.st !== "failed") return false;
      const failTs = Number(t.failedAt || t.queuedAt || 0);
      return failTs > 0 && (tsNow - failTs) > MAX_FAILED_QUEUE_AGE_MS;
    });
    if (expiredFailed.length) {
      await Promise.all(expiredFailed.slice(0, 20).map((k) => db.ref(MAIL_QUEUE_PATH + "/" + k).set(null).catch(() => null)));
    }
  }
  if (!grouped.count) {
    return { processed: 0, saved: 0, errors: 0, failed: 0, imapSessions: 0, folders: 0 };
  }

  let processed = 0;
  let saved = 0;
  let errors = 0;
  let failed = 0;
  let imapSessions = 0;

  for (const slug of grouped.folderOrder) {
    const tickets = grouped.byFolder[slug] || [];
    let activeClient = null;
    let doneQueue = null;
    let sessionPromise = null;
    let readyPromise = null;
    let imapError = null;

    const releaseFolderSession = () => {
      if (doneQueue) {
        const fn = doneQueue;
        doneQueue = null;
        fn();
      }
      activeClient = null;
    };

    const getClient = async () => {
      if (activeClient) return activeClient;
      if (imapError) throw imapError;
      if (!sessionPromise) {
        imapSessions += 1;
        let settled = false;
        let resolveReady;
        let rejectReady;
        readyPromise = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
        const closed = new Promise((res) => { doneQueue = res; });
        sessionPromise = Promise.resolve()
          .then(() => deps.withFolder(slug, async (client) => {
            settled = true;
            activeClient = client;
            resolveReady(client);
            await closed;
          }))
          .then(() => {
            if (!settled) {
              const err = new Error("IMAP folder session not opened: " + slug);
              imapError = err;
              rejectReady(err);
            }
          })
          .catch((err) => {
            imapError = err;
            rejectReady(err);
            throw err;
          })
          .finally(() => {
            activeClient = null;
          });
      }
      return readyPromise;
    };

    const fetchWithSession = async (folderSlug, mailUid) => {
      const client = await getClient();
      if (typeof deps.fetchWithClient === "function") {
        return deps.fetchWithClient(client, folderSlug, mailUid);
      }
      return fetchAttachmentsWithClient(client, mailUid, deps.pickParts, deps.drain, opts);
    };

    try {
      for (const ticket of tickets) {
        const ticketRef = db.ref(MAIL_QUEUE_PATH + "/" + ticket.key);
        try {
          const res = await collectSingleMail(
            {
              db,
              getSelfEmail: deps.getSelfEmail,
              pdfExtractor: deps.pdfExtractor,
              authServRe: deps.authServRe,
              fetchAttachments: fetchWithSession
            },
            ticket.slug,
            ticket.uid,
            ticket.msg
          );
          if (res && (res.status === "cooldown_after_error" || res.status === "already_claimed")) {
            continue;
          }
          await ticketRef.set(null);
          processed += 1;
          if (res && res.status === "saved") saved += 1;
        } catch (err) {
          errors += 1;
          const nextAttempts = Number(ticket.attempts || 0) + 1;
          const errText = String((err && err.message) || err).slice(0, 160);
          if (nextAttempts >= MAX_QUEUE_ATTEMPTS) {
            failed += 1;
            await ticketRef.update({
              attempts: nextAttempts,
              st: "failed",
              retryAfter: null,
              failedAt: tsNow,
              lastErr: errText
            }).catch(() => null);
          } else {
            await ticketRef.update({
              attempts: nextAttempts,
              retryAfter: tsNow + ERROR_RETRY_COOLDOWN_MS,
              lastErr: errText
            }).catch(() => null);
          }
        }
      }
    } finally {
      releaseFolderSession();
      if (sessionPromise) await sessionPromise.catch(() => null);
    }
  }

  return {
    processed,
    saved,
    errors,
    failed,
    imapSessions,
    folders: grouped.folderOrder.length
  };
}

module.exports = {
  MAIL_QUEUE_PATH,
  MAX_QUEUE_BATCH,
  MAX_QUEUE_ATTEMPTS,
  MAX_FAILED_QUEUE_AGE_MS,
  MAX_DOC_BYTES,
  MAX_RAW_ATT_BYTES,
  MAX_TOTAL_ATT_BYTES,
  MAX_ATT_COUNT,
  makeMailSeenKey,
  makeMailArchiveId,
  makeMailQueueTicket,
  groupQueueByFolder,
  fetchAttachmentsWithClient,
  isFundCollectableFolder,
  isDedicatedFundFolder,
  isSensitiveIdentityDoc,
  isAuthResultsPass,
  maskPiiText,
  classifyFundMailDoc,
  mapSdcKindToDocIds,
  inferArchiveYear,
  buildFundDirectory,
  matchFundFromMail,
  extractZipEntries,
  extractDocTextSample,
  buildAutoSaveUpdates,
  collectSingleMail,
  drainFundMailQueueBatch
};
