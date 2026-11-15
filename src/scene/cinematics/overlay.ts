import { el } from '../../ui/dom';
import type { SequenceKind } from './timeline';
import './cinematics.css';

export function mountCinemaUI(kind: SequenceKind, skip: () => void) {
  const ctrl = new AbortController();
  const radio = el('p.cinema-radio', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const mask = el('div.cinema-mask', { 'aria-hidden': 'true' });
  const button = el('button', { type: 'button' }, 'Omitir secuencia');
  const sound = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Audio apagado');
  const hint = el('p.cinema-note', {}, kind === 'arrival' ? 'Recreación con elipsis temporal · cartografía NASA SVS · vuelo simulado' : 'Registro de vuelo · secuencia resumida');
  const node = el('section.cinema-overlay', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Secuencia de misión' }, mask,
    el('div.cinema-transmission', {}, radio, hint), el('div.cinema-actions', {}, sound, button));
  let audio: AudioContext | null = null;
  let muted = true;
  sound.addEventListener('click', () => {
    muted = !muted;
    if (!muted) {
      try { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } catch { muted = true; }
    } else if (audio) void audio.suspend().catch(() => {});
    sound.textContent = muted ? 'Audio apagado' : 'Audio de comunicaciones';
    sound.setAttribute('aria-pressed', String(!muted));
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
    update(text: string, opacity: number) {
      mask.style.opacity = String(opacity);
      if (text === last) return;
      last = text;
      radio.textContent = text;
      if (!muted && audio?.state === 'running') {
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
    destroy() { ctrl.abort(); node.remove(); if (audio) void audio.close().catch(() => {}); },
  };
}
