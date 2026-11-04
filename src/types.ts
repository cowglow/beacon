export type DisplayMode = 'static' | 'blink'

export interface Preset {
    id: string
    label: string
    bg: string
    fg: string
}

export const PRESETS: Preset[] = [
    {id: 'Sunny Yellow', label: 'Black/Yellow', bg: '#0A0A0A', fg: '#FFE14D'},
    {id: 'Warn Orange', label: 'Black/White', bg: '#0A0A0A', fg: '#FF9A3C'},
    {id: 'Hot Pink', label: 'Black/Yellow', bg: '#0A0A0A', fg: '#FF4FA3'},
    {id: 'Violet', label: 'Black/White', bg: '#0A0A0A', fg: '#9B6BFF'},
    {id: 'Sky Cyan', label: 'Cyan/Black', bg: '#0A0A0A', fg: '#4FD8FF'},
]

export const CUSTOM_PRESET_ID = 'custom'

export const MODES: { id: DisplayMode; label: string }[] = [
    {id: 'static', label: 'Static'},
    {id: 'blink', label: 'Blink'},
]
