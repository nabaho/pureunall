#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pureun Unified LLM Router (푸른 통합 AI 라우터) v1.0
====================================================
외부 중계 수수료 없이 사내 PC·서버(Windows / Linux / macOS)에서 직접 구동하는
단일 API 기반 멀티 LLM 게이트웨이 서버입니다.

주요 기능:
1. 단일 OpenAI 호환 API (/v1/chat/completions, /v1/models)로
   OpenAI(GPT), Anthropic(Claude), Google(Gemini), 로컬 Ollama(Qwen/Llama 등) 통합 호출
2. Claude Code 연동용 Anthropic Messages API (/v1/messages) 양방향 프로토콜 자동 변환
3. 한국형 개인정보(주민등록번호·사업자번호·연락처·이메일·계좌) 실시간 비식별화 및 로컬 자동 복원
4. 사내 앱·직원별 가상 API 키 발급, 월 예산(원화) 한도 차단, 본문 무보관(Zero Data Retention) 감사 로그
5. 추가 pip 패키지 설치 없이 Python 3.9+ 기본 표준 라이브러리만으로 즉시 실행 (내장 웹 관리자 콘솔 포함)

실행 방법:
    python pureun_llm_router.py --port 8787
브라우저 접속:
    http://localhost:8787
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent

# ★ 2026-11-17 보안판 (푸른 저장소 tools/pureun-ai) — 누구나 아는 열쇠(sk-pureun-local-dev)를 없앴다.
#   설치할 때 이 PC 에서만 쓰는 열쇠를 새로 만들어 client_key.txt 에 둔다. MCP·터미널도 같은 파일을 읽는다.
LEGACY_KEY = "sk-pureun-local-dev"
def load_client_key() -> str:
    f = BASE_DIR / "client_key.txt"
    try:
        k = f.read_text(encoding="utf-8").strip()
        if k.startswith("sk-pureun-") and len(k) >= 30:
            return k
    except Exception:
        pass
    import secrets as _s
    k = "sk-pureun-" + _s.token_hex(20)
    try:
        f.write_text(k, encoding="utf-8")
    except Exception:
        pass
    return k
CLIENT_KEY = os.environ.get("PUREUN_DEFAULT_KEY") or load_client_key()
DEFAULT_DB_PATH = Path(os.environ.get("PUREUN_ROUTER_DB", str(BASE_DIR / "router_data.db")))
ADMIN_SESSION_TOKEN = secrets.token_hex(16)

# 대략적인 기본 토큰 참고 단가 (USD / 1M tokens: input, output) - 콘솔 비용 추산용
MODEL_PRICING_USD_PER_1M: Dict[str, Tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-5": (2.50, 10.00),
    "o3-mini": (1.10, 4.40),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-3-7-sonnet": (3.00, 15.00),
    "claude-opus-4-1": (15.00, 75.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.15, 0.60),
    "gemini-2.0-flash": (0.10, 0.40),
}

DEFAULT_SETTINGS: Dict[str, str] = {
    "openai_api_key": os.environ.get("OPENAI_API_KEY", ""),
    "anthropic_api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
    "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
    "openai_base_url": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    "anthropic_base_url": os.environ.get("ANTHROPIC_BASE_URL_UPSTREAM", "https://api.anthropic.com"),
    "gemini_base_url": os.environ.get(
        "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
    ),
    "ollama_base_url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
    "ollama_enabled": "1",
    "default_auto_models": "ollama/qwen2.5:32b,google/gemini-2.5-flash,openai/gpt-4o-mini,anthropic/claude-sonnet-4-5",
    "pii_masking_enabled": "1",
    "pii_reversible_unmask": "1",
    "skip_masking_for_local": "1",
    "zero_data_retention": "1",
    "blocked_keywords": "",
    "usd_to_krw": "1400",
    "admin_password": os.environ.get("PUREUN_ADMIN_PASSWORD", ""),
}


