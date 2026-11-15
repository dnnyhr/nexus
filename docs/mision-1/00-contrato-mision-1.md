# NEXUS — contrato común Misión 1 «Primera oscuridad»

Este contrato y `src/engine/types.ts` gobiernan cinco carriles. Es versión revisada de documentos descargados; leer `revision-prompts.md` para cambios. Ante ambigüedad de contrato, integrador resuelve y comunica cambio antes de que otros agentes dependan de él.

## Producto

Una partida incorpora preparación de base con 300 créditos, operación 3D, pausa con proyección, consecuencia, informe y reintento con diseño precargado. Un estado económico y un motor de misión; Modo libre permanece en misma aplicación sin cambios de comportamiento ni migración silenciosa de saves.

Objetivo inicial: 600 s de simulación; pausa real; velocidad 1x/2x. Exposición siempre en unidades didácticas. No usar dosis médicas ni mSv para misión.

## Escenario candidato

- Aviso de oscuridad: 180 s. Oscuridad: intervalo [240, 420).
- Aviso de tormenta: 450 s. Tormenta: intervalo [480, 540).
- Fin: 600 s. Intensidad didáctica fija y fulguración inspiradora del snapshot, con fuente y fecha.
- Victoria: alcanzar 600 s, salud >0, exposición <=40 u, ningún recurso vital agotado durante más de 20 s consecutivos.
- Fallo: salud <=0; exposición >40 u; O2, agua o alimentos <=0 durante más de 20 s consecutivos. Fallo prevalece sobre victoria al mismo paso.
- Sin rescate, impactos, construcción durante operación, rover, red ni progreso offline en misión. Modo libre mantiene funciones existentes.

Valores iniciales para balance; A puede proponer ajustes de constantes propias de misión y documentar antes/después. No cambiar kernel libre, cronología o objetivo a escondidas para hacer pasar tests.

## Preparación

Incluido: estación 1, antena 1, mástil 1, invernadero 1, capacidad energética base, reservas al 50 % y condiciones iniciales del cultivo explícitas. Baterías compradas aumentan capacidad según reglas de misión; documentar carga energética inicial sin confundir capacidad con energía almacenada.

| Ítem extra | Precio | Máximo |
| --- | --- | --- |
| Mástil solar | 40 | 3 |
| Batería | 50 | 3 |
| Nivel invernadero | 60 | 2 |
| Procesador | 50 | 1 |
| Berma | 40 | 3 |
| Reserva +10 % de capacidad de O2/agua/alimento | 15 | 5 por recurso |

Diseños inválidos incluyen NaN, Infinity, negativos, fracciones, ítems sobre límite o coste sobre presupuesto. Reserva inicial máxima: 100 %. Nada se compra durante operación.

Blindaje pasivo mejora protección del refugio; fuera de refugio protege traje, no berma. Referencia: `protection()` aplica tope 0.97. Tormenta candidata: tasa exterior 0.8 u/s por intensidad; exposición recibida = tasa exterior x (1-protection). Protección ya incluye traje: no descontarlo dos veces. Nivel 2 ya alcanza tope actual; explicar saturación y no vender nivel 3 como mejora adicional garantizada. Si se propone cambiar curva para misión, integrador aprueba y documenta decisión antes de UI/balance; no cambiar Modo libre.

En misión, refugio suspende procesador, robots y producción/crecimiento agrícola. Consumo de mantenimiento y comportamiento térmico del cultivo se definen explícitamente y se prueban. Adaptación respeta estrés, agua y luz sin afirmar que kernel ya implementa toda esta regla. Mayor nivel agrícola debe tener coste operativo verificable; A documenta adaptación en motor de misión.

## Estrategias de prueba

- A, granja y reservas: invernadero +2, mástil +1, berma 1, O2 +2 paquetes, agua +2 paquetes. Coste 260.
- B, batería y refugio: baterías 3, berma 2, mástil +1. Coste 270.
- C, fallo didáctico: invernadero +2, mástiles +3, luces 100 %, no refugio. Coste 240.

A y B riegan, corrigen temperatura y cosechan mediante comandos válidos. Política A contempla reducir luces durante oscuridad y asumir coste agrícola; B prioriza continuidad con almacenamiento. Especificar salida del refugio y resto de acciones en política reproducible, sin intervenciones ocultas de test. C debe fallar con explicación concreta. Dos victorias distintas son criterio de aceptación por demostrar, no hecho actual. Registrar cosechas reales, gasto, reservas, exposición y duración de restricciones; no exigir diferencia de cosechas sin evidencia.

## Motor y tipos

`src/engine/types.ts` es fuente única. A exporta desde `src/engine/index.ts`:

