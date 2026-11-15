import { SCENARIO_1 } from '../../engine';
import { cleanName, NAME_MAX, saveProfile } from '../../game/profile';
import { el, setText } from '../dom';
import { getLang, getPlayerName, onLangChange, setLang, setPlayerName, t } from '../i18n';
import './shell.css';

// Title menu over the 3D Moon: the mission patch, the name, and a short numbered list of what
// you can do. Same type and palette as the landing page. The menu never runs the economy.

export interface TitleOptions {
  /** Mission index of the free-mode save (0-based), or null without a save. */
  savedMission(): number | null;
  onCadetLaunch(): void;
  onCadetDesign(): void;
  onSimulator(): void;
  onLoadPng(): void;
}

export interface TitleHandle {
  destroy(): Promise<void>;
}

const PATCH = `${import.meta.env.BASE_URL}brand/nexus-patch.svg`;
const STORM = SCENARIO_1.events.find((e) => e.kind === 'storm');

function stop(node: HTMLElement, signal: AbortSignal): void {
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup']) node.addEventListener(type, (e) => e.stopPropagation(), { signal });
}

export function mountTitle(root: HTMLElement, opts: TitleOptions): TitleHandle {
  const events = new AbortController();
  const on = (node: HTMLElement, fn: () => void) => node.addEventListener('click', fn, { signal: events.signal });

  const wrap = el('section.nx-title', { 'aria-labelledby': 'nx-title-name' });
  stop(wrap, events.signal);
  const patch = el('img.nx-title__patch', { src: PATCH, alt: '', width: 72, height: 72 });
  const sub = el('span.nx-title__sub');
  const brand = el('div.nx-title__brand', {}, patch, el('h1.nx-title__word', { id: 'nx-title-name' }, 'NEXUS', sub));
  const stage = el('div.nx-title__stage');
  const footer = el('footer.nx-title__foot');
  wrap.append(brand, stage, footer);

  let view: 'home' | 'brief' = 'home';

  /** One numbered line of the menu: number, name, a short note and an arrow. */
  function item(n: number, name: string, note: string, onClick: () => void, primary = false): HTMLElement {
    const button = el(`button.nx-item${primary ? '.nx-item--primary' : ''}`, { type: 'button', style: `--i:${n}` },
      el('span.nx-item__num', {}, String(n).padStart(2, '0')),
      el('span.nx-item__name', {}, name),
      el('span.nx-item__note', {}, note),
      el('span.nx-item__arrow', { 'aria-hidden': 'true' }, '→'));
    on(button, onClick);
    return el('li', {}, button);
  }

  function home(): HTMLElement[] {
    const saved = opts.savedMission();
    return [el('ol.nx-menu', {},
      item(1, t('nxMission1'), t('nxMenuMission1Note'), () => go('brief'), true),
      item(2, t('nxModeSim'), saved === null ? t('nxMenuSimNote') : t('nxMenuSimSaved', { n: saved + 1 }), () => opts.onSimulator()),
      item(3, t('nxMenuLoad'), t('nxMenuLoadNote'), () => opts.onLoadPng()),
    )];
  }

  function brief(): HTMLElement[] {
    const date = STORM?.inspiredBy ? new Date(STORM.inspiredBy.peak).toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const launch = el('button.nx-cta', { type: 'button', 'data-launch': '' }, t('nxLaunch'));
    on(launch, () => opts.onCadetLaunch());
    const design = el('button.nx-ghost', { type: 'button' }, t('nxCustomize'));
    on(design, () => opts.onCadetDesign());
    const back = el('button.nx-link.nx-back', { type: 'button' }, `← ${t('nxBack')}`);
    on(back, () => go('home'));
    return [el('div.nx-brief', {},
      back,
      el('p.nx-brief__eyebrow', {}, t('nxBriefTitle')),
      el('h2.nx-brief__title', {}, t('nxMission1')),
      el('p', {}, t('nxBrief1')), el('p', {}, t('nxBrief2')), el('p', {}, t('nxBrief3')),
      STORM?.inspiredBy ? el('p.nx-brief__source', {}, t('nxBriefSource', { cls: STORM.inspiredBy.class, date })) : '',
      el('div.nx-brief__actions', {}, launch, design))];
  }

  function profile(): HTMLElement {
    const name = el('button.nx-link', { type: 'button', title: t('nxProfileLabel') });
    setText(name, `${t('nxPilot')}: ${getPlayerName() || t('defaultName')}`);
    on(name, () => {
      const input = el('input.nx-name', { type: 'text', maxlength: NAME_MAX, value: getPlayerName(), 'aria-label': t('nxProfileLabel'), autocomplete: 'off' }) as HTMLInputElement;
      const save = () => {
        const clean = cleanName(input.value);
        if (clean !== getPlayerName()) { saveProfile({ name: clean }); setPlayerName(clean); }
        render();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') render(); });
      const ok = el('button.nx-link', { type: 'button' }, t('nxSave'));
      ok.addEventListener('click', save);
      name.replaceWith(el('span.nx-name-edit', {}, input, ok));
      input.focus();
    });
    return name;
  }

  function footerContent(): HTMLElement[] {
    const langs = (['es', 'en'] as const).map((lang) => {
      const b = el('button.nx-lang', { type: 'button', 'aria-pressed': String(getLang() === lang) }, lang.toUpperCase());
      on(b, () => setLang(lang));
      return b;
    });
    return [profile(), el('span.nx-title__spacer'), el('span.nx-langs', { role: 'group', 'aria-label': 'Idioma / Language' }, ...langs)];
  }

  function go(next: typeof view): void {
    view = next;
    render();
    stage.querySelector<HTMLElement>(next === 'brief' ? '[data-launch]' : 'button')?.focus({ preventScroll: true });
  }

  function render(): void {
    setText(sub, t('nxSubtitle'));
    wrap.dataset.view = view;
    stage.replaceChildren(...(view === 'home' ? home() : brief()));
    footer.replaceChildren(...footerContent());
  }

  const unsubscribe = onLangChange(render);
  render();
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('is-in'));
  stage.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  return {
    destroy() {
      unsubscribe();
      events.abort();
      wrap.classList.remove('is-in');
      return new Promise((resolve) => setTimeout(() => { wrap.remove(); resolve(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380));
    },
  };
}
