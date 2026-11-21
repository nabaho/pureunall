# -*- coding: utf-8 -*-
"""푸른노무법인 경력관리 «요청 메일» — 이 PC 안에서만 도는 Laya 판단기 (대표 지시 2026-11-19
「laya 라는 프로그램 사용해서 설치하고 판단하는 기능 넣어서 만들어 달라」)

무엇을 하나
  경력관리 화면(kcareer.html)이 제목·첨부 이름을 http://127.0.0.1:18766/judge 로 보내면,
  Laya(ConvAI Innovations 의 무료 판단 모델, Apache-2.0) 다국어 판으로 «이력·회의·비용인가 / 고객 업무인가»를 고르고
  {"v": "personal"|"work", "p": 업무일 확률} 만 돌려준다. 화면은 이것을 «의견»으로만 적는다(메일을 옮기지 않는다).

지키는 것
  · 127.0.0.1 에만 묶는다 — 같은 공유기의 다른 기기·인터넷에서 닿지 않는다.
  · 받는 쪽 주소(Origin)는 푸른 ERP 두 주소(functions/erp-origins.js 와 같다)와 이 PC 의 미리보기(127.0.0.1·localhost)뿐이다.
    Host 머리글도 127.0.0.1·localhost 만 받는다(DNS 리바인딩 막기).
  · 받은 글은 저장하지도, 기록(로그)에 남기지도 않는다. 판단에만 쓰고 버린다.
  · 돌 때는 인터넷에 나가지 않는다(HF_HUB_OFFLINE=1). 모델은 설치 때(--download) 한 번 받고, 판(revision)을 못 박는다.
  · 파일·명령을 다루는 길이 없다 — 판단 말고는 아무것도 하지 않는다.

정확도 (숨기지 않는다)
  실제 요청 메일 64건(2026-11-19, 이 PC 안에서만 계산)에 대어 보니: 대표가 처리 완료한 6건 중 3건을 «업무»로 봤고,
  치운 58건 중 25건만 «업무»로 봤다. 그래서 화면은 이 판단으로 메일을 옮기지 않고, 대표 판단과 맞는 비율만 센다.

쓰는 법
  python laya_judge.py              판단기를 켠다(설치 스크립트가 로그인할 때 pythonw 로 켜 둔다)
  python laya_judge.py --download   모델을 받아 둔다(설치 때 한 번 — 이때만 인터넷을 쓴다)
  PUREUN_LAYA_FAKE=1                시험용 — 모델 없이 정해진 답을 낸다(tests/laya-judge.test.js)
"""
import json
import os
import re
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# pythonw(창 없이 켬)에는 출력 자리가 없다 — 진행 막대·경고가 None 에 쓰다 죽지 않게 빈 자리로 돌린다
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")             # Hugging Face 로 사용 기록을 보내지 않는다
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

HOST = "127.0.0.1"
PORT = int(os.environ.get("PUREUN_LAYA_PORT", "18766"))          # js/kcareer-mailreq.js 의 LAYA_PORT 와 같다
# ⚠ 18765 는 이 PC 의 «푸른 한글편집기» 실행 도우미 자리다(2026-11-08부터 · 편집기 자동 저장이 그 주소에 묶여 옮길 수 없다).
#   2026-11-19 에 판단기를 같은 자리에 깔아 편집기가 켜지지 않았다 → 2026-11-21 판단기를 옮겼다.
LAYA_VERSION = "0.4.37"                                            # install.ps1 이 까는 판
MODEL_REVISION = "e333cb7c823cd1787276228260f56d02fbf5180b"        # 2026-11-19 에 실제 64건으로 재 본 모델 판(convaiinnovations/laya · multilingual)
ERP_ORIGINS = ("https://nabaho.github.io", "https://erp.pureunlabor.co.kr")   # functions/erp-origins.js ERP_ORIGINS 와 같다
LOCAL_ORIGIN = re.compile(r"^http://(127\.0\.0\.1|localhost)(:\d{1,5})?$")
LOCAL_HOST = re.compile(r"^(127\.0\.0\.1|localhost)(:\d{1,5})?$")
MAX_BODY = 64 * 1024                                               # 받는 글 한도(바이트)
MAX_DRAIN = 1024 * 1024                                            # 한도를 넘은 글을 읽어 버리는 끝(이보다 크면 읽지 않고 끊는다)
MAX_ITEMS = 20                                                     # 한 번에 판단하는 건수(화면 LAYA_MAX 이하)
S_MAX, AN_MAX, AN_LEN = 200, 3, 80                                 # 제목 글자 · 첨부 수 · 첨부 이름 글자
ID_RE = re.compile(r"^[^/.#$\[\]]{1,80}~[0-9]{1,12}$")              # js/kcareer-mailreq.js 의 건 번호 꼴
FAKE = os.environ.get("PUREUN_LAYA_FAKE") == "1"
LOG = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "PureunLaya", "laya-judge.log")

