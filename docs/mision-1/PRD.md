# PRD — NEXUS: Last Horizon

Fecha: 2026-11-15. Versión: 0.1. Estado: borrador de producto para revisión.

Alcance: experiencia educativa NEXUS; primera entrega centrada en Misión 1 «Primera oscuridad», conservando Modo libre. Responsable de producto y aprobación final: por definir.

Documento describe requisitos, estado de implementación y validaciones pendientes. Las reglas ejecutables están en `src/engine` y `src/game/config.ts`; propuestas de producto requieren validación antes de incorporarse.

## 1. Producto y problema

NEXUS convierte gestión de base lunar en decisiones visibles: diseñar con presupuesto limitado, operar sistemas interdependientes, anticipar crisis, comparar alternativas y explicar consecuencias con registros de partida.

Problema propuesto: conocer conceptos espaciales no basta para comprender por qué proteger tripulación puede reducir producción, por qué tener batería no garantiza potencia suficiente o por qué más cultivo exige más energía. Validación de este problema con estudiantes: pendiente.

Promesa: «Toma decisiones de misión, observa sus costes y mejora tu siguiente diseño».

Contexto narrativo propio: año 2039, base científica en polo sur lunar, apoyo de comandante Rivera desde Tierra. Datos espaciales aportan contexto y procedencia; economía y exposición de misión son modelos didácticos. Proyecto educativo de equipo LifePlants; uso de fuentes NASA/NOAA no implica afiliación ni certificación oficial.

## 2. Usuarios y necesidades

- Principal previsto: niñas y niños de 7–12 años; empezar sin cuenta, entender siguiente acción y reconocer consecuencia. Adecuación de edad todavía sin validar.
- Secundario: adolescentes y jóvenes; experimentar con prioridades, reservas y diseños diferentes.
- Facilitador: docente o mentor; usar misma crisis para discutir decisiones comparables. Herramientas docentes dedicadas quedan para fase posterior.
- Demo: evaluador necesita reconocer decisión → consecuencia → aprendizaje en recorrido breve, sin aprender todos los controles del tycoon.

Necesidades clave: entrada comprensible, amenaza anticipada, controles legibles, pausa para pensar, resultado explicable y reintento rápido.

## 3. Objetivos de primera entrega

1. Completar ciclo inicio → decisión → consecuencia → informe → rediseño con motor real.
2. Enseñar tres relaciones: energía almacenada frente a potencia disponible; prioridad eléctrica frente a continuidad de sistemas; refugio frente a exposición y actividad productiva.
3. Mostrar efectos medibles de energía, soporte vital, cultivo y blindaje.
4. Ofrecer entrada guiada y personalización sin exigir dominio previo del Modo libre.
5. Conservar partidas y funciones existentes de Modo libre.
6. Distinguir observaciones externas, snapshots, proyecciones y resultados simulados.

No se promete aprendizaje demostrado hasta completar prueba con usuarios.

## 4. Experiencia y navegación

Menú → Cadete → Misión 1 → briefing → base recomendada o personalización → llegada omisible → operación 3D → pausa/comandante → decisión confirmada → resultado/revisión de vuelo → rediseño o menú.

- **Cadete:** entrada recomendada, diseño inicial disponible, briefing breve, crisis fija y revisión final.
- **Personalización:** alternativa al lanzamiento directo; compras y reservas dentro de 300 créditos.
- **Modo libre / Simulador:** construir, explorar y continuar base guardada; mantiene progresión existente de 14 misiones.
- **Progreso:** perfil, certificaciones internas y cápsulas científicas accesibles desde menú secundario.
- **Laboratorio Docente:** visible como próximo; sin lanzamiento hasta existir escenarios y flujo reales.

Idioma inicial español; inglés seleccionable. Gameplay orientado a horizontal; adaptación a teléfono debe validarse en dispositivo físico.

Duración de Misión 1: 600 s de simulación. Controles actuales: 1x, 2x, 4x y avance al siguiente evento, ejecutando pasos reales. Sin pausas ni saltos: 10 min a 1x, 5 min a 2x, 2,5 min a 4x, más pantallas y cinemáticas. Demo objetivo de 2 min requiere recorrido medido con avances; no equivale a duración garantizada de sesión.

## 5. Requisitos funcionales

### RF-01 — Entrada y briefing · P0

