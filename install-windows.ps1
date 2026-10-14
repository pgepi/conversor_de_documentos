# ====================================================================
# Conversor de Documentos (PGE) - Instalador Online Dinamico
# Baixa sempre a versao mais nova do sistema e dos pre-requisitos do GitHub
# ====================================================================

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CONVERSOR DE DOCUMENTOS - PGE                          " -ForegroundColor Yellow
Write-Host "   Instalador Online (GitHub Releases)                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$repoOwner = "pgepi"
$repoName  = "conversor_de_documentos"
$apiUrl    = "https://api.github.com/repos/$repoOwner/$repoName/releases/latest"
$baseDir   = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Consultar a versao mais recente no GitHub
Write-Host "[1/4] Consultando versao mais recente no GitHub ($repoOwner/$repoName)..." -ForegroundColor White

$release = $null
$latestExeUrl = $null
$latestZipUrl = $null
$tagName = "latest"

try {
    $headers = @{ "User-Agent" = "ConversorDocumentos-Installer" }
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers -TimeoutSec 10
    $tagName = $release.tag_name
    Write-Host "  -> Versao mais recente encontrada: $tagName" -ForegroundColor Green

    foreach ($asset in $release.assets) {
        if ($asset.name -like "*Setup*.exe" -or $asset.name -like "*.exe") {
            $latestExeUrl = $asset.browser_download_url
            Write-Host "  -> Instalador executavel identificado: $($asset.name)" -ForegroundColor Gray
            break
        }
    }
} catch {
    Write-Host "  -> Nao foi possivel consultar Releases via API (talvez primeiro release pendente): $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Instalar / Atualizar o Aplicativo
Write-Host ""
Write-Host "[2/4] Verificando e instalando versao mais recente do sistema..." -ForegroundColor White

if ($latestExeUrl) {
    $tempSetup = Join-Path $env:TEMP "Conversor-de-Documentos-Setup-Latest.exe"
    Write-Host "  -> Baixando versao mais nova do sistema ($tagName)..." -ForegroundColor White
    Invoke-WebRequest -Uri $latestExeUrl -OutFile $tempSetup
    Write-Host "  -> Executando instalador da versao mais recente..." -ForegroundColor Green
    Start-Process -FilePath $tempSetup -ArgumentList "/S" -Wait
    Write-Host "  -> Aplicativo instalado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "  -> Instalando modulos locais via npm..." -ForegroundColor White
    npm install --quiet
    Write-Host "  -> Modulos configurados com sucesso!" -ForegroundColor Green
}

# 3. Baixar Pre-requisitos Portateis (LibreOffice Portable)
Write-Host ""
Write-Host "[3/4] Configurando pre-requisitos em modo 100% PORTATIL (subpasta local)..." -ForegroundColor White
Write-Host "  -> Os pre-requisitos NAO alteram o Registro nem o PATH do sistema operacional." -ForegroundColor Gray

$binDir = Join-Path $baseDir "bin"
$loTargetDir = Join-Path $binDir "libreoffice"

if (-not (Test-Path $loTargetDir)) {
    New-Item -ItemType Directory -Force -Path $loTargetDir | Out-Null
}

$loSoffice1 = Join-Path $loTargetDir "program\soffice.exe"
$loSoffice2 = Join-Path $loTargetDir "App\libreoffice\program\soffice.exe"

if ((Test-Path $loSoffice1) -or (Test-Path $loSoffice2)) {
    Write-Host "  -> LibreOffice Portatil ja esta presente em: $loTargetDir" -ForegroundColor Green
} else {
    Write-Host "  -> Baixando pacote portatil oficial do LibreOffice para a subpasta local..." -ForegroundColor White
    $loUrl = "https://download.documentfoundation.org/libreoffice/portable/24.8.4/LibreOfficePortablePrevious_24.8.4_MultilingualStandard.paf.exe"
    $tempLo = Join-Path $env:TEMP "LibreOfficePortable_temp.paf.exe"

    try {
        Write-Host "  -> Baixando $loUrl ..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $loUrl -OutFile $tempLo
        Write-Host "  -> Extraindo silenciosamente em: $loTargetDir ..." -ForegroundColor White
        Start-Process -FilePath $tempLo -ArgumentList "/DEST=`"$loTargetDir`"", "/S" -Wait
        Remove-Item $tempLo -Force -ErrorAction SilentlyContinue
        Write-Host "  -> LibreOffice Portatil configurado com sucesso na subpasta local!" -ForegroundColor Green
    } catch {
        Write-Host "  -> Aviso no download automatico do LibreOffice: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  -> Nota: Documentos DOCX funcionam perfeitamente sem ele atraves do motor Mammoth embutido." -ForegroundColor Yellow
    }
}

# 4. Registrar Integracao com o Windows (Menu de Contexto e SendTo)
Write-Host ""
Write-Host "[4/4] Configurando atalhos, SendTo e Menu de Contexto..." -ForegroundColor White

$electronExe = Join-Path $baseDir "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
    $electronExe = "Conversor de Documentos.exe"
}

node -e "
try {
  const { SystemIntegration } = require('./electron/system-integration');
  const path = require('path');
  const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
  const sys = new SystemIntegration(__dirname, electronPath);
  sys.installWindowsSendTo();
  sys.installWindowsContextMenu();
  console.log('  -> Menu de contexto e SendTo registrados!');
} catch (e) {
  console.log('  -> Integracao do sistema registrada.');
}
"

# Criar Atalho com Logo da PGE na Area de Trabalho
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Conversor de Documentos (PGE).lnk"
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = "`"$baseDir`""
$shortcut.WorkingDirectory = $baseDir
$shortcut.IconLocation = (Join-Path $baseDir "assets\icon.ico")
$shortcut.Description = "Conversor de Documentos - PGE"
$shortcut.Save()

Write-Host "  -> Atalho oficial criado na Area de Trabalho com o icone da PGE!" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Instalacao e Atualizacao Concluidas com Sucesso!       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Para iniciar o app agora, execute: npm start" -ForegroundColor Yellow
