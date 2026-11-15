#!/usr/bin/env node
/* P박스 지방법원·행정법원·고등법원(하급심 org=400202) 및 산재 판례 초기 대량 백필(Backfill) 스크립트
 *
 * 사용법:
 *   node scripts/backfill-pbox-lowercourt.js --oc=<법제처무료OC아이디> [옵션]
 *
 * 주요 옵션:
 *   --oc=<ID>             법제처 국가법령정보 공동활용(open.law.go.kr) 무료 OC 아이디 (또는 환경변수 LAW_OC)
 *   --comwel-key=<KEY>    공공데이터포털 근로복지공단 산재 판례 인증키 (또는 환경변수 DATA_GO_KR_KEY, 선택)
 *   --preset=<NAME>       backfill_full(기본, 20개 전수 노무·산재 키워드) | all | dismissal | wage | sanjae | status
 *   --query=<단어1,단어2>  직접 지정할 검색어 목록 (쉼표 구분, 지정 시 preset 대신 사용)
 *   --court=<법원명>      특정 하급심 법원만 집중 수집 (예: 서울행정법원, 서울중앙지방법원, 수원지방법원, 부산지방법원)
 *   --since=<YYYY-MM-DD>  선고일자 시작일 (예: 2018-01-01)
 *   --until=<YYYY-MM-DD>  선고일자 종료일 (예: 2026-12-31)
 *   --max-pages=<N>       키워드당 최대 수집 페이지 (기본 5, 최대 30 · 페이지당 기본 50건)
 *   --display=<N>         페이지당 조회 건수 (기본 50, 최대 100)
 *   --detail-limit=<N>    본문·참조조문 보강용 상세 API 최대 호출 수 (기본 200, 0 입력 시 상세 호출 생략)
 *   --delay-ms=<N>        공공 API 호출 간 예의 지연 ms (기본 120, 0 가능)
 *   --out=<경로.json>     생성할 P박스 적재용 JSON 파일 경로 (기본: pbox-lowercourt-seed.json)
 *   --overwrite           기존 출력 파일이 있을 때 덮어쓰기 허용 (기본은 실수 방지용 배타 생성 wx)
 *   --push-supabase       SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 있을 때 공유 DB에도 즉시 적재
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PBoxSync = require('../functions/pbox-sync');
const PuPBoxEngine = require('../js/pu-pbox-engine');

function parseBoundedInt(val, fallback, min, max) {
  if (val === '' || val === null || val === undefined) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
}

function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const out = {
    oc: '',
    comwelKey: '',
    preset: 'backfill_full',
    queries: [],
    court: '',
    since: '',
    until: '',
    maxPages: 5,
    display: 50,
    detailLimit: 200,
    delayMs: 120,
    outFile: 'pbox-lowercourt-seed.json',
    overwrite: false,
    pushSupabase: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const a = String(args[i] || '').trim();
    if (!a) continue;
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a === '--push-supabase') { out.pushSupabase = true; continue; }
    if (a === '--overwrite') { out.overwrite = true; continue; }

    const eqIdx = a.indexOf('=');
    const key = eqIdx >= 0 ? a.slice(0, eqIdx) : a;
    const val = eqIdx >= 0 ? a.slice(eqIdx + 1).trim() : String(args[i + 1] || '').trim();
    if (eqIdx < 0 && val && !val.startsWith('--')) i++;

    if (key === '--oc') out.oc = val;
    else if (key === '--comwel-key') out.comwelKey = val;
    else if (key === '--preset') out.preset = val || 'backfill_full';
    else if (key === '--query' || key === '--queries') {
      out.queries = val.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (key === '--court') out.court = val;
    else if (key === '--since') out.since = val;
    else if (key === '--until') out.until = val;
    else if (key === '--max-pages') out.maxPages = parseBoundedInt(val, 5, 1, 30);
    else if (key === '--display') out.display = parseBoundedInt(val, 50, 1, 100);
    else if (key === '--detail-limit') out.detailLimit = parseBoundedInt(val, 200, 0, 2000);
    else if (key === '--delay-ms') out.delayMs = parseBoundedInt(val, 120, 0, 2000);
    else if (key === '--out') out.outFile = val || 'pbox-lowercourt-seed.json';
  }
  return out;
}

function isSameOrSubPath(parentDir, targetPath) {
  const p = path.resolve(parentDir);
  const t = path.resolve(targetPath);
  if (process.platform === 'win32') {
    const pLow = p.toLowerCase();
    const tLow = t.toLowerCase();
    if (pLow === tLow) return true;
    const rel = path.relative(pLow, tLow);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  }
  if (p === t) return true;
  const rel = path.relative(p, t);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isStrictSubPath(parentDir, targetPath) {
  const p = path.resolve(parentDir);
  const t = path.resolve(targetPath);
  if (process.platform === 'win32' ? p.toLowerCase() === t.toLowerCase() : p === t) return false;
  return isSameOrSubPath(p, t);
}

/* 허용 루트(realRoot) 내부의 모든 기존 경로 세그먼트에 심볼릭 링크·정션(junction)이 없는지 검사 */
function assertNoSymlinkAlongFromRoot(allowedRoot, targetPath) {
  const rootResolved = path.resolve(allowedRoot);
  const rel = path.relative(rootResolved, path.resolve(targetPath));
  const parts = rel.split(path.sep).filter(Boolean);
  let cur = rootResolved;
  for (const seg of parts) {
    cur = path.join(cur, seg);
    if (!fs.existsSync(cur)) {
      try {
        /* 깨진 심볼릭 링크까지 포착하기 위해 lstatSync 시도 */
        const brokenSt = fs.lstatSync(cur);
        if (brokenSt.isSymbolicLink()) {
          throw new Error('보안상 심볼릭 링크 또는 정션(junction) 경로에는 출력할 수 없습니다.');
        }
      } catch (e) {
        if (e && e.code === 'ENOENT') break;
        throw e;
      }
      break;
    }
    const st = fs.lstatSync(cur);
    if (st.isSymbolicLink()) {
      throw new Error('보안상 심볼릭 링크 또는 정션(junction) 경로에는 출력할 수 없습니다.');
    }
  }
}

