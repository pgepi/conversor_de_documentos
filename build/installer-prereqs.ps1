param(
    [switch]$InstallLibreOffice,
    [switch]$InstallPython,
    [string]$TargetDir = ""
)

if (-not $TargetDir) {
    $TargetDir = Split-Path -Parent $PSScriptRoot
}

Write-Host "=================================================="
Write-Host "Conversor de Documentos - Configurador de Componentes"
Write-Host "Destino da Instalacao: $TargetDir"
Write-Host "=================================================="

# 1. LIBREOFFICE PORTATIL
if ($InstallLibreOffice) {
    $loTarget = Join-Path $TargetDir "bin\libreoffice"
    $sofficeExe = Join-Path $loTarget "program\soffice.exe"
    $sofficeAppExe = Join-Path $loTarget "App\libreoffice\program\soffice.exe"

    if ((Test-Path $sofficeExe) -or (Test-Path $sofficeAppExe)) {
        Write-Host "LibreOffice já instalado em $loTarget. Pulando download."
    } else {
        Write-Host "Calculando versao mais recente do LibreOffice Portable..."
        $latestUrl = "http://tdf.c3sl.ufpr.br/libreoffice/portable/26.2.4/LibreOfficePortable_26.2.4_MultilingualStandard.paf.exe"
        try {
            $web = New-Object System.Net.WebClient
            $html = $web.DownloadString("http://tdf.c3sl.ufpr.br/libreoffice/portable/")
            $matches = [regex]::Matches($html, 'href="([0-9]+\.[0-9]+\.[0-9]+)/?"')
            $versions = @()
            foreach ($m in $matches) {
                $versions += $m.Groups[1].Value
            }
            if ($versions.Count -gt 0) {
                $sorted = $versions | Sort-Object { [version]$_ } -Descending
                $topVer = $sorted[0]
                $latestUrl = "http://tdf.c3sl.ufpr.br/libreoffice/portable/$topVer/LibreOfficePortable_${topVer}_MultilingualStandard.paf.exe"
                Write-Host "Versao mais recente detectada nos espelhos: $topVer"
            }
        } catch {
            Write-Host "Aviso: Consulta automatica de versoes falhou. Usando versao estavel 26.2.4."
        }

        $tmpInstaller = Join-Path $env:TEMP "LibreOfficePortable_Setup_$([System.IO.Path]::GetRandomFileName()).paf.exe"
        Write-Host "Baixando instalador portatil de: $latestUrl"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($latestUrl, $tmpInstaller)
            Write-Host "Download concluido! Extraindo binarios portateis em: $loTarget"
            New-Item -ItemType Directory -Force -Path $loTarget | Out-Null
            $proc = Start-Process -FilePath $tmpInstaller -ArgumentList "/DEST=$loTarget", "/S" -Wait -PassThru
            Write-Host "Extracao concluida (codigo $($proc.ExitCode))."
            Remove-Item -Force $tmpInstaller -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Erro no download/extracao do LibreOffice: $($_.Exception.Message)"
        }
    }
}

# 2. PYTHON PORTATIL
if ($InstallPython) {
    $pyTarget = Join-Path $TargetDir "bin\python"
    $pyExe = Join-Path $pyTarget "python.exe"

    if (Test-Path $pyExe) {
        Write-Host "Python portatil ja presente em $pyTarget. Pulando download."
    } else {
        Write-Host "Baixando pacote Python Embeddable 64-bit..."
        $pyUrl = "https://www.python.org/ftp/python/3.12.9/python-3.12.9-embed-amd64.zip"
        $tmpZip = Join-Path $env:TEMP "python-embed-$([System.IO.Path]::GetRandomFileName()).zip"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($pyUrl, $tmpZip)
            Write-Host "Download concluido! Extraindo para: $pyTarget"
            New-Item -ItemType Directory -Force -Path $pyTarget | Out-Null
            Expand-Archive -Path $tmpZip -DestinationPath $pyTarget -Force
            Remove-Item -Force $tmpZip -ErrorAction SilentlyContinue
            Write-Host "Python portatil configurado com sucesso em: $pyTarget"
        } catch {
            Write-Host "Erro ao configurar Python portatil: $($_.Exception.Message)"
        }
    }
}

Write-Host "=================================================="
Write-Host "Finalizada a configuracao de pre-requisitos."
Write-Host "=================================================="
