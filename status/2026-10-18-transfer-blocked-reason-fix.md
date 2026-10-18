상태: 완료

# 2026-10-18 · 계약 이관 막힘 팝업(#2593) — CI 빨강 둘을 고쳤다

대표 지시: #2593 을 고쳐서 합치게 하라. (main 을 merge 로 들였다 — 충돌 없음)

## 무엇이 왜 깨졌나
- `tests/ontology-intake.test.js` 「일부 이관 흔적이나 번호 단독 연결이 있으면 … 완료 처리하지 않는다」
  → `미검증 완료 확인창을 열면 안 됨`. 막힘 창(`erpXferBlockedPopup`)이 **고르는 창 `popConfirm`**(확인/닫기)을 썼다.
  번호만 남은 기록·일부 이관처럼 «확인 안 된» 상태에서 완료를 묻는 창과 같은 모양의 창을 연 것 —
  온톨로지 규칙(부분 이관·번호 단독 연결을 완료 근거로 삼지 않는다)을 어긴다. 알림 한 줄(「완료 처리…」)도 함께 사라졌다.
- `tests/no-real-client-data.test.js` 「사업자등록번호는 «123-» 으로 시작하는 예시뿐」
  → 새 검사 파일에 `111-…` 꼴 번호가 있었다.

## 고친 것
- `pu-erp.html` `erpXferBlockedPopup` — 창을 **알림창 `window.showAlert`(단추 하나, 돌려주는 값 없음)** 로 바꿨다.
  사유 알림 한 줄(`showToast`)도 다시 남긴다. 사유·푸는 길(`erpXferFixFor`)·막는 자리는 그대로.
- `tests/transfer-blocked-reason.test.js` — 가짜 사업자번호를 `123-` 꼴로. 규칙 검사 ⑥ 추가:
  막힘 창은 popConfirm 을 열지 않고, 값을 돌려주지 않으며, 알림 한 줄에도 사유가 남는다(옛 코드에서 빨강 확인).
- 가드(검사)는 하나도 약하게 바꾸지 않았다.

## 검사
- 관련: transfer-blocked-reason · ontology-intake · no-real-client-data · test-pin-guard 30/30.
- 전체 `node --test tests/*.test.js functions/*.test.js`: 통과 27,007 · 실패 0 · 취소 12
  (취소 12 는 `tests/rules-collect-stuck.test.js` — 이 컨테이너 Node 22 탓, main 도 같음. CI Node 24 는 초록).
