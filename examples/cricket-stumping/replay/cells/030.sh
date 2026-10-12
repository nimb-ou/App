# Cell 030 · source event 7401022a-df60-4d42-844e-b9af34796edb · 2026-10-11T14:53:29.027Z
# 
python - <<'PY'
from pypdf import PdfReader
p='/mnt/data/stumping_research_package/stumping_recovery_research_paper.pdf'
r=PdfReader(p)
for n,page in enumerate(r.pages[:3]):
 t=page.extract_text() or ''
 print('\nPAGE',n+1,'\n',t[:2600])
PY
