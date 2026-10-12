# Cell 028 · source event 2ee9a514-5dee-41cc-b76b-e2309eacab10 · 2026-10-11T14:51:58.344Z
# 
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read()
s=s.replace("    if line.startswith('\\\\[') or line.startswith('\\\\(') or line.startswith(('x(', 'z(', 'T_', 'P_', 'A_', 'S_l', 'h_')):\n        story.append(Paragraph(xml_escape(line.replace('\\\\[','').replace('\\\\]','').replace('\\\\(','').replace('\\\\)','')),styles['Equationx'])); i+=1; continue", "    if line.startswith('\\\\[') or line.startswith('\\\\('):\n        # Gather display math until matching closing delimiter, then show as readable plain-text maths.\n        opener = '\\\\[' if line.startswith('\\\\[') else '\\\\('\n        closer = '\\\\]' if opener == '\\\\[' else '\\\\)'\n        expr = line[len(opener):].strip()\n        i += 1\n        while i < len(lines) and closer not in lines[i]:\n            expr += ' ' + lines[i].strip()\n            i += 1\n        if i < len(lines):\n            expr += ' ' + lines[i].replace(closer,'').strip()\n        story.append(Paragraph(xml_escape(expr), styles['Equationx'])); i += 1; continue\n    if line.startswith(('x(', 'z(', 'T_', 'P_', 'A_', 'S_l', 'h_')) and len(line)<220:\n        story.append(Paragraph(xml_escape(line),styles['Equationx'])); i+=1; continue")
open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py && pdfinfo stumping_recovery_research_paper.pdf | grep Pages && pdftotext stumping_recovery_research_paper.pdf - | sed -n '45,95p'
