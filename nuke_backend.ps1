# Kill every python process that has finance-dashboard in its command line
$allProcs = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*finance-dashboard*" }
Write-Host "Found $($allProcs.Count) finance-dashboard python processes"
foreach ($proc in $allProcs) {
    Write-Host "  Killing PID=$($proc.ProcessId) Cmd=$($proc.CommandLine)"
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

# Also kill PID 23920 directly
Stop-Process -Id 23920 -Force -ErrorAction SilentlyContinue

# Kill ALL python.exe processes (nuclear option)
Write-Host "Killing all python.exe processes..."
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "python3" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
$still = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
Write-Host "Port 8000 listeners remaining: $($still.Count)"
