import type { ClosedContract, Summary } from './types';

export function computeSummary(
  contracts: readonly ClosedContract[],
  parseWarnings: readonly string[] = [],
): Summary {
  let totalPl = 0;
  let totalGain = 0;
  let totalLoss = 0;
  let winnersCount = 0;
  let losersCount = 0;
  let sumWin = 0;
  let sumLoss = 0;
  let sumPctWin = 0;
  let sumPctLoss = 0;
  const uniqueInstruments = new Set<string>();

  contracts.forEach((c) => {
    totalPl += c.pl;
    uniqueInstruments.add(c.instrument);
    if (c.pl > 0) {
      totalGain += c.pl;
      winnersCount += 1;
      sumWin += c.pl;
      sumPctWin += c.pctReturn;
    } else {
      // Zero-pl ties counted as losers per PRD §6.3 silent default.
      totalLoss += Math.abs(c.pl);
      losersCount += 1;
      sumLoss += c.pl;
      sumPctLoss += c.pctReturn;
    }
  });

  const totalClosed = contracts.length;
  const glRatio = totalLoss > 0 ? totalGain / totalLoss : null;
  const winRate = totalClosed > 0 ? (winnersCount / totalClosed) * 100 : 0;
  const avgWin = winnersCount > 0 ? sumWin / winnersCount : 0;
  const avgLoss = losersCount > 0 ? sumLoss / losersCount : 0;
  const avgPctWin = winnersCount > 0 ? sumPctWin / winnersCount : 0;
  const avgPctLoss = losersCount > 0 ? sumPctLoss / losersCount : 0;

  return {
    totalPl,
    totalGain,
    totalLoss,
    glRatio,
    winnersCount,
    losersCount,
    totalClosed,
    winRate,
    avgWin,
    avgLoss,
    avgPctWin,
    avgPctLoss,
    uniqueTickers: uniqueInstruments.size,
    parseWarnings: [...parseWarnings],
  };
}
