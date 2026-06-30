import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Bubbles, { type BubbleDatum } from './Bubbles.tsx';
import { buildRScale, buildXScale, buildYScale } from './scales.ts';

const fixture: readonly BubbleDatum[] = [
  { id: 'a', closeDate: new Date(2026, 3, 5), pctReturn: 50, pl: 200 },
  { id: 'b', closeDate: new Date(2026, 3, 10), pctReturn: 100, pl: 1500 },
  { id: 'c', closeDate: new Date(2026, 3, 15), pctReturn: 25, pl: 800 },
  { id: 'd', closeDate: new Date(2026, 3, 20), pctReturn: -30, pl: -400 },
  { id: 'e', closeDate: new Date(2026, 3, 25), pctReturn: -75, pl: -1200 },
];

const renderBubbles = (data: readonly BubbleDatum[] = fixture) => {
  const xScale = buildXScale(data, 800);
  const yScale = buildYScale(data, 540);
  const rScale = buildRScale(data);
  const result = render(
    <svg>
      <Bubbles data={data} xScale={xScale} yScale={yScale} rScale={rScale} />
    </svg>,
  );
  return { ...result, xScale, yScale, rScale };
};

const findById = (container: HTMLElement, id: string): Element => {
  const el = container.querySelector(`[data-bubble-id="${id}"]`);
  if (!el || el.tagName.toLowerCase() !== 'circle') {
    throw new Error(`circle with id "${id}" not found`);
  }
  return el;
};

describe('Bubbles (PRD §7.2 bubble rendering)', () => {
  test('AC1: each datum becomes one <circle>', () => {
    const { container } = renderBubbles();
    expect(container.querySelectorAll('circle')).toHaveLength(fixture.length);
  });

  test('AC1: cx/cy/r come from the scales', () => {
    const data: readonly BubbleDatum[] = [
      { id: 'x', closeDate: new Date(2026, 3, 15), pctReturn: 100, pl: 500 },
    ];
    const { container, xScale, yScale, rScale } = renderBubbles(data);
    const [datum] = data;
    if (!datum) throw new Error('fixture missing');
    const circle = findById(container, 'x');
    expect(circle.getAttribute('cx')).toBe(String(xScale(datum.closeDate)));
    expect(circle.getAttribute('cy')).toBe(String(yScale(datum.pctReturn)));
    expect(circle.getAttribute('r')).toBe(String(rScale(Math.abs(datum.pl))));
  });

  test('AC2: gain bubbles use the gain palette', () => {
    const { container } = renderBubbles();
    const gain = findById(container, 'a');
    expect(gain.getAttribute('stroke')).toBe('#2E7D32');
    expect(gain.getAttribute('fill')).toBe('rgba(76,175,80,0.22)');
  });

  test('AC2: loss bubbles use the loss palette', () => {
    const { container } = renderBubbles();
    const loss = findById(container, 'd');
    expect(loss.getAttribute('stroke')).toBe('#C62828');
    expect(loss.getAttribute('fill')).toBe('rgba(229,57,53,0.22)');
  });

  test('AC2: pl === 0 is treated as a gain', () => {
    const data: readonly BubbleDatum[] = [
      { id: 'zero', closeDate: new Date(2026, 3, 15), pctReturn: 0, pl: 0 },
    ];
    const { container } = renderBubbles(data);
    const circle = findById(container, 'zero');
    expect(circle.getAttribute('stroke')).toBe('#2E7D32');
  });

  test('AC3: DOM order is largest |pl| first', () => {
    const { container } = renderBubbles();
    const ids = Array.from(container.querySelectorAll('circle'))
      .map((c) => c.getAttribute('data-bubble-id'));
    // |pl| desc: b(1500), e(1200), c(800), d(400), a(200)
    expect(ids).toEqual(['b', 'e', 'c', 'd', 'a']);
  });

  test('AC3: input order does not matter (sort is internal)', () => {
    const reversed: readonly BubbleDatum[] = [...fixture].reverse();
    const { container } = renderBubbles(reversed);
    const ids = Array.from(container.querySelectorAll('circle'))
      .map((c) => c.getAttribute('data-bubble-id'));
    expect(ids).toEqual(['b', 'e', 'c', 'd', 'a']);
  });

  test('AC4: default stroke-width is 1.5', () => {
    const { container } = renderBubbles();
    const circles = Array.from(container.querySelectorAll('circle'));
    circles.forEach((c) => {
      expect(c.getAttribute('stroke-width')).toBe('1.5');
    });
  });

  test('AC4: hovered bubble stroke widens to 2.5', () => {
    const { container } = renderBubbles();
    const target = findById(container, 'b');
    expect(target.getAttribute('stroke-width')).toBe('1.5');
    fireEvent.mouseEnter(target);
    expect(target.getAttribute('stroke-width')).toBe('2.5');
    fireEvent.mouseLeave(target);
    expect(target.getAttribute('stroke-width')).toBe('1.5');
  });

  test('AC4: only the hovered bubble widens (others stay at 1.5)', () => {
    const { container } = renderBubbles();
    const target = findById(container, 'b');
    fireEvent.mouseEnter(target);
    const others = Array.from(container.querySelectorAll('circle'))
      .filter((c) => c.getAttribute('data-bubble-id') !== 'b');
    others.forEach((c) => {
      expect(c.getAttribute('stroke-width')).toBe('1.5');
    });
  });

  test('renders no circles for empty data', () => {
    const { container } = renderBubbles([]);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });
});