Jugador distingue Cadete, Simulador y Laboratorio pendiente. Puede lanzar base recomendada o personalizar antes de empezar. Briefing explica objetivo, oscuridad, tormenta y coste de refugiarse. Menú y preparación no consumen recursos.

Aceptación: usuario nuevo identifica acción principal; cada modo disponible abre flujo real; Laboratorio no aparenta funcionalidad jugable.

### RF-02 — Diseño de base · P0

Presupuesto de 300 créditos; estación, antena, mástil e invernadero incluidos. Reservas y energía iniciales al 50 % de capacidad. Compras extra: mástiles 40, baterías 50, niveles de invernadero 60, procesador 50, bermas 40 y paquetes de reserva 15 créditos. Cada paquete añade 10 puntos porcentuales de capacidad inicial del recurso elegido, hasta 100 %.

Máximos extra: 3 mástiles, 3 baterías, 2 niveles agrícolas, 1 procesador, 3 bermas y 5 paquetes por recurso. Capacidad de batería y carga almacenada deben presentarse como conceptos distintos. Berma 2 y 3 alcanzan protección máxima actual de 97 %; nivel 3 no se vende como mejora adicional garantizada.

Aceptación: coste y saldo visibles; diseño inválido o sobre presupuesto impide iniciar con motivo concreto. Reintento precarga diseño anterior. No hay compras durante operación.

### RF-03 — Operación 3D y sistemas · P0

Jugador recorre base, consulta sistemas, cambia prioridad eléctrica, interruptores y luces, entra/sale del refugio y realiza acciones agrícolas o de regolito permitidas. Soporte vital es carga crítica: prioridad modificable, sin interruptor de apagado directo.

HUD muestra O₂, agua, alimento, energía almacenada, salud, exposición, demanda, potencia disponible y sistemas realmente alimentados. Diferencia orden solicitada de funcionamiento efectivo; explica cortes por energía o potencia insuficiente.

Rutina automática de cultivo forma parte del mundo actual: riega, corrige clima y cosecha con costes reales cada 5 s cuando procede. Debe explicarse al jugador y aplicarse igual en partida, proyección y replay. Refugio suspende procesador, robots, crecimiento y rutina agrícola; consumos y evolución térmica siguen reglas del motor.

Aceptación: cambios producen efectos medibles; mensajes de rechazo explican restricciones; ninguna interacción visual crea recursos fuera del motor.

### RF-04 — Crisis y cierre de misión · P0

Cronología fija, en segundos simulados:

- 180: aviso de oscuridad; intervalo de oscuridad [240, 420).
- 450: aviso de tormenta; intervalo de tormenta [480, 540).
- 600: cierre previsto.

Victoria: llegar a 600 s con salud > 0, exposición ≤ 40 u y sin agotar O₂, agua o alimento durante más de 20 s consecutivos. Fallo: incumplir cualquiera de esas condiciones; fallo prevalece si coincide con cierre. Exposición siempre en unidades didácticas `u`.

Aceptación: avisos aparecen una vez; informe explica motivo de cierre con cifras reales; partida cerrada deja de avanzar. Construcción, rover, rescate e impactos quedan fuera de esta misión, conservados donde correspondan en Modo libre.

### RF-05 — Pausa y control temporal · P0

Pausa, comandante y cinemáticas congelan simulación y bloquean acciones económicas del mundo. Cerrar comandante restaura pausa anterior. Velocidades y avance por eventos cambian espera, conservando reglas y resultados para mismos comandos en mismos instantes simulados.

Aceptación: recursos y reloj permanecen estables durante pausa; callbacks diferidos y teclas repetidas tampoco alteran economía. Avance al siguiente evento ejecuta simulación completa y puede terminar antes por fallo.

### RF-06 — Comandante y proyección · P0

Desde checkpoint común, comparar continuidad actual con alternativa de controles, refugio y prioridades. Ambas usan mismo escenario, horizonte y motor. Editar alternativa no modifica partida; confirmar aplica comandos reales y comunica rechazos.

Aceptación: resultados identifican horizonte y tiempo realmente alcanzado; fallo temprano no aparenta proyección completa. No se suponen futuras acciones humanas; rutina automática existente sí se simula. Comparación se identifica como proyección.

### RF-07 — Informe, revisión y rediseño · P0

