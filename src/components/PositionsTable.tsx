import type { ClosedContract, UnrealizedPosition } from '../pnl/index.ts';
import {
  DASH,
  formatPrice,
  formatSignedCurrency,
} from './format.ts';
import { toOccSymbol } from './occ.ts';
import { usePrivacyMode } from './usePrivacyMode.tsx';
import { useUnrealizedMode } from './useUnrealizedMode.tsx';
import './PositionsTable.css';

// Each option contract controls 100 shares; cost basis / proceeds are dollar
// totals, so dividing by quantity × 100 recovers the per-share quoted price.
const OPTIONS_MULTIPLIER = 100;

export interface PositionsTableProps {
  contracts: readonly ClosedContract[];
  unrealized?: readonly UnrealizedPosition[];
}

type Row = {
  key: string;
  occ: string;
  entry: number;
  exit: number | null;
  pl: number | null;
  realized: boolean;
};

const perContractPrice = (total: number, qty: number): number => (
  qty === 0 ? NaN : total / qty / OPTIONS_MULTIPLIER
);

// Realized P/L colors green/red by sign; unrealized P/L is neutral gray,
// mirroring the dotted/pastel treatment of unrealized bubbles in the chart.
const plClassFor = (row: Row): string => {
  if (!row.realized) return 'positions-table__pl--unrealized';
  return (row.pl ?? 0) >= 0
    ? 'positions-table__pl--gain'
    : 'positions-table__pl--loss';
};

const closedRow = (c: ClosedContract, i: number): Row => ({
  key: `closed|${i}|${c.instrument}|${c.description}|${c.closeDate.toISOString()}`,
  occ: toOccSymbol(c.instrument, c.description),
  entry: perContractPrice(c.costBasis, c.closedQty),
  exit: perContractPrice(c.proceeds, c.closedQty),
  pl: c.pl,
  realized: true,
});

const openRow = (p: UnrealizedPosition, i: number): Row => ({
  key: `open|${i}|${p.instrument}|${p.description}|${p.openDate.toISOString()}`,
  occ: toOccSymbol(p.instrument, p.description),
  entry: perContractPrice(p.costBasis, p.openQty),
  exit: null,
  pl: p.unrealizedPl,
  realized: false,
});

function PositionsTable({ contracts, unrealized = [] }: PositionsTableProps) {
  const { privacyMode } = usePrivacyMode();
  const { unrealizedMode } = useUnrealizedMode();

  const closedRows = contracts.map(closedRow);
  const openRows = unrealized.map(openRow);
  const showUnrealized = unrealizedMode && openRows.length > 0;
  const rows: Row[] = showUnrealized ? [...closedRows, ...openRows] : closedRows;

  return (
    <div className="positions-table">
      <table className="positions-table__table">
        <caption className="positions-table__caption">
          Positions ledger — every bubble in the chart, as a row.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="positions-table__col-occ">Option (OCC)</th>
            <th scope="col" className="positions-table__col-num">Entry price</th>
            <th scope="col" className="positions-table__col-num">Exit price</th>
            <th scope="col" className="positions-table__col-num">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="positions-table__empty" colSpan={4}>
                No positions to display.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const plClass = plClassFor(row);
              const plText = row.pl === null
                ? DASH
                : formatSignedCurrency(row.pl, privacyMode);
              return (
                <tr
                  key={row.key}
                  data-realized={row.realized ? 'true' : 'false'}
                >
                  <td className="positions-table__occ">{row.occ}</td>
                  <td className="positions-table__num">
                    {formatPrice(row.entry, privacyMode)}
                  </td>
                  <td className="positions-table__num">
                    {row.exit === null ? DASH : formatPrice(row.exit, privacyMode)}
                  </td>
                  <td className={`positions-table__num ${plClass}`}>
                    {plText}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

PositionsTable.defaultProps = {
  unrealized: [],
};

export default PositionsTable;
