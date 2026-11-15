상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-15 · 🛡️ 괴롭힘·성희롱 조사(pu-harass) 전 단계 법정 절차 · 14종 공식 서식(.hwpx) · 비식별 익명본 · 호증 편철 · 확장 E2EE 전자서명 · 통합시스템 양방향 연동 완성 (대표 「전체 차례대로」)

가지: `feat/harass-complete-suite`

## 한 것 (1순위 → 2순위 → 3순위 전수 구현)

### 1. [1순위] 법정 요건 동적 분기 · 공식 서식 14종(.hwpx) · 실명원본/비식별익명본 이중 출력
- **사건·쟁점별 법정 요건 동적 분기 (`js/pu-harass-core.js` · `js/pu-harass-view.js` · `js/pu-harass-hwpx.js`)**:
  - `harass` (근로기준법 제76조의2 지위·관계 우위 / 업무상 적정범위 초과 / 고통·환경 악화), `sexual` (남녀고용평등법 제2조 제2호·제14조 지위·업무 관련성 / 성적 언동·성적 요구 / 성적 굴욕감·불이익), `third_party` (산업안전보건법 제41조·남녀고평법 제14조의2 고객 등 제3자 가해 요건), `both` (복합 사건 시 쟁점별 적용 법령 개별 지정·추론), `subcontract` (원·하청 도급 혼재 사업장 분리·협조 권고 자동 수록).
- **조사 전 과정 14종 법정 공문·실무 서식 정식 한글(`.hwpx`) 즉시 발급 (`OFFICIAL_DOC_TYPES` · `buildOfficialDocHwpx`)**:
  - ① 고충 신고서 및 기초 사실확인 설문지(`intake_form`)
  - ② 외부 조사위원 위촉장 및 공정조사(제척·기피·회피) 확인서(`committee_fairness`)
  - ③ 개인정보·민감정보 수집·이용 및 제3자 제공 동의서(`privacy_consent`)
  - ④ 조사계획서 및 기초자료 제출·협조 요청 공문(`plan_req`)
  - ⑤ 조사 참여자 비밀유지서약서(`pledge_form`)
  - ⑥ 당사자·참고인 조사 출석 및 면담 안내문(`attend_notice`)
  - ⑦ 피신고인 소명 안내 및 쟁점별 사전 서면질문지(`written_inquiry`)
  - ⑧ 관할 고용노동지청 조사결과 보고기한 연장 신청 공문(`labor_ext_req`)
  - ⑨ 피해근로자 보호 및 행위자 조치 사전 의견청취서(`victim_opinion_form` — 근기법 제76조의3 제4·5항 필수)
  - ⑩ 신고 취하 · 조사종료 동의 · 당사자 합의 확인서(`withdrawal_settle`)
  - ⑪ 당사자 교부용 조사결과 통지문 — 비공개 요약본(`party_result_notice`)
  - ⑫ 피해근로자 보호조치 및 사후 조치 권고 공문(`measure_rec`)
  - ⑬ 고용노동부 개선지도 자체(외부)조사 및 조치결과 보고서(`labor_result_rpt`)
  - ⑭ 인사(징계)위원회 출석통지 · 징계의결서 · 징계처분통지서 세트(`disciplinary_pack`)
- **실명 원본(`.hwpx`) + 비식별 익명본(`A·B·C`, `.hwpx`) 이중 출력 (`anonymizeReportPackage`)**:
  - 인사위원회·정보공개·당사자 열람 대응 시 당사자·참고인 실명(`신고인 A · 피신고인 B · 참고인 C`), 의뢰 사업장명(`의뢰 사업장(甲)`), 연락처(휴대·일반)·이메일·행정사건번호·감독관명·자필 서명 필적 이미지뿐 아니라 사전의견청취·종결합의·무기명설문 자유의견과 자동 조립 보고서 본문까지 전수 비식별 처리한 익명본 `.hwpx` 즉시 생성.

### 2. [2순위] 갑·을 호증 자동 편철·타임라인(`.hwpx`) · 확장 E2EE 전자서명 3종 · 노동청/사후모니터링/양정/재진정 비교
- **증거·호증 자동 편철 및 일자별 타임라인 대조표 (`renumberEvidences` · `extractEvidencesFromMails` · `buildEvidenceTimelineHwpx`)**:
  - 수집 공문·첨부파일 및 수기 등록 증거를 `갑 제N호증`(신고인 측) · `을 제N호증`(피신고인 측) · `참고자료 N`(회사·공문)으로 자동 채번하고, 일자별 양측 주장·객관적 증거 대조표 모달 및 단독 `.hwpx` 출력 지원.
