# Cell 023 · source event 9df66b7e-fcc7-4b64-860a-6cdc8f334daf · 2026-10-11T14:49:10.746Z
# 
cat > /mnt/data/stumping_research_package/paper.md <<'MD'
# A Deadline-Constrained Model of Foot Recovery During Cricket Stumping: A Transparent Kinematic Optimisation and Simulation Study

**Manuscript status:** Preprint-style modelling paper; not peer reviewed.  
**Author:** To be completed by the researcher before release.  
**Version:** 0.1.0 (11 October 2026)  
**Data status:** No athlete or match data were collected; all numerical parameters are illustrative assumptions.

## Abstract

A batter attempting to regain grounded contact behind the popping crease during a stumping may choose a low-clearance slide/drag or a lifted-and-planted foot recovery. These actions create a plausible trade-off between movement time and the risk of insufficient foot-ground clearance. We formulate a deliberately transparent task-space model with smooth-start/stop horizontal motion, a quartic vertical arch for the lifted strategy, an uncertain deadline, and an uncertain required clearance. For the lifted strategy, an analytic success-probability expression is maximised numerically and checked with a seeded 300,000-trial Monte Carlo simulation. Under one illustrative parameter set, the model chooses a peak clearance of 4.29 cm and predicts a model-conditional safe-return probability of 0.702; a Monte Carlo estimate at the nearest grid point is 0.702. A comparable slide has a timing-only success probability of 0.439 in the baseline, but the model does not give sliding a separate probability of catching the surface, so the two are not an empirically fair comparison. The main contribution is a reproducible hypothesis-generating framework and a validation protocol, not a validated coaching rule. A literature search found adjacent studies on minimum toe clearance, foot-ground clearance prediction, and cricket batting expertise, but does not establish priority or prove that the exact question is unpublished. Athlete-calibrated measurements and a matched strategy comparison are needed before strong practical or scientific claims are justified.

**Keywords:** cricket; stumping; foot clearance; sports biomechanics; movement optimisation; Monte Carlo; locomotion; reproducibility

## 1. Introduction

In cricket, a stumping incident can require a batter to restore a legally valid grounded position behind the popping crease before the wicket is put down. The foot's vertical trajectory and horizontal return are linked: lifting may reduce scraping or collision risk but necessarily changes the path and its kinematic cost. Sliding may minimise vertical displacement but could incur friction, surface irregularity, or catching risk. The strategy is therefore naturally expressed as constrained movement under a deadline.

Prior research already studies related ingredients. Killeen et al. examine minimum toe clearance and its relation to locomotor control [1]. Asogwa et al. investigate prediction of minimum foot-ground clearance events from toe-off kinematics [2]. Miyake et al. model toe-clearance parameters during swing [3]. Glazier et al. argue that dynamical-systems perspectives can be relevant to performance-oriented sports biomechanics [4]. In cricket, Connor et al. examine batting expertise from elite-coach perspectives [5], while Singh et al. systematically review the influence of task and environmental constraints on batting and bowling [6]. These are adjacent foundations, not direct evidence for the exact stumping-recovery problem.

This study therefore asks a narrow methodological question: can a simple, inspectable movement-time model coupled to uncertainty in deadline and required clearance generate a non-trivial candidate clearance optimum? It does not claim to reproduce the full human neuromusculoskeletal system, and it does not infer measured stumping probabilities from synthetic trials.

### 1.1 Research questions

1. How does the assumed time to regain grounded foot contact change with required horizontal return distance and peak vertical clearance?
2. Under a probabilistic deadline and clearance-risk model, can an intermediate clearance maximise the modelled success probability?
3. Which measured parameters would be needed to test whether the model describes actual batter behaviour?

### 1.2 Contributions and scope

The work contributes (i) closed-form trajectory-based movement-time expressions, (ii) a chance-constrained success objective with a numerically obtained optimum, (iii) seeded Monte Carlo checking of the analytic objective, (iv) plots and machine-readable outputs, and (v) an experimental validation protocol. All model coefficients are explicitly illustrative, so the numerical optimum should not be treated as an empirical finding.

## 2. Definitions and legal/operational scope

Let the target be a point at which some eligible part of the batter's person or bat is grounded behind the popping crease. The present calculation simplifies this to the batter's foot becoming grounded in a safe position. Real dismissals depend on the applicable Laws of Cricket and on whether a valid stumping situation exists; a foot-only kinematic model is not a complete adjudication model. A future study should define the relevant frame using synchronised wicket/bail and batter-contact events, and have the event labels reviewed by qualified cricket officials.

Variables use SI units unless indicated:

| Symbol | Definition | Baseline |
|---|---|---:|
| \(d\) | Horizontal return distance to the modelled safe-contact point | 0.25 m |
| \(h\) | Peak vertical clearance in the lifted strategy | Optimised over 0.2–12 cm |
| \(a_s\) | Effective acceleration budget for the slide | 15 m/s² |
| \(a_r\) | Effective resistance penalty for sliding | 4 m/s² |
| \(a_l\) | Effective task-space acceleration budget for lifting | 20 m/s² |
| \(\Delta\) | Available time before the deadline | Normal: mean 0.360 s, SD 0.060 s |
| \(H\) | Minimum clearance demand for avoiding contact/catching | Normal: mean 0.025 m, SD 0.012 m, truncated at zero in Monte Carlo |

The baseline numbers are not drawn from a sample of cricketers, force-plate tests, or match event timestamps. They are chosen to expose the trade-off. Conclusions depending on them are conditional, not population claims.

## 3. Methods

### 3.1 Horizontal smooth-start/stop trajectory

Use normalised time \(u=t/T\), with \(0\le u\le1\), to move horizontal distance \(d\):

\[
x(t)=d(3u^2-2u^3).
\]

Then

\[
\dot x(t)=\frac{6d}{T}u(1-u), \qquad
\ddot x(t)=\frac{6d}{T^2}(1-2u).
\]

The velocity is zero at both endpoints, and \(\max_t |\ddot x|=6d/T^2\). This cubic is a convenient boundary-condition trajectory; actual athletic motion need not follow it.

### 3.2 Sliding / dragging strategy

The reduced model assigns a constant acceleration budget \(a_s\) and a scalar effective resistance penalty \(a_r\). If \(a_s>a_r\), requiring the peak trajectory acceleration to be no more than the net budget yields

\[
\frac{6d}{T_s^2}\le a_s-a_r,\qquad
\boxed{T_s=\sqrt{\frac{6d}{a_s-a_r}}}.
\]

This is a stylised kinematic bound, not a physical friction law. It omits the foot's orientation, contact pressure distribution, shoe/pitch coefficients, torso dynamics, and the possibility that sliding itself fails to establish a safe grounded contact.

### 3.3 Lift-and-plant strategy

The vertical path is represented by a quartic arch:

\[
z(t)=16hu^2(1-u)^2.
\]

It starts and ends at ground height with zero vertical velocity and reaches peak height \(h\) at \(u=1/2\). Differentiation gives

\[
\ddot z(t)=\frac{32h}{T^2}(1-6u+6u^2).
\]

At endpoints, \(|\ddot z|=32h/T^2\); at midpoint it has magnitude \(16h/T^2\). The chosen task-space proxy combines horizontal and peak vertical acceleration scales into

\[
A_{\max}^{*}=\frac{\sqrt{36d^2+1024h^2}}{T^2}.
\]

Treating \(a_l\) as the upper task-space acceleration budget gives

\[
\boxed{T_l(h)=\sqrt{\frac{\sqrt{36d^2+1024h^2}}{a_l}}}.
\]

This combined norm is a modelling choice rather than a uniquely implied consequence of the separate coordinate constraints. A more physically grounded follow-up should specify joint angles, segment inertias, ground reaction forces and/or fit the trajectory to measured marker or pose data. The equation is retained because its assumptions are clear and it makes the height–time trade-off tractable.

### 3.4 Random deadline and clearance demand

For analytic calculations, assume independent normal variables

\[
\Delta\sim\mathcal N(\mu_\Delta,\sigma_\Delta^2),\quad
H\sim\mathcal N(\mu_H,\sigma_H^2).
\]

For a chosen height \(h\), the lifted trajectory is counted as successful if it reaches contact in time and clears the random obstacle/contact requirement:

\[
S_l(h)=\{\Delta\ge T_l(h), H\le h\}.
\]

Under independence,

\[
\boxed{P_l(h)=\Phi\!\left(\frac{\mu_\Delta-T_l(h)}{\sigma_\Delta}\right)
\Phi\!\left(\frac{h-\mu_H}{\sigma_H}\right)}.
\]

Here \(\Phi\) is the standard normal CDF. In Monte Carlo, the clearance demand is truncated at zero because a negative minimum clearance is physically meaningless. For the analytic expression, the normal tail at negative clearance is negligible for the chosen baseline; a later version should use a truncated-normal CDF consistently in both analytics and simulation.

The optimum is

\[
h^*=\operatorname*{arg\,max}_{h\in[0.002,0.12]}P_l(h),
\]

found on a 500-point grid. A continuous scalar optimiser and confidence interval should be added for confirmatory work; the grid is adequate for demonstrating the numerical method.

### 3.5 Monte Carlo verification

