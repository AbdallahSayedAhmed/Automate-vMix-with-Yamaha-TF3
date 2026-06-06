; ============================================================
; vMix ↔ Yamaha TF3 Bridge — Inno Setup Installer Script
; ============================================================
; Requirements: Inno Setup 6.2+ (https://jrsoftware.org/isinfo.php)
;
; Before compiling, ensure these files exist:
;   installer/deps/node-setup.msi      (Node.js LTS x64 MSI)
;   installer/deps/python-setup.exe    (Python 3.12+ amd64 installer)
;   installer/launcher.exe             (compiled from launcher.ps1)
; ============================================================

#define MyAppName      "vMix-Yamaha TF3 Bridge"
#define MyAppVersion   "1.0.0"
#define MyAppPublisher "vMix-Yamaha Bridge"
#define MyAppExeName   "launcher.exe"

[Setup]
AppId={{B7E4F2A1-3D8C-4F5E-9A1B-2C3D4E5F6A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\vMix-Yamaha Bridge
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; ── Output ──
OutputDir=Output
OutputBaseFilename=vMix-Yamaha-Bridge-Setup
Compression=lzma2
SolidCompression=yes
; ── Privileges ──
PrivilegesRequired=admin
; ── UI ──
WizardStyle=modern
DisableWelcomePage=no
; ── Misc ──
UninstallDisplayName={#MyAppName}
ArchitecturesAllowed=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

; ============================================================
; FILES
; ============================================================
[Files]
; ── Backend (Python / FastAPI) ──
Source: "..\backend\app\*";            DestDir: "{app}\backend\app";  Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "__pycache__,*.pyc"
Source: "..\backend\requirements.txt"; DestDir: "{app}\backend";      Flags: ignoreversion
Source: "..\backend\README.md";        DestDir: "{app}\backend";      Flags: ignoreversion

; ── Frontend (React / Vite) ──
Source: "..\frontend\src\*";           DestDir: "{app}\frontend\src";    Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\public\*";        DestDir: "{app}\frontend\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\index.html";      DestDir: "{app}\frontend";       Flags: ignoreversion
Source: "..\frontend\package.json";    DestDir: "{app}\frontend";       Flags: ignoreversion
Source: "..\frontend\package-lock.json"; DestDir: "{app}\frontend";     Flags: ignoreversion
Source: "..\frontend\vite.config.js";  DestDir: "{app}\frontend";       Flags: ignoreversion
Source: "..\frontend\eslint.config.js"; DestDir: "{app}\frontend";      Flags: ignoreversion

; ── Launcher & scripts ──
Source: "launcher.exe";      DestDir: "{app}"; Flags: ignoreversion
Source: "post-install.ps1";  DestDir: "{app}"; Flags: ignoreversion

; ── Project docs ──
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists(ExpandConstant('..\README.md'))

; ── Bundled dependency installers (only copied when not already installed) ──
Source: "deps\node-setup.msi";    DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall; Check: not IsNodeInstalled
Source: "deps\python-setup.exe";  DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall; Check: not IsPythonInstalled

; ============================================================
; SHORTCUTS
; ============================================================
[Icons]
Name: "{autodesktop}\{#MyAppName}";                   Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{group}\{#MyAppName}";                          Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}";    Filename: "{uninstallexe}"

; ============================================================
; POST-INSTALL EXECUTION
; ============================================================
[Run]
; Run the PowerShell post-install script (hidden, waits for completion)
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\post-install.ps1"" -InstallDir ""{app}"" -PCIP ""{code:GetPCIP}"" -YamahaIP ""{code:GetYamahaIP}"" -VMixIP ""{code:GetVMixIP}"" -NodeMsi ""{tmp}\node-setup.msi"" -PythonExe ""{tmp}\python-setup.exe"""; \
  StatusMsg: "Configuring vMix-Yamaha Bridge (installing dependencies, this may take several minutes)..."; \
  Flags: runhidden waituntilterminated

; Optional: launch the app after install
Filename: "{app}\{#MyAppExeName}"; \
  Description: "Launch {#MyAppName} now"; \
  Flags: postinstall nowait skipifsilent

; ============================================================
; UNINSTALL
; ============================================================
[UninstallDelete]
Type: filesandordirs; Name: "{app}\backend\.venv"
Type: filesandordirs; Name: "{app}\frontend\node_modules"
Type: filesandordirs; Name: "{app}\backend\bridge.db"
Type: filesandordirs; Name: "{app}\backend\.env"
Type: files;          Name: "{app}\bridge.log"
Type: files;          Name: "{app}\install.log"

; ============================================================
; PASCAL SCRIPT (custom wizard page + helper functions)
; ============================================================
[Code]
var
  IPPage: TInputQueryWizardPage;

// ── Detect Node.js ──────────────────────────────────────────
function IsNodeInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node --version', '', SW_HIDE,
                 ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

// ── Detect Python ───────────────────────────────────────────
function IsPythonInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c python --version', '', SW_HIDE,
                 ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

// ── Custom wizard page for IP configuration ─────────────────
procedure InitializeWizard;
begin
  IPPage := CreateInputQueryPage(wpSelectDir,
    'Network Configuration',
    'Configure the IP addresses for your vMix-Yamaha bridge.',
    'Enter the IP addresses below. The PC IP will be assigned to your'#13#10 +
    'Ethernet adapter (subnet: 255.255.255.0, gateway: 192.168.1.1).'#13#10 +
    ''#13#10 +
    'If vMix is running on THIS computer, use 127.0.0.1 for vMix IP.');

  IPPage.Add('PC IP Address (this computer''s Ethernet adapter):', False);
  IPPage.Add('Yamaha TF3 Mixer IP Address:', False);
  IPPage.Add('vMix Engine IP Address:', False);

  // Defaults
  IPPage.Values[0] := '192.168.1.50';
  IPPage.Values[1] := '192.168.1.3';
  IPPage.Values[2] := '192.168.1.50';
end;

// ── Getter functions for {code:...} constants ───────────────
function GetPCIP(Param: String): String;
begin
  Result := IPPage.Values[0];
end;

function GetYamahaIP(Param: String): String;
begin
  Result := IPPage.Values[1];
end;

function GetVMixIP(Param: String): String;
begin
  Result := IPPage.Values[2];
end;

// ── Validate IP page before proceeding ──────────────────────
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = IPPage.ID then
  begin
    if (Trim(IPPage.Values[0]) = '') or
       (Trim(IPPage.Values[1]) = '') or
       (Trim(IPPage.Values[2]) = '') then
    begin
      MsgBox('Please fill in all three IP address fields.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

// ── Ready-to-install summary ────────────────────────────────
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo,
  MemoDirInfo, MemoTypeInfo, MemoComponentsInfo,
  MemoGroupInfo, MemoTasksInfo: String): String;
var
  S: String;
begin
  S := '';

  // Install directory
  S := S + MemoDirInfo + NewLine + NewLine;

  // Network config
  S := S + 'Network Configuration:' + NewLine;
  S := S + Space + 'PC IP Address:      ' + IPPage.Values[0] + NewLine;
  S := S + Space + 'Yamaha TF3 IP:      ' + IPPage.Values[1] + NewLine;
  S := S + Space + 'vMix Engine IP:     ' + IPPage.Values[2] + NewLine;
  S := S + Space + 'Subnet Mask:        255.255.255.0' + NewLine;
  S := S + Space + 'Default Gateway:    192.168.1.1' + NewLine;
  S := S + NewLine;

  // Dependency status
  S := S + 'Dependencies:' + NewLine;
  if IsNodeInstalled then
    S := S + Space + 'Node.js:  Already installed (will skip)' + NewLine
  else
    S := S + Space + 'Node.js:  Will be installed' + NewLine;

  if IsPythonInstalled then
    S := S + Space + 'Python:   Already installed (will skip)' + NewLine
  else
    S := S + Space + 'Python:   Will be installed' + NewLine;

  S := S + NewLine;

  // Tasks
  if MemoTasksInfo <> '' then
    S := S + MemoTasksInfo + NewLine;

  Result := S;
end;
