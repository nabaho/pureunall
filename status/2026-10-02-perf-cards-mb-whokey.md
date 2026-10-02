# perf/cards-mb-whokey — 기업정보함 첫 화면 멈춤 줄이기 (2026-10-02)

- 대표 화면: 「10초 중 676ms 멈춤 · coListBuild 73ms · mbWhoKey 70ms(186,969번) · mbSpamWhy 32ms(15,056번)」.
- 메일함이 메일 7천여 통을 그릴 때마다 같은 주소를 몇 번이고 다시 판정했다.
  - `mbWhoKey`: 같은 글자 → 같은 답이라 답을 기억한다(함수에 붙인 상자, 5만 개 상한). 낡을 수 없다.
  - `mbIsSpam`: 그리는 동안만 사는 셈(mbMemoOf)에 메일별 판정을 담는다.
  - `mbWhoWhy`: 그리는 동안 «주소 하나에 한 번». 색인 한 판에 묶고, 넘겨받은 색인이 있으면 색인을 또 찾지 않는다.
    속은 `mbWhoWhyOf` 로 떼었다(검사 둘의 싣는 목록에 더함).
  - `mbWhoBust`(사람이 바꿈·서버 값 도착)에서 위 셈을 버린다.
- 검사: `tests/cards-mb-hot-memo.test.js`, 기존 메일 검사 손봄(mail-spam-filter·mail-sent-by-owner·mail-work-owner).

## 남은 일
- 대표 PC 에서 다시 재 본다 — 「처음 뜰 때 느린 까닭」 줄의 멈춤 ms 와 🐌 목록.
