$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
Write-Host "Processes on port 8000:"
foreach ($conn in $listening) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    $wmi = Get-WmiObject Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" -ErrorAction SilentlyContinue
    Write-Host "  PID=$($conn.OwningProcess) Name=$($proc.Name) StartTime=$($proc.StartTime) Cmd=$($wmi.CommandLine)"
}
