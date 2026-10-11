# Journal 09: Baton becomes a product (brand, site, one-click flow)

Prompt 008: "improve it drastically… a product, UI UX, website, brand identity, much easier."

## What "much easier" became

| Before (journal 08) | Now |
|---|---|
| Click bookmark → a Baton page → click "Continue in Claude" | Click bookmark → **pick Claude** in a small panel on the chat page → **Claude opens with the prompt filled in** |
| Desktop only | **Paste box** on the home page: select all in any AI app, copy, paste (phones). Also takes ChatGPT/Claude export files, with a picker for exports with many chats. |
| Link lives 7 days, no control | **Delete it now** from the browser that made it (one HttpOnly cookie holding a delete key; the server stores only its SHA-256) |
| Bare utility pages | A full site: landing page, live demo, privacy page, branded errors, social card, icons, light and dark themes |

### The in-page chooser (bookmarklet v2)

- Starts reading the chat **immediately**, so it's usually ready before you pick. The status line says what was found
  ("Full conversation, including tool outputs" / "2 messages (visible text)") and **"Nothing is sent until you choose."**
- It's built in a **closed shadow root** with `createElement` and CSSOM styles only, so host-page CSS can't break it and
  Gemini's Trusted Types and `style-src` rules don't block it.
- On a choice, it opens the new tab **synchronously** (keeps the click's user activation), shows "Baton is packing your chat…" in it,
  then sends the capture by form POST (or postMessage on Gemini, see journal 08). The relay answers with a redirect:
  - **Claude** → `https://claude.ai/new?q=<prompt + link>`
  - **ChatGPT** → `https://chatgpt.com/?q=<prompt + link>`
  - **Gemini** → the handoff page with a one-tap "Copy & open Gemini" step (Gemini has no prefill URL, and clipboard writes need a click)
  - **Link** → the handoff page with the link copied

### Paste parser (`src/parsers/pasted.ts`)

Built from **real select-all copies** saved as fixtures (`fixtures/pasted/`): ChatGPT's `You said:` / `ChatGPT said:`,
and Gemini's `You said <prompt>` followed by a duplicate line, then `Gemini said`. It strips app chrome ("Sign in",
"Gemini is AI and can make mistakes", "Sources"…), falls back to `User:` / `Assistant:` labels, then to one unlabelled block.

## Brand

See [docs/brand/BRAND.md](../brand/BRAND.md). In short: the mark is a baton mid-pass at −38° with motion strokes. Colours are warm
paper `#F5F2EA`, ink `#121314` and one signal orange `#FF5A1F`. There are no web fonts or third-party requests. The voice is plain,
calm and honest about loss. Destinations get neutral colour dots, never vendor logos.

## Real tests (live relay, real sites, no mocks)

| Test | Result |
|---|---|
| Real ChatGPT share page → bookmark → chooser → **Claude** | ✅ landed on `claude.ai/new?q=…` with the prompt and link `BTN-2X72-V07W-CHS2` |
| Real Gemini chat (typed signed-out) → chooser → **Gemini** | ✅ popup path → handoff page with the "One more tap for Gemini" step |
| Real Gemini chat → chooser → **ChatGPT** | ✅ landed on `chatgpt.com/?q=…` with link `BTN-Z4P5-8T25-1WAB` |
| Live site at phone size: paste a real ChatGPT copy → link → **Delete it now** | ✅ created, owner delete offered, deleted, link returns 404 |
| Real AI fetcher (WebFetch) opens the new handoff page | ✅ restated the goal, where it stopped, the latest instruction, the inlined files and the missing list |
| Pages at 1440 / 390 px, light and dark | ✅ no console errors, no horizontal overflow (screens in `docs/brand/screens/`) |

Bugs found in review: the brand-asset script broke its own `style` attribute with nested quotes, so the card rendered in a
fallback serif (fixed). `display: revert` broke the mobile pill button (fixed). The hero illustration started its loop empty
(offset with a negative delay). The dark-mode logo tile vanished on the dark background (hairline ring added).

**Still needs the owner's logins:** signed-in `chatgpt.com/c/…` and `claude.ai/chat/…` captures, whether the receiving
ChatGPT or Claude actually opens the link from the pre-filled prompt (it depends on the account's browsing/web-fetch setting),
and a real drag to a real bookmarks bar.
