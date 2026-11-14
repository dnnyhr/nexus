// All visible text in one place, in Spanish and English. Plain language first: the game is
// for ages 7-12, and any technical term gets a short explanation where it appears.

export type Lang = 'es' | 'en';

const STRINGS = {
  lifeSupport: { es: 'Soporte vital', en: 'Life support' },
  o2: { es: 'Oxígeno', en: 'Oxygen' },
  water: { es: 'Agua', en: 'Water' },
  food: { es: 'Comida', en: 'Food' },
  energy: { es: 'Energía', en: 'Power' },
  shield: { es: 'Blindaje', en: 'Shielding' },
  materials: { es: 'Materiales', en: 'Materials' },
  regolith: { es: 'Regolito', en: 'Regolith' },
  crewHealth: { es: 'Salud', en: 'Health' },
  dayLeft: { es: 'Día · quedan {m} min', en: 'Day · {m} min left' },
  nightLeft: { es: 'Noche · quedan {m} min', en: 'Night · {m} min left' },

  station: { es: 'Estación', en: 'Station' },
  greenhouse: { es: 'Invernadero', en: 'Greenhouse' },
  processor: { es: 'Procesador', en: 'Processor' },
  solarMast: { es: 'Panel solar', en: 'Solar mast' },
  battery: { es: 'Batería', en: 'Battery' },
  collectorRobot: { es: 'Robot recolector', en: 'Collector robot' },
  harvesterRobot: { es: 'Robot cosechador', en: 'Harvester robot' },
  shieldBerm: { es: 'Berma de blindaje', en: 'Shielding berm' },

  level: { es: 'Nivel {n}', en: 'Level {n}' },
  count: { es: '{n} construidos', en: '{n} built' },
  build: { es: 'Construir', en: 'Build' },
  upgrade: { es: 'Mejorar', en: 'Upgrade' },
  maxed: { es: 'Nivel máximo', en: 'Max level' },
  needMaterials: { es: 'Te faltan {n} materiales', en: 'You need {n} more materials' },
  needStation: { es: 'Primero mejora la estación', en: 'Upgrade the station first' },
  needGreenhouse: { es: 'Primero construye el invernadero', en: 'Build the greenhouse first' },
  close: { es: 'Cerrar', en: 'Close' },

  goShelter: { es: 'Ir al refugio', en: 'Go to shelter' },
  leaveShelter: { es: 'Salir del refugio', en: 'Leave shelter' },
  sheltered: { es: 'Tripulación en el refugio: robots y procesador detenidos', en: 'Crew in the shelter: robots and processor stopped' },

  plantWater: { es: 'Agua', en: 'Water' },
  plantLight: { es: 'Luz', en: 'Light' },
  plantTemp: { es: 'Temperatura', en: 'Temperature' },
  growth: { es: 'Crecimiento', en: 'Growth' },
  stress: { es: 'Estrés', en: 'Stress' },
  optimal: { es: 'Mantén cada valor entre 40 y 60', en: 'Keep every value between 40 and 60' },
  irrigate: { es: 'Regar', en: 'Water' },
  heat: { es: 'Calentar', en: 'Heat' },
  cool: { es: 'Enfriar', en: 'Cool' },
  harvest: { es: 'Cosechar', en: 'Harvest' },
  replant: { es: 'Replantar', en: 'Replant' },
  plantDead: { es: 'La planta murió. Replanta para seguir.', en: 'The plant died. Replant to continue.' },
  plantReady: { es: '¡Lista para cosechar!', en: 'Ready to harvest!' },

  powerTitle: { es: 'Reparto de energía', en: 'Power use' },
  powerHint: {
    es: 'De noche los paneles no producen. Apaga lo que no necesites para que la batería dure.',
    en: 'At night the solar masts make no power. Turn off what you don’t need so the battery lasts.',
  },
  heating: { es: 'Calefacción', en: 'Heating' },
  robots: { es: 'Robots', en: 'Robots' },
  growLights: { es: 'Luces de cultivo', en: 'Grow lights' },
  on: { es: 'Encendido', en: 'On' },
  off: { es: 'Apagado', en: 'Off' },
  shortage: { es: 'Falta energía: se apagaron sistemas', en: 'Not enough power: systems shut down' },

  tapGround: { es: 'Toca el suelo para juntar regolito', en: 'Tap the ground to collect regolith' },
  sender: { es: 'De: Dra. Rivera, directora de vuelo', en: 'From: Dr. Rivera, flight director' },
  menuBuild: { es: 'Construir', en: 'Build' },
  menuPower: { es: 'Energía', en: 'Power' },
} as const;

export type StringKey = keyof typeof STRINGS;

const listeners = new Set<() => void>();
let lang: Lang = load();

function load(): Lang {
  try {
    const saved = localStorage.getItem('nexus.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage can be blocked (private mode); fall back to the browser language.
  }
  return navigator.language?.startsWith('en') ? 'en' : 'es';
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem('nexus.lang', next);
  } catch {
    // Not saved, but the switch still works for this session.
  }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

/** Translate a key, filling {placeholders} from `vars`. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return STRINGS[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
