import { el, setText } from '../dom';
import { onLangChange, t, type StringKey } from '../i18n';
import type { Circuit } from '../../game/config';
import { formatRate, riskForPercent, type Risk } from './logic';
import { mountDisclosure, type DisclosureHandle, type SurfaceState } from '../disclosure';
import './experience.css';

export type BreakerSystem = 'heating' | 'processor' | 'robots' | 'greenhouse';

export interface SystemsSnapshot {
  energy: number;
  generation: number;
  demand: number;
  lights: number;
  breakers: Record<BreakerSystem, boolean>;
  dark?: boolean;
  sheltered?: boolean;
  shortage?: boolean;
  lightsDraw?: number;
  /** Feeding order in force (first is fed first). Shown only with onPriority. */
  priority?: readonly Circuit[];
  /** Circuits that asked for power this step and did not get all of it. */
  shed?: readonly Circuit[];
  /** Generation plus what the batteries can deliver this step. */
  available?: number;
  cause?: { key: StringKey; vars?: Record<string, string | number>; risk?: Risk } | null;
}

export interface SystemsHudOptions {
  getSnapshot(): SystemsSnapshot;
  onBreaker(system: BreakerSystem, on: boolean): void;
  onLights(value: number): void;
  /** Reorder circuits; when present, the priority list is shown. */
  onPriority?(order: Circuit[]): void;
  canCommand?(): boolean;
  initialCollapsed?: boolean;
}

export interface SystemsHudHandle {
  readonly el: HTMLElement;
  update(force?: boolean): void;
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
  destroy(): void;
}

const BREAKERS: { id: BreakerSystem; labelKey: StringKey }[] = [
  { id: 'heating', labelKey: 'heating' },
  { id: 'processor', labelKey: 'processor' },
  { id: 'robots', labelKey: 'robots' },
  { id: 'greenhouse', labelKey: 'greenhouse' },
];

const CIRCUIT_KEYS: Record<Circuit, StringKey> = {
  lifeSupport: 'lifeSupport', heating: 'heating', processor: 'processor', robots: 'robots', greenhouse: 'greenhouse',
};

interface PriorityRow { name: HTMLElement; up: HTMLButtonElement; down: HTMLButtonElement; row: HTMLElement }

let uid = 0;

class SystemsHud implements SystemsHudHandle {
  readonly el: HTMLElement;
  private toggle: HTMLButtonElement;
  private body: HTMLElement;
  private title: HTMLElement;
  private summaryEnergy: HTMLElement;
  private summaryNet: HTMLElement;
  private energyLabel: HTMLElement;
  private energyValue: HTMLElement;
  private bar: HTMLElement;
  private barFill: HTMLElement;
  private generationLabel: HTMLElement;
  private demandLabel: HTMLElement;
  private netLabel: HTMLElement;
  private generationValue: HTMLElement;
  private demandValue: HTMLElement;
  private netValue: HTMLElement;
  private cause: HTMLElement;
  private breakersLabel: HTMLElement;
  private breakerButtons = new Map<BreakerSystem, HTMLButtonElement>();
  private breakerLabels = new Map<BreakerSystem, HTMLElement>();
  private lightsLabel: HTMLElement;
  private lightsValue: HTMLElement;
  private lights: HTMLInputElement;
  private hint: HTMLElement;
  private availableLabel: HTMLElement;
  private availableValue: HTMLElement;
  private availableCell: HTMLElement;
  private priorityLabel: HTMLElement;
  private priorityHint: HTMLElement;
  private priorityRows: PriorityRow[] = [];
  private snap: SystemsSnapshot | null = null;
  private lastCause = '';
  private lastRender = 0;
  private disclosure: DisclosureHandle;
  private unsubscribe: () => void;

