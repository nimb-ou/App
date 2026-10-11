# Data dictionary, validation protocol, and limitations

## Data included
There is **no observational data** in this package. `results/simulation_results.json` is generated synthetic output from stated assumptions.

## Synthetic variables

| Variable | Unit | Distribution / construction | Meaning |
|---|---|---|---|
| `deadline_s` | seconds | Normal(0.360, 0.060) | time budget until wicket event |
| `clearance_demand_m` | metres | max(Normal(0.025, 0.012), 0) | required minimum clearance under uncertainty |
| `distance_m` | metres | fixed 0.25 m in baseline | horizontal return to safe contact |
| `height_m` | metres | 500-point grid from 0.002 to 0.120 | candidate peak foot clearance |
| `lift_time_s` | seconds | derived trajectory equation | modelled time to grounded contact |
| `slide_time_s` | seconds | derived trajectory equation | modelled slide time |
| `success` | boolean | deadline and clearance inequalities | synthetic model success event |

## Quality checks to add for an empirical dataset
1. Calibrate cameras with a known-length marker and report reprojection error.
2. Verify clock synchronisation; retain raw footage and immutable event timestamps.
3. Define ground contact and wicket/bail event times before annotation.
4. Use two independent annotators and report agreement (e.g. Cohen's kappa for categorical labels and ICC/absolute error for continuous timing/clearance).
5. Separate training/validation/test by player and preferably by session, not by frames from the same action.
6. Pre-register inclusion/exclusion and missing-frame rules; do not impute outcome-critical event times without sensitivity analysis.
7. Record surface type, footwear, dominant foot, batter level, initial geometry, bat grounding, body contact and strategy.
8. Store consent and ethics documentation separately from anonymised motion data; do not publish identifiable video without explicit permissions.

## Interpretation limits
- The acceleration budgets are assumptions, not measured physiological maxima.
- The cubic/quartic path is chosen for tractability, not inferred from athletes.
- The independence of deadline and clearance is not validated.
- The Gaussian clearance model is only approximately consistent with a zero-truncated Monte Carlo variable.
- The slide strategy is not penalised for its own contact failures, so current strategy probabilities are not a fair head-to-head comparison.
- The model considers foot recovery only; a bat or another eligible grounded contact can change the cricket-law outcome.
- Monte Carlo agreement with an analytic formula validates implementation consistency only, not real-world predictive validity.
