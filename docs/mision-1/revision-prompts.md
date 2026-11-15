# Revisión de prompts descargados

Se revisaron `00-contrato-mision-1.md`, `types.ts` y cuatro prompts de Descargas. Originales se conservan allí; documentos activos son versiones normalizadas en esta carpeta.

## Correcciones incorporadas

1. **Baseline avanzado:** `main` está en `01d79c6`, no en `e8188c5`. Hay 152 tests, no 147. Fix del astronauta en rover ya está integrado; no esperar respuesta para fusionarlo otra vez. Perfil, controles táctiles y manifest también existen.
2. **PWA parcial:** existe `public/manifest.webmanifest`; no se encontró service worker. Instalación/offline no se acreditan por manifest ni por build. PWA offline continúa fuera del alcance Misión 1.
3. **Cinco agentes:** se incorpora D para pruebas de integración/regresión y QA. No comparte ownership de motor ni UI.
4. **Conflictos:** B usa `texts.ts`; C usa `commanderTexts.ts`. No comparten `mock.ts`, previews ni archivos de contrato duplicados. Tipos se preparan antes del arranque paralelo.
5. **Refugio:** código actual bloquea procesador/robots, pero `stepGreenhouse` no detiene crecimiento por refugio y `resolvePower` no apaga luces por ese motivo. Misión debe definir comportamiento propio explícito sin cambiar Modo libre. No afirmar que regla completa ya existe.
6. **Invernadero:** consumo de luces actual no escala por nivel. A implementa y prueba coste adicional de niveles dentro de adaptación de misión; no basta cambiar constantes y suponer que kernel las usa.
7. **Políticas de prueba:** falta control térmico en ejemplos originales. A/B deben ajustar clima, regar y cosechar con comandos reales. Plantas requieren luz efectiva 40–60 para evitar estrés; 20 % durante oscuridad introduce coste y posible muerte, no garantía de cosecha.
8. **Presupuesto:** diseños A/B/C originales cuestan 260/270/240 créditos, respectivamente; 300 es máximo, no gasto obligatorio. Compra de 301 es imposible con precios múltiplos de 5. Caso de exceso válido: baterías 3 + mástil 1 + berma 1 + reservas O2 5 = 305.
9. **Resultados:** dos victorias y un fallo son objetivos de balance pendientes. No se probó que A tenga >=2 cosechas y B <=1. No fijar desigualdades arbitrarias para forzar balance; diferenciar estrategias con métricas verificadas.
10. **JSON:** no usar `Infinity` para desactivar tormentas. Modo misión no llama planificador de tormentas libres; cualquier centinela del estado debe ser finito.
11. **Contrato ampliado:** `MissionState.lastPower` permite HUD real; `MissionMetrics` conserva acumulados exactos sin inferir duración de muestras cada 5 s. Tipos solo son contrato; no existe implementación todavía.
12. **Pausa y replay:** callbacks de robots, trabajos diferidos, inputs, perfil, guardados y relojes externos requieren revisar su alcance. Animación no puede producir recursos ni saltarse `dispatch` mientras está en pausa. Posición visual no debe corromper replay de estado económico.
13. **Proyección:** declara política sin acciones futuras. Plan aplica comandos en instante actual; no promete riegos o cosechas futuros. Resumen no atribuye retraso causal de 80 s sin comparación calculada.
14. **Permisos:** se retiran pushes automáticos y previews remotas automáticas. Integración inicial local, con carriles y baseline compartido; `main` y producción no se modifican por este paquete.

## Pendientes deliberados

Motor, pantallas, balance de 600 s, guardado de misión, contrafactual desde checkpoint, offline completo y prueba con estudiantes. No sustituir estas verificaciones por mocks ni por capturas de prototipos.
