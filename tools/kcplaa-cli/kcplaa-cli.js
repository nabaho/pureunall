#!/usr/bin/env node
"use strict";
/* 한국공인노무사회(ilabor.co.kr + kcplaa.or.kr) CLI 수집 · 직접 검색 · P박스 연동 도구
 *
 * 사용 예시:
 *   kcplaa-pbox channels
 *   kcplaa-pbox today
 *   kcplaa-pbox search "통상임금"
 *   kcplaa-pbox search "포괄임금" --channel moel
 *   kcplaa-pbox pull --channel all --limit 20
 *   kcplaa-pbox pull --query "산재" --export ./kcplaa-sanjae.json
 *
 * 회원 상세 원문 연동(선택 — 코드·저장소에 자격증명을 절대 저장하지 않음):
 *   환경변수 ILABOR_ID / ILABOR_PW (또는 ILABOR_COOKIE / KCPLAA_COOKIE) 설정 후 실행하거나
 *   `kcplaa-pbox pull --login` 대화형 프롬프트 사용
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

function resolveSharedModule(relCandidates) {
  for (const rel of relCandidates) {
    const abs = path.resolve(__dirname, rel);
    if (fs.existsSync(abs)) return abs;
  }
  throw new Error("필수 공유 모듈을 찾을 수 없습니다: " + relCandidates.join(" | "));
}

const PBoxSync = require(resolveSharedModule([
  "../../functions/pbox-sync.js",
  "./lib/pbox-sync.js"
]));
const Engine = require(resolveSharedModule([
  "../../js/pu-pbox-engine.js",
  "./lib/pu-pbox-engine.js"
]));

const PBOX_API_HTTPS = "https://asia-northeast3-pureun-erp.cloudfunctions.net/pboxApi";
const RESERVED_JSON_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "jsconfig.json",
  "firebase.json",
  "manifest.json",
  "composer.json",
  "vercel.json",
  "settings.json",
  "launch.json",
  "tasks.json",
  "devcontainer.json"
]);

function stripTerminalControlChars(str) {
  return String(str || "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertTargetNotSymlink(targetAbs) {
  try {
    const st = fs.lstatSync(targetAbs);
    if (st.isSymbolicLink()) {
      throw new Error("심볼릭 링크 대상 파일에는 기록할 수 없습니다: " + targetAbs);
    }
  } catch (e) {
    if (e && e.code !== "ENOENT") throw e;
  }
}

function isProtectedConfigFilename(baseLower) {
  return baseLower.startsWith(".") || RESERVED_JSON_FILENAMES.has(baseLower);
}

/* 참고: Windows 환경에서는 POSIX mode(0o700/0o600) 대신 사용자 프로필(%USERPROFILE%) 기본 ACL로 격리됩니다. */
function defaultCachePath(env) {
  const e = env || process.env || {};
  if (e.KCPLAA_PBOX_CACHE && String(e.KCPLAA_PBOX_CACHE).trim()) {
    const raw = String(e.KCPLAA_PBOX_CACHE).trim();
    if (raw.includes("\0")) throw new Error("KCPLAA_PBOX_CACHE 경로가 올바르지 않습니다.");
    const abs = path.resolve(raw);
    const baseLower = path.basename(abs).toLowerCase();
    if (path.extname(abs).toLowerCase() !== ".json") {
      throw new Error("KCPLAA_PBOX_CACHE 경로는 .json 확장자여야 합니다: " + abs);
    }
    const norm = abs.replace(/\\/g, "/").toLowerCase();
    if (norm.includes("/.git/") || norm.endsWith("/.git") || norm.includes("/node_modules/") || isProtectedConfigFilename(baseLower)) {
      throw new Error("KCPLAA_PBOX_CACHE로 시스템·예약 설정 파일을 지정할 수 없습니다: " + abs);
    }
    assertTargetNotSymlink(abs);
    return abs;
  }
  const fallback = path.join(os.homedir(), ".pureun-pbox", "kcplaa-corpus.json");
  assertTargetNotSymlink(fallback);
  return fallback;
}

