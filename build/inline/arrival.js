// A link to a chapter of the sideways journey (#grip to #checkout) makes the browser jump to where
// that chapter sits before the journey exists, then hold it there while the page loads, against the
// page's own landing (264 px off, seen 2026-11-09). Where the journey will travel sideways (motion
// welcome, a screen at least 40rem tall), the address drops its fragment before the body is read:
// the page lands on the chapter itself, then puts the fragment back. Allowed by its CSP hash.
try {
  var arrival = location.hash.slice(1)
  var journey = ['grip', 'weight', 'anatomy', 'throw', 'checkout']
  if (
    journey.indexOf(arrival) >= 0 &&
    matchMedia('(height >= 40rem)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.documentElement.dataset.arrival = arrival
    history.replaceState(history.state, '', location.pathname + location.search)
  }
} catch {
  // No history API: the browser's own jump applies
}
