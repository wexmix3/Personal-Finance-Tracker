# Kill all processes on port 8000 and restart the backend
$pids = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
foreach ($pid in $pids) {
    try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Killed PID $pid"
    } catch {
        Write-Host "Could not kill $pid"
    }
}

# Also kill any python processes running main.py in the finance-dashboard folder
$pythonProcs = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*finance-dashboard*main*" }
foreach ($proc in $pythonProcs) {
    try {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
        Write-Host "Killed finance-dashboard python PID $($proc.ProcessId)"
    } catch {}
}

Start-Sleep -Seconds 2

# Start the backend
$backendDir = "C:\Users\maxmw\Downloads\Claude\finance-dashboard\backend"
Set-Location $backendDir
Start-Process -FilePath "$backendDir\.venv\Scripts\python.exe" -ArgumentList "main.py" -WorkingDirectory $backendDir -NoNewWindow
Write-Host "Backend started"
Start-Sleep -Seconds 5

# Test it
$result = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction SilentlyContinue
Write-Host "Health check: $($result.Content)"
