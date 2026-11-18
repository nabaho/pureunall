# 2026-11-18 `feat/erp-contract-review-guard` — 푸른메일함 09~18시 2시간 주기 전체(받은·내게쓴·보낸·보관·업무함) 자동 검토 및 계약관리 중복·해지·진행확인 안전장치

## 배경 및 원인
1. **내게쓴메일함(`tome`) 및 백그라운드 자동 수집 사각지대**:
   - 기존 `watchSentMail`은 보낸메일함(`sent`) 견적서만 단순 감시했고, `pullMailContracts`는 직원이 `pu-photos.html`을 직접 열었을 때만 동작했으며 `내게쓴메일함`(`tome`, `내게쓴편지함-*`)과 `보관메일함`(`archive`)을 조회 대상에서 빠뜨렸다.
   - 그 결과 내게쓴메일함에 보관된 위임약정서·계약서나 받은메일·보낸메일·업무메일함의 계약서·견적서가 정해진 시간마다 자동으로 `계약관리`에 모이지 못했고, 미연결 신규 거래처 요청(`deferLink` 누락)이나 담당자 미지정 요청이 `걸린 요청(blocked)`으로 쌓였다.
2. **계약관리 중복·기이관·해지·기존자문 오탐**:
   - `genContractNo`가 동일 루프 연속 호출 시 직전 채번 번호를 반영하지 못해 계약번호가 중복 채번됨.
   - `srcMails`의 객체 형식(`{ folder: "Sent", msgId: "176075" }`)과 문자열 형식(`Sent Messages-xxxx|176075`, `Sent:176075`)이 정규화되지 않아 동일 메일이 중복 등록됨.
   - 자문계약 해지 통보 메일에 첨부된 과거 계약서, 이미 `컨설팅관리`·`사건관리`·`기타사업`으로 이관된 건, `업체관리`에서 매월 고정입금·세금계산서가 발행 중인 기존 활성 자문 사업장 갱신 서류, 상시 자문사의 인사 서식(`수습평가기간 연장합의서`, 근로계약서 양식 검토 요청 등)이 신규 수임 계약으로 오탐됨.

## 변경 내용
- `functions/mail-contract-sweep.js` & `functions/index.js`:
  - 매일 **09:00, 11:00, 13:00, 15:00, 17:00, 18:00 (`0 9,11,13,15,17,18 * * *`, `Asia/Seoul`)** 에 자동 실행되는 `exports.mailContractSweep` 및 즉시 실행용 `exports.runMailContractSweep` 추가.
  - `받은메일함`(`inbox`), `내게쓴메일함`(`tome` + 자기발신 메일), `보낸메일함`(`sent`), `보관메일함`(`archive`), `업무메일함`(`custom`) 전체를 스캔하여 견적서(`quote`)와 계약서·위임약정서(`contract`)를 감지하고, 읽기 전용 IMAP(`openBox(..., true)`)으로 PDF·이미지·HWPX 첨부를 읽어(`pdfjs-dist` + HWPX XML + `GEMINI_KEY` 기반 AI 판독, 월 예산 한도 준수) `data/contract_requests`에 정합성 있게 적재.
  - 실행 상태 및 통계를 `data/app_config/mailContractSweep`, 처리 완료 키를 `data/app_config/mailContractSweepSeen`에 기록해 재실행 멱등성 보장.
- `js/pu-quote-detect.js` (`functions/quote-detect-core/pu-quote-detect.js` 동기화):
  - 근로자용 인사 서식(`수습평가기간 연장합의서`, 단시간·기간제·일용 근로계약서), 양식 검토 요청, 일반 상거래 도급·임대차·통신 재약정 등을 수임 계약·견적 감지에서 제외.
- `js/pu-doc-file.js`:
  - `canonSrcMailKey` 도입으로 폴더 슬러그·한글명·객체/문자열 `srcMails` 키 통일.
  - `extractCoFromSubj` 개선(선행 상호 패턴 `가나다수산_위임약정서(...)` 및 다중 밑줄 파일명에서 일반 업무명 배제).
  - `tome`·`archive` 메일함 포함 및 신규 미등록 거래처 견적 요청 시 `deferLink: true` 부여.
- `pu-erp.html`:
  - `계약관리` 상단 도구막대(및 모바일 `⋯ 더보기`)에 `[📬 메일검토]` 즉시 실행 단추와 자동검토 상태 배지 연결.
  - `genContractNo` 단조 증가 시퀀스 가드, `dir === 'tome'` 처리, 해지·종결(`closed`)·기이관·기존 활성 자문 사업장 중복 차단 추가.
  - 진행 여부가 불명확한 건에 대해 담당자가 확인할 수 있는 `❓ 진행확인`(`checkReq` 배지·필터·원클릭 처리 창) 구현.
- `functions/mail-contract-sweep.test.js` & `tests/erp-contract-review-guard.test.js`:
  - 내게쓴메일함 위임약정서·보낸메일 견적서·받은메일 서명 계약서 수집, 중복/해지 차단, `checkReq` 표시 회귀 검사 추가.
