import { newGame, type GameState } from './state';

/** A base that already has the first buildings, for tests of the systems themselves. */
export function developedGame(): GameState {
  const s = newGame();
  s.levels = { ...s.levels, antenna: 1, station: 1, greenhouse: 1, processor: 1, shield: 1 };
  s.counts.solarMast = 2;
  s.res.regolith = 20;
  return s;
}