function memberVaultPathFor(cacheFile) {
  const dir = path.dirname(cacheFile);
  const stem = path.basename(cacheFile, path.extname(cacheFile));
  return path.join(dir, stem + ".member-vault.json");
}

function readLocalCorpus(cacheFile) {
  try {
    if (!fs.existsSync(cacheFile)) {
      return { version: 1, updatedAt: "", docs: [] };
    }
    const raw = fs.readFileSync(cacheFile, "utf8");
    if (!raw.trim()) return { version: 1, updatedAt: "", docs: [] };
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      updatedAt: String((parsed && parsed.updatedAt) || ""),
      docs: Array.isArray(parsed && parsed.docs) ? parsed.docs : []
    };
  } catch (_) {
    return { version: 1, updatedAt: "", docs: [] };
  }
}

function readMemberVault(cacheFile) {
  const vaultFile = memberVaultPathFor(cacheFile);
  try {
    if (!fs.existsSync(vaultFile)) return [];
    const raw = fs.readFileSync(vaultFile, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.memberDocs)) return [];
    return parsed.memberDocs.map((d) => Object.assign({}, d, { memberOnly: true }));
  } catch (_) {
    return [];
  }
}

function writeLocalCorpus(cacheFile, docs) {
  assertTargetNotSymlink(cacheFile);
  const dir = path.dirname(cacheFile);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const publicOnly = (Array.isArray(docs) ? docs : []).filter((d) => d && !Engine.isMemberRestrictedDoc(d)).slice(0, 5000);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    docs: publicOnly
  };
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
  return payload;
}

function writeMemberVault(cacheFile, memberDocs) {
  const vaultFile = memberVaultPathFor(cacheFile);
  assertTargetNotSymlink(vaultFile);
  const dir = path.dirname(vaultFile);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const payload = {
    version: 1,
    source: "kcplaa-pbox-member-vault",
    memberVault: true,
    updatedAt: new Date().toISOString(),
    memberDocs: (Array.isArray(memberDocs) ? memberDocs : []).map((d) => Object.assign({}, d, { memberOnly: true })).slice(0, 5000)
  };
  fs.writeFileSync(vaultFile, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
  return payload;
}

function mergeIntoLocalCorpus(cacheFile, incomingDocs) {
  const list = Array.isArray(incomingDocs) ? incomingDocs : [];
  const pubIncoming = list.filter((d) => d && !Engine.isMemberRestrictedDoc(d));
  const memIncoming = list.filter((d) => d && Engine.isMemberRestrictedDoc(d));

  let added = 0;
  let merged = 0;
  const prevPub = readLocalCorpus(cacheFile).docs;
  let finalPubCount = prevPub.length;
  if (pubIncoming.length > 0) {
    const resPub = Engine.deduplicateDocs(prevPub, pubIncoming);
    const savedPub = writeLocalCorpus(cacheFile, resPub.docs);
    finalPubCount = savedPub.docs.length;
    added += resPub.stats.added;
    merged += resPub.stats.mergedStage1 + resPub.stats.mergedStage2 + resPub.stats.mergedStage3;
  }

  const prevMem = readMemberVault(cacheFile);
  let finalMemCount = prevMem.length;
  if (memIncoming.length > 0) {
    const resMem = Engine.deduplicateDocs(prevMem, memIncoming);
    const savedMem = writeMemberVault(cacheFile, resMem.docs);
    finalMemCount = savedMem.memberDocs.length;
    added += resMem.stats.added;
    merged += resMem.stats.mergedStage1 + resMem.stats.mergedStage2 + resMem.stats.mergedStage3;
  }

  return {
    totalStored: finalPubCount + finalMemCount,
    added,
    merged
  };
}

function validateSafeExportPath(rawPath, opts) {
  const o = opts || {};
  const s = String(rawPath || "").trim();
  if (!s) throw new Error("--export 파일 경로를 지정해 주세요.");
  if (s.includes("\0")) throw new Error("유효하지 않은 파일 경로입니다.");
  const abs = path.resolve(s);
  if (path.extname(abs).toLowerCase() !== ".json") {
    throw new Error("보안을 위해 .json 확장자 파일로만 내보낼 수 있습니다: " + abs);
  }
  const baseLower = path.basename(abs).toLowerCase();
  if (isProtectedConfigFilename(baseLower)) {
    throw new Error("프로젝트 예약·설정 파일(" + baseLower + ")은 덮어쓸 수 없습니다.");
  }
  const normalized = abs.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/.git/") || normalized.endsWith("/.git") || normalized.includes("/node_modules/")) {
    throw new Error(".git 또는 node_modules 내부 경로에는 내보낼 수 없습니다.");
  }
  assertTargetNotSymlink(abs);
  if (fs.existsSync(abs) && !o.force) {
    throw new Error("기존 파일을 보호하기 위해 덮어쓰기를 중단했습니다(새 파일명을 지정하거나 --force 옵션 사용): " + abs);
  }
  return abs;
}

