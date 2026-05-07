import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import StatsStrip from './StatsStrip.tsx';
import type { Summary } from '../pnl/types.ts';

const baseSummary: Summary = {
  totalPl: 1234.56,
  totalGain: 4800,
  totalLoss: 1200,
  glRatio: 4,
  winnersCount: 3,
  losersCount: 1,
  totalClosed: 4,
  winRate: 75,
  avgWin: 1600,
  avgLoss: -1200,
  avgPctWin: 5.5,
  avgPctLoss: -3.2,
  uniqueTickers: 2,
  parseWarnings: [],
};

const emptySummary: Summary = {
  totalPl: 0,
  totalGain: 0,
  totalLoss: 0,
  glRatio: null,
  winnersCount: 0,
  losersCount: 0,
  totalClosed: 0,
  winRate: Number.NaN,
  avgWin: Number.NaN,
  avgLoss: Number.NaN,
  avgPctWin: Number.NaN,
  avgPctLoss: Number.NaN,
  uniqueTickers: 0,
  parseWarnings: [],
};

const tileNames = [
  'Gain/Loss Ratio',
  'Total Realized P/L',
  'Win Rate',
  'Avg Win / Avg Loss',
  'Avg % Return',
] as const;

describe('StatsStrip', () => {
  test('AC1: renders 5 tiles in a horizontal flex row', () => {
    const { container } = render(<StatsStrip summary={baseSummary} />);
    const strip = container.querySelector('.stats-strip');
    expect(strip).not.toBeNull();
    const tiles = container.querySelectorAll('.stats-strip__tile');
    expect(tiles).toHaveLength(5);
    tileNames.forEach((name) => {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    });
  });

  test('AC2: each card has uppercase label, primary value (22px class), sub-text', () => {
    const { container } = render(<StatsStrip summary={baseSummary} />);
    const tiles = container.querySelectorAll('.stats-strip__tile');
    tiles.forEach((tile) => {
      expect(tile.querySelector('.stats-strip__label')).not.toBeNull();
      expect(tile.querySelector('.stats-strip__primary')).not.toBeNull();
      expect(tile.querySelector('.stats-strip__sub')).not.toBeNull();
    });
  });

  test('AC3: Gain/Loss Ratio formats glRatio to 2 decimals with compact sub-text', () => {
    render(<StatsStrip summary={baseSummary} />);
    const tile = screen.getByRole('region', { name: 'Gain/Loss Ratio' });
    expect(within(tile).getByText('4.00')).toBeInTheDocument();
    expect(within(tile).getByText('$4.8K ÷ $1.2K')).toBeInTheDocument();
  });

  test('AC3: Total Realized P/L formats as ±$N,NNN.NN with closed-positions sub-text', () => {
    render(<StatsStrip summary={baseSummary} />);
    const tile = screen.getByRole('region', { name: 'Total Realized P/L' });
    expect(within(tile).getByText('+$1,234.56')).toBeInTheDocument();
    expect(within(tile).getByText('4 closed positions')).toBeInTheDocument();
  });

  test('AC3: negative totalPl shows -$N,NNN.NN', () => {
    const summary: Summary = { ...baseSummary, totalPl: -987.65 };
    render(<StatsStrip summary={summary} />);
    const tile = screen.getByRole('region', { name: 'Total Realized P/L' });
    expect(within(tile).getByText('-$987.65')).toBeInTheDocument();
  });

  test('AC3: Win Rate formats as N.N% with W·L sub-text', () => {
    render(<StatsStrip summary={baseSummary} />);
    const tile = screen.getByRole('region', { name: 'Win Rate' });
    expect(within(tile).getByText('75.0%')).toBeInTheDocument();
    expect(within(tile).getByText('3 W · 1 L')).toBeInTheDocument();
  });

  test('AC3: Avg Win / Avg Loss formats as compact pair with reward:risk sub-text', () => {
    render(<StatsStrip summary={baseSummary} />);
    const tile = screen.getByRole('region', { name: 'Avg Win / Avg Loss' });
    expect(within(tile).getByText('$1.6K / -$1.2K')).toBeInTheDocument();
    expect(within(tile).getByText('Reward:risk 1.33×')).toBeInTheDocument();
  });

  test('AC3: Avg % Return formats as signed pair with winners/losers label', () => {
    render(<StatsStrip summary={baseSummary} />);
    const tile = screen.getByRole('region', { name: 'Avg % Return' });
    expect(within(tile).getByText('+5.5% / -3.2%')).toBeInTheDocument();
    expect(within(tile).getByText('winners / losers')).toBeInTheDocument();
  });

  test('AC4: empty summary renders — for every primary value', () => {
    render(<StatsStrip summary={emptySummary} />);
    tileNames.forEach((name) => {
      const tile = screen.getByRole('region', { name });
      const primary = tile.querySelector('.stats-strip__primary');
      expect(primary?.textContent).toBe('—');
    });
  });

  test('zero-loss winners-only summary: glRatio null shows — but sub-text still renders', () => {
    const summary: Summary = {
      ...baseSummary,
      totalGain: 1000,
      totalLoss: 0,
      glRatio: null,
      losersCount: 0,
      winnersCount: 4,
      avgLoss: Number.NaN,
      avgPctLoss: Number.NaN,
    };
    render(<StatsStrip summary={summary} />);
    const tile = screen.getByRole('region', { name: 'Gain/Loss Ratio' });
    expect(within(tile).getByText('—')).toBeInTheDocument();
    expect(within(tile).getByText('$1K ÷ $0')).toBeInTheDocument();
  });
});
