import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const REPORTS_DIR = 'reports'
fs.mkdirSync(REPORTS_DIR, { recursive: true })

// ── Run Vitest and capture results ────────────────────────────────────────
console.log('Running Vitest...')
let vitestOutput = ''
let vitestPassed = 0
let vitestFailed = 0

try {
  vitestOutput = execSync( 'TEST_MODE=true npx vitest run src/api-tests/plc.test.ts --reporter=json 2>/dev/null',
  {
    encoding: 'utf8',
    env: { ...process.env, TEST_MODE: 'true' }
  })
  const vitestJson = JSON.parse(vitestOutput)
  vitestPassed = vitestJson.numPassedTests ?? 0
  vitestFailed = vitestJson.numFailedTests ?? 0
} catch (e: any) {
  try {
    const vitestJson = JSON.parse(e.stdout ?? '{}')
    vitestPassed = vitestJson.numPassedTests ?? 0
    vitestFailed = vitestJson.numFailedTests ?? 0
  } catch {
    vitestFailed = 1
  }
}

// ── Run k6 baseline and capture summary ──────────────────────────────────
console.log('Running k6 baseline...')
let k6P95 = 0
let k6ErrorRate = 0
let k6Passed = false

try {
  const k6Out = execSync(
    'k6 run --summary-export=reports/k6-summary.json src/load-tests/baseline.js 2>/dev/null',
    { encoding: 'utf8' }
  )
  void k6Out
if (fs.existsSync('reports/k6-summary.json')) {
  const k6Json = JSON.parse(fs.readFileSync('reports/k6-summary.json', 'utf8'))
  k6P95 = k6Json?.metrics?.http_req_duration?.['p(95)'] ?? 0
  k6ErrorRate = k6Json?.metrics?.http_req_failed?.rate ?? 0
  k6Passed = k6P95 < 200 && k6ErrorRate < 0.01
}
} catch {
  k6Passed = false
}

// ── Build JSON report ─────────────────────────────────────────────────────
const report = {
  generated: new Date().toISOString(),
  project: 'openclaw-ot-qa',
  summary: {
    vitest: { passed: vitestPassed, failed: vitestFailed },
    k6: { p95Ms: Math.round(k6P95), errorRate: k6ErrorRate, passed: k6Passed },
    overall: vitestFailed === 0 && k6Passed ? 'PASS' : 'FAIL'
  }
}

fs.writeFileSync('reports/report.json', JSON.stringify(report, null, 2))
console.log('JSON report written to reports/report.json')

// ── Build HTML report ─────────────────────────────────────────────────────
const statusColor = report.summary.overall === 'PASS' ? '#38A169' : '#E53E3E'

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>openclaw-ot-qa — QA Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: monospace; background: #1a1a2e; color: #e2e8f0; padding: 40px; }
    h1 { color: #63b3ed; margin-bottom: 4px; }
    .subtitle { color: #718096; margin-bottom: 40px; font-size: 14px; }
    .badge { display: inline-block; padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 18px; background: ${statusColor}; color: white; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
    .card { background: #2d3748; border-radius: 12px; padding: 24px; }
    .card h2 { color: #a0aec0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
    .stat { font-size: 36px; font-weight: bold; margin-bottom: 4px; }
    .stat.green { color: #68d391; }
    .stat.red { color: #fc8181; }
    .stat.blue { color: #63b3ed; }
    .label { color: #718096; font-size: 13px; }
    .meta { color: #4a5568; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <h1>openclaw-ot-qa</h1>
  <p class="subtitle">OT Cybersecurity QA Report — ${new Date().toLocaleString()}</p>
  <div class="badge">${report.summary.overall}</div>
  <div class="grid">
    <div class="card">
      <h2>Vitest — API + OT Simulation</h2>
      <div class="stat green">${vitestPassed} passed</div>
      <div class="label">${vitestFailed > 0 ? `${vitestFailed} failed` : 'zero failures'}</div>
    </div>
    <div class="card">
      <h2>k6 — Load Test (baseline)</h2>
      <div class="stat blue">p95 ${Math.round(k6P95)}ms</div>
      <div class="label">threshold &lt;200ms — ${k6Passed ? 'PASS' : 'FAIL'}</div>
    </div>
  </div>
  <p class="meta">Generated: ${report.generated}</p>
</body>
</html>`

fs.writeFileSync('reports/report.html', html)
console.log('HTML report written to reports/report.html')

// ── Exit code ─────────────────────────────────────────────────────────────
const exitCode = report.summary.overall === 'PASS' ? 0 : 1
console.log(`\nOverall: ${report.summary.overall}`)
process.exit(exitCode)