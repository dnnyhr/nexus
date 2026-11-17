import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadSpaceWeather, radiationScale, snapshotWeather, type SpaceWeather } from '../data/spaceweather';
import { newGame, type GameState } from '../game/state';
import type { PowerReport } from '../game/sim';
import { panelArt, type ArtKind } from '../ui/panelArt';
import { LANDING_TEXT, type LandingLang } from './texts';
import './landing.css';

// The landing page. Content is real HTML (readable without JavaScript and by search
// engines); the script adds the language switch, the live Sun data, the drawings of the
// game's panels, GSAP motion and, once the page has painted, the WebGL Moon in the hero.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Language: the same preference the game uses ------------------------------------------
let lang: LandingLang = (() => {
  try {
    const saved = localStorage.getItem('nexus.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  return navigator.language?.startsWith('en') ? 'en' : 'es';
})();

function applyLang(): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((n) => {
    const entry = LANDING_TEXT[n.dataset.i18n as keyof typeof LANDING_TEXT];
    if (entry) n.textContent = entry[lang];
  });
  const toggle = document.querySelector<HTMLButtonElement>('[data-lang-toggle]');
  if (toggle) {
    toggle.textContent = lang === 'es' ? 'EN' : 'ES';
    toggle.setAttribute('aria-label', lang === 'es' ? 'Change language to English' : 'Cambiar el idioma a español');
  }
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((n) => {
    const entry = LANDING_TEXT[n.dataset.i18nAria as keyof typeof LANDING_TEXT];
    if (entry) n.setAttribute('aria-label', entry[lang]);
  });
  document.title = LANDING_TEXT.docTitle[lang];
  renderWeather();
  renderGallery();
}

document.querySelector('[data-lang-toggle]')?.addEventListener('click', () => {
  lang = lang === 'es' ? 'en' : 'es';
  try {
    localStorage.setItem('nexus.lang', lang);
  } catch {
    // Not saved, still switched.
  }
  applyLang();
});

// ---- Live Sun data from NASA DONKI and NOAA GOES ------------------------------------------
let weather: SpaceWeather = snapshotWeather();
function renderWeather(): void {
  const flare = [...weather.flares].sort((a, b) => b.peak.localeCompare(a.peak))[0];
  const set = (id: string, text: string) => { const n = document.getElementById(id); if (n) n.textContent = text; };
  if (flare) set('t-flare', `${flare.class} · ${new Date(flare.peak).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}`);
  set('t-protons', `S${radiationScale(weather.protons.flux)} · ${weather.protons.flux.toFixed(2)} pfu`);
  const note = document.getElementById('t-note');
  if (note) {
    note.textContent = weather.live ? LANDING_TEXT.tLive[lang] : LANDING_TEXT.tSnapshot[lang].replace('{d}', new Date(weather.fetchedAt).toLocaleDateString(lang));
    note.classList.toggle('live', weather.live);
  }
}
loadSpaceWeather().then((w) => { weather = w; renderWeather(); }).catch(() => renderWeather());

// ---- Drawings of the game's panels on the structure cards ---------------------------------
const demo: GameState = newGame(0);
demo.levels = { ...demo.levels, antenna: 1, station: 3, greenhouse: 2, processor: 1, collectorRobot: 2, harvesterRobot: 1, shield: 2 };
demo.counts = { solarMast: 3, battery: 2 };
demo.res.energy = 520;
demo.res.regolith = 90;
demo.plant = { ...demo.plant, growth: 100, stress: 4, light: 55, water: 52, temp: 50 };
demo.rover.ice = 20;
const demoPower = (): PowerReport => ({ generation: 8.4, demand: 2.1, running: { lights: 55, robots: true, processor: true, heating: false }, shortage: false, lifeSupportPowered: true });
document.querySelectorAll<HTMLElement>('.card[data-art]').forEach((card) => {
  const art = panelArt(card.dataset.art as ArtKind, { s: demo, power: demoPower });
  art.update();
  card.querySelector('.art-slot')?.append(art.node);
});

// ---- Gallery: real screenshots of the game, in the page's language -----------------------
const SHOTS = ['base', 'night', 'storm', 'energy', 'data', 'menu'] as const;
type Shot = (typeof SHOTS)[number];
let shot: Shot = 'base';
const shotUrl = (name: Shot, w: 800 | 1600) => `./media/shots/${name}-${lang}-${w}.webp`;

function renderGallery(): void {
  const main = document.getElementById('shot-main') as HTMLImageElement | null;
  if (!main) return;
  const i = SHOTS.indexOf(shot);
  const key = `g${i + 1}` as const;
  const title = LANDING_TEXT[`${key}t` as keyof typeof LANDING_TEXT][lang];
  const text = LANDING_TEXT[key as keyof typeof LANDING_TEXT][lang];
  const src = shotUrl(shot, 1600);
  if (!main.src.endsWith(src.slice(1))) {
    main.srcset = `${shotUrl(shot, 800)} 800w, ${src} 1600w`;
    main.src = src;
  }
  main.alt = `${title}. ${text}`;
  const set = (id: string, t: string) => { const n = document.getElementById(id); if (n) n.textContent = t; };
  set('shot-num', `${String(i + 1).padStart(2, '0')} / ${String(SHOTS.length).padStart(2, '0')}`);
  set('shot-title', title);
  set('shot-text', text);
  document.querySelectorAll<HTMLButtonElement>('.thumb[data-thumb]').forEach((b) => {
    const name = b.dataset.thumb as Shot;
    b.setAttribute('aria-pressed', String(name === shot));
    const img = b.querySelector('img');
    if (img && !img.src.endsWith(shotUrl(name, 800).slice(1))) img.src = shotUrl(name, 800);
  });
}

function showShot(next: Shot): void {
  if (next === shot) return;
  shot = next;
  const main = document.getElementById('shot-main');
  if (reduceMotion || !main) return renderGallery();
  gsap.to(main, { opacity: 0, duration: 0.18, ease: 'power1.in', onComplete: () => {
    renderGallery();
    gsap.to(main, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  } });
}

document.querySelectorAll<HTMLButtonElement>('.thumb[data-thumb]').forEach((b) => {
  b.addEventListener('click', () => showShot(b.dataset.thumb as Shot));
});
// Arrow keys move through the screenshots once a thumbnail has focus.
document.querySelector('.thumbs')?.addEventListener('keydown', (e) => {
  const k = (e as KeyboardEvent).key;
  if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
  e.preventDefault();
  const step = k === 'ArrowRight' ? 1 : -1;
  const next = SHOTS[(SHOTS.indexOf(shot) + step + SHOTS.length) % SHOTS.length];
  showShot(next);
  document.querySelector<HTMLButtonElement>(`.thumb[data-thumb="${next}"]`)?.focus();
});

// ---- Mobile menu ----------------------------------------------------------------------------
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const setMenu = (open: boolean) => {
  menuBtn?.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('menu-open', open);
};
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
document.querySelectorAll('#site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// ---- The nav marks the section on screen --------------------------------------------------
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('#site-nav a[href^="#"]')];
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    navLinks.forEach((a) => a.classList.toggle('on', a.hash === `#${e.target.id}`));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((a) => { const t = document.querySelector(a.hash); if (t) spy.observe(t); });

// ---- Top bar turns solid once the hero scrolls away ---------------------------------------
const bar = document.querySelector('.topbar');
const onScroll = () => bar?.classList.toggle('solid', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

applyLang();

// ---- Motion -----------------------------------------------------------------------------------
if (!reduceMotion) {
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('js-anim');
  // Hero: the title lands like a capsule, then the rest follows.
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.kicker', { y: 16, opacity: 0, duration: 0.6 })
    .from('.h-line', { y: 60, opacity: 0, letterSpacing: '0.5em', duration: 1.1 }, '-=0.3')
    .from('.h-sub', { y: 20, opacity: 0, duration: 0.7 }, '-=0.6')
    .from('.lede', { y: 20, opacity: 0, duration: 0.7 }, '-=0.45')
    .from('.hero-actions > *', { y: 18, opacity: 0, duration: 0.6, stagger: 0.12 }, '-=0.4')
    .from('.fine', { opacity: 0, duration: 0.6 }, '-=0.3')
    .from('.telemetry', { x: 40, opacity: 0, duration: 0.8 }, '-=0.6');

  // The numbers strip counts up the first time it shows.
  document.querySelectorAll<HTMLElement>('.stat dd').forEach((dd) => {
    const m = dd.textContent?.trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!m || dd.children.length) return;
    const end = parseFloat(m[1]);
    const decimals = m[1].includes('.') ? 1 : 0;
    const counter = { v: 0 };
    gsap.to(counter, {
      v: end, duration: 1.4, ease: 'power2.out',
      scrollTrigger: { trigger: dd, start: 'top 92%', once: true },
      onUpdate: () => { dd.textContent = counter.v.toFixed(decimals) + m[2]; },
    });
  });
  // The mission track fills in as you scroll past it.
  gsap.fromTo('.track', { '--fill': '0%' }, { '--fill': '100%', ease: 'none', scrollTrigger: { trigger: '.track', start: 'top 75%', end: 'bottom 55%', scrub: 0.5 } });

  // Sections reveal as they come in.
  // Siblings that come in together arrive one after another.
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }),
  });
  // The descent trajectory draws itself across the story.
  const path = document.querySelector<SVGPathElement>('.story .descent');
  if (path) {
    const len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top 80%', end: 'bottom 60%', scrub: 0.6 },
    });
  }
  gsap.fromTo('.final-patch', { rotate: -25, scale: 0.7 }, { rotate: 0, scale: 1, ease: 'back.out(1.6)', duration: 1.2, scrollTrigger: { trigger: '.final', start: 'top 80%' } });
}

// ---- WebGL Moon, loaded after the page has painted (and not when data is precious) -------
const canvas = document.getElementById('moon') as HTMLCanvasElement | null;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
if (canvas && !saveData && webglOk()) {
  const start = () => import('./scene').then(({ startMoon }) => startMoon(canvas, { reduceMotion })).catch(() => {});
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (document.readyState === 'complete') (idle ? idle(start, { timeout: 1500 }) : setTimeout(start, 200));
  else window.addEventListener('load', () => (idle ? idle(start, { timeout: 1500 }) : setTimeout(start, 200)), { once: true });
}
