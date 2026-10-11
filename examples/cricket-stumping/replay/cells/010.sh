# Cell 010 · source event ce5d45eb-f45d-4601-85dd-02de32f4ca51 · 2026-10-11T14:30:45.767Z
# 
python - <<'PY'
p='/mnt/data/stumping_study/build_paper.py'
s=open(p).read()
s=s.replace("doc.add_heading('4. Simulation design', level=1)", "doc.add_page_break()\ndoc.add_heading('4. Simulation design', level=1)")
old = "doc.add_heading('References', level=1)\nrefs = ["
new = "doc.add_heading('Reproducibility', level=1)\npara('Run `python simulate_stumping.py` with Python 3, NumPy, and Matplotlib. The script writes the three figures and `simulation_results.json` into its own directory. The random seed is fixed to 20261011. All baseline constants are declared at the top of the script and can be changed for sensitivity experiments.')\n\ndoc.add_heading('References', level=1)\nrefs = ["
s=s.replace(old,new)
old_end = "# Add a small model reproducibility note\n\ndoc.add_heading('Reproducibility', level=1)\npara('Run `python simulate_stumping.py` with Python 3, NumPy, and Matplotlib. The script writes the three figures and `simulation_results.json` into its own directory. The random seed is fixed to 20261011. All baseline constants are declared at the top of the script and can be changed for sensitivity experiments.')\n\nout = BASE / 'stumping_recovery_research_paper.docx'"
s=s.replace(old_end, "out = BASE / 'stumping_recovery_research_paper.docx'")
open(p,'w').write(s)
PY
python /mnt/data/stumping_study/build_paper.py
rm -rf /mnt/data/stumping_study/rendered && python /home/oai/skills/docx/render_docx.py /mnt/data/stumping_study/stumping_recovery_research_paper.docx --output_dir /mnt/data/stumping_study/rendered --emit_pdf
python - <<'PY'
from PIL import Image, ImageDraw
from pathlib import Path
p=Path('/mnt/data/stumping_study/rendered')
files=sorted(p.glob('page-*.png'))
print('pages',len(files))
thumbs=[]
for f in files:
 im=Image.open(f).convert('RGB'); im.thumbnail((350,460))
 canvas=Image.new('RGB',(370,490),'white'); canvas.paste(im,((370-im.width)//2,10)); ImageDraw.Draw(canvas).text((10,470),f.name,fill='black'); thumbs.append(canvas)
cols=3; rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*370,rows*490),(210,215,220))
for i,im in enumerate(thumbs):sheet.paste(im,((i%cols)*370,(i//cols)*490))
sheet.save(p/'contact_sheet.png')
PY
