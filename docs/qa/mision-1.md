# QA Misión 1 «Primera oscuridad» — informe D

- Fecha: 2026-11-15
- Rama: `test/mision-qa`
- Worktree: `/home/sma/Documentos/Proyectos_Desarrollo/nexus/.worktrees/qa`
- Base del carril: `04feeba` (`chore(mision): prepare shared agent baseline`)
- Motor probado: `feat/mision-motor` en `9ccbc41` (`feat(engine): implement deterministic mission core`), ejecutado en un worktree temporal, sin fusionar
- Entorno: Linux, Node 24.19.0, Vitest 5.1.0, TypeScript 7.0.2, Vite 8.3.8
- Alcance editado: `tests/mission/**` y este informe. No se tocó motor, UI, integración ni tests de A.

## Veredicto

**Motor aprobado en aislamiento; producto todavía no listo para revisión.** La suite de QA ejecutada contra el motor real de A pasa **58/58** casos. El baseline de Modo libre sigue verde.

No se acredita Misión 1 integrada: falta incorporar el motor a `feat/mision-1`, no existe runner de misión, no hay UI de preparación/comandante/informe y no se ejecutó navegador, emulación ni teléfono real. **No autorizar `main`, producción ni deploy.**

## Estado verificado

| Elemento | Estado |
| --- | --- |
| Motor | Commiteado en `feat/mision-motor@9ccbc41`; su worktree tiene además `docs/mision-1/balance.md`, `src/engine/balance.test.js` y un ajuste en `world.ts` **sin commitear** |
| Integración | `feat/mision-1` sigue en `04feeba`; el motor no está incorporado |
| Runner | No existe; `src/main.ts` mantiene el bucle acoplado a `renderer.setAnimationLoop` |
| UI de misión | `src/ui/mission/**` no existe |
| Balance de A | Documento presente en el worktree de motor (sin commit); su verificador pasa |
| QA de producto | Bloqueada por integración y UI |

## Automatizado

### En este carril (`test/mision-qa`)

| Suite | Casos | Resultado | Nota |
| --- | ---: | --- | --- |
| Baseline Modo libre | 152 | PASS | 15 archivos; sin cambios |
| `tests/mission/texts.test.ts` | 3 | PASS | Detector propio + barrido de `src/engine` y `src/ui/mission` (esta última ausente) |
| Motor de misión | 55 | SKIP | Se omiten porque `src/engine/index.ts` no está en esta rama; se ejecutaron contra A en sandbox |
| Build | — | PASS | `tsc --noEmit && vite build` |

Resultado local: **155 tests pasan, 55 omitidos, 210 total, 21 archivos**. Un test omitido no es evidencia; la evidencia está en la sección siguiente.

### Contra el motor real de A (sandbox)

Se creó un worktree temporal en `/tmp/opencode/nexus-qa-engine` sobre `9ccbc41`, se copiaron solo `tests/mission/**` y se enlazaron dependencias. **No se fusionó nada ni se modificó el worktree de A.**

| Ejecución | Resultado |
| --- | --- |
| 58 tests de misión (55 de motor + 3 de textos) | **58/58 PASS** |
| Repo completo del motor (baseline + tests de A + QA) | **217/217 PASS**, 23 archivos |
| `tsc --noEmit` | PASS |
| Verificador de `docs/mision-1/balance.md` de A | **1/1 PASS** contra motor commiteado y contra el `world.ts` sin commitear |
| Verificador de balance + suite QA | **59/59 PASS** |

La matriz de determinismo se ejecutó a nivel motor con 1, 4 y 40 pasos por frame a 1x/2x: estado, muestras, eventos, log y `summarize` idénticos. **No es prueba del runner real**, que todavía no existe.

### Casos ejecutados contra A

