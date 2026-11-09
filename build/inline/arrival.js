// A link to a chapter (#press to #checkout) makes the browser jump to where that chapter sits before
// the scroll story pins its chapters, then hold it there while the page loads, against the page's
// own landing: 264 px off in the sideways journey, and 421 px into the anatomy's pin on a short
// stacked screen (both seen 2026-11-09). Wherever the story will pin (motion welcome, any screen
// height), the address drops its fragment before the body is read: the page lands on the chapter
// itself, then puts the fragment back. Allowed by its CSP hash.
try {
  var arrival = location.hash.slice(1)
  var chapters = ['game-on', 'press', 'grip', 'weight', 'anatomy', 'throw', 'checkout']
  if (chapters.indexOf(arrival) >= 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.dataset.arrival = arrival
    history.replaceState(history.state, '', location.pathname + location.search)
  }
} catch {
  // No history API: the browser's own jump applies
}
