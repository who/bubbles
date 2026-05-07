import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ErrorBanner from './ErrorBanner.tsx';

const SECTION_9_MESSAGES = [
  'Only .csv files are supported.',
  'This file is empty.',
  "Couldn't find required column: Trans Code. Is this a Robinhood activity export?",
  "We couldn't parse any rows. Please check the file format.",
  'File is unusually large for an activity export. Max 50MB.',
];

describe('ErrorBanner', () => {
  test('AC1: renders the message verbatim inside a role="alert" container', () => {
    const message = 'This file is empty.';
    render(<ErrorBanner message={message} onDismiss={() => {}} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(message);
  });

  test.each(SECTION_9_MESSAGES)(
    'AC1: renders §9 message verbatim — "%s"',
    (message) => {
      const { unmount } = render(
        <ErrorBanner message={message} onDismiss={() => {}} />,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      unmount();
    },
  );

  test('AC2: renders a × dismiss button that invokes onDismiss', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="oops" onDismiss={onDismiss} />);

    const dismiss = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismiss).toHaveTextContent('×');

    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('AC3: does NOT auto-dismiss — banner remains after time passes', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<ErrorBanner message="persist me" onDismiss={onDismiss} />);

      vi.advanceTimersByTime(60_000);

      expect(screen.getByRole('alert')).toHaveTextContent('persist me');
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('unmounts on parent state change (controlled by parent)', () => {
    function Host() {
      const [show, setShow] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShow(false)}>
            hide
          </button>
          {show ? <ErrorBanner message="bye" onDismiss={() => {}} /> : null}
        </>
      );
    }

    render(<Host />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'hide' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('clicking dismiss in a controlled host removes the banner', () => {
    function Host() {
      const [message, setMessage] = useState<string | null>('boom');
      if (!message) return <p>cleared</p>;
      return (
        <ErrorBanner message={message} onDismiss={() => setMessage(null)} />
      );
    }

    render(<Host />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');

    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('cleared')).toBeInTheDocument();
  });
});
