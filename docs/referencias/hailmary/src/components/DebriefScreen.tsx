import { buildCounterfactual, buildDebrief } from '../engine/simulation';
import { RESOURCE_LABELS } from '../data/scenario';
import type { AttemptSummary, SimulationState } from '../engine/types';
import { ResourceChart } from './ResourceChart';
import { MissionPatch } from './MissionPatch';
import { DecisionTimeline } from './DecisionTimeline';
import { CounterfactualPanel } from './CounterfactualPanel';

export function DebriefScreen({
  state,
  previousAttempts,
  onRetry,
}: {
  state: SimulationState;
  previousAttempts: AttemptSummary[];
  onRetry: () => void;
}) {
  const report = buildDebrief(state);
  const counterfactual = buildCounterfactual(state, 4, { protection: 'normal' });
  const currentStatus = state.status === 'victory' ? 'victory' : 'failed';
  const currentAttempt: AttemptSummary = {
    attemptNumber: state.attemptNumber,
    status: currentStatus,
    cyclesCompleted: state.history.length,
    finalResources: state.resources,
    harvestsCompleted: state.harvestsCompleted,
  };
  const attempts = [...previousAttempts, currentAttempt].slice(-4);

  return (
    <>
      <section className={`debrief-hero debrief-hero-${currentStatus}`}>
        <div className="debrief-hero-top">
          <MissionPatch size={52} />
          <span className="debrief-kicker">
            INFORME DE MISIÓN · INTENTO #{state.attemptNumber}
          </span>
        </div>
        <span className="debrief-status">
          {currentStatus === 'victory' ? 'MISIÓN CUMPLIDA' : 'MISIÓN FALLIDA'}
        </span>
        <h1>{report.headline}</h1>
        <p className="intro">{report.summary}</p>
        <ul className="debrief-chips" aria-label="Recursos finales">
          {(Object.keys(RESOURCE_LABELS) as Array<keyof typeof RESOURCE_LABELS>).map((key) => (
            <li key={key}>
              <span>{RESOURCE_LABELS[key]}</span>
              <strong>{state.resources[key]} u</strong>
            </li>
          ))}
        </ul>
      </section>

      <DecisionTimeline state={state} />

      {counterfactual && (
        <CounterfactualPanel result={counterfactual} label="operado sin refugio" />
      )}

      <ResourceChart state={state} />

      <div className="assessments">
        {report.assessments.map((item) => (
          <section key={item.id}>
            <h2>{item.title}</h2>
            <strong className={`debrief-rating debrief-rating-${item.rating}`}>
              {({ optimal: 'Óptimo', adequate: 'Adecuado', critical: 'Crítico' })[item.rating]}
            </strong>
            <p>{item.finding}</p>
            <p>{item.scientificExplanation}</p>
            <a href={item.source.url} target="_blank" rel="noreferrer">
              {item.source.title} ↗
            </a>
          </section>
        ))}
      </div>

      <section className="attempts" aria-labelledby="attempts-title">
        <div className="panel-heading">
          <div>
            <h2 id="attempts-title">Comparativa de intentos</h2>
            <p>Últimos intentos terminados. Los valores son unidades didácticas.</p>
          </div>
          <span className="panel-tag">HISTORIAL</span>
        </div>
        <div className="table-scroll">
          <table className="attempts-table">
            <thead>
              <tr>
                <th scope="col">Intento</th>
                <th scope="col">Resultado</th>
                <th scope="col">Ciclos</th>
                <th scope="col">O₂</th>
                <th scope="col">Agua</th>
                <th scope="col">Alim.</th>
                <th scope="col">Energía</th>
                <th scope="col">Exposición</th>
                <th scope="col">Cosechas</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => {
                const isCurrent = attempt.attemptNumber === state.attemptNumber;
                return (
                  <tr key={attempt.attemptNumber} className={isCurrent ? 'is-current' : undefined}>
                    <th scope="row">#{attempt.attemptNumber}</th>
                    <td>{attempt.status === 'victory' ? 'Cumplida' : 'Fallida'}</td>
                    <td className="mono">{attempt.cyclesCompleted}/7</td>
                    <td className="mono">{attempt.finalResources.oxygen}</td>
                    <td className="mono">{attempt.finalResources.water}</td>
                    <td className="mono">{attempt.finalResources.food}</td>
                    <td className="mono">{attempt.finalResources.energy}</td>
                    <td className="mono">{attempt.finalResources.exposure}</td>
                    <td className="mono">{attempt.harvestsCompleted}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="debrief-actions">
        <button className="primary" onClick={onRetry}>
          Reintentar misión
        </button>
      </div>
    </>
  );
}
