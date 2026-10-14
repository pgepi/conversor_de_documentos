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

Write-Host "Motor de extracao 7-Zip: $(if ($7za) { $7za } else { 'Nao encontrado (usando extrator integrado)' })"

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
                Write-Host "Versao mais recente detectada: $topVer"
            }
        } catch {
            Write-Host "Aviso: Consulta remota falhou. Usando versao estavel 26.2.4."
        }

        $tmpInstaller = Join-Path $env:TEMP "LibreOfficePortable_$([System.IO.Path]::GetRandomFileName()).paf.exe"
        Write-Host "Baixando pacote portatil de: $latestUrl"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($latestUrl, $tmpInstaller)
            Write-Host "Download concluido! Extraindo automaticamente em: $loTarget"
            New-Item -ItemType Directory -Force -Path $loTarget | Out-Null

            if ($7za) {
                # Extracao 100% silenciosa e desassistida via 7-Zip
                Write-Host "Executando extracao silenciosa com 7-Zip..."
                $proc = Start-Process -FilePath $7za -ArgumentList "x", "`"$tmpInstaller`"", "-o`"$loTarget`"", "-y" -Wait -NoNewWindow -PassThru
                Write-Host "Extracao 7-Zip finalizada com codigo: $($proc.ExitCode)"

                # Limpa pasta temporaria interna do instalador se houver
                $pluginsDir = Join-Path $loTarget "`$PLUGINSDIR"
                if (Test-Path $pluginsDir) {
                    Remove-Item -Recurse -Force $pluginsDir -ErrorAction SilentlyContinue
                }

                # Se extraiu em App/libreoffice, espelha para bin/libreoffice para compatibilidade universal
                $nestedProgram = Join-Path $loTarget "App\libreoffice\program\soffice.exe"
                $rootProgram = Join-Path $loTarget "program\soffice.exe"
                if ((Test-Path $nestedProgram) -and (-not (Test-Path $rootProgram))) {
                    Write-Host "Organizando estrutura de pastas portateis..."
                    Copy-Item -Path (Join-Path $loTarget "App\libreoffice\*") -Destination $loTarget -Recurse -Force -ErrorAction SilentlyContinue
                }
            } else {
                # Fallback: executa instalador
                Write-Host "Executando assistente integrado de extracao..."
                $proc = Start-Process -FilePath $tmpInstaller -ArgumentList "/DEST=$loTarget", "/destination=$loTarget", "/S" -Wait -PassThru
            }

            Remove-Item -Force $tmpInstaller -ErrorAction SilentlyContinue
            Write-Host "LibreOffice portatil configurado com sucesso!"
        } catch {
            Write-Host "Erro durante instalacao do LibreOffice: $($_.Exception.Message)"
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
