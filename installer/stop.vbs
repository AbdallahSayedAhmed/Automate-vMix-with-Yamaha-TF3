' ============================================================
'  stop.vbs
'  Stops the Automate vMix Yamaha TF3 background processes.
'  Place in Start Menu as "Stop Automate vMix Yamaha TF3"
' ============================================================

Dim fso, WshShell, appDir, pidFile
Set fso      = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

appDir  = fso.GetParentFolderName(WScript.ScriptFullName)
pidFile = appDir & "\.launcher.pids"

Dim stopped
stopped = False

' ── Method 1: Kill by saved PIDs (cleanest) ─────────────────
If fso.FileExists(pidFile) Then
    Dim f, content, pids, pid
    Set f   = fso.OpenTextFile(pidFile, 1)
    content = f.ReadAll()
    f.Close

    ' Strip JSON brackets and split by comma
    content = Replace(content, "[", "")
    content = Replace(content, "]", "")
    pids = Split(content, ",")

    For Each pid In pids
        pid = Trim(pid)
        If pid <> "" And IsNumeric(pid) Then
            WshShell.Run "taskkill /PID " & pid & " /F /T", 0, True
        End If
    Next

    fso.DeleteFile pidFile
    stopped = True
End If

' ── Method 2: Fallback — kill all node.exe processes ─────────
'  (only if PID file wasn't found — avoids killing unrelated Node apps)
If Not stopped Then
    Dim answer
    answer = MsgBox("No running instance was found via PID file." & vbCrLf & vbCrLf & _
                    "Do you want to force-kill ALL node.exe processes on this machine?" & vbCrLf & _
                    "(This will affect any other Node.js apps that are running)", _
                    vbYesNo + vbExclamation, "Force Kill?")
    If answer = vbYes Then
        WshShell.Run "taskkill /IM node.exe /F", 0, True
        stopped = True
    End If
End If

If stopped Then
    MsgBox "Automate vMix Yamaha TF3 has been stopped.", _
           vbInformation, "Stopped"
Else
    MsgBox "Nothing was stopped.", _
           vbExclamation, "Not Running"
End If
