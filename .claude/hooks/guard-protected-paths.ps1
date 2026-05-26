# PreToolUse guard: block edits to constitutional / secret / governance files.
# Reads hook input JSON from stdin. Emits decision JSON to stdout.
# Exit 0 = allow. Exit 2 = block with reason on stderr.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $input = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$tool = $input.tool_name
if ($tool -ne 'Write' -and $tool -ne 'Edit') { exit 0 }

$path = $input.tool_input.file_path
if (-not $path) { exit 0 }

$normalized = $path -replace '\\', '/'

$protected = @(
    '/CONSTITUTION\.md$',
    '/AGENTS\.md$',
    '/CLAUDE\.md$',
    '/\.claude/settings\.json$',
    '/\.claude/harness\.json$',
    '/\.claude/hooks/',
    '/\.claude/skills/',
    '/specs/governance/',
    '/\.env(\.|$)',
    '/scripts/build-push\.sh$'
)

foreach ($pattern in $protected) {
    if ($normalized -match $pattern) {
        Write-Error "BLOCKED: $path is governance/protected. Amend via specs/governance/ + human approval. See CONSTITUTION.md §7.1 + §8.2."
        exit 2
    }
}

exit 0
