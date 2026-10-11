# Cell 019 · source event 304521a2-5e52-46b2-8257-3f9c081e91a8 · 2026-10-11T14:43:30.341Z
# 
python - <<'PY'
import runpy
x=runpy.run_path('/mnt/data/simulate_stumping.py')
print(x['t_slide'](), x['t_lift'](0.0429))
PY
