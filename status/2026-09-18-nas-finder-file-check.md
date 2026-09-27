# 2026-09-18 · 찾기가 두 번째 배포 사본에도 걸렸다 — «파일이 실제로 있는지»로 바꿨다

가지 `claude/login-start-screen-386qu2`

## 무엇이 있었나

`.git` 유무로 가른 뒤(직전 커밋), 대표님이 다시 돌리시자 이번엔 —

```
Error: Cannot find module '...\pureunall-deploy\scripts\nas-backup-deploy.js'
```

**이름부터 「deploy」다.** `.git` 은 있었다(스스로 커밋해 올리는 자리였을 것이다) — 그런데
배포 워크플로(`deploy-pages.yml`)는 올리기 «전에» `scripts` 폴더를 통째로 지운다.
그래서 `.git` 유무만으로는 **배포 사본과 원본을 못 가른다.** 한 번 틀린 짐작을
다른 조건으로 바꿔치기했을 뿐, 여전히 «짐작」이었다.

## 바꾼 것 — 짐작을 그만두고 «확인»으로

```powershell
Where-Object {
  (Test-Path (Join-Path $_.DirectoryName '.git')) -and
  (Test-Path (Join-Path $_.DirectoryName 'scripts\nas-backup-deploy.js'))   # ← 지금 쓸 그 파일
}
```

**「저장소같이 생겼는가」가 아니라 「지금 쓸 그 파일이 실제로 있는가」**로 물었다.
이러면 다음에 또 다른 이름의 배포 사본이 나와도 걸리지 않는다 — 이름을 안 보고 실물을 본다.

## 못 찾으면 — 되돌리지 않고 새로 받는다

이번엔 「없습니다, 클로드에게 보여 주세요」로 끝내지 않았다.
`Documents\pureunall-작업용` 에 **새로 `git clone`** 해서 그 자리에서 이어간다
(기존 `pu-deploy`·`…-deploy` 사본들과 이름이 안 겹치게).

## 손댄 곳

- `scripts/나스-올리기-찾아서.ps1` — 조건에 파일 존재 확인 추가, 없으면 자동 `git clone`
- `tests/nas-deploy-oneclick.test.js` — 두 규칙을 못 박음(파일 확인 · 자동 받기)

전체 검사 18,044개 통과. 돌연변이 둘 다 걸린다.

## 되풀이한 실수 — 여섯 번째

**「배포본이 아니게 가르는 법」을 스스로 두 번 다시 짐작했다** — `.git` → 또 틀림.
**앞으로는 «이름·모양으로 가르지 않는다» — 지금 쓸 그 실물이 있는지를 본다.**
이 원칙을 이번에 처음 세웠으니, 다음에 비슷한 「찾아서 실행」을 만들 때 먼저 적용한다.
