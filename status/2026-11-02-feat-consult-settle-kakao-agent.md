상태: 끝남(배포 대기) — 규칙 게시·심부름꾼 켜기·첫 시험 발송은 대표 확인 뒤
이어하기시도: 0
작업폴더: C:\Users\fair0\pu-wt-settle
가지: feat/consult-settle-kakao-agent

# 🧾 컨설팅정산 — 카톡 자동 발송(PR ② 카톡 심부름꾼 «보내기»)

대표 2026-11-02 「카카오톡에 자동으로 보내는 기능 만들 수 없나 ?」 → 설계서 §7(대표 선택 2026-10-31 «대표 PC 카톡 자동입력», 약관 위험 «알고 진행») → 「만들기」.
이번엔 «보내기»만 — «받은 파일 자동 올리기»(§7 받기)는 뒤로.

## 바꾼 것
- 앱 «💬 카톡 문구»: 카드마다 카톡 방·발송 상태(대기 중 / 시험 모드 / ✓ 보냄 / 시험 발송 / 실패), 확정 + 대표면 «카톡 보내기»·«모두 카톡 보내기»(확인 창, 이미 대기 중이면 빼고, 이미 보냈으면 «한 번 더» 알림).
  «카톡 방» 표(☐·번호, 담당마다 PC 카톡 창 제목 그대로, 대표만 저장) · «보낸 기록»(고른 해) · 심부름꾼 한 줄(모드·마지막 응답, 10분 넘으면 경고).
- 자료: `settle/rooms/{sid}`(SettleRoom) · `settle/kakaoQueue/{id}`(SettleKakao, 앱은 새로 만들기만·pending) · `settle/agent`(심부름꾼 CLI 전용). 온톨로지 등록(ontology ?v=89, 29개 화면).
- 보안 규칙(만들개): rooms·kakaoQueue 쓰기 관리자만 · 지우기 금지 · 대기열 새로 만들기만(status pending) · agent 화면 쓰기 없음. **아직 게시 전** — `tests/photos-staff-share.test.js` PENDING 세 줄.
  게시 전에는 «카톡 방 저장»·«카톡 보내기»만 권한 오류로 막힌다.
- 심부름꾼 `scripts/kakao-agent/`(전광판 심부름꾼 뼈대): config(저장소 밖 %APPDATA%\pureun-kakao-agent\config.json, 기본 시험 모드, redirectRoom) · store(firebase CLI — 쓰는 곳은 대기열 그 줄과 settle/agent 둘뿐)
  · kakao.js + send.ps1(ASCII, Win32 창 메시지만 — WM_SETTEXT·Enter, 마우스·키보드·클립보드 안 씀, 방 이름과 창 제목이 «똑같을 때만», 쓰던 글이 있으면 안 건드림, Enter 뒤 입력칸이 비어야 «보냄»)
  · run(보내기 전 확인 — 등록된 방·관리자가 넣은 줄·확정 정산표, 시험 모드는 outbox 에만, 카톡 꺼짐·화면 잠김은 기다림, 방 못 찾음·제목 다름은 곧바로 실패, 그 밖은 3번) · main(--probe · --once · --dry-run) · install-task.ps1(로그온 시, 대표 확인 뒤) · README.

## 확인
- `tests/settle-kakao-agent.test.js`(시험 모드는 카톡 안 부름·방 다르면 안 보냄·관리자/확정 확인·꺼짐 기다림·3번 멈춤·쓰는 곳 둘·작업 파일로 넘김·PS 파일 ASCII·창 메시지만), settle-{view,html,rules} 더함
- 대표 PC 에서 `--probe`(아무것도 보내거나 열지 않음): 카톡 켜짐·메인 창·채팅 검색칸·열린 대화창 4 찾음. (카톡 판에서 대화창도 메인 창과 같은 종류 — 채팅 목록이 든 창을 메인으로 고름, PowerShell $null → [NullString]::Value)
- firebase CLI 로그인·읽기 확인(`/settle/agent` null)
- 가짜 파이어베이스 브라우저: 방 등록 → 보내기 단추 → «모두 카톡 보내기» → 대기열 2(pending, 대표) → 다시 누르면 «이미 대기 중». 폰 375px 옆넘침 0·작은 입력칸 0

## 남은 것(대표 확인 뒤)
- [x] 보안 규칙 게시(rooms·kakaoQueue·agent) 2026-11-02 대표 「게시하기」 — 새로 3 · 바뀜 0 · 사라짐 0, 다시 읽어 같음, 콘솔 원문 2026-11-02 · PENDING 비움
- [ ] 카톡 방 이름 등록(박재원·김혜민·박한별·김동현)
- [ ] 심부름꾼 config.json · `--once --dry-run` · 실전 `redirectRoom`(나와의 채팅)으로 첫 한 통 · 화면 잠김 때 되는지 · 자동 시작 등록
