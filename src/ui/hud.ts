import * as THREE from 'three';
import { SHIELD } from '../game/config';
import { currentMission, MISSIONS, type Mission } from '../game/missions';
import { capacity, lifeSupportPercent, type PowerReport } from '../game/sim';
import { cyclePhase, type GameState } from '../game/state';
import { el, setText } from './dom';
import { getLang, onLangChange, setLang, t, type StringKey } from './i18n';
import { Joystick } from './joystick';
import { makePanel, makePowerPanel, type Panel, type PanelContext, type PanelKind } from './panels';
import './hud.css';

// Telemetry-style HUD: round gauges and the mission timeline in a band along the bottom,
// radio transmissions at the top, and the action prompt floating next to the object the
// astronaut can use. Only what matters now is shown: gauges appear as systems get built.

interface HudDeps {
  s: GameState;
  camera: THREE.Camera;
  power(): PowerReport;
  changed(): void;
  poke(target: THREE.Object3D | null): void;
  action(): void;
  jump(): void;
  dig(): void;
}

interface Floater { node: HTMLElement; world: THREE.Vector3; age: number }

const C = 2 * Math.PI * 40; // gauge circumference (r = 40)

/** Round gauge: a 270° arc with the value in the middle and a label below. */
function roundGauge(label: StringKey) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  const arc = (cls: string) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '40');
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke-width', cls === 'val' ? '4' : '2');
    c.setAttribute('class', cls);
    c.setAttribute('transform', 'rotate(135 50 50)');
    c.setAttribute('stroke-dasharray', `${C * 0.75} ${C}`);
    svg.append(c);
    return c;
  };
  arc('track');
  const val = arc('val');
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('x', '50');
  text.setAttribute('y', '58');
  text.setAttribute('text-anchor', 'middle');
  svg.append(text);
  const name = el('div.label', { 'data-label': label }, t(label));
  const sub = el('div.sub');
  const node = el('div.gauge-r', {}, svg, name, sub);
  return {
    node,
    sub,
    set(pct: number) {
      const v = Math.max(0, Math.min(100, pct));
      val.setAttribute('stroke-dasharray', `${(C * 0.75 * v) / 100} ${C}`);
      text.textContent = String(Math.round(v));
      node.classList.toggle('warn', v < 20 && v >= 10);
      node.classList.toggle('danger', v < 10);
    },
  };
}

export class Hud {
  private root = el('div', { id: 'hud' });
  private panel: { panel: Panel; anchor: THREE.Object3D | null; kind: string } | null = null;
  private floaters: Floater[] = [];
  private textTimer = 0;
  private gauges = { life: roundGauge('lifeSupport'), energy: roundGauge('energy'), shield: roundGauge('shield') };
  private goal = el('div.goal');
  private missionTag = el('div.label');
  private clockLabel = el('span.label');
  private clockValue = el('span.big');
  private rail = el('div.rail');
  private railDone = el('div.done-line');
  private nodes: HTMLElement[] = [];
  private counts = { mat: el('div.big'), reg: el('div.big'), bag: el('div.big') };
  private jumpDown = false;
  private powerBtn: HTMLButtonElement;
  private shelterBtn: HTMLButtonElement;
  private radioBox = el('div', { id: 'radio', class: 'hidden interactive' });
  private radioFrom = el('span.label');
  private radioMsg = el('div.msg');
  private radioQueue: { from: string; text: string; delay: number }[] = [];
  private radioTyping: { text: string; shown: number } | null = null;
  private prompt = el('button', { id: 'prompt', class: 'hidden' });
  private promptAnchor: THREE.Vector3 | null = null;
  private hint = el('div.hint');
  private arrow = el('div', { id: 'target-arrow' }, el('div.chev'), el('span.dist'));
  private target: { world: THREE.Vector3; from: THREE.Vector3 } | null = null;
  readonly joystick: Joystick;

