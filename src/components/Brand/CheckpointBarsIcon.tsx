interface CheckpointBarsIconProps {
  size?: number;
  className?: string;
}

/**
 * The FocusFlow logomark: variable-height bars representing a custom-built
 * cycle schedule, with one bar carrying a pin at its exact resume point —
 * the same precision the product uses recovering an interrupted session.
 *
 * Per brand guide: bars always render in the surrounding text color
 * (currentColor) and are never recolored; the pin is the only element
 * permitted to carry the Amber accent, and always does.
 */
export default function CheckpointBarsIcon({ size = 20, className }: CheckpointBarsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="20" y="120" width="22" height="50" rx="4" fill="currentColor" />
      <rect x="56" y="85" width="22" height="85" rx="4" fill="currentColor" />
      <rect x="92" y="50" width="22" height="120" rx="4" fill="currentColor" />
      <rect x="128" y="100" width="22" height="70" rx="4" fill="currentColor" />
      <rect x="164" y="130" width="22" height="40" rx="4" fill="currentColor" />
      {/* checkpoint pin — the one element allowed to carry Amber */}
      <line x1="114" y1="92" x2="134" y2="92" stroke="#E8A23D" strokeWidth="4" strokeLinecap="round" />
      <circle cx="139" cy="92" r="9" fill="#E8A23D" />
    </svg>
  );
}
