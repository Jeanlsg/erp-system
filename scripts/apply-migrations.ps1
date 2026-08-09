# =====================================================
# Script PowerShell para aplicar migrations no Supabase
#
# Uso:
#   .\scripts\apply-migrations.ps1 -DatabaseUrl "postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres"
#
# Ou defina DATABASE_URL no .env:
#   .\scripts\apply-migrations.ps1
# =====================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$DatabaseUrl = ""
)

$ErrorActionPreference = "Stop"

# Cores
function Write-Header { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  $msg" -ForegroundColor Green }
function Write-Error-Custom { param($msg) Write-Host "  $msg" -ForegroundColor Red }
function Write-Warn { param($msg) Write-Host "  $msg" -ForegroundColor Yellow }

# Pegar DATABASE_URL do argumento ou .env
if (-not $DatabaseUrl -and (Test-Path ".env")) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^DATABASE_URL=(.+)$') {
            $DatabaseUrl = $matches[1].Trim('"').Trim("'")
        }
    }
}

if (-not $DatabaseUrl) {
    Write-Host "❌ DATABASE_URL não definida" -ForegroundColor Red
    Write-Host "Uso: .\apply-migrations.ps1 -DatabaseUrl 'postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres'"
    exit 1
}

# Verificar psql
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql não encontrado. Adicione o PostgreSQL ao PATH." -ForegroundColor Red
    Write-Host "Geralmente em: C:\Program Files\PostgreSQL\<versão>\bin"
    exit 1
}

# Diretório de migrations
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$MigrationsDir = Join-Path $ProjectRoot "supabase\migrations"

if (-not (Test-Path $MigrationsDir)) {
    Write-Host "❌ Diretório não encontrado: $MigrationsDir" -ForegroundColor Red
    exit 1
}

# Esconder senha na URL
$maskedUrl = ($DatabaseUrl -replace '://[^:]+:[^@]+@', '://***:***@')

Write-Host "🚀 Aplicador de Migrations" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "📡 URL: $maskedUrl"
Write-Host ""

# Listar migrations
$migrations = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
$total = $migrations.Count
$current = 0

foreach ($migration in $migrations) {
    $current++
    $filename = $migration.Name
    
    Write-Host "[$current/$total] " -NoNewline -ForegroundColor Yellow
    Write-Host "Aplicando: $filename" -ForegroundColor Cyan
    
    try {
        $env:PGPASSWORD = $null
        & psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $migration.FullName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ OK"
        } else {
            throw "psql falhou com código $LASTEXITCODE"
        }
    } catch {
        Write-Error-Custom "✗ FALHOU: $_"
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Todas as migrations foram aplicadas com sucesso!" -ForegroundColor Green
Write-Host "Total: $total migrations"