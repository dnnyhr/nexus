import { build, checkBuild, currentLevel, nextCost } from '../game/build';
import { ENERGY, PROCESSOR, type BuildingKind } from '../game/config';
import type { Command, CommandResult } from '../engine/types';
import { adjustClimate, capacity, carryMax, digYield, harvest, inRange, irrigate, replant, type PowerReport } from '../game/sim';
import { cyclePhase, type GameState } from '../game/state';
import { el, setText } from './dom';
import { t, type StringKey } from './i18n';

// Panels that open next to a 3D object when the player taps it. Each panel shows the real
// state of that object and the actions that make sense for it. Panels keep stable DOM and
// refresh their values with update(), so buttons never get rebuilt under the player's finger.

export type PanelKind = 'station' | 'greenhouse' | 'processor' | 'solarMast' | 'battery' | 'robots' | 'rover' | 'antenna' | 'lander';

export interface PanelContext {
  s: GameState;
  power(): PowerReport;
  /** Something changed the buildings: re-sync the scene. */
  changed(): void;
  /** Floating feedback text at the object. */
  say(text: string, warn?: boolean): void;
  /** Make the object react (poke animation). */
  poke(): void;
  close(): void;
  /** Erase the save and start over (only the lander panel offers it). */
  newGame?(): void;
  /** Save cards (lander panel): download the game as a PNG, or load one. */
  exportGame?(): void;
  importGame?(): void;
  /**
   * Mission mode: every player action goes through the mission engine (logged, replayable).
   * Returns null outside a mission, where panels change the game directly as before.
   */
  command?(cmd: Command): CommandResult | null;
  /** True during a mission: nothing can be built or upgraded, saves stay in free mode. */
  mission?: boolean;
}

export interface Panel {
  el: HTMLElement;
  update(): void;
}

type Updater = () => void;

function header(title: () => string, sub: () => string, ctx: PanelContext, ups: Updater[]): HTMLElement {
  const h = el('h3');
  const s = el('span.sub');
  ups.push(() => { setText(h, title()); setText(s, sub()); });
  return el('div.head', {}, el('div', {}, h, ' ', s), el('button.close', { onclick: () => ctx.close(), 'aria-label': t('close') }, '✕'));
}

function reasonText(kind: BuildingKind, ctx: PanelContext): string {
  const c = checkBuild(ctx.s, kind);
  if (c.ok) return '';
  if (c.reason === 'max') return t('maxed');
  if (c.reason === 'materials') return t('needMaterials', { n: Math.ceil((c.cost ?? 0) - ctx.s.res.materials) });
  return c.requires === 'station' ? t('needStation') : t('needGreenhouse');
}

/** Upgrade / build button for a building kind, with the reason shown when it can't. */
export function upgradeButton(kind: BuildingKind, ctx: PanelContext, ups: Updater[], label: StringKey = 'upgrade'): HTMLElement {
  // In a mission the base was designed before starting: nothing is built during operation.
  if (ctx.mission) return el('span');
  const btn = el('button.t-btn', {
    onclick: () => {
      const before = currentLevel(ctx.s, kind);
      if (build(ctx.s, kind)) {
        ctx.changed();
        ctx.poke();
        const repeatable = kind === 'solarMast' || kind === 'battery';
        ctx.say(repeatable || before === 0 ? t('built') : t('upgraded', { n: before + 1 }));
      } else {
        ctx.say(reasonText(kind, ctx), true);
      }
    },
  });
  const name = el('span');
  const cost = el('span.cost');
  btn.append(name, cost);
  ups.push(() => {
    const c = nextCost(ctx.s, kind);
    setText(name, c === null ? t('maxed') : currentLevel(ctx.s, kind) === 0 ? t('build') : t(label));
    setText(cost, c === null ? '' : `· ${c}`);
    btn.classList.toggle('muted', !checkBuild(ctx.s, kind).ok);
  });
  return btn;
}

