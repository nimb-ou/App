# Cell 035 · source event b798a058-0c03-40ee-98c3-8ba2210a1592 · 2026-10-11T14:55:40.882Z
# Updating Equation Rendering and PDF Validation
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read()
start=s.index("    if line.startswith('\\\\[') or line.startswith('\\\\('):", s.index('story=[]'))
end=s.index("    if line.startswith('- '):", start)
new=r'''    if line.startswith('\\[') or line.startswith('\\('):
        opener = r'\[' if line.startswith(r'\[') else r'\('
        closer = r'\]' if opener == r'\[' else r'\)'
        expr = line[len(opener):].strip()
        i += 1
        while i < len(lines) and closer not in lines[i]:
            expr += ' ' + lines[i].strip()
            i += 1
        if i < len(lines):
            expr += ' ' + lines[i].replace(closer, '').strip()
        # Human-readable math transliteration for PDF; Markdown retains canonical LaTeX.
        replacements = [
          (r'\boxed{', ''), (r'\sqrt{', 'sqrt('), (r'\frac{', '('),
          (r'\left', ''), (r'\right', ''), (r'\qquad', '     '),
          (r'\quad', ' '), (r'\,', ' '), (r'\;', ' '), (r'\!', ''),
          (r'\dot x', 'dx/dt'), (r'\ddot x', 'd2x/dt2'), (r'\dot z', 'dz/dt'), (r'\ddot z', 'd2z/dt2'),
          (r'\Delta', 'Delta'), (r'\sigma', 'sigma'), (r'\mu', 'mu'),
          (r'\Phi', 'Phi'), (r'\mathcal N', 'Normal'), (r'\max', 'max'),
          (r'\operatorname{arg', 'arg'), (r'\mathrm{', ''), (r'\text{', ''),
          (r'\ge', '>='), (r'\le', '<='), (r'\in', 'in'), (r'\sim', '~'),
          (r'\{', '{'), (r'\}', ')')
        ]
        for a,b in replacements: expr = expr.replace(a,b)
        expr = re.sub(r'\\[A-Za-z]+', '', expr)
        expr = expr.replace('{','(').replace('}',')')
        story.append(Paragraph(xml_escape(expr), styles['Equationx'])); i += 1; continue
'''
s=s[:start]+new+s[end:]
open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py >/dev/null && pdftoppm -f 3 -l 3 -png -r 100 stumping_recovery_research_paper.pdf pagecheck3 >/dev/null 2>&1
