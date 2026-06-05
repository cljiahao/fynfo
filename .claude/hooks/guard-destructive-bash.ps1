# PreToolUse guard: block destructive shell commands that lack explicit owner approval.
  # Reads hook input JSON from stdin. Exit 2 = block.

  $ErrorActionPreference = 'Stop'

  try {
      $raw = [Console]::In.ReadToEnd()
      if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
      $payload = $raw | ConvertFrom-Json
  } catch {
      exit 0
  }

  if ($payload.tool_name -ne 'Bash') { exit 0 }
  $cmd = $payload.tool_input.command
  if (-not $cmd) { exit 0 }

  # Patterns that should never run unsupervised.
  $banned = @(
      'git\s+push\s+.*--force',
      'git\s+push\s+.*-f(\s|$)',
      'git\s+reset\s+--hard',
      'git\s+clean\s+-fd?',
      'git\s+branch\s+-D',
      '--no-verify',
      'git\s+commit\s+.*-n(\s|$)',
      'rm\s+-rf?\s+/',
      'rm\s+-rf?\s+(src|test|tests|\.husky|\.git)\b',
      'rm\s+.*-r.*-f.*\s+(src|test)\b',
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
          [Console]::Error.WriteLine("BLOCKED: command matches destructive pattern '$pattern'. Requires explicit owner
  approval - escalate per AGENTS.md S0.")
          exit 2
      }
  }

  exit 0