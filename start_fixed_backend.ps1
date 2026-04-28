$backendDir = "C:\Users\maxmw\Downloads\Claude\finance-dashboard\backend"
Set-Location $backendDir
Write-Host "Starting fixed backend on port 8001..."
& "$backendDir\.venv\Scripts\python.exe" main.py
