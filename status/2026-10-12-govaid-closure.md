상태: 이어하기 대기
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-govaid-note
가지: feat/govaid-closure

# 🎯 정부지원금 — 사업종료(예산 소진·접수 마감) 표시 · 편집 창 줄이기

대표 지시 2026-10-12 「예산이 소진되었다는 부분에 대해 확인이 가능하면 사업종료 표시」 · 「체크항목이 너무 아래로 … 한줄에 여러가지 체크항목」.

## 한 것 (이 PR)
- 엔진 `closureOf(사업)`: program.closure = {state open|partial|closed|unknown, reason budget|deadline|abolished|other, closedAt, note, sources, confidence, checkedAt, by}
  - closed → 확정 사업이어도 verdict 'closed'(후보 아님) · partial → 후보로 두고 «일부 마감 … 확인» 사람 조건 · 초안은 그대로 «조건 미확정»
- 화면: 상태 표마다 ⛔ 사업종료·예산 소진 / 접수 마감 / 사업 폐지 / 일부 마감(마감일), 사업 중심 상세는 «신청 불가» 알림,
  회사 접힘 줄에 «⛔ 사업종료 n», 확인할 조건 펼침에 접수 상태 근거.
- 편집 창: 접수 상태 줄(상태·까닭·마감일·공지 주소·메모 — 바꾸면 누가 언제 남김). 한 줄에 여러 항목: 숫자 조건 셋 한 줄,
  규모+지역 한 칸, 업종 짧은 이름, 예/아니오 3열 격자, 사람 조건·서류 나란히 → 한 화면에 다 들어옴.

## 남은 일
- [진행 중] 운영 사업 138개 접수 상태 조사 4갈래(스크래치패드 govaid-close/) → 공식 공지로 확인된 것만 closure 로 넣기(마른 돌리기 → 다시 읽어 확인)
- 매년 자동 업데이트(대표 지시 「매년 사업관련 자동 업데이트」) — 방식 제안 후 결정
