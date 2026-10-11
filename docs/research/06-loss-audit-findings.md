# 06: Loss audit findings: what a ChatGPT share link silently drops

*Measured on the real fixture `fixtures/chatgpt-share-cricket-stumping.html.gz`
(share `6acbc222-2500-83ee-b38c-dcfe2b46e388`, "Cricket Stumping Simulation", 2026-10-11).*

## Counts (from decoding the share payload)

| Item | Present in share | Lost / redacted |
|---|---|---|
| User prompts | **8 / 8** | none |
| Final assistant replies | 14 visible + 39 hidden "commentary" | none, but rich UI is flattened |
| Reasoning summaries (`thoughts`) | **46 blocks** | Full chain of thought was never exposed. Summaries only. |
| Executed code: `container.exec` inputs | **52 / 52** (120,715 chars) | none |
| Executed code: `functions.exec` inputs | 0 / 33 | **33 blank**. This is the code that built `app.py` and `stumping_model.py`. |
| Tool outputs, all tools | 0 / 163+ | **all redacted**: "The output of this plugin was redacted." |
| Web search results / citations | Queries only (`reasoning_titles`) | Result pages and `turn…searchN` targets are gone. `safe_urls[]` keeps a flat URL list. |
| Generated files (`sandbox:/mnt/data/...`) | Links in text | **Not downloadable from the share.** Every file link is dead for the recipient. |
| Canva design, GitHub actions | Links only | The connector outputs are redacted |

## Recoverability

Files written with heredocs inside `container.exec` (`cat > path <<'EOF' … EOF`) can be **reconstructed byte for
byte** from the code text. In this fixture that covers `simulate_stumping.py` (two versions), `build_paper.py`, `paper.md`,
`make_paper.py`, `references.bib`, `README.md`, `requirements.txt`, `LICENSE`, `DATA_AND_VALIDATION.md`,
`Dockerfile`, `.gitignore`, `CITATION.cff`, `.github/workflows/tests.yml`, `README.txt` and `run.log`.

Files later edited in place by a Python `s.replace(...)` script are recovered **at their last heredoc version and marked
`stale`**. Files whose creating code was blanked (`functions.exec`), such as `app.py`, `stumping_model.py`, the PDF and
the DOCX, are marked **`lost`**. Baton adds a *replay script* that re-runs every recovered exec cell in order inside a
sandbox you control. That can regenerate derived binaries like the PDF.

## Why this matters for the product

- The recipient of a share link sees polished prose saying *"Download the complete ZIP"*, but the ZIP does not exist for them.
  **A transfer tool that does not say what is missing misleads by omission.** The loss audit is a core feature.
- Recovering ~15 project files from a "dead" share link is a differentiator no exporter offers. It turns a
  conversation back into a **repository**.
