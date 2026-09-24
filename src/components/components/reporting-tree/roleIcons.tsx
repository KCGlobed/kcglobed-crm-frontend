// roleIcons.tsx
import React from "react";

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const CrownIcon = () => (
  <svg {...iconProps}>
    <path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z" />
    <path d="M5 21h14" />
  </svg>
);

export const ShieldIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const BriefcaseIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

export const MedalIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="15" r="5" />
    <path d="M9 3h6l-2 7h-2L9 3z" />
    <path d="M10.5 13.5l3 3" />
  </svg>
);

export const UserIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
  </svg>
);

/** Case-insensitive role -> icon lookup, with a sane default. */
const ROLE_ICON_TABLE: Array<{ match: RegExp; icon: React.ReactNode }> = [
  { match: /super\s*admin/i, icon: <CrownIcon /> },
  { match: /admin/i, icon: <ShieldIcon /> },
  { match: /sales/i, icon: <BriefcaseIcon /> },
  { match: /director/i, icon: <MedalIcon /> },
];

export function getRoleIcon(
  role: string,
  overrides?: Record<string, React.ReactNode>
): React.ReactNode {
  if (overrides) {
    const exact = Object.keys(overrides).find(
      (key) => key.toLowerCase() === role.toLowerCase()
    );
    if (exact) return overrides[exact];
  }

  const found = ROLE_ICON_TABLE.find((entry) => entry.match.test(role));
  return found ? found.icon : <UserIcon />;
}
