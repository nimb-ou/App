# Cell 016 · source event 80fed9c4-c48a-45b9-9e79-8a519cbe2c93 · 2026-10-11T14:42:42.239Z
# Locating stumping simulation files
ls -la /mnt/data | sed -n '1,100p'; find /mnt/data -maxdepth 2 -type f | grep -E 'stumping|simulate_stumping' | head -50
