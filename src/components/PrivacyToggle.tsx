import { usePrivacyMode } from './usePrivacyMode.tsx';
import './PrivacyToggle.css';

function EyeIcon() {
  return (
    <svg
      className="privacy-toggle__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="privacy-toggle__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <line
        x1="4"
        y1="20"
        x2="20"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PrivacyToggle() {
  const { privacyMode, setPrivacyMode } = usePrivacyMode();

  return (
    <button
      type="button"
      className="privacy-toggle"
      aria-label={privacyMode ? 'Show dollar amounts' : 'Hide dollar amounts'}
      aria-pressed={privacyMode}
      onClick={() => setPrivacyMode(!privacyMode)}
    >
      {privacyMode ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

export default PrivacyToggle;
