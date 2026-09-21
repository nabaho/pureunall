# 창고(Storage)에서 «fetch 로» 읽으려면 버킷에 CORS 를 넣어야 한다

2026-09-21, 명함 사진 421장을 창고로 옮기려다 걸렸다. 브라우저가 이렇게 말했다:

```
Access to fetch at 'https://firebasestorage.googleapis.com/v0/b/pureun-erp-photos/o/pucards%2F…'
from origin 'https://nabaho.github.io' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 왜 규칙·권한 문제가 «아닌가»

셋 다 확인했다 — **서버 쪽은 멀쩡하다.**

| 확인한 것 | 결과 |
|---|---|
| 창고 규칙(`pucards/photos`) | 읽기·쓰기·지우기 모두 `isStaff()` — 열려 있다 |
| 규칙의 `okImage()` | 421장 **전부 통과**(모두 jpeg · 가장 큰 것 3.2MB < 10MB) |
| 미리요청(preflight `OPTIONS`) | `200` + `Access-Control-Allow-Origin: *` — **통과한다** |
| 오류 응답(401·403) | 역시 `Access-Control-Allow-Origin: *` 이 붙어서 온다 |

막히는 것은 **성공한 «본 응답»(200 + 사진 바이트)** 하나다.
파이어베이스 앞단이 내주는 오류·미리요청에는 CORS 머리글이 붙지만,
**실제 파일은 버킷이 직접 내주고, 그때는 버킷에 CORS 설정이 있어야** 머리글이 붙는다.
**두 번째 버킷(기본 버킷이 아닌 것)은 그 설정이 비어 있는 채로 만들어진다.**

## 어느 앱이 걸리고 어느 앱이 안 걸리나

- `<img src="...">` 로 그리는 곳은 **안 걸린다** — 그림 태그는 CORS 를 안 본다.
- **`fetch()` 로 받아 data:URL 로 바꾸는 곳만** 걸린다.
  기업정보함(`_fetchFromBucket`)과 사진첩(`pu-photo-store.js` 의 `fetchFromBucket`)이 그 꼴이다.

사진첩은 **다른 버킷**(`pureun-erp-hrphotos`)을 쓰고 잘 돌아간다 —
그 버킷에는 CORS 가 들어 있고 `pureun-erp-photos` 에는 없는 것으로 보인다.
⚠ 확인은 못 했다(버킷 설정을 읽을 자격이 이 PC 에 없다). 아래 명령으로 **찍어 보면 바로 안다.**

## 고치는 법 — 구글 클라우드 콘솔의 Cloud Shell (설치할 것 없음)

1. https://console.cloud.google.com/ → 프로젝트 `pureun-erp` → 오른쪽 위 **Cloud Shell(>_)** 을 연다
2. 지금 설정을 **먼저 본다**(비어 있으면 `[]` 가 나온다):
   ```bash
   gcloud storage buckets describe gs://pureun-erp-photos --format="value(cors_config)"
   gcloud storage buckets describe gs://pureun-erp-hrphotos --format="value(cors_config)"
   ```
   → 사진첩(hrphotos)에는 있고 명함(photos)에는 없으면 위 짐작이 맞는 것이다.
3. 넣는다:
   ```bash
   cat > cors.json <<'EOF'
   [
     {
       "origin": ["https://nabaho.github.io", "http://localhost:8799", "http://127.0.0.1:8799"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Type", "Content-Length", "Content-Range", "Content-Disposition"],
       "maxAgeSeconds": 3600
     }
   ]
   EOF
   gcloud storage buckets update gs://pureun-erp-photos --cors-file=cors.json
   ```
4. 다시 찍어 들어갔는지 본다(2번 명령).

같은 내용이 이 폴더의 `storage-cors.json` 에도 있다 — **고칠 일이 생기면 그 파일을 고치고
여기 붙여 둔 것도 함께 고친다**(둘이 어긋나면 어느 쪽이 맞는지 아무도 모른다).

## 넣고 나면

- 기업정보함 → 설정 → **계정 · 관리** → **☁ 사진 창고로 옮기기** 를 다시 누른다.
  수 분 걸리고, 끝나면 「✅ 끝났습니다 — 옮김 421장」이 뜬다.
- ⚠ **그 전에는 누르지 마시라** — 한 장도 안 옮겨지고 시간만 쓴다(자료는 안전하다).

## ⚠ 이것이 «옮기기»만의 문제가 아니다

`pureun-erp-photos` 는 **명함 사진과 메일 첨부**가 함께 쓰는 창고다.
CORS 가 없으면 **그 창고에서 fetch 로 읽는 일이 전부** 막힌다.
2026-08-26 에 「새 사진은 창고로」 고쳤는데도 실시간DB 사진이 417 → 421 로 늘어난 것도
이것으로 설명된다 — 창고 쓰기가 실패하면 **조용히 실시간DB 로 물러서게** 돼 있다
(`putPhoto` 의 `catch`). 즉 그 고침은 **한 번도 제대로 듣지 않았을 수 있다.**

⚠ 넣은 뒤에 **명함 사진이 잘 보이는지** 한 번 확인할 것.

## 남은 버킷

창고가 셋이다. 같은 일이 벌어질 수 있으니 **한꺼번에 찍어 보는 편이 낫다**:
`pureun-erp-photos`(명함·메일) · `pureun-erp-hrphotos`(사진첩·서고) ·
`pureun-erp.firebasestorage.app`(급여데이터함).
