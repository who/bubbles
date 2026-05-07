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

export type ClosedTicker = {
  instrument: string;
  pl: number;
  pctReturn: number;
  closedQty: number;
  costBasis: number;
  grossVolume: number;
  contracts: number;
  closeDate: Date;
  openDate: Date;
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