Cierre presenta resultado, motivo, duración simulada, mínimos de recursos, exposición, cortes eléctricos, cosechas, refugio y decisiones registradas. Gráfico dispone de tabla equivalente. Comparación desde checkpoint aparece cuando existe evidencia compatible.

Aceptación: cada afirmación procede de estado, métricas, log o eventos. No atribuir retrasos de cosecha a una decisión sin cálculo que lo demuestre. Reintento conserva diseño y referencia del resultado previo; informe se abre una sola vez.

### RF-08 — Progreso e insignias · P1

Perfil e idioma conservan preferencias locales. Progresión de Modo libre agrupa sus 14 misiones en certificaciones internas. Pasaporte de vuelos muestra criterios y evidencia de insignias, sin presentarlas como acreditación profesional.

Aceptación: clicks solos no desbloquean insignias. Historial de vuelos actual vive en sesión; recargar no debe presentarse como conservación garantizada de misiones o pasaporte.

### RF-09 — Datos espaciales y procedencia · P0

Cada dato contextual muestra fuente, instante observado, obtención y estado `LIVE`, `SNAPSHOT` o `UNAVAILABLE`, según corresponda. Datos no disponibles no se inventan. Fuente remota obtenida ahora no implica observación reciente: antigüedad y calidad se muestran aparte.

Misión 1 usa escenario fijo inspirado en fulguración del snapshot versionado. Telemetría externa no cambia su cronología. Observaciones cerca de Tierra o L1 no se presentan como mediciones de superficie lunar. Exposición simulada no se convierte en magnitud médica.

Aceptación: caída de red permite fallback fechado para datos; no rotular snapshot como vivo. Este fallback no demuestra que app completa cargue offline.

### RF-10 — Preservación de Modo libre · P0

Conservar construcción, rover, perfil, táctil, pantalla completa, progresión y save `nexus.save.v1`. Misión no usa ese save para guardar o reanudar su economía; tampoco acumula progreso offline de misión.

Aceptación: completar/reintentar/abandonar misión deja save libre idéntico; volver a Simulador reanuda base correspondiente. Cambios de preferencias o perfil son independientes del estado económico.

## 6. Calidad y restricciones

- **Usabilidad:** acción principal y siguiente amenaza visibles; detalle científico y progreso no bloquean primer lanzamiento. En teléfono horizontal, HUD no debe impedir operar escena ni ocultar acciones críticas.
- **Accesibilidad:** teclado, foco visible y restaurado, salida de modales, etiquetas y tablas comprensibles; estado no depende solo de color. `prefers-reduced-motion` y omisión de cinemáticas deben conservar resultado funcional.
- **Audio y cinemáticas:** sin información indispensable solo por sonido; reproducción y controles de silencio respetan navegador. Llegada, victoria y evacuación no alteran economía ni dejan cámara/input bloqueados. Assets requieren procedencia documentada.
- **Rendimiento:** objetivo propuesto ≥30 FPS sostenidos durante operación en teléfono de referencia por definir. Registrar hardware, navegador, resolución y pausas largas; Chromium/SwiftShader no acredita rendimiento móvil.
- **Determinismo:** pasos de 0,25 s; mismos diseños y comandos temporizados producen mismo resultado en partida/replay. Proyección comparte reglas, sin reloj real, red ni azar externo dentro del motor.
- **Datos locales:** sin cuenta obligatoria ni telemetría de usuarios añadida. Preferencias y save libre existentes se preservan; fallos de almacenamiento no deben aparentar guardado exitoso.
- **Implementación:** TypeScript, Three.js y Vite existentes; sin React, Tailwind, dependencias nuevas, segundo runtime ni cambios de lockfile para este alcance.

## 7. Métricas de éxito propuestas

Metas para piloto moderado de al menos 6 participantes del público previsto; hipótesis de producto, sin medición actual ni instrumentación remota autorizada.

- **Entrada:** ≥80 % lanza primera misión sin ayuda del facilitador; medir desde menú hasta inicio, excluyendo carga inicial.
- **Comprensión:** ≥80 % explica al cierre dos de tres relaciones objetivo: energía/potencia, prioridades/cortes y refugio/producción. Rúbrica común antes y después; registrar cambio individual.
- **Rediseño:** ≥60 % propone cambio concreto para segundo intento y predice efecto coherente; revisión de vuelo permite contrastarlo.
- **Claridad del resultado:** ≥80 % identifica causa principal de victoria/fallo usando evidencia del informe.
- **Demo:** recorrido ensayado muestra crisis, decisión, consecuencia e informe en ≤2 min usando controles disponibles; medir tiempo real aparte del simulado.
- **Integridad:** cero mutaciones de save libre por misión; cero diferencias de determinismo en matriz acordada; cero errores que impidan completar flujo durante QA de entrega.

