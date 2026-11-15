export type SequenceKind = 'arrival' | 'evacuation' | 'victory';
export const DURATIONS: Record<SequenceKind, number> = { arrival: 16, evacuation: 8, victory: 6 };
export const CUES: Record<SequenceKind, readonly { at: number; text: string }[]> = {
  arrival: [
    { at: 0, text: 'CONTROL · Misión confirmada. Inserción terrestre nominal.' },
    { at: 3.2, text: 'NAVE · Inyección translunar. Crucero cislunar.' },
    { at: 6.5, text: 'CONTROL · Aproximación lunar. Preparar descenso.' },
    { at: 9, text: 'NAVE · Descenso terminal. Zona de alunizaje adquirida.' },
    { at: 13, text: 'NAVE · Touchdown. Motor de descenso apagado.' },
    { at: 14.3, text: 'CONTROL · Operaciones de superficie autorizadas.' },
  ],
  evacuation: [
    { at: 0, text: 'CONTROL · Evacuación autorizada. Tripulación a bordo.' },
    { at: 2, text: 'NAVE · Escotilla asegurada. Iniciando ascenso.' },
    { at: 5, text: 'CONTROL · Base despejada. Enlace de retorno establecido.' },
    { at: 7, text: 'CONTROL · Centro de Control recibe la misión.' },
  ],
  victory: [
    { at: 0, text: 'CONTROL · Objetivos de misión verificados.' },
    { at: 3, text: 'NAVE · Registro de operaciones cerrado. Preparar revisión de vuelo.' },
  ],
};
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const segment = (time: number, start: number, end: number) => clamp01((time - start) / (end - start));
export function ease(value: number): number {
  if (value <= 0 || value >= 1) return clamp01(value);
  let lo = 0, hi = 1;
  for (let i = 0; i < 14; i++) {
    const t = (lo + hi) / 2;
    const x = 3 * (1 - t) ** 2 * t * 0.77 + 3 * (1 - t) * t ** 2 * 0.175 + t ** 3;
    if (x < value) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return t * t * (3 - 2 * t);
}
export function shot(kind: SequenceKind, t: number) {
  const cues = CUES[kind];
  const cue = cues.reduce((last, item, index) => t >= item.at ? index : last, 0);
  const orbital = kind === 'arrival' && t < 9;
  const mask = kind === 'arrival'
    ? t < 0.5 ? 1 - t / 0.5 : t >= 8.5 && t < 9 ? segment(t, 8.5, 9) : t >= 9 && t < 9.5 ? 1 - segment(t, 9, 9.5) : 0
    : kind === 'evacuation' ? segment(t, 7, 8) : segment(t, 5.3, 6);
  return { orbital, cue, text: cues[cue].text, mask, progress: clamp01(t / DURATIONS[kind]) };
}
