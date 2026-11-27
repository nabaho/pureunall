'use strict';
/* 푸른포털 Google Play 스토어 심사 통과 준비도 통합 검증
 *
 * 검증 범위:
 *   1) 공개 정책 문서 3종(개인정보처리방침·계정삭제·이용약관) 필수 항목 및 색상·복귀 링크
 *   2) 포털 로그인 전(#loginView)·설치 화면(install.html)·로그인 후(내 정보) 정책·삭제 링크 노출
 *   3) Play 심사관 전용 계정(playreviewer@pureun.kr) 격리 동작:
 *      - 명부 미등록 경고가 뜨지 않고 role='reviewer' 전용 프로필이 잡힌다
 *      - APPS.forEach 를 실제로 돌렸을 때 준비중·PC 전용·사내 실데이터 타일이 0개이고
 *        실작동 프로그램(한글 편집기·공공임단협)만 정상 링크로 열린다
 *      - 기존 관리자(admin)·직원(member) 타일 동작은 조금도 바뀌지 않는다
 *   4) Android TWA 프로젝트(android/portal-twa) Play 정책 준수:
 *      - applicationId = kr.pureun.portal, targetSdk >= 36, compileSdk >= 36
 *      - 민감 권한(READ_SMS/SEND_SMS/REQUEST_INSTALL_PACKAGES 등) 미사용 및 AD_ID 병합 차단
 *      - usesCleartextTraffic="false", allowBackup="false", 오프라인 안내 액티비티 및 WebView 폴백 구비
 *   5) 스토어 그래픽 생성기(make-playstore-assets.js) 및 설정 도우미(play-store-setup.js) 실제 실행 검증
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { 함수몸 } = require('./strip-comments');

const ROOT = path.resolve(__dirname, '..');
const readUtf8 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('공개 정책 문서 3종이 존재하고 Google Play 필수 고지 항목을 모두 담고 있다', () => {
  const privacy = readUtf8('policy/privacy.html');
  const deletion = readUtf8('policy/account-deletion.html');
  const terms = readUtf8('policy/terms.html');

  assert.match(privacy, /개인정보처리방침/);
  assert.match(privacy, /처리하는 개인정보의 항목/);
  assert.match(privacy, /보유 및 이용\s*기간/);
  assert.match(privacy, /개인정보 보호책임자/);
  assert.match(privacy, /account-deletion\.html/, '개인정보처리방침에서 계정 삭제 안내로 이어져야 합니다');
  assert.match(privacy, /\.\.\/enter\.html/, '포털 복귀 링크가 있어야 합니다');

  assert.match(deletion, /계정 및 데이터 삭제/);
  assert.match(deletion, /Account\s*(?:&|&amp;)\s*Data Deletion/i, '해외 심사관 확인을 위한 영문 삭제 요약이 있어야 합니다');
  assert.match(deletion, /mailto:[^"']+\?subject=/, '즉시 삭제 요청 메일 링크가 있어야 합니다');
  assert.match(deletion, /삭제되는 데이터/);

  assert.match(terms, /이용약관/);
  assert.match(terms, /알리오|클린아이/, '공공데이터 출처 표기가 약관에 명시되어야 합니다');
});

test('로그인 전 포털 화면·설치 안내 화면·로그인 후 내 정보 창 모두에서 정책과 계정 삭제 안내에 닿는다', () => {
  const enter = readUtf8('enter.html');
  const install = readUtf8('install.html');

  const loginStart = enter.indexOf('<div id="loginView">');
  const portalStart = enter.indexOf('<section class="portal" id="portalView"');
  assert.ok(loginStart >= 0 && portalStart > loginStart, 'loginView 영역을 찾을 수 있어야 합니다');
  const loginSection = enter.slice(loginStart, portalStart);

  for (const href of ['policy/privacy.html', 'policy/terms.html', 'policy/account-deletion.html']) {
    assert.ok(loginSection.includes(href), '로그인 전 화면에 ' + href + ' 링크가 없습니다');
    assert.ok(install.includes(href), '설치 안내 화면(install.html)에 ' + href + ' 링크가 없습니다');
  }

  const policyHelper = 함수몸(enter, 'puPolicyLinksHtml');
  const profileFn = 함수몸(enter, 'kkOpenProfile');
  assert.match(policyHelper, /policy\/privacy\.html/);
  assert.match(policyHelper, /policy\/account-deletion\.html/);
  assert.match(profileFn, /puPolicyLinksHtml\(\)/, '로그인 후 내 정보 창에서도 정책·삭제 링크가 나와야 합니다');
});

test('Play 심사관 전용 계정(playreviewer@pureun.kr)은 사내 실데이터·준비중 타일 없이 실작동 앱만 노출한다', () => {
  const enter = readUtf8('enter.html');

  // 1) puPlayReviewerAcct 판별 검증
  const acctCtx = {};
  vm.createContext(acctCtx);
  vm.runInContext(함수몸(enter, 'puPlayReviewerAcct'), acctCtx);
  const rev = acctCtx.puPlayReviewerAcct('PlayReviewer@pureun.kr ');
  assert.ok(rev && rev.role === 'reviewer', '심사 전용 이메일은 reviewer 역할을 돌려줘야 합니다');
  assert.equal(acctCtx.puPlayReviewerAcct('p001@pureun.kr'), null, '일반 사내 계정은 건드리지 않아야 합니다');
  assert.equal(acctCtx.puPlayReviewerAcct(''), null);

  // 2) APPS 목록 + appIsSoon + APPS.forEach 블록을 실제 vm 에서 돌려 역할별 타일 비교
  const appsMatch = /var APPS = \[[\s\S]*?\n  \];/.exec(enter);
  const loopMatch = /APPS\.forEach\(function\(app\)\{[\s\S]*?\n    \}\);/.exec(enter);
  assert.ok(appsMatch && loopMatch, 'APPS 정의와 타일 렌더링 루프를 찾을 수 있어야 합니다');

  function renderTilesForRole(role, mobile, extraApps) {
    const tiles = [];
    const headShown = [];
    const ctx = {
      role,
      sgIsAdmin: () => role === 'admin',
      isMobile: () => mobile,
      appRowOf: (app) => app.row || 'client',
      portalAppWindowName: (k) => 'pureun-' + k,
      portalHeadAppPaint: (app) => headShown.push(app.key),
      portalAppPermOk: () => false,
      alert: () => {},
      openPortalApp: () => {},
      Date,
      Math,
      document: {
        createElement: () => ({
          className: '',
          dataset: {},
          style: {},
          href: '',
          target: '',
          title: '',
          innerHTML: '',
          attrs: {},
          setAttribute(k, v) { this.attrs[k] = v; },
          removeAttribute(k) { delete this[k]; delete this.attrs[k]; },
          addEventListener() {},
        }),
      },
      tileCont: () => ({ appendChild: (el) => tiles.push(el) }),
    };
    vm.createContext(ctx);
    const inject = Array.isArray(extraApps) && extraApps.length
      ? 'APPS = APPS.concat(' + JSON.stringify(extraApps) + ');\n'
      : '';
    vm.runInContext(
      appsMatch[0] + '\n' + inject + 함수몸(enter, 'appIsSoon') + '\n' + loopMatch[0],
      ctx
    );
    return { tiles, headShown };
  }

  const soonProbe = [{ key: '_soon_probe', name: '출시전앱', desc: '', icon: '🧪', url: 'probe.html', roles: null, soon: true, row: 'client' }];
  const reviewerMobile = renderTilesForRole('reviewer', true, soonProbe);
  const reviewerKeys = reviewerMobile.tiles.map((t) => t.dataset.key).sort();
  assert.deepEqual(
    reviewerKeys,
    ['aliounion', 'hangul'],
    '심사관 계정에는 로컬·공공데이터 실작동 프로그램(한글 편집기·공공임단협)만 노출되고 준비중 앱은 숨겨져야 합니다'
  );
  assert.equal(reviewerMobile.headShown.length, 0, '심사관 계정에는 사내 캘린더 머리줄 단추를 켜지 않습니다');
  for (const tile of reviewerMobile.tiles) {
    assert.notEqual(tile.href, '#', '심사관에게 노출된 타일은 막힌 링크(#)가 아니어야 합니다');
    assert.doesNotMatch(tile.innerHTML, /준비중|PC 전용/, '심사관 화면에 준비중·PC 전용 딱지가 없어야 합니다');
  }

  // 일반 직원과 관리자 화면은 기존대로 유지되는지 함께 확인 (급여아웃소싱 등 공개 앱은 즉시 실행, 준비중 지정 앱이 있을 때는 준비중 표시 유지)
  const memberMobile = renderTilesForRole('member', true, soonProbe);
  assert.ok(
    memberMobile.tiles.some((t) => t.dataset.key === 'erp'),
    '일반 직원 화면에는 기존 푸른이알피 등 사내 타일이 그대로 나와야 합니다'
  );
  assert.ok(
    memberMobile.tiles.some((t) => t.dataset.key === 'payroll' && t.href !== '#' && !t.dataset.soonApp),
    '일반 직원 화면에서 급여아웃소싱은 준비중 없이 즉시 실행 가능해야 합니다'
  );
  assert.ok(
    memberMobile.tiles.some((t) => t.dataset.soonApp === '1'),
    '일반 직원 화면의 준비중 타일 동작은 기존 그대로 유지되어야 합니다'
  );

  // 모바일 심사관 화면에서 무반응 관리자 설정(#cfgFab) 및 하단 더보기 막대(#fabBar/#moreDock) 감춤 확인
  const renderFn = 함수몸(enter, 'renderPortal');
  assert.match(renderFn, /cfgShowFab\(\)/, '심사관 로그인 시에도 cfgShowFab()으로 관리자 설정 단추를 숨겨야 합니다');
  assert.match(renderFn, /'fabBar'[\s\S]*?'moreDock'/, '심사관 로그인 시 하단 사내 도구 막대를 감춰야 합니다');
});

test('Android TWA 프로젝트가 Google Play API 36·최소 권한·암호화 통신·오프라인 방어 요건을 충족한다', () => {
  const gradle = readUtf8('android/portal-twa/app/build.gradle.kts');
  const manifest = readUtf8('android/portal-twa/app/src/main/AndroidManifest.xml');
  const strings = readUtf8('android/portal-twa/app/src/main/res/values/strings.xml');
  const launcherJava = readUtf8(
    'android/portal-twa/app/src/main/java/kr/pureun/portal/PortalLauncherActivity.java'
  );

  assert.match(gradle, /applicationId\s*=\s*"kr\.pureun\.portal"/);
  const compileSdk = Number((/compileSdk\s*=\s*(\d+)/.exec(gradle) || [])[1] || 0);
  const targetSdk = Number((/targetSdk\s*=\s*(\d+)/.exec(gradle) || [])[1] || 0);
  const minSdk = Number((/minSdk\s*=\s*(\d+)/.exec(gradle) || [])[1] || 0);
  assert.ok(compileSdk >= 36, 'compileSdk 는 36 이상이어야 합니다: ' + compileSdk);
  assert.ok(targetSdk >= 36, 'Google Play 신규 앱 정책상 targetSdk 는 36 이상이어야 합니다: ' + targetSdk);
  assert.ok(minSdk >= 26 && minSdk <= targetSdk, 'minSdk 범위가 올바르지 않습니다: ' + minSdk);

  // 민감 권한 0개 및 광고 ID 병합 제거 검증
  for (const forbidden of [
    'READ_SMS',
    'RECEIVE_SMS',
    'SEND_SMS',
    'READ_CALL_LOG',
    'READ_CONTACTS',
    'ACCESS_FINE_LOCATION',
    'REQUEST_INSTALL_PACKAGES',
    'SYSTEM_ALERT_WINDOW',
  ]) {
    assert.ok(!manifest.includes(forbidden), 'Play 심사 고위험 권한이 포함되어 있습니다: ' + forbidden);
  }
  assert.match(
    manifest,
    /com\.google\.android\.gms\.permission\.AD_ID[\s\S]*?tools:node="remove"/,
    '광고 ID 권한 병합 원천 차단 선언이 있어야 합니다'
  );
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /PortalLauncherActivity/);
  assert.match(manifest, /WebViewFallbackActivity/);
  /* 앱이 여는 주소 = ERP 가 실제로 열리는 주소(2026-11-15 이사 — functions/erp-origins.js 한 자리) */
  const ERP_LINK_BASE = require('../functions/erp-origins.js').ERP_LINK_BASE;
  assert.ok(strings.indexOf('>' + ERP_LINK_BASE + '/enter.html<') >= 0,
    '앱 시작 주소가 ERP 실제 주소(' + ERP_LINK_BASE + '/enter.html)가 아닙니다');

  // 네이티브 오프라인 방어 화면 및 내부 TWA 런처 비노출·URI 호스트 검증 확인
  assert.match(
    manifest,
    /com\.google\.androidbrowserhelper\.trusted\.LauncherActivity"[\s\S]*?android:exported="false"/,
    '내부 TWA LauncherActivity는 외부 앱이 임의 URI로 직접 열 수 없도록 exported="false" 여야 합니다'
  );
  assert.match(launcherJava, /isAllowedPortalUri/);
  assert.match(launcherJava, /NET_CAPABILITY_INTERNET/);
  assert.match(launcherJava, /registerDefaultNetworkCallback/);
  assert.match(launcherJava, /offline_title/);

  // PR 및 비기본 브랜치 빌드에서 서명 시크릿이 노출되지 않도록 워크플로가 분리되어 있는지 확인
  const workflow = readUtf8('.github/workflows/build-portal-playstore.yml');
  const prJob = workflow.slice(workflow.indexOf('verify-pr:'), workflow.indexOf('build-release:'));
  const relJob = workflow.slice(workflow.indexOf('build-release:'));
  assert.ok(prJob.length > 0 && !prJob.includes('secrets.'), 'PR 검증 job에는 서명 시크릿을 주입하지 않아야 합니다');
  assert.match(
    relJob,
    /if:\s*github\.event_name\s*!=\s*'pull_request'\s*&&\s*github\.ref\s*==\s*'refs\/heads\/main'/,
    '서명 시크릿을 사용하는 build-release job은 refs/heads/main 에서만 실행되어야 합니다'
  );
});

