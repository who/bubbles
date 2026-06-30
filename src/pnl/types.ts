export type RawTrade = {
  activityDate: Date;
  instrument: string;
  description: string;
  transCode: 'BTO' | 'STC' | 'BTC' | 'STO' | 'OEXP' | 'CDIV' | string;
  quantity: number;
  amount: number;
};

export type ClosedContract = {
  instrument: string;
  description: string;
  pl: number;
  pctReturn: number;
  closedQty: number;
  costBasis: number;
  proceeds: number;
  grossVolume: number;
  closeDate: Date;
  openDate: Date;
  tradeCount: number;
};

export type OpenPosition = {
  instrument: string;
  description: string;
  openQty: number;
  costBasis: number;
  openDate: Date;
  tradeCount: number;
};

// An open position priced against a current mark. `currentPrice` (and the
// derived fields) are null when no mark is available so the UI can still
// render the position with neutral/unknown P/L.
export type UnrealizedPosition = OpenPosition & {
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPl: number | null;
  pctReturn: number | null;
};

export type Summary = {
  totalPl: number;
  totalGain: number;
  totalLoss: number;
  glRatio: number | null;
  winnersCount: number;
  losersCount: number;
  totalClosed: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgPctWin: number;
  avgPctLoss: number;
  uniqueTickers: number;
  parseWarnings: string[];
};
