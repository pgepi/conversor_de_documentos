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

# Localiza 7za.exe para extracao 100% silenciosa e automatizada
$7za = $null
$candidates7z = @(
    (Join-Path $PSScriptRoot "7za.exe"),
    (Join-Path $TargetDir "resources\7za.exe"),
    (Join-Path (Split-Path -Parent $TargetDir) "resources\7za.exe"),
    "C:\Program Files\7-Zip\7z.exe"
)

foreach ($c in $candidates7z) {
    if (Test-Path $c) {
        $7za = $c
        break
    }
}

if (-not $7za) {
    $cmd = Get-Command "7z.exe" -ErrorAction SilentlyContinue
    if ($cmd) { $7za = $cmd.Source }
}

Write-Host "Motor de extracao 7-Zip: $(if ($7za) { $7za } else { 'Nao encontrado' })"

# 1. LIBREOFFICE MINIMAL (PT-BR + EN-US)
if ($InstallLibreOffice) {
    $loTarget = Join-Path $TargetDir "bin\libreoffice"
    $sofficeExe = Join-Path $loTarget "program\soffice.exe"
    $sofficeAppExe = Join-Path $loTarget "App\libreoffice\program\soffice.exe"

    if ((Test-Path $sofficeExe) -or (Test-Path $sofficeAppExe)) {
        Write-Host "LibreOffice já instalado em $loTarget. Pulando download."
    } else {
        # Prioridade 1: Pacote minimal pré-otimizado (107 MB em vez de 214 MB)
        $minimalUrl = "https://github.com/pgepi/conversor_de_documentos/releases/download/v1.1.1/libreoffice-minimal-ptbr-en.7z"
        $fallbackUrl = "http://tdf.c3sl.ufpr.br/libreoffice/portable/26.2.4/LibreOfficePortable_26.2.4_MultilingualStandard.paf.exe"

        $downloadUrl = $minimalUrl
        $is7z = $true
        $tmpFile = Join-Path $env:TEMP "LibreOfficeMinimal_$([System.IO.Path]::GetRandomFileName()).7z"

        Write-Host "Baixando pacote LibreOffice Minimal (~107 MB, PT-BR + EN)..."
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($downloadUrl, $tmpFile)
            Write-Host "Download do pacote minimal concluido com sucesso!"
        } catch {
            Write-Host "Aviso: Download do pacote minimal falhou ($($_.Exception.Message)). Usando espelho oficial PAF..."
            $downloadUrl = $fallbackUrl
            $is7z = $false
            $tmpFile = Join-Path $env:TEMP "LibreOfficePAF_$([System.IO.Path]::GetRandomFileName()).paf.exe"
            try {
                $wc = New-Object System.Net.WebClient
                $wc.DownloadFile($downloadUrl, $tmpFile)
            } catch {
                Write-Host "Erro crítico: Falha no download de ambos os espelhos: $($_.Exception.Message)"
            }
        }

        if (Test-Path $tmpFile) {
            Write-Host "Extraindo arquivos para: $loTarget"
            New-Item -ItemType Directory -Force -Path $loTarget | Out-Null

            if ($7za) {
                if ($is7z) {
                    $proc = Start-Process -FilePath $7za -ArgumentList "x", "`"$tmpFile`"", "-o`"$loTarget`"", "-y" -Wait -NoNewWindow -PassThru
                } else {
                    # PAF requer -tNsis para extração desassistida
                    $proc = Start-Process -FilePath $7za -ArgumentList "x", "-tNsis", "`"$tmpFile`"", "-o`"$loTarget`"", "-y" -Wait -NoNewWindow -PassThru
                }
                Write-Host "Extracao 7-Zip finalizada com codigo: $($proc.ExitCode)"

                # Limpa pasta temporaria interna se presente
                $pluginsDir = Join-Path $loTarget "`$PLUGINSDIR"
                if (Test-Path $pluginsDir) {
                    Remove-Item -Recurse -Force $pluginsDir -ErrorAction SilentlyContinue
                }

                # Se extraiu em App/libreoffice, sincroniza para a raiz do bin
                $nestedProgram = Join-Path $loTarget "App\libreoffice\program\soffice.exe"
                $rootProgram = Join-Path $loTarget "program\soffice.exe"
                if ((Test-Path $nestedProgram) -and (-not (Test-Path $rootProgram))) {
                    Write-Host "Configurando estrutura de pastas..."
                    Copy-Item -Path (Join-Path $loTarget "App\libreoffice\*") -Destination $loTarget -Recurse -Force -ErrorAction SilentlyContinue
                }
            } else {
                Write-Host "Aviso: 7-Zip nao localizado. Executando assistente integrado..."
                $proc = Start-Process -FilePath $tmpFile -ArgumentList "/DEST=$loTarget", "/S" -Wait -PassThru
            }

            Remove-Item -Force $tmpFile -ErrorAction SilentlyContinue
            Write-Host "LibreOffice Minimal configurado com sucesso!"
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

            if ($7za) {
                $proc = Start-Process -FilePath $7za -ArgumentList "x", "`"$tmpZip`"", "-o`"$pyTarget`"", "-y" -Wait -NoNewWindow -PassThru
            } else {
                Expand-Archive -Path $tmpZip -DestinationPath $pyTarget -Force
            }

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
