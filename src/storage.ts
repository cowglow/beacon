import type { DisplayMode } from './types.ts'

const RECENTS_KEY = 'beacon:recents'
const SETTINGS_KEY = 'beacon:settings'
const DRAFT_KEY = 'beacon:draft'
const MAX_RECENTS = 10

const STARTER_RECENTS = ['.bass', 'I ❤️ Bass', 'dotbassnbg', 'TAXI']

export interface Settings {
  presetId: string
  mode: DisplayMode
  customBg: string
  customFg: string
}

const DEFAULT_SETTINGS: Settings = {
  presetId: 'Sunny Yellow',
  mode: 'blink',
  customBg: '#0A0A0A',
  customFg: '#C8F25A',
}

export function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch {
    // corrupt storage, fall through to reseed
  }
  localStorage.setItem(RECENTS_KEY, JSON.stringify(STARTER_RECENTS))
  return STARTER_RECENTS
}

export function addRecent(message: string): string[] {
  const existing = getRecents().filter((m) => m !== message)
  const updated = [message, ...existing].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  return updated
}

export function removeRecent(message: string): string[] {
  const updated = getRecents().filter((m) => m !== message)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  return updated
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // corrupt storage, fall through to defaults
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function getDraft(): string {
  return localStorage.getItem(DRAFT_KEY) ?? '.bass'
}

export function saveDraft(text: string) {
  localStorage.setItem(DRAFT_KEY, text)
}
