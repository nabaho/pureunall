#!/usr/bin/env node
/* 푸른통합시스템 — 12개 컨설팅 전용 앱(6차산업 포함) 전수 사업장·사건별 · 연도별 백필 스크립트
 *
 * 3대 원천 통합:
 *   1) 라이브 Firebase RTDB (/data/consultings · /data/biz_cons_types · /data/companies · /scal_staff · /uid_roles)
 *   2) 로컬 컨설팅 아카이브 (바탕화면 컨설팅 아카이브 폴더 하위 연도·사업·기업별 폴더 및 연계 엑셀)
 *   3) 푸른메일함(IMAP + POP3 33,851통) & 카톡·문자 수집함(/msg_intake/items) -> 프로젝트 연계 comms/$pid/$cid 적재
 *
 * 보안·개인정보 원칙:
 *   - 모든 프로젝트·수신자료 텍스트는 Intake.sanitizeText() 가림 후 hasResidualPii() 및 LOCAL_PATH_RE 0건 통과 시에만 기록한다.
 *   - PC 로컬 절대경로, 주민번호, 계좌번호, 전화번호, 이메일 주소는 DB에 절대 저장하지 않는다.
 *
 * 사용법:
 *   node scripts/backfill-consult-suite.js --dry-run
 *   node scripts/backfill-consult-suite.js --dry-run --audit
 *   node scripts/backfill-consult-suite.js --dry-run --app=chamber
 *   node scripts/backfill-consult-suite.js --apply
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
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));

const DB_HOST = 'pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app';
const CUR_YEAR = new Date().getFullYear();
const CLI_ARG_SAFE_RE = /^[A-Za-z0-9._:/=\-]+$/;
const LOCAL_PATH_RE = /[A-Za-z]:\\|\/(?:Users|home)\/|\\Desktop\\|\\Downloads\\/i;

function str(v) { return v == null ? '' : String(v).trim(); }
function rowsOf(v) {
  const x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter((r) => r && typeof r === 'object');
  if (x && typeof x === 'object') return Object.keys(x).map((k) => x[k]).filter((r) => r && typeof r === 'object');
  return [];
}
function safeHashId(prefix, seed) {
  let h = 2166136261;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(36)}`;
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
      path: reqPath,
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
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

function rtdbPatch(dbPath, value, token) {
  const reqPath = `${encodeDbPath(dbPath)}.json`;
  const body = JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: DB_HOST,
      path: reqPath,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode} PATCH ${dbPath}: ${txt.slice(0, 160)}`));
        resolve(txt ? JSON.parse(txt) : {});
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function listDirSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
}

function countFilesShallow(dir) {
  return listDirSafe(dir).filter((x) => !x.isDirectory()).length;
}

function extractCompanyFromFolderName(raw) {
  let s = str(raw).normalize('NFC');
  // 129환자이송센터·100치과·6차산업은 숫자 보존, 연번 접두(1., 2. , 1유하정판, 6 팩트)만 제거
  if (!/^(?:\d+차|\d+호|\d+인|\d+대|129|100)/.test(s)) {
    s = s.replace(/^\d{1,2}[.\s_-]+(?=[가-힣A-Za-z㈜(])/, '');
    s = s.replace(/^(\d{1})(?=[가-힣]{2,})/, '');
  }
  s = s.replace(/^(?:20\d{2})[\s_-]+/, '');
  s = s.replace(/[-–_(\[]\s*(?:종료|완료|중간종료|진행중?|1차|2차)\s*[)\]]?$/i, '');
  s = s.replace(/[-–_]\s*(?:서류검토|보낼서류|컨설팅|퇴직금산정공문|자료)$/i, '');
  return Intake.cleanCompanyLabel(s);
}

const EXCLUDE_LOCAL_FOLDER_RE = /^(?:0\.?\s*|00\.?\s*|\.|_|\d+_\s*$|관련규정|모기관자회사송부용|기술보호교재|기술보호규정|기존자료|기존사업|비밀유지서약서|영업금지|제3기\s*전문가|신청기업\s*서류|기본서류|안내자료|참고자료|공통|노동부\s*수정요청|중간산출물|지방공기업평가원-최종보고서|최종보고서|기관\s*규정|이력서|새일센터.*강의|자료제출|2021\s*평가기준|2107|차워크숍|보고서\s*양식|기타|기타서식|규정정비|근로계약서|chuieop|tests|혁신바우처_홍보|회생기업|노사협의회\s*설치|\(10\.26|\(서식\)|가족친화인증\s*컨설팅\s*중간산출물)/i;
const META_OR_TEMPLATE_NAME_RE = /운영지침|전문위원\s*관리카드|사업설명\s*자료|매뉴얼|예상질문|결과보고서\s*양식|컨설턴트\s*배포|표준결과보고서|활동내용\s*안내|활동\s*안내|신청서\s*모음|배정표|위촉계약서|교육자료|공고문|과업지시서|제안요청서|평가기준|현황\s*조사표|자료배포|수행양식|중간산출물|컨설팅\s*신청서|^직장내괴롭힘$/i;

function isTemplateOrMetaFolder(name) {
  const s = str(name);
  if (!s) return true;
  if (EXCLUDE_LOCAL_FOLDER_RE.test(s)) return true;
  if (/^\[(?:한국공인노무사회|충남북부상의|충남농업6차산업센터|지방공기업평가원)\]/.test(s)) return true;
  if (/결과보고서\s*양식|컨설팅\s*관련\s*\(/.test(s)) return true;
  if (META_OR_TEMPLATE_NAME_RE.test(s) && !/\((?:종료|완료)\)|주식회사|㈜|\(주\)/.test(s)) return true;
  return false;
}

function inferYearFromDirAndFiles(dirPath, fallbackYear) {
  const baseName = path.basename(dirPath);
  const bm = baseName.match(/(201[2-9]|202[0-6])/);
  if (bm) return Number(bm[1]);
  const years = [];
  for (const ent of listDirSafe(dirPath)) {
    const m = ent.name.match(/(201[2-9]|202[0-6])/);
    if (m) years.push(Number(m[1]));
    else {
      const m2 = ent.name.match(/(?:^|[_-])(1[5-9]|2[0-6])(?:0[1-9]|1[0-2])/);
      if (m2) years.push(2000 + Number(m2[1]));
    }
  }
  if (years.length) return Math.max(...years);
  return fallbackYear || 2023;
}

function sampleSanitizedDocNames(dirPath) {
  const names = [];
  for (const ent of listDirSafe(dirPath)) {
    if (ent.name.startsWith('~$') || ent.name.startsWith('.')) continue;
    if (!ent.isDirectory()) {
      const clean = Intake.sanitizeText(ent.name);
      if (clean && !LOCAL_PATH_RE.test(clean)) names.push(clean.slice(0, 120));
    }
    if (names.length >= 6) break;
  }
  return names;
}

function scanLocalConsultingArchive(excelDir) {
  const records = [];
  if (!excelDir || !fs.existsSync(excelDir)) return records;

  function pushLocal(appKey, rawName, year, dirPath, opts = {}) {
    const companyName = extractCompanyFromFolderName(rawName);
    if (!companyName || companyName.length < 2) return;
    if (Intake.isAgencyNoticeLabel(companyName) && !/새마을|금고|복지관|공단|문화재단|시청|구청|교대|의료|약국|치과|병원/.test(companyName)) return;
    const isClosedText = /종료|완료/.test(str(rawName)) || Number(year) < CUR_YEAR;
    const tr = Intake.inferTrackForApp(appKey, `${opts.trackHint || ''} ${rawName} ${companyName}`, []);
    const docNames = opts.docNames || sampleSanitizedDocNames(dirPath);
    records.push({
      appKey,
      companyName,
      year: Number(year || CUR_YEAR),
      trackId: (tr && tr.id) || 'default',
      trackName: (tr && tr.name) || (Cats.get(appKey) && Cats.get(appKey).shortName) || appKey,
      status: opts.forceActive ? 'active' : (isClosedText ? 'done' : 'active'),
      stage: opts.forceActive ? 'visit' : (isClosedText ? 'followup' : 'visit'),
      docCount: Number(opts.docCount != null ? opts.docCount : Math.max(docNames.length, countFilesShallow(dirPath))),
      docNames,
      tag: str(opts.tag || '로컬 아카이브')
    });
  }

  // 1) 2. 상공회의소 컨설팅 (북부상의 vs 서산상의 연도별 전수)
  const chamberDir = path.join(excelDir, '2. 상공회의소 컨설팅');
  for (const topEnt of listDirSafe(chamberDir)) {
    if (!topEnt.isDirectory()) continue;
    const topPath = path.join(chamberDir, topEnt.name);
    const ym = topEnt.name.match(/(20\d{2})/);
    const yr = ym ? Number(ym[1]) : 2026;
    const topHint = /서산/.test(topEnt.name) ? '서산상공회의소' : (/당진/.test(topEnt.name) ? '당진상공회의소' : '충남북부상공회의소');

    const children = listDirSafe(topPath).filter((x) => x.isDirectory());
    const isRegionBucket = (c) => !isTemplateOrMetaFolder(c.name)
      && /^(?:20\d{2}\s*(?:년\s*[\[(]?)?\s*(?:서산\s*상공회의소|충남북부\s*(?:상공회의소|상의)|당진\s*상공회의소))/.test(c.name)
      && listDirSafe(path.join(topPath, c.name)).some((g) => g.isDirectory());
    const hasRegionBuckets = children.some(isRegionBucket);
    if (hasRegionBuckets) {
      for (const regEnt of children) {
        if (isTemplateOrMetaFolder(regEnt.name)) continue;
        const regHint = /서산/.test(regEnt.name) ? '서산상공회의소' : (/당진/.test(regEnt.name) ? '당진상공회의소' : '충남북부상공회의소');
        const regPath = path.join(topPath, regEnt.name);
        for (const coEnt of listDirSafe(regPath)) {
          if (!coEnt.isDirectory() || isTemplateOrMetaFolder(coEnt.name)) continue;
          pushLocal('chamber', coEnt.name, yr, path.join(regPath, coEnt.name), { trackHint: regHint, tag: `${yr} ${regHint}` });
        }
      }
    } else {
      for (const coEnt of children) {
        if (isTemplateOrMetaFolder(coEnt.name)) continue;
        pushLocal('chamber', coEnt.name, yr, path.join(topPath, coEnt.name), { trackHint: topHint, tag: `${yr} ${topHint}` });
      }
    }
  }

  // 2) 5. 기술보호컨설팅(대중소협력재단) (2022~2026)
  const techDir = path.join(excelDir, '5. 기술보호컨설팅(대중소협력재단)');
  for (const yrEnt of listDirSafe(techDir)) {
    if (!yrEnt.isDirectory()) continue;
    const ym = yrEnt.name.match(/(20\d{2})/);
    const yr = ym ? Number(ym[1]) : 2026;
    if (yr >= 2027) continue;
    const yrPath = path.join(techDir, yrEnt.name);
    for (const coEnt of listDirSafe(yrPath)) {
      if (!coEnt.isDirectory()) continue;
      if (isTemplateOrMetaFolder(coEnt.name)) continue;
      let nm = coEnt.name.replace(/^기술보호규정및서류검토\(([^)]+)\)$/, '$1');
      nm = nm.replace(/^\d+\.\s*현장자문\(인적보호\)_보고서_/, '');
      const bracketCorp = nm.match(/^\u005B(?:주식회사\s*)?([^\u005D]+)\u005D/);
      if (bracketCorp) nm = bracketCorp[1];
      pushLocal('techprotect', nm, yr, path.join(yrPath, coEnt.name), { tag: `${yr} 통합 기술보호지원반` });
    }
  }

  // 3) 1. 공공기관컨설팅 (2021~2026: 6차산업 · 출산육아 · 사회적기업 · 중기청클리닉 · 공공기관 · 소상공/외투)
  const pubDir = path.join(excelDir, '1. 공공기관컨설팅');
  for (const yrEnt of listDirSafe(pubDir)) {
    if (!yrEnt.isDirectory()) continue;
    const ym = yrEnt.name.match(/(20\d{2})/);
    const folderYr = ym ? Number(ym[1]) : 2024;
    const yrPath = path.join(pubDir, yrEnt.name);
    for (const subEnt of listDirSafe(yrPath)) {
      if (!subEnt.isDirectory()) continue;
      const subName = subEnt.name;
      const subPath = path.join(yrPath, subName);
      const subYrM = subName.match(/(20\d{2})/);
      const yr = subYrM ? Number(subYrM[1]) : folderYr;

      if (/소규모사업장\s*안전보건|노인인력개발$|공정채용$/.test(subName)) continue;

      if (/6차산업|농촌융복합/.test(subName)) {
        if (/활동\s*안내|공문/.test(subName)) {
          // 6차산업 관련 파일 속 경영체 추출 (예: _한국효소.hwp)
          for (const fEnt of listDirSafe(subPath)) {
            const m = fEnt.name.match(/[-_]([가-힣A-Za-z0-9]{2,14})\.(?:hwp|hwpx|pdf|zip)$/i);
            if (m && !/안내|매뉴얼|일체|계획|질문|서약서|관리카드|서류|요청|명단|컨설턴트명/.test(m[1])) {
              pushLocal('sixthind', m[1], yr, subPath, { trackHint: subName, docCount: 1, docNames: [Intake.sanitizeText(fEnt.name)], tag: `${yr} 6차산업` });
            }
          }
          continue;
        }
        const kids = listDirSafe(subPath).filter((x) => x.isDirectory() && !isTemplateOrMetaFolder(x.name));
        for (const k of kids) {
          pushLocal('sixthind', k.name, yr, path.join(subPath, k.name), { trackHint: subName, tag: `${yr} 6차산업 현장코칭` });
        }
        for (const fEnt of listDirSafe(subPath)) {
          if (fEnt.isDirectory()) continue;
          const m = fEnt.name.match(/(?:결과보고서|산출물|보고서)[_(\s]*([가-힣A-Za-z0-9㈜()]{2,20})[)\s]*(?:\.|_)/);
          if (m && !/공통|양식|노무사/.test(m[1])) {
            pushLocal('sixthind', m[1], yr, subPath, { trackHint: subName, docCount: 1, docNames: [Intake.sanitizeText(fEnt.name)], tag: `${yr} 6차산업` });
          }
        }
        continue;
      }

      if (/출산육아|가족친화/.test(subName)) {
        const subWalk = [subPath];
        if (subName === '2025 출산육아우수기업') {
          for (const d of ['점검사업장', '2차점검', '2025 출산 육아우수 3차 보고서']) subWalk.push(path.join(subPath, d));
        }
        for (const wp of subWalk) {
          for (const k of listDirSafe(wp)) {
            if (!k.isDirectory() || isTemplateOrMetaFolder(k.name)) continue;
            if (/^(?:점검사업장|2차점검|2025\s*출산|2025\s*출산육아우수기업)/.test(k.name)) continue;
            pushLocal('familywork', k.name, yr, path.join(wp, k.name), { trackHint: subName, tag: `${yr} 일·가정양립` });
          }
        }
        continue;
      }

      if (/충남중기청\s*이동상담/.test(subName)) {
        for (const k of listDirSafe(subPath)) {
          if (k.isDirectory() && !isTemplateOrMetaFolder(k.name)) pushLocal('clinic', k.name, yr, path.join(subPath, k.name), { trackHint: '충남중기청', tag: `${yr} 이동상담` });
        }
        continue;
      }

      if (/사회적경제|사경|사회적기업|산학융합원/.test(subName)) {
        const appK = 'socialent';
        const bracketCo = subName.match(/\u005B\s*((?:주식회사|\(주\)|㈜)?[가-힣A-Za-z0-9·]{2,18})\s*\u005D/);
        if (bracketCo && !/충남사회적경제|서산|당진/.test(bracketCo[1])) {
          pushLocal(appK, bracketCo[1], yr, subPath, { trackHint: subName, tag: `${yr} 사회적기업` });
        }
        for (const k of listDirSafe(subPath)) {
          if (k.isDirectory() && !isTemplateOrMetaFolder(k.name)) {
            if (/^2\.\s*\[충남사회적경제지원센터\]/.test(k.name) || /인사노무컨설팅\s*결과보고서/.test(k.name)) continue;
            if (/^동행컨설팅보고서\(([^)]+)\)/.test(k.name)) {
              const mm = k.name.match(/\(([^)]+)\)/);
              if (mm && !/^\d+$/.test(mm[1])) pushLocal(appK, mm[1], yr, path.join(subPath, k.name), { trackHint: subName, tag: `${yr} 동행컨설팅` });
              continue;
            }
            if (/^산학융합원/.test(k.name)) continue;
            pushLocal(appK, k.name, yr, path.join(subPath, k.name), { trackHint: subName, tag: `${yr} 사회적경제` });
          } else if (!k.isDirectory()) {
            const fm = k.name.match(/(?:상담신청서\(([^)]+)\)|프로보노[^-]*-\s*([가-힣A-Za-z0-9㈜]+)|^([^_]+)_컨설팅\s*수행일지)/);
            const hitCo = fm && (fm[1] || fm[2] || fm[3]);
            if (hitCo && !/충남사회적경제/.test(hitCo)) {
              pushLocal(appK, hitCo, yr, subPath, { trackHint: subName, docCount: 1, docNames: [Intake.sanitizeText(k.name)], tag: `${yr} 사회적경제` });
            }
          }
        }
        continue;
      }

      if (/외투기업|소상공/.test(subName)) {
        for (const k of listDirSafe(subPath)) {
          if (k.isDirectory() && !isTemplateOrMetaFolder(k.name)) {
            if (/컨설팅\s*비용/.test(k.name)) continue;
            pushLocal('specialcons', k.name, yr, path.join(subPath, k.name), { trackHint: subName, tag: `${yr} 특화위탁` });
          }
        }
        continue;
      }

      if (/근무혁신/.test(subName)) {
        pushLocal('familywork', '근무혁신인센티브 수행', yr, subPath, { trackHint: '유연근무', tag: `${yr} 근무혁신인센티브` });
        continue;
      }

      // 공공기관자회사, 공무직, 사회서비스원, 노인인력개발원, 지방공공기관, 특구FNS, 사회복지사 노무상담
      const dirKids = listDirSafe(subPath).filter((x) => x.isDirectory() && !isTemplateOrMetaFolder(x.name));
      if (dirKids.length) {
        for (const k of dirKids) {
          if (/^기관\s*규정|^최종보고서|^노동부/.test(k.name)) continue;
          pushLocal('pubconsult', k.name, yr, path.join(subPath, k.name), { trackHint: subName, tag: `${yr} 공공기관` });
        }
      }
      if (/특구FNS/.test(subName)) {
        pushLocal('pubconsult', '특구FNS', yr, subPath, { trackHint: '공공기관', tag: `${yr} 공공기관` });
      } else if (/국가보훈처/.test(subName)) {
        pushLocal('pubconsult', '국가보훈처(공무직인사관리)', yr, subPath, { trackHint: '공무직', tag: `${yr} 공무직` });
      } else if (/사회서비스원|사회복지사/.test(subName)) {
        for (const fEnt of listDirSafe(subPath)) {
          if (fEnt.isDirectory()) continue;
          const m = fEnt.name.match(/(?:-\s*([^.\s_]+(?:센터|예술단))|\d+\.\s*([가-힣A-Za-z0-9]+)_노무상담)/);
          const nm = m && (m[1] || m[2]);
          if (nm) pushLocal('pubconsult', nm, yr, subPath, { trackHint: subName, docCount: 1, docNames: [Intake.sanitizeText(fEnt.name)], tag: `${yr} 사회서비스·복지` });
        }
      }
    }
  }

  // 4) 바탕화면 컨설팅 아카이브 폴더 연도별·유형별 하위 폴더
  const dir2025 = path.join(excelDir, '2025');
  for (const ent of listDirSafe(dir2025)) {
    const p = path.join(dir2025, ent.name);
    if (!ent.isDirectory()) continue;
    if (/MG맞춤/.test(ent.name)) {
      for (const k of listDirSafe(p)) {
        if (k.isDirectory()) pushLocal('laboraudit', k.name, 2025, path.join(p, k.name), { trackHint: '새마을금고 노무진단', tag: '2025 노무진단' });
      }
    } else if (/자율점검/.test(ent.name)) {
      const doneDir = path.join(p, '2. 점검종료 사업장');
      for (const fEnt of listDirSafe(doneDir)) {
        const m = fEnt.name.match(/점검표_(.+)\.pdf$/i);
        if (m) pushLocal('laboraudit', m[1], 2025, doneDir, { trackHint: '자율점검', docCount: 1, docNames: [Intake.sanitizeText(fEnt.name)], tag: '2025 기초노동질서 자율점검' });
      }
    } else if (/서산비정규직/.test(ent.name)) {
      pushLocal('specialcons', '서산비정규직상담센터', 2025, p, { trackHint: '비정규직 고용구조개선', tag: '2025 고용구조개선' });
    }
  }

  const dir2023 = path.join(excelDir, '2023');
  if (fs.existsSync(path.join(dir2023, '2023 비즈,일반 컨설팅'))) {
    for (const k of listDirSafe(path.join(dir2023, '2023 비즈,일반 컨설팅'))) {
      if (k.isDirectory()) pushLocal('clinic', k.name, 2023, path.join(dir2023, '2023 비즈,일반 컨설팅', k.name), { trackHint: '비즈니스지원단', tag: '2023 비즈컨설팅' });
    }
  }
  const dirKowin = path.join(dir2023, '2023조직진단(코윈테크)');
  if (fs.existsSync(dirKowin)) {
    pushLocal('evalcomp', '코윈테크', 2023, dirKowin, { trackHint: '조직진단 직무', tag: '2023 조직진단' });
    if (fs.existsSync(path.join(dirKowin, '스테코_승격실시기준_230511'))) {
      pushLocal('evalcomp', '스테코', 2023, path.join(dirKowin, '스테코_승격실시기준_230511'), { trackHint: '임금·승격평가', tag: '2023 평가보상' });
    }
  }

  // 소상공인컨설팅 2021~2022
  for (const sy of ['2021 컨설팅업체', '2022 컨설팅업체']) {
    const sp = path.join(excelDir, '소상공인컨설팅_관련서식', sy);
    const yr = Number(sy.slice(0, 4));
    for (const k of listDirSafe(sp)) {
      if (!k.isDirectory() || /역량강화컨설팅/.test(k.name)) continue;
      pushLocal('specialcons', k.name, yr, path.join(sp, k.name), { trackHint: '외투기업 소상공', tag: `${yr} 소상공인컨설팅` });
    }
  }

  // 2017 이철노무사 컨설팅사업장
  const dir2017 = path.join(excelDir, '2017', '2017 이철노무사 컨설팅사업장');
  for (const k of listDirSafe(dir2017)) {
    if (!k.isDirectory() || isTemplateOrMetaFolder(k.name)) continue;
    const kp = path.join(dir2017, k.name);
    const yr = Math.min(2018, inferYearFromDirAndFiles(kp, 2017));
    pushLocal('hrconsult', k.name, yr, kp, { trackHint: '기초컨설팅', tag: `${yr} 기초인사노무` });
  }

  // 바탕화면 통상변화대응 폴더 동적 스캔
  const desk = path.dirname(excelDir);
  for (const dEnt of listDirSafe(desk)) {
    if (!dEnt.isDirectory()) continue;
    if (/통상변화대응/.test(dEnt.name)) {
      const mCo = dEnt.name.match(/통상변화대응[\s_\-–]+([^\s(\[\u005D]+)/);
      const coRaw = (mCo && mCo[1]) || dEnt.name.replace(/^.*통상변화대응[\s_\-–]*/, '');
      const ym = dEnt.name.match(/(20\d{2})/);
      pushLocal('specialcons', coRaw, ym ? Number(ym[1]) : CUR_YEAR, path.join(desk, dEnt.name), { trackHint: '중진공 통상변화대응', tag: `${ym ? ym[1] : CUR_YEAR} 통상변화대응`, forceActive: true });
    }
  }

  // 5) 컨설팅업체 직속 개별 기업 폴더(102개 중 실사업장만)
  for (const topEnt of listDirSafe(excelDir)) {
    if (!topEnt.isDirectory()) continue;
    if (/^[0-9]|^_|^\./.test(topEnt.name) || isTemplateOrMetaFolder(topEnt.name)) continue;
    const full = path.join(excelDir, topEnt.name);
    const fileHints = listDirSafe(full).map((x) => x.name).join(' ');
    const comb = `${topEnt.name} ${fileHints}`;
    const yr = inferYearFromDirAndFiles(full, 2021);
    let appK = 'hrconsult';
    if (/비즈니스지원단|비즈콜|-비즈(?=$|[\s_.-])/.test(comb)) appK = 'clinic';
    else if (/사내하도급|공정채용|혁신바우처|이음센터|외투/.test(comb)) appK = 'specialcons';
    else if (/평가|KPI|승격|호봉|조직진단|직무급/.test(comb)) appK = 'evalcomp';
    else if (/시정지시|자율점검|노무진단|감독/.test(comb)) appK = 'laboraudit';
    else if (/단체교섭|임단협|노사협의회\s*설치|노동조합/.test(comb)) appK = 'unionneg';
    else if (/청소년상담|복지센터|문화센터/.test(comb)) appK = 'pubconsult';
    pushLocal(appK, topEnt.name, yr, full, { trackHint: comb, tag: `${yr} 로컬 수행이력` });
  }

  return records;
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

