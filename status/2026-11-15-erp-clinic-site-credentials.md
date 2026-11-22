# 2026-11-15 푸른이알피 현장클리닉·사업장 포털 아이디/비번 분리 저장 및 보기 클릭 열람

## 배경 및 목표
- 사업장에서 직접 신청하지 않고 법인에 클리닉을 요청하면서 메일·첨부파일로 전달한 비즈니스지원단(현장클리닉) 계정 정보를 전수 발굴해 푸른이알피(컨설팅관리·계약관리·업체관리·종료관리)에 반영한다.
- 공개 원장(`data/*`)은 재직 근로자 전체가 읽으므로, 실제 비밀번호(`sitePw`)는 별도 금고(`site_secret/{표}/{건 id}/sitePw`)로 분리해 **해당 건의 담당자(주담당·부담당) 및 총괄관리자**만 서버 규칙에서 읽고 쓸 수 있게 한다.
- 담당자·관리자 화면에서도 비밀번호는 기본 숨김(`••••••••` / `password` 칸) 처리하고, **[보기]** 단추를 클릭했을 때만 열람하며 다시 **[숨기기]**로 가릴 수 있게 한다.

## 주요 변경
- `js/pu-site-secret.js`: `split`, `splitPatch`, `updatePaths`, `read`, `write`, `carry`, `canAccess` 구현 및 미편집 빈칸 저장 시 기존 비번 증발을 막는 `_sitePwDirty` 안전장치 도입.
- `scripts/make-firebase-rules.js` · `js/pu-ontology.js` · `tests/perf-rules.test.js`: `site_secret` 최상위 규칙(`cases`, `contracts`, `consultings`, `funds`, `other_projects`, `companies`) 및 온톨로지 소유권 등록.
- `pu-erp.html`:
  - `dbSet`, `dbUpsert`, `dbPatch`, `dbUpsertMany`, 계약 이관·복귀(`transferContract` · `returnToContract`), 백업 복원(`applyBackupData`), 계약 임시저장에 `PuSiteSecret` 분리·승계 연동.
  - 상세 화면(`UnifiedDetailModal`, `CompanyDetailModal`, `ClosedManagement`)에 `SiteAccountCard`(기본 `••••••••` 마스킹 + `[보기]`/`[숨기기]` 토글) 적용.
  - 수정 화면(`ProjectEditModal`, `ContractModal`, `CompanyEditModal`)에 `SiteAccountPwBox`(기본 `type="password"` + `[보기]` 클릭 시 서버 조회·표시) 적용 및 담당자·관리자 권한 확대.
- `tests/erp-site-secret.test.js`: 가상 픽스처 기반 분리·보존·권한·보안규칙·화면 연동 자동 검증 추가.

## 실서버 마이그레이션 및 보안 검토 반영
- 실서버 RTDB 보안규칙(`site_secret`) 선배포 후, 기존 원장(`data/*`)에 평문으로 남아 있던 `sitePw` 전량과 메일함(2021~2026)에서 검증된 현장클리닉·비즈니스지원단 계정을 칸 경로 원자적 업데이트로 반영·이전 완료(`data/*` 내 평문 `sitePw` 잔존 `0건`).
- `scripts/erp-integrity-audit.js --before/--after` 대조 결과 `violationCount: 0` 확인(종결·삭제·관리번호 불변성 준수).
- Orca 보안 검토 권고 반영:
  - `[숨기기]` 클릭 시 메모리 평문 상태 및 캐시(`clearCache`) 즉시 비움, `_cache` 외부 노출 제거.
  - `dbSet` 경유 시에도 `sitePw`가 실려 있으면 `site_secret`으로 함께 전송해 유실 방지.
  - `erpFindLinkedContract`의 사업자번호·업체 ID 보조 연결은 후보 계약이 정확히 1건일 때만 허용해 다중 계약 오연결 차단.
  - 입력 단계 `maxLength=120` 및 `split`·`splitPatch` 지우기 조건 일원화.
  - 참고 한계: 선례(`worker_secret`)와 동일하게 `data/*`의 담당자 배정 변경 권한은 재직 근로자 업무 흐름상 열려 있으며(`mgrHistory`·`AuditLog` 기록), 담당자 변경 통제가 필요할 경우 원장 담당자 불변 규칙을 별도 단계로 검토한다.
