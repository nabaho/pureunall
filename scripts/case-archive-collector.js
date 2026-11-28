#!/usr/bin/env node
/* 푸른통합시스템 — PC · D드라이브 · NAS · 푸른 메일 산재·노동사건 전수 수집 & 표준 보관함 정리기
 *
 * 원칙:
 *   1. PC/D/NAS 원본 파일은 100% 읽기 전용(이동·삭제·수정 절대 금지).
 *   2. Node fs API 전용 사용(로컬/네트워크 UNC 경로 안전).
 *   3. SHA-256 중복 제거 + 상대 경로 180자(전체 240자 미만) 안전 축약 후
 *      로컬 보관함(DEST_D) 및 선택적 네트워크 보관함(DEST_NAS)에 동시 정리.
 *   4. 수집 경로·예외 패턴은 저장소 밖 로컬 설정(_collector_config.json) 또는 환경변수로 주입.
 *   5. 모든 RTDB 쓰기는 PuCaseArchiveCore.sanitizeForSave + PuOntologyWrite + ETag(If-Match) 조건부 PUT 사용.
 *
 * 사용법:
 *   node scripts/case-archive-collector.js --scan [--config <경로>]
 *   node scripts/case-archive-collector.js --copy [--config <경로>]
 *   node scripts/case-archive-collector.js --backfill-rtdb --dry-run
 *   node scripts/case-archive-collector.js --backfill-rtdb --apply
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const Archive = require(path.join(ROOT, 'js', 'pu-case-archive-core.js'));
const SanjaeCore = require(path.join(ROOT, 'js', 'pu-sanjae-core.js'));
const LaborCore = require(path.join(ROOT, 'js', 'pu-laborcase-core.js'));
const OntWrite = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';

function loadCollectorConfig() {
  const cliArgv = process.argv.slice(2);
  const cfgIdx = cliArgv.indexOf('--config');
  const explicit = cfgIdx >= 0 ? cliArgv[cfgIdx + 1] : '';
  const defaultDestD = process.env.CASE_ARCHIVE_DEST_D || 'D:\\푸른_산재노동사건_통합보관함';
  const candidates = [
    explicit,
    process.env.CASE_ARCHIVE_CONFIG || '',
    path.join(defaultDestD, '_collector_config.json')
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
          destD: parsed.destD || defaultDestD,
          destNas: parsed.destNas || process.env.CASE_ARCHIVE_DEST_NAS || '',
          scanSources: Array.isArray(parsed.scanSources) ? parsed.scanSources : [],
          extraSkipFolderPattern: String(parsed.extraSkipFolderPattern || '')
        };
      }
    } catch (_) { /* 설정 파싱 실패 시 기본값 폴백 */ }
  }
  return {
    destD: defaultDestD,
    destNas: process.env.CASE_ARCHIVE_DEST_NAS || '',
    scanSources: [],
    extraSkipFolderPattern: ''
  };
}

const COLLECTOR_CFG = loadCollectorConfig();
const DEST_D = COLLECTOR_CFG.destD;
const DEST_NAS = COLLECTOR_CFG.destNas;
const SCAN_SOURCES = COLLECTOR_CFG.scanSources;

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.claude', '.venv', '__pycache__', '$recycle.bin',
  'system volume information', '#recycle', '@eadir', '푸른_산재노동사건_통합보관함',
  '00. [통합] 산재·노동사건보관함', 'github', 'temp', 'cache', 'dist', 'build',
  'ai', 'ai 프로그램', '옵시디언', '프로그램', '한글', '푸른모든코딩자료', '노리시스템',
  '이카운트', '내피시프로그램', '법인연결', '인공지능', 'gemini보내기', 'pu-remember-ext',
  'appdata', 'program files', 'program files (x86)', 'windows',
  '01. [업무] 급여관리', '06. [업무] 지원금관리', '02. [자문사] 명단+사무실관리', '03. [자문사] 배포안내자료'
]);

const BASE_SKIP_TOP_PATTERN = '(일터상생|일터혁신|산업일자리전환|산업일자리컨설팅|안전보건컨설팅|안전보건체계|법정교육|강의자료|근로복지기금|8\\.\\s*공동기금|9\\.\\s*강의\\s*회의|세무|연말정산|노무사시험|서식백업_원본|평가관련자료|기술보호지원반|인권경영|충남 기업명단|푸른입금내역|1\\. 컨설팅|10\\. 자문사|11\\.지원금|2026강의|11\\.?지원금|회생법원|사업자등록증 등|공문 제안서|푸른노무법인 제안서|수습노무사|푸른사무실운영서식|1\\.\\s*인사노무컨설팅|자율점검|비즈니스지원단|일생활균형|공공기관\\s*컨설팅|상공회의소\\s*컨설팅|기술보호컨설팅|근로자이음센터|자문사현황|직장내괴롭힘 추천|푸른 표준 서식|program files|windows)';
const SKIP_TOP_FOLDERS = COLLECTOR_CFG.extraSkipFolderPattern
  ? new RegExp(BASE_SKIP_TOP_PATTERN + '|(' + COLLECTOR_CFG.extraSkipFolderPattern + ')', 'i')
  : new RegExp(BASE_SKIP_TOP_PATTERN, 'i');
