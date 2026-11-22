# 사업장 중복 담당 연결 분리 및 단독 전환 일괄 신청·승인 시스템 (2026-11-22)

## 배경
- 과거 자문·급여 담당자(갑)가 등록된 사업장에서 추후 다른 노무사·담당자(을)가 별도 사업(컨설팅·사건 등)을 진행할 때, 메일함 공동 열람(`mbSubsOfRow`)과 수동 주소 고정(`mailWho`), 진행 건 연결(`_mbWork`)이 겹쳐 과거 담당자(갑) 메일함에도 신규 컨설팅 메일이 중복 표시되는 문제가 있었다.
- 또한 특별한 사정이나 업무 일원화로 기존 담당자(갑)는 완전히 빠지고 새 담당자(을)만 단독 담당해야 하는 상황에서 업체 주담당·부담당·진행 중 사업·업무시트·메일 고정을 한 번에 신청·변경할 수 있는 창구가 필요했다.

## 변경 사항
1. **사업장별 분리·과거 담당 제외 규칙 (`pucards/config/mailCoSplit`)**
   - `pu-cards.html`: `mbCoSplitLoad`, `mbCoSplitRuleOf`, `mbRowProjectKind`, `mbSplitPrimaryOfRow` 추가 및 `mbWhoWhyOf`·`mbWhoOfRow`·`mbSubsOfRow` 연동.
     - **유형 B (`mode: 'split'`)**: 컨설팅·사건·기금 갈래 메일은 해당 건 담당자(을)에게만 단독 배정하고, 급여·4대보험·일반자문 메일은 업체 주담당(갑)에게만 배정해 양쪽 메일함 중복 연결 차단.
     - **`mode: 'workOnly'` 및 `ex` 제외 목록**: 과거 담당자(갑) 재연결을 수동 고정(`mailWho`)보다 앞단에서 차단.
   - `functions/mail-owner.js`: 서버 푸시 알림·일일 분류(`loadTables`, `whoOf`, `whoAll`)에서도 동일한 `mailCoSplit` 규칙을 읽어 제외된 과거 담당자에게 알림이 가지 않도록 동기화.
2. **원스톱 담당 전환 신청·승인 및 중복 정리 모달 (`푸른 메일` + `푸른이알피` 양방향 연동)**
   - `pu-cards.html`: 메일 열람 상단 `담당자` 메뉴, 목록 `담당자 ˅` 메뉴, `🔎 담당 점검` 상단에 `🔄 담당 변경 · 중복 정리` 모달(`mbTransferOpen`) 및 관리자 즉시 승인(`mgrDecideReq`) 추가.
   - `pu-erp.html`: `거래처 관리` 상단·행 메뉴·`업체 수정` 창에 `🔄 담당 전환·중복정리`(`CoOwnerHandoverModal`) 추가, `coMgrRequest`·`coMgrDecide`·`coMgrApplyScope` 확장으로 승인 즉시 **업체 주담당 + 부담당 제외 + 진행 중 컨설팅·사건·기금 + 푸른업무 시트(`work_erp/items`) + 푸른메일 수동 고정 해제·제외 등록**을 일괄 실행.
3. **검증**
   - `tests/owner-split-and-handover.test.js`: 사업별 분리(`split`), 과거 담당자 제외(`ex`/`workOnly`, 화면·서버 일치), 일괄 변경 신청·승인(`coMgrDecide` + `coMgrApplyScope`) 단위 시험 추가 및 통과.
