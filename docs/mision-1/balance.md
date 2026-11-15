# Balance Misión 1 — barrido reproducible

Generado con `UPDATE_MISSION_BALANCE=1 npm test -- src/engine/balance.test.js`. Sin variable, el test verifica que este documento coincide con resultados actuales.

Casos: 57; diseños únicos: 30; victorias: 56. No es búsqueda exhaustiva ni QA del producto integrado.

## Reglas y adaptación

Reservas: 50 % + 10 % por paquete; energía inicial: 50 % de capacidad (120 + 300 por batería). Comprar batería agrega capacidad y media carga, no carga completa.

Cultivo inicial: agua/luz/temperatura 50, crecimiento/estrés 0, vivo. Luces iniciales 50 %. Demanda LED = brillo / 100 × 0.9 × nivel. Resolución de potencia comparte resolvePower; consumo/procesador comparten step; cultivo comparte stepGreenhouse; protección comparte protection. No tick ni tormentas libres.

Refugio: procesador/robots/LED apagados; crecimiento suspendido. Agua, temperatura y estrés siguen evolucionando: refugio no conserva mágicamente el cultivo. Calefacción nocturna consume 0.5/s; soporte vital 0.6/s sigue activo. Acciones manuales agrícolas suspendidas hasta salir.

Métricas por paso de 0.25 s: minLifeSupport incluye inicio y comandos; secondsLightsReduced cuenta decisión de brillo <50 fuera del refugio, independiente de cortes; secondsShortage cuenta limitación energética; secondsSheltered cuenta permanencia. No inferidas de samples. lastPower es balance del último intervalo, no pronóstico del siguiente.

Ledger aprobado: crew registra consumo vital y energía de soporte fuera de refugio; shelter registra esa misma energía mientras está dentro, sin ahorro ficticio. solar, lights, heating y processor registran flujos; irrigation, climate y harvest registran cambios reales por comando. storage recoge saturación/límite cero y residuo numérico. Cierre por intervalo: suma de diferencias de causas = recursos finales − iniciales. Las causas no incluyen salud, regolito ni materiales.

## Políticas

- Todas revisan cada 5 s: riegan con agua de planta ≤38; ajustan temperatura >58/ <42 si hay 3 energía; cosechan al llegar a 100; replantan si hay 8 materiales. Procesador: tres excavaciones y entrega si tolva <6. No se alteran recursos/cultivo directamente.
- granja: 50 % LED, 20 % entre 240–420; refugio [480,540).
- batería: 50 % LED todo el tiempo; refugio [480,540).
- riesgo: 100 % LED, sin refugio; mismo mantenimiento manual. C falla por exposición.

## Ajustes de balance

| Constante en mission1.ts | Antes | Después | Motivo |
| --- | --- | --- | --- |
| unpoweredHealthLoss | 0.3 | 0.3 | Valor inicial; sin ajuste tras barrido |
| agriculturalDrawPerLevel | 1 | 1 | Escala LED por nivel; sin ajuste tras barrido |
| cronología / presupuesto / límite exposición | 600 s / 300 / 40 u | sin cambios | Contrato preservado |

No se ajustó kernel libre ni curva de protección. Berma 2 y 3 saturan en 97 %: nivel 3 no mejora protección y queda dominado por nivel 2 para esta misión. No se presenta como compra ventajosa.

## Resultados

Diseño: S=solares extra, B=baterías, G=niveles agrícolas extra, P=procesador, R=berma; reservas O2/agua/alimento en paquetes.

