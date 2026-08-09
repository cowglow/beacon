function shrinkToFit(el: HTMLElement, fits: (px: number) => boolean, maxPx: number, minPx: number) {
  let lo = minPx
  let hi = maxPx
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2)
    el.style.fontSize = `${mid}px`
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  el.style.fontSize = `${lo}px`
}

/** Shrinks/grows font-size so `el` fits within `container` on both axes, wrapping as needed. */
export function fitText(el: HTMLElement, container: HTMLElement, maxPx = 1000, minPx = 8) {
  shrinkToFit(
    el,
    () => el.scrollWidth <= container.clientWidth && el.scrollHeight <= container.clientHeight,
    maxPx,
    minPx,
  )
}

/** Shrinks/grows font-size so a single-line (nowrap) `el` fits `container`'s height. */
export function fitTextSingleLine(el: HTMLElement, container: HTMLElement, maxPx = 1000, minPx = 8) {
  shrinkToFit(el, () => el.scrollHeight <= container.clientHeight, maxPx, minPx)
}
