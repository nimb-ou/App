# Replay kit

The source conversation ran **52 code cell(s)** in its own sandbox. The source did not include their
outputs: tool results were redacted, and files could not be downloaded. These cells are the exact code that ran, in order.
Re-running them in a sandbox you control can regenerate derived outputs such as PDFs, figures and archives.

```bash
# 1. Read every cell first. This is third-party code.
ls cells/ && less cells/*.sh
# 2. Run in an isolated container (no network by default)
BATON_REPLAY_NETWORK=bridge BATON_REPLAY_SETUP="pip install numpy matplotlib python-docx reportlab pypdf" ./run-in-docker.sh
# 3. Outputs land in ./workdir (mounted at /mnt/data inside the container)
```

Known limits:
- Cells that call vendor-internal helpers (for example `/home/oai/skills/...`) will fail outside the vendor sandbox.
- Cells whose input the source blanked (for example ChatGPT `functions.exec`) are not here. Files they made are listed as **lost** in `LOSS_AUDIT.md`.
- Baton never runs these cells itself.
