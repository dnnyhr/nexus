# NEXUS — transiciones de misión

Fecha: 2026-11-15. Rama: `feat/mission-cinematics`. Base de integración: `bcef605`. Worktree: `.worktrees/cinematics`. Implementación aislada; incorporación al checkout principal corresponde al integrador.

## Propuesta implementada

Director temporal sobre Three.js existente. Un renderer, una cámara, un bucle. Sin vídeo, dependencias nuevas, cambios de contrato del motor ni lockfile. Uso ocasional: continuidad espacial y confirmación del estado de misión. Movimiento controlado con curva `cubic-bezier(0.77, 0, 0.175, 1)`; tiempos cinematográficos separados del reloj de simulación.

- **Inicio, 16 s:** inserción terrestre 0–3.2; tránsito cislunar 3.2–6.5; aproximación 6.5–9; descenso de nave existente 9–13; touchdown y entrega al astronauta 13–16. Confirmación del diseño inicia la secuencia. Preparación conserva flujo actual.
- **Evacuación, 8 s:** confirmación explícita; embarque 0–2, ascenso 2–7, retorno al Centro de Control 7–8. Cancelar confirmación conserva pausa previa; confirmar abandona intento sin conceder victoria. El Centro de Control reutiliza menú actual.
- **Victoria, 6 s:** solo tras `mission.phase === 'victory'`; sobrevuelo de base 0–5.3, fundido 5.3–6, Flight Readiness Review. Fallo va directamente al mismo review, sin validación de éxito.

La inserción es una vista desde la nave. La representación Tierra–Luna conserva proporciones aproximadas de radios/distancia; el recorrido comprime días en segundos. No integra mecánica orbital. Cambio de escala orbital/superficie oculto por elipsis a negro en t=9; no hay corte al entregar gameplay. Superficie conserva estilo geométrico del proyecto. No es una recreación fotogramétrica del lugar de alunizaje.

## Dirección y composición

Modo Experience durante vuelo; Operate al recuperar control. Escena oscura, materiales lunares existentes, luz direccional sin sombras en escena orbital; contraste de comunicaciones sobre panel opaco. Acciones arriba; transmisión abajo con safe areas. Tipografía y lenguaje de misión existentes, sin rebotes, confeti ni estadísticas ficticias. Mapas NASA locales aportan detalle sin elevar geometría. Firma de transición: nave desciende en escena jugable, cámara se aproxima a pose exacta guardada, misma cámara pasa al jugador.

## Verificación documental y de diseño

Extensión de la experiencia Three.js existente. Autoridad inspeccionada: `hud.css`, `mission.css`, `experience.css`, director, overlay e integración. Se conservan Barlow Semi Condensed, paneles oscuros, trazos finos, botones de esquinas discretas y ámbar de foco; nave, astronauta y superficie siguen usando recursos existentes. Tierra y Luna añaden cartografía local NASA de 1024×512 con procedencia en `public/cinematics/SOURCES.md`. Radio sintetizada requiere activación voluntaria; textos transmiten contenido completo.

Código revisado tras correcciones: encuadre terrestre calcula distancia con menor FOV horizontal/vertical; `rotate-hint` se oculta durante secuencia y recupera prioridad sobre HUD vertical al terminar; Evacuar pertenece a controles de barra; `update(true)` sincroniza pausa al entregar control; pérdida de contexto conserva bloqueo lógico previo. Estas comprobaciones de implementación acompañan la QA visual y funcional; no acreditan FPS ni percepción de audio en hardware físico.

Estado documental preexistente: no se encontraron `PRODUCT.md`, `DESIGN.md` ni `.impeccable/design.json`. No existe contrato global escrito contra el cual cuantificar drift; se preserva implementación vigente y no se crea ni repara un sistema de diseño dentro de este alcance.

## Integración y propiedad de cámara

`CinematicDirector.start(kind, done)` captura posición, quaternion, target, FOV, near/far, zoom, damping, autoRotate, habilitación de OrbitControls y visibilidad/posición de actores. Rechaza otra secuencia activa. `update(realDt)` recibe delta visible; no usa timers independientes. `renderScene` selecciona escena orbital o escena de base. `active`, `kind`, `elapsed` permiten consultar estado. `skip()` y `interrupt()` comparten finalizador idempotente con terminación natural.

