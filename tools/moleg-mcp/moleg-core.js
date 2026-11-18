"use strict";
/* 법제처 국가법령정보센터(law.go.kr) 및 대한민국 전 행정심판·특별심판·위원회 재결례 통합 MCP 코어 엔진
 *
 * 특징:
 * - 판례·헌재·행정심판·특별행정심판·위원회결정·유권해석·자치법규·행정규칙은 대한민국 법제처 공식 원문(https://www.law.go.kr)과 직접 통신한다.
 * - 현행 국가법령(5,773편) 조문은 LAW_OC 설정 시 법제처 DRF Open API(law.go.kr)를 우선 조회하고, 미설정 또는 점검 시 P박스와 동일한 국가법령 공개 미러(legalize-kr)를 사용한다.
 * - 모든 외부 HTTP 요청에 HTTPS 강제·AbortController 제한시간·스트리밍 응답 바이트 상한을 적용하며, 질의어·응답 개인정보 비식별화를 수행한다.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function resolveModulePath(relCandidates) {
  for (const rel of relCandidates) {
    const abs = path.resolve(__dirname, rel);
    if (fs.existsSync(abs)) return abs;
  }
  throw new Error("Required module not found: " + relCandidates.join(" | "));
}

const PBoxSync = require(resolveModulePath([
  "./lib/pbox-sync.js",
  "../../functions/pbox-sync.js"
]));
const Engine = require(resolveModulePath([
  "./lib/pu-pbox-engine.js",
  "../../js/pu-pbox-engine.js"
]));
const Corpus = require(resolveModulePath([
  "./lib/pu-pbox-corpus.js",
  "../../js/pu-pbox-corpus.js"
]));

let _cachedLawIndex = null;
function getLawIndex() {
  if (_cachedLawIndex) return _cachedLawIndex;
  const idxPath = resolveModulePath([
    "./lib/pu-pbox-lawindex.js",
    "../../js/pu-pbox-lawindex.js"
  ]);
  const ctx = { window: {} };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(idxPath, "utf8"), ctx);
  _cachedLawIndex = ctx.window.PuPBoxLawIndex;
  return _cachedLawIndex;
}

const LAW_DRF_SEARCH_HTTPS = "https://www.law.go.kr/DRF/lawSearch.do";
const LAW_DRF_SERVICE_HTTPS = "https://www.law.go.kr/DRF/lawService.do";
const LEGALIZE_RAW_BASE = "https://raw.githubusercontent.com/legalize-kr/legalize-kr/main/kr/";
const UA = "pureun-moleg-mcp/1.1";
const DEFAULT_HTTP_TIMEOUT_MS = 8500;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function fetchTextBounded(fetchFn, urlStr, opts) {
  const f = fetchFn || fetch;
  const o = opts || {};
  const u = new URL(String(urlStr || ""));
  if (u.protocol !== "https:") {
    throw new Error("보안 정책상 HTTPS 요청만 허용됩니다: " + u.protocol);
  }
  const timeoutMs = Math.max(200, Math.min(Number(o.timeoutMs) || DEFAULT_HTTP_TIMEOUT_MS, 20000));
  const maxBytes = Math.max(4096, Math.min(Number(o.maxBytes) || DEFAULT_MAX_RESPONSE_BYTES, 4 * 1024 * 1024));
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;

  try {
    const work = (async () => {
      const init = { redirect: "error", headers: { "User-Agent": UA } };
      if (ac) init.signal = ac.signal;
      const r = await f(u.toString(), init);
      if (!r) return { ok: false, status: 0, text: "" };
      if (r.url && !String(r.url).startsWith("https://")) {
        throw new Error("비보안 리다이렉트 응답이 차단되었습니다.");
      }
      if (!r.ok) return { ok: false, status: r.status, text: "" };

      const cl = r.headers && typeof r.headers.get === "function" ? Number(r.headers.get("content-length") || 0) : 0;
      if (cl > maxBytes) {
        if (ac) ac.abort();
        throw new Error("응답 크기가 허용 상한(" + maxBytes + "B)을 초과했습니다.");
      }
      if (r.body && typeof r.body.getReader === "function") {
        const reader = r.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
          const step = await reader.read();
          if (step.done) break;
          const buf = step.value instanceof Uint8Array ? Buffer.from(step.value) : Buffer.from(step.value || "");
          total += buf.byteLength;
          if (total > maxBytes) {
            if (ac) ac.abort();
            Promise.resolve().then(() => reader.cancel()).catch(() => {});
            throw new Error("응답 스트림이 허용 상한(" + maxBytes + "B)을 초과했습니다.");
          }
          chunks.push(buf);
        }
        return { ok: true, status: r.status, text: Buffer.concat(chunks).toString("utf8") };
      }
      const txt = String((await r.text()) || "");
      if (Buffer.byteLength(txt, "utf8") > maxBytes) {
        throw new Error("응답 크기가 허용 상한(" + maxBytes + "B)을 초과했습니다.");
      }
      return { ok: true, status: r.status, text: txt };
    })();

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (ac) ac.abort();
        reject(new Error("요청 제한시간(" + timeoutMs + "ms)을 초과했습니다."));
      }, timeoutMs);
      if (timer && typeof timer.unref === "function") timer.unref();
    });

    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeCompact(s) {
  return String(s || "")
    .replace(/[ㆍ·・]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function expandLawAbbrev(rawName) {
  const s = String(rawName || "").trim();
  if (!s) return "";
  const map = (Corpus && Corpus.LAW_ABBREV_MAP) || {};
  if (map[s]) return map[s];
  const noSpace = s.replace(/\s+/g, "");
  if (map[noSpace]) return map[noSpace];
  return s;
}

function listTribunals(env) {
  const e = env || process.env || {};
  const oc = PBoxSync.sanitizeLawOc(e.LAW_OC || e.LAW_GO_KR_OC || "");
  return {
    mode: oc ? "open_api_and_official_ssr" : "keyless_official_ssr",
    hasLawOc: Boolean(oc),
    totalChannels: PBoxSync.TRIBUNAL_TARGETS.length,
    localAdminAppealCommissions: PBoxSync.LOCAL_ADMIN_APPEAL_ORGS,
    groups: PBoxSync.TRIBUNAL_GROUP_MAP,
    presets: PBoxSync.TRIBUNAL_PRESETS,
    tribunals: PBoxSync.TRIBUNAL_TARGETS.map((t) => ({
      id: t.id,
      label: t.label,
      category: t.category,
      openApiTarget: t.ssrOnly ? null : (t.drfTarget || t.target),
      officialSsrSupported: true,
      docType: t.docType
    }))
  };
}

async function searchLaws(args, opts) {
  const a = args || {};
  const o = opts || {};
  const rawQ = String(a.query || "").trim();
  const qCheck = PBoxSync.validateAndScrubOfficialQuery(rawQ, { allowEmpty: true, maxLen: 60 });
  if (!qCheck.ok) {
    throw new Error(qCheck.error);
  }
  const cleanQ = qCheck.query;
  const expandedQ = expandLawAbbrev(cleanQ);
  const cat = String(a.category || "all").trim();
  const limit = Math.max(1, Math.min(Number(a.limit) || 20, 60));

  const lawIdx = getLawIndex();
  const allFamilies = lawIdx.list();
  const qNorm = normalizeCompact(cleanQ);
  const expNorm = normalizeCompact(expandedQ);

  const scored = [];
  for (const fam of allFamilies) {
    if (cat !== "all") {
      if (cat === "priority") {
        if (!fam.priority) continue;
      } else if (fam.cat !== cat) {
        continue;
      }
    }
    if (!qNorm) {
      scored.push({ score: fam.priority ? 100 : 10, fam });
      continue;
    }
    const tNorm = normalizeCompact(fam.title);
    const dNorm = normalizeCompact(fam.dir);
    let score = 0;
    if (tNorm === qNorm || tNorm === expNorm || dNorm === qNorm || dNorm === expNorm) score = 1000;
    else if (tNorm.startsWith(expNorm) || tNorm.startsWith(qNorm)) score = 600;
    else if (tNorm.includes(expNorm) || (qNorm.length >= 2 && tNorm.includes(qNorm))) score = 350;
    else if (fam.dept && normalizeCompact(fam.dept).includes(qNorm)) score = 120;
    if (score > 0) {
      if (fam.priority) score += 40;
      scored.push({ score, fam });
    }
  }

  scored.sort((x, y) => y.score - x.score || x.fam.title.localeCompare(y.fam.title, "ko"));
  const top = scored.slice(0, limit).map(({ fam }) => ({
    title: fam.title,
    dir: fam.dir,
    department: fam.dept || "범부처",
    category: fam.cat,
    priority: Boolean(fam.priority),
    primaryFile: fam.primaryFile,
    availableSubLaws: fam.files,
    officialSearchUrl: "https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=" + encodeURIComponent(fam.title)
  }));

  let connectedLaws = [];
  if (a.includeConnected !== false && cleanQ && typeof Engine.getConnectedLawsFor === "function") {
    connectedLaws = Engine.getConnectedLawsFor(cleanQ, allFamilies).slice(0, 12);
  }

  if (cleanQ && top.length === 0 && Corpus && Array.isArray(Corpus.CONNECTED_LAW_MAP)) {
    const seenDir = new Set();
    for (const grp of Corpus.CONNECTED_LAW_MAP) {
      const hitKw = (grp.keywords || []).some((kw) => cleanQ.includes(kw) || kw.includes(cleanQ));
      if (!hitKw) continue;
      const candNames = [].concat(grp.baseLaws || [], (grp.connectedLaws || []).map((c) => c.law));
      for (const nm of candNames) {
        const famHit = allFamilies.find((f) => normalizeCompact(f.title) === normalizeCompact(nm) || normalizeCompact(f.dir) === normalizeCompact(nm));
        if (famHit && !seenDir.has(famHit.dir)) {
          seenDir.add(famHit.dir);
          top.push({
            title: famHit.title,
            dir: famHit.dir,
            department: famHit.dept || "범부처",
            category: famHit.cat,
            priority: Boolean(famHit.priority),
            primaryFile: famHit.primaryFile,
            availableSubLaws: famHit.files,
            matchedBy: "issue_topic:" + grp.topic,
            officialSearchUrl: "https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=" + encodeURIComponent(famHit.title)
          });
          if (top.length >= limit) break;
        }
      }
      if (top.length >= limit) break;
    }
  }

  /* 로컬 5,773편 색인에 없는 최신 제정 법령이고 LAW_OC가 설정된 경우 법제처 DRF 실시간 목록 조회 보조 */
  let liveDrfHits = [];
  const env = o.env || process.env || {};
  const oc = PBoxSync.sanitizeLawOc(env.LAW_OC || env.LAW_GO_KR_OC || "");
  if (cleanQ && top.length === 0 && oc && o.allowLiveFallback !== false) {
    try {
      const drfUrl = LAW_DRF_SEARCH_HTTPS + "?OC=" + encodeURIComponent(oc) + "&target=law&type=JSON&display=" + Math.min(limit, 10) + "&query=" + encodeURIComponent(cleanQ);
      const r = await fetchTextBounded(o.fetchFn, drfUrl, o);
      if (r.ok) {
        const j = JSON.parse(r.text);
        const root = PBoxSync.extractDrfRootOrThrow(j, "law");
        const arr = Array.isArray(root.law) ? root.law : (root.law ? [root.law] : []);
        liveDrfHits = arr.map((it) => ({
          title: it.법령명한글 || it.법령명 || "",
          lawId: it.법령ID || "",
          mst: it.법령일련번호 || "",
          department: it.소관부처명 || "",
          effectiveDate: it.시행일자 || ""
        })).filter((x) => x.title);
      }
    } catch (_) {}
  }

  return {
    query: cleanQ,
    expandedQuery: expandedQ !== cleanQ ? expandedQ : undefined,
    totalIndexedFamilies: allFamilies.length,
    totalIndexedFiles: lawIdx.TOTAL_FILES,
    matchedCount: scored.length || top.length,
    laws: top,
    connectedLaws,
    liveDrfHits: liveDrfHits.length ? liveDrfHits : undefined
  };
}

