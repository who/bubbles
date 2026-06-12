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

export type TooltipDatum = ContractTooltipDatum;

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

function HoverTooltip({ datum, anchorX, anchorY, containerWidth }: HoverTooltipProps) {
  const { privacyMode } = usePrivacyMode();

  if (!datum) return null;

  const isGain = datum.pl >= 0;
  const borderColor = isGain ? GAIN_BORDER : LOSS_BORDER;

  const flipsLeft = anchorX > containerWidth - EDGE_THRESHOLD;
  const left = flipsLeft
    ? anchorX - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X
    : anchorX + TOOLTIP_OFFSET_X;
  const top = anchorY - TOOLTIP_OFFSET_Y;

  const trailingLabel = `${datum.tradeCount} ${datum.tradeCount === 1 ? 'trade fill' : 'trade fills'}`;

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
      <p className="hover-tooltip__name">{datum.name}</p>
      <p className="hover-tooltip__date">{format(datum.closeDate, 'MMM d, yyyy')}</p>
      <dl className="hover-tooltip__fields">
        <div className="hover-tooltip__row">
          <dt>P/L</dt>
          <dd className={isGain ? 'hover-tooltip__value--gain' : 'hover-tooltip__value--loss'}>
            {formatSignedCurrency(datum.pl, privacyMode)}
          </dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>% Return</dt>
          <dd className={isGain ? 'hover-tooltip__value--gain' : 'hover-tooltip__value--loss'}>
            {formatSignedPercent(datum.pctReturn, 1)}
          </dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>Cost Basis</dt>
          <dd>{formatCostBasis(datum.costBasis, privacyMode)}</dd>
        </div>
        <div className="hover-tooltip__row">
          <dt>Closed Qty</dt>
          <dd>{formatQty(datum.closedQty)}</dd>
        </div>
      </dl>
      <p className="hover-tooltip__trailing">{trailingLabel}</p>
    </div>
  );
}

export default HoverTooltip;
