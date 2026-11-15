import { restoreState } from './save';
import type { GameState } from './state';

// Save cards: a game travels inside a PNG image. PNG files are a list of chunks, and a
// `tEXt` chunk holds a keyword and text that image viewers ignore. The card keeps the
// whole game state there (JSON, base64 so any name or accent survives), so the same file
// is a picture to share and a save to load. Apps that recompress photos drop the chunk,
// so the card has to travel as a file.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const KEYWORD = 'nexus-save';
const FORMAT = 'nexus-save';

export interface SaveCard {
  format: typeof FORMAT;
  v: 1;
  savedAt: number;
  /** The astronaut's name when the card was made (shown, not imported). */
  name: string;
  state: GameState;
}

// ---- PNG chunks -----------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Bytes to a string of char codes (no spread: large chunks would overflow the stack). */
function ascii(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function isPng(png: Uint8Array): boolean {
  return png.length > 8 && SIGNATURE.every((b, i) => png[i] === b);
}

interface Chunk { type: string; start: number; data: Uint8Array }

function chunks(png: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8;
  while (p + 12 <= png.length) {
    const len = view.getUint32(p);
    const type = ascii(png.subarray(p + 4, p + 8));
    if (p + 12 + len > png.length) break;
    out.push({ type, start: p, data: png.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

function textChunk(keyword: string, text: string): Uint8Array {
  const data = new Uint8Array(keyword.length + 1 + text.length);
  for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
  data[keyword.length] = 0;
  for (let i = 0; i < text.length; i++) data[keyword.length + 1 + i] = text.charCodeAt(i);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([116, 69, 88, 116], 4); // 'tEXt'
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

const toBase64 = (text: string) => {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** A copy of the PNG with `text` stored under our keyword (replacing an older one). */
export function embedText(png: Uint8Array, text: string): Uint8Array {
  if (!isPng(png)) throw new Error('not a PNG');
  const list = chunks(png);
  const end = list.find((c) => c.type === 'IEND');
  if (!end) throw new Error('PNG without IEND');
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  for (const c of list) {
    if (c.type === 'IEND') break;
    if (c.type === 'tEXt' && readKeyword(c.data) === KEYWORD) continue;
    parts.push(png.subarray(c.start, c.start + 12 + c.data.length));
  }
  parts.push(textChunk(KEYWORD, toBase64(text)), png.subarray(end.start, end.start + 12));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function readKeyword(data: Uint8Array): string {
  const zero = data.indexOf(0);
  return zero < 0 ? '' : ascii(data.subarray(0, zero));
}

/** The text stored under our keyword, or null (not a PNG, no save, or a damaged chunk). */
export function extractText(png: Uint8Array): string | null {
  if (!isPng(png)) return null;
  for (const c of chunks(png)) {
    if (c.type !== 'tEXt' || readKeyword(c.data) !== KEYWORD) continue;
    const crc = new DataView(png.buffer, png.byteOffset).getUint32(c.start + 8 + c.data.length);
    if (crc !== crc32(png.subarray(c.start + 4, c.start + 8 + c.data.length))) return null;
    try {
      return fromBase64(ascii(c.data.subarray(c.data.indexOf(0) + 1)));
    } catch {
      return null;
    }
  }
  return null;
}

// ---- Save cards -----------------------------------------------------------------------

export function packCard(state: GameState, name: string, now = Date.now()): string {
  const card: SaveCard = { format: FORMAT, v: 1, savedAt: now, name, state };
  return JSON.stringify(card);
}

/** Read a card's JSON back into a playable game, or null if it is not a NEXUS save. */
export function unpackCard(text: string): { savedAt: number; name: string; state: GameState } | null {
  try {
    const card = JSON.parse(text) as Partial<SaveCard>;
    if (card?.format !== FORMAT) return null;
    const state = restoreState(card.state);
    if (!state) return null;
    return { savedAt: Number(card.savedAt) || 0, name: typeof card.name === 'string' ? card.name : '', state };
  } catch {
    return null;
  }
}
