# 2026-11-11 — 푸른사진첩(pu-photos.html) 기기 안 0원 자동 판단(1·2·3 모두) 구현

## 배경
- 외부 유료 API 연결이나 마스킹 전 서류 원본의 제3자 전송 없이, `Jev`(구조화 `Choice`·확률 보정·판단 보류) 철학을 브라우저 기기 안(`Canvas` 픽셀 분석 + 내부 일정·업체 맥락 결합)에서 **0원**으로 수행하는 3대 자동 판단 기능 요청(`1·2·3 모두`).

## 한 일
1. **기기 안 자동 판단 엔진(`js/pu-photo-judge.js`) 신설**:
   - **① 사진 종류 자동 분류 (`classify`)**: 종이 비율·책상 위 명함 섬 대비(`islandPaper`·`islandLum`)·글자 획 밀도·색채 채도·종횡비를 소프트맥스 확률(`%`)로 보정해 `명함(card)` / `서류·문서(doc)` / `현장·회의 사진(scene)` / `구분 보류(unsure, <54%)`로 분류. 카카오톡 공유 받기·카메라 검토 시 현장 사진만 들어오면 구글 AI OCR 한도를 소모하지 않도록 선제 분류.
   - **② 품질 · 연사(`★ 베스트 컷`) 선별 (`assessQuality` · `dhash` · `groupBursts`)**: 상위 10% 라플라시안 경계 에너지 기반 선명도(`0~100점`, 흰 여백 면적 왜곡 방지), 어두움·빛반사 판정, `9×8` 64비트 지각 해시(`dHash`) 해밍 거리 기반 성형(닻 기준 직접 비교) 연사 묶기로 전이적 오병합(`A~B·B~C → A~C`) 및 대량 사진 `O(n²)` 비용 차단. 증빙(`meta.used.at`) 사진 및 다중 페이지 묶음 문서(`meta.doc.group`) 보호.
   - **③ 고객사 · 일정 · 폴더 자동 매칭 (`recommendTargets`)**: 촬영일(`takenAt`) 정부사업·컨설팅 방문 일정(`scal_scheds`·`scal_cos`), 판독/입력 상호·사업자번호(`bizNo`)·메모, ERP 업체 명부, 내 폴더를 대조해 사업장 연결·폴더 담기·동행 담당자 공유를 확률(`%`) 및 근거와 함께 추천. 동명 별개 사업장 오공유 차단 및 민감 서류(`contract`·`payslip`·`idcard` 등) 자동 공유 제외.
2. **저장 층(`js/pu-photo-store.js`, `?v=38` 동기화)**:
   - 화면(`pu-photos.html`)이 다른 앱의 DB 루트를 직접 읽지 않도록 읽기 전용 `loadMatchContext` 추가 및 로그인·로그아웃(`signIn`·`clearIdentity`) 세대 검증·캐시 초기화.
3. **푸른사진첩 화면 통합 및 보안·접근성 강화(`pu-photos.html`)**:
   - PC 왼쪽 대시보드(`#judgeBtn`), 폰 사진 작업 시트(`#phJudgeBtn`), 일괄 자동 판단 모달(`#judgeModal`), 사진 크게 보기 판독 칸(`#judgeInlineBox`), 촬영 직후 흔들림 경고(`#camOkNote`), 촬영 검토(`#camRevJudge`·`.jtag`), 공유 받기(`shareSave`) 연동 및 `PuBack` 뒤로가기·모달 포커스 트랩(`Tab`)·`aria-live="polite"`·말줄임 `title`·`:focus-visible` 적용.
   - 일괄·개별 사업장 연결 시 합집합이나 `autoShareByCo` 우회 폴백 없이 **사진별 추천 담당자(`rowShareUids`)만 개별 적용**하고 사용자 `confirm` 확인·버튼 중복 클릭 잠금을 거치며, 민감 서류 10종(`SENSITIVE_KINDS` 동기화) 및 `read.rrn` 포함 사진은 자동 공유에서 완전 제외. 썸네일 주소는 `judgeSafeImgSrc` 정규식 검증과 `esc()` 이중 이스케이프로 속성 이탈 XSS를 차단하고 `openViewer` 인자는 `data-vid` 속성으로 전달. 저장소 표준 5계열 27색 팔레트(`color-palette-apps.test.js`) 준수, 로그아웃/계정 전환 시 화면 캐시·모달 상태 즉시 초기화, 미리보기 없는 사진 실패 안내 처리.

## 검증
- 단위·규칙·공통 가드 검사 통과:
  - `node tests/test-pin-guard.test.js` (`10 통과 / 0 실패`)
  - `node tests/shared-js-cache-version.test.js` (`3 통과 / 0 실패`)
  - `node --test tests/color-palette-apps.test.js tests/photos-auto-judge.test.js` 및 `tests/*photo*.test.js`, `tests/ocr-fix-and-contract.test.js`, `tests/windows-checkout.test.js`, `tests/phone-screen-rules.test.js`, `tests/one-line-cells.test.js`, `tests/back-button.test.js` 전체 통과
- 고장넣기(Mutation Testing) 4건(`cardIsland` 무력화 · 증빙 `used` 보호 누락 · 촬영일 일정 매칭 누락 · 휴지통 `confirm` 생략) 모두 실패 포착 후 원복 시 통과 확인
- 헤드리스 Chrome 실측(`tools/phone-audit/measure.js`) PC(`1366×840`) · 폰(`375×812`) · 폰 큰 글씨(`360×800`, `1.25x`) 전 화면 `overflowX: 0`, `verticalN: 0`, `squeezedN: 0`, `wrapBtnN: 0` 및 콘솔 오류 `0` 확인