function normalizeArticleNo(rawArt) {
  const s = String(rawArt || "").trim();
  if (!s) return "";
  const m = /(?:제\s*)?(\d+)\s*조(?:\s*의\s*(\d+))?/.exec(s) || /^(\d+)(?:[-_](\d+))?$/.exec(s);
  if (!m) return s;
  return "제" + m[1] + "조" + (m[2] ? "의" + m[2] : "");
}

function pickSubLawFile(fam, subType) {
  if (!fam || !Array.isArray(fam.files) || !fam.files.length) return fam ? fam.primaryFile : "법률.md";
  const st = String(subType || "").trim();
  if (!st || st === "법률" || st === "본법") return fam.primaryFile;
  const hit = fam.files.find((f) =>
    f.includes(st) ||
    (st === "대통령령" && f.includes("시행령")) ||
    (st === "부령" && (f.includes("부령") || f.includes("시행규칙")))
  );
  if (hit) return hit.endsWith(".md") ? hit : (hit + ".md");
  throw new Error(fam.title + "에는 요청하신 하위법령 구분(" + st + ")이 수록되어 있지 않습니다. 수록 목록: " + fam.files.join(", "));
}

async function tryFetchLawViaDrf(lawTitle, oc, fetchFn, opts) {
  if (!oc || !lawTitle) return null;
  const searchUrl = LAW_DRF_SEARCH_HTTPS + "?OC=" + encodeURIComponent(oc) + "&target=law&type=JSON&display=10&query=" + encodeURIComponent(lawTitle);
  const sr = await fetchTextBounded(fetchFn, searchUrl, opts);
  if (!sr.ok) return null;
  const sj = JSON.parse(sr.text);
  const sRoot = PBoxSync.extractDrfRootOrThrow(sj, "law");
  const list = Array.isArray(sRoot.law) ? sRoot.law : (sRoot.law ? [sRoot.law] : []);
  const targetNorm = normalizeCompact(lawTitle);
  const exact = list.find((it) => normalizeCompact(it.법령명한글 || it.법령명 || "") === targetNorm);
  if (!exact || (!exact.법령일련번호 && !exact.법령ID)) return null;

  const svcUrl = LAW_DRF_SERVICE_HTTPS + "?OC=" + encodeURIComponent(oc) + "&target=law&type=JSON&" +
    (exact.법령일련번호 ? ("MST=" + encodeURIComponent(String(exact.법령일련번호))) : ("ID=" + encodeURIComponent(String(exact.법령ID))));
  const dr = await fetchTextBounded(fetchFn, svcUrl, opts);
  if (!dr.ok) return null;
  const dj = JSON.parse(dr.text);
  const lawRoot = dj && dj.법령;
  if (!lawRoot || !lawRoot.조문) return null;
  const info = lawRoot.기본정보 || {};
  const rawUnits = lawRoot.조문.조문단위;
  const unitArr = Array.isArray(rawUnits) ? rawUnits : (rawUnits ? [rawUnits] : []);
  const articles = [];
  const flattenContent = (val) => Array.isArray(val)
    ? val.map((x) => String(x || "").trim()).filter(Boolean).join("\n")
    : String(val || "").trim();
  for (const u of unitArr) {
    if (u.조문여부 && String(u.조문여부) !== "조문") continue;
    const joNum = String(u.조문번호 || "").trim();
    const joSub = String(u.조문가지번호 || "").trim();
    if (!joNum) continue;
    const no = "제" + joNum + "조" + (joSub && joSub !== "0" ? ("의" + joSub) : "");
    const heading = String(u.조문제목 || "").trim();
    const parts = [flattenContent(u.조문내용)];
    const hangs = Array.isArray(u.항) ? u.항 : (u.항 ? [u.항] : []);
    for (const h of hangs) {
      const hTxt = flattenContent(h.항내용);
      if (hTxt) parts.push(hTxt);
      const hos = Array.isArray(h.호) ? h.호 : (h.호 ? [h.호] : []);
      for (const ho of hos) {
        const hoTxt = flattenContent(ho.호내용);
        if (hoTxt) parts.push("  " + hoTxt);
      }
    }
    articles.push({ no, heading, text: parts.filter(Boolean).join("\n") });
  }
  if (!articles.length) return null;
  const effRaw = String(info.시행일자 || exact.시행일자 || "").replace(/[^0-9]/g, "");
  const effFmt = effRaw.length === 8 ? (effRaw.slice(0, 4) + "-" + effRaw.slice(4, 6) + "-" + effRaw.slice(6, 8)) : "";
  return {
    channel: "law.go.kr_drf_api",
    title: String(info.법령명_한글 || exact.법령명한글 || lawTitle),
    lawId: String(info.법령ID || exact.법령ID || ""),
    department: String(info.소관부처 || exact.소관부처명 || ""),
    effectiveDate: effFmt,
    sourceUrl: "https://www.law.go.kr/법령/" + encodeURIComponent(String(info.법령명_한글 || lawTitle)),
    articles,
    articleCount: articles.length,
    plainText: articles.map((x) => x.text).join("\n\n")
  };
}

