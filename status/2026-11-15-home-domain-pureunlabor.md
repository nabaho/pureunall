# 2026-11-15 · 홈페이지 도메인 pureunlabor.co.kr 로 옮김 (claude/home-domain-pureunlabor)

- 대표 지시 「홈페이지 도메인 주소 바꾸기 및 깃허브 도메인 주소 바꾸기 모두 실행해라」.
- 새로 산 도메인: pureunlabor.co.kr · pureunlabor.com (가비아, 법인 명의, 3년). 대표 주소는 .co.kr.
- `scripts/freeze-homepage.js` `SITE_DOMAIN` → `pureunlabor.co.kr` (굳히개가 만드는 CNAME).
- `pu-home.html` `SITE_VIEW`(「사이트 열기」) → `https://pureunlabor.co.kr`.
- 홈페이지 저장소(nabaho/pureun-site)의 GitHub Pages 사용자 도메인도 같은 주소로 바꾼다(저장소 설정).
- 그대로 둔 것
  - `REAL_ORIGIN`(검색 원본·sitemap) = 푸른노무법인.kr — 새 홈페이지는 아직 «미리보기»(robots 차단). 정식 공개(`--live`)는 대표 결정.
  - fairrunlabor.com — 메일(구글 워크스페이스)·뉴스레터·급여명세서 발신에 그대로 쓴다. MX·news 기록 손대지 않음.
- 왜 옮겼나: fairrunlabor.com 은 DNS 가 스퀘어스페이스 자리표(「곧 출시 예정」)를 가리켜, 9-03 연결 뒤에도 새 홈페이지가 밖에서 안 보였다.
- 남은 일: 가비아 DNS(A 넷 185.199.108~111.153 + www CNAME nabaho.github.io) → 인증서 → HTTPS 강제. pureunlabor.com → .co.kr 넘기기. 푸른노무법인.kr 11-27 만료(명의 woorimedia).
