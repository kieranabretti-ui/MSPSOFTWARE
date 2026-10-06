// The brand colours as hex values, for the places CSS variables cannot reach:
// chart props and the PDF report. brand/brand-tokens.css is the source of
// truth; tokens.test.ts fails if these drift from it.

export const color = {
  ink: '#0a0b0d',
  bone: '#edeef0',
  accent: '#c4f25b',
  accentHover: '#d4f87f',
  accentDeep: '#4d6b00',
  background: '#0a0b0d',
  surface: '#111316',
  surfaceRaised: '#181b1f',
  border: '#262a30',
  borderMuted: '#1b1e22',
  borderStrong: '#363b43',
  text: '#edeef0',
  textSecondary: '#a9afb8',
  muted: '#7f8690',
  faint: '#5b616a',
  success: '#4cd18f',
  warning: '#f2b84b',
  danger: '#f2735f',
  info: '#74a9f6',
} as const

export const viz = {
  positive: color.accent,
  series: '#3d434c',
  seriesStrong: '#6a717b',
  grid: '#1c1f24',
  axis: '#7f8690',
  categorical: ['#7fa421', '#4a8ee0', '#c96f38', '#a174e6'] as const,
  other: '#4c525b',
} as const

// Paper: the PDF report and print.
export const paper = {
  background: '#ffffff',
  surfaceSunken: '#f6f7f8',
  surfaceRaised: '#f1f2f4',
  border: '#dfe2e6',
  borderMuted: '#eceef1',
  text: '#0a0b0d',
  textSecondary: '#464c55',
  muted: '#636a74',
  success: '#17804d',
  warning: '#9a6200',
  danger: '#c2412d',
  info: '#2563c4',
} as const

export const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
