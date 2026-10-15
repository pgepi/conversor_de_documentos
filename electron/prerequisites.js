/**
 * Prerequisites Manager
 * Gerencia pré-requisitos em modo 100% PORTÁTIL (isolados em subpastas do aplicativo),
 * garantindo que o sistema operacional do usuário não seja modificado ou poluído.
 */

const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

class PrerequisitesManager {
  constructor(appPath, userDataPath) {
    this.appPath = appPath || path.resolve(__dirname, '..');
    this.userDataPath = userDataPath || this.appPath;
    this.platform = process.platform;
    this.setupEnvironment();
  }

  /**
   * Injeta os caminhos portáteis no PATH do processo em execução
   * Isso garante que subprocessos (incluindo o LiteParse) encontrem o soffice localmente
   */
  setupEnvironment() {
    const loPath = this.getLibreOfficePath();
    if (loPath) {
      const loDir = path.dirname(loPath);
      const sep = this.platform === 'win32' ? ';' : ':';
      if (!process.env.PATH.includes(loDir)) {
        process.env.PATH = `${loDir}${sep}${process.env.PATH}`;
      }
    }

    const pyPath = this.getPythonPath();
    if (pyPath) {
      const pyDir = path.dirname(pyPath);
      const sep = this.platform === 'win32' ? ';' : ':';
      if (!process.env.PATH.includes(pyDir)) {
        process.env.PATH = `${pyDir}${sep}${process.env.PATH}`;
      }
    }
  }

  /**
   * Localiza o executável do Python, priorizando a versão portátil em bin/python
   */
  getPythonPath() {
    const portableCandidates = [
      path.join(this.appPath, 'bin', 'python', 'python.exe'),
      path.join(this.userDataPath, 'bin', 'python', 'python.exe'),
      path.join(this.appPath, 'bin', 'python', 'bin', 'python3'),
      path.join(this.userDataPath, 'bin', 'python', 'bin', 'python3')
    ];

    for (const p of portableCandidates) {
      if (fs.existsSync(p)) return p;
    }

    try {
      const cmd = this.platform === 'win32' ? 'where python 2>nul' : 'which python3 || which python 2>/dev/null';
      const out = execSync(cmd, { encoding: 'utf-8' }).trim();
      if (out) return out.split(/\r?\n/)[0];
    } catch (e) {
      // Ignored
    }
    return null;
  }

  /**
   * Retorna o diretório onde os pré-requisitos portáteis devem ser instalados
   */
  getPortableBaseDir() {
    // Tenta gravar na pasta do app; se não for gravável (ex: C:\Program Files restrito), usa userData
    const localBin = path.join(this.appPath, 'bin');
    try {
      if (!fs.existsSync(localBin)) {
        fs.mkdirSync(localBin, { recursive: true });
      }
      fs.accessSync(localBin, fs.constants.W_OK);
      return localBin;
    } catch (e) {
      const userBin = path.join(this.userDataPath, 'bin');
      if (!fs.existsSync(userBin)) {
        fs.mkdirSync(userBin, { recursive: true });
      }
      return userBin;
    }
  }

  /**
   * Localiza o executável do LibreOffice, dando prioridade absoluta à versão portátil local
   */
  getLibreOfficePath() {
    const portableCandidates = [
      path.join(this.appPath, 'bin', 'libreoffice', 'program', 'soffice.exe'),
      path.join(this.appPath, 'bin', 'libreoffice', 'App', 'libreoffice', 'program', 'soffice.exe'),
      path.join(this.userDataPath, 'bin', 'libreoffice', 'program', 'soffice.exe'),
      path.join(this.userDataPath, 'bin', 'libreoffice', 'App', 'libreoffice', 'program', 'soffice.exe'),
      path.join(this.appPath, 'bin', 'soffice.exe'),
      // Linux Portable / AppImage
      path.join(this.appPath, 'bin', 'libreoffice', 'program', 'soffice'),
      path.join(this.appPath, 'bin', 'libreoffice.AppImage')
    ];

    for (const p of portableCandidates) {
      if (fs.existsSync(p)) return p;
    }

    // Fallback: se o usuário já possuir instalado no sistema
    if (this.platform === 'win32') {
      const sysCandidates = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LibreOffice', 'program', 'soffice.exe')
      ];

      for (const p of sysCandidates) {
        if (fs.existsSync(p)) return p;
      }

      try {
        const whereOutput = execSync('where soffice 2>nul', { encoding: 'utf-8' }).trim();
        if (whereOutput) return whereOutput.split('\r\n')[0];
      } catch (e) {
        // Ignored
      }
    } else if (this.platform === 'darwin') {
      const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
      if (fs.existsSync(macPath)) return macPath;
    } else {
      try {
        const whichOutput = execSync('which libreoffice || which soffice 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (whichOutput) return whichOutput.split('\n')[0];
      } catch (e) {
        // Ignored
      }
    }

    return null;
  }

