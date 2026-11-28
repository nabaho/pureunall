#!/usr/bin/env node
/* 푸른통합시스템 — 신규 12개 컨설팅 전용 앱(6차산업 포함) 통합 이력 집계·백필 스크립트
 *
 * 사용법:
 *   node scripts/backfill-consult-suite.js --dry-run
 *   node scripts/backfill-consult-suite.js --dry-run --app=sixthind
 *   node scripts/backfill-consult-suite.js --audit
 *   node scripts/backfill-consult-suite.js --apply        (※ 명시 실행 시에만 기록)
 */
'use strict';

const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
const OntWrite = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';
const CLI_ARG_SAFE_RE = /^[A-Za-z0-9._:/=\-]+$/;
const LOCAL_PATH_RE = /[A-Za-z]:\\|\/(?:Users|home)\/|\\Desktop\\|\\Downloads\\/i;

function str(v) { return v == null ? '' : String(v).trim(); }
function rowsOf(v) {
  const x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter((r) => r && typeof r === 'object');
  if (x && typeof x === 'object') return Object.keys(x).map((k) => x[k]).filter((r) => r && typeof r === 'object');
  return [];
}

function runFirebaseCli(args) {
  const argList = Array.isArray(args) ? args.map(String) : [];
  if (!argList.length || !argList.every((a) => CLI_ARG_SAFE_RE.test(a))) throw new Error('INVALID_FIREBASE_CLI_ARGS');
  if (process.platform === 'win32') {
    const fbJs = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    if (fs.existsSync(fbJs)) {
      return execFileSync(process.execPath, [fbJs, ...argList], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    }
  }
  return execFileSync('firebase', argList, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
}

function loadFreshAccessToken() {
  try {
    runFirebaseCli(['database:get', '/scal_types', '--instance', 'pureun-erp-default-rtdb', '--project', 'pureun-erp']);
  } catch (_) {}
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(cfgPath)) return '';
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return str(parsed && parsed.tokens && parsed.tokens.access_token);
}

function encodeDbPath(dbPath) {
  return String(dbPath || '').split('/').map((s) => (s ? encodeURIComponent(s) : '')).join('/');
}

function rtdbGet(dbPath, token) {
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      path: `${reqPath}?access_token=${encodeURIComponent(token)}`,
      method: 'GET'
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${txt.slice(0, 120)}`));
        try { resolve(JSON.parse(txt)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rtdbPut(dbPath, value, token) {
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  const body = JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      path: `${reqPath}?access_token=${encodeURIComponent(token)}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${txt.slice(0, 120)}`));
        resolve(JSON.parse(txt));
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function scanLocalExcelMasters(excelDir) {
  const out = {};
  if (!excelDir || !fs.existsSync(excelDir)) return { files: 0, byApp: out };
  const files = fs.readdirSync(excelDir).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'));
  let count = 0;
  for (const f of files) {
    try {
      const wb = XLSX.readFile(path.join(excelDir, f));
      count++;
      for (const shName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[shName], { defval: '' });
        for (const r of rows) {
          const line = Object.values(r).map(str).join(' ');
          if (!line.trim()) continue;
          const appKey = Cats.findByExcelType(line) || Cats.findByExcelType(f) || Cats.findByExcelType(shName);
          if (!appKey) continue;
          out[appKey] = (out[appKey] || 0) + 1;
        }
      }
    } catch (_) {}
  }
  return { files: count, byApp: out };
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doAudit = args.includes('--audit');
  const appArg = (args.find((a) => a.startsWith('--app=')) || '').slice(6);
  const excelDir = process.env.PUREUN_CONSULT_DIR || path.join(os.homedir(), 'Desktop', '컨설팅업체');

  const token = loadFreshAccessToken();
  if (!token) {
    console.log('Firebase CLI 토큰이 없어 오프라인 로컬 엑셀 집계만 수행합니다.');
  }

  const targetCats = appArg ? [Cats.get(appArg)].filter(Boolean) : Cats.listNew12();
  const excelSummary = scanLocalExcelMasters(excelDir);

  let mailboxFolders = {};
  let mailboxMsgs = {};
  let mailboxOldMsgs = {};
  let companies = [];
  let consultings = [];
  let msgIntake = {};

  if (token) {
    const [flds, msgs, oldMsgs, cos, cons, mi] = await Promise.all([
      rtdbGet('/mailbox/folders', token).catch(() => ({})),
      rtdbGet('/mailbox/msgs', token).catch(() => ({})),
      rtdbGet('/mailbox/old/msgs', token).catch(() => ({})),
      rtdbGet('/data/companies', token).catch(() => []),
      rtdbGet('/data/consultings', token).catch(() => []),
      rtdbGet('/msg_intake/items', token).catch(() => ({}))
    ]);
    mailboxFolders = flds || {};
    mailboxMsgs = msgs || {};
    mailboxOldMsgs = oldMsgs || {};
    companies = rowsOf(cos);
    consultings = rowsOf(cons);
    msgIntake = mi || {};
  }

  const flatMails = Intake.flattenMailbox(mailboxFolders, mailboxMsgs, mailboxOldMsgs);
  console.log(`\n[푸른 컨설팅 12개 사업 통합 백필 ${doApply ? 'APPLY' : (doAudit ? 'AUDIT' : 'DRY-RUN')}]`);
  console.log(`- 원천: 메일(IMAP+POP3) ${flatMails.length}통 · 업체 ${companies.length}개 · 이알피 컨설팅 ${consultings.length}건 · 로컬 엑셀 ${excelSummary.files}파일\n`);

  let piiLeakCount = 0;
  for (const cat of targetCats) {
    const res = Intake.discoverForApp(cat.key, {
      companies,
      consultings,
      projects: [],
      mailboxFolders,
      mailboxMsgs,
      mailboxOldMsgs,
      msgIntake
    });
    const exRows = excelSummary.byApp[cat.key] || 0;
    const sampleCheck = JSON.stringify(res.bundles.slice(0, 5));
    if (Intake.hasResidualPii(sampleCheck) || LOCAL_PATH_RE.test(sampleCheck)) piiLeakCount++;

    console.log(
      `  ${cat.icon} ${cat.key.padEnd(12)} (${cat.name.padEnd(12)}): ` +
      `후보묶음 ${String(res.bundles.length).padStart(4)}건 | ` +
      `메일 ${String(res.stats.mailHits).padStart(4)} · ERP ${String(res.stats.erpHits).padStart(3)} · 톡/문자 ${String(res.stats.msgHits).padStart(3)} · 엑셀행 ${String(exRows).padStart(4)}`
    );

    if (doApply && token && res.bundles.length) {
      const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'backfill-script' });
      let written = 0;
      for (const b of res.bundles.slice(0, 50)) {
        const pid = `bf_${cat.key}_${b.key.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)}`;
        const tr = (cat.tracks && cat.tracks[0]) || { id: 'default', name: cat.name };
        const prepared = gw.prepare({
          id: pid,
          entityType: 'Project',
          companyId: str(b.companyId),
          companyName: Intake.sanitizeText(b.companyName),
          year: Number(b.year || 2026),
          trackId: tr.id,
          trackName: tr.name,
          stage: 'collect',
          status: 'active',
          summaryNote: `자동 백필 집계 (메일 ${b.mailCount} / ERP ${b.erpCount})`
        }, { entityType: 'Project', allowPendingCompany: true });
        if (prepared.ok && !Intake.hasResidualPii(JSON.stringify(prepared.value))) {
          await rtdbPut(`/${cat.rtdbRoot}/projects/${pid}`, prepared.value, token);
          written++;
        }
      }
      console.log(`     -> --apply 기록: ${written}건`);
    }
  }

  console.log(`\n- 비식별·로컬경로 누출 검사: ${piiLeakCount === 0 ? '통과 (0건)' : `주의 (${piiLeakCount}건)`}`);
  if (piiLeakCount > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill-consult-suite 오류]', err && err.message || err);
    process.exitCode = 1;
  });
}

module.exports = { scanLocalExcelMasters };
