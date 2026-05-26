# PowerShell equivalent of scripts/backup-to-supabase.sh for Windows dev hosts
# without bash. Requires pg_dump.exe + psql.exe on PATH.
#
# Usage:
#   powershell -File scripts/backup-to-supabase.ps1
#   powershell -File scripts/backup-to-supabase.ps1 -DryRun
#   powershell -File scripts/backup-to-supabase.ps1 -KeepDump

param(
    [switch]$DryRun,
    [switch]$KeepDump
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ScriptDir '.env.backup'

if (-not (Test-Path $EnvFile)) {
    Write-Error "missing $EnvFile - copy from .env.backup.example and fill in connection strings"
    exit 1
}

# Source key=value pairs into env vars
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim().Trim('"').Trim("'")
        Set-Item -Path "env:$key" -Value $val
    }
}

if (-not $env:PROD_DATABASE_URL) { Write-Error 'PROD_DATABASE_URL not set'; exit 1 }
if (-not $env:BACKUP_DATABASE_URL) { Write-Error 'BACKUP_DATABASE_URL not set'; exit 1 }
if ($env:PROD_DATABASE_URL -eq $env:BACKUP_DATABASE_URL) {
    Write-Error 'PROD and BACKUP urls are identical - refusing to overwrite prod with itself'
    exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error 'pg_dump not on PATH - install Postgres client tools'; exit 1
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Error 'psql not on PATH - install Postgres client tools'; exit 1
}

$Tables = @(
    'public.users_profile',
    'public.equity_trades',
    'public.expense_records',
    'public.expense_splits',
    'public.salary_records',
    'public.monthly_snapshots',
    'public.asset_entries',
    'public.tax_relief_entries',
    'public.planner_settings'
)

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DumpDir = Join-Path $ProjectRoot '.supabase-backups'
if (-not (Test-Path $DumpDir)) { New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null }
$DumpFile = Join-Path $DumpDir "vault-$Timestamp.sql"

Write-Host "[1/3] pg_dump -> $DumpFile"
$tableArgs = $Tables | ForEach-Object { "--table=$_" }
& pg_dump $env:PROD_DATABASE_URL `
    @tableArgs `
    --data-only --column-inserts --no-owner --no-privileges --no-comments --quote-all-identifiers `
    | Out-File -Encoding utf8 -FilePath $DumpFile
if ($LASTEXITCODE -ne 0) { Write-Error 'pg_dump failed'; exit 1 }

$DumpSize = (Get-Item $DumpFile).Length
$DumpRows = (Get-Content $DumpFile | Where-Object { $_ -match '^INSERT INTO' }).Count
Write-Host "    dump ok - $DumpSize bytes, $DumpRows rows"

if ($DryRun) {
    Write-Host "-DryRun set - skipping restore. dump kept at $DumpFile"
    exit 0
}

Write-Host '[2/3] truncate backup tables'
$truncateList = ($Tables -join ', ')
& psql $env:BACKUP_DATABASE_URL -v ON_ERROR_STOP=1 -c "TRUNCATE $truncateList RESTART IDENTITY CASCADE;"
if ($LASTEXITCODE -ne 0) { Write-Error 'truncate failed'; exit 1 }

Write-Host '[3/3] psql restore from dump'
& psql $env:BACKUP_DATABASE_URL -v ON_ERROR_STOP=1 --single-transaction -f $DumpFile | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'restore failed'; exit 1 }

foreach ($t in $Tables) {
    $prodN = (& psql $env:PROD_DATABASE_URL -At -c "SELECT COUNT(*) FROM $t;").Trim()
    $backN = (& psql $env:BACKUP_DATABASE_URL -At -c "SELECT COUNT(*) FROM $t;").Trim()
    if ($prodN -ne $backN) {
        Write-Error "    $t : MISMATCH (prod=$prodN backup=$backN)"
        exit 1
    }
    Write-Host "    $t : $prodN rows"
}

if ($KeepDump) {
    Write-Host "dump retained at $DumpFile"
} else {
    Remove-Item -Force $DumpFile
}

Write-Host "backup complete - $Timestamp"
