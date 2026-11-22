# 2026-11-18 — 포털 29개 프로그램 통합 업무 오케스트레이션 구축 및 다중 검증 완료 (`feat/portal-orchestration`)

## 변경 요약
- **순수 오케스트레이션 엔진 (`js/pu-orchestrator-core.js`)**:
  - 포털 전체 앱(의뢰인 업무·자료함·영업관리·내부관리 + 머리줄 캘린더)을 5대 생애주기(`① 유입·계약` ➔ `② 사건·조사·규정` ➔ `③ 컨설팅·기금·지원금` ➔ `④ 주간업무·급여` ➔ `⑤ 입금·정산·환류`)로 연결.
  - 온톨로지 불변 규칙(`sourceMutation: 'never'`, `READ_ADAPTERS`의 모든 `in_app` 민감 본문·하위 경로 완전 비수집, `companyId` · 고유번호 5자리 몸통 · 사업자번호 10자리 확정 연결 vs 상호명 추정 분리, 사번·이메일·카드번호·계좌번호·국제/지역번호 비노출, 권한별 `fin`·`settle`·`career` 분리) 준수.
  - 자동 검토 3회 결과 전수 반영: 긴급도 정렬(`urgent:0` 우선), 장기 미종결 사건 기한 포함, 이관(`transferred`) 제외, `pu_sign/open` 및 `harass_invest` 등 `in_app` 경로 완전 제거, `Object.create(null)` 및 위험 레코드 ID(`__proto__`·`constructor`) 정제, 바통 필수 계정 바인딩(`uidTag` + `expiresAt <= at + TTL`) 및 1회 수신 즉시 소거, URL 쿼리 내 상호명 비포함 적용.
- **업무 오케스트레이션 전용 지휘 화면 (`pu-orchestrator.html`, `js/pu-orchestrator-view.js`)**:
  - `⚡ 실행 바통 대기열`, `🏢 사업장 360° 흐름판`, `🗺️ 연결망 · 표준 런북 8선`, `🔗 연결 무결성 진단` 4대 탭 및 우측 상세 서랍 제공.
  - WAI-ARIA 탭 방향키·`Home`·`End` 이동, 재렌더링 포커스 복원, 100건 페이지 분할(`+ 더 보기`), `SEL` `Object.create(null)` 적용, 계정 전환·잠금 첫머리에서 `ME`·카운터·검색어·DOM 즉시 소거 및 잠금 화면 내 로그아웃 단추 제공, `status === 'active'` 엄격 검증, `PuAppBar.goApp` 표준 창 이름 재사용.
- **검증 결과**:
  - 기능·UI 자동 검토(`antigravity:gemini-4-argon-high`): **통과 (높음 0, 중간 0, 낮음 0)**.
  - 보안 자동 검토(`antigravity:claude-opus-5-5-high`): 1·2·3차에서 발견된 `pu_sign/open`, `in_app` 하위 경로(`harass_invest/erp_sync`), 바통 1회 소거, 확장 마스킹, 계정 전환 초기화 항목 전수 반영 및 동적 회귀 테스트(`tests/portal-orchestrator.test.js`) 고정 완료.
