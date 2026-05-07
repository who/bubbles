import type { ClosedContract, ClosedTicker } from './types';

function groupByInstrument(
  contracts: readonly ClosedContract[],
): Map<string, ClosedContract[]> {
  const buckets = new Map<string, ClosedContract[]>();
  contracts.forEach((c) => {
    const existing = buckets.get(c.instrument);
    if (existing) {
      existing.push(c);
    } else {
      buckets.set(c.instrument, [c]);
    }
  });
  return buckets;
}

function reduceTicker(
  instrument: string,
  bucket: readonly ClosedContract[],
): ClosedTicker {
  let pl = 0;
  let costBasis = 0;
  let closedQty = 0;
  let grossVolume = 0;
  let { openDate, closeDate } = bucket[0]!;

  bucket.forEach((c) => {
    pl += c.pl;
    costBasis += c.costBasis;
    closedQty += c.closedQty;
    grossVolume += c.grossVolume;
    if (c.openDate < openDate) openDate = c.openDate;
    if (c.closeDate > closeDate) closeDate = c.closeDate;
  });

  const pctReturn = costBasis === 0 ? 0 : (pl / costBasis) * 100;

  return {
    instrument,
    pl,
    pctReturn,
    closedQty,
    costBasis,
    grossVolume,
    contracts: bucket.length,
    closeDate,
    openDate,
  };
}

export function computeClosedTickers(
  contracts: readonly ClosedContract[],
): ClosedTicker[] {
  const buckets = groupByInstrument(contracts);
  return Array.from(buckets.entries()).map(([instrument, bucket]) => reduceTicker(instrument, bucket));
}
