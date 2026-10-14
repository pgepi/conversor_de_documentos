# Conversor de Documentos (PGE) ⚡

Uma aplicação desktop nativa, moderna e multiplataforma (Windows, macOS e Linux) inspirada na interface do **Visual Studio Code**, desenvolvida sob a identidade visual da **Procuradoria Geral do Estado (PGE)** para converter documentos com alta velocidade e precisão utilizando o motor **LiteParse** (`run-llama/liteparse`).

---

## 🏛️ Identidade Visual e Logomarca PGE

- **Logomarca Oficial:** A aplicação incorpora o brasão e a identidade oficial da PGE (`LOGO OFICIAL PGE ATEMPORAL.svg`) diretamente na barra de título e no ícone do aplicativo (`.ico` / `.png`).
- **Nome Oficial:** **Conversor de Documentos** (com selo institucional PGE).

---

## 🌟 Principais Recursos e Atualizações

1. **Pré-visualização Inteligente de Documentos:**
   - **PDF:** Visualizador integrado de alta performance com controles de zoom, rotação e navegação de páginas.
   - **Word (DOCX):** Renderização nativa instantânea via motor HTML embutido (**Mammoth**), permitindo visualizar tabelas, parágrafos e cabeçalhos imediatamente, mesmo sem o LibreOffice instalado.
   - **Word Legado (DOC):** Suporte a arquivos `.doc` legados com conversão assistida pelo LibreOffice.
   - **Imagens:** Suporte a PNG, JPG, JPEG, TIFF e WebP com zoom interativo.
   - **Texto e Código:** Visualizador com numeração de linhas e syntax highlighting.

2. **Diagnóstico e Instalação de Pré-requisitos (1-Clique):**
   - **Aba "Pré-requisitos" na Activity Bar:** Monitora o status em tempo real de:
     - 📄 **LibreOffice:** Detecta se o executável `soffice` está presente no sistema. Se não estiver, oferece o botão **"Instalar LibreOffice (1-Clique)"** que aciona o download e instalação silenciosa via `winget` (Windows) ou gerenciador de pacotes nativo (Linux/Mac).
     - 🐍 **Python 3 & LiteParse:** Detecta o interpretador Python e a presença do pacote `liteparse`, permitindo instalação via `pip` com 1 clique.
     - ⚡ **LiteParse Nativo (Node/Rust):** Embutido no aplicativo com garantia de funcionamento 100% offline.

3. **Interface Estilo VSCode:**
   - **Activity Bar:** Explorador/Fila, Presets Expressos, Pré-requisitos, Integrações do SO e Configurações Avançadas.
   - **Editor Split:** Documento original à esquerda e resultado convertido (Markdown renderizado com tabelas/código, Markdown puro e JSON com bounding boxes) à direita.
   - **Console de Logs:** Acompanhamento dos timings do LiteParse (`[extract]`, `[ocr]`, `[markdown]`).
   - **Barra de Status:** Acompanhamento de página por página em tempo real (`📄 Pág. 3 / 10`).

4. **Integração com o Sistema Operacional:**
   - **Menu "Enviar para" (Send To):** Envie qualquer arquivo do Windows Explorer diretamente para o app.
   - **Menu de Contexto ("Converter para..."):** Submenu no clique direito do mouse com opções expressas para Markdown, Markdown com OCR, Texto puro e JSON.

---

## 📦 Instaladores do Sistema

### 1. Instaladores Gerados Localmente (Windows)
Os instaladores para Windows já foram compilados e estão disponíveis na pasta `dist/`:
- **Instalador NSIS:** `dist/Conversor-de-Documentos-Setup-1.0.0.exe` (131.8 MB) — Instalação completa com atalhos na Área de Trabalho, Menu Iniciar e desinstalador limpo.
- **Versão Portátil:** `dist/Conversor de Documentos 1.0.0.exe` (131.5 MB) — Executável independente sem necessidade de instalação.

Para compilar novamente no Windows:
```bash
npm run build:win
```

### 2. CI/CD no GitHub Actions (Todas as Plataformas)
Para compilar os instaladores para todas as plataformas (**Windows, Linux e macOS**) sem restrições de ambiente local, o projeto conta com o pipeline automatizado:
- Arquivo: [`.github/workflows/build-installers.yml`](file:///.github/workflows/build-installers.yml)
- **Windows:** Gera `Conversor-de-Documentos-Setup-1.0.0.exe` e versão `.portable`.
- **Linux:** Gera pacotes `Conversor-de-Documentos-1.0.0.AppImage` e `Conversor-de-Documentos-1.0.0.deb`.
- **macOS:** Gera pacotes `Conversor-de-Documentos-1.0.0.dmg` e `.zip`.

Basta subir o repositório para o GitHub ou acionar manualmente na aba **Actions** (`workflow_dispatch`). Os executáveis finais são disponibilizados automaticamente para download nos Artifacts do build.

### 3. Scripts de Instalação Rápida de Pré-requisitos
- **Windows:** Execute [`setup-windows.bat`](file:///c:/Users/xs/Documents/antigravity/mysterious-davinci/setup-windows.bat) ou [`install-windows.ps1`](file:///c:/Users/xs/Documents/antigravity/mysterious-davinci/install-windows.ps1).
- **Linux:** Execute `chmod +x install-linux.sh && ./install-linux.sh`.
- **macOS:** Execute `chmod +x install-macos.sh && ./install-macos.sh`.

---

## 🚀 Como Executar em Desenvolvimento

```bash
# Iniciar a aplicação
npm start
```