| Caso | Política | S/B/G/P/R; reservas | Coste | Resultado / motivo | Duración s | minLifeSupport % | Exposición u | Cosechas | Refugio s | Cortes s |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | granja | 1/0/2/0/1; 2/2/0 | 260 | victory | 600.00 | 25.00 | 3.84 | 1 | 60.00 | 108.75 |
| B | batería | 1/3/0/0/2; 0/0/0 | 270 | victory | 600.00 | 5.00 | 1.44 | 2 | 60.00 | 0.00 |
| C | riesgo | 3/0/2/0/0; 0/0/0 | 240 | failed / exposure_exceeded | 535.75 | 12.50 | 40.14 | 0 | 0.00 | 148.50 |
| base-granja | granja | 0/0/0/0/0; 0/0/0 | 0 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| solarMasts-1-granja | granja | 1/0/0/0/0; 0/0/0 | 40 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| solarMasts-2-granja | granja | 2/0/0/0/0; 0/0/0 | 80 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| solarMasts-3-granja | granja | 3/0/0/0/0; 0/0/0 | 120 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| batteries-1-granja | granja | 0/1/0/0/0; 0/0/0 | 50 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 0.00 |
| batteries-2-granja | granja | 0/2/0/0/0; 0/0/0 | 100 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 0.00 |
| batteries-3-granja | granja | 0/3/0/0/0; 0/0/0 | 150 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 0.00 |
| greenhouse-1-granja | granja | 0/0/1/0/0; 0/0/0 | 60 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 100.00 |
| greenhouse-2-granja | granja | 0/0/2/0/0; 0/0/0 | 120 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 108.75 |
| processor-1-granja | granja | 0/0/0/1/0; 0/0/0 | 50 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 133.00 |
| shield-1-granja | granja | 0/0/0/0/1; 0/0/0 | 40 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 88.75 |
| shield-2-granja | granja | 0/0/0/0/2; 0/0/0 | 80 | victory | 600.00 | 5.00 | 1.44 | 1 | 60.00 | 88.75 |
| shield-3-granja | granja | 0/0/0/0/3; 0/0/0 | 120 | victory | 600.00 | 5.00 | 1.44 | 1 | 60.00 | 88.75 |
| o2-2-granja | granja | 0/0/0/0/0; 2/0/0 | 30 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| o2-5-granja | granja | 0/0/0/0/0; 5/0/0 | 75 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| water-2-granja | granja | 0/0/0/0/0; 0/2/0 | 30 | victory | 600.00 | 8.00 | 14.40 | 1 | 60.00 | 88.75 |
| water-5-granja | granja | 0/0/0/0/0; 0/5/0 | 75 | victory | 600.00 | 8.00 | 14.40 | 1 | 60.00 | 88.75 |
| food-2-granja | granja | 0/0/0/0/0; 0/0/2 | 30 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| food-5-granja | granja | 0/0/0/0/0; 0/0/5 | 75 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 88.75 |
| mix-1-0-granja | granja | 0/1/0/0/1; 0/0/0 | 90 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-1-1-granja | granja | 0/1/1/0/1; 0/0/0 | 150 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-1-2-granja | granja | 0/1/2/0/1; 0/0/0 | 210 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-2-0-granja | granja | 0/2/0/0/1; 0/0/0 | 140 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-2-1-granja | granja | 0/2/1/0/1; 0/0/0 | 200 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-2-2-granja | granja | 0/2/2/0/1; 0/0/0 | 260 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-3-0-granja | granja | 0/3/0/0/1; 0/0/0 | 190 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| mix-3-1-granja | granja | 0/3/1/0/1; 0/0/0 | 250 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 0.00 |
| base-batería | batería | 0/0/0/0/0; 0/0/0 | 0 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| solarMasts-1-batería | batería | 1/0/0/0/0; 0/0/0 | 40 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| solarMasts-2-batería | batería | 2/0/0/0/0; 0/0/0 | 80 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| solarMasts-3-batería | batería | 3/0/0/0/0; 0/0/0 | 120 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| batteries-1-batería | batería | 0/1/0/0/0; 0/0/0 | 50 | victory | 600.00 | 5.00 | 14.40 | 2 | 60.00 | 0.00 |
| batteries-2-batería | batería | 0/2/0/0/0; 0/0/0 | 100 | victory | 600.00 | 5.00 | 14.40 | 2 | 60.00 | 0.00 |
| batteries-3-batería | batería | 0/3/0/0/0; 0/0/0 | 150 | victory | 600.00 | 5.00 | 14.40 | 2 | 60.00 | 0.00 |
| greenhouse-1-batería | batería | 0/0/1/0/0; 0/0/0 | 60 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 121.50 |
| greenhouse-2-batería | batería | 0/0/2/0/0; 0/0/0 | 120 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 132.25 |
| processor-1-batería | batería | 0/0/0/1/0; 0/0/0 | 50 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 137.50 |
| shield-1-batería | batería | 0/0/0/0/1; 0/0/0 | 40 | victory | 600.00 | 5.00 | 3.84 | 1 | 60.00 | 104.75 |
| shield-2-batería | batería | 0/0/0/0/2; 0/0/0 | 80 | victory | 600.00 | 5.00 | 1.44 | 1 | 60.00 | 104.75 |
| shield-3-batería | batería | 0/0/0/0/3; 0/0/0 | 120 | victory | 600.00 | 5.00 | 1.44 | 1 | 60.00 | 104.75 |
| o2-2-batería | batería | 0/0/0/0/0; 2/0/0 | 30 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| o2-5-batería | batería | 0/0/0/0/0; 5/0/0 | 75 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| water-2-batería | batería | 0/0/0/0/0; 0/2/0 | 30 | victory | 600.00 | 8.00 | 14.40 | 1 | 60.00 | 104.75 |
| water-5-batería | batería | 0/0/0/0/0; 0/5/0 | 75 | victory | 600.00 | 8.00 | 14.40 | 1 | 60.00 | 104.75 |
| food-2-batería | batería | 0/0/0/0/0; 0/0/2 | 30 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| food-5-batería | batería | 0/0/0/0/0; 0/0/5 | 75 | victory | 600.00 | 5.00 | 14.40 | 1 | 60.00 | 104.75 |
| mix-1-0-batería | batería | 0/1/0/0/1; 0/0/0 | 90 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-1-1-batería | batería | 0/1/1/0/1; 0/0/0 | 150 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-1-2-batería | batería | 0/1/2/0/1; 0/0/0 | 210 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 10.00 |
| mix-2-0-batería | batería | 0/2/0/0/1; 0/0/0 | 140 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-2-1-batería | batería | 0/2/1/0/1; 0/0/0 | 200 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-2-2-batería | batería | 0/2/2/0/1; 0/0/0 | 260 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-3-0-batería | batería | 0/3/0/0/1; 0/0/0 | 190 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |
| mix-3-1-batería | batería | 0/3/1/0/1; 0/0/0 | 250 | victory | 600.00 | 5.00 | 3.84 | 2 | 60.00 | 0.00 |

