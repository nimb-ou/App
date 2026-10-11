# Cell 044 · source event fd4f23a3-abb4-4aca-aa1c-df07e44dc0b7 · 2026-10-11T16:54:33.831Z
# 
cat > /mnt/data/stumping_research_package/README.md <<'EOF'
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
EOF
cat > /mnt/data/stumping_research_package/Dockerfile <<'EOF'
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8501/_stcore/health', timeout=3)" || exit 1
CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501", "--server.headless=true"]
EOF
cat > /mnt/data/stumping_research_package/.gitignore <<'EOF'
.venv/
venv/
__pycache__/
*.py[cod]
.pytest_cache/
.streamlit/secrets.toml
.DS_Store
EOF
cat > /mnt/data/stumping_research_package/LICENSE <<'EOF'
MIT License

Copyright (c) 2026 Stumping Recovery Lab contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
cat > /mnt/data/stumping_research_package/CITATION.cff <<'EOF'
cff-version: 1.2.0
message: "If you use this research prototype, cite the repository version you used."
title: "Stumping Recovery Lab: A Deadline-Constrained Foot-Recovery Model"
type: software
version: 0.1.0
date-released: 2026-10-11
abstract: >-
  An interactive hypothesis-generating model comparing slide/drag and
  lift-and-plant foot-recovery strategies during cricket stumping recovery.
  Outputs are conditional on synthetic assumptions and require empirical
  validation; this software is not peer-reviewed or a validated predictor.
license: MIT
EOF
cd /mnt/data/stumping_research_package && python -m py_compile app.py stumping_model.py simulate_stumping.py && pytest -q
