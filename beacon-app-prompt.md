# Build "Beacon" — a full-screen attention-grabbing text sign PWA

## What this app is
A single-purpose Progressive Web App that turns a phone screen into a giant,
high-contrast, instantly-readable sign — the kind you hold up over your head
in a dark, crowded space (a festival, a concert, an airport pickup lane) so
someone far away can read it in under a second.

The entire product is two screens: **type a message → hold the phone up**.
No accounts, no ads, no settings menu buried three taps deep. Every design
decision should optimize for *speed from thought to visible sign* and
*legibility at distance in low light*.

## Tech stack
- Vite + TypeScript, vanilla (no UI framework — already scaffolded). Keep
  it to plain DOM manipulation in TS, no React/Vue/etc, and avoid adding
  extra runtime dependencies beyond what Vite's vanilla-ts template ships
  with.
- PWA: `manifest.json` + a minimal service worker (e.g. via
  `vite-plugin-pwa` or hand-rolled) so it installs to the home screen and
  works offline after first load.
- Use the **Screen Wake Lock API** to keep the display on while showing text.
- Use the **Fullscreen API** on entering display mode.
- Use `localStorage` for recents/presets (no backend, no login).
- No external font/icon CDNs required — use system fonts (`-apple-system,
  Roboto, system-ui, sans-serif`) at huge weights for max compatibility.

## Screen 1 — Compose
- On load, a single large `<textarea>` (or contenteditable div) fills most
  of the screen and is auto-focused so the keyboard opens immediately.
  No splash screen, no onboarding.
- Below/above the input: a slim horizontal strip of **style presets**
  (see Style Presets below) shown as small color-swatch pills — tap to
  select, no separate settings page.
- Below that: a slim horizontal strip of **display mode** toggles:
  `Static` / `Blink` / `Scroll` (marquee).
- A swipe-up (or tap-to-expand) drawer holds **Recents** — the last 8-10
  messages sent to display, tap any to reload it into the input instantly.
  Seed it with 3-4 starter presets on first launch: `TAXI`, `ID?`,
  `ONE MORE SONG`, `🎉 BIRTHDAY 🎉`.
- One large, unmissable **"GO" button** (or just: tapping/pressing Enter
  on the textarea triggers display mode — evaluate both, pressing Enter
  should work as the fast path for returning users).

## Screen 2 — Display
- Full-screen, no browser chrome, forced landscape orientation
  (`screen.orientation.lock('landscape')` where supported; if not
  supported, rotate the text 90° via CSS as a fallback so it still reads
  correctly when the phone is held sideways).
- Text auto-scales to be as large as possible while still fitting the
  screen on one line (or wraps to 2 lines max for longer messages) — write
  a resize routine that measures text width/height and grows/shrinks font
  size to fill available space, re-running on resize/orientation change.
- Screen brightness note: browsers can't force hardware brightness, so
  compensate by defaulting to **pure white text on pure black background**
  (or pure black on pure yellow) — max contrast reads as "bright" even at
  normal screen brightness. Mention this limitation nowhere in the UI, it
  should just look bright.
- Wake Lock engaged the moment this screen is shown, released when the
  user exits.
- Tap anywhere on the display screen to return to Compose (message stays
  loaded so it can be tweaked and re-shown fast).
- Display modes:
    - **Static** — text just sits there, max size.
    - **Blink** — text flashes on/off at a steady, non-seizure-inducing rate
      (~2Hz; avoid anything in the 3–30Hz photosensitive-epilepsy risk band —
      research and pick a safe, clearly-visible rate).
    - **Scroll** — text marquees smoothly right-to-left at a legible speed,
      looping.

## Style presets (swatch pills, pick on Compose, apply on Display)
1. Black bg / Yellow text (the classic taxi-sign look)
2. Black bg / White text (max general contrast)
3. Yellow bg / Black text (inverse of #1, reads well from further away)
4. Red bg / White text (for urgent/hype messages)
   Keep this list short — 4 presets, not a color picker. A color picker
   adds a decision point that slows down the "type and go" flow this app
   exists to protect.

## Non-goals (do not build these unless explicitly asked later)
- No accounts, cloud sync, or sharing between users.
- No ads, analytics, or tracking.
- No image/emoji-sticker editor — text only (plain emoji typed via the
  system keyboard are fine, no custom emoji picker).
- No in-app settings screen separate from the compose screen — everything
  stays in the two-screen flow described above.

## Acceptance checklist
- [ ] Opening the app focuses the text input with keyboard open, zero taps.
- [ ] Typing a message and hitting Enter (or GO) goes full-screen with the
  text auto-sized to fill the screen.
- [ ] Wake lock keeps the screen on for as long as Display is active.
- [ ] Rotating/holding the phone sideways shows the text large and correctly
  oriented even if orientation lock isn't supported by the browser.
- [ ] Static, Blink, and Scroll modes all work and are switchable from
  Compose before going full-screen.
- [ ] The last 8-10 messages persist across app restarts (localStorage) and
  are one tap away from redisplay.
- [ ] The app installs to a phone home screen (valid manifest.json, icons,
  service worker) and opens full-screen/standalone, not in a browser tab.
- [ ] Everything works with zero network connection after first load.

## Design language
Bold, blunt, maximal — this is a warning-sign/road-sign aesthetic, not a
polished SaaS dashboard. Big tap targets (this gets used in dark, crowded,
one-handed situations). No thin fonts, no subtle grays, no hover-only
affordances (this is a touch-only, often one-thumb, context).

## Stretch ideas (only if there's time left — ask before building)
- Haptic buzz when Display mode activates, as tactile confirmation.
- A "shake to clear" gesture to blank the input fast.
- Adjustable blink/scroll speed.
- Export recents as a shareable list (still no backend — just a copyable
  text block).