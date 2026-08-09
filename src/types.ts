export type DisplayMode = 'static' | 'blink'

export interface Preset {
  id: string
  label: string
  bg: string
  fg: string
}

export const PRESETS: Preset[] = [
  { id: 'classic', label: 'Black/Yellow', bg: '#000000', fg: '#ffd400' },
  { id: 'mono', label: 'Black/White', bg: '#000000', fg: '#ffffff' },
]

export const CUSTOM_PRESET_ID = 'custom'

export const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'static', label: 'Static' },
  { id: 'blink', label: 'Blink' },
]
