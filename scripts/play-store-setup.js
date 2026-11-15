#!/usr/bin/env node
'use strict';
/* 푸른포털 Google Play 스토어 준비·점검·Asset Links 설정 도우미
 *
 * 사용법:
 *   node scripts/play-store-setup.js --check
 *   node scripts/play-store-setup.js --print-assetlinks --sha256 AA:BB:...[,CC:DD:...]
 *   node scripts/play-store-setup.js --write-root-site --out <저장소_바깥_폴더> --sha256 AA:BB:...
 *   node scripts/play-store-setup.js --init-keystore --out <저장소_바깥_경로/portal-upload.jks>
 *
 * 보안 원칙:
 *   - 서명키(.jks)·비밀번호·별도 루트 사이트 산출물은 현재 워크트리와 상위 Git 저장소 내부에 절대 생성하지 않는다.
 *   - keytool 호출 시 명령줄 인자 대신 환경변수(:env)로 암호를 전달하고, 터미널 표준출력에 평문 암호를 찍지 않는다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'kr.pureun.portal';
const SHA256_RE = /^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/;

function lstatIfExists(targetPath) {
  try {
    return fs.lstatSync(targetPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function resolveWithExistingAncestor(targetPath, depth = 0) {
  if (depth > 16) {
    throw new Error('심볼릭 링크 참조 깊이가 허용 한도를 초과했습니다: ' + targetPath);
  }
  const abs = path.resolve(targetPath);
  const parts = [];
  let cur = abs;
  let st = lstatIfExists(cur);
  while (!st) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    parts.unshift(path.basename(cur));
    cur = parent;
    st = lstatIfExists(cur);
  }
  let realBase = cur;
  if (st) {
    if (fs.existsSync(cur)) {
      realBase = fs.realpathSync(cur);
    } else if (st.isSymbolicLink()) {
      const linkTarget = path.resolve(path.dirname(cur), fs.readlinkSync(cur));
      realBase = resolveWithExistingAncestor(linkTarget, depth + 1);
    }
  }
  return parts.length ? path.join(realBase, ...parts) : realBase;
}

function rejectSymlinkChain(targetPath, stopAtBase, label) {
  const absTarget = path.resolve(targetPath);
  const absStop = path.resolve(stopAtBase || path.dirname(absTarget));
  const stopCmp = process.platform === 'win32' ? absStop.toLowerCase() : absStop;
  let cur = absTarget;
  while (true) {
    const st = lstatIfExists(cur);
    if (st && st.isSymbolicLink()) {
      throw new Error(
        (label || '대상 경로') +
          '에 심볼릭 링크 또는 정션(junction)을 사용할 수 없습니다: ' +
          cur
      );
    }
    const curCmp = process.platform === 'win32' ? cur.toLowerCase() : cur;
    const parent = path.dirname(cur);
    if (curCmp === stopCmp || parent === cur) break;
    cur = parent;
  }
}

function writeSafeFile(filePath, content, options = {}) {
  const absFile = path.resolve(filePath);
  const baseDir = path.resolve(options.baseDir || path.dirname(absFile));
  const label = options.label || '출력 파일';
  const exclusive = Boolean(options.exclusive);

  rejectSymlinkChain(absFile, baseDir, label);
  assertOutsideRepo(absFile, label);
  if (exclusive && lstatIfExists(absFile)) {
    throw new Error(
      label + '이(가) 이미 존재합니다. 덮어쓰기 방지를 위해 새 경로를 지정하세요: ' + absFile
    );
  }

  fs.mkdirSync(path.dirname(absFile), { recursive: true });
  rejectSymlinkChain(absFile, baseDir, label);
  const realParent = fs.realpathSync(path.dirname(absFile));
  assertOutsideRepo(path.join(realParent, path.basename(absFile)), label);

  const writeOpts = { encoding: 'utf8', flag: exclusive ? 'wx' : 'w' };
  if (options.mode !== undefined) writeOpts.mode = options.mode;
  fs.writeFileSync(absFile, content, writeOpts);
}

function normalizeForCompare(p) {
  const clean = path.normalize(resolveWithExistingAncestor(p)).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? clean.toLowerCase() : clean;
}

function collectProtectedRepoRoots() {
  const roots = new Set([normalizeForCompare(ROOT)]);
  let cur = resolveWithExistingAncestor(ROOT);
  while (true) {
    if (fs.existsSync(path.join(cur, '.git'))) {
      roots.add(normalizeForCompare(cur));
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return Array.from(roots);
}

function assertOutsideRepo(targetPath, label) {
  const cand = normalizeForCompare(targetPath);
  const protectedRoots = collectProtectedRepoRoots();
  for (const repoRoot of protectedRoots) {
    if (cand === repoRoot || cand.startsWith(repoRoot + path.sep)) {
      throw new Error(
        (label || '대상 경로') +
          '는 현재 작업트리 및 상위 Git 저장소 바깥 폴더여야 합니다: ' +
          path.resolve(targetPath)
      );
    }
  }
}

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) {
      out.values[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      out.values[a.slice(2)] = argv[++i];
    } else {
      out.flags.add(a.slice(2));
    }
  }
  return out;
}

function normalizeFingerprints(raw) {
  if (!raw) return [];
  const list = String(raw)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const fp of list) {
    if (!SHA256_RE.test(fp)) {
      throw new Error(
        '올바른 SHA-256 지문 형식이 아닙니다(예: AA:BB:...:FF 32바이트): ' + fp
      );
    }
  }
  return Array.from(new Set(list));
}

function buildAssetLinksJson(fingerprints) {
  return (
    JSON.stringify(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: PACKAGE_NAME,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ],
      null,
      2
    ) + '\n'
  );
}

function checkReadiness() {
  const requiredFiles = [
    ['정책 — 개인정보처리방침', 'policy/privacy.html'],
    ['정책 — 계정·데이터 삭제 안내', 'policy/account-deletion.html'],
    ['정책 — 이용약관', 'policy/terms.html'],
    ['포털 진입점', 'enter.html'],
    ['설치 안내 페이지', 'install.html'],
    ['웹 매니페스트', 'manifest.json'],
    ['Asset Links 템플릿', '.well-known/assetlinks.json'],
    ['Jekyll 점폴더 보존(.nojekyll)', '.nojekyll'],
    ['TWA 매니페스트', 'android/portal-twa/app/src/main/AndroidManifest.xml'],
    ['TWA Gradle 설정', 'android/portal-twa/app/build.gradle.kts'],
    [
      'TWA 오프라인 방어 액티비티',
      'android/portal-twa/app/src/main/java/kr/pureun/portal/PortalLauncherActivity.java',
    ],
    ['Play 스토어 빌드 워크플로', '.github/workflows/build-portal-playstore.yml'],
    ['스토어 그래픽 생성기', 'scripts/make-playstore-assets.js'],
    ['등록 가이드 문서', 'docs/구글플레이-등록-가이드.md'],
  ];

  let ok = true;
  const lines = ['=== 푸른포털 Google Play 등록 준비 상태 점검 ==='];
  for (const [label, rel] of requiredFiles) {
    const exists = fs.existsSync(path.join(ROOT, rel));
    lines.push((exists ? '[통과] ' : '[누락] ') + label + ' (' + rel + ')');
    if (!exists) ok = false;
  }

  const gradlePath = path.join(ROOT, 'android/portal-twa/app/build.gradle.kts');
  if (fs.existsSync(gradlePath)) {
    const g = fs.readFileSync(gradlePath, 'utf8');
    const targetM = /targetSdk\s*=\s*(\d+)/.exec(g);
    const targetSdk = targetM ? Number(targetM[1]) : 0;
    if (targetSdk >= 36) {
      lines.push('[통과] Play 신규 앱 API 수준 충족 (targetSdk = ' + targetSdk + ')');
    } else {
      lines.push('[실패] targetSdk 가 36 미만입니다: ' + targetSdk);
      ok = false;
    }
  }

  lines.push('');
  lines.push('다음 단계 안내:');
  lines.push('  1) 스토어 그래픽 생성: node scripts/make-playstore-assets.js --out <폴더>');
  lines.push('  2) Asset Links 출력 : node scripts/play-store-setup.js --print-assetlinks --sha256 <SHA256>');
  lines.push('  3) 전체 절차 문서   : docs/구글플레이-등록-가이드.md');
  return { ok, report: lines.join('\n') };
}

function writeRootSite(outDir, fingerprints) {
  const absOut = path.resolve(outDir);
  rejectSymlinkChain(absOut, absOut, '루트 사이트 출력 폴더');
  assertOutsideRepo(absOut, '루트 사이트 출력 폴더');
  const wkDir = path.join(absOut, '.well-known');
  rejectSymlinkChain(wkDir, absOut, '.well-known 폴더');
  assertOutsideRepo(wkDir, '.well-known 폴더');

  writeSafeFile(path.join(absOut, '.nojekyll'), '', {
    baseDir: absOut,
    label: '루트 사이트 .nojekyll',
  });
  writeSafeFile(path.join(wkDir, 'assetlinks.json'), buildAssetLinksJson(fingerprints), {
    baseDir: absOut,
    label: '루트 사이트 assetlinks.json',
  });
  writeSafeFile(
    path.join(absOut, 'index.html'),
    '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=/pureunall/enter.html">' +
      '<title>푸른노무법인 통합 포털</title></head>' +
      '<body><p><a href="/pureunall/enter.html">푸른노무법인 통합 포털로 이동</a></p></body></html>\n',
    {
      baseDir: absOut,
      label: '루트 사이트 index.html',
    }
  );
  return absOut;
}

function initKeystore(outFile) {
  const absKey = path.resolve(outFile);
  const keyDir = path.dirname(absKey);
  const secretGuidePath = absKey + '.secrets.txt';

  rejectSymlinkChain(absKey, keyDir, '업로드 서명키 파일');
  rejectSymlinkChain(secretGuidePath, keyDir, '시크릿 안내 파일');
  assertOutsideRepo(absKey, '업로드 서명키 파일');
  assertOutsideRepo(secretGuidePath, '시크릿 안내 파일');

  if (lstatIfExists(absKey)) {
    throw new Error(
      '업로드 서명키 파일이 이미 존재합니다. 기존 키 보호를 위해 새 경로를 지정하세요: ' + absKey
    );
  }
  if (lstatIfExists(secretGuidePath)) {
    throw new Error(
      '시크릿 안내 파일이 이미 존재합니다. 새 경로를 지정하거나 기존 파일을 정리하세요: ' +
        secretGuidePath
    );
  }

  fs.mkdirSync(keyDir, { recursive: true });
  rejectSymlinkChain(keyDir, keyDir, '업로드 서명키 폴더');
  const realKeyDir = fs.realpathSync(keyDir);
  assertOutsideRepo(path.join(realKeyDir, path.basename(absKey)), '업로드 서명키 파일');
  assertOutsideRepo(path.join(realKeyDir, path.basename(secretGuidePath)), '시크릿 안내 파일');

  const alias = 'pureun-portal-upload';
  const password = crypto.randomBytes(18).toString('base64url');
  const r = spawnSync(
    'keytool',
    [
      '-genkeypair',
      '-v',
      '-keystore', absKey,
      '-storetype', 'PKCS12',
      '-alias', alias,
      '-keyalg', 'RSA',
      '-keysize', '2048',
      '-validity', '10000',
      '-storepass:env', 'PORTAL_KEYSTORE_PW',
      '-keypass:env', 'PORTAL_KEYSTORE_PW',
      '-dname', 'CN=Pureun Labor Law Firm, OU=IT, O=Pureun Labor Law Firm, L=Seoul, S=Seoul, C=KR',
    ],
    {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { PORTAL_KEYSTORE_PW: password }),
    }
  );
  if (r.error || r.status !== 0) {
    throw new Error(
      'keytool 실행에 실패했습니다(JDK 17+ 설치 여부를 확인하세요): ' +
        ((r.error && r.error.message) || r.stderr || r.stdout)
    );
  }
  rejectSymlinkChain(absKey, keyDir, '업로드 서명키 파일');
  const b64 = fs.readFileSync(absKey).toString('base64');
  const secretGuide = [
    '# 푸른포털 Google Play 업로드 키 GitHub Secrets 등록 안내 (등록 및 안전 백업 후 즉시 삭제하세요)',
    'PORTAL_UPLOAD_KEY_ALIAS=' + alias,
    'PORTAL_UPLOAD_STORE_PASSWORD=' + password,
    'PORTAL_UPLOAD_KEY_PASSWORD=' + password,
    'PORTAL_UPLOAD_KEYSTORE_BASE64=' + b64,
    '',
  ].join('\n');
  writeSafeFile(secretGuidePath, secretGuide, {
    baseDir: keyDir,
    label: '시크릿 안내 파일',
    exclusive: true,
    mode: 0o600,
  });
  console.log('업로드 키 생성 완료:', absKey);
  console.log('GitHub Secrets 등록용 값이 터미널 로그 노출 방지를 위해 별도 파일에 저장되었습니다:');
  console.log('  ->', secretGuidePath);
  console.log('GitHub Secrets 등록 및 안전 백업 후 위 .secrets.txt 파일은 반드시 삭제하세요.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has('print-assetlinks') || ('print-assetlinks' in args.values)) {
    const fps = normalizeFingerprints(args.values.sha256);
    if (!fps.length) {
      throw new Error('--sha256 <AA:BB:...> 인자로 최소 1개의 SHA-256 인증서 지문을 지정하세요.');
    }
    process.stdout.write(buildAssetLinksJson(fps));
    return;
  }
  if (args.flags.has('write-root-site') || ('write-root-site' in args.values)) {
    const outDir = args.values.out || args.values['write-root-site'];
    if (!outDir) throw new Error('--out <폴더> 경로를 지정하세요.');
    const fps = normalizeFingerprints(args.values.sha256);
    if (!fps.length) throw new Error('--sha256 <AA:BB:...> 지문을 지정하세요.');
    const created = writeRootSite(outDir, fps);
    console.log('루트 오리진(nabaho.github.io) 배포용 파일 생성 완료:', created);
    return;
  }
  if (args.flags.has('init-keystore') || ('init-keystore' in args.values)) {
    const outFile = args.values.out || args.values['init-keystore'];
    if (!outFile) throw new Error('--out <저장소_바깥_경로/portal-upload.jks> 를 지정하세요.');
    initKeystore(outFile);
    return;
  }
  const res = checkReadiness();
  console.log(res.report);
  if (!res.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('오류:', err.message || err);
    process.exitCode = 1;
  }
}

module.exports = {
  PACKAGE_NAME,
  assertOutsideRepo,
  normalizeFingerprints,
  buildAssetLinksJson,
  checkReadiness,
  writeRootSite,
};
