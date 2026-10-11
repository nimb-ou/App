# Cell 021 · source event fed6ca57-d00b-4c21-9c32-11d32605f8a4 · 2026-10-11T14:44:50.463Z
# 
cat > /mnt/data/stumping_research_package/simulate_stumping.py <<'PY'
#!/usr/bin/env python3
"""Reproducible illustrative model of cricket stumping foot recovery.

No athlete-specific data are used. All baseline values are assumptions. The
simulation studies a deadline-versus-clearance trade-off and is not coaching
advice. Requires Python >=3.10, NumPy, Matplotlib.
"""
from __future__ import annotations
import json
from pathlib import Path
from math import erf, sqrt
import numpy as np
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "results"
OUT.mkdir(exist_ok=True)
SEED = 20261011
N_MC = 300_000

# SI units; deliberately illustrative and not fitted to players.
D_M = 0.25
A_SLIDE_MUSCLE = 15.0
A_SLIDE_RESISTANCE = 4.0
A_LIFT = 20.0
DEADLINE_MEAN_S = 0.360
DEADLINE_SD_S = 0.060
CLEARANCE_MEAN_M = 0.025
CLEARANCE_SD_M = 0.012
H_MIN_M, H_MAX_M, H_POINTS = 0.002, 0.120, 500


def normal_cdf(z):
    arr = np.asarray(z, dtype=float)
    out = np.vectorize(lambda v: 0.5 * (1.0 + erf(float(v) / sqrt(2.0))))(arr)
    return float(out) if out.ndim == 0 else out


def slide_time(distance_m=D_M):
    net = A_SLIDE_MUSCLE - A_SLIDE_RESISTANCE
    if net <= 0:
        return float("inf")
    return float(np.sqrt(6.0 * distance_m / net))


def lift_time(height_m, distance_m=D_M):
    h = np.asarray(height_m, dtype=float)
    return np.sqrt(np.sqrt(36.0 * distance_m**2 + 1024.0 * h**2) / A_LIFT)