function writeExportJsonAtomic(exportFile, payloadObj, forceOverwrite) {
  assertTargetNotSymlink(exportFile);
  fs.mkdirSync(path.dirname(exportFile), { recursive: true });
  const openFlags = forceOverwrite ? "w" : "wx";
  let fd = -1;
  try {
    fd = fs.openSync(exportFile, openFlags, 0o600);
    fs.writeFileSync(fd, JSON.stringify(payloadObj, null, 2), "utf8");
  } catch (e) {
    if (e && e.code === "EEXIST") {
      throw new Error("기존 파일을 보호하기 위해 덮어쓰기를 중단했습니다(새 파일명을 지정하거나 --force 옵션 사용): " + exportFile);
    }
    throw e;
  } finally {
    if (fd >= 0) {
      try { fs.closeSync(fd); } catch (_) {}
    }
  }
}

function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const out = {
    command: "",
    positionals: [],
    channel: "",
    query: "",
    limit: 15,
    exportPath: "",
    force: false,
    push: false,
    offline: false,
    login: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const a = String(args[i] || "");
    if (a === "--pw" || a === "--password" || a.startsWith("--pw=") || a.startsWith("--password=")) {
      throw new Error("보안 정책상 비밀번호를 명령줄 인자(--pw)로 직접 전달할 수 없습니다. --login 대화형 입력(권장) 또는 일회성 환경변수 ILABOR_ID / ILABOR_PW를 사용하세요.");
    }
    if (a === "-h" || a === "--help" || a === "help") {
      out.help = true;
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--force") {
      out.force = true;
    } else if (a === "--push") {
      out.push = true;
    } else if (a === "--offline") {
      out.offline = true;
    } else if (a === "--login") {
      out.login = true;
    } else if (a === "--channel" || a === "-c") {
      out.channel = String(args[++i] || "").trim();
    } else if (a.startsWith("--channel=")) {
      out.channel = a.slice("--channel=".length).trim();
    } else if (a === "--query" || a === "-q") {
      out.query = String(args[++i] || "").trim();
    } else if (a.startsWith("--query=")) {
      out.query = a.slice("--query=".length).trim();
    } else if (a === "--limit" || a === "-n") {
      out.limit = Math.max(1, Math.min(Number(args[++i]) || 15, 50));
    } else if (a.startsWith("--limit=")) {
      out.limit = Math.max(1, Math.min(Number(a.slice("--limit=".length)) || 15, 50));
    } else if (a === "--export" || a === "-o") {
      out.exportPath = String(args[++i] || "").trim();
    } else if (a.startsWith("--export=")) {
      out.exportPath = a.slice("--export=".length).trim();
    } else if (a.startsWith("-")) {
      throw new Error("알 수 없는 옵션입니다: " + a);
    } else if (!out.command) {
      out.command = a.toLowerCase();
    } else {
      out.positionals.push(a);
    }
  }

  if (!out.query && out.positionals.length > 0) {
    out.query = out.positionals.join(" ").trim();
  }
  return out;
}