`main.ts` es propietario de modo, runner y foco. `playSequence` bloquea y pausa runner; drena teclas, salto, joystick y acciones físicas pendientes; incrementa epoch para invalidar callbacks anteriores; aplica `inert` al fondo y oculta HUD/barra. El loop omite simulación, seguimiento y `controls.update()` durante vuelo. Finalizador restaura cada estado previo y libera geometrías, mapas GPU, audio y listeners propios; no destruye materiales prestados de nave/astronauta.

Inicio termina exactamente en pose jugable capturada. Skip omite presentación, no avanza recursos ni concede resultados. Evacuación termina en menú; victoria termina en review. `prefers-reduced-motion: reduce` usa mismo finalizador inmediatamente y evita viaje espacial. Escape equivale a skip; Tab queda entre controles; objetivos de 44 px; subtítulos legibles sin audio. Audio opcional sintetizado: confirmaciones de radio, activadas mediante gesto; sin voz grabada.

Visibilidad de pestaña pausa presentación y reinicia delta al volver. Pérdida de WebGL interrumpe secuencia, restaura propiedad y mantiene runner bloqueado hasta recuperar contexto. Restauración conserva bloqueo previo. No puede garantizar recuperación de GPU descartada definitivamente: en ese caso navegador exige recarga.

Si integrador conecta `TacticalCamera`, su `update()` debe quedar bajo la misma exclusión de `cinema.active`; no añadir otro escritor de cámara. Cámara táctica existente no se conecta en este cambio. Actualizar resize/aspect por vía actual; no sustituir objeto cámara.

## Review y evidencia

Review recibe estado real del motor, nunca un resultado sintético de cinemática. Pasaporte accesible desde review usa ese intento y valida eventos, métricas, muestras y comandos. No se añade persistencia de historial: al recargar no se conservan insignias de esta sesión.

Último plan confirmado en Comandante genera comparación desde checkpoint común: mantener configuración contra aplicar plan, mismo motor y horizonte final. Sin plan confirmado, review declara ausencia de comparación. No se inventa alternativa ni se equipara proyección con vuelo observado.

Procedencia y fecha del snapshot solar se mantienen en módulo de review. Mapas orbitales son referencias visuales históricas, no telemetría de navegación. Datos observados se distinguen de recursos/exposición simulados. No hay service worker añadido ni declaración de PWA offline.

## Archivos

- `src/scene/cinematics/director.ts`: captura, cámara, actores, ciclo y limpieza.
- `src/scene/cinematics/timeline.ts`: fases, tiempos, curva y mensajes.
- `src/scene/cinematics/orbit.ts`: Tierra/Luna/estrellas, precarga local y liberación GPU.
- `src/scene/cinematics/overlay.ts`, `cinematics.css`: radio, skip, audio, foco, confirmación y móvil.
- `src/scene/cinematics/director.test.ts`: invariantes de cámara y finalización.
- `src/main.ts`: entrada/salida/victoria, bloqueo, renderer, review, pasaporte, comparación y retorno a Modo libre desde save propio.
- `src/ui/mission/missionBar.ts`: actualización forzada del estado de barra al entregar control.
- `src/scene/player.ts`, `src/ui/hud.ts`, `src/ui/joystick.ts`: cancelar entradas latentes.
- `public/cinematics/earth.png`, `moon.jpg`, `SOURCES.md`: mapas locales y atribución.
- `docs/qa/cinematicas.md`: contrato, prioridades y QA.

## Prioridades y riesgos

**P0 implementado:** intro16s, skip seguro, propiedad exclusiva de cámara, motor congelado, entrega exacta, restauración de input, Modo libre protegido. Riesgo principal al integrar: otro loop/controlador escribiendo cámara o consumiendo eventos. Aplicar diff completo de `main.ts` sobre base actual, resolver cambios concurrentes por función; nunca reemplazar archivo con versión antigua.

**P1 implementado:** evacuación confirmada8s, victoria6s antes de review, comunicaciones, movimiento reducido, teclado/táctil, interrupción WebGL, mapas locales, comprobación de lifecycle. Mapas se precargan en preparación; fallo de carga conserva material procedural. Consumo añadido: dos texturas1024×512, dos esferas64×32,600 estrellas en un draw call. Ningún postprocesado, vídeo o shadow map orbital. Escena de superficie reutilizada; polvo limitado a una malla; embarque duplica temporalmente modelo, comparte recursos.

