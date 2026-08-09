import type { DisplayMode } from './types.ts'
import { fitText } from './textfit.ts'

export interface DisplayColors {
  bg: string
  fg: string
}

export class DisplayScreen {
  private root: HTMLElement
  private onExit: () => void
  private textEl: HTMLElement
  private wakeLock: WakeLockSentinel | null = null
  private active = false

  constructor(root: HTMLElement, onExit: () => void) {
    this.root = root
    this.onExit = onExit
    this.root.innerHTML = '<div class="display-text"></div>'
    this.textEl = this.root.querySelector('.display-text')!

    this.root.addEventListener('click', () => this.exit())
    window.addEventListener('resize', () => this.refit())
    window.addEventListener('orientationchange', () => this.refit())
    document.addEventListener('visibilitychange', () => {
      if (this.active && document.visibilityState === 'visible') void this.requestWakeLock()
    })
  }

  async show(text: string, colors: DisplayColors, mode: DisplayMode) {
    this.active = true

    this.root.style.setProperty('--preset-bg', colors.bg)
    this.root.style.setProperty('--preset-fg', colors.fg)
    this.root.style.background = colors.bg
    this.textEl.style.color = colors.fg
    this.textEl.textContent = text

    this.root.classList.remove('mode-static', 'mode-blink')
    this.root.classList.add(`mode-${mode}`)

    try {
      // Fullscreen the <html> root, not this element: a fullscreened element is
      // rendered in the top layer, which force-stretches it to the viewport and
      // silently defeats the CSS rotation fallback below.
      await document.documentElement.requestFullscreen?.()
    } catch {
      // fullscreen unavailable/denied — the CSS overlay already covers the viewport
    }
    try {
      await screen.orientation?.lock?.('landscape')
    } catch {
      // unsupported — CSS rotation fallback below handles portrait holds
    }

    await this.requestWakeLock()
    this.refit()
  }

  private async requestWakeLock() {
    try {
      this.wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      this.wakeLock = null
    }
  }

  private applyRotationFallback() {
    const portrait = window.matchMedia('(orientation: portrait)').matches
    this.root.classList.toggle('rotate-fallback', portrait)
  }

  private refit() {
    if (!this.active) return
    this.applyRotationFallback()
    fitText(this.textEl, this.root)
  }

  async exit() {
    if (!this.active) return
    this.active = false

    try {
      await this.wakeLock?.release()
    } catch {
      // already released
    }
    this.wakeLock = null

    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      // ignore
    }
    try {
      screen.orientation?.unlock?.()
    } catch {
      // ignore
    }

    this.root.classList.remove('rotate-fallback')
    this.onExit()
  }
}
