import type { ClosedContract, RawTrade } from './types';

const KEY_DELIMITER = ' ';

const bucketKey = (trade: RawTrade): string => `${trade.instrument}${KEY_DELIMITER}${trade.description}`;

function groupByContract(trades: readonly RawTrade[]): Map<string, RawTrade[]> {
  const buckets = new Map<string, RawTrade[]>();
  trades.forEach((trade) => {
    const key = bucketKey(trade);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(trade);
    } else {
      buckets.set(key, [trade]);
    }
  });
  return buckets;
}

function reduceBucket(bucket: readonly RawTrade[]): ClosedContract | null {
  let btoQty = 0;
  let stcQty = 0;
  let btoAmt = 0;
  let stcAmt = 0;
  let openDate: Date | null = null;
  let closeDate: Date | null = null;
  let tradeCount = 0;

  bucket.forEach((trade) => {
    if (trade.transCode === 'BTO') {
      btoQty += trade.quantity;
      btoAmt += trade.amount;
      tradeCount += 1;
      if (openDate === null || trade.activityDate < openDate) {
        openDate = trade.activityDate;
      }
    } else if (trade.transCode === 'STC') {
      stcQty += trade.quantity;
      stcAmt += trade.amount;
      tradeCount += 1;
      if (closeDate === null || trade.activityDate > closeDate) {
        closeDate = trade.activityDate;
      }
    }
  });

  if (btoQty === 0 || stcQty === 0 || openDate === null || closeDate === null) {
    return null;
  }

  const closedQty = Math.min(btoQty, stcQty);
  const costUsed = btoAmt * (closedQty / btoQty);
  const proceedsUsed = stcAmt * (closedQty / stcQty);
  const pl = costUsed + proceedsUsed;
  const costBasis = Math.abs(costUsed);
  const pctReturn = costBasis === 0 ? 0 : (pl / costBasis) * 100;

  const first = bucket[0];
  if (!first) return null;

  return {
    instrument: first.instrument,
    description: first.description,
    pl,
    pctReturn,
    closedQty,
    costBasis,
    proceeds: proceedsUsed,
    grossVolume: Math.abs(btoAmt) + Math.abs(stcAmt),
    closeDate,
    openDate,
    tradeCount,
  };
}

export function computeClosedContracts(trades: readonly RawTrade[]): ClosedContract[] {
  const buckets = groupByContract(trades);
  return Array.from(buckets.values())
    .map(reduceBucket)
    .filter((c): c is ClosedContract => c !== null);
}
