
@echo off
setlocal
title Query Mind AI - Auto Launcher

set "ROOT=D:\Project-Mtech\SmartAssistAI_NoLogin_Vercel\SmartAssistAI"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "SITE=https://query-mind-ai-lovat.vercel.app/"

echo.
echo ==========================================
echo       QUERY MIND AI - AUTO LAUNCHER
echo ==========================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
    echo ERROR: cloudflared is not installed or not in PATH.
    pause
    exit /b 1
)

where vercel >nul 2>&1
if errorlevel 1 (
    echo ERROR: Vercel CLI is not installed.
    echo Run: npm install -g vercel
    pause
    exit /b 1
)

if not exist "%BACKEND%\venv311\Scripts\python.exe" (
    echo ERROR: Backend Python environment not found.
    pause
    exit /b 1
)

if not exist "%FRONTEND%\vercel.json" (
    echo ERROR: frontend\vercel.json not found.
    pause
    exit /b 1
)

echo [1/4] Linking Vercel project in frontend...
cd /d "%FRONTEND%"
vercel link --yes
if errorlevel 1 (
    echo ERROR: Could not link the Vercel project.
    pause
    exit /b 1
)

if not exist "%FRONTEND%\.vercel\project.json" (
    echo ERROR: Vercel link completed but project.json is missing.
    echo Check your Vercel CLI configuration before continuing.
    pause
    exit /b 1
)

echo.
echo [2/4] Starting FastAPI backend...
start "Query Mind AI Backend" /D "%BACKEND%" cmd /k "venv311\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Waiting for backend health...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 30;$i++){try{$r=Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 2; if($r.status -eq 'ok'){$ok=$true;break}}catch{}; Start-Sleep -Seconds 2}; if($ok){exit 0}else{exit 1}"

if errorlevel 1 (
    echo ERROR: Backend did not become healthy.
    echo Check the backend window.
    pause
    exit /b 1
)

echo.
echo [3/4] Starting Cloudflare Quick Tunnel...
echo [4/4] Updating Vercel URL and deploying...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$front='%FRONTEND%'; $site='%SITE%';" ^
 "$out=Join-Path $env:TEMP 'querymind-tunnel-out.txt';" ^
 "$err=Join-Path $env:TEMP 'querymind-tunnel-err.txt';" ^
 "Remove-Item $out,$err -Force -ErrorAction SilentlyContinue;" ^
 "$p=Start-Process -FilePath 'cloudflared' -ArgumentList @('tunnel','--url','http://127.0.0.1:8000') -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden;" ^
 "$url=$null;" ^
 "for($i=0;$i -lt 60;$i++){Start-Sleep -Seconds 2; if($p.HasExited){break}; foreach($f in @($out,$err)){if(Test-Path $f){$s=Get-Content $f -Raw -ErrorAction SilentlyContinue; if($s -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'){$url=$Matches[0];break}}}; if($url){break}};" ^
 "if(-not $url){Write-Host 'ERROR: Could not detect the tunnel URL.'; if(Test-Path $err){Get-Content $err -Tail 20}; if(-not $p.HasExited){Stop-Process -Id $p.Id -Force}; exit 1};" ^
 "Write-Host ('Detected tunnel URL: '+$url);" ^
 "Push-Location $front; try {" ^
 "Write-Host 'Updating production BACKEND_URL...';" ^
 "& vercel env update BACKEND_URL production --value $url --yes; if($LASTEXITCODE -ne 0){throw 'Failed to update BACKEND_URL'};" ^
 "Write-Host 'Deploying production frontend...';" ^
 "& vercel deploy --prod --yes; if($LASTEXITCODE -ne 0){throw 'Vercel deployment failed'};" ^
 "Write-Host 'Deployment completed successfully.';" ^
 "Start-Process $site;" ^
 "} catch {Write-Host ('ERROR: '+$_.Exception.Message); exit 1} finally {Pop-Location}"

if errorlevel 1 (
    echo.
    echo Launcher failed. Read the error above.
    pause
    exit /b 1
)

echo.
echo Query Mind AI is deployed.
echo Keep the backend and Cloudflare tunnel running.
echo Closing the tunnel disconnects online AI access.
pause
endlocal
