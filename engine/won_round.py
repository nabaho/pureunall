# -*- coding: utf-8 -*-
"""
급여 금액의 원 미만 처리 — **반올림** (대표 결정 2026-10-05 「원미만 반올림」)

⚠ 왜 있나 — 대장 수식(일할 계산 =ROUND(N13*209,-1)/31*29, =S39*4.5% 등)이 칸에
  원 미만을 남긴다. 엑셀은 칸 표시 형식(#,##0)으로 반올림해 «보여» 주지만 칸 속
  값은 436897.14285714284 같은 소수다. 파서는 칸 속 값을 읽으므로 그대로 두면
  명세서에 436,897.143 이 찍힌다(실측 2026-10-05: 원 금액 칸 9,511개 · 34곳).
  원본 대장 표본 21칸 중 20칸이 정수 표시 형식이었다 — 반올림이 «대장에 보이는 값»과 같다.

⚠ 반올림은 엑셀과 같게 한다 —
  ① 먼저 유효숫자 15자리로 맞춘다(엑셀이 그렇게 들고 보여 준다).
     2646319.9999999995 는 2646320 이고, 436897.49999999994 는 «.5» 로 본다.
  ② 0.5 는 0 에서 먼 쪽으로(사사오입). 파이썬 round() 는 짝수 쪽(은행가 반올림)이라
     83534.5 → 83534 가 되어 대장(83,535)과 1원 어긋난다 — 쓰지 말 것.

⚠ 시급·근무시간·근무일수·평균시간은 **건드리지 않는다** — 지급액이 아니라 단가·양이다.
  (통상시급 9,860.28원 같은 값은 소수가 맞다.)

⚠ 맞물림 — 명세서는 임금총액을 «실수령 + 공제총액»으로 셈한다(payroll-os.html slipRows).
  둘 다 정수면 그 식은 저절로 정확하다. 남는 걱정은 대장의 지급총액과의 1원 차이다:
  원래(소수 상태) 지급총액 − 공제 = 실수령 이던 사람이 따로 반올림한 뒤 1원 어긋나면
  실수령을 «반올림한 지급총액 − 반올림한 공제»로 맞춘다(공제총액도 항목 합과 같던
  사람은 반올림한 항목 합으로 맞춘다). 실측에서는 0명이었다 — 안전장치이고, 맞춘
  사람 수는 세어 알린다.
"""
from decimal import Decimal, ROUND_HALF_UP

WON_FIELDS = ("기본급", "과세총액", "지급총액", "실수령", "공제총액",
              "소득세", "지방세", "국민연금", "건강보험", "장기요양", "고용보험",
              "연말정산", "기타공제", "일당")
DED_ITEMS = ("소득세", "지방세", "국민연금", "건강보험", "장기요양", "고용보험",
             "연말정산", "기타공제")


def round_won(v):
    """원 미만 반올림(엑셀과 같게). 정수·None·글자는 그대로 돌려준다."""
    if isinstance(v, bool) or not isinstance(v, float):
        return v
    if v != v or v in (float("inf"), float("-inf")):
        return v
    return int(Decimal(format(v, ".15g")).quantize(Decimal(1), ROUND_HALF_UP))


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def round_emp(e):
    """직원 한 줄의 금액 칸을 원 단위로. 새 dict 와 «맞춘 칸» 목록을 돌려준다."""
    out = dict(e)
    for k in WON_FIELDS:
        if k in out:
            out[k] = round_won(out[k])
    fixed = []

    items = [e[k] for k in DED_ITEMS if _num(e.get(k))]
    if _num(e.get("공제총액")) and items and abs(e["공제총액"] - sum(items)) < 0.5:
        s = sum(out[k] for k in DED_ITEMS if _num(out.get(k)))
        if out["공제총액"] != s:
            out["공제총액"] = s
            fixed.append("공제총액")

    g, n = e.get("지급총액"), e.get("실수령")
    d = e.get("공제총액") if _num(e.get("공제총액")) else (sum(items) if items else None)
    if _num(g) and _num(n) and d is not None and abs(g - d - n) < 0.5:
        rd = out["공제총액"] if _num(out.get("공제총액")) else sum(
            out[k] for k in DED_ITEMS if _num(out.get(k)))
        if out["지급총액"] - rd != out["실수령"]:
            out["실수령"] = out["지급총액"] - rd
            fixed.append("실수령")
    return out, fixed

