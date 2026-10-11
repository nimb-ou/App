# Stumping Recovery Lab

An interactive, reproducible **hypothesis-generating** model for comparing a slide/drag foot-recovery strategy with a lift-and-plant strategy during cricket stumping recovery.

> **Scientific status:** This is a research prototype, not peer-reviewed or experimentally validated. The outputs are conditional on user-selected assumptions and must not be interpreted as real-world success rates or coaching advice. No athlete or match data are included.

## Launch the app

### Local

Python 3.10+ is recommended.

```bash
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
streamlit run app.py
```

### Deploy publicly with Streamlit Community Cloud

1. Create a **public GitHub repository** and upload the contents of this folder to its root.
2. Visit https://share.streamlit.io/ and sign in with GitHub.
3. Choose **Create app**, select the repository and branch, and set the main file path to `app.py`.
4. Deploy. Streamlit installs packages from `requirements.txt`.

Alternative: the included `Dockerfile` can run the app on a container host.

## What is included

- `app.py` — interactive Streamlit dashboard and downloadable JSON output.
- `stumping_model.py` — model equations and simulation logic.
- `simulate_stumping.py` — original baseline simulation and figure generation.
- `paper.md`, `stumping_recovery_research_paper.pdf`, `stumping_recovery_research_paper.docx` — research-style manuscript in three formats.
- `VALIDATION_PROTOCOL.md` and `DATA_AND_VALIDATION.md` — proposed empirical validation, data dictionary and limitations.
- `data_collection_template.csv` — empty schema; it contains no observed data.
- `tests/` — automated unit tests.
- `results/` — illustrative simulation outputs.
- `CITATION.cff` — citation metadata.

## Reproduce and test

```bash
python simulate_stumping.py
pytest -q
```

The app exposes assumptions including the slide catch probability. That probability is not known from the model itself; it is an explicit sensitivity parameter. A fair strategy comparison requires measuring it or reporting results across a defensible range.

## Model limitations and research integrity

- All baseline inputs are synthetic assumptions, not measured athlete parameters.
- The selected optimum is conditional on the chosen equations and distributions; it is not a universal or validated optimal foot height.
- The current model is not a substitute for a systematic literature review, expert review, preregistration, ethics review where required, or empirical validation.
- An initial literature search found adjacent work on minimum toe clearance and cricket biomechanics, but a search cannot establish that the idea is novel or Nobel-worthy.
- Do not claim a discovery, causal effect, or real-world performance improvement until supported by independently reproducible empirical evidence.

## References and release

The manuscript contains a preliminary set of references that should be verified against publisher records before journal submission. No public GitHub repository, DOI, or hosted deployment is included in this archive yet. Once uploaded, replace this note with the canonical repository and release links.

## License

Original code and documentation are provided under the MIT License in `LICENSE`. Third-party cited works retain their respective copyrights and licenses.
