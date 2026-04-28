Write-Host "Attempting to kill PID 51732..."
Stop-Process -Id 51732 -Force -ErrorAction SilentlyContinue

# Try taskkill as well
$result = & taskkill.exe /PID 51732 /F 2>&1
Write-Host "Taskkill result: $result"

Start-Sleep -Seconds 2

# Check what's on 8000 now
$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "Still running on 8000: PIDs = $($listening.OwningProcess -join ',')"
} else {
    Write-Host "Port 8000 is FREE"
}
