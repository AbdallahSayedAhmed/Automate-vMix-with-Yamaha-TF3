; ============================================================
;  installer.nsi  -  Automate vMix with Yamaha TF3
;  NSIS Installer Script  |  Version 1.0.0
; ============================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"

; ── App metadata ─────────────────────────────────────────────
!define APP_NAME      "Automate vMix Yamaha TF3"
!define APP_VERSION   "1.0.0"
!define APP_PUBLISHER "Your Name / Studio"
!define APP_URL       "https://github.com/YOUR_USERNAME/automate-vmix-yamaha-tf3"
!define STOP_EXE      "stop.vbs"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define NODE_VERSION  "20.14.0"
!define NODE_URL      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-x64.msi"

; ── Variables (network config page) ─────────────────────────
Var hDialog
Var hInfoLabel
Var hVMixIP
Var hYamahaIP
Var hSubnet
Var hGateway
Var hAdapter

Var sVMixIP
Var sYamahaIP
Var sSubnet
Var sGateway
Var sAdapter

; ── Output settings ──────────────────────────────────────────
Name             "${APP_NAME} ${APP_VERSION}"
OutFile          "AutomateVmixYamahaTF3_Setup_v${APP_VERSION}.exe"
InstallDir       "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel admin
SetCompressor     /SOLID lzma
Unicode True

; ── MUI Settings ─────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON     "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON   "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP_NAME} ${APP_VERSION} Setup"
!define MUI_WELCOMEPAGE_TEXT  "This wizard will guide you through the installation.$\n$\n  Step 1: Choose WHERE to install$\n  Step 2: Enter your IP addresses (vMix + Yamaha TF3)$\n  Step 3: Choose optional components$\n  Step 4: Installation runs automatically$\n$\nNode.js is installed automatically if missing.$\nYour computer IP will be set to the static IP you enter.$\n$\nClick Next to continue."

!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose the folder where ${APP_NAME} will be installed.$\n$\nThe default is shown below. Click Browse to pick a different location."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Install Folder:"

!define MUI_FINISHPAGE_RUN            "wscript.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS '"$INSTDIR\launcher.vbs"'
!define MUI_FINISHPAGE_RUN_TEXT       "Launch ${APP_NAME} now"
!define MUI_FINISHPAGE_SHOWREADME     "$INSTDIR\README.md"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "View README"

; ── Section descriptions ─────────────────────────────────────
LangString DESC_SecMain      ${LANG_ENGLISH} "Installs files, Node.js (if needed), all npm dependencies, writes your IP config, and sets a static IP on your adapter. Required."
LangString DESC_SecShortcut  ${LANG_ENGLISH} "Creates a one-click shortcut on your Desktop to start the app."
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Adds Start Menu entries: Start app, Stop app, and Uninstall."

