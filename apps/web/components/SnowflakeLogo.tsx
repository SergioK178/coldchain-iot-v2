'use client';

/** Логотип Снежок — снежинка (кодовое название Coldchain IoT) */
export function SnowflakeLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22" fill="url(#logoGrad)" opacity="0.1" />
      <g stroke="url(#logoGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="24" y1="8" x2="24" y2="40" />
        <line x1="10.15" y1="16" x2="37.85" y2="32" />
        <line x1="10.15" y1="32" x2="37.85" y2="16" />
        <line x1="24" y1="8" x2="20" y2="12" />
        <line x1="24" y1="8" x2="28" y2="12" />
        <line x1="24" y1="40" x2="20" y2="36" />
        <line x1="24" y1="40" x2="28" y2="36" />
        <line x1="10.15" y1="16" x2="14" y2="16" />
        <line x1="10.15" y1="16" x2="12" y2="12.5" />
        <line x1="37.85" y1="32" x2="34" y2="32" />
        <line x1="37.85" y1="32" x2="36" y2="35.5" />
        <line x1="10.15" y1="32" x2="14" y2="32" />
        <line x1="10.15" y1="32" x2="12" y2="35.5" />
        <line x1="37.85" y1="16" x2="34" y2="16" />
        <line x1="37.85" y1="16" x2="36" y2="12.5" />
        <circle cx="24" cy="24" r="2.5" fill="url(#logoGrad)" stroke="none" />
      </g>
      <defs>
        <linearGradient id="logoGrad" x1="10" y1="10" x2="38" y2="38">
          <stop offset="0%" stopColor="#5aadff" />
          <stop offset="100%" stopColor="#3b93f0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