  constructor(private deps: HudDeps) {
    // Bottom band.
    const gauges = el('div.gauges', {}, this.gauges.life.node, this.gauges.energy.node, this.gauges.shield.node);
    this.rail.append(el('div.line'), this.railDone);
    MISSIONS.forEach((_, i) => {
      const n = el('div.node');
      n.style.left = `${(i / (MISSIONS.length - 1)) * 100}%`;
      this.nodes.push(n);
      this.rail.append(n);
    });
    const timeline = el('div.timeline', {},
      el('div.now', {}, el('div', {}, this.missionTag, this.goal), el('div.clock', {}, this.clockLabel, this.clockValue)),
      this.rail);
    const counts = el('div.counts', {},
      el('div', {}, el('div.label', { 'data-label': 'bag' }, t('bag')), this.counts.bag),
      el('div', {}, el('div.label', { 'data-label': 'materials' }, t('materials')), this.counts.mat),
      el('div', {}, el('div.label', { 'data-label': 'regolith' }, t('regolith')), this.counts.reg));
    const band = el('div', { id: 'telemetry' }, gauges, timeline, counts);

    // Top right: power and shelter appear when they matter; language switch.
    this.powerBtn = el('button.t-btn', { onclick: () => this.toggleMenu() }, el('span', { 'data-label': 'menuPower' }, t('menuPower')));
    this.shelterBtn = el('button.t-btn.danger', { onclick: () => { deps.s.sheltered = !deps.s.sheltered; this.refresh(); } });
    const langBox = el('div', { id: 'lang', class: 'interactive' });
    const langButtons = (['es', 'en'] as const).map((l) => el('button.t-btn', { onclick: () => setLang(l) }, l.toUpperCase()));
    langBox.append(...langButtons);
    const markLang = () => langButtons.forEach((b, i) => b.classList.toggle('on', ['es', 'en'][i] === getLang()));
    markLang();

    // Radio.
    this.radioBox.append(
      el('div.from', {}, el('span.dot'), this.radioFrom),
      this.radioMsg,
      el('div.row', {}, el('button.t-btn', { onclick: () => this.nextRadio(), 'data-label': 'ok' }, t('ok'))),
    );

    this.prompt.addEventListener('click', () => deps.action());
    this.root.append(band, el('div', { id: 'topright' }, this.powerBtn, this.shelterBtn, langBox), this.radioBox, this.prompt, this.hint, this.arrow);
    document.body.append(this.root);
    this.joystick = new Joystick(this.root);
    // Touch buttons: hop (hold to keep hopping) and dig.
    const hop = el('button.t-btn.touch', { id: 'btn-jump' }, el('span', { 'data-label': 'jump' }, t('jump')));
    hop.addEventListener('pointerdown', () => { this.jumpDown = true; deps.jump(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hop.addEventListener(ev, () => (this.jumpDown = false));
    const digBtn = el('button.t-btn.touch', { id: 'btn-dig', onclick: () => deps.dig() }, el('span', { 'data-label': 'dig' }, t('dig')));
    this.root.append(hop, digBtn);

    onLangChange(() => {
      markLang();
      this.root.querySelectorAll<HTMLElement>('[data-label]').forEach((n) => setText(n, t(n.dataset.label as StringKey)));
      if (this.panel) this.reopen();
      this.refresh();
    });
    this.refresh();
  }

  // ---- Radio --------------------------------------------------------------------------

  /** Queue a transmission. Radio messages arrive with the Earth-Moon delay (1.3 s). */
  radio(mission: Mission): void {
    const fromLander = mission.from === 'lander';
    this.radioQueue.push({
      from: fromLander ? t('landerComputer') : t('radioFrom'),
      text: t(`m_${mission.id}_text` as StringKey),
      delay: fromLander ? 0.3 : 1.3,
    });
    if (!this.radioTyping && this.radioBox.classList.contains('hidden')) this.nextRadio();
  }

  private nextRadio(): void {
    const next = this.radioQueue.shift();
    if (!next) {
      this.radioBox.classList.add('hidden');
      this.radioTyping = null;
      return;
    }
    this.radioBox.classList.remove('hidden');
    setText(this.radioFrom, next.from);
    setText(this.radioMsg, t('receiving'));
    this.radioTyping = { text: next.text, shown: -next.delay * 60 };
  }

  // ---- Panels -------------------------------------------------------------------------

  private context(anchor: THREE.Object3D | null): PanelContext {
    return {
      s: this.deps.s,
      power: this.deps.power,
      changed: this.deps.changed,
      say: (text, warn) => this.float(this.anchorPoint(anchor) ?? new THREE.Vector3(), text, warn),
      poke: () => this.deps.poke(anchor),
      close: () => this.close(),
    };
  }

  open(kind: PanelKind, anchor: THREE.Object3D): void {
    if (this.panel?.anchor === anchor) return this.close();
    this.show(makePanel(kind, this.context(anchor)), anchor, kind);
  }

  private toggleMenu(): void {
    if (this.panel?.kind === 'power') return this.close();
    this.show(makePowerPanel(this.context(null)), null, 'power');
  }

  private reopen(): void {
    const p = this.panel!;
    this.close();
    if (p.kind === 'power') this.toggleMenu();
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

  panelAnchor(): THREE.Object3D | null {
    return this.panel?.anchor ?? null;
  }

  // ---- Action prompt next to the object -------------------------------------------------

  /** Show the action prompt above a point in the world, or hide it with `null`. */
  setPrompt(world: THREE.Vector3 | null, text = '', cost = '', blocked = false): void {
    this.promptAnchor = world;
    this.prompt.classList.toggle('hidden', !world || this.isOpen());
    if (!world) return;
    this.prompt.classList.toggle('blocked', blocked);
    const key = this.prompt.querySelector('.key') ?? el('span.key');
    const label = this.prompt.querySelector('.txt') ?? el('span.txt');
    const costEl = this.prompt.querySelector('.cost') ?? el('span.cost');
    if (!key.parentNode) this.prompt.append(key, label, costEl);
    setText(key as HTMLElement, t('keyUse'));
    setText(label as HTMLElement, text);
    setText(costEl as HTMLElement, cost);
  }

  jumpHeld(): boolean {
    return this.jumpDown;
  }

  /** Mission target: when it is off screen, an arrow on the edge points to it. */
  setTarget(world: THREE.Vector3 | null, from: THREE.Vector3): void {
    this.target = world ? { world, from } : null;
  }

  private placeArrow(): void {
    const tg = this.target;
    if (!tg) { this.arrow.style.display = 'none'; return; }
    const p = tg.world.clone().project(this.deps.camera);
    const behind = p.z > 1;
    const W = window.innerWidth;
    const H = window.innerHeight - 175;
    let x = ((p.x + 1) / 2) * W;
    let y = ((1 - p.y) / 2) * window.innerHeight;
    if (behind) { x = W - x; y = H; }
    const inside = !behind && x > 40 && x < W - 40 && y > 60 && y < H - 10;
    const dist = Math.round(Math.hypot(tg.world.x - tg.from.x, tg.world.z - tg.from.z));
    if (inside || dist < 6) { this.arrow.style.display = 'none'; return; }
    const cx = W / 2;
    const cy = H / 2;
    const ang = Math.atan2(y - cy, x - cx);
    const k = Math.min((W / 2 - 50) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - 50) / Math.abs(Math.sin(ang) || 1e-6));
    this.arrow.style.display = '';
    this.arrow.style.left = `${cx + Math.cos(ang) * k}px`;
    this.arrow.style.top = `${cy + Math.sin(ang) * k}px`;
    (this.arrow.firstChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    setText(this.arrow.lastChild as HTMLElement, `${dist} m`);
  }

  /** Floating text that rises from a point in the world. */
  float(world: THREE.Vector3, text: string, warn = false): void {
    if (!text) return;
    const node = el(`div.float${warn ? '.warn' : ''}`, {}, text);
    this.root.append(node);
    this.floaters.push({ node, world: world.clone(), age: 0 });
  }

  // ---- Layout and refresh ---------------------------------------------------------------

  private anchorPoint(o: THREE.Object3D | null): THREE.Vector3 | null {
    if (!o) return null;
    const box = new THREE.Box3().setFromObject(o);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  }

  private toScreen(world: THREE.Vector3): { x: number; y: number } {
    const p = world.clone().project(this.deps.camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  private place(): void {
    if (!this.panel) return;
    const node = this.panel.panel.el;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight - 175;
    const pt = this.anchorPoint(this.panel.anchor);
    let x = W - w - 16;
    let y = 64;
    if (pt) {
      const sp = this.toScreen(pt);
      x = sp.x < W / 2 ? sp.x + 50 : sp.x - 50 - w;
      y = sp.y - h / 2;
    }
    node.style.left = `${Math.max(8, Math.min(W - w - 8, x))}px`;
    node.style.top = `${Math.max(56, Math.min(H - h - 8, y))}px`;
  }

  private refresh(): void {
    const s = this.deps.s;
    const cap = capacity(s);
    this.gauges.life.set(lifeSupportPercent(s));
    setText(this.gauges.life.sub, `O₂ ${Math.floor(s.res.o2)} · ${t('water')} ${Math.floor(s.res.water)} · ${t('food')} ${Math.floor(s.res.food)}`);
    this.gauges.energy.set((s.res.energy / cap.energy) * 100);
    this.gauges.shield.set(Math.min(100, SHIELD.base + SHIELD.perBermLevel * s.levels.shield + (s.sheltered ? SHIELD.shelterBonus : 0)));
    // Show systems only once they exist: one less thing to read at the start.
    this.gauges.energy.node.style.display = s.levels.processor || s.counts.solarMast ? '' : 'none';
    this.gauges.shield.node.style.display = s.levels.station ? '' : 'none';
    this.powerBtn.style.display = s.counts.battery || s.mission >= MISSIONS.findIndex((m) => m.id === 'battery') ? '' : 'none';
    this.shelterBtn.style.display = s.levels.station ? '' : 'none';
    setText(this.shelterBtn, s.sheltered ? t('leaveShelter') : t('goShelter'));

    const m = currentMission(s);
    const p = m.progress(s);
    setText(this.missionTag, t('missionN', { n: String(s.mission + 1).padStart(2, '0') }) + ' · ' + t(`m_${m.id}_title` as StringKey));
    setText(this.goal, t(`m_${m.id}_goal` as StringKey, { have: p.have, need: p.need }));
    this.nodes.forEach((n, i) => {
      n.classList.toggle('done', i < s.mission);
      n.classList.toggle('current', i === s.mission);
    });
    this.railDone.style.width = `${(s.mission / (MISSIONS.length - 1)) * 100}%`;

    const ph = cyclePhase(s.time);
    setText(this.clockLabel, ph.isDay ? t('lunarDay') : t('lunarNight'));
    const sec = Math.ceil(ph.secondsLeft);
    setText(this.clockValue, `T−${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`);
    setText(this.counts.mat, String(Math.floor(s.res.materials)));
    setText(this.counts.reg, String(Math.floor(s.res.regolith)));
    setText(this.counts.bag, `${Math.floor(s.carried)}/12`);
    this.counts.bag.classList.toggle('full', s.carried >= 12);
    setText(this.hint, matchMedia('(pointer: coarse)').matches ? t('tapGroundTouch') : t('tapGround'));
    this.hint.style.display = s.mission <= 3 && !this.isOpen() ? '' : 'none';
    this.panel?.panel.update();
  }

  update(dt: number): void {
    this.textTimer += dt;
    if (this.textTimer > 0.1) {
      this.textTimer = 0;
      this.refresh();
    }
    this.place();
    this.placeArrow();
    // Radio typewriter.
    if (this.radioTyping) {
      this.radioTyping.shown += dt * 60;
      if (this.radioTyping.shown >= 0) setText(this.radioMsg, this.radioTyping.text.slice(0, Math.floor(this.radioTyping.shown)));
    }
    if (this.promptAnchor && !this.prompt.classList.contains('hidden')) {
      const sp = this.toScreen(this.promptAnchor);
      // Keep the whole prompt on screen (it is centered on its anchor).
      const half = this.prompt.offsetWidth / 2;
      const x = Math.max(half + 8, Math.min(window.innerWidth - half - 8, sp.x));
      const y = Math.max(this.prompt.offsetHeight + 60, Math.min(window.innerHeight - 180, sp.y - 10));
      this.prompt.style.left = `${x}px`;
      this.prompt.style.top = `${y}px`;
    }
    for (const f of this.floaters) {
      f.age += dt;
      const sp = this.toScreen(f.world);
      f.node.style.left = `${sp.x}px`;
      f.node.style.top = `${sp.y - f.age * 40}px`;
      f.node.style.opacity = String(Math.max(0, 1 - f.age / 1.6));
    }
    this.floaters = this.floaters.filter((f) => {
      if (f.age < 1.6) return true;
      f.node.remove();
      return false;
    });
  }
}
