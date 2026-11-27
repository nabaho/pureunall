# 모든뷰어 (Modeun Viewer) v1.600004

광고 없이 100% 기기 내부에서 동작하는 모바일·PC 통합 문서·압축 뷰어입니다.
한글(`.hwp`, `.hwpx`), 엑셀(`.xlsx`, `.csv`, `.tsv`), 파워포인트(`.pptx`), 워드(`.docx`, `.rtf`), PDF, ZIP/TAR/GZIP, 사진(`.jpg` EXIF 보정), SQLite, 오디오·비디오, 3D STL/OBJ 등 16종 포맷을 지원합니다.

## 포함 파일 (`modeun-viewer/`)
- `index.html` / `modeun_viewer.html`: 설치 없이 스마트폰·PC 브라우저에서 바로 실행되는 단독 웹앱 (내장 APK 다운로드 포함)
- `모든뷰어_v1.600004.apk`: 안드로이드(갤럭시) 무압축 원본 설치 파일 (`kr.modeun.viewer`, `versionCode=21`, `versionName=1.600004`)
- `manifest.json`: 스마트폰 홈 화면 추가(PWA) 설정 파일

## v1.600004 주요 반영 및 검증 내역
- **추천 폰 실무 5대 기능 추가**:
  1. 카톡·메일 여러 파일 한 번에 공유받기(`ACTION_SEND_MULTIPLE`) 지원
  2. 서명·보정 화면(`.JPG`) 및 원본 서류 원터치 모바일 공유(`📤 JPG공유`)
  3. 인쇄 · PDF 저장 전용 클린 레이아웃(`🖨 인쇄·PDF`)
  4. 비밀번호 보호 PDF·ZIP 잠금 해제 입력창(`🔒`)
  5. 서류 열람 중 화면 꺼짐 방지(`💡 화면유지`) 및 오늘 날짜·체크(✓)·한줄 기입 도장(`📅 날짜·✓기입`)
- **모바일 화면·글자 전수 검증 수정**:
  - 한글 A4 원본 페이지 `box-sizing` 보정으로 360px 휴대폰 화면에서 우측 결재란·직인까지 잘림 없이 100% 중앙 맞춤
  - 엑셀 하단 시트 탭(`결산총괄표` 등)과 플로팅 버튼 겹침 해소
  - 다중 페이지(1~10쪽 PDF·한글·워드) 60fps 통합 확대·축소(25%~500%) 및 원바 미니멀(44px 1줄 헤더) 검증 완료
  - 신규 152종 전 포맷 파일 + 105,652회 자동화 테스트 `JS Errors = 0` 통과

## GitHub 자동 푸시 경로
- Google Drive `AutoPush-GitHub/modeun-viewer/` → `nabaho/pureunall` 저장소 `gemini-autopush/modeun-viewer/` (5분 주기 자동 커밋·푸시)
