#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pureun AI Router - Google Antigravity MCP 브릿지 서버
=====================================================
Google Antigravity IDE (~/.gemini/antigravity/mcp_config.json) 및
Antigravity CLI (~/.gemini/antigravity-cli/mcp_config.json)에서
내 컴퓨터의 푸른 통합 AI 라우터(http://127.0.0.1:8787)에 연결된
GPT, Claude, Gemini, 사내 로컬 Ollama(Qwen/Llama)를 직접 호출·비교하는 MCP 서버입니다.
"""
from __future__ import annotations

import concurrent.futures
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

ROUTER_BASE = os.environ.get("PUREUN_ROUTER_URL", "http://127.0.0.1:8787").rstrip("/")
def _key_from_file() -> str:
    try:
        return open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "client_key.txt"), encoding="utf-8").read().strip()
    except Exception:
        return ""
ROUTER_KEY = os.environ.get("PUREUN_API_KEY") or _key_from_file()   # ★ 보안판 — 누구나 아는 기본 열쇠 대신 이 PC 열쇠

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


TOOLS_SPEC: List[Dict[str, Any]] = [
    {
        "name": "ask_gpt",
        "description": "내 PC 푸른 통합 라우터를 통해 OpenAI GPT 모델(기본 openai/gpt-4o)에게 질문·코드 검토를 요청합니다. 주민번호·연락처는 자동 마스킹됩니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "전달할 질문이나 코드 내용"},
                "model": {"type": "string", "description": "호출할 모델 코드 (기본값: openai/gpt-4o)"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "ask_claude",
        "description": "내 PC 푸른 통합 라우터를 통해 Anthropic Claude 모델(기본 anthropic/claude-sonnet-4-5)에게 코드 작성·법률/노무 초안 검토를 요청합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "전달할 질문이나 코드 내용"},
                "model": {"type": "string", "description": "호출할 모델 코드 (기본값: anthropic/claude-sonnet-4-5)"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "ask_local_ollama",
        "description": "외부 인터넷 전송 없이 사내 내 컴퓨터의 로컬 Ollama AI(기본 ollama/qwen2.5:32b)를 무료로 호출합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "전달할 질문이나 기밀 문서 내용"},
                "model": {"type": "string", "description": "로컬 모델명 (기본값: ollama/qwen2.5:32b)"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "ask_multi_ai_compare",
        "description": "동일한 질문을 여러 AI 모델(예: GPT, Claude, Gemini, 로컬 Ollama)에 동시에 보내 답변을 한눈에 비교합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "동시에 질문할 프롬프트"},
                "models": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "비교할 모델 목록 (미입력 시 google/gemini-2.5-flash, anthropic/claude-sonnet-4-5, openai/gpt-4o)",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "router_usage_status",
        "description": "내 컴퓨터 푸른 통합 AI 라우터의 이번 달 호출 건수, 누적 원화 추산 비용, 개인정보 마스킹 보호 건수를 조회합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
]


def _call_router_chat(model: str, prompt: str) -> str:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }
    req = urllib.request.Request(
        f"{ROUTER_BASE}/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ROUTER_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
            meta = data.get("pureun_router_meta") or {}
            masked = meta.get("masked_pii_count", 0)
            suffix = f"\n\n(라우터 보호: 개인정보 {masked}건 자동 마스킹됨)" if masked else ""
            return f"[{data.get('model', model)}]\n{text}{suffix}"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return f"[{model} 오류 HTTP {e.code}] {err_body}"
    except Exception as e:
        return f"[{model} 연결 실패] 내 PC에서 푸른 통합 라우터(1_PC설치_및_실행.bat)가 켜져 있는지 확인해 주세요. ({e})"


def execute_tool(name: str, args: Dict[str, Any]) -> str:
    if name == "ask_gpt":
        return _call_router_chat(args.get("model") or "openai/gpt-4o", str(args.get("prompt", "")))
    if name == "ask_claude":
        return _call_router_chat(args.get("model") or "anthropic/claude-sonnet-4-5", str(args.get("prompt", "")))
    if name == "ask_local_ollama":
        return _call_router_chat(args.get("model") or "ollama/qwen2.5:32b", str(args.get("prompt", "")))
    if name == "ask_multi_ai_compare":
        prompt = str(args.get("prompt", ""))
        models = args.get("models") or [
            "google/gemini-2.5-flash",
            "anthropic/claude-sonnet-4-5",
            "openai/gpt-4o",
        ]
        results: List[str] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(models), 5)) as pool:
            futs = [pool.submit(_call_router_chat, m, prompt) for m in models]
            for f in futs:
                results.append(f.result())
        return "\n\n====================\n\n".join(results)
    if name == "router_usage_status":
        try:
            with urllib.request.urlopen(f"{ROUTER_BASE}/api/status", timeout=10) as resp:
                st = json.loads(resp.read().decode("utf-8"))
                s = st.get("stats", {}).get("summary", {})
                return (
                    f"이번 달 총 호출: {s.get('total_calls', 0)}건 | "
                    f"누적 토큰: {s.get('total_tokens', 0)} | "
                    f"추산 비용: {round(float(s.get('total_cost_krw', 0))):,}원 | "
                    f"개인정보 마스킹 보호: {s.get('total_masked', 0)}건"
                )
        except Exception as e:
            return f"상태 조회 실패: {e}"
    raise ValueError(f"알 수 없는 도구입니다: {name}")


def read_jsonrpc_message() -> Optional[Dict[str, Any]]:
    line = sys.stdin.readline()
    if not line:
        return None
    stripped = line.strip()
    if not stripped:
        return {}
    if stripped.lower().startswith("content-length:"):
        length = int(stripped.split(":", 1)[1].strip())
        while True:
            hdr = sys.stdin.readline()
            if not hdr or hdr in ("\r\n", "\n"):
                break
        body = sys.stdin.read(length)
        return json.loads(body)
    return json.loads(stripped)


def write_jsonrpc_response(msg_id: Any, result: Optional[Dict[str, Any]] = None, error: Optional[Dict[str, Any]] = None) -> None:
    payload: Dict[str, Any] = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["result"] = result
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    while True:
        try:
            msg = read_jsonrpc_message()
        except Exception:
            continue
        if msg is None:
            break
        if not msg:
            continue

        method = msg.get("method", "")
        msg_id = msg.get("id")
        params = msg.get("params") or {}

        # 알림(Notification) 메시지는 응답 생략
        if msg_id is None:
            continue

        if method == "initialize":
            client_ver = params.get("protocolVersion") or "2024-11-05"
            write_jsonrpc_response(
                msg_id,
                result={
                    "protocolVersion": client_ver,
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "pureun-ai-router", "version": "2.1.0"},
                },
            )
        elif method == "ping":
            write_jsonrpc_response(msg_id, result={})
        elif method == "tools/list":
            write_jsonrpc_response(msg_id, result={"tools": TOOLS_SPEC})
        elif method == "tools/call":
            t_name = params.get("name", "")
            t_args = params.get("arguments") or {}
            try:
                out_text = execute_tool(t_name, t_args)
                write_jsonrpc_response(
                    msg_id,
                    result={"content": [{"type": "text", "text": out_text}], "isError": False},
                )
            except Exception as exc:
                write_jsonrpc_response(
                    msg_id,
                    result={"content": [{"type": "text", "text": f"오류: {exc}"}], "isError": True},
                )
        else:
            write_jsonrpc_response(
                msg_id,
                error={"code": -32601, "message": f"Method not found: {method}"},
            )


if __name__ == "__main__":
    main()