/** 0-100 gauge; with `band`, the optimal 40-60 range is shaded and out-of-range turns amber. */
function gauge(label: StringKey, value: () => number, ups: Updater[], opts: { band?: boolean; plant?: boolean } = {}): HTMLElement {
  const v = el('span.v');
  const track = el('div.track');
  const node = el(`div.gauge${opts.plant ? '.plant' : ''}`, {}, el('div.label-row', {}, el('span.label', {}, t(label)), v), track);
  let mark: HTMLElement;
  if (opts.band) {
    track.append(el('div.band'));
    mark = el('div.mark');
  } else {
    mark = el('div.fill');
  }
  track.append(mark);
  ups.push(() => {
    const x = Math.round(value());
    setText(v, String(x));
    if (opts.band) {
      mark.style.left = `${x}%`;
      node.classList.toggle('bad', !inRange(x));
    } else {
      mark.style.width = `${x}%`;
    }
  });
  return node;
}

function para(text: () => string, ups: Updater[], cls = ''): HTMLElement {
  const p = el(cls ? `p.${cls}` : 'p');
  ups.push(() => setText(p, text()));
  return p;
}

function toggle(label: StringKey, get: () => boolean, set: (v: boolean) => void, ups: Updater[]): HTMLElement {
  const btn = el('button.t-btn', { onclick: () => set(!get()) });
  ups.push(() => {
    setText(btn, get() ? t('on') : t('off'));
    btn.classList.toggle('off', !get());
  });
  return el('div.toggle', {}, el('span', {}, t(label)), btn);
}

/** Run a player action: through the mission engine when there is one, else directly. */
function act(ctx: PanelContext, cmd: Command, direct: () => boolean): boolean {
  const r = ctx.command?.(cmd);
  return r ? r.ok : direct();
}

function actionButton(label: StringKey, run: () => void, ups: Updater[], extra?: () => string): HTMLElement {
  const b = el('button.t-btn', { onclick: run });
  ups.push(() => setText(b, extra ? `${t(label)} ${extra()}` : t(label)));
  return b;
}

