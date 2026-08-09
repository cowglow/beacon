import './style.css'
import { ComposeScreen } from './compose.ts'
import { DisplayScreen } from './display.ts'
import { runBoot } from './onboarding.ts'

const app = document.querySelector<HTMLDivElement>('#app')!

async function start() {
  await runBoot(app)

  app.innerHTML = `
    <div id="compose-screen" class="screen compose-screen"></div>
    <div id="display-screen" class="screen display-screen hidden"></div>
  `

  const composeRoot = app.querySelector<HTMLDivElement>('#compose-screen')!
  const displayRoot = app.querySelector<HTMLDivElement>('#display-screen')!

  const display = new DisplayScreen(displayRoot, () => {
    displayRoot.classList.add('hidden')
    composeRoot.classList.remove('hidden')
    compose.focusInput()
  })

  const compose = new ComposeScreen(composeRoot, (text, colors, mode) => {
    composeRoot.classList.add('hidden')
    displayRoot.classList.remove('hidden')
    void display.show(text, colors, mode)
  })

  compose.focusInput()
}

void start()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Absolute path built from BASE_URL, not a plain relative './sw.js': this
    // module can end up bundled under /assets/, and a relative URL here would
    // resolve against that nested location instead of the site root.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
