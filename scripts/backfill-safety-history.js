#!/usr/bin/env node
/* 푸른통합시스템 — 안전보건체계구축 과거 수행이력(2022~2026) 비식별 통합 백필 스크립트
 *
 * 맡는 일:
 *   1. RTDB 원천(/mailbox/msgs · /data/companies · /data/consultings · /scal_cos · /scal_types)과
 *      로컬 컨설팅 폴더(안전보건컨설팅 · 사회복지사 안전체계 · 위키 색인)에서 과거·진행 안전보건 사업장을 집계한다.
 *   2. 일반 자문사·급여사 명단(`2023년안전보건컨설팅.xlsx`) 및 개별 산재보상 사건(`요양/유족/심사청구`),
 *      수행 인력 개인정보 서류는 100% 배제한다.
 *   3. 8대 업종(제조 일반·특화, 유통물류, 서비스시설, 의료복지, 숙박외식, 교육사무, 건설도급) 및
 *      6대 수행트랙으로 분류하여 `/scal_safety/projects/{id}` 및 비식별 요약 카드로 적재한다.
 *   4. 모든 쓰기는 PuOntologyWrite + RTDB ETag(If-Match) 조건부 원자적 PUT 을 사용하며,
 *      주민번호·전화·이메일·계좌·로컬 경로 잔존 검사를 통과한 레코드만 기록한다.
 *
 * 실행:
 *   node scripts/backfill-safety-history.js --dry-run
 *   node scripts/backfill-safety-history.js --apply
 *   node scripts/backfill-safety-history.js --audit
 */
'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const Cat = require(path.join(ROOT, 'js', 'pu-safety-catalog.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-safety-intake.js'));
const OntWrite = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';
const CLI_ARG_SAFE_RE = /^[A-Za-z0-9._:/=\-]+$/;
const LOCAL_PATH_RE = /[A-Za-z]:\\|\/Users\/|\\Desktop\\|\\Downloads\\|\\바탕 화면\\|\\Documents\\/i;

function str(v) { return v == null ? '' : String(v).trim(); }
function rowsOf(v) {
  const x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter(r => r && typeof r === 'object');
  if (x && typeof x === 'object') return Object.keys(x).map(k => x[k]).filter(r => r && typeof r === 'object');
  return [];
}
function stripUndef(v) {
  if (Array.isArray(v)) return v.filter(x => x !== undefined).map(stripUndef);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = stripUndef(v[k]); });
    return o;
  }
  return v;
}

