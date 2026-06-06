Viewed README.md:32-79
Viewed config.py:1-78
Created .env.example

To connect your **real vMix production machine** and your **physical Yamaha TF3 mixer** to this automation bridge, you need to configure three areas: the hardware/software settings, the physical network, and the bridge configuration.

Here is your step-by-step connection guide:

### Step 1: Physical Network Verification
1. Ensure the PC running this automation bridge, the PC running vMix, and the Yamaha TF3 are all connected to the **same local area network (LAN)** (e.g., plugged into the same network switch).
2. Note the IPv4 addresses of both your vMix PC and your Yamaha TF3. *(Example: vMix is `192.168.1.100` and TF3 is `192.168.1.50`)*.

### Step 2: Configure vMix Settings
1. Open vMix and go to **Settings** (top right corner).
2. Click on the **Web Controller** tab on the left.
3. Check the box that says **Enable Web Controller**.
4. Note the port number listed (it is usually `8088`).
5. Click **OK** and restart vMix if prompted.
*(Note: vMix’s TCP API runs on port `8099` automatically as long as the Web Controller is enabled).*

### Step 3: Configure Yamaha TF3 Settings
1. On the Yamaha TF3 touch screen, press the **Gear icon (Setup)** in the top right.
2. Select **Network**.
3. Ensure the mixer is assigned a valid static IP address on your network (e.g., `192.168.1.50`). 
4. The TF3 listens for Remote Control Protocol (RCP) commands on port **`49280`** by default. No special "Enable RCP" button is required; it is always listening.

### Step 4: Point the Automation Bridge to the Hardware
You have two ways to configure the bridge to point to your real hardware:

**Method A: Using the Configuration File (Recommended for Persistence)**
1. Navigate to the `backend` folder in this project.
2. Rename the new file I just created called `.env.example` to exactly `.env`.
3. Open the `.env` file and change the IPs to match your real hardware:
   ```env
   VMIX_HOST=192.168.1.100  # Put 127.0.0.1 here if vMix is on the exact same PC
   VMIX_TCP_PORT=8099
   VMIX_HTTP_PORT=8088

   YAMAHA_HOST=192.168.1.50 # Put your real mixer IP here
   YAMAHA_PORT=49280
   ```
4. Restart your backend server (`uvicorn app.main:app`).

**Method B: Using the Live Web Dashboard**
1. Open the automation dashboard in your browser (`http://127.0.0.1:5173`).
2. Click the **Config** button in the top right corner.
3. Enter your real vMix IP and Yamaha TF3 IP into the modal.
4. Click **Save Settings**. 
*(Note: If you use the dashboard method, you still need to restart the backend Python terminal right afterward so the persistent socket loops can bind to the new target IPs).*

### Step 5: Verify the Connection
Once your backend server restarts with the real IPs configured:
1. Look at your dashboard. The large circular status indicators for **vMix Engine** and **Yamaha TF3** should pulse **GREEN** and display **ONLINE**.
2. If you see them turn RED / OFFLINE, check the scrolling event log terminal on the dashboard. It will print the exact network error (e.g., Connection Refused or Timeout), which usually indicates a Windows Firewall blocking the port or an incorrect IP address.



## Options of yamaha cmd

Input Channels (Mics, Instruments, PC Audio)
InCh/Fader/Level: Moves the volume fader up or down.
CH: 1 to 40.
VAL: Usually 0 is Unity (0dB). Negative numbers lower it. -32768 is absolute silence (negative infinity).
InCh/Fader/On: Mutes or Unmutes the channel (the "ON" button on the mixer).
CH: 1 to 40.
VAL: 1 turns it ON (Unmuted). 0 turns it OFF (Muted).
🔊 Master Stereo Output (Main PA Speakers)
St/Fader/Level: Moves the Main Left/Right Master Fader. (CH is always 1).
St/Fader/On: Mutes or Unmutes the Main Left/Right Output. (VAL is 1 or 0).
🎧 Aux Mixes (Stage Monitors, Livestream Sends)
Mix/Fader/Level: Moves the master volume for a specific Aux Mix bus. (CH is the Mix number, 1-20).
Mix/Fader/On: Mutes/Unmutes a specific Aux Mix bus.
InCh/ToMix/On: Turns an individual input's send to a specific Aux Mix ON or OFF.
InCh/ToMix/Level: Changes the volume of a single input going into a specific Aux mix.
🎛️ DCA Groups (Grouping multiple faders)
DCA/Fader/Level: Moves the volume of a DCA group. (CH is 1 to 8).
DCA/Fader/On: Mutes an entire DCA group at once.
💾 Scenes / Snapshots
ssrecall_ex: Recalls a saved Scene from the TF3's memory.
CH: The Scene number you want to load (e.g., 5 to load Scene 05).
VAL: Leave as 0.
Common Example for vMix: If a speaker walks on stage and their camera goes live in vMix (TransitionIn), you want their microphone (Plugged into TF3 Channel 1) to automatically unmute. You would set: YAMAHA CMD: InCh/Fader/On | CH: 1 | VAL: 1

Example_2: Let's say you want vMix to automatically load Scene 5 on the Yamaha mixer whenever a specific video finishes playing (using your new OnCompletion trigger).

In the Dashboard Rule table, you would configure the row like this:

YAMAHA CMD: Select ssrecall_ex from the dropdown.
CH (Channel): 0 (This box is ignored by the backend for scenes, so just leave it at 0).
VAL (Value): 5 (This is where you type the Scene Number you want to load).
When that rule triggers, the backend takes the VAL you entered (5) and automatically converts it into the exact raw string the Yamaha requires: ssrecall_ex 5 0 0 0 0 0.

So anytime you want to recall a scene, just put the Scene Number into the VAL box!


## Feature in the future 

 Multi-Action Macros
Right now, one vMix trigger executes exactly one Yamaha command. You could build a "Macro" system where one trigger fires a sequence of commands. Example: TransitionIn on Input 5 → Unmutes Ch1, Lowers the background music on Ch 15 by -10dB, and Recalls Scene 5, all at the exact same time.

Physical Controller Support (Stream Deck / MIDI)
You could add an OSC or HTTP listener to the FastAPI backend so that it can receive commands directly from an Elgato Stream Deck or a generic MIDI controller. This would turn your middleware into a universal hub where a single button press on a Stream Deck triggers both vMix and the Yamaha mixer simultaneously.

---
### we can make the two-Way communication and auto-ducking such as below but reverse it
 Two-Way Communication (Mixer to vMix)
Currently, the system is One-Way: vMix tells Yamaha what to do. You could upgrade the backend to actively listen to the Yamaha TF3's fader movements. For example, if you physically pull a fader down on the Yamaha board, it could automatically trigger a "Fade to Black" or fade down a specific audio input inside vMix! 

Auto-Ducking (Audio-Driven Logic)
Instead of just relying on video transitions, you could poll vMix's live audio meter data. If the bridge detects that a microphone in vMix is receiving audio (someone starts speaking), it could automatically lower the volume (duck) the music channels on the Yamaha TF3, and raise them back up when they stop speaking.
---







