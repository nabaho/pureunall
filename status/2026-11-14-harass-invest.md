# 2026-11-14 — 괴롭힘·성희롱 조사 통합 작업실 (`feat/harass-invest`)

- 포털 「의뢰인 업무」에 **🛡️ 괴롭힘·성희롱 조사** (`pu-harass.html`) 등록 및 푸른통합 온톨로지(`harass` · `harass_invest` · `harass_secret` · `harass_sign`) 연동.
- **푸른 메일 사건별 자동 수집·정리 및 푸른이알피(`pu-erp.html`) 8단계 양방향 연동**:
  - 조사 의뢰·접수, 조사계획·비밀서약, 피해근로자·참고인 면담, 행위자 면담·소명, 3요건 사실인정·법리검토, 최종 조사결과보고서, 조치권고·사후모니터링, 종결·비밀문서 봉인의 8단계 프로토콜 자동 매칭 및 진행과정 동기화(수동 확정 단계 및 기존 수기 비고 보존).
- **녹취록 자동 정리 스튜디오 (`js/pu-harass-core.js`, `functions/doc-read.js`)**:
  - 최대 500문답 표(질문·답변), 진술 핵심 요지, 근로기준법 제76조의2 3요건 쟁점 후보(`검토중` 기본값) 무료 오프라인 즉시 정리 및 AI 정밀 구조화(클라이언트·서버 이중 주민등록번호 가림 및 `harass` 바이너리 차단).
- **정식 한글(`.hwpx`) 양방향 입출력 (`js/pu-harass-hwpx.js`)**:
  - `.hwpx`·`.hwp`·`.docx`·`.txt`·텍스트형 `.pdf` 불러오기 및 전자서명 PNG·문서 무결성 해시가 내장된 **면담 진술확인서(`.hwpx`)**·**최종 조사결과보고서(`.hwpx`)** 생성/왕복 복원.
- **비밀유지 2채널 종단간 암호화 전자서명 (`sign-harass.html`, `js/pu-harass-sign.js`, `/harass_sign`)**:
  - 128비트 단건 슬롯 + URL 해시(`#k`) + 2채널 12자리 난수 보안코드(`PBKDF2 210,000회 + deflate-raw + AES-256-GCM`) 및 256비트 `subAuth` 제출 검증.
  - 실시간DB `/harass_sign` 보안규칙 게시 완료(`pureun-erp-default-rtdb`, `docs/firebase-rules-콘솔원문-2026-11-12.json`).
