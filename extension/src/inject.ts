// Put a handoff INTO another AI's composer: text into the input, files onto the uploader. Never presses send.

import type { ComposerSpec } from './adapters.ts';

export function waitFor(doc: Document, selectors: string[], timeoutMs = 15000): Promise<HTMLElement | null> {
  const find = () => {
    for (const s of selectors) {
      const el = doc.querySelector<HTMLElement>(s);
      if (el) return el;
    }
    return null;
  };
  return new Promise((resolve) => {
    const hit = find();
    if (hit) return resolve(hit);
    const obs = new MutationObserver(() => {
      const el = find();
      if (el) {
        obs.disconnect();
        clearTimeout(t);
        resolve(el);
      }
    });
    obs.observe(doc.documentElement, { childList: true, subtree: true });
    const t = setTimeout(() => {
      obs.disconnect();
      resolve(find());
    }, timeoutMs);
  });
}

export async function fillComposer(doc: Document, spec: ComposerSpec, text: string): Promise<boolean> {
  const el = await waitFor(doc, spec.input);
  if (!el) return false;
  el.focus();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, (el.value ? el.value + '\n\n' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  // contenteditable editors (ProseMirror, Quill, Lexical) accept insertText or a synthetic paste.
  const before = el.textContent ?? '';
  let ok = false;
  try {
    ok = doc.execCommand('insertText', false, text);
  } catch {
    ok = false;
  }
  if (!ok || (el.textContent ?? '') === before) {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }
  if ((el.textContent ?? '') === before) {
    el.textContent = before + text; // last resort
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return true;
}

export async function attachFiles(doc: Document, spec: ComposerSpec, files: File[]): Promise<'input' | 'paste' | 'none'> {
  if (!files.length) return 'none';
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const input = spec.file ? ((await waitFor(doc, spec.file, 4000)) as HTMLInputElement | null) : null;
  if (input && input instanceof HTMLInputElement && input.type === 'file') {
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'input';
  }
  const target = await waitFor(doc, spec.input, 2000);
  if (!target) return 'none';
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  return 'paste';
}
