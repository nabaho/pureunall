# 푸른 통합 AI 라우터 — 보안판 (2026-11-17)

> 대표가 제미나이로 만든 원클릭(「안티그래비티 토큰 다 썼다 · 제미나이도 연결하고 싶다」)을 보안 손질한 판.
> 원본 출처: 대표가 채팅에 올린 `PureunAI_OneClick.zip`. 기능은 그대로 — Claude·GPT·Gemini 키를 한곳에 모아 쓰는 중계기 · 폰 채팅앱 · 코딩명령창 · Antigravity MCP 연결.

## 바꾼 것
- 서버는 **이 PC 안(127.0.0.1)** 에서만 연다. 방화벽 8787 은 열지 않고, 예전 판이 연 규칙은 지운다.
- 누구나 아는 열쇠(`sk-pureun-local-dev`) 대신 **이 PC 전용 열쇠**(`C:\PureunAI\client_key.txt`, 처음 켤 때 만든다). 옛 열쇠는 꺼진다. MCP·터미널은 같은 파일을 읽는다.
- **다른 웹사이트가 보낸 요청·낯선 Host** 는 서버가 거절한다(아무 웹페이지가 PC 의 코딩명령창·설정을 몰래 부르던 길).
- 「내부」 판정은 루프백만(예전 «100.» 전부).

## 까는 법
- 원클릭: `python tools/pureun-ai/build-oneclick.py 푸른AI_원클릭_보안판.bat` 로 만든 파일을 대표 PC 에서 두 번 누른다(관리자 승인 창은 사람이).
- 설치가 끝나면 관리자 화면(http://localhost:8787/admin)이 열린다 — 「Gemini API 키」 칸에 **별도 키**(구글 콘솔에서 하루 상한)를 넣는다. 회사 서버 키(GEMINI_KEY 금고)는 쓰지 않는다.
- 폰에서 쓰려면 Tailscale serve 로 이 PC 의 8787 을 열고, 그 이름을 환경변수 `PUREUN_EXTRA_HOSTS` 에 적는다(그 이름만 통과).

## 지킴
`tests/pureun-ai-router-safety.test.js` — 기본 127.0.0.1 · 방화벽 안 엶 · 모든 요청 출처 검사 · CORS «*» 금지 · 옛 열쇠 금지 · 실제로 띄워 막힘 확인.
