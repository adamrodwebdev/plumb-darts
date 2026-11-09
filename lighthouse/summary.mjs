// One line per Lighthouse run (lhr-*.json) in the CI log: every run, not only the median LHCI
// keeps, to see at a glance which one failed and on what. A run that blocks for more than 50 ms
// lists its long tasks, scripts and main-thread work; the machine's speed index and the slowdown
// applied close each line.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2] ?? '.lighthouseci'
if (!existsSync(DIR)) process.exit(0)
const METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
]
const DETAIL_ABOVE_MS = 50

const ms = (value) => `${Math.round(value)} ms`
// Always the preview's origin: the path is enough
const withoutOrigin = (url) => url.replace(/^https?:\/\/[^/]+/, '') || url
const items = (report, id) => report.audits[id]?.details?.items ?? []

// Timestamped names: alphabetical order is the order of the runs
for (const file of readdirSync(DIR)
  .filter((name) => /^lhr-.*\.json$/.test(name))
  .sort()) {
  const report = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
  const scores = Object.values(report.categories).map(
    (category) => `${category.id} ${Math.round(category.score * 100)}`,
  )
  const metrics = METRICS.map((id) => `${id} ${report.audits[id].displayValue}`)
  const machine = `machine ${Math.round(report.environment.benchmarkIndex)}, slowed ${report.configSettings.throttling.cpuSlowdownMultiplier}×`
  console.log(
    `${withoutOrigin(report.finalDisplayedUrl)} | ${scores.join(', ')} | ${metrics.join(', ')} | ${machine}`,
  )
  if (report.audits['total-blocking-time'].numericValue <= DETAIL_ABOVE_MS) continue
  const tasks = items(report, 'long-tasks').map(
    (task) => `${ms(task.duration)} at ${ms(task.startTime)} (${withoutOrigin(task.url)})`,
  )
  const scripts = items(report, 'bootup-time')
    .slice(0, 4)
    .map(
      (script) =>
        `${withoutOrigin(script.url)} ${ms(script.total)} (scripting ${ms(script.scripting)})`,
    )
  const work = items(report, 'mainthread-work-breakdown').map(
    (group) => `${group.group} ${ms(group.duration)}`,
  )
  console.log(`    long tasks: ${tasks.join(', ') || 'none'}`)
  console.log(`    scripts: ${scripts.join(', ')}`)
  console.log(`    main thread: ${work.join(', ')}`)
}
