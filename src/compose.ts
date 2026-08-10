import { PRESETS, CUSTOM_PRESET_ID, MODES, type DisplayMode } from './types.ts'
import type { DisplayColors } from './display.ts'
import { getRecents, addRecent, removeRecent, getSettings, saveSettings, getDraft, saveDraft } from './storage.ts'
import { promptInstall, isStandalone } from './onboarding.ts'

const COG_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
`

export type GoHandler = (text: string, colors: DisplayColors, mode: DisplayMode) => void

const LONG_PRESS_MS = 550

export class ComposeScreen {
  private root: HTMLElement
  private onGo: GoHandler
  private textarea: HTMLTextAreaElement
  private drawer: HTMLElement
  private recentsList: HTMLElement
  private deleteDialog: HTMLDialogElement
  private deleteTargetEl: HTMLElement
  private customSwatch: HTMLButtonElement
  private customFgBtn: HTMLButtonElement
  private presetId: string
  private mode: DisplayMode
  private customBg: string
  private customFg: string
  private pendingDeleteMessage: string | null = null

  constructor(root: HTMLElement, onGo: GoHandler) {
    this.root = root
    this.onGo = onGo
    const settings = getSettings()
    this.presetId = settings.presetId
    this.mode = settings.mode
    this.customBg = settings.customBg
    this.customFg = settings.customFg

    this.root.innerHTML = `
      <button type="button" id="install-cog-btn" class="install-cog-btn" aria-label="Install app">
        ${COG_ICON_SVG}
      </button>
      <textarea
        id="message-input"
        placeholder="TYPE YOUR SIGN"
        maxlength="140"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
      ></textarea>
      <div class="controls">
        <div class="row presets" role="group" aria-label="Style">
          ${PRESETS.map(
            (p) =>
              `<button type="button" class="swatch" data-preset="${p.id}" style="background:${p.bg};color:${p.fg}" aria-label="${p.label}">Aa</button>`,
          ).join('')}
          <div class="custom-swatch-wrap">
            <button type="button" class="swatch" id="custom-swatch" data-preset="${CUSTOM_PRESET_ID}" style="background:${this.customBg};color:${this.customFg}" aria-label="Custom background color">Aa</button>
            <button type="button" id="custom-fg-btn" class="custom-fg-btn" style="background:${this.customFg}" aria-label="Toggle text color black or white"></button>
            <input type="color" id="custom-bg-input" class="color-input-hidden" value="${this.customBg}" tabindex="-1" />
          </div>
        </div>
        <div class="row modes" role="group" aria-label="Display mode">
          ${MODES.map((m) => `<button type="button" class="mode-btn" data-mode="${m.id}">${m.label}</button>`).join('')}
        </div>
        <button type="button" id="go-btn">GO</button>
      </div>
      <button type="button" id="recents-toggle">Recents</button>
      <div id="recents-drawer" class="drawer">
        <ul id="recents-list"></ul>
      </div>
      <dialog id="delete-dialog" class="confirm-dialog">
        <p class="dialog-message">Remove "<span id="delete-target"></span>" from Recents?</p>
        <div class="dialog-actions">
          <button type="button" id="dialog-keep" class="dialog-btn keep">Keep</button>
          <button type="button" id="dialog-remove" class="dialog-btn remove">Remove</button>
        </div>
      </dialog>
    `

    this.textarea = this.root.querySelector('#message-input')!
    this.textarea.value = getDraft()
    this.drawer = this.root.querySelector('#recents-drawer')!
    this.recentsList = this.root.querySelector('#recents-list')!
    this.deleteDialog = this.root.querySelector('#delete-dialog')!
    this.deleteTargetEl = this.root.querySelector('#delete-target')!
    this.customSwatch = this.root.querySelector('#custom-swatch')!
    this.customFgBtn = this.root.querySelector('#custom-fg-btn')!

    this.applyPresetSelection()
    this.applyModeSelection()
    this.renderRecents()
    this.wireEvents()
  }

  focusInput() {
    this.textarea.focus()
  }

  private wireEvents() {
    const installCogBtn = this.root.querySelector<HTMLButtonElement>('#install-cog-btn')!
    if (isStandalone()) {
      installCogBtn.classList.add('hidden')
    } else {
      installCogBtn.addEventListener('click', () => void promptInstall())
    }

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.go()
      }
    })
    this.textarea.addEventListener('input', () => saveDraft(this.textarea.value))

    this.root.querySelectorAll<HTMLButtonElement>('.swatch[data-preset]:not(#custom-swatch)').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.presetId = btn.dataset.preset!
        this.saveCurrentSettings()
        this.applyPresetSelection()
      })
    })

    const customBgInput = this.root.querySelector<HTMLInputElement>('#custom-bg-input')!

    this.customSwatch.addEventListener('click', () => {
      this.presetId = CUSTOM_PRESET_ID
      this.applyPresetSelection()
      this.saveCurrentSettings()
      customBgInput.click()
    })
    this.customFgBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.presetId = CUSTOM_PRESET_ID
      this.customFg = this.customFg === '#ffffff' ? '#000000' : '#ffffff'
      this.customSwatch.style.color = this.customFg
      this.customFgBtn.style.background = this.customFg
      this.applyPresetSelection()
      this.saveCurrentSettings()
    })
    customBgInput.addEventListener('input', () => {
      this.customBg = customBgInput.value
      this.customSwatch.style.background = this.customBg
      this.saveCurrentSettings()
    })

    this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode as DisplayMode
        this.saveCurrentSettings()
        this.applyModeSelection()
      })
    })

    this.root.querySelector('#go-btn')!.addEventListener('click', () => this.go())
    this.root.querySelector('#recents-toggle')!.addEventListener('click', () => {
      this.drawer.classList.toggle('open')
    })

    this.root.querySelector('#dialog-keep')!.addEventListener('click', () => this.deleteDialog.close())
    this.root.querySelector('#dialog-remove')!.addEventListener('click', () => {
      if (this.pendingDeleteMessage !== null) {
        removeRecent(this.pendingDeleteMessage)
        this.pendingDeleteMessage = null
        this.renderRecents()
      }
      this.deleteDialog.close()
    })
  }

  private saveCurrentSettings() {
    saveSettings({
      presetId: this.presetId,
      mode: this.mode,
      customBg: this.customBg,
      customFg: this.customFg,
    })
  }

  private resolveColors(): DisplayColors {
    if (this.presetId === CUSTOM_PRESET_ID) return { bg: this.customBg, fg: this.customFg }
    const preset = PRESETS.find((p) => p.id === this.presetId) ?? PRESETS[0]
    return { bg: preset.bg, fg: preset.fg }
  }

  private applyPresetSelection() {
    this.root.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.preset === this.presetId)
    })
  }

  private applyModeSelection() {
    this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.mode === this.mode)
    })
  }

  private renderRecents() {
    const recents = getRecents()
    this.recentsList.innerHTML = recents
      .map((_, i) => `<li><button type="button" class="recent-item" data-index="${i}"></button></li>`)
      .join('')
    this.recentsList.querySelectorAll<HTMLButtonElement>('.recent-item').forEach((btn, i) => {
      btn.textContent = recents[i]
      this.wireRecentItem(btn, recents[i])
    })
  }

  private wireRecentItem(btn: HTMLButtonElement, message: string) {
    let pressTimer = 0
    let longPressFired = false
    let clickTimer = 0

    const startPress = () => {
      longPressFired = false
      pressTimer = window.setTimeout(() => {
        longPressFired = true
        this.confirmDelete(message)
      }, LONG_PRESS_MS)
    }
    const cancelPress = () => window.clearTimeout(pressTimer)

    btn.addEventListener('touchstart', startPress)
    btn.addEventListener('touchend', cancelPress)
    btn.addEventListener('touchmove', cancelPress)
    btn.addEventListener('contextmenu', (e) => e.preventDefault())

    btn.addEventListener('dblclick', (e) => {
      e.preventDefault()
      window.clearTimeout(clickTimer)
      this.confirmDelete(message)
    })

    btn.addEventListener('click', () => {
      if (longPressFired) {
        longPressFired = false
        return
      }
      // A double-click is two `click` events followed by `dblclick`. Delay the
      // load-into-textarea action so a following dblclick can cancel it instead
      // of loading the message and collapsing the drawer out from under it.
      window.clearTimeout(clickTimer)
      clickTimer = window.setTimeout(() => {
        this.textarea.value = message
        saveDraft(message)
        this.drawer.classList.remove('open')
        this.textarea.focus()
      }, 300)
    })
  }

  private confirmDelete(message: string) {
    this.pendingDeleteMessage = message
    this.deleteTargetEl.textContent = message
    this.deleteDialog.showModal()
  }

  private go() {
    const text = this.textarea.value.trim()
    if (!text) return
    addRecent(text)
    this.renderRecents()
    this.onGo(text, this.resolveColors(), this.mode)
  }
}
