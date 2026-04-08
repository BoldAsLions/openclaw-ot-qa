const http = require('k6/http')
const { check, sleep } = require('k6')
const { Rate } = require('k6/metrics')

const errorRate = new Rate('error_rate')

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '10s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
  },
}

const BASE = 'http://localhost:3000/api/plc'

export default function () {
  const res = http.get(`${BASE}/status`)
  const ok = check(res, {
    'no 5xx': r => r.status < 500,
  })
  errorRate.add(!ok)
  sleep(0.1)
}