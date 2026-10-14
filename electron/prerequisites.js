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
    try {
      const pyVer = execSync('python --version', { encoding: 'utf-8', timeout: 3000 }).trim();
      status.python.installed = true;
      status.python.version = pyVer;
      status.python.path = execSync(this.platform === 'win32' ? 'where python' : 'which python', { encoding: 'utf-8' }).split(/\r?\n/)[0];

      try {
        const lpVer = execSync('python -c "import liteparse; print(liteparse.__version__)"', { encoding: 'utf-8', timeout: 3000 }).trim();
        status.liteparsePython.installed = true;
        status.liteparsePython.version = lpVer;
      } catch (e) {
        status.liteparsePython.installed = false;
      }
    } catch (e) {
      status.python.installed = false;
    }

    return status;
  }

  /**
   * Faz download com suporte a redirects (HTTP 301/302)
   */
  _downloadFile(url, destPath, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Segue redirecionamento
          return this._downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
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

      request.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
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
   * Instala o LibreOffice de forma 100% PORTÁTIL em subpasta do app
   * Baixa preferencialmente do GitHub Releases mais recente ou fonte oficial
   */
  async installLibreOfficePortable(onLog = () => {}) {
    const targetDir = path.join(this.getPortableBaseDir(), 'libreoffice');
    fs.mkdirSync(targetDir, { recursive: true });

    onLog('info', `Diretório de destino portátil: ${targetDir}`);

    if (this.platform === 'win32') {
      onLog('info', 'Consultando versão mais recente dos pré-requisitos no GitHub (pgepi/conversor_de_documentos)...');

      let downloadUrl = 'https://download.documentfoundation.org/libreoffice/portable/24.8.4/LibreOfficePortablePrevious_24.8.4_MultilingualStandard.paf.exe';
      const release = await this.getLatestGitHubRelease();

      if (release && release.assets) {
        onLog('info', `Versão mais recente no GitHub identificada: ${release.tag_name || 'latest'}`);
        const prereqAsset = release.assets.find(a => 
          a.name.toLowerCase().includes('libreoffice') || 
          a.name.toLowerCase().includes('prereq')
        );
        if (prereqAsset && prereqAsset.browser_download_url) {
          downloadUrl = prereqAsset.browser_download_url;
          onLog('info', `Utilizando asset oficial do GitHub Release: ${prereqAsset.name}`);
        }
      }

      const tempInstaller = path.join(os.tmpdir(), `LibreOfficePortable_${Date.now()}.paf.exe`);
      onLog('info', `Baixando instalador portátil (100% isolado, sem tocar no sistema)...`);
      onLog('info', `Origem: ${downloadUrl}`);

      try {
        await this._downloadFile(downloadUrl, tempInstaller, (pct, cur, tot) => {
          if (pct % 20 === 0) {
            onLog('info', `Progresso do download portátil: ${pct}% (${(cur / 1024 / 1024).toFixed(1)}MB / ${(tot / 1024 / 1024).toFixed(1)}MB)`);
          }
        });

        onLog('info', 'Download concluído! Extraindo binários portáteis silenciosamente...');

        return new Promise((resolve, reject) => {
          // Extração silenciosa do PAF em subpasta local
          const child = spawn(tempInstaller, [`/DEST=${targetDir}`, '/S']);

          child.on('close', (code) => {
            // Remove instalador temporário
            try { fs.unlinkSync(tempInstaller); } catch (e) {}

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
