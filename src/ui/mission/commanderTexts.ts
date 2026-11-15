import type { Circuit, Command, Design, Failure, Horizon, Summary } from '../../engine/types';

export type Rating = 'optimal' | 'adequate' | 'critical';

export const ratingLabels: Record<Rating, string> = {
  optimal: 'Sólido',
  adequate: 'Ajustado',
  critical: 'Crítico',
};

export const commanderTexts = {
  title: 'Comandante lunar',
  lede: 'La simulación está en pausa. Ajustá la configuración, compará las dos proyecciones y confirmá solo si querés despachar los comandos.',
  close: 'Cerrar el comandante',
  situation: 'Situación actual',
  time: (t: number) => `Tiempo de misión: ${Math.round(t)} s`,
  life: (v: number) => `Soporte vital: ${Math.round(v)} % del recurso más bajo`,
  energy: (v: number) => `Energía: ${Math.round(v)} % de capacidad`,
  exposure: (v: number, limit: number) => `Exposición: ${v.toFixed(1)} u de ${limit} u`,
  crop: (v: number) => `Cultivo: ${Math.round(v)} % de crecimiento`,
  sheltered: (value: boolean) => (value ? 'En refugio' : 'Fuera del refugio'),
  controls: 'Borrador de comandos',
  controlsHint: 'Nada se despacha hasta confirmar. Cancelar deja la misión como está.',
  lights: 'Luces de cultivo',
  lightsValue: (value: number) => `${Math.round(value)} %`,
  heating: 'Calefacción',
  processor: 'Procesador',
  robots: 'Robots',
  shelter: 'Refugio',
  enterShelter: 'Entrar al refugio',
  leaveShelter: 'Salir del refugio',
  on: 'Activo',
  off: 'Apagado',
  horizon: 'Horizonte',
  horizonAria: 'Elegir horizonte de proyección',
  columns: { current: 'Sigo así', plan: 'Si cambio', delta: 'Diferencia' },
  rows: {
    minLife: 'Mínimo soporte vital',
    energy: 'Energía final',
    exposure: 'Exposición final',
    harvests: 'Cosechas futuras',
    outcome: 'Resultado',
  },
  rowsHelp: {
    minLife: 'Mínimo de O₂, agua y alimentos en las muestras del intervalo.',
    energy: 'Energía al final del horizonte, en % de capacidad.',
    exposure: 'Exposición acumulada en unidades didácticas (u).',
    harvests: 'Cosechas registradas por la proyección dentro del horizonte.',
    outcome: 'Fallo, o instante alcanzado si la proyección termina antes.',
  },
  policy: 'Mantiene configuración; no supone riegos, ajustes ni cosechas manuales futuros.',
  comparison: 'Comparación de proyecciones',
  difference: 'Diferencia entre proyecciones',
  noDifference: 'Sin diferencia medible en las muestras del horizonte.',
  differenceParts: {
    minLife: (delta: string) => `mínimo vital ${delta} %`,
    energy: (delta: string) => `energía final ${delta} %`,
    exposure: (delta: string) => `exposición ${delta} u`,
    harvests: (delta: string) => `cosechas ${delta}`,
  },
  noSamples: 'Sin muestras en el intervalo.',
  noFailure: (until: number) => `Sin fallo hasta ${Math.round(until)} s`,
  failureLine: (failure: Failure) => `${failure.title} · t=${Math.round(failure.t)} s`,
  reached: (got: number, target: number) => `Alcanzó ${Math.round(got)} s de ${Math.round(target)} s proyectados`,
  rejectedTitle: 'Comandos rechazados por el motor',
  noRejections: 'Sin rechazos en este borrador.',
  emptyPlan: 'No cambiaste ningún control. Confirmar mantiene la configuración actual.',
  confirm: 'Confirmar plan',
  cancel: 'Cancelar sin cambios',
  projectionError: 'La proyección falló; no se muestran cifras estimadas.',
  chartAria: 'Proyección de recursos y exposición para la configuración actual y para el plan.',
  chartGhostNote: 'Líneas tenues discontinuas: proyección con el plan.',
  units: { percent: '%', exposure: 'u' },
};

export const horizonLabels: Record<Horizon['kind'], string> = {
  seconds: '60 s',
  endOfDarkness: 'Fin de la oscuridad',
  endOfMission: 'Fin de la misión',
};

export function horizonLabel(horizon: Horizon): string {
  if (horizon.kind === 'seconds') return `${Math.round(horizon.value)} s`;
  return horizonLabels[horizon.kind];
}

export const powerLabels: Record<'heating' | 'processor' | 'robots' | 'greenhouse', string> = {
  heating: 'Calefacción',
  processor: 'Procesador',
  robots: 'Robots',
  greenhouse: 'Invernadero',
};

