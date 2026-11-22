# 2026-11-22 · feat/edulib-slides — 강의자료 PPT 를 «작은 슬라이드»로 늘어놓아 보기

대표 지시(2026-11-22, 자세히 화면 갈무리와 함께) 「PPT 자료 원본을 작게 해 가지고 진열 보여줄 수 있을까? 그렇게 해야 어떻게 강의했는지 비교가 되는데」.
(같은 말의 뒤 절반 「기존 강의를 바꾼 게 있다면 마지막에 언제 강의랑 유사하다 표시」는 다음 가지에서.)

## 바꾼 것
- `js/pu-pptx-render.js`(새) — pptx(zip 안 XML)를 읽어 슬라이드를 SVG 로 다시 그린다. 원본은 읽기만.
  - 읽는 것: 보여 주는 순서(sldIdLst) · 슬라이드 크기 · 테마 색(schemeClr·clrMap·lumMod/lumOff/tint/shade) · 바탕(슬라이드→레이아웃→마스터, 색·그림) ·
    도형(자리·크기·회전·칠·선·네모/둥근네모/타원) · 자리(placeholder) 위치·글자 모양을 레이아웃·마스터에서 물려받기 · 마스터 장식 도형(showMasterSp) ·
    글자(크기·굵기·기울임·밑줄·색·정렬·글머리, Wingdings 글머리는 비슷한 기호로) · 그림(png·jpg·gif·bmp·webp·svg) · 묶음(좌표 바꾸기) · 표 · 선.
  - «대략 모양» — 차트·도식(SmartArt)·개체는 이름만 쓴 회색 칸, EMF·WMF 그림은 «그림» 칸, 별·화살표 같은 도형은 네모로. 화면에 그렇게 적어 둔다.
  - XML 은 이 파일의 작은 해석기로 읽는다(브라우저·node 검사가 같은 코드). 문서 글자는 textContent 로만 넣는다.
- `pu-slides-frame.html`·`js/pu-slides-frame.js`(새) — 격리 칸. 강의자료 화면이 `sandbox="allow-scripts"` 로만 연다(allow-same-origin 없음).
  CSP `default-src 'none'; script-src 'self'; connect-src 'none'; img-src blob: data:`. 문서뷰어 격리 칸과 같은 말(ready·open·opened·page·goto·close).
  작게 늘어놓고(−/+ 로 크기 4단) · 누르면 크게(◀ ▶·화살표 키·Esc) · 큰 자료는 8장씩 나눠 그린다(300장까지).
- `js/pu-edulib-app.js` — 파워포인트(pptx·ppsx) 미리보기는 «▦ 슬라이드»가 기본, 칸 아래 «≡ 글자» 단추로 예전 «글자만 보기»로 바꿀 수 있다(고른 보기는 이 브라우저에 기억).
  나란히 보기에서도 칸마다 슬라이드가 늘어서 «어떻게 강의했는지» 비교된다. 워드(docx)는 예전처럼 글자 보기.
- `js/pu-ontology.js` — 새 격리 칸을 «제외 화면»에(저장 자리 없음 · 문서뷰어 격리 칸과 같은 자리) · 캐시 109.
- `tools/phone-audit` — 시드가 «지어낸 창고 파일»(지어낸 pptx)을 내주는 길(storageFiles) · 슬라이드 화면(slides) ·
  격리 칸이 공개 화면 스크립트(js/·vendor/ 의 .js)를 부르는 요청만 좁게 허용 · `PA_CONSOLE=1` 이면 칸까지 콘솔 오류와 막은 요청을 찍는다.
- 검사: `tests/edulib-slides.test.js`(7개 — 격리·textContent·순서·테마 색·자리 물려받기·그림·묶음·표) · `tests/edulib-auth-open.test.js` 의 then·catch 세기를 겹쳐 세도록 고침.

## 확인한 것
- 이 PC 의 실제 강의 PPT 세 개(47·46·38장)를 격리 칸에 넣어 갈무리(올리지 않음): 2초 남짓에 다 그려짐, 그림·색·글자 자리가 원본에 가깝다. 제목 칸은 슬라이드 제목.
- 점검 도구(가짜 자료·지어낸 pptx)로 앱 안에서 끝까지: 자세히 → 왼쪽 칸에 슬라이드 · «1/2쪽» 넘기기 · «≡ 글자» — 1366px·375px 둘 다.

## 못 한 것
- 실제 자료(배포본)로는 합친 뒤 본다.
