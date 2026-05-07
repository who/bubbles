import './ViewToggle.css';

export type ViewMode = 'contract' | 'ticker';

export interface ViewToggleCounts {
  contract: number;
  ticker: number;
}

export interface ViewToggleProps {
  value?: ViewMode;
  onChange: (next: ViewMode) => void;
  counts: ViewToggleCounts;
}

interface Option {
  key: ViewMode;
  label: string;
}

const buildOptions = (counts: ViewToggleCounts): Option[] => [
  { key: 'contract', label: `By Contract · ${counts.contract.toLocaleString('en-US')}` },
  { key: 'ticker', label: `By Ticker · ${counts.ticker.toLocaleString('en-US')}` },
];

function ViewToggle({ value = 'contract', onChange, counts }: ViewToggleProps) {
  const options = buildOptions(counts);

  return (
    <div
      className="view-toggle"
      role="radiogroup"
      aria-label="Chart grouping mode"
    >
      {options.map(({ key, label }) => {
        const isActive = key === value;
        const className = `view-toggle__option${
          isActive ? ' view-toggle__option--active' : ''
        }`;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={className}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

ViewToggle.defaultProps = {
  value: 'contract',
};

export default ViewToggle;
