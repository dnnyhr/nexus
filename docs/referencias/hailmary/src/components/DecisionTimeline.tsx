import type { CycleDecision, SimulationState } from '../engine/types';

const ECLSS_LABEL: Record<CycleDecision['eclss'], string> = {
  nominal: 'Reciclaje nominal',
  intensive: 'Electrólisis intensiva',
};

const GREENHOUSE_LABEL: Record<CycleDecision['greenhouse'], string> = {
  standby: 'Latencia',
  active: 'Cultivo activo',
};

const PROTECTION_LABEL: Record<CycleDecision['protection'], string> = {
  normal: 'Operación normal',
  shelter: 'Refugio',
};

export function DecisionTimeline({ state }: { state: SimulationState }) {
  return (
    <section className="decision-timeline" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <h2 id="timeline-title">Línea de decisiones</h2>
          <p>Las siete decisiones que llevaron al resultado. Los pivotes científicos están marcados.</p>
        </div>
        <span className="panel-tag">7 CICLOS</span>
      </div>

      <ol className="timeline-list">
        {Array.from({ length: 7 }, (_, index) => {
          const cycle = index + 1;
          const entry = state.history.find((item) => item.cycle === cycle);
          const isStorm = cycle === 4;
          const isFailure = state.failure?.cycle === cycle;
          return (
            <li
              key={cycle}
              className={`${entry ? 'is-recorded' : 'is-pending'} ${isStorm ? 'is-storm' : ''} ${
                isFailure ? 'is-failure' : ''
              }`}
            >
              <span className="timeline-cycle">C{cycle}</span>
              {entry ? (
                <div className="timeline-body">
                  <strong>
                    {ECLSS_LABEL[entry.decision.eclss]} · {GREENHOUSE_LABEL[entry.decision.greenhouse]}
                  </strong>
                  <span>
                    {PROTECTION_LABEL[entry.decision.protection]} · Radiación +{entry.radiationDelta} u
                    {entry.harvested ? ' · Cosecha +32 u' : ''}
                  </span>
                </div>
              ) : (
                <div className="timeline-body">
                  <strong>Sin decisión registrada</strong>
                  <span>La misión no alcanzó este ciclo.</span>
                </div>
              )}
              {isStorm && <span className="timeline-flag">Tormenta</span>}
              {isFailure && <span className="timeline-flag timeline-flag-failure">Fallo</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
