# Agente 5 — D: QA, integración y regresión

Trabajás solo en `.worktrees/qa`, rama `test/mision-qa`, repo NEXUS. Leer AGENTS.md, contrato, revisión y tipos. Ownership: tests/mission/** y docs/qa/mision-1.md. No editar motor, UI, integración ni tests de A para hacerlos pasar. Commits locales propios de pruebas permitidos; sin push/main/deploy.

Baseline observado: 152 tests, 15 archivos, build correcto en 01d79c6. Verificar actual. No imponer número fijo como sustituto de pruebas ni añadir tests que repitan implementación. No agregar dependencias. Antes de motor/integración, revisar riesgos y preparar casos; ejecutar contra código real cuando integrador comunique commits.

## Pruebas automáticas con valor

- Paridad de proyección y ejecución por mismo horizonte; source state intacto; replay con comandos repetidos en mismo tiempo, incluidos rechazados.
- Eventos en fronteras 180/240/420/450/480/540/600 una sola vez; fallo/victoria y muestras finales coherentes.
- Diseños A/B/C con políticas reales y costes 260/270/240. Caso exceso 305; NaN/Infinity/fracciones/negativos; curva saturada de berma.
- Pausa/1x/2x/agrupación de frames a través de runner de integración si existe. No reemplazarlo con test trivial de no llamar worldStep. Si runner está acoplado a DOM, reportar ruta y cambio mínimo al integrador; no simular un runner ajeno y presentarlo como prueba del producto.
- Save libre y perfil intactos tras misión, reintento y menú. No escrituras a nexus.save.v1 desde misión.
- Botones, teclado, callbacks de robots y trabajos diferidos no saltan pausa ni duplican consumo.
- Primitivas libres mantienen tests originales; no modificar sus expectativas.

## QA real

Cuando flujo exista: escritorio, móvil horizontal si hay dispositivo disponible, teclado, foco, contraste legible, Comandante/cancelar/confirmar, cierre, informe y reintento. No controlar teléfono del usuario sin coordinar disponibilidad. No afirmar teléfono físico desde viewport emulado.

Verificar exposición u en misión, diferencia entre snapshot y datos en vivo, que proyección no promete acciones futuras, tabla accesible y gráfico con 0/1 muestras. Manifest existe; service worker/offline completo fuera de entrega. No declarar PWA validada por manifest.

No crear mocks para declarar misión integrada. Herramientas de navegador disponibles pueden usarse; si falta entorno, documentar pruebas pendientes sin instalar framework nuevo por inercia.

Cada hallazgo: ruta — problema reproducible — sugerencia; incluir esperado/observado y evidencia mínima. Reporte docs/qa/mision-1.md separa automatizado, navegador escritorio, emulación, teléfono real y pendientes. Integrador coordina correcciones por dueño; QA revalida cambios relevantes, sin ampliar alcance.

Entregar commit de pruebas/reporte y recomendación respaldada: listo para revisión o bloqueos concretos. Nunca autorizar main ni producción por cuenta propia.
