# Cell 034 · source event d1859c02-9241-4685-84ea-0ced865888d2 · 2026-10-11T14:55:40.865Z
# 
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read()
old="""    if line.startswith('\\\\[') or line.startswith('\\\\('):
        # Gather display math until matching closing delimiter, then show as readable plain-text maths.
        opener = '\\\\[' if line.startswith('\\\\[') else '\\\\('
        closer = '\\\\]' if opener == '\\\\[' else '\\\\)'
        expr = line[len(opener):].strip()
        i += 1
        while i < len(lines) and closer not in lines[i]:
            expr += ' ' + lines[i].strip()
            i += 1
        if i < len(lines):
            expr += ' ' + lines[i].replace(closer,'').strip()
        story.append(Paragraph(xml_escape(expr), styles['Equationx'])); i += 1; continue
"""
new="""    if line.startswith('\\\\[') or line.startswith('\\\\('):
        # Convert common LaTeX tokens to readable text; preserve the derivation without raw source markup.
        opener = '\\\\[' if line.startswith('\\\\[') else '\\\\('
        closer = '\\\\]' if opener == '\\\\[' else '\\\\)'
        expr = line[len(opener):].strip()
        i += 1
        while i < len(lines) and closer not in lines[i]:
            expr += ' ' + lines[i].strip()
            i += 1
        if i < len(lines):
            expr += ' ' + lines[i].replace(closer,'').strip()
        expr = expr.replace('\\\\qquad','     ').replace('\\\\,',' ').replace('\\\\;',' ').replace('\\\\!','')
        expr = expr.replace('\\\\ge','≥').replace('\\\\le','≤').replace('\\\\max','max').replace('\\\\operatorname{arg','arg')
        expr = expr.replace('\\\\mathcal N','N').replace('\\\\mathbb','').replace('\\\\Phi','Φ').replace('\\\\sim','~')
        expr = expr.replace('\\\\mathrm{','').replace('\\\\text{','').replace('\\\\left','').replace('\\\\right','')
        expr = expr.replace('\\\\boxed{','').replace('\\\\sqrt{','sqrt(').replace('\\\\frac{','(')
        expr = expr.replace('\\\\dot x','x-dot').replace('\\\\ddot x','x-double-dot').replace('\\\\dot z','z-dot').replace('\\\\ddot z','z-double-dot')
        expr = expr.replace('\\\\Delta','Δ').replace('\\\\sigma','σ').replace('\\\\mu','μ').replace('\\\\in','∈').replace('\\\\quad',' ')
        expr = expr.replace('\\\\{','{').replace('\\\\}','}').replace('\\\\,',' ')
        expr = re.sub(r'\\\\[a-zA-Z]+', '', expr)
        expr = expr.replace('{','(').replace('}',')')
        story.append(Paragraph(xml_escape(expr), styles['Equationx'])); i += 1; continue
"""
if old not in s:
 print('old not found')
else:
 s=s.replace(old,new)
 open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py >/dev/null && pdftoppm -f 3 -l 3 -png -r 100 stumping_recovery_research_paper.pdf pagecheck2 >/dev/null 2>&1