const ALLOW_EXTS = new Set(['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'eml', 'msg']);
const MAX_DOC_BYTES = 80 * 1024 * 1024;
const LOCAL_PATH_RE = /([A-Za-z]:\\\\|\\\\\\\\[^\\\\"]+\\\\|\/Users\/|\/home\/)/i;

function str(v) { return v == null ? '' : String(v).trim(); }
function rowsOf(v) {
  const x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter((r) => r && typeof r === 'object');
  if (x && typeof x === 'object') return Object.keys(x).map((k) => Object.assign({ id: x[k] && x[k].id ? x[k].id : k }, x[k])).filter((r) => r && typeof r === 'object');
  return [];
}

function safeSeg(name, maxLen) {
  let s = str(name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s) s = '미상';
  if (s.length > maxLen) s = s.slice(0, maxLen).trim().replace(/[. ]+$/, '');
  return s || '미상';
}

function safeFileName(name, maxBaseLen) {
  const ext = path.extname(name);
  let base = path.basename(name, ext);
  base = safeSeg(base, maxBaseLen);
  return base + ext.toLowerCase();
}

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(65536);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      h.update(buf.subarray(0, bytesRead));
    }
    return h.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

/* ── Firebase CLI 토큰 · ETag RTDB 도우미 ──────────────────────────────── */
function runFirebaseCli(args) {
  const argList = args.map(String);
  if (process.platform === 'win32') {
    const fbJs = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    if (fs.existsSync(fbJs)) {
      return execFileSync(process.execPath, [fbJs, ...argList], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    }
  }
  return execFileSync('firebase', argList, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
}

function loadFreshAccessToken() {
  runFirebaseCli(['database:get', '/data/biz_case_types', '--instance', 'pureun-erp-default-rtdb', '--project', 'pureun-erp']);
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const tok = parsed && parsed.tokens && parsed.tokens.access_token;
  if (!tok) throw new Error('Firebase CLI access_token 을 찾을 수 없습니다.');
  return tok;
}

function rtdbRequest(method, dbPath, token, bodyObj, etag) {
  const normPath = String(dbPath || '').replace(/^\/+/, '');
  const enc = '/' + normPath.split('/').filter(Boolean).map((s) => encodeURIComponent(s)).join('/');
  const headers = { Authorization: `Bearer ${token}` };
  if (method === 'GET' && etag === true) headers['X-Firebase-ETag'] = 'true';
  let payload = null;
  if (bodyObj !== undefined) {
    payload = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers['Content-Length'] = payload.length;
  }
  if (method === 'PUT' && typeof etag === 'string' && etag) headers['If-Match'] = etag;
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: DB_HOST, port: 443, path: `${enc}.json`, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 412) return resolve({ committed: false, conflict: true });
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`${method} ${dbPath} HTTP ${res.statusCode}: ${txt.slice(0, 200)}`));
        }
        resolve({ committed: true, data: txt ? JSON.parse(txt) : null, etag: String((res.headers && res.headers.etag) || '') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ── 디스크 재귀 탐색 (상위 사건 폴더 문맥 전파 포함) ──────────────────────── */

function walkSourceDir(sourceCfg, stats) {
  const rootDir = sourceCfg.dir;
  const collected = [];
  if (!fs.existsSync(rootDir)) {
    stats.missingRoots.push(rootDir);
    return collected;
  }

  let dirCount = 0;
  function visit(curDir, relPath, depth, inheritedFolderCls) {
    if (depth > sourceCfg.maxDepth) return;
    dirCount++;
    if (dirCount % 150 === 0) {
      console.log(`  [진행:${sourceCfg.origin}] 폴더 ${dirCount}개 탐색 · 파일 ${stats.scannedFiles}개 (현재: ${relPath.slice(0, 60)})`);
    }
    let entries;
    try {
      entries = fs.readdirSync(curDir, { withFileTypes: true });
    } catch (e) {
      stats.errors.push(`${curDir}: ${e.code || e.message}`);
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (name.startsWith('~$') || name.startsWith('.')) continue;
      if (ent.isSymbolicLink()) continue;
      const full = path.join(curDir, name);
      const nextRel = relPath ? path.join(relPath, name) : name;

      if (ent.isDirectory()) {
        if (IGNORE_DIRS.has(name.toLowerCase())) continue;
        if (SKIP_TOP_FOLDERS.test(name)) {
          stats.skippedFolders++;
          continue;
        }
        let nextInherited = inheritedFolderCls;
        const folderCls = Archive.classifyRecord({ relPath: nextRel, name, folderHint: nextRel });
        if (/^(02\.\s*\[업무\]\s*체당금|03\.\s*\[업무\]\s*산재|04\.\s*\[업무\]\s*노동부사건)/.test(name)) {
          const forcedDomain = /산재/.test(name) ? 'sanjae' : (/체당금/.test(name) ? 'labor_wage' : 'labor_dismissal');
          nextInherited = {
            domain: forcedDomain,
            subType: forcedDomain === 'sanjae' ? 'injury_accident' : (/체당금/.test(name) ? 'subrogation' : 'petition'),
            subTypeLabel: Archive.SUBTYPE_LABELS[forcedDomain === 'sanjae' ? 'injury_accident' : (/체당금/.test(name) ? 'subrogation' : 'petition')],
            programKey: forcedDomain === 'sanjae' ? 'sanjae' : 'laborcase',
            signals: Archive.parseCaseSignals({ relPath: nextRel, name, folderHint: nextRel }),
            anchorFolder: nextRel.split(/[\\/]/).slice(0, Math.min(3, depth + 2)).join('/')
          };
        } else if (folderCls.matched && folderCls.score >= 16) {
          nextInherited = {
            domain: folderCls.domain,
            subType: folderCls.subType,
            subTypeLabel: folderCls.subTypeLabel,
            programKey: folderCls.programKey,
            signals: folderCls.signals,
            anchorFolder: nextRel.split(/[\\/]/).slice(0, Math.min(3, depth + 1)).join('/')
          };
        }
        visit(full, nextRel, depth + 1, nextInherited);
        continue;
      }

      if (!ent.isFile()) continue;
      stats.scannedFiles++;
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!ALLOW_EXTS.has(ext)) continue;

      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (!st || st.size === 0 || st.size > MAX_DOC_BYTES) continue;

      const cls = Archive.classifyRecord({
        relPath: nextRel,
        name,
        folderHint: relPath,
        mtime: st.mtimeMs
      });

      let chosen = null;
      if (cls.matched) {
        chosen = {
          domain: cls.domain,
          subType: cls.subType,
          subTypeLabel: cls.subTypeLabel,
          programKey: cls.programKey,
          signals: cls.signals,
          anchorFolder: (inheritedFolderCls && inheritedFolderCls.anchorFolder) || relPath.split(/[\\/]/).slice(0, 3).join('/'),
          score: cls.score
        };
      } else if (inheritedFolderCls && !/보수총액|세금계산서|이력서|연말정산/i.test(name)) {
        const sig2 = Archive.parseCaseSignals({ relPath: nextRel, name, folderHint: relPath, mtime: st.mtimeMs });
        chosen = {
          domain: inheritedFolderCls.domain,
          subType: inheritedFolderCls.subType,
          subTypeLabel: inheritedFolderCls.subTypeLabel,
          programKey: inheritedFolderCls.programKey,
          signals: Object.assign({}, inheritedFolderCls.signals, {
            year: sig2.year || inheritedFolderCls.signals.year,
            companyName: inheritedFolderCls.signals.companyName || sig2.companyName,
            companyNorm: inheritedFolderCls.signals.companyNorm || sig2.companyNorm,
            claimantName: inheritedFolderCls.signals.claimantName || sig2.claimantName,
            primaryCaseNo: inheritedFolderCls.signals.primaryCaseNo || sig2.primaryCaseNo,
            jurisdiction: inheritedFolderCls.signals.jurisdiction || sig2.jurisdiction
          }),
          anchorFolder: inheritedFolderCls.anchorFolder,
          score: 15
        };
      } else {
        stats.excludedFiles++;
        continue;
      }

      collected.push({
        origin: sourceCfg.origin,
        sourcePath: full,
        relPath: nextRel,
        fileName: name,
        ext,
        size: st.size,
        mtimeMs: st.mtimeMs,
        dateIso: new Date(st.mtimeMs).toISOString().slice(0, 10),
        classification: chosen
      });
    }
  }

  visit(rootDir, '', 0, null);
  return collected;
}

/* ── 사건 단위 그룹화 + 표준 보관함 경로 계산 ──────────────────────────────── */
function domainFolderName(domain) {
  if (domain === 'sanjae') return '01_산재사건';
  if (domain === 'labor_dismissal') return '02_부당해고_노동위';
  return '03_임금체불_진정_대지급금';
}

function roleSubFolderName(side) {
  const found = Archive.ARCHIVE_DOCS_STANDARD_FOLDERS.find((f) => f.key === side);
  return found ? found.label : '04_입증자료·사실확인';
}

function buildCaseGroups(diskFiles, mailList, existingCompanies, erpCases) {
  const groups = {};
  const coLookup = {};
  const coMatchers = [];
  existingCompanies.forEach((co) => {
    const nm = Archive.normalizeCompanyName(co.name);
    if (nm) {
      coLookup[nm] = co;
      if (nm.length >= 2 && !/^(주식|회사|법인|병원|의원|학교|재단|공사|공단|조합)$/.test(nm)) {
        coMatchers.push({ norm: nm, co });
      }
    }
  });
  coMatchers.sort((a, b) => b.norm.length - a.norm.length);

  function matchExistingCompanyByText(text) {
    const normTxt = Archive.normalizeCompanyName(text);
    if (!normTxt) return null;
    for (const m of coMatchers) {
      if (normTxt.indexOf(m.norm) !== -1) return m.co;
    }
    return null;
  }

  function groupKeyFor(cls, originTag) {
    const sig = cls.signals || {};
    const dom = cls.domain;
    const yr = String(sig.year || new Date().getFullYear());
    if (sig.primaryCaseNo) return `${dom}|no|${sig.primaryCaseNo.replace(/\s+/g, '')}`;
    if (sig.companyNorm && sig.claimantName) return `${dom}|${yr}|${sig.companyNorm}|${sig.claimantName}`;
    if (sig.companyNorm) return `${dom}|${yr}|${sig.companyNorm}`;
    return `${dom}|${yr}|folder|${originTag}|${str(cls.anchorFolder || 'misc')}`;
  }

  function ensureGroup(key, cls, rawContextText) {
    if (groups[key]) return groups[key];
    const sig = cls.signals || {};
    let coHit = sig.companyNorm ? coLookup[sig.companyNorm] : null;
    if (!coHit && rawContextText) coHit = matchExistingCompanyByText(rawContextText);
    const coName = str((coHit && coHit.name) || sig.companyName || '업체미지정');
    const year = Number(sig.year) || new Date().getFullYear();
    const domDir = domainFolderName(cls.domain);
    const coSeg = safeSeg(coName, 26);
    const partySeg = safeSeg(sig.claimantName || '', 12);
    const noSeg = safeSeg(sig.primaryCaseNo || '', 18);
    const caseFolder = safeSeg([year, coSeg, partySeg, noSeg, cls.subTypeLabel].filter(Boolean).join('_'), 46);
    const hashId = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
    const idPrefix = cls.programKey === 'sanjae' ? 'sj_arc_' : 'lc_arc_';

    groups[key] = {
      id: idPrefix + hashId,
      groupKey: key,
      programKey: cls.programKey,
      domain: cls.domain,
      track: cls.domain === 'labor_wage' ? 'molab' : (cls.domain === 'labor_dismissal' ? 'nlrc' : ''),
      subType: cls.subType,
      subTypeLabel: cls.subTypeLabel,
      ourRole: cls.domain === 'sanjae' ? 'worker' : 'employer',
      year,
      companyId: coHit ? str(coHit.id) : '',
      companyName: coName,
      claimantName: str(sig.claimantName),
      caseNo: str(sig.primaryCaseNo),
      jurisdiction: str(sig.jurisdiction),
      baseRelDir: `${domDir}/${year}/${coSeg}/${caseFolder}`,
      files: [],
      mails: []
    };
    return groups[key];
  }

  for (const item of diskFiles) {
    const key = groupKeyFor(item.classification, item.origin);
    const g = ensureGroup(key, item.classification, item.relPath + ' ' + item.fileName);
    const role = Archive.classifyDocSideRole({ name: item.fileName, relPath: item.relPath, date: item.dateIso }, g.ourRole);
    const roleDir = roleSubFolderName(role.side);
    const cleanFile = safeFileName(item.fileName, 56);
    const relOut = `${g.baseRelDir}/${roleDir}/${cleanFile}`;
    g.files.push(Object.assign({}, item, { role, roleDir, archiveRelPath: relOut }));
  }

  for (const m of mailList) {
    const cls = Archive.classifyRecord({
      name: m.subject, subject: m.subject, body: m.bodyPreview, from: m.from,
      attachmentNames: m.attachmentNames, date: m.date
    });
    if (!cls.matched) continue;
    const key = groupKeyFor({
      domain: cls.domain,
      subType: cls.subType,
      subTypeLabel: cls.subTypeLabel,
      programKey: cls.programKey,
      signals: cls.signals,
      anchorFolder: str(cls.signals.companyName || m.subject).slice(0, 24)
    }, 'mail');
    const g = ensureGroup(key, cls, m.subject);
    g.mails.push(m);
  }

  /* ERP 기존 사건과 매칭 시도 */
  Object.values(groups).forEach((g) => {
    const gCo = Archive.normalizeCompanyName(g.companyName);
    const matchedErp = erpCases.find((ec) => {
      if (g.companyId && ec.companyId && g.companyId === ec.companyId) return true;
      const eCo = Archive.normalizeCompanyName(ec.companyName || ec.co);
      return gCo && eCo && gCo === eCo && str(ec.receiveDate).slice(0, 4) === String(g.year);
    });
    if (matchedErp) {
      g.erpCaseId = str(matchedErp.id);
      g.managerMain = str(matchedErp.managerMain);
      g.managerSubs = Array.isArray(matchedErp.managerSubs) ? matchedErp.managerSubs : [];
    }
  });

  return Object.values(groups);
}

/* ── 경로 이탈·심볼릭링크 검증 및 복사/대조표/색인 생성 ─────────────────────── */
function normalizeCmpPath(p) {
  const r = path.resolve(String(p || ''));
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

function isPathInsideRoot(normRoot, candidate) {
  const rCmp = normalizeCmpPath(normRoot).replace(/[\\/]+$/, '');
  const cCmp = normalizeCmpPath(candidate);
  return cCmp === rCmp || cCmp.startsWith(rCmp + path.sep);
}

function lstatIfExists(p) {
  try { return fs.lstatSync(p); }
  catch (e) { if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null; throw e; }
}

function assertNoSymlinkAndInsideRoot(rootDir, targetPath) {
  if (!rootDir) throw new Error('보관함 루트 미지정');
  const resolvedRoot = path.resolve(rootDir);
  const rootLst = lstatIfExists(resolvedRoot);
  if (rootLst && rootLst.isSymbolicLink()) {
    throw new Error('심볼릭 링크·정션 루트 거부: ' + resolvedRoot);
  }
  const normRoot = rootLst ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const resolvedTarget = path.resolve(targetPath);
  let rel = path.relative(resolvedRoot, resolvedTarget);
  if ((rel.startsWith('..') || path.isAbsolute(rel)) && normRoot !== resolvedRoot) {
    rel = path.relative(normRoot, resolvedTarget);
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('보관함 루트 이탈 경로 거부: ' + targetPath);
  }
  const parts = rel ? rel.split(/[\\/]+/).filter(Boolean) : [];
  let cur = normRoot;
  for (const seg of parts) {
    cur = path.join(cur, seg);
    const st = lstatIfExists(cur);
    if (st) {
      if (st.isSymbolicLink()) throw new Error('심볼릭 링크·정션 경로 거부: ' + cur);
      const realCur = fs.realpathSync(cur);
      if (!isPathInsideRoot(normRoot, realCur)) {
        throw new Error('실제 경로 보관함 이탈 거부: ' + realCur);
      }
    }
  }
  return path.join(normRoot, ...parts);
}

function ensureSafeDirSync(rootDir, dirPath) {
  const safeDir = assertNoSymlinkAndInsideRoot(rootDir, dirPath);
  if (!fs.existsSync(safeDir)) fs.mkdirSync(safeDir, { recursive: true });
  assertNoSymlinkAndInsideRoot(rootDir, safeDir);
  return safeDir;
}

function safeWriteFileSync(rootDir, filePath, content) {
  ensureSafeDirSync(rootDir, path.dirname(filePath));
  const safeFile = assertNoSymlinkAndInsideRoot(rootDir, filePath);
  fs.writeFileSync(safeFile, content, 'utf8');
}

function safeCopyFileIfNeeded(rootDir, src, destPath, sha256) {
  const srcLst = lstatIfExists(src);
  if (!srcLst || srcLst.isSymbolicLink()) return 'skipped_symlink';
  ensureSafeDirSync(rootDir, path.dirname(destPath));
  const safeDest = assertNoSymlinkAndInsideRoot(rootDir, destPath);
  if (lstatIfExists(safeDest)) {
    try {
      const dstStat = fs.statSync(safeDest);
      const srcStat = fs.statSync(src);
      if (dstStat.size === srcStat.size && sha256File(safeDest) === sha256) return 'skipped_same';
      /* 동일 파일명·다른 내용이면 해시 앞 6자리 접미사로 충돌 방지 */
      const ext = path.extname(safeDest);
      const altRaw = safeDest.slice(0, safeDest.length - ext.length) + '_' + sha256.slice(0, 6) + ext;
      const safeAlt = assertNoSymlinkAndInsideRoot(rootDir, altRaw);
      if (!lstatIfExists(safeAlt)) {
        fs.copyFileSync(src, safeAlt);
        return 'copied_renamed';
      }
      return 'skipped_same';
    } catch (_) {}
  }
  fs.copyFileSync(src, safeDest);
  return 'copied';
}

function buildGroupCounterMd(g, matrix) {
  const lines = [
    `# ${g.companyName}${g.claimantName ? ' (' + g.claimantName + ')' : ''} — 공방 대조표`,
    '',
    `- 영역: ${g.subTypeLabel} (${g.domain})`,
    `- 연도: ${g.year} / 사건번호: ${g.caseNo || '-'} / 관할: ${g.jurisdiction || '-'}`,
    `- 정리 서류: ${matrix.summary.totalDocs}건 (대응 완료 ${matrix.summary.matched} / 준비 ${matrix.summary.pending} / 기한경과 ${matrix.summary.overdue})`,
    '',
    '| № | 구분 | 상대방·기관 서류 | 날짜 | ⇄ | 당사 대응 서류 | 날짜 | 상태 |',
    '|---:|---|---|---|---|---|---|---|'
  ];
  matrix.rows.forEach((r, idx) => {
    const o = r.opponentDoc ? `${r.opponentDoc.name}` : '-';
    const od = r.opponentDoc ? (r.opponentDoc.date || '-') : '-';
    const d = r.ourDoc ? `${r.ourDoc.name}` : '-';
    const dd = r.ourDoc ? (r.ourDoc.date || '-') : '-';
    lines.push(`| ${idx + 1} | ${r.roundLabel} | ${o} | ${od} | ⇄ | ${d} | ${dd} | ${r.status} |`);
  });
  return lines.join('\n') + '\n';
}

function writeRootIndexes(destRoot, records, scanStats) {
  ensureSafeDirSync(destRoot, destRoot);
  const views = Archive.buildMultiAxisViews(records);

  const yearMd = ['# 연도별·시기별 산재·노동사건 전체 색인', ''].concat(
    views.byYear.map((yg) => `## ${yg.year}년 (${yg.count}건 · 서류 ${yg.docCount}개)\n` + yg.cases.map((c) => `- **${c.companyName}** (${c.claimantName || '-'}) · ${c.subTypeLabel} · ${c.caseNo || '-'} · [${c.docs.length}건] \`${c.archiveRelPath}\``).join('\n'))
  ).join('\n\n');

  const coMd = ['# 기업 중심 산재·노동사건 전체 색인', ''].concat(
    views.byCompany.map((cg) => `## ${cg.companyName} (${cg.count}건 · 서류 ${cg.docCount}개)\n` + cg.cases.map((c) => `- ${c.year}년 · ${c.subTypeLabel} (${c.claimantName || '-'}) · \`${c.archiveRelPath}\``).join('\n'))
  ).join('\n\n');

  const partyMd = ['# 진정인·신청인·재해자 중심 전체 색인', ''].concat(
    views.byParty.map((pg) => `- **${pg.partyName}** (${pg.companyName}) — ${pg.count}건 [${pg.domainSummary}]`)
  ).join('\n');

  safeWriteFileSync(destRoot, path.join(destRoot, '_전체색인_연도별.md'), yearMd);
  safeWriteFileSync(destRoot, path.join(destRoot, '_전체색인_기업별.md'), coMd);
  safeWriteFileSync(destRoot, path.join(destRoot, '_전체색인_당사자별.md'), partyMd);

  const reportObj = {
    generatedAt: new Date().toISOString(),
    stats: scanStats,
    totalCases: records.length,
    sanjaeCases: records.filter((r) => r.domain === 'sanjae').length,
    dismissalCases: records.filter((r) => r.domain === 'labor_dismissal').length,
    wagePetitionCases: records.filter((r) => r.domain === 'labor_wage').length,
    totalDocs: records.reduce((a, r) => a + r.docs.length, 0),
    totalMails: records.reduce((a, r) => a + r.mailLinks.length, 0)
  };
  const reportMd = [
    '# 푸른 산재·노동사건 전수 수집 리포트',
    '',
    `- 생성 시각: ${reportObj.generatedAt}`,
    `- 탐색 전체 파일: ${scanStats.scannedFiles.toLocaleString()}개 (오탐·무관 제외: ${scanStats.excludedFiles.toLocaleString()}개 / 제외 폴더: ${scanStats.skippedFolders.toLocaleString()}개)`,
    `- 분류 적중 파일: ${scanStats.matchedFiles.toLocaleString()}개 (예상 총 용량: ${(scanStats.totalBytes / (1024 * 1024)).toFixed(1)} MB · SHA-256 중복 제거 후: ${scanStats.uniqueFiles.toLocaleString()}개)`,
    `- 정리 사건 묶음: **${reportObj.totalCases}건** (산재 ${reportObj.sanjaeCases} · 부당해고/노동위 ${reportObj.dismissalCases} · 임금체불/진정/대지급금 ${reportObj.wagePetitionCases})`,
    `- 메일 연계 건수: ${reportObj.totalMails}통`,
    `- D 복사 결과: 신규 ${scanStats.copiedD} / 중복스킵 ${scanStats.skippedD}`,
    `- NAS 복사 결과: 신규 ${scanStats.copiedNas} / 중복스킵 ${scanStats.skippedNas}`,
    scanStats.errors.length ? `\n## 접근 오류(${scanStats.errors.length}건)\n` + scanStats.errors.slice(0, 20).map((e) => `- ${e}`).join('\n') : ''
  ].join('\n');

  safeWriteFileSync(destRoot, path.join(destRoot, '_수집리포트.json'), JSON.stringify(reportObj, null, 2));
  safeWriteFileSync(destRoot, path.join(destRoot, '_수집리포트.md'), reportMd);
  return reportObj;
}

/* ── 레코드를 RTDB 저장용 표준 객체로 변환 (보안·비식별 강제) ───────────────── */
function toSafeCaseRecord(g, withSha) {
  const docs = [];
  const seenInCase = new Set();
  for (const f of g.files) {
    let sha = f.sha256 || '';
    if (withSha && !sha) {
      try { sha = sha256File(f.sourcePath); f.sha256 = sha; } catch (_) {}
    }
    const dedupKey = sha || `${f.fileName}|${f.size}`;
    if (seenInCase.has(dedupKey)) continue;
    seenInCase.add(dedupKey);
    docs.push(Archive.sanitizeDocMeta({
      id: 'd_' + crypto.createHash('md5').update(dedupKey + f.archiveRelPath).digest('hex').slice(0, 10),
      name: f.fileName,
      title: f.fileName,
      ext: f.ext,
      date: f.dateIso,
      side: f.role.side,
      roleLabel: f.role.roleLabel,
      exhibitNo: f.role.exhibitNo,
      roundLabel: f.role.roundLabel,
      pairKey: f.role.pairKey,
      outcomeSignal: f.role.outcomeSignal,
      sha256: sha,
      size: f.size,
      sourceOrigin: f.origin,
      archiveRelPath: f.archiveRelPath.replace(/\\/g, '/')
    }));
  }

  g.mails.forEach((m, idx) => {
    const role = Archive.classifyDocSideRole(m, g.ourRole);
    const firstAtt = (m.attachmentNames && m.attachmentNames[0]) || '';
    docs.push(Archive.sanitizeDocMeta({
      id: 'm_' + idx + '_' + (m.uid || m.key || idx),
      name: firstAtt || m.subject,
      title: m.subject,
      ext: (firstAtt.split('.').pop() || '').toLowerCase() || 'eml',
      date: str(m.date).slice(0, 10),
      side: role.side,
      roleLabel: role.roleLabel,
      exhibitNo: role.exhibitNo,
      roundLabel: role.roundLabel,
      pairKey: role.pairKey,
      outcomeSignal: role.outcomeSignal,
      sourceOrigin: 'mail',
      archiveRelPath: ''
    }));
  });

  const isSanjae = g.programKey === 'sanjae';
  const steps = isSanjae
    ? SanjaeCore.inferStepsFromDocs(docs, {})
    : LaborCore.inferStepsFromDocs(docs, {}, g.track || 'nlrc');

  const sortedDates = docs.map((d) => d.date).filter(Boolean).sort();
  const raw = {
    id: g.id,
    entityType: 'Case',
    domain: g.domain,
    track: g.track || '',
    subType: g.subType,
    subTypeLabel: g.subTypeLabel,
    ourRole: g.ourRole,
    title: `${g.companyName}${g.claimantName ? ' (' + g.claimantName + ')' : ''} ${g.subTypeLabel}`,
    companyId: g.companyId,
    companyName: g.companyName,
    claimantName: g.claimantName,
    caseNo: g.caseNo,
    jurisdiction: g.jurisdiction,
    year: g.year,
    receiveDate: sortedDates[0] || `${g.year}-01-01`,
    status: g.year < new Date().getFullYear() ? '종결(아카이브)' : '진행중',
    rulingResult: '',
    managerMain: g.managerMain || '',
    managerSubs: g.managerSubs || [],
    erpCaseId: g.erpCaseId || '',
    archiveRelPath: g.baseRelDir.replace(/\\/g, '/'),
    steps,
    docs: docs.slice(0, 120),
    mailLinks: g.mails.slice(0, 60).map(Archive.sanitizeMailLink).filter(Boolean),
    sourceKind: 'archive_collector',
    sourceId: g.id
  };
  return Archive.sanitizeForSave(raw);
}

function hasRawMailAddress(mailLinks) {
  return Array.isArray(mailLinks) && mailLinks.some((m) => (
    m && typeof m === 'object' && (
      Object.prototype.hasOwnProperty.call(m, 'from') ||
      Object.prototype.hasOwnProperty.call(m, 'to') ||
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(
        String(m.subject || '') + ' ' + (Array.isArray(m.attachmentNames) ? m.attachmentNames.join(' ') : '')
      )
    )
  ));
}

function scrubMailLinksRecord(rec) {
  if (!rec || typeof rec !== 'object' || !Array.isArray(rec.mailLinks)) {
    return { changed: false, record: rec };
  }
  if (!hasRawMailAddress(rec.mailLinks)) {
    return { changed: false, record: rec };
  }
  return { changed: true, record: Archive.sanitizeForSave(rec) };
}

async function scrubRtdbMailAddresses(doApply) {
  const token = loadFreshAccessToken();
  if (!token) throw new Error('RTDB 정화에 Firebase CLI 토큰이 필요합니다.');
  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });
  const roots = ['sanjae_cases/cases', 'labor_cases/cases'];
  let total = 0, targets = 0, applied = 0, skipped = 0, remainRaw = 0;

  for (const rootPath of roots) {
    const allRes = await rtdbRequest('GET', rootPath, token, undefined, false);
    const map = (allRes && allRes.data && typeof allRes.data === 'object') ? allRes.data : {};
    const keys = Object.keys(map);
    total += keys.length;
    const workIds = keys.filter((id) => scrubMailLinksRecord(map[id]).changed);
    targets += workIds.length;

    if (doApply && workIds.length) {
      const CONC = 8;
      let idx = 0;
      async function scrubWorker() {
        while (idx < workIds.length) {
          const cid = workIds[idx++];
          const itemPath = rootPath + '/' + cid;
          let done = false;
          for (let attempt = 0; attempt < 2 && !done; attempt++) {
            const cur = await rtdbRequest('GET', itemPath, token, undefined, true);
            const latest = cur.data;
            const scrubbed = scrubMailLinksRecord(latest);
            if (!scrubbed.changed) { done = true; break; }
            const prep = gw.prepare(scrubbed.record, {
              entityType: 'Case',
              allowPendingCompany: true,
              actor: 'SYSTEM_BACKFILL',
              previous: latest || null,
              expectedRevision: latest ? Number(latest.revision || 0) : -1
            });
            if (!prep.ok) break;
            const putRes = await rtdbRequest('PUT', itemPath, token, prep.value, cur.etag);
            if (putRes.committed) { applied++; done = true; }
            else if (!putRes.conflict) break;
          }
          if (!done) skipped++;
        }
      }
      await Promise.all(Array.from({ length: CONC }, scrubWorker));
    }

    if (doApply) {
      const verifyRes = await rtdbRequest('GET', rootPath, token, undefined, false);
      const vMap = (verifyRes && verifyRes.data && typeof verifyRes.data === 'object') ? verifyRes.data : {};
      for (const id of Object.keys(vMap)) {
        if (vMap[id] && hasRawMailAddress(vMap[id].mailLinks)) remainRaw++;
      }
    }
  }
  console.log(`[RTDB 메일주소 정화 ${doApply ? 'APPLY' : 'DRY-RUN'}] 전체=${total}, 정화대상=${targets}, 반영=${applied}, 스킵=${skipped}, 잔존원문=${remainRaw}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const doScan = args.has('--scan') || args.has('--copy') || args.has('--backfill-rtdb');
  const doCopy = args.has('--copy');
  const doBackfill = args.has('--backfill-rtdb');
  const doScrubMail = args.has('--scrub-mail-addrs');
  const doApply = args.has('--apply');
  if (!doScan && !doScrubMail) {
    console.log('사용법: node scripts/case-archive-collector.js --scan | --copy | --backfill-rtdb --dry-run|--apply | --scrub-mail-addrs --dry-run|--apply');
    return;
  }
  if (doScrubMail) {
    await scrubRtdbMailAddresses(doApply);
    if (!doScan) return;
  }

  let token = '';
  let existingCompanies = [];
  let erpCases = [];
  let mails = [];
  try {
    token = loadFreshAccessToken();
    const [coRes, csRes, mbRes] = await Promise.all([
      rtdbRequest('GET', '/data/companies', token),
      rtdbRequest('GET', '/data/cases', token),
      rtdbRequest('GET', '/mailbox', token)
    ]);
    existingCompanies = rowsOf(coRes.data);
    erpCases = rowsOf(csRes.data);
    mails = Archive.flattenMailbox(mbRes.data || {});
    console.log(`[RTDB] 업체 ${existingCompanies.length}건, ERP사건 ${erpCases.length}건, 메일 ${mails.length}통 조회 완료`);
  } catch (e) {
    console.log(`[경고] RTDB 원천 조회 생략 (${e.message}) — 로컬 파일만 스캔합니다.`);
  }

  const stats = {
    scannedFiles: 0, excludedFiles: 0, skippedFolders: 0, matchedFiles: 0,
    uniqueFiles: 0, totalBytes: 0, copiedD: 0, skippedD: 0, copiedNas: 0, skippedNas: 0,
    missingRoots: [], errors: []
  };

  let allDiskFiles = [];
  for (const cfg of SCAN_SOURCES) {
    console.log(`[스캔] ${cfg.origin}: ${cfg.dir} ...`);
    const found = walkSourceDir(cfg, stats);
    console.log(`  -> 적중 ${found.length}개`);
    allDiskFiles = allDiskFiles.concat(found);
  }
  stats.matchedFiles = allDiskFiles.length;
  stats.totalBytes = allDiskFiles.reduce((a, f) => a + f.size, 0);

  const groups = buildCaseGroups(allDiskFiles, mails, existingCompanies, erpCases);
  const globalShaSet = new Set();
  let nasOk = false;
  if (!doCopy) {
    /* --scan 단계는 크기+파일명 추정으로 빠르게 통계 산출 (필요 시 5천만 바이트 이상 대용량 생략) */
    allDiskFiles.forEach((f) => globalShaSet.add(`${f.fileName}|${f.size}`));
    stats.uniqueFiles = globalShaSet.size;
  } else {
    console.log(`[복사] D드라이브(${DEST_D}) 및 NAS(${DEST_NAS || '미설정'}) 미러 정리 시작...`);
    ensureSafeDirSync(DEST_D, DEST_D);
    nasOk = Boolean(DEST_NAS) && (() => { try { ensureSafeDirSync(DEST_NAS, DEST_NAS); return true; } catch (e) { stats.errors.push('NAS Root: ' + e.message); return false; } })();

    for (const g of groups) {
      const seenCaseSha = new Set();
      for (const f of g.files) {
        let sha;
        try { sha = sha256File(f.sourcePath); f.sha256 = sha; } catch (e) { stats.errors.push(f.sourcePath + ': ' + e.message); continue; }
        globalShaSet.add(sha);
        if (seenCaseSha.has(sha)) continue;
        seenCaseSha.add(sha);

        const dTarget = path.join(DEST_D, f.archiveRelPath);
        const r1 = safeCopyFileIfNeeded(DEST_D, f.sourcePath, dTarget, sha);
        if (r1.startsWith('copied')) stats.copiedD++; else stats.skippedD++;

        if (nasOk) {
          try {
            const nasTarget = path.join(DEST_NAS, f.archiveRelPath);
            const r2 = safeCopyFileIfNeeded(DEST_NAS, f.sourcePath, nasTarget, sha);
            if (r2.startsWith('copied')) stats.copiedNas++; else stats.skippedNas++;
          } catch (e) {
            stats.errors.push('NAS copy: ' + e.message);
          }
        }
        if ((stats.copiedD + stats.skippedD) % 200 === 0) {
          console.log(`  [복사 진행] D(신규 ${stats.copiedD}/스킵 ${stats.skippedD}) · NAS(신규 ${stats.copiedNas}/스킵 ${stats.skippedNas})`);
        }
      }
      const recTmp = toSafeCaseRecord(g, false);
      const matrix = Archive.buildCounterMatrix(recTmp.docs, recTmp.ourRole);
      const md = buildGroupCounterMd(g, matrix);
      try {
        safeWriteFileSync(DEST_D, path.join(DEST_D, g.baseRelDir, '_공방대조표.md'), md);
        if (nasOk) {
          safeWriteFileSync(DEST_NAS, path.join(DEST_NAS, g.baseRelDir, '_공방대조표.md'), md);
        }
      } catch (e) { stats.errors.push('MD write: ' + e.message); }
    }
    stats.uniqueFiles = globalShaSet.size;
  }

  const safeRecords = groups.map((g) => toSafeCaseRecord(g, false));
  if (!doBackfill || doCopy || args.has('--scan')) {
    const summaryReport = writeRootIndexes(DEST_D, safeRecords, stats);
    if (doCopy && nasOk) {
      try { writeRootIndexes(DEST_NAS, safeRecords, stats); } catch (e) { stats.errors.push('NAS index: ' + e.message); }
    }
    console.log('[요약]', JSON.stringify(summaryReport, null, 2));
  } else {
    console.log('[요약] 사건 그룹:', safeRecords.length, '건 (기존 복사 리포트 보존)');
  }

  if (doBackfill) {
    if (!token) throw new Error('RTDB 백필에 Firebase CLI 토큰이 필요합니다.');
    const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });
    let absPathViolations = 0;
    let readyItems = [];
    let skipped = 0;
    let mailSingleSkipped = 0;

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const rec = safeRecords[gi];
      /* RTDB 공유 원장은 디스크 문서 >=1건, 명확한 사건번호, 또는 등록기업+메일>=2건만 적재하고
         단건 미분류 메일은 앱의 「메일 자동수집」 탭에 맡긴다. */
      const qualified = g.files.length >= 1 || Boolean(g.caseNo) || (Boolean(g.companyId) && g.mails.length >= 2);
      if (!qualified) {
        mailSingleSkipped++;
        continue;
      }
      const jsonStr = JSON.stringify(rec);
      if (LOCAL_PATH_RE.test(jsonStr) || /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/.test(jsonStr)) {
        absPathViolations++;
        continue;
      }
      const dbPath = (rec.domain === 'sanjae' ? 'sanjae_cases/cases/' : 'labor_cases/cases/') + rec.id;
      const prep = gw.prepare(rec, { entityType: 'Case', allowPendingCompany: true, actor: 'SYSTEM_BACKFILL' });
      if (!prep.ok) { skipped++; continue; }
      readyItems.push({ rec, dbPath });
    }

    let written = 0;
    if (doApply && readyItems.length) {
      const CONC = 8;
      let nextIdx = 0;
      async function worker() {
        while (nextIdx < readyItems.length) {
          const curIdx = nextIdx++;
          const item = readyItems[curIdx];
          const cur = await rtdbRequest('GET', item.dbPath, token, undefined, true);
          const latest = cur.data;
          if (latest && (latest._deleted === true || (latest.updatedBy && latest.updatedBy !== 'SYSTEM_BACKFILL'))) {
            skipped++; continue;
          }
          const prepApply = gw.prepare(item.rec, {
            entityType: 'Case', allowPendingCompany: true, actor: 'SYSTEM_BACKFILL',
            previous: latest || null,
            expectedRevision: latest ? Number(latest.revision || 0) : -1
          });
          if (!prepApply.ok) { skipped++; continue; }
          const putRes = await rtdbRequest('PUT', item.dbPath, token, prepApply.value, cur.etag);
          if (putRes.committed) written++; else skipped++;
          if (written % 100 === 0 && written > 0) console.log(`  [RTDB 반영] ${written}/${readyItems.length}...`);
        }
      }
      await Promise.all(Array.from({ length: CONC }, worker));
    }
    console.log(`[RTDB 백필 ${doApply ? 'APPLY' : 'DRY-RUN'}] 준비=${readyItems.length}, 반영=${written}, 스킵=${skipped}, 단건메일유보=${mailSingleSkipped}, 절대경로위반=${absPathViolations}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[오류]', e && e.stack || e);
    process.exit(1);
  });
} else {
  module.exports = {
    isPathInsideRoot,
    assertNoSymlinkAndInsideRoot,
    ensureSafeDirSync,
    safeWriteFileSync,
    safeCopyFileIfNeeded,
    scrubMailLinksRecord,
    hasRawMailAddress
  };
}
