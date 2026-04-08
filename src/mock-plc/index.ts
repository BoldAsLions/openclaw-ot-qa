import net from 'net'
import * as Modbus from 'jsmodbus'
import express from 'express'
import jwt from 'jsonwebtoken'
import { PLC_CONFIG } from '../../config/plc.config.js'

const coils   = Buffer.alloc(1024)
const holding = Buffer.alloc(1024)
const input   = Buffer.alloc(1024)

type MotorState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING'

const state = {
  coil: false,
  speed: 0,
  temperature: PLC_CONFIG.thermal.initialTemp,
  motorState: 'STOPPED' as MotorState,
  watchdogTimer: null as NodeJS.Timeout | null,
  thermalTimer: null as NodeJS.Timeout | null,
}

function syncBuffers() {
  coils.writeUInt8(state.coil ? 1 : 0, 0)
  holding.writeUInt16BE(state.speed, 0)
  input.writeUInt16BE(Math.round(state.temperature), 0)
}

function transition(target: 'on' | 'off'): boolean {
  const { transitionMs } = PLC_CONFIG.stateMachine
  if (target === 'on') {
    if (state.motorState === 'STOPPING') return false
    if (state.motorState === 'RUNNING' || state.motorState === 'STARTING') return true
    state.motorState = 'STARTING'
    state.coil = true
    setTimeout(() => { state.motorState = 'RUNNING' }, transitionMs)
  } else {
    if (state.motorState === 'STOPPED' || state.motorState === 'STOPPING') return true
    state.motorState = 'STOPPING'
    state.coil = false
    setTimeout(() => { state.motorState = 'STOPPED' }, transitionMs)
  }
  resetWatchdog()
  syncBuffers()
  return true
}

function resetWatchdog() {
  if (state.watchdogTimer) clearTimeout(state.watchdogTimer)
  state.watchdogTimer = setTimeout(() => {
    console.log('[watchdog] timeout — safe stopping motor')
    transition('off')
  }, PLC_CONFIG.stateMachine.watchdogMs)
}

function startThermal() {
  if (state.thermalTimer) clearInterval(state.thermalTimer)
  state.thermalTimer = setInterval(() => {
    if (state.motorState === 'RUNNING') {
      state.temperature += PLC_CONFIG.thermal.heatRatePerMs * 2000
    } else {
      state.temperature = Math.max(
        PLC_CONFIG.thermal.initialTemp,
        state.temperature - PLC_CONFIG.thermal.coolRatePerMs * 2000
      )
    }
    syncBuffers()
  }, 2000)
}

export function resetState() {
  state.coil = false
  state.speed = 0
  state.temperature = PLC_CONFIG.thermal.initialTemp
  state.motorState = 'STOPPED'
  if (state.watchdogTimer) clearTimeout(state.watchdogTimer)
  syncBuffers()
}

const netServer = net.createServer()
const modbusServer = new Modbus.server.TCP(netServer, { coils, holding, input })

modbusServer.on('preWriteSingleCoil', (request: any, response: any) => {
  const value = request.body.coil
  const ok = transition(value ? 'on' : 'off')
  if (!ok) response.body.exceptionCode = 0x04
})

modbusServer.on('preWriteSingleRegister', (request: any, response: any) => {
  const val = request.body.value
  if (val < PLC_CONFIG.registers.speedMin || val > PLC_CONFIG.registers.speedMax) {
    response.body.exceptionCode = 0x03
    return
  }
  state.speed = val
  syncBuffers()
})

netServer.listen(PLC_CONFIG.modbus.port, () => {
  console.log(`[modbus] listening on port ${PLC_CONFIG.modbus.port}`)
})

startThermal()
syncBuffers()

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' }); return
  }
  try {
    jwt.verify(auth.slice(7), PLC_CONFIG.jwt.secret)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireYubikey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (PLC_CONFIG.testMode) { next(); return }
  const ykHeader = req.headers['x-yubikey-response']
  if (!ykHeader) {
    res.status(403).json({ error: 'YubiKey authorization required' }); return
  }
  next()
}

const app = express()
app.use(express.json())

app.get('/api/plc/status', (_req, res) => {
  syncBuffers()
  res.json({
    coil: state.coil,
    speed: state.speed,
    temp: Math.round(state.temperature * 10) / 10,
    motorState: state.motorState,
  })
})

app.post('/api/plc/token', (_req, res) => {
  const token = jwt.sign(
    { sub: 'test-client' },
    PLC_CONFIG.jwt.secret,
    { expiresIn: PLC_CONFIG.jwt.expiresIn as string }
  )
  res.json({ token })
})

app.post('/api/plc/coil', requireAuth, requireYubikey, (req, res) => {
  const { value } = req.body
  if (typeof value !== 'boolean') {
    res.status(400).json({ error: 'value must be boolean' }); return
  }
  const ok = transition(value ? 'on' : 'off')
  if (!ok) {
    res.status(409).json({ error: 'Command rejected — motor is STOPPING' }); return
  }
  res.json({ coil: state.coil, motorState: state.motorState })
})

app.post('/api/plc/register', requireAuth, requireYubikey, (req, res) => {
  const { value } = req.body
  if (typeof value !== 'number' || isNaN(value)) {
    res.status(400).json({ error: 'value must be a number' }); return
  }
  if (value < PLC_CONFIG.registers.speedMin || value > PLC_CONFIG.registers.speedMax) {
    res.status(400).json({ error: `value must be between ${PLC_CONFIG.registers.speedMin} and ${PLC_CONFIG.registers.speedMax}` }); return
  }
  state.speed = value
  syncBuffers()
  res.json({ speed: state.speed })
})

app.post('/api/plc/reset', requireAuth, (_req, res) => {
  resetState()
  res.json({ message: 'State reset to defaults' })
})

app.listen(PLC_CONFIG.rest.port, () => {
  console.log(`[rest] listening on port ${PLC_CONFIG.rest.port}`)
})

export { state }