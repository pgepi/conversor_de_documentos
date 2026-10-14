const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { ConversionEngine } = require('./converter');
const { SystemIntegration } = require('./system-integration');
const { PrerequisitesManager } = require('./prerequisites');

let mainWindow = null;
const engine = new ConversionEngine();
const prereqs = new PrerequisitesManager(path.resolve(__dirname, '..'), app.getPath('userData'));
const integration = new SystemIntegration(path.resolve(__dirname, '..'), process.execPath);

// Presets pré-definidos para Processamento Expresso
const DEFAULT_PRESETS = [
  {
    id: 'preset_md_fast',
    name: '🚀 Ultra-Rápido (Sem OCR)',
    description: 'Conversão instantânea de PDFs e documentos digitais para Markdown.',
    format: 'markdown',
    ocrEnabled: false,
    imageMode: 'placeholder',
    extractImages: false,
    engine: 'native'
  },
  {
    id: 'preset_md_default',
    name: '📄 Padrão (Markdown com OCR)',
    description: 'Padrão recomendado: Converte texto e aciona OCR Tesseract em áreas gráficas.',
    format: 'markdown',
    ocrEnabled: true,
    ocrLanguage: 'eng',
    imageMode: 'placeholder',
    extractImages: false,
    engine: 'native'
  },
  {
    id: 'preset_md_ocr_deep',
    name: '🔍 OCR Avançado (Scans e Fotos)',
    description: 'Otimizado para documentos escaneados e fotos de páginas com Tesseract.',
    format: 'markdown',
    ocrEnabled: true,
    ocrLanguage: 'eng',
    dpi: 300,
    imageMode: 'placeholder',
    extractImages: false,
    engine: 'native'
  },
  {
    id: 'preset_md_images',
    name: '🖼️ Markdown + Imagens Extraídas',
    description: 'Extrai todas as imagens embutidas para uma pasta e insere links no Markdown.',
    format: 'markdown',
    ocrEnabled: true,
    ocrLanguage: 'eng',
    imageMode: 'embed',
    extractImages: true,
    engine: 'native'
  },
  {
    id: 'preset_json_layout',
    name: '📊 Estrutura JSON (BBoxes & Layout)',
    description: 'Gera JSON completo com coordenadas espaciais para RAG e LLMs.',
    format: 'json',
    ocrEnabled: true,
    engine: 'native'
  },
  {
    id: 'preset_text_clean',
    name: '📝 Texto Simples (.txt)',
    description: 'Extrai todo o conteúdo como texto puro sem marcação.',
    format: 'text',
    ocrEnabled: false,
    engine: 'native'
  }
];

// Caminho de configuração de presets do usuário
function getPresetsConfigPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'user_presets.json');
}

function loadPresets() {
  try {
    const p = getPresetsConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {
    console.error('Erro ao ler presets:', e);
  }
  return DEFAULT_PRESETS;
}

function savePresets(presets) {
  try {
    const p = getPresetsConfigPath();
    fs.writeFileSync(p, JSON.stringify(presets, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Erro ao salvar presets:', e);
    return false;
  }
}

// Extrai arquivos e flags passados por linha de comando (Send To / Context Menu)
function parseCommandLineArgs(argv) {
  const files = [];
  let express = false;
  let format = 'markdown';
  let ocr = false;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--express') {
      express = true;
    } else if (arg === '--ocr') {
      ocr = true;
    } else if (arg === '--format' && argv[i + 1]) {
      format = argv[++i];
    } else if (!arg.startsWith('--') && !arg.endsWith('electron.exe') && !arg.endsWith('electron') && arg !== '.') {
      if (fs.existsSync(arg)) {
        files.push(path.resolve(arg));
      }
    }
  }

  return { files, express, format, ocr };
}

let initialLaunchData = { files: [], express: false, format: 'markdown', ocr: false };

// Garante instância única
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const { files, express, format, ocr } = parseCommandLineArgs(argv);
      if (files.length > 0) {
        mainWindow.webContents.send('app:external-files', { files, express, format, ocr });
      }
    }
  });

  app.whenReady().then(() => {
    initialLaunchData = parseCommandLineArgs(process.argv);
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 980,
    minHeight: 650,
    title: 'Conversor de Documentos - PGE',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true // Habilita o plugin nativo de PDF do Chromium
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (initialLaunchData.files.length > 0) {
      mainWindow.webContents.send('app:external-files', initialLaunchData);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Suporte para macOS 'open-file'
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('app:external-files', {
      files: [filePath],
      express: false,
      format: 'markdown'
    });
  } else {
    initialLaunchData.files.push(filePath);
  }
});

// ==========================================
// IPC HANDLERS
// ==========================================

// Obter estado inicial de inicialização
ipcMain.handle('app:get-initial-state', () => {
  return initialLaunchData;
});

