const SPLASH_SEEN_KEY = 'beacon:splash-seen'
const INSTALL_PROMPT_SEEN_KEY = 'beacon:install-prompt-seen'
const SPLASH_DURATION_MS = 3000

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// Must be registered at module load, before this async boot sequence ever
// awaits, or the browser can fire the event before we're listening for it.
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstallPrompt = e as BeforeInstallPromptEvent
})

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function runBoot(root: HTMLElement): Promise<void> {
  if (!localStorage.getItem(SPLASH_SEEN_KEY)) {
    localStorage.setItem(SPLASH_SEEN_KEY, '1')
    await showSplash(root)
  }

  if (!isStandalone() && !localStorage.getItem(INSTALL_PROMPT_SEEN_KEY)) {
    await showInstallScreen(root)
  }
}

function showSplash(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    root.innerHTML = `
      <div class="splash-screen">
        <div class="splash-mark">BEACON</div>
        <div class="splash-bar"><div class="splash-bar-fill"></div></div>
      </div>
    `
    window.setTimeout(resolve, SPLASH_DURATION_MS)
  })
}

function showInstallScreen(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    root.innerHTML = `
      <div class="install-screen">
        <div class="install-mark">BEACON</div>
        <p class="install-copy">Install Beacon for instant, full-screen access next time.</p>
        <button type="button" id="install-btn" class="install-btn">Install App</button>
        <button type="button" id="continue-btn" class="continue-btn">Continue to Website</button>
        <p id="ios-instructions" class="ios-instructions hidden">
          Tap the <strong>Share</strong> icon, then <strong>Add to Home Screen</strong>.
        </p>
      </div>
    `

    const finish = () => {
      localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1')
      resolve()
    }

    root.querySelector('#continue-btn')!.addEventListener('click', finish)
    root.querySelector('#install-btn')!.addEventListener('click', () => {
      if (deferredInstallPrompt) {
        const prompt = deferredInstallPrompt
        deferredInstallPrompt = null
        void prompt
          .prompt()
          .then(() => prompt.userChoice)
          .catch(() => undefined)
          .then(finish)
      } else if (isIos()) {
        root.querySelector('#ios-instructions')!.classList.remove('hidden')
        root.querySelector<HTMLButtonElement>('#install-btn')!.classList.add('hidden')
      } else {
        // No install API available in this browser — nothing more we can offer.
        finish()
      }
    })
  })
}