# 묻는 말 — 실제 64건·지어낸 40건에서 «한국어 둘 중 고르기»가 가장 나았다(영어·네 갈래 고르기는 거의 다 «업무»로 답함)
QUESTION = {"scope": {"type": "choice", "instructions": "이 메일은 무엇에 관한 것인가?", "criteria": {
    "personal": "노무사 본인의 이력서·경력·위원 활동·회의·수당·비용",
    "work": "고객 회사의 노무 업무: 급여·근로계약·근로자·노동 사건·컨설팅 산출물"}}}

_state = {"router": None, "ready": False, "error": "", "since": 0}
_lock = threading.Lock()                                            # 모델은 한 번에 하나씩


def log(msg):
    """시작·오류만 적는다 — 받은 제목·첨부 이름은 절대 적지 않는다."""
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n")
    except OSError:
        pass


def _router():
    from laya import Router                                         # 무거운 가져오기는 여기서만(시험용 FAKE 는 laya 없이 돈다)
    return Router(device="cpu", vega=False, revision=MODEL_REVISION)


def load_model():
    if FAKE:
        _state.update(ready=True, since=time.time())
        return
    os.environ["HF_HUB_OFFLINE"] = "1"                              # 돌 때는 인터넷에 안 나간다 — 설치 때 받아 둔 것만
    try:
        r = _router()
        r.predict({"subject": "준비", "body": "준비"}, QUESTION)     # 처음 한 번 데워 둔다
        _state.update(router=r, ready=True, since=time.time())
        log("모델 준비 끝")
    except Exception as e:                                           # noqa: BLE001 — 무엇이든 «못 켰다»로 알린다
        _state["error"] = "%s: %s" % (type(e).__name__, str(e)[:160])
        log("모델을 못 켰습니다 — " + _state["error"])


def judge_one(s, an):
    """제목·첨부 이름 → (v, p). p 는 «업무»일 확률."""
    if FAKE:                                                         # 시험용 — 글에 «업무» 가 있으면 업무
        p = 0.9 if "업무" in s else 0.1
        return ("work" if p >= 0.5 else "personal"), p
    text = s + ("\n첨부: " + ", ".join(an) if an else "")
    with _lock:
        a = _state["router"].predict({"subject": s, "body": text}, QUESTION)["answers"]["scope"]
    probs = a.get("probabilities") or {}
    p = probs.get("work") if isinstance(probs, dict) else None
    if not isinstance(p, (int, float)) or not (0 <= float(p) <= 1):
        raise ValueError("모르는 답")
    p = float(p)
    return ("work" if p >= 0.5 else "personal"), round(p, 4)