async function getLawArticle(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const oc = PBoxSync.sanitizeLawOc(env.LAW_OC || env.LAW_GO_KR_OC || "");
  const rawName = String(a.lawName || "").trim();
  if (!rawName) throw new Error("조회할 법령명(lawName)을 입력해 주세요.");

  const expanded = expandLawAbbrev(rawName);
  const lawIdx = getLawIndex();
  const families = lawIdx.list();
  const qNorm = normalizeCompact(rawName);
  const expNorm = normalizeCompact(expanded);

  const fam =
    families.find((f) => normalizeCompact(f.title) === expNorm || normalizeCompact(f.dir) === expNorm) ||
    families.find((f) => normalizeCompact(f.title) === qNorm || normalizeCompact(f.dir) === qNorm) ||
    families.find((f) => normalizeCompact(f.title).startsWith(expNorm)) ||
    families.find((f) => normalizeCompact(f.title).includes(expNorm));

  if (!fam) {
    throw new Error("국가법령 색인에서 해당 법령을 찾지 못했습니다: " + rawName);
  }

  const fileName = pickSubLawFile(fam, a.subType);
  const subTitle = a.subType && !/^(?:법률|본법)$/.test(String(a.subType).trim())
    ? (fam.title + " " + (fileName.includes("시행령") ? "시행령" : (fileName.includes("시행규칙") ? "시행규칙" : String(a.subType).trim())))
    : fam.title;
  let parsed = null;
  let dataChannel = "legalize_kr_mirror";

  if (oc) {
    try {
      const drfParsed = await tryFetchLawViaDrf(subTitle, oc, o.fetchFn, o);
      if (drfParsed) {
        parsed = drfParsed;
        dataChannel = drfParsed.channel;
      }
    } catch (_) {}
  }

  if (!parsed) {
    const rawUrl = LEGALIZE_RAW_BASE + encodeURIComponent(fam.dir) + "/" + encodeURIComponent(fileName);
    const r = await fetchTextBounded(o.fetchFn, rawUrl, o);
    if (!r.ok) {
      throw new Error("법령 원문 조회 실패 (HTTP " + (r.status || 0) + "): " + fam.title + " / " + fileName);
    }
    parsed = Engine.parseLawMarkdown(r.text, { dir: fam.dir, fileName, title: subTitle });
  }

  const targetArtNo = normalizeArticleNo(a.articleNo);
  if (targetArtNo) {
    const exact = parsed.articles.find((art) => art.no === targetArtNo);
    const related = parsed.articles.filter((art) =>
      art.no !== targetArtNo && (art.no.startsWith(targetArtNo + "의") || (art.heading && art.heading.includes(String(a.articleNo).trim())))
    ).slice(0, 5);
    if (!exact) {
      return {
        found: false,
        channel: dataChannel,
        title: parsed.title,
        fileName,
        effectiveDate: parsed.effectiveDate,
        effectiveState: parsed.effectiveState,
        requestedArticle: targetArtNo,
        message: parsed.title + " (" + fileName.replace(/\.md$/, "") + ")에서 " + targetArtNo + " 조문을 찾지 못했습니다.",
        availableArticlesSample: parsed.articles.slice(0, 30).map((x) => x.no + (x.heading ? "(" + x.heading + ")" : ""))
      };
    }
    return {
      found: true,
      channel: dataChannel,
      title: parsed.title,
      lawId: parsed.lawId,
      department: parsed.department,
      effectiveDate: parsed.effectiveDate,
      effectiveState: parsed.effectiveState,
      sourceUrl: parsed.sourceUrl,
      subLaws: fam.files,
      article: exact,
      relatedArticles: related
    };
  }

  const maxChars = Math.max(1000, Math.min(Number(a.maxChars) || 12000, 40000));
  return {
    found: true,
    channel: dataChannel,
    title: parsed.title,
    lawId: parsed.lawId,
    department: parsed.department,
    effectiveDate: parsed.effectiveDate,
    effectiveState: parsed.effectiveState,
    sourceUrl: parsed.sourceUrl,
    subLaws: fam.files,
    articleCount: parsed.articleCount,
    articleOutline: parsed.articles.slice(0, 80).map((x) => x.no + (x.heading ? "(" + x.heading + ")" : "")),
    bodyPreview: parsed.plainText.slice(0, maxChars),
    truncated: parsed.plainText.length > maxChars
  };
}