class RouterStore:
    """스레드 안전한 SQLite 설정·키·사용량 저장소"""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    key_token TEXT NOT NULL UNIQUE,
                    monthly_limit_krw INTEGER NOT NULL DEFAULT 0,
                    allowed_prefixes TEXT NOT NULL DEFAULT '*',
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    month_ym TEXT NOT NULL,
                    key_name TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    prompt_tokens INTEGER NOT NULL DEFAULT 0,
                    completion_tokens INTEGER NOT NULL DEFAULT 0,
                    cost_krw REAL NOT NULL DEFAULT 0.0,
                    latency_ms INTEGER NOT NULL DEFAULT 0,
                    masked_items INTEGER NOT NULL DEFAULT 0,
                    status_code INTEGER NOT NULL DEFAULT 200,
                    prompt_preview TEXT NOT NULL DEFAULT ''
                )
                """
            )
            for k, v in DEFAULT_SETTINGS.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                    (k, v),
                )
            cur = conn.execute("SELECT COUNT(*) AS cnt FROM api_keys")
            if cur.fetchone()["cnt"] == 0:
                now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                default_key = CLIENT_KEY
                conn.execute(
                    """
                    INSERT INTO api_keys (name, key_token, monthly_limit_krw, allowed_prefixes, active, created_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                    """,
                    ("기본 사내 개발키", default_key, 0, "*", now),
                )
            # 옛 공용 열쇠는 끈다 — 누구나 아는 값이다. 대신 이 PC 열쇠가 없으면 넣는다.
            conn.execute("UPDATE api_keys SET active = 0 WHERE key_token = ?", (LEGACY_KEY,))
            if not conn.execute("SELECT 1 FROM api_keys WHERE key_token = ?", (CLIENT_KEY,)).fetchone():
                now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                conn.execute(
                    "INSERT INTO api_keys (name, key_token, monthly_limit_krw, allowed_prefixes, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
                    ("이 PC 열쇠", CLIENT_KEY, 0, "*", now),
                )
            conn.commit()

    def get_settings(self) -> Dict[str, str]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            result = dict(DEFAULT_SETTINGS)
            for r in rows:
                result[r["key"]] = r["value"]
            return result

    def update_settings(self, updates: Dict[str, Any]) -> None:
        with self._lock, self._connect() as conn:
            for k, v in updates.items():
                if k in DEFAULT_SETTINGS:
                    conn.execute(
                        "INSERT INTO settings (key, value) VALUES (?, ?) "
                        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                        (k, str(v)),
                    )
            conn.commit()

    def list_keys(self) -> List[Dict[str, Any]]:
        ym = dt.datetime.now().strftime("%Y-%m")
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT k.id, k.name, k.key_token, k.monthly_limit_krw, k.allowed_prefixes, k.active, k.created_at,
                       COALESCE(SUM(u.cost_krw), 0.0) AS month_spend_krw,
                       COUNT(u.id) AS month_calls
                FROM api_keys k
                LEFT JOIN usage_logs u ON u.key_name = k.name AND u.month_ym = ?
                GROUP BY k.id
                ORDER BY k.id ASC
                """,
                (ym,),
            ).fetchall()
            return [dict(r) for r in rows]

    def create_key(self, name: str, monthly_limit_krw: int = 0, allowed_prefixes: str = "*") -> Dict[str, Any]:
        token = f"sk-pureun-{secrets.token_hex(12)}"
        now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO api_keys (name, key_token, monthly_limit_krw, allowed_prefixes, active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """,
                (name.strip() or "사내 앱 키", token, int(monthly_limit_krw), allowed_prefixes.strip() or "*", now),
            )
            conn.commit()
        return {"name": name, "key_token": token, "monthly_limit_krw": monthly_limit_krw}

    def delete_key(self, key_id: int) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM api_keys WHERE id = ?", (int(key_id),))
            conn.commit()

    def validate_client_key(self, token: str, provider: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        if not token:
            return False, "API 키가 누락되었습니다. Authorization: Bearer sk-pureun-... 헤더를 전달하세요.", None
        ym = dt.datetime.now().strftime("%Y-%m")
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM api_keys WHERE key_token = ? AND active = 1", (token,)
            ).fetchone()
            if not row:
                return False, "유효하지 않거나 비활성화된 사내 API 키입니다.", None
            key_info = dict(row)
            allowed = key_info["allowed_prefixes"].strip()
            if allowed and allowed != "*":
                allowed_set = {p.strip().lower() for p in allowed.split(",") if p.strip()}
                if provider.lower() not in allowed_set:
                    return False, f"이 API 키는 '{provider}' 제공사 호출이 허용되지 않았습니다.", key_info
            limit_krw = int(key_info["monthly_limit_krw"] or 0)
            if limit_krw > 0:
                spend_row = conn.execute(
                    "SELECT COALESCE(SUM(cost_krw), 0.0) AS spend FROM usage_logs WHERE key_name = ? AND month_ym = ?",
                    (key_info["name"], ym),
                ).fetchone()
                if float(spend_row["spend"]) >= limit_krw:
                    return False, f"월 예산 한도({limit_krw:,}원)를 초과하여 호출이 자동 차단되었습니다.", key_info
            return True, "ok", key_info

    def log_usage(
        self,
        key_name: str,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost_krw: float,
        latency_ms: int,
        masked_items: int,
        status_code: int,
        prompt_preview: str,
    ) -> None:
        now = dt.datetime.now()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO usage_logs (
                    ts, month_ym, key_name, provider, model, prompt_tokens, completion_tokens,
                    cost_krw, latency_ms, masked_items, status_code, prompt_preview
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    now.strftime("%Y-%m-%d %H:%M:%S"),
                    now.strftime("%Y-%m"),
                    key_name,
                    provider,
                    model,
                    int(prompt_tokens),
                    int(completion_tokens),
                    round(float(cost_krw), 4),
                    int(latency_ms),
                    int(masked_items),
                    int(status_code),
                    prompt_preview[:160],
                ),
            )
            conn.commit()

    def get_stats(self) -> Dict[str, Any]:
        ym = dt.datetime.now().strftime("%Y-%m")
        with self._lock, self._connect() as conn:
            summary = conn.execute(
                """
                SELECT COUNT(*) AS total_calls,
                       COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens,
                       COALESCE(SUM(cost_krw), 0.0) AS total_cost_krw,
                       COALESCE(SUM(masked_items), 0) AS total_masked
                FROM usage_logs
                WHERE month_ym = ?
                """,
                (ym,),
            ).fetchone()
            by_provider = conn.execute(
                """
                SELECT provider, model, COUNT(*) AS calls,
                       COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens,
                       COALESCE(SUM(cost_krw), 0.0) AS cost_krw,
                       ROUND(AVG(latency_ms), 0) AS avg_ms
                FROM usage_logs
                WHERE month_ym = ?
                GROUP BY provider, model
                ORDER BY calls DESC
                """,
                (ym,),
            ).fetchall()
            recent = conn.execute(
                """
                SELECT id, ts, key_name, provider, model, prompt_tokens, completion_tokens,
                       cost_krw, latency_ms, masked_items, status_code, prompt_preview
                FROM usage_logs
                ORDER BY id DESC
                LIMIT 30
                """
            ).fetchall()
            return {
                "month_ym": ym,
                "summary": dict(summary),
                "by_model": [dict(r) for r in by_provider],
                "recent_logs": [dict(r) for r in recent],
            }

    def export_logs_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "일시",
                "정산월",
                "호출키(부서/앱)",
                "제공사",
                "모델",
                "입력토큰",
                "출력토큰",
                "추산비용(원)",
                "응답속도(ms)",
                "개인정보마스킹건수",
                "상태코드",
                "요약로그",
            ]
        )
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM usage_logs ORDER BY id DESC LIMIT 5000").fetchall()
            for r in rows:
                writer.writerow(
                    [
                        r["ts"],
                        r["month_ym"],
                        r["key_name"],
                        r["provider"],
                        r["model"],
                        r["prompt_tokens"],
                        r["completion_tokens"],
                        round(r["cost_krw"], 2),
                        r["latency_ms"],
                        r["masked_items"],
                        r["status_code"],
                        r["prompt_preview"],
                    ]
                )
        return "\ufeff" + output.getvalue()


class KoreanPIIGuard:
    """
    한국 인사·노무·법률 실무용 개인정보 비식별화 및 가역 복원기.
    외부 AI 모델(OpenAI, Anthropic, Google)로 전송하기 전 민감정보를 토큰으로 치환하고,
    응답 수신 시 사내 메모리에서만 원본 값으로 복원합니다.
    """

    PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
        # 주민등록번호 / 외국인등록번호 (YYMMDD-1XXXXXX)
        ("주민번호", re.compile(r"(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-[1-8]\d{6}(?!\d)")),
        # 사업자등록번호 (XXX-XX-XXXXX)
        ("사업자번호", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)")),
        # 휴대전화 및 일반 전화번호
        ("연락처", re.compile(r"(?<!\d)01[016789]-\d{3,4}-\d{4}(?!\d)|(?<!\d)0(?:2|[3-6][1-5]|70)-\d{3,4}-\d{4}(?!\d)")),
        # 이메일 주소
        ("이메일", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
        # 계좌번호 형태 (앞 패턴 제외 후 3~6자리-2~6자리-4~8자리)
        ("계좌번호", re.compile(r"(?<!\d)\d{3,6}-\d{2,6}-\d{4,8}(?!\d)")),
    ]

    def __init__(self, reversible: bool = True) -> None:
        self.reversible = reversible
        self.token_to_orig: Dict[str, str] = {}
        self.orig_to_token: Dict[str, str] = {}
        self.counters: Dict[str, int] = {}
        self.masked_count: int = 0

    def mask_text(self, text: str) -> str:
        if not text:
            return text
        masked = text
        for label, pattern in self.PATTERNS:
            def _repl(match: re.Match[str]) -> str:
                raw = match.group(0)
                if raw in self.orig_to_token:
                    self.masked_count += 1
                    return self.orig_to_token[raw]
                idx = self.counters.get(label, 0) + 1
                self.counters[label] = idx
                token = f"[{label}_{idx}]"
                self.orig_to_token[raw] = token
                self.token_to_orig[token] = raw
                self.masked_count += 1
                return token

            masked = pattern.sub(_repl, masked)
        return masked

    def mask_payload(self, obj: Any) -> Any:
        if isinstance(obj, str):
            return self.mask_text(obj)
        if isinstance(obj, list):
            return [self.mask_payload(item) for item in obj]
        if isinstance(obj, dict):
            out: Dict[str, Any] = {}
            for k, v in obj.items():
                # 모델명, 역할(role), 도구 이름, 타입 식별자는 마스킹 제외
                if k in ("model", "role", "type", "id", "name", "finish_reason", "stop_reason"):
                    out[k] = v
                else:
                    out[k] = self.mask_payload(v)
            return out
        return obj

    def unmask_text(self, text: str) -> str:
        if not self.reversible or not text or not self.token_to_orig:
            return text
        restored = text
        for token, orig in self.token_to_orig.items():
            if token in restored:
                restored = restored.replace(token, orig)
        return restored


class StreamUnmaskBuffer:
    """SSE 스트리밍 청크에서 '[주민번호_1]' 같은 플레이스홀더가 쪼개져 들어와도 안전하게 복원"""

    def __init__(self, guard: KoreanPIIGuard) -> None:
        self.guard = guard
        self.buf = ""

    def push(self, chunk_text: str) -> str:
        if not self.guard.reversible or not self.guard.token_to_orig:
            return chunk_text
        self.buf += chunk_text
        open_idx = self.buf.rfind("[")
        close_idx = self.buf.rfind("]")
        if open_idx != -1 and (close_idx == -1 or close_idx < open_idx):
            # 열린 '[' 이후 아직 ']'가 안 왔고 길이가 20자 이내라면 다음 청크까지 대기
            if len(self.buf) - open_idx <= 20:
                emit_part = self.buf[:open_idx]
                self.buf = self.buf[open_idx:]
                return self.guard.unmask_text(emit_part)
        out = self.guard.unmask_text(self.buf)
        self.buf = ""
        return out

    def flush(self) -> str:
        if not self.buf:
            return ""
        out = self.guard.unmask_text(self.buf)
        self.buf = ""
        return out


def check_blocked_keywords(payload: Any, keywords_csv: str) -> Optional[str]:
    if not keywords_csv.strip():
        return None
    keywords = [w.strip() for w in keywords_csv.split(",") if w.strip()]
    if not keywords:
        return None
    dumped = json.dumps(payload, ensure_ascii=False)
    for kw in keywords:
        if kw in dumped:
            return kw
    return None


def estimate_cost_krw(provider: str, model: str, prompt_tokens: int, completion_tokens: int, usd_to_krw: float) -> float:
    if provider == "ollama":
        return 0.0
    m_lower = model.lower()
    in_rate, out_rate = (1.00, 4.00)
    for key, rates in sorted(MODEL_PRICING_USD_PER_1M.items(), key=lambda x: -len(x[0])):
        if key in m_lower:
            in_rate, out_rate = rates
            break
    usd = (prompt_tokens * in_rate + completion_tokens * out_rate) / 1_000_000.0
    return usd * usd_to_krw


def resolve_provider_and_model(raw_model: str, settings: Dict[str, str]) -> List[Tuple[str, str]]:
    """
    모델 문자열을 분석해 (provider, upstream_model_name) 후보 리스트(자동 폴백용)를 반환합니다.
    예:
      - 'openai/gpt-4o' -> [('openai', 'gpt-4o')]
      - 'anthropic/claude-sonnet-4-5' -> [('anthropic', 'claude-sonnet-4-5')]
      - 'google/gemini-2.5-flash' -> [('google', 'gemini-2.5-flash')]
      - 'ollama/qwen2.5:32b' -> [('ollama', 'qwen2.5:32b')]
      - 'pureun/auto' 또는 'auto' -> 설정된 우선순위 체인 중 키가 등록된 모델 자동 선택
    """
    m = (raw_model or "").strip()
    if not m or m.lower() in ("auto", "pureun/auto", "bizrouter/route"):
        candidates: List[Tuple[str, str]] = []
        for item in settings.get("default_auto_models", "").split(","):
            item = item.strip()
            if not item:
                continue
            sub = resolve_provider_and_model(item, settings)
            for prov, mod in sub:
                if _is_provider_configured(prov, settings):
                    candidates.append((prov, mod))
        if not candidates:
            # 아무 키도 없으면 로컬 Ollama 기본 폴백
            candidates.append(("ollama", "qwen2.5:32b"))
        return candidates

    if "/" in m:
        prefix, rest = m.split("/", 1)
        p = prefix.lower().strip()
        if p in ("openai", "gpt"):
            return [("openai", rest)]
        if p in ("anthropic", "claude"):
            return [("anthropic", rest)]
        if p in ("google", "gemini"):
            return [("google", rest)]
        if p in ("ollama", "local"):
            return [("ollama", rest)]

    ml = m.lower()
    if ml.startswith(("gpt-", "o1", "o3", "o4", "chatgpt-")):
        return [("openai", m)]
    if ml.startswith("claude-"):
        return [("anthropic", m)]
    if ml.startswith("gemini-"):
        return [("google", m)]
    return [("ollama", m)]


def _is_provider_configured(provider: str, settings: Dict[str, str]) -> bool:
    if provider == "openai":
        return bool(settings.get("openai_api_key", "").strip())
    if provider == "anthropic":
        return bool(settings.get("anthropic_api_key", "").strip())
    if provider == "google":
        return bool(settings.get("gemini_api_key", "").strip())
    if provider == "ollama":
        return settings.get("ollama_enabled", "1") == "1" and bool(settings.get("ollama_base_url", "").strip())
    return False


# ============================================================================
# 프로토콜 변환기: OpenAI Chat Completions <-> Anthropic Messages API
# ============================================================================

def openai_req_to_anthropic_req(body: Dict[str, Any], target_model: str) -> Dict[str, Any]:
    """OpenAI /v1/chat/completions 요청을 Anthropic /v1/messages 형식으로 변환"""
    messages = body.get("messages", [])
    system_parts: List[str] = []
    anth_messages: List[Dict[str, Any]] = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("system", "developer"):
            if isinstance(content, str):
                system_parts.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        system_parts.append(part.get("text", ""))
            continue

        if role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": msg.get("tool_call_id", "tool_call_1"),
                "content": content if isinstance(content, str) else json.dumps(content, ensure_ascii=False),
            }
            if anth_messages and anth_messages[-1]["role"] == "user" and isinstance(anth_messages[-1]["content"], list):
                anth_messages[-1]["content"].append(block)
            else:
                anth_messages.append({"role": "user", "content": [block]})
            continue

        anth_role = "assistant" if role == "assistant" else "user"
        blocks: List[Dict[str, Any]] = []
        if isinstance(content, str) and content:
            blocks.append({"type": "text", "text": content})
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        blocks.append({"type": "text", "text": part.get("text", "")})
                    elif part.get("type") == "image_url":
                        url = (part.get("image_url") or {}).get("url", "")
                        if url.startswith("data:") and ";base64," in url:
                            header, b64 = url.split(";base64,", 1)
                            media_type = header.replace("data:", "") or "image/jpeg"
                            blocks.append(
                                {
                                    "type": "image",
                                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                                }
                            )

        if role == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                fn = tc.get("function") or {}
                raw_args = fn.get("arguments", "{}")
                try:
                    parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    parsed_args = {"raw": raw_args}
                blocks.append(
                    {
                        "type": "tool_use",
                        "id": tc.get("id", f"toolu_{secrets.token_hex(6)}"),
                        "name": fn.get("name", "tool"),
                        "input": parsed_args,
                    }
                )

        if not blocks:
            blocks = [{"type": "text", "text": " "}]

        # Anthropic은 동일 role 연속 배치를 허용하지 않으므로 병합
        if anth_messages and anth_messages[-1]["role"] == anth_role:
            prev_c = anth_messages[-1]["content"]
            if isinstance(prev_c, str):
                anth_messages[-1]["content"] = [{"type": "text", "text": prev_c}] + blocks
            else:
                prev_c.extend(blocks)
        else:
            anth_messages.append({"role": anth_role, "content": blocks})

    if not anth_messages:
        anth_messages = [{"role": "user", "content": "안녕하세요."}]

    max_tokens = body.get("max_tokens") or body.get("max_completion_tokens") or 4096
    anth_body: Dict[str, Any] = {
        "model": target_model,
        "max_tokens": int(max_tokens),
        "messages": anth_messages,
    }
    if system_parts:
        anth_body["system"] = "\n\n".join(system_parts)
    if "temperature" in body and body["temperature"] is not None:
        anth_body["temperature"] = float(body["temperature"])
    if body.get("stream"):
        anth_body["stream"] = True

    if body.get("tools"):
        anth_tools = []
        for t in body["tools"]:
            if t.get("type") == "function" and t.get("function"):
                fn = t["function"]
                anth_tools.append(
                    {
                        "name": fn.get("name", "tool"),
                        "description": fn.get("description", ""),
                        "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
                    }
                )
        if anth_tools:
            anth_body["tools"] = anth_tools
    return anth_body


def anthropic_resp_to_openai_resp(
    anth_resp: Dict[str, Any], requested_model: str, guard: KoreanPIIGuard
) -> Dict[str, Any]:
    """Anthropic /v1/messages JSON 응답을 OpenAI chat.completion 형식으로 변환"""
    text_parts: List[str] = []
    tool_calls: List[Dict[str, Any]] = []
    for block in anth_resp.get("content", []):
        btype = block.get("type")
        if btype == "text":
            text_parts.append(guard.unmask_text(block.get("text", "")))
        elif btype == "tool_use":
            args_str = json.dumps(block.get("input", {}), ensure_ascii=False)
            tool_calls.append(
                {
                    "id": block.get("id", f"call_{secrets.token_hex(6)}"),
                    "type": "function",
                    "function": {
                        "name": block.get("name", ""),
                        "arguments": guard.unmask_text(args_str),
                    },
                }
            )

    stop_map = {
        "end_turn": "stop",
        "stop_sequence": "stop",
        "max_tokens": "length",
        "tool_use": "tool_calls",
    }
    finish_reason = stop_map.get(anth_resp.get("stop_reason", "end_turn"), "stop")
    usage = anth_resp.get("usage") or {}
    in_tok = int(usage.get("input_tokens", 0))
    out_tok = int(usage.get("output_tokens", 0))

    message_obj: Dict[str, Any] = {
        "role": "assistant",
        "content": "".join(text_parts) if text_parts or not tool_calls else None,
    }
    if tool_calls:
        message_obj["tool_calls"] = tool_calls

    return {
        "id": anth_resp.get("id", f"chatcmpl-{secrets.token_hex(8)}"),
        "object": "chat.completion",
        "created": int(time.time()),
        "model": requested_model,
        "choices": [
            {
                "index": 0,
                "message": message_obj,
                "finish_reason": finish_reason,
            }
        ],
        "usage": {
            "prompt_tokens": in_tok,
            "completion_tokens": out_tok,
            "total_tokens": in_tok + out_tok,
        },
    }


def anthropic_req_to_openai_req(body: Dict[str, Any], target_model: str) -> Dict[str, Any]:
    """Claude Code 등에서 들어온 Anthropic /v1/messages 요청을 OpenAI 형식으로 변환"""
    oai_messages: List[Dict[str, Any]] = []
    sys_prompt = body.get("system")
    if isinstance(sys_prompt, str) and sys_prompt.strip():
        oai_messages.append({"role": "system", "content": sys_prompt})
    elif isinstance(sys_prompt, list):
        joined = "\n".join(b.get("text", "") for b in sys_prompt if isinstance(b, dict) and b.get("type") == "text")
        if joined.strip():
            oai_messages.append({"role": "system", "content": joined})

    for msg in body.get("messages", []):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if isinstance(content, str):
            oai_messages.append({"role": role, "content": content})
        elif isinstance(content, list):
            texts: List[str] = []
            tool_calls: List[Dict[str, Any]] = []
            tool_results: List[Dict[str, Any]] = []
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "text":
                    texts.append(block.get("text", ""))
                elif btype == "tool_use":
                    tool_calls.append(
                        {
                            "id": block.get("id", f"call_{secrets.token_hex(6)}"),
                            "type": "function",
                            "function": {
                                "name": block.get("name", "tool"),
                                "arguments": json.dumps(block.get("input", {}), ensure_ascii=False),
                            },
                        }
                    )
                elif btype == "tool_result":
                    tr_content = block.get("content", "")
                    if isinstance(tr_content, list):
                        tr_content = "\n".join(
                            x.get("text", "") for x in tr_content if isinstance(x, dict)
                        )
                    tool_results.append(
                        {
                            "role": "tool",
                            "tool_call_id": block.get("tool_use_id", "call_1"),
                            "content": str(tr_content),
                        }
                    )
            if role == "assistant" and (texts or tool_calls):
                m_obj: Dict[str, Any] = {"role": "assistant", "content": "\n".join(texts) if texts else None}
                if tool_calls:
                    m_obj["tool_calls"] = tool_calls
                oai_messages.append(m_obj)
            elif texts:
                oai_messages.append({"role": role, "content": "\n".join(texts)})
            for tr in tool_results:
                oai_messages.append(tr)

    oai_body: Dict[str, Any] = {
        "model": target_model,
        "messages": oai_messages,
    }
    if body.get("max_tokens"):
        oai_body["max_tokens"] = int(body["max_tokens"])
    if "temperature" in body and body["temperature"] is not None:
        oai_body["temperature"] = float(body["temperature"])
    if body.get("stream"):
        oai_body["stream"] = True
    if body.get("tools"):
        oai_tools = []
        for t in body["tools"]:
            oai_tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": t.get("name", "tool"),
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema") or {"type": "object", "properties": {}},
                    },
                }
            )
        if oai_tools:
            oai_body["tools"] = oai_tools
    return oai_body


def openai_resp_to_anthropic_resp(
    oai_resp: Dict[str, Any], requested_model: str, guard: KoreanPIIGuard
) -> Dict[str, Any]:
    """OpenAI chat.completion JSON 응답을 Anthropic /v1/messages 응답으로 변환"""
    choice = (oai_resp.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content_blocks: List[Dict[str, Any]] = []
    if msg.get("content"):
        content_blocks.append({"type": "text", "text": guard.unmask_text(str(msg["content"]))})
    for tc in msg.get("tool_calls") or []:
        fn = tc.get("function") or {}
        raw_args = guard.unmask_text(fn.get("arguments", "{}"))
        try:
            parsed_args = json.loads(raw_args)
        except Exception:
            parsed_args = {"raw": raw_args}
        content_blocks.append(
            {
                "type": "tool_use",
                "id": tc.get("id", f"toolu_{secrets.token_hex(6)}"),
                "name": fn.get("name", "tool"),
                "input": parsed_args,
            }
        )
    if not content_blocks:
        content_blocks.append({"type": "text", "text": ""})

    finish = choice.get("finish_reason", "stop")
    stop_reason = "tool_use" if finish == "tool_calls" else ("max_tokens" if finish == "length" else "end_turn")
    usage = oai_resp.get("usage") or {}
    return {
        "id": oai_resp.get("id", f"msg_{secrets.token_hex(8)}"),
        "type": "message",
        "role": "assistant",
        "model": requested_model,
        "content": content_blocks,
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {
            "input_tokens": int(usage.get("prompt_tokens", 0)),
            "output_tokens": int(usage.get("completion_tokens", 0)),
        },
    }


# ============================================================================
# 업스트림 HTTP 호출 및 SSE 스트림 파이프라인
# ============================================================================

def build_upstream_request(
    provider: str,
    target_model: str,
    openai_style_body: Dict[str, Any],
    settings: Dict[str, str],
) -> Tuple[str, Dict[str, str], bytes, str]:
    """
    (url, headers, encoded_body, upstream_protocol) 반환.
    upstream_protocol 은 'openai' 또는 'anthropic'.
    """
    if provider == "openai":
        api_key = settings.get("openai_api_key", "").strip()
        if not api_key:
            raise ValueError("OpenAI API 키가 설정되지 않았습니다. 관리자 콘솔에서 등록해 주세요.")
        base = settings.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
        payload = dict(openai_style_body, model=target_model)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        return f"{base}/chat/completions", headers, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "openai"

    if provider == "google":
        api_key = settings.get("gemini_api_key", "").strip()
        if not api_key:
            raise ValueError("Google Gemini API 키가 설정되지 않았습니다. 관리자 콘솔에서 등록해 주세요.")
        base = settings.get(
            "gemini_base_url", "https://generativelanguage.googleapis.com/v1beta/openai"
        ).rstrip("/")
        payload = dict(openai_style_body, model=target_model)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        return f"{base}/chat/completions", headers, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "openai"

    if provider == "ollama":
        base = settings.get("ollama_base_url", "http://localhost:11434/v1").rstrip("/")
        payload = dict(openai_style_body, model=target_model)
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer ollama",
        }
        return f"{base}/chat/completions", headers, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "openai"

    if provider == "anthropic":
        api_key = settings.get("anthropic_api_key", "").strip()
        if not api_key:
            raise ValueError("Anthropic(Claude) API 키가 설정되지 않았습니다. 관리자 콘솔에서 등록해 주세요.")
        base = settings.get("anthropic_base_url", "https://api.anthropic.com").rstrip("/")
        if base.endswith("/v1"):
            url = f"{base}/messages"
        else:
            url = f"{base}/v1/messages"
        anth_payload = openai_req_to_anthropic_req(openai_style_body, target_model)
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        return url, headers, json.dumps(anth_payload, ensure_ascii=False).encode("utf-8"), "anthropic"

    raise ValueError(f"지원하지 않는 제공사입니다: {provider}")


def iter_sse_lines(resp: Any) -> Generator[str, None, None]:
    while True:
        raw_line = resp.readline()
        if not raw_line:
            break
        yield raw_line.decode("utf-8", errors="replace").rstrip("\r\n")


# ============================================================================
# 내장 웹 관리자 콘솔 UI (한국어 단일 페이지)
# ============================================================================



def detect_access_urls(port: int = 8787) -> Dict[str, Any]:
    """현재 PC의 사무실 Wi-Fi(LAN) 주소와 외부 접속용 Tailscale 주소를 자동 감지합니다."""
    lan_ips: List[str] = []
    tailscale_ips: List[str] = []

    # 1. 기본 아웃바운드 소켓으로 주 LAN IP 확인
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        s.connect(("8.8.8.8", 80))
        primary_ip = s.getsockname()[0]
        s.close()
        if primary_ip and not primary_ip.startswith("127."):
            lan_ips.append(primary_ip)
    except Exception:
        pass

    # 2. Windows ipconfig 또는 호스트 인터페이스에서 추가 LAN / Tailscale(100.x.x.x) 탐색
    if os.name == "nt":
        try:
            out = subprocess.check_output(["ipconfig"], stderr=subprocess.DEVNULL, timeout=2).decode(
                "cp949", errors="replace"
            )
            for m in re.findall(r"(\d{1,3}(?:\.\d{1,3}){3})", out):
                if m.startswith(("192.168.", "10.", "172.")) and not m.endswith(".255") and not m.endswith(".1"):
                    if m not in lan_ips:
                        lan_ips.append(m)
                elif m.startswith("100.") and not m.endswith(".255"):
                    if m not in tailscale_ips:
                        tailscale_ips.append(m)
        except Exception:
            pass
    else:
        try:
            host_ips = socket.gethostbyname_ex(socket.gethostname())[2]
            for m in host_ips:
                if m.startswith("100.") and m not in tailscale_ips:
                    tailscale_ips.append(m)
                elif not m.startswith("127.") and m not in lan_ips:
                    lan_ips.append(m)
        except Exception:
            pass

    lan_url = f"http://{lan_ips[0]}:{port}/app" if lan_ips else f"http://내PC_IP주소:{port}/app"
    ts_url = f"http://{tailscale_ips[0]}:{port}/app" if tailscale_ips else ""
    return {
        "pc_app_url": f"http://localhost:{port}/app",
        "pc_admin_url": f"http://localhost:{port}/admin",
        "lan_phone_url": lan_url,
        "tailscale_phone_url": ts_url,
        "lan_ips": lan_ips,
        "tailscale_ips": tailscale_ips,
    }




# ============================================================================
# 푸른 통합 코딩 명령창 (/studio) 백엔드 헬퍼 및 UI
# ============================================================================


import base64


def transcribe_audio_base64(audio_b64: str, mime_type: str, settings: Dict[str, str]) -> str:
    """
    녹음된 오디오(Base64)를 등록된 Gemini API 또는 OpenAI Whisper API를 통해
    한·영 혼용 코딩 용어까지 정확하게 텍스트로 변환합니다.
    """
    raw_audio = base64.b64decode(audio_b64)
    clean_mime = (mime_type or "audio/webm").split(";")[0].strip() or "audio/webm"

    # 1순위: Google Gemini API 키가 있으면 무료/저비용 멀티모달 오디오 인식 사용
    gemini_key = settings.get("gemini_api_key", "").strip()
    if gemini_key:
        gem_base = settings.get("gemini_base_url", "https://generativelanguage.googleapis.com/v1beta/openai")
        # OpenAI 호환 경로에서 v1beta 루트 추출
        v1beta_root = gem_base.split("/openai")[0].rstrip("/")
        url = f"{v1beta_root}/models/gemini-2.5-flash:generateContent?key={urllib.parse.quote(gemini_key)}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": "다음 음성을 한국어(영어 개발·코딩 용어 포함) 발음 그대로 정확히 받아적어 텍스트만 출력하세요. 부연 설명이나 따옴표 없이 받아적은 문장만 출력하세요."
                        },
                        {"inline_data": {"mime_type": clean_mime, "data": audio_b64}},
                    ]
                }
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            cands = res_json.get("candidates") or []
            if cands:
                parts = (cands[0].get("content") or {}).get("parts") or []
                txt = "".join(p.get("text", "") for p in parts).strip()
                if txt:
                    return txt

    # 2순위: OpenAI API 키가 있으면 /v1/audio/transcriptions (Whisper / GPT-Transcribe) 호출
    openai_key = settings.get("openai_api_key", "").strip()
    if openai_key:
        oai_base = settings.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
        boundary = "----PureunAudioBoundary7MA4YWxkTrZu0gW"
        ext = "webm" if "webm" in clean_mime else ("mp4" if "mp4" in clean_mime else "wav")
        body_parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n".encode("utf-8"),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nko\r\n".encode("utf-8"),
            (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.{ext}\"\r\n"
                f"Content-Type: {clean_mime}\r\n\r\n"
            ).encode("utf-8")
            + raw_audio
            + f"\r\n--{boundary}--\r\n".encode("utf-8"),
        ]
        multipart_bytes = b"".join(body_parts)
        req = urllib.request.Request(
            f"{oai_base}/audio/transcriptions",
            data=multipart_bytes,
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            return str(res_json.get("text", "")).strip()

    raise ValueError("AI 고정밀 음성 변환을 쓰시려면 관리자 설정에 Gemini 또는 OpenAI API 키를 등록해 주세요. (브라우저 기본 실시간 음성 인식은 키 없이도 작동합니다.)")




def synthesize_speech_base64(text: str, settings: Dict[str, str]) -> Tuple[str, str]:
    """
    브라우저 내장 한국어 음성이 없는 환경을 위한 서버 측 OpenAI TTS 폴백 (Base64 MP3 반환).
    """
    clean_text = (text or "").strip()[:1200]
    if not clean_text:
        raise ValueError("읽을 텍스트가 비어 있습니다.")

    openai_key = settings.get("openai_api_key", "").strip()
    if openai_key:
        oai_base = settings.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
        payload = {
            "model": "gpt-4o-mini-tts",
            "voice": "nova",
            "input": clean_text,
            "response_format": "mp3",
        }
        req = urllib.request.Request(
            f"{oai_base}/audio/speech",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            mp3_bytes = resp.read()
            return base64.b64encode(mp3_bytes).decode("ascii"), "audio/mpeg"

    raise ValueError("브라우저 기본 한국어 음성(SpeechSynthesis)을 사용하거나 OpenAI API 키를 등록해 주세요.")


SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}


def studio_list_files(root_dir: str, max_files: int = 200) -> Dict[str, Any]:
    root = Path(root_dir).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"폴더가 존재하지 않습니다: {root}")
    files: List[str] = []
    for cur_root, dirs, filenames in os.walk(root):
        dirs[:] = sorted([d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")])
        for fn in sorted(filenames):
            if fn.startswith(".") or fn.endswith((".pyc", ".exe", ".dll", ".db", ".zip", ".png", ".jpg", ".pdf")):
                continue
            full = Path(cur_root) / fn
            rel = full.relative_to(root).as_posix()
            files.append(rel)
            if len(files) >= max_files:
                break
        if len(files) >= max_files:
            break
    return {"root": str(root), "files": files}


def studio_safe_path(root_dir: str, rel_path: str) -> Path:
    root = Path(root_dir).expanduser().resolve()
    target = (root / rel_path).resolve()
    if root != target and root not in target.parents:
        raise ValueError("허용된 프로젝트 폴더 밖의 경로에는 접근할 수 없습니다.")
    return target


def studio_run_git(root_dir: str, action: str, message: str = "") -> Dict[str, Any]:
    root = Path(root_dir).expanduser().resolve()
    if not root.exists():
        raise ValueError(f"폴더를 찾을 수 없습니다: {root}")

    def _exec(cmd: List[str]) -> Tuple[int, str]:
        proc = subprocess.run(
            cmd,
            cwd=str(root),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=45,
        )
        out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
        return proc.returncode, out.strip()

    if action == "status":
        code, out = _exec(["git", "status", "-s", "-b"])
        return {"ok": code == 0, "output": out or "변경 사항 없음 (깨끗한 상태)"}

    if action == "commit_push":
        commit_msg = (message or "").strip() or f"Update via Pureun AI Studio ({dt.datetime.now().strftime('%Y-%m-%d %H:%M')})"
        c1, o1 = _exec(["git", "add", "-A"])
        c2, o2 = _exec(["git", "commit", "-m", commit_msg])
        # 원격 저장소가 설정되어 있는지 확인 후 push 시도
        c_rem, rem_out = _exec(["git", "remote"])
        if c_rem == 0 and rem_out.strip():
            c3, o3 = _exec(["git", "push"])
            combined = "\n".join(x for x in [o1, o2, o3] if x)
            return {"ok": c3 == 0, "output": combined or "커밋 및 GitHub 푸시 완료!"}
        combined = "\n".join(x for x in [o1, o2, "[안내] 로컬 커밋 완료 (연결된 GitHub 원격 주소가 없어 push는 생략됨)"] if x)
        return {"ok": c2 == 0, "output": combined}

    raise ValueError(f"지원하지 않는 Git 작업입니다: {action}")


def studio_run_external_agent(
    root_dir: str, agent_type: str, prompt: str, router_port: int, client_key: str, model: str = ""
) -> Dict[str, Any]:
    """내 PC에 설치된 외부 코딩 에이전트 CLI (Claude Code / Antigravity agy / Gemini CLI) 대리 실행"""
    root = Path(root_dir).expanduser().resolve()
    if not root.exists():
        raise ValueError(f"폴더를 찾을 수 없습니다: {root}")

    env = dict(os.environ)
    env["ANTHROPIC_BASE_URL"] = f"http://127.0.0.1:{router_port}"
    env["ANTHROPIC_API_KEY"] = client_key
    env["OPENAI_BASE_URL"] = f"http://127.0.0.1:{router_port}/v1"
    env["OPENAI_API_KEY"] = client_key

    use_shell = os.name == "nt"
    if agent_type == "claude_code":
        exe = shutil.which("claude") or shutil.which("claude.cmd")
        if not exe:
            return {
                "ok": False,
                "output": "[미설치 안내] PC에서 Claude Code(claude) 명령어를 찾지 못했습니다.\n상단 모드를 '단일 AI 코딩' 또는 '3대 AI 동시 비교'로 두시면 별도 프로그램 없이도 바로 파일 수정 코딩이 가능합니다!",
            }
        cmd = [exe, "-p", prompt]
        if model:
            cmd.extend(["--model", model])
    elif agent_type == "antigravity_cli":
        exe = shutil.which("agy") or shutil.which("agy.cmd")
        if not exe:
            return {
                "ok": False,
                "output": "[미설치 안내] PC에서 Antigravity CLI(agy) 명령어를 찾지 못했습니다.\n데스크톱 Antigravity 앱을 쓰신다면 4_안티그래비티_자동연결.bat 실행 후 앱 안에서 바로 사용하실 수 있습니다.",
            }
        cmd = [exe, prompt]
    elif agent_type == "gemini_cli":
        exe = shutil.which("gemini") or shutil.which("gemini.cmd")
        if not exe:
            return {
                "ok": False,
                "output": "[미설치 안내] PC에서 Gemini CLI(gemini) 명령어를 찾지 못했습니다.\n이 명령창의 '단일 AI 코딩 -> google/gemini-2.5-pro'를 선택하시면 설치 없이 바로 제미나이로 코딩됩니다!",
            }
        cmd = [exe, "-p", prompt]
    else:
        raise ValueError(f"알 수 없는 에이전트 종류: {agent_type}")

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(root),
            env=env,
            shell=use_shell if isinstance(cmd, str) else False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
        )
        out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
        return {"ok": proc.returncode == 0, "output": out.strip() or "(실행 완료 - 출력 없음)"}
    except Exception as e:
        return {"ok": False, "output": f"실행 중 오류 발생: {e}"}


STUDIO_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>푸른 통합 코딩 명령창 (Pureun AI Coding Studio)</title>
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --panel2: #0b1120; --line: #334155;
    --ink: #f8fafc; --muted: #94a3b8; --primary: #3b82f6; --accent: #10b981;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; height: 100vh; display: flex; flex-direction: column;
    font-family: 'Pretendard', 'Malgun Gothic', -apple-system, sans-serif;
    background: var(--bg); color: var(--ink); overflow: hidden;
  }
  header {
    background: #020617; border-bottom: 1px solid var(--line); padding: 10px 18px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .brand { font-size: 16px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
  .folder-bar { display: flex; gap: 8px; align-items: center; flex: 1; max-width: 620px; }
  .folder-bar input {
    flex: 1; background: #1e293b; border: 1px solid #475569; color: #fff;
    padding: 7px 12px; border-radius: 7px; font-size: 13px; font-family: ui-monospace, Consolas, monospace;
  }
  .btn {
    background: var(--primary); color: #fff; border: none; padding: 7px 13px;
    border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap;
  }
  .btn-green { background: var(--accent); color: #022c22; font-weight: 700; }
  .btn-dark { background: #334155; color: #e2e8f0; }
  .workspace { flex: 1; display: grid; grid-template-columns: 230px 1fr 440px; min-height: 0; }
  .sidebar { background: var(--panel2); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
  .sec-head {
    padding: 10px 12px; font-size: 12px; font-weight: 700; color: var(--muted);
    border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center;
  }
  .file-list { flex: 1; overflow-y: auto; padding: 6px; }
  .file-item {
    padding: 6px 10px; border-radius: 6px; font-size: 13px; cursor: pointer;
    color: #cbd5e1; word-break: break-all; font-family: ui-monospace, Consolas, monospace;
  }
  .file-item:hover { background: #1e293b; }
  .file-item.active { background: #1d4ed8; color: #fff; }
  .editor-pane { display: flex; flex-direction: column; border-right: 1px solid var(--line); min-height: 0; }
  #codeEditor {
    flex: 1; width: 100%; background: #0f172a; color: #e2e8f0; border: none;
    padding: 14px; font-family: 'Consolas', ui-monospace, monospace; font-size: 13.5px;
    line-height: 1.55; resize: none; outline: none;
  }
  .cmd-pane { background: var(--panel); display: flex; flex-direction: column; min-height: 0; }
  .mode-tabs { display: flex; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .m-tab {
    background: #0f172a; color: #94a3b8; border: 1px solid var(--line);
    padding: 6px 10px; border-radius: 7px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  }
  .m-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  #aiOutputArea { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .ans-card {
    background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; font-size: 13.5px;
  }
  .ans-card .ans-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 700; color: #38bdf8; font-size: 12.5px; }
  .ans-card pre {
    margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, Consolas, monospace;
    font-size: 12.5px; color: #e2e8f0; max-height: 320px; overflow-y: auto;
  }
  .cmd-box { padding: 12px; border-top: 1px solid var(--line); background: #020617; display: flex; flex-direction: column; gap: 8px; }
  .cmd-box select, .cmd-box textarea {
    width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569;
    border-radius: 8px; padding: 8px 10px; font-size: 13.5px; font-family: inherit;
  }
</style>
</head>
<body>
<header>
  <div class="brand">푸른 통합 코딩 명령창</div>
  <div class="folder-bar">
    <input type="text" id="rootInput" placeholder="작업할 내 컴퓨터 폴더 경로 (예: C:\PureunERP)">
    <button class="btn btn-dark" onclick="loadFiles()">폴더 열기</button>
    <button class="btn btn-dark" onclick="newFilePrompt()">+ 새 파일</button>
  </div>
  <div style="display:flex;gap:8px;align-items:center;">
    <button class="btn btn-dark" onclick="gitStatus()">Git 상태</button>
    <button class="btn btn-green" onclick="gitPush()">GitHub 커밋·푸시</button>
    <a class="btn btn-dark" href="/app">채팅앱</a>
    <a class="btn btn-dark" href="/admin">키 설정</a>
  </div>
</header>

<div class="workspace">
  <!-- 좌측: 내 컴퓨터 파일 트리 -->
  <div class="sidebar">
    <div class="sec-head"><span>내 프로젝트 파일 목록</span><span id="fileCount">0개</span></div>
    <div class="file-list" id="fileList"></div>
  </div>

  <!-- 중앙: 실시간 코드 편집기 -->
  <div class="editor-pane">
    <div class="sec-head">
      <span id="currentFileName">선택된 파일 없음 (왼쪽에서 파일을 클릭하거나 + 새 파일을 만드세요)</span>
      <button class="btn" onclick="saveCurrentFile()">파일 저장 (Ctrl+S)</button>
    </div>
    <textarea id="codeEditor" spellcheck="false" placeholder="이곳에 선택한 파일의 코드가 표시되며, 우측 통합 명령창에서 AI가 수정한 코드를 버튼 한 번으로 바로 반영할 수 있습니다."></textarea>
  </div>

  <!-- 우측: 통합 AI 명령창 -->
  <div class="cmd-pane">
    <div class="mode-tabs">
      <button class="m-tab active" onclick="setMode('single')">1) 단일 AI 코딩</button>
      <button class="m-tab" onclick="setMode('compare')">2) 3대 AI 동시 비교</button>
      <button class="m-tab" onclick="setMode('cli')">3) 외부 비서 호출(Claude·Antigravity)</button>
    </div>

    <div id="aiOutputArea">
      <div class="ans-card">
        <div class="ans-head"><span>통합 코딩 명령창 안내</span></div>
        <pre>하나의 창에서 모든 AI로 코딩하고 GitHub까지 올리는 사령탑입니다!
1. 상단에 내 프로젝트 폴더 경로를 넣고 [폴더 열기]를 누르세요.
2. 파일을 고른 뒤 아래 입력창에 원하는 수정 사항을 적고 [명령 실행]을 누르세요.
3. AI가 짜준 코드 카드의 [편집기에 바로 반영 & 저장]을 누르면 내 컴퓨터 파일이 즉시 수정됩니다.</pre>
      </div>
    </div>

    <div class="cmd-box">
      <select id="targetSelector">
        <option value="pureun/auto">자동 선택 (pureun/auto)</option>
        <option value="google/gemini-2.5-pro">Google Gemini 2.5 Pro</option>
        <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
        <option value="anthropic/claude-sonnet-4-5">Anthropic Claude Sonnet 4.5</option>
        <option value="openai/gpt-4o">OpenAI GPT-4o</option>
        <option value="ollama/qwen2.5:32b">내 컴퓨터 무료 로컬 AI (Ollama Qwen)</option>
      </select>

      <div style="display:flex;gap:6px;align-items:center;justify-content:space-between;font-size:12px;color:#94a3b8;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:180px;">
          <select id="sttEngineSelect" style="padding:4px 8px;font-size:12px;width:auto;">
            <option value="webspeech">실시간 음성인식 (무료·즉시 타이핑)</option>
            <option value="ai_stt">AI 고정밀 음성인식 (외장마이크·코딩용어 특화)</option>
          </select>
          <select id="micDeviceSelect" style="padding:4px 8px;font-size:12px;max-width:170px;display:none;" title="외장 마이크 선택"></select>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" id="voiceAutoRun" checked> '실행해' 자동 실행
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#38bdf8;">
            <input type="checkbox" id="ttsAutoSpeak" checked> 완료 시 음성 브리핑
          </label>
          <select id="ttsRateSelect" style="padding:3px 6px;font-size:11.5px;width:auto;" title="음성 읽기 속도">
            <option value="1.0">1.0x</option>
            <option value="1.15" selected>1.15x</option>
            <option value="1.3">1.3x</option>
          </select>
        </div>
      </div>

      <div id="voiceStatusBanner" style="display:none;background:#7f1d1d;color:#fecaca;padding:6px 10px;border-radius:7px;font-size:12.5px;font-weight:600;">
        듣고 있습니다... 편하게 말씀하세요 (멈추려면 마이크 버튼 또는 Ctrl+Space)
      </div>

      <div style="display:flex;gap:8px;align-items:stretch;">
        <textarea id="cmdInput" rows="3" style="flex:1;" placeholder="타이핑하거나 우측 마이크(Ctrl+Space)를 눌러 말로 코딩을 지시하세요!"></textarea>
        <button type="button" id="studioMicBtn" onclick="toggleStudioVoice()" title="음성 코딩 지시 시작/중지 (단축키: Ctrl+Space)" style="width:68px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#f8fafc;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:700;">
          <span id="studioMicIcon" style="font-size:20px;">🎤</span>
          <span id="studioMicLabel">음성지시</span>
        </button>
      </div>
      <button class="btn" id="runCmdBtn" style="padding:10px;font-size:14px;" onclick="executeStudioCommand()">통합 코딩 명령 실행</button>
    </div>
  </div>
</div>

<script>
let studioMode = 'single';
let currentRoot = '';
let currentRelFile = '';
let clientKey = 'sk-pureun-local-dev';

fetch('/api/status').then(r => r.json()).then(d => {
  if (d.keys && d.keys.length > 0) clientKey = d.keys[0].key_token;
  if (d.default_studio_root && !document.getElementById('rootInput').value) {
    document.getElementById('rootInput').value = d.default_studio_root;
    loadFiles();
  }
});

function setMode(m) {
  studioMode = m;
  document.querySelectorAll('.m-tab').forEach((b, i) => {
    b.classList.toggle('active', ['single','compare','cli'][i] === m);
  });
  const sel = document.getElementById('targetSelector');
  if (m === 'single') {
    sel.style.display = 'block';
    sel.innerHTML = `
      <option value="pureun/auto">자동 선택 (pureun/auto)</option>
      <option value="google/gemini-2.5-pro">Google Gemini 2.5 Pro</option>
      <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
      <option value="anthropic/claude-sonnet-4-5">Anthropic Claude Sonnet 4.5</option>
      <option value="openai/gpt-4o">OpenAI GPT-4o</option>
      <option value="ollama/qwen2.5:32b">내 컴퓨터 무료 로컬 AI (Ollama Qwen)</option>`;
  } else if (m === 'compare') {
    sel.style.display = 'none';
  } else {
    sel.style.display = 'block';
    sel.innerHTML = `
      <option value="claude_code">Claude Code CLI (내 폴더 직접 에이전트 실행)</option>
      <option value="antigravity_cli">Google Antigravity CLI (agy 실행)</option>
      <option value="gemini_cli">Google Gemini CLI (gemini 실행)</option>`;
  }
}

async function loadFiles() {
  const root = document.getElementById('rootInput').value.trim();
  if (!root) return;
  const res = await fetch('/api/studio/files?root=' + encodeURIComponent(root));
  const data = await res.json();
  if (!res.ok) { alert(data.error || '폴더 열기 실패'); return; }
  currentRoot = data.root;
  document.getElementById('rootInput').value = currentRoot;
  document.getElementById('fileCount').textContent = data.files.length + '개';
  const box = document.getElementById('fileList');
  box.innerHTML = data.files.map(f => `<div class="file-item" onclick="openFile('${f.replace(/'/g, "\\'")}', this)">${f}</div>`).join('');
}

async function openFile(rel, el) {
  document.querySelectorAll('.file-item').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');
  const res = await fetch('/api/studio/read?root=' + encodeURIComponent(currentRoot) + '&path=' + encodeURIComponent(rel));
  const data = await res.json();
  if (!res.ok) { alert(data.error || '파일 읽기 실패'); return; }
  currentRelFile = rel;
  document.getElementById('currentFileName').textContent = rel;
  document.getElementById('codeEditor').value = data.content;
}

async function newFilePrompt() {
  if (!currentRoot) { alert('먼저 상단에서 프로젝트 폴더를 열어주세요.'); return; }
  const name = prompt('새로 만들 파일 이름을 입력하세요 (예: app.py 또는 index.html):');
  if (!name) return;
  currentRelFile = name.trim();
  document.getElementById('currentFileName').textContent = currentRelFile + ' (새 파일)';
  document.getElementById('codeEditor').value = '';
  await saveCurrentFile();
  await loadFiles();
}

async function saveCurrentFile() {
  if (!currentRoot || !currentRelFile) { alert('저장할 파일이 선택되지 않았습니다.'); return; }
  const content = document.getElementById('codeEditor').value;
  const res = await fetch('/api/studio/write', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ root: currentRoot, path: currentRelFile, content })
  });
  const data = await res.json();
  if (!res.ok) alert(data.error || '저장 실패');
  else document.getElementById('currentFileName').textContent = currentRelFile + ' (저장됨 ✓)';
}

function extractCodeBlock(text) {
  const m = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  return m ? m[1] : text;
}

let activeTtsAudio = null;
let activeTtsBtn = null;

function extractSpokenSummary(rawText, fallbackTitle) {
  // 코드블록(```...```)은 건너뛰고 한국어 설명·핵심 요약만 추출
  let cleaned = String(rawText || '').replace(/```[\s\S]*?```/g, ' ');
  cleaned = cleaned.replace(/https?:\/\/\S+/g, ' ');
  cleaned = cleaned.replace(/[#*`_~>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return (fallbackTitle ? fallbackTitle + ' 작업과 ' : '') + '코드 작성이 완료되었습니다. 편집기에 바로 반영하실 수 있습니다.';
  }
  if (cleaned.length > 360) {
    return cleaned.slice(0, 360) + '... 이상 핵심 요약입니다.';
  }
  return cleaned;
}

function stopStudioTts() {
  if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  if (activeTtsAudio) { try { activeTtsAudio.pause(); } catch (_) {} activeTtsAudio = null; }
  if (activeTtsBtn) { activeTtsBtn.textContent = '🔊 요약 듣기'; activeTtsBtn = null; }
}

async function speakStudioSummary(rawText, title, btnEl) {
  if (btnEl && activeTtsBtn === btnEl) {
    stopStudioTts();
    return;
  }
  stopStudioTts();
  const summary = extractSpokenSummary(rawText, title);
  const rate = parseFloat((document.getElementById('ttsRateSelect') || {}).value || '1.15');

  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(summary);
    utter.lang = 'ko-KR';
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
    if (koVoice) utter.voice = koVoice;
    if (btnEl) {
      activeTtsBtn = btnEl;
      btnEl.textContent = '⏹ 읽기 정지';
    }
    utter.onend = () => { if (activeTtsBtn === btnEl) { btnEl.textContent = '🔊 요약 듣기'; activeTtsBtn = null; } };
    utter.onerror = () => { if (activeTtsBtn === btnEl) { btnEl.textContent = '🔊 요약 듣기'; activeTtsBtn = null; } };
    window.speechSynthesis.speak(utter);
    return;
  }

  // 브라우저 내장 음성이 없을 때 서버 AI TTS 폴백
  try {
    if (btnEl) { activeTtsBtn = btnEl; btnEl.textContent = '⏳ 음성생성'; }
    const res = await fetch('/api/tts', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text: summary })
    });
    const data = await res.json();
    if (data.ok && data.audio_b64) {
      activeTtsAudio = new Audio('data:' + data.mime_type + ';base64,' + data.audio_b64);
      activeTtsAudio.playbackRate = rate;
      if (btnEl) btnEl.textContent = '⏹ 읽기 정지';
      activeTtsAudio.onended = () => stopStudioTts();
      activeTtsAudio.play();
    } else {
      stopStudioTts();
    }
  } catch (_) {
    stopStudioTts();
  }
}

function addResultCard(title, rawText, allowApply, autoSpeakNow) {
  const area = document.getElementById('aiOutputArea');
  const card = document.createElement('div');
  card.className = 'ans-card';
  const head = document.createElement('div');
  head.className = 'ans-head';
  const tSpan = document.createElement('span');
  tSpan.textContent = title;
  head.appendChild(tSpan);

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '6px';
  btnGroup.style.alignItems = 'center';

  const ttsBtn = document.createElement('button');
  ttsBtn.className = 'btn btn-dark';
  ttsBtn.style.padding = '4px 9px';
  ttsBtn.style.fontSize = '12px';
  ttsBtn.textContent = '🔊 요약 듣기';
  ttsBtn.onclick = () => speakStudioSummary(rawText, title, ttsBtn);
  btnGroup.appendChild(ttsBtn);

  if (allowApply) {
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-green';
    applyBtn.style.padding = '4px 10px';
    applyBtn.style.fontSize = '12px';
    applyBtn.textContent = '편집기에 바로 반영 & 저장';
    applyBtn.onclick = async () => {
      document.getElementById('codeEditor').value = extractCodeBlock(rawText);
      if (currentRelFile) await saveCurrentFile();
    };
    btnGroup.appendChild(applyBtn);
  }
  head.appendChild(btnGroup);

  const pre = document.createElement('pre');
  pre.textContent = rawText;
  card.appendChild(head);
  card.appendChild(pre);
  area.prepend(card);

  if (autoSpeakNow && document.getElementById('ttsAutoSpeak')?.checked) {
    speakStudioSummary(rawText, title, ttsBtn);
  }
}

async function askOneModel(model, instruction) {
  const code = document.getElementById('codeEditor').value;
  const sys = "당신은 최고 수준의 시니어 소프트웨어 엔지니어입니다. 파일 코드를 수정할 때는 전체 완성된 코드를 ``` 코드블록 안에 담아 출력해 주세요.";
  const fullPrompt = currentRelFile
    ? `[대상 파일: ${currentRelFile}]\n\`\`\`\n${code}\n\`\`\`\n\n[요청사항]\n${instruction}`
    : instruction;

  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientKey },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: fullPrompt }]
    })
  });
  const data = await res.json();
  if (!res.ok) return `[오류] ${data.error?.message || JSON.stringify(data)}`;
  return data.choices?.[0]?.message?.content || '';
}

async function executeStudioCommand() {
  const instruction = document.getElementById('cmdInput').value.trim();
  if (!instruction) return;
  const btn = document.getElementById('runCmdBtn');
  btn.disabled = true;
  btn.textContent = 'AI 실행 중...';

  try {
    if (studioMode === 'single') {
      const model = document.getElementById('targetSelector').value;
      const ans = await askOneModel(model, instruction);
      addResultCard('단일 AI 응답 (' + model + ')', ans, true, true);
    } else if (studioMode === 'compare') {
      const targets = ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-4-5', 'openai/gpt-4o'];
      const results = await Promise.all(targets.map(m => askOneModel(m, instruction).then(txt => ({ m, txt }))));
      results.reverse().forEach((r, idx) => addResultCard('동시 비교: ' + r.m, r.txt, true, idx === results.length - 1));
    } else {
      if (!currentRoot) { alert('먼저 프로젝트 폴더를 열어주세요.'); return; }
      const agent = document.getElementById('targetSelector').value;
      const res = await fetch('/api/studio/agent', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ root: currentRoot, agent_type: agent, prompt: instruction, client_key: clientKey })
      });
      const data = await res.json();
      addResultCard('외부 에이전트 실행 (' + agent + ')', data.output || JSON.stringify(data), false, true);
      await loadFiles();
      if (currentRelFile) await openFile(currentRelFile);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '통합 코딩 명령 실행';
  }
}

async function gitStatus() {
  if (!currentRoot) { alert('먼저 상단에서 프로젝트 폴더를 열어주세요.'); return; }
  const res = await fetch('/api/studio/git', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ root: currentRoot, action: 'status' })
  });
  const data = await res.json();
  addResultCard('Git 상태 확인', data.output || data.error, false);
}

async function gitPush() {
  if (!currentRoot) { alert('먼저 상단에서 프로젝트 폴더를 열어주세요.'); return; }
  const msg = prompt('GitHub에 기록할 커밋 메시지를 입력하세요:', 'AI 통합 스튜디오 코드 업데이트');
  if (msg === null) return;
  const res = await fetch('/api/studio/git', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ root: currentRoot, action: 'commit_push', message: msg })
  });
  const data = await res.json();
  addResultCard('GitHub 커밋 & 푸시 결과', data.output || data.error, false);
}


// ================= 음성 인식 (실시간 Web Speech + 고정밀 AI STT) =================
let isListening = false;
let speechRec = null;
let mediaRec = null;
let audioChunks = [];
let baseTextBeforeSpeech = '';

async function refreshMicDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const mics = devs.filter(d => d.kind === 'audioinput');
    const sel = document.getElementById('micDeviceSelect');
    if (mics.length > 0) {
      sel.innerHTML = mics.map((m, i) => `<option value="${m.deviceId}">${m.label || ('마이크 ' + (i + 1))}</option>`).join('');
    }
  } catch (_) {}
}

document.getElementById('sttEngineSelect').addEventListener('change', async (e) => {
  const micSel = document.getElementById('micDeviceSelect');
  if (e.target.value === 'ai_stt') {
    micSel.style.display = 'inline-block';
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
        await refreshMicDevices();
      } catch (_) {}
    }
  } else {
    micSel.style.display = 'none';
  }
});

function setMicUI(active, msg) {
  isListening = active;
  const btn = document.getElementById('studioMicBtn');
  const lbl = document.getElementById('studioMicLabel');
  const banner = document.getElementById('voiceStatusBanner');
  if (active) {
    btn.style.background = '#dc2626';
    btn.style.borderColor = '#ef4444';
    lbl.textContent = '듣는중..';
    banner.style.display = 'block';
    banner.textContent = msg || '마이크가 켜졌습니다. 코딩 지시를 말씀해 주세요... (Ctrl+Space로 종료)';
  } else {
    btn.style.background = '#1e293b';
    btn.style.borderColor = '#475569';
    lbl.textContent = '음성지시';
    banner.style.display = 'none';
  }
}

function checkAutoTrigger(text) {
  if (!document.getElementById('voiceAutoRun').checked) return false;
  const trimmed = text.trim();
  const triggers = ['명령 실행해', '바로 실행해', '코딩 실행해', '실행해 줘', '실행해줘'];
  for (const trig of triggers) {
    if (trimmed.endsWith(trig)) {
      document.getElementById('cmdInput').value = trimmed.slice(0, trimmed.length - trig.length).trim();
      stopStudioVoice();
      if (document.getElementById('cmdInput').value) executeStudioCommand();
      return true;
    }
  }
  return false;
}

function stopStudioVoice() {
  if (speechRec) { try { speechRec.stop(); } catch (_) {} speechRec = null; }
  if (mediaRec && mediaRec.state !== 'inactive') { try { mediaRec.stop(); } catch (_) {} }
  setMicUI(false);
}

async function toggleStudioVoice() {
  if (isListening) {
    stopStudioVoice();
    return;
  }
  const engine = document.getElementById('sttEngineSelect').value;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (engine === 'webspeech' && SR) {
    speechRec = new SR();
    speechRec.lang = 'ko-KR';
    speechRec.continuous = true;
    speechRec.interimResults = true;
    const inp = document.getElementById('cmdInput');
    baseTextBeforeSpeech = inp.value ? inp.value.trim() + ' ' : '';
    let finalTranscript = '';

    speechRec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      inp.value = (baseTextBeforeSpeech + finalTranscript + interim).trim();
      checkAutoTrigger(inp.value);
    };
    speechRec.onerror = (e) => {
      setMicUI(false);
      if (e.error === 'not-allowed') alert('브라우저 주소창 왼쪽 자물쇠 아이콘에서 마이크 권한을 허용해 주세요.');
    };
    speechRec.onend = () => { if (isListening) setMicUI(false); };
    speechRec.start();
    setMicUI(true, '실시간 한국어 음성 인식 중... 편하게 말씀하세요! ("코딩 실행해"라고 말하면 자동 실행)');
    return;
  }

  // AI 고정밀 녹음 모드 (또는 브라우저가 Web Speech 미지원 시 자동 전환)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('현재 접속 주소에서는 브라우저 보안 정책상 마이크가 제한됩니다. 내 PC에서는 http://localhost:8787/studio 로 접속해 주세요.');
    return;
  }
  try {
    const devId = document.getElementById('micDeviceSelect').value;
    const constraints = devId ? { audio: { deviceId: { exact: devId } } } : { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    await refreshMicDevices();
    audioChunks = [];
    mediaRec = new MediaRecorder(stream);
    mediaRec.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: mediaRec.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const b64 = String(reader.result || '').split(',')[1] || '';
        if (!b64) return;
        const btn = document.getElementById('studioMicLabel');
        btn.textContent = '변환중..';
        try {
          const res = await fetch('/api/stt', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ audio_b64: b64, mime_type: blob.type })
          });
          const data = await res.json();
          if (data.ok && data.text) {
            const inp = document.getElementById('cmdInput');
            inp.value = (inp.value ? inp.value.trim() + ' ' : '') + data.text;
            checkAutoTrigger(inp.value);
          } else {
            alert(data.error || '음성 변환 실패');
          }
        } finally {
          btn.textContent = '음성지시';
        }
      };
      reader.readAsDataURL(blob);
    };
    mediaRec.start();
    setMicUI(true, '고정밀 마이크 녹음 중... 말씀을 마친 뒤 마이크 버튼(또는 Ctrl+Space)을 한 번 더 누르면 텍스트로 변환됩니다.');
  } catch (err) {
    alert('마이크를 열 수 없습니다: ' + err);
  }
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveCurrentFile();
  }
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    toggleStudioVoice();
  }
});
</script>
</body>
</html>
"""

PWA_ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="42" fill="#1a56db"/>
  <circle cx="96" cy="96" r="54" fill="none" stroke="#ffffff" stroke-width="10"/>
  <circle cx="96" cy="96" r="18" fill="#38bdf8"/>
  <line x1="96" y1="24" x2="96" y2="54" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  <line x1="96" y1="138" x2="96" y2="168" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  <line x1="24" y1="96" x2="54" y2="96" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  <line x1="138" y1="96" x2="168" y2="96" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
</svg>"""

PWA_MANIFEST = {
    "name": "푸른 통합 AI",
    "short_name": "푸른AI",
    "description": "내 컴퓨터와 연결된 GPT·Claude·Gemini·로컬AI 통합 앱",
    "start_url": "/app",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#0f172a",
    "icons": [
        {"src": "/icon.svg", "sizes": "192x192 512x512", "type": "image/svg+xml", "purpose": "any maskable"}
    ],
}

PWA_SW_JS = """
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {});
"""

MOBILE_APP_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0f172a">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.svg">
<title>푸른 통합 AI</title>
<style>
  :root {
    --bg: #f8fafc; --ink: #0f172a; --muted: #64748b;
    --primary: #1a56db; --user-bg: #1a56db; --bot-bg: #ffffff;
    --line: #e2e8f0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; height: 100dvh; display: flex; flex-direction: column;
    font-family: 'Pretendard', 'Malgun Gothic', -apple-system, sans-serif;
    background: var(--bg); color: var(--ink);
  }
  header {
    background: #0f172a; color: #fff; padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;
  }
  .brand { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .top-actions { display: flex; gap: 6px; align-items: center; }
  .icon-btn {
    background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
    padding: 6px 10px; border-radius: 8px; font-size: 12.5px; cursor: pointer; text-decoration: none;
  }
  .model-bar {
    background: #fff; border-bottom: 1px solid var(--line); padding: 8px 12px;
    display: flex; gap: 8px; overflow-x: auto; flex-shrink: 0;
  }
  .m-chip {
    border: 1px solid #cbd5e1; background: #f8fafc; color: #334155;
    padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
    white-space: nowrap; cursor: pointer;
  }
  .m-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .install-banner {
    background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e40af;
    padding: 8px 14px; font-size: 12.5px; display: none; justify-content: space-between; align-items: center;
  }
  #chatBox {
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;
  }
  .msg { max-width: 86%; padding: 12px 15px; border-radius: 16px; font-size: 14.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .msg.user { align-self: flex-end; background: var(--user-bg); color: #fff; border-bottom-right-radius: 4px; }
  .msg.assistant { align-self: flex-start; background: var(--bot-bg); color: var(--ink); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
  .msg .meta { font-size: 11.5px; color: var(--muted); margin-top: 6px; border-top: 1px dashed var(--line); padding-top: 4px; }
  .composer {
    background: #fff; border-top: 1px solid var(--line); padding: 10px 12px;
    display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
  }
  textarea {
    flex: 1; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px;
    font-size: 15px; font-family: inherit; resize: none; max-height: 120px; outline: none;
  }
  .send-btn {
    background: var(--primary); color: #fff; border: none; border-radius: 12px;
    padding: 11px 18px; font-size: 14.5px; font-weight: 700; cursor: pointer; flex-shrink: 0;
  }
  .send-btn:disabled { opacity: 0.5; }
</style>
</head>
<body>
<header>
  <div class="brand">푸른 통합 AI</div>
  <div class="top-actions">
    <button class="icon-btn" id="appAutoTtsBtn" onclick="toggleAppAutoTts()" title="답변 완료 시 한국어 음성 자동 읽기">🔇 자동읽기 끔</button>
    <button class="icon-btn" onclick="resetChat()">새 대화</button>
    <a class="icon-btn" href="/admin">키·관리설정</a>
  </div>
</header>

<div class="install-banner" id="installBanner">
  <span>브라우저 메뉴(⋮ 또는 공유)에서 <strong>'홈 화면에 추가'</strong>를 누르면 폰 앱으로 설치됩니다.</span>
  <button class="icon-btn" id="pwaBtn" style="display:none;background:#1a56db;border:none;color:#fff;" onclick="installPwa()">앱 설치</button>
</div>

<div class="model-bar" id="modelBar">
  <button class="m-chip active" data-model="pureun/auto">자동 선택</button>
  <button class="m-chip" data-model="google/gemini-2.5-flash">Gemini 2.5</button>
  <button class="m-chip" data-model="anthropic/claude-sonnet-4-5">Claude Sonnet</button>
  <button class="m-chip" data-model="openai/gpt-4o">ChatGPT (GPT-4o)</button>
  <button class="m-chip" data-model="ollama/qwen2.5:32b">내PC 무료AI (Ollama)</button>
</div>

<div id="chatBox">
  <div class="msg assistant">안녕하세요! 내 컴퓨터 라우터와 연결되었습니다.
위 버튼에서 원하는 AI 두뇌(Gemini · Claude · GPT · 내PC 무료AI)를 터치해 바로 대화해 보세요. 주민등록번호나 연락처는 외부 전송 전 자동으로 가려집니다.</div>
</div>

<div class="composer">
  <button type="button" id="appMicBtn" onclick="toggleAppVoice()" title="음성 입력" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;padding:10px 13px;font-size:17px;cursor:pointer;flex-shrink:0;">🎤</button>
  <textarea id="promptInput" rows="1" placeholder="메시지를 입력하거나 🎤 버튼을 눌러 말씀하세요..."></textarea>
  <button class="send-btn" id="sendBtn" onclick="sendMsg()">전송</button>
</div>

<script>
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }
let deferredPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (!isStandalone && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
  document.getElementById('installBanner').style.display = 'flex';
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('installBanner').style.display = 'flex';
  document.getElementById('pwaBtn').style.display = 'inline-block';
});
async function installPwa() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt = null;
  document.getElementById('installBanner').style.display = 'none';
}

let currentModel = 'pureun/auto';
let history = [];
let clientKey = localStorage.getItem('pureun_key') || 'sk-pureun-local-dev';

fetch('/api/status').then(r => r.json()).then(d => {
  if (d.keys && d.keys.length > 0 && !localStorage.getItem('pureun_key')) {
    clientKey = d.keys[0].key_token;
  }
}).catch(() => {});

document.querySelectorAll('.m-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.m-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentModel = btn.dataset.model;
  });
});

function resetChat() {
  history = [];
  document.getElementById('chatBox').innerHTML = '<div class="msg assistant">새 대화를 시작합니다. 현재 선택 모델: ' + currentModel + '</div>';
}

function appendBubble(role, text, metaText) {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const span = document.createElement('div');
  span.textContent = text;
  div.appendChild(span);
  if (metaText) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = metaText;
    div.appendChild(m);
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return { div, span };
}

async function sendMsg() {
  const inp = document.getElementById('promptInput');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  document.getElementById('sendBtn').disabled = true;

  appendBubble('user', text);
  history.push({ role: 'user', content: text });
  const bot = appendBubble('assistant', '생각 중...');

  try {
    const res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clientKey },
      body: JSON.stringify({ model: currentModel, messages: history, stream: true })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      bot.span.textContent = '[연결 안내] ' + (err.error?.message || ('HTTP ' + res.status)) + '\n(우측 상단 [키·관리설정]에서 해당 AI의 API 키가 입력되었는지 확인해 주세요.)';
      history.pop();
    } else {
      bot.span.textContent = '';
      let full = '';
      let routedModel = currentModel;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:') || t === 'data: [DONE]') continue;
          try {
            const j = JSON.parse(t.slice(5).trim());
            if (j.model) routedModel = j.model;
            const c = j.choices?.[0]?.delta?.content || '';
            if (c) {
              full += c;
              bot.span.textContent = full;
              document.getElementById('chatBox').scrollTop = document.getElementById('chatBox').scrollHeight;
            }
          } catch (_) {}
        }
      }
      history.push({ role: 'assistant', content: full });
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.display = 'flex';
      meta.style.justifyContent = 'space-between';
      meta.style.alignItems = 'center';
      meta.style.gap = '8px';

      const mLabel = document.createElement('span');
      mLabel.textContent = '응답 모델: ' + routedModel;
      meta.appendChild(mLabel);

      const spkBtn = document.createElement('button');
      spkBtn.type = 'button';
      spkBtn.style.cssText = 'border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;border-radius:6px;padding:3px 8px;font-size:11.5px;font-weight:600;cursor:pointer;';
      spkBtn.textContent = '🔊 요약 듣기';
      spkBtn.onclick = () => speakAppText(full, spkBtn);
      meta.appendChild(spkBtn);

      bot.div.appendChild(meta);
      if (appAutoTts) speakAppText(full, spkBtn);
    }
  } catch (e) {
    bot.span.textContent = '내 컴퓨터 서버와 통신하지 못했습니다: ' + e;
    history.pop();
  }
  document.getElementById('sendBtn').disabled = false;
}



let appAutoTts = localStorage.getItem('pureun_auto_tts') === '1';
let appActiveSpkBtn = null;
let appActiveAudio = null;

function updateAppAutoTtsUI() {
  const b = document.getElementById('appAutoTtsBtn');
  if (!b) return;
  b.textContent = appAutoTts ? '🔊 자동읽기 켬' : '🔇 자동읽기 끔';
  b.style.background = appAutoTts ? '#1d4ed8' : '#1e293b';
}
updateAppAutoTtsUI();

function toggleAppAutoTts() {
  appAutoTts = !appAutoTts;
  localStorage.setItem('pureun_auto_tts', appAutoTts ? '1' : '0');
  if (!appAutoTts) stopAppTts();
  updateAppAutoTtsUI();
}

function cleanTextForSpeech(raw) {
  let c = String(raw || '').replace(/```[\s\S]*?```/g, ' (코드 블록 생략) ');
  c = c.replace(/https?:\/\/\S+/g, ' ').replace(/[#*`_~>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!c) return '코드가 생성되었습니다.';
  return c.length > 400 ? c.slice(0, 400) + '... 이상 요약입니다.' : c;
}

function stopAppTts() {
  if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  if (appActiveAudio) { try { appActiveAudio.pause(); } catch (_) {} appActiveAudio = null; }
  if (appActiveSpkBtn) { appActiveSpkBtn.textContent = '🔊 요약 듣기'; appActiveSpkBtn = null; }
}

async function speakAppText(raw, btnEl) {
  if (btnEl && appActiveSpkBtn === btnEl) { stopAppTts(); return; }
  stopAppTts();
  const summary = cleanTextForSpeech(raw);
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(summary);
    u.lang = 'ko-KR';
    u.rate = 1.1;
    const ko = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
    if (ko) u.voice = ko;
    if (btnEl) { appActiveSpkBtn = btnEl; btnEl.textContent = '⏹ 정지'; }
    u.onend = () => { if (appActiveSpkBtn === btnEl) { btnEl.textContent = '🔊 요약 듣기'; appActiveSpkBtn = null; } };
    u.onerror = () => { if (appActiveSpkBtn === btnEl) { btnEl.textContent = '🔊 요약 듣기'; appActiveSpkBtn = null; } };
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    if (btnEl) { appActiveSpkBtn = btnEl; btnEl.textContent = '⏳ 생성중'; }
    const res = await fetch('/api/tts', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text: summary })
    });
    const d = await res.json();
    if (d.ok && d.audio_b64) {
      appActiveAudio = new Audio('data:' + d.mime_type + ';base64,' + d.audio_b64);
      if (btnEl) btnEl.textContent = '⏹ 정지';
      appActiveAudio.onended = () => stopAppTts();
      appActiveAudio.play();
    } else {
      stopAppTts();
    }
  } catch (_) {
    stopAppTts();
  }
}

let appListening = false;
let appSpeechRec = null;
let appMediaRec = null;
let appChunks = [];

function stopAppVoice() {
  if (appSpeechRec) { try { appSpeechRec.stop(); } catch (_) {} appSpeechRec = null; }
  if (appMediaRec && appMediaRec.state !== 'inactive') { try { appMediaRec.stop(); } catch (_) {} }
  appListening = false;
  const b = document.getElementById('appMicBtn');
  b.style.background = '#f1f5f9';
  b.style.color = '#0f172a';
  b.textContent = '🎤';
}

async function toggleAppVoice() {
  if (appListening) { stopAppVoice(); return; }
  const b = document.getElementById('appMicBtn');
  const inp = document.getElementById('promptInput');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    alert('스마트폰 Wi-Fi(http) 접속 시에는 휴대폰 보안 정책상 브라우저 마이크 대신 스마트폰 자판 위의 마이크 버튼(🎙️)을 누르시면 바로 한국어 음성 입력이 됩니다!');
    inp.focus();
    return;
  }

  if (SR) {
    appSpeechRec = new SR();
    appSpeechRec.lang = 'ko-KR';
    appSpeechRec.continuous = true;
    appSpeechRec.interimResults = true;
    const prefix = inp.value ? inp.value.trim() + ' ' : '';
    let finalTxt = '';
    appSpeechRec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTxt += t + ' ';
        else interim += t;
      }
      inp.value = (prefix + finalTxt + interim).trim();
    };
    appSpeechRec.onerror = () => stopAppVoice();
    appSpeechRec.onend = () => { if (appListening) stopAppVoice(); };
    appSpeechRec.start();
    appListening = true;
    b.style.background = '#dc2626';
    b.style.color = '#fff';
    b.textContent = '⏹';
    return;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      appChunks = [];
      appMediaRec = new MediaRecorder(stream);
      appMediaRec.ondataavailable = e => { if (e.data.size > 0) appChunks.push(e.data); };
      appMediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(appChunks, { type: appMediaRec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = String(reader.result || '').split(',')[1] || '';
          if (!b64) return;
          const res = await fetch('/api/stt', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ audio_b64: b64, mime_type: blob.type })
          });
          const data = await res.json();
          if (data.ok && data.text) inp.value = (inp.value ? inp.value.trim() + ' ' : '') + data.text;
        };
        reader.readAsDataURL(blob);
      };
      appMediaRec.start();
      appListening = true;
      b.style.background = '#dc2626';
      b.style.color = '#fff';
      b.textContent = '⏹';
    } catch (e) {
      alert('마이크 권한을 확인해 주세요: ' + e);
    }
  }
}

document.getElementById('promptInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    e.preventDefault();
    sendMsg();
  }
});
</script>
</body>
</html>
"""

