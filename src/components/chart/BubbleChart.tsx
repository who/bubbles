import { useMemo, useState } from 'react';
import type { ClosedContract, UnrealizedPosition } from '../../pnl/index.ts';
import { useUnrealizedMode } from '../useUnrealizedMode.tsx';
import { XAxis, YAxis } from './Axes.tsx';
import Bubbles, { type BubbleDatum } from './Bubbles.tsx';
import HoverTooltip, {
  type ContractTooltipDatum,
  type OpenTooltipDatum,
  type TooltipDatum,
} from './HoverTooltip.tsx';
import { buildRScale, buildXScale, buildYScale, distinctDates } from './scales.ts';
import './BubbleChart.css';

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 380;
export const CHART_MARGIN = {
  top: 16,
  right: 24,
  bottom: 56,
  left: 56,
} as const;
export const PLOT_WIDTH = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
export const PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

export type BubbleChartProps = {
  data: readonly ClosedContract[];
  unrealized?: readonly UnrealizedPosition[];
};

const contractId = (c: ClosedContract): string => (
  `contract|${c.instrument}|${c.description}|${c.closeDate.toISOString()}`
);

const openId = (p: UnrealizedPosition): string => (
  `open|${p.instrument}|${p.description}|${p.openDate.toISOString()}`
);

const toBubbleData = (data: readonly ClosedContract[]): BubbleDatum[] => (
  data.map((c) => ({
    id: contractId(c),
    closeDate: c.closeDate,
    pctReturn: c.pctReturn,
    pl: c.pl,
    variant: 'realized',
  }))
);

// Map open positions to bubbles. They sit on the time axis at their open date,
// at their unrealized % return (break-even for un-priced positions). Un-priced
// positions render neutral and size off cost basis rather than P/L.
const toUnrealizedBubbleData = (
  positions: readonly UnrealizedPosition[],
): BubbleDatum[] => (
  positions.map((p) => {
    const priced = p.unrealizedPl !== null;
    return {
      id: openId(p),
      closeDate: p.openDate,
      pctReturn: p.pctReturn ?? 0,
      pl: p.unrealizedPl ?? 0,
      magnitude: priced ? Math.abs(p.unrealizedPl as number) : p.costBasis,
      variant: 'unrealized' as const,
      neutral: !priced,
    };
  })
);

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

const tooltipForOpen = (p: UnrealizedPosition): OpenTooltipDatum => ({
  view: 'open',
  name: p.description,
  openDate: p.openDate,
  unrealizedPl: p.unrealizedPl,
  pctReturn: p.pctReturn,
  costBasis: p.costBasis,
  openQty: p.openQty,
  tradeCount: p.tradeCount,
});

// Resolve the hovered bubble to its tooltip + plot anchor. Realized contracts
// always resolve; open positions only when the unrealized layer is shown.
const findHovered = (
  data: readonly ClosedContract[],
  unrealized: readonly UnrealizedPosition[],
  showUnrealized: boolean,
  hoveredId: string | null,
): { datum: TooltipDatum; closeDate: Date; pctReturn: number } | null => {
  if (!hoveredId) return null;
  const contract = data.find((c) => contractId(c) === hoveredId);
  if (contract) {
    return {
      datum: tooltipForContract(contract),
      closeDate: contract.closeDate,
      pctReturn: contract.pctReturn,
    };
  }
  if (!showUnrealized) return null;
  const open = unrealized.find((p) => openId(p) === hoveredId);
  if (!open) return null;
  return {
    datum: tooltipForOpen(open),
    closeDate: open.openDate,
    pctReturn: open.pctReturn ?? 0,
  };
};

export const EMPTY_RESULT_MESSAGE = 'This file has no matched closes. All positions appear to still be open.';

function BubbleChart({ data, unrealized = [] }: BubbleChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { unrealizedMode } = useUnrealizedMode();

  const realizedData = useMemo(() => toBubbleData(data), [data]);
  const unrealizedData = useMemo(
    () => toUnrealizedBubbleData(unrealized),
    [unrealized],
  );
  const showUnrealized = unrealizedMode && unrealizedData.length > 0;
  const visibleData = useMemo(
    () => (showUnrealized ? [...realizedData, ...unrealizedData] : realizedData),
    [showUnrealized, realizedData, unrealizedData],
  );

  if (realizedData.length === 0) {
    return (
      <div
        className="bubble-chart bubble-chart--empty"
        data-grouping-mode="contract"
        data-bubble-count={0}
        data-unrealized-count={showUnrealized ? unrealizedData.length : 0}
        style={{ width: `${CHART_WIDTH}px`, height: `${CHART_HEIGHT}px` }}
      >
        <p className="bubble-chart__empty-message" role="status">
          {EMPTY_RESULT_MESSAGE}
        </p>
      </div>
    );
  }

  const xScale = buildXScale(visibleData, PLOT_WIDTH);
  const xDates = distinctDates(visibleData);
  const yScale = buildYScale(visibleData, PLOT_HEIGHT);
  const rScale = buildRScale(visibleData);

  const hovered = findHovered(data, unrealized, showUnrealized, hoveredId);
  const anchorX = hovered ? CHART_MARGIN.left + xScale(hovered.closeDate) : 0;
  const anchorY = hovered ? CHART_MARGIN.top + yScale(hovered.pctReturn) : 0;

  return (
    <div
      className="bubble-chart"
      data-grouping-mode="contract"
      data-bubble-count={realizedData.length}
      data-unrealized-count={showUnrealized ? unrealizedData.length : 0}
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
            data={visibleData}
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

BubbleChart.defaultProps = {
  unrealized: [],
};

export default BubbleChart;