**P2 pendiente de validación física:** FPS/p95 en GPU móvil, consumo térmico, Safari/iOS, lector de pantalla y percepción de peso de cámara/audio en dispositivo real. Ajustar detalle solo contra mediciones. Voz humana o terreno orbital detallado serían ampliaciones de arte, sin bloquear operación actual.

## QA y reproducción

`npm test`; `npm run build`; `git diff --check`. Tests unitarios cubren fin único, reentrada, skip en siete fases, delta inválido, interrupción/reinicio, pose final exacta, independencia del agrupamiento de frames y movimiento reducido.

Smoke automatizado sobre app real, Chromium/SwiftShader, `/tmp/nexus-cinema/check.cjs`. Capturas pausadas mediante instrumentación DEV del reloj cinematográfico; no simulan resultados del motor. Victoria obtenida ejecutando pasos reales con diseño cadete y refugio durante tormenta. No cambiar `phase`, métricas ni samples para forzar resultados. Separar capturas del funcionamiento a duración normal y de FPS real.

Checklist manual de aceptación:

1. Confirmar diseño; observar 16 s completos y autorización antes de mover astronauta.
2. Saltar durante Tierra, crucero, descenso y entrega; comprobar cámara, misión t=0 y ausencia de inputs retenidos.
3. Mantener WASD/joystick/salto antes de abrir evacuación; cancelar, confirmar y repetir. Pausa previa debe conservarse.
4. Ocultar pestaña durante vuelo; volver sin salto temporal. Perder/restaurar WebGL; comprobar desbloqueo correcto.
5. Ganar con reglas reales; confirmar sobrevuelo antes del review. Fallar; confirmar ausencia de validación de éxito.
6. Revisar alternativas y pasaporte; volver/reintentar; evacuar después y abrir Modo libre sin heredar estado de misión.
7. 390×844 y844×390: skip visible, safe areas, foco, botones ≥44 px. Probar también dispositivo físico.
8. Repetir tres misiones; comparar recursos GPU tras terminar. Confirmar que no crecen texturas o geometrías temporales.

## Resultado observado

342 tests en36 archivos y build pasan. Bundle principal212.41 kB, gzip72.60 kB frente a191.99/65.17 kB de base. Mapas locales suman aproximadamente570 KiB; sin nuevas dependencias. `git diff --check` pasa. Detector visual sobre nuevos overlay/CSS: sin hallazgos; procedencia embebida en2/2 mapas.

Chromium con SwiftShader: sin errores JS; intro natural16.225 s, evacuación8.06 s; pose de cámara exacta al terminar. Skip, motor congelado, teclado aislado, confirmación cancelada, pausa previa y Modo libre desde su save verificados. Victoria obtenida por motor real→cinemática→review. Pérdida/restauración real de WebGL durante intro y con confirmación/Comandante abiertos: bloqueo liberado correctamente tras cerrar modal. Primer repro de Comandante dejaba `blocked=true`; regresión final devuelve `blocked=false, paused=false` en ambos modales.

Capturas1280×800,390×844,844×390. Cinemática visible enportrait; gameplay conserva requisito heredado de orientación horizontal. Barra operativa heredada ocupa gran parte de landscape; queda como limitación visual ajena a las transiciones, pendiente de integración con nuevo HUD. Cinco hallazgos del revisor corregidos, verdict `ship` limitado a esos cinco fixes. Documentación comparada con identidad existente; sin cambio de sistema visual.

Evidencia estructurada: `docs/qa/cinematicas-evidencia.json`. Capturas locales no versionadas: `.impeccable/review/`. Scripts de esta sesión: `/tmp/nexus-cinema/check.cjs`, flags `--states` y `--recovery`. Requieren Chromium/Playwright instalados fuera del proyecto; no se agregaron al package.json.

Pendientes: teléfono físico/FPS, audio perceptual, Safari/iOS, lector de pantalla, suspensión real del SO y offline. No confundir estos pendientes con tests/build ni con emulación de viewport. Sin service worker funcional, no se declara soporte PWA offline.