test('스토어 그래픽 생성기와 설정 도우미가 정상 동작하고 유효한 PNG·Asset Links를 만든다', () => {
  const { generatePlayStoreAssets } = require(path.join(ROOT, 'scripts', 'make-playstore-assets.js'));
  const setup = require(path.join(ROOT, 'scripts', 'play-store-setup.js'));

  const readiness = setup.checkReadiness();
  assert.equal(readiness.ok, true, '준비도 점검이 모두 통과해야 합니다:\n' + readiness.report);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pu-play-test-'));
  try {
    const assets = generatePlayStoreAssets(tmpDir);
    const iconBuf = fs.readFileSync(assets.iconPath);
    const featBuf = fs.readFileSync(assets.featurePath);

    // PNG 시그니처 + IHDR 해상도 검증 (512x512, 1024x500)
    assert.deepEqual(Array.from(iconBuf.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(iconBuf.readUInt32BE(16), 512);
    assert.equal(iconBuf.readUInt32BE(20), 512);

    assert.deepEqual(Array.from(featBuf.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(featBuf.readUInt32BE(16), 1024);
    assert.equal(featBuf.readUInt32BE(20), 500);

    // Asset Links 생성 검증 (예시 지문 형식 검증)
    const sampleFp = Array(32).fill('AA').join(':');
    const siteDir = path.join(tmpDir, 'root-site');
    setup.writeRootSite(siteDir, [sampleFp]);
    const parsed = JSON.parse(
      fs.readFileSync(path.join(siteDir, '.well-known', 'assetlinks.json'), 'utf8')
    );
    assert.equal(parsed[0].target.package_name, 'kr.pureun.portal');
    assert.deepEqual(parsed[0].target.sha256_cert_fingerprints, [sampleFp]);
    assert.ok(fs.existsSync(path.join(siteDir, '.nojekyll')));

    // 저장소 내부 경로 쓰기 원천 차단 및 하위 폴더 정션(junction)·심볼릭 링크 우회 차단 검증
    assert.throws(
      () => setup.assertOutsideRepo(path.join(ROOT, 'portal-upload.jks')),
      /바깥 폴더여야 합니다/
    );
    assert.throws(
      () => setup.writeRootSite(ROOT, [sampleFp]),
      /바깥 폴더여야 합니다/
    );
    if (process.platform === 'win32') {
      const linkDir = path.join(tmpDir, 'junction-site');
      fs.mkdirSync(linkDir, { recursive: true });
      fs.symlinkSync(path.join(ROOT, '.well-known'), path.join(linkDir, '.well-known'), 'junction');
      assert.throws(
        () => setup.writeRootSite(linkDir, [sampleFp]),
        /심볼릭 링크|정션|바깥 폴더/,
        '외부 폴더 내 .well-known 정션을 통한 저장소 우회 쓰기가 차단되어야 합니다'
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Google Play 앱(TWA·WebView) 내부에서는 외부 APK 다운로드 링크를 숨기고 배포 게이트가 정책·미인증 파일을 통제한다', () => {
  const vm = require('node:vm');
  const erp = readUtf8('pu-erp.html');
  const enter = readUtf8('enter.html');
  const deployYml = readUtf8('.github/workflows/deploy-pages.yml');

  // 1. enter.html 에서 TWA 진입 세션을 sessionStorage('pu_play_twa')에 기록한다
  assert.match(enter, /android-app:\/\/kr\.pureun\.portal/, 'enter.html 에 Play TWA referrer 감지가 있어야 합니다');
  assert.match(enter, /sessionStorage\.setItem\(['"]pu_play_twa['"]/, 'enter.html 에 pu_play_twa 세션 저장이 있어야 합니다');

  // 2. pu-erp.html hanaApkBlock() 이 Play 앱 환경(TWA referrer·세션·Android WebView)에서 .apk 링크를 노출하지 않는다
  function cutBlock(src, header) {
    const i = src.indexOf(header);
    assert.ok(i >= 0, '못 찾음: ' + header);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
    }
    throw new Error('닫는 괄호 없음: ' + header);
  }
  function hasApkLink(node) {
    if (!node) return false;
    if (Array.isArray(node)) return node.some(hasApkLink);
    if (typeof node !== 'object') return false;
    if (node.tag === 'a' && node.props && /hana-bridge\.apk/.test(String(node.props.href || ''))) return true;
    return hasApkLink(node.kids);
  }
  function evalHanaBlock(env) {
    const ctx = Object.assign({
      HANA_APK_VER: '9.9.9',
      location: { protocol: 'https:', origin: 'https://erp.pureunlabor.co.kr', pathname: '/pu-erp.html' },
      h: (tag, props, ...kids) => ({ tag, props: props || {}, kids }),
    }, env || {});
    vm.createContext(ctx);
    vm.runInContext(cutBlock(erp, 'function hanaApkUrl(){'), ctx);
    vm.runInContext(cutBlock(erp, '  function hanaApkBlock(){'), ctx);
    return ctx.hanaApkBlock();
  }

  assert.equal(
    hasApkLink(evalHanaBlock({ document: { referrer: 'android-app://kr.pureun.portal/' } })),
    false,
    'TWA referrer 환경에서는 외부 APK 다운로드 링크를 숨겨야 합니다'
  );
  assert.equal(
    hasApkLink(evalHanaBlock({ sessionStorage: { getItem: (k) => (k === 'pu_play_twa' ? '1' : null) } })),
    false,
    'TWA 세션(pu_play_twa=1)에서는 외부 APK 다운로드 링크를 숨겨야 합니다'
  );
  assert.equal(
    hasApkLink(evalHanaBlock({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36' } })),
    false,
    'Android WebView 폴백 환경에서는 외부 APK 다운로드 링크를 숨겨야 합니다'
  );
  assert.equal(
    hasApkLink(evalHanaBlock({ navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0' } })),
    true,
    '일반 PC 브라우저에서는 기존 하나문자 APK 다운로드 링크가 유지되어야 합니다'
  );

  // 3. 배포 게이트가 Play 필수 정책 문서 3종을 유지하고 미인증 프로토타입(pu-payroll-mail-sync.html)을 제외한다
  for (const keepPolicy of ['policy/privacy.html', 'policy/terms.html', 'policy/account-deletion.html']) {
    assert.ok(deployYml.includes(keepPolicy), 'deploy-pages.yml keep 목록에 누락됨: ' + keepPolicy);
  }
  assert.match(deployYml, /test -f "\$pdoc" && test -s "\$pdoc"/, '정책 문서 3종은 비어 있지 않은 일반 파일인지 검증해야 합니다');
  assert.match(deployYml, /rm -f --[^\n]*pu-payroll-mail-sync\.html/, '미인증 시안 파일이 배포 제외 목록에 있어야 합니다');
  assert.match(deployYml, /for gone in[\s\S]*?pu-payroll-mail-sync\.html/, '미인증 시안 파일이 gone 검증 목록에 있어야 합니다');

  // 4. 네이티브 TWA 딥링크(PortalLauncherActivity.java)에서 .apk 직접 경로를 차단한다
  const launcherJava = readUtf8('android/portal-twa/app/src/main/java/kr/pureun/portal/PortalLauncherActivity.java');
  assert.match(launcherJava, /endsWith\("\.apk"\)/, '네이티브 딥링크에서 .apk 경로를 차단해야 합니다');
});

test('안드로이드 홈 화면 위젯과 Digital Asset Links SHA-256 지문이 안전하게 구성되어 있다', () => {
  const manifest = readUtf8('android/portal-twa/app/src/main/AndroidManifest.xml');
  const widgetJava = readUtf8('android/portal-twa/app/src/main/java/kr/pureun/portal/PortalWidgetProvider.java');
  const widgetInfo = readUtf8('android/portal-twa/app/src/main/res/xml/portal_widget_info.xml');
  const widgetLayout = readUtf8('android/portal-twa/app/src/main/res/layout/widget_portal_quick.xml');
  const strings = readUtf8('android/portal-twa/app/src/main/res/values/strings.xml');
  const assetlinks = JSON.parse(readUtf8('.well-known/assetlinks.json'));

  // 1. Digital Asset Links 업로드 키 SHA-256 지문이 최소 1개 이상 유효한 형식으로 등록되어 있어야 한다
  const fps = assetlinks[0] && assetlinks[0].target && assetlinks[0].target.sha256_cert_fingerprints;
  assert.ok(Array.isArray(fps) && fps.length >= 1, 'assetlinks.json 에 최소 1개의 SHA-256 인증서 지문이 등록되어 있어야 합니다');
  for (const fp of fps) {
    assert.match(fp, /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/, '잘못된 SHA-256 지문 형식: ' + fp);
  }

  // 2. 홈 화면 위젯 리시버·메타데이터·레이아웃·FLAG_IMMUTABLE 보안 검증
  assert.match(manifest, /android:name="\.PortalWidgetProvider"/);
  assert.match(manifest, /android\.appwidget\.action\.APPWIDGET_UPDATE/);
  assert.match(manifest, /@xml\/portal_widget_info/);
  assert.match(widgetInfo, /@layout\/widget_portal_quick/);
  assert.match(widgetJava, /PendingIntent\.FLAG_IMMUTABLE/, 'Android 12+ 보안 정책상 PendingIntent.FLAG_IMMUTABLE 이 필수입니다');
  assert.match(widgetJava, /PortalLauncherActivity\.class/, '위젯은 명시적으로 PortalLauncherActivity 를 통해 검증된 주소만 열어야 합니다');

  // 3. 위젯의 6개 핵심 앱 바로가기 버튼과 URL 이 모두 ERP 정식 출처를 가리킨다
  const { ERP_LINK_BASE } = require('../functions/erp-origins.js');
  for (const id of ['widget_header', 'widget_btn_erp', 'widget_btn_cal', 'widget_btn_cards', 'widget_btn_mail', 'widget_btn_photos', 'widget_btn_work']) {
    assert.ok(widgetLayout.includes('@+id/' + id), '위젯 레이아웃에 버튼이 누락됨: ' + id);
    assert.ok(widgetJava.includes('R.id.' + id), '위젯 Provider에 클릭 핸들러가 누락됨: ' + id);
  }
  for (const key of ['widget_url_portal', 'widget_url_erp', 'widget_url_cal', 'widget_url_cards', 'widget_url_mail', 'widget_url_photos', 'widget_url_work']) {
    assert.ok(
      strings.includes('name="' + key + '" translatable="false">' + ERP_LINK_BASE + '/'),
      '위젯 URL이 ERP 정식 출처(' + ERP_LINK_BASE + ')와 다릅니다: ' + key
    );
  }
});
