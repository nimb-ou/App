from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.units import cm

ROOT=Path(__file__).resolve().parent
text=(ROOT/'paper.md').read_text()
lines=text.splitlines()

# DOCX renderer: headings, paragraphs, bullet lists, simple markdown tables, math as literal formula text.
doc=Document()
sec=doc.sections[0]
sec.top_margin=Inches(.72); sec.bottom_margin=Inches(.72); sec.left_margin=Inches(.82); sec.right_margin=Inches(.82)
styles=doc.styles
styles['Normal'].font.name='Cambria'; styles['Normal'].font.size=Pt(10.5)
styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'),'Cambria')
styles['Normal'].paragraph_format.space_after=Pt(5)
for sty in ['Title','Heading 1','Heading 2','Heading 3']:
    styles[sty].font.name='Cambria'
styles['Title'].font.size=Pt(21); styles['Title'].font.bold=True; styles['Title'].font.color.rgb=RGBColor(28,48,72)
styles['Heading 1'].font.size=Pt(15); styles['Heading 1'].font.color.rgb=RGBColor(28,48,72)
styles['Heading 2'].font.size=Pt(12); styles['Heading 2'].font.color.rgb=RGBColor(42,80,112)
styles['Heading 3'].font.size=Pt(11)

def add_rich(p,s):
    # inline emphasis and code backticks, simple handling
    pat=re.compile(r'(\*\*.*?\*\*|\*[^*]+\*|`[^`]+`)')
    pos=0
    for m in pat.finditer(s):
        if m.start()>pos: p.add_run(s[pos:m.start()])
        tok=m.group()
        if tok.startswith('**'):
            r=p.add_run(tok[2:-2]); r.bold=True
        elif tok.startswith('*'):
            r=p.add_run(tok[1:-1]); r.italic=True
        else:
            r=p.add_run(tok[1:-1]); r.font.name='Consolas'; r.font.size=Pt(9)
        pos=m.end()
    if pos<len(s): p.add_run(s[pos:])

def add_table(mdrows):
    rows=[]
    for i,line in enumerate(mdrows):
        cells=[c.strip() for c in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-{3,}:?',c.replace(' ','')) for c in cells): continue
        rows.append(cells)
    if not rows:return
    n=max(len(r) for r in rows)
    t=doc.add_table(rows=0, cols=n); t.style='Light Shading Accent 1'
    for ri,row in enumerate(rows):
        cs=t.add_row().cells
        for j in range(n):
            val=row[j] if j<len(row) else ''
            p=cs[j].paragraphs[0]; p.paragraph_format.space_after=Pt(1)
            add_rich(p,val)
            for run in p.runs:
                run.font.size=Pt(8.6)
                if ri==0:run.bold=True
    doc.add_paragraph()

# Cover title
idx=0
if lines and lines[0].startswith('# '):
    p=doc.add_paragraph(style='Title'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; add_rich(p,lines[0][2:]); idx=1
for i in range(idx,len(lines)):
    line=lines[i].rstrip()
    if not line.strip(): continue
    if line.startswith('## '):
        doc.add_heading(line[3:].strip(),level=1); continue
    if line.startswith('### '):
        doc.add_heading(line[4:].strip(),level=2); continue
    if line.startswith('|'):
        block=[]
        while i<len(lines) and lines[i].startswith('|'):
            block.append(lines[i]); i+=1
        i-=1; add_table(block); continue
    if line.startswith('- '):
        p=doc.add_paragraph(style='List Bullet'); add_rich(p,line[2:]); continue
    if re.match(r'^\d+\. ',line):
        p=doc.add_paragraph(style='List Number'); add_rich(p,re.sub(r'^\d+\. ','',line)); continue
    if line.startswith('**') and line.endswith('**') and len(line)<100:
        p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; add_rich(p,line); continue
    p=doc.add_paragraph(); add_rich(p,line)
# Add footer and page numbering
for s in doc.sections:
    footer=s.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run('Stumping Recovery Model • Preprint-style manuscript • Not peer reviewed   |   Page ')
    fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); footer._p.append(fld)
docx=ROOT/'stumping_recovery_research_paper.docx'; doc.save(docx)

# PDF renderer from markdown, using reportlab; equations are rendered as readable plaintext equation lines.
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='PaperTitle',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=18,leading=22,alignment=TA_CENTER,textColor=colors.HexColor('#1c3048'),spaceAfter=18))
styles.add(ParagraphStyle(name='H1x',parent=styles['Heading1'],fontName='Helvetica-Bold',fontSize=14,leading=17,textColor=colors.HexColor('#1c3048'),spaceBefore=12,spaceAfter=6,keepWithNext=True))
styles.add(ParagraphStyle(name='H2x',parent=styles['Heading2'],fontName='Helvetica-Bold',fontSize=11.5,leading=14,textColor=colors.HexColor('#2a5070'),spaceBefore=9,spaceAfter=4,keepWithNext=True))
styles.add(ParagraphStyle(name='Bodyx',parent=styles['BodyText'],fontName='Times-Roman',fontSize=9.3,leading=12,spaceAfter=5,alignment=TA_LEFT))
styles.add(ParagraphStyle(name='Equationx',parent=styles['BodyText'],fontName='Courier',fontSize=8.2,leading=11,leftIndent=14,rightIndent=10,backColor=colors.HexColor('#f4f6f8'),borderPadding=5,spaceBefore=4,spaceAfter=7))
styles.add(ParagraphStyle(name='Smallx',parent=styles['BodyText'],fontName='Times-Roman',fontSize=8,leading=10,spaceAfter=2))