function buildStaffMaps(scalStaffRaw, uidRolesRaw) {
  const sidToName = Object.create(null);
  const sidToUid = Object.create(null);
  let adminUid = '';
  let adminName = '전담 노무사';

  for (const s of rowsOf(scalStaffRaw)) {
    const sid = str(s.erpSid || s.sid);
    if (sid && str(s.name)) sidToName[sid] = str(s.name);
  }
  if (uidRolesRaw && typeof uidRolesRaw === 'object') {
    for (const [uid, r] of Object.entries(uidRolesRaw)) {
      if (!r || r.status !== 'active') continue;
      if (str(r.sid)) sidToUid[str(r.sid)] = uid;
      if ((r.isAdmin == true || r.role === 'admin') && !adminUid) {
        adminUid = uid;
        if (sidToName[str(r.sid)]) adminName = sidToName[str(r.sid)];
      }
      if (str(r.sid) === 'P-001') {
        adminUid = uid;
        if (sidToName['P-001']) adminName = sidToName['P-001'];
      }
    }
  }
  return { sidToName, sidToUid, adminUid, hasRealAdmin: !!adminUid, adminName };
}

function isGoodMailOnlyCandidate(appKey, b) {
  if (!b || b.isAgencyNotice) return false;
  if (b.companyId || b.erpCount > 0 || b.msgCount > 0) return true;
  const nm = str(b.companyName);
  if (!nm || nm.length < 2 || nm === '미확인 사업장') return false;
  if (/^(?:re|fw|fwd|회신|문의|답변|자료|안내|요청|공고|공지|제목없음)$/i.test(nm)) return false;
  if (/^\d+(?:년|월|일|$)/.test(nm)) return false;
  // 소규모 전문 사업(6차산업·상공회의소·기술보호·사회적기업·평가보상·노사교섭)은 핵심어 >=50 이상 실건 편입,
  // 초대형 메일함(기초인사노무·자율점검·현장클리닉·공공기관)은 원장 일치 또는 다중 메일/법인 표기/핵심점수 >=70 선별
  if (['chamber', 'techprotect', 'sixthind', 'socialent', 'unionneg', 'evalcomp', 'familywork'].includes(appKey)) {
    return b.topScore >= 50 || b.mailCount >= 2 || /(?:주식회사|㈜|\(주\)|협동조합|영농조합|농원|농장|공사|공단|재단|센터|복지관)/.test(nm);
  }
  return b.topScore >= 70 || (b.topScore >= 50 && b.mailCount >= 2);
}

