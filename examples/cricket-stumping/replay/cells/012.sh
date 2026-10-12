# Cell 012 · source event caad84ef-b9ce-4fec-bc7b-5f1f76e058ea · 2026-10-11T14:34:28.053Z
# 
cp /mnt/data/stumping_study/rendered/stumping_recovery_research_paper.pdf /mnt/data/stumping_recovery_research_paper.pdf
cp /mnt/data/stumping_study/stumping_recovery_research_paper.docx /mnt/data/stumping_recovery_research_paper.docx
cp /mnt/data/stumping_study/simulate_stumping.py /mnt/data/simulate_stumping.py
cp /mnt/data/stumping_study/simulation_results.json /mnt/data/stumping_simulation_results.json
cat > /mnt/data/stumping_study/README.txt <<'TXT'
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
TXT
cp /mnt/data/stumping_study/README.txt /mnt/data/stumping_recovery_README.txt
cd /mnt/data/stumping_study && zip -q -j /mnt/data/stumping_recovery_simulation_bundle.zip \
  stumping_recovery_research_paper.pdf stumping_recovery_research_paper.docx \
  simulate_stumping.py simulation_results.json time_vs_height.png \
  success_probability_vs_height.png strategy_phase_diagram.png README.txt
python /home/oai/skills/pdfs/scripts/render_pdf.py /mnt/data/stumping_recovery_research_paper.pdf --out_dir /mnt/data/stumping_pdf_render --dpi 150
pdfinfo /mnt/data/stumping_recovery_research_paper.pdf | head -15
ls -lh /mnt/data/stumping_recovery_research_paper.pdf /mnt/data/stumping_recovery_research_paper.docx /mnt/data/simulate_stumping.py /mnt/data/stumping_recovery_simulation_bundle.zip
