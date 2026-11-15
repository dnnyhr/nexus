import { getLang } from '../i18n';


type Entry = { es: string; en: string };

const TEXTS = {
  menuTitle: { es: 'Misión 1: La primera oscuridad', en: 'Mission 1: The first darkness' },
  menuObjective: {
    es: 'Tu base tiene que aguantar {duration} segundos. Viene una oscuridad sin Sol y una tormenta solar. Prepárala bien y mantén viva a tu tripulación.',
    en: 'Your base has to last {duration} seconds. A darkness with no Sun is coming, and a solar storm. Get it ready and keep your crew alive.',
  },
  menuMission: { es: 'Jugar la misión', en: 'Play the mission' },
  menuFree: { es: 'Modo libre', en: 'Free mode' },
  menuFreeContinue: { es: 'Seguir en modo libre', en: 'Continue free mode' },
  menuFreeHint: { es: 'Construye tu base a tu ritmo, sin reloj. La misión no cambia tu partida libre.', en: 'Build your base at your own pace, with no clock. The mission does not change your free game.' },

  briefHead: { es: 'Lo que va a pasar', en: 'What is going to happen' },
  briefSituation: {
    es: 'Del segundo {dStart} al {dEnd} se va el Sol: los paneles solares no darán energía. Del segundo {sStart} al {sEnd} llega una tormenta solar con mucha radiación.',
    en: 'From second {dStart} to {dEnd} the Sun goes away: the solar panels will make no power. From second {sStart} to {sEnd} a solar storm brings lots of radiation.',
  },
  briefTest: {
    es: 'Antes de empezar, eliges qué llevar con 300 créditos. No alcanza para todo: piensa qué necesitas más.',
    en: 'Before you start, you choose what to bring with 300 credits. It is not enough for everything: think about what you need most.',
  },
  briefWin: {
    es: 'Ganas si llegas al segundo {duration} con la tripulación viva, sin pasar de {limit} puntos de radiación y sin quedarte sin aire, agua o comida.',
    en: 'You win if you reach second {duration} with the crew alive, without going over {limit} radiation points and without running out of air, water or food.',
  },
  briefNext: { es: 'Elegir qué llevar', en: 'Choose what to bring' },

  prepPrice: { es: '{p} créditos', en: '{p} credits' },
  prepTitle: { es: 'Elige qué llevar', en: 'Choose what to bring' },
  prepBudget: { es: 'Gastaste {spent} de {budget} créditos · te quedan {left}', en: 'You spent {spent} of {budget} credits · {left} left' },
  prepInvalid: { es: 'Algo no cuadra:', en: 'Something is off:' },
  prepAddMore: { es: 'puedes llevar {n} más', en: 'you can bring {n} more' },
  prepNoRoom: { es: 'no te alcanza para más', en: 'not enough credits for more' },
  prepMax: { es: 'máximo {max}', en: 'up to {max}' },
  prepMinus: { es: 'Quitar {item}', en: 'Remove {item}' },
  prepPlus: { es: 'Añadir {item}', en: 'Add {item}' },
  prepConfirm: { es: '¡Listo, empezar!', en: 'Ready, start!' },
  prepBack: { es: 'Volver', en: 'Back' },
  prepSkipCredit: { es: 'No hace falta gastar todos los créditos.', en: 'You do not have to spend all the credits.' },
  estimateBefore: { es: 'te quedarás sin energía antes de que se vaya el Sol (segundo {t}).', en: 'you will run out of power before the Sun goes away (second {t}).' },
  estimateStopped: { es: 'la misión falla en el segundo {t}, antes de saberlo.', en: 'the mission fails at second {t}, before we can tell.' },
  estimateTitle: { es: '¿Alcanza la energía en la oscuridad?', en: 'Will the power last in the dark?' },
  estimatePending: { es: 'calculando…', en: 'working it out…' },
  estimateInvalid: { es: 'arregla tu lista para saberlo.', en: 'fix your list to find out.' },
  estimateEmpty: { es: 'no. Con todo encendido, la batería se vacía a los {s} segundos de oscuridad.', en: 'no. With everything on, the battery runs out after {s} seconds of darkness.' },
  estimateHolds: { es: 'sí. Con todo encendido, la batería aguanta los {s} segundos de oscuridad.', en: 'yes. With everything on, the battery lasts the {s} seconds of darkness.' },
  prevTitle: { es: 'Tu intento anterior', en: 'Your last try' },
  prevVictory: { es: 'Ganaste', en: 'You won' },
  prevFailed: { es: 'Perdiste', en: 'You lost' },
  prevReached: { es: '{phase} en el segundo {t} · {h} cosechas', en: '{phase} at second {t} · {h} harvests' },
  prevChanges: { es: 'Lo que cambiaste', en: 'What you changed' },
  prevNoChanges: { es: 'Llevas lo mismo que la vez anterior', en: 'You are bringing the same as last time' },

  reserveO2: { es: 'Aire', en: 'Air' },
  reserveWater: { es: 'Agua', en: 'Water' },
  reserveFood: { es: 'Comida', en: 'Food' },

  groupPower: { es: 'Energía', en: 'Power' },
  groupLife: { es: 'Aire, agua y comida', en: 'Air, water and food' },
  groupCrop: { es: 'Invernadero', en: 'Greenhouse' },
  groupShield: { es: 'Protección contra la radiación', en: 'Protection from radiation' },

  item_solarMasts: { es: 'Panel solar extra', en: 'Extra solar panel' },
  item_batteries: { es: 'Batería', en: 'Battery' },
  item_processor: { es: 'Fábrica de oxígeno', en: 'Oxygen maker' },
  item_greenhouse: { es: 'Invernadero más grande', en: 'Bigger greenhouse' },
  item_shield: { es: 'Muro de tierra lunar', en: 'Moon-soil wall' },
  item_reserveO2: { es: 'Tanque de aire', en: 'Air tank' },
  item_reserveWater: { es: 'Tanque de agua', en: 'Water tank' },
  item_reserveFood: { es: 'Caja de comida', en: 'Food box' },

  effect_solarMasts: { es: 'Da más energía cuando hay Sol. En la oscuridad no sirve.', en: 'Makes more power when the Sun shines. In the dark it does nothing.' },
  effect_batteries: {
    es: 'Guarda la energía del Sol para usarla cuando oscurezca.',
    en: 'Stores the Sun’s power to use when it gets dark.',
  },
  effect_processor: { es: 'Saca oxígeno de la tierra lunar: casi la mitad de esas rocas es oxígeno. Gasta energía.', en: 'Gets oxygen out of Moon soil: almost half of those rocks is oxygen. Uses power.' },
  effect_greenhouse: {
    es: 'Da más comida en cada cosecha, pero sus luces gastan más energía.',
    en: 'Gives more food each harvest, but its lights use more power.',
  },
  effect_shield: {
    es: 'Cubre el refugio con tierra lunar, que frena la radiación. Con 2 ya casi llegas al máximo.',
    en: 'Covers the shelter with Moon soil, which stops radiation. With 2 you are almost at the most it can do.',
  },
  effect_reserveO2: { es: 'Empiezas con más aire para respirar.', en: 'You start with more air to breathe.' },
  effect_reserveWater: { es: 'Empiezas con más agua para beber y regar.', en: 'You start with more water to drink and to water plants.' },
  effect_reserveFood: { es: 'Empiezas con más comida.', en: 'You start with more food.' },

  barPause: { es: 'Pausa (P)', en: 'Pause (P)' },
  barResume: { es: 'Seguir (P)', en: 'Go on (P)' },
  barPaused: { es: 'EN PAUSA', en: 'PAUSED' },
  barRunning: { es: 'En marcha', en: 'Running' },
  barEnded: { es: 'Terminó', en: 'Over' },
  barCommander: { es: '¿Qué hago?', en: 'What should I do?' },
  barSkip: { es: 'Saltar al siguiente aviso ⏭', en: 'Skip to the next warning ⏭' },
  barSkipHint: { es: 'Avanza rápido hasta el próximo aviso. El juego no se salta nada: pasa lo mismo, solo que más rápido.', en: 'Fast-forward to the next warning. Nothing is skipped: the same things happen, only faster.' },
  barClock: { es: 'Segundo {t} de {d}', en: 'Second {t} of {d}' },
  barExposure: { es: 'Radiación {x} de {limit}', en: 'Radiation {x} of {limit}' },
  barWindows: { es: 'Oscuridad {dStart}–{dEnd} · Tormenta {sStart}–{sEnd}', en: 'Darkness {dStart}–{dEnd} · Storm {sStart}–{sEnd}' },
  barNoEvents: { es: 'Ya pasó lo difícil: aguanta hasta el final', en: 'The hard part is over: hold on to the end' },
  evDarkness: { es: 'oscuridad', en: 'darkness' },
  evStorm: { es: 'tormenta', en: 'storm' },
  nextWarn: { es: 'En {s} s te avisan de la {label}', en: '{label} warning in {s} s' },
  nextStarts: { es: 'La {label} empieza en {s} s', en: 'The {label} starts in {s} s' },
  nextRunning: { es: 'Estás en la {label}: faltan {s} s', en: 'You are in the {label}: {s} s to go' },
  powerBalance: { es: 'Entra {g} y sale {d} de energía por segundo · batería al {b} %', en: '{g} power in and {d} out each second · battery at {b} %' },
  barEventWindow: { es: '{label}: aviso en {warn} s · de {start} a {end} s', en: '{label}: warning at {warn} s · from {start} to {end} s' },
  barTimeline: { es: 'Lo que viene en la misión', en: 'What is coming in the mission' },
  powerNight: { es: 'Oscuridad: no entra energía. Sale {d} por segundo; batería al {b} %.', en: 'Dark: no power comes in. {d} goes out each second; battery at {b} %.' },
  powerCharge: { es: 'Entra más de lo que sale: la batería se carga ({b} %).', en: 'More comes in than goes out: the battery charges ({b} %).' },
  powerDrain: { es: 'Sale más de lo que entra: la batería baja ({b} %).', en: 'More goes out than comes in: the battery drops ({b} %).' },
  powerShortage: { es: 'No alcanza la energía: se apagaron cosas.', en: 'Not enough power: things were switched off.' },
  powerMeterTitle: { es: 'Energía', en: 'Power' },
  powerMake: { es: 'Entra', en: 'In' },
  powerUse: { es: 'Sale', en: 'Out' },
} as const satisfies Record<string, Entry>;

export type TextKey = keyof typeof TEXTS;

export function tx(key: TextKey, vars: Record<string, string | number> = {}): string {
  return TEXTS[key][getLang()].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
