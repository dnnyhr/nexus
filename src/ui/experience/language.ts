import { el } from '../dom';
import { getLang, onLangChange, setLang, t, type Lang } from '../i18n';

const LANGS: Lang[] = ['es', 'en'];

export interface LanguageSwitchHandle {
  readonly el: HTMLElement;
  destroy(): void;
}

export interface LanguageSwitchOptions {
  /** Pins the switch to the corner of the screen instead of flowing with the content. */
  floating?: boolean;
}

/** ES/EN switch visible from the first screen. The choice is stored and applied everywhere. */
export function mountLanguageSwitch(root: HTMLElement, options: LanguageSwitchOptions = {}): LanguageSwitchHandle {
  const buttons = LANGS.map((lang) => el('button.x-lang__btn', {
    type: 'button',
    'aria-pressed': String(getLang() === lang),
    onclick: () => {
      if (getLang() === lang) return;
      setLang(lang);
    },
  }, lang.toUpperCase()));

  const box = el(options.floating ? 'div.x-lang.x-lang--float' : 'div.x-lang', { role: 'group', 'aria-label': t('ccLanguage') }, ...buttons);
  root.append(box);

  const unsubscribe = onLangChange(() => {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(LANGS[index] === getLang())));
    box.setAttribute('aria-label', t('ccLanguage'));
  });

  return {
    el: box,
    destroy() {
      unsubscribe();
      box.remove();
    },
  };
}
