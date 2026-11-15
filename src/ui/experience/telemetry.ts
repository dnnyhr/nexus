import { el, setText } from '../dom';
import { isCompactViewport, loadPrefs, savePrefs } from '../disclosure';
import { getLang, onLangChange, t, type StringKey } from '../i18n';
import {
  formatTrend,
  riskForExposure,
  riskForPercent,
  tacticalDirective,
  trendOf,
  type Directive,
  type Risk,
  type TrendDirection,
} from './logic';
import './experience.css';

export type TelemetryResource = 'o2' | 'water' | 'food' | 'energy' | 'exposure';

export interface TelemetrySnapshot {
  updatedAt: number;
  o2: number;
  water: number;
  food: number;
  energy: number;
  exposure?: number;
  exposureLimit?: number;
  generation?: number;
  demand?: number;
  dark?: boolean;
  sheltered?: boolean;
  storm?: boolean;
  directive?: { key: StringKey; vars?: Record<string, string | number>; risk?: Risk } | null;
}

export interface TelemetryRibbonOptions {
  getSnapshot(): TelemetrySnapshot;
  onOpenPower?(): void;
  onOpenCommander?(): void;
}

export interface TelemetryRibbonHandle {
  readonly el: HTMLElement;
  update(force?: boolean): void;
  setDensity(density: 'full' | 'compact'): void;
  destroy(): void;
}

interface Reading {
  field: TelemetryResource;
  labelKey: StringKey;
  node: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
  unit: HTMLElement;
  trend: HTMLElement;
  flag: HTMLElement;
  trendDir: TrendDirection;
  trendRate: number;
}

const READING_META: { field: TelemetryResource; labelKey: StringKey; unit: '%' | 'u' }[] = [
  { field: 'o2', labelKey: 'o2', unit: '%' },
  { field: 'water', labelKey: 'water', unit: '%' },
  { field: 'food', labelKey: 'food', unit: '%' },
  { field: 'energy', labelKey: 'energy', unit: '%' },
  { field: 'exposure', labelKey: 'telExposure', unit: 'u' },
];

const RISK_KEY: Record<Risk, StringKey> = {
  ok: 'telRiskOk',
  caution: 'telRiskCaution',
  critical: 'telRiskCritical',
};

const TREND_KEY: Record<Exclude<TrendDirection, 0>, StringKey> = {
  [-1]: 'telTrendFalling',
  1: 'telTrendRising',
};