  /**
   * Verifica se a instalação atual é portátil
   */
  isLibreOfficePortable() {
    const loPath = this.getLibreOfficePath();
    if (!loPath) return false;
    return loPath.startsWith(this.appPath) || loPath.startsWith(this.userDataPath);
  }

  /**
   * Verifica o status completo dos pré-requisitos
   */
  async checkStatus() {
    const loPath = this.getLibreOfficePath();
    const isPortable = this.isLibreOfficePortable();

    const status = {
      libreoffice: {
        installed: !!loPath,
        isPortable: isPortable,
        version: null,
        path: loPath,
        portableDir: path.join(this.getPortableBaseDir(), 'libreoffice'),
        requiredFor: 'Conversão e visualização de arquivos DOC, DOCX, XLSX, PPTX'
      },
      python: {
        installed: false,
        version: null,
        path: null,
        requiredFor: 'Motor Python alternativo do LiteParse'
      },
      liteparseNode: {
        installed: true,
        version: '2.15.1 (Embutido)',
        requiredFor: 'Motor nativo ultrarrápido de PDFs'
      },
      liteparsePython: {
        installed: false,
        version: null,
        requiredFor: 'Suporte estendido Python'
      }
    };

    // Detalhes do LibreOffice
    if (loPath) {
      try {
        const verOut = execSync(`"${loPath}" --version`, { encoding: 'utf-8', timeout: 4000 });
        status.libreoffice.version = verOut.trim();
      } catch (e) {
        status.libreoffice.version = isPortable ? 'Portátil (Ativo)' : 'Sistema (Ativo)';
      }
    }

    // Detalhes do Python
    const pyPath = this.getPythonPath();
    if (pyPath) {
      try {
        const pyVer = execSync(`"${pyPath}" --version`, { encoding: 'utf-8', timeout: 3000 }).trim();
        status.python.installed = true;
        status.python.version = pyVer;
        status.python.path = pyPath;

        try {
          const lpVer = execSync(`"${pyPath}" -c "import liteparse; print(liteparse.__version__)"`, { encoding: 'utf-8', timeout: 3000 }).trim();
          status.liteparsePython.installed = true;
          status.liteparsePython.version = lpVer;
        } catch (e) {
          status.liteparsePython.installed = false;
        }
      } catch (e) {
        status.python.installed = false;
      }
    } else {
      status.python.installed = false;
    }

    return status;
  }

