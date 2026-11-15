# Agente 4 — experiencia 3D y evaluación

Fecha de QA: 2026-11-15 UTC. Repo `dnnyhr/nexus`. Worktree `.worktrees/experiencia-3d`, rama `feat/experiencia-3d`, baseline `04feeba`. Carril: `src/scene/`, `src/models/`, `src/ui/flightreview/`, `src/ui/passport/` y esta documentación.

Entrega de módulos; conexión con el flujo principal corresponde al integrador. No se ha fusionado esta rama. Sin cambios a `main.ts`, contrato, Modo libre, perfil, controles táctiles, manifest, dependencias o lockfile. El pasaporte no escribe almacenamiento ni altera el perfil existente.

## Commits locales

- `288e319` — escena, iluminación, materiales y cámara táctica.
- `0906bb1` — Flight Readiness Review, pasaporte e insignias.
- `2e96e64` — evidencia tipada compatible con extensiones del estado del motor.

Aplicar en ese orden sobre baseline; la integración solo la realiza el integrador.

## Cambios

- Iluminación lunar continua entre día y noche, sin salto de color al cruzar 50 %. Sol rasante cálido, relleno nocturno frío más legible. Materiales Lambert compartidos; separación entre casco, estructura, paneles y regolito. El relleno es recurso visual, no una medición de iluminación lunar.
- Misma geometría y materiales de tipo Lambert, tres luces y un único emisor de sombras. Sin postprocesado, texturas nuevas, motor adicional ni otro loop de render.
- Cámara táctica sobre la misma `PerspectiveCamera` y `OrbitControls`: seguimiento, isométrica y cenital. Encuadre de base según FOV/aspecto. Cenital conserva inclinación mínima de 0.035 rad para evitar dirección de movimiento nula en el cálculo XZ existente.
- Transición de 280 ms, curva `cubic-bezier(0.23, 1, 0.32, 1)`, reversible desde pose actual. `prefers-reduced-motion` usa cambio inmediato. Se conservan asignaciones táctiles, velocidades de control y pan. Zoom táctico limitado entre 0.5× y 2× la distancia de encuadre; límites originales restaurados al volver al seguimiento. Bloqueo externo respetado.
- Flight Readiness Review: reservas inicial/final/mínimo muestreado, métricas acumuladas exactas del motor, gráfico SVG con trazos diferenciados y tabla equivalente, decisiones aceptadas/rechazadas, eventos y aprendizajes STEM.
- Alternativas calculadas con `project` real desde el mismo checkpoint y horizonte: configuración actual sin comandos nuevos frente al plan recibido. Se declara política sin acciones manuales futuras y tiempo realmente alcanzado en cada columna. Comparaciones de otro escenario/diseño/historial se omiten. Sin checkpoint, estado vacío explícito; no se inventa contrafactual.
- Pasaporte con cinco insignias SVG propias: misión, soporte vital, energía, cultivo y refugio. Estados bloqueada/desbloqueada, criterio y evidencia textual. Se contrastan cierre, salud, exposición, reservas/muestra final, métricas, eventos y comandos. Cosechas requieren concordancia entre comando aceptado, evento y contador; refugio exige cobertura completa de una tormenta. No constituye certificación profesional ni validación externa.

## API y conexión para integrador

`src/scene/camera.ts` exporta:

```ts
new TacticalCamera(camera, controls, { center?, radius?, reducedMotion? })
mode
transitioning
setMode('follow' | 'isometric' | 'top')
setEnabled(boolean)
update(dt, focus)
resize()
destroy()
```

`mountCameraControl(root, camera)` devuelve `{ update(), destroy() }`. Llamar `update()` tras cambios de modo programáticos; pulsaciones propias ya sincronizan `aria-pressed`. Grupo aísla `keydown/keyup`, conserva Space/Enter nativos. No añade atajos globales.

En `main.ts`, crear controlador después de configurar `OrbitControls` y posición inicial. Sustituir bloque de seguimiento y llamada final a `controls.update()` por una sola llamada a `cameraRig.update(dt, focus)`. Ejecutar Q/E solo cuando `!cameraRig.transitioning`; no añadir otro RAF. El mismo objeto camera sigue sirviendo para HUD, raycasting y movimiento relativo. Al redimensionar, actualizar aspect/proyección y después `cameraRig.resize()`. Colocar toolbar fuera del joystick y bandas de recursos.

```ts
const cameraRig = new TacticalCamera(camera, controls);
const cameraUi = mountCameraControl(cameraHost, cameraRig);
cameraRig.setEnabled(!interactionBlocked);
cameraRig.update(dt, focus);
```

`src/ui/flightreview/index.ts` exporta:

```ts
mountFlightReview(root, {
  getState(): MissionState,
  comparison?: FlightComparison,
  weather?: SpaceWeather,
  onRetry(design: Design): void,
  onMenu(): void,
  onPassport?(): void
}): { destroy(): void }

compareFlightPlans(checkpoint, plan, horizon, project): FlightComparison
comparisonMatches(mission, comparison): boolean
```

