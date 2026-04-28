$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
Write-Host "Processes on port 8000:"
foreach ($conn in $listening) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "  PID=$($conn.OwningProcess) Name=$($proc.Name) Path=$($proc.Path)"
}

# Kill them all
$procIds = $listening.OwningProcess | Sort-Object -Unique
Write-Host "Killing: $procIds"
Stop-Process -Id $procIds -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$still = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
Write-Host "Still listening after kill: $($still.Count) processes"
