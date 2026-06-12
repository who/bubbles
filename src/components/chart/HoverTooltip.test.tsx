import { render } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { MASKED_AMOUNT } from '../format.ts';
import {
  PRIVACY_MODE_STORAGE_KEY,
  PrivacyModeProvider,
} from '../usePrivacyMode.tsx';
import HoverTooltip, {
  EDGE_THRESHOLD,
  TOOLTIP_OFFSET_X,
  TOOLTIP_OFFSET_Y,
  TOOLTIP_WIDTH,
  type ContractTooltipDatum,
  type TooltipDatum,
} from './HoverTooltip.tsx';

const contractGain: ContractTooltipDatum = {
  view: 'contract',
  name: 'AAPL 5/8/2026 Call $190.00',
  closeDate: new Date(2026, 4, 8),
  pl: 374.20,
  pctReturn: 21.69,
  costBasis: 1725.20,
  closedQty: 5,
  tradeCount: 2,
};

const contractLoss: ContractTooltipDatum = {
  view: 'contract',
  name: 'TSLA 4/30/2026 Put $250.00',
  closeDate: new Date(2026, 3, 30),
  pl: -800.50,
  pctReturn: -45.3,
  costBasis: 1766.00,
  closedQty: 3,
  tradeCount: 1,
};

const renderTooltip = (props: {
  datum: TooltipDatum | null;
  anchorX?: number;
  anchorY?: number;
  containerWidth?: number;
}) => render(
  <HoverTooltip
    datum={props.datum}
    anchorX={props.anchorX ?? 400}
    anchorY={props.anchorY ?? 300}
    containerWidth={props.containerWidth ?? 800}
  />,
);

const getTooltip = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector('.hover-tooltip');
  if (!(el instanceof HTMLElement)) throw new Error('tooltip not found');
  return el;
};

