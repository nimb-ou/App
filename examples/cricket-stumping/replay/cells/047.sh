# Cell 047 · source event 986c1bdb-17e0-40db-9a1c-f7e91b600f91 · 2026-10-11T16:57:54.727Z
# 
cd /mnt/data/stumping_research_package && for f in README.md app.py stumping_model.py requirements.txt Dockerfile DATA_AND_VALIDATION.md VALIDATION_PROTOCOL.md CITATION.cff data_collection_template.csv tests/test_model.py .github/workflows/tests.yml paper.md LICENSE .gitignore simulate_stumping.py; do echo; echo "===FILE:$f==="; cat "$f"; done
