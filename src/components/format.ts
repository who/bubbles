export const DASH = '—';

export const MASKED_AMOUNT = '•••';

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatRatio = (n: number | null): string => {
  if (n === null || !Number.isFinite(n)) return DASH;
  return n.toFixed(2);
};

export const formatSignedCurrency = (n: number, masked = false): string => {
  if (masked) return MASKED_AMOUNT;
  if (!Number.isFinite(n)) return DASH;
  if (n > 0) return `+${currencyFmt.format(n)}`;
  return currencyFmt.format(n);
};

export const formatCompactCurrency = (n: number, masked = false): string => {
  if (masked) return MASKED_AMOUNT;
  if (!Number.isFinite(n)) return DASH;
  return compactCurrencyFmt.format(n).replace(/\.0(?=[A-Z]|$)/, '');
};

export const formatPercent = (n: number, decimals = 1): string => {
  if (!Number.isFinite(n)) return DASH;
  return `${n.toFixed(decimals)}%`;
};

export const formatSignedPercent = (n: number, decimals = 1): string => {
  if (!Number.isFinite(n)) return DASH;
  if (n > 0) return `+${n.toFixed(decimals)}%`;
  return `${n.toFixed(decimals)}%`;
};

export const formatRewardRisk = (avgWin: number, avgLoss: number): string => {
  if (!Number.isFinite(avgWin) || !Number.isFinite(avgLoss) || avgLoss === 0) {
    return DASH;
  }
  const ratio = Math.abs(avgWin / avgLoss);
  if (!Number.isFinite(ratio)) return DASH;
  return `${ratio.toFixed(2)}×`;
};