- **확장 모바일 종단간 암호화(E2EE) 비밀 전자서명 (`js/pu-harass-sign.js` · `sign-harass.html` · `harvestCaseSignatures`)**:
  - 기존 비밀서약·진술확인 외에 **피해근로자 사전 의견청취(`victim_opinion`)**, **신고 취하·합의 종결 자유의사 확인(`withdrawal_consent`)**, **부서·조직문화 무기명 보안 실태조사 설문(`org_survey` — 7문항 자동 집계표)** 2채널 보안코드 서명·수거 지원.
- **노동청 감독관·연장기한 · 종결 후 사후 모니터링 · 징계양정 가이드 · 선행사건 재진정 비교**:
  - 관할 고용노동지청(`laborOffice`) · 근로감독관(`inspectorName`) · 행정 사건번호(`govCaseNo`) · 1·2차 연장기한(`extDue1`, `extDue2`, `effectiveDueDateOf`) 관리, 종결 후 1·3·6개월차 2차 가해·불이익 처우 점검(`monitoringLogs`), 비례원칙 징계 양정 참고 가이드(`DISCIPLINARY_GUIDE`, `suggestDisciplinaryLevel`), 선행 사건 대비 기조사 중복/신규 쟁점 비교(`buildRecomplaintComparison`).

### 3. [3순위] 푸른통합시스템 양방향 연동 & 녹취 스튜디오 음성 플레이어 · 화자 치환기
- **푸른 한글편집기 (`hangul.html` · `hangul/js/app.js`) 바로 열기 브리지**:
  - 조사결과보고서(실명본/익명본), 14종 공식 서식, 타임라인 대조표 `.hwpx`를 `localStorage` 디스크 평문 기록 없이 동일 출처 일회성 메모리 채널(`postMessage` / `BroadcastChannel`)로만 `hangul.html?from=harass` 에 인계하고 수신 확인(`pureun_hangul_ack`) 및 팝업 차단·로그아웃 즉시 메모리에서 소거.
- **기업규정집 (`rules-v2.html` / `rules_mgmt`) 취업규칙 조항 인용**:
  - 경량 색인(`rules_mgmt/index`) 대조 후 해당 사업장 개정본(`rules_mgmt/done/{siteKey}/{rev}`)만 필요한 시점에 읽어 괴롭힘·성희롱·징계 조항을 발췌 인용(미보유 사업장은 고용노동부 표준취업규칙 자동 제공).
- **녹취 스튜디오 로컬 오디오 플레이어 + STT 화자 일괄 치환기**:
  - 원본 음성 외부 서버 미전송 원칙을 지키며 브라우저 로컬 `<audio>` 배속(`0.75x~1.75x`)·구간 이동(`-5초/+5초`)·현재 시각 `[MM:SS] 문/답` 삽입기, 클로바노트·다글로 화자 라벨(`참석자 1` 등) 일괄 치환기, `.json` 세그먼트 및 `.srt`/`.vtt` 자막 정제 추출기 탑재.
- **2채널 휘발성 발송(`mailto:` / `sms:` / 공유시트) & 일정(`.ics` · `pu-cal.html`) · 계약(`docs-esign.html`) · 판례(`pu-pbox.html`) · 정산(`pu-settle.html`) 바로가기 연동**.

## 확인
- 캐시 버전 검사(`node scripts/check-cache-version.js --all`) 통과.
- 단위·보안·팔레트·한줄셀·폰규칙·사번가림·온톨로지 검사 12개 파일 **165건 전체 통과 (실패 0)**:
  - `tests/harass-invest.test.js` 19건 (기존 1~16 + 신규 17·18·19 — 14종 `.hwpx` 전수 왕복 추출 및 주민번호 마스킹, 익명본 실명·연락처·서명이미지 제거 검증, 갑·을 호증 편철 시 `'피신고인'`이 `'신고인'`에 오매칭되던 경계 조건 수정 확인, E2EE 사전의견청취 암복호화, 화자 치환 및 한글편집기 브리지·`.ics` 검증).
- 폰·태블릿·데스크톱 화면 전수 점검 (`node tools/phone-audit/run.mjs harass --widths=360,375,411,768,1366`): 25개 화면 모두 **옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은단추 0**.
- Headless Chromium 실제 브라우저 E2E 시나리오(공문 14종, `hangul.html` 브리지 수신 확인, 사후 모니터링, `.ics` 일정, 호증·타임라인 `.hwpx`, 동적 성희롱 요건, 화자 치환, E2EE 링크 발급, 무기명 설문 집계, `rules_mgmt` 취업규칙 인용, 징계양정, 재진정 비교, 실명/익명 `.hwpx` 내려받기) 통과.
