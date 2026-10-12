Cricket stumping foot-recovery simulation
========================================

Files
- stumping_recovery_research_paper.pdf : formatted 8-page paper
- stumping_recovery_research_paper.docx: editable manuscript
- simulate_stumping.py                 : reproducible Python simulation
- simulation_results.json              : baseline numerical outputs
- time_vs_height.png                   : time-height plot
- success_probability_vs_height.png    : simulated trade-off/optimum
- strategy_phase_diagram.png           : distance/deadline strategy map

Requirements
- Python 3
- NumPy
- Matplotlib

Run
    python simulate_stumping.py

The script regenerates the figures and JSON results in its own directory.
The baseline is illustrative and NOT fitted to player biomechanics. Do not use
its estimated 4.3 cm peak clearance as coaching advice. It is a model prediction
conditional on the assumed acceleration limits, deadline distribution and
clearance-risk distribution. See the paper for derivations and validation plan.