function resolveSafeOutPath(rawOutFile, baseCwd) {
  const rawCwd = path.resolve(baseCwd || process.cwd());
  const realCwd = fs.existsSync(rawCwd) ? fs.realpathSync(rawCwd) : rawCwd;
  const realTmp = fs.realpathSync(os.tmpdir());

  const candidate = path.resolve(realCwd, String(rawOutFile || 'pbox-lowercourt-seed.json').trim());
  if (path.extname(candidate).toLowerCase() !== '.json') {
    throw new Error('출력 파일(--out)은 .json 확장자여야 합니다.');
  }
  const normalized = candidate.replace(/\\/g, '/');
  if (/\/(\.git|node_modules)(\/|$)/i.test(normalized)) {
    throw new Error('보안상 .git 또는 node_modules 내부에는 출력할 수 없습니다.');
  }

  let matchedRoot = '';
  if (isStrictSubPath(realCwd, candidate)) matchedRoot = realCwd;
  else if (isStrictSubPath(realTmp, candidate)) matchedRoot = realTmp;
  else {
    throw new Error('출력 경로(--out)는 현재 작업 폴더 또는 임시 폴더 내부만 허용됩니다.');
  }

  assertNoSymlinkAlongFromRoot(matchedRoot, candidate);
  return candidate;
}

function writeJsonSafeAtomic(targetPath, jsonText, baseCwd, allowOverwrite) {
  const checkedPath = resolveSafeOutPath(targetPath, baseCwd);
  const rawCwd = path.resolve(baseCwd || process.cwd());
  const realCwd = fs.existsSync(rawCwd) ? fs.realpathSync(rawCwd) : rawCwd;
  const realTmp = fs.realpathSync(os.tmpdir());
  const parentDir = path.dirname(checkedPath);

  fs.mkdirSync(parentDir, { recursive: true });
  const realParent = fs.realpathSync(parentDir);
  if (!isSameOrSubPath(realCwd, realParent) && !isSameOrSubPath(realTmp, realParent)) {
    throw new Error('생성된 부모 디렉터리의 실제 경로가 허용 범위를 벗어났습니다.');
  }

  const finalPath = path.join(realParent, path.basename(checkedPath));
  let targetExists = false;
  try {
    const st = fs.lstatSync(finalPath);
    if (st.isSymbolicLink() || !st.isFile()) {
      throw new Error('대상 출력 경로가 일반 파일이 아니거나 심볼릭 링크입니다.');
    }
    targetExists = true;
  } catch (e) {
    if (!e || e.code !== 'ENOENT') throw e;
  }

  if (!allowOverwrite && targetExists) {
    throw new Error('출력 파일이 이미 존재합니다(--overwrite 옵션 지정 시 덮어쓰기 허용): ' + finalPath);
  }

  /* 항상 임시 형제 파일에 전량 기록 + fsync 완료를 검증한 뒤에만 원자적 링크(wx 동등 비덮어쓰기) 또는 원자적 rename 수행
   * — writeFileSync(ENOSPC) 또는 fsyncSync(EIO) 실패 시 에러를 삼키지 않고 전파하며,
   *   단일 외곽 finally 에서 fd 닫기와 임시파일(tmpSibling) 삭제를 보장해 잔여 파일이 절대 남지 않는다. */
  const tmpSibling = path.join(realParent, '.pbox-tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex') + '.json');
  let fd = fs.openSync(tmpSibling, 'wx');
  try {
    fs.writeFileSync(fd, jsonText, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    if (!allowOverwrite) {
      try {
        fs.linkSync(tmpSibling, finalPath);
      } catch (linkErr) {
        if (linkErr && linkErr.code === 'EEXIST') {
          throw new Error('출력 파일이 이미 존재합니다(--overwrite 옵션 지정 시 덮어쓰기 허용): ' + finalPath);
        }
        throw linkErr;
      }
    } else {
      const recheck = fs.existsSync(finalPath) ? fs.lstatSync(finalPath) : null;
      if (recheck && (recheck.isSymbolicLink() || !recheck.isFile())) {
        throw new Error('대상 출력 경로가 심볼릭 링크로 변경되어 쓰기를 중단했습니다.');
      }
      fs.renameSync(tmpSibling, finalPath);
    }
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try {
      if (fs.existsSync(tmpSibling)) fs.unlinkSync(tmpSibling);
    } catch (_) {}
  }
  return finalPath;
}

