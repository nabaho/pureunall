# 공시 MCP(korean-dart) 판 올림 — Node 26 에서 설치가 안 되던 것 (2026-11-23)

가지: `fix/korean-dart-mcp-node26`

> 「니가 직접 mcp 연결해라」 (MCP 서버 창에서 korean-dart·korean-law 가 «다시 연결» 실패)

## 원인 — 둘이 서로 달랐다

| 서버 | 겉으로 본 오류 | 실제 원인 | 한 일 |
|---|---|---|---|
| korean-law (`korean-law-mcp@4.15.5`) | Connection closed | npx 캐시가 반쯤 깔린 채 깨짐(`hono` 꾸러미가 통째로 없음 → `hono/ws` 못 찾음) | 깨진 캐시 폴더 하나만 지우고 다시 받음 → 시작·도구 10개 응답 확인. 저장소 변경 없음 |
| korean-dart (`korean-dart-mcp@0.10.1`) | Connection closed | ① npx 캐시 깨짐(package.json 없음) ② 고쳐 받아도 `better-sqlite3@11` 이 **Node 26(ABI 147)용 미리 빌드가 없어** 설치 실패 | `.mcp.json` 판을 **0.10.3** 으로 올림(이 PR) |

- `korean-dart-mcp@0.10.3`(2026-10-26 게시) 은 `better-sqlite3@^12.4.1` 을 쓴다. 12.11.1 에는 `node-v147-win32-x64` 미리 빌드가 있다(GitHub 릴리스 자산으로 확인). 0.10.1 이 쓰는 11.10.0 에는 없다.
- 0.10.3 은 이 PC(Node 26.13.1)에서 설치까지 끝났다. 그다음 `DART_API_KEY 가 설정되지 않았습니다` 를 찍고 멈춘다 — 열쇠만 넣으면 된다.
- 판 고정 규칙(`tests/mcp-config-no-secrets.test.js` ⑤)은 그대로 지킨다(`@x.y.z`).

## 아직 사람이 할 일

- **열쇠 두 개가 이 PC 에 없다** — `DART_API_KEY`(opendart.fss.or.kr 무료 발급), `LAW_OC`(open.law.go.kr). korean-law 는 열쇠 없이도 켜지지만 도구를 부르면 «API 키가 필요합니다»로 실패한다.
- 열쇠는 사용자 환경변수로 넣고 데스크톱 앱을 다시 켠다. 저장소·채팅에 적지 않는다.
- 법령 조문·판례는 열쇠 없이 공개 미러로 도는 `moleg-law` 가 이미 대신하고 있다.

## 손대지 않은 것

- `.codex/config.toml`(저장소에 없는 개인 설정)에도 `korean-dart-mcp@0.10.1` 이 있다. Codex 에서도 같은 이유로 안 켜질 것이다.
