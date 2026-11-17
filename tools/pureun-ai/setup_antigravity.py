#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Antigravity IDE 및 Antigravity CLI(agy)의 mcp_config.json 설정 파일에
푸른 통합 AI 라우터(pureun-ai-router)를 자동으로 추가·병합합니다.
기존에 등록해 두신 다른 MCP 설정(hwp-mcp, korean-law-mcp 등)은 그대로 보존됩니다!
"""
import json
import os
import sys
from pathlib import Path


def register_antigravity(mcp_script_path: Path, home_dir: Path | None = None) -> list[Path]:
    base_home = home_dir or Path.home()
    python_exe = sys.executable or "python"

    # Antigravity 데스크톱 IDE 및 Antigravity CLI(agy) 공식 설정 경로 2곳 모두 지원
    targets = [
        base_home / ".gemini" / "antigravity" / "mcp_config.json",
        base_home / ".gemini" / "antigravity-cli" / "mcp_config.json",
    ]

    entry = {
        "command": python_exe,
        "args": [str(mcp_script_path.resolve())],
        "env": {
            "PUREUN_ROUTER_URL": "http://127.0.0.1:8787",
            # ★ 보안판 — 열쇠는 설정 파일에 적지 않는다(MCP 가 client_key.txt 를 직접 읽는다)
        },
    }

    updated: list[Path] = []
    for cfg_path in targets:
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        data = {"mcpServers": {}}
        if cfg_path.exists():
            try:
                loaded = json.loads(cfg_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    data = loaded
            except Exception:
                # 손상된 경우 백업 보관
                cfg_path.with_suffix(".json.bak").write_bytes(cfg_path.read_bytes())
        if not isinstance(data.get("mcpServers"), dict):
            data["mcpServers"] = {}

        # Antigravity 규격에 맞춰 'type' 필드 없이 command/args/env 만 깔끔하게 등록
        data["mcpServers"]["pureun-ai-router"] = entry
        cfg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        updated.append(cfg_path)
    return updated


if __name__ == "__main__":
    target_mcp = Path(sys.argv[1]) if len(sys.argv) > 1 else (Path(__file__).resolve().parent / "pureun_antigravity_mcp.py")
    paths = register_antigravity(target_mcp)
    print("Antigravity MCP 자동 등록 완료:")
    for p in paths:
        print(" -", p)