| Archivo | Casos | Qué quedó verificado |
| --- | ---: | --- |
| `tests/mission/contract.test.ts` | 11 | Muestras finitas, 0–100 %, exposición ≥ 0; cadencia 5 s; muestra inicial/final; fronteras 180/240/420/450/480/540 una sola vez; eventos y log ordenados; rechazo sin mutación; métricas/resumen coherentes; `darknessAt`/`nextEvent`; estado serializable |
| `tests/mission/determinism.test.ts` | 7 | 1/4/40 pasos por frame a 1x/2x con comandos rechazados; estado y `summarize` idénticos; lecturas por frame sin efectos; `worldStep` no muta tras el cierre |
| `tests/mission/serialization.test.ts` | 7 | JSON de `MissionState`; sin NaN/Infinity/funciones/ciclos; continuación equivalente; replay reproduce estado y resumen; rechazos conservados |
| `tests/mission/projection.test.ts` | 6 | `project` no muta el origen; paridad con ejecución del mismo plan; horizontes `seconds`/`endOfDarkness`/`endOfMission`; rechazos; parada en fallo; sin valores no finitos |
| `tests/mission/balance.test.ts` | 24 | Precios/límites; costes A/B/C 260/270/240; caso 305; máximos; NaN/Infinity/negativos/fracciones; cada compra se refleja en el estado inicial; saturación de berma; A y B ganan con cosechas; C falla por exposición |
| `tests/mission/texts.test.ts` | 3 | Sin `mSv`, `dosis`, `en vivo`, `NASA valida`, `game.dose` ni claves de dosis libre en `src/engine` y `src/ui/mission` |

### Límites de lo automatizado

- **Runner real:** no se probó pausa/1x/2x/agrupación en el producto porque no existe. La matriz actual es nivel motor.
- **UI, pausa, callbacks, save/perfil:** requieren integración; no se simularon con mocks.
- **Accesibilidad:** no hay UI que medir.
- **Balance:** se ejecutó el barrido de A y una política independiente; no hay prueba con estudiantes.

## Navegador escritorio

**No ejecutado.** No hay flujo de misión que abrir: faltan preparación, barra, comandante, informe y reintento. Abrir el Modo libre actual no valida Misión 1.

Cuando exista el commit integrado, cubrir:

1. Menú → Misión 1 → preparación con 300 créditos; compras, límites y presupuesto visible.
2. Inicio; pausa real; 1x/2x; luces, energía, riego, clima, cosecha y refugio.
3. Oscuridad 240–420 y tormenta 480–540; reloj/eventos coherentes; exposición en **u**, no mSv.
4. Comandante: abrir, editar alternativa sin despachar, confirmar, cancelar y cerrar con Esc.
5. Informe: timeline, gráfico, tabla alternativa, diseño y reintento precargado; una sola apertura.
6. Pausa/overlay: ningún comando económico, callback de robot o trabajo diferido consume recursos.
7. Cierre: save libre y perfil intactos; sin escrituras a `nexus.save.v1` desde misión.

## Emulación

**No ejecutado.** No hay UI de misión. Cuando exista, repetir en móvil horizontal (por ejemplo 844×390) con emulación táctil: botones ≥ 44 px, sin solapamientos, foco visible, P/Esc, comandante e informe legibles. La emulación no se reportará como teléfono físico.

## Teléfono real

**No ejecutado.** No se coordinó disponibilidad de dispositivo ni se controló un teléfono ajeno. No se afirma nada sobre tacto, rendimiento, instalación u offline real.

## Hallazgos

### H-01 — Bloqueo de integración: motor no incorporado

- Ruta: `feat/mision-motor@9ccbc41`; `feat/mision-1` y `test/mision-qa` en `04feeba`.
- Esperado: integrador incorpora el motor y comunica commit; B/C validan contra él.
- Observado: motor compilable y con 217/217 tests en su repo, pero fuera de la rama de integración. Su worktree tiene además cambios sin commit (`world.ts`, `balance.md`, `balance.test.js`).
- Sugerencia: A commitea su balance y el ajuste de `world.ts`; integrador fusiona A en `feat/mision-1` y comunica hash. D reejecuta en el árbol integrado.

### H-02 — Bloqueo: no hay runner de misión testeable

- Ruta: `src/main.ts:589-605` (bucle de `renderer.setAnimationLoop`).
- Problema: el avance de simulación está dentro del callback de render; no hay función pura que D pueda invocar con 1/4/40 pasos por frame y 1x/2x.
- Esperado: función exportada, por ejemplo `advanceMission(state, frameSeconds, speed)` o `stepMissionFrame(...)`, usada por `main.ts` y testeable sin WebGL.
- Observado: bucle acoplado a `THREE`, cámara, colisiones y HUD.
- Sugerencia al integrador: extraer **solo** el avance de simulación a `src/ui/mission/runner.ts` sin cambiar comportamiento; D cablea la matriz de determinismo contra esa función. Sin esto no se puede cerrar el punto 1 del encargo.

### H-03 — El balance de A existe pero no está commiteado