Tasa de victoria aislada no demuestra aprendizaje. Comparar diseños por exposición, continuidad, reservas, cosechas y coste; dificultad se calibra después del piloto.

## 8. Estado y evidencia al redactar

- **Observado en código local:** menú con Cadete/Simulador/Laboratorio deshabilitado, diseño recomendado, preparación, motor/runner, HUD, comandante, informe, revisión, pasaporte y secuencias cinematográficas conectados.
- **Verificación automática:** tests comprueban reglas, balance y regresiones; build comprueba tipos y empaquetado. La presencia de una función en código no acredita validación en dispositivo.
- **Sin validar aquí:** producción, teléfono físico, Safari/iOS, lector de pantalla real, instalación, arranque offline y aprendizaje con estudiantes.

## 9. Prioridades y gates

1. **P0 — Cierre de primera entrega:** verificar RF-01 a RF-07, RF-09 y RF-10 sobre commit candidato concreto. Ejecutar tests/build y flujo real por separado; resolver bloqueos de navegación, datos, pausa, informe y save.
2. **P0 — Validación de dispositivo:** completar recorrido en escritorio y teléfono horizontal autorizado; registrar legibilidad, táctil, FPS y fallos. Sin dispositivo, aceptación móvil queda pendiente explícita.
3. **P1 — Aprendizaje y consistencia:** piloto, duración real, cobertura ES/EN de informe/revisión/pasaporte, balance y RF-08. Ajustes de reglas requieren actualizar requisitos y evidencia.
4. **P2 — Ampliación:** Laboratorio Docente, nuevas misiones, persistencia de vuelos y arranque offline; cada ampliación necesita alcance propio.

Cada gate registra versión, casos, resultado y límites. Tests/build, navegador, teléfono, instalación y offline se reportan separados.

## 10. Riesgos y decisiones abiertas

- **Dificultad permisiva:** barrido documentado permite victorias sin compras; revisar aprendizaje y variedad de estrategias antes de endurecer reglas.
- **Automatización agrícola:** reglas actuales difieren del mantenimiento manual descrito en documentos iniciales; comunicar claramente y actualizar evidencia de balance antes de reutilizar cifras antiguas.
- **Duración comercial:** texto «~2 min» depende de avances y decisiones; validar recorrido o corregir promesa, conservando 600 s simulados.
- **Móvil y accesibilidad:** cobertura de viewport emulado no sustituye hardware ni tecnologías asistivas reales.
- **Idioma:** selector ES/EN existe; módulos de revisión/pasaporte contienen textos españoles directos. Cobertura completa bilingüe pendiente de auditoría.
- **Historial:** vuelos en memoria no ofrecen persistencia tras recarga. Decidir necesidad de conservación sin tocar save libre.
- **Fuentes externas y assets:** APIs pueden fallar; assets audiovisuales requieren procedencia documentada. No atribuir afiliaciones por utilizar datos públicos.
- **Responsabilidad y medición:** definir dueño de producto, teléfono objetivo, facilitador y fecha de piloto antes de comprometer lanzamiento.

## 11. Fuera de primera entrega

Multijugador, cuentas/cloud, panel docente, editor de escenarios, Laboratorio jugable, guardado/reanudación de misión, progreso offline de misión, PWA offline completa, certificación profesional y validación clínica de exposición. Replay/proyección existentes no equivalen a editor contrafactual general de partidas guardadas.

## 12. Referencias del producto

- [Balance](balance.md): barrido histórico; revisar vigencia tras cambios de rutina.
- [Escenario y diseño Cadete](../../src/engine/mission1.ts), [config de juego](../../src/game/config.ts), [runner](../../src/engine/runner.ts), [rutina agrícola](../../src/engine/routine.ts).
- [Integración activa](../../src/main.ts), [menú](../../src/ui/shell/titleScreen.ts), [telemetría](../../src/data/telemetry.ts), [comparación](../../src/ui/flightreview/model.ts), [pasaporte](../../src/ui/passport/index.ts).
- [README raíz](../../README.md): visión, público, narrativa y desarrollo local.
