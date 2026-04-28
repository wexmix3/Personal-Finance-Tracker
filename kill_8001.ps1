$listening = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
$procIds = $listening.OwningProcess | Sort-Object -Unique
Write-Host "Killing port 8001 PIDs: $procIds"
Stop-Process -Id $procIds -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$still = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
Write-Host "Still on 8001: $($still.Count)"
