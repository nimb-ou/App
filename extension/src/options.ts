declare const chrome: any;
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

chrome.storage.sync.get(['relay', 'token', 'seal', 'redact']).then((s: Record<string, unknown>) => {
  $('relay').value = String(s.relay ?? '');
  $('token').value = String(s.token ?? '');
  $('seal').checked = s.seal === true;
  $('redact').checked = s.redact !== false;
});

$('save').addEventListener('click', async () => {
  const relay = $('relay').value.trim().replace(/\/$/, '');
  if (relay) {
    // Ask for access to the relay's origin only (optional host permission), at the moment of the click.
    const granted = await chrome.permissions.request({ origins: [new URL(relay).origin + '/*'] }).catch(() => false);
    if (!granted) return void ($('st').textContent = 'Permission to reach the relay was not granted.');
  }
  await chrome.storage.sync.set({ relay, token: $('token').value, seal: $('seal').checked, redact: $('redact').checked });
  $('st').textContent = 'Saved.';
});
