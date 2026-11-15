import { replay, type MissionState, type MissionSpeed } from '../engine';
import { MAX_LEVEL } from './config';
import { isPriority } from './power';
import { cleanName } from './profile';
import { newGame, type GameState } from './state';

export const MAX_SAVE_PNG_BYTES = 8 * 1024 * 1024;
export interface PortableSave {
  format: 'nexus-save'; version: 1; createdAt: number; name: string; lang: 'es' | 'en';
  checkpoint: { mode: 'free'; game: GameState } | { mode: 'mission'; mission: MissionState; position: { x: number; z: number }; speed: MissionSpeed };
}
class SaveError extends Error {
  constructor(readonly code: string) { super(code); }
}
const fail = (code = 'invalid'): never => { throw new SaveError(code); };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
function crc(bytes: Uint8Array): number {
  let n = 0xffffffff;
  for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); }
  return (n ^ 0xffffffff) >>> 0;
}
function chunks(png: Uint8Array) {
  if (png.length > MAX_SAVE_PNG_BYTES) fail('too-large');
  if (png.length < 45 || !signature.every((b, i) => png[i] === b)) fail();
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const result: { type: string; start: number; end: number; data: Uint8Array }[] = [];
  let at = 8;
  while (at + 12 <= png.length) {
    const size = view.getUint32(at), end = at + 12 + size;
    if (end > png.length || crc(png.subarray(at + 4, end - 4)) !== view.getUint32(end - 4)) fail();
    const type = decoder.decode(png.subarray(at + 4, at + 8));
    result.push({ type, start: at, end, data: png.subarray(at + 8, end - 4) });
    at = end;
    if (type === 'IEND') break;
  }
  if (at !== png.length || result[0]?.type !== 'IHDR' || result[0].data.length !== 13 || result.at(-1)?.type !== 'IEND' || result.at(-1)?.data.length || !result.some(c => c.type === 'IDAT')) fail();
  const head = new DataView(result[0].data.buffer, result[0].data.byteOffset);
  if (!head.getUint32(0) || !head.getUint32(4) || head.getUint32(0) * head.getUint32(4) > 16000000) fail();
  return result;
}
function shape(value: unknown, sample: unknown): boolean {
  if (sample === null) return value === null || (typeof value === 'object' && value !== null && ['id', 'class', 'peak', 'link'].every(k => typeof (value as Record<string, unknown>)[k] === 'string'));
  if (typeof sample === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof sample !== 'object') return typeof value === typeof sample;
  if (Array.isArray(sample)) return isPriority(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(sample as object), obj = value as Record<string, unknown>;
  if (!keys.length) return Object.values(obj).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
  return Object.keys(obj).length === keys.length && keys.every(k => shape(obj[k], (sample as Record<string, unknown>)[k]));
}
function validate(raw: unknown): PortableSave {
  let nodes = 0;
  const scan = (v: unknown, depth = 0): void => {
    if (++nodes > 60000 || depth > 24) fail();
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER)) fail();
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (['__proto__', 'constructor', 'prototype'].includes(k)) fail(); scan(x, depth + 1); }
  };
  scan(raw);
  const s = raw as PortableSave;
  if (!s || s.format !== 'nexus-save') fail();
  if (s.version !== 1) fail('incompatible');
  if (!Number.isFinite(s.createdAt) || s.createdAt < 0 || typeof s.name !== 'string' || cleanName(s.name) !== s.name || !['es', 'en'].includes(s.lang) || !s.checkpoint) fail();
  const cp = s.checkpoint;
  if (cp.mode === 'free') {
    const g = cp.game;
    if (!shape(g, newGame(0)) || g.version !== 1 || !isPriority(g.power.priority) || g.mission < 0 || g.mission > 14 || !Number.isInteger(g.mission)) fail();
    for (const [k, v] of Object.entries(g.levels)) if (!Number.isInteger(v) || v < (k === 'bag' ? 1 : 0) || v > MAX_LEVEL[k as keyof typeof MAX_LEVEL]) fail();
    for (const [k, v] of Object.entries(g.counts)) if (!Number.isInteger(v) || v < 0 || v > MAX_LEVEL[k as keyof typeof MAX_LEVEL]) fail();
    if (Object.values(g.res).some(v => v < 0) || Object.values(g.stats).some(v => v < 0) || g.time < 0 || g.savedAt < 0 || g.crewHealth < 0 || g.crewHealth > 100 || Math.abs(g.player.x) > 256 || Math.abs(g.player.z) > 256 || g.power.growLights < 0 || g.power.growLights > 100 || !['none', 'warning', 'active'].includes(g.storm.phase)) fail();
  } else if (cp.mode === 'mission') {
    const ms = cp.mission;
    if (!ms || !Array.isArray(ms.log) || ms.log.length > 10000 || ms.t > 600 || ms.log.some(e => !e || e.t > ms.t) || ![1, 2, 4].includes(cp.speed) || !cp.position || ![cp.position.x, cp.position.z].every(v => Number.isFinite(v) && Math.abs(v) <= 256)) fail();
    try { if (JSON.stringify(replay(ms.design, ms.log, ms.t)) !== JSON.stringify(ms)) fail('incompatible'); } catch { fail('incompatible'); }
  } else fail();
  return s;
}
export function encodeSavePng(png: Uint8Array, save: PortableSave): Uint8Array {
  validate(save);
  const list = chunks(png);
  if (list.some(c => c.type === 'nxSv')) fail();
  const data = encoder.encode(JSON.stringify(save));
  if (data.length > 1024 * 1024) fail('too-large');
  const chunk = new Uint8Array(data.length + 12), view = new DataView(chunk.buffer);
  view.setUint32(0, data.length); chunk.set(encoder.encode('nxSv'), 4); chunk.set(data, 8); view.setUint32(chunk.length - 4, crc(chunk.subarray(4, -4)));
  const at = list.at(-1)!.start, out = new Uint8Array(png.length + chunk.length);
  if (out.length > MAX_SAVE_PNG_BYTES) fail('too-large');
  out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at), at + chunk.length);
  return out;
}
export function decodeSavePng(png: Uint8Array): PortableSave {
  const found = chunks(png).filter(c => c.type === 'nxSv');
  if (!found.length) fail('missing');
  if (found.length !== 1) fail();
  if (found[0].data.length > 1024 * 1024) fail('too-large');
  let raw: unknown;
  try { raw = JSON.parse(decoder.decode(found[0].data)); } catch { fail(); }
  return validate(raw);
}
