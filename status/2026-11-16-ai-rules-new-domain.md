# 2026-11-16 · 여러 AI 규칙에 ERP 새 주소 · 옛 주소 박기 막는 검사 (claude/ai-rules-new-domain)

- 대표 지시 「도메인주소 변경 이후 안티그래피티 챗지피티 제미나이등 코딩에 전혀 영향 없게 잘정리 해라」.
- 규칙 파일 넷에 같은 뜻의 «ERP 주소» 절: `CLAUDE.md`(Claude) · `AGENTS.md`(Codex·Copilot) · `GEMINI.md`(Gemini·Antigravity) · `.agents/rules/pureun-rules.md` 10번(Antigravity 늘 켜짐).
  - 배포 erp.pureunlabor.co.kr · 홈페이지 pureunlabor.co.kr / 화면은 상대경로(절대 `/pureunall/` 금지) / 서버는 `functions/erp-origins.js` 상수만 / 옛 주소는 301 이라 새 코드에 안 씀 / 출처별 저장소 → 구출 쪽.
  - 자세히: `docs/규칙/ERP-주소.md`(새로).
- 지킴: `tests/no-hardcoded-old-erp-url.test.js`(새로) — 뿌리 html·js/·functions/ 실행 코드(주석 제외)의 `nabaho.github.io/pureunall` 래칫. 지금 남은 7개 파일 14곳은 파일별 상한+까닭으로 묶음(OAuth https 아닐 때 대체값·이음 보기 링크·apk 내려받기·소식지 지난 회차 그림 허용).
  - `tests/agents-md.test.js` 짝 목록에 새 검사 추가, `tests/antigravity-rules.test.js` 에 «GEMINI.md·pureun-rules.md 가 새 주소·erp-origins.js·문서를 안다» 추가.
- `gov.html` 기업마당 «시스템 URL» 안내를 새 주소로(옛 주소를 등록하라던 안내) + `tests/gov-app.test.js` 규칙 갱신.
- `docs/규칙/폰화면.md` 는 이미 새 주소(마무리 PR #3104) — 바꿀 것 없음.
- 고장넣기 일곱: 허용 밖 js·상한 넘김·서버 함수·규칙 10번 지움·gov 옛 주소·AGENTS 검사 이름 지움 → 모두 실패, 주석으로만 넣음 → 통과(주석은 안 셈). 원복 확인.
- 남은 일: 허용 목록 14곳 중 «내보내는 링크»(이음 보기·apk)는 받는 쪽 확인 뒤 새 주소로 줄일 수 있다. 2027-02 옛 출처 빼기 때 허용 목록도 다시 본다.
