import { useUnrealizedMode } from './useUnrealizedMode.tsx';
import './UnrealizedToggle.css';

// A dashed-outline bubble, echoing how unrealized positions render on the chart.
function DashedBubbleIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="unrealized-toggle__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="7"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.25 : 0}
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 2.5"
      />
    </svg>
  );
}

function UnrealizedToggle() {
  const { unrealizedMode, setUnrealizedMode } = useUnrealizedMode();

  return (
    <button
      type="button"
      className="unrealized-toggle"
      aria-label={unrealizedMode ? 'Hide unrealized bubbles' : 'Show unrealized bubbles'}
      aria-pressed={unrealizedMode}
      onClick={() => setUnrealizedMode(!unrealizedMode)}
    >
      <DashedBubbleIcon filled={unrealizedMode} />
    </button>
  );
}

export default UnrealizedToggle;
