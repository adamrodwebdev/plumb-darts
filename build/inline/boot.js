// Loads the page's code once the browser reports the first paint: the HTML and its inline style
// paint first, the code never delays them. The files come from #boot-manifest (written at build).
;(() => {
  const manifest = JSON.parse(document.getElementById('boot-manifest').textContent)
  // Only the site's own versioned files load, whatever the manifest says
  const ASSET = /^(?:\/[\w.-]+)*\/assets\/[\w.-]+\.(?:js|css)$/
  let started = false

  const start = () => {
    if (started) return
    started = true
    for (const href of manifest.modules) {
      if (!ASSET.test(href)) continue
      const link = document.createElement('link')
      link.rel = 'modulepreload'
      link.crossOrigin = ''
      link.href = href
      document.head.append(link)
    }
    const styles = manifest.styles
      .filter((href) => ASSET.test(href))
      .map(
        (href) =>
          new Promise((resolve) => {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = href
            link.onload = link.onerror = resolve
            document.head.append(link)
          }),
      )
    if (ASSET.test(manifest.entry)) Promise.all(styles).then(() => import(manifest.entry))
  }

  const measured = (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes) || []
  // Hidden tab or no paint timing: load right away
  if (document.visibilityState !== 'visible' || !measured.includes('paint')) {
    setTimeout(start)
    return
  }
  new PerformanceObserver((list, observer) => {
    if (list.getEntriesByName('first-contentful-paint').length > 0) {
      observer.disconnect()
      requestAnimationFrame(() => setTimeout(start))
    }
  }).observe({ type: 'paint', buffered: true })
  // Safety net: a signal that never comes cannot keep the page without its code
  setTimeout(start, 1500)
})()
