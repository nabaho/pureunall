상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-deploy-1031
가지: fix/site-publish-body

# 2026-10-31 · 「새 사이트에 올리기」가 깃허브에서 거절되던 것

대표 「새사이트에 올리기」 → 두 번 막혔다.

## ① GitHub 401: Bad credentials — 서버의 깃허브 열쇠가 죽어 있었다
- `GITHUB_AUTOMATION_TOKEN` 은 1판 하나뿐이었다. 대표가 새 토큰(세밀한 토큰, pureun-site·pureunall,
  Contents·Issues·Actions 읽기쓰기, 기한 없음)을 만들어 2판으로 넣었다. 값은 대표만 다뤘다.
- 이 열쇠를 쓰는 세 함수(publishSite · weeklyNewsBrief · developmentAutomation)를 다시 배포했다.

## ② GitHub 400: Body should be a JSON object — 몸통을 두 번 감쌌다
- `site-publish.js` 의 `올리기` 가 `JSON.stringify(body)` 로 넘기고, `githubRequest`(dev-automation.js)가
  또 `JSON.stringify` 했다. 깃허브는 객체 대신 글자 하나를 받았다. 2026-08-31 이 단추가 생긴 뒤
  서버로 올라간 적이 «한 번도» 없었다(새 사이트 저장소의 커밋은 손으로 넣은 것뿐).
- 같은 `올리기` 를 쓰는 weeklyNewsBrief(주간 뉴스 요약 → 새 사이트)도 같은 까닭으로 막혀 있었을 것이다.
- 검사가 못 잡은 까닭: tests/site-publish.test.js 의 가짜 githubRequest 가 «글자» 몸통을 기대했다 —
  진짜와 약속이 달랐다. 가짜를 진짜 약속(객체)에 맞추고, functions/site-publish.test.js 에
  진짜 두 부품을 맞물려 돌리는 검사를 새로 넣었다(고치기 전 빨강 확인).

## 남은 일
- 합친 뒤 publishSite · weeklyNewsBrief 다시 배포 → 「새 사이트에 올리기」 다시 누르기.
