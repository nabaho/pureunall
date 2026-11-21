# 2026-11-21 Google Play 보안·정책 보완 (`fix/play-policy-hardening`)

- **배경**: 푸른포털 Google Play 스토어 전수 감사에서 확인된 보안·정책 리스크 4건을 일괄 보완.
- **변경 내용**:
  1. `enter.html` + `pu-erp.html`: Play 앱(TWA `android-app://kr.pureun.portal` referrer, `sessionStorage('pu_play_twa')`, Android WebView 폴백) 내부에서는 외부 APK 설치 유도(`hana-bridge.apk`) 링크를 숨기고 PC 브라우저 설치 안내로 대체.
  2. `.github/workflows/deploy-pages.yml`: 미인증 프로토타입 시안 파일 `pu-payroll-mail-sync.html`을 공개 배포에서 제외(`rm -f`·`gone` 검증)하고, Play 필수 공개 문서 `policy/privacy.html`·`terms.html`·`account-deletion.html`을 필수 유지(`keep`) 검증 목록에 추가.
  3. `pu-news.html`: 화면 내 옛 주소(`nabaho.github.io/pureunall/`) 안내문·placeholder 3곳을 `erp.pureunlabor.co.kr/`로 갱신하고 `tests/no-hardcoded-old-erp-url.test.js` 상한 제거.
  4. `tests/play-store-readiness.test.js`, `tests/dev-tools-not-published.test.js`: 위 보안·정책 가드 자동화 테스트 추가.