ADMIN_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>푸른 통합 AI 라우터 (Pureun LLM Gateway)</title>
<style>
  :root {
    --bg: #f4f6f9;
    --card: #ffffff;
    --ink: #17202a;
    --muted: #5d6d7e;
    --line: #e2e8f0;
    --primary: #1a56db;
    --primary-hover: #1e429f;
    --accent: #0e9f6e;
    --danger: #e02424;
    --badge-bg: #ebf5ff;
    --badge-fg: #1e429f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: 'Pretendard', 'Malgun Gothic', -apple-system, sans-serif;
    background: var(--bg); color: var(--ink); line-height: 1.5;
  }
  header {
    background: #0f172a; color: #fff; padding: 18px 28px;
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  }
  header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  header .sub { font-size: 13px; color: #94a3b8; margin-top: 2px; }
  .endpoint-pill {
    background: #1e293b; border: 1px solid #334155; padding: 7px 14px;
    border-radius: 8px; font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: #38bdf8;
  }
  .container { max-width: 1200px; margin: 24px auto; padding: 0 20px 48px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
  .kpi .label { font-size: 13px; color: var(--muted); }
  .kpi .val { font-size: 26px; font-weight: 700; margin-top: 6px; color: var(--ink); }
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 10px; flex-wrap: wrap; }
  .tab-btn {
    border: 1px solid var(--line); background: var(--card); color: var(--ink);
    padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
  }
  .tab-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .panel { display: none; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }
  .panel.active { display: block; }
  h2 { margin: 0 0 14px; font-size: 17px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .field label { font-size: 13px; font-weight: 600; color: #334155; }
  .field input[type="text"], .field input[type="password"], .field input[type="number"], .field select, .field textarea {
    padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; width: 100%;
  }
  .toggle-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; font-size: 14px; }
  .btn {
    background: var(--primary); color: #fff; border: none; padding: 10px 18px;
    border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn:hover { background: var(--primary-hover); }
  .btn-secondary { background: #475569; }
  .btn-danger { background: var(--danger); padding: 6px 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-top: 12px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  th { background: #f8fafc; font-weight: 600; color: #475569; }
  code { background: #f1f5f9; padding: 3px 6px; border-radius: 5px; font-size: 12.5px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--badge-bg); color: var(--badge-fg); }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 8px; display: none; font-size: 14px; z-index: 99; }
</style>
</head>
<body>
<header>
  <div>
    <h1>푸른 통합 AI 라우터 (Pureun LLM Gateway)</h1>
    <div class="sub">단일 API · OpenAI / Claude / Gemini / 로컬 Ollama 통합 · 한국형 개인정보 자동 비식별화</div>
  </div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
    <a href="/studio" style="background:#10b981;color:#022c22;padding:8px 14px;border-radius:8px;font-weight:800;font-size:13.5px;text-decoration:none;">통합 코딩 명령창 (/studio)</a><a href="/app" style="background:#38bdf8;color:#0f172a;padding:8px 14px;border-radius:8px;font-weight:700;font-size:13.5px;text-decoration:none;">채팅 앱 화면 열기 (/app)</a>
    <div class="endpoint-pill" id="baseUrlLabel">Base URL: http://localhost:8787/v1</div>
  </div>
</header>

<div class="container">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <div>
      <div style="font-weight:700;color:#1e3a8a;font-size:15px;">내 스마트폰(갤럭시·아이폰)에 앱 설치하는 주소</div>
      <div style="font-size:13.5px;color:#1e40af;margin-top:4px;" id="phoneUrlInfo">주소를 불러오는 중입니다...</div>
    </div>
    <div style="font-size:12.5px;color:#334155;">폰 브라우저로 위 주소 접속 후 <strong>[홈 화면에 추가]</strong>를 누르면 앱 아이콘이 생성됩니다.</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">이번 달 총 호출 수</div><div class="val" id="kpiCalls">0건</div></div>
    <div class="kpi"><div class="label">이번 달 누적 토큰</div><div class="val" id="kpiTokens">0</div></div>
    <div class="kpi"><div class="label">이번 달 추산 API 비용</div><div class="val" id="kpiCost">0원</div></div>
    <div class="kpi"><div class="label">자동 마스킹 보호 건수</div><div class="val" id="kpiMasked">0건</div></div>
  </div>

  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('test')">실시간 모델 테스트</button>
    <button class="tab-btn" onclick="switchTab('providers')">모델 제공사 · 보안 설정</button>
    <button class="tab-btn" onclick="switchTab('keys')">사내 API 키 · 예산 한도</button>
    <button class="tab-btn" onclick="switchTab('logs')">사용 통계 · 감사 로그</button>
    <button class="tab-btn" onclick="switchTab('code')">연동 가이드 (Antigravity / Claude Code / Python)</button>
  </div>

  <!-- 1. 실시간 테스트 -->
  <div class="panel active" id="panel-test">
    <h2>단일 API 모델 전환 및 개인정보 마스킹 테스트</h2>
    <div class="form-grid">
      <div class="field">
        <label>호출할 모델 선택 (코드 수정 없이 모델명만 변경)</label>
        <select id="testModel">
          <option value="pureun/auto">pureun/auto (스마트 자동 라우팅·장애 폴백)</option>
          <option value="ollama/qwen2.5:32b">ollama/qwen2.5:32b (사내 로컬 LLM - 무료·무제한)</option>
          <option value="openai/gpt-4o">openai/gpt-4o (OpenAI GPT-4o)</option>
          <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (OpenAI 경량)</option>
          <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5 (Claude Sonnet 4.5)</option>
          <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (Google Gemini 2.5 Flash)</option>
          <option value="google/gemini-2.5-pro">google/gemini-2.5-pro (Google Gemini 2.5 Pro)</option>
        </select>
      </div>
      <div class="field">
        <label>직접 모델 코드 입력 (선택 사항)</label>
        <input type="text" id="customModel" placeholder="예: ollama/llama3.3 또는 openai/gpt-5">
      </div>
      <div class="field">
        <label>사용할 사내 API 키</label>
        <input type="text" id="testClientKey" value="sk-pureun-local-dev">
      </div>
    </div>
    <div class="field">
      <label>프롬프트 입력 (주민등록번호·연락처 포함 시 외부 전송 전 자동 마스킹 후 복원 테스트 가능)</label>
      <textarea id="testPrompt" rows="4">근로자 홍길동(주민번호 880101-1234567, 연락처 010-9876-5432)의 입사일이 2024-03-01일 때 연차유급휴가 발생 기준을 2문장으로 요약해 주세요.</textarea>
    </div>
    <button class="btn" onclick="runPlayground()">통합 API 호출 실행</button>
    <div style="margin-top:16px;">
      <label style="font-size:13px;font-weight:600;color:#334155;">응답 결과</label>
      <pre id="testOutput">아직 실행되지 않았습니다.</pre>
    </div>
  </div>

  <!-- 2. 제공사 및 보안 설정 -->
  <div class="panel" id="panel-providers">
    <h2>AI 모델 제공사 API 키 및 한국형 보안 가드레일 설정</h2>
    <p style="font-size:13.5px;color:var(--muted);margin-top:0;">등록한 키는 외부 서버로 전송되지 않고 이 PC의 로컬 SQLite DB(<code>router_data.db</code>)에만 저장됩니다.</p>
    <div class="form-grid">
      <div class="field">
        <label>OpenAI API Key (GPT 시리즈)</label>
        <input type="password" id="cfg_openai_api_key" placeholder="sk-...">
      </div>
      <div class="field">
        <label>Anthropic API Key (Claude 시리즈)</label>
        <input type="password" id="cfg_anthropic_api_key" placeholder="sk-ant-...">
      </div>
      <div class="field">
        <label>Google Gemini API Key (AI Studio 키)</label>
        <input type="password" id="cfg_gemini_api_key" placeholder="AIza...">
      </div>
      <div class="field">
        <label>사내 로컬 Ollama 주소 (Qwen / Llama 등)</label>
        <input type="text" id="cfg_ollama_base_url" placeholder="http://localhost:11434/v1">
      </div>
      <div class="field">
        <label>스마트 라우팅(pureun/auto) 우선순위 체인</label>
        <input type="text" id="cfg_default_auto_models">
      </div>
      <div class="field">
        <label>원화 비용 환산 환율 (KRW / 1 USD)</label>
        <input type="number" id="cfg_usd_to_krw" value="1400">
      </div>
    </div>
    <div class="field">
      <label>사내 유출 차단 금칙어 (쉼표 구분 - 포함 시 외부 API 전송 즉시 차단)</label>
      <input type="text" id="cfg_blocked_keywords" placeholder="예: 대외비프로젝트명, 내부기밀코드">
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="cfg_pii_masking_enabled" checked>
      <label for="cfg_pii_masking_enabled"><strong>개인정보 자동 비식별화 켜기</strong> (주민번호·사업자번호·연락처·이메일·계좌번호 외부 전송 전 치환)</label>
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="cfg_pii_reversible_unmask" checked>
      <label for="cfg_pii_reversible_unmask"><strong>로컬 가역 복원 켜기</strong> (AI 응답 수신 시 마스킹 토큰을 사내 PC에서 원래 정보로 자동 복원)</label>
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="cfg_skip_masking_for_local" checked>
      <label for="cfg_skip_masking_for_local"><strong>사내 로컬 Ollama 호출 시 마스킹 생략</strong> (외부 인터넷으로 나가지 않는 내부 모델)</label>
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="cfg_zero_data_retention" checked>
      <label for="cfg_zero_data_retention"><strong>프롬프트 본문 무보관 모드 (Zero Data Retention)</strong> (감사 로그에 토큰·비용만 남기고 대화 원문 미저장)</label>
    </div>
    <div style="margin-top:16px;">
      <button class="btn" onclick="saveSettings()">설정 저장하기</button>
    </div>
  </div>

  <!-- 3. 사내 키 관리 -->
  <div class="panel" id="panel-keys">
    <h2>사내 앱 · 직원별 API 키 및 월 예산 한도 관리</h2>
    <div class="form-grid">
      <div class="field">
        <label>키 이름 (예: 푸른ERP, 푸른법령정보집, 박노무사)</label>
        <input type="text" id="newKeyName" placeholder="푸른ERP 서버">
      </div>
      <div class="field">
        <label>월 예산 상한 (원, 0 입력 시 무제한)</label>
        <input type="number" id="newKeyLimit" value="100000">
      </div>
      <div class="field">
        <label>허용 제공사 (* 또는 openai,anthropic,google,ollama)</label>
        <input type="text" id="newKeyPrefixes" value="*">
      </div>
    </div>
    <button class="btn" onclick="createKey()">새 사내 API 키 발급</button>
    <table>
      <thead>
        <tr><th>이름</th><th>사내 API Key</th><th>허용 제공사</th><th>이번 달 사용액 / 한도</th><th>호출 수</th><th>관리</th></tr>
      </thead>
      <tbody id="keysTableBody"></tbody>
    </table>
  </div>

  <!-- 4. 로그 및 통계 -->
  <div class="panel" id="panel-logs">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2>모델별 사용량 및 최근 감사 로그</h2>
      <a class="btn btn-secondary" href="/api/logs/csv" style="text-decoration:none;">엑셀(CSV) 정산내역 다운로드</a>
    </div>
    <table>
      <thead>
        <tr><th>제공사</th><th>모델명</th><th>호출 수</th><th>총 토큰</th><th>추산 비용(원)</th><th>평균 속도</th></tr>
      </thead>
      <tbody id="modelStatsBody"></tbody>
    </table>
    <h2 style="margin-top:28px;">최근 호출 이력 (최신 30건)</h2>
    <table>
      <thead>
        <tr><th>시각</th><th>호출 키</th><th>모델</th><th>토큰(입/출)</th><th>비용(원)</th><th>마스킹</th><th>속도</th><th>본문 기록</th></tr>
      </thead>
      <tbody id="recentLogsBody"></tbody>
    </table>
  </div>

  <!-- 5. 연동 가이드 -->
  <div class="panel" id="panel-code">
    <h2>1. Python / 사내 프로그램 연동 (기존 OpenAI SDK 그대로 2줄 변경)</h2>
<pre>from openai import OpenAI

client = OpenAI(
    api_key="sk-pureun-local-dev",          # 사내 발급 키
    base_url="http://localhost:8787/v1"     # 자체 라우터 주소
)

# model 값만 바꾸면 코드 수정 없이 즉시 전환됩니다!
# - "openai/gpt-4o"
# - "anthropic/claude-sonnet-4-5"
# - "google/gemini-2.5-flash"
# - "ollama/qwen2.5:32b"
# - "pureun/auto" (자동 선택 및 장애 폴백)
res = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-5",
    messages=[{"role": "user", "content": "안녕하세요!"}]
)
print(res.choices[0].message.content)</pre>

    <h2 style="margin-top:24px;">2. Claude Code 연동 (터미널 환경변수 설정 후 모든 모델 사용)</h2>
<pre>REM Windows 명령 프롬프트(CMD) 실행 예시:
set ANTHROPIC_BASE_URL=http://localhost:8787
set ANTHROPIC_API_KEY=sk-pureun-local-dev
claude --model anthropic/claude-sonnet-4-5

REM Claude Code 안에서 로컬 Qwen이나 Gemini로 전환할 때:
claude --model ollama/qwen2.5:32b
claude --model google/gemini-2.5-pro</pre>

    <h2 style="margin-top:24px;">3. Google Antigravity IDE · CLI 연동 (원클릭 자동 등록 지원)</h2>
<pre>1) 패키지 안의 [4_안티그래비티_자동연결.bat] 더블클릭
   → 내 컴퓨터의 .gemini\antigravity\mcp_config.json 에 'pureun-ai-router'가 자동 등록됩니다.
2) Antigravity 우측 Agent 패널 메뉴(⋮) → MCP Servers → Manage MCP Servers → [Refresh] 클릭
3) 이제 Antigravity 채팅창에서 바로 아래처럼 지시할 수 있습니다:
   - "이 코드를 ask_claude 와 ask_gpt 로 동시에 검토해서 비교해 줘"
   - "이 기밀 문서는 ask_local_ollama 로 내 컴퓨터 안에서만 요약해 줘"

# Antigravity Python SDK에서 로컬/통합 에이전트로 직접 연결할 때:
from antigravity import LocalOpenAIAgentConfig
config = LocalOpenAIAgentConfig(model="pureun/auto", base_url="http://127.0.0.1:8787/v1")</pre>
  </div>
</div>

<div class="toast" id="toast">저장되었습니다.</div>

<script>
document.getElementById('baseUrlLabel').textContent = 'Base URL: ' + location.origin + '/v1';

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2600);
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b, idx) => {
    const map = ['test', 'providers', 'keys', 'logs', 'code'];
    b.classList.toggle('active', map[idx] === name);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  refreshAll();
}

async function refreshAll() {
  const res = await fetch('/api/status');
  const data = await res.json();
  const s = data.stats.summary;
  if (data.access_urls) {
    let phtml = '1) 같은 사무실·집 Wi-Fi 폰 주소: <code>' + escapeHtml(data.access_urls.lan_phone_url) + '</code>';
    if (data.access_urls.tailscale_phone_url) {
      phtml += ' &nbsp;|&nbsp; 2) 밖에서(LTE/5G) 폰 주소: <code>' + escapeHtml(data.access_urls.tailscale_phone_url) + '</code>';
    } else {
      phtml += ' &nbsp;(밖에서도 쓰려면 PC와 폰에 무료 Tailscale 설치)';
    }
    const pEl = document.getElementById('phoneUrlInfo');
    if (pEl) pEl.innerHTML = phtml;
  }
  document.getElementById('kpiCalls').textContent = Number(s.total_calls || 0).toLocaleString() + '건';
  document.getElementById('kpiTokens').textContent = Number(s.total_tokens || 0).toLocaleString();
  document.getElementById('kpiCost').textContent = Math.round(Number(s.total_cost_krw || 0)).toLocaleString() + '원';
  document.getElementById('kpiMasked').textContent = Number(s.total_masked || 0).toLocaleString() + '건';

  const cfg = data.settings;
  ['openai_api_key','anthropic_api_key','gemini_api_key','ollama_base_url','default_auto_models','usd_to_krw','blocked_keywords'].forEach(k => {
    const el = document.getElementById('cfg_' + k);
    if (el && document.activeElement !== el) el.value = cfg[k] || '';
  });
  ['pii_masking_enabled','pii_reversible_unmask','skip_masking_for_local','zero_data_retention'].forEach(k => {
    const el = document.getElementById('cfg_' + k);
    if (el) el.checked = cfg[k] === '1';
  });

  const kb = document.getElementById('keysTableBody');
  kb.innerHTML = data.keys.map(k => `
    <tr>
      <td><strong>${escapeHtml(k.name)}</strong></td>
      <td><code>${escapeHtml(k.key_token)}</code></td>
      <td><span class="badge">${escapeHtml(k.allowed_prefixes)}</span></td>
      <td>${Math.round(k.month_spend_krw).toLocaleString()}원 / ${k.monthly_limit_krw > 0 ? k.monthly_limit_krw.toLocaleString() + '원' : '무제한'}</td>
      <td>${k.month_calls}건</td>
      <td><button class="btn btn-danger" onclick="deleteKey(${k.id})">삭제</button></td>
    </tr>
  `).join('');
  if (data.keys.length > 0 && !document.getElementById('testClientKey').dataset.edited) {
    document.getElementById('testClientKey').value = data.keys[0].key_token;
  }

  document.getElementById('modelStatsBody').innerHTML = data.stats.by_model.map(m => `
    <tr>
      <td><span class="badge">${escapeHtml(m.provider)}</span></td>
      <td><code>${escapeHtml(m.model)}</code></td>
      <td>${m.calls}건</td>
      <td>${Number(m.tokens).toLocaleString()}</td>
      <td>${Math.round(m.cost_krw).toLocaleString()}원</td>
      <td>${m.avg_ms} ms</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="color:#64748b;">아직 호출 기록이 없습니다.</td></tr>';

  document.getElementById('recentLogsBody').innerHTML = data.stats.recent_logs.map(r => `
    <tr>
      <td>${escapeHtml(r.ts)}</td>
      <td>${escapeHtml(r.key_name)}</td>
      <td><code>${escapeHtml(r.provider)}/${escapeHtml(r.model)}</code></td>
      <td>${r.prompt_tokens} / ${r.completion_tokens}</td>
      <td>${Math.round(r.cost_krw).toLocaleString()}원</td>
      <td>${r.masked_items > 0 ? '<span class="badge">' + r.masked_items + '건 보호</span>' : '-'}</td>
      <td>${r.latency_ms}ms</td>
      <td style="color:#64748b;">${escapeHtml(r.prompt_preview)}</td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="color:#64748b;">아직 로그가 없습니다.</td></tr>';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function saveSettings() {
  const body = {};
  ['openai_api_key','anthropic_api_key','gemini_api_key','ollama_base_url','default_auto_models','usd_to_krw','blocked_keywords'].forEach(k => {
    body[k] = document.getElementById('cfg_' + k).value;
  });
  ['pii_masking_enabled','pii_reversible_unmask','skip_masking_for_local','zero_data_retention'].forEach(k => {
    body[k] = document.getElementById('cfg_' + k).checked ? '1' : '0';
  });
  await fetch('/api/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  showToast('설정이 로컬 DB에 저장되었습니다.');
  refreshAll();
}

async function createKey() {
  const name = document.getElementById('newKeyName').value || '사내 신규 키';
  const monthly_limit_krw = Number(document.getElementById('newKeyLimit').value || 0);
  const allowed_prefixes = document.getElementById('newKeyPrefixes').value || '*';
  await fetch('/api/keys', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, monthly_limit_krw, allowed_prefixes })
  });
  document.getElementById('newKeyName').value = '';
  showToast('새 사내 API 키가 발급되었습니다.');
  refreshAll();
}

