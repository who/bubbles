import { format } from 'date-fns';
import {
  formatSignedCurrency,
  formatSignedPercent,
} from '../format.ts';
import { usePrivacyMode } from '../usePrivacyMode.tsx';
import './HoverTooltip.css';

export const TOOLTIP_WIDTH = 220;
export const TOOLTIP_OFFSET_X = 12;
export const TOOLTIP_OFFSET_Y = 8;
export const EDGE_THRESHOLD = 150;

const GAIN_BORDER = '#2E7D32';
const LOSS_BORDER = '#C62828';
// Un-priced open position: neutral border (matches the neutral bubble stroke).
const NEUTRAL_BORDER = '#9E9E9E';
// Shown for unrealized fields with no available mark.
const UNPRICED_PLACEHOLDER = '—';

export type ContractTooltipDatum = {
  readonly view: 'contract';
  readonly name: string;
  readonly closeDate: Date;
  readonly pl: number;
  readonly pctReturn: number;
  readonly costBasis: number;
  readonly closedQty: number;
  readonly tradeCount: number;
};

// Hover datum for an open (unrealized) position. Mirrors the contract tooltip
// but P/L and % return are null when no current mark is available.
export type OpenTooltipDatum = {
  readonly view: 'open';
  readonly name: string;
  readonly openDate: Date;
  readonly unrealizedPl: number | null;
  readonly pctReturn: number | null;
  readonly costBasis: number;
  readonly openQty: number;
  readonly tradeCount: number;
};

export type TooltipDatum = ContractTooltipDatum | OpenTooltipDatum;

export interface HoverTooltipProps {
  datum: TooltipDatum | null;
  anchorX: number;
  anchorY: number;
  containerWidth: number;
}

const formatQty = (n: number): string => {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
};

const formatCostBasis = (n: number, masked: boolean): string => formatSignedCurrency(n, masked).replace(/^\+/, '');

// Normalize either tooltip variant into the fields the markup renders, so the
// open (unrealized) and contract views share one layout.
type TooltipView = {
  name: string;
  date: Date;
  pl: number | null;
  pctReturn: number | null;
  costBasis: number;
  qty: number;
  qtyLabel: string;
  plLabel: string;
  tradeCount: number;
};

const toView = (datum: TooltipDatum): TooltipView => {
  if (datum.view === 'open') {
    return {
      name: datum.name,
      date: datum.openDate,
      pl: datum.unrealizedPl,
      pctReturn: datum.pctReturn,
      costBasis: datum.costBasis,
      qty: datum.openQty,
      qtyLabel: 'Open Qty',
      plLabel: 'Unrealized P/L',
      tradeCount: datum.tradeCount,
    };
  }
  return {
    name: datum.name,
    date: datum.closeDate,
    pl: datum.pl,
    pctReturn: datum.pctReturn,
    costBasis: datum.costBasis,
    qty: datum.closedQty,
    qtyLabel: 'Closed Qty',
    plLabel: 'P/L',
    tradeCount: datum.tradeCount,
  };
};

function HoverTooltip({ datum, anchorX, anchorY, containerWidth }: HoverTooltipProps) {
  const { privacyMode } = usePrivacyMode();

  if (!datum) return null;

  const view = toView(datum);
  const priced = view.pl !== null;
  const isGain = priced && (view.pl as number) >= 0;
  // Un-priced open positions read as neutral; priced positions follow P/L sign.
  let borderColor = NEUTRAL_BORDER;
  let valueClass: string | undefined;
  if (priced) {
    borderColor = isGain ? GAIN_BORDER : LOSS_BORDER;
    valueClass = isGain ? 'hover-tooltip__value--gain' : 'hover-tooltip__value--loss';
  }

  const flipsLeft = anchorX > containerWidth - EDGE_THRESHOLD;
  const left = flipsLeft
    ? anchorX - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X
    : anchorX + TOOLTIP_OFFSET_X;
  const top = anchorY - TOOLTIP_OFFSET_Y;

  const trailingLabel = `${view.tradeCount} ${view.tradeCount === 1 ? 'trade fill' : 'trade fills'}`;

  return (
    <div
      className="hover-tooltip"
      role="tooltip"
      data-flipped={flipsLeft ? 'left' : 'right'}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${TOOLTIP_WIDTH}px`,
        borderTopColor: borderColor,
      }}
    >
      <p className="hover-tooltip__name">{view.name}</p>
      <p className="hover-tooltip__date">{format(view.date, 'MMM d, yyyy')}</p>
      <dl className="hover-tooltip__fields">
        <div className="hover-tooltip__row">
          <dt>{view.plLabel}</dt>
          <dd className={valueClass}>
            {priced ? formatSignedCurrency(view.pl as number, privacyMode) : UNPRICED_PLACEHOLDER}
          </dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>% Return</dt>
          <dd className={valueClass}>
            {view.pctReturn !== null ? formatSignedPercent(view.pctReturn, 1) : UNPRICED_PLACEHOLDER}
          </dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>Cost Basis</dt>
          <dd>{formatCostBasis(view.costBasis, privacyMode)}</dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>{view.qtyLabel}</dt>
          <dd>{formatQty(view.qty)}</dd>
        </div>
      </dl>
      <p className="hover-tooltip__trailing">{trailingLabel}</p>
    </div>
  );
}

export default HoverTooltip;
