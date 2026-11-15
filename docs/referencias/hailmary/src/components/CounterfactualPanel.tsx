import { GitCompareArrows } from 'lucide-react';
import type { CounterfactualOutcome, CounterfactualResult } from '../engine/types';

const STATUS_LABEL: Record<CounterfactualOutcome['status'], string> = {
  in_progress: 'En curso',
  victory: 'Cumplida',
  failed: 'Fallida',
};

const FAILURE_LABEL: Record<string, string> = {
  oxygen_depleted: 'O₂ agotado',
  water_depleted: 'Agua agotada',
  food_depleted: 'Alimentos agotados',
  energy_depleted: 'Energía agotada',
  radiation_exceeded: 'Exposición excedida',
  final_thresholds_unmet: 'Umbrales finales incompletos',
};

function Outcome({ title, outcome }: { title: string; outcome: CounterfactualOutcome }) {
  return (
    <div className="cf-outcome">
      <span>{title}</span>
      <strong className={outcome.status === 'victory' ? 'is-victory' : 'is-failed'}>
        {STATUS_LABEL[outcome.status]}
      </strong>
      <span className="mono">Exposición {outcome.exposure} u</span>
      {outcome.failureCode && <span>{FAILURE_LABEL[outcome.failureCode] ?? outcome.failureCode}</span>}
      <span className="mono">{outcome.cyclesCompleted}/7 ciclos</span>
    </div>
  );
}

export function CounterfactualPanel({
  result,
  label,
}: {
  result: CounterfactualResult;
  label: string;
}) {
  if (!result.differs) return null;

  return (
    <section className="counterfactual" aria-labelledby="counterfactual-title">
      <div className="panel-heading">
        <div>
          <h2 id="counterfactual-title">¿Qué habría pasado?</h2>
          <p>
            Si en el ciclo {result.cycle} hubieras {label}, la misma secuencia de decisiones habría
            producido otro resultado.
          </p>
        </div>
        <span className="panel-tag">VERIFICADO POR EL MOTOR</span>
      </div>

      <div className="cf-body">
        <GitCompareArrows className="cf-icon" aria-hidden="true" />
        <div>
          <p className="cf-summary">{result.summary}</p>
          <div className="cf-compare">
            <Outcome title="Misión real" outcome={result.actual} />
            <Outcome title="Variante" outcome={result.alternative} />
          </div>
        </div>
      </div>
    </section>
  );
}
