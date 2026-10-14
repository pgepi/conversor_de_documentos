/**
 * LiteParse Studio - Main UI Application Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Estado da Aplicação
  const state = {
    queue: [],
    activeFileId: null,
    isConverting: false,
    activeSideTab: 'explorer',
    activeOutputTab: 'preview',
    destinationType: 'source',
    customDestPath: '',
    presets: [],
    activePresetId: 'preset_md_default',
    settings: {
      engine: 'native',
      format: 'markdown',
      ocrEnabled: true,
      ocrLanguage: 'eng',
      extractImages: false,
      imageMode: 'placeholder',
      dpi: 150
    }
  };

  // Elementos do DOM
  const dom = {
    // Activity Bar
    actExplorer: document.getElementById('act-btn-explorer'),
    actPresets: document.getElementById('act-btn-presets'),
    actSettings: document.getElementById('act-btn-settings'),
    actLogs: document.getElementById('act-btn-logs'),

    // Sidebar Views
    sideExplorer: document.getElementById('side-view-explorer'),
    sidePresets: document.getElementById('side-view-presets'),
    sideSettings: document.getElementById('side-view-settings'),

    // File Queue & Buttons
    btnAddFiles: document.getElementById('btn-add-files'),
    btnAddFolder: document.getElementById('btn-add-folder'),
    btnClearQueue: document.getElementById('btn-clear-queue'),
    btnSelectFilesAlt: document.getElementById('btn-select-files-alt'),
    btnSelectFolderAlt: document.getElementById('btn-select-folder-alt'),
    dropzone: document.getElementById('dropzone'),
    queueContainer: document.getElementById('queue-items-container'),
    emptyQueueMsg: document.getElementById('empty-queue-message'),

    // Destination Config
    destSource: document.getElementById('dest-type-source'),
    destCustom: document.getElementById('dest-type-custom'),
    customDestBox: document.getElementById('custom-dest-box'),
    customDestInput: document.getElementById('custom-dest-input'),
    btnBrowseDest: document.getElementById('btn-browse-dest'),

    // Conversion Control
    btnTopConvert: document.getElementById('btn-top-convert'),
    btnTopCancel: document.getElementById('btn-top-cancel'),
    quickPresetTitle: document.getElementById('quick-preset-title'),

    // Editor Panes
    tabSource: document.getElementById('tab-source'),
    tabSourceTitle: document.getElementById('tab-source-title'),
    sourceMetaBadge: document.getElementById('source-meta-badge'),
    sourceContainer: document.getElementById('source-content-container'),

    tabPreview: document.getElementById('tab-preview'),
    tabRaw: document.getElementById('tab-raw'),
    targetContainer: document.getElementById('target-content-container'),
    btnCopyMarkdown: document.getElementById('btn-copy-markdown'),
    btnSaveMarkdown: document.getElementById('btn-save-markdown'),
    btnRevealOutput: document.getElementById('btn-reveal-output'),

    // Bottom Panel
    bottomPanel: document.getElementById('bottom-panel'),
    logContainer: document.getElementById('log-stream-container'),
    logFilter: document.getElementById('log-filter-input'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    btnCopyLogs: document.getElementById('btn-copy-logs'),
    btnTogglePanel: document.getElementById('btn-toggle-panel'),

    // Status Bar
    statusText: document.getElementById('status-text'),
    statusPageTracker: document.getElementById('status-page-tracker'),
    statusPageText: document.getElementById('status-page-text'),
    statusQueueCount: document.getElementById('status-queue-count'),
    statusBarFill: document.getElementById('status-progress-bar'),
    statusPercent: document.getElementById('status-progress-percent'),
    statusPresetTag: document.getElementById('status-preset-tag'),
    statusEngineTag: document.getElementById('status-engine-tag'),

    // Diagnostic status elements
    settingsDiagPython: document.getElementById('settings-diag-python'),
    settingsDiagLibreOffice: document.getElementById('settings-diag-libreoffice'),

    // Presets Container
    presetsCardsContainer: document.getElementById('presets-cards-container'),

    // Settings Inputs
    settingEngine: document.getElementById('setting-engine'),
    settingFormat: document.getElementById('setting-format'),
    settingOcr: document.getElementById('setting-ocr'),
    settingOcrLang: document.getElementById('setting-ocr-lang'),
    settingExtractImages: document.getElementById('setting-extract-images'),
    settingImageMode: document.getElementById('setting-image-mode'),
    settingDpi: document.getElementById('setting-dpi'),

    toastContainer: document.getElementById('toast-container')
  };

  // Inicialização de Presets
  try {
    state.presets = await window.electronAPI.getPresets();
    renderPresetsList();
  } catch (e) {
    console.error('Erro ao carregar presets:', e);
  }

  // Inicialização de diagnóstico dos componentes
  updateComponentDiagnostics();

  // Tratamento de arquivos recebidos via linha de comando / Send To / Context Menu
  try {
    const initialState = await window.electronAPI.getInitialState();
    if (initialState && initialState.files && initialState.files.length > 0) {
      handleExternalFiles(initialState);
    }
  } catch (e) {
    console.error('Erro ao verificar inicialização externa:', e);
  }

  window.electronAPI.onExternalFilesReceived((data) => {
    handleExternalFiles(data);
  });

  function handleExternalFiles(data) {
    const { files, express, format, ocr } = data;
    if (files && files.length > 0) {
      addFilesToQueue(files);
      showToast(`Adicionado(s) ${files.length} arquivo(s) via integração do sistema`, 'info');

      if (format) {
        state.settings.format = format;
        dom.settingFormat.value = format;
      }
      if (typeof ocr === 'boolean') {
        state.settings.ocrEnabled = ocr;
        dom.settingOcr.checked = ocr;
      }

      // Se for express, inicia imediatamente
      if (express) {
        startConversionQueue();
      }
    }
  }

  // ==========================================
  // NAVEGAÇÃO NA ACTIVITY BAR
  // ==========================================
  const navTabs = [
    { btn: dom.actExplorer, view: dom.sideExplorer, name: 'explorer' },
    { btn: dom.actPresets, view: dom.sidePresets, name: 'presets' },
    { btn: dom.actSettings, view: dom.sideSettings, name: 'settings' }
  ];

  function switchSideTab(targetName) {
    const target = navTabs.find(t => t.name === targetName);
    if (!target) return;
    navTabs.forEach(t => {
      t.btn.classList.remove('active');
      t.view.style.display = 'none';
    });
    target.btn.classList.add('active');
    target.view.style.display = 'flex';
    state.activeSideTab = targetName;
  }
  window.switchSideTab = switchSideTab;

  navTabs.forEach(({ btn, view, name }) => {
    btn.addEventListener('click', () => {
      switchSideTab(name);
    });
  });

  dom.actLogs.addEventListener('click', () => {
    dom.bottomPanel.classList.toggle('collapsed');
  });

  dom.btnTogglePanel.addEventListener('click', () => {
    dom.bottomPanel.classList.add('collapsed');
  });

  // ==========================================
  // FILA DE ARQUIVOS E SELEÇÃO
  // ==========================================
  dom.btnAddFiles.addEventListener('click', pickFiles);
  dom.btnSelectFilesAlt.addEventListener('click', pickFiles);

  dom.btnAddFolder.addEventListener('click', pickFolder);
  dom.btnSelectFolderAlt.addEventListener('click', pickFolder);

  dom.btnClearQueue.addEventListener('click', () => {
    if (state.isConverting) {
      showToast('Aguarde ou cancele a conversão em andamento antes de limpar.', 'warn');
      return;
    }
    state.queue = [];
    state.activeFileId = null;
    renderQueue();
    updateViewers();
    updateStatusQueueCount();
    showToast('Fila limpa.', 'info');
  });

  async function pickFiles() {
    try {
      const filePaths = await window.electronAPI.selectFiles();
      if (filePaths && filePaths.length > 0) {
        addFilesToQueue(filePaths);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function pickFolder() {
    try {
      const filePaths = await window.electronAPI.selectFolder();
      if (filePaths && filePaths.length > 0) {
        addFilesToQueue(filePaths);
        showToast(`Encontrado(s) ${filePaths.length} documento(s) na pasta.`, 'info');
      } else {
        showToast('Nenhum documento suportado encontrado na pasta selecionada.', 'info');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dom.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dom.dropzone.classList.add('drag-over');
    });
    document.body.addEventListener(eventName, (e) => e.preventDefault());
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dom.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dom.dropzone.classList.remove('drag-over');
    });
    document.body.addEventListener(eventName, (e) => e.preventDefault());
  });

  dom.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) {
      const paths = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
      if (paths.length > 0) {
        addFilesToQueue(paths);
      }
    }
  });

  async function addFilesToQueue(filePaths) {
    let addedCount = 0;
    for (const p of filePaths) {
      // Evita duplicatas exatas na fila
      if (state.queue.some(item => item.path === p)) continue;

      const fileInfo = await window.electronAPI.getFileInfo(p);
      const ext = (fileInfo ? fileInfo.ext : p.split('.').pop()).replace('.', '').toLowerCase();

      const item = {
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        path: p,
        name: fileInfo ? fileInfo.name : p.split(/[\\/]/).pop(),
        ext: ext,
        size: fileInfo ? formatFileSize(fileInfo.size) : 'Desconhecido',
        status: 'pending', // 'pending' | 'converting' | 'success' | 'error'
        page: 0,
        totalPages: 0,
        outputPath: '',
        outputContent: '',
        error: ''
      };

      state.queue.push(item);
      addedCount++;
    }

    if (addedCount > 0) {
      if (!state.activeFileId && state.queue.length > 0) {
        state.activeFileId = state.queue[0].id;
      }
      renderQueue();
      updateViewers();
      updateStatusQueueCount();
    }
  }

  function renderQueue() {
    dom.queueContainer.innerHTML = '';

    if (state.queue.length === 0) {
      dom.emptyQueueMsg.style.display = 'block';
      dom.queueContainer.appendChild(dom.emptyQueueMsg);
      return;
    }

    dom.emptyQueueMsg.style.display = 'none';

    state.queue.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `queue-item ${item.id === state.activeFileId ? 'active' : ''}`;
      el.onclick = () => {
        state.activeFileId = item.id;
        renderQueue();
        updateViewers();
      };

      let badgeHtml = '<span class="queue-badge pending">Pendente</span>';
      if (item.status === 'converting') {
        const pageText = item.totalPages > 0 ? `Pág. ${item.page}/${item.totalPages}` : 'Processando...';
        badgeHtml = `<span class="queue-badge converting">${pageText}</span>`;
      } else if (item.status === 'success') {
        badgeHtml = `<span class="queue-badge success">✓ Concluído (${item.totalPages}p)</span>`;
      } else if (item.status === 'error') {
        badgeHtml = '<span class="queue-badge error">✗ Erro</span>';
      }

      el.innerHTML = `
        <div class="queue-item-left">
          <div class="file-ext-icon ${getFileIconClass(item.ext)}">${item.ext.substring(0, 4)}</div>
          <div class="queue-item-info">
            <div class="queue-item-name" title="${item.path}">${item.name}</div>
            <div class="queue-item-meta">
              <span>${item.size}</span>
              ${badgeHtml}
            </div>
          </div>
        </div>
        <button class="icon-btn remove-btn" title="Remover da fila" onclick="event.stopPropagation(); window.removeQueueItem('${item.id}');">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      dom.queueContainer.appendChild(el);
    });
  }

  window.removeQueueItem = (id) => {
    state.queue = state.queue.filter(i => i.id !== id);
    if (state.activeFileId === id) {
      state.activeFileId = state.queue.length > 0 ? state.queue[0].id : null;
    }
    renderQueue();
    updateViewers();
    updateStatusQueueCount();
  };

  function updateStatusQueueCount() {
    dom.statusQueueCount.textContent = `${state.queue.length} arquivo(s) na fila`;
  }

  function getFileIconClass(ext) {
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'docx';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xlsx';
    if (['png', 'jpg', 'jpeg', 'tiff', 'webp'].includes(ext)) return 'img';
    return 'other';
  }

  // ==========================================
  // CONFIGURAÇÃO DA PASTA DE DESTINO
  // ==========================================
  dom.destSource.addEventListener('change', () => {
    state.destinationType = 'source';
    dom.customDestBox.style.display = 'none';
  });

  dom.destCustom.addEventListener('change', () => {
    state.destinationType = 'custom';
    dom.customDestBox.style.display = 'flex';
  });

  dom.btnBrowseDest.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectDestDir();
    if (folder) {
      state.customDestPath = folder;
      dom.customDestInput.value = folder;
    }
  });

  // ==========================================
  // VISUALIZADORES (ORIGEM & DESTINO)
  // ==========================================
  function updateViewers() {
    const activeItem = state.queue.find(i => i.id === state.activeFileId);

    if (!activeItem) {
      dom.tabSourceTitle.textContent = 'Documento de Origem';
      dom.sourceMetaBadge.style.display = 'none';
      dom.sourceContainer.innerHTML = `
        <div class="source-empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <div class="empty-state-title">Nenhum Documento Selecionado</div>
          <div class="empty-state-desc">Selecione um arquivo da fila à esquerda para visualizar seu conteúdo original.</div>
        </div>
      `;

      dom.targetContainer.innerHTML = `
        <div class="target-empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <div class="empty-state-title">Aguardando Conversão</div>
          <div class="empty-state-desc">O resultado convertido aparecerá aqui.</div>
        </div>
      `;
      return;
    }

    // Atualiza Visualizador de Origem
    dom.tabSourceTitle.textContent = activeItem.name;
    dom.sourceMetaBadge.style.display = 'inline-block';
    dom.sourceMetaBadge.textContent = activeItem.ext.toUpperCase();

    renderSourceViewer(activeItem);
    renderTargetViewer(activeItem);
  }

  function renderSourceViewer(item) {
    const ext = item.ext.toLowerCase();

    if (ext === 'pdf') {
      // PDF Embed nativo de alta performance no Chromium
      const fileUrl = `file:///${item.path.replace(/\\/g, '/')}`;
      dom.sourceContainer.innerHTML = `
        <div class="pdf-container">
          <embed class="pdf-embed" src="${fileUrl}#toolbar=1&navpanes=0" type="application/pdf">
        </div>
      `;
    } else if (['png', 'jpg', 'jpeg', 'tiff', 'webp'].includes(ext)) {
      const fileUrl = `file:///${item.path.replace(/\\/g, '/')}`;
      dom.sourceContainer.innerHTML = `
        <div class="image-viewer-container">
          <img class="image-preview" src="${fileUrl}" alt="${item.name}">
        </div>
      `;
    } else if (ext === 'docx' || ext === 'doc') {
      dom.sourceContainer.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--vscode-text-secondary);">
          <div style="display: inline-block; width: 22px; height: 22px; border: 2px solid #007acc; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div style="margin-top: 10px; font-size: 12px;">Gerando visualização de ${item.name}...</div>
        </div>
      `;

      window.electronAPI.getDocPreview(item.path).then(preview => {
        if (!preview) {
          dom.sourceContainer.innerHTML = `
            <div class="source-empty-state">
              <div class="empty-state-title">Visualização Binária</div>
              <div class="empty-state-desc">Documento pronto para conversão direta pelo LiteParse.</div>
            </div>
          `;
          return;
        }

        if (preview.type === 'html') {
          dom.sourceContainer.innerHTML = `
            <div class="markdown-preview-container" style="background-color: #1e1e1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-size: 11px; color: #858585; margin-bottom: 14px; border-bottom: 1px solid #333; padding-bottom: 6px; display: flex; justify-content: space-between;">
                <span>Visualização Formatada de Documento Word (${ext.toUpperCase()})</span>
                <span class="viewer-badge" style="background-color: #185abd; color: white;">DOCX</span>
              </div>
              <div class="docx-html-body" style="line-height: 1.6; color: #d4d4d4;">
                ${preview.html}
              </div>
            </div>
          `;
        } else if (preview.type === 'pdf') {
          const fileUrl = `file:///${preview.path.replace(/\\/g, '/')}`;
          dom.sourceContainer.innerHTML = `
            <div class="pdf-container">
              <embed class="pdf-embed" src="${fileUrl}#toolbar=1&navpanes=0" type="application/pdf">
            </div>
          `;
        } else if (preview.type === 'missing_libreoffice') {
          dom.sourceContainer.innerHTML = `
            <div class="source-empty-state">
              <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="#cca700" stroke-width="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div class="empty-state-title" style="color: #cca700;">LibreOffice Necessário para Visualização .DOC</div>
              <div class="empty-state-desc" style="max-width: 400px; line-height: 1.5;">
                Arquivos no formato legado do Word (.DOC) necessitam do LibreOffice para geração de preview visual fiel e conversão completa.
              </div>
              <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="vscode-btn small success" onclick="window.switchSideTab('prereqs');">
                  Instalar LibreOffice com 1-Clique
                </button>
              </div>
            </div>
          `;
        } else {
          dom.sourceContainer.innerHTML = `
            <div class="source-empty-state">
              <div class="empty-state-title">Aviso de Visualização</div>
              <div class="empty-state-desc">${escapeHtml(preview.message || 'Falha ao processar documento')}</div>
            </div>
          `;
        }
      }).catch(err => {
        dom.sourceContainer.innerHTML = `
          <div class="source-empty-state">
            <div class="empty-state-title">Erro ao Abrir Documento</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
          </div>
        `;
      });
    } else {
      // Arquivos de texto ou outros
      window.electronAPI.readFile(item.path).then(content => {
        if (content) {
          const lines = content.split('\n');
          const lineNumbersHtml = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
          dom.sourceContainer.innerHTML = `
            <div class="code-viewer-container">
              <div class="line-numbers">${lineNumbersHtml}</div>
              <pre class="code-content"><code>${escapeHtml(content)}</code></pre>
            </div>
          `;
        } else {
          dom.sourceContainer.innerHTML = `
            <div class="source-empty-state">
              <div class="empty-state-title">Visualização Binária</div>
              <div class="empty-state-desc">Este formato de documento (${ext.toUpperCase()}) será analisado e convertido diretamente para Markdown pelo LiteParse.</div>
            </div>
          `;
        }
      }).catch(() => {
        dom.sourceContainer.innerHTML = `
          <div class="source-empty-state">
            <div class="empty-state-title">Visualização não disponível</div>
            <div class="empty-state-desc">Arquivo pronto para conversão.</div>
          </div>
        `;
      });
    }
  }

  function renderTargetViewer(item) {
    if (!item.outputContent && item.status !== 'success') {
      dom.targetContainer.innerHTML = `
        <div class="target-empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <div class="empty-state-title">Aguardando Conversão</div>
          <div class="empty-state-desc">Clique em <strong>Converter Fila</strong> no topo para processar este documento com o LiteParse.</div>
          <button class="vscode-btn small success" onclick="window.convertCurrentFile('${item.id}')">
            Converter Este Documento
          </button>
        </div>
      `;
      return;
    }

    if (state.activeOutputTab === 'preview') {
      let renderedHtml = '';
      if (item.outputContent) {
        if (typeof window.marked !== 'undefined') {
          renderedHtml = window.marked.parse(item.outputContent);
        } else {
          renderedHtml = `<pre>${escapeHtml(item.outputContent)}</pre>`;
        }
      }
      dom.targetContainer.innerHTML = `
        <div class="markdown-preview-container">
          ${renderedHtml}
        </div>
      `;
    } else {
      // Raw Editor
      dom.targetContainer.innerHTML = `
        <textarea id="raw-markdown-textarea" class="raw-markdown-editor" spellcheck="false">${escapeHtml(item.outputContent || '')}</textarea>
      `;
      const textarea = document.getElementById('raw-markdown-textarea');
      textarea.addEventListener('input', () => {
        item.outputContent = textarea.value;
      });
    }
  }

  // Alternar abas do visualizador de saída (Preview vs Raw)
  dom.tabPreview.addEventListener('click', () => {
    dom.tabPreview.classList.add('active');
    dom.tabRaw.classList.remove('active');
    state.activeOutputTab = 'preview';
    const activeItem = state.queue.find(i => i.id === state.activeFileId);
    if (activeItem) renderTargetViewer(activeItem);
  });

  dom.tabRaw.addEventListener('click', () => {
    dom.tabRaw.classList.add('active');
    dom.tabPreview.classList.remove('active');
    state.activeOutputTab = 'raw';
    const activeItem = state.queue.find(i => i.id === state.activeFileId);
    if (activeItem) renderTargetViewer(activeItem);
  });

  // Ações do Destino
  dom.btnCopyMarkdown.addEventListener('click', () => {
    const activeItem = state.queue.find(i => i.id === state.activeFileId);
    if (activeItem && activeItem.outputContent) {
      navigator.clipboard.writeText(activeItem.outputContent);
      showToast('Markdown copiado para a Área de Transferência!', 'success');
    } else {
      showToast('Nenhum conteúdo para copiar.', 'info');
    }
  });

  dom.btnSaveMarkdown.addEventListener('click', async () => {
    const activeItem = state.queue.find(i => i.id === state.activeFileId);
    if (activeItem && activeItem.outputPath && activeItem.outputContent) {
      const res = await window.electronAPI.saveFile(activeItem.outputPath, activeItem.outputContent);
      if (res.success) {
        showToast('Arquivo salvo com sucesso!', 'success');
      } else {
        showToast(`Erro ao salvar: ${res.error}`, 'error');
      }
    }
  });

  dom.btnRevealOutput.addEventListener('click', () => {
    const activeItem = state.queue.find(i => i.id === state.activeFileId);
    if (activeItem && activeItem.outputPath) {
      window.electronAPI.revealFile(activeItem.outputPath);
    } else if (activeItem) {
      window.electronAPI.revealFile(activeItem.path);
    }
  });

  window.convertCurrentFile = (fileId) => {
    const targetFile = state.queue.find(i => i.id === fileId);
    if (targetFile) {
      startConversionQueue([targetFile]);
    }
  };

  // ==========================================
  // EXECUÇÃO DA CONVERSÃO
  // ==========================================
  dom.btnTopConvert.addEventListener('click', () => {
    if (state.queue.length === 0) {
      showToast('Adicione arquivos antes de iniciar a conversão.', 'warn');
      return;
    }
    startConversionQueue();
  });

  dom.btnTopCancel.addEventListener('click', () => {
    window.electronAPI.cancelConversion();
    appendLog('warn', 'Cancelamento solicitado pelo usuário...');
  });

  async function startConversionQueue(customList = null) {
    if (state.isConverting) return;

    const filesToConvert = customList || state.queue;
    if (filesToConvert.length === 0) return;

    state.isConverting = true;
    dom.btnTopConvert.style.display = 'none';
    dom.btnTopCancel.style.display = 'inline-flex';
    dom.statusPageTracker.style.display = 'inline-flex';

    // Opções de conversão consolidadas
    const options = {
      engine: state.settings.engine,
      format: state.settings.format,
      ocrEnabled: state.settings.ocrEnabled,
      ocrLanguage: state.settings.ocrLanguage,
      imageMode: state.settings.imageMode,
      extractImages: state.settings.extractImages,
      dpi: parseInt(state.settings.dpi, 10) || 150,
      destDir: state.destinationType === 'custom' && state.customDestPath ? state.customDestPath : 'source'
    };

    appendLog('info', `Iniciando lote de conversão (${filesToConvert.length} arquivo(s)). Formato: ${options.format.toUpperCase()}`);

    try {
      await window.electronAPI.startConversion(filesToConvert, options);
    } catch (e) {
      appendLog('error', `Falha na conversão: ${e.message}`);
      showToast(`Erro na conversão: ${e.message}`, 'error');
    } finally {
      state.isConverting = false;
      dom.btnTopConvert.style.display = 'inline-flex';
      dom.btnTopCancel.style.display = 'none';
      dom.statusPageTracker.style.display = 'none';
    }
  }

  // ==========================================
  // EVENTOS IPC DO CONVERSOR
  // ==========================================
  window.electronAPI.onLog((data) => {
    appendLog(data.level, data.message, data.timestamp);
  });

  window.electronAPI.onProgress((data) => {
    dom.statusText.textContent = data.status || 'Processando...';
    dom.statusBarFill.style.width = `${data.overallPercent || 0}%`;
    dom.statusPercent.textContent = `${data.overallPercent || 0}%`;
  });

  window.electronAPI.onPageProgress((data) => {
    dom.statusPageText.textContent = `Pág. ${data.page} / ${data.totalPages || '?'}`;
    const targetItem = state.queue.find(i => i.path === data.filePath);
    if (targetItem) {
      targetItem.status = 'converting';
      targetItem.page = data.page;
      targetItem.totalPages = data.totalPages;
      renderQueue();
    }
  });

  window.electronAPI.onFileStart((data) => {
    appendLog('info', `Iniciando: ${data.fileName} (${data.fileIndex + 1}/${data.totalFiles})`);
    const targetItem = state.queue.find(i => i.path === data.filePath);
    if (targetItem) {
      targetItem.status = 'converting';
      renderQueue();
    }
  });

  window.electronAPI.onFileComplete((data) => {
    const targetItem = state.queue.find(i => i.path === data.filePath);
    if (targetItem) {
      targetItem.status = 'success';
      targetItem.outputPath = data.outputPath;
      targetItem.outputContent = data.content;
      targetItem.totalPages = data.totalPages;
      renderQueue();

      // Se for o arquivo atualmente em foco, atualiza a tela instantaneamente
      if (targetItem.id === state.activeFileId) {
        updateViewers();
      }
    }
  });

  window.electronAPI.onFileError((data) => {
    const targetItem = state.queue.find(i => i.path === data.filePath);
    if (targetItem) {
      targetItem.status = 'error';
      targetItem.error = data.error;
      renderQueue();
    }
  });

  window.electronAPI.onBatchComplete((data) => {
    const successCount = data.results.filter(r => r.success).length;
    showToast(`Conversão concluída! ${successCount} arquivo(s) processados com sucesso.`, 'success');
    dom.statusText.textContent = 'Pronto';
    dom.statusBarFill.style.width = '100%';
    dom.statusPercent.textContent = '100%';
  });

  // ==========================================
  // CONSOLE DE LOGS
  // ==========================================
  function appendLog(level, message, timestamp = null) {
    const time = timestamp || new Date().toLocaleTimeString();
    const el = document.createElement('div');
    el.className = 'log-line';

    let levelBadge = `<span class="log-level info">[INFO]</span>`;
    if (level === 'warn') levelBadge = `<span class="log-level warn">[WARN]</span>`;
    if (level === 'error') levelBadge = `<span class="log-level error">[ERROR]</span>`;
    if (level === 'success') levelBadge = `<span class="log-level success">[OK]</span>`;

    el.innerHTML = `
      <span class="log-time">[${time}]</span>
      ${levelBadge}
      <span class="log-msg">${escapeHtml(message)}</span>
    `;

    dom.logContainer.appendChild(el);
    dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
  }

  dom.btnClearLogs.addEventListener('click', () => {
    dom.logContainer.innerHTML = '';
  });

  dom.btnCopyLogs.addEventListener('click', () => {
    const text = dom.logContainer.innerText;
    navigator.clipboard.writeText(text);
    showToast('Logs copiados para a Área de Transferência.', 'info');
  });

  // Filtro de busca de logs
  dom.logFilter.addEventListener('input', () => {
    const filter = dom.logFilter.value.toLowerCase();
    const lines = dom.logContainer.querySelectorAll('.log-line');
    lines.forEach(line => {
      const txt = line.innerText.toLowerCase();
      line.style.display = txt.includes(filter) ? 'flex' : 'none';
    });
  });

  // ==========================================
  // PRESETS EXPRESSOS
  // ==========================================
  function renderPresetsList() {
    dom.presetsCardsContainer.innerHTML = '';

    state.presets.forEach(preset => {
      const card = document.createElement('div');
      card.className = `preset-card ${preset.id === state.activePresetId ? 'active' : ''}`;
      card.onclick = () => selectPreset(preset);

      card.innerHTML = `
        <div class="preset-card-title">
          <span>${preset.name}</span>
          <span style="font-size: 10px; color: var(--vscode-accent);">${preset.format.toUpperCase()}</span>
        </div>
        <div class="preset-card-desc">${preset.description}</div>
        <div style="margin-top: 8px; display: flex; gap: 6px;">
          <button class="vscode-btn small" onclick="event.stopPropagation(); window.applyAndConvertPreset('${preset.id}')">
            Aplicar & Converter Fila
          </button>
        </div>
      `;

      dom.presetsCardsContainer.appendChild(card);
    });
  }

  function selectPreset(preset) {
    state.activePresetId = preset.id;
    dom.quickPresetTitle.textContent = `Preset: ${preset.name}`;
    dom.statusPresetTag.textContent = preset.name.split(' ')[0] + ' ' + (preset.name.split(' ')[1] || '');

    // Aplica configurações no estado e na UI
    if (preset.format) {
      state.settings.format = preset.format;
      dom.settingFormat.value = preset.format;
    }
    if (typeof preset.ocrEnabled === 'boolean') {
      state.settings.ocrEnabled = preset.ocrEnabled;
      dom.settingOcr.checked = preset.ocrEnabled;
    }
    if (preset.imageMode) {
      state.settings.imageMode = preset.imageMode;
      dom.settingImageMode.value = preset.imageMode;
    }
    if (typeof preset.extractImages === 'boolean') {
      state.settings.extractImages = preset.extractImages;
      dom.settingExtractImages.checked = preset.extractImages;
    }
    if (preset.engine) {
      state.settings.engine = preset.engine;
      dom.settingEngine.value = preset.engine;
    }

    renderPresetsList();
    showToast(`Preset ativo: ${preset.name}`, 'info');
  }

  window.applyAndConvertPreset = (presetId) => {
    const p = state.presets.find(item => item.id === presetId);
    if (p) {
      selectPreset(p);
      startConversionQueue();
    }
  };

  // ==========================================
  // DIAGNÓSTICO DISCRETO DOS COMPONENTES
  // ==========================================
  async function updateComponentDiagnostics() {
    try {
      const pStatus = await window.electronAPI.getPrereqStatus();
      if (dom.settingsDiagPython) {
        if (pStatus.python && pStatus.python.installed) {
          dom.settingsDiagPython.innerHTML = `• Python 3: <span style="color:#89d185;">${pStatus.python.version} ✓</span>`;
        } else {
          dom.settingsDiagPython.innerHTML = `• Python 3: <span style="color:#cca700;">Não detectado no PATH</span>`;
        }
      }
      if (dom.settingsDiagLibreOffice) {
        if (pStatus.libreoffice && pStatus.libreoffice.installed) {
          const mode = pStatus.libreoffice.isPortable ? 'Portátil (bin/libreoffice)' : 'Sistema';
          dom.settingsDiagLibreOffice.innerHTML = `• LibreOffice: <span style="color:#89d185;">Ativo (${mode}) ✓</span>`;
        } else {
          dom.settingsDiagLibreOffice.innerHTML = `• LibreOffice: <span style="color:#cca700;">Não instalado (DOC/XLS indisponíveis)</span>`;
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar status dos componentes:', e);
    }
  }

  // ==========================================
  // CONFIGURAÇÕES AVANÇADAS
  // ==========================================
  dom.settingEngine.addEventListener('change', () => {
    state.settings.engine = dom.settingEngine.value;
    dom.statusEngineTag.textContent = dom.settingEngine.value === 'native' ? 'LiteParse Nativo' : 'LiteParse Python';
  });

  dom.settingFormat.addEventListener('change', () => {
    state.settings.format = dom.settingFormat.value;
  });

  dom.settingOcr.addEventListener('change', () => {
    state.settings.ocrEnabled = dom.settingOcr.checked;
  });

  dom.settingOcrLang.addEventListener('change', () => {
    state.settings.ocrLanguage = dom.settingOcrLang.value;
  });

  dom.settingExtractImages.addEventListener('change', () => {
    state.settings.extractImages = dom.settingExtractImages.checked;
  });

  dom.settingImageMode.addEventListener('change', () => {
    state.settings.imageMode = dom.settingImageMode.value;
  });

  dom.settingDpi.addEventListener('change', () => {
    state.settings.dpi = dom.settingDpi.value;
  });

  // ==========================================
  // NOTIFICAÇÕES (TOASTS) & UTILITÁRIOS
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconColor = '#007acc';
    if (type === 'success') iconColor = '#89d185';
    if (type === 'error') iconColor = '#f14c4c';
    if (type === 'warn') iconColor = '#cca700';

    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <div style="flex: 1;">${escapeHtml(message)}</div>
    `;

    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Atalhos de Teclado
  document.addEventListener('keydown', (e) => {
    // Ctrl + Enter: Iniciar Conversão
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      startConversionQueue();
    }
    // Ctrl + ` : Alternar painel de logs
    if (e.ctrlKey && (e.key === '`' || e.key === 'j')) {
      e.preventDefault();
      dom.bottomPanel.classList.toggle('collapsed');
    }
  });
});
