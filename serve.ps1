# Fallback game server for Windows PCs without Python.
# hardcount.bat runs this when no Python is installed. It needs nothing beyond the
# PowerShell that ships with Windows 10/11, listens on localhost only (no
# firewall prompt, nothing exposed to the network), and opens the game.
#   powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 [-Open hardcount/] [-Port 8000] [-NoBrowser]
param([string]$Open = 'hardcount/', [int]$Port = 8000, [switch]$NoBrowser)

$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.mjs' = 'text/javascript'
  '.css' = 'text/css'; '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'; '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.ico' = 'image/x-icon'
  '.txt' = 'text/plain; charset=utf-8'; '.woff2' = 'font/woff2'; '.md' = 'text/plain; charset=utf-8'
}

# a free port on localhost (a forgotten old server may still hold 8000)
$listener = $null
for ($i = 0; $i -lt 25; $i++) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
    # big queue: the browser opens many connections at once for the game's modules
    $listener.Start(512)
    break
  } catch {
    $listener = $null
    $Port++
  }
}
if (-not $listener) {
  Write-Host '  Could not find a free port. Close other game windows and try again.'
  exit 1
}

$url = "http://localhost:$Port/$Open"
Write-Host "  Game server running at $url"
Write-Host '  Keep this window open while you play. Close it to stop the server.'
if (-not $NoBrowser) { Start-Process $url }

function Send($stream, [string]$status, [string]$type, [byte[]]$body, [string]$extra) {
  $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n$extra`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    # a browser may open a spare connection and never use it: don't stall on it
    $client.ReceiveTimeout = 1500
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $line = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ($h -eq $null -or $h -eq '') { break } }
    if (-not $line) { continue }
    $target = ($line -split ' ')[1]
    if (-not $target) { continue }
    $path = [System.Uri]::UnescapeDataString(($target -split '\?')[0])
    $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $rel))
    $empty = New-Object byte[] 0
    if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send $stream '403 Forbidden' 'text/plain' $empty ''
    } elseif ([System.IO.Directory]::Exists($file)) {
      if (-not $path.EndsWith('/')) {
        # folders need their trailing slash so relative links resolve
        Send $stream '301 Moved Permanently' 'text/plain' $empty "Location: $path/`r`n"
      } else {
        $index = [System.IO.Path]::Combine($file, 'index.html')
        if ([System.IO.File]::Exists($index)) {
          Send $stream '200 OK' $mime['.html'] ([System.IO.File]::ReadAllBytes($index)) ''
        } else {
          Send $stream '404 Not Found' 'text/plain' $empty ''
        }
      }
    } elseif ([System.IO.File]::Exists($file)) {
      $type = $mime[[System.IO.Path]::GetExtension($file).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      Send $stream '200 OK' $type ([System.IO.File]::ReadAllBytes($file)) ''
    } else {
      Send $stream '404 Not Found' 'text/plain' $empty ''
    }
  } catch {
    # a browser that hangs up early is not our problem
  } finally {
    $client.Close()
  }
}
