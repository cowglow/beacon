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

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function runBoot(): Promise<void> {
  if (!localStorage.getItem(SPLASH_SEEN_KEY)) {
    localStorage.setItem(SPLASH_SEEN_KEY, '1')
    await showSplash()
  }

  if (!isStandalone() && !localStorage.getItem(INSTALL_PROMPT_SEEN_KEY)) {
    await promptInstall()
  }
}

function showSplash(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'splash-screen'
    overlay.innerHTML = `
      <div class="splash-mark">BEACON</div>
      <div class="splash-bar"><div class="splash-bar-fill"></div></div>
    `
    document.body.appendChild(overlay)
    window.setTimeout(() => {
      overlay.remove()
      resolve()
    }, SPLASH_DURATION_MS)
  })
}

/** Shows the Install App / Continue to Website overlay. Safe to call any
 * time — used both during first-launch boot and from a manual re-trigger. */
export function promptInstall(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'install-screen'
    overlay.innerHTML = `
      <div class="install-mark">BEACON</div>
      <p class="install-copy">Install Beacon for instant, full-screen access next time.</p>
      <button type="button" id="install-btn" class="install-btn">Install App</button>
      <button type="button" id="continue-btn" class="continue-btn">Continue to Website</button>
      <p id="ios-instructions" class="ios-instructions hidden">
        Tap the <strong>Share</strong> icon, then <strong>Add to Home Screen</strong>.
      </p>
      <a href="https://github.com/cowglow/beacon" target="_blank" rel="noopener noreferrer" class="github-link">View on GitHub</a>
    `
    document.body.appendChild(overlay)

    const finish = () => {
      localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1')
      overlay.remove()
      resolve()
    }

    overlay.querySelector('#continue-btn')!.addEventListener('click', finish)
    overlay.querySelector('#install-btn')!.addEventListener('click', () => {
      if (deferredInstallPrompt) {
        const prompt = deferredInstallPrompt
        deferredInstallPrompt = null
        void prompt
          .prompt()
          .then(() => prompt.userChoice)
          .catch(() => undefined)
          .then(finish)
      } else if (isIos()) {
        overlay.querySelector('#ios-instructions')!.classList.remove('hidden')
        overlay.querySelector<HTMLButtonElement>('#install-btn')!.classList.add('hidden')
      } else {
        // No install API available in this browser — nothing more we can offer.
        finish()
      }
    })
  })
}
