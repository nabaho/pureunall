#!/usr/bin/env node
/**
 * backfill-union-history.js — 노사관계·단체교섭 과거 이력 비식별 통합 백필
 *
 * 데이터 원천 (read-only):
 *   1) 푸른이알피 /data/companies · /data/cases (기존 노사관계 사건 연결 보조)
 *   2) 푸른 메일 /mailbox/folders · /mailbox/msgs · /mailbox/old/msgs (IMAP + POP3 전수 스캔)
 *   3) 로컬 교섭 폴더(기본: ~/Desktop/7.교섭관련 또는 --local-dir, 파일명·역할 메타만 비식별 수집, 경로 미저장)
 *
 * 쓰기 대상 (PuOntologyWrite enforce 모드 + ETag If-Match 원자적 조건부 PUT):
 *   - /union_rel/cases/{id}      (entityType: 'Case')
 *   - /union_rel/docs/{cid}/{id} (entityType: 'Document')
 *   - /union_rel/mails/{cid}/{id}(entityType: 'Message')
 *
 * 실행 예:
 *   node scripts/backfill-union-history.js --dry-run
 *   node scripts/backfill-union-history.js --apply
 *   node scripts/backfill-union-history.js --audit
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UnionCore = require(path.join(ROOT, 'js', 'pu-union-core.js'));
const OntWrite = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_INSTANCE = 'pureun-erp-default-rtdb';
const PROJECT_ID = 'pureun-erp';
const ACTOR = 'SYSTEM_BACKFILL';

const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|Desktop[\\/])/i;
const UNION_CASE_KW_RE = /(?:노조|노동조합|단체교섭|임단협|임금협상|단협|창구단일화|노동쟁의|쟁의조정|파업|노사협의회|부당노동행위)/i;
const SKIP_TOP_REF_RE = /^(?:\d+\.\s*단협강의|\d+\.\s*노동조합설립|단협프로세스|집단관계|노동쟁의조정신청서$)/i;
const SKIP_FOLDER_TAIL_RE = /(?:단체교섭|임금협상|임단협|단협|교섭|창구\s*단일화|관련\s*자료|법률자문\s*의뢰서|노사관계\s*대응\s*시나리오|교섭\s*요구안|송부|검토|제시안|직원노조|교수노조|부당노동행위|부당해고|일반노조)/gi;
const IGNORE_FILE_RE = /^(?:desktop\.ini|thumbs\.db|\.ds_store|~\$)/i;

function str(v) {
  return v == null ? '' : String(v).trim();
}

function stripUndef(objVal) {
  if (!objVal || typeof objVal !== 'object' || Array.isArray(objVal)) return objVal;
  const out = {};
  Object.keys(objVal).forEach((k) => {
    if (objVal[k] !== undefined) out[k] = objVal[k];
  });
  return out;
}

const META_FIELDS = ['revision', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'];
function stripMetaFields(rec) {
  const cp = Object.assign({}, rec || {});
  META_FIELDS.forEach((k) => { delete cp[k]; });
  return cp;
}

function scrubText(text) {
  return UnionCore.maskPiiStrict(str(text), [], { keepBizNo: true, keepCaseNo: true })
    .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/|Desktop[\\/])/gi, '[로컬경로가림]')
    .trim();
}

function hasLeakInString(s) {
  const t = String(s == null ? '' : s);
  if (!t) return false;
  if (LOCAL_PATH_RE.test(t)) return true;
  if (UnionCore.hasResidualPii(t)) return true;
  return false;
}

function assertCleanPayload(rec) {
  if (!rec || typeof rec !== 'object') return 'invalid_record';
  const idKeys = ['id', 'caseId', 'companyId', 'mailKey', 'key'];
  for (let i = 0; i < idKeys.length; i++) {
    const k = idKeys[i];
    if (rec[k] == null || rec[k] === '') continue;
    const v = String(rec[k]);
    if (LOCAL_PATH_RE.test(v)) return 'local_path_leak:' + k;
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(v)) return 'pii_leak:' + k;
  }
  const textFields = ['companyName', 'unionName', 'title', 'fileName', 'source', 'subject', 'docRoleLabel', 'note'];
  const blob = textFields.map((k) => rec[k]).filter(Boolean).join('\n');
  if (LOCAL_PATH_RE.test(blob)) return 'local_path_leak:text';
  if (UnionCore.hasResidualPii(blob)) return 'pii_leak:text';
  if (Array.isArray(rec.attNames) && hasLeakInString(rec.attNames.join('\n'))) return 'pii_leak:attNames';
  if (Array.isArray(rec.mailLinks) && hasLeakInString(JSON.stringify(rec.mailLinks))) return 'pii_leak:mailLinks';
  if (Array.isArray(rec.rounds) && hasLeakInString(JSON.stringify(rec.rounds))) return 'pii_leak:rounds';
  if (rec.steps && hasLeakInString(JSON.stringify(rec.steps))) return 'pii_leak:steps';
  return '';
}

/* ── Firebase CLI 토큰 & RTDB ETag 조건부 쓰기 ──────────────────────── */
function configstorePath() {
  return path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
}

