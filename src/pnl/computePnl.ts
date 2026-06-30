import type {
  ClosedContract, OpenPosition, RawTrade, UnrealizedPosition,
} from './types';

const KEY_DELIMITER = ' ';

// Each option contract controls 100 shares; marks are quoted per share.
const OPTIONS_MULTIPLIER = 100;

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
  let oexpQty = 0;
  let btoAmt = 0;
  let stcAmt = 0;
  let openDate: Date | null = null;
  let closeDate: Date | null = null;
  let expireDate: Date | null = null;
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
    } else if (trade.transCode === 'OEXP') {
      oexpQty += trade.quantity;
      if (expireDate === null || trade.activityDate > expireDate) {
        expireDate = trade.activityDate;
      }
    }
  });

  if (btoQty === 0 || openDate === null) {
    return null;
  }

  const first = bucket[0];
  if (!first) return null;

  // Sold to close (possibly partial). This is the realized-P&L path; an OEXP
  // sharing the bucket is ignored because the sale already closed the long.
  if (stcQty > 0 && closeDate !== null) {
    const closedQty = Math.min(btoQty, stcQty);
    const costUsed = btoAmt * (closedQty / btoQty);
    const proceedsUsed = stcAmt * (closedQty / stcQty);
    const pl = costUsed + proceedsUsed;
    const costBasis = Math.abs(costUsed);
    const pctReturn = costBasis === 0 ? 0 : (pl / costBasis) * 100;

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

  // Expired worthless: a long that was never sold and an OEXP row retired it.
  // No cash comes back, so the entire cost basis is lost — proceeds $0,
  // pl = -costBasis, pctReturn -100%.
  if (oexpQty > 0 && expireDate !== null) {
    const pl = btoAmt;
    const costBasis = Math.abs(btoAmt);
    const pctReturn = costBasis === 0 ? 0 : (pl / costBasis) * 100;

    return {
      instrument: first.instrument,
      description: first.description,
      pl,
      pctReturn,
      closedQty: btoQty,
      costBasis,
      proceeds: 0,
      grossVolume: Math.abs(btoAmt),
      closeDate: expireDate,
      openDate,
      tradeCount: tradeCount + 1,
    };
  }

  return null;
}

export function computeClosedContracts(trades: readonly RawTrade[]): ClosedContract[] {
  const buckets = groupByContract(trades);
  return Array.from(buckets.values())
    .map(reduceBucket)
    .filter((c): c is ClosedContract => c !== null);
}

// Surface the still-open remainder of a contract bucket. Mirrors reduceBucket's
// bookkeeping but keeps the un-closed quantity instead of discarding it:
// openQty = BTO qty minus everything that has already closed it (STC + OEXP).
// Returns null when nothing remains open.
function reduceOpenBucket(bucket: readonly RawTrade[]): OpenPosition | null {
  let btoQty = 0;
  let stcQty = 0;
  let oexpQty = 0;
  let btoAmt = 0;
  let openDate: Date | null = null;
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
      tradeCount += 1;
    } else if (trade.transCode === 'OEXP') {
      oexpQty += trade.quantity;
      tradeCount += 1;
    }
  });

  if (btoQty === 0 || openDate === null) {
    return null;
  }

  const openQty = btoQty - stcQty - oexpQty;
  if (openQty <= 0) {
    return null;
  }

  const first = bucket[0];
  if (!first) return null;

  // Cost basis of just the un-closed portion, proportional to the open share
  // of the total long. btoAmt is negative (cash out), so take the magnitude.
  const costBasis = Math.abs(btoAmt) * (openQty / btoQty);

  return {
    instrument: first.instrument,
    description: first.description,
    openQty,
    costBasis,
    openDate,
    tradeCount,
  };
}

// Open positions are contract buckets whose BTO quantity still exceeds what
// STC/OEXP rows have closed. The realized ClosedContract path is unaffected;
// a partially-closed bucket appears in BOTH outputs (its closed slice as a
// ClosedContract, its remaining slice here).
export function computeOpenPositions(trades: readonly RawTrade[]): OpenPosition[] {
  const buckets = groupByContract(trades);
  return Array.from(buckets.values())
    .map(reduceOpenBucket)
    .filter((p): p is OpenPosition => p !== null);
}

// A current mark for a position, looked up by its fill description (the same
// identifier the /api/prices proxy keys its response on). Missing/non-finite
// marks resolve to null so the position renders with unknown P/L.
export type PriceLookup = Record<string, number | null | undefined>;

// Pair each open position with its current mark and derived unrealized P/L.
// Positions with no available price keep null P/L fields rather than being
// dropped, so the UI can still render them as neutral/unknown bubbles.
export function priceOpenPositions(
  positions: readonly OpenPosition[],
  prices: PriceLookup,
): UnrealizedPosition[] {
  return positions.map((position) => {
    const raw = prices[position.description];
    const currentPrice = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

    if (currentPrice === null) {
      return {
        ...position,
        currentPrice: null,
        currentValue: null,
        unrealizedPl: null,
        pctReturn: null,
      };
    }

    const currentValue = currentPrice * position.openQty * OPTIONS_MULTIPLIER;
    const unrealizedPl = currentValue - position.costBasis;
    const pctReturn = position.costBasis === 0 ? 0 : (unrealizedPl / position.costBasis) * 100;

    return {
      ...position,
      currentPrice,
      currentValue,
      unrealizedPl,
      pctReturn,
    };
  });
}