function timeText(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return t('telNoData');
  const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
  return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function snapshotValue(snapshot: TelemetrySnapshot, field: TelemetryResource): number | undefined {
  if (field === 'exposure') return snapshot.exposure;
  return snapshot[field];
}

function displayValue(field: TelemetryResource, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return t('telNoData');
  if (field === 'exposure') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(Math.round(value));
}

function readingRisk(field: TelemetryResource, value: number | undefined, snapshot: TelemetrySnapshot): Risk {
  if (field === 'exposure') return riskForExposure(value, snapshot.exposureLimit);
  return value === undefined ? 'caution' : riskForPercent(value);
}

class TelemetryRibbon implements TelemetryRibbonHandle {
  readonly el: HTMLElement;
  private readings = new Map<TelemetryResource, Reading>();
  private brandText: HTMLElement;
  private updated: HTMLElement;
  private directiveLabel: HTMLElement;
  private directiveText: HTMLElement;
  private directiveBox: HTMLElement;
  private powerButton: HTMLButtonElement | null = null;
  private commanderButton: HTMLButtonElement | null = null;
  private densityButton: HTMLButtonElement;
  private density: 'full' | 'compact' = 'full';
  private chips: Record<'dark' | 'sheltered' | 'storm', HTMLElement>;
  private sample: Partial<Record<TelemetryResource, number>> = {};
  private sampleAt = 0;
  private lastRender = 0;
  private lastSnapshot: TelemetrySnapshot | null = null;
  private lastDirective = '';
  private timer: number;
  private unsubscribe: () => void;

  constructor(private options: TelemetryRibbonOptions) {
    this.brandText = el('span.x-tel__brand-text', {}, t('telTitle'));
    this.updated = el('span.x-tel__updated');
    this.directiveLabel = el('span.x-tel__dir-label', {}, t('telDirective'));
    this.directiveText = el('span.x-tel__dir-text');
    this.directiveBox = el('div.x-tel__directive', { 'data-risk': 'ok' }, this.directiveLabel, this.directiveText);
    this.chips = {
      dark: el('span.x-tel__chip', { hidden: true }, t('telDarkChip')),
      sheltered: el('span.x-tel__chip', { hidden: true }, t('telShelterChip')),
      storm: el('span.x-tel__chip.x-tel__chip--danger', { hidden: true }, t('telStormChip')),
    };

    const readingNodes = READING_META.map((meta) => {
      const label = el('span.x-read__label', {}, t(meta.labelKey));
      const value = el('span.x-read__value', {}, t('telNoData'));
      const unit = el('span.x-read__unit', {}, meta.unit);
      const trend = el('span.x-read__trend', { 'aria-hidden': 'true' }, '=');
      const flag = el('span.x-sr-only');
      const node = el(`div.x-read.x-read--${meta.field}`, { 'data-risk': 'ok', role: 'group' },
        label,
        el('span.x-read__main', {}, value, unit),
        trend,
        flag,
      );
      const reading: Reading = { ...meta, node, label, value, unit, trend, flag, trendDir: 0, trendRate: 0 };
      this.readings.set(meta.field, reading);
      return node;
    });

    const actions = el('div.x-tel__actions');
    const onOpenPower = options.onOpenPower;
    if (onOpenPower) {
      this.powerButton = el('button.x-tel__btn', { type: 'button', onclick: onOpenPower }, t('telOpenSystems'));
      actions.append(this.powerButton);
    }
    const onOpenCommander = options.onOpenCommander;
    if (onOpenCommander) {
      this.commanderButton = el('button.x-tel__btn', { type: 'button', onclick: onOpenCommander }, t('telOpenCommander'));
      actions.append(this.commanderButton);
    }

    this.densityButton = el('button.x-tel__btn.x-tel__density', { type: 'button' });
    this.densityButton.addEventListener('click', () => {
      this.setDensity(this.density === 'full' ? 'compact' : 'full');
    });

    const status = el('div.x-tel__status', {},
      this.chips.dark,
      this.chips.sheltered,
      this.chips.storm,
      this.updated,
      this.densityButton,
      actions,
    );

    this.el = el('section.x-tel', { 'aria-label': t('telTitle') },
      el('div.x-tel__main', {},
        el('div.x-tel__brand', {},
          el('span.x-tel__pulse', { 'aria-hidden': 'true' }),
          this.brandText,
        ),
        el('div.x-tel__readings', {}, ...readingNodes),
        status,
      ),
      this.directiveBox,
    );

    this.unsubscribe = onLangChange(() => this.applyLabels());
    const prefs = loadPrefs();
    const initial = prefs.telemetry === 'compact' ? 'compact' : (isCompactViewport() ? 'compact' : 'full');
    this.setDensity(initial, false);
    this.timer = window.setInterval(() => {
      if (this.lastSnapshot) this.renderUpdated(this.lastSnapshot, Date.now());
    }, 1000);
  }

  setDensity(density: 'full' | 'compact', persist = true): void {
    this.density = density;
    this.el.classList.toggle('is-compact', density === 'compact');
    const label = t(density === 'compact' ? 'telFull' : 'telCompact');
    this.densityButton.textContent = label;
    this.densityButton.setAttribute('aria-label', label);
    this.densityButton.setAttribute('aria-pressed', String(density === 'compact'));
    if (persist) {
      const prefs = loadPrefs();
      (prefs as Record<string, string>).telemetry = density;
      savePrefs(prefs);
    }
  }

  update(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRender < 250) return;
    this.lastRender = now;
    const snapshot = this.options.getSnapshot();
    this.lastSnapshot = snapshot;

    if (now - this.sampleAt >= 1000 || !this.sampleAt) {
      const seconds = Math.max(0.25, (now - this.sampleAt) / 1000);
      for (const reading of this.readings.values()) {
        const value = snapshotValue(snapshot, reading.field);
        if (value === undefined || !Number.isFinite(value)) {
          reading.trendDir = 0;
          reading.trendRate = 0;
          delete this.sample[reading.field];
          continue;
        }
        const previous = this.sample[reading.field];
        reading.trendDir = trendOf(value, previous, 0.1);
        reading.trendRate = previous === undefined ? 0 : (value - previous) / seconds;
        this.sample[reading.field] = value;
      }
      this.sampleAt = now;
    }

    for (const reading of this.readings.values()) {
      const value = snapshotValue(snapshot, reading.field);
      const visible = value !== undefined && Number.isFinite(value);
      reading.node.hidden = reading.field === 'exposure' && !visible;
      const risk = readingRisk(reading.field, value, snapshot);
      const shown = displayValue(reading.field, value);
      const trend = reading.trendDir;
      reading.node.dataset.risk = risk;
      setText(reading.value, shown);
      setText(reading.unit, reading.field === 'exposure' ? t('telUnitU') : '%');
      setText(reading.trend, trend === 0 ? '=' : trend > 0 ? '▲' : '▼');
      const trendWord = trend === 0 ? t('telTrendSteady') : t(TREND_KEY[trend]);
      reading.trend.title = trend === 0 ? trendWord : `${trendWord} ${t('perSecond', { n: formatTrend(reading.trendRate) })}`;
      reading.flag.textContent = t(RISK_KEY[risk]);
      const label = t(reading.labelKey);
      reading.node.setAttribute('aria-label', `${label} ${shown}${reading.unit.textContent} · ${trendWord} · ${t(RISK_KEY[risk])}`);
    }

    this.chips.dark.hidden = !snapshot.dark;
    this.chips.sheltered.hidden = !snapshot.sheltered;
    this.chips.storm.hidden = !snapshot.storm;
    this.renderUpdated(snapshot, now);
    this.renderDirective(snapshot);
  }

  destroy(): void {
    window.clearInterval(this.timer);
    this.unsubscribe();
    this.el.remove();
  }

  private renderUpdated(snapshot: TelemetrySnapshot, now: number): void {
    const stale = now - snapshot.updatedAt > 5000;
    this.el.classList.toggle('is-stale', stale);
    const text = stale
      ? t('telStale')
      : t('telUpdated', { t: timeText(snapshot.updatedAt) });
    setText(this.updated, text);
    if (Number.isFinite(snapshot.updatedAt)) this.updated.title = new Date(snapshot.updatedAt).toLocaleString(getLang() === 'es' ? 'es-ES' : 'en-US');
  }

  private renderDirective(snapshot: TelemetrySnapshot): void {
    const computed = tacticalDirective({
      o2: snapshot.o2,
      water: snapshot.water,
      food: snapshot.food,
      energy: snapshot.energy,
      generation: snapshot.generation ?? 0,
      demand: snapshot.demand ?? 0,
      exposure: snapshot.exposure ?? 0,
      exposureLimit: snapshot.exposureLimit ?? 0,
      dark: !!snapshot.dark,
      sheltered: !!snapshot.sheltered,
      storm: !!snapshot.storm,
    });
    const directive: Directive = snapshot.directive
      ? { key: snapshot.directive.key, vars: snapshot.directive.vars, risk: snapshot.directive.risk ?? computed.risk }
      : computed;
    const text = t(directive.key, directive.vars);
    if (text !== this.lastDirective) {
      this.lastDirective = text;
      setText(this.directiveText, text);
    }
    this.directiveBox.dataset.risk = directive.risk;
  }

  private applyLabels(): void {
    this.el.setAttribute('aria-label', t('telTitle'));
    setText(this.brandText, t('telTitle'));
    setText(this.directiveLabel, t('telDirective'));
    setText(this.chips.dark, t('telDarkChip'));
    setText(this.chips.sheltered, t('telShelterChip'));
    setText(this.chips.storm, t('telStormChip'));
    if (this.powerButton) {
      setText(this.powerButton, t('telOpenSystems'));
      this.powerButton.setAttribute('aria-label', t('telOpenSystems'));
    }
    if (this.commanderButton) {
      setText(this.commanderButton, t('telOpenCommander'));
      this.commanderButton.setAttribute('aria-label', t('telOpenCommander'));
    }
    for (const reading of this.readings.values()) setText(reading.label, t(reading.labelKey));
    const densityLabel = t(this.density === 'compact' ? 'telFull' : 'telCompact');
    this.densityButton.textContent = densityLabel;
    this.densityButton.setAttribute('aria-label', densityLabel);
    this.lastDirective = '';
    if (this.lastSnapshot) {
      this.renderUpdated(this.lastSnapshot, Date.now());
      this.renderDirective(this.lastSnapshot);
    }
  }
}

export function mountTelemetryRibbon(root: HTMLElement, options: TelemetryRibbonOptions): TelemetryRibbonHandle {
  const ribbon = new TelemetryRibbon(options);
  root.append(ribbon.el);
  ribbon.update(true);
  return ribbon;
}
