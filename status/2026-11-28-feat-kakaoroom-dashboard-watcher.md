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

## 점검 상태
- 전체 단위 테스트(`node --test tests/*.test.js functions/*.test.js` 31,873건 fail 0), 캐시 버전 검사, 폰 화면 전수점검(360·375·411·768·900·1366px 라이트/다크), 실제 카톡 캡처 이미지 WinRT OCR 드라이런, Orca 2단계 데스크보드 점검 및 보안 재검토를 통과한 상태로 PR 생성 준비.
