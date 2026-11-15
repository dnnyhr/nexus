import { el } from '../../ui/dom';
import type { SequenceKind } from './timeline';
import './cinematics.css';

const ARRIVAL_AUDIO_URL = `${import.meta.env.BASE_URL}cinematics/arrival.mp3`;
// Start the Apollo 11 quote during lunar approach so it spans descent and touchdown.
const ARRIVAL_AUDIO_START = 5.8;

export function mountCinemaUI(kind: SequenceKind, skip: () => void) {
  const ctrl = new AbortController();
  const radio = el('p.cinema-radio', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const mask = el('div.cinema-mask', { 'aria-hidden': 'true' });
  const button = el('button', { type: 'button' }, 'Omitir secuencia');
  const sound = el('button', { type: 'button' });
  const hint = el('p.cinema-note', {}, kind === 'arrival' ? 'Recreación con elipsis temporal · cartografía NASA SVS · vuelo simulado' : 'Registro de vuelo · secuencia resumida');
  const node = el('section.cinema-overlay', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Secuencia de misión' }, mask,
    el('div.cinema-transmission', {}, radio, hint), el('div.cinema-actions', {}, sound, button));
  let audio: AudioContext | null = null;
  let clip: HTMLAudioElement | null = null;
  let time = 0;
  // The touchdown quote plays by default; the other sequences start silent.
  let muted = kind !== 'arrival';
  let unlocking = false;
  const label = () => {
    sound.textContent = muted ? 'Audio apagado' : 'Audio de comunicaciones';
    sound.setAttribute('aria-pressed', String(!muted));
  };
  label();
  if (kind === 'arrival' && typeof Audio !== 'undefined') {
    clip = new Audio(ARRIVAL_AUDIO_URL);
    clip.preload = 'auto';
    // The sequence starts from the «Despegar» tap: play and pause silently now, inside that
    // gesture, so mobile browsers (iOS) let the quote play later on its own.
    const unlock = clip;
    unlock.muted = true;
    unlocking = true;
    const done = () => { unlocking = false; unlock.muted = false; };
    void unlock.play().then(() => { if (time < ARRIVAL_AUDIO_START) { unlock.pause(); unlock.currentTime = 0; } done(); }).catch(done);
  }
  const syncClip = () => {
    if (!clip || unlocking) return;
    if (muted || time < ARRIVAL_AUDIO_START) {
      if (!clip.paused) clip.pause();
      if (time < ARRIVAL_AUDIO_START) clip.currentTime = 0;
      return;
    }
    const at = Math.max(0, time - ARRIVAL_AUDIO_START);
    if (Math.abs(clip.currentTime - at) > 0.35) clip.currentTime = at;
    if (clip.paused) void clip.play().catch(() => {});
  };
  sound.addEventListener('click', () => {
    muted = !muted;
    if (clip) {
      syncClip();
    } else if (!muted) {
      try { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } catch { muted = true; }
    } else if (audio) void audio.suspend().catch(() => {});
    label();
  }, { signal: ctrl.signal });
  button.addEventListener('click', skip, { signal: ctrl.signal });
  node.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); skip(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === sound ? button : sound).focus();
    }
  }, { signal: ctrl.signal });
  for (const type of ['keyup', 'pointerdown', 'pointerup', 'click', 'contextmenu', 'wheel']) node.addEventListener(type, event => event.stopPropagation(), { signal: ctrl.signal });
  document.body.append(node);
  button.focus({ preventScroll: true });
  let last = '';
  return {
    update(text: string, opacity: number, t = 0) {
      time = t;
      mask.style.opacity = String(opacity);
      if (clip) syncClip();
      if (text === last) return;
      last = text;
      radio.textContent = text;
      if (!clip && !muted && audio?.state === 'running') {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0, audio.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, audio.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    },
    destroy() {
      ctrl.abort();
      node.remove();
      if (audio) void audio.close().catch(() => {});
      if (clip) { clip.pause(); clip.src = ''; clip.load(); }
    },
  };
}
