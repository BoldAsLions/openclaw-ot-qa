import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import axios, { AxiosInstance } from 'axios'

const BASE = 'http://localhost:3000/api/plc'
let client: AxiosInstance
let token: string

beforeAll(async () => {
  client = axios.create({ baseURL: BASE, validateStatus: () => true })
  const res = await client.post('/token')
  token = res.data.token
})

const auth = () => ({ Authorization: `Bearer ${token}` })

// ── REST test cases ───────────────────────────────────────────────────────

describe('Module 2 — REST API', () => {

  it('TC1: GET /status returns motor state', async () => {
    const res = await client.get('/status')
    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('coil')
    expect(res.data).toHaveProperty('speed')
    expect(res.data).toHaveProperty('temp')
    expect(res.data).toHaveProperty('motorState')
  })

  it('TC2: POST /coil toggles motor on', async () => {
    const res = await client.post('/coil',
      { value: true },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.status).toBe(200)
    expect(res.data.coil).toBe(true)
    expect(['STARTING', 'RUNNING']).toContain(res.data.motorState)
  })

  it('TC3: POST /coil toggles motor off', async () => {
    await new Promise(r => setTimeout(r, 600))
    const res = await client.post('/coil',
      { value: false },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.status).toBe(200)
    expect(['STOPPING', 'STOPPED']).toContain(res.data.motorState)
  })

  it('TC4: POST /register sets speed to 75', async () => {
    const res = await client.post('/register',
      { value: 75 },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.status).toBe(200)
    expect(res.data.speed).toBe(75)
  })

  it('TC5: POST /register with speed > 100 returns 400', async () => {
    const before = await client.get('/status')
    const res = await client.post('/register',
      { value: 101 },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.status).toBe(400)
    const after = await client.get('/status')
    expect(after.data.speed).toBe(before.data.speed)
  })

  it('TC6: POST /register with non-numeric value returns 400', async () => {
    const res = await client.post('/register',
      { value: 'fast' },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.status).toBe(400)
    expect(res.data).toHaveProperty('error')
  })

  it('TC7: Missing auth header returns 401', async () => {
    const res = await client.post('/coil', { value: true })
    expect(res.status).toBe(401)
  })

  it('TC8: Expired JWT returns 401', async () => {
    const res = await client.post('/coil',
      { value: true },
      { headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid' } }
    )
    expect(res.status).toBe(401)
  })

  it('TC9: POST /reset without auth returns 401', async () => {
    const res = await client.post('/reset')
    expect(res.status).toBe(401)
  })

  it('TC10: POST /reset clears state', async () => {
    await client.post('/register',
      { value: 50 },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    const res = await client.post('/reset',
      {},
      { headers: auth() }
    )
    expect(res.status).toBe(200)
    const status = await client.get('/status')
    expect(status.data.speed).toBe(0)
    expect(status.data.coil).toBe(false)
    expect(status.data.motorState).toBe('STOPPED')
  })

  it('TC11: Cross-interface consistency — REST write reflects in status', async () => {
    await client.post('/register',
      { value: 42 },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    const status = await client.get('/status')
    expect(status.data.speed).toBe(42)
  })

})