function promptInteractiveCredentials() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("--login 대화형 입력은 터미널(TTY)에서만 사용할 수 있습니다. 비대화형 환경에서는 ILABOR_ID / ILABOR_PW 환경변수를 사용하세요."));
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question("한국공인노무사회(ilabor) 회원 ID: ", (idAns) => {
      rl.close();
      process.stderr.write("한국공인노무사회(ilabor) 비밀번호: ");
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (typeof stdin.setRawMode === "function") stdin.setRawMode(true);
      stdin.resume();
      let pw = "";
      const onData = (buf) => {
        const str = buf.toString("utf8");
        for (const ch of str) {
          if (ch === "\r" || ch === "\n" || ch === "\u0004") {
            stdin.removeListener("data", onData);
            if (typeof stdin.setRawMode === "function") stdin.setRawMode(Boolean(wasRaw));
            stdin.pause();
            process.stderr.write("\n");
            resolve({ memberId: String(idAns || "").trim(), memberPw: pw });
            return;
          }
          if (ch === "\u0003") {
            stdin.removeListener("data", onData);
            if (typeof stdin.setRawMode === "function") stdin.setRawMode(Boolean(wasRaw));
            stdin.pause();
            process.stderr.write("\n");
            reject(new Error("사용자 취소"));
            return;
          }
          if (ch === "\u007f" || ch === "\b") {
            pw = pw.slice(0, -1);
          } else if (ch >= " ") {
            pw += ch;
          }
        }
      };
      stdin.on("data", onData);
    });
  });
}

async function resolveCliMemberCookies(parsedArgs, runtimeOpts) {
  const o = runtimeOpts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  let ilaborCookie = String(env.ILABOR_COOKIE || "").trim();
  const kcplaaCookie = String(env.KCPLAA_COOKIE || "").trim();

  if (!ilaborCookie && (parsedArgs.login || (env.ILABOR_ID && env.ILABOR_PW))) {
    const envPw = String(env.ILABOR_PW || "");
    /* 자식 프로세스 유출 방지를 위해 환경변수 테이블에서 ILABOR_PW 엔트리만 즉시 제거 */
    if (!parsedArgs.login && env.ILABOR_PW) {
      try { delete env.ILABOR_PW; } catch (_) {}
    }
    const creds = parsedArgs.login
      ? await promptInteractiveCredentials()
      : { memberId: String(env.ILABOR_ID).trim(), memberPw: envPw };
    const loginRes = await PBoxSync.loginIlaborMemberCli({
      fetchFn,
      memberId: creds.memberId,
      memberPw: creds.memberPw
    });
    if (!loginRes.ok) {
      throw new Error(loginRes.error || "한국공인노무사회(ilabor) 회원 인증에 실패했습니다.");
    }
    ilaborCookie = loginRes.cookie;
  }
  return { ilaborCookie, kcplaaCookie };
}

