/// <reference types="node" />
import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { embedText, extractText, packCard, unpackCard } from './pngsave';
import { newGame } from './state';

/** A real 2×2 RGBA PNG, built the long way so the test needs no image library. */
function tinyPng(): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    Buffer.from(data).copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(2 * (1 + 2 * 4), 200);
  raw[0] = 0; raw[9] = 0;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array()),
  ]));
}

describe('save cards (game inside a PNG)', () => {
  it('stores and reads back a game, accents and all', () => {
    const s = newGame();
    s.mission = 7;
    s.res.materials = 123;
    const png = embedText(tinyPng(), packCard(s, 'María José', 1_700_000_000_000));
    const card = unpackCard(extractText(png)!);
    expect(card?.name).toBe('María José');
    expect(card?.savedAt).toBe(1_700_000_000_000);
    expect(card?.state.mission).toBe(7);
    expect(card?.state.res.materials).toBe(123);
  });

  it('keeps the image valid: same pixels, chunk before IEND', () => {
    const src = tinyPng();
    const png = embedText(src, 'hola');
    const tail = Buffer.from(png.subarray(png.length - 12)).toString('latin1');
    expect(tail.slice(4, 8)).toBe('IEND');
    const idat = (b: Uint8Array) => { const s = Buffer.from(b).toString('latin1'); const i = s.indexOf('IDAT'); return inflateSync(Buffer.from(b.subarray(i + 4, i + 4 + Buffer.from(b).readUInt32BE(i - 4)))); };
    expect(idat(png).equals(idat(src))).toBe(true);
  });

  it('replaces an older save instead of stacking them', () => {
    const once = embedText(tinyPng(), 'a');
    const twice = embedText(once, 'b');
    expect(extractText(twice)).toBe('b');
    expect(twice.length).toBe(once.length);
  });

  it('says no to images without a save, damaged saves and other JSON', () => {
    expect(extractText(tinyPng())).toBeNull();
    expect(extractText(new Uint8Array([1, 2, 3]))).toBeNull();
    const png = embedText(tinyPng(), packCard(newGame(), 'Leo'));
    const broken = png.slice();
    broken[broken.length - 30] ^= 0xff; // flip a byte inside the save chunk
    expect(extractText(broken)).toBeNull();
    expect(unpackCard('{"format":"otro"}')).toBeNull();
    expect(unpackCard(JSON.stringify({ format: 'nexus-save', v: 1, state: { hola: 1 } }))).toBeNull();
  });

  it('fills in fields that older saves did not have', () => {
    const s = newGame() as unknown as Record<string, unknown>;
    delete s.rover;
    const card = unpackCard(JSON.stringify({ format: 'nexus-save', v: 1, savedAt: 1, name: '', state: s }));
    expect(card?.state.rover).toEqual(newGame().rover);
  });
});