describe('Bubbles — unrealized variant (bubbles-1xy)', () => {
  test('unrealized gain uses the pastel gain palette and a dashed outline', () => {
    const data: readonly BubbleDatum[] = [
      {
        id: 'u', closeDate: new Date(2026, 3, 15), pctReturn: 30, pl: 250, variant: 'unrealized',
      },
    ];
    const { container } = renderBubbles(data);
    const circle = findById(container, 'u');
    expect(circle.getAttribute('stroke')).toBe('#66BB6A');
    expect(circle.getAttribute('fill')).toBe('rgba(129,199,132,0.18)');
    expect(circle.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(circle.getAttribute('data-bubble-variant')).toBe('unrealized');
  });

  test('unrealized loss uses the pastel loss palette and a dashed outline', () => {
    const data: readonly BubbleDatum[] = [
      {
        id: 'u', closeDate: new Date(2026, 3, 15), pctReturn: -30, pl: -250, variant: 'unrealized',
      },
    ];
    const { container } = renderBubbles(data);
    const circle = findById(container, 'u');
    expect(circle.getAttribute('stroke')).toBe('#EF5350');
    expect(circle.getAttribute('fill')).toBe('rgba(239,154,154,0.18)');
    expect(circle.getAttribute('stroke-dasharray')).toBe('4 3');
  });

  test('un-priced (neutral) unrealized renders neutral color, dashed, sized off magnitude', () => {
    const data: readonly BubbleDatum[] = [
      {
        id: 'n',
        closeDate: new Date(2026, 3, 15),
        pctReturn: 0,
        pl: 0,
        magnitude: 800,
        variant: 'unrealized',
        neutral: true,
      },
    ];
    const { container, rScale } = renderBubbles(data);
    const circle = findById(container, 'n');
    expect(circle.getAttribute('stroke')).toBe('#9E9E9E');
    expect(circle.getAttribute('fill')).toBe('rgba(158,158,158,0.15)');
    expect(circle.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(circle.getAttribute('r')).toBe(String(rScale(800)));
  });

  test('realized bubbles are unaffected: solid palette, no dasharray', () => {
    const data: readonly BubbleDatum[] = [
      {
        id: 'r', closeDate: new Date(2026, 3, 15), pctReturn: 30, pl: 250, variant: 'realized',
      },
    ];
    const { container } = renderBubbles(data);
    const circle = findById(container, 'r');
    expect(circle.getAttribute('stroke')).toBe('#2E7D32');
    expect(circle.getAttribute('fill')).toBe('rgba(76,175,80,0.22)');
    expect(circle.getAttribute('stroke-dasharray')).toBeNull();
    expect(circle.getAttribute('data-bubble-variant')).toBe('realized');
  });
});
