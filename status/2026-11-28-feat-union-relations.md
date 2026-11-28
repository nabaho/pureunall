# 노사관계·단체교섭 전용 프로그램(`pu-union.html`, `unionrel`) 구축 완료

- **일자**: 2026-11-28
- **브랜치**: `feat/union-relations` (`c:\...\pureunall-wt-union-relations` 격리 워크트리)
- **대상**: 포털 `[의뢰인 업무]` › `🗣️ 노사관계·단체교섭` (`pu-union.html`)

## 1. 구현 요약
1. **핵심 엔진 (`js/pu-union-core.js`)**
   - 5개 노사트랙(`bargain`, `wage`, `single_ch`, `dispute`, `council`), 8단계 표준 교섭 절차, 4개 수행유형, 4개 진행상태, 4대 서류군(`progress`, `review`, `signed`, `evidence`) × 14개 세부 서류유형(`DOC_ROLES`) 정의.
   - `flattenMailbox` / `scanAndGroupUnionMails`: IMAP(`mailbox/folders`, `mailbox/msgs`), POP3(`mailbox/old/msgs`), 서버 심층검색(`searchMailbox`)을 통합 스캔해 사업장×연도별 자동 분류. 일반 컨설팅 메일에 자주 붙는 `통합진단 인터뷰 양식_노동조합 및 근로자대표` 첨부 오탐을 자동 배제하고 파일명 우선 서류 역할 판정.
   - 법정기일 계산기(`calcChannelTimeline` 창구단일화 7/5/14일, `calcDisputeTimeline` 일반 10일·공익 15일 D-Day) 및 임금협상 원가·간접인건비 시뮬레이터(`simulateWageImpact`).
   - PII·계좌·이메일·로컬경로 비식별 가림(`maskPiiStrict`, `hasResidualPii`, 사건번호 예외 보존) 및 CSV 수식 인젝션 방어(`csvSafeCell`).
2. **문서·출력 엔진 (`js/pu-union-hwpx.js`)**
   - 4종 한글 문서(`channel_demand`, `channel_confirm`, `review_report`, `yearly_summary`) `.hwpx` 바이트 생성(`PureunHwpx.buildHwpx`), 푸른한글(`hangul.html?from=unionrel`) 브리지, CSV 내보내기, A4 웹 인쇄.
   - `.hwpx`/`.docx` (`PureunZip.readZip` 비동기 해제) 및 `.hwp`/`.pdf` (`PuKordocText.read`) 텍스트 추출 및 비식별 마스킹.
3. **5개 대시보드 워크스페이스 (`pu-union.html`, `js/pu-union-view.js`)**
   - `종합·연도별 대시보드`: 트랙 필터, 1줄 KPI 배지, 연도별 알약/분포, 헤더 정렬·멀티필터 팝오버, 일괄 상태 변경·삭제.
   - `사업장 절차·진행`: 동일 사업장 연도 전환 알약, 8단계 수기/자동 토글, 법정기일 계산기, 교섭 회차 진행일지.
   - `이메일 전수 수집`: 미등록 사업장×연도 후보 묶음 1클릭/일괄 편입·제외, 비파괴(`peek:1`) 메일·첨부 실시간 열람.
   - `서류·검토서류 자료함`: 4대 서류군별 필터, 수기 등록, File System Access API 기반 로컬 교섭폴더 파일명 비식별 연결.
   - `단협·임협 신구대비 검토실`: 현행 vs 노조안 vs 사측안 3단 대비표, 임금협상 원가 시뮬레이터, HWPX/CSV/인쇄 출력.
   - 27색 팔레트·모바일 `16px` 입력·1줄 테이블 셀·`PuOntologyWrite` 강제(`enforce`) 관문 적용.
4. **포털·온톨로지·챗봇·프록시·규칙 연동**
   - `enter.html`, `js/pu-appbar.js`, `js/pu-ontology.js`, `js/pu-chatbot-kb.js`, `functions/doc-read.js`, `scripts/make-firebase-rules.js`(`rules.union_rel`), `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json` 동기화 및 HTML 캐시 버전(`pu-ontology.js?v=112`, `pu-appbar.js?v=56`, `pu-chatbot-kb.js?v=20`) 일치.

## 2. 실측 백필 및 보안규칙 처리 현황
- **`scripts/backfill-union-history.js` 실행 결과 (`--apply` → `--audit`)**:
  - 스캔 대상: 푸른 메일함 31,826통(노사교섭 분류 307통) + 로컬 교섭폴더 파일 메타 323건
  - `/union_rel` 적재(`PuOntologyWrite` enforce + ETag `If-Match`): 사건 `217`건, 서류 `408`건(진행 311·검토 67·체결 8·증빙 22), 수집 메일 `307`건 (`skipped: 0`)
  - `--audit` 검증: `ok: true`, `leakCount: 0` (실명·PII·로컬경로 누출 0건)
- **RTDB 보안규칙 자동 배포(`scripts/rules-deploy.js`) 보류 사유**:
  - 리베이스 전 미리보기에서는 19개(`gone: 19`), `origin/main` 리베이스(`2de42b0a8`) 후 미리보기에서는 타 미병합 작업 규칙 1개(`/govlinks`, `gone: 1`)가 라이브 콘솔에 존재해 `rules-deploy.js` 안전 장치가 배포를 중단함(exit 2).
  - 타 PR 미병합 규칙을 임의로 삭제하거나 본 PR에 섞지 않기 위해 `rules-deploy.js --deploy`는 보류하고 본 PR에는 `rules.union_rel`만 포함.

## 3. 검증 및 Orca 2단계 점검
- **Orca 2단계 파이프라인 (`ow-fix-20261128-170107-r77WiC`)**:
  - 1단계(Gemini): `saveEntity`/`softDeleteEntity` 트랜잭션 `fbDb.ref` 수정, 포털 아이콘 중복 해소(`🤝` → `🗣️`), 검색창 포커스 유지, 시뮬레이터 0%·사건번호 마스킹 보완 등 10개 파일 수정.
  - 2단계(Claude): 중간 5건(`saveEntity` `expectedRevision` & `patch` 동시수정 보호, 클릭 핸들러 `try/catch`, 일괄/삭제 `confirm`, `_deleted` 사건 서류 제외, 화면 저장 첨부명 `scrubField` 가림) + `PuKordocText.read` 연동 등 추가 보완 후 재검증 통과.
- **리베이스(`origin/main` `2de42b0a8`) 후 최종 회귀 테스트**: `union-relations`, `app-icons`, `ontology-contract`, `ontology-registry`, `ontology-write-gate`, `color-palette-apps`, `phone-screen-rules`, `phone-input-zoom`, `one-line-cells`, `no-hardcoded-old-erp-url`, `anti-resurrection-guards`, `read-fence-apps`, `portal-chatbot`, `firebase-rules-apply`, `perf-rules`, `test-pin-guard`, `ai-proxy-doc`, `portal-pbar-fit`, `appbar-coverage`, `appbar-every-link`(총 294건 ALL PASS), `check-cache-version.js --all` PASS, `tools/phone-audit/run.mjs unionrel` 10개 뷰 모두 옆넘침 0·화면밖 0 PASS.
