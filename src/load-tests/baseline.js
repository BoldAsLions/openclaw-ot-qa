const http = require('k6/http')
const { check, sleep } = require('k6')
const { Trend, Rate } = require('k6/metrics')

const p95 = new Trend('p95_response', true)
const errorRate = new Rate('error_rate')

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
}

const BASE = 'http://localhost:3000/api/plc'

export default function () {
  const status = http.get(`${BASE}/status`)
  const statusOk = check(status, {
    'status 200': r => r.status === 200,
    'has motorState': r => JSON.parse(r.body).motorState !== undefined,
  })
  p95.add(status.timings.duration)
  errorRate.add(!statusOk)
  sleep(0.1)

  const tokenRes = http.post(`${BASE}/token`)
  const token = JSON.parse(tokenRes.body).token

  const coilRes = http.post(
    `${BASE}/coil`,
    JSON.stringify({ value: true }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  )
  const coilOk = check(coilRes, {
    'coil 200 or 409': r => r.status === 200 || r.status === 409,
  })
  errorRate.add(!coilOk)
  sleep(0.1)
}