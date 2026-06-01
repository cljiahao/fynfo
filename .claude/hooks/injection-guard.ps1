# UserPromptSubmit hook: block obvious prompt-injection phrases (OWASP LLM01). Spec 010.
# Reads hook JSON from stdin; exit 2 blocks the prompt with a reason on stderr; exit 0 allows.
# Deny list is intentionally minimal — extend for this project's domain as needed.
$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$promptText = ''
if ($data.prompt) { $promptText = [string]$data.prompt }
$lower = $promptText.ToLowerInvariant()

$deny = @(
    'ignore previous instructions',
    'ignore all previous instructions',
    'ignore all instructions',
    'disregard previous instructions',
    'disregard your instructions',
    'forget your instructions',
    'you are now a ',
    'you are now an '
)

foreach ($phrase in $deny) {
    if ($lower.Contains($phrase)) {
        [Console]::Error.WriteLine("BLOCKED: prompt matches injection pattern '$phrase' (OWASP LLM01). Rephrase, or extend the deny list in .claude/hooks/injection-guard.ps1.")
        exit 2
    }
}
exit 0