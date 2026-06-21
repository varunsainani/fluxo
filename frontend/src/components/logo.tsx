/** Fluxo mark: two nodes wired by a glowing edge — the trigger→action motif. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fluxo-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary-strong)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8" stroke="url(#fluxo-logo-grad)" strokeWidth="1.5" />
      <path
        d="M9 11 H15 M17 21 H23"
        stroke="url(#fluxo-logo-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M15 11 C 20 11, 12 21, 17 21" stroke="url(#fluxo-logo-grad)" strokeWidth="2" fill="none" />
      <circle cx="9" cy="11" r="2.6" fill="var(--primary-strong)" />
      <circle cx="23" cy="21" r="2.6" fill="var(--accent)" />
    </svg>
  );
}
