# Cell 013 · source event a985e42d-4d90-4138-8aea-ef9d5ea81fb6 · 2026-10-11T14:34:59.489Z
# 
python - <<'PY'
from PIL import Image, ImageDraw
from pathlib import Path
p=Path('/mnt/data/stumping_pdf_render')
files=sorted(p.glob('page-*.png'))
print('pdf-render pages',len(files))
thumbs=[]
for f in files:
 im=Image.open(f).convert('RGB'); im.thumbnail((350,460)); c=Image.new('RGB',(370,490),'white'); c.paste(im,((370-im.width)//2,10)); ImageDraw.Draw(c).text((10,470),f.name,fill='black'); thumbs.append(c)
cols=3; rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*370,rows*490),(210,215,220))
for i,im in enumerate(thumbs):sheet.paste(im,((i%cols)*370,(i//cols)*490))
sheet.save(p/'contact_sheet.png')
PY
