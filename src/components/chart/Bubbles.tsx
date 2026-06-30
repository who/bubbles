import { useState } from 'react';
import type { ScaleLinear, ScalePower, ScaleTime } from 'd3-scale';
import { datumMagnitude, type ChartDatum } from './scales.ts';

const GAIN_STROKE = '#2E7D32';
const GAIN_FILL = 'rgba(76,175,80,0.22)';
const LOSS_STROKE = '#C62828';
const LOSS_FILL = 'rgba(229,57,53,0.22)';

// Unrealized bubbles use a softer, more pastel variant of the realized
// palette — lighter green / red, shifted a few degrees toward a gentler tone —
// so they read as related-but-distinct from realized bubbles.
const UNREALIZED_GAIN_STROKE = '#66BB6A';
const UNREALIZED_GAIN_FILL = 'rgba(129,199,132,0.18)';
const UNREALIZED_LOSS_STROKE = '#EF5350';
const UNREALIZED_LOSS_FILL = 'rgba(239,154,154,0.18)';
// No mark available: render neutral (neither green nor red) but still dotted.
const UNREALIZED_NEUTRAL_STROKE = '#9E9E9E';
const UNREALIZED_NEUTRAL_FILL = 'rgba(158,158,158,0.15)';

// Dotted/dashed outline that distinguishes unrealized from realized bubbles.
export const UNREALIZED_DASHARRAY = '4 3';

const STROKE_DEFAULT = 1.5;
const STROKE_HOVER = 2.5;

export type BubbleVariant = 'realized' | 'unrealized';

export type BubbleDatum = ChartDatum & {
  readonly id: string;
  // Defaults to 'realized' when absent so existing callers are unaffected.
  readonly variant?: BubbleVariant;
  // Unrealized position with no available mark: color neutral, outline dotted.
  readonly neutral?: boolean;
};

export interface BubblesProps {
  data: readonly BubbleDatum[];
  xScale: ScaleTime<number, number>;
  yScale: ScaleLinear<number, number>;
  rScale: ScalePower<number, number>;
  onHoverChange?: (id: string | null) => void;
}

type Palette = { stroke: string; fill: string };

const paletteFor = (d: BubbleDatum): Palette => {
  if (d.variant === 'unrealized') {
    if (d.neutral) {
      return { stroke: UNREALIZED_NEUTRAL_STROKE, fill: UNREALIZED_NEUTRAL_FILL };
    }
    return d.pl >= 0
      ? { stroke: UNREALIZED_GAIN_STROKE, fill: UNREALIZED_GAIN_FILL }
      : { stroke: UNREALIZED_LOSS_STROKE, fill: UNREALIZED_LOSS_FILL };
  }
  return d.pl >= 0
    ? { stroke: GAIN_STROKE, fill: GAIN_FILL }
    : { stroke: LOSS_STROKE, fill: LOSS_FILL };
};

const sortByPlMagnitudeDesc = (data: readonly BubbleDatum[]): BubbleDatum[] => [...data]
  .sort((a, b) => datumMagnitude(b) - datumMagnitude(a));

const noopHoverChange = (): void => {};

function Bubbles({
  data,
  xScale,
  yScale,
  rScale,
  onHoverChange = noopHoverChange,
}: BubblesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const sorted = sortByPlMagnitudeDesc(data);

  const handleEnter = (id: string) => {
    setHoveredId(id);
    onHoverChange(id);
  };
  const handleLeave = () => {
    setHoveredId(null);
    onHoverChange(null);
  };

  return (
    <g className="bubble-chart__bubbles">
      {sorted.map((d) => {
        const { stroke, fill } = paletteFor(d);
        const isUnrealized = d.variant === 'unrealized';
        const isHovered = hoveredId === d.id;
        return (
          <circle
            key={d.id}
            data-bubble-id={d.id}
            data-bubble-variant={isUnrealized ? 'unrealized' : 'realized'}
            cx={xScale(d.closeDate)}
            cy={yScale(d.pctReturn)}
            r={rScale(datumMagnitude(d))}
            stroke={stroke}
            fill={fill}
            strokeWidth={isHovered ? STROKE_HOVER : STROKE_DEFAULT}
            strokeDasharray={isUnrealized ? UNREALIZED_DASHARRAY : undefined}
            onMouseEnter={() => handleEnter(d.id)}
            onMouseLeave={handleLeave}
          />
        );
      })}
    </g>
  );
}

Bubbles.defaultProps = {
  onHoverChange: noopHoverChange,
};

export default Bubbles;
