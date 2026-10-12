# Cell 006 · source event 2413e8e7-cd9e-47ef-8ac7-9c0025dfa328 · 2026-10-11T14:23:02.374Z
# 
python - <<'PY'
p='/mnt/data/stumping_study/simulate_stumping.py'
s=open(p).read()
s=s.replace("im = ax.pcolormesh(d_grid*100, budget_grid*1000, code, shading='auto', vmin=0, vmax=3,\n                       cmap=plt.matplotlib.colors.ListedColormap(['#dddddd','#4C78A8','#F58518','#72B7B2']))\n    # Use explicit colorbar labels for transparent interpretation.\n    cbar = fig.colorbar(im, ax=ax, ticks=[0,1,2,3])\n    cbar.ax.set_yticklabels(['Neither in time','Slide preferred','Lift preferred','Both (unused)'])",
"im = ax.pcolormesh(d_grid*100, budget_grid*1000, code, shading='auto', vmin=0, vmax=2,\n                       cmap=plt.matplotlib.colors.ListedColormap(['#dddddd','#4C78A8','#F58518']))\n    # Each cell labels the faster option among strategies that meet the deadline.\n    cbar = fig.colorbar(im, ax=ax, ticks=[0,1,2])\n    cbar.ax.set_yticklabels(['Neither in time','Slide preferred','Lift preferred'])")
open(p,'w').write(s)
PY
python /mnt/data/stumping_study/simulate_stumping.py >/mnt/data/stumping_study/run.log
cat /mnt/data/stumping_study/run.log
