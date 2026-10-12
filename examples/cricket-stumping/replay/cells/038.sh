# Cell 038 · source event 47c10ac3-1a85-48c3-858a-a73c4127cfa9 · 2026-10-11T14:58:26.026Z
# Inspecting Research Paper Equations
python - <<'PY'
from pathlib import Path
lines=Path('/mnt/data/stumping_research_package/paper.md').read_text().splitlines()
i=0
while i<len(lines):
 l=lines[i].strip()
 if l.startswith('\\['):
  opener='\\['; closer='\\]'; e=l[len(opener):].strip(); i+=1
  while i<len(lines) and closer not in lines[i]: e+=' '+lines[i].strip(); i+=1
  if i<len(lines): e+=' '+lines[i].replace(closer,'').strip()
  print(repr(e))
 i+=1
PY