Al abrir Comandante, conservar checkpoint real con `phase === 'running'` y calcular comparación con `project` del motor; `compareFlightPlans` lanza error para otras fases. Mantener ese resultado asociado al intento; pasarlo al review al cerrar misión. `compareFlightPlans` clona entradas y calcula ambas columnas de forma independiente. No despacha comandos en la partida original ni supone intervenciones futuras.

Montar review cuando la fase sale de `running`; parar runner y bloquear inputs/callbacks económicos antes de montar. Copia estado al abrir: no necesita actualización por frame. Acciones de navegación son de uso único para evitar doble reintento; callbacks deben destruir vista actual y montar destino. Al volver del pasaporte, montar un review nuevo. `destroy()` retira listeners/nodos y restaura foco cuando corresponde.

`src/ui/passport/index.ts` exporta:

```ts
mountPassport(root, {
  name: string,
  missions: readonly MissionState[],
  onBack(): void
}): { destroy(): void }

evaluateBadges(mission): BadgeProgress[]
collectBadges(missions): BadgeProgress[]
verifiedCompletion(mission): boolean
```

Los evaluadores exportan `PassportEvidence`, un `Pick<MissionState, ...>` de los 11 campos que leen. Aceptan estados completos del motor sin exigir campos ajenos a la evaluación. No se modifica contrato común.

Pasar nombre del perfil actual y vuelos reales del historial del integrador. `verifiedCompletion` valida coherencia interna del registro; no reemplaza `replay` ni autentica datos externos. Para conservar insignias entre sesiones, el dueño de persistencia debe conservar/restaurar vuelos validados, sin sobrescribir `nexus.save.v1` ni migrar silenciosamente perfil. Lista vacía muestra criterios bloqueados; no hay IDs de insignias confiados ciegamente a storage.

Review y pasaporte esperan CSS global del producto (`src/style.css`, incluido `box-sizing: border-box`) y contenedor con altura de viewport. Deben poder leerse en vertical: el aviso existente de girar teléfono solo debe cubrir escena 3D, no estas vistas. Ambos aíslan eventos de interacción que podrían activar juego. El integrador debe limpiar teclas/joystick mantenidos y bloquear las demás rutas de mutación; aislar DOM no pausa por sí solo el motor.

## Telemetría y honestidad pedagógica

El escenario declara la fulguración que lo inspira mediante `inspiredBy`. Review muestra fuente NASA DONKI, ID, clase y pico observado. Fecha de captura del snapshot solo aparece si ID/clase/pico coinciden con snapshot versionado; si no, declara fecha desconocida. Datos del motor y proyecciones se rotulan simulados. La fecha de captura no se presenta como fecha del fenómeno.

En la verificación, referencia `2026-10-08T15:29:00-FLR-001`, clase M6.7, pico `2026-10-08T15:48Z`, snapshot `2026-11-14T22:59Z`. Si se suministra contexto GOES, se muestra fuente, instante observado, fecha de obtención, pfu y procedencia remota/local. Se aclara que ese contexto no modifica la cronología fija ni acredita haber sido entrada del motor.

No hay conversión de clase de rayos X o flujo de protones a dosis lunar. Exposición siempre en u didácticas. Las preguntas STEM distinguen potencia/almacenamiento, acoplamiento del cultivo, protección y costes de refugio. No atribuyen una cosecha o duración perdida a una sola decisión sin comparación calculada. Insignias reconocen criterios de simulación, no competencia profesional demostrada.

## Pruebas automáticas

Baseline propio antes de cambios: 152 tests/15 archivos y build pasan. Tras implementación y correcciones: 167 tests/18 archivos, `npm run build` y `git diff --check` pasan en este worktree. Build verifica tipos de los módulos, pero todavía no incluye cámara/review/pasaporte en el entry principal porque esa conexión es del integrador.

Tests nuevos comprueban encuadre, retorno al seguimiento, cambios durante transición, bloqueo externo, viewport estrecho, equivalencia 30/60 FPS, continuidad de luz y criterios de insignias. Incluyen datos incompletos/contradictorios/NaN y entradas rechazadas. Fixtures de unidad verifican reglas de evaluación; no acreditan ejecución de una misión.

Regresión reproducida durante revisión: rotación amortiguada pendiente hacía saltar cámara 9.5238 unidades antes de transición. Test `starts a transition from the visible pose while orbit inertia is pending` falló antes del arreglo. Se conserva pose visible antes de vaciar inercia y se restaura al iniciar transición, sin cambiar expectativa del test.