function runFirebaseCli(args) {
  const argList = Array.isArray(args) ? args.map(String) : String(args || '').trim().split(/\s+/).filter(Boolean);
  if (!argList.length || !argList.every(a => CLI_ARG_SAFE_RE.test(a))) throw new Error('INVALID_FIREBASE_CLI_ARGS');
  if (process.platform === 'win32') {
    const fbJs = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    if (fs.existsSync(fbJs)) {
      return execFileSync(process.execPath, [fbJs, ...argList], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    }
  }
  return execFileSync('firebase', argList, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
}

function loadFreshAccessToken() {
  runFirebaseCli(['database:get', '/scal_types', '--instance', 'pureun-erp-default-rtdb', '--project', 'pureun-erp']);
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const tok = parsed && parsed.tokens && parsed.tokens.access_token;
  if (!tok) throw new Error('Firebase CLI access_token 을 찾을 수 없습니다.');
  return tok;
}

function encodeDbPath(dbPath) {
  return String(dbPath || '').split('/').map(s => (s ? encodeURIComponent(s) : '')).join('/');
}

function rtdbGet(dbPath, token) {
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST, port: 443, path: reqPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`GET ${dbPath} HTTP ${res.statusCode}`));
        resolve(txt ? JSON.parse(txt) : null);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rtdbGetWithEtag(dbPath, token) {
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST, port: 443, path: reqPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-Firebase-ETag': 'true' }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`GET(ETag) ${dbPath} HTTP ${res.statusCode}`));
        resolve({ data: txt ? JSON.parse(txt) : null, etag: String((res.headers && res.headers.etag) || '') });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rtdbPutIfMatch(dbPath, token, etag, bodyObj) {
  if (!etag) return Promise.resolve({ committed: false, reason: 'missing_etag' });
  const payload = Buffer.from(JSON.stringify(bodyObj), 'utf8');
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST, port: 443, path: reqPath, method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length, 'If-Match': etag }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode === 412) return resolve({ committed: false, conflict: true });
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`PUT ${dbPath} HTTP ${res.statusCode}`));
        resolve({ committed: true });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const META_FIELDS = ['revision', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'];
function stripMetaFields(rec) {
  const cp = Object.assign({}, rec || {});
  META_FIELDS.forEach(k => { delete cp[k]; });
  return cp;
}

async function conditionalWriteRecord(dbPath, desiredRecord, entityType, gw, token) {
  const fetched = await rtdbGetWithEtag(dbPath, token);
  const latest = (fetched && fetched.data && typeof fetched.data === 'object') ? fetched.data : null;
  const etag = fetched ? String(fetched.etag || '') : '';
  if (!etag) return { committed: false, skipped: 'missing_etag' };

  if (latest) {
    if (latest._deleted === true) return { committed: false, skipped: 'deleted_tombstone' };
    if (latest.updatedBy && latest.updatedBy !== 'SYSTEM_BACKFILL') return { committed: false, skipped: 'user_modified' };
  }

  const now = Date.now();
  const cleanDesired = stripMetaFields(desiredRecord);
  const merged = stripUndef(Object.assign({}, latest || {}, cleanDesired));
  const prep = gw.prepare(merged, {
    previous: latest || null,
    expectedRevision: latest ? Number(latest.revision || 0) : undefined,
    entityType,
    now
  });
  if (!prep || !prep.ok) return { committed: false, skipped: 'validation_failed', issues: prep && prep.issues };
  return await rtdbPutIfMatch(dbPath, token, etag, stripUndef(prep.value));
}

/* ══ 로컬 디렉터리 안전 순회 ═════════════════════════════════════════════ */
function walkFilesSafe(rootDir) {
  const entries = [];
  if (!rootDir || !fs.existsSync(rootDir)) return entries;
  function walk(curDir, rel) {
    let items = [];
    try { items = fs.readdirSync(curDir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of items) {
      const full = path.join(curDir, d.name);
      const nextRel = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) walk(full, nextRel);
      else if (d.isFile()) entries.push({ fullPath: full, relPath: nextRel, name: d.name });
    }
  }
  walk(rootDir, path.basename(rootDir));
  return entries;
}

function scrubTextStrict(raw) {
  const masked = Intake.maskPiiStrict(String(raw || ''), []).text;
  return masked.replace(LOCAL_PATH_RE, '[로컬경로]').replace(/\s+/g, ' ').trim();
}

function assertCleanPayload(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const idFields = ['id', 'companyId', 'projectId', 'mailKey'];
  for (const k of idFields) {
    if (o[k] == null || o[k] === '') continue;
    const v = String(o[k]);
    if (LOCAL_PATH_RE.test(v)) return 'local_path_leak';
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(v)) return 'pii_leak';
    if (k !== 'mailKey' && !/^[A-Za-z0-9가-힣._:\-]+$/.test(v)) return 'pii_leak';
  }
  const textFields = ['companyName', 'summaryNote', 'source', 'title', 'maskedExcerpt', 'summaryLines', 'consultantName'];
  const textBlob = JSON.stringify(textFields.map(k => o[k]).filter(Boolean));
  if (LOCAL_PATH_RE.test(textBlob)) return 'local_path_leak';
  if (Intake.hasResidualPii(textBlob)) return 'pii_leak';
  return '';
}

