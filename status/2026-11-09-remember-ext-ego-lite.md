# 2026-11-09 · 리멤버 연결 — 에고라이트에도 깔리게 (갱신기가 «어느 브라우저»인지 찾는다)

상태: 코드 완료 · **PC 설치는 대표가 확장을 에고라이트에 불러와야 끝난다** (아래 «확인하지 못한 것»)

- 대표 지시: 「리멤버 확장버전 만들어서 연결시키자」 → 어느 브라우저냐고 여쭈니 **「에고라이트」**
- 가지: `feat/remember-ext-ego-lite`

## 배경 — Windows 를 다시 깔고 사라진 것

2026-11-07 밤 포맷으로 PC 쪽 설치물이 모두 없어졌다: 크롬 확장 설치 · 설치 폴더 `C:\pu-remember-ext` · 예약 작업 「푸른 리멤버 확장 갱신」 · 크롬 프로필(권형하)의 로그인.
코드는 main 에 전부 있었다(PR #2713 … #2941). 2026-11-09 에 설치 폴더·예약 작업을 되살렸으나(예약 작업은 사람이 `register-task.ps1` 을 한 번 실행),
**평소 쓰는 브라우저가 크롬이 아니라 에고라이트**였다 — 갱신기는 크롬 프로필만 찾아 «깨우기 못 함» 만 남기고 있었다.

## 한 것

- `tools/remember-ext/sync-ext.js` — 확장이 깔린 브라우저를 «여럿 중에서» 찾는다: `browsers()`(에고라이트 → 크롬 순) · `findExt()` 가 `{browser, exe, profile, id}` 를 돌려준다 ·
  `kickPlan()`(순수 함수)이 «그 브라우저의 실행 파일 + `--profile-directory` + `chrome-extension://…/kick.html`» 을 만든다 · `kick()` 은 그 계획으로만 켠다.
  에고라이트 경로는 이 PC 에서 읽어 확인한 값이다: `%LOCALAPPDATA%\Citro Labs\ego lite\User Data` · `C:\Program Files\Citro Labs\ego lite\Application\ego.exe`.
- 장애 알림 문구에서 «크롬(권형하)» 를 지웠다 — 「확장을 깐 브라우저(에고라이트·크롬)」. 프로필 이름·번호는 코드에 박지 않는다(시험이 지킨다).
- `tools/remember-ext/README.md` — 설치 안내를 «평소 쓰는 브라우저(에고라이트·크롬)» · `C:\pu-remember-ext` 로 바로잡았다(옛 `C:\Users\fair0\...` 경로는 PC 사용자 이름이 바뀌어 못 쓴다).
- **확장 자체(bg.js·hook.js·manifest.json 등)는 한 글자도 안 바꿨다** — 크롬 계열이라 같은 파일로 돈다. 그래서 확장 판 번호(ver.js)는 그대로다.

## 검사

- 새 `tests/remember-ext-browsers.test.js` 13개 — 가짜 PC(임시 폴더로 LOCALAPPDATA·ProgramFiles 를 바꿔)에서 «에고라이트에 있으면 찾는다 · 크롬에만 있어도 찾는다 · 둘 다면 에고라이트 먼저 ·
  다른 폴더에서 불러온 확장은 우리 것이 아니다 · 대소문자·끝 슬래시 · 깨진·null 프로필·빈 경로 하나가 전부를 막지 않는다 · 깨우기 계획의 인자 · 못 깨우는 까닭의 말 · 코드에 프로필 이름 안 박힘 · kick 이 찾은 브라우저로만 켠다».
- 새 `tests/remember-ext-manifest-shape.test.js` 7개 — 아래 «보안 검토»의 manifest 비교를 진짜 manifest 를 조금씩 바꿔 판정기째 돌린다.
- 고장 넣기 17개(첫 10 + 보안 보강 6 + 재검증 1) 전부 걸림 — 원본 복구 확인.
- 리멤버 시험 파일 전부(`tests/remember-*.test.js` + 사진첩→리멤버): 81개 통과(새 20개 포함 · 기존 61개).
- 저장소 전체: PR 에 적는다.

## 보안 검토에서 나온 것 (Antigravity·Codex 자동 검토, 2026-11-09) — 둘 다 이 PR 에서 고쳤다

- **[중간 · 기존 문제] manifest 비교가 «범위를 넓히는 칸»을 놓쳤다**(Codex). 갱신기는 GitHub main 의 확장 파일을 받아 바꾸는데, 안전장치인 manifest «모양» 비교가
  permissions·host_permissions·content_scripts(matches·js·world)·background 만 봐서 `optional_host_permissions` · `optional_permissions` ·
  content_scripts 의 `all_frames`·`match_about_blank` 같은 칸이 늘어도 «같다»고 통과했다(Codex 가 메모리에서 재현). → 비교를 «허용 목록»에서 **«제외 목록»** 으로 뒤집었다:
  글자만 바뀌는 칸(version·version_name·name·description·action.default_title)만 빼고 나머지 전부를 견준다(배열은 순서 무시). 새 칸이 생겨도 «달라짐 — 사람이 확인»으로 멈춘다.
  main 에 변경을 넣을 수 있는 쪽에 대한 방어일 뿐 임의 웹페이지의 직접 공격은 아니며, 선택 권한을 실제로 받으려면 브라우저 승인이 따로 필요하다.
- **[낮음] 설정 파일이 JSON `null` 이거나 확장 경로가 글자가 아니면 `findExt` 가 던진다**(Antigravity). → `j && …` 와 `typeof path === 'string'` 로 막았다.
- **재검증 1차(2026-11-09, Antigravity 통과 · Codex 발견 사항 없음)**: 위 두 고침을 다시 재현해 확인했다. Antigravity 의 낮음 2건 중
  ① `path.resolve('')` 가 «지금 작업 폴더»라 예약 작업(작업 폴더 = 설치 폴더)에서 빈 경로 확장이 우리 것으로 보일 수 있음 → **고침**(빈 경로는 건너뜀 + 시험 1개 + 고장 넣기);
  ② `action: []` 이 빈 객체와 같아짐 → 권한 우회는 안 돼서(그 칸은 권한이 아니다) **고치지 않음**.
- Codex 가 짚은 «상태 문서의 82개 주장 ≠ glob 46개»: 맞다 — 82 는 내가 잘못 더한 숫자였다(새 파일이 이미 71 안에 들어 있었다). 위 숫자(80 · 기존 61 + 새 19)로 바로잡았다.

## 확인하지 못한 것

- ⚠ **진짜 에고라이트에서 확장이 불러와지고 «깨우기»가 도는지**는 못 봤다. 이 PC 의 에고라이트 프로필 둘(Profile 1·2)에는 아직 확장이 없다(읽기로 확인).
  확장은 대표가 에고라이트에서 «압축해제된 확장 프로그램을 로드» 해야 한다(개발자 모드·브라우저 설정이라 AI 가 대신하지 않는다). 불러온 뒤 설정 파일에 경로가 적히면 갱신기가 찾는다.
- 에고라이트가 `--profile-directory` 인자와 `chrome-extension://` 주소를 크롬처럼 받는지는 안 해 봤다(같은 크롬 계열이라는 가정).
- 갱신기 자신은 스스로 안 바뀐다(설계) — 이 판을 `C:\pu-remember-ext\sync-ext.js` 로 «손으로 복사»해야 PC 에 반영된다(합친 뒤).
