상태: 완료
# 2026-10-11 · ⚖ 산재 사례 찾기 — 이알피 사건 상세 (대표 「진행」 → 목업 ㉮)

가지: `erp-sanjae-cases`
- js/pu-sanjae-cases.js: 근로복지공단 판례·심사결정서·질병판정서(공공데이터, 10/11 승인)를 그 자리에서 찾음. 저장 안 함, 원문은 textContent.
- 이알피 산재 사건(case-injury) 상세에 「⚖ 비슷한 산재 사례 찾기」 — 사건 제목으로 미리 찾음, 「사건 메모에 붙이기」는 case_memos.
- 검사 tests/sanjae-cases.test.js 6건. 전체 검사(Full system tests) 통과로 합쳐짐(#2462). 화면 눈 확인 10/11: 가짜 자료로 목록 한 줄·원문 펼침·꺾쇠 글자 그대로 확인.
