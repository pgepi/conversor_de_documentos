/**
 * System Integration Manager
 * Gerencia a integração com o Sistema Operacional:
 * - "Send To" do Windows e equivalentes (Linux / macOS)
 * - Menu de contexto "Converter para..." para arquivos compatíveis
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class SystemIntegration {
  constructor(appPath, exePath) {
    this.appPath = appPath;
    this.exePath = exePath || process.execPath;
    this.platform = process.platform;
  }

  getCommandPrefix() {
    const absExe = path.resolve(this.exePath);
    const absApp = path.resolve(this.appPath);
    if (path.basename(absExe).toLowerCase().includes('electron')) {
      return `"${absExe}" "${absApp}"`;
    }
    return `"${absExe}"`;
  }

  // ==========================================
  // WINDOWS: "Send To" (Enviar para)
  // ==========================================
  getWindowsSendToPath() {
    const appData = process.env.APPDATA;
    if (!appData) return null;
    return path.join(appData, 'Microsoft', 'Windows', 'SendTo');
  }

  installWindowsSendTo() {
    const sendToDir = this.getWindowsSendToPath();
    if (!sendToDir || !fs.existsSync(sendToDir)) {
      throw new Error('Diretório SendTo do Windows não encontrado.');
    }

    const scriptPath = path.join(sendToDir, 'Conversor de Documentos.cmd');
    const legacyPath = path.join(sendToDir, 'LiteParse.cmd');
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch (e) {}
    }

    const cmdContent = `@echo off\r\nstart "" ${this.getCommandPrefix()} %*\r\n`;
    fs.writeFileSync(scriptPath, cmdContent, 'utf-8');

    return {
      success: true,
      path: scriptPath,
      message: 'Atalho "Conversor de Documentos" adicionado com sucesso ao menu "Enviar para" (Send To)!'
    };
  }

  uninstallWindowsSendTo() {
    const sendToDir = this.getWindowsSendToPath();
    if (!sendToDir) return { success: false };

    const scriptPath = path.join(sendToDir, 'Conversor de Documentos.cmd');
    const legacyPath = path.join(sendToDir, 'LiteParse.cmd');
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

    return { success: true, message: 'Atalho removido do menu "Enviar para".' };
  }

  isWindowsSendToInstalled() {
    const sendToDir = this.getWindowsSendToPath();
    if (!sendToDir) return false;
    return fs.existsSync(path.join(sendToDir, 'Conversor de Documentos.cmd')) || fs.existsSync(path.join(sendToDir, 'LiteParse.cmd'));
  }

  // ==========================================
  // WINDOWS: Menu de Contexto ("Converter para...")
  // ==========================================
  installWindowsContextMenu() {
    if (this.platform !== 'win32') {
      throw new Error('Menu de contexto do Registro Windows só é suportado no Windows.');
    }

    const rawCmd = this.getCommandPrefix();
    const cmdForReg = rawCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const firstToken = rawCmd.split(' ')[0].replace(/"/g, '').replace(/\\/g, '\\\\');

    // Cria arquivo .reg temporário para registrar com segurança no HKCU (não requer privilégios de Administrador!)
    const regContent = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos]
"MUIVerb"="Converter Documento (PGE)"
"SubCommands"=""
"Icon"="${firstToken}"

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell]

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\1_Markdown]
@="Converter para Markdown (.md) [Expresso]"
[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\1_Markdown\\command]
@="${cmdForReg} --express --format markdown \\"%1\\""

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\2_MarkdownOCR]
@="Converter para Markdown com OCR (.md)"
[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\2_MarkdownOCR\\command]
@="${cmdForReg} --express --format markdown --ocr \\"%1\\""

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\3_Text]
@="Converter para Texto (.txt)"
[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\3_Text\\command]
@="${cmdForReg} --express --format text \\"%1\\""

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\4_JSON]
@="Converter para JSON (.json)"
[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\4_JSON\\command]
@="${cmdForReg} --express --format json \\"%1\\""

[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\5_Studio]
@="Abrir no Conversor de Documentos..."
[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\ConversorDocumentos\\shell\\5_Studio\\command]
@="${cmdForReg} \\"%1\\""
`;

    const tempRegFile = path.join(process.env.TEMP || '.', `conversor_install_${Date.now()}.reg`);
    fs.writeFileSync(tempRegFile, regContent, 'utf-8');

    try {
      execSync(`reg.exe import "${tempRegFile}"`, { stdio: 'ignore' });
      if (fs.existsSync(tempRegFile)) fs.unlinkSync(tempRegFile);
      return {
        success: true,
        message: 'Menu de contexto "Converter para..." registrado com sucesso no Windows!'
      };
    } catch (err) {
      if (fs.existsSync(tempRegFile)) fs.unlinkSync(tempRegFile);
      throw new Error(`Falha ao registrar no Registro do Windows: ${err.message}`);
    }
  }

  uninstallWindowsContextMenu() {
    if (this.platform !== 'win32') return { success: false };

    try {
      execSync('reg.exe delete "HKCU\\Software\\Classes\\*\\shell\\ConversorDocumentos" /f', { stdio: 'ignore' });
      execSync('reg.exe delete "HKCU\\Software\\Classes\\*\\shell\\LiteParse" /f 2>nul', { stdio: 'ignore' });
      return {
        success: true,
        message: 'Menu de contexto do Conversor de Documentos removido com sucesso.'
      };
    } catch (err) {
      return { success: true, message: 'Menu já não estava presente.' };
    }
  }

  isWindowsContextMenuInstalled() {
    if (this.platform !== 'win32') return false;
    try {
      const output = execSync('reg query "HKCU\\Software\\Classes\\*\\shell\\ConversorDocumentos" 2>nul', { encoding: 'utf-8' });
      return output.includes('ConversorDocumentos') || output.includes('MUIVerb');
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // LINUX: Nautilus Scripts & Desktop Entry
  // ==========================================
  installLinuxIntegration() {
    const home = process.env.HOME;
    if (!home) throw new Error('HOME não definido no Linux.');

    // 1. Nautilus / File Manager script (equivalente ao Send To)
    const nautilusScriptsDir = path.join(home, '.local', 'share', 'nautilus', 'scripts');
    fs.mkdirSync(nautilusScriptsDir, { recursive: true });

    const scriptPath = path.join(nautilusScriptsDir, 'Converter com LiteParse');
    const scriptContent = `#!/bin/bash\n${this.getCommandPrefix()} "$@"\n`;
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

    // 2. Desktop Entry com Ações de Contexto
    const appsDir = path.join(home, '.local', 'share', 'applications');
    fs.mkdirSync(appsDir, { recursive: true });

    const desktopPath = path.join(appsDir, 'liteparse.desktop');
    const desktopContent = `[Desktop Entry]
Name=LiteParse
Comment=Conversor Inteligente de Documentos
Exec=${this.getCommandPrefix()} %F
Terminal=false
Type=Application
MimeType=application/pdf;application/vnd.openxmlformats-officedocument.wordprocessingml.document;image/png;image/jpeg;
Categories=Office;Utility;
Actions=ConvertMD;ConvertOCR;ConvertTXT;

[Desktop Action ConvertMD]
Name=Converter para Markdown (.md)
Exec=${this.getCommandPrefix()} --express --format markdown %F

[Desktop Action ConvertOCR]
Name=Converter para Markdown com OCR (.md)
Exec=${this.getCommandPrefix()} --express --format markdown --ocr %F

[Desktop Action ConvertTXT]
Name=Converter para Texto (.txt)
Exec=${this.getCommandPrefix()} --express --format text %F
`;

    fs.writeFileSync(desktopPath, desktopContent, { mode: 0o644 });

    return {
      success: true,
      message: 'Integrações do Linux (Nautilus Scripts e .desktop) instaladas com sucesso!'
    };
  }

  uninstallLinuxIntegration() {
    const home = process.env.HOME;
    if (!home) return { success: false };

    const scriptPath = path.join(home, '.local', 'share', 'nautilus', 'scripts', 'Converter com LiteParse');
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    const desktopPath = path.join(home, '.local', 'share', 'applications', 'liteparse.desktop');
    if (fs.existsSync(desktopPath)) fs.unlinkSync(desktopPath);

    return { success: true, message: 'Integrações do Linux removidas com sucesso.' };
  }

  isLinuxIntegrationInstalled() {
    const home = process.env.HOME;
    if (!home) return false;
    const desktopPath = path.join(home, '.local', 'share', 'applications', 'liteparse.desktop');
    return fs.existsSync(desktopPath);
  }

  // ==========================================
  // STATUS GERAL
  // ==========================================
  getStatus() {
    if (this.platform === 'win32') {
      return {
        platform: 'windows',
        sendToInstalled: this.isWindowsSendToInstalled(),
        contextMenuInstalled: this.isWindowsContextMenuInstalled()
      };
    } else if (this.platform === 'linux') {
      const installed = this.isLinuxIntegrationInstalled();
      return {
        platform: 'linux',
        sendToInstalled: installed,
        contextMenuInstalled: installed
      };
    } else {
      return {
        platform: 'darwin',
        sendToInstalled: false,
        contextMenuInstalled: false
      };
    }
  }
}

module.exports = { SystemIntegration };
