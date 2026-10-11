# Embedding Baton in every AI

Baton works from **inside** each assistant, so it captures what share links and exports drop (tool outputs, generated
files, the model's own state) and moves it to another assistant without downloading or uploading files.

```
 ChatGPT ──┐                                               ┌── ChatGPT
 Claude  ──┤  in-page extension  ──── tab-to-tab ─────────▶├── Claude
 Gemini  ──┤                                               ├── Gemini
 any AI  ──┤  MCP: baton_checkpoint ─▶ relay ─▶ baton_pickup├── any AI with the connector
 agents  ──┘  hooks / local MCP ─────▶ ~/.baton/store ─────└── any local agent
```

## 1. Browser extension (ChatGPT, Claude, Gemini on the web)

1. `npm run build` (or use the committed `extension/dist/`).
2. Chrome / Edge / Brave → `chrome://extensions` → Developer mode → **Load unpacked** → choose `extension/dist`.
3. Open a conversation and click **Baton** (bottom right) → **Capture this conversation**.

| Site | How it captures | What it gets that a share link does not |
|---|---|---|
| ChatGPT | The page's own conversation API with your session, plus each `sandbox:/mnt/data/…` file through the download endpoint, plus your uploads | Every tool output, `functions.exec` code, generated files (PDF, ZIP, code) **as bytes**, uploads. Capture before the sandbox expires. |
| Claude | The page's full conversation API (`render_all_tools`) | Tool calls and results, thinking, artifacts (create/update replayed into files), `create_file` outputs |
| Gemini | Rendered page plus the raw response stream observed while generating | Visible turns and code. The raw stream is kept under `files/live-streams/`. |

Then use **Copy prompt**, **Save .zip**, **Continue in → Claude / ChatGPT / Gemini** (opens the other AI, fills its
message box and attaches `HANDOFF.md` plus the files; you press send), or **Send to relay** (end-to-end encrypted by default).

Permissions: the four chat sites, the ChatGPT file host, and (only if you set one) your relay's origin.
Nothing is sent anywhere unless you click Send.

## 2. MCP: let the model checkpoint and pick up work itself

The model calls `baton_checkpoint` with what it holds in context: full file contents, tool outputs, verbatim prompts, decisions and next steps.
It returns a pickup code. In any other AI, `baton_pickup <code>` returns the handoff brief plus the files.

### Web assistants need a reachable relay

```bash
npx github:nimb-ou/App relay --port 8787            # or: docker build -t baton-relay . && docker run -p 8787:8787 baton-relay
# expose it over HTTPS (any reverse proxy, Render via render.yaml, Fly, Cloud Run…) and set BATON_PUBLIC_URL
```

| Assistant | Where to add it |
|---|---|
| **ChatGPT** | Settings → Apps & Connectors → Advanced → **Developer mode** → Create → URL `https://<relay>/mcp` (or `/mcp/<BATON_MCP_SECRET>`), auth "No authentication". Write tools (checkpoint) require a plan with developer-mode write actions. Read-only plans can still **pick up**. |
| **Claude** (web, desktop) | Settings → Connectors → **Add custom connector** → `https://<relay>/mcp` |
| **Claude Code** | `claude mcp add --transport http baton https://<relay>/mcp`, or install the plugin (local, below) |
| **Cursor / Codex / Gemini CLI / others** | Add an HTTP MCP server with the same URL |

Use it by saying *"baton: hand this off"*, then in the other assistant *"baton pickup BTN-7F3K-9QXA-2M4P"*.
The relay also serves `https://<relay>/h/<code>` (viewer) and `/h/<code>.zip`.

Relay settings: `BATON_PUBLIC_URL`, `BATON_MCP_SECRET` (serve MCP only at `/mcp/<secret>`), `BATON_RELAY_TOKEN`
(bearer for REST uploads), `BATON_TTL_DAYS` (default 7), `BATON_MAX_BYTES` (default 25 MB), `BATON_STORE`.

### Local agents need no server

Any stdio MCP client can run `npx -y github:nimb-ou/App mcp`. Every local agent then shares `~/.baton/store`, so
Claude Desktop → Cursor → Claude Code handoffs work offline. Set `BATON_RELAY_URL` to point them at a hub instead.

```json
{ "mcpServers": { "baton": { "command": "npx", "args": ["-y", "github:nimb-ou/App", "mcp"] } } }
```

## 3. Claude Code plugin: automatic capture

`/plugin marketplace add nimb-ou/App` → `/plugin install baton@baton` gives you:
- the **baton** skill, plus `/baton:import` and `/baton:handoff`
- the MCP server (file tools plus checkpoint and pickup)
- **hooks**: on `PreCompact` and `SessionEnd`, the full transcript is bundled into `.baton/sessions/<time>-<event>-<id>/`
  **before compaction discards it**. Set `BATON_AUTO_SEND=1` and `BATON_RELAY_URL` to also send each snapshot.

## 4. Terminal

```bash
baton send handoffs/my-work --relay https://<relay> --seal   # → https://<relay>/h/BTN-…#key
baton pickup "https://<relay>/h/BTN-…#key"                  # → handoffs/BTN-…/HANDOFF.md
```

## Security model

- Pickup codes are 60-bit capability tokens, so treat them like a link to a private doc. Handoffs expire (7 days by default).
- **Sealed** uploads (extension and CLI `--seal`) are AES-GCM encrypted in the sender's browser or terminal. The key exists only
  in the link's `#fragment`, which browsers never send to servers. The relay stores ciphertext only.
- MCP checkpoints cannot be sealed, because the model sends plaintext to the server. Self-host the relay, or use the local store.
- Redaction (keys, tokens, emails, phones) runs before anything leaves the capture point.