export const circuitLabels: Record<Circuit, string> = {
  lifeSupport: 'Soporte vital',
  heating: 'Calefacción',
  processor: 'Procesador',
  robots: 'Robots',
  greenhouse: 'Invernadero',
};

export function commandText(cmd: Command): string {
  switch (cmd.type) {
    case 'setGrowLights':
      return `Luces de cultivo al ${Math.round(cmd.value)} %`;
    case 'setPower':
      return `${powerLabels[cmd.system]} ${cmd.on ? 'encendido' : 'apagado'}`;
    case 'setPriority':
      return `Prioridad eléctrica: ${cmd.order.map((c) => circuitLabels[c]).join(' › ')}`;
    case 'irrigate':
      return 'Regar el cultivo';
    case 'adjustClimate':
      return `Ajustar clima ${cmd.dir > 0 ? '+1' : '−1'}`;
    case 'harvest':
      return 'Cosechar';
    case 'replant':
      return 'Replantar';
    case 'enterShelter':
      return 'Entrar al refugio';
    case 'leaveShelter':
      return 'Salir del refugio';
    case 'collectRegolith':
      return 'Recoger regolito';
    case 'deliverRegolith':
      return 'Entregar regolito';
  }
}

export function designLabel(design: Design): string {
  return [
    `Mástiles +${design.solarMasts}`,
    `Baterías +${design.batteries}`,
    `Invernadero +${design.greenhouse}`,
    design.processor ? 'Procesador' : 'Sin procesador',
    `Berma +${design.shield}`,
    `Reservas O₂ ${design.reserves.o2} · agua ${design.reserves.water} · alimento ${design.reserves.food}`,
  ].join(' · ');
}

export const designItemLabels = {
  solarMasts: 'Mástiles solares extra',
  batteries: 'Baterías',
  greenhouse: 'Niveles extra de invernadero',
  processor: 'Procesador de regolito',
  shield: 'Berma de regolito',
  reserveO2: 'Reservas de O₂ (+10 % de capacidad)',
  reserveWater: 'Reservas de agua (+10 % de capacidad)',
  reserveFood: 'Reservas de alimento (+10 % de capacidad)',
} as const;

export const chartTexts = {
  title: 'Recursos de la misión y exposición acumulada',
  ariaLabel: 'Gráfico de recursos en % de capacidad y exposición en unidades didácticas',
  description: (until: number, exposureMax: number) =>
    `Recursos en % de capacidad y exposición en u, hasta ${Math.round(until)} s. Escala de exposición 0 a ${exposureMax} u. Bandas rayadas: oscuridad y tormenta del escenario.`,
  empty: 'Sin muestras para graficar.',
  unitPercent: '% de capacidad',
  unitExposure: 'Exposición (u)',
  darkness: 'Oscuridad',
  storm: 'Tormenta',
  warning: 'Aviso',
  timeAxis: (t: number) => `${Math.round(t)} s`,
  ghostNote: 'Líneas tenues discontinuas: proyección con el plan.',
};

export const reportTexts = {
  victoryKicker: 'Misión cumplida',
  failureKicker: 'Misión fallida',
  victoryHeadline: 'Primera oscuridad superada',
  victoryLede: (duration: number, harvests: number) =>
    `La base alcanzó ${Math.round(duration)} s con la tripulación a bordo y ${harvests} cosecha${harvests === 1 ? '' : 's'} registrada${harvests === 1 ? '' : 's'}.`,
  failureLede: (explanation: string) => explanation,
  duration: (seconds: number) => `${Math.round(seconds)} s de misión`,
  tradeoffsTitle: 'Qué sostuviste y qué sacrificaste',
  energyTitle: '¿A dónde fue la energía?',
  energyNote:
    'Barras por causa, según el registro del motor. No se estiman desde muestras: si el motor no expone el registro, la sección no aparece.',
  energyCauses: { darkness: 'Oscuridad', storm: 'Tormenta' } as const,
  energyValue: (value: number) => `${value.toFixed(1)} u`,
  chartTitle: 'Evolución de la misión',
  chartHint: 'Deslizá horizontalmente para recorrer el gráfico. Los valores exactos están en la tabla.',
  chartTable: 'Ver valores de las muestras',
  columns: { time: 't (s)', o2: 'O₂', water: 'Agua', food: 'Alim.', energy: 'Energía', exposure: 'Exposición' },
  timelineTitle: 'Línea de tiempo',
  timelineHint: 'Decisiones propias y eventos del escenario, en orden de simulación.',
  timelineAll: 'Todo',
  timelineOwn: 'Solo mis decisiones',
  timelineCommand: 'Mi decisión',
  timelineEvent: 'Evento',
  rejected: 'Rechazado',
  rejectedNoReason: 'El motor rechazó el comando y no registró un motivo legible.',
  timelineEmpty: 'Sin entradas registradas.',
  comparisonTitle: 'Comparación con el intento anterior',
  comparisonPrevious: 'Intento anterior',
  comparisonCurrent: 'Este intento',
  comparisonEmpty: 'Primer intento registrado: la tabla comparativa aparecerá en el próximo informe.',
  comparisonRows: {
    result: 'Resultado',
    exposure: 'Exposición',
    harvests: 'Cosechas',
    minLifeSupport: 'Mínimo soporte vital',
    lights: 'Segundos con luces reducidas',
    design: 'Diseño',
  },
  resultVictory: 'Cumplida',
  resultFailed: (failure: Failure | null) => (failure ? `Fallida · ${failure.title}` : 'Fallida'),
  designTitle: 'Diseño y coste',
  designBudget: (spent: number, budget: number, credits: number) =>
    `Coste ${spent} de ${budget} créditos. Saldo sin usar: ${credits}.`,
  designBase: 'Solo equipo base incluido: nada extra comprado.',
  shieldNote:
    'La berma nivel 2 ya alcanza el tope de protección del kernel; el nivel 3 no garantiza una mejora adicional.',
  assessmentsTitle: 'Evaluaciones',
  sourcePrefix: 'Fuente:',
  retry: 'Reintentar con este diseño',
  menu: 'Volver al menú',
  disclaimer: 'Cifras didácticas: no son dosis médicas ni suponen afiliación a NASA.',
  noFoodSamples: 'Sin muestras de alimento para calcular el mínimo.',
  ratingTitles: {
    lifeSupport: 'Soporte vital',
    food: 'Alimentos',
    protection: 'Protección',
  },
};

