# 2026-11-28 법인 카카오톡 방 자동정리 대시보드 + PC 화면·하단알림 오프라인 OCR 자동캡처 수집기

## 요약
1. **사람별 · 사건/업무별 · 공유 건별 자동정리 대시보드(`pu-kakaoroom.html`, `js/pu-kakaoroom-core.js`, `js/pu-kakaoroom-app.js`)**:
   - 첫 화면을 4가지 정리 뷰(`👤 사람별 정리`, `⚖️ 사건·업무별 정리`, `📌 공유 건별 정리`, `📋 전체 표`)로 개편하고 `buildDashboardSummary()` 순수 엔진으로 자동 분류·D-day·미연결 건수를 집계합니다.
   - Firebase RTDB(`/kakao_room/items`, `/kakao_room/files`, `/kakao_room/watcher`) 실시간 `.on('value')` 구독과 서버 미정리 대화 자동 당겨오기(`checkServerAutoPull`)를 추가해 새 내용이 들어오면 대시보드에 즉시 정리됩니다.
2. **PC 카카오톡 화면·하단알림 읽기 전용 자동 캡처 수집기(`scripts/kakao-watch-agent/`)**:
   - 카톡 클라이언트 조작(클릭·키보드·스크롤·DB 복호화) 없이 OS 읽기 전용 픽셀 캡처와 Windows 내장 오프라인 한국어 OCR(`Windows.Media.Ocr.OcrEngine`)로 화면 우측 하단 알림 팝업과 열린 등록 법인방 창의 변화만 읽습니다.
   - 웹과 동일한 `PuKakaoRoomCore` 5중 안전판별(개인방 제외 · OTP 차단 · 주민번호/카드/계좌/비번 3중 가림)을 거친 뒤 비식별 `KakaoWorkArchive` 레코드만 저장하고 `_deleted` 건 부활을 차단합니다.
3. **Firebase RTDB 보안규칙(`scripts/make-firebase-rules.js`)**:
   - `/kakao_room/watcher` (`.write: false`, 읽기는 상위 `LOGIN` 상속) 규칙을 추가하고 규칙 검증 `PENDING` 목록을 현 콘솔 상태에 맞춰 동기화했습니다.

## 2026-11-28 추가 개편 (사번순 1줄 표 + 첨부서류·푸른메일 대조)
1. **푸른인사관리 사번순 세로 1줄 대시보드(`pu-kakaoroom.html`, `js/pu-kakaoroom-core.js`, `js/pu-kakaoroom-app.js`)**:
   - 박스/카드(`dash-grid`/`dash-card`) 레이아웃을 전면 제거하고, `👤 사번·사람별 정리` · `⚖️ 사건·업무별 정리` · `📌 공유 건별 정리` · `📋 전체 표` 4개 뷰 모두 1줄 표(`table.t.hr-dash`)로 개편했습니다.
   - `data/user_dir` 공개 명부 기준 재직 직원을 사번 오름차순으로 왼쪽 세로 정렬하고, 직원당 카톡·업무 요약을 1줄로 표시(다건 시 `▶`/`▼` 및 `▼ 모두 펼치기` 지원, `카톡 있는 사람만` 필터 제공)했습니다. (동명이인은 추측 귀속하지 않고 미등록·확인을 위해 분리합니다.)
2. **첨부서류 전수 집계 & 푸른메일 발송일시 대조(`collectRowAttachments`, `matchAttachmentMailSent`)**:
   - 카톡 `fileNames`, 요약 내 inline `📎`·`[이미지 공유: ...]`, `kakao_room/files`(톡서랍 단독 파일 포함)를 직원별·사건별로 누락 없이 모았습니다.
   - `mailbox/folders`(`sent`)·`mailbox/msgs/{slug}` 최근 180일 보낸 메일의 첨부파일명·사건번호·날짜 선후관계를 대조해 메일 발송 일시(`✉ MM/DD HH:MM 발송`)를 표와 상세 모달에 함께 표시합니다.

## 점검 상태
- Orca 2단계 점검(Gemini 1단계 직접 수정 + Claude 2단계 중간 4건 보완), 전체 단위 테스트, 캐시 버전 검사, 폰 화면 전수점검 통과.
