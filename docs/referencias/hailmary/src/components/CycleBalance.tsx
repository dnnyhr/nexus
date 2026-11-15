import { RESOURCE_LABELS } from '../data/scenario';
import type { CycleBreakdown, CycleBreakdownEntry } from '../engine/types';

const CONTRIBUTION_LABELS = {
  solar: 'Solar',
  crew: 'Tripulación',
  eclss: 'ECLSS',
  greenhouse: 'Invernadero',
  protection: 'Refugio',
  harvest: 'Cosecha',
  radiation: 'Radiación',
} as const;

type ContributionKey = keyof typeof CONTRIBUTION_LABELS;

function contributions(row: CycleBreakdownEntry): Array<{ key: ContributionKey; value: number }> {
  return (Object.keys(CONTRIBUTION_LABELS) as ContributionKey[])
    .map((key) => ({ key, value: row[key] }))
    .filter((item) => item.value !== 0);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function CycleBalance({
  breakdown,
  cycle,
}: {
  breakdown: CycleBreakdown;
  cycle: number;
}) {
  return (
    <section className="cycle-balance" aria-labelledby="balance-title">
      <div className="panel-heading">
        <div>
          <h2 id="balance-title">Balance del ciclo {cycle}</h2>
          <p>Proyección antes de ejecutar. Cada unidad asignada compite con el resto de la base.</p>
        </div>
        <span className="panel-tag">PROYECCIÓN</span>
      </div>

      <div className="table-scroll">
        <table className="balance-table">
          <thead>
            <tr>
              <th scope="col">Recurso</th>
              <th scope="col">Inicio</th>
              <th scope="col">Contribuciones del ciclo</th>
              <th scope="col">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{RESOURCE_LABELS[row.key]}</th>
                <td className="mono">{row.start}</td>
                <td>
                  <span className="balance-chips">
                    {contributions(row).length === 0 ? (
                      <span className="balance-chip neutral">Sin cambios</span>
                    ) : (
                      contributions(row).map(({ key, value }) => (
                        <span
                          key={key}
                          className={`balance-chip ${
                            row.key === 'exposure'
                              ? 'danger'
                              : value > 0
                                ? 'positive'
                                : 'negative'
                          }`}
                        >
                          {CONTRIBUTION_LABELS[key]} {signed(value)}
                        </span>
                      ))
                    )}
                  </span>
                </td>
                <td className="mono">
                  {row.end}
                  <span className={`balance-net ${row.net > 0 ? 'positive' : row.net < 0 ? 'negative' : ''}`}>
                    {signed(row.net)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="balance-note">
        {breakdown.willHarvest
          ? 'Este ciclo completa la cosecha: +32 u de alimentos antes del cierre.'
          : 'La cosecha requiere dos ciclos de cultivo activo. La latencia conserva el progreso.'}{' '}
        Los topes de 100 u pueden absorber parte del cambio.
      </p>
    </section>
  );
}
