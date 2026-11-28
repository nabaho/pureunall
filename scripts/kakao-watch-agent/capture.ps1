# Read-only PC KakaoTalk screen and bottom notification popup capture + offline Windows Korean OCR.
#
# NOTE: Pure ASCII only. Windows PowerShell 5.1 treats a .ps1 without BOM as ANSI, so all non-ASCII
# text (room names, OCR Korean lines) is exchanged strictly through UTF-8 JSON files.
#
# Read-only guarantee:
#   - Uses only OS read/screen-capture APIs (EnumWindows, GetWindowRect, Graphics.CopyFromScreen).
#   - Never calls SendInput, SendMessage, PostMessage, SetForegroundWindow, or DB readers.
#   - Temporary upscaled PNGs for WinRT OCR are deleted in a finally block immediately after OCR.
param(
  [string]$Mode = 'scan',
  [string]$RoomsFile = '',
  [string]$StateFile = '',
  [string]$OutFile = '',
  [string]$ImagePath = '',
  [int]$WatchPopup = 1,
  [int]$WatchOpenRoom = 1,
  [string]$RunId = ''
)

$ErrorActionPreference = 'Stop'

$OcrTmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'pu-kakao-watch-ocr')

function Clear-StaleOcrTempFiles {
  try {
    if (Test-Path $OcrTmpDir) {
      $cutoff = (Get-Date).AddMinutes(-2)
      Get-ChildItem -Path $OcrTmpDir -ErrorAction SilentlyContinue |
        Where-Object { ($_.Name -like 'pu_kw_ocr_*.png' -or $_.Name -like 'pu_kw_ocr_*.json') -and $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}

Clear-StaleOcrTempFiles

function Write-ResultJson($obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  if ($OutFile) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($OutFile, $json, $enc)
  } else {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $json
  }
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRt($op, $type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait()
  return $t.Result
}

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class KakaoWatchWin32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowExW(IntPtr p, IntPtr a, string c, string t);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
  [DllImport("user32.dll")] public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
  [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hDesktop);

  public static string Title(IntPtr h) {
    var sb = new StringBuilder(512);
    GetWindowText(h, sb, 512);
    return sb.ToString();
  }
  public static string Cls(IntPtr h) {
    var sb = new StringBuilder(256);
    GetClassName(h, sb, 256);
    return sb.ToString();
  }
  public static string Norm(string s) {
    if (s == null) return "";
    var t = s.Replace((char)0x00A0, (char)0x20).Trim();
    while (t.Contains("  ")) t = t.Replace("  ", " ");
    return t;
  }
  public static List<IntPtr> VisibleTopOf(uint pid) {
    var list = new List<IntPtr>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      uint p;
      GetWindowThreadProcessId(h, out p);
      if (p == pid && IsWindowVisible(h) && !IsIconic(h)) list.Add(h);
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
'@

function Test-SessionLocked {
  if (Get-Process -Name LogonUI -ErrorAction SilentlyContinue) { return $true }
  $desk = [KakaoWatchWin32]::OpenInputDesktop(0, $false, 0x0001)
  if ($desk -eq [IntPtr]::Zero) { return $true }
  $null = [KakaoWatchWin32]::CloseDesktop($desk)
  return $false
}

function Get-KoOcrEngine {
  $ko = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages |
    Where-Object { $_.LanguageTag -like 'ko*' } |
    Select-Object -First 1
  if (-not $ko) { return $null }
  return [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($ko)
}

function Get-BitmapDigest($bmp) {
  $thumb = New-Object System.Drawing.Bitmap(16, 16)
  $g = [System.Drawing.Graphics]::FromImage($thumb)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
    $g.DrawImage($bmp, 0, 0, 16, 16)
    $bytes = New-Object byte[] (16 * 16 * 3)
    $idx = 0
    for ($y = 0; $y -lt 16; $y++) {
      for ($x = 0; $x -lt 16; $x++) {
        $px = $thumb.GetPixel($x, $y)
        $bytes[$idx++] = [byte]([Math]::Floor($px.R / 8) * 8)
        $bytes[$idx++] = [byte]([Math]::Floor($px.G / 8) * 8)
        $bytes[$idx++] = [byte]([Math]::Floor($px.B / 8) * 8)
      }
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha.ComputeHash($bytes)
      return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant().Substring(0, 24)
    } finally {
      $sha.Dispose()
    }
  } finally {
    $g.Dispose()
    $thumb.Dispose()
  }
}

function Invoke-OcrOnBitmap($bmp, $engine) {
  $scale = 2
  $w = $bmp.Width * $scale
  $h = $bmp.Height * $scale
  $up = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($up)
  if (-not (Test-Path $OcrTmpDir)) { $null = New-Object System.IO.DirectoryInfo($OcrTmpDir) | ForEach-Object { $_.Create() } }
  $safeRun = if ($RunId) { ($RunId -replace '[^A-Za-z0-9_-]', '') } else { [string]$PID }
  $tmp = [System.IO.Path]::Combine($OcrTmpDir, ('pu_kw_ocr_' + $safeRun + '_' + [guid]::NewGuid().ToString('N') + '.png'))
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($bmp, 0, 0, $w, $h)
    $g.Dispose()
    $up.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $up.Dispose()

    $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
      $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
      $soft = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
      $res = Await-WinRt ($engine.RecognizeAsync($soft)) ([Windows.Media.Ocr.OcrResult])
      $lines = @()
      foreach ($ln in $res.Lines) {
        $ws = @($ln.Words)
        if ($ws.Count -eq 0) { continue }
        $first = $ws[0].BoundingRect
        $last = $ws[$ws.Count - 1].BoundingRect
        $lines += @{
          x = [int][Math]::Round($first.X / $scale)
          y = [int][Math]::Round($first.Y / $scale)
          r = [int][Math]::Round(($last.X + $last.Width) / $scale)
          b = [int][Math]::Round(($first.Y + $first.Height) / $scale)
          text = [string]$ln.Text
        }
      }
      return ,$lines
    } finally {
      $stream.Dispose()
    }
  } finally {
    if ($g) { try { $g.Dispose() } catch {} }
    if ($up) { try { $up.Dispose() } catch {} }
    if (Test-Path $tmp) { Remove-Item -Force -ErrorAction SilentlyContinue $tmp }
  }
}

$engine = Get-KoOcrEngine
$ocrAvailable = $null -ne $engine
$locked = Test-SessionLocked
$procs = @(Get-Process -Name KakaoTalk -ErrorAction SilentlyContinue)
$kakaoRunning = $procs.Count -gt 0

if ($Mode -eq 'probe') {
  Write-ResultJson @{
    ok = $true
    mode = 'probe'
    ocrAvailable = $ocrAvailable
    kakaoRunning = $kakaoRunning
    locked = $locked
  }
  exit 0
}

if (-not $ocrAvailable) {
  Write-ResultJson @{
    ok = $false
    code = 'no-ocr'
    error = 'Windows Korean OCR pack (ko) is not available'
    ocrAvailable = $false
    kakaoRunning = $kakaoRunning
    locked = $locked
    captures = @()
  }
  exit 0
}

if ($Mode -eq 'testimage') {
  if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
    Write-ResultJson @{ ok = $false; code = 'no-image'; error = 'ImagePath not found'; captures = @() }
    exit 0
  }
  $bmp = New-Object System.Drawing.Bitmap($ImagePath)
  try {
    $hash = Get-BitmapDigest $bmp
    $lines = Invoke-OcrOnBitmap $bmp $engine
    Write-ResultJson @{
      ok = $true
      mode = 'testimage'
      ocrAvailable = $true
      kakaoRunning = $kakaoRunning
      locked = $false
      skippedUnchanged = $false
      captures = @(@{
        surface = 'room'
        key = ('test:' + [System.IO.Path]::GetFileName($ImagePath))
        title = ''
        width = $bmp.Width
        height = $bmp.Height
        hash = $hash
        lines = $lines
      })
    }
  } finally {
    $bmp.Dispose()
  }
  exit 0
}

if ($locked) {
  Write-ResultJson @{
    ok = $false
    code = 'locked'
    error = 'Screen is locked'
    ocrAvailable = $true
    kakaoRunning = $kakaoRunning
    locked = $true
    captures = @()
  }
  exit 0
}

if (-not $kakaoRunning) {
  Write-ResultJson @{
    ok = $true
    mode = 'scan'
    ocrAvailable = $true
    kakaoRunning = $false
    locked = $false
    skippedUnchanged = $false
    captures = @()
  }
  exit 0
}

$allowedRooms = @()
if ($RoomsFile -and (Test-Path $RoomsFile)) {
  $rawRooms = Get-Content -Path $RoomsFile -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($r in @($rawRooms)) {
    $nr = [KakaoWatchWin32]::Norm([string]$r)
    if ($nr) { $allowedRooms += $nr }
  }
}

$prevHashes = @{}
if ($StateFile -and (Test-Path $StateFile)) {
  try {
    $rawState = Get-Content -Path $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($rawState) {
      foreach ($p in $rawState.PSObject.Properties) { $prevHashes[$p.Name] = [string]$p.Value }
    }
  } catch {}
}

$screenW = [KakaoWatchWin32]::GetSystemMetrics(0)
$screenH = [KakaoWatchWin32]::GetSystemMetrics(1)
$captures = @()
$nextHashes = @{}
$skippedCount = 0

foreach ($proc in $procs) {
  $hwnds = [KakaoWatchWin32]::VisibleTopOf([uint32]$proc.Id)
  foreach ($h in $hwnds) {
    $cls = [KakaoWatchWin32]::Cls($h)
    $title = [KakaoWatchWin32]::Norm([KakaoWatchWin32]::Title($h))
    $rect = New-Object KakaoWatchWin32+RECT
    if (-not [KakaoWatchWin32]::GetWindowRect($h, [ref]$rect)) { continue }
    $w = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($w -lt 120 -or $height -lt 50) { continue }

    $editHandle = [KakaoWatchWin32]::FindWindowExW($h, [IntPtr]::Zero, 'RICHEDIT50W', [NullString]::Value)
    $hasInput = $editHandle -ne [IntPtr]::Zero

    $surface = ''
    $capLeft = $rect.Left
    $capTop = $rect.Top
    $capW = $w
    $capH = $height

    $isPopupCandidate = ($WatchPopup -eq 1) -and ($cls -eq 'EVA_Window' -or $cls -eq 'EVA_Window_Dblclk') -and (-not $hasInput) -and
      ($w -ge 160 -and $w -le 540) -and ($height -ge 50 -and $height -le 300) -and
      ($rect.Right -ge [int]($screenW * 0.45)) -and ($rect.Bottom -ge [int]($screenH * 0.45))

    if ($isPopupCandidate) {
      $surface = 'popup'
    } elseif ($WatchOpenRoom -eq 1 -and $allowedRooms -contains $title -and ($w -ge 280 -and $height -ge 280)) {
      $surface = 'room'
    }

    if (-not $surface) { continue }

    $key = $surface + ':' + $title
    $bmp = New-Object System.Drawing.Bitmap($capW, $capH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.CopyFromScreen($capLeft, $capTop, 0, 0, (New-Object System.Drawing.Size($capW, $capH)))
      $digest = Get-BitmapDigest $bmp
      if ($prevHashes.ContainsKey($key) -and $prevHashes[$key] -eq $digest) {
        $nextHashes[$key] = $digest
        $skippedCount++
        continue
      }
      $lines = Invoke-OcrOnBitmap $bmp $engine
      $nextHashes[$key] = $digest
      $captures += @{
        surface = $surface
        key = $key
        title = $title
        width = $capW
        height = $capH
        hash = $digest
        lines = $lines
      }
    } catch {
      continue
    } finally {
      $g.Dispose()
      $bmp.Dispose()
    }
  }
}

Write-ResultJson @{
  ok = $true
  mode = 'scan'
  ocrAvailable = $true
  kakaoRunning = $true
  locked = $false
  skippedUnchanged = ($captures.Count -eq 0 -and $skippedCount -gt 0)
  captures = $captures
}
