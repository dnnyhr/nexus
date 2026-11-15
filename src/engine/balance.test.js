import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyCommand, checkDesign, emptyDesign, MISSION_RULES, startMission, summarize, worldStep } from './index';

export const DESIGN_A = { ...emptyDesign(), greenhouse: 2, solarMasts: 1, shield: 1, reserves: { o2: 2, water: 2, food: 0 } };
export const DESIGN_B = { ...emptyDesign(), batteries: 3, shield: 2, solarMasts: 1 };
export const DESIGN_C = { ...emptyDesign(), greenhouse: 2, solarMasts: 3 };

export function operate(ms , policy ) {
  if (ms.t % 5 !== 0) return;
  const send = (cmd ) => {
    const result = applyCommand(ms, cmd);
    if (!result.ok) throw new Error(`Política ${policy}: ${JSON.stringify(cmd)}: ${result.reason}`);
  };
  if (policy !== 'riesgo') {
    if (ms.t === 480) send({ type: 'enterShelter' });
    if (ms.t === 540) send({ type: 'leaveShelter' });
  }
  const lights = policy === 'riesgo' ? 100 : policy === 'granja' && ms.t >= 240 && ms.t < 420 ? 20 : 50;
  if (ms.game.power.growLights !== lights) send({ type: 'setGrowLights', value: lights });
  if (ms.game.sheltered) return;
  if (ms.game.plant.dead) {
    if (ms.game.res.materials >= 8) send({ type: 'replant' });
    return;
  }
  if (ms.game.plant.water <= 38 && ms.game.res.water >= 2) send({ type: 'irrigate' });
  if (ms.game.res.energy >= 3) {
    if (ms.game.plant.temp > 58) send({ type: 'adjustClimate', dir: -1 });
    else if (ms.game.plant.temp < 42) send({ type: 'adjustClimate', dir: 1 });
  }
  if (ms.game.plant.growth >= 100) send({ type: 'harvest' });
  if (ms.game.levels.processor && ms.game.res.regolith < 6) {
    for (let i = 0; i < 3; i++) send({ type: 'collectRegolith' });
    send({ type: 'deliverRegolith' });
  }
}

function cases() {
  const result = [
    { name: 'A', design: DESIGN_A, policy: 'granja' },
    { name: 'B', design: DESIGN_B, policy: 'batería' },
    { name: 'C', design: DESIGN_C, policy: 'riesgo' },
  ];
  for (const policy of ['granja', 'batería'] ) {
    result.push({ name: `base-${policy}`, design: emptyDesign(), policy });
    for (const [key, max] of [['solarMasts', 3], ['batteries', 3], ['greenhouse', 2], ['processor', 1], ['shield', 3]] ) {
      for (let n = 1; n <= max; n++) result.push({ name: `${key}-${n}-${policy}`, design: { ...emptyDesign(), [key]: n }, policy });
    }
    for (const r of ['o2', 'water', 'food'] ) {
      for (const n of [2, 5]) result.push({ name: `${r}-${n}-${policy}`, design: { ...emptyDesign(), reserves: { ...emptyDesign().reserves, [r]: n } }, policy });
    }
    for (const batteries of [1, 2, 3]) {
      for (const greenhouse of [0, 1, 2]) {
        const design = { ...emptyDesign(), batteries, greenhouse, shield: 1 };
        if (checkDesign(design).ok) result.push({ name: `mix-${batteries}-${greenhouse}-${policy}`, design, policy });
      }
    }
  }
  return result;
}

export function runCase(c ) {
  const ms = startMission(c.design);
  while (ms.phase === 'running') {
    operate(ms, c.policy);
    worldStep(ms);
  }
  return ms;
}

const fmt = (n ) => n.toFixed(2);