export function makePanel(kind: PanelKind, ctx: PanelContext): Panel {
  const ups: Updater[] = [];
  const s = ctx.s;
  const levelSub = (k: BuildingKind) => () => t('level', { n: currentLevel(s, k) });
  let node: HTMLElement;

  switch (kind) {
    case 'greenhouse': {
      const status = para(() => (s.plant.dead ? t('plantDead') : s.plant.growth >= 100 ? t('plantReady') : t('optimal')), ups);
      node = el('div', {},
        header(() => t('greenhouse'), levelSub('greenhouse'), ctx, ups),
        status,
        gauge('plantWater', () => s.plant.water, ups, { band: true }),
        gauge('plantLight', () => s.plant.light, ups, { band: true }),
        gauge('plantTemp', () => s.plant.temp, ups, { band: true }),
        gauge('growth', () => s.plant.growth, ups, { plant: true }),
        gauge('stress', () => s.plant.stress, ups),
        el('div.row', {},
          actionButton('irrigate', () => { if (act(ctx, { type: 'irrigate' }, () => irrigate(s))) ctx.poke(); else if (!ctx.mission) ctx.say(t('noWater'), true); }, ups, () => '· 2'),
          actionButton('heat', () => { if (!act(ctx, { type: 'adjustClimate', dir: 1 }, () => adjustClimate(s, 1)) && !ctx.mission) ctx.say(t('noEnergy'), true); }, ups),
          actionButton('cool', () => { if (!act(ctx, { type: 'adjustClimate', dir: -1 }, () => adjustClimate(s, -1)) && !ctx.mission) ctx.say(t('noEnergy'), true); }, ups),
        ),
        el('div.row', {},
          actionButton('harvest', () => {
            const before = s.res.food;
            const ok = act(ctx, { type: 'harvest' }, () => harvest(s) > 0);
            if (ok) { ctx.poke(); ctx.say(t('harvested', { n: Math.round(s.res.food - before) })); } else if (!ctx.mission) ctx.say(t('notReady'), true);
          }, ups),
          actionButton('replant', () => { if (!act(ctx, { type: 'replant' }, () => replant(s)) && !ctx.mission) ctx.say(t('needMaterials', { n: 8 }), true); }, ups, () => '· 8'),
          upgradeButton('greenhouse', ctx, ups),
        ),
        para(() => t('factGreenhouse'), ups, 'fact'),
      );
      break;
    }
    case 'processor': {
      node = el('div', {},
        header(() => t('processor'), levelSub('processor'), ctx, ups),
        para(() => {
          const p = ctx.power();
          if (s.sheltered) return t('procSheltered');
          if (!s.power.processor) return t('procOff');
          if (s.res.regolith <= 0) return t('procNoRegolith');
          if (!p.running.processor) return t('procNoPower');
          return t('procRunning');
        }, ups),
        para(() => `${t('regolith')}: ${Math.floor(s.res.regolith)} · ${t('perSecond', { n: (PROCESSOR.regolithPerSecond * (1 + 0.5 * (s.levels.processor - 1))).toFixed(2) })}`, ups),
        toggle('processor', () => s.power.processor, (v) => act(ctx, { type: 'setPower', system: 'processor', on: v }, () => { s.power.processor = v; return true; }), ups),
        el('div.row', {}, upgradeButton('processor', ctx, ups)),
        para(() => t('factRegolith'), ups, 'fact'),
      );
      break;
    }
    case 'station': {
      const cap = () => capacity(s);
      node = el('div', {},
        header(() => t('station'), levelSub('station'), ctx, ups),
        para(() => t('stationInfo'), ups),
        para(() => `${t('o2')} ${Math.floor(s.res.o2)}/${cap().o2} · ${t('water')} ${Math.floor(s.res.water)}/${cap().water} · ${t('food')} ${Math.floor(s.res.food)}/${cap().food}`, ups),
        gauge('crewHealth', () => s.crewHealth, ups),
        el('div.row', {}, upgradeButton('station', ctx, ups)),
        para(() => t('bagInfo', { n: s.levels.bag, cap: carryMax(s), dig: digYield(s) }), ups),
        el('div.row', {}, upgradeButton('bag', ctx, ups, 'upgradeBag')),
        para(() => t('shieldLevel', { n: s.levels.shield }), ups),
        el('div.row', {}, upgradeButton('shield', ctx, ups, 'upgradeShield')),
        para(() => t('factShield'), ups, 'fact'),
      );
      break;
    }
    case 'solarMast': {
      node = el('div', {},
        header(() => t('solarMast'), () => t('count', { n: s.counts.solarMast }), ctx, ups),
        para(() => (cyclePhase(s.time).isDay ? t('solarNow', { n: ENERGY.solarPerMast.toFixed(1) }) : t('solarNight')), ups),
        para(() => `${t('generation')}: ${ctx.power().generation.toFixed(1)}/s · ${t('demand')}: ${ctx.power().demand.toFixed(1)}/s`, ups),
        el('div.row', {}, upgradeButton('solarMast', ctx, ups, 'buildAnother')),
        para(() => t('factPolarSun'), ups, 'fact'),
      );
      break;
    }
    case 'battery': {
      node = el('div', {},
        header(() => t('battery'), () => t('count', { n: s.counts.battery }), ctx, ups),
        para(() => t('batteryCharge', { p: Math.round((s.res.energy / capacity(s).energy) * 100) }), ups),
        para(() => t('capacity', { n: capacity(s).energy }), ups),
        el('div.row', {}, upgradeButton('battery', ctx, ups, 'buildAnother')),
        para(() => t('factNight'), ups, 'fact'),
      );
      break;
    }
    case 'robots': {
      node = el('div', {},
        header(() => t('robots'), () => '', ctx, ups),
        para(() => t('robotsInfo'), ups),
        toggle('robots', () => s.power.robots, (v) => act(ctx, { type: 'setPower', system: 'robots', on: v }, () => { s.power.robots = v; return true; }), ups),
        para(() => `${t('collectorRobot')} · ${s.levels.collectorRobot ? t('level', { n: s.levels.collectorRobot }) : t('notBuilt')}`, ups),
        el('div.row', {}, upgradeButton('collectorRobot', ctx, ups)),
        para(() => `${t('harvesterRobot')} · ${s.levels.harvesterRobot ? t('level', { n: 1 }) : t('notBuilt')}`, ups),
        el('div.row', {}, upgradeButton('harvesterRobot', ctx, ups)),
      );
      break;
    }
    case 'rover':
      node = el('div', {}, header(() => t('rover'), () => '', ctx, ups), para(() => t('roverInfo'), ups));
      break;
    case 'antenna':
      node = el('div', {}, header(() => t('antenna'), () => '', ctx, ups), para(() => t('antennaInfo'), ups));
      break;
    case 'lander':
      node = el('div', {},
        header(() => t('lander'), () => '', ctx, ups),
        para(() => t('landerInfo'), ups),
        para(() => t('bagInfo', { n: s.levels.bag, cap: carryMax(s), dig: digYield(s) }), ups),
        el('div.row', {}, upgradeButton('bag', ctx, ups, 'upgradeBag')),
        // Saved games (free mode only): the lander's computer keeps the mission file.
        ...(ctx.mission ? [] : [
          el('h4.section', {}, t('savesTitle')),
          para(() => t('savesInfo'), ups, 'fact'),
          el('div.row', {},
            actionButton('exportSave', () => ctx.exportGame?.(), ups),
            actionButton('importSave', () => ctx.importGame?.(), ups)),
          el('div.row', {}, actionButton('newGame', () => { if (confirm(t('newGameConfirm'))) ctx.newGame?.(); }, ups)),
        ]),
      );
      break;
  }

  const panel = el('div.panel.interactive', {}, node!);
  const update = () => ups.forEach((u) => u());
  update();
  return { el: panel, update };
}

