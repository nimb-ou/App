# Cell 004 · source event 9c4dfcf1-a921-4674-8b27-6ceb7beca11c · 2026-10-11T14:21:54.916Z
# Computing Sensitivity Analysis Results
python - <<'PY'
import sys
sys.path.insert(0,'/mnt/data/stumping_study')
import simulate_stumping as s
import numpy as np
from math import erf,sqrt

def cdf(z):return .5*(1+erf(z/sqrt(2)))
for d in [.15,.25,.35]:
  h=np.linspace(.002,.12,1000)
  # use local version
  ts=np.sqrt(6*d/(s.a_muscle_slide-s.a_drag))
  tl=np.sqrt(np.sqrt(36*d*d+1024*h*h)/s.a_lift)
  p=cdf((s.mu_deadline-tl)/s.sd_deadline)*np.array([cdf((x-s.mu_clearance)/s.sd_clearance) for x in h])
  i=p.argmax()
  print('d',d,'ts',ts*1000,'h*',h[i]*100,'lift t',tl[i]*1000,'p*',p[i], 'p slide',cdf((s.mu_deadline-ts)/s.sd_deadline))
for mean in [.28,.32,.36,.40,.44]:
  h=np.linspace(.002,.12,1000)
  tl=np.sqrt(np.sqrt(36*.25**2+1024*h*h)/s.a_lift)
  p=np.array([cdf((mean-t)/.06) for t in tl])*np.array([cdf((x-.025)/.012) for x in h])
  i=p.argmax()
  print('deadline mean',mean,'h*cm',h[i]*100,'Tms',tl[i]*1000,'p',p[i])
PY
