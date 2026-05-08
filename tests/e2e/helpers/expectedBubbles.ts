// Independent re-application of PRD §7.2 scale rules for the canonical fixture
// (src/pnl/__fixtures__/canonical-april-2026.csv). The chart implementation
// lives in src/components/chart/{scales,Bubbles,BubbleChart}.tsx; this helper
// deliberately does NOT import from there so the test pins the visual contract
// rather than the implementation.
import { extent, max } from 'd3-array';
import { scaleLinear, scaleSqrt, scaleTime } from 'd3-scale';

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

export const GAIN_STROKE = '#2E7D32';
export const GAIN_FILL = 'rgba(76,175,80,0.22)';
export const LOSS_STROKE = '#C62828';
export const LOSS_FILL = 'rgba(229,57,53,0.22)';

export const PIXEL_TOLERANCE = 1;

const X_PAD_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const Y_INCREMENT = 250;
const R_RANGE: readonly [number, number] = [4, 42];

export interface ExpectedBubble {
  readonly instrument: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly stroke: string;
  readonly fill: string;
}

interface FixtureDatum {
  readonly instrument: string;
  readonly closeDate: Date;
  readonly pl: number;
  readonly costBasis: number;
}

// Per src/pnl/__fixtures__/canonical-april-2026.csv (UTC dates per parseDate):
//   AMD : BTO 5 @ $3.45 ($1,725.20) → STC 5 @ $4.20 ($2,099.40); P/L = +$374.20; close 5/5/2026
//   PLTR: BTO 50 @ $0.85 ($4,252.00) → STC 50 @ $1.10 ($5,497.50); P/L = +$1,245.50; close 5/4/2026
const FIXTURE: readonly FixtureDatum[] = [
  {
    instrument: 'AMD',
    closeDate: new Date(Date.UTC(2026, 4, 5)),
    pl: 374.20,
    costBasis: 1725.20,
  },
  {
    instrument: 'PLTR',
    closeDate: new Date(Date.UTC(2026, 4, 4)),
    pl: 1245.50,
    costBasis: 4252.00,
  },
];

export function computeExpectedBubbles(): ExpectedBubble[] {
  const dates = FIXTURE.map((d) => d.closeDate);
  const [minDate, maxDate] = extent(dates);
  if (!minDate || !maxDate) {
    throw new Error('Fixture must contain at least one datum');
  }
  const xDomain: [Date, Date] = [
    new Date(minDate.getTime() - X_PAD_DAYS * DAY_MS),
    new Date(maxDate.getTime() + X_PAD_DAYS * DAY_MS),
  ];
  const xScale = scaleTime().domain(xDomain).range([0, PLOT_WIDTH]);

  const pcts = FIXTURE.map((d) => (d.pl / d.costBasis) * 100);
  const [minPct, maxPct] = extent(pcts);
  const minIn = minPct ?? 0;
  const maxIn = maxPct ?? 0;
  let yLo = Math.floor(minIn / Y_INCREMENT) * Y_INCREMENT;
  let yHi = Math.ceil(maxIn / Y_INCREMENT) * Y_INCREMENT;
  if (yLo === yHi) {
    yLo -= Y_INCREMENT;
    yHi += Y_INCREMENT;
  }
  const yScale = scaleLinear().domain([yLo, yHi]).range([PLOT_HEIGHT, 0]);

  const peak = max(FIXTURE, (d) => Math.abs(d.pl)) ?? 0;
  const rScale = scaleSqrt().domain([0, peak]).range([R_RANGE[0], R_RANGE[1]]);

  // Largest |pl| renders first per PRD §7.2 ("largest first") so smaller
  // bubbles draw on top and remain hoverable.
  const sorted = [...FIXTURE].sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));

  return sorted.map((d) => {
    const pctReturn = (d.pl / d.costBasis) * 100;
    const isGain = d.pl >= 0;
    return {
      instrument: d.instrument,
      cx: xScale(d.closeDate),
      cy: yScale(pctReturn),
      r: rScale(Math.abs(d.pl)),
      stroke: isGain ? GAIN_STROKE : LOSS_STROKE,
      fill: isGain ? GAIN_FILL : LOSS_FILL,
    };
  });
}
