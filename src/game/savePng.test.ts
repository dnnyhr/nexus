import { describe, expect, it } from 'vitest';
import { applyCommand, CADET_DESIGN, replay, startMission, worldStep } from '../engine';
import { newGame } from './state';
import { decodeSavePng, encodeSavePng, MAX_SAVE_PNG_BYTES, type PortableSave } from './savePng';

const image = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));
const free = (): PortableSave => ({ format: 'nexus-save', version: 1, createdAt: 1800000000000, name: 'Luna Álvarez', lang: 'es', checkpoint: { mode: 'free', game: newGame(1000) } });

function rewritePayload(png: Uint8Array, change: (data: Record<string, unknown>) => void): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    if (new TextDecoder().decode(png.subarray(offset + 4, offset + 8)) === 'nxSv') {
      const data = JSON.parse(new TextDecoder().decode(png.subarray(offset + 8, offset + 8 + length)));
      change(data);
      const text = new TextEncoder().encode(JSON.stringify(data));
      const chunk = new Uint8Array(text.length + 12);
      new DataView(chunk.buffer).setUint32(0, text.length);
      chunk.set(new TextEncoder().encode('nxSv'), 4);
      chunk.set(text, 8);
      let crc = 0xffffffff;
      for (const byte of chunk.subarray(4, -4)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      new DataView(chunk.buffer).setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
      return Uint8Array.from([...png.subarray(0, offset), ...chunk, ...png.subarray(offset + length + 12)]);
    }
    offset += length + 12;
  }
  throw new Error('Save chunk missing');
}

describe('portable PNG saves', () => {
  it('round trips a complete free game without mutating it or its PNG image chunks', () => {
    const save = free();
    if (save.checkpoint.mode !== 'free') throw new Error();
    save.checkpoint.game.res.materials = 123;
    save.checkpoint.game.player = { x: -8, z: 16 };
    save.checkpoint.game.rover.driving = true;
    const before = structuredClone(save);
    const png = encodeSavePng(image, save);
    expect(decodeSavePng(png)).toEqual(save);
    expect(save).toEqual(before);
    expect(png.subarray(0, image.length - 12)).toEqual(image.subarray(0, -12));
    expect(png.subarray(-12)).toEqual(image.subarray(-12));
  });

  it('restores a mission checkpoint and continues with exactly the same economy and history', () => {
    const mission = startMission(CADET_DESIGN);
    while (mission.t < 250) {
      if (mission.t === 200) applyCommand(mission, { type: 'setGrowLights', value: 20 });
      worldStep(mission);
    }
    applyCommand(mission, { type: 'setPower', system: 'heating', on: false });
    const save: PortableSave = { ...free(), checkpoint: { mode: 'mission', mission, position: { x: 12, z: -5 }, speed: 4 } };
    const restored = decodeSavePng(encodeSavePng(image, save));
    expect(restored).toEqual(save);
    if (restored.checkpoint.mode !== 'mission') throw new Error();
    while (mission.t < 420) { worldStep(mission); worldStep(restored.checkpoint.mission); }
    expect(restored.checkpoint.mission).toEqual(mission);
    expect(replay(mission.design, mission.log, mission.t)).toEqual(mission);
  });

  it.each(['victory', 'failed'] as const)('retains a closed mission with phase %s', phase => {
    const mission = startMission(CADET_DESIGN);
    while (mission.phase === 'running') {
      if (phase === 'victory' && mission.t === 480) applyCommand(mission, { type: 'enterShelter' });
      worldStep(mission);
    }
    expect(mission.phase).toBe(phase);
    const save: PortableSave = { ...free(), checkpoint: { mode: 'mission', mission, position: { x: 0, z: 0 }, speed: 1 } };
    expect(decodeSavePng(encodeSavePng(image, save))).toEqual(save);
  });

  it('distinguishes an ordinary image from a NEXUS save', () => {
    expect(() => decodeSavePng(image)).toThrow(expect.objectContaining({ code: 'missing' }));
  });

  it('rejects corruption, truncation and appended bytes', () => {
    const png = encodeSavePng(image, free());
    const corrupt = png.slice();
    corrupt[corrupt.length - 20] ^= 1;
    for (const data of [corrupt, png.subarray(0, -4), Uint8Array.from([...png, 0]), new Uint8Array(20)]) {
      expect(() => decodeSavePng(data)).toThrow(expect.objectContaining({ code: 'invalid' }));
    }
  });

  it('rejects an oversized image before parsing it', () => {
    expect(() => decodeSavePng(new Uint8Array(MAX_SAVE_PNG_BYTES + 1))).toThrow(expect.objectContaining({ code: 'too-large' }));
  });

  it('rejects unsupported save versions', () => {
    const png = rewritePayload(encodeSavePng(image, free()), data => { data.version = 2; });
    expect(() => decodeSavePng(png)).toThrow(expect.objectContaining({ code: 'incompatible' }));
  });

  it.each([
    (game: ReturnType<typeof newGame>) => { game.res.water = -1; },
    (game: ReturnType<typeof newGame>) => { game.counts.solarMast = 100000; },
    (game: ReturnType<typeof newGame>) => { game.power.priority = ['lifeSupport', 'lifeSupport'] as never; },
    (game: ReturnType<typeof newGame>) => { game.player.x = 1e30; },
    (game: ReturnType<typeof newGame>) => { game.version = 2 as never; },
    (game: ReturnType<typeof newGame>) => { game.sheltered = 'true' as never; },
  ])('rejects malformed free-game data even with a valid PNG checksum', change => {
    const png = rewritePayload(encodeSavePng(image, free()), data => {
      change((data.checkpoint as { game: ReturnType<typeof newGame> }).game);
    });
    expect(() => decodeSavePng(png)).toThrow();
  });

  it('rejects forged mission metrics instead of trusting a serialized result', () => {
    const mission = startMission(CADET_DESIGN);
    worldStep(mission);
    const save: PortableSave = { ...free(), checkpoint: { mode: 'mission', mission, position: { x: 0, z: 0 }, speed: 1 } };
    const png = rewritePayload(encodeSavePng(image, save), data => {
      (data.checkpoint as typeof save.checkpoint & { mission: typeof mission }).mission.metrics.secondsSheltered = 200;
    });
    expect(() => decodeSavePng(png)).toThrow(expect.objectContaining({ code: 'incompatible' }));
  });

  it('rejects commands after the checkpoint and duplicate save chunks', () => {
    const save: PortableSave = { ...free(), checkpoint: { mode: 'mission', mission: startMission(CADET_DESIGN), position: { x: 0, z: 0 }, speed: 1 } };
    const png = rewritePayload(encodeSavePng(image, save), data => {
      (data.checkpoint as { mission: { log: unknown[] } }).mission.log.push({ t: 2, cmd: { type: 'enterShelter' }, ok: true });
    });
    expect(() => decodeSavePng(png)).toThrow();
    expect(() => encodeSavePng(encodeSavePng(image, free()), free())).toThrow();
  });
});
