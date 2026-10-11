# Cell 015 · source event df15520d-d954-4fbd-9042-b0d44faf8762 · 2026-10-11T14:36:03.552Z
# 
cp /mnt/data/stumping_recovery_research_paper.pdf /mnt/data/stumping_study/stumping_recovery_research_paper.pdf
cd /mnt/data/stumping_study && rm -f /mnt/data/stumping_recovery_simulation_bundle.zip && zip -q -j /mnt/data/stumping_recovery_simulation_bundle.zip \
  stumping_recovery_research_paper.pdf stumping_recovery_research_paper.docx \
  simulate_stumping.py simulation_results.json time_vs_height.png \
  success_probability_vs_height.png strategy_phase_diagram.png README.txt
unzip -l /mnt/data/stumping_recovery_simulation_bundle.zip | sed -n '1,20p'
