import type { StandingRow } from '../../core/index.js';
import { useI18n } from '../../i18n/context.js';

interface StandingsTableProps {
  rows: StandingRow[];
  highlightTopCount?: number;
}

export function StandingsTable({ rows, highlightTopCount = 1 }: StandingsTableProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold tracking-wide text-stone-500 uppercase">
            <th className="px-3 py-3">{t.standings.pos}</th>
            <th className="px-3 py-3">{t.standings.player}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.gp}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.w}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.d}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.l}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.pts}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.winPct}</th>
            <th className="px-2.5 py-3 text-right">{t.standings.pf}</th>
            <th className="px-2.5 py-3 text-right">{t.standings.pa}</th>
            <th className="px-2.5 py-3 text-right">{t.standings.diff}</th>
            <th className="px-2.5 py-3 text-center">{t.standings.byes}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => {
            const isTop = row.rank <= highlightTopCount && row.gamesPlayed > 0;
            return (
              <tr
                key={row.participantId}
                className={
                  row.status !== 'active'
                    ? 'bg-stone-50/70 text-stone-400'
                    : isTop
                      ? 'bg-emerald-50/50 text-stone-900'
                      : 'text-stone-800 hover:bg-stone-50'
                }
              >
                <td className="px-3 py-2.5 font-bold">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs ${
                      row.rank === 1 && row.gamesPlayed > 0
                        ? 'bg-amber-400 text-stone-950'
                        : isTop
                          ? 'bg-emerald-800 text-white'
                          : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {row.rank}
                    {row.isTied ? '=' : ''}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-stone-400">
                      #{row.participantNumber}
                    </span>
                    <span className="font-semibold">{row.displayName}</span>
                    {row.status === 'eliminated' && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {t.standings.eliminatedBadge}
                      </span>
                    )}
                    {row.status === 'withdrawn' && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                        {t.standings.withdrawnBadge}
                      </span>
                    )}
                    {row.isSubstitute && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                        {t.standings.substituteBadge}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-2.5 text-center tabular-nums">{row.gamesPlayed}</td>
                <td className="px-2.5 py-2.5 text-center font-semibold text-emerald-700 tabular-nums">
                  {row.wins}
                </td>
                <td className="px-2.5 py-2.5 text-center text-stone-500 tabular-nums">
                  {row.draws}
                </td>
                <td className="px-2.5 py-2.5 text-center text-rose-600 tabular-nums">
                  {row.losses}
                </td>
                <td className="px-2.5 py-2.5 text-center font-bold tabular-nums">
                  {row.matchPoints}
                </td>
                <td className="px-2.5 py-2.5 text-center tabular-nums">
                  {(row.winRate * 100).toFixed(1)}%
                </td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{row.pointsFor}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{row.pointsAgainst}</td>
                <td
                  className={`px-2.5 py-2.5 text-right font-semibold tabular-nums ${
                    row.pointDiff > 0
                      ? 'text-emerald-700'
                      : row.pointDiff < 0
                        ? 'text-rose-600'
                        : 'text-stone-500'
                  }`}
                >
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </td>
                <td className="px-2.5 py-2.5 text-center tabular-nums">{row.byes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
