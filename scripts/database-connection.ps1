function Set-PostgresConnectionEnvironment {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetDatabase
  )

  $databaseUrl = $env:DATABASE_URL
  if (-not $databaseUrl) {
    $environmentFile = Join-Path $PSScriptRoot "..\backend\.env"
    if (-not (Test-Path -LiteralPath $environmentFile)) {
      throw "Set DATABASE_URL or create backend\.env with a DATABASE_URL entry."
    }
    $databaseLine = Get-Content -LiteralPath $environmentFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $databaseLine) {
      throw "No DATABASE_URL entry was found in backend\.env."
    }
    $databaseUrl = ($databaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  }

  try {
    $uri = [Uri]::new($databaseUrl)
  } catch {
    throw "DATABASE_URL is not a valid PostgreSQL connection URL."
  }
  if ($uri.Scheme -notin @("postgres", "postgresql")) {
    throw "DATABASE_URL must use the postgres or postgresql scheme."
  }

  $separator = $uri.UserInfo.IndexOf(":")
  if ($separator -lt 1) {
    throw "DATABASE_URL must include a database username and password."
  }
  $username = [Uri]::UnescapeDataString($uri.UserInfo.Substring(0, $separator))
  $password = [Uri]::UnescapeDataString($uri.UserInfo.Substring($separator + 1))
  if (-not $uri.Host -or -not $username -or -not $password) {
    throw "DATABASE_URL must include a database host, username, and password."
  }

  $env:PGHOST = $uri.Host
  $env:PGPORT = if ($uri.IsDefaultPort) { "5432" } else { [string]$uri.Port }
  $env:PGUSER = $username
  $env:PGPASSWORD = $password
  $env:PGDATABASE = $TargetDatabase
  if ($uri.Query -match '(?:\?|&)sslmode=([^&]+)') {
    $env:PGSSLMODE = [Uri]::UnescapeDataString($Matches[1])
  }
}
