# 3D운전교실 한국 버전 (`game/`)

설치 없이 웹 브라우저(PC · 스마트폰 · 태블릿)에서 바로 실행되는 단일 파일 3D 운전·비행 시뮬레이터입니다.

## 포함된 파일
- `index.html`: 웹 접속 시 바로 실행되는 메인 게임 파일 (65종 국산·외제 슈퍼카, 4색 연속 한국 배경 루프 & 대한민국 전국지도, NPC 탑승, 초음속 비행 변신·직접 조준 미사일 교전·격추·점수, 10분 플레이 제한 포함)
- `driving_class_kr.html`: 동일한 원본 백업 파일
- `manifest.json`: 스마트폰 홈 화면 추가(PWA) 설정 파일

## GitHub 자동 동기화 및 온라인 배포 경로
- **Google Drive 자동 푸시(`AutoPush-GitHub/game/`) 기본 경로**: `nabaho/pureunall` 저장소의 `gemini-autopush/game/index.html` (Apps Script `GITHUB_BASE_DIR`을 `''`로 비우면 저장소 최상위 `game/index.html`로 푸시)
- **GitHub Pages 활성화 시 접속 예시**:
  - `nabaho/pureunall` 최상위 `game/` 배포 시: `https://nabaho.github.io/pureunall/game/`
  - 별도 `nabaho/game` 전용 저장소(Public + GitHub Pages `main` 브랜치) 배포 시: `https://nabaho.github.io/game/`
