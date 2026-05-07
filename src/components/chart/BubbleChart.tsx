import { useMemo, useState } from 'react';
import type { ClosedContract, ClosedTicker } from '../../pnl/index.ts';
import Bubbles, { type BubbleDatum } from './Bubbles.tsx';
import HoverTooltip, {
  type ContractTooltipDatum,
  type TickerTooltipDatum,
  type TooltipDatum,
} from './HoverTooltip.tsx';
import { buildRScale, buildXScale, buildYScale } from './scales.ts';
import './BubbleChart.css';

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 380;

export type BubbleChartProps =
  | { data: readonly ClosedContract[]; groupingMode: 'contract' }
  | { data: readonly ClosedTicker[]; groupingMode: 'ticker' };

const contractId = (c: ClosedContract): string => (
  `contract|${c.instrument}|${c.description}|${c.closeDate.toISOString()}`
);

const tickerId = (t: ClosedTicker): string => `ticker|${t.instrument}`;

const toBubbleData = (props: BubbleChartProps): BubbleDatum[] => {
  if (props.groupingMode === 'contract') {
    return props.data.map((c) => ({
      id: contractId(c),
      closeDate: c.closeDate,
      pctReturn: c.pctReturn,
      pl: c.pl,
    }));
  }
  return props.data.map((t) => ({
    id: tickerId(t),
    closeDate: t.closeDate,
    pctReturn: t.pctReturn,
    pl: t.pl,
  }));
};

const tooltipForContract = (c: ClosedContract): ContractTooltipDatum => ({
  view: 'contract',
  name: c.description,
  closeDate: c.closeDate,
  pl: c.pl,
  pctReturn: c.pctReturn,
  costBasis: c.costBasis,
  closedQty: c.closedQty,
  tradeCount: c.tradeCount,
});

const tooltipForTicker = (t: ClosedTicker): TickerTooltipDatum => ({
  view: 'ticker',
  name: t.instrument,
  closeDate: t.closeDate,
  pl: t.pl,
  pctReturn: t.pctReturn,
  costBasis: t.costBasis,
  closedQty: t.closedQty,
  contracts: t.contracts,
});

const findHovered = (
  props: BubbleChartProps,
  hoveredId: string | null,
): { datum: TooltipDatum; closeDate: Date; pctReturn: number } | null => {
  if (!hoveredId) return null;
  if (props.groupingMode === 'contract') {
    const found = props.data.find((c) => contractId(c) === hoveredId);
    if (!found) return null;
    return {
      datum: tooltipForContract(found),
      closeDate: found.closeDate,
      pctReturn: found.pctReturn,
    };
  }
  const found = props.data.find((t) => tickerId(t) === hoveredId);
  if (!found) return null;
  return {
    datum: tooltipForTicker(found),
    closeDate: found.closeDate,
    pctReturn: found.pctReturn,
  };
};

function BubbleChart(props: BubbleChartProps) {
  const { groupingMode } = props;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const bubbleData = useMemo(() => toBubbleData(props), [props]);
  const xScale = useMemo(() => buildXScale(bubbleData, CHART_WIDTH), [bubbleData]);
  const yScale = useMemo(() => buildYScale(bubbleData, CHART_HEIGHT), [bubbleData]);
  const rScale = useMemo(() => buildRScale(bubbleData), [bubbleData]);

  const hovered = findHovered(props, hoveredId);
  const anchorX = hovered ? xScale(hovered.closeDate) : 0;
  const anchorY = hovered ? yScale(hovered.pctReturn) : 0;

  return (
    <div
      className="bubble-chart"
      data-grouping-mode={groupingMode}
      data-bubble-count={bubbleData.length}
      style={{ width: `${CHART_WIDTH}px`, height: `${CHART_HEIGHT}px` }}
    >
      <svg
        className="bubble-chart__svg"
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Realized gain/loss bubble chart"
      >
        <Bubbles
          data={bubbleData}
          xScale={xScale}
          yScale={yScale}
          rScale={rScale}
          onHoverChange={setHoveredId}
        />
      </svg>
      <HoverTooltip
        datum={hovered ? hovered.datum : null}
        anchorX={anchorX}
        anchorY={anchorY}
        containerWidth={CHART_WIDTH}
      />
    </div>
  );
}

export default BubbleChart;