async function deleteKey(id) {
  await fetch('/api/keys?id=' + id, { method: 'DELETE' });
  showToast('키가 삭제되었습니다.');
  refreshAll();
}

async function runPlayground() {
  const out = document.getElementById('testOutput');
  out.textContent = '호출 중입니다...';
  const model = document.getElementById('customModel').value.trim() || document.getElementById('testModel').value;
  const key = document.getElementById('testClientKey').value.trim();
  const prompt = document.getElementById('testPrompt').value;
  try {
    const res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    if (!res.ok) {
      out.textContent = '[오류 ' + res.status + ']\n' + JSON.stringify(data, null, 2);
    } else {
      const reply = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      const meta = data.pureun_router_meta ? '\n\n--- [라우터 메타정보] ---\n' + JSON.stringify(data.pureun_router_meta, null, 2) : '';
      out.textContent = reply + meta;
    }
  } catch (e) {
    out.textContent = '요청 실패: ' + e;
  }
  refreshAll();
}

document.getElementById('testClientKey').addEventListener('input', e => { e.target.dataset.edited = '1'; });
refreshAll();
</script>
</body>
</html>
"""


# ============================================================================
# 메인 HTTP 게이트웨이 핸들러
# ============================================================================

class GatewayHTTPHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    store: RouterStore

    def log_message(self, fmt: str, *args: Any) -> None:
        # 콘솔 출력 간소화
        sys.stderr.write(f"[PureunRouter] {self.address_string()} - {fmt % args}\n")

    def _extra_hosts(self) -> list:
        # 폰에서 Tailscale serve(https://내PC.….ts.net)로 열 때만 — 환경변수 PUREUN_EXTRA_HOSTS 에 그 이름을 적는다(쉼표로)
        return [h.strip().lower() for h in os.environ.get("PUREUN_EXTRA_HOSTS", "").split(",") if h.strip()]

    def _allowed_origins(self) -> set:
        port = self.server.server_address[1]
        return {f"http://localhost:{port}", f"http://127.0.0.1:{port}"} | {f"https://{h}" for h in self._extra_hosts()}

    def _request_ok(self) -> bool:
        """★ 보안판 — 다른 웹사이트(브라우저)가 보낸 요청과 낯선 Host(DNS 리바인딩)를 막는다.
        Origin 이 없으면 브라우저가 아닌 프로그램(Claude Code·MCP·curl)이라 통과, 있으면 이 PC 주소만."""
        port = self.server.server_address[1]
        host = (self.headers.get("Host") or "").strip().lower()
        if host and host not in (f"localhost:{port}", f"127.0.0.1:{port}", f"[::1]:{port}") and host not in self._extra_hosts():
            return False
        origin = (self.headers.get("Origin") or "").strip()
        return (not origin) or origin in self._allowed_origins()

    def _deny(self) -> None:
        raw = json.dumps({"error": {"message": "이 PC 의 푸른 화면에서 온 요청만 받습니다(보안)."}}, ensure_ascii=False).encode("utf-8")
        self.send_response(403)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(raw)

    def _send_cors(self) -> None:
        origin = (self.headers.get("Origin") or "").strip()
        if origin not in self._allowed_origins():
            return   # ★ 보안판 — 예전 «*»(아무 사이트나) 대신 이 PC 화면에만 연다
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta, X-App-Name",
        )
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

    def _send_json(self, status: int, data: Any) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self._send_cors()
        self.end_headers()
        self.wfile.write(raw)

    def _send_html(self, status: int, html: str) -> None:
        raw = html.replace(LEGACY_KEY, CLIENT_KEY).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(raw)

    def _extract_client_token(self) -> str:
        auth = self.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        x_key = self.headers.get("x-api-key", "").strip()
        return x_key

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _is_local_client(self) -> bool:
        ip = (self.client_address[0] or "").strip()
        return ip in ("127.0.0.1", "::1", "localhost")   # ★ 보안판 — «100.» 전부를 내부로 치던 것을 걷었다

    def do_OPTIONS(self) -> None:
        if not self._request_ok():
            self._deny()
            return
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self._send_cors()
        self.end_headers()

    def do_GET(self) -> None:
        if not self._request_ok():
            self._deny()
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/", "/admin", "/index.html"):
            self._send_html(200, ADMIN_HTML)
            return

        if path == "/app":
            self._send_html(200, MOBILE_APP_HTML)
            return

        if path == "/studio":
            if not self._is_local_client():
                self._send_json(403, {"error": "통합 코딩 명령창(/studio)은 보안을 위해 내 PC(localhost) 또는 Tailscale 사설망에서만 열립니다."})
                return
            self._send_html(200, STUDIO_HTML)
            return

        if path == "/api/studio/files":
            if not self._is_local_client():
                self._send_json(403, {"error": "로컬 PC에서만 허용됩니다."})
                return
            qs = urllib.parse.parse_qs(parsed.query)
            root = (qs.get("root") or [str(BASE_DIR)])[0]
            try:
                self._send_json(200, studio_list_files(root))
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/studio/read":
            if not self._is_local_client():
                self._send_json(403, {"error": "로컬 PC에서만 허용됩니다."})
                return
            qs = urllib.parse.parse_qs(parsed.query)
            root = (qs.get("root") or [""])[0]
            rel = (qs.get("path") or [""])[0]
            try:
                target = studio_safe_path(root, rel)
                self._send_json(200, {"path": rel, "content": target.read_text(encoding="utf-8", errors="replace")})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/manifest.json":
            self._send_json(200, PWA_MANIFEST)
            return

        if path == "/icon.svg":
            raw_svg = PWA_ICON_SVG.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
            self.send_header("Content-Length", str(len(raw_svg)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(raw_svg)
            return

        if path == "/sw.js":
            raw_js = PWA_SW_JS.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(raw_js)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(raw_js)
            return

        if path == "/health":
            self._send_json(200, {"status": "ok", "service": "pureun-llm-router"})
            return

        if path == "/v1/models":
            settings = self.store.get_settings()
            catalog = [
                {"id": "pureun/auto", "object": "model", "owned_by": "pureun-router"},
                {"id": "openai/gpt-4o", "object": "model", "owned_by": "openai"},
                {"id": "openai/gpt-4o-mini", "object": "model", "owned_by": "openai"},
                {"id": "openai/gpt-5", "object": "model", "owned_by": "openai"},
                {"id": "anthropic/claude-sonnet-4-5", "object": "model", "owned_by": "anthropic"},
                {"id": "anthropic/claude-opus-4-1", "object": "model", "owned_by": "anthropic"},
                {"id": "google/gemini-2.5-pro", "object": "model", "owned_by": "google"},
                {"id": "google/gemini-2.5-flash", "object": "model", "owned_by": "google"},
                {"id": "ollama/qwen2.5:32b", "object": "model", "owned_by": "ollama-local"},
                {"id": "ollama/llama3.3", "object": "model", "owned_by": "ollama-local"},
            ]
            # 설정된 제공사 상태 표시 확장 필드
            for item in catalog:
                prov = item["id"].split("/")[0]
                item["configured"] = True if prov == "pureun" else _is_provider_configured(prov, settings)
            self._send_json(200, {"object": "list", "data": catalog})
            return

        if path == "/api/status":
            settings = self.store.get_settings()
            # 화면 표시 시에도 로컬 관리자용으로 제공하되 비밀번호만 마스킹
            safe_settings = dict(settings)
            safe_settings.pop("admin_password", None)
            self._send_json(
                200,
                {
                    "settings": safe_settings,
                    "keys": self.store.list_keys(),
                    "stats": self.store.get_stats(),
                    "access_urls": detect_access_urls(self.server.server_address[1]),
                    "default_studio_root": str(BASE_DIR),
                },
            )
            return

        if path == "/api/logs/csv":
            csv_data = self.store.export_logs_csv().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="pureun_router_usage.csv"')
            self.send_header("Content-Length", str(len(csv_data)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(csv_data)
            return

        self._send_json(404, {"error": {"message": f"경로를 찾을 수 없습니다: {path}"}})

    def do_DELETE(self) -> None:
        if not self._request_ok():
            self._deny()
            return
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/keys":
            qs = urllib.parse.parse_qs(parsed.query)
            key_id = int((qs.get("id") or ["0"])[0])
            self.store.delete_key(key_id)
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": {"message": "Not found"}})

    def do_POST(self) -> None:
        if not self._request_ok():
            self._deny()
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()
        except Exception as exc:
            self._send_json(400, {"error": {"message": f"잘못된 JSON 본문입니다: {exc}"}})
            return

        if path == "/api/config":
            self.store.update_settings(body)
            self._send_json(200, {"ok": True})
            return

        if path == "/api/tts":
            try:
                settings = self.store.get_settings()
                audio_b64, mime = synthesize_speech_base64(str(body.get("text", "")), settings)
                self._send_json(200, {"ok": True, "audio_b64": audio_b64, "mime_type": mime})
            except Exception as e:
                self._send_json(400, {"ok": False, "error": str(e)})
            return

        if path == "/api/stt":
            try:
                settings = self.store.get_settings()
                text = transcribe_audio_base64(
                    audio_b64=str(body.get("audio_b64", "")),
                    mime_type=str(body.get("mime_type", "audio/webm")),
                    settings=settings,
                )
                self._send_json(200, {"ok": True, "text": text})
            except Exception as e:
                self._send_json(400, {"ok": False, "error": str(e)})
            return

        if path == "/api/studio/write":
            if not self._is_local_client():
                self._send_json(403, {"error": "로컬 PC에서만 허용됩니다."})
                return
            try:
                target = studio_safe_path(str(body.get("root", "")), str(body.get("path", "")))
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(str(body.get("content", "")), encoding="utf-8")
                self._send_json(200, {"ok": True, "path": str(target)})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/studio/git":
            if not self._is_local_client():
                self._send_json(403, {"error": "로컬 PC에서만 허용됩니다."})
                return
            try:
                res = studio_run_git(
                    str(body.get("root", "")),
                    str(body.get("action", "status")),
                    str(body.get("message", "")),
                )
                self._send_json(200, res)
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/studio/agent":
            if not self._is_local_client():
                self._send_json(403, {"error": "로컬 PC에서만 허용됩니다."})
                return
            try:
                res = studio_run_external_agent(
                    root_dir=str(body.get("root", "")),
                    agent_type=str(body.get("agent_type", "claude_code")),
                    prompt=str(body.get("prompt", "")),
                    router_port=self.server.server_address[1],
                    client_key=CLIENT_KEY,
                    model=str(body.get("model", "")),
                )
                self._send_json(200, res)
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/keys":
            created = self.store.create_key(
                name=str(body.get("name", "사내 키")),
                monthly_limit_krw=int(body.get("monthly_limit_krw", 0) or 0),
                allowed_prefixes=str(body.get("allowed_prefixes", "*")),
            )
            self._send_json(200, created)
            return

        if path == "/v1/chat/completions":
            self._handle_chat_completions(body, client_protocol="openai")
            return

        if path in ("/v1/messages", "/claude/v1/messages"):
            self._handle_chat_completions(body, client_protocol="anthropic")
            return

        self._send_json(404, {"error": {"message": f"지원하지 않는 엔드포인트입니다: {path}"}})

    def _handle_chat_completions(self, raw_body: Dict[str, Any], client_protocol: str) -> None:
        t0 = time.time()
        settings = self.store.get_settings()
        client_token = self._extract_client_token()
        requested_model = str(raw_body.get("model", "pureun/auto"))

        # 금칙어 검사
        blocked_kw = check_blocked_keywords(raw_body, settings.get("blocked_keywords", ""))
        if blocked_kw:
            self._send_json(
                400,
                {
                    "error": {
                        "type": "forbidden_content",
                        "message": f"사내 보안 금칙어('{blocked_kw}')가 포함되어 외부 AI 전송이 차단되었습니다.",
                    }
                },
            )
            return

        candidates = resolve_provider_and_model(requested_model, settings)
        first_provider = candidates[0][0]
        ok, err_msg, key_info = self.store.validate_client_key(client_token, first_provider)
        if not ok or not key_info:
            self._send_json(401, {"error": {"type": "authentication_error", "message": err_msg}})
            return

        # 클라이언트 요청을 내부 표준(OpenAI 형식)으로 정규화
        if client_protocol == "anthropic":
            openai_body = anthropic_req_to_openai_req(raw_body, candidates[0][1])
        else:
            openai_body = dict(raw_body)

        is_stream = bool(openai_body.get("stream", False))
        usd_to_krw = float(settings.get("usd_to_krw", "1400") or "1400")
        zdr = settings.get("zero_data_retention", "1") == "1"

        last_error_msg = "호출 가능한 모델이 없습니다."
        last_status = 502

        for provider, target_model in candidates:
            # 제공사별 키 권한 재확인
            ok_prov, prov_err, _ = self.store.validate_client_key(client_token, provider)
            if not ok_prov:
                last_error_msg = prov_err
                last_status = 403
                continue

            # 개인정보 마스킹 적용 여부 판단
            use_masking = settings.get("pii_masking_enabled", "1") == "1"
            if provider == "ollama" and settings.get("skip_masking_for_local", "1") == "1":
                use_masking = False

            guard = KoreanPIIGuard(reversible=(settings.get("pii_reversible_unmask", "1") == "1"))
            outbound_body = guard.mask_payload(openai_body) if use_masking else dict(openai_body)

            try:
                url, headers, encoded_payload, upstream_proto = build_upstream_request(
                    provider, target_model, outbound_body, settings
                )
            except ValueError as cfg_err:
                last_error_msg = str(cfg_err)
                last_status = 400
                continue

            req = urllib.request.Request(url, data=encoded_payload, headers=headers, method="POST")
            try:
                resp = urllib.request.urlopen(req, timeout=120)
            except urllib.error.HTTPError as http_err:
                err_raw = http_err.read().decode("utf-8", errors="replace")
                last_status = http_err.code
                last_error_msg = f"[{provider}/{target_model} HTTP {http_err.code}] {err_raw[:400]}"
                # 429(한도초과)나 5xx 서버 장애 시 다음 후보 모델로 자동 폴백
                if http_err.code in (408, 429, 500, 502, 503, 504) and len(candidates) > 1:
                    continue
                break
            except Exception as net_err:
                last_status = 502
                last_error_msg = f"[{provider}/{target_model} 연결 실패] {net_err}"
                if len(candidates) > 1:
                    continue
                break

            # 성공적으로 업스트림 응답 연결됨
            preview_text = "[무보관 모드 - 본문 미저장]" if zdr else str(openai_body.get("messages", "")[:120])

            if is_stream:
                self._relay_stream(
                    resp=resp,
                    upstream_proto=upstream_proto,
                    client_protocol=client_protocol,
                    requested_model=f"{provider}/{target_model}",
                    provider=provider,
                    target_model=target_model,
                    guard=guard,
                    key_name=key_info["name"],
                    usd_to_krw=usd_to_krw,
                    t0=t0,
                    preview_text=preview_text,
                )
                return

            with resp:
                resp_bytes = resp.read()
            upstream_json = json.loads(resp_bytes.decode("utf-8", errors="replace"))

            # 업스트림 응답 -> OpenAI 표준 응답 정규화 (마스킹 복원 포함)
            if upstream_proto == "anthropic":
                normalized_oai = anthropic_resp_to_openai_resp(
                    upstream_json, f"{provider}/{target_model}", guard
                )
            else:
                normalized_oai = upstream_json
                normalized_oai["model"] = f"{provider}/{target_model}"
                for ch in normalized_oai.get("choices") or []:
                    msg = ch.get("message") or {}
                    if isinstance(msg.get("content"), str):
                        msg["content"] = guard.unmask_text(msg["content"])
                    for tc in msg.get("tool_calls") or []:
                        fn = tc.get("function") or {}
                        if isinstance(fn.get("arguments"), str):
                            fn["arguments"] = guard.unmask_text(fn["arguments"])

            usage = normalized_oai.get("usage") or {}
            p_tok = int(usage.get("prompt_tokens", 0))
            c_tok = int(usage.get("completion_tokens", 0))
            cost_krw = estimate_cost_krw(provider, target_model, p_tok, c_tok, usd_to_krw)
            latency_ms = int((time.time() - t0) * 1000)

            self.store.log_usage(
                key_name=key_info["name"],
                provider=provider,
                model=target_model,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                cost_krw=cost_krw,
                latency_ms=latency_ms,
                masked_items=guard.masked_count,
                status_code=200,
                prompt_preview=preview_text,
            )

            if client_protocol == "anthropic":
                # 이미 normalized_oai에서 복원 완료되었으므로 빈 가드 전달
                noop_guard = KoreanPIIGuard(reversible=False)
                final_resp = openai_resp_to_anthropic_resp(
                    normalized_oai, f"{provider}/{target_model}", noop_guard
                )
            else:
                final_resp = normalized_oai
                final_resp["pureun_router_meta"] = {
                    "routed_provider": provider,
                    "routed_model": target_model,
                    "masked_pii_count": guard.masked_count,
                    "estimated_cost_krw": round(cost_krw, 2),
                    "latency_ms": latency_ms,
                }

            self._send_json(200, final_resp)
            return

        # 모든 후보 실패 시
        self._send_json(
            last_status,
            {"error": {"type": "upstream_error", "message": last_error_msg}},
        )

    def _relay_stream(
        self,
        resp: Any,
        upstream_proto: str,
        client_protocol: str,
        requested_model: str,
        provider: str,
        target_model: str,
        guard: KoreanPIIGuard,
        key_name: str,
        usd_to_krw: float,
        t0: float,
        preview_text: str,
    ) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self._send_cors()
        self.end_headers()

        unmask_buf = StreamUnmaskBuffer(guard)
        prompt_tokens = 0
        completion_tokens = 0
        stream_id = f"chatcmpl-{secrets.token_hex(8)}"

        def _emit_sse(data_str: str, event_name: Optional[str] = None) -> None:
            out = ""
            if event_name:
                out += f"event: {event_name}\n"
            out += f"data: {data_str}\n\n"
            self.wfile.write(out.encode("utf-8"))
            self.wfile.flush()

        try:
            with resp:
                if client_protocol == "anthropic":
                    # Claude Code 스트리밍 응답 시작 이벤트
                    _emit_sse(
                        json.dumps(
                            {
                                "type": "message_start",
                                "message": {
                                    "id": f"msg_{secrets.token_hex(8)}",
                                    "type": "message",
                                    "role": "assistant",
                                    "model": requested_model,
                                    "content": [],
                                    "stop_reason": None,
                                    "usage": {"input_tokens": 0, "output_tokens": 0},
                                },
                            },
                            ensure_ascii=False,
                        ),
                        event_name="message_start",
                    )
                    _emit_sse(
                        json.dumps(
                            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
                            ensure_ascii=False,
                        ),
                        event_name="content_block_start",
                    )

                for line in iter_sse_lines(resp):
                    if not line.startswith("data:"):
                        continue
                    payload_str = line[5:].strip()
                    if not payload_str or payload_str == "[DONE]":
                        continue
                    try:
                        ev = json.loads(payload_str)
                    except Exception:
                        continue

                    delta_text = ""
                    if upstream_proto == "openai":
                        choices = ev.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            if isinstance(delta.get("content"), str):
                                delta_text = delta["content"]
                        u = ev.get("usage") or {}
                        if u.get("prompt_tokens"):
                            prompt_tokens = int(u["prompt_tokens"])
                        if u.get("completion_tokens"):
                            completion_tokens = int(u["completion_tokens"])
                    else:
                        # Anthropic SSE 이벤트 해석
                        ev_type = ev.get("type")
                        if ev_type == "message_start":
                            u = (ev.get("message") or {}).get("usage") or {}
                            prompt_tokens = int(u.get("input_tokens", prompt_tokens))
                        elif ev_type == "content_block_delta":
                            d = ev.get("delta") or {}
                            if d.get("type") == "text_delta":
                                delta_text = d.get("text", "")
                        elif ev_type == "message_delta":
                            u = ev.get("usage") or {}
                            completion_tokens = int(u.get("output_tokens", completion_tokens))

                    if delta_text:
                        safe_chunk = unmask_buf.push(delta_text)
                        if safe_chunk:
                            completion_tokens = max(completion_tokens, 1)
                            if client_protocol == "openai":
                                chunk_obj = {
                                    "id": stream_id,
                                    "object": "chat.completion.chunk",
                                    "created": int(time.time()),
                                    "model": requested_model,
                                    "choices": [
                                        {"index": 0, "delta": {"content": safe_chunk}, "finish_reason": None}
                                    ],
                                }
                                _emit_sse(json.dumps(chunk_obj, ensure_ascii=False))
                            else:
                                _emit_sse(
                                    json.dumps(
                                        {
                                            "type": "content_block_delta",
                                            "index": 0,
                                            "delta": {"type": "text_delta", "text": safe_chunk},
                                        },
                                        ensure_ascii=False,
                                    ),
                                    event_name="content_block_delta",
                                )

                tail = unmask_buf.flush()
                if tail:
                    if client_protocol == "openai":
                        _emit_sse(
                            json.dumps(
                                {
                                    "id": stream_id,
                                    "object": "chat.completion.chunk",
                                    "created": int(time.time()),
                                    "model": requested_model,
                                    "choices": [{"index": 0, "delta": {"content": tail}, "finish_reason": None}],
                                },
                                ensure_ascii=False,
                            )
                        )
                    else:
                        _emit_sse(
                            json.dumps(
                                {
                                    "type": "content_block_delta",
                                    "index": 0,
                                    "delta": {"type": "text_delta", "text": tail},
                                },
                                ensure_ascii=False,
                            ),
                            event_name="content_block_delta",
                        )

                if client_protocol == "openai":
                    _emit_sse(
                        json.dumps(
                            {
                                "id": stream_id,
                                "object": "chat.completion.chunk",
                                "created": int(time.time()),
                                "model": requested_model,
                                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                            },
                            ensure_ascii=False,
                        )
                    )
                    _emit_sse("[DONE]")
                else:
                    _emit_sse(
                        json.dumps({"type": "content_block_stop", "index": 0}, ensure_ascii=False),
                        event_name="content_block_stop",
                    )
                    _emit_sse(
                        json.dumps(
                            {
                                "type": "message_delta",
                                "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                                "usage": {"output_tokens": completion_tokens},
                            },
                            ensure_ascii=False,
                        ),
                        event_name="message_delta",
                    )
                    _emit_sse(json.dumps({"type": "message_stop"}, ensure_ascii=False), event_name="message_stop")
        finally:
            latency_ms = int((time.time() - t0) * 1000)
            cost_krw = estimate_cost_krw(provider, target_model, prompt_tokens, completion_tokens, usd_to_krw)
            self.store.log_usage(
                key_name=key_name,
                provider=provider,
                model=target_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_krw=cost_krw,
                latency_ms=latency_ms,
                masked_items=guard.masked_count,
                status_code=200,
                prompt_preview=preview_text,
            )


def create_server(host: str = "127.0.0.1", port: int = 8787, db_path: Path = DEFAULT_DB_PATH) -> ThreadingHTTPServer:
    store = RouterStore(db_path)

    class BoundHandler(GatewayHTTPHandler):
        pass

    BoundHandler.store = store
    return ThreadingHTTPServer((host, port), BoundHandler)


def main() -> None:
    parser = argparse.ArgumentParser(description="푸른 통합 AI 라우터 (Pureun Unified LLM Gateway)")
    parser.add_argument("--host", default="127.0.0.1", help="바인딩 호스트 (보안판 기본 127.0.0.1 — 이 PC 에서만. 폰은 Tailscale serve 로)")
    parser.add_argument("--port", type=int, default=8787, help="포트 번호 (기본값: 8787)")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="SQLite 데이터베이스 파일 경로")
    args = parser.parse_args()

    srv = create_server(host=args.host, port=args.port, db_path=Path(args.db))
    print("=" * 66)
    print("  푸른 통합 AI 라우터 (Pureun Unified LLM Gateway) 가동 시작!")
    print(f"  - 관리자 대시보드 : http://{args.host}:{args.port}")
    print(f"  - OpenAI 호환 API : http://{args.host}:{args.port}/v1/chat/completions")
    print(f"  - Claude Code API : http://{args.host}:{args.port}/v1/messages")
    print("  - 이 PC 열쇠: client_key.txt (화면에 찍지 않는다)")
    print("=" * 66)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        srv.server_close()


if __name__ == "__main__":
    main()
