# Stop hook: run the test suite at turn end. Spec 010 (restores 003-removed enforcement).
# External .ps1 invoked via -File so no bash-wrapper $VAR stripping (003 lesson).
# Writes tail to stderr and exits 2 on failure so Claude must fix a red suite before stopping.
$ErrorActionPreference = 'Continue'

try {
    $output = & pnpm test:ci 2>&1 | Out-String
    $code = $LASTEXITCODE
} catch {
    [Console]::Error.WriteLine("Stop hook: could not run pnpm test:ci - $($_.Exception.Message)")
    exit 0
}

$lines = $output -split "`r?`n"
$tail = ($lines | Select-Object -Last 20) -join "`n"
[Console]::Error.WriteLine($tail)

if ($code -ne 0) {
    [Console]::Error.WriteLine("Stop hook: pnpm test:ci FAILED (exit $code). Fix tests before ending the turn (AGENTS.md section 3 gates).")
    exit 2
}
[Console]::Error.WriteLine("Stop hook: tests green. Reminder: spec linked? sections cited? scope respected?")
exit 0