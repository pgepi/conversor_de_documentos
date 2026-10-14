#!/usr/bin/env bash
# ====================================================================
# Conversor de Documentos (PGE) - Instalador para Linux (Ubuntu/Debian)
# ====================================================================
set -e

echo "=== Conversor de Documentos (PGE) - Linux Installer ==="

# 1. Instalar Pré-requisitos
echo "[1/3] Instalando dependências do sistema..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y libreoffice tesseract-ocr python3 python3-pip
elif command -v dnf &> /dev/null; then
    sudo dnf install -y libreoffice tesseract python3 python3-pip
fi

# 2. Instalar dependências Python
echo "[2/3] Instalando LiteParse no Python..."
pip3 install liteparse || true

# 3. Instalar dependências Node/Electron
echo "[3/3] Instalando módulos da aplicação..."
npm install

echo "=== Instalação concluída com sucesso! Digite 'npm start' para iniciar ==="
