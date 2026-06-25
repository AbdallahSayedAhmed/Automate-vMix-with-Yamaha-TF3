Viewed post-install.ps1:1-33

To update your program in the future after making changes to the code, the process is very straightforward. Because of how the Inno Setup script is configured, your user data (like the `.env` IP settings and the SQLite database) will **not** be overwritten during an update.

Here are the exact steps to follow when you want to release an update:

### 1. Update the Version Number
Open the `installer\setup.iss` file and look near the top for this line:
```pascal
#define MyAppVersion   "1.0.0"
```
Change it to your new version number (for example, `"1.0.1"` or `"1.1.0"`).

### 2. Build the New Installer
Open PowerShell as Administrator, navigate to the `installer/` folder, and run the build script exactly as before:
```powershell
.\build-installer.ps1
```
This will compile your updated code into a new `vMix-Yamaha-Bridge-Setup.exe` inside the `Output/` folder.

### 3. Install the Update on the Target Machine
Take that new `.exe` to your production machine. Before running it, **you must stop the currently running program** so the files aren't locked:
1. Right-click the vMix-Yamaha Bridge icon in the system tray (near the clock).
2. Click **Stop & Exit**.
3. Run your new `vMix-Yamaha-Bridge-Setup.exe`.

### What happens during the update?
- The installer detects that the software is already installed.
- It will skip installing Node.js and Python (since they are already there).
- It will overwrite the old backend and frontend code files with your new edits.
- It will run `npm install` and `pip install` again, which is helpful if your update included new dependencies.
- It **will not** overwrite your `backend/.env` file or your `backend/bridge.db` database. Your saved IPs and settings will remain completely intact!