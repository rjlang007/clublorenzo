param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [string]$TargetDatabase
)

. (Join-Path $PSScriptRoot "database-connection.ps1")
$environmentNames = @("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE")
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
    throw "Backup file not found: $BackupFile"
  }
  if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
    throw "pg_restore was not found. Install the PostgreSQL command-line tools and retry."
  }

  $resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
  & pg_restore --list $resolvedBackup > $null
  if ($LASTEXITCODE -ne 0) {
    throw "The selected file is not a readable PostgreSQL custom-format backup."
  }

  Set-PostgresConnectionEnvironment -TargetDatabase $TargetDatabase
  Write-Warning "This replaces objects in the target database '$TargetDatabase'. Use a separate, empty test database for a restore drill."
  $confirmation = Read-Host "Type '$TargetDatabase' to confirm the restore target"
  if ($confirmation -cne $TargetDatabase) {
    throw "Restore cancelled because the target database name did not match."
  }

  & pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction --dbname $TargetDatabase $resolvedBackup
  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed with exit code $LASTEXITCODE."
  }
  Write-Output "Database restore completed for target '$TargetDatabase'."
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}
