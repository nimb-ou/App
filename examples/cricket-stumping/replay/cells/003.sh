# Cell 003 · source event af812744-7df1-471f-a290-8ee45df655ef · 2026-10-11T14:19:26.280Z
# Simulating stumping recovery strategies and optimizing clearance height
mkdir -p /mnt/data/stumping_study && cat > /mnt/data/stumping_study/simulate_stumping.py <<'PY'
#!/usr/bin/env python3
"""Reproducible toy simulation for foot recovery under a stumping deadline.

The model is deliberately transparent and illustrative. Parameters are not fitted
player-specific biomechanical measurements. Run with Python 3, numpy, matplotlib.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

OUT = Path(__file__).resolve().parent
SEED = 20261011
N_MC = 300_000

# Illustrative baseline assumptions (SI units)
d = 0.25                 # horizontal return distance to safe foot contact (m)
a_muscle_slide = 15.0    # effective max horizontal acceleration while sliding (m/s^2)
a_drag = 4.0             # effective sliding-resistance penalty (m/s^2)
a_lift = 20.0            # effective task-space acceleration budget during swing (m/s^2)
mu_deadline = 0.360       # mean movement budget after response has begun (s)
sd_deadline = 0.060       # SD of available movement budget (s)
mu_clearance = 0.025     # mean minimum clearance demand from surface/foot uncertainty (m)
sd_clearance = 0.012     # SD of clearance demand (m)
h_min, h_max, n_h = 0.002, 0.120, 500


def t_slide(distance: float = d) -> float:
    """Smooth-start/stop return time with an effective drag penalty.

    For x=d(3u^2 - 2u^3), max |x''| = 6d/T^2. Reserve a_drag of
    the available acceleration for surface resistance.
    """
    net = a_muscle_slide - a_drag
    if net <= 0:
        return float('inf')
    return float(np.sqrt(6.0 * distance / net))


def t_lift(height: np.ndarray | float, distance: float = d) -> np.ndarray | float:
    """Lift-and-plant time from a smooth 2D trajectory.

    x=d(3u^2-2u^3); z=16h*u^2*(1-u)^2. The path starts and ends at z=0
    with zero vertical velocity and reaches peak clearance h at u=1/2.
    Its maximum task-space acceleration is sqrt(36 d^2 + 1024 h^2)/T^2.
    """
    h = np.asarray(height, dtype=float)
    peak_accel_numerator = np.sqrt(36.0 * distance**2 + 1024.0 * h**2)
    return np.sqrt(peak_accel_numerator / a_lift)


def normal_cdf(z: np.ndarray | float) -> np.ndarray | float:
    # Standard library/math-free vectorized normal CDF via erf.
    from math import erf, sqrt
    arr = np.asarray(z, dtype=float)
    out = np.vectorize(lambda v: 0.5 * (1.0 + erf(float(v) / sqrt(2.0))))(arr)
    return float(out) if out.ndim == 0 else out


def main() -> None:
    rng = np.random.default_rng(SEED)
    h_grid = np.linspace(h_min, h_max, n_h)
    ts = t_slide()
    tl = t_lift(h_grid)

    # Chance of beating uncertain wicket-breaking deadline.
    p_slide_timing = normal_cdf((mu_deadline - ts) / sd_deadline)
    p_lift_timing = normal_cdf((mu_deadline - tl) / sd_deadline)
    p_clear_analytic = normal_cdf((h_grid - mu_clearance) / sd_clearance)
    p_lift_analytic = p_lift_timing * p_clear_analytic

    i_opt = int(np.argmax(p_lift_analytic))
    h_opt = float(h_grid[i_opt])
    tl_opt = float(tl[i_opt])
    p_opt = float(p_lift_analytic[i_opt])
    h_min_required_95 = float(mu_clearance + 1.6448536269514722 * sd_clearance)
    time_at_95 = float(t_lift(h_min_required_95))

    # Monte Carlo verification using same independent deadline and clearance noise.
    deadlines = rng.normal(mu_deadline, sd_deadline, N_MC)
    clearance_need = np.maximum(rng.normal(mu_clearance, sd_clearance, N_MC), 0.0)
    i_mc = np.unique(np.round(np.linspace(0, n_h - 1, 60)).astype(int))
    p_lift_mc = []
    for i in i_mc:
        h = h_grid[i]
        success = (deadlines >= float(tl[i])) & (clearance_need <= h)
        p_lift_mc.append(float(success.mean()))
    p_lift_mc = np.asarray(p_lift_mc)
    p_slide_mc = float((deadlines >= ts).mean())

    # Plot 1: movement time versus lift height and constant sliding comparator.
    fig, ax = plt.subplots(figsize=(8.3, 4.8))
    ax.plot(h_grid * 100, tl * 1000, label='Lift and plant', linewidth=2.4)
    ax.axhline(ts * 1000, linestyle='--', linewidth=2, label='Slide / drag')
    ax.axvline(h_opt * 100, linestyle=':', linewidth=1.8, label=f'Best success height: {h_opt*100:.1f} cm')
    ax.set_xlabel('Peak foot clearance, h (cm)')
    ax.set_ylabel('Movement time to grounded contact (ms)')
    ax.set_title('Kinematic time cost of lift height (illustrative baseline)')
    ax.grid(True, alpha=0.25)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(OUT / 'time_vs_height.png', dpi=180)
    plt.close(fig)

    # Plot 2: success probability under timing and terrain-clearance uncertainty.
    fig, ax = plt.subplots(figsize=(8.3, 4.8))
    ax.plot(h_grid * 100, p_lift_analytic, label='Lift: analytic probability', linewidth=2.5)
    ax.scatter(h_grid[i_mc] * 100, p_lift_mc, s=20, alpha=0.65,
               label='Lift: Monte Carlo (subset of heights)')
    ax.axhline(p_slide_timing, linestyle='--', linewidth=2,
               label=f'Slide: timing-only probability ({p_slide_timing:.2f})')
    ax.axvline(h_opt * 100, linestyle=':', linewidth=1.8)
    ax.scatter([h_opt*100], [p_opt], s=55, zorder=5)
    ax.set_xlabel('Peak foot clearance, h (cm)')
    ax.set_ylabel('Probability of safe return before wicket is broken')
    ax.set_ylim(0, 1)
    ax.set_title('Trade-off: extra clearance costs time but reduces contact risk')
    ax.grid(True, alpha=0.25)
    ax.legend(frameon=False, loc='best')
    fig.tight_layout()
    fig.savefig(OUT / 'success_probability_vs_height.png', dpi=180)
    plt.close(fig)

    # Plot 3: strategic phase diagram across return distance and available time.
    d_grid = np.linspace(0.08, 0.45, 100)
    budget_grid = np.linspace(0.18, 0.52, 100)
    DD, TT = np.meshgrid(d_grid, budget_grid)
    Ts = np.sqrt(6.0 * DD / (a_muscle_slide - a_drag))
    # Compare deterministic movement times using h*=4.2 cm fixed for phase diagram.
    h_ref = h_opt
    Tl = np.sqrt(np.sqrt(36.0 * DD**2 + 1024.0 * h_ref**2) / a_lift)
    # 0: neither meets budget; 1: slide only; 2: lift only; 3: both (faster method indicated by lift=3, slide=1)
    # Here 1=slide only or faster if both; 2=lift faster/only; 0=neither.
    viable_slide = Ts <= TT
    viable_lift = Tl <= TT
    code = np.zeros_like(DD, dtype=int)
    code[viable_slide & ~viable_lift] = 1
    code[viable_lift & ~viable_slide] = 2
    code[viable_slide & viable_lift & (Tl < Ts)] = 2
    code[viable_slide & viable_lift & (Ts <= Tl)] = 1
    fig, ax = plt.subplots(figsize=(8.3, 4.8))
    im = ax.pcolormesh(d_grid*100, budget_grid*1000, code, shading='auto', vmin=0, vmax=3,
                       cmap=plt.matplotlib.colors.ListedColormap(['#dddddd','#4C78A8','#F58518','#72B7B2']))
    # Use explicit colorbar labels for transparent interpretation.
    cbar = fig.colorbar(im, ax=ax, ticks=[0,1,2,3])
    cbar.ax.set_yticklabels(['Neither in time','Slide preferred','Lift preferred','Both (unused)'])
    ax.set_xlabel('Required horizontal return distance, d (cm)')
    ax.set_ylabel('Available movement budget (ms)')
    ax.set_title(f'Deterministic strategy map at fixed lift height h={h_ref*100:.1f} cm')
    ax.grid(False)
    fig.tight_layout()
    fig.savefig(OUT / 'strategy_phase_diagram.png', dpi=180)
    plt.close(fig)

    # Distance-specific threshold: solve equality T_lift(h)=T_slide analytically.
    # sqrt(36d^2 + 1024h^2) = a_lift * T_slide^2; after squaring:
    # h_cross^2 = ((a_lift*T_slide^2)^2 - 36d^2)/1024.
    cross_arg = ((a_lift * ts**2)**2 - 36.0*d**2) / 1024.0
    h_cross = float(np.sqrt(cross_arg)) if cross_arg > 0 else None
    results = {
        'model_type': 'illustrative kinematic model; not fitted to athlete-specific data',
        'seed': SEED,
        'monte_carlo_trials': N_MC,
        'parameters_SI': {
            'return_distance_m': d,
            'slide_max_acceleration_m_s2': a_muscle_slide,
            'effective_sliding_resistance_m_s2': a_drag,
            'lift_task_acceleration_budget_m_s2': a_lift,
            'available_time_mean_s': mu_deadline,
            'available_time_sd_s': sd_deadline,
            'clearance_demand_mean_m': mu_clearance,
            'clearance_demand_sd_m': sd_clearance,
        },
        'slide_time_ms': ts*1000,
        'slide_timing_success_probability_analytic': p_slide_timing,
        'slide_timing_success_probability_monte_carlo': p_slide_mc,
        'optimal_lift_height_cm': h_opt*100,
        'lift_time_at_optimum_ms': tl_opt*1000,
        'lift_success_probability_analytic': p_opt,
        'lift_success_probability_monte_carlo_nearest_grid': float(p_lift_mc[np.argmin(abs(h_grid[i_mc]-h_opt))]),
        'lift_time_at_clearance_for_95pct_contact_safety_ms': time_at_95*1000,
        'clearance_for_95pct_contact_safety_cm': h_min_required_95*100,
        'slide_lift_equal_time_clearance_cm': None if h_cross is None else h_cross*100,
        'figures': ['time_vs_height.png','success_probability_vs_height.png','strategy_phase_diagram.png']
    }
    (OUT / 'simulation_results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
PY
python /mnt/data/stumping_study/simulate_stumping.py
