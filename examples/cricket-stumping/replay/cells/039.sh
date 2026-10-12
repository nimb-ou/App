# Cell 039 · source event 8b2563a3-929e-4a45-ac65-1c1c95c64924 · 2026-10-11T14:58:57.893Z
# 
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read()
start=s.index("        eqmap = {", s.index('story=[]'))
end=s.index("        story.append(Paragraph(xml_escape(plain), styles['Equationx'])); i += 1; continue", start)
new=r'''        e = expr.strip()
        if e.startswith('x(t)='):
            plain = 'x(t) = d (3u^2 - 2u^3)'
        elif r'\dot x' in e:
            plain = 'dx/dt = (6d/T) u(1-u);  d2x/dt2 = (6d/T^2)(1-2u)'
        elif r'\frac{6d}{T_s^2}' in e:
            plain = '6d/T_s^2 <= a_s - a_r;  T_s = sqrt(6d/(a_s-a_r))'
        elif e.startswith('z(t)='):
            plain = 'z(t) = 16h u^2 (1-u)^2'
        elif r'\ddot z' in e:
            plain = 'd2z/dt2 = (32h/T^2)(1 - 6u + 6u^2)'
        elif r'A_{\max}' in e:
            plain = 'A*_max = sqrt(36d^2 + 1024h^2) / T^2'
        elif r'T_l(h)=' in e:
            plain = 'T_l(h) = sqrt( sqrt(36d^2 + 1024h^2) / a_l )'
        elif r'\Delta\sim' in e:
            plain = 'Delta ~ Normal(mu_Delta, sigma_Delta^2);  H ~ Normal(mu_H, sigma_H^2)'
        elif e.startswith('S_l(h)='):
            plain = 'S_l(h) = {Delta >= T_l(h), H <= h}'
        elif r'P_l(h)=' in e:
            plain = 'P_l(h) = Phi((mu_Delta - T_l(h))/sigma_Delta) * Phi((h - mu_H)/sigma_H)'
        elif r'h^*=' in e:
            plain = 'h* = arg max P_l(h), for h in [0.002, 0.12] metres'
        elif r'T_l(h)=T_s' in e:
            plain = 'T_l(h) = T_s  =>  h_cross = sqrt(((a_l*T_s^2)^2 - 36d^2)/1024)'
        else:
            plain = e
        story.append(Paragraph(xml_escape(plain), styles['Equationx'])); i += 1; continue'''
s=s[:start]+new+s[end+len("        story.append(Paragraph(xml_escape(plain), styles['Equationx'])); i += 1; continue"):]
open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py >/dev/null && pdftoppm -f 3 -l 3 -png -r 100 stumping_recovery_research_paper.pdf pagecheck5 >/dev/null 2>&1
