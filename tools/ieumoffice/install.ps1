# 이음오피스(IeumOffice) 설치 — 대표 지시 2026-11-17 「이음오피스 내 PC 에 다운받고 실행 가능하게」
# 하는 일: ① 공식 저장소(github.com/pblsketch/ieumoffice)의 «최신 릴리스»를 묻고
#          ② 윈도 설치 파일(IeumOffice-Setup-*.exe)을 «그 저장소의 다운로드 주소에서만» 받고
#          ③ 지문(SHA256)을 보여 준 뒤 ④ 설치를 시작한다. 「PC 보호」 창의 «추가 정보 → 실행»은 사람이 누른다.
# ⚠ 이 설치 파일에는 코드 서명이 없다(제작자 README). 그래서 받는 곳을 공식 저장소 하나로 못 박는다.
# ⚠ 조용히 깔지 않는다 — 설치 창은 사람이 보고 누른다.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Repo   = 'pblsketch/ieumoffice'
$Prefix = "https://github.com/$Repo/releases/download/"

Write-Host '이음오피스 최신 판을 확인합니다...'
$rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'pureun-installer' }
$asset = $rel.assets | Where-Object { $_.name -match '^IeumOffice-Setup-[0-9.]+\.exe$' } | Select-Object -First 1
if (-not $asset) { throw "윈도 설치 파일(IeumOffice-Setup-*.exe)을 릴리스 $($rel.tag_name) 에서 찾지 못했습니다." }
$url = [string]$asset.browser_download_url
if (-not $url.StartsWith($Prefix)) { throw "받는 주소가 공식 저장소가 아닙니다: $url — 멈춥니다." }

$dest = Join-Path ([Environment]::GetFolderPath('UserProfile')) ('Downloads\' + $asset.name)
Write-Host "판: $($rel.tag_name)  ·  파일: $($asset.name)  ·  크기: $([math]::Round($asset.size/1MB,1)) MB"
Write-Host "받는 곳: $url"
Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
if ((Get-Item $dest).Length -ne $asset.size) { Remove-Item $dest -Force; throw '받은 파일 크기가 릴리스와 다릅니다 — 지웠습니다. 다시 실행해 주세요.' }
$hash = (Get-FileHash $dest -Algorithm SHA256).Hash
Write-Host "지문(SHA256): $hash"
if ($asset.digest) { Write-Host "릴리스에 적힌 지문: $($asset.digest)"
  if (("sha256:" + $hash.ToLower()) -ne ([string]$asset.digest).ToLower()) { Remove-Item $dest -Force; throw '지문이 릴리스와 다릅니다 — 지웠습니다.' } }

Write-Host ''
Write-Host '설치를 시작합니다. 「Windows의 PC 보호」 창이 뜨면 «추가 정보 → 실행»을 눌러 주세요(서명 없는 프로그램이라 뜹니다).'
Start-Process -FilePath $dest
Write-Host ''
Write-Host '⚠ AI 기능을 켜면 문서 내용이 연결한 AI 회사(Anthropic·OpenAI·구글 등)로 갑니다. 고객 주민번호·임금대장 문서에는 AI 를 쓰지 마세요.'
