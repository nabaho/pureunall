# 2026-11-15 · 새 홈페이지 정식 공개 — 원본 주소를 pureunlabor.co.kr 로 (claude/home-go-live)

- 대표 결정 「푸른노무법인.kr 더이상 연장 안한다」(옛 홈페이지 도메인 11-27 만료) → 「새 홈페이지 정식 공개 … 여기서 진행」.
- `scripts/freeze-homepage.js` `REAL_ORIGIN` → `https://pureunlabor.co.kr` (canonical·og:url·sitemap·robots 의 주소 머리).
- `site/`(20개 파일) 을 «미리보기 → 운영용»으로 돌렸다 — **내려받기 없이** 머리만 바꿨다
  (다시 굳히면 ERP 에서 올린 구성원·공지가 옛 사이트 내용으로 덮이므로).
  - canonical·og:url 의 옛 주소 → 새 주소, `noindex` 줄 뺌, 「미리보기용」 표시 → 「실제 운영용」
  - `robots.txt` 열림 + `Sitemap: https://pureunlabor.co.kr/sitemap.xml`, `sitemap.xml` 주소 머리 교체
  - 홈페이지 저장소(nabaho/pureun-site)도 같은 변환. 그쪽 sitemap 에 빠져 있던 공지 140 도 이쪽 것으로 맞춤.
- 검사
  - `tests/home-domain-cname.test.js` — 규칙 바뀜: 「원본 ≠ 얹히는 주소」 → 「원본 = 얹히는 주소, 접은 옛 도메인 아님」.
  - `tests/homepage-static.test.js` — 「진짜 주소」를 굳히개 REAL_ORIGIN 에서 읽는다(따로 박지 않음). 옛 도메인 둘은 «새 나가면 안 되는 곳»으로 남김.
  - 고장넣기 넷(원본 옛 주소 / 운영용인데 noindex / sitemap 옛 주소 / robots 막음) 모두 잡힘 → 원복.
- 굳히개는 11-27 뒤 내려받을 곳이 없어 못 돈다 — 머리말 주석에 적었다. 고치는 길은 ERP 「저장하고 반영」 한 길.
- 남은 일: ERP 「홈페이지」 화면의 옛 홈페이지 기능(옛 관리자로 고치기·옛 사이트 링크·미리보기 꾸밈) 정리 — 조사 중.
