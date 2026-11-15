import { SystemMap } from './SystemMap';

export function BriefingScreen({
  onStart,
  onContinue,
  continueLabel = 'Continuar misión guardada',
}: {
  onStart: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  return (
    <section className="briefing">
      <div className="briefing-hero">
        <picture>
          <source srcSet="/images/lunar-south-pole.webp" type="image/webp" />
          <img
            src="/images/lunar-south-pole.jpg"
            alt="Vista del polo sur lunar con cráteres y sombras permanentes"
          />
        </picture>
        <div className="briefing-hero-shade" aria-hidden="true" />
        <div className="briefing-hero-content">
          <span className="briefing-kicker">NASA SPACE APPS 2026 · LIFE PLANTS</span>
          <h1>
            Una base lunar.
            <br />
            Cada decisión cuenta.
          </h1>
          <p className="intro">
            Sos el flight director de Lunar Outpost Alpha. Dos tripulantes, siete ciclos y un
            entorno que no perdona improvisaciones.
          </p>
          <ul className="hero-chips" aria-label="Resumen de la misión">
            <li>2 tripulantes</li>
            <li>7 ciclos</li>
            <li>5–8 minutos</li>
          </ul>
          <div className="actions">
            {onContinue && (
              <button className="secondary" onClick={onContinue}>
                {continueLabel}
              </button>
            )}
            <button className={onContinue ? '' : 'primary'} onClick={onStart}>
              Iniciar simulación
            </button>
          </div>
        </div>
        <p className="image-credit">Polo sur lunar: NASA/GSFC/Arizona State University</p>
      </div>

      <div className="briefing-body">
        <ol className="briefing-steps" aria-label="Bucle de juego">
          <li>
            <span>01</span>
            <strong>Configurá</strong>
            <p>Elegí soporte vital, cultivo y protección para el ciclo.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Verificá</strong>
            <p>Revisá la proyección y el balance antes de comprometer recursos.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Ejecutá</strong>
            <p>Leé la consecuencia científica y ajustá el ciclo siguiente.</p>
          </li>
        </ol>

        <div className="briefing-columns">
          <SystemMap />
          <div className="briefing-pillars">
            <h2>Cuatro restricciones, una base</h2>
            <dl className="pillars">
              <div>
                <dt>Oxígeno y agua</dt>
                <dd>La electrólisis produce O₂, pero consume agua y energía.</dd>
              </div>
              <div>
                <dt>Energía</dt>
                <dd>Solar +19 u por ciclo; mantenimiento en ciclo 6: solo +7 u.</dd>
              </div>
              <div>
                <dt>Alimentos</dt>
                <dd>Dos ciclos de cultivo entregan +32 u. La latencia conserva progreso y cuesta 2 u.</dd>
              </div>
              <div>
                <dt>Radiación</dt>
                <dd>Evento SPE en ciclo 4: +35 u sin refugio, +8 u con refugio. Límite: 40 u (GCR de fondo: +3 u/ciclo).</dd>
              </div>
            </dl>
          </div>
        </div>

        <details className="technical-dossier">
          <summary>Dossier técnico: reglas y umbrales</summary>
          <div className="dossier-grid">
            <div>
              <h3>Al cerrar el ciclo 7</h3>
              <ul>
                <li>Oxígeno ≥ 15 u</li>
                <li>Agua ≥ 15 u</li>
                <li>Alimentos ≥ 8 u</li>
                <li>Energía ≥ 10 u</li>
                <li>Exposición ≤ 40 u</li>
              </ul>
            </div>
            <div>
              <h3>Orden de la simulación</h3>
              <p>
                Solar → consumo basal → supervivencia → subsistemas → cosecha → radiación. La
                tripulación consume antes de producir: una cosecha tardía no rescata reservas
                agotadas.
              </p>
            </div>
            <div>
              <h3>Límites operativos</h3>
              <p>
                Capacidad máxima: 100 u por reserva. Refugio + Electrólisis Intensiva + Cultivo
                Activo no pueden operar juntos. Las cifras son unidades didácticas, no dosis
                médicas.
              </p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
