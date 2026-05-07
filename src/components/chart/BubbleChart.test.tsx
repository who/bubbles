import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { ClosedContract, ClosedTicker } from '../../pnl/index.ts';
import BubbleChart from './BubbleChart.tsx';

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

const mkTicker = (overrides: Partial<ClosedTicker> = {}): ClosedTicker => ({
  instrument: 'AAPL',
  pl: 1000,
  pctReturn: 75,
  closedQty: 25,
  costBasis: 1333,
  grossVolume: 2333,
  contracts: 4,
  closeDate: new Date(2026, 4, 8),
  openDate: new Date(2026, 4, 1),
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

describe('BubbleChart (bubbles-xad.5 grouping views)', () => {
  test('AC1: groupingMode=contract → tooltip shows description + trade-fill count', () => {
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
      <BubbleChart data={data} groupingMode="contract" />,
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

  test('AC1: groupingMode=contract — singular "1 trade fill" when tradeCount===1', () => {
    const data: ClosedContract[] = [mkContract({ tradeCount: 1 })];
    const { container } = render(
      <BubbleChart data={data} groupingMode="contract" />,
    );
    fireEvent.mouseEnter(findCircle(container, 'contract|'));
    expect(getTooltip(container)).toHaveTextContent('1 trade fill');
  });

  test('AC2: groupingMode=ticker → tooltip shows instrument + contract count', () => {
    const data: ClosedTicker[] = [
      mkTicker({
        instrument: 'PLTR',
        pl: 1245.50,
        pctReturn: 29.29,
        costBasis: 4252.00,
        closedQty: 50,
        contracts: 4,
      }),
    ];
    const { container } = render(
      <BubbleChart data={data} groupingMode="ticker" />,
    );
    fireEvent.mouseEnter(findCircle(container, 'ticker|'));

    const tip = getTooltip(container);
    expect(tip).not.toBeNull();
    expect(tip).toHaveTextContent('PLTR');
    expect(tip).toHaveTextContent('4 contracts');
    expect(tip).toHaveTextContent('+$1,245.50');
    expect(tip).toHaveTextContent('+29.3%');
  });

  test('AC2: groupingMode=ticker — singular "1 contract" when contracts===1', () => {
    const data: ClosedTicker[] = [mkTicker({ contracts: 1 })];
    const { container } = render(
      <BubbleChart data={data} groupingMode="ticker" />,
    );
    fireEvent.mouseEnter(findCircle(container, 'ticker|'));
    expect(getTooltip(container)).toHaveTextContent('1 contract');
  });

  test('AC3: re-rendering with a different dataset rebuilds scales and bubbles', () => {
    const oneContract: ClosedContract[] = [mkContract({ pl: 100, pctReturn: 50 })];
    const fiveTickers: ClosedTicker[] = [
      mkTicker({ instrument: 'A', pctReturn: -100 }),
      mkTicker({ instrument: 'B', pctReturn: 200 }),
      mkTicker({ instrument: 'C', pctReturn: 50 }),
      mkTicker({ instrument: 'D', pctReturn: -25 }),
      mkTicker({ instrument: 'E', pctReturn: 600 }),
    ];

    const { container, rerender } = render(
      <BubbleChart data={oneContract} groupingMode="contract" />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    const initialChart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(initialChart.dataset.groupingMode).toBe('contract');
    expect(initialChart.dataset.bubbleCount).toBe('1');

    rerender(<BubbleChart data={fiveTickers} groupingMode="ticker" />);

    expect(container.querySelectorAll('circle')).toHaveLength(5);
    const updatedChart = container.querySelector('.bubble-chart') as HTMLElement;
    expect(updatedChart.dataset.groupingMode).toBe('ticker');
    expect(updatedChart.dataset.bubbleCount).toBe('5');

    // All five new bubbles use ticker ids — none of the contract id remains
    const contractCircles = container.querySelectorAll('circle[data-bubble-id^="contract|"]');
    const tickerCircles = container.querySelectorAll('circle[data-bubble-id^="ticker|"]');
    expect(contractCircles).toHaveLength(0);
    expect(tickerCircles).toHaveLength(5);
  });

  test('AC4: bubble count matches active dataset length (contract & ticker modes)', () => {
    const contracts: ClosedContract[] = [
      mkContract({ description: 'A', closeDate: new Date(2026, 3, 1) }),
      mkContract({ description: 'B', closeDate: new Date(2026, 3, 5) }),
      mkContract({ description: 'C', closeDate: new Date(2026, 3, 9) }),
    ];
    const tickers: ClosedTicker[] = [
      mkTicker({ instrument: 'AAA' }),
      mkTicker({ instrument: 'BBB' }),
    ];

    const { container } = render(
      <BubbleChart data={contracts} groupingMode="contract" />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);

    const { container: c2 } = render(
      <BubbleChart data={tickers} groupingMode="ticker" />,
    );
    expect(c2.querySelectorAll('circle')).toHaveLength(2);
  });

  test('AC4: empty dataset renders zero bubbles and no tooltip', () => {
    const { container } = render(
      <BubbleChart data={[]} groupingMode="contract" />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(getTooltip(container)).toBeNull();
  });

  test('xad.2: axes render with weekly X ticks and 250%-step Y gridlines', () => {
    // Apr 5 - Apr 25 contracts → padded X domain [Apr 3, Apr 27): 4 Sundays
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
      <BubbleChart data={data} groupingMode="contract" />,
    );

    const xAxis = container.querySelector('.bubble-chart__x-axis');
    const yAxis = container.querySelector('.bubble-chart__y-axis');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();
    expect(xAxis!.querySelectorAll('.tick')).toHaveLength(4);
    expect(yAxis!.querySelectorAll('.tick')).toHaveLength(3);

    const xLabels = Array.from(xAxis!.querySelectorAll('.tick text'))
      .map((t) => t.textContent);
    expect(xLabels).toEqual(['Apr 5', 'Apr 12', 'Apr 19', 'Apr 26']);

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
      <BubbleChart data={data} groupingMode="contract" />,
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