; ── Pages order ──────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom pgNetConfig pgNetConfigLeave
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ════════════════════════════════════════════════════════════
;  NETWORK CONFIGURATION PAGE
; ════════════════════════════════════════════════════════════
Function pgNetConfig
    !insertmacro MUI_HEADER_TEXT \
        "Network Configuration" \
        "Set the IP addresses for this computer (vMix Engine) and the Yamaha TF3."

    nsDialogs::Create 1018
    Pop $hDialog
    ${If} $hDialog == error
        Abort
    ${EndIf}

    ; ── Auto-detect current IP ───────────────────────────
    nsExec::ExecToStack '"powershell.exe" -NoProfile -NonInteractive -Command \
        "((Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -NotLike 127.* | Where-Object IPAddress -NotLike 169.*) | Select-Object -First 1 -ExpandProperty IPAddress)"'
    Pop $0   ; exit code
    Pop $1   ; IP string

    ; ── Auto-detect adapter name ─────────────────────────
    nsExec::ExecToStack '"powershell.exe" -NoProfile -NonInteractive -Command \
        "(Get-NetAdapter | Where-Object Status -eq Up | Select-Object -First 1 -ExpandProperty Name)"'
    Pop $0   ; exit code
    Pop $2   ; adapter name

    ; Show detected values as hint ─────────────────────────
    ${NSD_CreateLabel} 0 0 100% 14u "Detected: Current IP = $1   |   Adapter = $2"
    Pop $hInfoLabel

    ; Horizontal rule ──────────────────────────────────────
    ${NSD_CreateHLine} 0 17u 100% 1u ""
    Pop $0

    ; ── vMix Engine IP (this computer) ───────────────────
    ${NSD_CreateLabel} 0 22u 56% 12u "This Computer IP  (vMix Engine):"
    Pop $0
    ${NSD_CreateText} 58% 20u 40% 12u "$1"
    Pop $hVMixIP

    ; ── Yamaha TF3 IP ────────────────────────────────────
    ${NSD_CreateLabel} 0 38u 56% 12u "Yamaha TF3  IP Address:"
    Pop $0
    ${NSD_CreateText} 58% 36u 40% 12u "192.168.0.200"
    Pop $hYamahaIP

    ; Horizontal rule ──────────────────────────────────────
    ${NSD_CreateHLine} 0 55u 100% 1u ""
    Pop $0

    ; ── Subnet ────────────────────────────────────────────
    ${NSD_CreateLabel} 0 60u 56% 12u "Subnet Mask:"
    Pop $0
    ${NSD_CreateText} 58% 58u 40% 12u "255.255.255.0"
    Pop $hSubnet

    ; ── Gateway ───────────────────────────────────────────
    ${NSD_CreateLabel} 0 76u 56% 12u "Default Gateway:"
    Pop $0
    ${NSD_CreateText} 58% 74u 40% 12u "192.168.0.1"
    Pop $hGateway

    ; ── Adapter name ──────────────────────────────────────
    ${NSD_CreateLabel} 0 92u 56% 12u "Network Adapter Name:"
    Pop $0
    ${NSD_CreateText} 58% 90u 40% 12u "$2"
    Pop $hAdapter

    ; Horizontal rule ──────────────────────────────────────
    ${NSD_CreateHLine} 0 108u 100% 1u ""
    Pop $0

    ; ── Warning note ──────────────────────────────────────
    ${NSD_CreateLabel} 0 112u 100% 26u \
        "The installer will assign a STATIC IP to your network adapter.$\nMake sure the IP addresses above match your network plan before clicking Next."
    Pop $0

    nsDialogs::Show
FunctionEnd

Function pgNetConfigLeave
    ${NSD_GetText} $hVMixIP   $sVMixIP
    ${NSD_GetText} $hYamahaIP $sYamahaIP
    ${NSD_GetText} $hSubnet   $sSubnet
    ${NSD_GetText} $hGateway  $sGateway
    ${NSD_GetText} $hAdapter  $sAdapter

    ; Validate required fields
    ${If} $sVMixIP == ""
        MessageBox MB_ICONEXCLAMATION "Please enter the computer (vMix Engine) IP address."
        Abort
    ${EndIf}
    ${If} $sYamahaIP == ""
        MessageBox MB_ICONEXCLAMATION "Please enter the Yamaha TF3 IP address."
        Abort
    ${EndIf}
    ${If} $sAdapter == ""
        MessageBox MB_ICONEXCLAMATION "Please enter the network adapter name.$\n(e.g. Ethernet, Wi-Fi, Local Area Connection)"
        Abort
    ${EndIf}

    ; Confirm summary before proceeding
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Please confirm your network configuration:$\n$\n \
        Computer IP  (vMix Engine) :  $sVMixIP$\n \
        Yamaha TF3 IP              :  $sYamahaIP$\n \
        Subnet Mask                :  $sSubnet$\n \
        Default Gateway            :  $sGateway$\n \
        Network Adapter            :  $sAdapter$\n$\n \
        The installer will SET YOUR ADAPTER TO A STATIC IP.$\n \
        Are these values correct?" \
        IDYES goNext
    Abort
    goNext:
FunctionEnd

; ════════════════════════════════════════════════════════════
;  HELPER: FIND NODE.EXE
; ════════════════════════════════════════════════════════════
Function FindNode
    ReadRegStr $0 HKLM "SOFTWARE\Node.js" "InstallPath"
    ${If} $0 != ""
        StrCpy $0 "$0\node.exe"
        ${If} ${FileExists} $0
            Return
        ${EndIf}
    ${EndIf}
    nsExec::ExecToStack '"cmd.exe" /c "where node 2>nul"'
    Pop $1
    Pop $0
    ${If} $1 == 0
        Return
    ${EndIf}
    StrCpy $0 ""
FunctionEnd