With NumPy's generator seed 20261011, draw 300,000 independent deadline and clearance samples. For each of 60 heights spanning the optimisation grid, compute the fraction of trials satisfying \(\Delta\ge T_l(h)\) and \(H\le h\). Compare those Monte Carlo proportions with the analytic expression at the same heights. For the slide, estimate only \(P(\Delta\ge T_s)\). This asymmetry is intentional but important: sliding is not charged a separately estimated catch/contact failure, so its comparison with lift is incomplete.

### 3.6 Strategy crossover

Equating the time expressions gives a nominal equality height, when its radicand is positive:

\[
T_l(h)=T_s\quad\Rightarrow\quad
\boxed{h_{\mathrm{cross}}=\sqrt{\frac{(a_lT_s^2)^2-36d^2}{1024}}}.
\]

The crossover compares movement times only; it is not the same as the probability-optimal clearance. If the radicand is non-positive, there is no real positive crossover under this model.

## 4. Results

### 4.1 Baseline outputs

Running `python simulate_stumping.py` gives:

| Quantity | Output |
|---|---:|
| Monte Carlo trials | 300,000 |
| Slide movement time | 369.27 ms |
| Slide timing-only success probability (analytic) | 0.43858 |
| Slide timing-only success probability (Monte Carlo) | 0.43831 |
| Lift-and-plant model-optimal height | 4.291 cm |
| Lift time at that height | 318.87 ms |
| Lift combined success probability (analytic) | 0.70240 |
| Nearest grid point Monte Carlo probability | 0.70210 |
| Height corresponding to 95% modelled clearance probability | 4.474 cm |
| Lift time at that height | 321.99 ms |
| Time-only slide/lift crossover height | 7.118 cm |

The nearest-grid Monte Carlo estimate is close to the analytic result, consistent with sampling noise at this trial count. It confirms implementation consistency, not validity of the assumptions or predictive accuracy for cricket.

### 4.2 Interpretation of the optimum

At low heights, a large number of synthetic trials fail the clearance criterion. As height increases, that risk falls. Simultaneously, the movement-time equation increases with height, reducing the fraction of deadlines met. The product yields an interior maximum. This mechanism is the source of the optimum; it is not evidence that real batters should target approximately 4.3 cm.

### 4.3 Figures

The code produces the three following figures in `results/`:

1. `time_vs_height.png` — lift/plant movement time as a function of height, with the slide comparator.
2. `success_probability_vs_height.png` — analytic success curve and Monte Carlo points.
3. `strategy_phase_diagram.png` — deterministic preferred movement-time strategy across distance and time-budget combinations, at the baseline optimised height.

## 5. Sensitivity and model criticism

The optimal height depends on the joint distributions of deadline and clearance demand, the assumed acceleration budgets, and return distance. If the clearance requirement is low, the model tends to prefer a smaller lift; if it is high or uncertain, a taller lift can be worthwhile until added time cost dominates. A shorter return distance changes the relationship between horizontal and vertical requirements. Independence between deadline and clearance may be unrealistic: hurried responses, foot orientation, and surface conditions can affect both. Further work should fit a joint distribution or estimate conditional relationships.

The model also assumes the same horizontal cubic shape for both strategies and abstracts muscle/joint limits into acceleration budgets. It omits the bat as a possible legal grounding contact, multi-segment coordination, footwear, pitch friction, foot rotation, body lean, anticipation, reaction time before movement begins, wicketkeeper action time, ball trajectory and wicket geometry. Thus the present model is useful as a derivation and experiment-design scaffold, not a validated digital twin.

The comparison is not fully symmetric: the slide is evaluated only on whether its assumed movement time fits the deadline, while the lifted strategy also includes clearance uncertainty. Future work must estimate slide-specific contact/catch failure and compare strategies under the same success definition.

## 6. Proposed empirical validation study

### 6.1 Design

Recruit adult batters across skill levels following institutional ethics review and written informed consent. Use a safe, controlled practice setup rather than risking real dismissals or injury. Randomise or counterbalance trial conditions across multiple starting foot positions, target return distances, instructions to slide or lift, and surface conditions. Include enough repeated trials per athlete to estimate within-athlete variability; conduct a prospective power analysis after a pilot estimates variance and intraclass correlation.

### 6.2 Instrumentation

Record two or more calibrated high-speed camera views at 240–500 frames/s, ideally with synchronised force/pressure sensors or a clear observable ground-contact proxy. Record the wicketkeeper's first contact with the wicket/bails, foot ground contact, foot-to-ground clearance, horizontal foot position relative to the popping crease, and whether the bat or another eligible body part establishes grounded contact. Synchronise every sensor. Two independent annotators should label events, with disagreements adjudicated.

### 6.3 Outcomes

Primary outcome: binary safe-contact-before-wicket-break outcome under a clearly stated operational definition consistent with the Laws of Cricket. Secondary outcomes: time to grounded contact, peak clearance, minimum clearance, horizontal distance, movement initiation delay, peak velocity, foot/ankle orientation, and strategy. Report inter-rater reliability and measurement error. The model must not use a kinematic event after the decision time as a predictor of success.

