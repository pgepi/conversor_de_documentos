!macro customHeader
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  !ifndef BUILD_UNINSTALLER
    Var Dialog
    Var Hwnd_CheckPython
    Var Hwnd_NotePython
    Var Hwnd_CheckLibreOffice
    Var Hwnd_NoteLibreOffice
    Var Hwnd_CheckContextMenu
    Var Hwnd_NoteContextMenu
    Var Hwnd_CheckSendTo

    Var PythonInstalled
    Var PythonVersionText
    Var LibreOfficeInstalled

    Var InstallPythonState
    Var InstallLibreOfficeState
    Var InstallContextMenuState
    Var InstallSendToState

    Function ComponentsPageCreate
      # Detect Python
      StrCpy $PythonInstalled "0"
      StrCpy $PythonVersionText "Nao detectado"

      ReadRegStr $0 HKCU "Software\Python\PythonCore\3.14\InstallPath" ""
      ${If} $0 != ""
        StrCpy $PythonInstalled "1"
        StrCpy $PythonVersionText "v3.14"
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ReadRegStr $0 HKLM "Software\Python\PythonCore\3.14\InstallPath" ""
        ${If} $0 != ""
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "v3.14"
        ${EndIf}
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ReadRegStr $0 HKCU "Software\Python\PythonCore\3.13\InstallPath" ""
        ${If} $0 != ""
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "v3.13"
        ${EndIf}
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ReadRegStr $0 HKLM "Software\Python\PythonCore\3.13\InstallPath" ""
        ${If} $0 != ""
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "v3.13"
        ${EndIf}
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ReadRegStr $0 HKCU "Software\Python\PythonCore\3.12\InstallPath" ""
        ${If} $0 != ""
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "v3.12"
        ${EndIf}
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ReadRegStr $0 HKLM "Software\Python\PythonCore\3.12\InstallPath" ""
        ${If} $0 != ""
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "v3.12"
        ${EndIf}
      ${EndIf}

      ${If} $PythonInstalled == "0"
        ${If} ${FileExists} "$INSTDIR\bin\python\python.exe"
          StrCpy $PythonInstalled "1"
          StrCpy $PythonVersionText "Portatil local"
        ${EndIf}
      ${EndIf}

      # Detect LibreOffice
      StrCpy $LibreOfficeInstalled "0"
      ${If} ${FileExists} "$INSTDIR\bin\libreoffice\program\soffice.exe"
        StrCpy $LibreOfficeInstalled "1"
      ${ElseIf} ${FileExists} "$INSTDIR\bin\libreoffice\App\libreoffice\program\soffice.exe"
        StrCpy $LibreOfficeInstalled "1"
      ${ElseIf} ${FileExists} "C:\Program Files\LibreOffice\program\soffice.exe"
        StrCpy $LibreOfficeInstalled "1"
      ${ElseIf} ${FileExists} "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
        StrCpy $LibreOfficeInstalled "1"
      ${EndIf}

      # Create dialog
      nsDialogs::Create 1018
      Pop $Dialog
      ${If} $Dialog == error
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "Componentes e Integracoes" "Selecione os pre-requisitos e integracoes com o Windows"

      # 1. Python
      ${If} $PythonInstalled == "1"
        ${NSD_CreateCheckbox} 0 0 300u 12u "Python 3: Detectado no sistema ($PythonVersionText) [OK]"
        Pop $Hwnd_CheckPython
        ${NSD_Check} $Hwnd_CheckPython
        EnableWindow $Hwnd_CheckPython 0
        ${NSD_CreateLabel} 12u 13u 288u 10u "O motor de conversao utilizara a instalacao existente do Python."
        Pop $Hwnd_NotePython
      ${Else}
        ${NSD_CreateCheckbox} 0 0 300u 12u "Instalar Python 3 Portatil (Obrigatorio / Recomendado)"
        Pop $Hwnd_CheckPython
        ${NSD_Check} $Hwnd_CheckPython
        ${NSD_CreateLabel} 12u 13u 288u 10u "Necessario para execucao completa das rotinas e automacoes do LiteParse."
        Pop $Hwnd_NotePython
      ${EndIf}

      # 2. LibreOffice
      ${If} $LibreOfficeInstalled == "1"
        ${NSD_CreateCheckbox} 0 28u 300u 12u "LibreOffice: Detectado no sistema / localmente [OK]"
        Pop $Hwnd_CheckLibreOffice
        ${NSD_Check} $Hwnd_CheckLibreOffice
        ${NSD_CreateLabel} 12u 41u 288u 20u "O conversor utilizara a instalacao existente para documentos legados (.doc, .xls, .ppt)."
        Pop $Hwnd_NoteLibreOffice
      ${Else}
        ${NSD_CreateCheckbox} 0 28u 300u 12u "Baixar e instalar LibreOffice Portatil (~210 MB)"
        Pop $Hwnd_CheckLibreOffice
        ${NSD_Check} $Hwnd_CheckLibreOffice
        ${NSD_CreateLabel} 12u 41u 288u 24u "Nota: Se desmarcado, a conversao de arquivos .doc, .xls e .ppt legados ficara indisponivel. Formatos modernos (.docx, .pdf, textos e imagens) funcionam sem o LibreOffice."
        Pop $Hwnd_NoteLibreOffice
      ${EndIf}

      # 3. Context Menu
      ${NSD_CreateCheckbox} 0 68u 300u 12u "Integrar ao menu de contexto do Windows ('Converter Documento (PGE)')"
      Pop $Hwnd_CheckContextMenu
      ${NSD_Check} $Hwnd_CheckContextMenu
      ${NSD_CreateLabel} 12u 81u 288u 10u "Permite clicar com botao direito em qualquer documento para conversao instantanea."
      Pop $Hwnd_NoteContextMenu

      # 4. SendTo
      ${NSD_CreateCheckbox} 0 95u 300u 12u "Adicionar atalho ao menu 'Enviar para' (SendTo) do Windows"
      Pop $Hwnd_CheckSendTo
      ${NSD_Check} $Hwnd_CheckSendTo

      nsDialogs::Show
    FunctionEnd

    Function ComponentsPageLeave
      ${NSD_GetState} $Hwnd_CheckPython $InstallPythonState
      ${NSD_GetState} $Hwnd_CheckLibreOffice $InstallLibreOfficeState
      ${NSD_GetState} $Hwnd_CheckContextMenu $InstallContextMenuState
      ${NSD_GetState} $Hwnd_CheckSendTo $InstallSendToState

      # If Python not installed on machine and user unchecked:
      ${If} $PythonInstalled == "0"
        ${If} $InstallPythonState == 0
          MessageBox MB_ICONEXCLAMATION|MB_YESNO "Atencao: O Python e um componente essencial para o funcionamento do motor de conversao.$\r$\n$\r$\nDeseja realmente continuar sem instalar o Python?" IDYES +2
          Abort
        ${EndIf}
      ${EndIf}

      # If LibreOffice not installed and user unchecked:
      ${If} $LibreOfficeInstalled == "0"
        ${If} $InstallLibreOfficeState == 0
          MessageBox MB_ICONINFORMATION|MB_YESNO "Aviso: Sem o LibreOffice Portatil, arquivos legados (.doc, .xls, .ppt) nao poderao ser convertidos nem pre-visualizados.$\r$\n(Formatos como .docx, .pdf, imagens e texto continuam funcionando normalmente).$\r$\n$\r$\nDeseja continuar a instalacao sem o LibreOffice?" IDYES +2
          Abort
        ${EndIf}
      ${EndIf}
    FunctionEnd
  !endif
