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
    .replace(/^\((?=(?:㈜|\(주\)|주식회사|주\)))/, '')
    .replace(/^(?:주식회사|㈜|\(주\)|주\))\s*/, '㈜')
    .replace(/\(주$/, '㈜')
    .replace(/\)+$/, (m, offset, whole) => {
      const prefix = whole.slice(0, offset);
      const openCnt = (prefix.match(/\(/g) || []).length;
      const closeCnt = (prefix.match(/\)/g) || []).length;
      return m.slice(0, Math.max(0, openCnt - closeCnt));
    })
    .trim();
}

const CANONICAL_CORP_MAP = {
  '세종시사회서비스원': { name: '세종시사회서비스원', industryCode: 'medical_welfare', track: 'welfare_pub' },
  '세종특별자치시사회서비스원': { name: '세종시사회서비스원', industryCode: 'medical_welfare', track: 'welfare_pub' },
  '세종시사회서비스원아이돌봄서비스제공기관': { name: '세종시사회서비스원', industryCode: 'medical_welfare', track: 'welfare_pub' },
  '충남유통': { name: '충남유통', industryCode: 'retail_logis', track: 'private_sapa' },
  '삼성디지컴': { name: '삼성디지컴', industryCode: 'mfg_general', track: 'private_sapa' },
  '반도기전': { name: '반도기전', industryCode: 'mfg_high', track: 'kosha_high' },
  '금진식품': { name: '㈜금진식품', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '다우테크': { name: '㈜다우테크놀로지', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '다우테크놀로지': { name: '㈜다우테크놀로지', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '주다우테크놀로지': { name: '㈜다우테크놀로지', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '동양테이프': { name: '㈜동양테이프', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '동현엔지니어링': { name: '㈜동현엔지니어링', industryCode: 'mfg_high', track: 'kosha_high' },
  '리싸이텍': { name: '㈜리싸이텍', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '주리싸이텍': { name: '㈜리싸이텍', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '새롬웰푸드': { name: '㈜새롬웰푸드', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '성창오토텍아산산업': { name: '㈜성창오토텍아산사업장', industryCode: 'mfg_high', track: 'kosha_high' },
  '성창오토텍아산산업장': { name: '㈜성창오토텍아산사업장', industryCode: 'mfg_high', track: 'kosha_high' },
  '성창오토텍아산사업장': { name: '㈜성창오토텍아산사업장', industryCode: 'mfg_high', track: 'kosha_high' },
  '고산': { name: '㈜성창오토텍아산사업장', industryCode: 'mfg_high', track: 'kosha_high' },
  '세일메카닉스': { name: '㈜세일메카닉스', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '신성하우징': { name: '㈜신성하우징', industryCode: 'const_sub', track: 'special_coop' },
  '씨원케미칼': { name: '㈜씨원케미칼', industryCode: 'mfg_high', track: 'kosha_high' },
  '엘라이트': { name: '㈜엘라이트', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '주엘라이트': { name: '㈜엘라이트', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '그랜드모터스': { name: '그랜드모터스', industryCode: 'mfg_high', track: 'kosha_high' },
  '더부러': { name: '더부러주식회사', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '더부러주식회사': { name: '더부러주식회사', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '두원공업': { name: '두원공업', industryCode: 'mfg_high', track: 'kosha_high' },
  '디마인드테크': { name: '디마인드테크', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '디마인드테크놀로지': { name: '디마인드테크', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '마인드테크': { name: '디마인드테크', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '미르g&i': { name: '미르지엔아이㈜', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '미르지엔아이': { name: '미르지엔아이㈜', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '미르지엔아이주식회사': { name: '미르지엔아이㈜', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '사랑과평화의집': { name: '사랑과평화의집', industryCode: 'medical_welfare', track: 'welfare_pub' },
  '삼익에프앤티': { name: '삼익에프앤티㈜', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '삼익에프앤티주': { name: '삼익에프앤티㈜', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '우리미디어': { name: '㈜우리미디어', industryCode: 'edu_office', track: 'kosha_etc' },
  '천안지역자활센터': { name: '천안지역자활센터', industryCode: 'medical_welfare', track: 'welfare_pub' },
  '대명크라샤': { name: '㈜대명크라샤', industryCode: 'const_sub', track: 'special_coop' },
  '대명크리샤': { name: '㈜대명크라샤', industryCode: 'const_sub', track: 'special_coop' },
  '주대명크라샤': { name: '㈜대명크라샤', industryCode: 'const_sub', track: 'special_coop' },
  '경덕산업': { name: '경덕산업', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '공주시정신건강복지센터': { name: '공주시정신건강복지센터', industryCode: 'medical_welfare', track: 'welfare_pub' },
  'cts': { name: 'CTS', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '씨티에스': { name: 'CTS', industryCode: 'mfg_general', track: 'kosha_mfg' },
  '에스에프이': { name: '에스에프이', industryCode: 'mfg_general', track: 'kosha_mfg' }
};

function resolveCanonicalCorp(rawName) {
  const cleanName = normalizeDisplayCompany(rawName);
  const rawNorm = Intake.normCorpName(cleanName);
  const mapped = CANONICAL_CORP_MAP[rawNorm] || null;
  if (mapped) {
    return {
      name: mapped.name,
      norm: Intake.normCorpName(mapped.name),
      industryCode: mapped.industryCode,
      track: mapped.track
    };
  }
  return { name: cleanName, norm: rawNorm, industryCode: '', track: '' };
}

const CONSULTING_EVIDENCE_RE = /(?:결과\s*보고서|결과보고서|컨설팅\s*보고서|보고서공문|결과\s*체크리스트|취합\s*자료|위임\s*계약서|용역\s*계약(?!서\.hwp)|과업\s*지시서|작업중지명령|실적\s*증명서|컨설팅\s*결과\s*공유|강의\s*교안|강의교안|리포트_|_리포트|안전보건관리체계\s*구축\s*(?:컨설팅\s*)?자료|안전보건관리체계\s*구축\s*관련\s*필요\s*자료|위험성\s*평가\s*컨설팅\s*(?:2회차\s*)?자료)/i;

function resolveMailYear(dateStr, combinedText) {
  const d = str(dateStr);
  const yr = Number(d.slice(0, 4)) || 2024;
  if (/^2024-0[12]/.test(d) && /취합\s*자료/.test(combinedText)) return 2023;
  if (/^2024-0[1-4]/.test(d) && /실적\s*증명서/.test(combinedText)) return 2023;
  return yr;
}

const NON_CORP_STOP_RE = /^(?:긴급|안내|공지|요청|회신|재송부|참고|공문|중요|외부|내부|첨부|수정|위탁|인쇄용|서식등포함양식|붙임|붙임1|안전보건공단|안전보건|고용노동부|근로복지공단|한국산업안전보건공단|대한산업보건협회|푸른노무법인|천안노동법률사무소|열린노무법인|법무법인|중대재해|위험성평가|산업안전컨설팅|작업중지명령|안전관리자|한국산업|선정|발송|결과|한국스마트컨설팅협회|충청남도사회복지사협회|충남노사민정협의회|한국안전보건협회|사단법인한국안전보건협회|한국공인노무사회|한국공인노무사회성실회원자료배포|개별의뢰인|참여사업장|표준|공통|발표|자료|계획|명단|매뉴얼|양식|요약|대상|전체)$/;
const AGENCY_PREFIX_RE = /^\s*\[(?:한국산업안전보건공단|안전보건공단[^\]]*|한국공인노무사회[^\]]*|사단법인\s*한국안전보건협회|고용노동부)\]/i;

function extractCorpNameFromMail(subject, attNames, coList) {
  const subj = str(subject);
  if (AGENCY_PREFIX_RE.test(subj)) return null;
  const atts = Array.isArray(attNames) ? attNames : [];
  const attStr = atts.join(' ');
  const combinedText = subj + ' ' + attStr;

  /* 1. [푸른노무법인] 업체명_위험성/안전... */
  const mPureun = /\[푸른노무법인\]\s*([^_\n[\]]+?)_(?:위험성|안전|중대)/.exec(subj);
  if (mPureun && mPureun[1]) {
    const c1 = normalizeDisplayCompany(mPureun[1]);
    if (c1 && !NON_CORP_STOP_RE.test(Intake.normCorpName(c1))) return { name: c1, co: null };
  }

  /* 2. ERP /data/companies 매칭 (리싸이텍, 대명크라샤 등) */
  const subjNorm = Intake.normCorpName(combinedText);
  for (const co of (coList || [])) {
    const nn = Intake.normCorpName(co && co.name);
    if (nn.length >= 2 && subjNorm.indexOf(nn) >= 0) {
      return { name: co.name, co };
    }
  }

  /* 3. 명시적 첨부 서식명 패턴: 위임계약서_산업안전컨설팅_업체명_261125 / 보고서공문_업체명_ / 체크리스트(업체명) */
  const mContract = /위임계약서_산업안전컨설팅_([가-힣A-Za-z0-9㈜]+?)_(?:\d{6}|$)/.exec(attStr);
  if (mContract && mContract[1]) {
    const c2 = normalizeDisplayCompany(mContract[1]);
    if (c2 && !NON_CORP_STOP_RE.test(Intake.normCorpName(c2))) return { name: c2, co: null };
  }
  const mGovDoc = /(?:보고서공문|결과\s*체크리스트)\s*[_(]\s*([가-힣A-Za-z0-9㈜()]+?)(?:_\d+\.|[)_]|$)/.exec(attStr);
  if (mGovDoc && mGovDoc[1]) {
    const c2b = normalizeDisplayCompany(mGovDoc[1]);
    if (c2b && !NON_CORP_STOP_RE.test(Intake.normCorpName(c2b))) return { name: c2b, co: null };
  }

  /* 4. 제목 선두 (업체명) N회차 위험성평가/안전보건... */
  const mLead = /^\s*(?:RE:\s*|FW:\s*|Fwd:\s*)*\(\(?((?:㈜|\(주\)|주식회사)?[가-힣A-Za-z0-9·&]{2,20}(?:\(주\)|㈜)?)\)?\)\s*(?:1회차|2회차|3회차|4회차|5회차|위험성\s*평가|안전\s*보건)/.exec(subj);
  if (mLead && mLead[1]) {
    const c3 = normalizeDisplayCompany(mLead[1]);
    const n3 = Intake.normCorpName(c3);
    if (n3.length >= 2 && !NON_CORP_STOP_RE.test(n3) && !/^202\d/.test(n3)) return { name: c3, co: null };
  }

  /* 5. 괄호 [업체명] / (업체명) */
  const bm = /[\[\(]((?:주식회사|㈜|\(주\)|[가-힣A-Za-z0-9·&\s]){2,22})[\]\)]/.exec(combinedText);
  if (bm && bm[1]) {
    const cleaned = normalizeDisplayCompany(bm[1]);
    const nn2 = Intake.normCorpName(cleaned);
    if (nn2.length >= 2 && !NON_CORP_STOP_RE.test(nn2) && !/^202\d$/.test(nn2) && !/^(?:1차|2차|회차)$/.test(nn2)) {
      return { name: cleaned, co: null };
    }
  }

  /* 6. 주요 접미사·상호 패턴 */
  const cm = /((?:㈜|\(주\)|주식회사)?\s*[가-힣A-Za-z]{2,14}(?:회계법인|복지관|요양원|복지센터|자활센터|평화의집|서비스원|모터스|크라샤|케미칼|공업|테크|산업|하우징|웰푸드|식품|푸드|유통|미디어|엔지니어링|메카닉스|테이프|정공|기전|디지컴|전자|마음터|농공단지|에스메카|에스앤씨|로스윈|네오텍|이노베이스|에스에프이|씨티에스|반도기전|에프앤티))/.exec(combinedText);
  if (cm && cm[1] && !NON_CORP_STOP_RE.test(Intake.normCorpName(cm[1]))) {
    return { name: cm[1].trim(), co: null };
  }
  return null;
}

/* ══ 후보 수집기 ══════════════════════════════════════════════════════════ */
function collectSafetyProjectsAndCards({ companies, consultings, contracts, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs, skipLocalDirs }) {
  const coList = rowsOf(companies);
  const coByNorm = new Map();
  coList.forEach(c => {
    const n = Intake.normCorpName(c && c.name);
    if (n.length >= 2 && !coByNorm.has(n)) coByNorm.set(n, c);
  });

  const projectsByKey = new Map();
  const cardsByPid = new Map();

  function upsertProject(raw) {
    const canon = resolveCanonicalCorp(raw.companyName);
    const cleanName = canon.name;
    const norm = canon.norm;
    if (!norm || norm.length < 2) return null;
    if (NON_CORP_STOP_RE.test(norm)) return null;

    let year = Number(raw.year) || 2025;
    if (raw.allowPriorYearMerge && year === 2024 && projectsByKey.has(norm + ':2023')) {
      year = 2023;
    }
    const co = coByNorm.get(norm) || null;
    const safeCidRaw = str(co ? co.id : (raw.companyId || ('sfco_' + Intake.safeIdPart(norm))));
    const companyId = safeCidRaw.replace(/[^A-Za-z0-9가-힣._:\-]+/g, '_').replace(/^_+|_+$/g, '') || ('sfco_' + Intake.sha256Hex(norm).slice(0, 10));
    const indCode = raw.industryCode || canon.industryCode || Intake.inferIndustryCode(cleanName, co && co.bizType, co && co.bizItem, raw.hintText);
    const trackCode = raw.track || canon.track || Intake.inferTrackCode(raw.hintText || cleanName, indCode);
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

  /* 1. Desktop 안전보건컨설팅 폴더 (실제 수행 사업장 서류만 — 2023년 자문사명단·배정명단·우수사례·노무상담 제외) */
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
  }

  /* 2. ERP · 계약 · 정부사업일정 안전보건 후보 */
  const erpCands = Intake.discoverSafetyCandidates({
    companies, consultings, contracts, bizTypes, scalCos, scalTypes, registeredProjects: []
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

  /* 3. 푸른메일함(전 폴더) 스캔 — 실제 안전보건컨설팅 수행·계약 송수신 메일만 선별 */
  const flatMails = Intake.flattenMailboxRows(mailFolders || {}, mailMsgs || {});
  flatMails.forEach(m => {
    if (!Intake.isSafetyConsultingMail(m.subject, m.attNames)) return;
    const combinedText = m.subject + ' ' + (m.attNames || []).join(' ');
    if (!CONSULTING_EVIDENCE_RE.test(combinedText)) return;
    const hit = extractCorpNameFromMail(m.subject, m.attNames, coList);
    if (!hit || !hit.name) return;

    const yr = resolveMailYear(m.date, combinedText);
    const p = upsertProject({
      companyId: hit.co ? hit.co.id : '',
      companyName: hit.name,
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

  /* 4. LLM-Wiki 안전보건 메일 색인 보조 스캔 (실제 수행 증빙 메일 제목만 선별) */
  const wikiBase = path.join(os.homedir(), 'llm-wiki', '03_푸른메일_사건별_회사별_전체정리');
  const wikiListPath = path.join(wikiBase, '02_회사및기관별_유입메일_사건_총람', '01_중소교신기업_전체목록_사건분류표.md');
  if (!skipLocalDirs && fs.existsSync(wikiListPath)) {
    fs.readFileSync(wikiListPath, 'utf8').split(/\r?\n/).forEach(ln => {
      if (!/\|/.test(ln)) return;
      const cols = ln.split('|').map(s => s.trim()).filter(Boolean);
      if (cols.length < 8) return;
      const dateCol = cols[6] || '';
      const subjCol = cols[7] || '';
      if (!Intake.isSafetyConsultingMail(subjCol, [])) return;
      if (!CONSULTING_EVIDENCE_RE.test(subjCol)) return;
      const candCorp = normalizeDisplayCompany(cols[1]);
      if (candCorp.length >= 2 && !NON_CORP_STOP_RE.test(Intake.normCorpName(candCorp))) {
        const yr = resolveMailYear(dateCol, subjCol);
        const isFollowUpDocOnly = /자료\s*송부/.test(subjCol) && !/(?:결과\s*보고서|결과보고서|취합\s*자료|위임\s*계약서|용역\s*계약)/.test(subjCol);
        upsertProject({
          companyName: candCorp,
          year: yr,
          allowPriorYearMerge: isFollowUpDocOnly,
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
      const dateCol = cols[0] || '';
      const subjCol = cols[3] || '';
      if (!Intake.isSafetyConsultingMail(subjCol, [])) return;
      if (!CONSULTING_EVIDENCE_RE.test(subjCol)) return;
      const candCorp = normalizeDisplayCompany(cols[2]);
      if (candCorp.length >= 2 && !NON_CORP_STOP_RE.test(Intake.normCorpName(candCorp))) {
        const yr = resolveMailYear(dateCol, subjCol);
        upsertProject({
          companyName: candCorp,
          year: yr,
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

async function softDeleteRecord(dbPath, entityType, gw, token) {
  const fetched = await rtdbGetWithEtag(dbPath, token);
  const latest = (fetched && fetched.data && typeof fetched.data === 'object') ? fetched.data : null;
  const etag = fetched ? String(fetched.etag || '') : '';
  if (!etag || !latest) return { committed: false, skipped: 'missing' };
  if (latest._deleted === true) return { committed: false, skipped: 'already_deleted' };
  if (latest.updatedBy && latest.updatedBy !== 'SYSTEM_BACKFILL') return { committed: false, skipped: 'user_modified' };

  const gone = OntWrite.tombstone(latest, {
    actor: 'SYSTEM_BACKFILL',
    entityType,
    expectedRevision: Number(latest.revision || 0),
    now: Date.now()
  });
  if (!gone || !gone.ok) return { committed: false, skipped: 'validation_failed', issues: gone && gone.issues };
  return await rtdbPutIfMatch(dbPath, token, etag, stripUndef(gone.value));
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
  const doReconcile = args.includes('--reconcile');
  const doReconcileApply = args.includes('--reconcile-apply');
  const doApply = args.includes('--apply') || doReconcileApply;
  const doAudit = args.includes('--audit');

  const token = loadFreshAccessToken();
  if (doAudit) {
    await runAudit(token);
    return;
  }

  const [companies, consultings, contracts, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs] = await Promise.all([
    rtdbGet('/data/companies', token),
    rtdbGet('/data/consultings', token),
    rtdbGet('/data/contracts', token),
    rtdbGet('/data/biz_cons_types', token),
    rtdbGet('/scal_cos', token),
    rtdbGet('/scal_types', token),
    rtdbGet('/mailbox/folders', token),
    rtdbGet('/mailbox/msgs', token)
  ]);

  const built = collectSafetyProjectsAndCards({ companies, consultings, contracts, bizTypes, scalCos, scalTypes, mailFolders, mailMsgs });
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

  if (doReconcile || doReconcileApply) {
    const curSafety = (await rtdbGet('/scal_safety', token)) || {};
    const curProjs = curSafety.projects || {};
    const curIntake = curSafety.intake || {};
    const curChecks = curSafety.checks || {};
    const curReports = curSafety.reports || {};
    const curSnapshots = curSafety.snapshots || {};

    const keepIds = new Set(cleanProjects.map(p => p.id));
    const targetByCanonNorm = new Map();
    cleanProjects.forEach(p => {
      const cn = resolveCanonicalCorp(p.companyName).norm;
      if (!targetByCanonNorm.has(cn)) targetByCanonNorm.set(cn, p);
    });

    const activeCur = Object.values(curProjs).filter(p => p && !p._deleted && p.id);
    const toSoftDelete = [];
    const blockedManual = [];
    const migrateCards = [];

    activeCur.forEach(oldP => {
      if (keepIds.has(oldP.id)) return;
      if ((oldP.updatedBy && oldP.updatedBy !== 'SYSTEM_BACKFILL') ||
          curChecks[oldP.id] || curReports[oldP.id] || curSnapshots[oldP.id]) {
        blockedManual.push({ id: oldP.id, companyName: oldP.companyName, updatedBy: oldP.updatedBy || '' });
        return;
      }
      toSoftDelete.push(oldP.id);
      const oldCanonNorm = resolveCanonicalCorp(oldP.companyName).norm;
      const targetProj = targetByCanonNorm.get(oldCanonNorm) || null;
      if (targetProj && curIntake[oldP.id]) {
        Object.values(curIntake[oldP.id]).forEach(c => {
          if (!c || c._deleted || !c.id || assertCleanPayload(c)) return;
          migrateCards.push({ fromPid: oldP.id, targetProj, card: stripMetaFields(c) });
        });
      }
    });

    console.log(JSON.stringify({
      mode: doReconcileApply ? 'reconcile-apply' : 'reconcile-dry-run',
      discoveredProjects: cleanProjects.length,
      currentActive: activeCur.length,
      keepCount: keepIds.size,
      softDeleteCount: toSoftDelete.length,
      migrateCardCount: migrateCards.length,
      blockedManualCount: blockedManual.length,
      blockedManual,
      byYear,
      projects: cleanProjects.map(p => `${p.year} | ${p.id} | ${p.companyName} | ${p.industryCode} | ${p.track}`)
    }, null, 2));

    if (blockedLeaks > 0 || blockedManual.length > 0) {
      console.error('FAIL: PII 누출 또는 수동 수정 레코드 보호로 중단합니다.');
      process.exit(1);
    }
    if (!doReconcileApply) return;

    const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });
    let writtenProj = 0, writtenCard = 0, migratedCardCount = 0, softDeleted = 0, skipped = 0;

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
    for (const mc of migrateCards) {
      const rc = await conditionalWriteRecord(`/scal_safety/intake/${mc.targetProj.id}/${mc.card.id}`, Object.assign({}, mc.card, {
        projectId: mc.targetProj.id,
        companyId: mc.targetProj.companyId,
        companyName: mc.targetProj.companyName,
        entityType: 'Document'
      }), 'Document', gw, token);
      if (rc && rc.committed) migratedCardCount++;
    }
    for (const delId of toSoftDelete) {
      const rd = await softDeleteRecord(`/scal_safety/projects/${delId}`, 'Project', gw, token);
      if (rd && rd.committed) softDeleted++; else skipped++;
    }
    console.log(JSON.stringify({ applied: true, writtenProj, writtenCard, migratedCardCount, softDeleted, skipped }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    mode: doApply ? 'apply' : 'dry-run',
    mailScannedCount: built.mailScannedCount,
    discoveredProjects: cleanProjects.length,
    totalCards: Array.from(built.cardsByPid.values()).reduce((a, m) => a + m.size, 0),
    blockedLeaks,
    byYear,
    byIndustry: byInd,
    byTrack,
    projects: cleanProjects.map(p => `${p.year} | ${p.id} | ${p.companyName} | ${p.industryCode} | ${p.track}`)
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
  normalizeDisplayCompany,
  resolveCanonicalCorp,
  resolveMailYear,
  extractCorpNameFromMail
};
