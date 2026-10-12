# Loss audit: Cricket Stumping Simulation

A transfer is only trustworthy if it says what it could **not** carry. This report lists everything the source dropped,
everything Baton reconstructed, and everything Baton removed on purpose (private context, secrets).

| Severity | Category | Count | Detail |
|---|---|---|---|
| HIGH | tool-outputs | 163 | The source replaced 163 tool output(s) with a placeholder (container.exec ×52, api_tool.call_tool ×52, functions.exec ×33, container.open_image ×20, web.run ×6). Results of searches, code runs and connector calls are not available. The receiving agent must re-run them if needed. |
| HIGH | tool-inputs | 81 | 81 tool call(s) have no input in the source (api_tool.call_tool ×41, functions.exec ×33, web.run ×5, q7dr546 ×2). The code or arguments they ran cannot be recovered. |
| HIGH | files-lost | 16 | 16 file(s) were created or linked but their contents are not in the source: simulate_stumping.py, stumping_recovery_lab_repo_root.zip, stumping_recovery_README.txt, stumping_recovery_research_paper.docx, stumping_recovery_research_paper.pdf, stumping_recovery_simulation_bundle.zip, stumping_research_lab.zip, stumping_research_package.zip, …. Some derived outputs can be regenerated with replay/. |
| WARN | files-stale | 3 | 3 file(s) were recovered exactly as last written, but later code changed them in ways that cannot be replayed statically: stumping_research_package/make_paper.py, stumping_study/build_paper.py, stumping_study/simulate_stumping.py. |
| WARN | citations | 3 | 3 inline citation marker(s) point to search results that the source did not include; only marker ids survive. See links for the source's URL list. |
| info | files-recovered | 13 | 13 file(s) were reconstructed byte-for-byte from the code that created them. |
| info | images | 4 | Images shown in the conversation are not included; placeholders keep their search query where available. |
| info | reasoning-depth | 47 | Reasoning is available as the summaries ChatGPT displays, not the full internal chain of thought. |

## Files

| Status | Path | Size | Versions | Notes |
|---|---|---|---|---|
| lost | `simulate_stumping.py` |  |  | replaced by cp/mv; created by code the source did not include |
| lost | `stumping_recovery_lab_repo_root.zip` |  |  | archive produced by zip; binary/derived output; regenerate with replay/ |
| lost | `stumping_recovery_README.txt` |  |  | replaced by cp/mv; created by code the source did not include |
| lost | `stumping_recovery_research_paper.docx` |  |  | replaced by cp/mv; binary/derived output; regenerate with replay/ |
| lost | `stumping_recovery_research_paper.pdf` |  |  | replaced by cp/mv; binary/derived output; regenerate with replay/ |
| lost | `stumping_recovery_simulation_bundle.zip` |  |  | archive produced by zip; binary/derived output; regenerate with replay/ |
| lost | `stumping_research_lab.zip` |  |  | archive produced by zip; binary/derived output; regenerate with replay/ |
| lost | `stumping_research_package.zip` |  |  | archive produced by zip; binary/derived output; regenerate with replay/ |
| recovered | `stumping_research_package/.github/workflows/tests.yml` | 369 B | 1 |  |
| recovered | `stumping_research_package/.gitignore` | 85 B | 1 |  |
| lost | `stumping_research_package/app.py` |  |  | created by code the source did not include |
| recovered | `stumping_research_package/CITATION.cff` | 555 B | 1 |  |
| recovered | `stumping_research_package/DATA_AND_VALIDATION.md` | 2.6 KB | 1 |  |
| recovered | `stumping_research_package/Dockerfile` | 474 B | 1 |  |
| recovered | `stumping_research_package/LICENSE` | 1.1 KB | 2 |  |
| stale | `stumping_research_package/make_paper.py` | 9.4 KB | 1 | rewritten by Python open(…, "w") |
| recovered | `stumping_research_package/paper.md` | 19.9 KB | 1 |  |
| recovered | `stumping_research_package/README.md` | 3.4 KB | 2 |  |
| recovered | `stumping_research_package/rebuild_readme.txt` | 0 B | 1 |  |
| recovered | `stumping_research_package/references.bib` | 2.3 KB | 1 |  |
| recovered | `stumping_research_package/requirements.txt` | 28 B | 1 |  |
| lost | `stumping_research_package/results/run_output.txt` |  |  | overwritten by shell redirect; created by code the source did not include |
| recovered | `stumping_research_package/simulate_stumping.py` | 6.2 KB | 1 |  |
| lost | `stumping_research_package/stumping_recovery_research_paper.docx` |  |  | binary/derived output; regenerate with replay/ |
| lost | `stumping_research_package/stumping_recovery_research_paper.pdf` |  |  | binary/derived output; regenerate with replay/ |
| lost | `stumping_research_package/VALIDATION_PROTOCOL.md` |  |  | created by code the source did not include |
| lost | `stumping_simulation_results.json` |  |  | replaced by cp/mv; created by code the source did not include |
| stale | `stumping_study/build_paper.py` | 25.7 KB | 1 | rewritten by Python open(…, "w") |
| recovered | `stumping_study/README.txt` | 1.0 KB | 1 |  |
| lost | `stumping_study/run.log` |  |  | overwritten by shell redirect; created by code the source did not include |
| stale | `stumping_study/simulate_stumping.py` | 8.8 KB | 1 | rewritten by Python open(…, "w") |
| lost | `stumping_study/stumping_recovery_research_paper.pdf` |  |  | replaced by cp/mv; binary/derived output; regenerate with replay/ |

- **recovered**: reconstructed byte for byte from the code that wrote it. Its SHA-256 is in `bundle.json`.
- **stale**: exactly the last full write, but later code modified it in a way that cannot be replayed statically.
- **lost**: the conversation created or linked it, but its contents are not in the source.
- **attached**: shipped with the source export (e.g. uploaded file with extracted text).

## Integrity

Hash chain root (SHA-256 over 379 events + 32 artifact digests): `0e489b3a871206841699f7195e270a7198f60bca19e2defbb98ffb0ec416bac6`

Run `baton verify <bundle-dir>` to recompute it. Any edit to an event or a recovered file changes the root.

## Stats

- Prompts: 8 · assistant messages: 20 · reasoning blocks: 47
- Tool calls: 133 · tool results: 163 · items the source redacted: 244
- Wall-clock span: 2h 49m