async function runLowerCourtBackfill(options) {
  const o = options || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const lawOc = PBoxSync.sanitizeLawOc(o.oc || env.LAW_OC || '');
  const comwelKey = String(o.comwelKey || env.DATA_GO_KR_KEY || '').trim();

  if (!lawOc && !comwelKey) {
    throw new Error('법제처 무료 OC 아이디(--oc=<아이디> 또는 LAW_OC 환경변수)나 공공데이터 인증키(--comwel-key) 중 최소 하나를 입력해 주세요.');
  }

  /* 사전 입력 검증: 법원명·선고일 달력 실존 여부·시작/종료일 역전 차단 */
  const cVal = PBoxSync.validateCourtFilterStrict(o.court || '');
  if (!cVal.ok) throw new Error(cVal.error);
  const fVal = PBoxSync.validateCompactYmdStrict(o.since || '', '선고 시작일');
  if (!fVal.ok) throw new Error(fVal.error);
  const tVal = PBoxSync.validateCompactYmdStrict(o.until || '', '선고 종료일');
  if (!tVal.ok) throw new Error(tVal.error);
  if (fVal.compact && tVal.compact && fVal.compact > tVal.compact) {
    throw new Error('선고 시작일(' + fVal.compact + ')이 선고 종료일(' + tVal.compact + ')보다 늦을 수 없습니다.');
  }

  const maxPages = parseBoundedInt(o.maxPages, 5, 1, 30);
  const display = parseBoundedInt(o.display, 50, 1, 100);
  const detailLimit = parseBoundedInt(o.detailLimit, 200, 0, 2000);
  const delayMs = parseBoundedInt(o.delayMs, 120, 0, 2000);

  const lowerRes = lawOc
    ? await PBoxSync.pullLawGoKrLowerCourt(lawOc, fetchFn, {
        preset: o.preset || 'backfill_full',
        queries: Array.isArray(o.queries) && o.queries.length ? o.queries : undefined,
        maxQueries: 30,
        court: cVal.court,
        dateFrom: fVal.compact,
        dateTo: tVal.compact,
        searchScope: '2',
        display,
        maxPages,
        detailLimit,
        delayMs,
        onProgress: o.onProgress
      })
    : { docs: [], rawCount: 0, attempted: 0, succeeded: 0, errors: [] };

  const comwelRes = comwelKey
    ? await PBoxSync.pullComwelSanjaeCases(comwelKey, fetchFn, {
        maxPages: Math.max(1, Math.min(maxPages, 10))
      })
    : { docs: [], attempted: 0, succeeded: 0, errors: [] };

  const explicitQueries = Array.isArray(o.queries) && o.queries.length
    ? o.queries.map((q) => String(q || '').trim()).filter(Boolean)
    : ((o.preset && o.preset !== 'all' && o.preset !== 'sanjae' && o.preset !== 'backfill_full' && PBoxSync.LOWER_COURT_PRESETS[o.preset])
        ? PBoxSync.LOWER_COURT_PRESETS[o.preset]
        : []);

  const filteredLower = PBoxSync.filterLowerCourtDocs(lowerRes.docs || [], {
    court: cVal.court,
    dateFrom: fVal.compact,
    dateTo: tVal.compact,
    queries: explicitQueries
  });
  const filteredComwel = PBoxSync.filterLowerCourtDocs(comwelRes.docs || [], {
    court: cVal.court,
    dateFrom: fVal.compact,
    dateTo: tVal.compact,
    queries: explicitQueries
  });

  const combinedRaw = [].concat(filteredLower, filteredComwel);
  const dedupOut = PuPBoxEngine.deduplicateDocs([], combinedRaw);
  const cleanDocs = dedupOut.docs.filter((d) => !PBoxSync.hasResidualHardPii(d));

  const errors = [].concat(lowerRes.errors || [], comwelRes.errors || []);
  const attempted = (lowerRes.attempted || 0) + (comwelRes.attempted || 0);
  const succeeded = (lowerRes.succeeded || 0) + (comwelRes.succeeded || 0);

  if (attempted > 0 && succeeded === 0) {
    throw new Error('공공 API 호출이 모두 실패했습니다: ' + (errors[0] || '네트워크 또는 인증키 확인 필요'));
  }

  let supabasePushed = 0;
  if (o.pushSupabase) {
    const batchSize = 50;
    for (let i = 0; i < cleanDocs.length; i += batchSize) {
      const slice = cleanDocs.slice(i, i + batchSize);
      const upRes = await PBoxSync.upsertToSupabase(slice, env, fetchFn, 'system_sync');
      if (upRes.ok === false) {
        errors.push('supabase_batch_' + Math.floor(i / batchSize) + ': ' + (upRes.error || ('HTTP ' + (upRes.status || 500))));
      }
      supabasePushed += (upRes.pushed || 0);
    }
  }

  let savedPath = '';
  if (o.writeFile !== false) {
    const bundle = {
      version: 1,
      kind: 'pbox_lowercourt_pack',
      exportedAt: new Date().toISOString(),
      stats: {
        rawFetched: combinedRaw.length,
        dedupedCount: cleanDocs.length,
        mergedStage1: dedupOut.stats.mergedStage1,
        mergedStage2: dedupOut.stats.mergedStage2,
        mergedStage3: dedupOut.stats.mergedStage3,
        supabasePushed,
        courtFilter: lowerRes.courtFilter || '전체 하급심(org=400202)'
      },
      docs: cleanDocs
    };
    savedPath = writeJsonSafeAtomic(
      o.outFile || 'pbox-lowercourt-seed.json',
      JSON.stringify(bundle, null, 2),
      o.cwd,
      o.overwrite === true
    );
  }

  return {
    ok: errors.length === 0,
    partial: errors.length > 0 && succeeded > 0,
    savedPath,
    rawFetched: combinedRaw.length,
    dedupedCount: cleanDocs.length,
    dedupStats: dedupOut.stats,
    supabasePushed,
    errors,
    docs: cleanDocs
  };
}

