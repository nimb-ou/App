# Cell 005 · source event c729e6e3-8b86-4d05-b047-f097e4fb70f4 · 2026-10-11T14:22:16.656Z
# 
python - <<'PY'
import sys
sys.path.insert(0,'/mnt/data/stumping_study')
import simulate_stumping as s
import numpy as np

def cdf(z): return s.normal_cdf(z)
for d in [.15,.25,.35]:
  h=np.linspace(.002,.12,1000)
  ts=np.sqrt(6*d/(s.a_muscle_slide-s.a_drag))
  tl=np.sqrt(np.sqrt(36*d*d+1024*h*h)/s.a_lift)
  p=cdf((s.mu_deadline-tl)/s.sd_deadline)*cdf((h-s.mu_clearance)/s.sd_clearance)
  i=p.argmax()
  print('d',d,'ts',ts*1000,'h*',h[i]*100,'lift t',tl[i]*1000,'p*',p[i], 'p slide',cdf((s.mu_deadline-ts)/s.sd_deadline))
for mean in [.28,.32,.36,.40,.44]:
  h=np.linspace(.002,.12,1000)
  tl=np.sqrt(np.sqrt(36*.25**2+1024*h*h)/s.a_lift)
  p=cdf((mean-tl)/.06)*cdf((h-.025)/.012)
  i=p.argmax()
  print('deadline mean',mean,'h*cm',h[i]*100,'Tms',tl[i]*1000,'p',p[i])
PY
