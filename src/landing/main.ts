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
  document.title = LANDING_TEXT.docTitle[lang];
  renderWeather();
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
