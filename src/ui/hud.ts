import * as THREE from 'three';
import { SHIELD } from '../game/config';
import { capacity, lifeSupportPercent, type PowerReport } from '../game/sim';
import { cyclePhase, type GameState } from '../game/state';
import { el, setText } from './dom';
import { getLang, onLangChange, setLang, t, type StringKey } from './i18n';
import { makeBuildMenu, makePanel, makePowerPanel, type Panel, type PanelContext, type PanelKind } from './panels';
import './hud.css';

// Heads-up display: resources (top left), Build and Power (bottom left), shelter (bottom
// right), language (top right), floating feedback, and the panel of the tapped object,
// which follows that object on screen.

interface HudDeps {
  s: GameState;
  camera: THREE.Camera;
  power(): PowerReport;
  changed(): void;
  poke(target: THREE.Object3D | null): void;
}

interface Floater { node: HTMLElement; world: THREE.Vector3; age: number }

export class Hud {
  private root = el('div', { id: 'hud' });
  private panel: { panel: Panel; anchor: THREE.Object3D | null; kind: string } | null = null;
  private floaters: Floater[] = [];
  private textTimer = 0;
  private rows: Record<string, { row: HTMLElement; fill: HTMLElement; num: HTMLElement }> = {};
  private sub = el('div.res-sub');
  private foot = { mat: el('b'), reg: el('b'), day: el('span') };
  private shelterBtn: HTMLButtonElement;
  private hint = el('div.hint');
  private healthRow: HTMLElement;

  constructor(private deps: HudDeps) {
    const res = el('div.hw', { id: 'resources' });
    for (const key of ['lifeSupport', 'energy', 'shield', 'crewHealth'] as StringKey[]) {
      const fill = el('div.fill');
      const num = el('span.num');
      const row = el('div.res-row', {}, el('span', { 'data-label': key }, t(key)), el('div.track', {}, fill), num);
      this.rows[key] = { row, fill, num };
      res.append(row);
      if (key === 'lifeSupport') res.append(this.sub);
    }
    this.healthRow = this.rows.crewHealth.row;
    res.append(el('div.res-foot', {}, el('span', {}, el('span', { 'data-label': 'materials' }, t('materials')), ' ', this.foot.mat),
      el('span', {}, el('span', { 'data-label': 'regolith' }, t('regolith')), ' ', this.foot.reg)));
    res.append(el('div.res-foot', {}, this.foot.day));

    const buildBtn = el('button.hw', { onclick: () => this.toggleMenu('build') }, el('span', { 'data-label': 'menuBuild' }, t('menuBuild')));
    const powerBtn = el('button.hw', { onclick: () => this.toggleMenu('power') }, el('span', { 'data-label': 'menuPower' }, t('menuPower')));
    this.shelterBtn = el('button.hw.danger', { id: 'shelter', onclick: () => { deps.s.sheltered = !deps.s.sheltered; this.refreshText(); } });

    const langBox = el('div.hw.interactive', { id: 'lang' });
    const langButtons = (['es', 'en'] as const).map((l) => el('button', { onclick: () => setLang(l) }, l.toUpperCase()));
    langBox.append(...langButtons);
    const markLang = () => langButtons.forEach((b, i) => b.classList.toggle('on', ['es', 'en'][i] === getLang()));
    markLang();

    this.root.append(res, el('div', { id: 'actions' }, buildBtn, powerBtn), this.shelterBtn, langBox, this.hint);
    document.body.append(this.root);

    onLangChange(() => {
      markLang();
      this.root.querySelectorAll<HTMLElement>('[data-label]').forEach((n) => setText(n, t(n.dataset.label as StringKey)));
      // Panels are rebuilt so every label switches language.
      if (this.panel) this.reopen();
      this.refreshText();
    });
    this.refreshText();
  }

  private context(anchor: THREE.Object3D | null): PanelContext {
    return {
      s: this.deps.s,
      power: this.deps.power,
      changed: this.deps.changed,
      say: (text, warn) => this.float(this.anchorPoint(anchor) ?? this.screenCenterWorld(), text, warn),
      poke: () => this.deps.poke(anchor),
      close: () => this.close(),
    };
  }

  /** Open the panel of a tapped 3D object. */
  open(kind: PanelKind, anchor: THREE.Object3D): void {
    if (this.panel?.anchor === anchor) return this.close();
    this.show(makePanel(kind, this.context(anchor)), anchor, kind);
  }

  private toggleMenu(which: 'build' | 'power'): void {
    if (this.panel?.kind === which) return this.close();
    const ctx = this.context(null);
    this.show(which === 'build' ? makeBuildMenu(ctx) : makePowerPanel(ctx), null, which);
  }

