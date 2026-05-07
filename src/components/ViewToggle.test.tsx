import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ViewToggle from './ViewToggle.tsx';

const counts = { contract: 102, ticker: 64 };

describe('ViewToggle', () => {
  test('AC1: renders two radio buttons with the active one pressed', () => {
    render(<ViewToggle value="contract" onChange={() => {}} counts={counts} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(2);
    const contractBtn = screen.getByRole('radio', { name: 'By Contract · 102' });
    const tickerBtn = screen.getByRole('radio', { name: 'By Ticker · 64' });
    expect(contractBtn).toHaveAttribute('aria-checked', 'true');
    expect(tickerBtn).toHaveAttribute('aria-checked', 'false');
    expect(contractBtn.className).toContain('view-toggle__option--active');
    expect(tickerBtn.className).not.toContain('view-toggle__option--active');
  });

  test('AC1: switching value flips the active state', () => {
    render(<ViewToggle value="ticker" onChange={() => {}} counts={counts} />);
    const contractBtn = screen.getByRole('radio', { name: 'By Contract · 102' });
    const tickerBtn = screen.getByRole('radio', { name: 'By Ticker · 64' });
    expect(tickerBtn).toHaveAttribute('aria-checked', 'true');
    expect(contractBtn).toHaveAttribute('aria-checked', 'false');
    expect(tickerBtn.className).toContain('view-toggle__option--active');
  });

  test('AC2: each button label shows the count', () => {
    render(<ViewToggle value="contract" onChange={() => {}} counts={counts} />);
    expect(screen.getByRole('radio', { name: 'By Contract · 102' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'By Ticker · 64' })).toBeInTheDocument();
  });

  test('AC2: counts format with thousands separators', () => {
    render(
      <ViewToggle
        value="contract"
        onChange={() => {}}
        counts={{ contract: 1234, ticker: 5678 }}
      />,
    );
    expect(screen.getByRole('radio', { name: 'By Contract · 1,234' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'By Ticker · 5,678' })).toBeInTheDocument();
  });

  test('AC3: clicking By Ticker calls onChange with "ticker"', () => {
    const onChange = vi.fn();
    render(<ViewToggle value="contract" onChange={onChange} counts={counts} />);
    fireEvent.click(screen.getByRole('radio', { name: 'By Ticker · 64' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ticker');
  });

  test('AC3: clicking By Contract calls onChange with "contract"', () => {
    const onChange = vi.fn();
    render(<ViewToggle value="ticker" onChange={onChange} counts={counts} />);
    fireEvent.click(screen.getByRole('radio', { name: 'By Contract · 102' }));
    expect(onChange).toHaveBeenCalledWith('contract');
  });

  test('AC4: default value is "contract" when value prop omitted', () => {
    render(<ViewToggle onChange={() => {}} counts={counts} />);
    const contractBtn = screen.getByRole('radio', { name: 'By Contract · 102' });
    const tickerBtn = screen.getByRole('radio', { name: 'By Ticker · 64' });
    expect(contractBtn).toHaveAttribute('aria-checked', 'true');
    expect(tickerBtn).toHaveAttribute('aria-checked', 'false');
  });

  test('renders inside a radiogroup', () => {
    render(<ViewToggle value="contract" onChange={() => {}} counts={counts} />);
    expect(screen.getByRole('radiogroup', { name: 'Chart grouping mode' })).toBeInTheDocument();
  });
});
