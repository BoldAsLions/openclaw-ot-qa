import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('error_rate')

export const options = {
  vus: 20,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
  },
}

const BASE = 'http://localhost:3000/api/plc'

export default function () {
  const tokenRes = http.post(`${BASE}/token`)
  const token = JSON.parse(tokenRes.body).token
  const speed = Math.floor(Math.random() * 101)

  const res = http.post(
    `${BASE}/register`,
    JSON.stringify({ value: speed }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  )

  const ok = check(res, {
    'write accepted': r => r.status === 200,
    'valid speed returned': r => {
      const body = JSON.parse(r.body)
      return body.speed >= 0 && body.speed <= 100
    },
  })
  errorRate.add(!ok)
  sleep(0.05)
}