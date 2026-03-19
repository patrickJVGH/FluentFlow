param(
  [string]$Environment = "production",
  [string]$Project = "",
  [int]$TimeoutMinutes = 8,
  [int]$PollSeconds = 5,
  [switch]$FollowRuntime
)

. "$PSScriptRoot\vercel-common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$resolvedProject = if ($Project) { $Project } else { Get-LinkedVercelProjectName }
$sha = Get-HeadCommitSha
$shortSha = $sha.Substring(0, 7)
$logDir = Ensure-VercelLogDir
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$deployment = $null

Write-Host "Aguardando deployment do commit $shortSha no projeto $resolvedProject..."

while ((Get-Date) -lt $deadline) {
  $raw = Invoke-VercelCli list $resolvedProject --environment $Environment --meta "githubCommitSha=$sha" --format json
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao consultar deployments da Vercel."
  }

  $parsed = $raw | ConvertFrom-Json
  if ($parsed.deployments -and $parsed.deployments.Count -gt 0) {
    $deployment = $parsed.deployments | Sort-Object createdAt -Descending | Select-Object -First 1
    break
  }

  Start-Sleep -Seconds $PollSeconds
}

if (-not $deployment) {
  throw "Nenhum deployment encontrado para o commit $shortSha dentro de ${TimeoutMinutes}m."
}

$deploymentUrl = "https://$($deployment.url)"
$stamp = Get-LogTimestamp
$metaFile = Join-Path $logDir "deployment-$stamp-$shortSha.json"
$buildLogFile = Join-Path $logDir "build-$stamp-$shortSha.log"

$deployment | ConvertTo-Json -Depth 12 | Set-Content -Path $metaFile

Write-Host "Deployment encontrado: $deploymentUrl"
Write-Host "Build logs -> $buildLogFile"

Invoke-VercelCliText inspect $deploymentUrl --wait --timeout "${TimeoutMinutes}m" --logs | Tee-Object -FilePath $buildLogFile

if ($FollowRuntime) {
  $runtimeLogFile = Join-Path $logDir "runtime-$stamp-$shortSha.log"
  Write-Host "Runtime logs -> $runtimeLogFile"
  Invoke-VercelCliText logs $deploymentUrl --json | Tee-Object -FilePath $runtimeLogFile
}
