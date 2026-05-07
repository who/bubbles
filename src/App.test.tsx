import { render, screen } from '@testing-library/react';
import App from './App.tsx';

test('renders the PnL Bubbles heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /PnL Bubbles/i })).toBeInTheDocument();
});
