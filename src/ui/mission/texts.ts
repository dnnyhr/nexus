import { getLang } from '../i18n';


type Entry = { es: string; en: string };

const TEXTS = {
  menuTitle: { es: 'Misión 1: Primera oscuridad', en: 'Mission 1: First Darkness' },
  menuObjective: {
    es: 'Llega a {duration} s con la tripulación viva, exposición de {limit} u como máximo y sin recursos vitales en cero más de {grace} s.',
    en: 'Reach {duration} s with the crew alive, exposure at most {limit} u, and no life resource at zero for more than {grace} s.',
  },
  menuMission: { es: 'Empezar misión', en: 'Start mission' },
  menuFree: { es: 'Modo libre', en: 'Free mode' },
  menuFreeContinue: { es: 'Continuar Modo libre', en: 'Continue free mode' },
  menuFreeHint: { es: 'Sin objetivo: construye a tu ritmo. La misión no toca tu partida libre.', en: 'No objective: build at your own pace. The mission does not touch your free save.' },

  briefHead: { es: 'Briefing', en: 'Briefing' },
  briefSituation: {
    es: 'Situación: la base del polo sur tiene soporte vital, pero la oscuridad llega de {dStart} a {dEnd} s y una tormenta solar de {sStart} a {sEnd} s.',
    en: 'Situation: the south pole base has life support, but darkness comes from {dStart} to {dEnd} s and a solar storm from {sStart} to {sEnd} s.',
  },
  briefTest: {
    es: 'Qué pondrá a prueba: la energía sin paneles solares, el oxígeno, el agua, la comida y la exposición a la radiación.',
    en: 'What it tests: power without solar masts, oxygen, water, food and radiation exposure.',
  },
  briefWin: {
    es: 'Cómo se gana: llegar a {duration} s con la tripulación viva, exposición ≤ {limit} u y sin recurso vital en cero más de {grace} s.',
    en: 'How to win: reach {duration} s with the crew alive, exposure ≤ {limit} u, and no life resource at zero for more than {grace} s.',
  },
  briefNext: { es: 'Preparar base', en: 'Prepare base' },

  prepPrice: { es: '{p} créditos por unidad', en: '{p} credits each' },
  prepTitle: { es: 'Preparar base', en: 'Prepare base' },
  prepBudget: { es: 'Créditos: {spent} gastados de {budget} · quedan {left}', en: 'Credits: {spent} spent of {budget} · {left} left' },
  prepInvalid: { es: 'Diseño no válido', en: 'Invalid design' },
  prepAddMore: { es: 'Con lo que queda te alcanzan {n} más', en: 'What is left buys {n} more' },
  prepNoRoom: { es: 'No te alcanza para más', en: 'Not enough left for more' },
  prepMax: { es: 'Máximo {max}', en: 'Max {max}' },
  prepMinus: { es: 'Quitar {item}', en: 'Remove {item}' },
  prepPlus: { es: 'Añadir {item}', en: 'Add {item}' },
  prepConfirm: { es: 'Confirmar y empezar', en: 'Confirm and start' },
  prepBack: { es: 'Volver', en: 'Back' },
  prepSkipCredit: { es: 'Puedes confirmar sin gastar todo el crédito.', en: 'You can confirm without spending all the credits.' },
  estimateBefore: { es: 'Primer corte energético antes de la oscuridad (~{t} s).', en: 'First power cut before darkness (~{t} s).' },
  estimateStopped: { es: 'Proyección interrumpida por fallo a los {t} s; autonomía completa no comprobada.', en: 'Projection stopped by failure at {t} s; full endurance unverified.' },
  estimateTitle: { es: 'Estimación con ajustes iniciales, sin acciones futuras', en: 'Estimate with initial settings, no future actions' },
  estimatePending: { es: 'Calculando…', en: 'Calculating…' },
  estimateInvalid: { es: 'Corrige el diseño para estimar.', en: 'Fix the design to estimate.' },
  estimateEmpty: { es: 'Energía en oscuridad: alcanza ~{s} s con consumo base, hasta el primer corte', en: 'Power in darkness: lasts ~{s} s at base use, until the first cut' },
  estimateHolds: { es: 'Energía en oscuridad: aguanta toda la oscuridad ({s} s) con consumo base sin cortes', en: 'Power in darkness: holds through all of the darkness ({s} s) at base use without cuts' },
  prevTitle: { es: 'Intento anterior', en: 'Previous attempt' },
  prevVictory: { es: 'Victoria', en: 'Victory' },
  prevFailed: { es: 'Fallo', en: 'Failure' },
  prevReached: { es: '{phase} a los {t} s · {h} cosechas', en: '{phase} at {t} s · {h} harvests' },
  prevChanges: { es: 'Cambios de diseño', en: 'Design changes' },
  prevNoChanges: { es: 'Mismo diseño que el intento anterior', en: 'Same design as the previous attempt' },

  reserveO2: { es: 'Oxígeno', en: 'Oxygen' },
  reserveWater: { es: 'Agua', en: 'Water' },
  reserveFood: { es: 'Comida', en: 'Food' },

  groupPower: { es: 'Energía', en: 'Power' },
  groupLife: { es: 'Soporte vital', en: 'Life support' },
  groupCrop: { es: 'Cultivo', en: 'Crops' },
  groupShield: { es: 'Blindaje', en: 'Shielding' },

  item_solarMasts: { es: 'Mástil solar extra', en: 'Extra solar mast' },
  item_batteries: { es: 'Batería', en: 'Battery' },
  item_processor: { es: 'Procesador', en: 'Processor' },
  item_greenhouse: { es: 'Nivel de invernadero', en: 'Greenhouse level' },
  item_shield: { es: 'Berma de regolito', en: 'Regolith berm' },
  item_reserveO2: { es: 'Reserva de oxígeno', en: 'Oxygen reserve' },
  item_reserveWater: { es: 'Reserva de agua', en: 'Water reserve' },
  item_reserveFood: { es: 'Reserva de comida', en: 'Food reserve' },

  effect_solarMasts: { es: 'Produce energía solo de día; de noche no produce.', en: 'Makes power only by day; none at night.' },
  effect_batteries: {
    es: 'Aumenta la capacidad de almacenar energía. La carga inicial sigue siendo {initial} %.',
    en: 'Raises how much power can be stored. The starting charge is still {initial} %.',
  },
  effect_processor: { es: 'Convierte regolito en oxígeno y materiales. Se apaga en refugio.', en: 'Turns regolith into oxygen and materials. Stops in the shelter.' },
  effect_greenhouse: {
    es: 'Cada nivel extra aumenta el consumo del cultivo. Se detiene en refugio.',
    en: 'One extra level adds grow lights that use power. Stops in the shelter.',
  },
  effect_shield: {
    es: 'Protege dentro del refugio. La curva satura: comprar el máximo no garantiza protección adicional.',
    en: 'Protects inside the shelter. Protection saturates: buying the maximum does not guarantee extra protection.',
  },
  effect_reserveO2: { es: 'Suma {pct} % de capacidad de oxígeno al empezar.', en: 'Adds {pct} % of oxygen capacity at the start.' },
  effect_reserveWater: { es: 'Suma {pct} % de capacidad de agua al empezar.', en: 'Adds {pct} % of water capacity at the start.' },
  effect_reserveFood: { es: 'Suma {pct} % de capacidad de comida al empezar.', en: 'Adds {pct} % of food capacity at the start.' },

  barPause: { es: 'Pausa (P)', en: 'Pause (P)' },
  barResume: { es: 'Reanudar (P)', en: 'Resume (P)' },
  barPaused: { es: 'PAUSA', en: 'PAUSED' },
  barRunning: { es: 'En marcha', en: 'Running' },
  barEnded: { es: 'Misión terminada', en: 'Mission over' },
  barCommander: { es: 'Comandante', en: 'Commander' },
  barSkip: { es: 'Siguiente evento ⏭', en: 'Next event ⏭' },
  barSkipHint: { es: 'Avanza sin esperar hasta el próximo aviso, inicio o fin. La simulación no se salta: corre los mismos pasos.', en: 'Fast-forward to the next warning, start or end. The simulation is not skipped: it runs the same steps.' },
  barClock: { es: '{t} / {d} s', en: '{t} / {d} s' },
  barExposure: { es: 'Exposición {x} u de {limit} u', en: 'Exposure {x} u of {limit} u' },
  barWindows: { es: 'Oscuridad {dStart}–{dEnd} s · Tormenta {sStart}–{sEnd} s', en: 'Darkness {dStart}–{dEnd} s · Storm {sStart}–{sEnd} s' },
  barNoEvents: { es: 'Sin eventos pendientes', en: 'No pending events' },
  evDarkness: { es: 'oscuridad', en: 'darkness' },
  evStorm: { es: 'tormenta', en: 'storm' },
  nextWarn: { es: 'Aviso de {label} en {s} s', en: '{label} warning in {s} s' },
  nextStarts: { es: 'La {label} empieza en {s} s', en: 'The {label} starts in {s} s' },
  nextRunning: { es: 'La {label} está en curso: termina en {s} s', en: 'The {label} is under way: ends in {s} s' },
  powerBalance: { es: 'Producción {g}/s · consumo {d}/s · batería {b} %. Balance {net}/s antes de límites y cortes.', en: 'Production {g}/s · demand {d}/s · battery {b} %. Balance {net}/s before limits and cuts.' },
  barEventWindow: { es: '{label}: aviso {warn} s · {start}–{end} s', en: '{label}: warning {warn} s · {start}–{end} s' },
  barTimeline: { es: 'Cronología de misión', en: 'Mission timeline' },
  powerNight: { es: 'Noche: no hay producción. Consumo {d}/s; batería al {b} %.', en: 'Night: no production. Use {d}/s; battery at {b} %.' },
  powerCharge: { es: 'Producción {g}/s cubre el consumo {d}/s: la batería se recarga; {b} %.', en: 'Making {g}/s covers the use of {d}/s: the battery charges; {b} %.' },
  powerDrain: { es: 'Consumo {d}/s supera la producción {g}/s: la batería baja; {b} %.', en: 'Use of {d}/s exceeds the {g}/s made: the battery drops; {b} %.' },
  powerShortage: { es: 'Hay cortes: se apagaron sistemas por falta de energía.', en: 'Cuts: systems shut down for lack of power.' },
  powerMeterTitle: { es: 'Producción frente a consumo', en: 'Production vs use' },
  powerMake: { es: 'Producción', en: 'Making' },
  powerUse: { es: 'Consumo', en: 'Using' },
} as const satisfies Record<string, Entry>;

export type TextKey = keyof typeof TEXTS;

export function tx(key: TextKey, vars: Record<string, string | number> = {}): string {
  return TEXTS[key][getLang()].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
