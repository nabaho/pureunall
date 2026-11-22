#!/usr/bin/env python3
"""원클릭 .bat 하나로 묶는다 — 예전 판과 같은 꼴(자기 안의 PS 본문 + base64 압축).
쓰는 법: python tools/pureun-ai/build-oneclick.py <나올 파일.bat>
⚠ client_key.txt·*.db 는 넣지 않는다(열쇠는 설치한 PC 에서 새로 만든다)."""
import base64, io, sys, zipfile
from pathlib import Path
here = Path(__file__).resolve().parent
files = ['pureun_llm_router.py', 'pureun_antigravity_mcp.py', 'setup_antigravity.py', 'claude_code_terminal.bat']
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(here / f, f)
b64 = base64.b64encode(buf.getvalue()).decode()
b64 = '\r\n'.join(b64[i:i + 100] for i in range(0, len(b64), 100))
body = (here / 'install-body.ps1').read_text(encoding='utf-8')
expand = r'''function Expand-PureunPayload($Dir) {
  $t = [System.IO.File]::ReadAllText($env:PUREUN_SELF, [System.Text.Encoding]::UTF8)
  $s = '#ZIP_' + 'START#'; $e = '#ZIP_' + 'STOP#'
  $a = $t.IndexOf($s) + $s.Length; $b = $t.IndexOf($e)
  $bytes = [Convert]::FromBase64String(($t.Substring($a, $b - $a) -replace '\s+', ''))
  $tmp = Join-Path $Dir '_payload.zip'; [System.IO.File]::WriteAllBytes($tmp, $bytes)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($tmp)
  foreach ($en in $zip.Entries) { if ($en.FullName -match '\.\.|[\\/]') { continue }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($en, (Join-Path $Dir $en.FullName), $true) }
  $zip.Dispose(); Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
'''
head = ('@echo off\r\nsetlocal\r\nset "PUREUN_SELF=%~f0"\r\nnet session >nul 2>&1\r\n'
        'if not "%errorlevel%"=="0" (\r\n    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:PUREUN_SELF -Verb RunAs"\r\n    exit /b\r\n)\r\n'
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=$env:PUREUN_SELF;$t=[IO.File]::ReadAllText($f,[Text.Encoding]::UTF8);$m=\'#PS_\'+\'START#\';$n=\'#PS_\'+\'STOP#\';$a=$t.IndexOf($m)+$m.Length;$b=$t.IndexOf($n);iex $t.Substring($a,$b-$a)"\r\n'
        'pause\r\nexit /b\r\n')
out = head + '#PS_START#\r\n' + (expand + body).replace('\r\n', '\n').replace('\n', '\r\n') + '\r\n#PS_STOP#\r\n#ZIP_START#\r\n' + b64 + '\r\n#ZIP_STOP#\r\n'
Path(sys.argv[1]).write_bytes(out.encode('utf-8'))
print('만듦:', sys.argv[1], len(out), '자')