!macroend

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Page custom ComponentsPageCreate ComponentsPageLeave
  !endif
!macroend

!macro customInstall
  # Context Menu
  ${If} $InstallContextMenuState == 1
    DetailPrint "Configurando menu de contexto do Windows..."
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos" "MUIVerb" "Converter Documento (PGE)"
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos" "SubCommands" ""
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"

    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\1_Markdown" "" "Converter para Markdown (.md) [Expresso]"
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\1_Markdown\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --express --format markdown "%1"'

    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\2_MarkdownOCR" "" "Converter para Markdown com OCR (.md)"
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\2_MarkdownOCR\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --express --format markdown --ocr "%1"'

    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\3_Text" "" "Converter para Texto (.txt)"
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\3_Text\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --express --format text "%1"'

    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\4_JSON" "" "Converter para JSON (.json)"
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\4_JSON\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --express --format json "%1"'

    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\5_Studio" "" "Abrir no Conversor de Documentos..."
    WriteRegStr HKCU "Software\Classes\*\shell\ConversorDocumentos\shell\5_Studio\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  ${EndIf}

  # Send To
  ${If} $InstallSendToState == 1
    DetailPrint "Configurando atalho no menu Enviar para (SendTo)..."
    CreateShortcut "$APPDATA\Microsoft\Windows\SendTo\Conversor de Documentos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}

  # Prerequisites installer script
  StrCpy $0 ""
  ${If} $InstallLibreOfficeState == 1
    ${If} $LibreOfficeInstalled == "0"
      StrCpy $0 "$0 -InstallLibreOffice"
    ${EndIf}
  ${EndIf}

  ${If} $InstallPythonState == 1
    ${If} $PythonInstalled == "0"
      StrCpy $0 "$0 -InstallPython"
    ${EndIf}
  ${EndIf}

  ${If} $0 != ""
    DetailPrint "Instalando pre-requisitos portateis selecionados..."
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer-prereqs.ps1" $0 -TargetDir "$INSTDIR"'
  ${EndIf}
!macroend

!macro customUnInstall
  DetailPrint "Removendo integracoes do sistema..."
  DeleteRegKey HKCU "Software\Classes\*\shell\ConversorDocumentos"
  Delete "$APPDATA\Microsoft\Windows\SendTo\Conversor de Documentos.lnk"
  Delete "$APPDATA\Microsoft\Windows\SendTo\Conversor de Documentos.cmd"
  Delete "$APPDATA\Microsoft\Windows\SendTo\LiteParse.cmd"
!macroend