; ════════════════════════════════════════════════════════════
;  SECTION 1 — MAIN APPLICATION (required)
; ════════════════════════════════════════════════════════════
Section "Main Application (required)" SecMain
    SectionIn RO

    ; ── 1. Node.js ───────────────────────────────────────
    DetailPrint ">>> Step 1/6: Checking Node.js..."
    Call FindNode
    ${If} $0 == ""
        DetailPrint "Node.js not found. Downloading v${NODE_VERSION}..."
        SetDetailsPrint listonly
        nsExec::ExecToLog '"powershell.exe" -NoProfile -NonInteractive -Command "Invoke-WebRequest -Uri ''${NODE_URL}'' -OutFile ''$TEMP\nodejs_setup.msi'' -UseBasicParsing"'
        Pop $1
        ${If} $1 != 0
            MessageBox MB_ICONSTOP "Failed to download Node.js.$\nCheck your internet connection and try again.$\nOr install manually from https://nodejs.org"
            Abort
        ${EndIf}
        DetailPrint "Installing Node.js silently..."
        ExecWait '"msiexec.exe" /i "$TEMP\nodejs_setup.msi" /quiet /norestart ADDLOCAL="NodeRuntime,npm,NodePATH"' $1
        Delete "$TEMP\nodejs_setup.msi"
        ${If} $1 != 0
            MessageBox MB_ICONSTOP "Node.js installation failed (code: $1).$\nPlease install Node.js v${NODE_VERSION} manually and re-run this installer."
            Abort
        ${EndIf}
        SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
        DetailPrint "Node.js installed successfully."
        SetDetailsPrint both
    ${Else}
        DetailPrint "Node.js already installed: $0"
    ${EndIf}

    ; ── 2. Copy project files ────────────────────────────
    DetailPrint ">>> Step 2/6: Copying application files to $INSTDIR..."
    SetOutPath "$INSTDIR"
    File /r /x "node_modules" /x ".git" /x "*.nsi" /x "build-installer.ps1" /x "setup-github.ps1" ".\*"
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\config"
    DetailPrint "Files copied."

    ; ── 3. npm install ───────────────────────────────────
    DetailPrint ">>> Step 3/6: Running npm install..."
    SetDetailsPrint listonly
    nsExec::ExecToLog '"cmd.exe" /c "cd /d "$INSTDIR" && npm install --production 2>&1"'
    Pop $1
    SetDetailsPrint both
    ${If} $1 != 0
        MessageBox MB_ICONEXCLAMATION "npm install finished with warnings (code: $1).$\nThe app may still work. Check $INSTDIR\logs for details."
    ${Else}
        DetailPrint "npm install completed successfully."
    ${EndIf}

    ; ── 4. Write .env config ─────────────────────────────
    DetailPrint ">>> Step 4/6: Writing configuration files..."
    FileOpen  $9 "$INSTDIR\.env" w
    FileWrite $9 "# Automate vMix Yamaha TF3 - Auto-generated by installer$\r$\n"
    FileWrite $9 "$\r$\n"
    FileWrite $9 "# ----- vMix Engine (this computer) -----$\r$\n"
    FileWrite $9 "VMIX_HOST=$sVMixIP$\r$\n"
    FileWrite $9 "VMIX_PORT=8099$\r$\n"
    FileWrite $9 "$\r$\n"
    FileWrite $9 "# ----- Yamaha TF3 Mixer -----$\r$\n"
    FileWrite $9 "TF3_HOST=$sYamahaIP$\r$\n"
    FileWrite $9 "TF3_PORT=49280$\r$\n"
    FileWrite $9 "$\r$\n"
    FileWrite $9 "# ----- Dashboard -----$\r$\n"
    FileWrite $9 "DASHBOARD_URL=http://localhost:5173$\r$\n"
    FileClose $9
    DetailPrint ".env written."

    ; Write config/settings.json
    FileOpen  $9 "$INSTDIR\config\settings.json" w
    FileWrite $9 "{$\r$\n"
    FileWrite $9 "  $\"vmix$\": {$\r$\n"
    FileWrite $9 "    $\"host$\": $\"$sVMixIP$\",$\r$\n"
    FileWrite $9 "    $\"port$\": 8099$\r$\n"
    FileWrite $9 "  },$\r$\n"
    FileWrite $9 "  $\"yamaha$\": {$\r$\n"
    FileWrite $9 "    $\"host$\": $\"$sYamahaIP$\",$\r$\n"
    FileWrite $9 "    $\"port$\": 49280$\r$\n"
    FileWrite $9 "  },$\r$\n"
    FileWrite $9 "  $\"network$\": {$\r$\n"
    FileWrite $9 "    $\"adapter$\": $\"$sAdapter$\",$\r$\n"
    FileWrite $9 "    $\"vmixIp$\": $\"$sVMixIP$\",$\r$\n"
    FileWrite $9 "    $\"subnet$\": $\"$sSubnet$\",$\r$\n"
    FileWrite $9 "    $\"gateway$\": $\"$sGateway$\"$\r$\n"
    FileWrite $9 "  }$\r$\n"
    FileWrite $9 "}$\r$\n"
    FileClose $9
    DetailPrint "config/settings.json written."

    ; ── 5. Set static IP on adapter ──────────────────────
    DetailPrint ">>> Step 5/6: Setting static IP $sVMixIP on adapter $\"$sAdapter$\"..."
    nsExec::ExecToLog '"netsh.exe" interface ip set address name="$sAdapter" static $sVMixIP $sSubnet $sGateway 1'
    Pop $1
    ${If} $1 != 0
        DetailPrint "netsh returned code $1 - trying PowerShell fallback..."
        nsExec::ExecToLog '"powershell.exe" -NoProfile -Command "New-NetIPAddress -InterfaceAlias $\"$sAdapter$\" -IPAddress $sVMixIP -PrefixLength 24 -DefaultGateway $sGateway -ErrorAction SilentlyContinue"'
        Pop $1
        ${If} $1 != 0
            MessageBox MB_ICONEXCLAMATION \
                "Could not set static IP automatically.$\n$\n \
                Please set it manually in:$\n \
                Control Panel > Network > $sAdapter > IPv4 Properties$\n$\n \
                Values to enter:$\n \
                  IP Address  : $sVMixIP$\n \
                  Subnet Mask : $sSubnet$\n \
                  Gateway     : $sGateway"
        ${Else}
            DetailPrint "IP set via PowerShell successfully."
        ${EndIf}
    ${Else}
        DetailPrint "Static IP $sVMixIP set on $sAdapter successfully."
    ${EndIf}

    ; ── 6. Uninstaller + Registry ────────────────────────
    DetailPrint ">>> Step 6/6: Registering application..."
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayName"     "${APP_NAME}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayVersion"  "${APP_VERSION}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "Publisher"       "${APP_PUBLISHER}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "URLInfoAbout"    "${APP_URL}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayIcon"     "$INSTDIR\launcher.vbs"
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify"        1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair"        1
    DetailPrint "Installation complete!"

