import { CYCLE } from '../game/config';
import { currentMission, MISSIONS } from '../game/missions';
import type { GameState } from '../game/state';
import { getLang, t, type StringKey } from './i18n';

// The picture on a save card: a mission file the player can keep or send, like a save
// slot in a console game. A frame of the base as it looks right now fills the card; a
// dark side panel carries the astronaut's name, the mission and a few numbers, with the
// mission rail along the bottom. The game data itself goes into the PNG (pngsave.ts).

export const CARD_W = 1280;
export const CARD_H = 720;
const FONT = '"Barlow Semi Condensed", "Helvetica Neue", Arial, sans-serif';
const WHITE = '#f4f2ee';
const DIM = 'rgba(244, 242, 238, 0.58)';
const FAINT = 'rgba(244, 242, 238, 0.24)';
const AMBER = '#f2b54a';

export interface CardInfo {
  state: GameState;
  name: string;
  /** A frame of the 3D view (any size; drawn to cover the card). */
  shot: CanvasImageSource & { width: number; height: number } | null;
  savedAt: number;
}

/** Wait for the HUD font so the card is not drawn in a fallback face. */
export async function cardFontsReady(): Promise<void> {
  try {
    await Promise.all(['500', '600'].map((w) => document.fonts.load(`${w} 40px "Barlow Semi Condensed"`)));
  } catch {
    // Fallback fonts still make a readable card.
  }
}

export function drawCard(info: CardInfo): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  const s = info.state;

  // Background: the base, cover-fit and darkened so the text reads on any frame.
  g.fillStyle = '#0a0a0b';
  g.fillRect(0, 0, CARD_W, CARD_H);
  if (info.shot && info.shot.width && info.shot.height) {
    // A little bigger than the card, shifted right: the astronaut (center of the view)
    // lands beside the side panel instead of under it.
    const k = Math.max(CARD_W / info.shot.width, CARD_H / info.shot.height) * 1.3;
    const w = info.shot.width * k;
    const h = info.shot.height * k;
    const x = Math.min(0, Math.max(CARD_W - w, CARD_W * 0.68 - w / 2));
    g.drawImage(info.shot, x, (CARD_H - h) / 2, w, h);
  }
  g.fillStyle = 'rgba(0, 0, 0, 0.18)';
  g.fillRect(0, 0, CARD_W, CARD_H);
  const shade = g.createLinearGradient(0, CARD_H * 0.55, 0, CARD_H);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
  g.fillStyle = shade;
  g.fillRect(0, 0, CARD_W, CARD_H);

  // Side panel.
  const px = 56;
  const py = 56;
  const pw = 470;
  const ph = CARD_H - 112 - 70;
  g.fillStyle = 'rgba(6, 7, 9, 0.78)';
  g.fillRect(px, py, pw, ph);
  g.fillStyle = WHITE;
  g.fillRect(px, py, pw, 2);

  const text = (str: string, x: number, y: number, size: number, color = WHITE, weight = 500, spacing = 0, align: CanvasTextAlign = 'left') => {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
    g.fillText(str, x, y);
  };
  const fit = (str: string, max: number, size: number, weight: number) => {
    let sz = size;
    g.font = `${weight} ${sz}px ${FONT}`;
    while (sz > 28 && g.measureText(str).width > max) g.font = `${weight} ${--sz}px ${FONT}`;
    return sz;
  };

  const x = px + 34;
  text(t('cardKicker').toUpperCase(), x, py + 52, 17, DIM, 500, 3.5);
  const name = (info.name || t('defaultName')).toUpperCase();
  text(name, x, py + 124, fit(name, pw - 68, 64, 600), WHITE, 600, 1);

  const m = currentMission(s);
  const n = String(s.mission + 1).padStart(2, '0');
  text(`${t('missionN', { n })} · ${t(`m_${m.id}_title` as StringKey)}`.toUpperCase(), x, py + 172, 19, AMBER, 600, 3);
  const goal = t(`m_${m.id}_goal` as StringKey, m.progress(s));
  text(goal, x, py + 204, fit(goal, pw - 68, 24, 500), WHITE, 500);

  // Numbers: 2 × 2.
  g.fillStyle = FAINT;
  g.fillRect(x, py + 236, pw - 68, 1);
  const cycles = Math.floor(s.time / (CYCLE.daySeconds + CYCLE.nightSeconds)) + 1;
  const built = s.levels.antenna + s.levels.station + s.levels.greenhouse + s.levels.processor + s.levels.collectorRobot
    + s.levels.harvesterRobot + s.levels.shield + s.counts.solarMast + s.counts.battery;
  const stats: [StringKey, string][] = [
    ['cardCycles', String(cycles)],
    ['materials', String(Math.floor(s.res.materials))],
    ['cardBuilt', String(built)],
    ['cardIce', String(Math.round(s.stats.iceDelivered))],
  ];
  stats.forEach(([label, value], i) => {
    const sx = x + (i % 2) * 200;
    const sy = py + 290 + Math.floor(i / 2) * 96;
    text(t(label).toUpperCase(), sx, sy, 15, DIM, 500, 2.5);
    text(value, sx, sy + 46, 46, WHITE, 500);
  });

  const when = new Date(info.savedAt).toLocaleString(getLang(), { dateStyle: 'medium', timeStyle: 'short' });
  text(t('cardSaved', { date: when }), x, py + ph - 26, 17, DIM, 500, 0.5);

  // Mission rail along the bottom, like the HUD timeline.
  const rx = px;
  const rw = CARD_W - px * 2;
  const ry = CARD_H - 70;
  g.fillStyle = FAINT;
  g.fillRect(rx, ry, rw, 2);
  const done = s.mission / (MISSIONS.length - 1);
  g.fillStyle = WHITE;
  g.fillRect(rx, ry, rw * done, 2);
  MISSIONS.forEach((_, i) => {
    const cx = rx + (i / (MISSIONS.length - 1)) * rw;
    g.beginPath();
    g.arc(cx, ry + 1, i === s.mission ? 9 : 6, 0, Math.PI * 2);
    g.fillStyle = i < s.mission ? WHITE : '#0a0a0b';
    g.fill();
    g.lineWidth = i === s.mission ? 3 : 1.5;
    g.strokeStyle = i <= s.mission ? WHITE : DIM;
    g.stroke();
  });
  text(t('cardProgress', { n: s.mission + 1, total: MISSIONS.length }).toUpperCase(), rx, ry + 36, 16, DIM, 500, 3);
  text('NEXUS · ' + t('gameTitle').replace(/^NEXUS:\s*/, '').toUpperCase(), CARD_W - px, ry + 36, 16, DIM, 500, 3, 'right');

  // Corner ticks around the whole card.
  g.strokeStyle = 'rgba(244, 242, 238, 0.7)';
  g.lineWidth = 2;
  const m0 = 22;
  const L = 34;
  for (const [cx, cy, dx, dy] of [[m0, m0, 1, 1], [CARD_W - m0, m0, -1, 1], [m0, CARD_H - m0, 1, -1], [CARD_W - m0, CARD_H - m0, -1, -1]]) {
    g.beginPath();
    g.moveTo(cx, cy + dy * L);
    g.lineTo(cx, cy);
    g.lineTo(cx + dx * L, cy);
    g.stroke();
  }
  return c;
}
