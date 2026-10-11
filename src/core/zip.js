const encoder = new TextEncoder();

function asBytes(value) {
  return value instanceof Uint8Array ? value : encoder.encode(String(value));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function header(size) { return new Uint8Array(size); }
function set16(view, offset, value) { view.setUint16(offset, value, true); }
function set32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
function join(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

// A small ZIP writer using the standard "stored" method; no compression package is needed.
export function buildZip(entries) {
  const locals = [];
  const central = [];
  const seen = new Set();
  let offset = 0;
  for (const entry of entries) {
    const path = entry.path.replace(/\\/g, "/");
    if (seen.has(path)) throw new Error(`Duplicate ZIP path: ${path}`);
    seen.add(path);
    const name = encoder.encode(path);
    const data = asBytes(entry.data);
    const checksum = crc32(data);
    const local = header(30);
    const lv = new DataView(local.buffer);
    set32(lv, 0, 0x04034b50); set16(lv, 4, 20); set16(lv, 6, 0x0800); set16(lv, 8, 0);
    set32(lv, 14, checksum); set32(lv, 18, data.length); set32(lv, 22, data.length); set16(lv, 26, name.length);
    locals.push(local, name, data);

    const directory = header(46);
    const dv = new DataView(directory.buffer);
    set32(dv, 0, 0x02014b50); set16(dv, 4, 20); set16(dv, 6, 20); set16(dv, 8, 0x0800); set16(dv, 10, 0);
    set32(dv, 16, checksum); set32(dv, 20, data.length); set32(dv, 24, data.length); set16(dv, 28, name.length);
    set32(dv, 42, offset);
    central.push(directory, name);
    offset += local.length + name.length + data.length;
  }
  const centralBytes = join(central);
  const end = header(22);
  const ev = new DataView(end.buffer);
  set32(ev, 0, 0x06054b50); set16(ev, 8, entries.length); set16(ev, 10, entries.length);
  set32(ev, 12, centralBytes.length); set32(ev, 16, offset);
  return join([...locals, centralBytes, end]);
}
