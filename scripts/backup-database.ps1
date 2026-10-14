param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

. (Join-Path $PSScriptRoot "database-connection.ps1")
$environmentNames = @("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE")
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    throw "pg_dump was not found. Install the PostgreSQL command-line tools and retry."
  }
  $databaseLine = if ($env:DATABASE_URL) { $env:DATABASE_URL } else {
    $environmentFile = Join-Path $PSScriptRoot "..\backend\.env"
    if (Test-Path -LiteralPath $environmentFile) {
      (Get-Content -LiteralPath $environmentFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1) -replace '^\s*DATABASE_URL\s*=\s*', ''
    }
  }
  if (-not $databaseLine) {
    throw "Set DATABASE_URL or add it to backend\.env before running a backup."
  }
  $databaseLine = $databaseLine.Trim().Trim('"').Trim("'")
  $databaseUri = [Uri]::new($databaseLine)
  $databaseName = [Uri]::UnescapeDataString($databaseUri.AbsolutePath.TrimStart("/"))
  if (-not $databaseName) {
    throw "DATABASE_URL does not specify a database name."
  }

  Set-PostgresConnectionEnvironment -TargetDatabase $databaseName
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
  $backupPath = Join-Path $OutputDirectory "pickleball-$timestamp.dump"
  & pg_dump --format=custom --no-owner --no-acl --file $backupPath
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force }
    throw "pg_dump failed with exit code $LASTEXITCODE."
  }
  Write-Output "Database backup created: $backupPath"
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}
