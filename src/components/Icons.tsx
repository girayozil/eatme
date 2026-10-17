import type { ReactNode } from 'react'

function Svg({ size = 24, width = 2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const SettingsIcon = () => (
  <Svg size={22}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
)

export const ChevronLeft = ({ size = 24 }: { size?: number }) => (
  <Svg size={size} width={2.2}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)

export const ChevronRight = ({ size = 24 }: { size?: number }) => (
  <Svg size={size} width={2.2}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const PlusIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} width={2.4}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const MinusIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} width={2.4}>
    <path d="M5 12h14" />
  </Svg>
)

export const CheckIcon = () => (
  <Svg size={22} width={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)

export const CloseIcon = () => (
  <Svg size={20} width={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const TodayIcon = () => (
  <Svg size={26}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Svg>
)

export const MenuIcon = () => (
  <Svg size={26}>
    <path d="M9 7h11M9 12h11M9 17h11" />
    <circle cx="5" cy="7" r="1" />
    <circle cx="5" cy="12" r="1" />
    <circle cx="5" cy="17" r="1" />
  </Svg>
)

export const TrendsIcon = () => (
  <Svg size={26}>
    <path d="M5 20V12M12 20V5M19 20v-9" />
  </Svg>
)
