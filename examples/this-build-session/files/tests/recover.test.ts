import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BatonEvent } from '../src/core/schema.ts';
import { bundlePath, extractShellOps, foldOps, recoverArtifacts, unwrapShell } from '../src/recover/artifacts.ts';

const call = (id: string, input: string, name = 'container.exec'): BatonEvent => ({ id, seq: 0, kind: 'tool_call', role: 'assistant', text: '', tool: { name, input, language: 'bash' } });

describe('shell heredoc extraction', () => {
  it('recovers quoted heredocs exactly, with trailing newline', () => {
    const ops = extractShellOps("bash -lc mkdir -p /mnt/data/p && cat > /mnt/data/p/a.py <<'PY'\nprint('$HOME')\nPY\necho done", 'e1');
    const w = ops.find((o) => o.kind === 'write');
    assert.equal(w?.path, '/mnt/data/p/a.py');
    assert.equal(w?.content, "print('$HOME')\n");
    assert.equal(w?.note, undefined);
  });
  it('flags unquoted heredocs that would expand', () => {
    const ops = extractShellOps('cat > /mnt/data/x.txt <<EOF\nhome=$HOME\nEOF', 'e1');
    assert.match(ops[0].note ?? '', /unquoted heredoc/);
  });
  it('handles append, tee, <<- tab stripping and multiple heredocs', () => {
    const script = "cat >> /mnt/data/log.txt <<'A'\none\nA\ntee /mnt/data/t.txt <<-'B'\n\tindented\n\tB\ncat <<'C' > /mnt/data/c.txt\nc\nC";
    const ops = extractShellOps(script, 'e1');
    assert.deepEqual(ops.map((o) => [o.kind, o.path, o.content]), [
      ['append', '/mnt/data/log.txt', 'one\n'],
      ['write', '/mnt/data/t.txt', 'indented\n'],
      ['write', '/mnt/data/c.txt', 'c\n'],
    ]);
  });
  it('tracks cd per command segment', () => {
    const ops = extractShellOps('cd /mnt/data/pkg && python run.py > results/out.txt && cd /mnt/data && zip -qr bundle.zip pkg', 'e1');
    assert.deepEqual(ops.map((o) => o.path).sort(), ['/mnt/data/bundle.zip', '/mnt/data/pkg/results/out.txt']);
  });
  it('detects python in-place rewrites as touches', () => {
    const ops = extractShellOps("python - <<'PY'\np='/mnt/data/pkg/m.py'\ns=open(p).read().replace('a','b')\nopen(p,'w').write(s)\nPY", 'e1');
    assert.deepEqual(ops.map((o) => [o.kind, o.path]), [['touch', '/mnt/data/pkg/m.py']]);
  });
  it('does not mistake .zip in filenames or inline > for commands', () => {
    const ops = extractShellOps('zip -qr /mnt/data/a.zip README.md app.zip.md && python -c "print(1>0)"', 'e1');
    assert.deepEqual(ops.map((o) => o.path), ['/mnt/data/a.zip']);
  });
  it('unwraps JSON cmd form', () => {
    assert.equal(unwrapShell('{"cmd":["bash","-lc","ls -la"]}'), 'ls -la');
  });
});

describe('fold + statuses', () => {
  it('recovered → stale after unreplayable modification; rewrite resets', () => {
    const events = [
      call('1', "cat > /mnt/data/a.py <<'X'\nv1\nX"),
      call('2', "python - <<'PY'\nopen('/mnt/data/a.py','w').write('v2')\nPY"),
    ];
    let arts = recoverArtifacts(events, 'chatgpt-share').artifacts;
    assert.equal(arts[0].status, 'stale');
    assert.equal(arts[0].content, 'v1\n');
    events.push(call('3', "cat > /mnt/data/a.py <<'X'\nv3\nX"));
    arts = recoverArtifacts(events, 'chatgpt-share').artifacts;
    assert.equal(arts[0].status, 'recovered');
    assert.equal(arts[0].versions, 2);
    assert.equal(arts[0].content, 'v3\n');
  });
  it('sandbox links without content are lost; binaries point to replay', () => {
    const msg: BatonEvent = { id: 'm', seq: 0, kind: 'message', role: 'assistant', text: '[PDF](sandbox:/mnt/data/out/paper.pdf) and [app](sandbox:/mnt/data/out/app.py)' };
    const arts = recoverArtifacts([msg], 'chatgpt-share').artifacts;
    assert.deepEqual(arts.map((a) => [a.path, a.status]), [['out/app.py', 'lost'], ['out/paper.pdf', 'lost']]);
    assert.match(arts[1].note ?? '', /replay/);
  });
  it('replays Claude Code Write + Edit + MultiEdit exactly', () => {
    const ev = (id: string, name: string, args: Record<string, unknown>): BatonEvent => ({ id, seq: 0, kind: 'tool_call', role: 'assistant', text: '', tool: { name, args } });
    const arts = recoverArtifacts(
      [
        ev('1', 'Write', { file_path: '/repo/src/a.ts', content: 'const a = 1;\nconst b = 2;\n' }),
        ev('2', 'Edit', { file_path: '/repo/src/a.ts', old_string: 'const a = 1;', new_string: 'const a = 10;' }),
        ev('3', 'MultiEdit', { file_path: '/repo/src/a.ts', edits: [{ old_string: 'b = 2', new_string: 'b = 20' }] }),
        ev('4', 'Edit', { file_path: '/repo/README.md', old_string: 'x', new_string: 'y' }),
      ],
      'claude-code',
      '/repo',
    ).artifacts;
    const a = arts.find((x) => x.path === 'src/a.ts');
    assert.equal(a?.status, 'recovered');
    assert.equal(a?.content, 'const a = 10;\nconst b = 20;\n');
    assert.equal(a?.versions, 3);
    const readme = arts.find((x) => x.path === 'README.md');
    assert.equal(readme?.status, 'lost');
    assert.match(readme?.note ?? '', /pre-existing/);
  });
  it('bundle paths can never escape the bundle', () => {
    assert.equal(bundlePath('/mnt/data/../../etc/passwd', 'chatgpt-share'), 'etc/passwd');
    assert.equal(bundlePath('/etc/passwd', 'claude-code', '/repo'), '_abs/etc/passwd');
    assert.equal(bundlePath('/repo/../x', 'claude-code', '/repo'), '_abs/x');
  });
  it('folds ops in order with replace on known content', () => {
    const arts = foldOps(
      [
        { kind: 'write', path: '/r/f', eventId: '1', content: 'hello world' },
        { kind: 'replace', path: '/r/f', eventId: '2', old: 'world', new: 'baton' },
      ],
      'claude-code',
      '/r',
    );
    assert.equal(arts[0].content, 'hello baton');
  });
});