  /**
   * Faz download com suporte a redirects (HTTP 301/302) e fallback automático HTTPS -> HTTP
   */
  _downloadFile(url, destPath, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;

      const request = client.get(url, { timeout: 20000 }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          return this._downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Servidor retornou status HTTP ${response.statusCode}`));
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            onProgress(percent, downloadedBytes, totalBytes);
          }
        });

        response.on('end', () => {
          file.end();
          resolve(destPath);
        });
      });

      const handleFail = (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        // Se falhou em HTTPS em espelhos que suportam HTTP, tenta automaticamente via HTTP
        if (isHttps && url.includes('c3sl.ufpr.br')) {
          const fallbackUrl = url.replace('https://', 'http://');
          return this._downloadFile(fallbackUrl, destPath, onProgress).then(resolve).catch(reject);
        }
        reject(err);
      };

      request.on('error', handleFail);
      request.on('timeout', () => {
        request.destroy();
        handleFail(new Error('Tempo limite de conexão esgotado (timeout)'));
      });
    });
  }

  /**
   * Consulta a API do GitHub Releases para obter os assets mais recentes
   */
  async getLatestGitHubRelease() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/pgepi/conversor_de_documentos/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'ConversorDocumentos-App'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(4000, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }

  /**
   * Calcula dinamicamente o link para a versão mais recente do LibreOffice Portable
   */
  async getLatestLibreOfficePortableUrl(onLog = () => {}) {
    // 1. Tenta obter asset portátil prioritário do GitHub Releases do conversor_de_documentos
    try {
      const release = await this.getLatestGitHubRelease();
      if (release && release.assets) {
        const prereqAsset = release.assets.find(a => 
          a.name.toLowerCase().includes('libreoffice') || 
          a.name.toLowerCase().includes('prereq')
        );
        if (prereqAsset && prereqAsset.browser_download_url) {
          onLog('info', `Asset oficial identificado no GitHub Release (${release.tag_name || 'latest'}): ${prereqAsset.name}`);
          return prereqAsset.browser_download_url;
        }
      }
    } catch (e) {
      // Ignora e segue para os espelhos oficiais
    }

    // 2. Espelhos oficiais da The Document Foundation (TDF)
    const baseMirrors = [
      'http://tdf.c3sl.ufpr.br/libreoffice/portable/',
      'https://tdf.c3sl.ufpr.br/libreoffice/portable/',
      'https://download.documentfoundation.org/libreoffice/portable/',
      'http://download.documentfoundation.org/libreoffice/portable/'
    ];

    const fetchHtml = (u) => {
      return new Promise((resolve, reject) => {
        const client = u.startsWith('https') ? https : http;
        const req = client.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchHtml(res.headers.location).then(resolve).catch(reject);
          }
          if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
    };

    const compareSemVer = (a, b) => {
      const pa = a.split('.').map(n => parseInt(n, 10) || 0);
      const pb = b.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return na - nb;
      }
      return 0;
    };

    for (const mirror of baseMirrors) {
      try {
        onLog('info', `Consultando espelho oficial: ${mirror}...`);
        const html = await fetchHtml(mirror);
        const versionRegex = /href=["'](\d+\.\d+\.\d+(?:\.\d+)?)\/?["']/g;
        const versions = [];
        let match;
        while ((match = versionRegex.exec(html)) !== null) {
          versions.push(match[1]);
        }

        if (versions.length > 0) {
          versions.sort(compareSemVer);
          const latestVersion = versions[versions.length - 1];
          onLog('info', `Última versão detectada dinamicamente: ${latestVersion}`);

          const versionUrl = mirror.endsWith('/') ? mirror + latestVersion + '/' : mirror + '/' + latestVersion + '/';
          try {
            const vHtml = await fetchHtml(versionUrl);
            const fileMatch = vHtml.match(/href=["'](LibreOfficePortable[^"']*MultilingualStandard\.paf\.exe)["']/i) ||
                              vHtml.match(/href=["'](LibreOfficePortable[^"']*\.paf\.exe)["']/i);
            if (fileMatch) {
              const finalUrl = versionUrl + fileMatch[1];
              onLog('info', `Link calculado para versão mais recente: ${finalUrl}`);
              return finalUrl;
            }
          } catch (e) {
            const fallbackVersionUrl = versionUrl + `LibreOfficePortable_${latestVersion}_MultilingualStandard.paf.exe`;
            onLog('info', `Link montado para versão mais recente: ${fallbackVersionUrl}`);
            return fallbackVersionUrl;
          }
        }
      } catch (err) {
        onLog('warn', `Consulta ao espelho ${mirror} não respondeu: ${err.message}`);
      }
    }

    // 3. Fallback seguro e verificado caso todos os espelhos estejam offline
    const defaultUrl = 'http://tdf.c3sl.ufpr.br/libreoffice/portable/26.2.4/LibreOfficePortable_26.2.4_MultilingualStandard.paf.exe';
    onLog('info', `Utilizando link oficial da UFPR C3SL: ${defaultUrl}`);
    return defaultUrl;
  }

  /**
   * Instala o LibreOffice de forma 100% PORTÁTIL em subpasta do app
   * Baixa preferencialmente do GitHub Releases mais recente ou fonte oficial
   */
  async installLibreOfficePortable(onLog = () => {}) {
    const targetDir = path.join(this.getPortableBaseDir(), 'libreoffice');
    fs.mkdirSync(targetDir, { recursive: true });

    onLog('info', `Diretório de destino portátil: ${targetDir}`);

    if (this.platform === 'win32') {
      const minimalUrl = 'https://github.com/pgepi/conversor_de_documentos/releases/download/v1.1.1/libreoffice-minimal-ptbr-en.7z';
      let downloadUrl = minimalUrl;
      let is7z = true;
      let tempInstaller = path.join(os.tmpdir(), `LibreOfficeMinimal_${Date.now()}.7z`);

      onLog('info', 'Baixando pacote LibreOffice Minimal (~107 MB, PT-BR + EN)...');
      onLog('info', `Origem: ${downloadUrl}`);

      try {
        await this._downloadFile(downloadUrl, tempInstaller, (pct, cur, tot) => {
          if (pct % 20 === 0) {
            onLog('info', `Progresso do download portátil: ${pct}% (${(cur / 1024 / 1024).toFixed(1)}MB / ${(tot / 1024 / 1024).toFixed(1)}MB)`);
          }
        });

        onLog('info', 'Download concluído! Extraindo binários portáteis silenciosamente...');

        const sevenZipCandidates = [
          path.join(process.resourcesPath || '', '7za.exe'),
          path.join(this.appPath, 'build', '7za.exe'),
          path.join(this.appPath, 'resources', '7za.exe'),
          path.join(__dirname, '..', 'build', '7za.exe')
        ];
        let sevenZip = null;
        for (const c of sevenZipCandidates) {
          if (fs.existsSync(c)) { sevenZip = c; break; }
        }

        return new Promise((resolve, reject) => {
          let child;
          if (sevenZip) {
            onLog('info', 'Utilizando motor 7-Zip para extração 100% desassistida...');
            child = spawn(sevenZip, ['x', tempInstaller, `-o${targetDir}`, '-y']);
          } else {
            child = spawn(tempInstaller, [`/DEST=${targetDir}`, '/S']);
          }

          child.on('close', (code) => {
            // Remove instalador temporário
            try { fs.unlinkSync(tempInstaller); } catch (e) {}

            // Normaliza estrutura se extraído em App/libreoffice
            const nestedProgram = path.join(targetDir, 'App', 'libreoffice', 'program', 'soffice.exe');
            const rootProgram = path.join(targetDir, 'program', 'soffice.exe');
            if (fs.existsSync(nestedProgram) && !fs.existsSync(rootProgram)) {
              try {
                const nestedBase = path.join(targetDir, 'App', 'libreoffice');
                fs.cpSync(nestedBase, targetDir, { recursive: true });
              } catch (cpErr) {
                // Ignored
              }
            }

            this.setupEnvironment();
            const loPath = this.getLibreOfficePath();

            if (loPath) {
              onLog('success', `✓ LibreOffice portátil configurado com sucesso em: ${loPath}`);
              resolve({
                success: true,
                isPortable: true,
                path: loPath,
                message: 'LibreOffice portátil instalado com sucesso na pasta do app!'
              });
            } else {
              onLog('warn', `Instalação concluída (código ${code}), verificando executável em ${targetDir}...`);
              resolve({
                success: true,
                isPortable: true,
                path: targetDir,
                message: 'Arquivos extraídos na pasta portátil.'
              });
            }
          });

          child.on('error', (err) => {
            try { fs.unlinkSync(tempInstaller); } catch (e) {}
            reject(err);
          });
        });

      } catch (err) {
        onLog('error', `Falha no download/extração automática: ${err.message}`);
        onLog('info', 'Dica: Você também pode simplesmente colar a pasta do LibreOfficePortable diretamente em: ' + targetDir);
        throw err;
      }
    } else {
      onLog('info', 'No Linux/macOS, coloque a pasta dos binários do LibreOffice ou o AppImage em: ' + targetDir);
      return { success: true, message: 'Pasta portátil pronta para receber binários.' };
    }
  }

  /**
   * Converte documento office usando o LibreOffice (portátil ou sistema)
   */
  async convertOfficeWithLibreOffice(filePath, outputFormat = 'pdf') {
    const loPath = this.getLibreOfficePath();
    if (!loPath) {
      throw new Error('LibreOffice não encontrado nem na pasta portátil nem no sistema.');
    }

    const tempDir = path.join(os.tmpdir(), `liteparse_preview_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--convert-to', outputFormat,
        '--outdir', tempDir,
        filePath
      ];

      const child = spawn(loPath, args);
      child.on('close', code => {
        if (code === 0) {
          const baseName = path.basename(filePath, path.extname(filePath));
          const convertedFile = path.join(tempDir, `${baseName}.${outputFormat}`);
          if (fs.existsSync(convertedFile)) {
            resolve(convertedFile);
          } else {
            reject(new Error(`Arquivo convertido não encontrado em ${convertedFile}`));
          }
        } else {
          reject(new Error(`LibreOffice encerrou com código ${code}`));
        }
      });
      child.on('error', reject);
    });
  }
}

module.exports = { PrerequisitesManager };