describe('HoverTooltip (PRD §7.2 + §7.3)', () => {
  test('AC1: tooltip is positioned above the bubble (translate-Y -100%)', () => {
    const { container } = renderTooltip({
      datum: contractGain,
      anchorX: 400,
      anchorY: 300,
      containerWidth: 800,
    });
    const tip = getTooltip(container);
    expect(tip.style.left).toBe(`${400 + TOOLTIP_OFFSET_X}px`);
    expect(tip.style.top).toBe(`${300 - TOOLTIP_OFFSET_Y}px`);
  });

  test('AC2: gain bubble uses gain top-border color', () => {
    const { container } = renderTooltip({ datum: contractGain });
    const tip = getTooltip(container);
    expect(tip.style.borderTopColor).toBe('rgb(46, 125, 50)');
  });

  test('AC2: loss bubble uses loss top-border color', () => {
    const { container } = renderTooltip({ datum: contractLoss });
    const tip = getTooltip(container);
    expect(tip.style.borderTopColor).toBe('rgb(198, 40, 40)');
  });

  test('AC2: pl === 0 is treated as a gain (border green)', () => {
    const zero: ContractTooltipDatum = { ...contractGain, pl: 0 };
    const { container } = renderTooltip({ datum: zero });
    const tip = getTooltip(container);
    expect(tip.style.borderTopColor).toBe('rgb(46, 125, 50)');
  });

  test('AC3: contract view renders all required fields plus trade fill count', () => {
    const { container } = renderTooltip({ datum: contractGain });
    const tip = getTooltip(container);
    expect(tip).toHaveTextContent('AAPL 5/8/2026 Call $190.00');
    expect(tip).toHaveTextContent('May 8, 2026');
    expect(tip).toHaveTextContent('+$374.20');
    expect(tip).toHaveTextContent('+21.7%');
    expect(tip).toHaveTextContent('$1,725.20');
    expect(tip).toHaveTextContent('5');
    expect(tip).toHaveTextContent('2 trade fills');
  });

  test('AC3: contract view singular-grams "1 trade fill" when tradeCount===1', () => {
    const single: ContractTooltipDatum = { ...contractGain, tradeCount: 1 };
    const { container } = renderTooltip({ datum: single });
    expect(getTooltip(container)).toHaveTextContent('1 trade fill');
  });

  test('AC3: signed P/L for losses shows negative without leading +', () => {
    const { container } = renderTooltip({ datum: contractLoss });
    const tip = getTooltip(container);
    expect(tip).toHaveTextContent('-$800.50');
    expect(tip).toHaveTextContent('-45.3%');
  });

  test('AC4: tooltip flips to bubble left when within ~150px of right edge', () => {
    const { container } = renderTooltip({
      datum: contractGain,
      anchorX: 700,
      anchorY: 300,
      containerWidth: 800,
    });
    const tip = getTooltip(container);
    expect(tip.dataset.flipped).toBe('left');
    expect(tip.style.left).toBe(`${700 - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X}px`);
  });

  test('AC4: tooltip stays on bubble right side when outside the edge threshold', () => {
    const { container } = renderTooltip({
      datum: contractGain,
      anchorX: 600,
      anchorY: 300,
      containerWidth: 800,
    });
    const tip = getTooltip(container);
    expect(tip.dataset.flipped).toBe('right');
    expect(tip.style.left).toBe(`${600 + TOOLTIP_OFFSET_X}px`);
  });

  test('AC4: edge threshold matches PRD §7.3 ~150px', () => {
    expect(EDGE_THRESHOLD).toBe(150);
    // sanity: at exactly the threshold, do not flip; one px past, flip
    const { container: c1 } = renderTooltip({
      datum: contractGain,
      anchorX: 800 - EDGE_THRESHOLD,
      anchorY: 300,
      containerWidth: 800,
    });
    expect(getTooltip(c1).dataset.flipped).toBe('right');
    const { container: c2 } = renderTooltip({
      datum: contractGain,
      anchorX: 800 - EDGE_THRESHOLD + 1,
      anchorY: 300,
      containerWidth: 800,
    });
    expect(getTooltip(c2).dataset.flipped).toBe('left');
  });

  test('renders nothing when datum is null', () => {
    const { container } = renderTooltip({ datum: null });
    expect(container.querySelector('.hover-tooltip')).toBeNull();
  });
});

describe('HoverTooltip privacy mode (bubbles-1c2)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderPrivate = (datum: TooltipDatum) => render(
    <PrivacyModeProvider>
      <HoverTooltip
        datum={datum}
        anchorX={400}
        anchorY={300}
        containerWidth={800}
      />
    </PrivacyModeProvider>,
  );

  test('privacy mode ON: P/L and cost basis are masked, % return and qty remain', () => {
    window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, 'true');
    const { container } = renderPrivate(contractGain);
    const tip = getTooltip(container);
    expect(tip).not.toHaveTextContent('+$374.20');
    expect(tip).not.toHaveTextContent('$1,725.20');
    expect(tip.querySelectorAll('dd')[0]).toHaveTextContent(MASKED_AMOUNT);
    expect(tip.querySelectorAll('dd')[2]).toHaveTextContent(MASKED_AMOUNT);
    expect(tip).toHaveTextContent('+21.7%');
    expect(tip).toHaveTextContent('5');
    expect(tip).toHaveTextContent('2 trade fills');
  });

  test('privacy mode ON: loss tooltip still gets loss border color (sizes/colors unaffected)', () => {
    window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, 'true');
    const { container } = renderPrivate(contractLoss);
    const tip = getTooltip(container);
    expect(tip.style.borderTopColor).toBe('rgb(198, 40, 40)');
    expect(tip).not.toHaveTextContent('-$800.50');
    expect(tip).toHaveTextContent('-45.3%');
  });

  test('privacy mode OFF: dollar amounts render normally', () => {
    const { container } = renderPrivate(contractGain);
    const tip = getTooltip(container);
    expect(tip).toHaveTextContent('+$374.20');
    expect(tip).toHaveTextContent('$1,725.20');
  });
});
