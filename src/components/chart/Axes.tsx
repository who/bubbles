import { format } from 'date-fns';
import type { ScaleLinear, ScaleTime } from 'd3-scale';

export const Y_TICK_INCREMENT = 250;
export const ZERO_LINE_STROKE = '#3D4651';
export const GRID_LINE_STROKE = '#E5E7EB';

export const X_LABEL_ROTATION = -45;

const Y_LABEL_DX = 8;

export interface XAxisProps {
  xScale: ScaleTime<number, number>;
  dates: readonly Date[];
  plotHeight: number;
}

export function XAxis({ xScale, dates, plotHeight }: XAxisProps) {
  return (
    <g className="bubble-chart__x-axis" data-testid="bubble-chart-x-axis">
      {dates.map((d) => (
        <g
          key={d.toISOString()}
          className="tick bubble-chart__x-tick"
          transform={`translate(${xScale(d)}, ${plotHeight})`}
        >
          <text
            className="bubble-chart__tick-label"
            dx="-0.5em"
            dy="0.4em"
            textAnchor="end"
            transform={`rotate(${X_LABEL_ROTATION})`}
          >
            {format(d, 'MMM d')}
          </text>
        </g>
      ))}
    </g>
  );
}

const computeYTicks = (lo: number, hi: number, step: number): number[] => {
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
};

export interface YAxisProps {
  yScale: ScaleLinear<number, number>;
  plotWidth: number;
}

export function YAxis({ yScale, plotWidth }: YAxisProps) {
  const [lo, hi] = yScale.domain() as [number, number];
  const values = computeYTicks(lo, hi, Y_TICK_INCREMENT);
  return (
    <g className="bubble-chart__y-axis" data-testid="bubble-chart-y-axis">
      {values.map((v) => {
        const isZero = v === 0;
        return (
          <g
            key={v}
            className="tick bubble-chart__y-tick"
            transform={`translate(0, ${yScale(v)})`}
            data-value={v}
          >
            <line
              className={isZero ? 'bubble-chart__y-zero-line' : 'bubble-chart__y-grid-line'}
              x1={0}
              x2={plotWidth}
              stroke={isZero ? ZERO_LINE_STROKE : GRID_LINE_STROKE}
            />
            <text
              className="bubble-chart__tick-label"
              x={-Y_LABEL_DX}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {`${v}%`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
