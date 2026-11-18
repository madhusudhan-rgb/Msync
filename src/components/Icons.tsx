import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'music'
  | 'disc'
  | 'mic'
  | 'film'
  | 'queue'
  | 'note'
  | 'play'
  | 'pause'
  | 'previous'
  | 'next'
  | 'shuffle'
  | 'repeat'
  | 'repeat-one'
  | 'volume'
  | 'volume-low'
  | 'mute'
  | 'folder-plus'
  | 'file-plus'
  | 'refresh'
  | 'search'
  | 'close'
  | 'trash'
  | 'chevron-left'
  | 'spinner'
  | 'check'
  | 'plus';

const FILLED = { fill: 'currentColor', stroke: 'none' } as const;

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </>
  ),
  film: (
    <>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 12h20M2 7.5h5M2 16.5h5M17 7.5h5M17 16.5h5" />
    </>
  ),
  queue: (
    <>
      <path d="M21 15V6" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M12 12H3M16 6H3M12 18H3" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  play: <path d="M7 4.5v15l13-7.5z" {...FILLED} />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" {...FILLED} />
      <rect x="14" y="4" width="4" height="16" rx="1" {...FILLED} />
    </>
  ),
  previous: (
    <>
      <path d="M19 5v14l-11-7z" {...FILLED} />
      <rect x="4" y="5" width="2.6" height="14" rx="1" {...FILLED} />
    </>
  ),
  next: (
    <>
      <path d="M5 5v14l11-7z" {...FILLED} />
      <rect x="17.4" y="5" width="2.6" height="14" rx="1" {...FILLED} />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  'repeat-one': (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      <path d="M11.2 10.5h1.3v4.2" />
      <path d="M10.8 14.7h2.2" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" {...FILLED} />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  'volume-low': (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" {...FILLED} />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  mute: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" {...FILLED} />
      <path d="m16 9 5 6M21 9l-5 6" />
    </>
  ),
  'folder-plus': (
    <>
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3" />
      <path d="M18 14v8M14 18h8" />
    </>
  ),
  'file-plus': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M12 12v6M9 15h6" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  spinner: (
    <>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" opacity="0.9" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Equalizer({ active }: { active: boolean }) {
  return (
    <span className={`equalizer ${active ? 'is-active' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
