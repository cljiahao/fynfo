# PreToolUse guard: block edits to constitutional / governance / secret / CI files.
# Reads hook input JSON from stdin. Exit 0 = allow. Exit 2 = block (reason on stderr).
$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$tool = $payload.tool_name
if ($tool -ne 'Write' -and $tool -ne 'Edit') { exit 0 }

$path = $payload.tool_input.file_path
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
    '/scripts/build-push\.sh$',
    '/\.github/workflows/',
    '\.(pem|key|p12|pfx|secret)$',
    '/(credentials\.json|\.netrc|\.secrets)$'
)

foreach ($pattern in $protected) {
    if ($normalized -match $pattern) {
        [Console]::Error.WriteLine("BLOCKED: $path is governance/secret/CI-protected. Amend governance via specs/governance/ + human approval (CONSTITUTION.md S7.1 + S8.2); secrets/CI files are never agent-editable.")
        exit 2
    }
}

exit 0