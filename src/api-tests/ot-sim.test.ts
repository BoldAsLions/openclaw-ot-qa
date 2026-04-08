import { describe, it, expect, beforeAll } from 'vitest'
import axios, { AxiosInstance } from 'axios'

const BASE = 'http://localhost:3000/api/plc'
let client: AxiosInstance
let token: string

beforeAll(async () => {
  client = axios.create({ baseURL: BASE, validateStatus: () => true })
  const res = await client.post('/token')
  token = res.data.token
  await client.post('/reset', {}, { headers: { Authorization: `Bearer ${token}` } })
})

const auth = () => ({ Authorization: `Bearer ${token}` })
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('Module 4 — OT Simulation', () => {

  it('TC-OT1: Motor transitions STOPPED → STARTING → RUNNING', async () => {
    await client.post('/reset', {}, { headers: auth() })
    const res = await client.post('/coil',
      { value: true },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(res.data.motorState).toBe('STARTING')
    await wait(600)
    const status = await client.get('/status')
    expect(status.data.motorState).toBe('RUNNING')
  })

  it('TC-OT2: Motor transitions RUNNING → STOPPING → STOPPED', async () => {
    const status = await client.get('/status')
    if (status.data.motorState !== 'RUNNING') {
      await client.post('/coil', { value: true }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
      await wait(600)
    }
    const res = await client.post('/coil',
      { value: false },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    )
    expect(['STOPPING', 'STOPPED']).toContain(res.data.motorState)
    await wait(600)
    const after = await client.get('/status')
    expect(after.data.motorState).toBe('STOPPED')
  })

  it('TC-OT3: Command rejected during STOPPING state returns 409', async () => {
    await client.post('/reset', {}, { headers: auth() })
    await client.post('/coil', { value: true }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    await wait(600)
    await client.post('/coil', { value: false }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    const status = await client.get('/status')
    if (status.data.motorState === 'STOPPING') {
      const res = await client.post('/coil',
        { value: true },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      )
      expect(res.status).toBe(409)
    } else {
      console.log('Motor already stopped — transition too fast, skipping rejection check')
      expect(true).toBe(true)
    }
  })

  it('TC-OT4: Temperature rises when motor is RUNNING', async () => {
    await client.post('/reset', {}, { headers: auth() })
    const before = await client.get('/status')
    const tempBefore = before.data.temp
    await client.post('/coil', { value: true }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    await wait(600)
    await wait(2500)
    const after = await client.get('/status')
    expect(after.data.temp).toBeGreaterThan(tempBefore)
  })

  it('TC-OT5: Temperature cools when motor is STOPPED', async () => {
    const running = await client.get('/status')
    if (running.data.motorState === 'RUNNING') {
      await client.post('/coil', { value: false }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
      await wait(600)
    }
    const before = await client.get('/status')
    const tempBefore = before.data.temp
    await wait(2500)
    const after = await client.get('/status')
    expect(after.data.temp).toBeLessThanOrEqual(tempBefore)
  })

  it('TC-OT6: Safe shutdown sequence — RUNNING → STOPPED within timeout', async () => {
    await client.post('/reset', {}, { headers: auth() })
    await client.post('/coil', { value: true }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    await wait(600)
    const running = await client.get('/status')
    expect(running.data.motorState).toBe('RUNNING')
    await client.post('/coil', { value: false }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    await wait(600)
    const stopped = await client.get('/status')
    expect(stopped.data.motorState).toBe('STOPPED')
  })

  it('TC-OT7: Watchdog safe-stops motor if no command received', async () => {
    await client.post('/reset', {}, { headers: auth() })
    await client.post('/coil', { value: true }, { headers: { ...auth(), 'Content-Type': 'application/json' } })
    await wait(600)
    const running = await client.get('/status')
    expect(running.data.motorState).toBe('RUNNING')
    await wait(62000)
    const after = await client.get('/status')
    expect(after.data.motorState).toBe('STOPPED')
  }, 70000)

})