// Diálogo: Selecionar Arquivos
ipcMain.handle('dialog:select-files', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Documentos para Converter',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documentos Compatíveis', extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'tiff', 'txt', 'html'] },
      { name: 'Documentos PDF (*.pdf)', extensions: ['pdf'] },
      { name: 'Documentos Office (*.docx, *.xlsx, *.pptx)', extensions: ['docx', 'xlsx', 'pptx'] },
      { name: 'Imagens com Texto (*.png, *.jpg, *.jpeg, *.tiff)', extensions: ['png', 'jpg', 'jpeg', 'tiff'] },
      { name: 'Todos os Arquivos (*.*)', extensions: ['*'] }
    ]
  });

  if (result.canceled) return [];
  return result.filePaths;
});

// Diálogo: Selecionar Pasta de Entrada (escanear documentos)
ipcMain.handle('dialog:select-folder', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Pasta com Documentos',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) return [];
  const folderPath = result.filePaths[0];

  const allowedExts = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg', '.tiff']);
  const filesFound = [];

  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            filesFound.push(fullPath);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao ler diretório:', e);
    }
  }

  scanDir(folderPath);
  return filesFound;
});

// Diálogo: Selecionar Pasta de Destino
ipcMain.handle('dialog:select-dest-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Pasta de Destino dos Arquivos Convertidos',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Operações de Arquivo
ipcMain.handle('fs:read-file', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Erro ao ler arquivo: ${err.message}`);
  }
});

ipcMain.handle('fs:save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:get-file-info', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      dir: path.dirname(filePath),
      ext: path.extname(filePath).toLowerCase(),
      size: stats.size,
      mtime: stats.mtime
    };
  } catch (e) {
    return null;
  }
});

ipcMain.handle('shell:reveal-file', (_event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('shell:open-path', (_event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

// Execução de Conversão
ipcMain.handle('converter:start', async (_event, fileList, options) => {
  if (!mainWindow) return;

  const callbacks = {
    onLog: (level, message) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:log', {
          level,
          message,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    },
    onProgress: (progressData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:progress', progressData);
      }
    },
    onPageProgress: (pageData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:page-progress', pageData);
      }
    },
    onFileStart: (fileData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:file-start', fileData);
      }
    },
    onFileComplete: (resultData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:file-complete', resultData);
      }
    },
    onFileError: (errorData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:file-error', errorData);
      }
    },
    onBatchComplete: (batchData) => {
      if (mainWindow) {
        mainWindow.webContents.send('converter:batch-complete', batchData);
      }
      // Notificação nativa do SO
      if (Notification.isSupported()) {
        const count = batchData.results.filter(r => r.success).length;
        new Notification({
          title: 'LiteParse Studio',
          body: `Conversão concluída! ${count} arquivo(s) processado(s) com sucesso.`
        }).show();
      }
    }
  };

  return await engine.convertBatch(fileList, options, callbacks);
});

ipcMain.handle('converter:cancel', () => {
  engine.cancel();
  return { success: true };
});

// Integração com o Sistema Operacional
ipcMain.handle('sys:get-status', () => {
  return integration.getStatus();
});

ipcMain.handle('sys:install-sendto', () => {
  return integration.installWindowsSendTo();
});

ipcMain.handle('sys:uninstall-sendto', () => {
  return integration.uninstallWindowsSendTo();
});

ipcMain.handle('sys:install-contextmenu', () => {
  return integration.installWindowsContextMenu();
});

ipcMain.handle('sys:uninstall-contextmenu', () => {
  return integration.uninstallWindowsContextMenu();
});

// Visualização Especial de Documentos Office (DOCX / DOC / XLSX)
ipcMain.handle('fs:get-doc-preview', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.docx') {
      const htmlRes = await mammoth.convertToHtml({ path: filePath });
      return {
        type: 'html',
        html: htmlRes.value,
        messages: htmlRes.messages
      };
    }

    if (ext === '.doc') {
      const loPath = prereqs.getLibreOfficePath();
      if (loPath) {
        try {
          const pdfPath = await prereqs.convertOfficeWithLibreOffice(filePath, 'pdf');
          return {
            type: 'pdf',
            path: pdfPath
          };
        } catch (convErr) {
          return {
            type: 'error',
            message: `Erro na conversão do DOC via LibreOffice: ${convErr.message}`
          };
        }
      } else {
        return {
          type: 'missing_libreoffice',
          message: 'Visualização completa de arquivos .DOC antigos requer o LibreOffice instalado no computador.'
        };
      }
    }

    return null;
  } catch (err) {
    return {
      type: 'error',
      message: err.message
    };
  }
});

// Pré-requisitos
ipcMain.handle('prereq:get-status', async () => {
  return await prereqs.checkStatus();
});

ipcMain.handle('prereq:install-libreoffice', async () => {
  return await prereqs.installLibreOfficePortable((level, message) => {
    if (mainWindow) {
      mainWindow.webContents.send('converter:log', {
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });
});

ipcMain.handle('prereq:install-liteparse-python', async () => {
  return await prereqs.installLiteParsePython((level, message) => {
    if (mainWindow) {
      mainWindow.webContents.send('converter:log', {
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });
});

// Presets
ipcMain.handle('config:get-presets', () => {
  return loadPresets();
});

ipcMain.handle('config:save-presets', (_event, presets) => {
  return savePresets(presets);
});
