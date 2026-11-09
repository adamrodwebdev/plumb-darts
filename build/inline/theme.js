// Theme remembered from an earlier visit, applied before the first paint (no light/dark flash).
// Without a choice, the stylesheet follows the system. Allowed by its hash in the page's CSP.
try {
  var theme = localStorage.getItem('plumb.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // Storage blocked: the system theme applies
}