  constructor(private options: SystemsHudOptions) {
    const id = `x-sys-body-${++uid}`;
    this.title = el('span.x-sys__title', {}, t('sysTitle'));
    this.summaryEnergy = el('span.x-sys__summary-value');
    this.summaryNet = el('span.x-sys__summary-net');
    this.toggle = el('button.x-sys__toggle', {
      type: 'button',
      'aria-expanded': 'true',
      'aria-controls': id,
    },
    this.title,
    el('span.x-sys__summary', {}, this.summaryEnergy, this.summaryNet),
    el('span.x-sys__chevron', { 'aria-hidden': 'true' }),
    );

    this.energyLabel = el('span.x-sys__stat-label', {}, t('sysEnergyAvailable'));
    this.energyValue = el('span.x-sys__energy-value');
    this.bar = el('div.x-sys__bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 });
    this.barFill = el('i');
    this.bar.append(this.barFill);

    this.generationLabel = el('span.x-sys__stat-label', {}, t('sysGeneration'));
    this.demandLabel = el('span.x-sys__stat-label', {}, t('sysDemand'));
    this.netLabel = el('span.x-sys__stat-label', {}, t('sysNet'));
    this.generationValue = el('span.x-sys__stat-value');
    this.demandValue = el('span.x-sys__stat-value');
    this.netValue = el('span.x-sys__stat-value');
    this.availableLabel = el('span.x-sys__stat-label', {}, t('sysAvailable'));
    this.availableValue = el('span.x-sys__stat-value');
    this.availableCell = el('div', {}, this.availableLabel, this.availableValue);
    this.cause = el('p.x-sys__cause');

    this.breakersLabel = el('div.x-sys__section-label', {}, t('sysBreakers'));
    const breakerList = el('div.x-sys__breakers');
    for (const spec of BREAKERS) {
      const label = el('span.x-sys__breaker-name', {}, t(spec.labelKey));
      const state = el('span.x-sys__breaker-state');
      const button = el('button.x-sys__breaker', {
        type: 'button',
        'aria-pressed': 'false',
        onclick: () => {
          if (!this.commandAllowed()) return;
          const current = this.options.getSnapshot();
          this.options.onBreaker(spec.id, !current.breakers[spec.id]);
        },
      }, label, state);
      this.breakerButtons.set(spec.id, button);
      this.breakerLabels.set(spec.id, label);
      breakerList.append(button);
    }

    this.lightsLabel = el('span.x-sys__stat-label', {}, t('growLights'));
    this.lightsValue = el('span.x-sys__lights-value');
    this.lights = el('input.x-sys__range', {
      type: 'range',
      min: 0,
      max: 100,
      step: 5,
      'aria-label': t('growLights'),
    }) as HTMLInputElement;
    this.lights.addEventListener('input', () => setText(this.lightsValue, t('sysEnergyValue', { n: Math.round(Number(this.lights.value)) })));
    this.lights.addEventListener('change', () => {
      if (!this.commandAllowed()) return;
      this.options.onLights(Math.round(Number(this.lights.value)));
    });

    this.hint = el('p.x-sys__hint');

    this.priorityLabel = el('div.x-sys__section-label', {}, t('sysPriority'));
    this.priorityHint = el('p.x-sys__hint', {}, t('sysPriorityHint'));
    const priorityList = el('ol.x-sys__priority');
    const move = (i: number, dir: -1 | 1) => {
      if (!this.commandAllowed() || !this.options.onPriority) return;
      const order = [...(this.options.getSnapshot().priority ?? [])];
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      this.options.onPriority(order);
    };
    for (let i = 0; i < Object.keys(CIRCUIT_KEYS).length; i++) {
      const name = el('span.x-sys__priority-name');
      const up = el('button.x-sys__priority-move', { type: 'button', onclick: () => move(i, -1) }, '▲') as HTMLButtonElement;
      const down = el('button.x-sys__priority-move', { type: 'button', onclick: () => move(i, 1) }, '▼') as HTMLButtonElement;
      const row = el('li.x-sys__priority-row', {}, name, el('span.x-sys__priority-actions', {}, up, down));
      this.priorityRows.push({ name, up, down, row });
      priorityList.append(row);
    }
    const prioritySection = el('div.x-sys__priority-wrap', {}, this.priorityLabel, priorityList, this.priorityHint);
    prioritySection.hidden = !options.onPriority;

    this.body = el('div.x-sys__body', { id },
      el('div.x-sys__energy', {},
        el('div.x-sys__label-row', {}, this.energyLabel, this.energyValue),
        this.bar,
      ),
      el('div.x-sys__grid', {},
        el('div', {}, this.generationLabel, this.generationValue),
        el('div', {}, this.demandLabel, this.demandValue),
        el('div', {}, this.netLabel, this.netValue),
        this.availableCell,
      ),
      this.cause,
      this.breakersLabel,
      breakerList,
      el('label.x-sys__lights', {},
        el('span.x-sys__label-row', {}, this.lightsLabel, this.lightsValue),
        this.lights,
      ),
      prioritySection,
      this.hint,
    );

    this.el = el('aside.x-sys', { 'aria-label': t('sysTitle') }, this.toggle, this.body);
    const defaultState: SurfaceState = options.initialCollapsed ? 'closed' : 'open';
    this.disclosure = mountDisclosure(this.el, {
      id: 'systems',
      persist: true,
      defaultState,
      toggle: this.toggle,
      body: this.body,
      nameKey: 'sysTitle',
      mutexGroup: 'hud-mobile',
    });
    this.unsubscribe = onLangChange(() => this.applyLabels());
    this.update(true);
  }

  update(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRender < 250) return;
    this.lastRender = now;
    const snap = this.options.getSnapshot();
    this.snap = snap;
    const energy = Number.isFinite(snap.energy) ? snap.energy : 0;
    const risk = riskForPercent(energy);
    const net = snap.generation - snap.demand;
    const allowed = this.commandAllowed();

    this.disclosure.setRisk(risk);
    setText(this.summaryEnergy, t('sysEnergyValue', { n: Math.round(energy) }));
    setText(this.energyValue, t('sysEnergyValue', { n: Math.round(energy) }));
    setText(this.summaryNet, t('sysBalanceValue', { n: formatRate(net) }));
    this.bar.setAttribute('aria-valuenow', String(Math.round(energy)));
    this.bar.setAttribute('aria-valuetext', t('sysEnergyValue', { n: Math.round(energy) }));
    this.barFill.style.width = `${Math.max(0, Math.min(100, energy))}%`;
    setText(this.generationValue, t('perSecond', { n: snap.generation.toFixed(1) }));
    setText(this.demandValue, t('perSecond', { n: snap.demand.toFixed(1) }));
    setText(this.netValue, t('sysBalanceValue', { n: formatRate(net) }));
    this.netValue.dataset.sign = net > 0.05 ? 'positive' : net < -0.05 ? 'negative' : 'neutral';

    for (const spec of BREAKERS) {
      const on = snap.breakers[spec.id];
      const button = this.breakerButtons.get(spec.id);
      const label = this.breakerLabels.get(spec.id);
      if (!button || !label) continue;
      const state = button.querySelector('.x-sys__breaker-state');
      if (state) setText(state as HTMLElement, t(on ? 'on' : 'off'));
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `${t(spec.labelKey)} · ${t(on ? 'on' : 'off')}`);
      button.disabled = !allowed;
      setText(label, t(spec.labelKey));
    }

