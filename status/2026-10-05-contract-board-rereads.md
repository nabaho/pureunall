# 2026-10-05 · 계약관리 칸반이 덜 받은 목록에 멈추던 것 (fix/contract-board-lost)

대표 신고: 「상담접수 없어진것 계약확정 사라진것 다시 살려라」 (계약관리 캡쳐 — 상담접수 0·계약확정 2·전체 36건).

## 실측 (지운 것 없음)
- 서버 data/contracts 167건: 상담접수 2 · 계약확정(signed) 6 · 진행 2 · 이관 143 · 종료 5 · 취소 7 · 삭제표시 2.
- 대표 PC 크롬 사본 169건 — 멀쩡. 새로 연 탭은 상담접수 2·계약확정 6·전체 169 로 다 나왔다.
- 캡쳐의 탭만 36건을 들고 있었다 → 화면 문제. 자료 손실 아님. 서버·사본 어디도 고치지 않았다.

## 원인
- `ContractManagement` 가 목록을 처음 열 때 `useState(dbGet('contracts'))` 로 한 번 받아 얼려 두고,
  그 뒤 서버 자료 도착(fb_initial_done)·실시간 변경(fb_data_changed)을 안 들었다.
  열린 순간 자료가 덜 와 있으면 새로고침 전까지 그 사진에 멈춘다.
- 세금계산서(FinanceInvoice)는 2026-08-26 같은 까닭으로 이미 고쳤다 — 계약관리만 남아 있었다.
- ⚠ 36건이 정확히 어디서 왔는지는 그 탭을 못 읽어 확정 못 했다(다른 탭에서는 그 탭의 메모리를 볼 수 없다).

## 한 것
- 계약관리가 fb_initial_done · fb_data_changed(contracts·batch·manual) · pureun-saved(contracts) 를 듣고
  `refreshContracts()` 로 저장소에서 다시 읽는다. 남의 표 변경엔 안 그린다. 화면을 떠나면 듣기를 푼다.
- 새 검사 `tests/contract-board-rereads.test.js` 11개 — 일부러 망가뜨린 5가지 모두 운다.

## 남은 것
- 다른 화면 중 `useState(dbGet(...))` 로 얼리는 곳이 더 있을 수 있다(사건·컨설팅 등) — 이번엔 계약관리만.
