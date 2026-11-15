# 2026-11-15 · 푸른포털 Google Play 스토어 심사·등록 전체 기반 구축 (feat/play-store-ready)

- 대표 지시 「푸른시스템을 Google Play 스토어에 다운받을 수 있게 시스템을 만들려고 한다. 등록에 통과할 수 있는 모든 시스템 개선해달라」.
- `android/portal-twa/` — 패키지 ID `kr.pureun.portal`, `compileSdk = 36` · `targetSdk = 36` · `minSdk = 26`, 최소 권한(`INTERNET`, `ACCESS_NETWORK_STATE`, `AD_ID` 병합 원천 제거), 100% 벡터 Adaptive Icon(전경·배경·단색), 네이티브 오프라인 안내(`PortalLauncherActivity`), TWA 미지원 기기 안전 폴백(`WebViewFallbackActivity`).
- `.github/workflows/build-portal-playstore.yml` — Play Console 제출용 `app-release.aab` 및 사전 기기 점검용 `app-release.apk` 자동 빌드·지문 출력 워크플로.
- `policy/privacy.html` · `policy/account-deletion.html` · `policy/terms.html` — Google Play 필수 공개 정책 문서 3종 작성 및 `enter.html`(로그인 전·내 정보)·`install.html` 인앱 접근 링크 연결.
- `enter.html` — Play 심사관 전용 격리 계정(`playreviewer@pureun.kr` → `role: 'reviewer'`) 분기 추가: 의뢰인·구성원 실데이터 원천 격리 유지, 명부 미등록 경고·DB 권한 오류 제거, `준비중`·`PC 전용` 타일 미노출, 실작동 로컬·공공데이터 프로그램(`한글 편집기` · `공공임단협`) 노출.
- `scripts/play-store-setup.js` · `scripts/make-playstore-assets.js` · `.well-known/assetlinks.json` · `.nojekyll` · `docs/구글플레이-등록-가이드.md` · `tests/play-store-readiness.test.js` — 준비도 점검, 업로드 서명키·루트 `assetlinks.json` 생성, 스토어 그래픽(512×512 아이콘 · 1024×500 대표 그래픽) 생성, 복붙용 등록 가이드 및 자동화 검증 추가.
