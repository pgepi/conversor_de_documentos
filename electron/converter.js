/**
 * LiteParse Engine Wrapper
 * Suporta motor nativo Node/Rust (@llamaindex/liteparse) e motor Python (liteparse)
 * Fornece streaming de paginação em tempo real, captura de logs e cálculo de progresso.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mammoth = require('mammoth');
const { LiteParse } = require('@llamaindex/liteparse');

class ConversionEngine {
  constructor() {
    this.currentTask = null;
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
    if (this.currentTask && typeof this.currentTask.kill === 'function') {
      try {
        this.currentTask.kill();
      } catch (e) {
        // Ignored
      }
    }
  }

  /**
   * Converte uma lista de arquivos
   */
  async convertBatch(fileList, options, callbacks = {}) {
    const {
      onLog = () => {},
      onProgress = () => {},
      onFileStart = () => {},
      onPageProgress = () => {},
      onFileComplete = () => {},
      onFileError = () => {},
      onBatchComplete = () => {}
    } = callbacks;

    this.isCancelled = false;
    const results = [];
    const totalFiles = fileList.length;

    onLog('info', `Iniciando conversão em lote: ${totalFiles} arquivo(s) na fila`);

    for (let i = 0; i < totalFiles; i++) {
      if (this.isCancelled) {
        onLog('warn', 'Processamento cancelado pelo usuário');
        break;
      }

      const fileItem = fileList[i];
      const filePath = typeof fileItem === 'string' ? fileItem : fileItem.path;
      const fileOptions = { ...options, ...(fileItem.options || {}) };

      onFileStart({
        fileIndex: i,
        totalFiles,
        filePath,
        fileName: path.basename(filePath)
      });

      onProgress({
        fileIndex: i,
        totalFiles,
        currentFile: path.basename(filePath),
        overallPercent: Math.round((i / totalFiles) * 100),
        status: `Convertendo (${i + 1}/${totalFiles})...`
      });

      const startTime = Date.now();

      try {
        const fileResult = await this.convertSingleFile(filePath, fileOptions, {
          onLog,
          onPageProgress: (pageInfo) => {
            onPageProgress({
              fileIndex: i,
              totalFiles,
              filePath,
              fileName: path.basename(filePath),
              ...pageInfo
            });
            // Atualiza progresso proporcional
            const fileProgress = (pageInfo.page / (pageInfo.totalPages || 1));
            const overall = ((i + fileProgress) / totalFiles) * 100;
            onProgress({
              fileIndex: i,
              totalFiles,
              currentFile: path.basename(filePath),
              overallPercent: Math.min(99, Math.round(overall)),
              status: `Pág. ${pageInfo.page} de ${pageInfo.totalPages} (${Math.round(fileProgress * 100)}%)`
            });
          }
        });

        const elapsedMs = Date.now() - startTime;
        fileResult.elapsedMs = elapsedMs;
        results.push(fileResult);

        onFileComplete({
          fileIndex: i,
          totalFiles,
          filePath,
          outputPath: fileResult.outputPath,
          content: fileResult.content,
          totalPages: fileResult.totalPages,
          elapsedMs
        });

        onLog('success', `✓ Concluído: ${path.basename(filePath)} (${fileResult.totalPages} págs) em ${(elapsedMs / 1000).toFixed(2)}s`);
      } catch (err) {
        const elapsedMs = Date.now() - startTime;
        onLog('error', `✗ Erro ao converter ${path.basename(filePath)}: ${err.message}`);
        onFileError({
          fileIndex: i,
          totalFiles,
          filePath,
          error: err.message
        });
        results.push({
          filePath,
          error: err.message,
          success: false
        });
      }
    }

    onProgress({
      fileIndex: totalFiles,
      totalFiles,
      overallPercent: 100,
      status: this.isCancelled ? 'Cancelado' : 'Concluído'
    });

    onBatchComplete({
      results,
      cancelled: this.isCancelled
    });

    return results;
  }

  /**
   * Converte um único arquivo com paginação e captura de log
   */
  async convertSingleFile(filePath, options = {}, callbacks = {}) {
    const { onLog = () => {}, onPageProgress = () => {} } = callbacks;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const format = options.format || 'markdown'; // 'markdown' | 'text' | 'json'
    const ocrEnabled = options.ocrEnabled !== false;
    const ocrLanguage = options.ocrLanguage || 'eng';
    const imageMode = options.imageMode || 'placeholder';
    const extractImages = !!options.extractImages;
    const targetPages = options.targetPages || undefined;
    const maxPages = options.maxPages ? parseInt(options.maxPages, 10) : 1000;
    const engineType = options.engine || 'native'; // 'native' | 'python'

    // Determina caminho de destino
    let destDir = options.destDir;
    if (!destDir || destDir === 'source') {
      destDir = path.dirname(filePath);
    }
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const baseName = path.basename(filePath, ext);
    let outputExt = '.md';
    if (format === 'text') outputExt = '.txt';
    if (format === 'json') outputExt = '.json';

    const outputPath = path.join(destDir, `${baseName}${outputExt}`);
    onLog('info', `Origem: ${filePath}`);
    onLog('info', `Destino: ${outputPath}`);
    onLog('info', `Configurações: Formato=${format.toUpperCase()}, OCR=${ocrEnabled ? `Sim (${ocrLanguage})` : 'Não'}, Motor=${engineType}`);

    if (engineType === 'python') {
      return await this._convertWithPython(filePath, outputPath, options, callbacks);
    }

    // Configura o parser do LiteParse nativo
    const parserConfig = {
      outputFormat: format,
      ocrEnabled: ocrEnabled,
      ocrLanguage: ocrLanguage,
      imageMode: imageMode,
      extractImages: extractImages,
      targetPages: targetPages,
      maxPages: maxPages,
      quiet: false
    };

    if (extractImages) {
      const imgDir = path.join(destDir, `${baseName}_images`);
      if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
      }
      parserConfig.imageOutputDir = imgDir;
      parserConfig.imageMode = 'embed';
    }

    const parser = new LiteParse(parserConfig);

    // Iteração por lotes de páginas para obter progresso e paginação em tempo real
    let allMarkdown = [];
    let allText = [];
    let jsonPages = [];
    let totalPages = 0;
    let pageCountSeen = 0;

    onLog('info', `Analisando páginas e renderizando documento...`);

    try {
      // Usar parseBatches com tamanho 1 para permitir atualização página a página em tempo real
      for await (const batch of parser.parseBatches(filePath, 1)) {
        if (this.isCancelled) {
          throw new Error('Operação cancelada pelo usuário');
        }

        totalPages = batch.totalPages || totalPages;
        const pageNum = batch.startPage;
        pageCountSeen++;

        onPageProgress({
          page: pageNum,
          totalPages: totalPages || pageNum,
          percent: totalPages ? Math.round((pageNum / totalPages) * 100) : 100
        });

        onLog('info', `[liteparse] Processada página ${pageNum} de ${totalPages || '?'}`);

        if (batch.result) {
          if (batch.result.pages && batch.result.pages.length > 0) {
            for (const p of batch.result.pages) {
              if (p.markdown) {
                allMarkdown.push(p.markdown);
              }
              if (p.text) {
                allText.push(p.text);
              }
              jsonPages.push(p);
            }
          } else if (batch.result.text) {
            allText.push(batch.result.text);
            allMarkdown.push(batch.result.text);
          }
        }
      }
    } catch (batchErr) {
      // Se parseBatches falhar ou não for suportado para o formato (ex: DOCX sem LibreOffice),
      // faz fallback para parse() direto ou para o mammoth
      onLog('warn', `Processamento inicial (${batchErr.message}). Tentando método alternativo...`);

      if (ext === '.docx') {
        try {
          onLog('info', 'Processando DOCX diretamente com motor de conversão Mammoth...');
          if (format === 'markdown') {
            const mdRes = await mammoth.convertToMarkdown({ path: filePath });
            allMarkdown = [mdRes.value];
            totalPages = 1;
          } else {
            const rawRes = await mammoth.extractRawText({ path: filePath });
            allText = [rawRes.value];
            allMarkdown = [rawRes.value];
            totalPages = 1;
          }
        } catch (docxErr) {
          onLog('error', `Falha no motor DOCX: ${docxErr.message}`);
        }
      }

      if (allMarkdown.length === 0 && allText.length === 0) {
        try {
          const fullResult = await parser.parse(filePath);
          totalPages = fullResult.totalPages || (fullResult.pages ? fullResult.pages.length : 1);
          if (fullResult.pages && fullResult.pages.length > 0) {
            allMarkdown = fullResult.pages.map(p => p.markdown || p.text || '');
            allText = fullResult.pages.map(p => p.text || '');
            jsonPages = fullResult.pages;
          } else {
            allText = [fullResult.text || ''];
            allMarkdown = [fullResult.text || ''];
          }
        } catch (fullErr) {
          if (ext === '.doc') {
            throw new Error(`Arquivos .DOC legados requerem o LibreOffice. Habilite a opção portátil no instalador do sistema. Erro: ${fullErr.message}`);
          }
          throw fullErr;
        }
      }
    }

    let finalContent = '';
    if (format === 'markdown') {
      finalContent = allMarkdown.join('\n\n---\n\n');
    } else if (format === 'text') {
      finalContent = allText.join('\n\n');
    } else if (format === 'json') {
      finalContent = JSON.stringify({
        source: filePath,
        totalPages: totalPages || pageCountSeen,
        format: 'json',
        pages: jsonPages
      }, null, 2);
    }

    // Grava o arquivo de saída
    fs.writeFileSync(outputPath, finalContent, 'utf-8');
    onLog('info', `Arquivo salvo com sucesso em: ${outputPath}`);

    return {
      filePath,
      outputPath,
      content: finalContent,
      format,
      totalPages: totalPages || pageCountSeen || 1,
      success: true
    };
  }

  /**
   * Converte usando o processo Python como motor alternativo/fallback
   */
  async _convertWithPython(filePath, outputPath, options, callbacks) {
    const { onLog = () => {}, onPageProgress = () => {} } = callbacks;
    const workerScript = path.join(__dirname, 'python_worker.py');

    return new Promise((resolve, reject) => {
      const args = [
        workerScript,
        '--input', filePath,
        '--output', outputPath,
        '--format', options.format || 'markdown'
      ];

      if (options.ocrEnabled === false) {
        args.push('--no-ocr');
      }
      if (options.ocrLanguage) {
        args.push('--ocr-lang', options.ocrLanguage);
      }

      onLog('info', `Iniciando worker Python: python ${args.join(' ')}`);

      const pyProc = spawn('python', args);
      this.currentTask = pyProc;

      pyProc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('{"event":')) {
            try {
              const evt = JSON.parse(trimmed);
              if (evt.event === 'page') {
                onPageProgress({
                  page: evt.page,
                  totalPages: evt.totalPages,
                  percent: Math.round((evt.page / evt.totalPages) * 100)
                });
                onLog('info', `[Python] Página ${evt.page} de ${evt.totalPages}`);
              } else if (evt.event === 'done') {
                // Done event
              }
            } catch (e) {
              onLog('info', trimmed);
            }
          } else {
            onLog('info', trimmed);
          }
        }
      });

      pyProc.stderr.on('data', (data) => {
        onLog('warn', data.toString().trim());
      });

      pyProc.on('close', (code) => {
        this.currentTask = null;
        if (code === 0 && fs.existsSync(outputPath)) {
          const content = fs.readFileSync(outputPath, 'utf-8');
          resolve({
            filePath,
            outputPath,
            content,
            format: options.format || 'markdown',
            totalPages: 1,
            success: true
          });
        } else {
          reject(new Error(`Processo Python encerrou com código ${code}`));
        }
      });

      pyProc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = { ConversionEngine };
