# 전광판 심부름꾼 (scripts/signboard-agent)

포털 «전광판» 앱에서 **«전광판에 올리기»** 를 누르면, 이 프로그램이 올린 판을 가져다 사무실 안의 LED 전광판 장비에 보냅니다.
설계: `docs/superpowers/specs/2026-10-12-signboard-design.md` §6~§8. 이 폴더(`scripts/`)는 배포본에서 지워집니다 — 인터넷에 공개되지 않습니다.

## 한눈에
| 모드 | 하는 일 |
|---|---|
| **시험 모드** (기본) | 장비에 **한 번도 연결하지 않습니다.** 보낼 내용을 `outbox/v판번호.json` 에 적기만 합니다. 열쇠 없이도 돕니다. |
| **실전 모드** | `config.json` 에 `"liveEnabled": true` 가 있을 때만. 장비에 파일을 올리고 프로그램을 «전체 교체»합니다. |

`--dry-run` 을 붙이면 설정과 상관없이 **항상 시험 모드**입니다.

## 처음 한 번
1. Node 와 firebase CLI 가 이 PC 에 있고, `firebase login` 이 되어 있어야 합니다(포털 데이터를 읽고 `signboard/state` 를 쓰는 데 씁니다).
2. 설정 파일을 **저장소 밖**에 만듭니다: `%APPDATA%\pureun-signboard\config.json` (`config.example.json` 을 복사).
   - 시험 모드는 `deviceHost`·`sdkKey`·`sdkSecret` 이 비어 있어도 됩니다.
3. 한 바퀴만 시험: `node scripts/signboard-agent/main.js --once --dry-run`
4. 계속 돌리기: `node scripts/signboard-agent/main.js`

## 실전으로 넘어가기 전에 (설계서 §11)
- [ ] 장비 번호 가운데에 `D`(공정 카드)가 있다 — 없으면 공식 통로가 열리지 않습니다.
- [ ] 灰度 기술지원에서 받은 `sdkKey`·`sdkSecret` 을 `config.json` 에 넣었다. **이 값은 저장소·채팅·화면 어디에도 적지 않습니다.**
- [ ] 장비 시계와 시간대가 한국(UTC+9)이다 — 포털 «전광판 상태» 탭에 경고가 없다.
- [ ] 전광판에 지금 들어 있는 광고가 지워져도 된다 — 포털 «전광판 상태» 탭에서 대표가 «지워도 됩니다»를 눌러야 첫 전송이 나갑니다.
- [ ] HDPlayer 의 «정해진 시각 켜고 끄기» 설정을 쓰고 있었다면, 공식 통로를 켠 뒤 안 먹을 수 있다 — 확인.
- [ ] `config.json` 에 `"liveEnabled": true` 를 쓰고 시험 광고 한 건으로 먼저 확인.

## 안전장치
- 광고가 0건인 판은 보내지 않습니다(전광판을 통째로 비우지 않습니다).
- 받은 파일 크기가 기록과 다르면 그 판 전송을 중단하고, 장비의 기존 광고는 건드리지 않습니다.
- 같은 판은 3번까지만 다시 해 보고 멈춥니다. 새 판이 올라오면 다시 시작합니다.
- 장비 와이파이 비밀번호 등 장비 정보는 «필요한 칸만» 골라 올리고 나머지는 버립니다.
- 오류 글에서 `sdkKey`·`sdkSecret` 값은 `***` 로 지워집니다.
- 이 프로그램은 포털 데이터베이스에서 `signboard/state` **한 곳만** 씁니다.

## 자동 시작 (PC 설정을 바꾸므로 대표 확인 뒤에)
`powershell -ExecutionPolicy Bypass -File scripts\signboard-agent\install-task.ps1 -RepoDir <오래 두는 저장소 폴더>`
- 오래 두는 폴더에서 `git pull` 로 최신을 유지하세요(임시 작업 폴더는 지워질 수 있습니다).
- 되돌리기: `...install-task.ps1 -Remove`

## 문제 해결
| 증상 | 확인 |
|---|---|
| 포털에 «마지막 응답 N분 전» 경고 | PC 가 꺼졌나? `firebase login` 이 풀렸나? 로그: `%APPDATA%\pureun-signboard\agent.log` |
| 상태가 «실패» | 포털 «전광판 상태»의 메시지. 같은 판은 3번 뒤 멈춥니다 — 새 판을 올리거나 `local.json` 의 `failures` 를 지우세요 |
| 장비에 연결 안 됨 | `deviceHost`(예: `192.168.0.50:30080`)가 맞나, 전광판과 이 PC 가 같은 망인가 |
| 기간 예약이 한 시간 어긋남 | 장비 시간대가 중국(UTC+8)인지 — 포털 상태 탭의 경고 |
