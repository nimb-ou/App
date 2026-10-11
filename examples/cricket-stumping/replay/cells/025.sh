# Cell 025 · source event 41c8dcfe-c4a9-4a58-ab3e-d719bc849f72 · 2026-10-11T14:51:04.783Z
# 
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read().replace("if line.startswith('\\\\[' or line.startswith('\\\\(') or (line.startswith('x(') or line.startswith('z(') or line.startswith('T_') or line.startswith('P_') or line.startswith('A_') or line.startswith('S_l') or line.startswith('h_')):", "if line.startswith('\\\\[') or line.startswith('\\\\(') or line.startswith(('x(', 'z(', 'T_', 'P_', 'A_', 'S_l', 'h_')):")
open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py && ls -lh
