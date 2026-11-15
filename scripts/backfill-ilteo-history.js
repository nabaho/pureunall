#!/usr/bin/env node
/* 푸른통합시스템 — 과거 메일 컨설팅 사업장 자료 · 중간보고서 · 최종보고서 전수 비식별 백필 스크립트
 *
 * 맡는 일:
 *   1. 마스터(data/companies · data/consultings · scal_cos · scal_scheds · pucards/items)와
 *      과거 컨설팅·보고서 메일의 명시적 법인 상호를 교차 대조하여 컨설팅 수행 사업장 목록을 구축한다.
 *   2. ① 기업규정 서고(rules_mgmt/library/docs · text) 기수집 비식별 원문,
 *      ② 다음메일 IMAP(readOnly: true) 본문·첨부(.pptx/.xlsx/.hwpx/.hwp/.docx/.pdf/.txt),
 *      ③ 다음메일 POP3(읽기 전용 UIDL/LIST/RETR/TOP, DELE 없음) 과거 메일 본문·첨부를 메모리에서만 분석한다.
 *   3. 정량 엑셀은 비식별 통계만 집계하고, 모든 텍스트·보고서 원문은 kordoc + PuIlteoIntake 2중 가림 및
 *      독립 개인정보 감사(주민·전화·이메일 잔존 0건) 통과본만 남긴다.
 *   4. 사업장별 수집 카드(scal_ilteo/intake)를 바탕으로 중간보고서(scal_ilteo/mid)와
 *      최종 결과보고서(scal_ilteo/final) 7개 표준 섹션을 완성하여 PuOntologyWrite 강제 규격으로 적재한다.
 *
 * ⚠ 보안 불변식:
 *   - 터미널 출력에 실존 고객사 상호·성명·이메일·연락처·비밀번호를 절대 출력하지 않는다(건수 통계만 출력).
 *   - 메일 서버는 100% 읽기 전용(IMAP readOnly:true, POP3 RSET+QUIT)으로만 접근한다.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
module.paths.unshift(path.join(ROOT, 'functions', 'node_modules'));

const Cat = require(path.join(ROOT, 'js', 'pu-ilteo-catalog.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-ilteo-intake.js'));
const Report = require(path.join(ROOT, 'js', 'pu-ilteo-report.js'));
const OntWrite = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
const JSZip = require(path.join(ROOT, 'vendor', 'jszip.min.js'));
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));
const Kordoc = require(path.join(ROOT, 'functions', 'vendor', 'kordoc', 'pu-kordoc-text.js'));
const Audit = require(path.join(ROOT, 'scripts', 'rules-library-audit.js'));

let PdfReader = null;
let MS = null;
let MD = null;
let ImapFlow = null;
let simpleParser = null;
function loadHeavyMailDeps() {
  if (!ImapFlow) {
    PdfReader = require(path.join(ROOT, 'functions', 'rules-collect-pdf.js'));
    MS = require(path.join(ROOT, 'functions', 'mail-sync.js'));
    MD = require(path.join(ROOT, 'functions', 'mail-deliver.js'));
    ImapFlow = require('imapflow').ImapFlow;
    simpleParser = require('mailparser').simpleParser;
  }
}

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';
const SELF_MAIL_RE = /@pureun\.kr$|^370-6@(?:daum\.net|hanmail\.net)$/i;
const PUBLIC_DOMAINS = new Set([
  'naver.com', 'daum.net', 'hanmail.net', 'gmail.com', 'kakao.com',
  'nate.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.co.kr',
  'icloud.com', 'korea.kr', 'pureun.kr'
]);

const CONS_MAIL_RE = /일터\s*혁신|일터\s*상생|상생\s*컨설팅|노사발전재단|이음센터|중간\s*보고|최종\s*보고|결과\s*보고|완료\s*보고|수행\s*계획|수행\s*보고|현장\s*클리닉|기술\s*보호|산업\s*일자리|인사\s*노무|기초\s*컨설팅|출산\s*육아|컨설팅\s*(?:자료|보고|산출물|안내|요청|회차|수행|결과)|취업\s*규칙|근로\s*계약|임금\s*대장|급여\s*대장|근태|출퇴근|연차|설문|조직\s*진단|신구\s*대조|디자인팀|노사\s*협의회/i;
const REPORT_CORE_RE = /일터\s*혁신|일터\s*상생|상생\s*컨설팅|노사발전재단|이음센터|중간\s*보고|최종\s*보고|결과\s*보고|완료\s*보고|수행\s*계획|수행\s*보고|컨설팅\s*보고서/i;
const SKIP_SUBJ_RE = /^\s*[\(\[]\s*광고\s*[\)\]]|뉴스레터|세미나\s*안내|교육\s*안내|수신\s*거부|unsubscribe|청구서|명세서\s*안내|결제\s*안내|인증\s*번호/i;
const EXCLUDE_ORG_RE = /푸른노무|노사발전|이음센터|고용노동|근로복지|산업인력|중소벤처|테크노파크|상공회의소|경영자총|능률협회|생산성본부|표준협회|신용보증|기술보증|산업단지|진흥원|정보통신|연구개발특구|한국노동|충남경제|경제진흥원|창조경제|중소기업중앙회/i;
const EXPLICIT_CORP_RE = /(?:\(주\)|㈜|주식회사\s*|\(유\)|유한회사\s*|농업회사법인\s*(?:\(주\)|주식회사)?\s*)([가-힣A-Za-z0-9]{2,18})|([가-힣A-Za-z0-9]{2,18})\s*(?:\(주\)|㈜|주식회사|\(유\)|유한회사)/g;

function str(v) { return v == null ? '' : String(v).trim(); }
function safeKey(v) {
  return str(v).replace(/[.#$/\[\]\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72) || ('id_' + Date.now());
}
function sha1Short(v) {
  return crypto.createHash('sha1').update(String(v || ''), 'utf8').digest('hex').slice(0, 12);
}
function rowsOf(v) {
  const x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter(r => r && typeof r === 'object');
  if (x && typeof x === 'object') return Object.keys(x).map(k => x[k]).filter(r => r && typeof r === 'object');
  return [];
}
function mailOf(v) {
  const m = String(v == null ? '' : v).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : '';
}
function domainOf(e) {
  const m = mailOf(e);
  const i = m.indexOf('@');
  return i > 0 ? m.slice(i + 1) : '';
}
function normCorpName(v) {
  return str(v).normalize('NFC')
    .replace(/농업회사법인|\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(사\)|사단법인|\(재\)|재단법인|\(합\)|합자회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[.,·・\-–—_'"()\[\]]/g, '')
    .toLowerCase();
}
function stripUndef(v) {
  if (Array.isArray(v)) return v.filter(x => x !== undefined).map(stripUndef);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(k => {
      if (v[k] !== undefined) o[k] = stripUndef(v[k]);
    });
    return o;
  }
  return v;
}
function withTimeout(promise, ms, tag) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(tag || 'TIMEOUT')), ms);
    if (timer && timer.unref) timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function runFirebaseCli(argsLine) {
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', 'firebase ' + argsLine], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
  }
  return execFileSync('firebase', argsLine.split(/\s+/), {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
}

function loadFreshAccessToken() {
  /* CLI 1회 경량 호출로 OAuth 토큰 만료 시 자동 갱신 유도 */
  runFirebaseCli('database:get /scal_types --instance pureun-erp-default-rtdb --project pureun-erp');
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const tok = parsed && parsed.tokens && parsed.tokens.access_token;
  if (!tok) throw new Error('Firebase CLI access_token 을 찾을 수 없습니다.');
  return tok;
}

function loadDaumMailPassword() {
  const raw = runFirebaseCli('functions:secrets:access DAUM_MAIL_PASSWORD --project pureun-erp');
  const pw = String(raw || '').trim();
  if (!pw) throw new Error('DAUM_MAIL_PASSWORD 시크릿이 비어 있습니다.');
  return pw;
}