export function signed(value: number, digits = 1): string {
  const rounded = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(rounded) < 0.05 ? 0 : rounded;
  const text = fixed.toFixed(digits);
  return fixed > 0 ? `+${text}` : text;
}

export function lifeSupportFinding(min: number, shortage: number, grace: number): string {
  if (!Number.isFinite(min)) return reportTexts.noFoodSamples;
  const graceLine = grace > 0 ? ` y el margen de gracia es de ${Math.round(grace)} s` : '';
  return `El recurso vital más débil tocó ${Math.round(min)} % de capacidad y la carencia acumulada llegó a ${Math.round(shortage)} s${graceLine}.`;
}

export function foodFinding(harvests: number, min: number, final: number): string {
  if (!Number.isFinite(min)) return `${harvests} cosecha(s) registrada(s). ${reportTexts.noFoodSamples}`;
  return `Se registraron ${harvests} cosecha(s). El alimento tocó ${Math.round(min)} % y cerró en ${Math.round(final)} % de capacidad.`;
}

export function protectionFinding(exposure: number, limit: number, sheltered: number, shield: number): string {
  const used = limit > 0 ? Math.round((exposure / limit) * 100) : 0;
  return `La exposición acumulada fue ${exposure.toFixed(1)} u (${used} % del límite de ${limit} u). Pasaste ${Math.round(sheltered)} s en refugio y la berma quedó en nivel ${shield}.`;
}

export function summaryTradeoffHeader(summary: Summary): string {
  return summary.phase === 'victory' ? reportTexts.victoryHeadline : 'Cierre de la misión';
}

export const assessmentScience = {
  lifeSupport:
    'Un sistema de soporte vital cerrado recicla agua y genera oxígeno; cuanto menor es el margen, menos tiempo queda para corregir antes de que el recurso más débil llegue a cero. Los números salen de las muestras y de los segundos acumulados por el motor.',
  food:
    'En un invernadero lunar el cultivo depende de luz, agua y temperatura, y compite por la misma energía que la calefacción. Las cifras miden cosechas registradas, no rendimiento agronómico real.',
  protection:
    'La exposición se lleva en unidades didácticas (u), no en dosis médicas. El refugio y la berma reducen la fracción de radiación recibida, pero no eliminan la radiación de fondo; la protección del kernel ya incluye el traje, por lo que no se descuenta dos veces.',
};

export const NASA_SOURCES = {
  eclss: {
    title: 'NASA — Environmental Control and Life Support Systems (ECLSS)',
    url: 'https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/',
    topic: 'Reciclaje de agua, electrólisis de oxígeno e interdependencia de sistemas.',
  },
  plants: {
    title: 'NASA — Growing Plants in Space',
    url: 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
    topic: 'Cultivos en ambientes controlados, consumo hídrico y producción diferida.',
  },
  shielding: {
    title: 'NASA Langley — Radiation Analysis and Shielding Design',
    url: 'https://ddtrb.larc.nasa.gov/radiation/',
    topic: 'Blindaje físico, refugios y mitigación parcial de exposición.',
  },
} as const;

export type { Summary };