## API y lecturas para integración

`src/engine/index.ts` exporta tipos y STEP/SAMPLE_EVERY; SCENARIO_1/SCENARIO_SOURCE/PRICES/LIMITS/MISSION_RULES; emptyDesign/checkDesign/startMission; applyToGame/applyCommand; worldStep/project/replay; darknessAt/nextEvent/summarize.

HUD: ms.t, ms.phase, ms.game.res + capacity(ms.game), ms.lastPower, ms.exposure en u, ms.scenario, ms.events, ms.metrics y ms.ledger. No usar game.dose ni cyclePhase libres. lastPower.running distingue controles solicitados de sistemas realmente alimentados; demand incluye requisito vital aunque lifeSupportPowered sea false. Saturación de almacenamiento explica por qué generación − demanda no equivale siempre a variación de batería.

MissionLedger es diferencia acumulada desde inicio, no saldo: ledger[recurso][causa]. Se actualiza también en comandos. Sin sumar causas con unidades distintas. El campo es obligatorio en MissionState; B/C/D deben incorporar este contrato aprobado, sin fixtures anteriores ni tipos duplicados.

El integrador bloquea dispatch durante pausa/overlay y no llama worldStep mientras está pausado. MissionState no contiene pausa: motor no puede conocerla. applyCommand comprueba cierre y restricciones de refugio, registra aceptación/rechazo. Entradas no finitas rechazadas se canonizan a null dentro del log para conservar JSON/replay.

worldStep avanza 0.25 s. Para proyección, segundos finitos no negativos alineados a STEP; endOfDarkness usa siguiente final pendiente, o final de misión. Projection.until informa instante realmente alcanzado. project aplica plan ahora, incluye solo eventos nuevos y no presume acciones humanas futuras. replay valida tiempos alineados/orden/aceptación; procesa comandos al instante final solicitado.

Radio: consumir eventos nuevos por índice estable; no repetirlos por frame. Al sustituir estado tras inicio/reintento, reconstruir referencias de escena. Exposición didáctica no se convierte a mSv; fuente fija en SCENARIO_SOURCE y scenario.events[].inspiredBy.

## Lectura y límites

A y B ganan con configuraciones y gestión energética distintas; C pierde con motivo medido. Ningún ítem extra es necesario en todas las victorias de este barrido. Eso no demuestra ausencia de estrategia dominante: comparar costes, continuidad, cosechas y soporte mínimo requiere ponderar objetivos. Hay victorias de base sin compras: dificultad actual permisiva; calibración educativa con estudiantes pendiente.

Un solar extra mejora carga diurna; baterías sostienen oscuridad; cultivo aumenta rendimiento y demanda; procesador recupera O2 a cambio de energía y trabajo; berma reduce exposición solo bajo refugio. Reservas mejoran saldo inicial del recurso comprado. No hay bonificación invisible por diseño A/B.

Pausa/1x/2x/agrupación de frames requieren runner real del integrador. Navegador, teléfono, guardado libre y flujo completo no verificados desde carril A.
