# 2026-11-16 · 홈페이지 원본 주소에 끝 빗금 (claude/home-canonical-slash)

- 왜: 구글 서치콘솔에 sitemap 을 낼 때 보니 하위 쪽 주소가 `https://pureunlabor.co.kr/greeting` 처럼 빗금 없이 적혀 있었다.
  쪽은 폴더(`greeting/index.html`)라 깃허브가 301 로 `/greeting/` 에 넘긴다 → 검색엔진에 «넘어가는 주소»를 원본이라 알리는 셈.
- `scripts/freeze-homepage.js` — `쪽주소(mid)` 하나로 canonical·og:url·sitemap 주소를 만든다(하위 쪽은 끝 빗금, 뿌리는 그대로). 굳히개는 실행하지 않음(운영 중 멈춤 장치).
- `site/` 쪽 16개 + `sitemap.xml` — 내려받기 없이 글자만 끝 빗금 꼴로. 홈페이지 저장소 nabaho/pureun-site 에도 같은 변환(별도 PR).
- `functions/notice-lib.js` — 새 공지 sitemap 줄을 끝 빗금으로 만들고, `/notice/` 꼴과 옛 `/notice` 꼴을 다 읽으며, 옛 꼴로 이미 실린 번호는 다시 안 넣는다.
  새 공지 쪽의 canonical·og:url 은 본(다른 공지 쪽)을 복사하며 `notice/옛번호/` → `notice/새번호/` 로 바꾸므로 따로 고칠 곳이 없다(pu-home.html·site-publish.js 손대지 않음).
- 자동 검토: 기능 검증 통과(antigravity gemini) · 보안(codex) 이번 변경 문제 없음, «기존» 중간 1건 → 고침: 굳히개 자산 출처를 앞글자가 아니라 «출처 정확히 같음»으로, `담기()` 가 출력 폴더 밖(풀린 ../·절대 경로)이면 건너뜀. 새 검사 `tests/freeze-homepage-safety.test.js`(함수를 떠서 돌림), 고장넣기 2개 잡힘.
  - 보안 재검증 1차: 넘김(3xx)이 출처 검사 없이 따라가던 것(중간) → `fetchBin` 이 우리 출처 https 안에서만, 5번까지 따라감. 가짜 https 로 돌려 보는 검사 추가. 고장넣기: 출처 검사 뺌 잡힘(https 검사만 뺀 것은 출처 비교에 이미 scheme 이 들어 있어 겹치는 이중 장치 — 동작 같음).
- 검사: `homepage-static` 에 «진짜 주소 = 그 쪽 폴더 자리(끝 빗금)»·«sitemap 하위 주소 끝 빗금»·«굳히개 쪽주소를 돌려 보기», `homepage-notice` 에 «끝 빗금·옛 꼴 섞여도 중복 없음». 고장넣기 8개 모두 잡힘.
