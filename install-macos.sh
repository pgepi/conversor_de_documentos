#!/usr/bin/env bash
# ====================================================================
# Conversor de Documentos (PGE) - Instalador para macOS
# ====================================================================
set -e

echo "=== Conversor de Documentos (PGE) - macOS Installer ==="

# 1. Instalar Pré-requisitos com Homebrew
if command -v brew &> /dev/null; then
    echo "[1/3] Instalando LibreOffice e Tesseract via Homebrew..."
    brew install --cask libreoffice || true
    brew install tesseract python || true
fi

# 2. Instalar dependências Python
echo "[2/3] Instalando LiteParse no Python..."
pip3 install liteparse || true

# 3. Instalar dependências Node/Electron
echo "[3/3] Instalando módulos da aplicação..."
npm install

echo "=== Instalação concluída com sucesso! Digite 'npm start' para iniciar ==="