Compatibilidad adicional: copia temporal de fuentes propias más motor real `0c8379a` en `/tmp/nexus-a4-compat`, sin fusionar ramas. TSC detectó inicialmente `TS2741` en fixture que construía `MissionState` sin nuevo `ledger`. Ajuste a `PassportEvidence` mantiene lógica y aserciones; `tsc --noEmit` pasa con contrato real ampliado, además de tests/build del carril. Esto verifica tipos, no el runner integrado. Revisión independiente conserva `ship` para este cambio exclusivamente de tipos.

Detector visual ejecutado una vez sobre módulos UI y CSS de cámara: sin hallazgos (`[]`).

## QA de navegador con motor real

Harness aislado `/tmp/nexus-a4-qa/`, Chromium headless instalado, Playwright existente; sin instalar dependencias. Motor real archivado desde commit `0c8379a` y componentes del worktree propio; sin fusionar motor a esta rama ni añadir mocks de producción. Políticas copiadas del barrido del motor: revisión cada 5 s, riego/clima/cosecha con comandos, refugio [480,540) en A/B, LED 20 % durante oscuridad en A, 50 % en B y 100 % sin refugio en C. `replay` reproduce exactamente los tres estados completos.

- A: victoria a 600 s, 1 cosecha, exposición 3.84 u, mínimo vital 25 %, luces reducidas 180 s, refugio 60 s, potencia insuficiente 108.75 s. Insignias misión/soporte vital/cultivo/refugio.
- B: victoria a 600 s, 2 cosechas, exposición 1.44 u, mínimo vital 5 %, refugio 60 s, potencia insuficiente 0 s. Insignias misión/energía/cultivo/refugio.
- C: fallo por exposición a 535.75 s, exposición 40.14 u. Sin insignias de victoria.
- Comparación real desde t=480 s y horizonte 60 s: mantener configuración falla a 535.75 s; entrar a refugio alcanza 540 s. Ambas usan mismo checkpoint y motor.

Comprobaciones: foco inicial en artículo, Tab/Enter, ida/vuelta a pasaporte, reintento único ante doble click, estado sin vuelos, informe de fallo, gráficos con 0/1 muestras, procedencia fechada, tablas con captions/headers, scroll de artículos y tablas en 390×844 y 844×390. No se prueba lector de pantalla real ni teléfono físico.

Primera captura UI descartada: harness omitía reset global del producto y medía solo overflow interno. Confirmación carga CSS real y comprueba ancho del documento y límites del artículo; las capturas deben coincidir exactamente con 1440×900, 390×844 y 844×390. No se modifica CSS productivo para ocultar defecto del harness.

Resumen durable: [experiencia-3d-evidencia.json](experiencia-3d-evidencia.json). Evidencia local: `/tmp/nexus-a4-qa/functional.json`, `performance.json`, `confirmation.json` y `captures/`. Scripts locales `check.cjs`, `qa.ts` y `scene.ts`; el servidor y navegador se cierran al terminar. Son evidencia de módulos/harness, no del flujo integrado del producto.

## Rendimiento

Comparación a 1440×900, DPR 1, misma escena, cámara y sombras. Baseline/actual: **242 draw calls, 54 288 triángulos, 135 geometrías, 7 programas, 3 luces**, idénticos. Misma resolución de shadow map (2048²), sin emisores de sombra extra. La cámara reutiliza vectores y no crea loop paralelo.

Renderer: ANGLE/SwiftShader Vulkan, software. Dos muestras breves de 6 frames tras calentamiento: baseline 311.10 y 280.55 ms/frame; actual 188.90 y 316.67 ms/frame. Variación y orden de ejecución impiden concluir mejora o regresión de FPS. No se acredita rendimiento de GPU real ni móvil. Repetir carga representativa en dispositivo autorizado al integrar; la adaptación de DPR existente se conserva.

## Pendientes y límites de aceptación

- `src/main.ts` — módulos nuevos aún desconectados — integrador conecta controlador, cierre/reintento, navegación y bloqueo completo de inputs; luego QA del flujo real.
- Historial/perfil — los módulos no persisten vuelos — integrador conecta historial validado al pasaporte sin alterar save libre.
- Navegador integrado — harness prueba módulos y motor real por separado del runner — ejecutar operación→pausa→proyección→resultado→review→pasaporte→reintento tras incorporar esta rama.
- Teléfono/GPU real, lector de pantalla, instalación y prueba con estudiantes: pendientes; viewport emulado no sustituye dispositivo físico.
- Existe manifest. Búsqueda actual no encuentra registro ni implementación de service worker en `src`, `public`, `index.html` o config. **No se declara soporte PWA offline.** No se añadió SW.

Sin push, PR remoto, merge a main ni deploy.

## Revisión final

Revisión independiente: **ship**, limitada a módulos/harness para entregar al integrador. Tres hallazgos materiales cerrados: teclado de cámara, salto por inercia y dimensiones del harness. Quince capturas finales válidas revisadas; Space/Enter nativos funcionan sin propagarse a window y raycasting conserva impactos en ambas vistas tácticas. Cero errores de página. No equivale a aprobación del producto integrado.
