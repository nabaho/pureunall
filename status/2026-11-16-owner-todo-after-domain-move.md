# 2026-11-16 · claude/owner-todo-after-domain-move

대표 지시 「합치면 배포확인」 · 「추가로 내가 해야될거 모두 확인해서 올려주고 창열어줘」 · 「창도 열어주고 나스도 지금 로그인 했다 니가 모두 바꿔라」.

## 한 것
- PR #3120(코드 옛 주소 6곳) 합침 확인 → «Test and Deploy Pages» 성공 → 새 주소 `pu-release` = 합친 커밋 `ff1c0f7a`, 앱 설명 파일 두 개 `related_applications` 새 주소, `pu-cal` 이음 뿌리 새 주소, `pu-erp.html` 옛 주소 0곳(실측).
- 나스(DSM 192.168.0.21, 대표가 로그인) 제어판 › 로그인 포털 › 고급 › 역방향 프록시 «푸른이알피»(https:*:5443 → https://localhost:5001)의 사용자 지정 머리글 `Access-Control-Allow-Origin` 값 `https://nabaho.github.io` → `https://erp.pureunlabor.co.kr`. 저장 뒤 DSM API 로 다시 읽어 확인. `Access-Control-Allow-Private-Network: true` 는 그대로. 작업 스케줄러 3개(PureunERP_Backup·Auto S.M.A.R.T. Test_2·PureunFiles_Backup) 목록에 옛 주소 없음(스크립트 본문은 비밀 열쇠가 있을 수 있어 안 열었다).
  - ⚠ 9월 기록(`status/2026-09-18-nas-reverse-proxy-dead-end.md`)대로 이 머리글은 브라우저 CORS 에 실제로는 안 먹는다 — 이사 계획 표대로 값만 맞춰 둔 것.
- 옛 홈페이지 도메인 조회: 등록처 가비아, 등록일 2025-11-27, 사용 종료일 2026-11-27. DNS·메일은 카페24.
- `STATUS.md` 「2. 지금 손이 필요한 것」 🌐 절을 «대표가 직접 할 일» 전체 목록(급함·로그인·확인·나중·끝남)으로 바꿈.

## 못 한 것
- 가비아·네이버·새 주소 ERP 로그인이 필요한 일 — 비밀번호는 AI 가 넣지 않는다.

## 덧붙임 — 옛 도메인 결정
- 대표 「연장해서 넘겨라」 → 곧바로 「옛도메인 그대로 종료」(2026-11-16). 연장·DNS 는 아무것도 손대지 않았다. STATUS 항목을 «그대로 종료»로 닫음.
