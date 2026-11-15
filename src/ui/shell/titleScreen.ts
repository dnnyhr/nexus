import { SCENARIO_1 } from '../../engine';
import { cleanName, NAME_MAX, saveProfile } from '../../game/profile';
import { el, setText } from '../dom';
import { getLang, getPlayerName, onLangChange, setLang, setPlayerName, t } from '../i18n';
import './shell.css';

// Title menu over the 3D space scene: the logo, three modes and little else. Secondary screens
// (progress, certifications, science) open from a quiet link. The menu never runs the economy.

export interface TitleOptions {
  /** Mission index of the free-mode save (0-based), or null without a save. */
  savedMission(): number | null;
  onCadetLaunch(): void;
  onCadetDesign(): void;
  onSimulator(): void;
  onProgress(): void;
}

export interface TitleHandle {
  destroy(): Promise<void>;
}

const LOGO = `${import.meta.env.BASE_URL}brand/nexus-logo.png`;
const STORM = SCENARIO_1.events.find((e) => e.kind === 'storm');

function stop(node: HTMLElement, signal: AbortSignal): void {
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup']) node.addEventListener(type, (e) => e.stopPropagation(), { signal });
}

export function mountTitle(root: HTMLElement, opts: TitleOptions): TitleHandle {
  const events = new AbortController();
  const wrap = el('section.nx-title', { 'aria-labelledby': 'nx-title-name' });
  stop(wrap, events.signal);
  const brand = el('div.nx-title__brand');
  const word = el('h1.nx-title__word', { id: 'nx-title-name' }, 'NEXUS', el('span', {}, ''));
  brand.append(word);
  // The official logo, when present in public/brand/, takes the place of the wordmark.
  const logo = new Image();
  logo.alt = 'NEXUS';
  logo.className = 'nx-title__logo';
  logo.onload = () => { brand.replaceChildren(el('h1.nx-title__sr', { id: 'nx-title-name' }, 'NEXUS'), logo); };
  logo.src = LOGO;
  const tagline = el('p.nx-title__tagline');
  const stage = el('div.nx-title__stage');
  const footer = el('footer.nx-title__foot');
  wrap.append(el('div.nx-title__top', {}, brand, tagline), stage, footer);

  type View = 'home' | 'missions' | 'brief';
  let view: View = 'home';

  function mode(id: string, name: string, desc: string, action: string, onClick: (() => void) | null, extra: (HTMLElement | string)[] = []): HTMLElement {
    const button = el('button.nx-mode__go', { type: 'button' }, action) as HTMLButtonElement;
    if (onClick) button.addEventListener('click', onClick, { signal: events.signal });
    else button.disabled = true;
    return el(`article.nx-mode.nx-mode--${id}`, {}, el('h2.nx-mode__name', {}, name, ...extra), el('p.nx-mode__desc', {}, desc), button);
  }

  function home(): HTMLElement[] {
    const saved = opts.savedMission();
    return [el('div.nx-modes', {},
      mode('cadet', t('nxModeCadet'), t('nxModeCadetDesc'), t('nxPlay'), () => go('missions'), [el('span.nx-chip.nx-chip--go', {}, t('nxRecommended'))]),
      mode('sim', t('nxModeSim'), saved === null ? t('nxModeSimDesc') : `${t('nxModeSimDesc')} ${t('nxModeSimSaved', { n: saved + 1 })}`,
        t(saved === null ? 'nxOpen' : 'nxContinue'), () => opts.onSimulator()),
      mode('lab', t('nxModeLab'), t('nxModeLabDesc'), t('nxSoonShort'), null, [el('span.nx-chip', {}, t('nxSoon'))]),
    )];
  }

  function missions(): HTMLElement[] {
    const card = el('button.nx-mission', { type: 'button' }, el('strong', {}, t('nxMission1')), el('span', {}, t('nxMission1Meta')));
    card.addEventListener('click', () => go('brief'), { signal: events.signal });
    return [el('div.nx-panel', {}, el('h2.nx-panel__title', {}, t('nxChooseMission')), card, back('home'))];
  }

  function brief(): HTMLElement[] {
    const date = STORM?.inspiredBy ? new Date(STORM.inspiredBy.peak).toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const launch = el('button.nx-mode__go', { type: 'button', 'data-launch': '' }, t('nxLaunch'));
    launch.addEventListener('click', () => opts.onCadetLaunch(), { signal: events.signal });
    const design = el('button.nx-link', { type: 'button' }, t('nxCustomize'));
    design.addEventListener('click', () => opts.onCadetDesign(), { signal: events.signal });
    return [el('div.nx-panel.nx-panel--brief', {},
      el('p.nx-panel__kicker', {}, t('nxBriefTitle'), ' · ', t('nxMission1')),
      el('p', {}, t('nxBrief1')), el('p', {}, t('nxBrief2')), el('p', {}, t('nxBrief3')),
      STORM?.inspiredBy ? el('p.nx-panel__source', {}, t('nxBriefSource', { cls: STORM.inspiredBy.class, date })) : '',
      el('div.nx-panel__actions', {}, back('missions'), design, launch))];
  }

  function back(to: View): HTMLElement {
    const b = el('button.nx-link', { type: 'button' }, `‹ ${t('nxBack')}`);
    b.addEventListener('click', () => go(to), { signal: events.signal });
    return b;
  }

  function profile(): HTMLElement {
    const name = el('button.nx-link', { type: 'button', title: t('nxProfileLabel') });
    setText(name, `◉ ${getPlayerName() || t('defaultName')}`);
    name.addEventListener('click', () => {
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
    }, { signal: events.signal });
    return name;
  }

  function footerContent(): HTMLElement[] {
    const langs = (['es', 'en'] as const).map((lang) => {
      const b = el('button.nx-lang', { type: 'button', 'aria-pressed': String(getLang() === lang) }, lang.toUpperCase());
      b.addEventListener('click', () => setLang(lang), { signal: events.signal });
      return b;
    });
    const progress = el('button.nx-link', { type: 'button' }, t('nxProgress'));
    progress.addEventListener('click', () => opts.onProgress(), { signal: events.signal });
    return [profile(), progress, el('span.nx-title__spacer'), el('span.nx-langs', { role: 'group', 'aria-label': 'Idioma / Language' }, ...langs)];
  }

  function go(next: View): void {
    view = next;
    render();
    stage.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }

  function render(): void {
    setText(word.lastChild as HTMLElement, t('nxSubtitle'));
    setText(tagline, t('nxTagline'));
    wrap.dataset.view = view;
    stage.replaceChildren(...(view === 'home' ? home() : view === 'missions' ? missions() : brief()));
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
