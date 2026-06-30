# Mata processos ouvindo na porta 3001 (dev:api watch)
$conns = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if ($procId -and $procId -match '^\d+$') {
            Write-Host "Killing PID $procId"
            Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 2
$remaining = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Remaining on 3001: $remaining"