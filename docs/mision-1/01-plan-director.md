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

1. **Base motor** (Agente 1) — hecho: A, B, C, D integrados con autorización (`046b4b0`…`9055cb3`).
2. **Circuitos eléctricos** (Agente 1) — hecho: C1 `87529f3`, C2 `a03d120` (+ ajuste mínimo en C `b91d45a`).
3. **Runner** (Agente 1) — hecho: C3 `16560b7`. Matriz 1/4/40 pasos por frame, 1x/2x y pausas: idéntica.
4. **Conexión** (Agente 1) — hecho: C4 `8716f7b`. Flujo completo verificado en Chromium headless (ver abajo).
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

## Verificación del integrador (2026-11-15, `8716f7b`)

- Automatizado: 288/289 tests y build correctos. El único fallo es H-08 (textos).
- Chromium headless (escritorio 1280×720, sin teléfono): menú → preparación → misión → pausa (P rechaza acciones sin log) → comandante (Esc restaura pausa) → prioridad desde el panel (`setPriority` en log) → informe una sola vez → reintento precargado → Modo libre. Sin errores de consola.
- Save libre: idéntico byte a byte tras una misión completa con `visibilitychange`/`pagehide`. Modo libre reanuda la partida.
- No verificado: teléfono real, emulación táctil, accesibilidad medida, instalación/offline.

## Encargos abiertos por carril

- **Agente 3 (UI/textos)**
  - H-08: `commanderTexts.ts:206` y `:248` usan «dosis» aunque sea en negación, y la auditoría de D falla. Reformular sin «dosis» (p. ej. «Cifras didácticas en u; no son mediciones clínicas ni implican afiliación con NASA»). El test no se cambia.
  - `missionBar.ts:70` corta la propagación de toda tecla salvo P con foco en la barra, incluidas Esc y Tab. La integración lo evita moviendo el foco al comandante; conviene limitar el corte a las teclas de juego.
  - `SystemsHud`: añadir `greenhouse` a `BreakerSystem` y la prioridad (`movePriority`/`setPriority`). Agente 1 conecta los callbacks en `main.ts`.
  - Mover `POWER_TEXT` de `panels.ts` a `i18n.ts`. CSS de las filas de prioridad: los ▲▼ salen apilados.
  - Comandante: añadir el interruptor de invernadero y la prioridad al borrador (`commandText` ya los cubre).
  - Informe: «Deslizá» (voseo) frente al español neutro del resto.
- **Agente 2 (3D)**: `menuOrbit` en `main.ts` es un marcador simple; reemplazar con la cámara cinematográfica vía API exportada. La noche de misión sale de `darknessAt`.
- **Agente 4 (QA)**: reejecutar `tests/mission/**` sobre `8716f7b`; ya existe el runner real (`createMissionRunner`) para la matriz de producto. QA de teléfono y accesibilidad pendientes.
- **Producto**: el diseño base sin compras sigue ganando, así que la dificultad es permisiva. Con el límite de descarga, los cortes sin batería cubren toda la oscuridad (180 s). Calibrar con estudiantes antes de endurecer.

## Fuera de alcance de esta fase

PWA offline, guardado de misión, contrafactual, prueba con estudiantes y teléfono real sin dispositivo autorizado.
