// A small, safe Markdown → HTML renderer for the transcript viewer.
// Every character of input is HTML-escaped first; only the constructs below are turned into tags.
// Supports: fenced code, headings, blockquotes, lists, tables, hr, paragraphs, **bold**, *em*,
// `code`, [links](http…), <autolinks>, <details>/<summary> produced by our own renderers.

import { escapeHtml } from '../core/util.ts';

function inline(s: string): string {
  let t = escapeHtml(s);
  const codes: string[] = [];
  t = t.replace(/`([^`\n]+)`/g, (_m, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|[A-Za-z0-9_./%-]+)\)/g, (_m, label: string, href: string) => `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a>`);
  t = t.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, u: string) => `<a href="${u}" rel="noopener noreferrer" target="_blank">${u}</a>`);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  t = t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
  return t;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const fenceM = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)\s*$/);
    if (fenceM) {
      flush();
      const close = fenceM[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== close) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${fenceM[2] ? ` class="lang-${escapeHtml(fenceM[2])}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    // Our own <details>/<summary> wrappers (renderers emit them on their own lines).
    const det = line.match(/^<details><summary>(.*)<\/summary>$/);
    if (det) {
      flush();
      const summary = det[1].replace(/<code>(.*?)<\/code>/g, (_m, c: string) => `\u0001${c}\u0002`);
      out.push(`<details><summary>${escapeHtml(summary).replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;').replace(/\u0001(.*?)\u0002/g, '<code>$1</code>')}</summary>`);
      i++;
      continue;
    }
    if (line.trim() === '</details>') {
      flush();
      out.push('</details>');
      i++;
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdownToHtml(body.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
      const headCells = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${headCells.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (m) {
          items.push(m[3]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join('\n');
}
