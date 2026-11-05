const PARAM = 't'

/** Absolute link that opens Beacon with `text` prefilled, e.g. …/beacon/#t=I%20%F0%9F%90%B7%20BACON */
export function buildShareUrl(text: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#${PARAM}=${encodeURIComponent(text)}`
}

/** Reads `#t=…` from the current URL, or null if there isn't one. */
export function readSharedText(): string | null {
  const hash = location.hash.slice(1)
  for (const part of hash.split('&')) {
    const eq = part.indexOf('=')
    if (eq === -1 || part.slice(0, eq) !== PARAM) continue
    const raw = part.slice(eq + 1)
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw // malformed escape (e.g. a hand-typed lone "%") — use it verbatim
    }
  }
  return null
}

/** Drops the hash so a later reload restores the user's own draft instead of re-applying the link. */
export function clearSharedText() {
  history.replaceState(null, '', location.pathname + location.search)
}
