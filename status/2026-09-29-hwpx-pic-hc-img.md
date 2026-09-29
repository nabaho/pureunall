# 경력관리 — 도장·사진 그림 조각을 한글이 «날것 그대로» 여는 꼴로

- 남은 일(2026-09-29-kcareer-stamp-pick.md 끝줄)을 마쳤다: 도장(`js/kcareer-hwpstamp.js`)·사진(`js/kcareer-hwpxphoto.js`)
  그림 조각이 `<hp:img>` 대신 `<hc:img>`(core 이름칸) 를 imgDim 바로 뒤에 쓰고, 이어서 `<hp:effects></hp:effects>`.
  rhwp 가 다시 내보내는 꼴·한컴이 스스로 넣는 꼴과 같다. 나머지는 그대로.
- 까닭: `<hp:img>` 가 든 HWPX 는 한컴(COM Open)이 False. 그동안은 rhFinalizeHwpx 가 다시 써서 가려졌을 뿐 —
  그 단계가 실패하면(날것을 돌려준다) 한글에서 안 열렸다.
- 확인(시험 서식 「성명 홍길동 (인)」에 도장):
  한컴 12.0 COM — 도장 없는 것 열림 · **새 꼴 날것 열림 + PDF 에 도장 보임** · 옛 꼴(hp:img) **안 열림** · rhwp 재출력본 열림.
  rhwp(Node) — 새 꼴을 읽고 SVG 에 그림이 그려지고, reflow·exportHwpx 뒤에도 pic·BinData 가 남는다.
  사진 모듈은 같은 짜임이라 rhwp·검사로만 봤다(한컴 실측은 도장만).
- 검사: 두 모듈에 「hp:img 없음 · imgDim 뒤 hc:img 뒤 effects」 규칙 추가. 캐시 번호 hwpstamp v7 · hwpxphoto v2.
- ⚠ COM 으로 시험할 때: 경로에 파일 이름이 빠지면 한컴이 «자기 파일도» 못 연다(False) — 파일 탓으로 오해하기 쉽다.
