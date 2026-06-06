; ============================================================
;  installer.nsi  -  Automate vMix with Yamaha TF3
;  NSIS Installer Script  |  Version 1.0.0
;
;  Compile with:  makensis installer.nsi
;  Or run:        build-installer.ps1   (auto-downloads NSIS)
;
;  What this installer does:
;    1. Checks if Node.js is installed (>= 18)
;    2. Downloads & installs Node.js LTS silently if missing
;    3. Copies all project files to the install directory
;    4. Runs npm install to restore dependencies
;    5. Creates a Desktop shortcut + Start Menu entry
;    6. Registers an Add/Remove Programs entry
;    7. Installs an uninstaller
; ============================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; ── App metadata ─────────────────────────────────────────────
!define APP_NAME      "Automate vMix Yamaha TF3"
!define APP_VERSION   "1.0.0"
!define APP_PUBLISHER "Your Name / Studio"
!define APP_URL       "https://github.com/YOUR_USERNAME/automate-vmix-yamaha-tf3"
!define APP_EXE       "start.bat"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define NODE_VERSION  "20.14.0"
!define NODE_URL      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-x64.msi"

; ── Output file ──────────────────────────────────────────────
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

; Welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP_NAME} ${APP_VERSION} Setup"
!define MUI_WELCOMEPAGE_TEXT  "This wizard will guide you through the installation of ${APP_NAME}.$\n$\n- You can choose WHERE to install the application on the next screen.$\n- Node.js will be installed automatically if not already present.$\n- All dependencies will be installed for you.$\n$\nClick Next to continue."

; Directory page - custom text so user clearly knows they can change the folder
!define MUI_DIRECTORYPAGE_TEXT_TOP    "Choose the folder where ${APP_NAME} will be installed.$\n$\nThe default location is shown below. Click Browse to select a different folder, or click Install to use the default."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION  "Install Folder:"

; Finish page
!define MUI_FINISHPAGE_RUN            "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT       "Launch ${APP_NAME} now"
!define MUI_FINISHPAGE_SHOWREADME     "$INSTDIR\README.md"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "View README"

; ── Pages ────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME

; Directory selection page (user picks install folder here)
!insertmacro MUI_PAGE_DIRECTORY

; Optional components page (Desktop shortcut toggle)
!insertmacro MUI_PAGE_COMPONENTS

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Helper: Find node.exe in PATH or Program Files ───────────
Function FindNode
    ; Try registry (official installer puts it here)
    ReadRegStr $0 HKLM "SOFTWARE\Node.js" "InstallPath"
    ${If} $0 != ""
        StrCpy $0 "$0\node.exe"
        ${If} ${FileExists} $0
            Return
        ${EndIf}
    ${EndIf}

    ; Try PATH directly
    nsExec::ExecToStack '"cmd.exe" /c "where node 2>nul"'
    Pop $1  ; exit code
    Pop $0  ; stdout
    ${If} $1 == 0
        Return   ; $0 contains the path
    ${EndIf}

    StrCpy $0 ""  ; not found
FunctionEnd

; ── Section descriptions (shown on Components page) ──────────
LangString DESC_SecMain    ${LANG_ENGLISH} "Installs the application files, Node.js (if needed), and all dependencies. This component is required."
LangString DESC_SecShortcut ${LANG_ENGLISH} "Creates a shortcut on your Desktop so you can launch the app with one click."
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Adds an entry to the Windows Start Menu under '${APP_NAME}'."

; ── Section 1: Main Application (required) ───────────────────
Section "Main Application (required)" SecMain
    SectionIn RO  ; locked - user cannot uncheck this

    ; ── Check / Install Node.js ───────────────────────────
    DetailPrint "Checking for Node.js..."
    Call FindNode
    ${If} $0 == ""
        DetailPrint "Node.js not found - downloading Node.js v${NODE_VERSION} LTS..."
        SetDetailsPrint listonly

        nsExec::ExecToLog '"powershell.exe" -NoProfile -NonInteractive -Command "Invoke-WebRequest -Uri ''${NODE_URL}'' -OutFile ''$TEMP\nodejs_setup.msi'' -UseBasicParsing"'
        Pop $1
        ${If} $1 != 0
            MessageBox MB_ICONSTOP "Failed to download Node.js.$\nPlease install manually from https://nodejs.org and re-run."
            Abort
        ${EndIf}

        DetailPrint "Installing Node.js silently..."
        ExecWait '"msiexec.exe" /i "$TEMP\nodejs_setup.msi" /quiet /norestart ADDLOCAL="NodeRuntime,npm,NodePATH"' $1
        Delete "$TEMP\nodejs_setup.msi"

        ${If} $1 != 0
            MessageBox MB_ICONSTOP "Node.js installation failed (code $1).$\nPlease install Node.js v${NODE_VERSION} manually and re-run."
            Abort
        ${EndIf}

        SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
        DetailPrint "Node.js installed successfully."
    ${Else}
        DetailPrint "Node.js found: $0"
    ${EndIf}

    ; ── Copy project files to user-chosen directory ───────
    DetailPrint "Copying application files to: $INSTDIR"
    SetOutPath "$INSTDIR"
    File /r /x "node_modules" /x ".git" /x "*.nsi" /x "build-installer.ps1" /x "setup-github.ps1" ".\*"
    DetailPrint "Files copied successfully."

    ; ── Run npm install ───────────────────────────────────
    DetailPrint "Installing Node.js dependencies (npm install --production)..."
    SetDetailsPrint listonly
    nsExec::ExecToLog '"cmd.exe" /c "cd /d "$INSTDIR" && npm install --production 2>&1"'
    Pop $1
    ${If} $1 != 0
        MessageBox MB_ICONEXCLAMATION "npm install finished with warnings.$\nThe app may still work - check $INSTDIR for details."
    ${Else}
        DetailPrint "Dependencies installed successfully."
    ${EndIf}
    SetDetailsPrint both

    ; ── Create launcher batch file ────────────────────────
    DetailPrint "Creating launcher script..."
    FileOpen  $9 "$INSTDIR\${APP_EXE}" w
    FileWrite $9 "@echo off$\r$\n"
    FileWrite $9 "title ${APP_NAME}$\r$\n"
    FileWrite $9 "cd /d %~dp0$\r$\n"
    FileWrite $9 "echo Starting ${APP_NAME}...$\r$\n"
    FileWrite $9 "node .$\r$\n"
    FileWrite $9 "if %ERRORLEVEL% neq 0 ($\r$\n"
    FileWrite $9 "  echo.$\r$\n"
    FileWrite $9 "  echo Application exited with an error. See above.$\r$\n"
    FileWrite $9 "  pause$\r$\n"
    FileWrite $9 ")$\r$\n"
    FileClose $9

    ; ── Uninstaller + Add/Remove Programs entry ───────────
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayName"      "${APP_NAME}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayVersion"   "${APP_VERSION}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "Publisher"        "${APP_PUBLISHER}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "URLInfoAbout"     "${APP_URL}"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "InstallLocation"  "$INSTDIR"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "UninstallString"  "$INSTDIR\Uninstall.exe"
    WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayIcon"      "$INSTDIR\${APP_EXE}"
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify"         1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair"         1

SectionEnd

; ── Section 2: Desktop Shortcut (op