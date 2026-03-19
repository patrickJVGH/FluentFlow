param(
  [string]$Remote = "origin",
  [string]$Branch = "",
  [switch]$FollowRuntime,
  [int]$TimeoutMinutes = 8
)

. "$PSScriptRoot\vercel-common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$resolvedBranch = if ($Branch) { $Branch } else { (git rev-parse --abbrev-ref HEAD).Trim() }
if ($LASTEXITCODE -ne 0 -or -not $resolvedBranch) {
  throw "Nao foi possivel resolver a branch atual."
}

Write-Host "Git push -> $Remote/$resolvedBranch"
git push $Remote $resolvedBranch
if ($LASTEXITCODE -ne 0) {
  throw "Falha no git push."
}

$watchArgs = @(
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $PSScriptRoot "vercel-watch-head-deployment.ps1"),
  "-TimeoutMinutes", $TimeoutMinutes
)

if ($FollowRuntime) {
  $watchArgs += "-FollowRuntime"
}

& powershell @watchArgs
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao acompanhar o deployment na Vercel."
}
