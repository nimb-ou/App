# Cell 009 · source event 9b7d06bb-6c54-4dff-be74-fa914a8a09b1 · 2026-10-11T14:28:42.695Z
# 
ls -lh /mnt/data/stumping_study/rendered && python - <<'PY'
from PIL import Image, ImageOps, ImageDraw
from pathlib import Path
p=Path('/mnt/data/stumping_study/rendered')
files=sorted(p.glob('page-*.png'))
print('pages',len(files))
# make a contact sheet, scaled
thumbs=[]
for f in files:
 im=Image.open(f).convert('RGB')
 im.thumbnail((350,460))
 canvas=Image.new('RGB',(370,490),'white')
 canvas.paste(im,((370-im.width)//2,10))
 ImageDraw.Draw(canvas).text((10,470),f.name,fill='black')
 thumbs.append(canvas)
cols=3; rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*370,rows*490),(210,215,220))
for i,im in enumerate(thumbs): sheet.paste(im,((i%cols)*370,(i//cols)*490))
sheet.save(p/'contact_sheet.png')
PY