async function pushDocsToPboxServer(docs, staffToken, fetchFn) {
  const tok = String(staffToken || "").trim();
  if (!tok) {
    throw new Error("--push 옵션을 사용하려면 PBOX_STAFF_TOKEN 환경변수(포털 직원 Firebase ID 토큰)가 필요합니다. 또는 --export <파일.json>으로 내보내 P박스에서 복원하세요.");
  }
  const safePublicDocs = (Array.isArray(docs) ? docs : []).filter((d) => d && !Engine.isMemberRestrictedDoc(d));
  if (!safePublicDocs.length) {
    throw new Error("회원 전용 로그인 세션으로 수집된 원문(memberOnly)은 저작권·접근통제 보호를 위해 전 직원 공유 DB(--push)에 업로드할 수 없습니다.");
  }
  const f = fetchFn || fetch;
  const batches = [];
  for (let i = 0; i < safePublicDocs.length; i += 40) {
    batches.push(safePublicDocs.slice(i, i + 40));
  }
  let totalPushed = 0;
  for (const batch of batches) {
    const r = await f(PBOX_API_HTTPS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tok
      },
      body: JSON.stringify({ action: "push", docs: batch })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.ok === false) {
      throw new Error((j && j.error) || ("P박스 공유 서버 업로드 실패 (HTTP " + r.status + ")"));
    }
    totalPushed += Number(j.pushed || 0);
  }
  return totalPushed;
}

function formatUsageText() {
  return [
    "🏛️ 한국공인노무사회(ilabor.co.kr · kcplaa.or.kr) P박스 CLI 연동 도구 (kcplaa-pbox)",
    "",
    "사용법:",
    "  kcplaa-pbox channels                           지원하는 15개 노무사회 채널 및 로컬 색인 현황 보기",
    "  kcplaa-pbox today [--json]                     ilabor 오늘의 자료 · 노사정뉴스 · 본회 최신 공지 즉시 당겨오기",
    "  kcplaa-pbox search <검색어> [--channel <채널>] 로컬 색인 + 실시간 노무사회 전 채널 직접 검색",
    "  kcplaa-pbox pull [--channel <채널>] [--query <어구>] [--limit <N>] [--export <파일.json>] [--push]",
    "",
    "선택 옵션:",
    "  --channel, -c   all | today | moel | comwel | nlrc | press | prec | decc | interp | guide | news | focus | forms_rules | kcplaa_notice",
    "  --offline       네트워크 호출 없이 로컬에 당겨온 한국공인노무사회 색인만 초고속 검색",
    "  --export, -o    수집된 문서를 P박스 백업 호환 JSON 파일(.json)로 저장",
    "  --login         한국공인노무사회(ilabor) 회원 계정 대화형 인증(상세 원문 전체 수집 시)",
    "  --json          자동화·파이프라인용 JSON 출력"
  ].join("\n");
}

function formatDocsHuman(docs, headerLine) {
  const lines = [stripTerminalControlChars(headerLine), "─".repeat(72)];
  if (!docs.length) {
    lines.push("일치하는 한국공인노무사회 수록 자료가 없습니다.");
    return lines.join("\n");
  }
  docs.forEach((d, idx) => {
    const meta = [d.agency || d.court || "한국공인노무사회", d.caseNo || "", d.decisionDate || ""]
      .map(stripTerminalControlChars)
      .filter(Boolean)
      .join(" · ");
    lines.push((idx + 1) + ". [" + meta + "] " + stripTerminalControlChars(d.title));
    if (d.summary && d.summary !== d.title) {
      lines.push("   요지: " + stripTerminalControlChars(String(d.summary).replace(/\s+/g, " ").slice(0, 180)));
    }
    if (d.officialUrl) {
      lines.push("   원문: " + stripTerminalControlChars(d.officialUrl));
    }
  });
  return lines.join("\n");
}

