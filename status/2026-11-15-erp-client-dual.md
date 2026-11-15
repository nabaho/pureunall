# 2026-11-15 · ERP 주소 이사 1단계 — 화면·도구를 «옛·새 주소 양쪽»에서 (claude/erp-client-dual)

- 대표 지시 「모든 부분 중단하지말고 모두 옮겨달라」 — 계획 `docs/superpowers/plans/2026-11-15-ERP-주소-이사.md` 1단계 중 화면·도구 몫.
  옛: `https://nabaho.github.io/pureunall/…` · 새: `https://erp.pureunlabor.co.kr/…`(앞머리 없음). 도메인을 켜는 순간 옛 주소는 301 이라 «미리» 양쪽에서 돌아야 한다.
- 절대경로 → 상대: `enter.html` manifest 줄, `install.html`(manifest·아이콘·워커 등록·포털 링크 3곳).
- `manifest.json` scope `/pureunall/` → `./`(옛 주소에서 같은 뜻). **id 는 그대로** — 옛 설치본이 둘로 갈리지 않게(새 주소에서도 불투명 식별자로 동작).
- `firebase-messaging-sw.js` — 앱 뿌리(APP_BASE)를 워커 자리에서 읽는다(옛 `/pureunall/`, 새 `/`). 새 주소에서는 서버가 보낸 옛 꼴 `/pureunall/x` 앞머리를 떼고 연다. 아이콘·배지도 뿌리 기준. 뿌리 뒤 `//`(→ 바깥 주소) 막기를 더했다.
- 새 파일: 뿌리 `index.html`(→ enter.html, 쿼리·해시 유지) · `404.html`(새 주소에서 옛 꼴 `/pureunall/…` 이면 앞머리 떼고 넘김 — 이미 보낸 서명 링크·즐겨찾기 구제, `//` 막음, 옛 주소에서는 안내만).
- 배포(`deploy-pages.yml`): `include-hidden-files: true` — v4 부터 점 파일을 빼서 `.well-known/assetlinks.json` 이 404 였다(실측). 필수 확인에 `index.html`·`404.html`·`.well-known/assetlinks.json`, 지우기·남으면멈춤에 `.gitattributes` 등 점 파일.
- 도구: 리멤버 확장(`manifest.json` 받는 화면 두 주소, `bg.js` 열린 탭을 두 주소로 찾기) · 폰 미러(`허용주소` 새 주소). `remember-pull` 은 옛 주소를 열면 301 로 따라가므로 그대로(이사 뒤 그 프로필에서 한 번 다시 로그인).
- `clinic-intake.html` — 이미 `location.origin + location.pathname` 으로 북마클릿을 만든다(고칠 것 없음). 이사 뒤 직원은 북마클릿을 다시 끌어 놓는다.
- 검사: 새 `tests/erp-dual-origin.test.js`(11) · 고친 것 `phone-security-hardening`(워커를 통째로 옛·새 출처에서 돌림) · `push-badge-icon` · `remember-auto` · `dev-tools-not-published`(필수 목록). 고장넣기 10가지 모두 잡힘.
- 화면 확인: 설치 화면·404 쪽 PC 1366 · 폰 375 그림(가로 넘침 0).
- 범위 밖: functions/(서버 두 주소 허용 — 다른 PR), pu-home.html, 콘솔·DNS·도메인 전환, TWA 새 빌드(manifest related_applications 도 그때).