describe('representative balance sweep', () => {
  it('runs at least 30 unique valid designs and records measured outcomes', () => {
    const inputs = cases();
    const rows = inputs.map(c => ({ ...c, ms: runCase(c), cost: checkDesign(c.design).spent }));
    expect(inputs.length).toBeGreaterThanOrEqual(30);
    expect(new Set(inputs.map(c => JSON.stringify(c.design))).size).toBeGreaterThanOrEqual(30);
    expect(rows.every(c => checkDesign(c.design).ok)).toBe(true);
    expect(rows.slice(0, 3).map(c => c.cost)).toEqual([260, 270, 240]);
    expect(rows[0].ms.phase).toBe('victory');
    expect(rows[1].ms.phase).toBe('victory');
    expect(rows[2].ms.failure?.code).toBe('exposure_exceeded');
    expect(rows[0].ms.metrics.secondsLightsReduced).toBe(180);
    expect(rows[1].ms.metrics.secondsLightsReduced).toBe(0);
    const winners = rows.filter(c => c.ms.phase === 'victory');
    for (const item of ['solarMasts', 'batteries', 'greenhouse', 'processor', 'shield']         ) expect(winners.some(c => c.design[item] === 0)).toBe(true);
    for (const c of rows) {
      expect(c.ms.events.filter(e => e.kind === 'harvest').length).toBe(c.ms.game.stats.harvests);
      expect(JSON.parse(JSON.stringify(c.ms))).toEqual(c.ms);
    }
    const report = [
      '# Balance Misión 1 — barrido reproducible', '',
      'Generado con `UPDATE_MISSION_BALANCE=1 npm test -- src/engine/balance.test.js`. Sin variable, el test verifica que este documento coincide con resultados actuales.', '',
      `Casos: ${rows.length}; diseños únicos: ${new Set(inputs.map(c => JSON.stringify(c.design))).size}; victorias: ${winners.length}. No es búsqueda exhaustiva ni QA del producto integrado.`, '',
      '## Reglas y adaptación', '',
      `Reservas: 50 % + 10 % por paquete; energía inicial: ${MISSION_RULES.initialEnergy * 100} % de capacidad (120 + 300 por batería). Comprar batería agrega capacidad y media carga, no carga completa.`, '',
      'Cultivo inicial: agua/luz/temperatura 50, crecimiento/estrés 0, vivo. Luces iniciales 50 %. Demanda LED = brillo / 100 × 0.9 × nivel. Resolución de potencia comparte resolvePower; consumo/procesador comparten step; cultivo comparte stepGreenhouse; protección comparte protection. No tick ni tormentas libres.', '',
      'Refugio: procesador/robots/LED apagados; crecimiento suspendido. Agua, temperatura y estrés siguen evolucionando: refugio no conserva mágicamente el cultivo. Calefacción nocturna consume 0.5/s; soporte vital 0.6/s sigue activo. Acciones manuales agrícolas suspendidas hasta salir.', '',
      'Métricas por paso de 0.25 s: minLifeSupport incluye inicio y comandos; secondsLightsReduced cuenta decisión de brillo <50 fuera del refugio, independiente de cortes; secondsShortage cuenta limitación energética; secondsSheltered cuenta permanencia. No inferidas de samples. lastPower es balance del último intervalo, no pronóstico del siguiente.', '',
      'Ledger aprobado: crew registra consumo vital y energía de soporte fuera de refugio; shelter registra esa misma energía mientras está dentro, sin ahorro ficticio. solar, lights, heating y processor registran flujos; irrigation, climate y harvest registran cambios reales por comando. storage recoge saturación/límite cero y residuo numérico. Cierre por intervalo: suma de diferencias de causas = recursos finales − iniciales. Las causas no incluyen salud, regolito ni materiales.', '',
      '## Políticas', '',
      '- Todas revisan cada 5 s: riegan con agua de planta ≤38; ajustan temperatura >58/ <42 si hay 3 energía; cosechan al llegar a 100; replantan si hay 8 materiales. Procesador: tres excavaciones y entrega si tolva <6. No se alteran recursos/cultivo directamente.',
      '- granja: 50 % LED, 20 % entre 240–420; refugio [480,540).',
      '- batería: 50 % LED todo el tiempo; refugio [480,540).',
      '- riesgo: 100 % LED, sin refugio; mismo mantenimiento manual. C falla por exposición.', '',
      '## Ajustes de balance', '',
      '| Constante en mission1.ts | Antes | Después | Motivo |',
      '| --- | --- | --- | --- |',
      `| unpoweredHealthLoss | 0.3 | ${MISSION_RULES.unpoweredHealthLoss} | Valor inicial; sin ajuste tras barrido |`,
      `| agriculturalDrawPerLevel | 1 | ${MISSION_RULES.agriculturalDrawPerLevel} | Escala LED por nivel; sin ajuste tras barrido |`,
      '| cronología / presupuesto / límite exposición | 600 s / 300 / 40 u | sin cambios | Contrato preservado |', '',
      'No se ajustó kernel libre ni curva de protección. Berma 2 y 3 saturan en 97 %: nivel 3 no mejora protección y queda dominado por nivel 2 para esta misión. No se presenta como compra ventajosa.', '',
      '## Resultados', '',
      'Diseño: S=solares extra, B=baterías, G=niveles agrícolas extra, P=procesador, R=berma; reservas O2/agua/alimento en paquetes.', '',
      '| Caso | Política | S/B/G/P/R; reservas | Coste | Resultado / motivo | Duración s | minLifeSupport % | Exposición u | Cosechas | Refugio s | Cortes s |',
      '| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...rows.map(c => {
        const d = c.design;
        const s = summarize(c.ms);
        return `| ${c.name} | ${c.policy} | ${d.solarMasts}/${d.batteries}/${d.greenhouse}/${d.processor}/${d.shield}; ${d.reserves.o2}/${d.reserves.water}/${d.reserves.food} | ${c.cost} | ${s.phase}${s.failure ? ` / ${s.failure.code}` : ''} | ${fmt(s.duration)} | ${fmt(s.minLifeSupport)} | ${fmt(s.exposure)} | ${s.harvests} | ${fmt(s.secondsSheltered)} | ${fmt(s.secondsShortage)} |`;
      }), '',
      '## API y lecturas para integración', '',
      '`src/engine/index.ts` exporta tipos y STEP/SAMPLE_EVERY; SCENARIO_1/SCENARIO_SOURCE/PRICES/LIMITS/MISSION_RULES; emptyDesign/checkDesign/startMission; applyToGame/applyCommand; worldStep/project/replay; darknessAt/nextEvent/summarize.', '',
      'HUD: ms.t, ms.phase, ms.game.res + capacity(ms.game), ms.lastPower, ms.exposure en u, ms.scenario, ms.events, ms.metrics y ms.ledger. No usar game.dose ni cyclePhase libres. lastPower.running distingue controles solicitados de sistemas realmente alimentados; demand incluye requisito vital aunque lifeSupportPowered sea false. Saturación de almacenamiento explica por qué generación − demanda no equivale siempre a variación de batería.', '',
      'MissionLedger es diferencia acumulada desde inicio, no saldo: ledger[recurso][causa]. Se actualiza también en comandos. Sin sumar causas con unidades distintas. El campo es obligatorio en MissionState; B/C/D deben incorporar este contrato aprobado, sin fixtures anteriores ni tipos duplicados.', '',
      'El integrador bloquea dispatch durante pausa/overlay y no llama worldStep mientras está pausado. MissionState no contiene pausa: motor no puede conocerla. applyCommand comprueba cierre y restricciones de refugio, registra aceptación/rechazo. Entradas no finitas rechazadas se canonizan a null dentro del log para conservar JSON/replay.', '',
      'worldStep avanza 0.25 s. Para proyección, segundos finitos no negativos alineados a STEP; endOfDarkness usa siguiente final pendiente, o final de misión. Projection.until informa instante realmente alcanzado. project aplica plan ahora, incluye solo eventos nuevos y no presume acciones humanas futuras. replay valida tiempos alineados/orden/aceptación; procesa comandos al instante final solicitado.', '',
      'Radio: consumir eventos nuevos por índice estable; no repetirlos por frame. Al sustituir estado tras inicio/reintento, reconstruir referencias de escena. Exposición didáctica no se convierte a mSv; fuente fija en SCENARIO_SOURCE y scenario.events[].inspiredBy.', '',
      '## Lectura y límites', '',
      'A y B ganan con configuraciones y gestión energética distintas; C pierde con motivo medido. Ningún ítem extra es necesario en todas las victorias de este barrido. Eso no demuestra ausencia de estrategia dominante: comparar costes, continuidad, cosechas y soporte mínimo requiere ponderar objetivos. Hay victorias de base sin compras: dificultad actual permisiva; calibración educativa con estudiantes pendiente.', '',
      'Un solar extra mejora carga diurna; baterías sostienen oscuridad; cultivo aumenta rendimiento y demanda; procesador recupera O2 a cambio de energía y trabajo; berma reduce exposición solo bajo refugio. Reservas mejoran saldo inicial del recurso comprado. No hay bonificación invisible por diseño A/B.', '',
      'Pausa/1x/2x/agrupación de frames requieren runner real del integrador. Navegador, teléfono, guardado libre y flujo completo no verificados desde carril A.', '',
    ].join('\n');
    const path = fileURLToPath(new URL('../../docs/mision-1/balance.md', import.meta.url));
    if (process.env.UPDATE_MISSION_BALANCE === '1') writeFileSync(path, report);
    expect(readFileSync(path, 'utf8')).toBe(report);
  }, 30000);
});
