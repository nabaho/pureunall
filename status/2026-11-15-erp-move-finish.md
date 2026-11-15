# 2026-11-15 · ERP 이사 마무리 (claude/erp-move-finish)

- 배경: ERP 를 2026-11-15 23:03 KST 에 `https://erp.pureunlabor.co.kr` 로 전환(Pages 사용자 도메인·인증서·HTTPS 강제). 서버 두 출처 허용(PR #3101)·화면 두 주소 동작(PR #3102) 뒤의 정리.
- 사람에게 «내보내는» 링크를 새 주소로
  - `functions/erp-origins.js` — `ERP_LINK_BASE`(= 새 출처, ERP 화면 링크 뿌리)·`PUBLIC_HOME`(공개 홈페이지) 더함. 옛 출처는 받는 목록에 «2026-02-15 무렵까지» 남긴다고 날짜와 함께 적음.
  - `functions/news-friday.js` 검토 메일 «관리 화면» 링크, `functions/recruit-digest.js` 정부사업 화면 링크 → `ERP_LINK_BASE`.
  - `functions/index.js` newsClick «모르는 번호» 302 → `PUBLIC_HOME`(판단: 누르는 분은 뉴스레터 받은 바깥 사람 — ERP 로그인 문이 아니라 공개 홈페이지. 주석의 «우리 홈페이지로» 그대로).
  - `hosting/index.html`(news.fairrunlabor.com 첫 화면) «푸른노무법인 홈으로» → 공개 홈페이지. 호스팅은 합친 뒤 `firebase deploy --only hosting` 로 따로 올린다(Firebase 배포 작업은 규칙·함수만 다룸).
  - 웹푸시 url 의 상대경로 `/pureunall/…` 8곳은 **그대로** — 알림 워커가 새 출처에서 앞머리를 뗀다(PR #3102). 그림 «받는» 허용 목록 4곳(mail-send·news-lib 둘·news-view)의 옛 주소도 그대로(지난 회차 편지 그림).
- 기록 맞춤: `docs/storage-cors.json`·`docs/storage-cors-읽어보세요.md` 에 새 출처(실제 버킷 3곳에는 이미 들어가 있음).
- 문서: `STATUS.md` 배포 주소·도메인 절(«erp.푸른노무법인.kr» 안은 접음), 되풀이된 실수 11 에 한 줄, `payroll-STATUS.md`, 지금 안내 문서(구글플레이 가이드·캘린더 키·배포·폰화면·폰미러·AI 프록시·유료 API) 주소. 지난 기록·계획 문서는 안 건드림.
- 플레이스토어 앱(TWA): `strings.xml` 호스트·시작 주소·asset_statements, `AndroidManifest.xml` pathPrefix `/`, `PortalLauncherActivity` 주소 판정(뿌리 아래, `//` 막음), README. versionCode 1 그대로 — 출시 전(assetlinks 지문 비어 있음).
- 검사: 새 `tests/erp-move-finish.test.js` 8건(메일 둘은 «돌려 봄»), 기존 3개 규칙만큼 고침(news-track·newsletter-preview-link·play-store-readiness). 고장넣기 10개 모두 잡힘 → 원복.
