상태: 완료
가지: feat/pu-wiki

# 푸른 지식백과 (pu-wiki.html) — 3층 검증형 사내위키 신설 및 옵시디언·법령원문·위키백과 분리 연동 (2026-11-28)

대표 지시: 「옵시디언 작업과 푸른 업무 통합 시스템을 연결시켰는데 이걸 어떻게 활용해야 하느냐 … 위키피디아와도 문제 없이 시스템적으로 잘 돌아가게 만들고 다른 직원들이 검토해도 정확한 정보를 확인할 수 있게 추천대로 해 달라」

## 한 일
- `pu-wiki.html` · `js/pu-wiki.js`: 자료함(`store` 줄) 신규 앱 「📖 푸른 지식백과」 신설.
  - **1층(사내 실무 지식)**: 옵시디언 배포 묶음(`.json`·`.md`) 가져오기 시 내 PC 경로(`C:\`·`file:///`)·하위 폴더 트리·연락처·사업자번호·이메일을 자동 제거하고 주민등록번호 원문은 저장을 차단하며, 8대 노무·컨설팅 비식별 기본 실무 기준을 수록.
  - **2층(법적 근거 원문)**: 본문·인용 조문(약칭 포함)을 자동 추출해 `P박스`(`PuPBoxCorpus`·`PuPBoxLawIndex`·`PuPBoxEngine`) 및 국가법령정보센터(`law.go.kr`) 원문으로 직결.
  - **3층(외부 배경지식 분리)**: 한국어 위키백과 공식 REST API 조회 결과를 「법적 근거 아님」 참고 상자로 분리하고 개인정보·사건번호 검색어의 외부 전송을 차단.
  - **교차검증 워크플로**: 담당 노무사·직원의 `[✅ 검토 확인]`(고유 `actorSid` 기준 집계) 및 `[🚩 오류·개정 신고]` 즉시 경고 배지, 온톨로지 강제 관문(`PuOntologyWrite` enforce · `_deleted` 무덤 표식) 적용.
- `js/pu-ontology.js` · `enter.html` · `js/pu-appbar.js` · `js/pu-chatbot-kb.js`: `puwiki`(`WikiArticle`·`WikiReview`), 포털 타일·앱바·챗봇(`SYS-puwiki-01`) 등록 및 공유 스크립트 캐시 번호 갱신.
- `scripts/make-firebase-rules.js` · `docs/firebase-rules-*.json` · `tests/perf-rules.test.js` · `tests/photos-staff-share.test.js`: `/puwiki` 실시간 DB 보안규칙(재직 직원 읽기·쓰기, 물리 삭제 금지, `reviews` 본인 사번 위조 방지 및 불변 칸 잠금) 작성 및 콘솔 배포·일치 확인.
- `tests/pu-wiki.test.js` · `tools/phone-audit/seeds/puwiki.js` · `tests/color-palette-apps.test.js`: 단위·보안·27색 팔레트·휴대폰 화면(`360px`·`411px` 6개 뷰 결함 0) 시험 추가.
