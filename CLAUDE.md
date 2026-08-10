# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Implemented: vanilla TypeScript + Vite PWA, two-screen Compose → Display flow, installable with offline support, deployed to GitHub Pages.

`beacon-app-prompt.md` is the original product spec, still useful for intent and the non-goals list (no accounts, no backend, no image/sticker editor), but the shipped app has diverged from it in a few explicit, user-directed ways — don't "fix" these back toward the spec:
- Only 2 fixed style presets (Black/Yellow, Black/White) plus a **Custom** swatch: tap it for a native background color picker; a small badge on its corner toggles text color between black/white (not a free color picker).
- **Scroll** display mode was removed. Only **Static** and **Blink** remain. Blink inverts background/text color (not an opacity flash).
- A one-time splash animation (first launch only) and a one-time "Install App / Continue to Website" interstitial (shown once, skipped entirely once running standalone) render as overlays on first load — this intentionally trades away the spec's "zero taps, instant" first-open in exchange for an app-like install funnel for shared links. A cog icon on Compose (hidden once running standalone) re-opens that same install prompt on demand via `promptInstall()` in `onboarding.ts`.
- The textarea no longer autofocuses on load — the spec's "keyboard opens immediately, zero taps" was deliberately dropped so opening the link doesn't yank up the mobile keyboard before the user's chosen anything. `compose.focusInput()` is still called after returning from Display or loading a Recent, since those are direct results of a tap, not a page-load side effect.
- The message draft mirrors to `localStorage` (`beacon:draft`, in `storage.ts`) on every keystroke and whenever a Recent is loaded, and is restored into the textarea on mount — an in-progress message survives a reload/relaunch instead of being lost.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc`, no emit) then production-build via Vite
- `npm run preview` — serve the production build locally

There is no test runner and no lint command configured in this repo.

## Tech constraints (from the spec)

- Vanilla TypeScript + DOM only — no React/Vue/frontend framework, and avoid adding runtime dependencies beyond the Vite vanilla-ts template.
- No backend/accounts/cloud sync — persistence is `localStorage` only.
- PWA requirements: manifest + service worker (installable, works offline after first load), Screen Wake Lock API on the display screen, Fullscreen API + `screen.orientation.lock('landscape')` (with a CSS-rotation fallback when unsupported).
- `tsconfig.json` targets ES2023/bundler resolution with `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly` enabled — keep imports type-correct, remove dead locals/params, and don't use constructor parameter-property shorthand (`erasableSyntaxOnly` rejects it) or `tsc` (and thus `npm run build`) will fail.

## Architecture

No routing library — `main.ts` mounts two full-screen `.screen` divs (Compose, Display) toggled via a `hidden` class immediately on load, then kicks off `onboarding.ts`'s `runBoot()` concurrently rather than gating the mount on it. `runBoot()` renders the splash and (if not already standalone) the install interstitial as overlays appended directly to `document.body` — each shown at most once per `localStorage` flag, and each removes itself when done. `promptInstall()` and `isStandalone()` are also exported and reused outside boot (see the Compose cog icon below), which is why the overlays are self-contained rather than tied to whatever `main.ts` happens to have mounted underneath them.

1. **Compose** (`compose.ts`) — textarea (no autofocus — see Project status), preset/custom-color swatches, Static/Blink toggle, a Recents drawer (`storage.ts`, seeded on first launch, capped at 10), and GO (button + Enter, Shift+Enter for a literal newline). Long-press (mobile) or double-click (desktop) a recent to delete it via a confirm dialog — note the double-click handler must debounce the plain `click` action, since a double-click fires `click, click, dblclick` and an undebounced `click` handler would fire the recent-load side effect before the delete dialog appears.
2. **Display** (`display.ts`) — takes resolved `{bg, fg}` colors directly (no preset-id lookup), fits text via binary search (`textfit.ts`), holds the Wake Lock, and requests fullscreen on **`document.documentElement`**, not the display element itself — fullscreening the display element directly puts it in the browser's top layer, which force-stretches it to the viewport and silently defeats the CSS rotation fallback used when `screen.orientation.lock('landscape')` is unsupported.

### Deploying (GitHub Pages, no custom domain)

Live at https://cowglow.github.io/beacon/. `.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`. Since a project Pages site is served from `/<repo-name>/` rather than the domain root, the workflow sets `BASE_PATH=/${{ github.event.repository.name }}/` as an env var before `npm run build`; `vite.config.ts` reads `process.env.BASE_PATH` (defaulting to `/` for local dev/build) as Vite's `base`. This is derived from the actual repo name at build time — don't hardcode a repo name anywhere.

Two things fall outside Vite's own base-rewriting and are handled by hand — keep this in mind if you touch either file:
- `public/manifest.json`'s `start_url`, `scope`, and icon `src` are relative (`.`, `favicon.svg`), which resolve against the manifest's own fetched URL regardless of subpath.
- `public/sw.js`'s cached `APP_SHELL` paths are relative (`./`, `./index.html`, ...), resolving against the service worker's own script URL.
- The service worker registration call in `main.ts` uses `` `${import.meta.env.BASE_URL}sw.js` `` (an absolute path built from Vite's base) rather than a plain relative string — the calling module can be bundled into a nested `assets/` chunk, and a relative URL there would resolve against that nested location instead of the site root.

### README assets

`docs/screencapture/` (screenshots + a demo clip, referenced by `README.md`) is deliberately outside `public/` — anything under `public/` ships as part of the deployed PWA via Vite, and these are documentation-only. Don't move them into `public/` for convenience; that was tried and reverted specifically because it bloated `dist/` by ~21MB for zero runtime benefit.
