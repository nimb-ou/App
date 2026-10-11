# Cell 046 · source event d9e7f92c-adef-4bbb-b5e9-5b72f12ba94a · 2026-10-11T16:57:46.822Z
# Inspecting Project Files and Archive Contents
find /mnt/data/stumping_research_package -maxdepth 3 -type f -printf '%P %s bytes\n' | sort && echo '---' && unzip -l /mnt/data/stumping_research_lab.zip | head -50
