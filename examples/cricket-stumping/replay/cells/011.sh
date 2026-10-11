# Cell 011 · source event fd93a772-dbd4-43fa-982b-e08bf6e94542 · 2026-10-11T14:33:35.101Z
# 
python - <<'PY'
p='/mnt/data/stumping_study/build_paper.py'
s=open(p).read()
s=s.replace("para('The model produces three distinct statements. First, legal success is about being grounded behind the crease at the relevant instant, not merely moving a foot across the line in the air [1,2]. Second, under a deterministic height constraint, the optimal lift is the smallest clearance that reliably avoids surface contact; adding height only increases time in the present trajectory family. Third, once clearance uncertainty is modelled, an interior maximum can emerge because each extra centimetre buys reliability but costs time. In the illustrative case, that balance occurs near 4.3 cm.')",
"p_interp = para('The model produces three distinct statements. First, legal success is about being grounded behind the crease at the relevant instant, not merely moving a foot across the line in the air [1,2]. Second, under a deterministic height constraint, the optimal lift is the smallest clearance that reliably avoids surface contact; adding height only increases time in the present trajectory family. Third, once clearance uncertainty is modelled, an interior maximum can emerge because each extra centimetre buys reliability but costs time. In the illustrative case, that balance occurs near 4.3 cm.')\np_interp.paragraph_format.keep_together = True")
s=s.replace("para('The study is theoretical and its parameters are not athlete-calibrated. The endpoint trajectory is a convenient cubic/smooth polynomial, not an identified human movement primitive. The acceleration constraints approximate complex joint-level limits; they do not model muscle activation, fatigue, body balance, footwear, pitch deformation, or the need to avoid losing balance. Independence of timing and clearance noise may be false. The sliding model folds ground interaction into one acceleration penalty. The wicketkeeper deadline is represented as a random available-time budget, rather than being generated from measured glove-to-bail kinematics. The model also omits the bat and other body contacts that may satisfy the cricket law sooner than returning a foot.')",
"p_limit1 = para('The study is theoretical and its parameters are not athlete-calibrated. The endpoint trajectory is a convenient cubic/smooth polynomial, not an identified human movement primitive. The acceleration constraints approximate complex joint-level limits; they do not model muscle activation, fatigue, body balance, footwear, pitch deformation, or the need to avoid losing balance. Independence of timing and clearance noise may be false. The sliding model folds ground interaction into one acceleration penalty. The wicketkeeper deadline is represented as a random available-time budget, rather than being generated from measured glove-to-bail kinematics. The model also omits the bat and other body contacts that may satisfy the cricket law sooner than returning a foot.')\np_limit1.paragraph_format.keep_together = True")
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
 im=Image.open(f).convert('RGB'); im.thumbnail((350,460)); c=Image.new('RGB',(370,490),'white'); c.paste(im,((370-im.width)//2,10)); ImageDraw.Draw(c).text((10,470),f.name,fill='black'); thumbs.append(c)
cols=3; rows=(len(thumbs)+cols-1)//cols
s=Image.new('RGB',(cols*370,rows*490),(210,215,220))
for i,im in enumerate(thumbs):s.paste(im,((i%cols)*370,(i//cols)*490))
s.save(p/'contact_sheet.png')
PY