SectionEnd

; ════════════════════════════════════════════════════════════
;  SECTION 2 — DESKTOP SHORTCUT (optional)
; ════════════════════════════════════════════════════════════
Section "Desktop Shortcut" SecShortcut
    DetailPrint "Creating Desktop shortcut..."
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" \
        "wscript.exe" '"$INSTDIR\launcher.vbs"' \
        "$INSTDIR\launcher.vbs" 0
    DetailPrint "Desktop shortcut created."
SectionEnd

; ════════════════════════════════════════════════════════════
;  SECTION 3 — START MENU (optional)
; ════════════════════════════════════════════════════════════
Section "Start Menu Entry" SecStartMenu
    DetailPrint "Creating Start Menu entries..."
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Start ${APP_NAME}.lnk" \
        "wscript.exe" '"$INSTDIR\launcher.vbs"' \
        "$INSTDIR\launcher.vbs" 0
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Stop ${APP_NAME}.lnk" \
        "wscript.exe" '"$INSTDIR\${STOP_EXE}"' \
        "$INSTDIR\${STOP_EXE}" 0
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" \
        "$INSTDIR\Uninstall.exe"
    DetailPrint "Start Menu entries created."
SectionEnd

; ── Section descriptions ─────────────────────────────────────
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain}      $(DESC_SecMain)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecShortcut}  $(DESC_SecShortcut)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ════════════════════════════════════════════════════════════
;  UNINSTALL
; ════════════════════════════════════════════════════════════
Section "Uninstall"
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "This will remove ${APP_NAME} from:$\n$\n$INSTDIR$\n$\nContinue?" \
        IDYES doUninstall
    Abort

    doUninstall:
    RMDir /r "$INSTDIR"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Start ${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Stop ${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
    RMDir  "$SMPROGRAMS\${APP_NAME}"
    DeleteRegKey HKLM "${UNINSTALL_KEY}"
    MessageBox MB_ICONINFORMATION "${APP_NAME} has been uninstalled.$\n$\nNote: Node.js and your network IP were NOT changed."
SectionEnd