### 6.4 Model fitting and evaluation

Estimate player-specific distributions using a hierarchical model, with batter-level random effects. Fit acceleration/trajectory parameters to measured kinematics instead of choosing them by convenience. Compare the analytic model to a flexible baseline such as logistic regression or a generalised additive model. Use grouped cross-validation that holds out entire players and report calibration (Brier score, log loss, calibration curves), discrimination (ROC-AUC), uncertainty intervals and sensitivity to the operational definition of safe contact. Test predictions on an external cohort or a later collection session before giving coaching recommendations.

### 6.5 Falsification criteria

The model should be rejected or revised if its predicted optimal height is unstable under small parameter perturbations, if fitted kinematic trajectories systematically violate measured accelerations, if its probability estimates are poorly calibrated on held-out batters, or if slide/lift outcome differences vanish under controlled conditions. A pre-registered protocol should specify thresholds before confirmatory data are collected.

## 7. Novelty, public release, and research integrity

The searches carried out for this draft returned research on foot clearance and cricket batting, but no direct record clearly matching a joint deadline-versus-clearance optimisation for foot recovery during stumping. That finding is not a proof of novelty: index coverage varies, terminology differs, and related ideas may appear in theses, coaching literature, patents, or unpublished work. Before claiming a novel contribution, conduct a documented systematic search across scholarly databases, thesis repositories, patents and cricket coaching sources, archive the search strings and dates, and invite expert review.

The defensible contribution at this stage is a clearly specified toy model, its analytic/Monte Carlo cross-check, and an experimental pathway. No Nobel claim is justified by this work. The Nobel Prizes do not operate as a general award for a promising sports-science simulation; scientific significance cannot be inferred from the fact that a model has an equation or a non-trivial optimum.

The package contains no athlete data. It can be released as a preprint and open-source code project after author identity, affiliations, conflicts, acknowledgements and final references are checked. If deposited with a repository such as Zenodo/OSF, add a permanent DOI and archive a release. Do not label the paper peer reviewed or experimentally validated unless that becomes true.

## 8. Conclusion

A smooth-trajectory model plus uncertainty in deadline and clearance produces an intermediate optimum for lift height. Under an illustrative baseline, the numerical optimum is 4.29 cm, with an analytic success value around 0.702 and a close Monte Carlo check. These values are conditional outputs from assumptions, not empirical estimates. A balanced evaluation of slide versus lift requires strategy-specific contact risk, player-calibrated kinematics, legally valid outcome labelling, and independent validation. The main result is a reproducible modelling framework and a concrete falsifiable study plan.

## References

[1] Killeen, T., Awai Easthope, C., Demkó, L., Filli, L., Lőrincz, L., Linnebank, M., Curt, A. E. P., Zörner, B., & Bolliger, M. (2017). Minimum toe clearance: probing the neural control of locomotion. *Scientific Reports*. https://doi.org/10.1038/s41598-017-02189-y

[2] Asogwa, C. O., Nagano, H., Wang, K., & Begg, R. K. (2022). Using Deep Learning to Predict Minimum Foot–Ground Clearance Event from Toe-Off Kinematics. *Sensors, 22*(18), 6960. https://doi.org/10.3390/s22186960

[3] Miyake, T., Fujie, M. G., & Sugano, S. (2019). Prediction Algorithm of Parameters of Toe Clearance in the Swing Phase. *Applied Bionics and Biomechanics*. https://doi.org/10.1155/2019/4502719

[4] Glazier, P. S., Davids, K., & Bartlett, R. (2003). Dynamical systems theory: A relevant framework for performance-oriented sports biomechanics research. *Sportsci*. http://www.sportsci.org/jour/03/psg.htm

[5] Connor, J. D., Renshaw, I., & Farrow, D. (2020). Defining cricket batting expertise from the perspective of elite coaches. *PLOS ONE, 15*(7), e0234802. https://doi.org/10.1371/journal.pone.0234802

[6] Singh, U., Ramachandran, A. K., Doma, K., & Connor, J. D. (2023). Exploring the influence of task and environmental constraints on batting and bowling performance in cricket: A systematic review. *International Journal of Sports Science & Coaching*. https://doi.org/10.1177/17479541231181549

## Reproducibility statement

The simulation uses Python, NumPy and Matplotlib. The seed, all baseline parameters, analytic output, Monte Carlo sample size and generated figure names are stored in `simulate_stumping.py` and `results/simulation_results.json`. Run instructions and limitations appear in `README.md`. No external dataset is used.
MD
cat > /mnt/data/stumping_research_package/DATA_AND_VALIDATION.md <<'MD'
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
MD