def clean_items(raw):
    """화면이 보낸 것에서 «건 번호·제목·첨부 이름»만 꺼낸다. 모양이 틀리면 버린다."""
    out, seen = [], set()
    for x in raw if isinstance(raw, list) else []:
        if len(out) >= MAX_ITEMS:
            break
        if not isinstance(x, dict):
            continue
        i, s, an = x.get("id"), x.get("s"), x.get("an")
        if not isinstance(i, str) or not ID_RE.match(i) or i in seen or not isinstance(s, str):
            continue
        names = [n[:AN_LEN] for n in (an if isinstance(an, list) else []) if isinstance(n, str) and n.strip()][:AN_MAX]
        seen.add(i)
        out.append((i, s[:S_MAX], names))
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "PureunLaya/1"
    sys_version = ""

    def log_message(self, *args):                                   # 요청 줄도 남기지 않는다(받은 글이 섞일 수 있다)
        return

    def _origin_ok(self):
        o = self.headers.get("Origin")
        if o is None:                                                # 브라우저 밖(이 PC 의 명령줄 등) — 127.0.0.1 에만 묶여 있으니 받는다
            return True, None
        if o in ERP_ORIGINS or LOCAL_ORIGIN.match(o):
            return True, o
        return False, o

    def _host_ok(self):
        return bool(LOCAL_HOST.match(self.headers.get("Host") or ""))

    def _send(self, code, obj, origin=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def _guard(self):
        if not self._host_ok():
            self._send(421, {"ok": False, "error": "이 PC 주소(127.0.0.1)로만 받습니다"})
            return None
        ok, origin = self._origin_ok()
        if not ok:
            self._send(403, {"ok": False, "error": "푸른 ERP 화면에서만 받습니다"})
            return None
        return origin or ""

    def do_OPTIONS(self):                                            # 브라우저가 먼저 묻는 것(CORS · 사설망 접근)
        origin = self._guard()
        if origin is None:
            return
        self.send_response(204)
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        origin = self._guard()
        if origin is None:
            return
        if self.path.split("?")[0] != "/health":
            self._send(404, {"ok": False, "error": "없는 길"}, origin)
            return
        self._send(200, {"ok": True, "ready": _state["ready"], "model": "laya-multilingual", "laya": LAYA_VERSION,
                         "revision": MODEL_REVISION[:12], "fake": FAKE, "error": _state["error"]}, origin)

    def do_POST(self):
        origin = self._guard()
        if origin is None:
            return
        if self.path.split("?")[0] != "/judge":
            self._send(404, {"ok": False, "error": "없는 길"}, origin)
            return
        if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
            self._send(415, {"ok": False, "error": "JSON 으로 보내 주세요"}, origin)
            return
        try:
            n = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            n = -1
        if n <= 0 or n > MAX_BODY:
            # 너무 긴 글도 1MB 까지는 읽어 버리고 답한다 — 안 읽고 끊으면 보내는 쪽이 «연결 끊김»으로 답을 못 받는 때가 있다
            if 0 < n <= MAX_DRAIN:
                self.rfile.read(n)
            self.close_connection = True
            self._send(413, {"ok": False, "error": "보낸 글이 비었거나 너무 깁니다"}, origin)
            return
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._send(400, {"ok": False, "error": "JSON 을 읽지 못했습니다"}, origin)
            return
        if not _state["ready"]:
            msg = "Laya 모델을 켜지 못했습니다 — 설치를 다시 해 주세요" if _state["error"] else "Laya 모델을 준비하는 중입니다 — 잠시 뒤 다시"
            self._send(503, {"ok": False, "error": msg}, origin)
            return
        items = clean_items(data.get("items") if isinstance(data, dict) else None)
        results = {}
        for i, s, an in items:
            try:
                v, p = judge_one(s, an)
                results[i] = {"v": v, "p": p}
            except Exception:                                        # noqa: BLE001 — 한 건을 못 해도 나머지는 간다(못 한 건은 답에서 빠진다)
                continue
        self._send(200, {"ok": True, "results": results}, origin)


def download():
    """설치 때 한 번 — 못 박은 판의 모델을 받아 두고, 한 번 판단해 본다."""
    os.environ.pop("HF_HUB_OFFLINE", None)
    r = _router()
    a = r.predict({"subject": "평가위원 위촉 안내", "body": "평가위원 위촉 안내"}, QUESTION)["answers"]["scope"]
    print("모델을 받아 두었습니다 — 시험 판단: %s" % a.get("choice"))


def make_server():
    """자리를 «혼자» 쥔다. 기본 HTTP 서버는 SO_REUSEADDR 를 켜는데, 윈도우에서는 그러면 이미 다른 프로그램이 듣는 자리에도
    소리 없이 묶여 버려 어느 쪽이 받을지 모르게 된다(2026-11-21 한글편집기와 겹친 까닭). 그래서 끄고, 윈도우에서는 독점으로 묶는다
    — 자리가 이미 쓰이면 여기서 OSError 가 나 «켜지 못했습니다»로 알린다."""
    httpd = ThreadingHTTPServer((HOST, PORT), Handler, bind_and_activate=False)
    httpd.allow_reuse_address = False
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        httpd.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        httpd.server_bind()
        httpd.server_activate()
    except BaseException:
        httpd.server_close()
        raise
    return httpd


def main():
    if "--download" in sys.argv:
        download()
        return
    try:
        httpd = make_server()
    except OSError as e:
        log("켜지 못했습니다(이미 켜져 있을 수 있습니다) — %s" % e)
        print("이미 켜져 있거나 %d 번 자리를 다른 프로그램이 씁니다: %s" % (PORT, e), file=sys.stderr)
        sys.exit(1)
    httpd.daemon_threads = True
    threading.Thread(target=load_model, daemon=True).start()
    log("켰습니다 — http://%s:%d (FAKE=%s)" % (HOST, PORT, FAKE))
    print("Laya 판단기 — http://%s:%d" % (HOST, PORT), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