function readAccessTokenFromStore() {
  const p = configstorePath();
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const t = raw && raw.tokens && raw.tokens.access_token;
  const exp = Number(raw && raw.tokens && raw.tokens.expires_at) || 0;
  return { token: str(t), expiresAt: exp };
}

function runFirebaseCli(args) {
  return execFileSync('firebase', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function loadFreshAccessToken() {
  const cur = readAccessTokenFromStore();
  if (cur && cur.token && cur.expiresAt > Date.now() + 120 * 1000) {
    return cur.token;
  }
  runFirebaseCli(['database:get', '/scal_types', '--instance', DB_INSTANCE, '--project', PROJECT_ID]);
  const next = readAccessTokenFromStore();
  if (!next || !next.token) {
    throw new Error('Firebase CLI 액세스 토큰을 읽을 수 없습니다. firebase login 상태를 확인하세요.');
  }
  return next.token;
}

function rtdbGet(dbPath, token) {
  const reqPath = `${dbPath}.json?access_token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      port: 443,
      path: reqPath,
      method: 'GET'
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`RTDB GET ${dbPath} HTTP ${res.statusCode}`));
        }
        try {
          resolve(txt ? JSON.parse(txt) : null);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rtdbGetWithEtag(dbPath, token) {
  const reqPath = `${dbPath}.json?access_token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      port: 443,
      path: reqPath,
      method: 'GET',
      headers: { 'X-Firebase-ETag': 'true' }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`RTDB GET(ETag) ${dbPath} HTTP ${res.statusCode}`));
        }
        try {
          resolve({
            data: txt ? JSON.parse(txt) : null,
            etag: String((res.headers && res.headers.etag) || '')
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rtdbPutIfMatch(dbPath, token, etag, bodyObj) {
  if (!etag) return Promise.resolve({ committed: false, reason: 'missing_etag' });
  const payload = Buffer.from(JSON.stringify(bodyObj), 'utf8');
  const reqPath = `${dbPath}.json?access_token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      port: 443,
      path: reqPath,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': payload.length,
        'If-Match': etag
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode === 412) {
          return resolve({ committed: false, conflict: true });
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`RTDB PUT(If-Match) ${dbPath} HTTP ${res.statusCode}`));
        }
        resolve({ committed: true });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function conditionalWriteRecord(dbPath, desiredRecord, entityType, gw, token, ioHooks) {
  const hooks = ioHooks || { getWithEtag: rtdbGetWithEtag, putIfMatch: rtdbPutIfMatch };
  const fetched = await hooks.getWithEtag(dbPath, token);
  const latest = (fetched && fetched.data && typeof fetched.data === 'object') ? fetched.data : null;
  const etag = fetched ? String(fetched.etag || '') : '';
  if (!etag) return { committed: false, skipped: 'missing_etag' };

  if (latest) {
    if (latest._deleted === true) return { committed: false, skipped: 'deleted_tombstone' };
    if (latest.updatedBy && latest.updatedBy !== ACTOR) {
      return { committed: false, skipped: 'user_modified' };
    }
  }

  const cleanDesired = stripMetaFields(desiredRecord);
  const merged = stripUndef(Object.assign({}, latest || {}, cleanDesired));
  const expectedRev = latest ? Number(latest.revision || 0) : undefined;
  const prep = gw.prepare(merged, {
    previous: latest || null,
    expectedRevision: expectedRev,
    entityType,
    allowPendingCompany: !str(merged.companyId),
    now: Date.now()
  });

  if (!prep || !prep.ok) {
    return { committed: false, skipped: 'validation_failed', issues: prep && prep.issues };
  }
  return await hooks.putIfMatch(dbPath, token, etag, stripUndef(prep.value));
}

/* ── 로컬 교섭 폴더 비식별 메타 스캔 ───────────────────────────────── */
function normalizeFolderCorpName(rawName, dir) {
  let s = str(rawName).normalize('NFC')
    .replace(/^\d{6}[_-]\s*/, '')
    .replace(/^20\d{2}[.\s_-]*/, '')
    .replace(/^\(\s*([^\)]{2,24})\s*\)/, '$1 ')
    .replace(SKIP_FOLDER_TAIL_RE, ' ')
    .replace(/[-_·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const dirEntries = (dir && Array.isArray(dir.entries)) ? dir.entries : ((dir && Array.isArray(dir.byLen)) ? dir.byLen : []);
  if (dirEntries.length) {
    const normCand = UnionCore.normCorpName(s || rawName);
    for (let i = 0; i < dirEntries.length; i++) {
      const c = dirEntries[i];
      if (c.norm.length >= 2 && (normCand.indexOf(c.norm) >= 0 || UnionCore.normCorpName(rawName).indexOf(c.norm) >= 0)) {
        return { companyId: c.id, companyName: c.name };
      }
    }
  }
  const cleaned = UnionCore.cleanDisplayCompany(s);
  return { companyId: '', companyName: cleaned || '' };
}

function inferYearFromPathParts(parts, mtimeMs) {
  const joined = (parts || []).join(' ');
  const mFull = /(?:^|[^0-9])(202[0-9]|201[5-9]|203[0-5])(?:[^0-9]|$)/.exec(joined);
  if (mFull) return mFull[1];
  const mShort = /(?:^|[^0-9])(2[0-9])[01]\d[0-3]\d(?:[_.\s-]|$)/.exec(joined);
  if (mShort) return '20' + mShort[1];
  return mtimeMs ? String(new Date(mtimeMs).getFullYear()) : String(new Date().getFullYear());
}

function scanLocalUnionFolder(localDir, dir) {
  if (!localDir || !fs.existsSync(localDir)) return [];
  const entries = [];

  function walk(curDir, relParts) {
    let list = [];
    try {
      list = fs.readdirSync(curDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    list.forEach((ent) => {
      if (!ent || !ent.name || IGNORE_FILE_RE.test(ent.name)) return;
      const nextParts = relParts.concat([ent.name]);
      const fullPath = path.join(curDir, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath, nextParts);
        return;
      }
      if (!ent.isFile()) return;
      let st = null;
      try { st = fs.statSync(fullPath); } catch (_) {}
      const topPart = nextParts[0] || '';
      const folderHint = nextParts.slice(0, -1).join(' ');
      const fileName = scrubText(ent.name);
      const yr = inferYearFromPathParts(nextParts, st ? st.mtimeMs : 0);
      const ymd = st && st.mtimeMs ? UnionCore.ymdOf(st.mtimeMs) : (yr + '-01-01');

      let corp = { companyId: '', companyName: '' };
      if (SKIP_TOP_REF_RE.test(topPart) || SKIP_TOP_REF_RE.test(nextParts.slice(0, -1).join('/'))) {
        corp = { companyId: '', companyName: '노사관계 공통자료' };
      } else {
        for (let idx = nextParts.length - 2; idx >= 0; idx--) {
          const seg = nextParts[idx];
          if (/^20\d{2}[.\s_-]*$/.test(seg) || /^20\d{2}\.\s*단체교섭$/i.test(seg)) continue;
          const hit = normalizeFolderCorpName(seg, dir);
          if (hit.companyName && hit.companyName.length >= 2) {
            corp = hit;
            break;
          }
        }
        if (!corp.companyName) {
          const hitTop = normalizeFolderCorpName(topPart, dir);
          corp = hitTop.companyName ? hitTop : { companyId: '', companyName: '노사관계 공통자료' };
        }
      }

      const combined = scrubText(folderHint + ' ' + fileName);
      const track = UnionCore.inferTrack(combined, [fileName], '');
      const roleObj = UnionCore.inferDocRole(fileName, combined, '');
      const performMode = UnionCore.inferPerformMode(combined, [fileName], '', track);
      const roundNo = UnionCore.extractRoundNo(fileName, [folderHint]);

      entries.push({
        companyId: corp.companyId,
        companyName: scrubText(corp.companyName) || '노사관계 공통자료',
        year: yr,
        track,
        performMode,
        roundNo,
        fileName,
        role: roleObj.code,
        roleLabel: roleObj.label,
        group: roleObj.group,
        stepCode: roleObj.stepCode,
        docDate: ymd,
        source: '로컬 폴더(7.교섭관련)'
      });
    });
  }

  walk(localDir, []);
  return entries;
}

/* ── 메일 + ERP + 로컬 병합 수집 ────────────────────────────────────── */
function collectUnionBackfill({ companies, erpCases, mailFolders, mailMsgs, oldMailMsgs, existingUnionCases, dismissed, localDir, skipLocalDirs }) {
  const dir = UnionCore.buildCompanyDirectory(companies);
  const flatMails = UnionCore.flattenMailbox(mailFolders, mailMsgs, oldMailMsgs);
  const scanRes = UnionCore.scanAndGroupUnionMails(flatMails, {
    companies,
    existingCases: existingUnionCases || {},
    dismissed: dismissed || {}
  });

  const caseByKey = new Map();
  const docsByCaseId = new Map();
  const mailsByCaseId = new Map();
  const existingMap = (existingUnionCases && typeof existingUnionCases === 'object') ? existingUnionCases : {};

  function bundleKeyOf(companyId, companyName, year) {
    const coKey = str(companyId) ? ('id:' + str(companyId)) : ('nm:' + (UnionCore.normCorpName(companyName) || UnionCore.safeKey(companyName)));
    return coKey + '|' + str(year || '2026');
  }

  function ensureCase({ preferredId, companyId, companyName, year, track, performMode, title, receiveDate, latestDate, erpCaseId }) {
    const cleanName = scrubText(companyName) || '미분류 사업장';
    const yr = /^20\d{2}$/.test(str(year)) ? str(year) : '2026';
    const bKey = bundleKeyOf(companyId, cleanName, yr);
    const detId = 'ur_' + UnionCore.sha256Hex(bKey).slice(0, 14);
    const hitId = (preferredId && existingMap[preferredId] && !existingMap[preferredId]._deleted)
      ? preferredId
      : ((existingMap[detId] && !existingMap[detId]._deleted) ? detId : '');
    const existingHit = hitId ? existingMap[hitId] : null;
    const cid = existingHit ? str(existingHit.id) : detId;
    let c = caseByKey.get(cid);
    if (!c) {
      const tr = UnionCore.TRACKS[(existingHit && existingHit.track) || track] || UnionCore.TRACKS.bargain;
      const rawPm = (existingHit && existingHit.performMode) || performMode;
      c = {
        id: cid,
        entityType: 'Case',
        companyId: str((existingHit && existingHit.companyId) || companyId),
        companyName: scrubText((existingHit && existingHit.companyName) || cleanName) || cleanName,
        year: (existingHit && existingHit.year) || yr,
        title: scrubText((existingHit && existingHit.title) || title || (yr + '년 ' + tr.short)),
        track: tr.code,
        performMode: (UnionCore.PERFORM_MODES[rawPm] && rawPm) || 'review_advisory',
        status: (existingHit && existingHit.status) || (Number(yr) < new Date().getFullYear() ? 'closed' : 'active'),
        erpCaseId: str((existingHit && existingHit.erpCaseId) || erpCaseId),
        receiveDate: str((existingHit && existingHit.receiveDate) || receiveDate) || (yr + '-01-01'),
        latestDate: str((existingHit && existingHit.latestDate) || latestDate || receiveDate) || (yr + '-01-01'),
        steps: (existingHit && existingHit.steps) || UnionCore.buildCaseStepsDefault(),
        mailLinks: Array.isArray(existingHit && existingHit.mailLinks) ? existingHit.mailLinks.slice() : [],
        source: (existingHit && existingHit.source) || 'backfill',
        _mails: [],
        _docs: []
      };
      caseByKey.set(cid, c);
    } else {
      if (!c.companyId && str(companyId)) c.companyId = str(companyId);
      if (!c.erpCaseId && str(erpCaseId)) c.erpCaseId = str(erpCaseId);
      if (receiveDate && (!c.receiveDate || receiveDate < c.receiveDate)) c.receiveDate = receiveDate;
      if (latestDate && (!c.latestDate || latestDate > c.latestDate)) c.latestDate = latestDate;
    }
    return c;
  }

  /* 1. 메일 스캔 결과 적재 (기존 연결 + 미등록 묶음 모두) */
  scanRes.unionMails.forEach((m) => {
    const c = ensureCase({
      preferredId: m.linkedCaseId,
      companyId: m.companyId,
      companyName: m.companyName,
      year: m.year,
      track: m.track,
      performMode: m.performMode,
      receiveDate: m.date,
      latestDate: m.date
    });
    const mid = 'ml_' + UnionCore.sha256Hex(m.key).slice(0, 14);
    const mRec = {
      id: mid,
      entityType: 'Message',
      caseId: c.id,
      companyId: c.companyId,
      companyName: c.companyName,
      mailKey: m.key,
      key: m.key,
      slug: str(m.slug),
      uid: str(m.uid),
      old: !!m.old,
      dir: str(m.dir) || 'in',
      date: str(m.date),
      year: m.year,
      subject: scrubText(m.subject),
      track: m.track,
      docGroup: m.docGroup,
      docRole: m.docRole,
      stepCode: m.stepCode,
      attNames: (m.attNames || []).map(scrubText).filter(Boolean)
    };
    if (!mailsByCaseId.has(c.id)) mailsByCaseId.set(c.id, new Map());
    mailsByCaseId.get(c.id).set(mid, mRec);
    c._mails.push(mRec);
    if (!c.mailLinks.some((x) => x.key === m.key)) {
      c.mailLinks.push({ key: m.key, date: str(m.date), subject: mRec.subject.slice(0, 80) });
    }

    (m.docItems || []).forEach((di, idx) => {
      if (!di.fileName) return;
      const fn = scrubText(di.fileName);
      const did = 'ud_' + UnionCore.sha256Hex(c.id + '|' + m.key + '|' + fn + '|' + idx).slice(0, 14);
      const dRec = {
        id: did,
        entityType: 'Document',
        caseId: c.id,
        companyId: c.companyId,
        companyName: c.companyName,
        year: c.year,
        group: di.group,
        role: di.role,
        roleLabel: di.roleLabel,
        stepCode: di.stepCode,
        title: fn,
        fileName: fn,
        source: '푸른 메일 백필',
        reviewState: di.group === 'signed' ? 'final' : 'pending',
        docDate: str(m.date),
        mailKey: m.key
      };
      if (!docsByCaseId.has(c.id)) docsByCaseId.set(c.id, new Map());
      docsByCaseId.get(c.id).set(did, dRec);
      c._docs.push(dRec);
    });
  });

  /* 2. ERP /data/cases 중 노사관계·교섭 키워드 건 연결/보완 */
  UnionCore.rowsOf(erpCases).forEach((ec) => {
    const hay = [ec.title, ec.typeName, ec.category, ec.memo].map(str).join(' ');
    if (!UNION_CASE_KW_RE.test(hay)) return;
    const yr = UnionCore.caseYearOf({ year: ec.year, receiveDate: ec.receiveDate || ec.contractDate || ec.createdAt }) || '2025';
    const tr = UnionCore.inferTrack(hay, [], '');
    const c = ensureCase({
      companyId: str(ec.companyId),
      companyName: str(ec.companyName || ec.coName),
      year: yr,
      track: tr,
      performMode: 'review_advisory',
      receiveDate: UnionCore.ymdOf(ec.receiveDate || ec.contractDate || ec.createdAt),
      erpCaseId: str(ec.id)
    });
    if (ec.status === 'done' || ec.status === 'closed') c.status = 'closed';
  });

  /* 3. 로컬 폴더 (7.교섭관련) 메타데이터 비식별 적재 */
  const localItems = skipLocalDirs ? [] : scanLocalUnionFolder(localDir, dir);
  localItems.forEach((li, idx) => {
    const c = ensureCase({
      companyId: li.companyId,
      companyName: li.companyName,
      year: li.year,
      track: li.track,
      performMode: li.performMode,
      receiveDate: li.docDate,
      latestDate: li.docDate
    });
    const did = 'ud_' + UnionCore.sha256Hex(c.id + '|local|' + li.fileName + '|' + li.docDate + '|' + idx).slice(0, 14);
    const dRec = {
      id: did,
      entityType: 'Document',
      caseId: c.id,
      companyId: c.companyId,
      companyName: c.companyName,
      year: li.year,
      group: li.group,
      role: li.role,
      roleLabel: li.roleLabel,
      stepCode: li.stepCode,
      title: li.fileName,
      fileName: li.fileName,
      source: li.source,
      reviewState: li.group === 'signed' ? 'final' : 'pending',
      docDate: li.docDate,
      roundNo: li.roundNo || ''
    };
    if (!docsByCaseId.has(c.id)) docsByCaseId.set(c.id, new Map());
    docsByCaseId.get(c.id).set(did, dRec);
    c._docs.push(dRec);
  });

  /* 4. 단계 자동 재구성 및 내부 임시필드 제거 */
  const cases = Array.from(caseByKey.values()).map((c) => {
    c.steps = UnionCore.reconstructStepsFromMails(c.steps, c._mails, c._docs);
    const out = Object.assign({}, c);
    delete out._mails;
    delete out._docs;
    return out;
  });

  return {
    cases,
    docsByCaseId,
    mailsByCaseId,
    stats: {
      mailScannedCount: flatMails.length,
      unionMailCount: scanRes.unionMails.length,
      localFileCount: localItems.length,
      discoveredCases: cases.length
    }
  };
}

async function runAudit(token) {
  const cur = (await rtdbGet('/union_rel', token)) || {};
  const cases = cur.cases || {};
  const docs = cur.docs || {};
  const clauses = cur.clauses || {};
  const mails = cur.mails || {};
  const leaks = [];
  let caseCnt = 0, docCnt = 0, clauseCnt = 0, mailCnt = 0;

  Object.keys(cases).forEach((cid) => {
    const c = cases[cid];
    if (!c || c._deleted) return;
    caseCnt++;
    const err = assertCleanPayload(c);
    if (err) leaks.push(`cases/${cid}: ${err}`);
  });
  [
    ['docs', docs, () => docCnt++],
    ['clauses', clauses, () => clauseCnt++],
    ['mails', mails, () => mailCnt++]
  ].forEach(([kind, rootBucket, inc]) => {
    Object.keys(rootBucket).forEach((cid) => {
      const bucket = rootBucket[cid] || {};
      Object.keys(bucket).forEach((rid) => {
        const rec = bucket[rid];
        if (!rec || rec._deleted) return;
        inc();
        const err = assertCleanPayload(rec);
        if (err) leaks.push(`${kind}/${cid}/${rid}: ${err}`);
      });
    });
  });

  console.log(JSON.stringify({
    ok: leaks.length === 0,
    caseCnt,
    docCnt,
    clauseCnt,
    mailCnt,
    leakCount: leaks.length,
    leaks: leaks.slice(0, 10)
  }, null, 2));
  if (leaks.length) process.exit(1);
}

async function runPool(items, concurrency, workerFn) {
  let idx = 0;
  const results = [];
  const cap = Math.max(1, Math.min(concurrency, items.length || 1));
  const workers = Array.from({ length: cap }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await workerFn(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doAudit = args.includes('--audit');
  const skipLocalDirs = args.includes('--skip-local');
  const localIdx = args.indexOf('--local-dir');
  const localDir = localIdx >= 0 && args[localIdx + 1]
    ? args[localIdx + 1]
    : path.join(os.homedir(), 'Desktop', '7.교섭관련');

  const token = loadFreshAccessToken();
  if (doAudit) {
    await runAudit(token);
    return;
  }

  const [companies, erpCases, mailFolders, mailMsgs, oldMailMsgs, curUnion] = await Promise.all([
    rtdbGet('/data/companies', token),
    rtdbGet('/data/cases', token),
    rtdbGet('/mailbox/folders', token),
    rtdbGet('/mailbox/msgs', token),
    rtdbGet('/mailbox/old/msgs', token),
    rtdbGet('/union_rel', token)
  ]);

  const built = collectUnionBackfill({
    companies,
    erpCases,
    mailFolders,
    mailMsgs,
    oldMailMsgs,
    existingUnionCases: (curUnion && curUnion.cases) || {},
    dismissed: (curUnion && curUnion.dismissed) || {},
    localDir,
    skipLocalDirs
  });

  let blockedLeaks = 0;
  const cleanCases = [];
  const byYear = {};
  const byTrack = {};
  const byDocGroup = {};

  built.cases.forEach((c) => {
    const err = assertCleanPayload(c);
    if (err) { blockedLeaks++; return; }
    cleanCases.push(c);
    byYear[c.year] = (byYear[c.year] || 0) + 1;
    byTrack[c.track] = (byTrack[c.track] || 0) + 1;
  });

  const cleanDocs = [];
  const cleanMails = [];
  cleanCases.forEach((c) => {
    const dm = built.docsByCaseId.get(c.id);
    if (dm) {
      dm.forEach((d) => {
        if (assertCleanPayload(d)) { blockedLeaks++; return; }
        cleanDocs.push(d);
        byDocGroup[d.group] = (byDocGroup[d.group] || 0) + 1;
      });
    }
    const mm = built.mailsByCaseId.get(c.id);
    if (mm) {
      mm.forEach((m) => {
        if (assertCleanPayload(m)) { blockedLeaks++; return; }
        cleanMails.push(m);
      });
    }
  });

  console.log(JSON.stringify({
    mode: doApply ? 'apply' : 'dry-run',
    mailScannedCount: built.stats.mailScannedCount,
    unionMailCount: built.stats.unionMailCount,
    localFileCount: built.stats.localFileCount,
    discoveredCases: cleanCases.length,
    discoveredDocs: cleanDocs.length,
    discoveredMails: cleanMails.length,
    blockedLeaks,
    byYear,
    byTrack,
    byDocGroup
  }, null, 2));

  if (blockedLeaks > 0) {
    console.error(`FAIL: ${blockedLeaks}건의 PII 또는 로컬경로 누출이 감지되어 중단합니다.`);
    process.exit(1);
  }
  if (!doApply) return;

  const gw = OntWrite.createGateway({ mode: 'enforce', actor: ACTOR });
  let writtenCases = 0, writtenDocs = 0, writtenMails = 0, skipped = 0;

  await runPool(cleanCases, 8, async (c) => {
    const r = await conditionalWriteRecord(`/union_rel/cases/${c.id}`, c, 'Case', gw, token);
    if (r && r.committed) writtenCases++; else skipped++;
  });
  await runPool(cleanDocs, 8, async (d) => {
    const r = await conditionalWriteRecord(`/union_rel/docs/${d.caseId}/${d.id}`, d, 'Document', gw, token);
    if (r && r.committed) writtenDocs++; else skipped++;
  });
  await runPool(cleanMails, 8, async (m) => {
    const r = await conditionalWriteRecord(`/union_rel/mails/${m.caseId}/${m.id}`, m, 'Message', gw, token);
    if (r && r.committed) writtenMails++; else skipped++;
  });

  console.log(JSON.stringify({ applied: true, writtenCases, writtenDocs, writtenMails, skipped }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  collectUnionBackfill,
  assertCleanPayload,
  scanLocalUnionFolder,
  normalizeFolderCorpName,
  conditionalWriteRecord,
  scrubText
};
