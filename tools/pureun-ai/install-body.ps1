# 푸른 통합 AI 라우터 — 보안판 설치 본문 (대표가 제미나이로 만든 원클릭을 2026-11-17 보안 손질)
# 바뀐 것: ① 서버는 이 PC 안(127.0.0.1)에서만 연다 — 방화벽을 «열지 않고» 예전 규칙은 지운다
#          ② 누구나 아는 열쇠 대신 이 PC 전용 열쇠(client_key.txt, 서버가 처음 켤 때 만든다)
#          ③ 다른 웹사이트가 보낸 요청은 서버가 거절한다(pureun_llm_router.py _request_ok)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$InstallDir = 'C:\PureunAI'
if (!(Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }

Write-Host '[1/6] 프로그램 파일 설치 중...' -ForegroundColor Yellow
Expand-PureunPayload $InstallDir

Write-Host '[2/6] Python 확인 중...' -ForegroundColor Yellow
function Find-RealPython {
    $c = @('python') + (Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe","C:\Program Files\Python3*\python.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object FullName)
    foreach ($cmd in $c) { try { $o = & $cmd -c "import sys; print(sys.executable)" 2>$null; if ($LASTEXITCODE -eq 0 -and $o -and ($o -notmatch 'WindowsApps')) { return $o.Trim() } } catch {} }
    return $null
}
$PyExe = Find-RealPython
if (-not $PyExe) { Write-Host '  -> Python 3.12 를 설치합니다(winget)...' -ForegroundColor Magenta
    & winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements; $PyExe = Find-RealPython }
if (-not $PyExe) { throw 'Python 을 찾지 못했습니다. python.org 에서 설치 후 다시 실행해 주세요.' }
$PywExe = Join-Path (Split-Path $PyExe -Parent) 'pythonw.exe'; if (!(Test-Path $PywExe)) { $PywExe = $PyExe }

Write-Host '[3/6] 예전 서버 정리 중...' -ForegroundColor Yellow
Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'pureun_llm_router\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
# ★ 예전 판이 열어 둔 방화벽(8787 누구나 들어옴)을 닫는다 — 새 판은 이 PC 안에서만 쓰므로 열 필요가 없다
& netsh advfirewall firewall delete rule name="PureunAI_8787" | Out-Null

Write-Host '[4/6] 부팅 자동 실행 등록 중(이 PC 안에서만)...' -ForegroundColor Yellow
$RouterPy = Join-Path $InstallDir 'pureun_llm_router.py'
$Vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'PureunAI_AutoStart.vbs'
$VbsContent = "Set WshShell = CreateObject(`"WScript.Shell`")`r`nWshShell.CurrentDirectory = `"$InstallDir`"`r`nWshShell.Run `"`"`"$PywExe`"`" `"`"$RouterPy`"`" --host 127.0.0.1 --port 8787`", 0, False`r`n"
[System.IO.File]::WriteAllText($Vbs, $VbsContent, [System.Text.Encoding]::Default)

Write-Host '[5/6] 서버 켜기 · Antigravity 연결 · 바탕화면 아이콘...' -ForegroundColor Yellow
Start-Process -FilePath $PywExe -ArgumentList "`"$RouterPy`" --host 127.0.0.1 --port 8787" -WorkingDirectory $InstallDir -WindowStyle Hidden
for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 300
  try { if ((Invoke-WebRequest -Uri 'http://127.0.0.1:8787/health' -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200) { break } } catch {} }
& $PyExe (Join-Path $InstallDir 'setup_antigravity.py') (Join-Path $InstallDir 'pureun_antigravity_mcp.py') | Out-Null
$Desk = [Environment]::GetFolderPath('Desktop')
@(@{ N='푸른 통합 코딩명령창.url'; U='http://localhost:8787/studio' }, @{ N='푸른 AI 채팅앱.url'; U='http://localhost:8787/app' }, @{ N='푸른 AI 관리자설정.url'; U='http://localhost:8787/admin' }) |
  ForEach-Object { [System.IO.File]::WriteAllText((Join-Path $Desk $_.N), "[InternetShortcut]`r`nURL=$($_.U)`r`n", [System.Text.Encoding]::UTF8) }

Write-Host '[6/6] 관리자 화면을 엽니다 — 「Gemini API 키」 칸에 제미나이 키를 넣고 저장하세요.' -ForegroundColor Yellow
Start-Process 'http://localhost:8787/admin'
Write-Host ''
Write-Host '완료. ⚠ 제미나이 키는 회사 서버 키가 아닌 «별도 키»로, 구글 콘솔에서 하루 사용량 상한을 걸어 두세요.' -ForegroundColor Green
Write-Host '⚠ 고객 주민번호·임금대장을 AI 에 넣지 마세요(구글·Anthropic·OpenAI 로 갑니다).' -ForegroundColor Green
Start-Sleep -Seconds 4
