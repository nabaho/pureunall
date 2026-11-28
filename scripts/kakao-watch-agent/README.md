# PC 카카오톡 화면·하단알림 자동 캡처 수집기 (`kakao-watch-agent`)

## 동작 원칙 (약관 무위반 · 읽기 전용 · 오프라인 OCR)
1. 카카오톡 창에 클릭·키보드·스크롤·창 열기·DB 복호화를 **절대 하지 않는다**.
2. 화면에 뜬 ① **우측 하단 카톡 알림 팝업**과 ② **화이트리스트(`kakaoWork/rooms`)에 등록된 열린 법인 카톡방 창**(상단 헤더·하단 입력창 제외)의 OS 화면 픽셀만 읽는다.
3. Windows 10/11 기본 내장 오프라인 한국어 OCR(`Windows.Media.Ocr.OcrEngine`)로 이 PC 내부에서만 글자를 읽으며, 임시 캡처 이미지는 OCR 직후 즉시 삭제된다(외부 OCR API 전송 0).
4. 웹(`pu-kakaoroom.html`)과 동일한 `PuKakaoRoomCore` 5중 안전판별을 적용해:
   - 미등록 개인방·잡담·OTP·인증번호 자동 차단
   - 주민번호·카드·계좌번호·비밀번호 3중 가림
   - 사람별·사건별·공유건별 자동 분류 후 `/kakao_room/items/{id}` 저장 및 `/kakao_room/watcher` 상태 기록

## 실행 방법
```powershell
# 1) 환경 확인 (OCR 및 카톡 실행 여부만 확인)
node scripts/kakao-watch-agent/main.js --probe

# 2) 시험 모드 1회 실행 (DB에 쓰지 않고 %APPDATA%\pureun-kakao-watch\outbox\ 에만 결과 저장)
node scripts/kakao-watch-agent/main.js --once --dry-run

# 3) 카톡 스크린샷 1장 OCR -> 안전판별 드라이런 테스트
node scripts/kakao-watch-agent/main.js --test-image C:\경로\카톡캡처.png

# 4) 상주 실행 (%APPDATA%\pureun-kakao-watch\config.json 에 "liveEnabled": true 일 때 실전 반영)
node scripts/kakao-watch-agent/main.js
```

## 설정 파일 (`%APPDATA%\pureun-kakao-watch\config.json`)
`config.example.json`을 `%APPDATA%\pureun-kakao-watch\config.json`으로 복사해 사용하세요.
- `liveEnabled`: 기본 `false` (시험 모드). `true`로 바꿀 때만 Firebase RTDB `/kakao_room/items`에 자동 기록합니다.
- `watchPopup`: 하단 카톡 알림 팝업 감시 여부 (`true`)
- `watchOpenRoom`: 열린 등록 법인방 화면 감시 여부 (`true`)
- `rooms`: 허용할 법인 카톡방 이름 배열 (글자 그대로 일치하는 방만 수집)

## Windows 로그인 시 자동 실행 등록 (대표 승인 후 직접 실행)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/kakao-watch-agent/install-task.ps1
```
제거하려면 `-Remove` 옵션을 붙입니다.
