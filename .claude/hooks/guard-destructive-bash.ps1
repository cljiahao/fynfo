# PreToolUse guard: block destructive shell commands that lack explicit owner approval.
# Reads hook input JSON from stdin. Exit 2 = block.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $input = $raw | ConvertFrom-Json
} catch {
    exit 0
}

if ($input.tool_name -ne 'Bash') { exit 0 }
$cmd = $input.tool_input.command
if (-not $cmd) { exit 0 }

# Patterns that should never run unsupervised.
$banned = @(
    'git\s+push\s+.*--force',
    'git\s+push\s+.*-f(\s|$)',
    'git\s+reset\s+--hard',
    'git\s+clean\s+-fd?',
    'git\s+branch\s+-D',
    'rm\s+-rf\s+/',
    'docker\s+push',
    './scripts/build-push\.sh',
    'supabase\s+db\s+reset',
    'psql.*-c\s+["'']?\s*DROP\s+',
    'DROP\s+TABLE',
    'DROP\s+DATABASE',
    '>\s*\.env'
)

foreach ($pattern in $banned) {
    if ($cmd -match $pattern) {
        Write-Error "BLOCKED: command matches destructive pattern '$pattern'. Requires explicit owner approval — escalate per AGENTS.md §0."
        exit 2
    }
}

exit 0