```ts
SCENARIO_1, PRICES, LIMITS, STEP, SAMPLE_EVERY
emptyDesign(), checkDesign(design, scenario?), startMission(design, scenario?)
applyToGame(game, command), applyCommand(mission, command)
worldStep(mission), project(mission, plan, horizon)
replay(design, log, until, scenario?), darknessAt(mission), nextEvent(mission)
summarize(mission)
```

Firmas completas en comentarios originales de tipos. Reexportar tipos públicos. `worldStep` avanza STEP=0.25, sin efecto tras cierre. `lastPower` contiene último balance real. `metrics` acumula mínimos y duraciones por paso, con definición documentada; samples cada 5 s son representación de gráfico, no base de medición exacta.

Inicializar con `newGame(0)`. Sin reloj de pared, fetch ni Math.random dentro de motor. Ningún campo contiene Infinity o valores no serializables. Tormentas libres no se ejecutan; estado `game.storm` sirve para representación del escenario fijo.

Eventos se emiten una sola vez al cruzar frontera; incluir muestras inicial y final aunque no coincidan con cadencia. Muestras expresan recursos en % de capacidad y exposición en u; no sumar ambas escalas.

`project` clona estado, aplica plan ahora, devuelve muestra de partida más futuro hasta horizonte o fallo. Eventos/harvests futuros se distinguen de previos; no duplicar historia al mostrar comparación. Sin futuras acciones humanas supuestas. Mismo horizonte, escenario y reglas para ambas columnas. Declarar hasta qué instante llegó cada resultado si hubo fallo previo.

Comandos aceptados/rechazados se registran con tiempo de simulación y orden estable. Confirmar en UI despacha comandos reales, informa rechazos, nunca altera juego durante edición de alternativa. Replay reproduce estado económico y eventos; integración mantiene movimiento visual fuera de ese estado salvo que exista comando reproducible para modificarlo.

Resumen usa datos medidos. Frases como «luces reducidas durante 120 s; energía mínima 8 %» son válidas; «eso retrasó cosecha 80 s» exige contrafactual calculado, fuera del alcance inicial.

## Archivos y ramas

| Rol | Rama | Propiedad |
| --- | --- | --- |
| Integrador | feat/mision-1 | main.ts, ui/hud.ts, ui/panels.ts, ui/i18n.ts, index.html, README.md, AGENTS.md, docs/mision-1 y coordinación |
| A motor | feat/mision-motor | src/engine/** y tests de motor allí |
| B preparación | feat/mision-preparar | src/ui/mission/prepare.ts, missionBar.ts, mission.css, texts.ts |
| C comandante | feat/mision-comandante | src/ui/mission/commander.ts, report.ts, chart.ts, report.css, commanderTexts.ts |
| D QA | test/mision-qa | tests/mission/**, docs/qa/mision-1.md |

Referencias HailMary no se modifican ni se importan en producción. Si integración necesita otro archivo, dueño actual coordina cambio antes de editar. No modificar package.json/lockfile. No generar mock.ts compartido ni pantallas falsas dentro del build.

## Integración y aceptación

Integrador revisa y commitea preparación localmente al ejecutar su encargo; crea worktrees desde baseline compartido. A primero; B/C trabajan contra tipos y validan contra motor real cuando esté integrado. D valida comportamiento y regresiones; no debilita tests del motor.

No consumo ni comandos económicos cuando está en pausa o overlay bloquea interacción. Revisar callbacks de robots, trabajos diferidos, atajos y inputs repetidos; `requestAnimationFrame` no es única ruta de mutación.

`nexus.save.v1`, perfil y preferencias libres se conservan. Misión no carga, guarda ni simula progreso offline sobre save libre. Menú no ejecuta economía de fondo.

- Preparar respeta presupuesto, máximos y oportunidad de compra.
- Tres partes del juego conectadas con motor real; replay y proyección reproducibles.
- Pausa, 1x/2x y agrupación de frames no alteran resultados para mismos comandos en mismos tiempos de simulación.
- Diseños A/B ganan; C pierde; cuatro sistemas tienen efectos medibles.
- Informe explica resultados, incluye timeline, gráfico con tabla, diseño y reintento.
- Tests libres de baseline siguen verdes; build pasa.
- Flujo real probado en navegador de escritorio y teléfono horizontal cuando haya dispositivo autorizado. Pendientes explícitos si no hay acceso.
- PWA offline, contrafactual desde checkpoint, save de misión y prueba con estudiantes permanecen fuera de primera entrega.

Sin commits durante preparación de este paquete. Al iniciar trabajo de agentes se permiten commits locales de sus entregas. Push/PR/main/deploy no quedan autorizados automáticamente.