    this.availableCell.hidden = snap.available === undefined;
    if (snap.available !== undefined) setText(this.availableValue, t('perSecond', { n: snap.available.toFixed(1) }));

    const order = snap.priority ?? [];
    this.priorityRows.forEach((r, i) => {
      const circuit = order[i];
      r.row.hidden = !circuit;
      if (!circuit) return;
      const shed = snap.shed?.includes(circuit) ?? false;
      const tags = [circuit === 'lifeSupport' ? t('sysCritical') : '', shed ? t('sysShed') : ''].filter(Boolean).join(' · ');
      setText(r.name, `${i + 1}. ${t(CIRCUIT_KEYS[circuit])}${tags ? ` · ${tags}` : ''}`);
      r.row.classList.toggle('is-shed', shed);
      r.up.disabled = !allowed || i === 0;
      r.down.disabled = !allowed || i === order.length - 1;
      r.up.setAttribute('aria-label', t('sysUp', { x: t(CIRCUIT_KEYS[circuit]) }));
      r.down.setAttribute('aria-label', t('sysDown', { x: t(CIRCUIT_KEYS[circuit]) }));
    });

    if (document.activeElement !== this.lights) this.lights.value = String(Math.round(snap.lights));
    setText(this.lightsValue, t('sysEnergyValue', { n: Math.round(Number(this.lights.value)) }));
    this.lights.disabled = !allowed;
    this.lights.setAttribute('aria-label', `${t('growLights')} · ${t('sysEnergyValue', { n: Math.round(Number(this.lights.value)) })}`);