function isCleanForRtdb(obj) {
  const fullJson = JSON.stringify(obj);
  if (LOCAL_PATH_RE.test(fullJson)) return false;
  // ID/타임스탬프(createdAt/id/companyId) 오탐을 피하고 모든 사용자 가시 문자열만 PII 검증
  const textParts = [
    obj.companyName, obj.caseNo, obj.trackName, obj.summaryNote, obj.consultantName,
    obj.subject, obj.maskedPreview,
    Array.isArray(obj.atts) ? obj.atts.join(' ') : '',
    Array.isArray(obj.matchedReasons) ? obj.matchedReasons.join(' ') : ''
  ].filter(Boolean).join(' ');
  return !Intake.hasResidualPii(textParts);
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doPruneStale = args.includes('--prune-stale');
  const doAudit = args.includes('--audit');
  const appArg = (args.find((a) => a.startsWith('--app=')) || '').slice(6);
  const excelDir = process.env.PUREUN_CONSULT_DIR || path.join(os.homedir(), 'Desktop', '컨설팅업체');

  const token = loadFreshAccessToken();
  if (!token) {
    console.log('Firebase CLI 토큰이 없어 오프라인 로컬 집계만 수행합니다.');
  }

  const targetCats = appArg ? [Cats.get(appArg)].filter(Boolean) : Cats.listNew12();
  const excelSummary = scanLocalExcelMasters(excelDir);
  const localRecords = scanLocalConsultingArchive(excelDir);

  let mailboxFolders = {};
  let mailboxMsgs = {};
  let mailboxOldMsgs = {};
  let companies = [];
  let consultings = [];
  let consTypes = [];
  let msgIntake = {};
  let scalStaffRaw = {};
  let uidRolesRaw = {};
  const existingScalByApp = Object.create(null);

  if (token) {
    const readOrEmpty = (p, fb) => (doApply ? rtdbGet(p, token) : rtdbGet(p, token).catch(() => fb));
    const [flds, msgs, oldMsgs, cos, cons, cTypes, mi, stf, ur] = await Promise.all([
      readOrEmpty('/mailbox/folders', {}),
      readOrEmpty('/mailbox/msgs', {}),
      readOrEmpty('/mailbox/old/msgs', {}),
      readOrEmpty('/data/companies', []),
      readOrEmpty('/data/consultings', []),
      readOrEmpty('/data/biz_cons_types', []),
      readOrEmpty('/msg_intake/items', {}),
      readOrEmpty('/scal_staff', {}),
      readOrEmpty('/uid_roles', {})
    ]);
    mailboxFolders = flds || {};
    mailboxMsgs = msgs || {};
    mailboxOldMsgs = oldMsgs || {};
    companies = rowsOf(cos);
    consultings = rowsOf(cons);
    consTypes = rowsOf(cTypes);
    msgIntake = mi || {};
    scalStaffRaw = stf || {};
    uidRolesRaw = ur || {};

    await Promise.all(targetCats.map(async (cat) => {
      const rootNode = await readOrEmpty(`/${cat.rtdbRoot}`, {});
      existingScalByApp[cat.key] = rootNode || {};
    }));
  } else if (doApply) {
    throw new Error('Firebase 액세스 토큰을 읽지 못해 --apply 백필을 중단합니다.');
  }

  const staffMaps = buildStaffMaps(scalStaffRaw, uidRolesRaw);
  const lookup = Intake.buildCompanyLookup(companies);
  const flatMails = Intake.flattenMailbox(mailboxFolders, mailboxMsgs, mailboxOldMsgs);

  console.log(`\n[푸른 컨설팅 12개 사업 전수 사업장·사건·연도별 백필 ${doApply ? 'APPLY' : (doAudit ? 'AUDIT' : 'DRY-RUN')}]`);
  console.log(`- 원천: 메일(IMAP+POP3) ${flatMails.length}통 · 업체원장 ${companies.length}개 · ERP 컨설팅 ${consultings.length}건(유형 ${consTypes.length}종) · 로컬 아카이브 ${localRecords.length}건\n`);

  let piiLeakCount = 0;
  let totalProjectsPlanned = 0;
  let totalCommsPlanned = 0;
  let totalWrittenProj = 0;
  let totalWrittenComm = 0;
  let totalPrunedProj = 0;

  for (const cat of targetCats) {
    const existingRoot = existingScalByApp[cat.key] || {};
    const existingProjectsMap = (existingRoot && existingRoot.projects) || {};
    const existingCommsMap = (existingRoot && existingRoot.comms) || {};
    const existingChecksMap = (existingRoot && existingRoot.checks) || {};
    const existingReportsMap = (existingRoot && existingRoot.reports) || {};
    const manualProjects = Object.values(existingProjectsMap).filter((p) => p && !p._deleted && !String(p.id || '').startsWith('bf_'));

    // 1) 메일·ERP·카톡 통합 발굴
    const res = Intake.discoverForApp(cat.key, {
      companies,
      consultings,
      consTypes,
      regions: rowsOf(existingRoot.regions),
      projects: manualProjects,
      flatMails,
      msgIntake
    });

    // 2) 병합 테이블: key = (coId || normName) | year | (chamber ? trackId : *) | (caseNo || *)
    const mergedMap = Object.create(null);
    const primaryKeyByCoYrTr = Object.create(null);

    function upsertTarget(srcKind, rec) {
      const cleanName = Intake.sanitizeText(rec.companyName);
      const normNm = Intake.normCorpName(cleanName);
      // 온톨로지 규칙: 이름 일치만으로 companyId 를 자동 대입하지 않고 명시적 ID 가 있을 때만 연결한다.
      const coObj = rec.companyId
        ? lookup.list.find((c) => str(c.id) === str(rec.companyId))
        : null;
      const cid = coObj ? str(coObj.id) : str(rec.companyId);
      const yr = Number(rec.year || CUR_YEAR);
      const trId = str(rec.trackId || (cat.tracks && cat.tracks[0] && cat.tracks[0].id) || 'default');
      const trName = str(rec.trackName || (cat.tracks && cat.tracks[0] && cat.tracks[0].name) || cat.shortName);
      const caseNo = str(rec.caseNo);
      const baseCoKey = cid ? `co_${cid}` : `nm_${normNm || safeHashId('co', cleanName)}`;
      const coYrTr = `${baseCoKey}|${yr}|${cat.key === 'chamber' ? trId : '*'}`;

      let mKey;
      if (caseNo) {
        mKey = `${coYrTr}|${caseNo}`;
        if (!primaryKeyByCoYrTr[coYrTr]) primaryKeyByCoYrTr[coYrTr] = mKey;
      } else if (primaryKeyByCoYrTr[coYrTr]) {
        mKey = primaryKeyByCoYrTr[coYrTr];
      } else {
        mKey = coYrTr;
        primaryKeyByCoYrTr[coYrTr] = mKey;
      }

      if (!mergedMap[mKey]) {
        mergedMap[mKey] = {
          seedKey: mKey,
          companyId: cid,
          companyName: cleanName,
          bizNo: coObj ? str(coObj.bizNo).replace(/[^0-9-]/g, '') : '',
          caseNo,
          year: yr,
          trackId: trId,
          trackName: trName,
          stage: yr < CUR_YEAR ? 'followup' : (rec.stage || 'collect'),
          status: yr < CUR_YEAR ? 'done' : (rec.status || 'active'),
          consultantSid: str(rec.consultantSid),
          workerCount: numOrZero(coObj && coObj.workers),
          sources: {},
          notes: [],
          comms: []
        };
      }
      const cur = mergedMap[mKey];
      cur.sources[srcKind] = 1;
      if (cid && !cur.companyId) cur.companyId = cid;
      if (caseNo && !cur.caseNo) cur.caseNo = caseNo;
      if (rec.consultantSid && !cur.consultantSid) cur.consultantSid = str(rec.consultantSid);
      if (rec.status === 'done') { cur.status = 'done'; cur.stage = 'followup'; }
      if (rec.note && cur.notes.indexOf(rec.note) < 0) cur.notes.push(rec.note);
      if (Array.isArray(rec.comms)) {
        for (const cm of rec.comms) {
          if (cur.comms.length < 15) cur.comms.push(cm);
        }
      }
    }

    // 2a) 원천 1: ERP·원장일치·카톡·고신뢰 메일 번들 먼저 반영 (ERP가 caseNo·trackId 우선권 보유)
    const sortedBundles = [...res.bundles].sort((a, b) => (b.erpCount - a.erpCount) || (Number(!!b.companyId) - Number(!!a.companyId)));
    for (const b of sortedBundles) {
      if (b.erpCount > 0 || b.msgCount > 0 || b.companyId) {
        const isCancelledOrMoved = /^(?:cancelled|canceled|transferred|취소|이관|해지)$/i.test(str(b.erpStatus));
        if (isCancelledOrMoved && b.mailCount === 0 && b.msgCount === 0) continue;
        const isDone = isCancelledOrMoved || (b.erpStatus === 'closed' || b.erpStatus === 'done') || Number(b.year) < CUR_YEAR;
        upsertTarget(b.erpCount > 0 ? 'ERP' : (b.msgCount > 0 ? '카톡·문자' : '메일'), {
          companyId: b.companyId,
          companyName: b.companyName,
          caseNo: b.caseNo,
          year: b.year,
          trackId: b.suggestedTrackId,
          trackName: b.suggestedTrackName,
          stage: isDone ? 'followup' : (b.erpCount > 0 ? 'visit' : 'collect'),
          status: isDone ? 'done' : 'active',
          consultantSid: b.consultantSid,
          note: b.erpCount > 0 ? `ERP 수임(${b.caseNo || b.year})` : `메일 ${b.mailCount}통 연계`,
          comms: b.items || []
        });
      }
    }

    // 2b) 원천 2: 로컬 컨설팅 폴더 아카이브 반영
    const appLocals = localRecords.filter((r) => r.appKey === cat.key);
    for (const lr of appLocals) {
      const localComm = lr.docNames.length ? [{
        source: 'local_archive',
        id: safeHashId('loc', `${lr.year}|${lr.companyName}|${lr.trackId}`),
        date: `${lr.year}-06-30`,
        subject: `[보관자료 ${lr.year}] ${Intake.sanitizeText(lr.companyName)} (${lr.docCount}개 파일)`,
        maskedPreview: Intake.sanitizeText(`확인된 비식별 산출물/서식: ${lr.docNames.join(', ')}`).slice(0, 800),
        atts: lr.docNames.slice(0, 6)
      }] : [];
      upsertTarget('로컬', {
        companyId: '',
        companyName: lr.companyName,
        year: lr.year,
        trackId: lr.trackId,
        trackName: lr.trackName,
        stage: lr.stage,
        status: lr.status,
        note: `${lr.tag} (${lr.docCount}파일)`,
        comms: localComm
      });
    }

    // 2c) 원천 3: 미등록 고신뢰 메일 단독 실사건 보완 반영
    for (const b of sortedBundles) {
      if (b.erpCount > 0 || b.msgCount > 0 || b.companyId) continue;
      if (!isGoodMailOnlyCandidate(cat.key, b)) continue;
      upsertTarget('메일', {
        companyId: '',
        companyName: b.companyName,
        year: b.year,
        trackId: b.suggestedTrackId,
        trackName: b.suggestedTrackName,
        stage: Number(b.year) < CUR_YEAR ? 'followup' : 'collect',
        status: Number(b.year) < CUR_YEAR ? 'done' : 'active',
        note: `메일 ${b.mailCount}통 자동분류`,
        comms: b.items || []
      });
    }

    // 3) 기존 수동 등록 프로젝트와 충돌 시 제외, 보관삭제(_deleted) 레코드 부활 금지, 결정적 ID(bf_{app}_{yr}_{hash}) 부여
    const manualSet = new Set(manualProjects.map((p) => `${Intake.normCorpName(p.companyName)}|${numOrZero(p.year)}`));
    const manualTrackSet = new Set(manualProjects.map((p) => `${Intake.normCorpName(p.companyName)}|${numOrZero(p.year)}|${str(p.trackId)}`));
    const finalList = Object.values(mergedMap).filter((rec) => {
      const pid = safeHashId(`bf_${cat.key}_${rec.year}`, rec.seedKey);
      if (existingProjectsMap[pid] && existingProjectsMap[pid]._deleted) return false;
      if (rec.caseNo && manualProjects.some((p) => str(p.caseNo) === rec.caseNo)) return false;
      if (cat.key === 'chamber') {
        if (manualTrackSet.has(`${Intake.normCorpName(rec.companyName)}|${rec.year}|${rec.trackId}`)) return false;
      } else if (manualSet.has(`${Intake.normCorpName(rec.companyName)}|${rec.year}`)) {
        return false;
      }
      return true;
    }).sort((a, b) => (b.year - a.year) || a.companyName.localeCompare(b.companyName, 'ko'));

    const byYr = {};
    const byTr = {};
    for (const r of finalList) {
      byYr[r.year] = (byYr[r.year] || 0) + 1;
      byTr[r.trackId] = (byTr[r.trackId] || 0) + 1;
    }
    const commSum = finalList.reduce((s, r) => s + r.comms.length, 0);
    totalProjectsPlanned += finalList.length;
    totalCommsPlanned += commSum;

    // 비식별 검사
    for (const r of finalList) {
      if (!isCleanForRtdb(r)) piiLeakCount++;
      for (const cm of r.comms) {
        if (!isCleanForRtdb(cm)) piiLeakCount++;
      }
    }

    console.log(
      `  ${cat.icon} ${cat.key.padEnd(12)} (${cat.shortName.padEnd(8)}): ` +
      `실저장대상 ${String(finalList.length).padStart(3)}건 (연계자료 ${String(commSum).padStart(4)}건)`
    );
    if (doAudit || cat.key === 'chamber' || cat.key === 'sixthind') {
      console.log(`     연도별: ${JSON.stringify(byYr)} | 트랙별: ${JSON.stringify(byTr)}`);
    }

    if (doApply && token && finalList.length && piiLeakCount === 0) {
      if (!staffMaps.hasRealAdmin) {
        throw new Error('uid_roles에서 활성 관리자 UID를 찾지 못해 백필 --apply를 중단합니다.');
      }
      let writtenP = 0;
      let writtenC = 0;
      const now = Date.now();
      const patchBatch = {};
      let batchCount = 0;
      async function flushPatch() {
        if (!batchCount) return;
        await rtdbPatch(`/${cat.rtdbRoot}`, Object.assign({}, patchBatch), token);
        for (const k of Object.keys(patchBatch)) delete patchBatch[k];
        batchCount = 0;
      }

      for (const r of finalList) {
        const pid = safeHashId(`bf_${cat.key}_${r.year}`, r.seedKey);
        const prev = existingProjectsMap[pid] || null;
        const isHumanEdited = prev && str(prev.updatedBy) && prev.updatedBy !== 'backfill-script';
        const cSid = r.consultantSid || 'P-001';
        const cName = staffMaps.sidToName[cSid] || staffMaps.adminName || '전담 노무사';
        const cUid = staffMaps.sidToUid[cSid] || staffMaps.adminUid;
        const srcTag = Object.keys(r.sources).join('+');
        const summary = Intake.sanitizeText(`[${srcTag}] ${r.notes.join(' · ')}`).slice(0, 1900);

        const isPrevDone = !!(prev && prev.status === 'done');
        const skipProjWrite = isHumanEdited || isPrevDone;
        const effectiveStatus = (isPrevDone || r.status === 'done') ? 'done' : 'active';
        const effectiveStage = isPrevDone ? str(prev.stage || 'followup') : r.stage;
        const projPayload = {
          id: pid,
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          revision: prev ? (Number(prev.revision || 0) + 1) : 1,
          createdAt: (prev && prev.createdAt) || now,
          updatedAt: now,
          createdBy: (prev && prev.createdBy) || staffMaps.adminUid,
          updatedBy: 'backfill-script',
          companyId: str(r.companyId),
          companyName: r.companyName.slice(0, 190),
          year: isPrevDone ? Number(prev.year || r.year) : Number(r.year),
          trackId: (isPrevDone && prev.trackId) ? prev.trackId : r.trackId.slice(0, 60),
          trackName: (isPrevDone && prev.trackName) ? prev.trackName : r.trackName.slice(0, 115),
          stage: effectiveStage,
          workerCount: Number(r.workerCount || (prev && prev.workerCount) || 0),
          consultantName: cName.slice(0, 75),
          consultantUid: cUid,
          status: effectiveStatus,
          summaryNote: summary
        };
        const effBizNo = str((prev && prev.bizNo) || r.bizNo);
        if (effBizNo) projPayload.bizNo = effBizNo.slice(0, 30);
        const effCaseNo = str((isPrevDone && prev && prev.caseNo) || r.caseNo || (prev && prev.caseNo));
        if (effCaseNo) projPayload.caseNo = Intake.sanitizeText(effCaseNo).slice(0, 60);

        if (!isCleanForRtdb(projPayload)) {
          piiLeakCount++;
          continue;
        }
        // 사람 수정 레코드(updatedBy !== 'backfill-script') 및 종결(done) 레코드는 재실행 시 덮어쓰지 않는다.
        const needWriteProj = !skipProjWrite && (
          !prev
          || prev.trackId !== projPayload.trackId
          || prev.year !== projPayload.year
          || prev.companyName !== projPayload.companyName
          || str(prev.companyId) !== str(projPayload.companyId)
          || prev.status !== projPayload.status
          || str(prev.caseNo) !== str(projPayload.caseNo)
          || prev.summaryNote !== projPayload.summaryNote
        );
        if (needWriteProj) {
          patchBatch[`projects/${pid}`] = projPayload;
          batchCount++;
          writtenP++;
        }

        const existingPidComms = existingCommsMap[pid] || {};
        for (let ci = 0; ci < r.comms.length; ci++) {
          const cm = r.comms[ci];
          const cid = safeHashId('cm', `${pid}|${ci}|${cm.date || ''}|${cm.subject || ''}`);
          const prevC = existingPidComms[cid] || null;
          if (prevC) continue; // 이미 백필된 동일 수신자료 스킵(멱등)
          const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(str(cm.date)) ? str(cm.date) : `${r.year}-01-01`;
          const commPayload = {
            id: cid,
            projectId: pid,
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            revision: 1,
            createdAt: now,
            updatedAt: now,
            createdBy: projPayload.createdBy,
            updatedBy: 'backfill-script',
            source: str(cm.source || 'mail').slice(0, 50),
            date: cleanDate,
            subject: Intake.sanitizeText(cm.subject || '수신 자료').slice(0, 280),
            maskedPreview: Intake.sanitizeText(cm.maskedPreview || cm.subject || '').slice(0, 3800)
          };
          if (Array.isArray(cm.atts) && cm.atts.length) {
            const cleanAtts = cm.atts.map((a) => Intake.sanitizeText(a).slice(0, 220)).filter((a) => a && !LOCAL_PATH_RE.test(a)).slice(0, 12);
            if (cleanAtts.length) commPayload.atts = cleanAtts;
          }
          if (!isCleanForRtdb(commPayload)) {
            piiLeakCount++;
            continue;
          }
          patchBatch[`comms/${pid}/${cid}`] = commPayload;
          batchCount++;
          writtenC++;
          if (batchCount >= 180) await flushPatch();
        }
        if (batchCount >= 180) await flushPatch();
      }
      let pruned = 0;
      if (doPruneStale) {
        const activePidSet = new Set(finalList.map((r) => safeHashId(`bf_${cat.key}_${r.year}`, r.seedKey)));
        for (const [oldPid, oldRec] of Object.entries(existingProjectsMap)) {
          if (!oldPid.startsWith('bf_')) continue;
          if (!oldRec || oldRec._deleted || oldRec.status === 'done') continue;
          if (oldRec.updatedBy !== 'backfill-script') continue;
          if (activePidSet.has(oldPid)) continue;
          // 체크·보고서 또는 사람이 추가한 수신자료가 연결된 건은 정리하지 않고 보존한다.
          if (existingChecksMap[oldPid] || existingReportsMap[oldPid]) continue;
          const oldComms = Object.values(existingCommsMap[oldPid] || {});
          if (oldComms.some((cm) => cm && cm.updatedBy && cm.updatedBy !== 'backfill-script')) continue;
          // 온톨로지 규칙: 물리 삭제 대신 _deleted 표식(tombstone)으로 전환하고 comms 원문은 보존한다.
          patchBatch[`projects/${oldPid}`] = Object.assign({}, oldRec, {
            _deleted: true,
            deletedAt: now,
            deletedBy: staffMaps.adminUid,
            updatedAt: now,
            updatedBy: 'backfill-script',
            revision: Number(oldRec.revision || 0) + 1
          });
          batchCount++;
          pruned++;
          if (batchCount >= 180) await flushPatch();
        }
      }
      await flushPatch();
      totalWrittenProj += writtenP;
      totalWrittenComm += writtenC;
      totalPrunedProj += pruned;
      console.log(`     -> --apply 기록: 프로젝트 ${writtenP}건 · 수신자료 ${writtenC}건` + (pruned ? ` · 고아중복 정리 ${pruned}건` : ''));
    }
  }

  console.log(`\n- 합계: 12개 앱 대상 ${totalProjectsPlanned}건 (연계자료 ${totalCommsPlanned}건)` + (doApply ? ` / 실DB 기록: 프로젝트 ${totalWrittenProj}건 · 수신자료 ${totalWrittenComm}건` + (doPruneStale ? ` · 고아중복 정리 ${totalPrunedProj}건` : '') : ''));
  console.log(`- 엑셀 원천 파일: ${excelSummary.files}파일`);
  console.log(`- 비식별·로컬경로 누출 검사: ${piiLeakCount === 0 ? '통과 (0건)' : `주의 (${piiLeakCount}건)`}`);
  if (piiLeakCount > 0) process.exitCode = 1;
}

function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill-consult-suite 오류]', (err && err.message) || err);
    process.exitCode = 1;
  });
}

module.exports = { scanLocalExcelMasters, scanLocalConsultingArchive };