- Ruta: `.worktrees/motor/docs/mision-1/balance.md` y `src/engine/balance.test.js` (untracked).
- Reproducción: `git -C .worktrees/motor status --short`.
- Esperado: documento y verificador dentro del commit de A.
- Observado: el verificador de A pasa **1/1** y reproduce el documento sin diferencias, tanto contra `9ccbc41` como contra el `world.ts` sin commitear. El contenido es reproducible; falta el commit.
- Sugerencia: A commitea ambos archivos. No se copiaron a este carril porque pertenecen a su ownership.

### H-04 — Riesgo de texto: cadenas de dosis del Modo libre

- Rutas y textos:
  - `src/ui/i18n.ts:213` — `stormDose: 'Dosis {d} mSv'`.
  - `src/ui/i18n.ts:226-227` — `stormEnd: 'La tormenta pasó. Dosis recibida en esta misión: {d} mSv...'`.
  - `src/ui/hud.ts:304,313` — `setStorm(..., dose ...)` usa `t('stormDose', { d: info.dose.toFixed(1) })`.
- Problema: son textos válidos del Modo libre, pero si la misión reutiliza el HUD/caja de tormenta mostrará dosis médica en mSv. El contrato exige exposición en **u** y `ms.exposure`.
- Esperado: claves de misión como «Exposición acumulada: {u} u», alimentadas por `ms.exposure`; nunca `game.dose`.
- Observado: `src/engine` de A no contiene esos términos en textos de misión; `src/ui/mission` no existe todavía.
- Sugerencia: crear claves propias en `src/ui/mission/texts.ts`/`commanderTexts.ts`; el test `texts.test.ts` fallará si se cuela `mSv`, `dosis`, `game.dose` o `stormDose`.

### H-05 — «en vivo» y NASA: sin violación en alcance

- Rutas: `src/ui/i18n.ts:234` («no es en vivo»), `src/ui/i18n.ts:240` («real y en vivo»), `src/ui/i18n.ts:231,236` (NASA DONKI).
- Observado: textos del Modo libre; la snapshot se etiqueta correctamente como copia guardada y NASA DONKI se usa como fuente, no como validación de la misión.
- Esperado en misión: snapshot fechado, sin afirmar lectura en directo ni validación NASA. `src/engine/types.ts:166` aclara en comentario que la exposición no es mSv ni dosis real; no requiere cambio.
- Sugerencia: mantener estas claves fuera de misión; si se muestra la fulguración, decir «registrada por NASA DONKI» con fecha/fuente.

### H-06 — Bloqueo: accesibilidad no medible todavía

- Ruta: `src/ui/mission/**` inexistente.
- Problema: no se puede comprobar foco, contraste, objetivos táctiles, P/Esc ni tabla del gráfico sin UI.
- Esperado/observado: sin pantallas; cualquier afirmación sería inventada.
- Sugerencia: checklist manual de la sección siguiente cuando B/C integren.

### H-07 — Observación no bloqueante: semántica de `nextEvent`

- Ruta: `src/engine/observation.ts:12`.
- Comportamiento: en t=300 devuelve el evento de oscuridad **en curso** (240–420), no solo el siguiente evento futuro. `darknessAt` ya informa el estado actual.
- Prueba: `contract.test.ts` verifica que devuelve `kind: 'darkness'` y `endAt: 420`; pasa.
- Sugerencia: si la UI usará `nextEvent` como «próximo evento futuro», aclarar la semántica con A/integrador; no es un fallo de motor.

## Revisión de balance

### Reejecución del documento de A

El verificador de A compara el documento generado contra `docs/mision-1/balance.md` y pasa **1/1**; no hay diferencias entre lo declarado y lo reproducido. El barrido declara **57 casos, 30 diseños únicos y 56 victorias**; C es el único fallo. Nuestra suite independiente confirma A/B victorias y C fallo por exposición.

Nuestra política no es idéntica a la de A (luces 55/40 y refugio 65 s frente a 50/20 y 60 s), pero los resultados gruesos coinciden:

| Estrategia | Resultado | Duración | minLifeSupport | Exposición | Cosechas | Refugio | Cortes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A (política QA) | victory | 600.00 | 27.0 % | 3.84 u | 1 | 65 s | 126.5 s |
| B (política QA) | victory | 600.00 | 3.0 % | 1.44 u | 2 | 65 s | 0 s |
| C (política QA) | failed / exposure_exceeded | 535.75 | 12.5 % | 40.14 u | 0 | 0 s | 148.5 s |

### Compras con efecto medido

Evidencia del barrido de A (misma política, mismo horizonte):

