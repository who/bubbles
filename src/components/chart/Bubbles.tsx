import { useState } from 'react';
import type { ScaleLinear, ScalePower, ScaleTime } from 'd3-scale';
import type { ChartDatum } from './scales.ts';

const GAIN_STROKE = '#2E7D32';
const GAIN_FILL = 'rgba(76,175,80,0.22)';
const LOSS_STROKE = '#C62828';
const LOSS_FILL = 'rgba(229,57,53,0.22)';
const STROKE_DEFAULT = 1.5;
const STROKE_HOVER = 2.5;

export type BubbleDatum = ChartDatum & { readonly id: string };

export interface BubblesProps {
  data: readonly BubbleDatum[];
  xScale: ScaleTime<number, number>;
  yScale: ScaleLinear<number, number>;
  rScale: ScalePower<number, number>;
}

const sortByPlMagnitudeDesc = (data: readonly BubbleDatum[]): BubbleDatum[] => [...data]
  .sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));

function Bubbles({ data, xScale, yScale, rScale }: BubblesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const sorted = sortByPlMagnitudeDesc(data);

  return (
    <g className="bubble-chart__bubbles">
      {sorted.map((d) => {
        const isGain = d.pl >= 0;
        const stroke = isGain ? GAIN_STROKE : LOSS_STROKE;
        const fill = isGain ? GAIN_FILL : LOSS_FILL;
        const isHovered = hoveredId === d.id;
        return (
          <circle
            key={d.id}
            data-bubble-id={d.id}
            cx={xScale(d.closeDate)}
            cy={yScale(d.pctReturn)}
            r={rScale(Math.abs(d.pl))}
            stroke={stroke}
            fill={fill}
            strokeWidth={isHovered ? STROKE_HOVER : STROKE_DEFAULT}
            onMouseEnter={() => setHoveredId(d.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      })}
    </g>
  );
}

export default Bubbles;
