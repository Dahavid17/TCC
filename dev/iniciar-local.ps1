# Sobe o ambiente LOCAL do Marketplace Rural sem mexer no MySQL principal da maquina:
#   1. MySQL de testes na porta 3307 (dados em %LOCALAPPDATA%\MarketplaceRuralDev\mysql-data)
#   2. Banco marketplace_rural_dev (estrutura + migracao 004 + conta de teste), so na primeira vez
#   3. Servidor PHP em http://127.0.0.1:8080 (usa dev/router.php -> dev/config.dev.php)
#
# Uso, na raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File dev\iniciar-local.ps1
#   powershell -ExecutionPolicy Bypass -File dev\iniciar-local.ps1 -SemServidor   (so o banco)

param(
    [switch]$SemServidor,
    [string]$MySqlBase = 'C:\Program Files\MySQL\MySQL Server 8.4',
    [string]$Php = 'C:\xampp\php\php.exe',
    [int]$PortaMySql = 3307,
    [int]$PortaSite = 8080
)

$ErrorActionPreference = 'Stop'

$raiz   = Split-Path -Parent $PSScriptRoot
$dados  = Join-Path $env:LOCALAPPDATA 'MarketplaceRuralDev\mysql-data'
$mysqld = Join-Path $MySqlBase 'bin\mysqld.exe'
$mysql  = Join-Path $MySqlBase 'bin\mysql.exe'

if (-not (Test-Path $mysqld)) { throw "MySQL nao encontrado em $MySqlBase (use -MySqlBase)." }
if (-not (Test-Path $Php))    { throw "PHP nao encontrado em $Php (use -Php)." }

function MySqlEscutando {
    [bool](Get-NetTCPConnection -LocalPort $PortaMySql -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-Path $dados)) {
    Write-Host 'Criando a pasta de dados do MySQL de testes...'
    New-Item -ItemType Directory -Force (Split-Path $dados) | Out-Null
    & $mysqld --initialize-insecure "--basedir=$MySqlBase" "--datadir=$dados"
}

if (-not (MySqlEscutando)) {
    Write-Host "Iniciando o MySQL de testes na porta $PortaMySql..."
    Start-Process -FilePath $mysqld -WindowStyle Hidden -ArgumentList @(
        "--basedir=`"$MySqlBase`"", "--datadir=`"$dados`"", "--port=$PortaMySql",
        '--mysqlx=OFF', '--bind-address=127.0.0.1'
    )

    for ($i = 0; $i -lt 30 -and -not (MySqlEscutando); $i++) { Start-Sleep -Seconds 1 }

    if (-not (MySqlEscutando)) { throw 'O MySQL de testes nao respondeu na porta.' }
}

$conexao = @('-h', '127.0.0.1', '-P', "$PortaMySql", '-u', 'root', '--default-character-set=utf8mb4')
$existe  = & $mysql @conexao -N -e "SHOW DATABASES LIKE 'marketplace_rural_dev'"

if (-not $existe) {
    Write-Host 'Criando o banco marketplace_rural_dev...'
    $sql = { param($arquivo) (Join-Path $raiz $arquivo) -replace '\\', '/' }

    & $mysql @conexao -e ("source " + (& $sql 'dev\banco-dev.sql'))
    & $mysql @conexao marketplace_rural_dev -e ("source " + (& $sql 'banco\migracoes\004_iot_sensores.sql'))
    & $mysql @conexao marketplace_rural_dev -e ("source " + (& $sql 'dev\seed-dev.sql'))

    Write-Host 'Banco pronto. A conta de teste esta descrita em dev\seed-dev.sql.'
}

if ($SemServidor) {
    Write-Host "MySQL de testes ativo em 127.0.0.1:$PortaMySql."
    return
}

Write-Host ''
Write-Host "Marketplace local: http://127.0.0.1:$PortaSite/frontend/pages/login-marketplace.html"
Write-Host 'Ctrl+C encerra o servidor PHP (o MySQL de testes continua rodando).'
Write-Host ''

& $Php -S "127.0.0.1:$PortaSite" -t $raiz (Join-Path $raiz 'dev\router.php')
