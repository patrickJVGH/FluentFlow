function Get-RepoRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Get-VercelCliPath {
  $repoRoot = Get-RepoRoot
  $localCli = Join-Path $repoRoot "node_modules\.bin\vercel.cmd"
  if (Test-Path $localCli) {
    return $localCli
  }

  return "vercel"
}

function Get-LinkedVercelProjectName {
  $repoRoot = Get-RepoRoot
  $projectFile = Join-Path $repoRoot ".vercel\project.json"
  if (-not (Test-Path $projectFile)) {
    throw "Projeto Vercel nao vinculado. Rode 'npx.cmd vercel link --yes --project fluentflow'."
  }

  $project = Get-Content $projectFile -Raw | ConvertFrom-Json
  if (-not $project.projectName) {
    throw "Nao foi possivel resolver o projectName em .vercel/project.json."
  }

  return [string]$project.projectName
}

function Ensure-VercelLogDir {
  $repoRoot = Get-RepoRoot
  $logDir = Join-Path $repoRoot "logs\vercel"
  if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  }
  return $logDir
}

function Get-HeadCommitSha {
  $repoRoot = Get-RepoRoot
  $sha = git -C $repoRoot rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or -not $sha) {
    throw "Nao foi possivel resolver o commit atual com git rev-parse HEAD."
  }
  return $sha.Trim()
}

function Get-LogTimestamp {
  return (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Invoke-VercelCli {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  $cli = Get-VercelCliPath
  $repoRoot = Get-RepoRoot
  & $cli --cwd $repoRoot @Arguments
}

function Convert-ToCmdArgument {
  param([string]$Value)

  if ([string]::IsNullOrEmpty($Value)) {
    return '""'
  }

  if ($Value -notmatch '[\s"&^<>()|]') {
    return $Value
  }

  return '"' + ($Value -replace '"', '""') + '"'
}

function Invoke-VercelCliText {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  $cli = Get-VercelCliPath
  $repoRoot = Get-RepoRoot
  $parts = @(
    (Convert-ToCmdArgument $cli),
    "--cwd",
    (Convert-ToCmdArgument $repoRoot)
  ) + ($Arguments | ForEach-Object { Convert-ToCmdArgument $_ })

  & cmd.exe /d /c ($parts -join " ")
}