async function runCli(argv, runtimeOpts) {
  const opts = runtimeOpts || {};
  const env = opts.env || process.env || {};
  const fetchFn = opts.fetchFn || fetch;
  const writeOut = opts.stdout || ((s) => process.stdout.write(s + "\n"));
  const cacheFile = opts.cacheFile || defaultCachePath(env);

  const parsed = parseCliArgs(argv);
  if (parsed.help || !parsed.command) {
    writeOut(formatUsageText());
    return { ok: true, command: "help" };
  }

  if (parsed.command === "channels") {
    const local = readLocalCorpus(cacheFile);
    const memberDocs = readMemberVault(cacheFile);
    const totalCount = local.docs.length + memberDocs.length;
    const payload = {
      ok: true,
      cacheFile,
      localCachedCount: totalCount,
      updatedAt: local.updatedAt,
      channels: PBoxSync.KCPLAA_ILABOR_CHANNELS,
      groups: PBoxSync.KCPLAA_CHANNEL_GROUPS
    };
    if (parsed.json) {
      writeOut(JSON.stringify(payload, null, 2));
    } else {
      const lines = [
        "🏛️ 한국공인노무사회(ilabor.co.kr · kcplaa.or.kr) 연동 채널 (" + PBoxSync.KCPLAA_ILABOR_CHANNELS.length + "개)",
        "• 로컬 색인 경로: " + cacheFile + " (보관 " + totalCount + "건" + (local.updatedAt ? ", 최근 갱신 " + local.updatedAt : "") + ")",
        "─".repeat(72)
      ];
      for (const ch of PBoxSync.KCPLAA_ILABOR_CHANNELS) {
        lines.push("  - " + ch.id.padEnd(15, " ") + " : " + ch.label + (ch.cliOnly ? " [회원세션 전용]" : ""));
      }
      writeOut(lines.join("\n"));
    }
    return payload;
  }

  if (parsed.command === "today" || parsed.command === "pull") {
    const targetChannel = parsed.command === "today"
      ? "daily_digest"
      : (parsed.channel || (parsed.query ? "search_fast" : "all"));
    const cookies = await resolveCliMemberCookies(parsed, { env, fetchFn });
    const hasMemberAuth = Boolean(cookies.ilaborCookie || cookies.kcplaaCookie);
    if ((parsed.push || parsed.exportPath) && hasMemberAuth) {
      throw new Error("회원 전용 로그인 세션(--login 또는 ILABOR_COOKIE/KCPLAA_COOKIE)으로 수집한 원문은 저작권·접근통제 보호를 위해 외부 내보내기(--export)나 전 직원 공유 DB 업로드(--push)를 할 수 없습니다. 로컬 검색(kcplaa-pbox search)으로만 활용하거나 비로그인 공개 모드로 실행하세요.");
    }
    let exportedFile = "";
    if (parsed.exportPath) {
      exportedFile = validateSafeExportPath(parsed.exportPath, { force: parsed.force });
    }
    const pullRes = await PBoxSync.pullKcplaaIlaborBundle({
      env,
      fetchFn,
      channel: targetChannel,
      query: parsed.query,
      maxPerChannel: parsed.limit,
      detailLimit: Math.min(parsed.limit, 12),
      allowCliSession: true,
      ilaborCookie: cookies.ilaborCookie,
      kcplaaCookie: cookies.kcplaaCookie,
      skipSupabase: true
    });
    if (!pullRes.ok && !pullRes.partial) {
      throw new Error(pullRes.error || "한국공인노무사회 자료 당겨오기에 실패했습니다.");
    }
    const mergedStats = mergeIntoLocalCorpus(cacheFile, pullRes.docs);
    if (exportedFile) {
      const exportableDocs = pullRes.docs.filter((d) => d && !Engine.isMemberRestrictedDoc(d));
      writeExportJsonAtomic(exportedFile, {
        exportedAt: new Date().toISOString(),
        source: "kcplaa-pbox-cli",
        excludedMemberOnlyCount: pullRes.docs.length - exportableDocs.length,
        docs: exportableDocs
      }, parsed.force);
    }
    let pushedServerCount = 0;
    if (parsed.push && pullRes.docs.length > 0) {
      const pushableDocs = pullRes.docs.filter((d) => d && !Engine.isMemberRestrictedDoc(d));
      pushedServerCount = await pushDocsToPboxServer(pushableDocs, env.PBOX_STAFF_TOKEN, fetchFn);
    }
    const outPayload = {
      ok: true,
      command: parsed.command,
      channel: targetChannel,
      query: parsed.query || "",
      authenticatedMember: pullRes.authenticatedMember,
      pulledCount: pullRes.docs.length,
      localAdded: mergedStats.added,
      localMerged: mergedStats.merged,
      totalLocalDocs: mergedStats.totalStored,
      exportedFile: exportedFile || undefined,
      pushedServerCount: parsed.push ? pushedServerCount : undefined,
      sourcesHit: pullRes.sourcesHit,
      docs: pullRes.docs.slice(0, parsed.limit)
    };
    if (parsed.json) {
      writeOut(JSON.stringify(outPayload, null, 2));
    } else {
      const hdr = "✓ 한국공인노무사회 자료 당겨오기 완료: 수신 " + pullRes.docs.length +
        "건 (신규 색인 " + mergedStats.added + "건 · 병합 " + mergedStats.merged +
        "건 · 누적 " + mergedStats.totalStored + "건)" +
        (exportedFile ? (" · 내보내기: " + exportedFile) : "") +
        (parsed.push ? (" · 공유DB 업로드: " + pushedServerCount + "건") : "");
      writeOut(formatDocsHuman(outPayload.docs, hdr));
    }
    return outPayload;
  }

  if (parsed.command === "search") {
    if (!parsed.query) {
      throw new Error("검색어를 입력해 주세요. 예: kcplaa-pbox search \"통상임금\"");
    }
    let liveSourcesHit = [];
    if (!parsed.offline) {
      const cookies = await resolveCliMemberCookies(parsed, { env, fetchFn });
      const liveRes = await PBoxSync.pullKcplaaIlaborBundle({
        env,
        fetchFn,
        channel: parsed.channel || "search_fast",
        query: parsed.query,
        maxPerChannel: Math.min(parsed.limit, 12),
        detailLimit: 6,
        allowCliSession: true,
        ilaborCookie: cookies.ilaborCookie,
        kcplaaCookie: cookies.kcplaaCookie,
        skipSupabase: true
      }).catch(() => ({ ok: false, docs: [], sourcesHit: [] }));
      if (Array.isArray(liveRes.docs) && liveRes.docs.length) {
        mergeIntoLocalCorpus(cacheFile, liveRes.docs);
        liveSourcesHit = liveRes.sourcesHit || [];
      }
    }

    const corpus = readLocalCorpus(cacheFile);
    const memberDocs = readMemberVault(cacheFile);
    const combinedDocs = memberDocs.length > 0
      ? Engine.deduplicateDocs(corpus.docs, memberDocs).docs
      : corpus.docs;
    const searchRes = Engine.searchCorpus(parsed.query, {
      docs: combinedDocs,
      loadedLaws: [],
      lawIndex: [],
      docType: "all",
      limit: parsed.limit
    });
    const matched = searchRes.docs.slice(0, parsed.limit);
    const outPayload = {
      ok: true,
      command: "search",
      query: parsed.query,
      offline: parsed.offline,
      count: matched.length,
      totalMatched: searchRes.totalMatchedDocs,
      totalLocalDocs: combinedDocs.length,
      liveSourcesHit,
      docs: matched
    };
    if (parsed.json) {
      writeOut(JSON.stringify(outPayload, null, 2));
    } else {
      const hdr = "🔎 한국공인노무사회「" + parsed.query + "」직접 검색 결과: " + matched.length +
        "건 (전체 매칭 " + searchRes.totalMatchedDocs + "건 / 로컬 색인 " + combinedDocs.length + "건)";
      writeOut(formatDocsHuman(matched, hdr));
    }
    return outPayload;
  }

  throw new Error("알 수 없는 명령입니다: " + parsed.command + "\n\n" + formatUsageText());
}

if (require.main === module) {
  runCli(process.argv.slice(2)).catch((err) => {
    process.stderr.write("오류: " + String((err && err.message) || err) + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  parseCliArgs,
  validateSafeExportPath,
  readLocalCorpus,
  writeLocalCorpus,
  mergeIntoLocalCorpus,
  runCli
};
