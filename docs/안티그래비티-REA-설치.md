# 구글 안티그래비티 + REA 설치 (대표 지시 2026-10-24)

> 「구글 안티그래피티 최신 버전으로 다운받고 REA 리버스 엔지니어링 애니띵도 연결시켜줘」

## 까는 법 (대표 PC, 윈도)

`tools/antigravity/install-antigravity.bat` 을 더블클릭한다. 스크립트가 하는 일:

1. 공식 다운로드 페이지(https://antigravity.google/download)에서 **그때의 최신** 윈도 설치 파일 주소를 읽는다(x64·ARM64 자동 선택).
2. 이미 같은 판이 깔려 있으면 건너뛴다. 옛 판이면 덮어 설치할지 묻는다.
3. 받은 뒤 **실행 전에** 서명을 본다 — Google LLC 서명이 아니거나 깨졌으면 지우고 멈춘다.
4. 설치 창을 연다(조용히 깔지 않는다 — 다음 → 설치 → 마침은 사람이 누른다).
5. Node.js 판을 본다. REA 조건(22.23.4+ · 24.22.1+ · 26.12.1+)에 못 미치면 winget 으로 LTS 를 깔지 묻는다.
6. `npx rea-agents@latest setup --client antigravity` — REA 가 «바꿀 내용»을 보여 주고, 승인하면 안티그래비티에 MCP 서버로 등록한다.
7. `doctor --client antigravity` 로 점검한다. 끝나면 안티그래비티를 껐다 켠다.

설치 중간에 바탕화면 바로가기도 만든다(설치 프로그램이 안 만들 때가 있다). 바탕화면 자리는 Windows 에 묻는다 —
OneDrive 가 바탕화면을 옮겨 둔 PC 에서는 `%USERPROFILE%\Desktop` 이 화면에 안 보이는 폴더다.

**이미 깔았는데 바탕화면에 안 보이면**: `tools/antigravity/make-desktop-shortcut.bat` — 받기·REA 없이 바로가기만 만들고, 열지 묻는다.
실행 파일을 못 찾으면 설치가 안 끝난 것이니 `install-antigravity.bat` 을 다시 돌린다.

## 2026-10-24 확인한 것 (클라우드에서)

| 항목 | 결과 |
|---|---|
| 공식 페이지 최신 | Antigravity App v2.26.0 (따로 Antigravity IDE Standalone v2.5.5 도 있다 — 이 스크립트는 App 을 깐다) |
| 윈도 x64 설치 파일 | 약 166MB, NSIS 설치 프로그램, 관리자 권한 없이 사용자 계정에 깔림(`asInvoker`) |
| 서명 | `O=Google LLC` (DigiCert EV 코드서명) |
| REA | npm `rea-agents` 최신 6.7.0, MIT, 안티그래비티 지원(`--client antigravity`) |
| 스크립트 | pwsh 7.4 로 구문 검사 통과 · 주소 찾기·Node 판 판정은 실제 페이지로 돌려 봄 |

⚠ **윈도에서 실제로 끝까지 돌려 본 것은 아니다**(클라우드에는 윈도가 없다). 처음 돌릴 때 멈추면 화면 글을 그대로 알려 주시면 고친다.

## 쓰는 규칙

- REA 는 역공학 도구다. **권리가 있는 프로그램만** 분석한다(우리 것·고객사가 허락한 것). 깊은 바이너리 분석에 쓰는 IDA·Hopper 는 따로 사는 상용품이다.
- 분석 결과는 안티그래비티가 쓰는 AI 회사로 넘어간다 — **고객 자료(주민번호·임금대장)가 든 파일은 넣지 않는다.**
- 지우기: 윈도 설정 → 앱 → Antigravity 제거 · `npx rea-agents uninstall --client antigravity`.

검사: `tests/antigravity-install.test.js` (받는 곳·주소 안 박기·서명 먼저·조용히 안 깔기·REA 범위·BOM).
