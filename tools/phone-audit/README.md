# 폰 화면 점검 도구 (개발용 — 배포에 안 올라간다)

대표 지시 「폰화면관리」(2026-10-18). 포털 앱 전부를 **폰 크기로, 로그인한 채** 그려 재고 갈무리를 남긴다.

```
node tools/phone-audit/run.mjs                    # 포털 앱 전부, 360·411px
node tools/phone-audit/run.mjs work cal           # 몇 개만 (enter.html APPS 의 key)
node tools/phone-audit/run.mjs work --full        # 페이지 전체 갈무리도
node tools/phone-audit/run.mjs work --view=week   # views 가운데 하나만
```

결과: `tools/phone-audit/out/` (갈무리 `<key>[-<view>]-<폭>.png` · `result*.json`) — 저장소에 안 올린다.

## 어떻게 로그인하나 — 안 한다

gstatic 의 `firebase-*-compat.js` 를 `fake-firebase.js` 로 바꿔 끼운다. 앱 코드는 그대로다.
로그인된 사람은 지어낸 대표 계정(`P001`), 자료는 `seed.js`(공통) + `seeds/<key>.js`(앱별)이다.
라이브러리 CDN 말고는 바깥으로 아무것도 안 나간다 — 진짜 서버에 쓰지 않는다.

⚠ **자료는 모두 지어낸다.** 실제 고객·직원 이름·주민번호·금액을 넣지 말 것.

## 앱별 자료·화면 — `seeds/<key>.js`

```js
module.exports = {
  data: { work_erp: { items: { ... } } },          // 공통 자료 위에 덧씌운다
  localStorage: { 'some_key': 'value' },           // 열기 전에 넣어 둘 것(선택)
  views: [                                         // 첫 화면 다음에 차례로 열어 잰다(선택)
    { name: 'done', run: async (page) => { await page.click('text=완료'); } },
  ],
};
```

## 무엇을 재나 (`measure.js`)

| 이름 | 뜻 |
|---|---|
| 옆넘침 | 페이지가 옆으로 밀린다(px) |
| 화면밖 | 화면 밖으로 나가 못 읽는/못 누르는 것 (옆으로 미는 상자 안은 뺀다) |
| 세로깨짐 | 칸이 좁아 글자가 한 글자씩 세로로 쌓였다 |
| 두줄단추 | 단추·탭 글자가 두 줄로 접혔다 |
| 작은단추 | 누를 것이 가로·세로 모두 24px 미만 |
| 작은입력 | 입력칸 글씨 16px 미만(아이폰이 누를 때 화면을 키운다) |
| 떠있음 | 화면에 떠 있는 것이 덮은 넓이(%) |

숫자는 «찾는 그물»이다 — 0 이 목표가 아니라, 걸린 것을 갈무리로 보고 사람이 판단한다.