def xml_escape(s):
    s=s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    s=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'\*(.*?)\*',r'<i>\1</i>',s)
    s=re.sub(r'`(.*?)`',r'<font name="Courier">\1</font>',s)
    # Convert simple markdown links not in this document (none expected)
    return s

story=[]; i=0
while i<len(lines):
    line=lines[i].strip()
    if not line: i+=1; continue
    if line.startswith('# '): story.append(Paragraph(xml_escape(line[2:]),styles['PaperTitle'])); i+=1; continue
    if line.startswith('## '): story.append(Paragraph(xml_escape(line[3:]),styles['H1x'])); i+=1; continue
    if line.startswith('### '): story.append(Paragraph(xml_escape(line[4:]),styles['H2x'])); i+=1; continue
    if line.startswith('|'):
        block=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            block.append(lines[i].strip()); i+=1
        rows=[]
        for row in block:
            vals=[v.strip() for v in row.strip('|').split('|')]
            if all(re.fullmatch(r':?-{3,}:?',v.replace(' ','')) for v in vals): continue
            rows.append([Paragraph(xml_escape(v),styles['Smallx']) for v in vals])
        if rows:
            n=max(map(len,rows)); rows=[r+[Paragraph('',styles['Smallx'])]*(n-len(r)) for r in rows]
            widths=[(A4[0]-3.4*cm)/n]*n
            tb=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
            tb.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8eef3')),
                ('TEXTCOLOR',(0,0),(-1,0),colors.HexColor('#1c3048')),
                ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
                ('GRID',(0,0),(-1,-1),.35,colors.HexColor('#c4ccd4')),
                ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)
            ])); story.extend([tb,Spacer(1,7)])
        continue
    if line.startswith('\\[' or line.startswith('\\(') or (line.startswith('x(') or line.startswith('z(') or line.startswith('T_') or line.startswith('P_') or line.startswith('A_') or line.startswith('S_l') or line.startswith('h_')):
        story.append(Paragraph(xml_escape(line.replace('\\[','').replace('\\]','').replace('\\(','').replace('\\)','')),styles['Equationx'])); i+=1; continue
    if line.startswith('- '):
        story.append(Paragraph('• '+xml_escape(line[2:]),styles['Bodyx'])); i+=1; continue
    if re.match(r'^\d+\. ',line):
        m=re.match(r'^(\d+)\. (.*)$',line); story.append(Paragraph(m.group(1)+'. '+xml_escape(m.group(2)),styles['Bodyx'])); i+=1; continue
    story.append(Paragraph(xml_escape(line),styles['Bodyx'])); i+=1

# Attach graphs at the end as an appendix so they are included in static PDF output.
story.append(PageBreak()); story.append(Paragraph('Appendix A. Simulation figures',styles['H1x']))
for name,cap in [('time_vs_height.png','Figure A1. Movement time versus peak clearance.'),('success_probability_vs_height.png','Figure A2. Analytic probability curve and Monte Carlo checks.'),('strategy_phase_diagram.png','Figure A3. Deterministic strategy map across return distance and time budget.')]:
    p=ROOT/'results'/name
    if p.exists():
        story.append(Image(str(p),width=16.5*cm,height=9.45*cm,kind='proportional'))
        story.append(Paragraph(cap,styles['Smallx'])); story.append(Spacer(1,8))

def footer(canvas,doc):
    canvas.saveState(); canvas.setFont('Helvetica',7); canvas.setFillColor(colors.grey)
    canvas.drawCentredString(A4[0]/2,0.7*cm,f"Stumping Recovery Model • Preprint-style manuscript • Not peer reviewed  |  Page {doc.page}")
    canvas.restoreState()
pdf=ROOT/'stumping_recovery_research_paper.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,rightMargin=1.7*cm,leftMargin=1.7*cm,topMargin=1.5*cm,bottomMargin=1.5*cm,title='A Deadline-Constrained Model of Foot Recovery During Cricket Stumping',author='Author to be completed').build(story,onFirstPage=footer,onLaterPages=footer)
print(docx,pdf)