  private reopen(): void {
    const p = this.panel!;
    this.close();
    if (p.kind === 'build' || p.kind === 'power') this.toggleMenu(p.kind);
    else if (p.anchor) this.open(p.kind as PanelKind, p.anchor);
  }

  private show(panel: Panel, anchor: THREE.Object3D | null, kind: string): void {
    this.close();
    this.panel = { panel, anchor, kind };
    this.root.append(panel.el);
    this.place();
  }

  close(): void {
    this.panel?.panel.el.remove();
    this.panel = null;
  }

  isOpen(): boolean {
    return this.panel !== null;
  }

  /** Floating text that rises from a point in the world. */
  float(world: THREE.Vector3, text: string, warn = false): void {
    if (!text) return;
    const node = el(`div.float${warn ? '.warn' : ''}`, {}, text);
    this.root.append(node);
    this.floaters.push({ node, world: world.clone(), age: 0 });
  }

  private anchorPoint(o: THREE.Object3D | null): THREE.Vector3 | null {
    if (!o) return null;
    const box = new THREE.Box3().setFromObject(o);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  }

  private screenCenterWorld(): THREE.Vector3 {
    return new THREE.Vector3(0, 2, 0);
  }

  private toScreen(world: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = world.clone().project(this.deps.camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, visible: p.z < 1 };
  }

  /** Keep the open panel beside its object (or above the bottom bar for menus). */
  private place(): void {
    if (!this.panel) return;
    const node = this.panel.panel.el;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x: number;
    let y: number;
    const pt = this.anchorPoint(this.panel.anchor);
    if (pt) {
      const sp = this.toScreen(pt);
      x = sp.x < W / 2 ? sp.x + 40 : sp.x - 40 - w;
      y = sp.y - h / 2;
    } else {
      x = 10;
      y = H - h - 70;
    }
    node.style.left = `${Math.max(8, Math.min(W - w - 8, x))}px`;
    node.style.top = `${Math.max(8, Math.min(H - h - 8, y))}px`;
  }

  private refreshText(): void {
    const s = this.deps.s;
    const cap = capacity(s);
    const set = (key: string, pct: number, label?: string) => {
      const r = this.rows[key];
      const v = Math.max(0, Math.min(100, pct));
      r.fill.style.width = `${v}%`;
      setText(r.num, label ?? String(Math.round(v)));
      r.row.classList.toggle('warn', v < 20 && v >= 10);
      r.row.classList.toggle('danger', v < 10);
    };
    set('lifeSupport', lifeSupportPercent(s));
    setText(this.sub, `O₂ ${Math.floor(s.res.o2)} · ${t('water')} ${Math.floor(s.res.water)} · ${t('food')} ${Math.floor(s.res.food)}`);
    set('energy', (s.res.energy / cap.energy) * 100);
    const shield = Math.min(100, SHIELD.base + SHIELD.perBermLevel * s.levels.shield + (s.sheltered ? SHIELD.shelterBonus : 0));
    set('shield', shield);
    set('crewHealth', s.crewHealth);
    this.healthRow.style.display = s.crewHealth < 99.5 ? '' : 'none';
    setText(this.foot.mat, String(Math.floor(s.res.materials)));
    setText(this.foot.reg, String(Math.floor(s.res.regolith)));
    const ph = cyclePhase(s.time);
    setText(this.foot.day, (ph.isDay ? t('dayLeft', { m: Math.ceil(ph.secondsLeft / 60) }) : t('nightLeft', { m: Math.ceil(ph.secondsLeft / 60) })));
    setText(this.shelterBtn, s.sheltered ? t('leaveShelter') : t('goShelter'));
    setText(this.hint, t('tapGround'));
    this.hint.style.display = s.stats.regolithCollected < 15 && !this.panel ? '' : 'none';
    this.panel?.panel.update();
  }

  update(dt: number): void {
    this.textTimer += dt;
    if (this.textTimer > 0.1) {
      this.textTimer = 0;
      this.refreshText();
    }
    this.place();
    for (const f of this.floaters) {
      f.age += dt;
      const sp = this.toScreen(f.world);
      f.node.style.left = `${sp.x}px`;
      f.node.style.top = `${sp.y - f.age * 40}px`;
      f.node.style.opacity = String(Math.max(0, 1 - f.age / 1.4));
    }
    this.floaters = this.floaters.filter((f) => {
      if (f.age < 1.4) return true;
      f.node.remove();
      return false;
    });
  }
}