async function searchPrecedents(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const scope = String(a.scope || "all").trim();
  const limit = Math.max(2, Math.min(Number(a.limit) || 8, 20));

  const fromChk = PBoxSync.validateCompactYmdStrict(a.dateFrom, "선고 시작일");
  if (!fromChk.ok) throw new Error(fromChk.error);
  const toChk = PBoxSync.validateCompactYmdStrict(a.dateTo, "선고 종료일");
  if (!toChk.ok) throw new Error(toChk.error);
  if (fromChk.compact && toChk.compact && fromChk.compact > toChk.compact) {
    throw new Error("선고 시작일(" + fromChk.compact + ")이 선고 종료일(" + toChk.compact + ")보다 늦을 수 없습니다.");
  }

  let normCourtFilter = "";
  if (a.court !== undefined && a.court !== null && String(a.court).trim() !== "") {
    const rawCourt = String(a.court).trim();
    const cNorm = PBoxSync.normalizeCourt(rawCourt);
    if (scope === "supreme") {
      if (cNorm !== "대법원") throw new Error("scope=supreme 조회 시 법원명(court)은 대법원만 지정할 수 있습니다.");
      normCourtFilter = "대법원";
    } else if (scope === "constitutional") {
      if (cNorm !== "헌법재판소") throw new Error("scope=constitutional 조회 시 법원명(court)은 헌법재판소만 지정할 수 있습니다.");
      normCourtFilter = "헌법재판소";
    } else if (scope === "lower") {
      const lowerChk = PBoxSync.validateCourtFilterStrict(rawCourt);
      if (!lowerChk.ok) throw new Error(lowerChk.error);
      normCourtFilter = PBoxSync.normalizeCourt(lowerChk.court);
    } else {
      if (cNorm === "대법원" || cNorm === "헌법재판소") {
        normCourtFilter = cNorm;
      } else {
        const anyChk = PBoxSync.validateCourtFilterStrict(rawCourt);
        if (!anyChk.ok) throw new Error(anyChk.error);
        normCourtFilter = PBoxSync.normalizeCourt(anyChk.court);
      }
    }
  }

  if (scope === "lower" && (normCourtFilter || fromChk.compact || toChk.compact)) {
    const resLower = await PBoxSync.pullLowerCourtBundle({
      env,
      fetchFn,
      query: a.query,
      court: a.court,
      dateFrom: a.dateFrom,
      dateTo: a.dateTo,
      display: Math.max(limit, 10),
      detailLimit: limit,
      includeComwel: false,
      skipSupabase: true
    });
    if (!resLower.ok && !resLower.partial) {
      throw new Error(resLower.error || (resLower.errors && resLower.errors[0]) || "하급심 판례 조회에 실패했습니다.");
    }
    const lowerAll = resLower.docs || [];
    const lowerDocs = lowerAll.slice(0, limit);
    return {
      query: a.query,
      scope,
      court: a.court || undefined,
      count: lowerDocs.length,
      totalMatched: lowerAll.length,
      docs: lowerDocs,
      errors: resLower.errors || []
    };
  }

  let targets = ["prec_sc", "prec_lower", "detc"];
  if (scope === "supreme") targets = ["prec_sc"];
  else if (scope === "lower") targets = ["prec_lower"];
  else if (scope === "constitutional") targets = ["detc"];

  const res = await PBoxSync.liveSearchOfficialApis({
    env,
    fetchFn,
    query: a.query,
    targets,
    maxPerTarget: Math.min(Math.max(limit, 5), 12),
    detailLimit: Math.min(limit + 4, 20),
    includeComwel: false,
    skipSupabase: true
  });
  if (!res.ok && !res.partial) {
    throw new Error(res.error || (res.errors && res.errors[0]) || "법제처 판례 실시간 조회에 실패했습니다.");
  }
  const filtered = (res.docs || []).filter((d) => {
    if (normCourtFilter && PBoxSync.normalizeCourt(d.court || "") !== normCourtFilter) return false;
    if (fromChk.compact || toChk.compact) {
      const dc = String(d.decisionDate || "").replace(/[^0-9]/g, "");
      if (dc.length !== 8) return false;
      if (fromChk.compact && dc < fromChk.compact) return false;
      if (toChk.compact && dc > toChk.compact) return false;
    }
    return true;
  });
  const sliced = filtered.slice(0, limit);
  return {
    query: res.query || a.query,
    scope,
    court: normCourtFilter || undefined,
    sourcesHit: res.sourcesHit || [],
    count: sliced.length,
    totalMatched: filtered.length,
    docs: sliced,
    errors: res.errors || []
  };
}

