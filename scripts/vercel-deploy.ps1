param(
  [switch]$Production,
  [switch]$NoWait,
  [switch]$Force
)

. "$PSScriptRoot\vercel-common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$project = Get-LinkedVercelProjectName
$logDir = Ensure-VercelLogDir
$stamp = Get-LogTimestamp
$suffix = if ($Production) { "prod" } else { "preview" }
$logFile = Join-Path $logDir "deploy-$stamp-$suffix.log"

$args = @("deploy", "--yes", "--logs")
if ($Production) {
  $args += "--prod"
}
if ($NoWait) {
  $args += "--no-wait"
}
if ($Force) {
  $args += "--force"
}

Write-Host "Vercel deploy -> $logFile"
Write-Host "Projeto: $project | Production: $Production"

Invoke-VercelCliText @args | Tee-Object -FilePath $logFile
