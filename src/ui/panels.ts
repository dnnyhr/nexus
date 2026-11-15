import type { Command, CommandResult } from '../engine/types';
import { build, checkBuild, currentLevel, nextCost } from '../game/build';
import { ENERGY, POWER, PROCESSOR, type BuildingKind, type Circuit } from '../game/config';
import { movePriority, priorityOf } from '../game/power';
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
  /** Mission mode: actions become commands; without it, free mode mutates the state as always. */
  dispatch?(cmd: Command): CommandResult;
  /** Mission mode: nothing is built, upgraded or reset during operation. */
  mission?: boolean;
}

const CIRCUIT_LABEL: Record<Circuit, StringKey> = {
  lifeSupport: 'lifeSupport', heating: 'heating', processor: 'processor', robots: 'robots', greenhouse: 'greenhouse',
};

/** Run an action: as a command in mission mode, as before in free mode. Says why when it fails. */
function act(ctx: PanelContext, cmd: Command, free: () => boolean, fail: string): boolean {
  if (ctx.dispatch) {
    const r = ctx.dispatch(cmd);
    if (!r.ok) ctx.say(r.reason ?? fail, true);
    return r.ok;
  }
  const ok = free();
  if (!ok) ctx.say(fail, true);
  return ok;
}

function setSystem(ctx: PanelContext, system: 'heating' | 'processor' | 'robots' | 'greenhouse', on: boolean): void {
  if (ctx.dispatch) {
    const r = ctx.dispatch({ type: 'setPower', system, on });
    if (!r.ok && r.reason) ctx.say(r.reason, true);
  } else {
    ctx.s.power[system] = on;
  }
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
  if (ctx.mission) {
    const none = el('span');
    none.hidden = true;
    return none;
  }
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
          actionButton('irrigate', () => { if (act(ctx, { type: 'irrigate' }, () => irrigate(s), t('noWater'))) ctx.poke(); }, ups, () => '· 2'),
          actionButton('heat', () => { act(ctx, { type: 'adjustClimate', dir: 1 }, () => adjustClimate(s, 1), t('noEnergy')); }, ups),
          actionButton('cool', () => { act(ctx, { type: 'adjustClimate', dir: -1 }, () => adjustClimate(s, -1), t('noEnergy')); }, ups),
        ),
        el('div.row', {},
          actionButton('harvest', () => {
            const before = s.res.food;
            let food = 0;
            if (act(ctx, { type: 'harvest' }, () => (food = harvest(s)) > 0, t('notReady'))) {
              ctx.poke();
              ctx.say(t('harvested', { n: ctx.dispatch ? Math.round(s.res.food - before) : food }));
            }
          }, ups),
          actionButton('replant', () => { act(ctx, { type: 'replant' }, () => replant(s), t('needMaterials', { n: 8 })); }, ups, () => '· 8'),
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
        toggle('processor', () => s.power.processor, (v) => setSystem(ctx, 'processor', v), ups),
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
        toggle('robots', () => s.power.robots, (v) => setSystem(ctx, 'robots', v), ups),
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
        ...(ctx.mission ? [] : [el('div.row', {}, actionButton('newGame', () => { if (confirm(t('newGameConfirm'))) ctx.newGame?.(); }, ups))]),
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

/** Ranked circuits with up/down buttons. Rows stay put; only their contents follow the order. */
function priorityList(ctx: PanelContext, ups: Updater[]): HTMLElement {
  const s = ctx.s;
  const setOrder = (order: Circuit[]) => {
    if (ctx.dispatch) {
      const r = ctx.dispatch({ type: 'setPriority', order });
      if (!r.ok && r.reason) ctx.say(r.reason, true);
    } else {
      s.power.priority = order;
    }
  };
  const title = el('p.label');
  const hint = el('p.fact');
  ups.push(() => { setText(title, t('sysPriority')); setText(hint, t('sysPriorityHint')); });
  const rows = POWER.circuits.map((_, i) => {
    const name = el('span');
    const up = el('button.t-btn', { onclick: () => setOrder(movePriority(priorityOf(s), priorityOf(s)[i], -1)) }, '▲');
    const down = el('button.t-btn', { onclick: () => setOrder(movePriority(priorityOf(s), priorityOf(s)[i], 1)) }, '▼');
    const row = el('div.toggle', {}, name, el('span', {}, up, ' ', down));
    ups.push(() => {
      const c = priorityOf(s)[i];
      const shed = ctx.power().shed?.includes(c) ?? false;
      const tag = c === 'lifeSupport' ? ` · ${t('sysCritical')}` : '';
      setText(name, `${i + 1}. ${t(CIRCUIT_LABEL[c])}${tag}${shed ? ` · ${t('sysShed')}` : ''}`);
      row.classList.toggle('off', shed);
      up.disabled = i === 0;
      down.disabled = i === POWER.circuits.length - 1;
      up.setAttribute('aria-label', t('sysUp', { x: t(CIRCUIT_LABEL[c]) }));
      down.setAttribute('aria-label', t('sysDown', { x: t(CIRCUIT_LABEL[c]) }));
    });
    return row;
  });
  return el('div', {}, title, ...rows, hint);
}

/** Power panel: what stays on, especially at night when the battery must last. */
export function makePowerPanel(ctx: PanelContext): Panel {
  const ups: Updater[] = [];
  const s = ctx.s;
  const slider = el('input.hw-range', { type: 'range', min: 0, max: 100, step: 5 }) as HTMLInputElement;
  if (ctx.dispatch) {
    slider.addEventListener('change', () => {
      const r = ctx.dispatch!({ type: 'setGrowLights', value: Number(slider.value) });
      if (!r.ok && r.reason) ctx.say(r.reason, true);
    });
  } else {
    slider.addEventListener('input', () => (s.power.growLights = Number(slider.value)));
  }
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
    ...(ctx.mission ? [para(() => `${t('sysAvailable')}: ${(ctx.power().available ?? 0).toFixed(1)}/s`, ups)] : []),
    toggle('heating', () => s.power.heating, (v) => setSystem(ctx, 'heating', v), ups),
    toggle('processor', () => s.power.processor, (v) => setSystem(ctx, 'processor', v), ups),
    toggle('robots', () => s.power.robots, (v) => setSystem(ctx, 'robots', v), ups),
    toggle('greenhouse', () => s.power.greenhouse, (v) => setSystem(ctx, 'greenhouse', v), ups),
    el('div.toggle', {}, el('span', {}, t('growLights'), ' ', lightsVal)),
    slider,
    shortage,
    priorityList(ctx, ups),
    para(() => t('factNight'), ups, 'fact'),
  );
  const panel = el('div.panel.interactive', {}, node);
  const update = () => ups.forEach((u) => u());
  update();
  return { el: panel, update };
}