async function searchTribunals(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const limit = Math.max(2, Math.min(Number(a.limit) || 10, 25));

  const res = await PBoxSync.pullTribunalBundle({
    env,
    fetchFn,
    tribunal: a.tribunal || "all",
    preset: a.preset || "all",
    localOrg: a.localOrg || "",
    query: a.query,
    maxPerTarget: Math.min(limit, 10),
    detailLimit: Math.min(Math.max(limit + 8, 24), 36),
    skipSupabase: true
  });
  if (!res.ok && !res.partial) {
    throw new Error(res.error || (res.errors && res.errors[0]) || "심판·재결 실시간 조회에 실패했습니다.");
  }
  const allDocs = res.docs || [];
  const sliced = allDocs.slice(0, limit);
  return {
    tribunal: res.tribunal,
    queries: res.queries,
    sourcesHit: res.sourcesHit || [],
    count: sliced.length,
    totalMatched: allDocs.length,
    docs: sliced,
    errors: res.errors || []
  };
}

async function searchInterpretations(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const src = String(a.source || "all").trim();
  const limit = Math.max(2, Math.min(Number(a.limit) || 10, 20));

  let targets = ["expc", "cgmExpc", "ordc", "baiPvcs"];
  if (src === "moleg") targets = ["expc"];
  else if (src === "ministry") targets = ["cgmExpc"];
  else if (src === "ordinance_opinion") targets = ["ordc"];
  else if (src === "bai") targets = ["baiPvcs"];

  const res = await PBoxSync.liveSearchOfficialApis({
    env,
    fetchFn,
    query: a.query,
    targets,
    maxPerTarget: Math.min(limit, 10),
    detailLimit: Math.min(limit + 4, 20),
    includeComwel: false,
    skipSupabase: true
  });
  if (!res.ok && !res.partial) {
    throw new Error(res.error || (res.errors && res.errors[0]) || "유권해석 실시간 조회에 실패했습니다.");
  }
  const allDocs = res.docs || [];
  const sliced = allDocs.slice(0, limit);
  return {
    query: res.query || a.query,
    source: src,
    sourcesHit: res.sourcesHit || [],
    count: sliced.length,
    totalMatched: allDocs.length,
    docs: sliced,
    errors: res.errors || []
  };
}

