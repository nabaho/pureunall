# 2026-11-11 — 의뢰인 업무 「괴롭힘·성희롱 조사」(pu-harass.html) 구축 및 푸른 메일·푸른이알피 자동 연동

## 한 일
1. **포털 「의뢰인 업무」 전용 독립 프로그램(`pu-harass.html` · `js/pu-harass-core.js` · `js/pu-harass-view.js`) 구축**:
   - `enter.html` 및 `js/pu-appbar.js`의 `APPS`(`row: 'client'`)에 **`🛡️ 괴롭힘·성희롱 조사`**(`key: 'harass'`, `url: 'pu-harass.html'`)를 등록하고, `js/pu-ontology.js`에 소유 저장뿌리(`harass_invest`, `harass_secret`), 쓰기 계약 5건, 읽기 어댑터(`harass_core`)를 등록.
   - 27색 공용 팔레트만 사용(예외 0개, WCAG AA 4.5:1 이상 명암 대비 준수), PC 한 칸 한 줄 표 + 모바일(360~768px) 옆넘침 0 두 줄 카드 전환, 모든 표 왼쪽 `☐ + 번호` 및 일괄 실행 바, 모달 초점 가두기(Focus Trap)·`Escape` 닫기, A4 인쇄 레이아웃 지원.
2. **푸른 메일(`mailbox/folders` · `mailbox/msgs` · `searchMailbox`) 사건별 공문·서류 자동 수집 및 정리**:
   - 8단계 표준 조사 프로토콜(① 상담·수임 → ② 조사계획·착수공문 → ③ 비밀유지·보호조치 → ④ 신고인 면담 → ⑤ 피신고인 면담 → ⑥ 참고인·증거 → ⑦ 법리검토 → ⑧ 보고·종결)에 따라 메일 제목·첨부파일명을 자동 분류해 사건별로 귀속하고 단계 완료일을 복원(사람이 직접 수정한 `manual: true` 단계는 보존).
   - 동일 사업장에 동시 진행 사건이 여러 건일 때는 고유 사건명·사건번호 키워드로 분리하고, 모호한 공통 공문은 중복 귀속하지 않고 상세 화면에 수동 연결 후보로 안내.
   - 아직 이알피에 없는 조사 메일은 의뢰처별 후보 묶음(Bundle)으로 그룹화하여 검토 후 원클릭(또는 체크박스 일괄) 등록·제외할 수 있게 구성하고, 비활성 `DOMParser` 기반 안전 본문 열람(`peek: 1`) 및 `readMailAttachment` 메모리 내 첨부 내려받기 지원.
3. **진술 정리 · 근로기준법 제76조의2 3요건 검토 · 표준 조사결과보고서 자동 조립 및 비밀유지·권한상승 차단**:
   - 근로기준법 제76조의3 제7항(비밀유지 의무)에 맞춰 사건 목록·8단계 진행현황·공문 머리글(`harass_invest`)은 재직 직원(`LOGIN`)이 열람 공유하되, 면담 진술 요약·쟁점별 사실인정 및 3요건 검토·조사결과보고서 본문(`harass_secret`)은 **사건 주·부담당 노무사(`managerMain` / `managerSubs`) 및 대표(`ADMIN`)만** 열람·저장하도록 화면과 실시간DB 보안규칙(`scripts/make-firebase-rules.js`) 양쪽에서 분리하고 콘솔 배포 완료.
   - 비담당 직원이 `harass_invest/cases/$id`의 담당자 필드를 덮어써 비밀금고 권한을 탈취하거나 `erp_sync/$id`·`erp_ack/$id`(`syncedRevision` 일치 강제 포함)를 위조하지 못하도록 보안규칙(`HARASS_CASE_WRITE`, `HARASS_SYNC_OWNER`, `managerMain`·`managerSubs` 사번 형식 검증)을 강화하고, `SESSION_EPOCH`·`MODAL_SEQ` 검사 및 `purgeSessionState()`로 로그아웃·계정 전환·모달 교체 시 비동기 지연 응답을 포함한 메모리 캐시와 민감 DOM을 즉시 폐기.
   - `applyCaseMutation`·`diffCaseModalFields`와 비밀금고 항목별 병합으로 서버 최신 스냅샷(`prev`) 기준 변경 필드·단계·진술·쟁점 단위 동시 편집 유실을 막고, 8단계(`report`) 취소 시 종결일(`closeDate`) 자동 초기화 및 보고서 조립·저장·미저장 인쇄·복사·내보내기 전 경로에 하이픈 유무 무관 13자리 주민등록번호 자동 가림(`maskRrnText`) 적용.
4. **푸른이알피(`pu-erp.html`) 진행 과정 전체 자동 연동**:
   - `pu-erp.html`에 `erpHarassInvestSync`를 연결해 `harass_invest/cases` 원장 기준으로 정규 페이로드를 검증·산출하고(`ack.erpCaseId` 오신뢰 배제), 신규 `case-investigate` 자동 채번·생성 및 기존 조사 사건의 진행상태(`pending`/`progress`/`judgment`/`closed`), 기한·종결일 초기화 포함 일정, 진행 요약(`harassSummary`·`brief`), 비고 자동연동 블록(수기 비고 보존 병합), 단계·공문 타임라인 업무 메모(`case_memos` 결정적 키 `cm-hi-...`)를 멱등 반영한 뒤 `erp_ack` 수신 확인을 남김.
   - 푸른이알피 `CaseDetailModal`에 조사 사건 8단계 진행 배지 섹션 및 `🛡️ 조사실·보고서 열기 ›` 바로가기 추가.

## 검증
- `node scripts/check-cache-version.js --all` 통과
- `node scripts/rules-deploy.js --deploy` 실시간DB 보안규칙 콘솔 배포 및 재독 대조 통과
- `node --test tests/harass-invest.test.js` 외 가드레일 테스트 150개 항목 전량 통과
- `node tools/phone-audit/run.mjs harass --widths=360,375,411,768` 4개 화면 × 4개 폭 전체 `옆넘침 0 · 화면밖 0 · 작은입력 0` 통과
