# Agente 2 — A: motor de Misión 1

Trabajás solo en `.worktrees/motor`, rama `feat/mision-motor`, de repo NEXUS. Integrador comunica ruta absoluta y baseline compartido. No hagas checkout ni pull en raíz. Leer AGENTS.md, contrato, revisión y src/engine/types.ts. Commits locales propios permitidos al ejecutar encargo; sin push/main/deploy.

Ownership: src/engine/**. Tipos ya preparados; no reemplazarlos por versión de Descargas. Revisar kernel real: src/game/sim.ts, state.ts, config.ts, storm.ts, damage.ts y tests. Reusar primitivas sin cambiar Modo libre. No importar runtime React ni código de docs/referencias.

## Implementar

- mission1.ts: escenario fijo, precios, límites y constantes explícitas. Snapshot local solo como contexto fechado. Sin fetch/reloj de pared/Math.random.
- design.ts: emptyDesign, checkDesign y startMission desde newGame(0). Validar finitud, enteros, rangos y presupuesto. Valores JSON serializables; no Infinity. Declarar capacidad y carga inicial energética.
- commands.ts: applyToGame conserva semántica libre; applyCommand valida fase, aplica y registra comandos aceptados/rechazados en orden y tiempo de simulación. Eventos de refugio solo si hubo transición real.
- world.ts: paso fijo 0.25; oscuridad y tormenta del escenario; actualizar balances, cultivo, exposición, métricas, muestras y fallo/victoria. No usar tick/cyclePhase para decidir día. Sin efectos aleatorios, rescate ni callbacks del render.
- Adaptación de misión: resolver coste agrícola por nivel y suspensión de producción en refugio. Kernel actual no hace ambas cosas. No cambiar globales libres. Si adaptación no cabe sin duplicación arriesgada, informar solución concreta al integrador antes de tocar otro carril.
- lastPower y metrics: balance real y acumulados por paso, mínimos incluyendo estado inicial/final. Definir reducción de luces respecto de configuración y/o rango, sin confundir falta de energía con decisión manual. Guardar métricas coherentes para summarize.
- project.ts: clon, aplicar plan ahora, avanzar con mismo worldStep al horizonte válido, devolver datos del intervalo y rechazos. Sin mutación del original. No inventar acciones futuras; advertencia sobre esta política en UI.
- replay.ts: reproducir comandos a sus tiempos STEP y orden original. Validar until finito/alineado; comportamiento explícito para entradas inválidas. RNG solo si escenario lo usa; no inventar azar por cumplir nombre de módulo.
- summary.ts: cifras desde estado/métricas/eventos; explicar hechos observados. No afirmar retrasos causales sin contrafactual.
- index.ts: API y tipos públicos del contrato. Comunicar pronto commit de motor compilable para desbloquear B/C/D; no usar implementaciones falsas como entrega.

## Pruebas

Paridad proyecto/ejecución, no mutación, replay económico exacto, presupuesto (caso 305), rangos inválidos, fronteras de eventos sin duplicados, fallo antes de victoria, muestras inicial/final, métrica de pausa mediante runner real en integración y estrategias A/B/C. Cambiar agrupación de frames y 1x/2x requiere prueba en integración; no vender test «no llamar función no cambia nada» como prueba de pausa.

Políticas A/B incluyen riego, control térmico, cosecha y entrada/salida de refugio. Comprobar costes 260/270/240. Dos victorias distintas y fallo C deben demostrarse; calibrar constantes propias de misión y documentar antes/después. No forzar cosechas arbitrarias, cambiar expectativas para ocultar fallos ni tocar config libre.

Entregar commit local, API, pruebas, decisiones de balance y lecturas que integrador debe mostrar. Tests/build con kernel real; si integración aún no existe, declararlo. Extras y contrafactual quedan fuera hasta completar bucle y validación.