    const cause = this.causeText(snap);
    if (cause !== this.lastCause) {
      this.lastCause = cause;
      setText(this.cause, cause);
    }
    setText(this.hint, allowed ? t('sysHint') : t('sysPaused'));
    this.hint.classList.toggle('is-paused', !allowed);
  }

  setCollapsed(collapsed: boolean): void {
    this.disclosure.setState(collapsed ? 'closed' : 'open', 'user');
  }

  isCollapsed(): boolean {
    return this.disclosure.getState() !== 'open';
  }

  destroy(): void {
    this.unsubscribe();
    this.disclosure.destroy();
    this.el.remove();
  }

  private commandAllowed(): boolean {
    return this.options.canCommand?.() ?? true;
  }

  private causeText(snap: SystemsSnapshot): string {
    if (snap.cause) return t(snap.cause.key, snap.cause.vars);
    if (snap.shed?.includes('lifeSupport')) return t('sysCauseLifeSupport');
    if (snap.shed?.length && snap.available !== undefined) {
      return t('sysCauseLimit', { a: snap.available.toFixed(1), d: snap.demand.toFixed(1), x: snap.shed.map((c) => t(CIRCUIT_KEYS[c]).toLowerCase()).join(', ') });
    }
    if (snap.sheltered) return t('sysCauseSheltered');
    if (snap.shortage) return t('sysCauseShortage');
    if (snap.dark && snap.generation <= 0) return t('sysCauseDark');
    if (snap.lights > 0 && snap.lightsDraw !== undefined) {
      return t('sysCauseLights', { n: Math.round(snap.lights), p: snap.lightsDraw.toFixed(2) });
    }
    return t('sysCauseBalance', { g: snap.generation.toFixed(1), d: snap.demand.toFixed(1) });
  }

  private applyLabels(): void {
    setText(this.title, t('sysTitle'));
    setText(this.energyLabel, t('sysEnergyAvailable'));
    setText(this.generationLabel, t('sysGeneration'));
    setText(this.demandLabel, t('sysDemand'));
    setText(this.netLabel, t('sysNet'));
    setText(this.breakersLabel, t('sysBreakers'));
    setText(this.availableLabel, t('sysAvailable'));
    setText(this.priorityLabel, t('sysPriority'));
    setText(this.priorityHint, t('sysPriorityHint'));
    setText(this.lightsLabel, t('growLights'));
    this.el.setAttribute('aria-label', t('sysTitle'));
    for (const spec of BREAKERS) setText(this.breakerLabels.get(spec.id) ?? this.title, t(spec.labelKey));
    if (this.snap) {
      this.lastCause = '';
      this.update(true);
    }
  }
}

export function mountSystemsHud(root: HTMLElement, options: SystemsHudOptions): SystemsHudHandle {
  const hud = new SystemsHud(options);
  root.append(hud.el);
  return hud;
}
