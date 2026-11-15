import { el } from './dom';
import { onLangChange, t } from './i18n';

const STORAGE_KEY = 'nexus:bgm-muted';
const DEFAULT_SRC = `${import.meta.env.BASE_URL}audio/interstellar.mp3`;
const DEFAULT_VOLUME = 0.18;

export interface BackgroundMusicHandle {
  play(): void;
  pause(): void;
  resume(): void;
  toggle(): void;
  setVolume(volume: number): void;
  destroy(): void;
}

export function mountBackgroundMusic(options?: { src?: string; volume?: number; root?: HTMLElement }): BackgroundMusicHandle {
  const audio = new Audio(options?.src ?? DEFAULT_SRC);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = options?.volume ?? DEFAULT_VOLUME;

  let userMuted = false;
  try { userMuted = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}
  let wantsPlay = false;
  let destroyed = false;

  const saveMuted = () => {
    try { localStorage.setItem(STORAGE_KEY, userMuted ? '1' : '0'); } catch {}
  };

  const button = el('button.t-btn.x-bgm', {
    type: 'button',
    'aria-label': '',
    title: '',
    onclick: () => {
      userMuted = !userMuted;
      saveMuted();
      if (userMuted) audio.pause();
      else wantsPlay = true;
      sync();
      if (!userMuted) void tryPlay();
    },
  });

  function label(): string {
    return userMuted || audio.paused ? t('bgmPlay') : t('bgmPause');
  }

  function sync(): void {
    const playing = !userMuted && !audio.paused;
    button.textContent = t('bgmTitle');
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    button.setAttribute('data-muted', userMuted ? 'true' : 'false');
    const l = label();
    button.setAttribute('aria-label', l);
    button.title = l;
  }

  async function tryPlay(): Promise<void> {
    if (destroyed || userMuted || !wantsPlay) return;
    try {
      await audio.play();
    } catch {
      // Autoplay blocked or missing source: keep UI consistent, retry on next gesture/play.
    }
    sync();
  }

  const offLang = onLangChange(sync);
  const onGesture = () => { void tryPlay(); };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);

  (options?.root ?? document.body).append(button);
  sync();

  return {
    play() {
      wantsPlay = true;
      void tryPlay();
    },
    pause() {
      wantsPlay = false;
      audio.pause();
      sync();
    },
    resume() {
      wantsPlay = true;
      void tryPlay();
    },
    toggle() {
      if (audio.paused || userMuted) {
        userMuted = false;
        saveMuted();
        wantsPlay = true;
        void tryPlay();
      } else {
        this.pause();
      }
    },
    setVolume(volume: number) {
      audio.volume = Math.max(0, Math.min(1, volume));
    },
    destroy() {
      destroyed = true;
      wantsPlay = false;
      offLang();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      audio.pause();
      audio.src = '';
      button.remove();
    },
  };
}
