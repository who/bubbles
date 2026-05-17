import { useTheme } from './useTheme.ts';
import './ThemeToggle.css';

function SunIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
        <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      aria-pressed={isDark}
      onClick={() => setTheme(next)}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export default ThemeToggle;
