# NEXUS — plan de dirección y contratos de integración (fase 2)

Fecha: 2026-11-15. Rama de integración: `feat/mision-1` (checkout principal). Sin push, PR, `main` ni deploy.

## Objetivo

Demo de 2 minutos ante jurado: menú → preparar base → operar 3D → crisis de oscuridad → decidir con comandante → informe → reintentar. Prioridad: integración real y aprendizaje (energía ≠ potencia, prioridad de cargas, refugio) sobre cantidad de funciones. Sin frameworks nuevos ni dependencias.

## Estado verificado

| Carril | Rama | Commit | Estado |
| --- | --- | --- | --- |
| Motor (A) | `feat/mision-motor` | `0c8379a` | Motor determinista completo; QA 58/58 en aislamiento |
| Preparación/barra (B) | `feat/mision-preparar` | `5394db5` | Módulos UI; validados solo contra tipos |
| Comandante/informe (C) | `feat/mision-comandante` | `38af959` | Módulos UI; validados solo contra tipos |
| QA (D) | `test/mision-qa` | `1e7aeee` | Suite lista; bloqueos H-01 (sin integrar), H-02 (runner) |
| Experiencia 3D | `feat/experiencia-3d` | `04feeba` + WIP | Cámara, iluminación, paleta, `ui/flightreview` |
| Telemetría | `feat/mision-telemetria` | `04feeba` + WIP | `src/data/models.ts`, `telemetry.ts` |
| Experiencia UI | **checkout principal** | WIP sin commit | `src/ui/experience/**`, `i18n.ts`, `experience-preview.html` |

Riesgo abierto: el agente de experiencia UI escribe en el checkout del integrador. Debe moverse a su worktree; el integrador no commitea ni modifica esos archivos.

## Cuatro agentes

| Agente | Propiedad exclusiva | Entrega |
| --- | --- | --- |
| 1 — Motor e integración | `src/engine/**`, `src/game/**`, `src/main.ts`, merges en `feat/mision-1` | Motor, runner, circuitos eléctricos, balance, conexión de módulos |
| 2 — Experiencia 3D | `src/scene/**`, `src/models/**`, `src/ui/flightreview/**` | Cámara, luz, estética cinematográfica |
| 3 — Experiencia UI y textos | `src/ui/experience/**`, `src/ui/mission/**`, `src/ui/i18n.ts`, CSS de UI | Centro de control, HUD de sistemas, preparación, comandante, informe |
| 4 — QA y telemetría de prueba | `tests/**`, `docs/qa/**`, `src/data/**` (telemetría) | Regresión, determinismo, navegador/teléfono por separado |

Asignación de 2–4 inferida de los worktrees activos; el usuario confirma. Ningún agente edita archivos de otro: pide el cambio por contrato.

## Fases y gates

1. **Base motor** (Agente 1): integrar A, B, C, D en `feat/mision-1` tras revisión. Gate: tests + build verdes. *Bloqueado: merges locales requieren autorización explícita del usuario.*
2. **Circuitos eléctricos** (Agente 1): kernel listo en `src/game` (C1). Falta adaptarlo al motor (C2) y rebalancear la misión documentando el antes y el después.
3. **Runner** (Agente 1): `src/engine/runner.ts` sobre `fixedStepClock` (C3). Gate: matriz 1/4/40 pasos por frame, 1x/2x y pausa, idéntica.
4. **Conexión** (Agente 1): `main.ts` con modos `menu | free | mission` (C4). Gate: flujo completo en navegador de escritorio.
5. **Pulido** (Agentes 2/3) contra el commit integrado. **QA** (Agente 4) sobre el producto real. QA del teléfono, por separado.

## Contratos

### C1 — Circuitos eléctricos (hecho, `src/game`)

- `config.ts`: `type Circuit = 'lifeSupport' | 'heating' | 'processor' | 'robots' | 'greenhouse'`; `POWER.defaultPriority` = orden histórico (luces se cortan primero, soporte vital último); `POWER.switchable` excluye `lifeSupport` (carga crítica: no se desconecta, solo cambia de rango).
- `config.ts` → `MISSION`: todo el balance de Misión 1 (reservas, precios, límites, exposición) y la restricción física nueva `stationDischarge` + `dischargePerBattery`. La batería limita la **potencia** que entrega, no solo la **energía** almacenada.
- `GameState.power`: `greenhouse: boolean` (interruptor) y `priority: Circuit[]`. Saves viejos cargan con los valores por defecto (probado).
- `resolvePower(s, dt, isDay, opts?)`: alimenta circuitos por `priority`; `opts.dischargeLimit`, `opts.lightsDrawScale`, `opts.lightsSuspended`. Sin opciones y con orden por defecto da resultados idénticos bit a bit al resolver anterior (probado contra copia literal). `PowerReport.available?` y `shed?` (opcionales para no romper literales existentes; `resolvePower` siempre los rellena).
- `power.ts`: `isPriority`, `priorityOf`, `movePriority`, `rankOf`.
- `loop.ts`: `fixedStepClock(step, { maxFrame, maxSteps })` → `advance(frameSeconds, step, speed)`, `reset()`.

Modo libre: misma física (sin límite de descarga), mismas 14 misiones y guardado compatible.

### C2 — Comandos de misión (`src/engine/types.ts`, tras integrar A)

```ts
| { type: 'setPower'; system: 'heating' | 'processor' | 'robots' | 'greenhouse'; on: boolean }
| { type: 'setPriority'; order: Circuit[] } // permutación completa; si no, se rechaza con motivo
```

`MissionMetrics` añade `secondsLifeSupportUnpowered`, `secondsHeatingShed`, `secondsLightsShed` y `minCrewHealth`, medidos por paso. `Summary` los expone. Consumidores afectados: `commanderTexts.commandText` y `powerLabels` (C) necesitan dos casos; el integrador los añade en el commit de contrato y avisa.

### C3 — Runner (`src/engine/runner.ts`)

```ts
createMissionRunner(ms: MissionState): {
  readonly mission: MissionState;
  paused: boolean; speed: 1 | 2; blocked: boolean; // blocked = overlay abierto
  advance(realSeconds: number): number;            // pasos ejecutados; 0 si pausa/bloqueo/cierre
  dispatch(cmd: Command): CommandResult;           // juego: rechaza en pausa/bloqueo sin tocar estado
  confirm(plan: Command[]): CommandResult[];       // comandante: aplica aunque esté en pausa
}
```

### C4 — Conexión en `main.ts` (Agente 1)

- Toda acción económica de misión pasa por `runner.dispatch`. Modo libre usa `applyToGame` con los mismos comandos.
- Módulos UI exponen `mount…(root, opts) → { update?(), destroy() }` y callbacks; nunca mutan `GameState` en misión.
- Adaptadores en `main.ts`: `SystemsHudOptions.onBreaker/onLights/canCommand` → `dispatch`; snapshot desde `ms.lastPower`.
- Misión no lee ni escribe `nexus.save.v1`, ni ejecuta tormentas aleatorias, impactos, rescate ni progreso offline. Exposición siempre en **u** desde `ms.exposure`; nunca `game.dose` ni mSv.

## Fuera de alcance de esta fase

PWA offline, guardado de misión, contrafactual, prueba con estudiantes y teléfono real sin dispositivo autorizado.