def run():
    rng = np.random.default_rng(SEED)
    h = np.linspace(H_MIN_M, H_MAX_M, H_POINTS)
    ts = slide_time()
    tl = lift_time(h)
    p_slide_time = float(normal_cdf((DEADLINE_MEAN_S - ts) / DEADLINE_SD_S))
    p_lift_time = normal_cdf((DEADLINE_MEAN_S - tl) / DEADLINE_SD_S)
    p_clearance = normal_cdf((h - CLEARANCE_MEAN_M) / CLEARANCE_SD_M)
    p_lift = p_lift_time * p_clearance
    opt_i = int(np.argmax(p_lift))
    h_opt = float(h[opt_i])
    p_opt = float(p_lift[opt_i])
    t_opt = float(tl[opt_i])

    # Monte Carlo uses the same independent Gaussian assumptions as analytics.
    deadlines = rng.normal(DEADLINE_MEAN_S, DEADLINE_SD_S, N_MC)
    clearances = np.maximum(rng.normal(CLEARANCE_MEAN_M, CLEARANCE_SD_M, N_MC), 0.0)
    mc_i = np.unique(np.round(np.linspace(0, H_POINTS - 1, 60)).astype(int))
    mc_p = []
    for i in mc_i:
        mc_p.append(float(np.mean((deadlines >= tl[i]) & (clearances <= h[i]))))
    mc_p = np.asarray(mc_p)
    p_slide_mc = float(np.mean(deadlines >= ts))

    # Plot movement time against clearance.
    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    ax.plot(h * 100, tl * 1000, linewidth=2.4, label="Lift and plant")
    ax.axhline(ts * 1000, linestyle="--", linewidth=2, label="Slide / drag")
    ax.axvline(h_opt * 100, linestyle=":", linewidth=1.8, label=f"Optimal model height: {100*h_opt:.1f} cm")
    ax.set(xlabel="Peak foot clearance, h (cm)", ylabel="Movement time to grounded contact (ms)", title="Kinematic time cost of lift height (illustrative parameters)")
    ax.grid(True, alpha=.25); ax.legend(frameon=False); fig.tight_layout()
    fig.savefig(OUT / "time_vs_height.png", dpi=180); plt.close(fig)

    # Probability curve with Monte Carlo sample points.
    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    ax.plot(h*100, p_lift, linewidth=2.5, label="Lift: analytic success probability")
    ax.scatter(h[mc_i]*100, mc_p, s=20, alpha=.7, label="Lift: Monte Carlo subset")
    ax.axhline(p_slide_time, linestyle="--", linewidth=2, label=f"Slide (timing only): {p_slide_time:.2f}")
    ax.axvline(h_opt*100, linestyle=":", linewidth=1.8)
    ax.scatter([h_opt*100], [p_opt], s=55, zorder=5)
    ax.set(xlabel="Peak foot clearance, h (cm)", ylabel="Probability of safe return before wicket is broken", title="Deadline–clearance trade-off (illustrative assumptions)", ylim=(0,1))
    ax.grid(True, alpha=.25); ax.legend(frameon=False); fig.tight_layout()
    fig.savefig(OUT / "success_probability_vs_height.png", dpi=180); plt.close(fig)

    # Deterministic strategy map using optimal baseline height as reference.
    d_grid = np.linspace(.08,.45,100)
    budget_grid = np.linspace(.18,.52,100)
    DD, TT = np.meshgrid(d_grid,budget_grid)
    Ts = np.sqrt(6*DD/(A_SLIDE_MUSCLE-A_SLIDE_RESISTANCE))
    Tl = np.sqrt(np.sqrt(36*DD**2+1024*h_opt**2)/A_LIFT)
    vs, vl = Ts<=TT, Tl<=TT
    code=np.zeros_like(DD,dtype=int)
    code[vs & ~vl]=1; code[vl & ~vs]=2
    code[vs & vl & (Tl<Ts)]=2; code[vs & vl & (Ts<=Tl)]=1
    from matplotlib.colors import ListedColormap
    fig,ax=plt.subplots(figsize=(8.4,4.8))
    im=ax.pcolormesh(d_grid*100,budget_grid*1000,code,shading="auto",vmin=0,vmax=2,cmap=ListedColormap(["#dddddd","#4C78A8","#F58518"]))
    cb=fig.colorbar(im,ax=ax,ticks=[0,1,2]); cb.ax.set_yticklabels(["Neither in time","Slide preferred","Lift preferred"])
    ax.set(xlabel="Required horizontal return distance, d (cm)",ylabel="Available movement time (ms)",title=f"Deterministic strategy map at h={h_opt*100:.1f} cm")
    fig.tight_layout(); fig.savefig(OUT/"strategy_phase_diagram.png",dpi=180); plt.close(fig)

    h_95 = CLEARANCE_MEAN_M + 1.6448536269514722*CLEARANCE_SD_M
    cross_arg=((A_LIFT*ts**2)**2-36*D_M**2)/1024
    result={
      "model_status":"illustrative mathematical model; not calibrated or validated on athletes",
      "seed":SEED,"monte_carlo_trials":N_MC,
      "parameters_SI":{"return_distance_m":D_M,"slide_acceleration_budget_m_s2":A_SLIDE_MUSCLE,"sliding_resistance_penalty_m_s2":A_SLIDE_RESISTANCE,"lift_acceleration_budget_m_s2":A_LIFT,"deadline_mean_s":DEADLINE_MEAN_S,"deadline_sd_s":DEADLINE_SD_S,"clearance_demand_mean_m":CLEARANCE_MEAN_M,"clearance_demand_sd_m":CLEARANCE_SD_M},
      "slide_time_ms":ts*1000,"slide_timing_probability_analytic":p_slide_time,"slide_timing_probability_monte_carlo":p_slide_mc,
      "optimal_lift_height_cm":h_opt*100,"lift_time_at_optimum_ms":t_opt*1000,"lift_success_probability_analytic":p_opt,
      "nearest_grid_mc_success_probability":float(mc_p[np.argmin(np.abs(h[mc_i]-h_opt))]),
      "height_for_95pct_contact_safety_cm":h_95*100,"time_at_that_height_ms":float(lift_time(h_95))*1000,
      "equal_time_height_cm":float(np.sqrt(cross_arg)*100) if cross_arg>0 else None,
      "figures":["time_vs_height.png","success_probability_vs_height.png","strategy_phase_diagram.png"]}
    (OUT/"simulation_results.json").write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
    return result

if __name__=="__main__": run()
PY
python /mnt/data/stumping_research_package/simulate_stumping.py
