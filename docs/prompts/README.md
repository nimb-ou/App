# Prompt log (verbatim)

These are the user's prompts for this build, copied exactly as written, typos included. Each entry records
when it arrived and how it was interpreted. The interpretation is the agent's reading; the
prompt itself is the source of truth.

| # | Received (UTC) | Prompt | Interpretation |
|---|----------------|--------|----------------|
| 001 | 2026-10-11 ~17:10 | `hi` | Greeting. Replied with repo and branch context. |
| 002 | 2026-10-11 ~17:14 | see [002-build-this.md](002-build-this.md) | Build the ChatGPT-shared idea end to end as a product. |
| 003 | 2026-10-11 ~17:20 | see [003-the-exact-problem.md](003-the-exact-problem.md) | **Reframe:** the product is the *transfer* problem itself, i.e. moving a chat, plan, prompts, reasoning, outputs and files between AI tools. |
| 004 | 2026-10-11 ~17:53 | see [004-capture-from-within.md](004-capture-from-within.md) | **Reframe 2:** embed Baton *inside* every AI (extension, MCP relay, hooks) and capture what sharing never can. |
| 005 | 2026-10-11 | `build it so that i can use it in real and test on my claude and chatgpt and gemini` | Harden the extension and relay for the real sites; write a test script for the owner. |
| 006 | 2026-10-11 | `commit eberything. like demo now. run it` → `i do not want anything mock, all reeal` | Deploy for real (Cloudflare). Never present a scripted client as a real AI. Rule saved in `CLAUDE.md`. |
| 007 | 2026-10-11 | see [007-make-it-easier.md](007-make-it-easier.md) | **Reframe 3:** remove setup. No extension, no connector: one bookmark and one link any AI can read. |

Inputs from other systems are stored under [`../../fixtures/`](../../fixtures/), and the decoded
transcript of the shared ChatGPT conversation is under [`../../examples/cricket-stumping/`](../../examples/cricket-stumping/).
