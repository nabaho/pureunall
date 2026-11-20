# 2026-11-18 · 안드로이드 CI PR 서명키 격리·단계 범위 제한 및 임시 키파일 파기 (fix/android-ci-secret-isolation)

- `build-hana-sms-bridge.yml` 을 `refs/heads/main` 전용 서명 빌드(`build`)와 시크릿 미주입 PR 검증 빌드(`verify-pr`)로 분리했다.
- `build-hana-sms-bridge.yml` 과 `build-portal-playstore.yml` 모두 서명 시크릿을 잡 전체가 아닌 필요한 단계의 `env:` 에만 제한하고, 임시 `.jks` 생성 시 `umask 077` 및 `if: always()` 파기 단계를 적용했다(`tests/hana-apk-signing.test.js` 로 지킨다).
