import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { ReactElement } from 'react';
import type { ClosedContract } from '../../pnl/index.ts';
import BubbleChart from './BubbleChart.tsx';
import { UnrealizedModeProvider, UnrealizedToggle } from '../index.ts';

const mkContract = (overrides: Partial<ClosedContract> = {}): ClosedContract => ({
  instrument: 'AAPL',
  description: 'AAPL 5/8/2026 Call $190.00',
  pl: 250,
  pctReturn: 50,
  closedQty: 5,
  costBasis: 500,
  proceeds: 750,
  grossVolume: 1250,
  closeDate: new Date(2026, 4, 8),
  openDate: new Date(2026, 4, 1),
  tradeCount: 2,
  ...overrides,
});

const findCircle = (container: HTMLElement, idPrefix: string): Element => {
  const el = container.querySelector(`circle[data-bubble-id^="${idPrefix}"]`);
  if (!el) throw new Error(`circle starting with "${idPrefix}" not found`);
  return el;
};

const getTooltip = (container: HTMLElement): HTMLElement | null => (
  container.querySelector('.hover-tooltip') as HTMLElement | null
);

describe('BubbleChart (contract grouping view)', () => {
  test('AC1: tooltip shows description + trade-fill count', () => {
    const data: ClosedContract[] = [
      mkContract({
        description: 'AAPL 5/8/2026 Call $190.00',
        pl: 374.20,
        pctReturn: 21.69,
        costBasis: 1725.20,
        closedQty: 5,
        tradeCount: 2,
      }),
    ];
    const { container } = render(
      <BubbleChart data={data} />,
    );

    expect(getTooltip(container)).toBeNull();

    const circle = findCircle(container, 'contract|');
    fireEvent.mouseEnter(circle);

    const tip = getTooltip(container);
    expect(tip).not.toBeNull();
    expect(tip).toHaveTextContent('AAPL 5/8/2026 Call $190.00');
    expect(tip).toHaveTextContent('2 trade fills');
    expect(tip).toHaveTextContent('+$374.20');
    expect(tip).toHaveTextContent('+21.7%');

    fireEvent.mouseLeave(circle);
    expect(getTooltip(container)).toBeNull();
  });

  test('AC1: singular "1 trade fill" when tradeCount===1', () => {
    const data: ClosedContract[] = [mkContract({ tradeCount: 1 })];
    const { container } = render(
      <BubbleChart data={data} />,
    );
    fireEvent.mouseEnter(findCircle(container, 'contract|'));
    expect(getTooltip(container)).toHaveTextContent('1 trade fill');
  });

  test('AC3: re-rendering with a different dataset rebuilds scales and bubbles', () => {
    const oneContract: ClosedContract[] = [mkContract({ pl: 100, pctReturn: 50 })];
    const fiveContracts: ClosedContract[] = [
      mkContract({ description: 'A', pctReturn: -100, closeDate: new Date(2026, 3, 1) }),
      mkContract({ description: 'B', pctReturn: 200, closeDate: new Date(2026, 3, 5) }),
      mkContract({ description: 'C', pctReturn: 50, closeDate: new Date(2026, 3, 9) }),
      mkContract({ description: 'D', pctReturn: -25, closeDate: new Date(2026, 3, 13) }),
      mkContract({ description: 'E', pctReturn: 600, closeDate: new Date(2026, 3, 17) }),
    ];

    const { container, rerender } = render(
      <BubbleChart data={oneContract} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    const initialChart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(initialChart.dataset.groupingMode).toBe('contract');
    expect(initialChart.dataset.bubbleCount).toBe('1');

    rerender(<BubbleChart data={fiveContracts} />);

    expect(container.querySelectorAll('circle')).toHaveLength(5);
    const updatedChart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(updatedChart.dataset.bubbleCount).toBe('5');

    const contractCircles = container.querySelectorAll('circle[data-bubble-id^="contract|"]');
    expect(contractCircles).toHaveLength(5);
  });

  test('AC4: bubble count matches dataset length', () => {
    const contracts: ClosedContract[] = [
      mkContract({ description: 'A', closeDate: new Date(2026, 3, 1) }),
      mkContract({ description: 'B', closeDate: new Date(2026, 3, 5) }),
      mkContract({ description: 'C', closeDate: new Date(2026, 3, 9) }),
    ];

    const { container } = render(
      <BubbleChart data={contracts} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });

  test('AC4: empty dataset renders zero bubbles and no tooltip', () => {
    const { container } = render(
      <BubbleChart data={[]} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(getTooltip(container)).toBeNull();
  });

  test('xad.2: axes render one X tick per distinct date and 250%-step Y gridlines', () => {
    // Two distinct close dates → 2 X ticks, one labeled per date
    // pctReturns -100/+100 → Y domain [-250, 250]: 3 ticks (-250, 0, 250)
    const data: ClosedContract[] = [
      mkContract({
        description: 'A',
        pctReturn: -100,
        closeDate: new Date(2026, 3, 5),
      }),
      mkContract({
        description: 'B',
        pctReturn: 100,
        closeDate: new Date(2026, 3, 25),
      }),
    ];
    const { container } = render(
      <BubbleChart data={data} />,
    );

    const xAxis = container.querySelector('.bubble-chart__x-axis');
    const yAxis = container.querySelector('.bubble-chart__y-axis');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();
    expect(xAxis!.querySelectorAll('.tick')).toHaveLength(2);
    expect(yAxis!.querySelectorAll('.tick')).toHaveLength(3);

    const xLabels = Array.from(xAxis!.querySelectorAll('.tick text'))
      .map((t) => t.textContent);
    expect(xLabels).toEqual(['Apr 5', 'Apr 25']);

    const yLabels = Array.from(yAxis!.querySelectorAll('.tick text'))
      .map((t) => t.textContent);
    expect(yLabels).toEqual(['-250%', '0%', '250%']);

    const zeroLine = yAxis!.querySelector('.tick[data-value="0"] line');
    expect(zeroLine!.getAttribute('stroke')).toBe('#3D4651');
  });

  test('hovering a different bubble swaps the tooltip content', () => {
    const data: ClosedContract[] = [
      mkContract({ description: 'first', pl: 100, pctReturn: 10, tradeCount: 1 }),
      mkContract({
        description: 'second',
        pl: -50,
        pctReturn: -5,
        tradeCount: 3,
        closeDate: new Date(2026, 4, 12),
      }),
    ];
    const { container } = render(
      <BubbleChart data={data} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);

    fireEvent.mouseEnter(circles[0]!);
    expect(getTooltip(container)).toHaveTextContent('first');
    expect(getTooltip(container)).toHaveTextContent('1 trade fill');

    fireEvent.mouseLeave(circles[0]!);
    fireEvent.mouseEnter(circles[1]!);
    expect(getTooltip(container)).toHaveTextContent('second');
    expect(getTooltip(container)).toHaveTextContent('3 trade fills');
  });
});

describe('BubbleChart empty result state (bubbles-xad.6)', () => {
  test('AC1: empty data shows §7.3 friendly message centered in chart card', () => {
    const { container } = render(
      <BubbleChart data={[]} />,
    );

    const wrapper = container.querySelector('.bubble-chart');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('bubble-chart--empty');
    expect((wrapper as HTMLElement).dataset.bubbleCount).toBe('0');
    expect((wrapper as HTMLElement).dataset.groupingMode).toBe('contract');

    const message = container.querySelector('.bubble-chart__empty-message');
    expect(message).not.toBeNull();
    expect(message).toHaveTextContent(
      'This file has no matched closes. All positions appear to still be open.',
    );
  });

  test('AC2: empty state does not render axes or any svg', () => {
    const { container } = render(
      <BubbleChart data={[]} />,
    );

    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.bubble-chart__x-axis')).toBeNull();
    expect(container.querySelector('.bubble-chart__y-axis')).toBeNull();
  });
});

describe('BubbleChart — unrealized bubbles + toggle (bubbles-1xy)', () => {
  const mkUnrealized = (
    overrides: Partial<import('../../pnl/index.ts').UnrealizedPosition> = {},
  ): import('../../pnl/index.ts').UnrealizedPosition => ({
    instrument: 'AAPL',
    description: 'AAPL 5/8/2026 Call $200.00',
    openQty: 2,
    costBasis: 400,
    openDate: new Date(2026, 4, 2),
    tradeCount: 1,
    currentPrice: 3,
    currentValue: 600,
    unrealizedPl: 200,
    pctReturn: 50,
    ...overrides,
  });

  const withProvider = (node: ReactElement) => render(
    <UnrealizedModeProvider>{node}</UnrealizedModeProvider>,
  );

  test('renders realized + unrealized bubbles when the mode is on (default)', () => {
    const { container } = withProvider(
      <BubbleChart data={[mkContract()]} unrealized={[mkUnrealized()]} />,
    );
    const chart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(chart.dataset.bubbleCount).toBe('1');
    expect(chart.dataset.unrealizedCount).toBe('1');
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(
      container.querySelectorAll('circle[data-bubble-id^="open|"]'),
    ).toHaveLength(1);
    const open = findCircle(container, 'open|');
    expect(open.getAttribute('data-bubble-variant')).toBe('unrealized');
    expect(open.getAttribute('stroke-dasharray')).toBe('4 3');
    // priced gain → pastel green
    expect(open.getAttribute('stroke')).toBe('#66BB6A');
  });

  test('toggling OFF hides all unrealized bubbles; realized untouched', () => {
    const { container } = withProvider(
      <>
        <UnrealizedToggle />
        <BubbleChart data={[mkContract()]} unrealized={[mkUnrealized()]} />
      </>,
    );
    expect(container.querySelectorAll('circle[data-bubble-id^="open|"]')).toHaveLength(1);

    fireEvent.click(container.querySelector('.unrealized-toggle') as HTMLElement);

    const chart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(chart.dataset.unrealizedCount).toBe('0');
    expect(container.querySelectorAll('circle[data-bubble-id^="open|"]')).toHaveLength(0);
    // realized bubble still present and solid
    const realized = findCircle(container, 'contract|');
    expect(realized.getAttribute('stroke-dasharray')).toBeNull();
    // Scope to the chart: the toggle's own icon also contains a <circle>.
    const plot = container.querySelector('.bubble-chart') as HTMLElement;
    expect(plot.querySelectorAll('circle')).toHaveLength(1);
  });

  test('un-priced open position renders a neutral dashed bubble', () => {
    const neutral = mkUnrealized({
      currentPrice: null,
      currentValue: null,
      unrealizedPl: null,
      pctReturn: null,
    });
    const { container } = withProvider(
      <BubbleChart data={[mkContract()]} unrealized={[neutral]} />,
    );
    const open = findCircle(container, 'open|');
    expect(open.getAttribute('stroke')).toBe('#9E9E9E');
    expect(open.getAttribute('stroke-dasharray')).toBe('4 3');
  });
});