function printUsage() {
  console.log([
    '사용법: node scripts/backfill-pbox-lowercourt.js --oc=<법제처무료OC아이디> [옵션]',
    '',
    '예시:',
    '  1) 전국 지방법원·행정법원 노무·산재 20대 쟁점 일괄 수집 후 JSON 파일 생성:',
    '     node scripts/backfill-pbox-lowercourt.js --oc=myid --out=pbox-lowercourt-seed.json',
    '  2) 서울행정법원 2022년 이후 판례만 집중 수집:',
    '     node scripts/backfill-pbox-lowercourt.js --oc=myid --court=서울행정법원 --since=2022-01-01',
    '  3) 생성된 JSON 파일은 P박스(pu-pbox.html) [하급심 수집·중복정리] 화면에 끌어다 놓으면 즉시 적재됩니다.'
  ].join('\n'));
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.help) {
    printUsage();
    return;
  }
  const res = await runLowerCourtBackfill({
    oc: cli.oc,
    comwelKey: cli.comwelKey,
    preset: cli.preset,
    queries: cli.queries,
    court: cli.court,
    since: cli.since,
    until: cli.until,
    maxPages: cli.maxPages,
    display: cli.display,
    detailLimit: cli.detailLimit,
    delayMs: cli.delayMs,
    outFile: cli.outFile,
    overwrite: cli.overwrite,
    pushSupabase: cli.pushSupabase,
    onProgress: (p) => {
      process.stdout.write('\r[하급심 수집 진행] 검색어 "' + p.query + '" (p' + p.page + ') — 누적 추출 ' + p.fetchedSoFar + '건   ');
    }
  });
  process.stdout.write('\n');
  console.log('[완료] 총 ' + res.rawFetched + '건 수집 → 3단계 중복제거 후 ' + res.dedupedCount + '건 확정');
  if (res.savedPath) console.log('[파일 저장] ' + res.savedPath);
  if (cli.pushSupabase) console.log('[공유 DB 적재] ' + res.supabasePushed + '건 반영');
  if (res.errors.length) console.warn('[일부 경고] ' + res.errors.slice(0, 5).join(' | '));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[오류] ' + String((err && err.message) || err));
    process.exitCode = 1;
  });
}

module.exports = {
  parseCliArgs,
  resolveSafeOutPath,
  writeJsonSafeAtomic,
  runLowerCourtBackfill
};
