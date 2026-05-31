import { useMemo, useState } from 'react';
import type { ClosedContract, ClosedTicker } from '../../pnl/index.ts';
import { XAxis, YAxis } from './Axes.tsx';
import Bubbles, { type BubbleDatum } from './Bubbles.tsx';
import HoverTooltip, {
  type ContractTooltipDatum,
  type TickerTooltipDatum,
  type TooltipDatum,
} from './HoverTooltip.tsx';
import { buildRScale, buildXScale, buildYScale, distinctDates } from './scales.ts';
import './BubbleChart.css';

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 380;
export const CHART_MARGIN = {
  top: 16,
  right: 24,
  bottom: 32,
  left: 56,
} as const;
export const PLOT_WIDTH = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
export const PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

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

export const EMPTY_RESULT_MESSAGE = 'This file has no matched closes. All positions appear to still be open.';

function BubbleChart(props: BubbleChartProps) {
  const { groupingMode } = props;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const bubbleData = useMemo(() => toBubbleData(props), [props]);

  if (bubbleData.length === 0) {
    return (
      <div
        className="bubble-chart bubble-chart--empty"
        data-grouping-mode={groupingMode}
        data-bubble-count={0}
        style={{ width: `${CHART_WIDTH}px`, height: `${CHART_HEIGHT}px` }}
      >
        <p className="bubble-chart__empty-message" role="status">
          {EMPTY_RESULT_MESSAGE}
        </p>
      </div>
    );
  }

  const xScale = buildXScale(bubbleData, PLOT_WIDTH);
  const xDates = distinctDates(bubbleData);
  const yScale = buildYScale(bubbleData, PLOT_HEIGHT);
  const rScale = buildRScale(bubbleData);

  const hovered = findHovered(props, hoveredId);
  const anchorX = hovered ? CHART_MARGIN.left + xScale(hovered.closeDate) : 0;
  const anchorY = hovered ? CHART_MARGIN.top + yScale(hovered.pctReturn) : 0;

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
        <g transform={`translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`}>
          <YAxis yScale={yScale} plotWidth={PLOT_WIDTH} />
          <XAxis xScale={xScale} dates={xDates} plotHeight={PLOT_HEIGHT} />
          <Bubbles
            data={bubbleData}
            xScale={xScale}
            yScale={yScale}
            rScale={rScale}
            onHoverChange={setHoveredId}
          />
        </g>
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