- **Baterías:** efecto claro. En granja, 1 batería elimina los cortes (104.75 → 0 s). En la política de batería, 1 batería sube las cosechas de 1 a 2 y elimina cortes.
- **Berma 1:** reduce la exposición de 14.40 a 3.84 u por 40 créditos.
- **Berma 2:** baja a 1.44 u; mejora menor.
- **Berma 3:** **dominada** por berma 2: misma exposición (1.44 u), +40 créditos. El propio documento de A lo señala.
- **Reservas de agua:** suben el mínimo de soporte de 5 % a 8 % en el barrido; efecto pequeño pero medido.

### Compras sin efecto medido o problemáticas

- **Mástiles solares extra:** 1, 2 y 3 producen exactamente las mismas métricas que la base en ambas políticas (mínimo 5 %, exposición 14.40, 1 cosecha, cortes 88.75/104.75 s). No se midió beneficio; no se afirma que sean inútiles en toda estrategia.
- **Niveles extra de invernadero:** las cosechas siguen en 1; los cortes empeoran (granja 88.75 → 100 → 108.75 s; batería 104.75 → 121.5 → 132.25 s) por mayor demanda. No rentables en este barrido.
- **Procesador:** las cosechas siguen en 1 y los cortes suben (granja 133 s; batería 137.5 s). No se midió beneficio de O2 que compense el coste.
- **Reservas de O2 y alimento:** el mínimo de soporte no cambia (5 %). Sin efecto medido en las métricas del barrido.
- **Victoria sin compras:** la base gana con 0 créditos en ambas políticas. La dificultad actual es permisiva: ninguna compra es necesaria para completar 600 s.

### Lectura

A y B son estrategias distintas con compromisos reales: A tiene mejor soporte mínimo (25 % en el doc de A) pero más cortes; B tiene 0 cortes y 2 cosechas pero mínimo 5 %. No hay una estrategia global dominante demostrada.

Las señales de balance sí son concretas: berma 3 está dominada; mástiles, invernadero, procesador y reservas de O2/alimento no muestran beneficio en el barrido; la base ya gana. A's document reconoce que no es una búsqueda exhaustiva y que falta calibración educativa. No se cambiaron constantes ni expectativas para ocultar esto.

## Accesibilidad — checklist preparada

No ejecutada por falta de UI. Evidencia mínima requerida:

- [ ] Pausa, running, victoria, fallo, oscuridad y tormenta con **texto/icono/ARIA**, no solo color.
- [ ] Foco visible en todos los controles (`:focus-visible` con outline/contraste), sin `outline: none` sin reemplazo.
- [ ] P pausa y Esc cierra overlay/restaura pausa previa; probar con foco en input y tras abrir comandante.
- [ ] Objetivos táctiles ≥ 44×44 px CSS (incluidos iconos), con separación suficiente.
- [ ] Gráfico con `<table>` alternativa, caption/encabezados y mismos datos; funciona con 0 y 1 muestras.
- [ ] Comandante: abrir/cerrar, confirmar/cancelar, foco atrapado y devuelto, sin despachar durante edición.
- [ ] Contraste de texto ≥ 4,5:1 (3:1 en texto grande) medido, no estimado a ojo.
- [ ] Zoom 200 % y móvil horizontal sin recortes ni controles fuera de pantalla.

## Pendientes

1. A: commitear `docs/mision-1/balance.md`, `balance.test.js` y el ajuste de `world.ts`; comunicar hash.
2. Integrador: incorporar A a `feat/mision-1`, extraer el runner y conectar el flujo de misión.
3. B/C: preparación, barra, comandante, informe, reintento y textos de misión.
4. D: reejecutar la suite en el árbol integrado; QA de navegador escritorio, emulación móvil horizontal y teléfono real cuando haya dispositivo autorizado.
5. D: accesibilidad, textos sobre UI real, save/perfil y ausencia de economía en pausa.
6. Fuera de esta entrega: service worker/offline completo, guardado de misión, contrafactual y prueba con estudiantes. El manifest existente no acredita PWA.

## Recomendación

**Motor listo para integración; producto no listo para revisión.** Bloqueos concretos: motor no incorporado a `feat/mision-1` (H-01), runner inexistente (H-02), balance de A sin commit (H-03), UI de misión ausente (H-06) y QA de navegador/teléfono pendiente.

El baseline de Modo libre sigue verde y el motor supera 58/58 pruebas de QA en aislamiento. Reanudar D cuando el integrador comunique un commit con motor, runner y UI reales. **No autorizar `main`, producción ni deploy.**
