# DRM Offline Agent Hub — Windows setup

Runs fully offline on a Windows laptop. There's no internet, no cloud, and no accounts. Your agents, their memory, and chat history stay in the browser on that laptop.

## What's in the folder
| File | What it does |
|---|---|
| `start_hub.bat` | Double-click this. It starts Ollama (local AI) if installed and opens the hub. |
| `index.html`, `app.js`, `haptics.js`, `styles.css` | The hub itself (no CDN, everything is bundled). |
| `profiles.json` / `profiles.js` | The 5 starter agents (same data; the `.js` copy also works when opened as a plain file). |
| `avatars/` | Bundled avatar images. |
| `serve_hub.ps1` | Backup web server if Python isn't installed. |

## One-time install (do this on an online PC, carry it over on USB)
1. **Get Ollama for Windows:** on an online PC, download `OllamaSetup.exe` from https://ollama.com/download/windows and copy it to the USB stick.
2. **Get the model:** on the online PC, after installing Ollama, open *Command Prompt* and run
   `ollama pull llama3.2:3b`  (for 4 GB RAM laptops use `ollama pull llama3.2:1b` instead).
   Then copy the folder `C:\Users\<you>\.ollama\models` to the USB stick.
3. **On the offline laptop:** run `OllamaSetup.exe`. Then copy the `models` folder from the USB into
   `C:\Users\<you>\.ollama\` (replace the existing one if asked).
4. Check it worked: open Command Prompt and run `ollama list`. You should see `llama3.2:3b` or `llama3.2:1b`.
5. Copy this whole `drm-offline-hub` folder anywhere on the laptop (for example your Desktop).

> If the laptop does have internet once, steps 1–3 shrink to: install Ollama, run `ollama pull llama3.2:3b`.

## Every day
Double-click **`start_hub.bat`**. Your browser opens the hub at `http://localhost:8795`.
- The top pill shows **Local AI: llama3.2:3b** in green when the AI is ready.
- Red **"Ollama offline · fallback mode"** means the AI isn't running. Agents still answer with a short offline note and keep your messages saved.
- If you only installed the 1b model, open **⚙ Settings**, set Model to `llama3.2:1b`, then click Save.

### If the pill stays red while Ollama is running
The Ollama tray app may have started before the launcher and be blocking the browser. Fix it once:
1. Quit Ollama from the tray icon (by the clock).
2. Press Start and search for "Edit environment variables for your account". Add a new variable
   `OLLAMA_ORIGINS` with the value `*`.
3. Run `start_hub.bat` again.

## Using the hub
- **Tabs:** each agent is its own agency, with its own system prompt, chat history, and pinned memory. They don't share history.
- **＋ Adopt an agent:** set a name, role, agency, prompt, avatar (pick one or upload; uploads stay on the laptop), and haptic pattern, then click **Adopt agent**. Use **✎ Edit** on an agent card to change it or release it.
- **Haptics:** plug in an Xbox or PlayStation controller (USB or Bluetooth) and **press any button once** so the browser sees it. Each reply then buzzes in that agent's pattern. **▶ Buzz** on the card or **Test haptics** in Settings checks it. Android phones opening the hub also vibrate. Laptops have no vibration motor of their own. Chrome and Edge give the best controller rumble.
- **Backup:** ⚙ Settings → **Export hub (JSON)** saves everything to a file for the USB stick, and **Import** restores it.

## Starter agents (all equal peers)
| Agent | Role | Haptic |
|---|---|---|
| Klaudia | Exec Admin (DRMH) | Double tap `60,80,60` |
| SWID | Production & Promo | Heartbeat 108 BPM `120,160,60,215` |
| Jett Girlfriend | Companion (Wifi Wife), SFW | Flutter `30,40,30,40,30,40,90` |
| DRM Label Desk | Label / Rights | Long-short-long stamp `250,100,70,100,250` |
| DRM House Promo | Promo / Brand (Ava TJ) | Rising triple `40,70,80,70,140` |

Hub-wide rules are built into every prompt: Jett is the only gate, offline/local first, and no credentials or masters.
