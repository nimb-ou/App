# Test Baton on your own ChatGPT, Claude and Gemini

About 20 minutes. Use a **desktop** Chrome, Edge, Brave or Arc. Mobile browsers cannot load extensions.
If anything fails, click **Copy debug report** in the Baton panel and send it back. It contains no conversation text.

## 0. Install the extension (2 minutes)

1. Download [`extension/baton-extension.zip`](https://github.com/nimb-ou/App/raw/claude/laughing-davinci-c048d8/extension/baton-extension.zip) and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`) → switch on **Developer mode** (top right).
3. **Load unpacked** → select the unzipped `baton-extension` folder.
4. Optional: pin the Baton icon in the toolbar.

You should see a dark **BATON** button at the bottom right of chatgpt.com, claude.ai and gemini.google.com.
If not, reload the tab.

## 1. ChatGPT → Claude, no server (5 minutes)

1. In ChatGPT, run something that uses tools and makes a file, e.g. *"Write a Python script that computes the first 20 primes,
   run it, and give me the script and a CSV of the result as downloadable files."*
2. Wait until it finishes and the URL is `chatgpt.com/c/…`. Click **BATON** → **Capture this conversation**.
   - Expect: `N prompts · ≥1 tool outputs · ≥2 files`, plus the line *"A share link of this chat would keep 0 tool outputs and 0 files"*.
3. Click **Save .zip**, open it, and check `files/` (the actual `.py` and `.csv`), `HANDOFF.md`, and `TRANSCRIPT.md` (tool outputs present).
4. Click **Continue in → Claude**. A claude.ai tab opens. Within a few seconds the message box fills with the handoff and
   `HANDOFF.md` plus the files are attached. **Review, then press send.** Ask Claude to continue the work.

## 2. Claude → Gemini (3 minutes)

1. In a Claude chat (URL `claude.ai/chat/…`), ask for something with an artifact, e.g. *"Make an HTML landing page for a coffee shop."*
2. **BATON** → **Capture**. Expect the artifact under Files (e.g. `landing.html`) and the thinking/tool steps in the transcript.
3. **Continue in → Gemini**. The Gemini box fills with the handoff. File contents are pasted inline, because Gemini's uploader cannot be
   driven by scripts. Press send.

## 3. Gemini → ChatGPT (2 minutes)

1. In any Gemini chat → **BATON** → **Capture**. Gemini is captured from the page itself: visible text and code, plus the raw response
   stream if the answer was generated while the tab was open.
2. **Continue in → ChatGPT**. The ChatGPT box fills, and the bundle `.zip` plus `HANDOFF.md` are attached (ChatGPT can unzip and read it).

## 4. Inside the models with pickup codes (10 minutes, needs the relay)

1. Deploy the relay: [`docs/DEPLOY.md`](DEPLOY.md) (Cloudflare one-click). Open its home page to get the MCP URL.
2. **Claude:** Settings → Connectors → Add custom connector → paste the MCP URL. In a chat, enable the connector, do some work,
   then say: *"baton: hand this off. Include the full files."*
   - Expect: Claude calls `baton_checkpoint` and replies with a code like `BTN-7F3K-9QXA-2M4P` plus a viewer link. Open the link.
3. **ChatGPT:** Settings → Apps & Connectors → Advanced settings → **Developer mode** on → Create → paste the MCP URL, choose
   "No authentication". In a new chat, enable it from the + / Developer mode menu and say: *"baton pickup BTN-…"*
   - Expect: ChatGPT calls `baton_pickup`, then summarises the goal, state and files and continues.
   - If your plan only allows read-only connector tools, `baton_pickup` still works. To hand off *from* ChatGPT, use the extension.
4. **Gemini (no connector support):** BATON panel → **Options** → set the Relay URL (the relay's base URL, without `/mcp`). Then in the
   panel paste the code into **Pick up a handoff here** → **Insert**.
5. **Extension → relay:** after any capture, **Send to relay** returns an encrypted link. Paste it into another browser or send it to a teammate.

## What to report back

For each step: ✅ or ❌, plus for ❌ the **Copy debug report** text and what you saw. Most likely failure points:

| Symptom | Likely cause | What the report shows |
|---|---|---|
| Capture says "fell back to the page" | The site changed its internal API | `GET /backend-api/… → 4xx/5xx` |
| Capture finds 0 turns | The site changed its page structure | `DOM turns: user=0 assistant=0` |
| "Continue in" opens the tab but nothing is inserted | The composer selector changed | `composer: …=0` |
| Files missing from a ChatGPT capture | The sandbox expired (old chats) | `files-not-captured` in loss |

Each of these is a small selector or endpoint fix in `extension/src/adapters.ts`.
