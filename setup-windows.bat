@echo off
title Instalador - Conversor de Documentos (PGE)
cd /d "%~dp0"
echo ========================================================
echo   Iniciando Instalacao do Conversor de Documentos (PGE)
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"
pause
