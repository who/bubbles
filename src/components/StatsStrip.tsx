import type { Summary } from '../pnl/types.ts';
import {
  DASH,
  formatCompactCurrency,
  formatPercent,
  formatRatio,
  formatRewardRisk,
  formatSignedCurrency,
  formatSignedPercent,
} from './format.ts';
import './StatsStrip.css';

export interface StatsStripProps {
  summary: Summary;
}

interface Tile {
  label: string;
  primary: string;
  sub: string;
}

const buildTiles = (summary: Summary): Tile[] => {
  const empty = summary.totalClosed === 0;

  const gainSubText = `${formatCompactCurrency(summary.totalGain)} ÷ ${formatCompactCurrency(summary.totalLoss)}`;
  const winSubText = `${summary.winnersCount} W · ${summary.losersCount} L`;
  const closedSubText = `${summary.totalClosed} closed positions`;
  const rrSubText = `Reward:risk ${formatRewardRisk(summary.avgWin, summary.avgLoss)}`;
  const labelSubText = 'winners / losers';

  if (empty) {
    return [
      { label: 'Gain/Loss Ratio', primary: DASH, sub: gainSubText },
      { label: 'Total Realized P/L', primary: DASH, sub: closedSubText },
      { label: 'Win Rate', primary: DASH, sub: winSubText },
      { label: 'Avg Win / Avg Loss', primary: DASH, sub: rrSubText },
      { label: 'Avg % Return', primary: DASH, sub: labelSubText },
    ];
  }

  return [
    {
      label: 'Gain/Loss Ratio',
      primary: formatRatio(summary.glRatio),
      sub: gainSubText,
    },
    {
      label: 'Total Realized P/L',
      primary: formatSignedCurrency(summary.totalPl),
      sub: closedSubText,
    },
    {
      label: 'Win Rate',
      primary: formatPercent(summary.winRate, 1),
      sub: winSubText,
    },
    {
      label: 'Avg Win / Avg Loss',
      primary: `${formatCompactCurrency(summary.avgWin)} / ${formatCompactCurrency(summary.avgLoss)}`,
      sub: rrSubText,
    },
    {
      label: 'Avg % Return',
      primary: `${formatSignedPercent(summary.avgPctWin, 1)} / ${formatSignedPercent(summary.avgPctLoss, 1)}`,
      sub: labelSubText,
    },
  ];
};

function StatsStrip({ summary }: StatsStripProps) {
  const tiles = buildTiles(summary);

  return (
    <div className="stats-strip">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="stats-strip__tile"
          role="region"
          aria-label={tile.label}
        >
          <p className="stats-strip__label">{tile.label}</p>
          <p className="stats-strip__primary">{tile.primary}</p>
          <p className="stats-strip__sub">{tile.sub}</p>
        </div>
      ))}
    </div>
  );
}

export default StatsStrip;
