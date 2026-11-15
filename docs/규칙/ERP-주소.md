# ERP 주소 — `https://erp.pureunlabor.co.kr` (2026-11-15 이사)

> 대표 지시 2026-11-16 「도메인주소 변경 이후 안티그래피티 챗지피티 제미나이등 코딩에 전혀 영향 없게 잘정리 해라」.
> Claude(CLAUDE.md)·Codex/Copilot(AGENTS.md)·Gemini/Antigravity(GEMINI.md·`.agents/rules/pureun-rules.md`)가 같은 규칙을 읽는다.
> 이사 계획·경과: `docs/superpowers/plans/2026-11-15-ERP-주소-이사.md`

## 주소

| 무엇 | 주소 |
|---|---|
| 푸른 ERP(통합 포털, 이 저장소의 GitHub Pages) | `https://erp.pureunlabor.co.kr` (뿌리 → `enter.html`) |
| 공개 홈페이지(저장소 nabaho/pureun-site) | `https://pureunlabor.co.kr` |
| 옛 ERP 주소 | `https://nabaho.github.io/pureunall/*` → GitHub 이 **301** 로 새 주소에 넘김(경로 앞머리 `/pureunall` 만 떼고 `?…`·`#…` 유지) |
| 옛 기기 자료 구출 쪽 | `https://nabaho.github.io/pureunall-rescue/` (옛 출처 저장소를 파일로 내려받기) |
| 메일 도메인(그대로) | `fairrunlabor.com` — 회사 메일·뉴스레터(news.fairrunlabor.com)·급여명세서 발신 |

## 지킬 것

1. **화면 코드는 상대경로만.** `href="/pureunall/…"`·`location.href = '/pureunall/…'` 같은 절대 경로는 새 주소에서 404 다(앞머리가 없다). 자기 주소가 필요하면 `location.origin`.
2. **서버(functions)는 `functions/erp-origins.js` 만 쓴다.**
   - `ERP_ORIGINS` — 받아 주는 출처(CORS·OAuth). 옛 출처 `https://nabaho.github.io` 는 이미 나간 링크·옛 탭 때문에 **2027-02-15 무렵까지** 남긴다. 와일드카드 금지.
   - `ERP_LINK_BASE` — 사람에게 내보내는 ERP 링크(메일·문자·알림 본문)의 뿌리. 언제나 새 주소.
   - `PUBLIC_HOME` — 바깥 사람을 «홈»으로 보낼 때(공개 홈페이지).
   - 주소 글자(`https://…`)를 함수 파일에 새로 박지 않는다.
3. **옛 주소는 «동작은 하지만» 새 코드·문서·안내 글에 쓰지 않는다.** 301 을 한 번 더 돌고, 2027-02 이후 옛 출처 허용을 빼면 서버 호출이 막힌다.
4. **브라우저 저장소는 출처별이다.** 옛 주소의 localStorage·IndexedDB·로그인·알림 권한·설치 앱은 새 주소에서 안 보인다. 자료를 옮기는 코드를 짜지 말고, 필요하면 구출 쪽으로 꺼내 사람이 넘긴다.
5. **바깥 콘솔에 주소를 등록하는 곳**(새 기능이 OAuth·CORS 를 쓰면 같이 넣는다): Firebase Auth 승인 도메인, 구글 OAuth 클라이언트(프로젝트 tactile-timer-447610-p5)의 JS 원본·리디렉션, 카카오 앱 1589519 리다이렉트 URI, Storage 버킷 3개 CORS(`docs/storage-cors.json`).

## 지키는 검사

- `tests/no-hardcoded-old-erp-url.test.js` — 화면·서버 실행 코드(뿌리 `*.html`·`js/*.js`·`functions/**/*.js`, 주석 제외)에 `nabaho.github.io/pureunall` 이 «새로 생기거나 늘면» 실패. 지금 남은 자리는 파일별 상한과 까닭을 적은 허용 목록으로 묶었다(줄이는 것은 언제나 좋다 — 줄였으면 상한도 내린다).
- `tests/erp-origins-dual.test.js`·`tests/erp-dual-origin.test.js`·`tests/erp-move-finish.test.js` — 두 출처 허용·화면 두 주소 동작·내보내는 링크가 새 주소.
