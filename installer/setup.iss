; ============================================================
; vMix-Yamaha TF3 Bridge - Inno Setup Installer Script
; ============================================================

#define MyAppName      "vMix-Yamaha TF3 Bridge"
#define MyAppVersion   "1.5.0"
#define MyAppPublisher "vMix-Yamaha Bridge"
#define MyAppExeName   "vMix-Yamaha Bridge.exe"

[Setup]
AppId={{B7E4F2A1-3D8C-4F5E-9A1B-2C3D4E5F6A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\vMix-Yamaha Bridge
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=Output
OutputBaseFilename=vMix-Yamaha-Bridge-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
DisableWelcomePage=no
SetupIconFile=..\frontend\public\program-image.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
; Electron Desktop App (contains backend.exe)
Source: "..\frontend\dist_electron\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Post-install script
Source: "post-install.ps1";             DestDir: "{app}";              Flags: ignoreversion

; Project docs
Source: "..\README.md";                 DestDir: "{app}";              Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#MyAppName}";                Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{group}\{#MyAppName}";                      Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\post-install.ps1"" -InstallDir ""{app}"" -PCIP ""{code:GetPCIP}"" -YamahaIP ""{code:GetYamahaIP}"" -VMixIP ""{code:GetVMixIP}"""; \
  StatusMsg: "Configuring vMix-Yamaha Bridge..."; \
  Flags: runhidden waituntilterminated

Filename: "{app}\{#MyAppExeName}"; \
  StatusMsg: "Starting {#MyAppName}..."; \
  Flags: nowait skipifsilent

[UninstallDelete]
Type: files;          Name: "{app}\bridge.db"
Type: files;          Name: "{app}\.env"
Type: files;          Name: "{app}\bridge.log"
Type: files;          Name: "{app}\install.log"

[Code]
var
  IPPage: TInputQueryWizardPage;

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

  IPPage.Values[0] := '192.168.1.50';
  IPPage.Values[1] := '192.168.1.3';
  IPPage.Values[2] := '192.168.1.50';
end;

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

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo,
  MemoDirInfo, MemoTypeInfo, MemoComponentsInfo,
  MemoGroupInfo, MemoTasksInfo: String): String;
var
  S: String;
begin
  S := '';
  S := S + MemoDirInfo + NewLine + NewLine;
  S := S + 'Network Configuration:' + NewLine;
  S := S + Space + 'PC IP Address:      ' + IPPage.Values[0] + NewLine;
  S := S + Space + 'Yamaha TF3 IP:      ' + IPPage.Values[1] + NewLine;
  S := S + Space + 'vMix Engine IP:     ' + IPPage.Values[2] + NewLine;
  S := S + Space + 'Subnet Mask:        255.255.255.0' + NewLine;
  S := S + Space + 'Default Gateway:    192.168.1.1' + NewLine;
  S := S + NewLine;
  if MemoTasksInfo <> '' then
    S := S + MemoTasksInfo + NewLine;
  Result := S;
end;
