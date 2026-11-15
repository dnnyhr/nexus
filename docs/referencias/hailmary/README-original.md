# NEXUS: Último Horizonte

Simulador educativo determinista: dos tripulantes, siete ciclos en Lunar Outpost Alpha. Elegí soporte vital, cultivo y protección; observá consecuencias proyectadas antes de ejecutar. El debrief explica decisiones con fuentes NASA y compara intentos terminados.

Proyecto independiente, no afiliado a NASA. Todos los números son unidades didácticas de simulación, nunca dosis médicas ni mSv. Los ciclos no representan días reales. La conservación del cultivo en latencia es una simplificación pedagógica.

## English summary

NEXUS is a deterministic lunar operations learning simulator for students aged 13–18. Players balance oxygen, water, food, energy and radiation exposure over seven cycles. Live projections reveal trade-offs; a scientific debrief links decisions to NASA sources. Independent project, not affiliated with NASA. All quantities are fictional educational units, not operational predictions or medical doses.

## Ejecución

Node.js compatible con Vite 7 (22.12+ recomendado).

```sh
npm install
npm test
npm run dev
npm run build
npm run preview
```

Preview: http://localhost:4173. Publicación estática: comando `npm run build`, directorio `dist`. No requiere backend ni credenciales. La sesión v2 se valida contra el historial determinista; payloads inválidos o sin versión se descartan. Se guarda en localStorage de este navegador y origen; no se sincroniza entre dispositivos. Reiniciar una misión activa solicita confirmación; reintentar una misión terminada conserva su resumen.

## Modelo V1.0

Orden: Solar → consumo basal → supervivencia inmediata → subsistemas → cosecha → radiación → validación final. Falta de reservas para consumo basal termina la misión antes de producir. Reservas limitadas a 0–100; exposición tiene límite de fracaso >40.

| Regla | Efecto en unidades didácticas |
|---|---|
| Inicio | O₂ 51, agua 77, alimentos 44, energía 70, exposición 0 |
| Consumo basal | O₂ −11, agua −6, alimentos −8, energía −7 |
| Solar | +19 energía; ciclo 6: +7 |
| Reciclaje nominal | +4 O₂, +3 agua, −9 energía |
| Electrólisis intensiva | +18 O₂, −8 agua, −19 energía |
| Cultivo activo | −7 agua, −13 energía; segundo ciclo activo: +32 alimentos |
| Latencia | −2 energía; conserva progreso |
| Refugio | −10 energía |
| Radiación | GCR de fondo +3; ciclo 4 evento SPE: +35 normal o +8 refugio |
| Combinación bloqueada | Refugio + electrólisis intensiva + cultivo activo |
| Cierre ciclo 7 | O₂ ≥15, agua ≥15, alimentos ≥8, energía ≥10, exposición ≤40 |

También se bloquean combinaciones cuya demanda de subsistemas exceda reservas disponibles.

## Fuentes NASA

Consultadas el 13 de noviembre de 2026. Respaldan conceptos; no validan los coeficientes del juego.

