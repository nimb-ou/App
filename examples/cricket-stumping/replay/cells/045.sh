# Cell 045 · source event 853180cb-055b-4937-8ec8-d36e806ea3a4 · 2026-10-11T16:54:42.734Z
# 
mkdir -p /mnt/data/stumping_research_package/.github/workflows && cat > /mnt/data/stumping_research_package/.github/workflows/tests.yml <<'EOF'
name: Tests
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: python -m pip install -r requirements.txt
      - run: python -m py_compile app.py stumping_model.py simulate_stumping.py
      - run: pytest -q
EOF
cd /mnt/data && rm -f stumping_research_lab.zip && zip -qr stumping_research_lab.zip stumping_research_package -x '*/__pycache__/*' '*/.pytest_cache/*' '*/.DS_Store' && ls -lh /mnt/data/stumping_research_lab.zip /mnt/data/stumping_research_package/Dockerfile /mnt/data/stumping_research_package/CITATION.cff
