# 2026-09-19 · 「고쳐서 올렸다」고 했는데 대표님 화면엔 옛 오류가 그대로 났다

가지 `claude/login-start-screen-386qu2`

## 무엇이 있었나

PR #1460(윈도우 `spawnSync npx ENOENT` 수정)을 머지하고 「다시 해 보세요」라고 했다.
대표님이 같은 한 줄을 다시 붙여넣으셨는데 —

```
찾았습니다: C:\Users\fair0\Documents\pu-deploy
Already up to date.
...
✗ 파이어베이스 CLI 를 못 불렀습니다 — 인터넷과 npx 를 확인하세요.
  spawnSync npx ENOENT
```

**고치기 전과 똑같은 오류가 그대로 났다.** `git pull` 은 「Already up to date」라고
했는데, 그 폴더에는 방금 올린 수정이 없었다.

## 까닭

`pu-deploy` 폴더가 **어느 가지를 보고 있는지 짐작만 했다.** `git pull` 은
**«지금 체크아웃돼 있는 가지»만** 원격과 맞춘다 — 그 가지가 우리가 원하는
`main` 의 최신인지는 전혀 확인하지 않는다. 다른 가지에 있었거나, 마침 병합되는
순간과 겹쳐 아무것도 못 받았을 수 있다. 「고쳐서 올렸다」와 「그 컴퓨터가
그것을 받았다」는 다른 일인데, 그 둘을 확인 없이 같다고 여겼다.

## 고친 것

`git pull` 을 믿는 대신 **못 박는다** — 반드시 `main`, 반드시 `origin` 의 최신 그대로.

```
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main
```

이 폴더는 사람이 편집하는 자리가 아니라 **«올리기 전용 사본»**이므로, 로컬에
무엇이 있었든(다른 가지·엇나간 커밋) `origin/main` 으로 덮어써도 안전하다.

`scripts/나스-올리기.bat` · `scripts/나스-올리기-찾아서.ps1` 둘 다 고쳤다 —
한쪽만 고치면 다음에 어느 길로 도느냐에 따라 또 갈린다.

`tests/nas-deploy-oneclick.test.js` ⑥ — 두 파일 모두 무른 `git pull` 이 없고,
`fetch origin main` · `checkout -B main origin/main` · `reset --hard origin/main`
세 줄이 다 있는지 기계로 본다.

전체 검사 18,119개 통과. 돌연변이(`reset --hard` 제거) 걸린다.

## 대표님이 다시 하실 것

같은 한 줄을 다시 붙여넣으시면 됩니다. 이번엔 그 폴더가 **정말로** 최신 `main`
으로 맞춰진 뒤에 올리기를 시도합니다.
