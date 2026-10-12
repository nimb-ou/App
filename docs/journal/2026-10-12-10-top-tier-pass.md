# Journal 10: the top-tier pass

Prompt 009. The question asked of every surface: *what makes someone fail on the first try, and can we remove it without adding a step?*

## 1. The next AI no longer has to open the link

Before, the pre-filled prompt was just a link, so a ChatGPT or Claude with browsing off would get nothing.
Measured for real:

- `chatgpt.com/?q=` with a **12,000-character** prompt: real Chromium showed all of it in ChatGPT's composer (`12024` chars).
- Both chatgpt.com and claude.ai accept request URLs up to ~40K characters at their edge (80K drops the connection).
  claude.ai's composer could not be checked from the test browser (bot check).

So the prompt now **carries the work itself** (the goal, the latest instruction, where it stopped, open threads when the last
reply was cut, the files that came across, and what didn't transfer), capped at 5,000 characters, plus the link for everything else
(`continuePrompt` in `src/relay/linkpage.ts`). The demo chat's prompt is 2,350 characters.
"Copy for any AI" and the Gemini step now copy the **full brief** (up to 60K characters) instead of a link.

Real check: practice page → bookmark → key **2** → real chatgpt.com opened with 1,473 characters in its composer, starting with `GOAL (my first message)`.

## 2. Onboarding that ends in "it works"

- Clicking the bookmark button instead of dragging it now opens an **install sheet**: an animated drag into a bookmarks bar,
  the platform's shortcut (⌘ or Ctrl), the button again, and **Try it on a practice chat**.
- **`/try`**: the first turns of the real demo chat, marked up the way ChatGPT marks turns, so the real bookmark captures it
  exactly as on chatgpt.com. When the Baton panel appears, the coach bar turns green: "It works. That panel is Baton."
  Real check: done with the real bookmark code served by the live home page.

## 3. Faster for people who do this every day

- The chooser focuses its first option, and **1–4 picks a destination** (ignored while typing in a text field).
- On the AI you're already in, that option reads **"(fresh chat)"**, for when a chat hits its context limit.
- Old bookmarks still work. Their link page says a newer bookmark exists (`?upd=1`).

Real check: the real Gemini page showed "Gemini (fresh chat)" and the key hints, and Claude opened with the compact brief.

## 4. Fewer dead ends

- Pasting a share link (ChatGPT, Claude, Gemini) explains why a server can't open it and what to do instead.
- Installable web app (manifest, 512px icon) that opens straight to the paste box on phones.
- Security headers on site pages: HSTS, Permissions-Policy, COOP; JSON-LD on the home page.

## 5. Chrome Web Store, ready to submit

- The extension carries the brand: icons at 16, 32, 48 and 128 px, a dark ink panel, and a round mark button.
  The buttons read **Copy for any AI**, **Get a link** and **Save .zip**. The options page is restyled.
- It works out of the box: the public server is the default, so **Get a link** needs no setup.
  End-to-end encryption is now opt-in, because encrypted links can't be read by the AI they're sent to.
- **New: shared ChatGPT chats** (`/share/…`) can be captured. Before, the extension refused them.
- `docs/store/CHROME_WEB_STORE.md`: listing copy, permission justifications, data disclosures, privacy URL.
  The screenshots are real captures, and the promo tiles are generated.

Real checks: the branded extension in Chromium on the real shared ChatGPT chat captured 8 prompts and rebuilt 13 files (16 listed as lost).
**Get a link** created `BTN-YKF3-G44M-JEQP` on the live server, and its `.md` served the brief. `npm run test:e2e` passes.

## 6. Open items closed

- `main` branch created from the first commit (shared with Codex PR nimb-ou/App#1), and this work opened as a draft PR against it.
- Version 0.4.0 across the package, plugin, extension and server.

## Still needs the owner

- **$5 Chrome Web Store registration and upload** (everything else is in `docs/store/`).
- Signed-in `chatgpt.com/c/…` and `claude.ai/chat/…` captures, and claude.ai's composer with a long `?q=`.
- Decide on Codex PR nimb-ou/App#1 (an earlier, parallel MVP that this work supersedes).
- Roll the Cloudflare token. A custom domain would make links look trustworthy (the workers.dev address works but looks temporary).
