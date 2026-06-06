' ============================================================
'  launcher.vbs
'  Runs launcher.js completely invisibly — no CMD window at all.
'  This is what the Desktop shortcut and Start Menu point to.
'
'  To run:  wscript.exe launcher.vbs
'           (or just double-click — Windows uses wscript by default for .vbs)
' ============================================================

Dim fso, appDir, nodePath, cmd
Set fso     = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Get the folder where this .vbs file lives (the install directory)
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if already running — prevent double-launch
Dim pidFile
pidFile = appDir & "\.launcher.pids"

If fso.FileExists(pidFile) Then
    Dim answer
    answer = MsgBox("Automate vMix Yamaha TF3 appears to be already running." & vbCrLf & vbCrLf & _
                    "Do you want to restart it?", _
                    vbYesNo + vbQuestion, "Already Running")
    If answer = vbNo Then
        WScript.Quit
    End If
End If

' Build the command:  node "C:\...\launcher.js"
cmd = "node """ & appDir & "\launcher.js"""

' Run with window style 0 = hidden, bWaitOnReturn = False (fire and forget)
WshShell.Run cmd, 0, False

' Done — this script exits immediately; launcher.js keeps running hidden