async function searchOrdinanceAndAdmrul(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const kind = String(a.kind || "all").trim();
  const limit = Math.max(2, Math.min(Number(a.limit) || 10, 20));

  let targets = ["ordin", "admrul"];
  if (kind === "ordinance") targets = ["ordin"];
  else if (kind === "admrul") targets = ["admrul"];

  const res = await PBoxSync.liveSearchOfficialApis({
    env,
    fetchFn,
    query: a.query,
    targets,
    maxPerTarget: Math.min(limit, 10),
    detailLimit: Math.min(limit + 4, 20),
    includeComwel: false,
    skipSupabase: true
  });
  if (!res.ok && !res.partial) {
    throw new Error(res.error || (res.errors && res.errors[0]) || "자치법규·행정규칙 실시간 조회에 실패했습니다.");
  }
  const allDocs = res.docs || [];
  const sliced = allDocs.slice(0, limit);
  return {
    query: res.query || a.query,
    kind,
    sourcesHit: res.sourcesHit || [],
    count: sliced.length,
    totalMatched: allDocs.length,
    docs: sliced,
    errors: res.errors || []
  };
}

function buildOfficialDetailTarget(args) {
  const a = args || {};
  if (a.officialUrl) {
    const clean = PBoxSync.sanitizeOfficialLawUrl(a.officialUrl);
    if (!clean) {
      throw new Error("허용되지 않은 URL입니다. https://www.law.go.kr/LSW/... 형식의 법제처 공식 원문 URL만 지원합니다.");
    }
    let kind = "decc";
    if (clean.includes("/precInfoP.do")) kind = "prec";
    else if (clean.includes("/detcInfoP.do")) kind = "detc";
    else if (clean.includes("/cgmExpcInfoP.do")) kind = "cgmExpc";
    else if (clean.includes("/expcInfoP.do")) kind = "expc";
    else if (clean.includes("/ordcInfoP.do")) kind = "ordc";
    else if (clean.includes("/ordinInfo")) kind = "ordin";
    else if (clean.includes("/admRul")) kind = "admrul";
    else if (clean.includes("/nlrcInfoP.do")) kind = "nlrc";
    else if (clean.includes("/specialDeccInfoP.do")) kind = "specialDecc";
    else if (clean.includes("/deccInfoP.do")) kind = "decc";
    else if (clean.includes("/baiPvcsInfoP.do")) kind = "baiPvcs";
    else if (/\/(?:ftc|ppc|acr|kcc|fsc|oclt|eiac|iaciac|ecc|nhrck)InfoP\.do/.test(clean)) kind = "decsnDoc";
    const fetchUrl = clean.includes("/admRulLsInfoP.do")
      ? clean.replace("/admRulLsInfoP.do", "/admRulInfoR.do")
      : (clean.includes("/ordinInfoP.do") ? clean.replace("/ordinInfoP.do", "/ordinInfoR.do") : clean);
    return { kind, fetchUrl, officialUrl: clean };
  }

  const rawSeq = String(a.seq == null ? "" : a.seq).trim();
  if (!rawSeq || !/^\d+$/.test(rawSeq)) {
    throw new Error("officialUrl 또는 순수 숫자 형식의 문서 일련번호(seq)를 입력해 주세요.");
  }
  const seq = rawSeq;
  const t = String(a.target || "prec").trim();
  const rawCode = String(a.code == null ? "" : a.code).trim();
  if (rawCode && !/^[A-Za-z0-9_]+$/.test(rawCode)) {
    throw new Error("보조 코드(code) 형식이 올바르지 않습니다.");
  }
  const code = rawCode;
  const base = "https://www.law.go.kr/LSW/";

  switch (t) {
    case "prec": return { kind: "prec", fetchUrl: base + "precInfoP.do?precSeq=" + seq, officialUrl: base + "precInfoP.do?precSeq=" + seq };
    case "detc": return { kind: "detc", fetchUrl: base + "detcInfoP.do?detcSeq=" + seq, officialUrl: base + "detcInfoP.do?detcSeq=" + seq };
    case "decc": return { kind: "decc", fetchUrl: base + "deccInfoP.do?deccSeq=" + seq, officialUrl: base + "deccInfoP.do?deccSeq=" + seq };
    case "specialDecc": return { kind: "specialDecc", fetchUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=" + (code || "360101"), officialUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=" + (code || "360101") };
    case "tt": return { kind: "specialDecc", fetchUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360101", officialUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360101" };
    case "kmst": return { kind: "specialDecc", fetchUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360103", officialUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360103" };
    case "adap": return { kind: "specialDecc", fetchUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360106", officialUrl: base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360106" };
    case "nlrc": return { kind: "nlrc", fetchUrl: base + "nlrcInfoP.do?nlrcSeq=" + seq + "&cmtClsCd=" + (code || "460110"), officialUrl: base + "nlrcInfoP.do?nlrcSeq=" + seq + "&cmtClsCd=" + (code || "460110") };
    case "iaciac": return { kind: "decsnDoc", fetchUrl: base + "iaciacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460108", officialUrl: base + "iaciacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460108" };
    case "eiac": return { kind: "decsnDoc", fetchUrl: base + "eiacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460107", officialUrl: base + "eiacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460107" };
    case "ftc": return { kind: "decsnDoc", fetchUrl: base + "ftcInfoP.do?ftcSeq=" + seq + "&cmtClsCd=460101", officialUrl: base + "ftcInfoP.do?ftcSeq=" + seq + "&cmtClsCd=460101" };
    case "ppc": return { kind: "decsnDoc", fetchUrl: base + "ppcInfoP.do?ppcSeq=" + seq + "&cmtClsCd=460102", officialUrl: base + "ppcInfoP.do?ppcSeq=" + seq + "&cmtClsCd=460102" };
    case "acr": return { kind: "decsnDoc", fetchUrl: base + "acrInfoP.do?acrSeq=" + seq + "&cmtClsCd=460103", officialUrl: base + "acrInfoP.do?acrSeq=" + seq + "&cmtClsCd=460103" };
    case "nhrck": return { kind: "decsnDoc", fetchUrl: base + "nhrckInfoP.do?nhrckSeq=" + seq + "&cmtClsCd=460111", officialUrl: base + "nhrckInfoP.do?nhrckSeq=" + seq + "&cmtClsCd=460111" };
    case "oclt": return { kind: "decsnDoc", fetchUrl: base + "ocltInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460106", officialUrl: base + "ocltInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460106" };
    case "ecc": return { kind: "decsnDoc", fetchUrl: base + "eccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460109", officialUrl: base + "eccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460109" };
    case "fsc": return { kind: "decsnDoc", fetchUrl: base + "fscInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460105", officialUrl: base + "fscInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460105" };
    case "kcc": return { kind: "decsnDoc", fetchUrl: base + "kccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460104", officialUrl: base + "kccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460104" };
    case "expc": return { kind: "expc", fetchUrl: base + "expcInfoP.do?expcSeq=" + seq, officialUrl: base + "expcInfoP.do?expcSeq=" + seq };
    case "cgmExpc": return { kind: "cgmExpc", fetchUrl: base + "cgmExpcInfoP.do?cgmExpcDatSeq=" + seq + (code ? "&ofiClsCd=" + code : ""), officialUrl: base + "cgmExpcInfoP.do?cgmExpcDatSeq=" + seq + (code ? "&ofiClsCd=" + code : "") };
    case "ordc": return { kind: "ordc", fetchUrl: base + "ordcInfoP.do?ordcSeq=" + seq, officialUrl: base + "ordcInfoP.do?ordcSeq=" + seq };
    case "ordin": return { kind: "ordin", fetchUrl: base + "ordinInfoR.do?ordinSeq=" + seq + (code ? "&gubun=" + code : "&gubun=ELIS"), officialUrl: base + "ordinInfoP.do?ordinSeq=" + seq + (code ? "&gubun=" + code : "&gubun=ELIS") };
    case "admrul": return { kind: "admrul", fetchUrl: base + "admRulInfoR.do?admRulSeq=" + seq, officialUrl: base + "admRulLsInfoP.do?admRulSeq=" + seq };
    case "baiPvcs": return { kind: "baiPvcs", fetchUrl: base + "baiPvcsInfoP.do?baiPvcsDatSeq=" + seq, officialUrl: base + "baiPvcsInfoP.do?baiPvcsDatSeq=" + seq };
    default:
      throw new Error("지원하지 않는 target 코드입니다: " + t);
  }
}

