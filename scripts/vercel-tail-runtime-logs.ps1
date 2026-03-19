param(
  [string]$Since = "15m",
  [string]$Environment = "production",
  [string]$Project = "",
  [string]$OutFile = "",
  [string]$RequestId = "",
  [string]$Query = "",
  [switch]$NoFollow
)

. "$PSScriptRoot\vercel-common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$resolvedProject = if ($Project) { $Project } else { Get-LinkedVercelProjectName }
$logDir = Ensure-VercelLogDir
$resolvedOutFile = if ($OutFile) { $OutFile } else { Join-Path $logDir "runtime-live.log" }

$args = @(
  "logs",
  "--project", $resolvedProject,
  "--environment", $Environment,
  "--since", $Since,
  "--json"
)

if (-not $NoFollow) {
  $args += "--follow"
}

if ($RequestId) {
  $args += @("--request-id", $RequestId)
}

if ($Query) {
  $args += @("--query", $Query)
}

Write-Host "Vercel runtime logs -> $resolvedOutFile"
Write-Host "Projeto: $resolvedProject | Ambiente: $Environment | Since: $Since | Follow: $(-not $NoFollow)"

Invoke-VercelCliText @args | Tee-Object -FilePath $resolvedOutFile