function normalizeDisplayCompany(rawName) {
  return str(rawName).normalize('NFC')
    .replace(/\[(?:📥\s*)?([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^📥\s*/, '')
    .replace(/^[\d._\-\s]+/, '')
    .replace(/\s*\([^)]*202\d[^)]*\)/g, '')
    .replace(/\s*중처법.*$/, '')
    .replace(/\s*우수사례.*$/, '')
    .replace(/^(?:주식회사|㈜|\(주\))\s*/, '㈜')
    .trim();
}

/* ══ 후보 수집기 ══════════════════════════════════════════════════════════ */
function collectSafetyProjectsAndCards({ companies, consultings, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs, skipLocalDirs }) {
  const coList = rowsOf(companies);
  const coByNorm = new Map();
  coList.forEach(c => {
    const n = Intake.normCorpName(c && c.name);
    if (n.length >= 2 && !coByNorm.has(n)) coByNorm.set(n, c);
  });

  const projectsByKey = new Map();
  const cardsByPid = new Map();

  function upsertProject(raw) {
    const cleanName = normalizeDisplayCompany(raw.companyName);
    const norm = Intake.normCorpName(cleanName);
    if (!norm || norm.length < 2) return null;
    if (/^(공단|고용노동부|근로복지공단|한국산업안전보건공단|안전보건공단|대한산업보건협회|푸른노무법인|법무법인|참여사업장|표준|공통|발표|자료|안내|계획|명단|매뉴얼|양식|요약|대상|선정|전체)$/.test(norm)) return null;

    const year = Number(raw.year) || 2025;
    const co = coByNorm.get(norm) || null;
    const safeCidRaw = str(co ? co.id : (raw.companyId || ('sfco_' + Intake.safeIdPart(norm))));
    const companyId = safeCidRaw.replace(/[^A-Za-z0-9가-힣._:\-]+/g, '_').replace(/^_+|_+$/g, '') || ('sfco_' + Intake.sha256Hex(norm).slice(0, 10));
    const indCode = raw.industryCode || Intake.inferIndustryCode(cleanName, co && co.bizType, co && co.bizItem, raw.hintText);
    const trackCode = raw.track || Intake.inferTrackCode(raw.hintText || cleanName, indCode);
    const key = norm + ':' + year;

    let proj = projectsByKey.get(key);
    const pid = ('sf_' + Intake.safeIdPart(companyId) + '_' + year).replace(/[^A-Za-z0-9가-힣._:\-]+/g, '_');
    const ind = Cat.getIndustry(indCode);
    const tr = Cat.getTrack(trackCode);

    if (!proj) {
      proj = {
        id: pid,
        entityType: 'Project',
        companyId,
        companyName: str(co ? co.name : cleanName),
        year,
        industryCode: ind.code,
        extraIndustries: [],
        track: tr.code,
        selectedHazards: ind.recommendedHazards.slice(),
        workerCount: Number(raw.workerCount || (co && co.workerCount) || 0),
        status: year < 2026 ? 'archive' : 'active',
        roundCount: Number(raw.roundCount || (year < 2026 ? tr.defaultRounds : 1)),
        source: str(raw.source || '이력 백필'),
        summaryNote: scrubTextStrict(raw.summaryNote || (ind.short + ' · ' + tr.short + ' 수행')),
        consultantName: '푸른노무법인 전담 공인노무사'
      };
      projectsByKey.set(key, proj);
    } else {
      if (raw.source && proj.source.indexOf(raw.source) < 0) {
        proj.source = (proj.source + ' · ' + raw.source).slice(0, 60);
      }
      if (raw.summaryNote && proj.summaryNote.length < 140) {
        const extra = scrubTextStrict(raw.summaryNote);
        if (extra && proj.summaryNote.indexOf(extra) < 0) {
          proj.summaryNote = (proj.summaryNote + ' / ' + extra).slice(0, 180);
        }
      }
      if (raw.workerCount && !proj.workerCount) proj.workerCount = Number(raw.workerCount);
    }
    return proj;
  }

  function addCard(proj, cardObj) {
    if (!proj || !cardObj) return;
    if (!cardsByPid.has(proj.id)) cardsByPid.set(proj.id, new Map());
    const map = cardsByPid.get(proj.id);
    if (!map.has(cardObj.id)) map.set(cardObj.id, cardObj);
  }

  /* 1. Desktop 안전보건컨설팅 폴더 (2023년안전보건컨설팅.xlsx 자문사명단 제외!) */
  const desktopDir = path.join(os.homedir(), 'Desktop');
  const safetyDir = path.join(desktopDir, '컨설팅업체', '9 안전보건컨설팅');
  if (!skipLocalDirs && fs.existsSync(safetyDir)) {
    const entries = walkFilesSafe(safetyDir);
    const grouped = Intake.groupSafetyFolderEntries(entries, { rootDirName: '9 안전보건컨설팅' });
    grouped.groups.forEach(g => {
      const p = upsertProject({
        companyName: g.companyName,
        year: g.year,
        industryCode: g.industryCode,
        track: g.track,
        source: '로컬 폴더 아카이브',
        summaryNote: `보관 서류 ${g.fileCount}종 확인 (${Object.keys(g.docKindCounts).slice(0, 4).join(', ')})`
      });
      if (p) {
        addCard(p, {
          id: 'sfdir_' + Intake.sha256Hex(p.id).slice(0, 12),
          title: '과거 수행 서류 묶음 요약 (' + g.fileCount + '건)',
          docKind: 'summary_rpt',
          docKindName: '14. 종합보고서 · 핵심 개선사항 1P 요약보고서',
          source: 'local',
          piiStripped: true,
          maskedExcerpt: scrubTextStrict('로컬 안전보건 폴더에서 ' + g.fileCount + '건의 구축 서류 분류 확인됨.'),
          summaryLines: ['폴더 보유 서류 ' + g.fileCount + '건 비식별 집계'],
          analyzedAt: Date.now()
        });
      }
    });

    /* 선정명단 엑셀 파싱 (1차_11.xlsx 등 — 2023년안전보건컨설팅.xlsx 절대 제외) */
    entries.forEach(ent => {
      if (!/\.(xlsx|xls)$/i.test(ent.name)) return;
      if (/2023년안전보건컨설팅\.xlsx$/i.test(ent.name)) return;
      if (!/선정\s*명단|우수사례/.test(ent.name)) return;
      try {
        const st = fs.statSync(ent.fullPath);
        if (st.size > 15 * 1024 * 1024) return;
        const wb = XLSX.read(fs.readFileSync(ent.fullPath), { type: 'buffer' });
        (wb.SheetNames || []).forEach(sn => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
          let corpCol = -1, itemCol = -1, indCol = -1;
          for (let r = 0; r < Math.min(10, rows.length); r++) {
            const line = (rows[r] || []).map(str);
            line.forEach((cell, idx) => {
              if (/사업장명|업체명|기업명|기관명/.test(cell) && corpCol < 0) corpCol = idx;
              if (/주요품목|품목|생산품/.test(cell) && itemCol < 0) itemCol = idx;
              if (/^업종$|업종코드|업종명/.test(cell) && indCol < 0) indCol = idx;
            });
            if (corpCol >= 0) {
              for (let rr = r + 1; rr < rows.length; rr++) {
                const rawCorp = str(rows[rr] && rows[rr][corpCol]);
                if (!rawCorp || /사업장명|합계|소계|^연번$/.test(rawCorp)) continue;
                const itemVal = itemCol >= 0 ? str(rows[rr] && rows[rr][itemCol]) : '';
                const indVal = indCol >= 0 ? str(rows[rr] && rows[rr][indCol]) : '';
                const ym = /(202[2-9])/.exec(ent.relPath);
                upsertProject({
                  companyName: rawCorp,
                  year: ym ? Number(ym[1]) : 2023,
                  hintText: ent.relPath + ' ' + itemVal + ' ' + indVal,
                  source: '공단 위탁 선정명단',
                  summaryNote: itemVal ? '품목: ' + itemVal : '2023 공단 체계구축 위탁 선정 사업장'
                });
              }
              break;
            }
          }
        });
      } catch (e) {}
    });

    /* 우수사례 파일명에서 수행 기업 추출 */
    entries.forEach(ent => {
      const mEx = /우수사례[_\s]+([^\s_().]+)/.exec(ent.name);
      if (mEx && mEx[1]) {
        upsertProject({
          companyName: mEx[1],
          year: /(202[2-9])/.test(ent.relPath) ? Number(/(202[2-9])/.exec(ent.relPath)[1]) : 2023,
          hintText: ent.relPath,
          source: '공단 우수사례',
          summaryNote: '공단 체계구축 우수사례 발표·수행 사업장'
        });
      }
    });
  }

  /* 2. 2026 사회복지사 안전체계 구축사업 */
  const pubWelfareDir = path.join(desktopDir, '컨설팅업체', '1. 공공기관컨설팅', '2026 공공기관 컨설팅', '2026사회복지사 안전체계 구축사업 『노무상담』 신청자 연계');
  if (!skipLocalDirs && fs.existsSync(pubWelfareDir)) {
    walkFilesSafe(pubWelfareDir).forEach(ent => {
      const m = /^\d+\.\s*([^_]+)_노무상담/.exec(ent.name);
      if (m && m[1]) {
        upsertProject({
          companyName: m[1],
          year: 2026,
          industryCode: 'medical_welfare',
          track: 'welfare_pub',
          source: '2026 사회복지 안전체계',
          summaryNote: '사회복지·종사자 안전체계 구축 및 노무상담 연계 기관'
        });
      }
    });
  }

  /* 3. ERP · 정부사업일정 안전보건 후보 */
  const erpCands = Intake.discoverSafetyCandidates({
    companies, consultings, bizTypes, scalCos, scalTypes, registeredProjects: []
  });
  erpCands.forEach(c => {
    upsertProject({
      companyId: c.companyId,
      companyName: c.companyName,
      year: c.year,
      industryCode: c.industryCode,
      track: c.track,
      source: c.source,
      summaryNote: c.bizLabel
    });
  });

  /* 4. 푸른메일함(전 폴더) 스캔 — 안전보건컨설팅 송수신 메일만 (개인 산재보상 100% 제외) */
  const flatMails = Intake.flattenMailboxRows(mailFolders || {}, mailMsgs || {});
  const bracketStopRe = /^(?:긴급|안내|공지|요청|회신|재송부|참고|공문|중요|외부|내부|첨부|안전보건공단|안전보건|고용노동부|푸른노무법인|중대재해|위험성평가|선정|발송|결과)$/;
  flatMails.forEach(m => {
    if (!Intake.isSafetyConsultingMail(m.subject, m.attNames)) return;
    const combinedText = m.subject + ' ' + (m.attNames || []).join(' ');
    const subjNorm = Intake.normCorpName(combinedText);
    const yr = Number((m.date || '').slice(0, 4)) || 2024;
    let matchedName = '';
    let matchedCo = null;

    for (const co of coList) {
      const nn = Intake.normCorpName(co && co.name);
      if (nn.length >= 2 && subjNorm.indexOf(nn) >= 0) {
        matchedName = co.name;
        matchedCo = co;
        break;
      }
    }
    if (!matchedName) {
      const bm = /[\[\(]((?:주식회사|㈜|\(주\)|[가-힣A-Za-z0-9·()\s]){2,20})[\]\)]/.exec(combinedText);
      if (bm && bm[1]) {
        const cleaned = normalizeDisplayCompany(bm[1]);
        const nn2 = Intake.normCorpName(cleaned);
        if (nn2.length >= 2 && !bracketStopRe.test(nn2) && !/^202\d$/.test(nn2) && !/^1차|2차|회차$/.test(nn2)) matchedName = cleaned;
      }
    }
    if (!matchedName) {
      const cm = /((?:㈜|\(주\)|주식회사)?\s*[가-힣A-Za-z]{2,12}(?:회계법인|복지관|요양원|복지센터|서비스원|모터스|크라샤|케미칼|공업|테크|산업|하우징|웰푸드|식품|푸드|엔지니어링|메카닉스|테이프|정공|기전|디지컴|전자|마음터|농공단지|에스메카|에스앤씨|로스윈|네오텍|이노베이스|에스에프이|씨티에스|반도기전|에프앤티))/.exec(combinedText);
      if (cm && cm[1] && cm[1] !== '푸른노무법인') matchedName = cm[1].trim();
    }
    if (!matchedName) return;

    const p = upsertProject({
      companyId: matchedCo ? matchedCo.id : '',
      companyName: matchedName,
      year: yr,
      hintText: combinedText,
      source: '푸른메일함 이력',
      summaryNote: scrubTextStrict(m.subject)
    });
    if (p) {
      const dk = Intake.classifySafetyDocKind(m.subject, m.attNames, '');
      addCard(p, {
        id: 'sfm_' + Intake.sha256Hex(m.key).slice(0, 12),
        title: scrubTextStrict(m.subject).slice(0, 70) || '안전보건 메일 이력',
        mailKey: m.key,
        docKind: dk.code,
        docKindName: dk.name,
        source: 'mail',
        date: m.date,
        piiStripped: true,
        maskedExcerpt: scrubTextStrict('제목: ' + m.subject + (m.attNames.length ? ' / 첨부: ' + m.attNames.join(', ') : '')),
        summaryLines: ['[' + dk.name + '] ' + (m.date || '') + ' 메일 이력 비식별 추출'],
        analyzedAt: Date.now()
      });
    }
  });

  /* 5. LLM-Wiki 안전보건 메일 색인 보조 스캔 (os.homedir() 기준 동적 경로 — 실제 안전체계/위험성/안전컨설팅 메일 제목만 선별) */
  const SAFETY_SUBJ_ONLY_RE = /안전\s*보건\s*(?:관리)?체계|위험성\s*평가|중대\s*재해.*(?:예방|컨설팅|체계)|안전\s*컨설팅|안전\s*체계/i;
  const EXCLUDE_AGENCY_RE = /^(?:공단|고용노동부|근로복지공단|한국산업안전보건공단|안전보건공단|대한산업보건협회|천안노동법률사무소|고용과산재|푸른노무법인|법무법인|참여사업장|표준|공통|개별의뢰인|공문)$/;
  const wikiBase = path.join(os.homedir(), 'llm-wiki', '03_푸른메일_사건별_회사별_전체정리');
  const wikiListPath = path.join(wikiBase, '02_회사및기관별_유입메일_사건_총람', '01_중소교신기업_전체목록_사건분류표.md');
  if (!skipLocalDirs && fs.existsSync(wikiListPath)) {
    fs.readFileSync(wikiListPath, 'utf8').split(/\r?\n/).forEach(ln => {
      if (!/\|/.test(ln)) return;
      const cols = ln.split('|').map(s => s.trim()).filter(Boolean);
      if (cols.length < 8) return;
      const subjCol = cols[7] || '';
      if (!SAFETY_SUBJ_ONLY_RE.test(subjCol)) return;
      const candCorp = normalizeDisplayCompany(cols[1]);
      if (candCorp.length >= 2 && !EXCLUDE_AGENCY_RE.test(Intake.normCorpName(candCorp))) {
        upsertProject({
          companyName: candCorp,
          year: /(202[2-9])/.test(cols[6] + subjCol) ? Number(/(202[2-9])/.exec(cols[6] + subjCol)[1]) : 2024,
          hintText: subjCol,
          source: '메일정리 색인',
          summaryNote: scrubTextStrict(subjCol)
        });
      }
    });
  }
  const wikiSafetyPath = path.join(wikiBase, '01_사건및업무유형별_유입자료_상세', '07_산재보상_업무상질병_산업안전_중대재해.md');
  if (!skipLocalDirs && fs.existsSync(wikiSafetyPath)) {
    fs.readFileSync(wikiSafetyPath, 'utf8').split(/\r?\n/).forEach(ln => {
      if (!/\|/.test(ln)) return;
      const cols = ln.split('|').map(s => s.trim()).filter(Boolean);
      if (cols.length < 4) return;
      const subjCol = cols[3] || '';
      if (!SAFETY_SUBJ_ONLY_RE.test(subjCol)) return;
      const candCorp = normalizeDisplayCompany(cols[2]);
      if (candCorp.length >= 2 && !EXCLUDE_AGENCY_RE.test(Intake.normCorpName(candCorp))) {
        upsertProject({
          companyName: candCorp,
          year: /(202[2-9])/.test(cols[0] + subjCol) ? Number(/(202[2-9])/.exec(cols[0] + subjCol)[1]) : 2026,
          hintText: subjCol,
          source: '안전·중대재해 메일색인',
          summaryNote: scrubTextStrict(subjCol)
        });
      }
    });
  }

  return {
    projects: Array.from(projectsByKey.values()),
    cardsByPid,
    mailScannedCount: flatMails.length
  };
}

