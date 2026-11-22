# 푸른포털 Google Play 스토어 앱 (`kr.pureun.portal`)

푸른노무법인 통합 업무 시스템(**푸른포털**, `https://erp.pureunlabor.co.kr/enter.html`(2026-11-15 이사 — 옛 `nabaho.github.io/pureunall` 은 301))을 **Google Play 스토어**에서 바로 내려받아 설치할 수 있게 묶은 공식 Android Trusted Web Activity(TWA) 프로젝트입니다.

## 핵심 설계 (Google Play 심사 기준 충족)
1. **최신 API 36 대응**: `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26` (Android 8.0 이상)
2. **최소 권한 원칙**: `INTERNET`·`ACCESS_NETWORK_STATE` 외 민감 권한(`READ_SMS`, `SEND_SMS`, `REQUEST_INSTALL_PACKAGES` 등) 0개, 광고 식별자(`com.google.android.gms.permission.AD_ID`) 병합 원천 차단(`tools:node="remove"`).
3. **네이티브 오프라인 방어(`PortalLauncherActivity`)**: 비행기 모드·통신 단절 상태에서 실행하더라도 브라우저 원시 오류 화면 대신 한국어 안내 카드·재연결 버튼·네트워크 설정 이동·복구 시 자동 연결이 작동합니다.
4. **TWA 미지원 기기 안전 폴백(`WebViewFallbackActivity`)**: Chrome 등 TWA 지원 브라우저가 비활성화된 테스트 기기에서도 외부 브라우저로 튕기지 않고 앱 내부에서 안전하게 열립니다.
5. **100% 벡터 Adaptive Icon**: 전경(`ic_launcher_foreground`)·배경(`ic_launcher_background`)·단색(`ic_launcher_monochrome`)이 모두 벡터 XML로 구성되어 모든 해상도와 테마 아이콘을 선명하게 지원합니다.

## 자동 빌드 (GitHub Actions)
- 워크플로: `.github/workflows/build-portal-playstore.yml`
- 산출물:
  - `pureun-portal-playstore-aab` → `app-release.aab` (**Google Play Console 업로드용**)
  - `pureun-portal-playstore-apk` → `app-release.apk` (사전 기기 설치 점검용)

## 업로드 서명키 및 Asset Links 설정
저장소 루트에서 아래 도우미를 실행하면 서명키 생성·GitHub Secret 등록·`assetlinks.json` 배포까지 안내합니다.

```bash
node scripts/play-store-setup.js --check
```

자세한 스토어 등록 절차와 심사관 계정 안내는 `docs/구글플레이-등록-가이드.md`를 참고하세요.
