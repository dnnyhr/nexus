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
  rover: { es: 'Rover de expedición', en: 'Expedition rover' },
  antenna: { es: 'Antena de comunicaciones', en: 'Comms antenna' },
  lander: { es: 'Módulo de aterrizaje', en: 'Lander' },

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

  tapGround: { es: 'WASD para moverte · Espacio para saltar · Clic derecho para excavar · F para usar', en: 'WASD to move · Space to hop · Right click to dig · F to use' },
  tapGroundTouch: { es: 'Joystick para moverte · Saltar · Excavar · toca el aviso blanco para usar', en: 'Joystick to move · Hop · Dig · tap the white prompt to use' },
  jump: { es: 'Saltar', en: 'Hop' },
  bag: { es: 'Bolsa', en: 'Bag' },
  bagFull: { es: 'Bolsa llena · llévala al procesador', en: 'Bag full · take it to the processor' },
  deliverX: { es: 'Depositar regolito', en: 'Deliver regolith' },
  delivered: { es: '+{n} regolito al procesador', en: '+{n} regolith to the processor' },
  hopperFull: { es: 'El procesador está lleno', en: 'The processor is full' },
  dig: { es: 'Excavar', en: 'Dig' },
  use: { es: 'Usar: {x}', en: 'Use: {x}' },
  getCloser: { es: 'Acércate para usarlo', en: 'Walk closer to use it' },
  busy: { es: 'Trabajando…', en: 'Working…' },
  sender: { es: 'Radio · Comandante Rivera, Control Tierra', en: 'Radio · Commander Rivera, Mission Control' },
  menuBuild: { es: 'Construir', en: 'Build' },
  menuPower: { es: 'Energía', en: 'Power' },
  procRunning: { es: 'Procesando: convierte regolito en oxígeno y materiales.', en: 'Running: turns regolith into oxygen and materials.' },
  procNoRegolith: { es: 'Detenido: no hay regolito. Toca el suelo o usa un robot.', en: 'Stopped: no regolith. Tap the ground or use a robot.' },
  procNoPower: { es: 'Detenido: no hay energía suficiente.', en: 'Stopped: not enough power.' },
  procOff: { es: 'Apagado.', en: 'Switched off.' },
  procSheltered: { es: 'Detenido: la tripulación está en el refugio.', en: 'Stopped: the crew is in the shelter.' },
  factRegolith: { es: 'Dato real: más del 40 % del peso del regolito lunar es oxígeno atrapado en minerales.', en: 'Real fact: over 40% of lunar regolith by mass is oxygen locked in minerals.' },
  factNight: { es: 'Dato real: la noche lunar dura unos 14 días terrestres, con frío extremo.', en: 'Real fact: a lunar night lasts about 14 Earth days, and it is extremely cold.' },
  factPolarSun: { es: 'Dato real: en el polo sur lunar el Sol da vueltas cerca del horizonte. Por eso los paneles son verticales y lo siguen.', en: 'Real fact: at the lunar south pole the Sun circles near the horizon. That is why the panels stand upright and follow it.' },
  factGreenhouse: { es: 'Dato real: en la Estación Espacial la NASA cultiva plantas con luces LED y riego controlado.', en: 'Real fact: on the Space Station, NASA grows plants under LED lights with controlled watering.' },
  factShield: { es: 'Dato real: la Luna no tiene atmósfera ni campo magnético que frene la radiación del Sol. Una capa de regolito sirve de escudo.', en: 'Real fact: the Moon has no atmosphere or magnetic field to stop the Sun’s radiation. A layer of regolith works as a shield.' },
  solarNow: { es: 'Produce {n} de energía por segundo.', en: 'Making {n} power per second.' },
  solarNight: { es: 'De noche no produce energía.', en: 'Makes no power at night.' },
  batteryCharge: { es: 'Carga: {p} %', en: 'Charge: {p}%' },
  capacity: { es: 'Capacidad: {n}', en: 'Capacity: {n}' },
  stationInfo: { es: 'Aquí vive la tripulación. Mejorarla agrega módulos y más almacenamiento.', en: 'The crew lives here. Upgrading adds modules and more storage.' },
  shieldLevel: { es: 'Berma de regolito: {n} de 3', en: 'Regolith berm: {n} of 3' },
  upgradeShield: { es: 'Reforzar berma', en: 'Reinforce berm' },
  robotsInfo: { es: 'Los robots trabajan solos, pero gastan energía.', en: 'Robots work on their own, but they use power.' },
  buildAnother: { es: 'Construir otro', en: 'Build another' },
  roverInfo: { es: 'Pronto: expediciones al cráter con hielo.', en: 'Coming soon: expeditions to the ice crater.' },
  antennaInfo: { es: 'Recibe los mensajes de Control Tierra. La señal tarda 1,3 segundos en llegar desde la Tierra.', en: 'Receives Mission Control messages. The signal takes 1.3 seconds to arrive from Earth.' },
  landerInfo: { es: 'La nave en la que llegaste a la Luna.', en: 'The ship that brought you to the Moon.' },
  noWater: { es: 'No hay agua suficiente', en: 'Not enough water' },
  noEnergy: { es: 'No hay energía suficiente', en: 'Not enough power' },
  notReady: { es: 'Todavía no está lista', en: 'Not ready yet' },
  regolithGain: { es: '+{n} regolito', en: '+{n} regolith' },
  storageFull: { es: 'Depósito lleno', en: 'Storage full' },
  generation: { es: 'Producción', en: 'Making' },
  demand: { es: 'Consumo', en: 'Using' },
  perSecond: { es: '{n}/s', en: '{n}/s' },
  built: { es: '¡Construido!', en: 'Built!' },
  upgraded: { es: '¡Mejorado a nivel {n}!', en: 'Upgraded to level {n}!' },
  harvested: { es: '+{n} comida', en: '+{n} food' },
  notBuilt: { es: 'Sin construir', en: 'Not built' },

  // ---- Missions: radio text, short title (timeline) and objective (with progress) ----
  m_antenna_title: { es: 'Antena', en: 'Antenna' },
  m_antenna_goal: { es: 'Construye la antena', en: 'Build the antenna' },
  m_antenna_text: { es: 'Bienvenido a la Luna. Sin antena no podemos hablar con la Tierra. Camina hasta el anillo naranja y constrúyela.', en: 'Welcome to the Moon. Without an antenna we can’t talk to Earth. Walk to the orange ring and build it.' },
  m_dig_title: { es: 'Regolito', en: 'Regolith' },
  m_dig_goal: { es: 'Excava regolito {have}/{need}', en: 'Dig regolith {have}/{need}' },
  m_dig_text: { es: 'Aquí el comandante Rivera, desde la Tierra. ¡Te escuchamos! Para construir necesitas regolito: el polvo y las rocas de la Luna. Excava con clic derecho (o el botón Excavar) hasta llenar tu bolsa.', en: 'Commander Rivera here, from Earth. We hear you! To build you need regolith: the Moon’s dust and rocks. Dig with right click (or the Dig button) until your bag is full.' },
  m_processor_title: { es: 'Procesador', en: 'Processor' },
  m_processor_goal: { es: 'Construye el procesador', en: 'Build the processor' },
  m_processor_text: { es: 'Muy bien. Ahora construye el procesador: saca oxígeno y materiales del regolito. Más del 40 % de su peso es oxígeno.', en: 'Well done. Now build the processor: it gets oxygen and materials out of regolith. Over 40% of its weight is oxygen.' },
  m_materials_title: { es: 'Materiales', en: 'Materials' },
  m_materials_goal: { es: 'Lleva regolito al procesador · {have}/{need} materiales', en: 'Bring regolith to the processor · {have}/{need} materials' },
  m_materials_text: { es: 'El procesador solo trabaja con el regolito que le lleves. Deposita tu bolsa y vuelve por más hasta fabricar 15 materiales.', en: 'The processor only works with the regolith you bring it. Empty your bag into it and fetch more until it makes 15 materials.' },
  m_solar_title: { es: 'Energía', en: 'Power' },
  m_solar_goal: { es: 'Instala un panel solar', en: 'Put up a solar mast' },
  m_solar_text: { es: 'Necesitamos más energía. Instala un panel solar. Aquí el Sol da vueltas cerca del horizonte: por eso los paneles son altos y lo siguen.', en: 'We need more power. Put up a solar mast. Here the Sun circles near the horizon, so the panels are tall and follow it.' },
  m_habitat_title: { es: 'Hábitat', en: 'Habitat' },
  m_habitat_goal: { es: 'Levanta el hábitat', en: 'Build the habitat' },
  m_habitat_text: { es: 'Hora de tener casa: levanta el hábitat. Te protegerá y guardará más recursos.', en: 'Time for a home: build the habitat. It protects you and stores more supplies.' },
  m_robot_title: { es: 'Robot', en: 'Robot' },
  m_robot_goal: { es: 'Construye un robot recolector', en: 'Build a collector robot' },
  m_robot_text: { es: 'Excavar a mano cansa. Construye un robot recolector: trabajará solo, pero gasta energía.', en: 'Digging by hand is tiring. Build a collector robot: it works on its own, but it uses power.' },
  m_greenhouse_title: { es: 'Invernadero', en: 'Greenhouse' },
  m_greenhouse_goal: { es: 'Construye el invernadero', en: 'Build the greenhouse' },
  m_greenhouse_text: { es: 'Vas a necesitar comida. Construye el invernadero.', en: 'You’ll need food. Build the greenhouse.' },
  m_harvest_title: { es: 'Cosecha', en: 'Harvest' },
  m_harvest_goal: { es: 'Cosecha tu primera planta', en: 'Harvest your first plant' },
  m_harvest_text: { es: 'Las plantas necesitan agua, luz y temperatura entre 40 y 60. Entra al invernadero y cuida tu primera planta hasta cosecharla.', en: 'Plants need water, light and temperature between 40 and 60. Use the greenhouse and look after your first plant until you can harvest it.' },
  m_battery_title: { es: 'Batería', en: 'Battery' },
  m_battery_goal: { es: 'Construye una batería', en: 'Build a battery' },
  m_battery_text: { es: 'Se acerca la noche lunar. Dura unos 14 días terrestres y los paneles no producen. Construye una batería.', en: 'The lunar night is coming. It lasts about 14 Earth days and the panels make no power. Build a battery.' },
  m_shield_title: { es: 'Blindaje', en: 'Shielding' },
  m_shield_goal: { es: 'Refuerza la berma del hábitat', en: 'Reinforce the habitat’s berm' },
  m_shield_text: { es: 'La Luna no tiene atmósfera que frene la radiación del Sol. Usa el hábitat y refuerza su berma de regolito.', en: 'The Moon has no atmosphere to stop the Sun’s radiation. Use the habitat and reinforce its regolith berm.' },
  m_grow_title: { es: 'Crecer', en: 'Grow' },
  m_grow_goal: { es: 'Mejora el hábitat a nivel 2', en: 'Upgrade the habitat to level 2' },
  m_grow_text: { es: '¡Gran trabajo! Mejora el hábitat al nivel 2 para que la base crezca.', en: 'Great work! Upgrade the habitat to level 2 so the base can grow.' },
  m_colony_title: { es: 'Colonia', en: 'Colony' },
  m_colony_goal: { es: 'Haz crecer la base · nivel {have}', en: 'Grow the base · level {have}' },
  m_colony_text: { es: 'Sigue mejorando la base hasta convertirla en una colonia estable. Después: Marte.', en: 'Keep upgrading the base until it is a stable colony. Then: Mars.' },
  missionN: { es: 'Misión {n}', en: 'Mission {n}' },
  missionDone: { es: 'Misión cumplida · la Tierra envía {n} materiales', en: 'Mission complete · Earth sends {n} materials' },
  receiving: { es: 'Recibiendo transmisión…', en: 'Receiving transmission…' },
  landerComputer: { es: 'Computadora del módulo', en: 'Lander computer' },
  radioFrom: { es: 'Radio · Comandante Rivera · Tierra', en: 'Radio · Commander Rivera · Earth' },
  buildX: { es: 'Construir {x}', en: 'Build {x}' },
  useX: { es: 'Usar {x}', en: 'Use {x}' },
  keySpace: { es: 'Espacio', en: 'Space' },
  keyUse: { es: 'F', en: 'F' },
  lunarDay: { es: 'Día lunar', en: 'Lunar day' },
  lunarNight: { es: 'Noche lunar', en: 'Lunar night' },
  ok: { es: 'Entendido', en: 'Got it' },
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
