# 2026-11-11 — 푸른이알피(pu-erp.html) 중복 훑기 컨설팅·기금·기타사업 확장 및 복제 판정 보강

## 한 일
1. **중복 훑기(`DUP_SWEEP_KINDS` · `dupSweepScan`) 대상 확장 및 단일 `typeCode` 판독 보정**:
   - 종전에 계약·사건·일반업무 3곳만 훑어 컨설팅·기금·기타사업 본 표의 중복 행이 빠지던 점을 고쳐 `consultings`·`funds`·`other_projects`를 `DUP_SWEEP_KINDS`에 추가.
   - 사건·컨설팅·기금·기타사업 본 표는 `kinds` 배열 없이 단일 `typeCode` 칸만 쓰므로 `dupSweepFacets`가 단일 `typeCode`와 세부 유형 이름표를 온전히 읽도록 보강하고, 컨설팅의 성과추적관리(`perfTrack`) 트랙은 현장클리닉일 때만 다른 코드(`|perf`)로 갈라 헛경고를 막음(비배열 `kinds` 방어 포함).
2. **복귀 복제본·동일 대상 이중 이관 계약 감지(`cloneDup`) 및 경계값 방어**:
   - 같은 관리번호(`dupSweepNoOf`, 앞뒤 공백 정리)가 둘 이상 살아 있거나 같은 세부 이관 대상(`transferredTo`의 `갈래:관리번호`, 빈 대상 번호 제외)을 가리키는 복제 계약은 이관완료(`transferred`) 상태여도 재계약(`again`)에 묻히지 않고 진짜 중복(`dup`, `번호·이관대상 중복`)으로 드러나게 보강.
   - 관리번호·이관대상 색인에 `Object.create(null)`을 사용해 프로토타입 속성 이름(`toString`·`constructor`·`__proto__`)에 의한 오판·누락을 원천 차단.
3. **사건·컨설팅·기금·기타사업 툴바(PC·모바일) `🔎 중복 훑기` 단추, 대화상자 접근성 및 정합성 검사 보강**:
   - `ContractManagement`·`CaseManagement`·`ProjectManagementShared`의 PC 및 모바일 툴바에 읽기 전용 중복 훑기 진입 단추와 `DupSweepModal`을 연결하고, 전체 중복 훑기 창에서 `열기`를 누르면 `ERP_OPEN_REC`를 통해 대상 화면의 상세 창이 곧바로 열리도록 연결.
   - `DupSweepModal`에 `useEscClose`·`data-close`·`role="dialog"`·`aria-modal="true"`·`aria-pressed`를 갖추고 흰 바탕 보조 글자색을 `#64748b`(AA 명암비 충족)로 보강.
   - 환경설정 정합성 검사에 `consultings`·`funds`·`other_projects` 중복 ID 검사와 계약·사건·컨설팅·기금·기타사업 활성 행의 관리번호 중복 경고를 추가.

## 검증
- `node --test tests/dup-sweep.test.js` 통과
- `node --test tests/test-pin-guard.test.js tests/color-palette-apps.test.js tests/one-line-cells.test.js tests/phone-screen-rules.test.js tests/erp-open-rec-from-mail.test.js tests/clinic-perf-track.test.js` 통과
- `node --test tests/*.test.js` 전체 통과
