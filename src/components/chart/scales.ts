import { extent, max } from 'd3-array';
import {
  scaleLinear,
  scaleSqrt,
  scaleTime,
  type ScaleLinear,
  type ScalePower,
  type ScaleTime,
} from 'd3-scale';

export type ChartDatum = {
  readonly closeDate: Date;
  readonly pctReturn: number;
  readonly pl: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const X_PAD_DAYS = 2;
const Y_INCREMENT = 250;
const R_RANGE: readonly [number, number] = [4, 42];

const roundDownTo = (value: number, step: number): number => Math.floor(value / step) * step + 0;
const roundUpTo = (value: number, step: number): number => Math.ceil(value / step) * step + 0;

export const buildXScale = (
  data: readonly ChartDatum[],
  width: number,
): ScaleTime<number, number> => {
  const dates = data.map((d) => d.closeDate);
  const [minDate, maxDate] = extent(dates);
  const fallback = new Date();
  const lo = minDate ?? fallback;
  const hi = maxDate ?? fallback;
  const padded: [Date, Date] = [
    new Date(lo.getTime() - X_PAD_DAYS * DAY_MS),
    new Date(hi.getTime() + X_PAD_DAYS * DAY_MS),
  ];
  return scaleTime().domain(padded).range([0, width]);
};

export const buildYScale = (
  data: readonly ChartDatum[],
  height: number,
): ScaleLinear<number, number> => {
  const values = data.map((d) => d.pctReturn);
  const [minVal, maxVal] = extent(values);
  const minIn = minVal ?? 0;
  const maxIn = maxVal ?? 0;
  let lo = roundDownTo(minIn, Y_INCREMENT);
  let hi = roundUpTo(maxIn, Y_INCREMENT);
  if (lo === hi) {
    lo -= Y_INCREMENT;
    hi += Y_INCREMENT;
  }
  return scaleLinear().domain([lo, hi]).range([height, 0]);
};

export const buildRScale = (
  data: readonly ChartDatum[],
): ScalePower<number, number> => {
  const peak = max(data, (d) => Math.abs(d.pl)) ?? 0;
  return scaleSqrt().domain([0, peak]).range([R_RANGE[0], R_RANGE[1]]);
};
