# news.pureun.kr — 뉴스레터 주소를 «우리 이름»으로

대표 지시 2026-09-20 「팝업시 주소를 이렇게 보내면 문제가 많을것 같은데 주소는
어떻게 해야하나?」 → 2026-09-21 「news.pureun.kr 로」

## 왜 바꾸나

지금까지 편지에 실려 나간 주소는 이것이었다.

    https://asia-northeast3-pureun-erp.cloudfunctions.net/newsView?i=2026-09-w3

① 받는 분 눈에 «푸른노무법인과 아무 상관없어» 보인다 — 낯선 주소는 안 누른다.
② 회사 메일 보안장비가 `cloudfunctions.net` 을 의심한다(차단 목록에 자주 오른다).
③ 우리 시스템 이름(`pureun-erp`)과 서버 위치(`asia-northeast3`)가 그대로 드러난다.
④ 나중에 서버를 옮기면 이미 나간 편지의 링크가 «전부» 죽는다.

## 어떻게 되어 있나

이 칸(`hosting/`)이 `news.pureun.kr` 의 뿌리다. 안에 든 것은 맨 앞 쪽(index.html)
하나뿐이고, 나머지는 `firebase.json` 의 **rewrites** 가 «지금 그대로의 함수»로 넘긴다.

    news.pureun.kr/newsView      →  newsView      (asia-northeast3)
    news.pureun.kr/newsClick     →  newsClick
    news.pureun.kr/newsOpen      →  newsOpen
    news.pureun.kr/newsFullPage  →  newsFullPage
    news.pureun.kr/newsFull      →  newsFull

★ 함수는 한 줄도 안 고쳤다. 주소만 앞에 새 문을 하나 낸 것이다.

⚠⚠ `newsFull` 을 빠뜨리면 안 된다. 「전문 보기」를 그 자리에서 펼 때 쪽이 «자기
   주소로» `/newsFull` 을 부른다(functions/news-view.js). 새 도메인에서 그 길이
   없으면 판례가 조용히 안 펴진다 — 오류도 안 난다.

⚠ 맨 끝의 `"source": "**"` 는 «함수로»가 아니라 «맨 앞 쪽으로» 보낸다. 넘김은 위에서부터
   맞는 것 하나가 이기므로, 적어 둔 다섯 자리는 함수로 가고 그 밖은 모두 맨 앞 쪽이
   받는다. 이 줄을 «함수로» 바꾸면 아무 주소나 함수를 깨우게 되니 그러지 말 것.
   ⚠ 이 줄이 없으면 주소를 잘못 친 분이 «파이어베이스 이름이 박힌 404»를 본다 —
     주소를 바꾼 까닭이 통째로 무너진다(2026-09-21 실측으로 잡았다).

⚠ 맨 앞 쪽(index.html)을 «비워 두지 않는다». 주소를 바꾼 까닭이 «믿게 하려는 것»인데
   뿌리가 404 면 오히려 의심을 부른다.

## 옛 주소는 «영원히» 살려 둔다

이미 나간 편지에는 `cloudfunctions.net` 주소가 박혀 있다. 그 문을 닫으면 지난 편지의
링크가 전부 죽는다 — 고칠 방법도 없다. 새 주소는 «앞으로 나갈 편지»부터다.

## 바꿔 끼우는 자리

편지가 주소를 짓는 밑값은 코드가 아니라 «설정»이다 —
뉴스레터관리 → 설정 → **추적밑주소**. 도메인이 붙고 확인이 끝나면 이 한 칸을
`https://news.pureun.kr` 로 바꾸면 그 뒤 편지부터 새 주소로 나간다.

⚠ 순서를 지킨다: ① 호스팅 올리고 `pureun-erp.web.app` 에서 다섯 자리를 다 눌러 본 뒤
  ② 도메인을 붙이고 ③ 그때 설정을 바꾼다. 거꾸로 하면 도중에 링크가 죽는다.
