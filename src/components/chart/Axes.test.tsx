import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { XAxis, YAxis, ZERO_LINE_STROKE } from './Axes.tsx';
import { buildXScale, buildYScale, distinctDates, type ChartDatum } from './scales.ts';

const PLOT_WIDTH = 720;
const PLOT_HEIGHT = 320;

const datum = (overrides: Partial<ChartDatum> = {}): ChartDatum => ({
  closeDate: new Date(2026, 3, 15),
  pctReturn: 0,
  pl: 0,
  ...overrides,
});

const renderXAxis = (data: readonly ChartDatum[]) => {
  const xScale = buildXScale(data, PLOT_WIDTH);
  return render(
    <svg>
      <XAxis xScale={xScale} dates={distinctDates(data)} plotHeight={PLOT_HEIGHT} />
    </svg>,
  );
};

const renderYAxis = (data: readonly ChartDatum[]) => {
  const yScale = buildYScale(data, PLOT_HEIGHT);
  return render(
    <svg>
      <YAxis yScale={yScale} plotWidth={PLOT_WIDTH} />
    </svg>,
  );
};

describe('XAxis (PRD §7.2 X axis)', () => {
  test('AC1: one tick per distinct date in the data', () => {
    // Seven consecutive days → seven ticks, one per date
    const data = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      datum({ closeDate: new Date(2026, 3, 5 + offset) }));
    const { container } = renderXAxis(data);
    expect(container.querySelectorAll('.tick')).toHaveLength(7);
  });

  test('AC1: duplicate dates collapse to a single tick', () => {
    const data = [
      datum({ closeDate: new Date(2026, 3, 5) }),
      datum({ closeDate: new Date(2026, 3, 5) }),
      datum({ closeDate: new Date(2026, 3, 6) }),
    ];
    const { container } = renderXAxis(data);
    expect(container.querySelectorAll('.tick')).toHaveLength(2);
  });

  test('AC1: tick labels formatted via date-fns "MMM d", one per date', () => {
    const data = [
      datum({ closeDate: new Date(2026, 3, 7) }),
      datum({ closeDate: new Date(2026, 3, 5) }),
      datum({ closeDate: new Date(2026, 3, 6) }),
    ];
    const { container } = renderXAxis(data);
    const labels = Array.from(container.querySelectorAll('.tick text'))
      .map((t) => t.textContent);
    // sorted chronologically regardless of input order
    expect(labels).toEqual(['Apr 5', 'Apr 6', 'Apr 7']);
  });

  test('ticks are positioned via xScale on the X axis', () => {
    const data = [
      datum({ closeDate: new Date(2026, 3, 5) }),
      datum({ closeDate: new Date(2026, 3, 25) }),
    ];
    const xScale = buildXScale(data, PLOT_WIDTH);
    const { container } = render(
      <svg>
        <XAxis xScale={xScale} dates={distinctDates(data)} plotHeight={PLOT_HEIGHT} />
      </svg>,
    );
    const firstTick = container.querySelector('.tick');
    expect(firstTick).not.toBeNull();
    const expectedX = xScale(new Date(2026, 3, 5));
    expect(firstTick!.getAttribute('transform'))
      .toBe(`translate(${expectedX}, ${PLOT_HEIGHT})`);
  });

  test('does not render an axis line (PRD §7.2: no axis line, no vertical gridlines)', () => {
    const data = [
      datum({ closeDate: new Date(2026, 3, 5) }),
      datum({ closeDate: new Date(2026, 3, 25) }),
    ];
    const { container } = renderXAxis(data);
    // X axis has no <line> children — only <text> tick labels
    const xAxis = container.querySelector('.bubble-chart__x-axis');
    expect(xAxis).not.toBeNull();
    expect(xAxis!.querySelectorAll('line')).toHaveLength(0);
  });
});

describe('YAxis (PRD §7.2 Y axis)', () => {
  test('AC2: gridlines drawn at every 250% boundary', () => {
    // domain [-250, 1000] → ticks at -250, 0, 250, 500, 750, 1000 (6 ticks)
    const data = [
      datum({ pctReturn: -78.9 }),
      datum({ pctReturn: 950.5 }),
    ];
    const { container } = renderYAxis(data);
    expect(container.querySelectorAll('.tick')).toHaveLength(6);
  });

  test('AC2: each tick has a horizontal gridline spanning the plot width', () => {
    const data = [
      datum({ pctReturn: -100 }),
      datum({ pctReturn: 100 }),
    ];
    const { container } = renderYAxis(data);
    const lines = container.querySelectorAll('.tick line');
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((l) => {
      expect(l.getAttribute('x1')).toBe('0');
      expect(l.getAttribute('x2')).toBe(String(PLOT_WIDTH));
    });
  });

  test('AC3: y=0 gridline uses #3D4651 (darker than other gridlines)', () => {
    const data = [
      datum({ pctReturn: -100 }),
      datum({ pctReturn: 100 }),
    ];
    const { container } = renderYAxis(data);
    const zeroLine = container.querySelector('.tick[data-value="0"] line');
    expect(zeroLine).not.toBeNull();
    expect(zeroLine!.getAttribute('stroke')).toBe(ZERO_LINE_STROKE);
  });

  test('AC3: non-zero gridlines use a lighter stroke distinct from #3D4651', () => {
    const data = [
      datum({ pctReturn: -100 }),
      datum({ pctReturn: 100 }),
    ];
    const { container } = renderYAxis(data);
    const otherTicks = Array.from(container.querySelectorAll('.tick'))
      .filter((t) => t.getAttribute('data-value') !== '0');
    expect(otherTicks.length).toBeGreaterThan(0);
    otherTicks.forEach((t) => {
      const line = t.querySelector('line');
      expect(line).not.toBeNull();
      expect(line!.getAttribute('stroke')).not.toBe(ZERO_LINE_STROKE);
    });
  });

  test('AC4: tick labels formatted as "N%"', () => {
    const data = [
      datum({ pctReturn: -250 }),
      datum({ pctReturn: 500 }),
    ];
    const { container } = renderYAxis(data);
    const labels = Array.from(container.querySelectorAll('.tick text'))
      .map((t) => t.textContent);
    expect(labels).toEqual(['-250%', '0%', '250%', '500%']);
  });

  test('AC4: positive labels do not have a leading "+"', () => {
    const data = [
      datum({ pctReturn: 100 }),
      datum({ pctReturn: 600 }),
    ];
    const { container } = renderYAxis(data);
    const labels = Array.from(container.querySelectorAll('.tick text'))
      .map((t) => t.textContent ?? '');
    // domain [0, 750] → 0%, 250%, 500%, 750%
    expect(labels).toEqual(['0%', '250%', '500%', '750%']);
    labels.forEach((l) => {
      expect(l.startsWith('+')).toBe(false);
    });
  });

  test('ticks are positioned via yScale', () => {
    const data = [datum({ pctReturn: -100 }), datum({ pctReturn: 100 })];
    const yScale = buildYScale(data, PLOT_HEIGHT);
    const { container } = render(
      <svg>
        <YAxis yScale={yScale} plotWidth={PLOT_WIDTH} />
      </svg>,
    );
    const zeroTick = container.querySelector('.tick[data-value="0"]');
    expect(zeroTick!.getAttribute('transform'))
      .toBe(`translate(0, ${yScale(0)})`);
  });
});
