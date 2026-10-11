# Cell 037 · source event 0c040d10-fda2-42a0-b2ad-dc3fc0ea1876 · 2026-10-11T14:56:59.450Z
# Updating PDF Equation Rendering Logic
python - <<'PY'
p='/mnt/data/stumping_research_package/make_paper.py'
s=open(p).read()
start=s.index("    if line.startswith('\\\\[') or line.startswith('\\\\('):", s.index('story=[]'))
end=s.index("    if line.startswith('- '):", start)
new='''    if line.startswith(r"\\[") or line.startswith(r"\\("):
        opener = r"\\[" if line.startswith(r"\\[") else r"\\("
        closer = r"\\]" if opener == r"\\[" else r"\\)"
        expr = line[len(opener):].strip()
        i += 1
        while i < len(lines) and closer not in lines[i]:
            expr += " " + lines[i].strip()
            i += 1
        if i < len(lines):
            expr += " " + lines[i].replace(closer, "").strip()
        # Render common expressions as readable ASCII mathematics in the PDF.
        eqmap = {
          "x(t)=d(3u^2-2u^3).": "x(t) = d (3u^2 - 2u^3)",
          r"\\dot x(t)=\\frac{6d}{T}u(1-u), \\\qquad \\ddot x(t)=\\frac{6d}{T^2}(1-2u).": "dx/dt = (6d/T) u(1-u);  d2x/dt2 = (6d/T^2)(1-2u)",
          r"\\frac{6d}{T_s^2}\\le a_s-a_r,\\qquad \\boxed{T_s=\\sqrt{\\frac{6d}{a_s-a_r}}}. ": "6d/T_s^2 <= a_s - a_r;  T_s = sqrt(6d / (a_s - a_r))",
          r"\\ddot z(t)=\\frac{32h}{T^2}(1-6u+6u^2).": "d2z/dt2 = (32h/T^2)(1 - 6u + 6u^2)",
          r"A_{\\max}^{*}=\\frac{\\sqrt{36d^2+1024h^2}}{T^2}.": "A*_max = sqrt(36d^2 + 1024h^2) / T^2",
          r"\\boxed{T_l(h)=\\sqrt{\\frac{\\sqrt{36d^2+1024h^2}}{a_l}}}. ": "T_l(h) = sqrt( sqrt(36d^2 + 1024h^2) / a_l )",
          r"\\Delta\\sim\\mathcal N(\\mu_\\Delta,\\sigma_\\Delta^2),\\quad H\\sim\\mathcal N(\\mu_H,\\sigma_H^2).": "Delta ~ Normal(mu_Delta, sigma_Delta^2);  H ~ Normal(mu_H, sigma_H^2)",
          r"S_l(h)=\\{\\Delta\\ge T_l(h), H\\le h\\}.": "S_l(h) = {Delta >= T_l(h), H <= h}",
          r"\\boxed{P_l(h)=\\Phi\\!\\left(\\frac{\\mu_\\Delta-T_l(h)}{\\sigma_\\Delta}\\right) \\Phi\\!\\left(\\frac{h-\\mu_H}{\\sigma_H}\\right)}.": "P_l(h) = Phi((mu_Delta - T_l(h))/sigma_Delta) * Phi((h - mu_H)/sigma_H)",
          r"h^*=\\operatorname*{arg\\,max}_{h\\in[0.002,0.12]}P_l(h),": "h* = arg max P_l(h), for h in [0.002, 0.12] m",
          r"T_l(h)=T_s\\quad\\Rightarrow\\quad \\boxed{h_{\\mathrm{cross}}=\\sqrt{\\frac{(a_lT_s^2)^2-36d^2}{1024}}}.": "T_l(h) = T_s  =>  h_cross = sqrt(((a_l*T_s^2)^2 - 36d^2) / 1024)"
        }
        plain = None
        for src, dst in eqmap.items():
            if src.replace("\\\\qquad", " ").strip() == expr.strip() or src.strip() == expr.strip():
                plain = dst
                break
        if plain is None:
            plain = expr
            plain = plain.replace(r"\\qquad", "   ").replace(r"\\quad", " ").replace(r"\\,", " ")
            plain = plain.replace(r"\\boxed{", "").replace(r"\\sqrt{", "sqrt(").replace(r"\\frac{", "(")
            plain = plain.replace(r"\\Delta", "Delta").replace(r"\\sigma", "sigma").replace(r"\\mu", "mu").replace(r"\\Phi", "Phi")
            plain = plain.replace(r"\\mathcal N", "Normal").replace(r"\\operatorname{arg", "arg").replace(r"\\max", "max")
            plain = plain.replace(r"\\ge", ">=").replace(r"\\le", "<=").replace(r"\\in", "in").replace(r"\\sim", "~")
            plain = re.sub(r"\\\\[A-Za-z]+", "", plain).replace("{", "(").replace("}", ")")
        story.append(Paragraph(xml_escape(plain), styles['Equationx'])); i += 1; continue
'''
s=s[:start]+new+s[end:]
open(p,'w').write(s)
PY
cd /mnt/data/stumping_research_package && python make_paper.py >/dev/null && pdftoppm -f 3 -l 3 -png -r 100 stumping_recovery_research_paper.pdf pagecheck4 >/dev/null 2>&1
