# LiteParse Studio ⚡

Uma aplicação desktop nativa, moderna e multiplataforma (Windows, macOS e Linux) inspirada na interface do **Visual Studio Code**, desenvolvida para converter documentos e PDFs com alta velocidade e precisão utilizando o **LiteParse** (`run-llama/liteparse`).

---

## 🌟 Principais Recursos

- **100% Desktop e Offline:** Não requer chaves de API ou serviços em nuvem. Seus documentos nunca saem do seu computador.
- **Interface Estilo VSCode:**
  - **Activity Bar** lateral para alternar entre Fila de Arquivos, Presets Expressos, Configurações e Integração do Sistema.
  - **Side Bar** com Fila de Conversão, zona de Drag & Drop, seleção de pasta de destino e status individual por arquivo.
  - **Editor Split (Visualizadores Internos Lado a Lado):**
    - **Esquerda (Origem):** Visualizador de documentos com suporte nativo a PDF (zoom, paginação e rotação), visualizador de imagens e visualizador de código/texto.
    - **Direita (Destino):** Visualizador renderizado de Markdown com suporte a tabelas, blocos de código com sintaxe colorida, editor de Markdown puro e inspector JSON.
  - **Painel Inferior (Terminal / Logs):** Console de saída em tempo real com níveis de log coloridos (`[INFO]`, `[OCR]`, `[LITEPARSE]`, `[OK]`), busca/filtro de logs, limpeza e cópia rápida.
  - **Barra de Status (Footer):** Acompanhamento em tempo real da conversão por arquivo, progresso global e rastreamento de páginas (`📄 Pág. 3 / 10 (30%)`).
- **Motor Duplo de Conversão:**
  - **LiteParse Nativo (Node/Rust):** Processamento ultrarrápido com aceleração local.
  - **LiteParse Python:** Alternativa integrada compatível com scripts e bibliotecas do ecossistema Python.
- **Processamento Expresso com Presets:**
  - 🚀 **Ultra-Rápido (Sem OCR):** Conversão instantânea de PDFs digitais diretamente para Markdown.
  - 📄 **Padrão (Markdown com OCR):** Extração completa com OCR Tesseract para gráficos e digitalizações.
  - 🔍 **OCR Avançado (Scans e Fotos):** Otimizado para documentos escaneados com alta densidade (300 DPI).
  - 🖼️ **Markdown + Imagens Extraídas:** Extrai todas as imagens embutidas para uma pasta anexa e gera links no Markdown.
  - 📊 **Estrutura JSON:** Saída com coordenadas espaciais e bounding boxes (BBoxes) para pipelines RAG e agentes de IA.
  - 📝 **Texto Simples (.txt):** Texto desformatado e limpo.
- **Integração com o Sistema Operacional:**
  - **"Send to" (Enviar para) do Windows:** Permite clicar com o botão direito em qualquer documento no Windows Explorer e enviá-lo diretamente para conversão no LiteParse.
  - **Menu de Contexto ("Converter para..."):** Adiciona opções em cascata no menu do botão direito:
    - *Converter para Markdown (.md) [Expresso]*
    - *Converter para Markdown com OCR (.md)*
    - *Converter para Texto (.txt)*
    - *Converter para JSON (.json)*
    - *Abrir no LiteParse Studio...*
  - **Instalador/Desinstalador com 1 Clique:** Sem necessidade de privilégios de Administrador (registrado em `HKCU`).
  - **Equivalentes para Linux & macOS:** Suporte a Nautilus scripts, arquivos `.desktop` e Quick Actions.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** >= 18
- **Python** >= 3.10 (opcional, caso queira utilizar o motor Python alternativo)

### Instalação das dependências
```bash
npm install
```

### Iniciar o aplicativo
```bash
npm start
```

---

## 📂 Estrutura do Projeto

```
mysterious-davinci/
├── package.json               # Configurações e dependências (Electron, @llamaindex/liteparse, marked)
├── electron/
│   ├── main.js                # Processo principal, ciclo de vida, IPC e CLI
│   ├── preload.js             # Bridge segura de comunicação (window.electronAPI)
│   ├── converter.js           # Engine de conversão com paginação e streaming de logs
│   ├── python_worker.py       # Worker Python alternativo para o LiteParse
│   └── system-integration.js  # Gerenciador do Menu de Contexto e "Send To"
├── src/
│   ├── index.html             # Interface inspirada no VS Code
│   ├── css/
│   │   ├── vscode-theme.css   # Variáveis e tema Dark+ do VS Code
│   │   ├── layout.css         # Estrutura flexível (Activity Bar, Sidebar, Editor Split, Panel, Status Bar)
│   │   ├── viewer.css         # Visualizador de PDF/imagem e Markdown com estilo GitHub Dark
│   │   └── components.css     # Botões, cards de fila, badges, presets e toasts
│   └── js/
│       └── app.js             # Lógica de controle, estado da fila e renderizadores
└── sample_documents/          # Documentos de teste para validação imediata
```

---

## ⌨️ Atalhos Úteis

- **`Ctrl + Enter`**: Iniciar conversão da fila atual.
- **`Ctrl + \`` ou `Ctrl + J`**: Mostrar / ocultar o painel inferior de logs.
- **`Copiar Markdown`**: Botão direto na barra de abas da visualização de saída.
- **`Revelar no Explorador`**: Abre a pasta de saída contendo o documento convertido.

---

## 📄 Licença
Distribuído sob a licença Apache-2.0.
# conversor_de_documentos