/** Build menu: every building with its level and the button to build or upgrade it. */
export function makeBuildMenu(ctx: PanelContext): Panel {
  const ups: Updater[] = [];
  const s = ctx.s;
  const rows: [BuildingKind, StringKey][] = [
    ['station', 'station'], ['greenhouse', 'greenhouse'], ['processor', 'processor'], ['solarMast', 'solarMast'],
    ['battery', 'battery'], ['collectorRobot', 'collectorRobot'], ['harvesterRobot', 'harvesterRobot'], ['shield', 'shieldBerm'],
  ];
  const list = rows.map(([kind, name]) => {
    const info = el('span.sub');
    ups.push(() => {
      const n = currentLevel(s, kind);
      setText(info, kind === 'solarMast' || kind === 'battery' ? t('count', { n }) : n ? t('level', { n }) : t('notBuilt'));
    });
    return el('div.toggle', {}, el('span', {}, t(name), ' ', info), upgradeButton(kind, ctx, ups, kind === 'solarMast' || kind === 'battery' ? 'buildAnother' : 'upgrade'));
  });
  const node = el('div', {}, header(() => t('menuBuild'), () => `${t('materials')}: ${Math.floor(s.res.materials)}`, ctx, ups), ...list);
  const panel = el('div.panel.interactive', {}, node);
  const update = () => ups.forEach((u) => u());
  update();
  return { el: panel, update };
}

/** Power panel: what stays on, especially at night when the battery must last. */
export function makePowerPanel(ctx: PanelContext): Panel {
  const ups: Updater[] = [];
  const s = ctx.s;
  const slider = el('input.hw-range', { type: 'range', min: 0, max: 100, step: 5 }) as HTMLInputElement;
  slider.addEventListener('input', () => act(ctx, { type: 'setGrowLights', value: Number(slider.value) }, () => { s.power.growLights = Number(slider.value); return true; }));
  const lightsVal = el('span.sub');
  ups.push(() => {
    if (document.activeElement !== slider) slider.value = String(s.power.growLights);
    setText(lightsVal, `${s.power.growLights}`);
  });
  const shortage = para(() => (ctx.power().shortage ? t('shortage') : ''), ups, 'reason');
  const node = el('div', {},
    header(() => t('powerTitle'), () => '', ctx, ups),
    para(() => t('powerHint'), ups),
    para(() => `${t('generation')}: ${ctx.power().generation.toFixed(1)}/s · ${t('demand')}: ${ctx.power().demand.toFixed(1)}/s`, ups),
    toggle('heating', () => s.power.heating, (v) => act(ctx, { type: 'setPower', system: 'heating', on: v }, () => { s.power.heating = v; return true; }), ups),
    toggle('processor', () => s.power.processor, (v) => act(ctx, { type: 'setPower', system: 'processor', on: v }, () => { s.power.processor = v; return true; }), ups),
    toggle('robots', () => s.power.robots, (v) => act(ctx, { type: 'setPower', system: 'robots', on: v }, () => { s.power.robots = v; return true; }), ups),
    el('div.toggle', {}, el('span', {}, t('growLights'), ' ', lightsVal)),
    slider,
    shortage,
    para(() => t('factNight'), ups, 'fact'),
  );
  const panel = el('div.panel.interactive', {}, node);
  const update = () => ups.forEach((u) => u());
  update();
  return { el: panel, update };
}
