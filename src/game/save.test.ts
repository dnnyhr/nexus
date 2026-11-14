import { beforeEach, describe, expect, it } from 'vitest';
import { OFFLINE } from './config';
import { clearSave, loadGame, saveGame, simulateOffline } from './save';
import { newGame } from './state';
import { developedGame } from './testing';

// Minimal localStorage for the test environment.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

describe('saving', () => {
  beforeEach(() => store.clear());

  it('saves and loads the same game', () => {
    const s = developedGame();
    s.res.materials = 123;
    s.mission = 4;
    s.player = { x: 3, z: -7 };
    saveGame(s, 1000);
    const back = loadGame()!;
    expect(back.res.materials).toBe(123);
    expect(back.mission).toBe(4);
    expect(back.player).toEqual({ x: 3, z: -7 });
    expect(back.savedAt).toBe(1000);
  });

  it('fills in fields that older saves did not have', () => {
    const old = newGame() as unknown as Record<string, unknown>;
    delete old.damage;
    delete old.storm;
    store.set('nexus.save.v1', JSON.stringify(old));
    const back = loadGame()!;
    expect(back.damage).toEqual({});
    expect(back.storm.phase).toBe('none');
  });

  it('no save means a new game', () => {
    clearSave();
    expect(loadGame()).toBeNull();
  });
});

describe('offline progress', () => {
  it('robots and the processor keep working while away', () => {
    const s = developedGame();
    s.levels.collectorRobot = 1;
    s.res.regolith = 0;
    const mat = s.res.materials;
    const r = simulateOffline(s, 3600);
    expect(s.res.materials).toBeGreaterThan(mat);
    expect(r.materials).toBeGreaterThan(0);
  });

  it('is capped at 8 hours', () => {
    const s = developedGame();
    expect(simulateOffline(s, 48 * 3600).seconds).toBe(OFFLINE.maxSeconds);
  });

  it('plants never die and the crew is safe while away', () => {
    const s = developedGame();
    s.plant.water = 0;
    s.plant.stress = 95;
    const health = s.crewHealth;
    simulateOffline(s, OFFLINE.maxSeconds);
    expect(s.plant.dead).toBe(false);
    expect(s.crewHealth).toBe(health);
  });
});