- [ECLSS](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/)
- [Space Radiation Element](https://www.nasa.gov/reference/about-the-space-radiation-element/)
- [NASA Langley: Radiation Analysis and Shielding Design](https://ddtrb.larc.nasa.gov/radiation/)
- [Growing Plants in Space](https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/)
- [Challenges of Growing Plants in Space](https://science.nasa.gov/biological-physical/the-challenges-of-growing-plants-in-space/)
- [Moon Base Systems](https://www.nasa.gov/moonbase-systems/)

## QA reproducible

Estrategia ganadora (ECLSS / cultivo / protección):

1. Nominal / espera / normal.
2. Intensiva / espera / normal.
3. Nominal / activo / normal.
4. Nominal / latencia / refugio.
5. Nominal / activo / normal.
6. Nominal / espera / normal.
7. Nominal / espera / normal.

Resultado: 16 / 31 / 20 / 23 / 26; una cosecha. Para derrota por radiación, ejecutar cuatro ciclos nominales sin refugio: exposición 44.

Verificado: 21 pruebas Vitest y build TypeScript/Vite. Smoke automatizado en Chromium headless (1440×900 y 390×844): briefing y misión sin overflow horizontal ni errores de consola; partida ganadora completa (7 ciclos) hasta debrief con contrafactual y timeline. Pendiente validación humana final en dispositivo/red externa: recarga antes de ciclo 4, sesión corrupta, Tab/Enter, contraste auditado y verificación de la URL pública desde otra red.

## Entrega y respaldo

URL pública: https://nexus-ultimo-horizonte.netlify.app (Netlify, estático desde `dist`, sin credenciales). Redesplegar con `npm ci && npm test && npm run build` y carga del directorio `dist`. La ficha Space Apps y la hora límite local siguen pendientes de confirmación con los organizadores; no se ha enviado una entrega oficial.

Respaldo offline: conservar repositorio, dependencias instaladas y `dist`; ejecutar preview antes de desconectar internet. Tipografías externas usan fallback sin conexión. Fuentes NASA requieren internet. Video 1080p, capturas y copia USB pendientes de grabación.

## Pitch de 90 segundos

- 0:00–0:15: «Los estudiantes aprenden ingeniería lunar tomando decisiones bajo restricciones. NEXUS permite observar sus consecuencias antes de ejecutarlas».
- 0:15–0:30: mostrar briefing: dos tripulantes, siete ciclos, cuatro pilares.
- 0:30–1:05: ejecutar C1; mostrar electrólisis y ejecutar C2; activar cultivo C3. En C4 demostrar combinación bloqueada; volver a nominal, latencia y refugio. Explicar coste de protección. Completar C5–7 con secuencia de QA.
- 1:05–1:25: mostrar resultado, gráfico y evaluaciones; abrir fuente ECLSS o Langley. Aclarar unidades didácticas.
- 1:25–1:30: «NEXUS convierte compromisos de ingeniería espacial en una práctica STEM medible y accesible».

Guion preparado; duración real y fluidez pendientes de ensayo cronometrado. Congelar funcionalidades antes de ensayo final.

## Ejecución del plan técnico

Baseline y estabilidad previos conservados: `89d60c8` (tag `mvp-baseline`), `e467557`, `1fa5d9a`, `a48627d`. Sobre esa base se recuperaron las mejoras de mayor impacto de Fase 2 y Fase 3 sin tocar el modelo matemático:

- Motor (vistas derivadas con test): `getCycleBreakdown` y `buildCounterfactual` (replay verificado; C4 sin refugio → exposición 44 y fallo por radiación).
- Mission Control: barra de mando, stepper de 7 ciclos, alertas dinámicas (C3/C4/C6), panel de balance proyectado, checklist de preparación/cierre, panel de radiación destacado en ventana de tormenta y barra de ejecución con viabilidad.
- Briefing: hero lunar con crédito NASA, bucle de 3 pasos, mapa de sistemas SVG y dossier técnico colapsable.
- Debrief: resultado, timeline de decisiones, contrafactual verificado por el motor, ratings semánticos y comparativa de intentos.
- Fix de estabilidad: reset de scroll/foco al cambiar de ciclo y actualización parcial de subsistemas para no perder configuración.

P1/P2 no ejecutados. Modelo matemático y copy científico intactos.

### Deploy

URL pública: https://nexus-ultimo-horizonte.netlify.app (Netlify, directorio `dist`). Redesplegar:

```sh
npm ci
npm test
npm run build
# subir dist (Vercel, Netlify Drop o CLI autenticada)
```

### Checklist de QA

- [x] 21 tests: motor (incluye `survivalWarning`, `getCycleBreakdown`, contrafactual C4) y persistencia v2.
- [x] TypeScript y build Vite limpios.
- [x] Modelo conserva victoria exacta 16 / 31 / 20 / 23 / 26.
- [x] Smoke automatizado (Chromium headless, 1440 y 390 px): sin overflow ni errores de consola; partida ganadora completa hasta debrief.
- [x] URL pública publicada.
- [ ] Validación humana: recarga C3, payload corrupto, C4 refugio → C5 nominal/espera/normal, error boundary en dev.
- [ ] QA desde otro dispositivo/red, teclado Tab/Enter, contraste auditado.
- [ ] Video 1080p, dos ensayos cronometrados, ficha Space Apps enviada.

`npm ci` reportó 3 vulnerabilidades de dependencias (1 moderada, 2 críticas); no se aplicó actualización automática ni cambio de dependencias.

### Créditos

NEXUS: Último Horizonte, equipo LifePlants. Referencias científicas: NASA y NASA Langley, enlaces arriba. Imagen del briefing: “The Lunar South Pole” (PIA13523), NASA/GSFC/Arizona State University — usada con crédito en pantalla. Tipografías existentes: Inter y JetBrains Mono (con fallback). Iconos: Lucide. Favicon y parche de misión SVG propios del proyecto, sin logo NASA.

Definition of Done pendiente: QA humano final en red/dispositivo externo, video, ensayos y entrega oficial.