async function runAudit(token) {
  const cur = await rtdbGet('/scal_safety', token);
  const projs = (cur && cur.projects) || {};
  const intake = (cur && cur.intake) || {};
  const leaks = [];
  let projCnt = 0, cardCnt = 0;

  Object.keys(projs).forEach(pid => {
    const p = projs[pid];
    if (!p || p._deleted) return;
    projCnt++;
    const err = assertCleanPayload(p);
    if (err) leaks.push(`projects/${pid}: ${err}`);
  });
  Object.keys(intake).forEach(pid => {
    const bucket = intake[pid] || {};
    Object.keys(bucket).forEach(cid => {
      const c = bucket[cid];
      if (!c || c._deleted) return;
      cardCnt++;
      const err = assertCleanPayload(c);
      if (err) leaks.push(`intake/${pid}/${cid}: ${err}`);
    });
  });
  console.log(JSON.stringify({ ok: leaks.length === 0, projCnt, cardCnt, leakCount: leaks.length, leaks: leaks.slice(0, 10) }, null, 2));
  if (leaks.length) process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doAudit = args.includes('--audit');

  const token = loadFreshAccessToken();
  if (doAudit) {
    await runAudit(token);
    return;
  }

  const [companies, consultings, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs] = await Promise.all([
    rtdbGet('/data/companies', token),
    rtdbGet('/data/consultings', token),
    rtdbGet('/data/biz_cons_types', token),
    rtdbGet('/scal_cos', token),
    rtdbGet('/scal_types', token),
    rtdbGet('/mailbox/folders', token),
    rtdbGet('/mailbox/msgs', token)
  ]);

  const built = collectSafetyProjectsAndCards({ companies, consultings, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs });
  const byInd = {}, byYear = {}, byTrack = {};
  let blockedLeaks = 0;

  const cleanProjects = [];
  built.projects.forEach(p => {
    const leak = assertCleanPayload(p);
    if (leak) { blockedLeaks++; return; }
    cleanProjects.push(p);
    byInd[p.industryCode] = (byInd[p.industryCode] || 0) + 1;
    byYear[p.year] = (byYear[p.year] || 0) + 1;
    byTrack[p.track] = (byTrack[p.track] || 0) + 1;
  });

  console.log(JSON.stringify({
    mode: doApply ? 'apply' : 'dry-run',
    mailScannedCount: built.mailScannedCount,
    discoveredProjects: cleanProjects.length,
    totalCards: Array.from(built.cardsByPid.values()).reduce((a, m) => a + m.size, 0),
    blockedLeaks,
    byYear,
    byIndustry: byInd,
    byTrack
  }, null, 2));

  if (blockedLeaks > 0) {
    console.error(`FAIL: ${blockedLeaks}건의 PII/로컬경로 누출이 감지되어 중단합니다.`);
    process.exit(1);
  }
  if (!doApply) return;

  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });
  let writtenProj = 0, writtenCard = 0, skipped = 0;

  for (const proj of cleanProjects) {
    const r = await conditionalWriteRecord(`/scal_safety/projects/${proj.id}`, proj, 'Project', gw, token);
    if (r && r.committed) writtenProj++; else skipped++;
    const cards = built.cardsByPid.get(proj.id);
    if (cards) {
      for (const c of cards.values()) {
        if (assertCleanPayload(c)) continue;
        const rc = await conditionalWriteRecord(`/scal_safety/intake/${proj.id}/${c.id}`, Object.assign({}, c, {
          projectId: proj.id,
          companyId: proj.companyId,
          companyName: proj.companyName,
          entityType: 'Document'
        }), 'Document', gw, token);
        if (rc && rc.committed) writtenCard++; else skipped++;
      }
    }
  }
  console.log(JSON.stringify({ applied: true, writtenProj, writtenCard, skipped }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  collectSafetyProjectsAndCards,
  assertCleanPayload,
  normalizeDisplayCompany
};