async function getOfficialDocument(args, opts) {
  const o = opts || {};
  const info = buildOfficialDetailTarget(args);
  const r = await fetchTextBounded(o.fetchFn, info.fetchUrl, o);
  if (!r.ok) {
    throw new Error("법제처 공식 원문 상세 조회 실패 (HTTP " + (r.status || 0) + ")");
  }
  const maxChars = Math.max(1000, Math.min(Number(args && args.maxChars) || 15000, 40000));
  const parsed = PBoxSync.parseLawGoKrSsrDetailHtml(info.kind, r.text, {
    seq: args && args.seq ? String(args.seq) : "",
    officialUrl: info.officialUrl,
    maxBodyChars: maxChars
  });
  if (!parsed) {
    throw new Error("법제처 원문 페이지에서 유효한 본문을 추출하지 못했습니다.");
  }
  const scrubbed = PBoxSync.scrubDocumentObjectServer(parsed);
  if (PBoxSync.hasResidualHardPii(scrubbed)) {
    throw new Error("원문 내 잔존 개인정보가 감지되어 반환을 보류했습니다.");
  }
  return scrubbed;
}

async function unifiedSearch(args, opts) {
  const a = args || {};
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const limitPer = Math.max(2, Math.min(Number(a.limitPerCategory) || 4, 8));

  const qCheck = PBoxSync.validateAndScrubOfficialQuery(a.query, { allowEmpty: false, maxLen: 50 });
  if (!qCheck.ok) {
    throw new Error(qCheck.error);
  }

  const [lawRes, liveRes] = await Promise.all([
    searchLaws({ query: qCheck.query, limit: limitPer, includeConnected: true }, { fetchFn, env, allowLiveFallback: false }),
    PBoxSync.liveSearchOfficialApis({
      env,
      fetchFn,
      query: qCheck.query,
      targets: ["prec_sc", "prec_lower", "detc", "decc_acrc", "nlrc", "iaciac", "adap", "cgmExpc", "expc"],
      maxPerTarget: limitPer,
      detailLimit: Math.min(Math.max(18, limitPer * 5), 36),
      includeComwel: false,
      skipSupabase: true
    })
  ]);

  if (!liveRes.ok && !liveRes.partial) {
    throw new Error(liveRes.error || (liveRes.errors && liveRes.errors[0]) || "법제처 통합 조회에 실패했습니다.");
  }

  const docs = liveRes.docs || [];
  return {
    query: qCheck.query,
    statutes: lawRes.laws,
    connectedLaws: lawRes.connectedLaws,
    precedents: docs.filter((d) => d.docType === "prec_sc" || d.docType === "prec_lower").slice(0, limitPer * 2),
    tribunals: docs.filter((d) => d.docType === "dec_nlrc").slice(0, limitPer * 2),
    interpretations: docs.filter((d) => d.docType === "interp_moel" || d.docType === "interp_gov").slice(0, limitPer * 2),
    sourcesHit: liveRes.sourcesHit || [],
    errors: liveRes.errors || []
  };
}

module.exports = {
  fetchTextBounded,
  listTribunals,
  searchLaws,
  getLawArticle,
  searchPrecedents,
  searchTribunals,
  searchInterpretations,
  searchOrdinanceAndAdmrul,
  getOfficialDocument,
  unifiedSearch
};
