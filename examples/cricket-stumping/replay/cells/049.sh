# Cell 049 · source event cee0f983-2bff-4eb7-b3f3-526c492a33cb · 2026-10-11T16:58:00.361Z
# 
cd /mnt/data/stumping_research_package && for f in stumping_model.py requirements.txt Dockerfile DATA_AND_VALIDATION.md VALIDATION_PROTOCOL.md CITATION.cff data_collection_template.csv tests/test_model.py .github/workflows/tests.yml; do echo "===FILE:$f==="; cat "$f"; done
