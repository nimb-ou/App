# Cell 018 · source event 9c26aa65-ca51-4884-81a5-db4be9122a0a · 2026-10-11T14:43:21.550Z
# 
python - <<'PY'
import importlib.util
for m in ['numpy','matplotlib','docx','reportlab','scipy','sympy']:
 print(m, bool(importlib.util.find_spec(m)))
PY