function rtdbRequest(method, dbPath, token) {
  if (method !== 'GET') {
    throw new Error('무조건 덮어쓰기 방지: 모든 쓰기는 conditionalWriteRecord(ETag + If-Match)를 사용해야 합니다.');
  }
  const reqPath = `${dbPath}.json?access_token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      port: 443,
      path: reqPath,
      method: 'GET'
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
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
      res.on('data', c => chunks.push(c));
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
      res.on('data', c => chunks.push(c));
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

const META_FIELDS = ['revision', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'];
function stripMetaFields(rec) {
  const cp = Object.assign({}, rec || {});
  META_FIELDS.forEach(k => { delete cp[k]; });
  return cp;
}

/* 레코드별 ETag 조회 → 최신 _deleted/updatedBy/revision 재검증 → If-Match 조건부 PUT (TOCTOU 원천 차단) */
async function conditionalWriteRecord(dbPath, desiredRecord, entityType, gw, token, ioHooks) {
  const hooks = ioHooks || { getWithEtag: rtdbGetWithEtag, putIfMatch: rtdbPutIfMatch };
  const fetched = await hooks.getWithEtag(dbPath, token);
  const latest = (fetched && fetched.data && typeof fetched.data === 'object') ? fetched.data : null;
  const etag = fetched ? String(fetched.etag || '') : '';
  if (!etag) return { committed: false, skipped: 'missing_etag' };

  if (latest) {
    if (latest._deleted === true) {
      return { committed: false, skipped: 'deleted_tombstone' };
    }
    if (latest.updatedBy && latest.updatedBy !== 'SYSTEM_BACKFILL') {
      return { committed: false, skipped: 'user_modified' };
    }
  }

  const now = Date.now();
  let prep;
  if (desiredRecord && desiredRecord._deleted === true) {
    if (!latest) return { committed: false, skipped: 'already_absent' };
    prep = OntWrite.tombstone(latest, { actor: 'SYSTEM_BACKFILL', entityType, now });
  } else {
    const cleanDesired = stripMetaFields(desiredRecord);
    const merged = stripUndef(Object.assign({}, latest || {}, cleanDesired));
    const expectedRev = latest ? Number(latest.revision || 0) : undefined;
    prep = gw.prepare(merged, {
      previous: latest || null,
      expectedRevision: expectedRev,
      entityType,
      now
    });
  }

  if (!prep || !prep.ok) {
    return { committed: false, skipped: 'validation_failed' };
  }
  return await hooks.putIfMatch(dbPath, token, etag, stripUndef(prep.value));
}

async function runPool(items, concurrency, workerFn) {
  let idx = 0;
  const results = [];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await workerFn(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return results;
}

function htmlToPlain(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let kordocInitPromise = null;
function ensureKordoc() {
  if (!kordocInitPromise) {
    const mjsPath = path.join(ROOT, 'functions', 'vendor', 'kordoc', 'kordoc.browser.min.mjs');
    kordocInitPromise = import(pathToFileURL(mjsPath).href)
      .then(K => {
        if (!K || !Kordoc || typeof Kordoc._use !== 'function') {
          throw new Error('KORDOC_BIND_UNAVAILABLE');
        }
        Kordoc._use(K);
        if (typeof Kordoc.redactFile !== 'function') {
          throw new Error('KORDOC_REDACT_UNAVAILABLE');
        }
        return K;
      })
      .catch(err => {
        kordocInitPromise = null;
        throw err;
      });
  }
  return kordocInitPromise;
}

async function doubleRedactText(rawText, opts) {
  const stage0 = String(rawText == null ? '' : rawText);
  if (!stage0) return '';
  let kd = opts && opts.kordoc !== undefined ? opts.kordoc : null;
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'kordoc')) {
    kd = opts.kordoc;
  } else {
    await ensureKordoc();
    kd = Kordoc;
  }
  if (!kd || typeof kd.redactFile !== 'function') {
    throw new Error('KORDOC_UNAVAILABLE');
  }
  const r1 = await kd.redactFile(null, stage0, ['rrn', 'money', 'phone', 'email', 'id', 'person']);
  if (!r1 || typeof r1.text !== 'string') {
    throw new Error('KORDOC_REDACT_FAILED');
  }
  return r1.text;
}

function passesIndependentAudit(text, opts) {
  const s = String(text || '');
  if (!s) return true;
  if (Intake.hasResidualPii(s)) return false;
  if (typeof Intake.hasIndependentPersonAuditLeak === 'function' && Intake.hasIndependentPersonAuditLeak(s)) return false;
  if (opts && opts.isLabel && typeof Intake.hasStandaloneNameInLabel === 'function' && Intake.hasStandaloneNameInLabel(s)) return false;
  const auditRes = Audit.scan({ doc: s });
  const severeHits = (auditRes.hits || []).filter(h => h.kind === '주민' || h.kind === '전자우편' || h.kind === '전화');
  return severeHits.length === 0;
}

async function parseAttachmentBuffer(fileName, buf, org, phase, midConfirmedAt) {
  const lower = str(fileName).toLowerCase();
  const safeFile = await sanitizeTitle(fileName, org);
  if (!safeFile || !passesIndependentAudit(safeFile.split((org && org.name) || '\0').join('[해당 기업]'), { isLabel: true })) return null;

  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) {
    const diffMeta = Intake.extractPostMidDiff('타임스탬프 회의 사진 첨부 확인', safeFile, [safeFile]);
    return {
      docKind: 'round_proof',
      track: 'meta',
      piiStripped: true,
      maskedExcerpt: '',
      stats: null,
      policyIssues: [],
      postDiff: phase === 'post_mid' ? diffMeta : null,
      summaryLines: ['회차 수행 사진 증빙 확인 (' + safeFile + ')']
    };
  }

  let excelFallback = '';
  let detectedKind = '';
  if (/\.(xlsx|xls|csv)$/.test(lower)) {
    try {
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheetMap = {};
      (wb.SheetNames || []).forEach(sn => {
        sheetMap[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
      });
      const hasSens = Intake.hasSensitiveTableHeaders(sheetMap);
      const orgNames = [];
      if (org && org.name) orgNames.push({ v: org.name, as: '[해당 기업]' });
      if (org && org.ceoName) orgNames.push({ v: org.ceoName, as: '[대표자]' });
      if (org && org.contactName) orgNames.push({ v: org.contactName, as: '[담당자]' });
      const tabRes = Intake.analyzeTabularRows(sheetMap, '', {
        level: 'deep',
        totalWorkers: org.workerCount || 0,
        baseYear: org.latestYear || 2026,
        fileName: safeFile,
        names: orgNames
      });
      if (tabRes && tabRes.ok) {
        let auditedQuant = null;
        try {
          auditedQuant = await Intake.auditQuantResultAsync(tabRes, {
            names: orgNames,
            redactFn: (txt) => doubleRedactText(txt),
            auditFn: (txt) => passesIndependentAudit(txt)
          });
        } catch (_) {
          return null;
        }
        if (!auditedQuant || !auditedQuant.ok) {
          return null;
        }
        const corpBack = org && org.name ? [{ as: '[해당 기업]', v: org.name }] : [];
        return {
          docKind: auditedQuant.docKind,
          track: 'quant',
          piiStripped: true,
          maskedExcerpt: '',
          stats: auditedQuant.stats,
          policyIssues: [],
          postDiff: null,
          summaryLines: (auditedQuant.summaryLines || []).map(ln => Intake.unmaskNames(ln, corpBack))
        };
      }
      if (hasSens || (tabRes && !tabRes.nonQuant)) {
        return null;
      }
      if (tabRes && tabRes.docKind) detectedKind = tabRes.docKind;
      excelFallback = Object.keys(sheetMap).map(sn => {
        const rows = (sheetMap[sn] || []).slice(0, 150).map(r =>
          (Array.isArray(r) ? r : []).map(str).filter(Boolean).join(' ')
        ).filter(Boolean).join('\n');
        return '[' + sn + ']\n' + rows;
      }).join('\n');
    } catch (_) {
      return null;
    }
  }

  let rawText = excelFallback;
  if (!rawText) {
    if (/\.pptx$/.test(lower)) {
      rawText = await Intake.extractPptxText(buf, JSZip);
    } else if (/\.(hwpx|hwp|docx)$/.test(lower)) {
      try {
        await ensureKordoc();
        const kr = await Kordoc.read(buf);
        if (kr && kr.text) rawText = kr.text;
      } catch (_) {}
    } else if (/\.pdf$/.test(lower)) {
      try {
        loadHeavyMailDeps();
        const pr = await withTimeout(PdfReader.pdfText(buf), 25000, 'PDF_TIMEOUT');
        if (pr && pr.text) rawText = pr.text;
      } catch (_) {}
    } else if (/\.(txt|md)$/.test(lower)) {
      rawText = Buffer.from(buf).toString('utf8');
    }
  }

  if (!str(rawText)) return null;
  let stage1 = '';
  try {
    stage1 = await doubleRedactText(rawText);
  } catch (_) {
    return null;
  }
  const res = Intake.sanitizeAndAnalyzeText(stage1, {
    companyName: org.name,
    ceoName: org.ceoName,
    contactName: org.contactName,
    docKind: detectedKind,
    phase,
    midConfirmedAt,
    subject: safeFile,
    attNames: [safeFile]
  });
  if (!res.ok || res.leakBlocked || !passesIndependentAudit(res.maskedExcerpt)) return null;
  return {
    docKind: res.docKind,
    track: res.track,
    piiStripped: true,
    maskedExcerpt: res.maskedExcerpt,
    stats: null,
    policyIssues: res.policyIssues || [],
    postDiff: res.postDiff || null,
    summaryLines: res.summaryLines || []
  };
}

async function sanitizeTitle(raw, org, opts) {
  const s = str(raw);
  if (!s) return '';
  const names = [];
  if (org && org.name) names.push({ v: org.name, as: '[해당 기업]' });
  if (org && org.ceoName) names.push({ v: org.ceoName, as: '[대표자]' });
  if (org && org.contactName) names.push({ v: org.contactName, as: '[담당자]' });
  /* 기업 상호 자리표시를 먼저 치환한 뒤 kordoc 1차 가림(fail-closed) → Intake 2차 가림 + 단독 인명 토큰 가림 → 독립 감사 순서로 처리 */
  const pre = Intake.maskPiiStrict(s, names).text;
  const kdMasked = await doubleRedactText(pre, opts);
  let m = Intake.maskStandaloneNamesInLabel(Intake.maskPiiStrict(kdMasked, []).text);
  for (let i = 0; i < 3 && (Intake.hasResidualPii(m) || Intake.hasStandaloneNameInLabel(m)); i++) {
    m = Intake.maskStandaloneNamesInLabel(Intake.maskPiiStrict(m, []).text);
  }
  if (!passesIndependentAudit(m, { isLabel: true })) return '';
  const back = (org && org.name) ? [{ as: '[해당 기업]', v: str(org.name) }] : [];
  return Intake.unmaskNames(m, back);
}

function inferSelectedTasks(org, intakeCards) {
  const blob = [
    Array.from((org && org.consTypes) || []).join(' '),
    (org && org.industry) || '',
    ...(intakeCards || []).map(c => [c.title, (c.summaryLines || []).join(' '), (c.maskedExcerpt || '').slice(0, 1200)].join(' '))
  ].join('\n');

  const picked = [];
  function add(code) {
    if (Cat.getTask(code) && picked.indexOf(code) < 0) picked.push(code);
  }

  if (/주\s*4\.5|금요일\s*단축|주\s*35|주\s*36|근로시간\s*단축/.test(blob)) add('wt_45day');
  if (/교대\s*근무|교대제|2교대|3교대|4조\s*2교대|유연\s*근무|시차\s*출퇴근|선택적\s*근로|탄력적\s*근로|재택/.test(blob)) add('wt_shift');
  if (/연차|휴가\s*활성|반차|반반차|연장\s*근로|장시간|출퇴근\s*기록/.test(blob) && picked.length < 3) add('wt_mgmt');
  if (/포괄\s*임금|고정\s*연장|고정\s*ot/i.test(blob)) add('wg_inclusive');
  if (/임금\s*체계|직무급|직능급|호봉|성과\s*보상|인센티브|상여금|수당\s*개편/.test(blob)) add('wg_redesign');
  if (/통상\s*임금|임금\s*명세|급여\s*명세/.test(blob) && picked.length < 4) add('wg_mgmt');
  if (/인사\s*평가|성과\s*평가|다면\s*평가|kpi|mbo/i.test(blob)) add('ev_design');
  if (/직무\s*분석|직무\s*기술서|직무\s*조사/.test(blob)) add('jb_analysis');
  if (/업무\s*분장|직제|직무\s*재설계/.test(blob) && picked.length < 4) add('jb_redesign');
  if (/노사\s*협의회|근로자\s*위원/.test(blob)) add('cp_council');
  if (/고충\s*처리|노사\s*상생|노사\s*파트너십/.test(blob) && picked.length < 4) add('cp_partner');
  if (/정년|계속\s*고용|고령자|재고용|촉탁/.test(blob)) add('sn_hr');
  if (/육아|출산|일\s*가정|가족\s*돌봄|모성\s*보호/.test(blob)) add('cu_balance');
  if (/괴롭힘|성희롱|감정\s*노동|직무\s*스트레스/.test(blob) && picked.length < 4) add('cu_protect');
  if (/채용|면접|수습|온보딩/.test(blob)) add('hr_diag');
  if (/교육\s*훈련|숙련|학습\s*체계|직무\s*교육|ojt/i.test(blob)) add('sk_std');

  if (!picked.length) {
    add('wt_45day');
    add('wg_redesign');
  } else if (picked.length === 1) {
    add(picked[0].startsWith('wg_') ? 'wt_45day' : 'wg_redesign');
  }
  return picked.slice(0, 4);
}

function extractYearFromTs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const y = new Date(n + 9 * 3600e3).getUTCFullYear();
  return (y >= 2018 && y <= 2027) ? y : 0;
}

function mailPriorityScore(m) {
  const hay = (str(m.subject) + ' ' + (m.attNames || []).join(' ') + ' ' + str(m.preview)).toLowerCase();
  let sc = 0;
  if (/최종\s*보고|결과\s*보고|완료\s*보고/.test(hay)) sc += 100;
  if (/중간\s*보고|현황\s*진단\s*보고/.test(hay)) sc += 95;
  if (/수행\s*계획|수행\s*보고|컨설팅\s*보고서/.test(hay)) sc += 80;
  if (/일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(hay)) sc += 60;
  if (/\.(pptx|ppt)\b/.test(hay)) sc += 55;
  if (/\.(xlsx|xls|csv)\b/.test(hay)) sc += 45;
  if (/\.(hwpx|hwp|docx|pdf)\b/.test(hay)) sc += 40;
  if (/신구\s*대조|찬반\s*투표|동의서|취업\s*규칙|임금\s*대장|조직\s*진단|설문/.test(hay)) sc += 35;
  if (Number(m.attCount) > 0) sc += 20;
  return sc;
}

async function main() {
  loadHeavyMailDeps();
  console.log('[1/7] Firebase RTDB 마스터 · 메일 거울 · 규정 서고 로드 시작...');
  let token = loadFreshAccessToken();
  const mailPass = loadDaumMailPassword();

  const [
    rawCompanies,
    rawConsultings,
    rawBizTypes,
    rawScalCos,
    rawScalTypes,
    rawScalScheds,
    rawPucardsItems,
    rawMatMailCfg,
    mailFolders,
    mailMsgs,
    mailOldMsgs,
    rulesDocs,
    rulesTexts
  ] = await Promise.all([
    rtdbRequest('GET', '/data/companies', token),
    rtdbRequest('GET', '/data/consultings', token),
    rtdbRequest('GET', '/data/biz_cons_types', token),
    rtdbRequest('GET', '/scal_cos', token),
    rtdbRequest('GET', '/scal_types', token),
    rtdbRequest('GET', '/scal_scheds', token),
    rtdbRequest('GET', '/pucards/items', token),
    rtdbRequest('GET', '/pucards/config/matMail', token),
    rtdbRequest('GET', '/mailbox/folders', token),
    rtdbRequest('GET', '/mailbox/msgs', token),
    rtdbRequest('GET', '/mailbox/old/msgs', token),
    rtdbRequest('GET', '/rules_mgmt/library/docs', token),
    rtdbRequest('GET', '/rules_mgmt/library/text', token)
  ]);

  const companies = rowsOf(rawCompanies);
  const consultings = rowsOf(rawConsultings);
  const bizTypes = rowsOf(rawBizTypes);
  const scalCosObj = rawScalCos || {};
  const scalTypesObj = rawScalTypes || {};
  const scalScheds = rowsOf(rawScalScheds);
  const pucardItems = rowsOf(rawPucardsItems);
  const fromAccount = str(rawMatMailCfg && rawMatMailCfg.from) || '370-6@daum.net';

  const bizTypeMap = {};
  bizTypes.forEach(b => {
    const k = str(b.id || b.code);
    if (k) bizTypeMap[k] = str(b.name || b.title);
  });
  const scalTypeMap = {};
  Object.keys(scalTypesObj).forEach(k => {
    const t = scalTypesObj[k];
    if (t && typeof t === 'object') scalTypeMap[str(t.id || k)] = str(t.name || t.title);
  });

  /* ── 2. 통합 조직 사전 구축 ── */
  const orgs = new Map();
  const byBiz = new Map();
  const byNorm = new Map();

  function collectObjEmails(obj) {
    const out = [];
    if (!obj || typeof obj !== 'object') return out;
    [obj.email, obj.primaryContactEmail, obj.taxEmail, obj.contactEmail, obj.managerEmail].forEach(v => {
      const e = mailOf(v);
      if (e) out.push(e);
    });
    rowsOf(obj.contacts).forEach(c => {
      const e = mailOf(c && c.email);
      if (e) out.push(e);
    });
    rowsOf(obj.defCoAtts).forEach(c => {
      const e = mailOf(c && c.email);
      if (e) out.push(e);
    });
    return out;
  }

  function upsertOrg(seed) {
    const bz = str(seed.bizNo).replace(/\D/g, '');
    const nm = normCorpName(seed.name);
    if (nm && EXCLUDE_ORG_RE.test(seed.name)) return null;

    let key = str(seed.companyId);
    if (!key && bz.length === 10 && byBiz.has(bz)) key = byBiz.get(bz);
    if (!key && nm.length >= 2 && byNorm.has(nm)) key = byNorm.get(nm);
    if (!key) key = str(seed.fallbackId);
    if (!key) return null;

    let o = orgs.get(key);
    if (!o) {
      o = {
        key,
        companyId: str(seed.companyId || key),
        consultingId: str(seed.consultingId || ''),
        scalCoId: str(seed.scalCoId || ''),
        scalTypeId: str(seed.scalTypeId || ''),
        name: str(seed.name),
        normName: nm,
        bizNo: str(seed.bizNo),
        ceoName: str(seed.ceoName),
        contactName: str(seed.contactName),
        industry: str(seed.industry),
        workerCount: Number(seed.workerCount) || 0,
        emails: new Set(),
        domains: new Set(),
        isIlteo: false,
        isConsulting: false,
        consTypes: new Set(),
        years: new Set()
      };
      orgs.set(key, o);
    } else {
      if (!o.name && seed.name) { o.name = str(seed.name); o.normName = nm; }
      if (!o.bizNo && seed.bizNo) o.bizNo = str(seed.bizNo);
      if (!o.ceoName && seed.ceoName) o.ceoName = str(seed.ceoName);
      if (!o.contactName && seed.contactName) o.contactName = str(seed.contactName);
      if (!o.industry && seed.industry) o.industry = str(seed.industry);
      if (!o.workerCount && Number(seed.workerCount) > 0) o.workerCount = Number(seed.workerCount);
      if (!o.consultingId && seed.consultingId) o.consultingId = str(seed.consultingId);
      if (!o.scalCoId && seed.scalCoId) o.scalCoId = str(seed.scalCoId);
      if (!o.scalTypeId && seed.scalTypeId) o.scalTypeId = str(seed.scalTypeId);
    }

    if (bz.length === 10 && !byBiz.has(bz)) byBiz.set(bz, key);
    if (nm.length >= 2 && !byNorm.has(nm)) byNorm.set(nm, key);
    if (seed.isIlteo) o.isIlteo = true;
    if (seed.isConsulting) o.isConsulting = true;
    if (seed.consType) o.consTypes.add(str(seed.consType));
    if (Number(seed.year) >= 2018) o.years.add(Number(seed.year));

    (seed.emails || []).forEach(raw => {
      const e = mailOf(raw);
      if (!e || SELF_MAIL_RE.test(e)) return;
      o.emails.add(e);
      const d = domainOf(e);
      if (d && !PUBLIC_DOMAINS.has(d)) o.domains.add(d);
    });
    return o;
  }

  /* 2-1) ERP 기업정보함 */
  companies.forEach(c => {
    if (!c.id || c._deleted) return;
    const cts = rowsOf(c.contacts);
    upsertOrg({
      companyId: String(c.id),
      name: c.name,
      bizNo: c.bizNo,
      ceoName: c.ceo || c.ceoName,
      contactName: c.contactName || c.manager || (cts[0] && cts[0].name),
      industry: c.bizType || c.bizCategory,
      workerCount: c.workerCount || c.empCount || 0,
      emails: collectObjEmails(c)
    });
  });

  /* 2-2) ERP 컨설팅 계약 마스터 (전 연도 컨설팅 사업장) */
  consultings.forEach(cs => {
    if (!cs || cs._deleted) return;
    const bCode = str(cs.typeCode || cs.bizTypeId || cs.consultingTypeCode);
    const tName = str(cs.bizName || cs.typeName || cs.consultingType || bizTypeMap[bCode] || '노무컨설팅');
    const coObj = (cs.company && typeof cs.company === 'object') ? cs.company : {};
    const yr = Number(String(cs.year || cs.contractDate || cs.startDate || '').slice(0, 4)) || extractYearFromTs(cs.createdAt);
    upsertOrg({
      companyId: str(cs.companyId || coObj.id),
      fallbackId: 'cons_' + safeKey(cs.id),
      consultingId: str(cs.id),
      name: cs.companyName || coObj.name || cs.name,
      bizNo: cs.bizNo || coObj.bizNo,
      ceoName: cs.ceo || coObj.ceo,
      contactName: cs.contactName || cs.managerName,
      industry: cs.industry || coObj.bizType,
      workerCount: cs.workerCount || coObj.workerCount || 0,
      emails: collectObjEmails(cs).concat(collectObjEmails(coObj)),
      isConsulting: true,
      isIlteo: /일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(tName),
      consType: tName,
      year: yr
    });
  });

  /* 2-3) 정부사업일정 (scal_cos) */
  Object.keys(scalCosObj).forEach(sk => {
    const sc = scalCosObj[sk];
    if (!sc || typeof sc !== 'object' || sc._deleted) return;
    const scId = str(sc.id || sk);
    const rawTypes = Array.isArray(sc.types) ? sc.types : Object.values(sc.types || {});
    if (sc.typeId) rawTypes.push(sc.typeId);
    const tNames = rawTypes.map(t => scalTypeMap[str(t)] || '').filter(Boolean);
    const schedYears = scalScheds.filter(s => s && s.coId === scId && /^\d{4}/.test(str(s.date)))
      .map(s => Number(str(s.date).slice(0, 4)));
    const yr = Number(sc.year) || (schedYears.length ? Math.max(...schedYears) : 0);
    const o = upsertOrg({
      companyId: str(sc.co_id || sc.erpCompanyId || sc.companyId),
      fallbackId: 'scal_' + safeKey(scId),
      scalCoId: scId,
      scalTypeId: str(rawTypes[0] || 't1'),
      name: sc.name,
      bizNo: sc.bizNo,
      industry: sc.industry,
      emails: collectObjEmails(sc),
      isConsulting: true,
      isIlteo: rawTypes.includes('t1') || tNames.some(n => /일터/.test(n)),
      year: yr
    });
    if (o) tNames.forEach(tn => o.consTypes.add(tn));
  });

  /* 2-4) pucards/items 보조 보강 (기존 컨설팅 기업에 명함 이메일·업종·대표자 연결 + 명함 사전 구축) */
  const pucardByNorm = new Map();
  pucardItems.forEach(it => {
    if (!it || typeof it !== 'object') return;
    const comp = str(it.company);
    if (!comp || EXCLUDE_ORG_RE.test(comp)) return;
    const nm = normCorpName(comp);
    if (nm.length < 2) return;
    const em = mailOf(it.email || it.mail || it.memo);
    const bz = str(it.bizno).replace(/\D/g, '');
    if (!pucardByNorm.has(nm)) {
      pucardByNorm.set(nm, { name: comp, bizNo: str(it.bizno), ceoName: str(it.ceo), industry: str(it.bizType || it.bizItem), emails: [] });
    }
    if (em && !SELF_MAIL_RE.test(em)) pucardByNorm.get(nm).emails.push(em);

    const existingKey = (bz.length === 10 && byBiz.get(bz)) || byNorm.get(nm);
    if (existingKey && orgs.has(existingKey)) {
      const o = orgs.get(existingKey);
      if (!o.industry && (it.bizType || it.bizItem)) o.industry = str(it.bizType || it.bizItem);
      if (!o.ceoName && it.ceo) o.ceoName = str(it.ceo);
      if (!o.bizNo && it.bizno) o.bizNo = str(it.bizno);
      if (em && !SELF_MAIL_RE.test(em)) {
        o.emails.add(em);
        const d = domainOf(em);
        if (d && !PUBLIC_DOMAINS.has(d)) o.domains.add(d);
      }
    }
  });

  /* ── 3. 전체 메일 통합(IMAP + POP3 중복제거) 및 과거 명시적 법인 보고서 사업장 포착 ── */
  const flatMails = Intake.flattenMailboxRows(mailFolders || {}, mailMsgs || {}, mailOldMsgs || {});
  console.log(`[2/7] 통합 메일 거울 스캔 대상: ${flatMails.length}통 (규정 서고 문서: ${Object.keys(rulesDocs || {}).length}건)`);

  flatMails.forEach(m => {
    if (SKIP_SUBJ_RE.test(m.subject)) return;
    const hay = m.subject + ' ' + (m.attNames || []).join(' ');
    if (!REPORT_CORE_RE.test(hay)) return;
    EXPLICIT_CORP_RE.lastIndex = 0;
    let match;
    while ((match = EXPLICIT_CORP_RE.exec(hay)) !== null) {
      const fullCorp = str(match[0]);
      const bare = str(match[1] || match[2]);
      if (bare.length < 2 || EXCLUDE_ORG_RE.test(fullCorp) || /^(?:일터혁신|상생컨설팅|중간보고|최종보고|결과보고|노사발전)$/.test(bare)) continue;
      const nm = normCorpName(bare);
      if (nm.length < 2) continue;
      const existingKey = byNorm.get(nm);
      if (existingKey && orgs.has(existingKey)) {
        const eo = orgs.get(existingKey);
        eo.isConsulting = true;
        if (/일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(hay)) eo.isIlteo = true;
        const my = extractYearFromTs(m.ts);
        if (my) eo.years.add(my);
      } else {
        const pc = pucardByNorm.get(nm);
        const peerAddrs = (m.dir === 'out' ? m.to : [m.from]).filter(e => e && !SELF_MAIL_RE.test(e));
        upsertOrg({
          fallbackId: 'hist_' + sha1Short(nm),
          name: (pc && pc.name) || fullCorp,
          bizNo: pc ? pc.bizNo : '',
          ceoName: pc ? pc.ceoName : '',
          industry: pc ? pc.industry : '',
          emails: (pc ? pc.emails : []).concat(peerAddrs),
          isConsulting: true,
          isIlteo: /일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(hay),
          consType: /일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(hay) ? '일터혁신 상생컨설팅' : '노무컨설팅(과거이력)',
          year: extractYearFromTs(m.ts)
        });
      }
    }
  });

  /* 주소 · 도메인 · 상호 인덱스 구축 (다중 소유 공유 주소·도메인 및 동명 상호 자동귀속 차단) */
  const addrOwners = new Map();
  const domOwners = new Map();
  const normOwners = new Map();
  orgs.forEach(o => {
    o.emails.forEach(e => {
      if (!addrOwners.has(e)) addrOwners.set(e, new Set());
      addrOwners.get(e).add(o.key);
    });
    o.domains.forEach(d => {
      if (!domOwners.has(d)) domOwners.set(d, new Set());
      domOwners.get(d).add(o.key);
    });
    if (o.normName.length >= 3) {
      if (!normOwners.has(o.normName)) normOwners.set(o.normName, new Set());
      normOwners.get(o.normName).add(o.key);
    }
  });

  const addrToOrg = new Map();
  addrOwners.forEach((set, e) => { if (set.size === 1) addrToOrg.set(e, Array.from(set)[0]); });
  const domToOrg = new Map();
  domOwners.forEach((set, d) => { if (set.size === 1) domToOrg.set(d, Array.from(set)[0]); });
  const nameSearchList = [];
  normOwners.forEach((set, nm) => {
    if (set.size === 1) nameSearchList.push({ nm, key: Array.from(set)[0] });
  });
  nameSearchList.sort((a, b) => b.nm.length - a.nm.length);

  function matchMailToOrg(m) {
    const peers = (m.dir === 'out' ? m.to : [m.from]).filter(e => e && !SELF_MAIL_RE.test(e));
    /* 서로 다른 확정 사업장에 각각 귀속되는 주소가 한 메일에 섞여 있으면 오귀속 차단 */
    const matchedKeys = new Set();
    for (const e of peers) {
      if (addrToOrg.has(e)) matchedKeys.add(addrToOrg.get(e));
    }
    if (matchedKeys.size === 1) return orgs.get(Array.from(matchedKeys)[0]);
    if (matchedKeys.size > 1) return null;

    const matchedDomKeys = new Set();
    for (const e of peers) {
      const d = domainOf(e);
      if (d && domToOrg.has(d)) matchedDomKeys.add(domToOrg.get(d));
    }
    if (matchedDomKeys.size === 1) return orgs.get(Array.from(matchedDomKeys)[0]);
    if (matchedDomKeys.size > 1) return null;

    /* 제목·첨부 상호 매칭은 동명 기업이 없는 단일 상호이면서, 내부 발송분 또는 법인격 표기 포함 메일일 때만 허용 */
    const rawSubjAtt = m.subject + ' ' + (m.attNames || []).join(' ');
    const hasExplicitLegalTag = /\(주\)|㈜|주식회사|\(유\)|유한회사|농업회사법인/.test(rawSubjAtt);
    const isInternalSent = m.dir === 'out' || SELF_MAIL_RE.test(m.from);
    if (!isInternalSent && !hasExplicitLegalTag) return null;

    const hayNorm = normCorpName(rawSubjAtt);
    if (hayNorm) {
      const hitKeys = [];
      for (const it of nameSearchList) {
        if (hayNorm.includes(it.nm)) {
          hitKeys.push(it.key);
          if (hitKeys.length > 1) return null;
        }
      }
      if (hitKeys.length === 1) return orgs.get(hitKeys[0]);
    }
    return null;
  }

  /* 사업장별 메일 버킷 분류 */
  const mailsByOrg = new Map();
  flatMails.forEach(m => {
    if (SKIP_SUBJ_RE.test(m.subject)) return;
    const hay = m.subject + ' ' + (m.attNames || []).join(' ') + ' ' + str(m.preview);
    const o = matchMailToOrg(m);
    if (!o) return;
    const isCoreReport = REPORT_CORE_RE.test(hay);
    const isConsDoc = CONS_MAIL_RE.test(hay);
    if (!isCoreReport && !(o.isConsulting && isConsDoc)) return;

    if (isCoreReport) {
      o.isConsulting = true;
      if (/일터\s*혁신|일터\s*상생|상생\s*컨설팅|노사발전재단|이음센터/.test(hay)) o.isIlteo = true;
    }
    const my = extractYearFromTs(m.ts);
    if (my) o.years.add(my);

    if (!mailsByOrg.has(o.key)) mailsByOrg.set(o.key, []);
    mailsByOrg.get(o.key).push(m);
  });

  /* ── 4. 기업규정 서고(rules_mgmt/library) 기수집 원문 매칭 ── */
  const rulesByOrg = new Map();
  Object.keys(rulesDocs || {}).forEach(docId => {
    const d = rulesDocs[docId];
    if (!d || d.status !== '담김') return;
    const txt = str(rulesTexts && rulesTexts[docId]);
    if (!txt) return;

    let targetOrg = null;
    const cands = Array.isArray(d.companyCand) ? d.companyCand : [];
    for (const c of cands) {
      if (c && c.companyId && orgs.has(String(c.companyId))) {
        targetOrg = orgs.get(String(c.companyId));
        break;
      }
    }
    if (!targetOrg && d.mail) {
      targetOrg = matchMailToOrg({
        dir: str(d.mail.from) === fromAccount ? 'out' : 'in',
        from: mailOf(d.mail.from),
        to: str(d.mail.to).split(/[,;]+/).map(mailOf).filter(Boolean),
        subject: str(d.mail.subject),
        attNames: [str(d.name)]
      });
    }
    if (!targetOrg || !targetOrg.isConsulting) return;
    if (!rulesByOrg.has(targetOrg.key)) rulesByOrg.set(targetOrg.key, []);
    rulesByOrg.get(targetOrg.key).push({ docId, doc: d, text: txt });
  });

  /* 백필 대상 사업장 확정: 컨설팅 계약·정부사업일정 등록 기업 또는 보고서 메일이 확인된 기업 */
  const targetOrgs = Array.from(orgs.values()).filter(o => o.isConsulting && str(o.name).length >= 2);
  targetOrgs.forEach(o => {
    const yrs = Array.from(o.years).filter(y => y >= 2018 && y <= 2027);
    o.latestYear = yrs.length ? Math.max(...yrs) : 2026;
  });
  console.log(`[3/7] 백필 대상 컨설팅 사업장 확정: ${targetOrgs.length}개사 (일터혁신: ${targetOrgs.filter(o => o.isIlteo).length}개사, 규정서고 매칭: ${rulesByOrg.size}개사, 메일 매칭: ${mailsByOrg.size}개사)`);

  /* ── 5. IMAP · POP3 메일 원문 및 첨부파일 읽기 전용 파싱 ── */
  /* 사업장별로 우선순위 상위 메일 선별 (중간/최종보고서·PPTX·XLSX·규정 최우선) */
  const selectedImapBySlug = new Map(); // slug -> [{ org, mail }]
  const selectedPopFull = [];           // [{ org, mail }] — 핵심 보고서·첨부 원문 RETR 대상
  const selectedPopLight = [];          // [{ org, mail }] — 미리보기·TOP 본문 분석 대상

  targetOrgs.forEach(o => {
    const list = (mailsByOrg.get(o.key) || []).slice()
      .sort((a, b) => (mailPriorityScore(b) - mailPriorityScore(a)) || (b.ts - a.ts));
    const topMails = list.slice(0, 14);
    topMails.forEach((m, idx) => {
      if (m.src === 'imap') {
        if (!selectedImapBySlug.has(m.slug)) selectedImapBySlug.set(m.slug, []);
        selectedImapBySlug.get(m.slug).push({ org: o, mail: m });
      } else if (m.src === 'pop3') {
        const hay = m.subject + ' ' + str(m.preview);
        const isHighValueReport = /중간\s*보고|최종\s*보고|결과\s*보고|완료\s*보고|일터\s*혁신|상생\s*컨설팅|컨설팅\s*보고서/.test(hay);
        if (isHighValueReport && idx < 4 && selectedPopFull.length < 110) {
          selectedPopFull.push({ org: o, mail: m });
        } else {
          selectedPopLight.push({ org: o, mail: m });
        }
      }
    });
  });

  const parsedCardsByOrg = new Map(); // orgKey -> Map(cardId -> cardPayload)
  function addOrgCard(orgKey, card) {
    if (!card || !card.id) return;
    if (!parsedCardsByOrg.has(orgKey)) parsedCardsByOrg.set(orgKey, new Map());
    parsedCardsByOrg.get(orgKey).set(card.id, card);
  }

  /* 5-1) 규정 서고(rules_mgmt/library) 기수집 원문을 카드로 변환 (1차 kordoc 가림 fail-closed 적용) */
  let rulesCardCnt = 0;
  for (const [orgKey, items] of rulesByOrg.entries()) {
    const org = orgs.get(orgKey);
    for (const { docId, doc, text } of items.slice(0, 8)) {
      try {
        const kMap = {
          '규칙본문': 'work_rules',
          '노사협의회': 'lmanagement',
          '신구대조표': 'design_feedback',
          '회의록': 'design_feedback',
          '합의·교섭': 'worker_consent'
        };
        const forcedKind = kMap[doc.kind] || 'work_rules';
        const phase = (doc.kind === '신구대조표' || doc.kind === '합의·교섭') ? 'post_mid' : 'pre_mid';
        const safeName = await sanitizeTitle(doc.name || (doc.mail && doc.mail.subject) || doc.kind, org);
        if (!safeName) continue;
        const stage1RuleText = await doubleRedactText(text);
        const analyzed = Intake.sanitizeAndAnalyzeText(stage1RuleText, {
          companyName: org.name,
          ceoName: org.ceoName,
          contactName: org.contactName,
          docKind: forcedKind,
          phase,
          subject: safeName,
          attNames: [safeName]
        });
        if (!analyzed.ok || analyzed.leakBlocked || !passesIndependentAudit(analyzed.maskedExcerpt)) continue;
        const ts = Number((doc.mail && doc.mail.date) || doc.createdAt || Date.now());
        addOrgCard(orgKey, {
          id: 'lib_' + safeKey(docId),
          source: 'rules_library',
          mailKey: doc.mail && doc.mail.key ? String(doc.mail.key) : '',
          title: safeName,
          subject: safeName,
          attNames: [safeName],
          phase: analyzed.phase,
          docKind: analyzed.docKind,
          track: analyzed.track,
          piiStripped: true,
          maskedExcerpt: analyzed.maskedExcerpt,
          stats: null,
          policyIssues: analyzed.policyIssues || [],
          postDiff: analyzed.postDiff || null,
          summaryLines: analyzed.summaryLines || [],
          checkedAt: ts,
          analyzedAt: ts
        });
        rulesCardCnt++;
      } catch (_) {}
    }
  }

  /* 5-2) IMAP 폴더별 읽기 전용(readOnly: true) 본문·첨부 일괄 파싱 */
  let imapFetchedCnt = 0, imapAttParsedCnt = 0;
  const totalImapTarget = Array.from(selectedImapBySlug.values()).reduce((a, x) => a + x.length, 0);
  console.log(`[4/7] IMAP 읽기 전용(readOnly:true) 메일·첨부 파싱 시작 (대상 ${totalImapTarget}통, ${selectedImapBySlug.size}개 폴더)...`);

  if (totalImapTarget > 0) {
    let imapClient = null;
    try {
      for (const loginId of MD.loginIds(fromAccount, process.env.DAUM_MAIL_ID)) {
        const c = new ImapFlow({
          host: 'imap.daum.net',
          port: 993,
          secure: true,
          auth: { user: loginId, pass: mailPass },
          logger: false
        });
        try {
          await c.connect();
          imapClient = c;
          break;
        } catch (_) {
          try { await c.logout(); } catch (__) {}
        }
      }

      if (imapClient) {
        for (const [slug, jobs] of selectedImapBySlug.entries()) {
          const folderInfo = mailFolders && mailFolders[slug];
          const folderPath = folderInfo && folderInfo.path;
          if (!folderPath) continue;
          let lock = null;
          try {
            lock = await imapClient.getMailboxLock(folderPath, { readOnly: true });
            for (const { org, mail } of jobs) {
              try {
                const uidNum = Number(mail.uid);
                const head = await withTimeout(
                  imapClient.fetchOne(uidNum, { uid: true, bodyStructure: true }, { uid: true }),
                  20000,
                  'IMAP_HEAD_TIMEOUT'
                );
                if (!head || !head.bodyStructure) continue;
                const parts = MS.pickParts(head.bodyStructure, null, 0);

                let bodyPlain = '';
                const txtPart = parts.text || parts.html;
                if (txtPart && txtPart.part && Number(txtPart.size || 0) < 2 * 1024 * 1024) {
                  try {
                    const dlTxt = await withTimeout(imapClient.download(uidNum, txtPart.part, { uid: true }), 15000, 'IMAP_TXT_TIMEOUT');
                    const bufTxt = await MS.drain(dlTxt.content, 2 * 1024 * 1024);
                    const cs = String(txtPart.charset || 'utf-8').toLowerCase();
                    const enc = /euc-kr|cp949|ks_c_5601/.test(cs) ? 'euc-kr' : 'utf-8';
                    const rawStr = new TextDecoder(enc, { fatal: false }).decode(bufTxt);
                    bodyPlain = parts.text ? rawStr : htmlToPlain(rawStr);
                  } catch (_) {}
                }

                const dkGuess = Intake.classifyDocKind(mail.subject, mail.attNames, bodyPlain.slice(0, 600));
                const initPhase = Intake.resolvePhase(mail.ts, 0, dkGuess, mail.subject, mail.attNames);

                let mergedStats = null;
                let mergedIssues = [];
                let mergedDiff = null;
                let attExcerpts = [];
                let attSummaries = [];
                let parsedAttItems = [];
                let finalKind = dkGuess.code;

                const wantAtts = (parts.atts || []).filter(a =>
                  a && a.name && Number(a.size || 0) <= 12 * 1024 * 1024 &&
                  /\.(pptx|xlsx|xls|csv|hwpx|hwp|docx|pdf|txt|jpg|jpeg|png)$/i.test(a.name)
                ).slice(0, 4);

                for (let ai = 0; ai < wantAtts.length; ai++) {
                  const a = wantAtts[ai];
                  try {
                    const dlAtt = await withTimeout(imapClient.download(uidNum, a.part, { uid: true }), 25000, 'IMAP_ATT_TIMEOUT');
                    const attBuf = await MS.drain(dlAtt.content, 12 * 1024 * 1024);
                    const attRes = await parseAttachmentBuffer(a.name, attBuf, org, initPhase, 0);
                    if (attRes) {
                      imapAttParsedCnt++;
                      const safeAttName = await sanitizeTitle(a.name, org);
                      parsedAttItems.push({ idx: ai, safeName: safeAttName, res: attRes });
                      if (parsedAttItems.length === 1 || attRes.docKind === 'mid_report_doc' || attRes.docKind === 'final_report_doc') {
                        finalKind = attRes.docKind || finalKind;
                      }
                      if (attRes.stats && !mergedStats) mergedStats = attRes.stats;
                      if (attRes.policyIssues && attRes.policyIssues.length) mergedIssues = mergedIssues.concat(attRes.policyIssues);
                      if (attRes.postDiff) mergedDiff = attRes.postDiff;
                      if (attRes.maskedExcerpt) attExcerpts.push(attRes.maskedExcerpt);
                      attSummaries = attSummaries.concat(attRes.summaryLines || []);
                    }
                  } catch (_) {}
                }

                const safeSubj = await sanitizeTitle(mail.subject || dkGuess.short, org);
                const safeAtts = (await Promise.all((mail.attNames || []).map(n => sanitizeTitle(n, org)))).filter(Boolean);
                if (!safeSubj) continue;

                const finalKindObj = Cat.getDocKind(finalKind) || dkGuess;
                const effectivePhase = Intake.resolvePhase(mail.ts, 0, finalKindObj, safeSubj, safeAtts);

                const combinedRaw = [attExcerpts.join('\n\n'), await doubleRedactText(bodyPlain)].filter(Boolean).join('\n\n');
                const bodyRes = Intake.sanitizeAndAnalyzeText(combinedRaw || safeSubj, {
                  companyName: org.name,
                  ceoName: org.ceoName,
                  contactName: org.contactName,
                  docKind: finalKind,
                  phase: effectivePhase,
                  subject: safeSubj,
                  attNames: safeAtts
                });
                if (!bodyRes.ok || bodyRes.leakBlocked || !passesIndependentAudit(bodyRes.maskedExcerpt)) continue;

                const sumLines = attSummaries.concat(bodyRes.summaryLines || []).filter(Boolean).slice(0, 8);
                addOrgCard(org.key, {
                  id: 'mail_' + safeKey(mail.key),
                  mailKey: mail.key,
                  source: 'mail',
                  title: safeSubj,
                  subject: safeSubj,
                  attNames: safeAtts,
                  phase: bodyRes.phase || effectivePhase,
                  docKind: finalKind || bodyRes.docKind,
                  track: (parsedAttItems.length === 1 && mergedStats) ? 'quant' : bodyRes.track,
                  piiStripped: true,
                  maskedExcerpt: bodyRes.maskedExcerpt,
                  stats: (parsedAttItems.length === 1 && mergedStats) ? mergedStats : null,
                  policyIssues: mergedIssues.length ? mergedIssues : (bodyRes.policyIssues || []),
                  postDiff: mergedDiff || bodyRes.postDiff || null,
                  summaryLines: sumLines.length ? sumLines : ['메일·첨부 내용 비식별 반영 완료'],
                  checkedAt: mail.ts || Date.now(),
                  analyzedAt: mail.ts || Date.now()
                });
                if (parsedAttItems.length >= 2) {
                  for (const pa of parsedAttItems) {
                    if (!passesIndependentAudit(pa.safeName)) continue;
                    const paDk = Cat.getDocKind(pa.res.docKind) || finalKindObj;
                    const paPh = Intake.resolvePhase(mail.ts, 0, paDk, safeSubj, pa.safeName ? [pa.safeName] : []);
                    addOrgCard(org.key, {
                      id: 'mail_' + safeKey(mail.key) + '_att_' + pa.idx,
                      mailKey: mail.key,
                      source: 'mail_att',
                      title: pa.safeName || safeSubj,
                      subject: safeSubj,
                      attNames: pa.safeName ? [pa.safeName] : [],
                      phase: paPh,
                      docKind: pa.res.docKind || finalKind,
                      track: pa.res.track || (pa.res.stats ? 'quant' : 'text'),
                      piiStripped: true,
                      maskedExcerpt: str(pa.res.maskedExcerpt),
                      stats: pa.res.stats || null,
                      policyIssues: pa.res.policyIssues || [],
                      postDiff: pa.res.postDiff || null,
                      summaryLines: (pa.res.summaryLines && pa.res.summaryLines.length) ? pa.res.summaryLines.slice(0, 6) : [pa.safeName + ' 분석 완료'],
                      checkedAt: mail.ts || Date.now(),
                      analyzedAt: mail.ts || Date.now()
                    });
                  }
                }
                imapFetchedCnt++;
              } catch (_) {}
            }
          } catch (_) {
          } finally {
            if (lock) { try { lock.release(); } catch (_) {} }
          }
        }
      }
    } finally {
      if (imapClient) { try { await imapClient.logout(); } catch (_) {} }
    }
  }
  console.log(`  → IMAP 파싱 완료: 메일 ${imapFetchedCnt}통, 첨부 문서·통계 ${imapAttParsedCnt}건 추출`);

  /* 5-3) POP3 지난 메일함 읽기 전용(DELE 없음) 핵심 보고서 RETR + 경량 메일 본문 반영 */
  let popRetrCnt = 0, popAttParsedCnt = 0, popLightCnt = 0;
  console.log(`[5/7] POP3 지난 메일함 읽기 전용 파싱 시작 (원문 RETR 대상: ${selectedPopFull.length}통, 미리보기·본문 대상: ${selectedPopLight.length}통)...`);

  if (selectedPopFull.length > 0) {
    let pop = null;
    try {
      for (const loginId of MD.loginIds(fromAccount, process.env.DAUM_MAIL_ID)) {
        try {
          pop = await MS.popOpen(loginId, mailPass, 180000);
          break;
        } catch (_) {}
      }
      if (pop) {
        const uidlBody = (await pop.cmd('UIDL', true)).body;
        const uidlRows = MS.popUidlList(uidlBody);
        const popNumByKey = new Map();
        uidlRows.forEach(x => { popNumByKey.set(MS.popKey(x.id), x.n); });

        const startPopMs = Date.now();
        for (const { org, mail } of selectedPopFull) {
          /* 전체 POP3 RETR 시간 예산 4.5분 초과 시 나머지는 경량 본문 파싱으로 안전 전환 */
          if (Date.now() - startPopMs > 270 * 1000) {
            selectedPopLight.push({ org, mail });
            continue;
          }
          const msgNo = popNumByKey.get(mail.popKey);
          if (!msgNo) {
            selectedPopLight.push({ org, mail });
            continue;
          }
          try {
            const listResp = await pop.cmd('LIST ' + msgNo, false);
            const byteSize = Number((String(listResp.head).match(/\d+\s+(\d+)/) || [])[1] || 0);
            /* 5MB 초과 대용량 POP3 메일은 TOP 120줄 초고속 수신으로 전환 (60KB/s 병목 방지) */
            const useTopOnly = byteSize > 5 * 1024 * 1024;
            const rawResp = await withTimeout(
              pop.cmd(useTopOnly ? ('TOP ' + msgNo + ' 120') : ('RETR ' + msgNo), true),
              30000,
              'POP_RETR_TIMEOUT'
            );
            const parsed = await simpleParser(Buffer.from(rawResp.body, 'binary'));
            const bodyPlain = str(parsed.text) || htmlToPlain(parsed.html) || str(mail.preview);
            const attNames = (parsed.attachments || []).map(a => str(a && a.filename)).filter(Boolean);
            const dkGuess = Intake.classifyDocKind(mail.subject, attNames, bodyPlain.slice(0, 600));
            const initPhase = Intake.resolvePhase(mail.ts, 0, dkGuess, mail.subject, attNames);

            let mergedStats = null;
            let mergedIssues = [];
            let mergedDiff = null;
            let attExcerpts = [];
            let attSummaries = [];
            let parsedAttItems = [];
            let finalKind = dkGuess.code;

            const popAttSlice = (parsed.attachments || []).slice(0, 4);
            for (let ai = 0; ai < popAttSlice.length; ai++) {
              const att = popAttSlice[ai];
              const aName = str(att && att.filename);
              if (!aName || !att.content || att.content.length > 12 * 1024 * 1024) continue;
              if (!/\.(pptx|xlsx|xls|csv|hwpx|hwp|docx|pdf|txt|jpg|jpeg|png)$/i.test(aName)) continue;
              try {
                const attRes = await parseAttachmentBuffer(aName, att.content, org, initPhase, 0);
                if (attRes) {
                  popAttParsedCnt++;
                  const safeAttName = await sanitizeTitle(aName, org);
                  parsedAttItems.push({ idx: ai, safeName: safeAttName, res: attRes });
                  if (parsedAttItems.length === 1 || attRes.docKind === 'mid_report_doc' || attRes.docKind === 'final_report_doc') {
                    finalKind = attRes.docKind || finalKind;
                  }
                  if (attRes.stats && !mergedStats) mergedStats = attRes.stats;
                  if (attRes.policyIssues && attRes.policyIssues.length) mergedIssues = mergedIssues.concat(attRes.policyIssues);
                  if (attRes.postDiff) mergedDiff = attRes.postDiff;
                  if (attRes.maskedExcerpt) attExcerpts.push(attRes.maskedExcerpt);
                  attSummaries = attSummaries.concat(attRes.summaryLines || []);
                }
              } catch (_) {}
            }

            const safeSubj = await sanitizeTitle(mail.subject || dkGuess.short, org);
            const safeAtts = (await Promise.all(attNames.map(n => sanitizeTitle(n, org)))).filter(Boolean);
            if (!safeSubj) continue;

            const finalKindObj = Cat.getDocKind(finalKind) || dkGuess;
            const effectivePhase = Intake.resolvePhase(mail.ts, 0, finalKindObj, safeSubj, safeAtts);

            const combinedRaw = [attExcerpts.join('\n\n'), await doubleRedactText(bodyPlain)].filter(Boolean).join('\n\n');
            const bodyRes = Intake.sanitizeAndAnalyzeText(combinedRaw || safeSubj, {
              companyName: org.name,
              ceoName: org.ceoName,
              contactName: org.contactName,
              docKind: finalKind,
              phase: effectivePhase,
              subject: safeSubj,
              attNames: safeAtts
            });
            if (!bodyRes.ok || bodyRes.leakBlocked || !passesIndependentAudit(bodyRes.maskedExcerpt)) continue;

            const sumLines = attSummaries.concat(bodyRes.summaryLines || []).filter(Boolean).slice(0, 8);
            addOrgCard(org.key, {
              id: 'mail_' + safeKey(mail.key),
              mailKey: mail.key,
              source: 'mail',
              title: safeSubj,
              subject: safeSubj,
              attNames: safeAtts,
              phase: bodyRes.phase || effectivePhase,
              docKind: finalKind || bodyRes.docKind,
              track: (parsedAttItems.length === 1 && mergedStats) ? 'quant' : bodyRes.track,
              piiStripped: true,
              maskedExcerpt: bodyRes.maskedExcerpt,
              stats: (parsedAttItems.length === 1 && mergedStats) ? mergedStats : null,
              policyIssues: mergedIssues.length ? mergedIssues : (bodyRes.policyIssues || []),
              postDiff: mergedDiff || bodyRes.postDiff || null,
              summaryLines: sumLines.length ? sumLines : ['과거 메일·첨부 원문 비식별 반영 완료'],
              checkedAt: mail.ts || Date.now(),
              analyzedAt: mail.ts || Date.now()
            });
            if (parsedAttItems.length >= 2) {
              for (const pa of parsedAttItems) {
                if (!passesIndependentAudit(pa.safeName)) continue;
                const paDk = Cat.getDocKind(pa.res.docKind) || finalKindObj;
                const paPh = Intake.resolvePhase(mail.ts, 0, paDk, safeSubj, pa.safeName ? [pa.safeName] : []);
                addOrgCard(org.key, {
                  id: 'mail_' + safeKey(mail.key) + '_att_' + pa.idx,
                  mailKey: mail.key,
                  source: 'mail_att',
                  title: pa.safeName || safeSubj,
                  subject: safeSubj,
                  attNames: pa.safeName ? [pa.safeName] : [],
                  phase: paPh,
                  docKind: pa.res.docKind || finalKind,
                  track: pa.res.track || (pa.res.stats ? 'quant' : 'text'),
                  piiStripped: true,
                  maskedExcerpt: str(pa.res.maskedExcerpt),
                  stats: pa.res.stats || null,
                  policyIssues: pa.res.policyIssues || [],
                  postDiff: pa.res.postDiff || null,
                  summaryLines: (pa.res.summaryLines && pa.res.summaryLines.length) ? pa.res.summaryLines.slice(0, 6) : [pa.safeName + ' 분석 완료'],
                  checkedAt: mail.ts || Date.now(),
                  analyzedAt: mail.ts || Date.now()
                });
              }
            }
            popRetrCnt++;
          } catch (popErr) {
            if (!/^KORDOC_/.test(String((popErr && popErr.message) || ''))) {
              selectedPopLight.push({ org, mail });
            }
          }
        }
      }
    } finally {
      if (pop) { try { await pop.close(); } catch (_) {} }
    }
  }

  /* 창 밖이거나 경량 대상인 POP3 메일은 기저장 미리보기(preview) + 제목으로 빠짐없이 반영 (kordoc 실패 시 fail-closed 스킵) */
  for (const { org, mail } of selectedPopLight) {
    try {
      const safeSubj = await sanitizeTitle(mail.subject, org);
      if (!safeSubj) continue;
      const rawPreview = await doubleRedactText([mail.subject, mail.preview].filter(Boolean).join('\n'));
      const dkGuess = Intake.classifyDocKind(safeSubj, mail.attNames || [], rawPreview);
      const phase = Intake.resolvePhase(mail.ts, 0, dkGuess, safeSubj, mail.attNames || []);
      const res = Intake.sanitizeAndAnalyzeText(rawPreview || safeSubj, {
        companyName: org.name,
        ceoName: org.ceoName,
        contactName: org.contactName,
        docKind: dkGuess.code,
        phase,
        subject: safeSubj,
        attNames: []
      });
      if (!res.ok || res.leakBlocked || !passesIndependentAudit(res.maskedExcerpt)) continue;
      addOrgCard(org.key, {
        id: 'mail_' + safeKey(mail.key),
        mailKey: mail.key,
        source: 'mail',
        title: safeSubj,
        subject: safeSubj,
        attNames: [],
        phase: res.phase,
        docKind: res.docKind,
        track: res.track,
        piiStripped: true,
        maskedExcerpt: res.maskedExcerpt,
        stats: null,
        policyIssues: res.policyIssues || [],
        postDiff: res.postDiff || null,
        summaryLines: (res.summaryLines && res.summaryLines.length) ? res.summaryLines : ['과거 수발신 내역 비식별 반영 완료'],
        checkedAt: mail.ts || Date.now(),
        analyzedAt: mail.ts || Date.now()
      });
      popLightCnt++;
    } catch (_) {}
  }
  console.log(`  → POP3 파싱 완료: 원문 RETR ${popRetrCnt}통(첨부 ${popAttParsedCnt}건), 경량·미리보기 ${popLightCnt}통, 규정서고 ${rulesCardCnt}건`);

  /* ── 6. 사업장 프로젝트 · 수집카드 · 중간보고서 · 최종보고서 조립 및 온톨로지 검증 ── */
  console.log('[6/7] 최신 운영 DB 재조회 및 사업장별 중간·최종보고서 원고 조립(PuOntologyWrite 검증) 중...');
  token = loadFreshAccessToken();
  const [liveProjectsRaw, liveIntakeRaw, liveMidRaw, liveFinalRaw] = await Promise.all([
    rtdbRequest('GET', '/scal_ilteo/projects', token),
    rtdbRequest('GET', '/scal_ilteo/intake', token),
    rtdbRequest('GET', '/scal_ilteo/mid', token),
    rtdbRequest('GET', '/scal_ilteo/final', token)
  ]);

  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });
  const prevProjects = liveProjectsRaw || {};
  const prevIntake = liveIntakeRaw || {};
  const prevMid = liveMidRaw || {};
  const prevFinal = liveFinalRaw || {};

  const outProjects = {};
  const outIntakePatches = {}; // pid -> { cardId: cardObj } (부분 PATCH 전용 — 기존 _deleted 묘비 보존)
  const outMid = {};
  const outFinal = {};
  const nowMs = Date.now();

  let totalSavedCards = 0;
  let midBuiltCnt = 0;
  let finalBuiltCnt = 0;
  let legacyRetiredCnt = 0;
  let skippedProtectedCnt = 0;

  function isProtectedRecord(rec) {
    if (!rec || typeof rec !== 'object') return false;
    if (rec._deleted === true) return true;
    if (rec.updatedBy && rec.updatedBy !== 'SYSTEM_BACKFILL') return true;
    return false;
  }

  function retireLegacyPid(legacyPid) {
    if (!legacyPid || !prevProjects[legacyPid] || prevProjects[legacyPid]._deleted) return;
    if (prevProjects[legacyPid].updatedBy && prevProjects[legacyPid].updatedBy !== 'SYSTEM_BACKFILL') return;
    if (outProjects[legacyPid]) return;
    const retiredProj = gw.prepare(
      stripUndef(Object.assign({}, prevProjects[legacyPid], { _deleted: true })),
      { previous: prevProjects[legacyPid], entityType: 'Project', now: nowMs }
    );
    if (retiredProj.ok) {
      outProjects[legacyPid] = stripUndef(retiredProj.value);
      legacyRetiredCnt++;
    }
    if (prevMid[legacyPid] && !prevMid[legacyPid]._deleted && (!prevMid[legacyPid].updatedBy || prevMid[legacyPid].updatedBy === 'SYSTEM_BACKFILL')) {
      const retiredMid = gw.prepare(
        stripUndef(Object.assign({}, prevMid[legacyPid], { _deleted: true })),
        { previous: prevMid[legacyPid], entityType: 'Document', now: nowMs }
      );
      if (retiredMid.ok) outMid[legacyPid] = stripUndef(retiredMid.value);
    }
    if (prevFinal[legacyPid] && !prevFinal[legacyPid]._deleted && (!prevFinal[legacyPid].updatedBy || prevFinal[legacyPid].updatedBy === 'SYSTEM_BACKFILL')) {
      const retiredFin = gw.prepare(
        stripUndef(Object.assign({}, prevFinal[legacyPid], { _deleted: true })),
        { previous: prevFinal[legacyPid], entityType: 'Document', now: nowMs }
      );
      if (retiredFin.ok) outFinal[legacyPid] = stripUndef(retiredFin.value);
    }
    const legCards = prevIntake[legacyPid] || {};
    const legPatch = {};
    Object.keys(legCards).forEach(lcid => {
      const lc = legCards[lcid];
      if (lc && !lc._deleted && (!lc.updatedBy || lc.updatedBy === 'SYSTEM_BACKFILL')) {
        const retiredCard = gw.prepare(
          stripUndef(Object.assign({}, lc, { _deleted: true })),
          { previous: lc, entityType: 'Document', now: nowMs }
        );
        if (retiredCard.ok) legPatch[lcid] = stripUndef(retiredCard.value);
      }
    });
    if (Object.keys(legPatch).length > 0) outIntakePatches[legacyPid] = legPatch;
  }

  /* 이전 백필에서 생성된 연도 미포함 구 키(ilt_<companyId>) 전수 논리 삭제 정리 */
  Object.keys(prevProjects).forEach(k => {
    if (!/_\d{4}$/.test(k) && prevProjects[k] && prevProjects[k].updatedBy === 'SYSTEM_BACKFILL') {
      retireLegacyPid(k);
    }
  });

  for (const org of targetOrgs) {
    const projYear = org.latestYear || 2026;
    const pid = 'ilt_' + safeKey(org.companyId) + '_' + projYear;
    const legacyPid = 'ilt_' + safeKey(org.companyId);
    if (legacyPid !== pid) retireLegacyPid(legacyPid);

    const prevProj = prevProjects[pid] || null;
    if (isProtectedRecord(prevProj)) {
      skippedProtectedCnt++;
      continue;
    }

    const prevCardsMap = prevIntake[pid] || {};
    const newCardsMap = parsedCardsByOrg.get(org.key) || new Map();

    const mergedIntakeMap = {};
    const pidPatchMap = {};
    Object.keys(prevCardsMap).forEach(cid => {
      if (prevCardsMap[cid] && !prevCardsMap[cid]._deleted) {
        mergedIntakeMap[cid] = prevCardsMap[cid];
      }
    });

    for (const [cid, cardRaw] of newCardsMap.entries()) {
      const prevC = prevCardsMap[cid] || null;
      if (isProtectedRecord(prevC)) continue;
      const prepCard = gw.prepare(stripUndef(Object.assign({}, prevC || {}, cardRaw, {
        id: cid,
        projectId: pid,
        entityType: 'Document',
        companyId: org.companyId,
        companyName: org.name
      })), { previous: prevC, entityType: 'Document', now: nowMs });
      if (prepCard.ok) {
        const cleanCard = stripUndef(prepCard.value);
        mergedIntakeMap[cid] = cleanCard;
        pidPatchMap[cid] = cleanCard;
        totalSavedCards++;
      }
    }

    const activeCards = Object.values(mergedIntakeMap).filter(c => c && !c._deleted);
    const selectedTasks = inferSelectedTasks(org, activeCards);

    const midTimestamps = activeCards
      .filter(c => c.docKind === 'mid_report_doc' && Number(c.checkedAt) > 0)
      .map(c => Number(c.checkedAt));
    const finTimestamps = activeCards
      .filter(c => c.docKind === 'final_report_doc' && Number(c.checkedAt) > 0)
      .map(c => Number(c.checkedAt));
    const postTimestamps = activeCards
      .filter(c => c.phase === 'post_mid' && Number(c.checkedAt) > 0)
      .map(c => Number(c.checkedAt));

    const minMidTs = midTimestamps.length ? Math.min(...midTimestamps) : 0;
    const minFinTs = finTimestamps.length ? Math.min(...finTimestamps) : 0;
    const minPostTs = postTimestamps.length ? Math.min(...postTimestamps) : 0;

    const hasMidOrig = activeCards.some(c => c.docKind === 'mid_report_doc');
    const hasFinOrig = activeCards.some(c => c.docKind === 'final_report_doc');
    const hasPostCards = activeCards.some(c => c.phase === 'post_mid');
    const isPastYear = projYear < 2026;

    let midConfirmedAt = 0;
    if (minMidTs > 0) {
      midConfirmedAt = minMidTs;
    } else if (minFinTs > 0 || minPostTs > 0) {
      const earliestPost = (minFinTs > 0 && minPostTs > 0) ? Math.min(minFinTs, minPostTs) : (minFinTs || minPostTs);
      midConfirmedAt = Math.max(1, earliestPost - 86400000);
    } else if (isPastYear) {
      midConfirmedAt = Date.UTC(projYear, 6, 1);
    }

    let finalConfirmedAt = 0;
    if (minFinTs > 0) {
      finalConfirmedAt = Math.max(minFinTs, midConfirmedAt || 0);
    } else if (isPastYear) {
      finalConfirmedAt = Math.max(Date.UTC(projYear, 11, 15), midConfirmedAt || 0);
    }

    const consTypesArr = Array.from(org.consTypes);
    const programName = org.isIlteo
      ? '일터혁신 상생컨설팅'
      : (consTypesArr[0] || '노무컨설팅');

    /* 정부사업일정(scal_scheds) 회차 매핑 */
    const rawOrgScheds = org.scalCoId
      ? scalScheds.filter(s => s && s.coId === org.scalCoId && s.phase !== 'pre' && s.phase !== 'post' && /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)))
          .sort((a, b) => (str(a.date) < str(b.date) ? -1 : 1))
      : [];
    const orgScheds = await Promise.all(rawOrgScheds.map(async (s, idx) => ({
      roundNo: idx + 1,
      date: str(s.date),
      mode: s.isField === false ? 'remote' : 'face',
      mins: 120,
      companyPeople: 4,
      topic: await sanitizeTitle(s.memo, org),
      hasPhoto: isPastYear,
      hasSign: isPastYear
    })));

    const projBase = Object.assign({}, prevProj || {});
    delete projBase.midConfirmedAt;
    delete projBase.finalConfirmedAt;

    const projPayload = stripUndef(Object.assign(projBase, {
      id: pid,
      entityType: 'Project',
      companyId: org.companyId,
      consultingId: org.consultingId || (prevProj && prevProj.consultingId) || '',
      scalCoId: org.scalCoId || (prevProj && prevProj.scalCoId) || '',
      scalTypeId: org.scalTypeId || (prevProj && prevProj.scalTypeId) || '',
      companyName: org.name,
      bizNo: org.bizNo || (prevProj && prevProj.bizNo) || '',
      industry: org.industry || (prevProj && prevProj.industry) || '제조·서비스업',
      workerCount: org.workerCount || (prevProj && prevProj.workerCount) || 0,
      year: projYear,
      programName,
      isIlteo: !!org.isIlteo,
      level: (prevProj && prevProj.level) || 'deep',
      contactEmails: Array.from(org.emails).slice(0, 10),
      selectedTasks,
      consultantName: (prevProj && prevProj.consultantName) || '푸른노무법인 전담 공인노무사',
      designTeamCount: (prevProj && prevProj.designTeamCount) || 4,
      midConfirmedAt: midConfirmedAt || undefined,
      finalConfirmedAt: finalConfirmedAt || undefined
    }));

    const prepProj = gw.prepare(projPayload, { previous: prevProj, entityType: 'Project', now: nowMs });
    if (!prepProj.ok) continue;
    const savedProj = stripUndef(prepProj.value);
    outProjects[pid] = savedProj;
    if (Object.keys(pidPatchMap).length > 0) {
      outIntakePatches[pid] = pidPatchMap;
    }

    /* 중간보고서 7개 섹션 생성 및 검증 (사용자 편집 문서 보호) */
    const builtMid = Report.buildMidReport(savedProj, mergedIntakeMap, orgScheds, prevMid[pid] || null);
    if (!isProtectedRecord(prevMid[pid])) {
      const prepMid = gw.prepare(stripUndef({
        id: pid,
        projectId: pid,
        entityType: 'Document',
        companyId: savedProj.companyId,
        companyName: savedProj.companyName,
        sections: builtMid.sections,
        locks: builtMid.locks || {}
      }), { previous: prevMid[pid] || null, entityType: 'Document', now: nowMs });
      if (prepMid.ok) {
        outMid[pid] = stripUndef(prepMid.value);
        midBuiltCnt++;
      }
    }

    /* 최종 결과보고서 7개 섹션 생성 및 검증 — 기초단계 진행중 사업장은 조기 확정·생성 방지 */
    const shouldBuildFinal = isPastYear || midConfirmedAt > 0 || finalConfirmedAt > 0 || hasMidOrig || hasFinOrig || hasPostCards;
    if (shouldBuildFinal && !isProtectedRecord(prevFinal[pid])) {
      const builtFinal = Report.buildFinalReport(savedProj, builtMid, mergedIntakeMap, orgScheds, prevFinal[pid] || null);
      const prepFinal = gw.prepare(stripUndef({
        id: pid,
        projectId: pid,
        entityType: 'Document',
        companyId: savedProj.companyId,
        companyName: savedProj.companyName,
        sections: builtFinal.sections,
        locks: builtFinal.locks || {}
      }), { previous: prevFinal[pid] || null, entityType: 'Document', now: nowMs });
      if (prepFinal.ok) {
        outFinal[pid] = stripUndef(prepFinal.value);
        finalBuiltCnt++;
      }
    } else if (!shouldBuildFinal && prevFinal[pid] && !prevFinal[pid]._deleted && !isProtectedRecord(prevFinal[pid])) {
      const retiredEarlyFin = gw.prepare(
        stripUndef(Object.assign({}, prevFinal[pid], { _deleted: true })),
        { previous: prevFinal[pid], entityType: 'Document', now: nowMs }
      );
      if (retiredEarlyFin.ok) outFinal[pid] = stripUndef(retiredEarlyFin.value);
    }
  }

  /* ── 7. 운영 RTDB /scal_ilteo 레코드별 ETag + If-Match 조건부 원자적 적재 ── */
  console.log(`[7/7] 운영 RTDB(/scal_ilteo) ETag 조건부 적재 시작: 사업장 ${Object.keys(outProjects).length}건(구키 정리 ${legacyRetiredCnt}건, 사용자보호 건너뜀 ${skippedProtectedCnt}건), 수집카드 ${totalSavedCards}건, 중간보고 ${midBuiltCnt}건, 최종보고 ${finalBuiltCnt}건...`);
  token = loadFreshAccessToken();

  const writeJobs = [];
  Object.keys(outProjects).forEach(pid => {
    writeJobs.push({
      path: '/scal_ilteo/projects/' + encodeURIComponent(pid),
      record: outProjects[pid],
      entityType: 'Project'
    });
  });
  Object.keys(outIntakePatches).forEach(pid => {
    const cmap = outIntakePatches[pid] || {};
    Object.keys(cmap).forEach(cid => {
      writeJobs.push({
        path: '/scal_ilteo/intake/' + encodeURIComponent(pid) + '/' + encodeURIComponent(cid),
        record: cmap[cid],
        entityType: 'Document'
      });
    });
  });
  Object.keys(outMid).forEach(pid => {
    writeJobs.push({
      path: '/scal_ilteo/mid/' + encodeURIComponent(pid),
      record: outMid[pid],
      entityType: 'Document'
    });
  });
  Object.keys(outFinal).forEach(pid => {
    writeJobs.push({
      path: '/scal_ilteo/final/' + encodeURIComponent(pid),
      record: outFinal[pid],
      entityType: 'Document'
    });
  });

  let committedCnt = 0;
  let skippedOrConflictCnt = 0;
  await runPool(writeJobs, 16, async (job) => {
    const r = await conditionalWriteRecord(job.path, job.record, job.entityType, gw, token);
    if (r && r.committed) committedCnt++;
    else skippedOrConflictCnt++;
  });

  /* 적재 후 활성 엔티티(!_deleted) 기준 검증 */
  const [verifyProjects, verifyMid, verifyFinal] = await Promise.all([
    rtdbRequest('GET', '/scal_ilteo/projects', token),
    rtdbRequest('GET', '/scal_ilteo/mid', token),
    rtdbRequest('GET', '/scal_ilteo/final', token)
  ]);
  const activeProjCnt = Object.values(verifyProjects || {}).filter(p => p && !p._deleted).length;
  const activeMidCnt = Object.values(verifyMid || {}).filter(m => m && !m._deleted).length;
  const activeFinCnt = Object.values(verifyFinal || {}).filter(f => f && !f._deleted).length;
  console.log('✓ 백필 적재 및 검증 완료:', {
    activeProjectsInDb: activeProjCnt,
    activeMidReportsInDb: activeMidCnt,
    activeFinalReportsInDb: activeFinCnt,
    retiredLegacyProjects: legacyRetiredCnt,
    conditionalCommitted: committedCnt,
    conflictOrProtectedSkipped: skippedOrConflictCnt
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('백필 오류:', err && err.code ? err.code : 'ERR');
    process.exitCode = 1;
  });
}

module.exports = { inferSelectedTasks, passesIndependentAudit, conditionalWriteRecord, ensureKordoc, doubleRedactText, sanitizeTitle, parseAttachmentBuffer };
