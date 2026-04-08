import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/plc'

type MotorState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING'

interface PLCStatus {
  coil: boolean
  speed: number
  temp: number
  motorState: MotorState
}

const STATE_COLORS: Record<MotorState, string> = {
  STOPPED:  '#718096',
  STARTING: '#D69E2E',
  RUNNING:  '#38A169',
  STOPPING: '#E53E3E',
}

export default function App() {
  const [status, setStatus]       = useState<PLCStatus | null>(null)
  const [token, setToken]         = useState<string>('')
  const [speedInput, setSpeed]    = useState('')
  const [error, setError]         = useState('')
  const [speedError, setSpeedErr] = useState('')
  const [log, setLog]             = useState<string[]>([])

  const addLog = (msg: string) =>
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/status`)
      const data = await res.json()
      setStatus(data)
    } catch {
      setError('Cannot reach PLC server')
    }
  }, [])

  const getToken = useCallback(async () => {
    const res = await fetch(`${BASE}/token`, { method: 'POST' })
    const data = await res.json()
    setToken(data.token)
    addLog('Token refreshed')
    return data.token
  }, [])

  useEffect(() => {
    getToken()
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [fetchStatus, getToken])

  const toggleCoil = async () => {
    const t = token || await getToken()
    const next = !status?.coil
    const res = await fetch(`${BASE}/coil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ value: next })
    })
    const data = await res.json()
    if (res.ok) {
      addLog(`Motor ${next ? 'ON' : 'OFF'} → ${data.motorState}`)
    } else {
      addLog(`Coil error: ${data.error}`)
    }
    fetchStatus()
  }

  const setRegister = async () => {
    const val = Number(speedInput)
    if (isNaN(val) || val < 0 || val > 100) {
      setSpeedErr('Speed must be 0–100'); return
    }
    setSpeedErr('')
    const t = token || await getToken()
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ value: val })
    })
    const data = await res.json()
    if (res.ok) {
      addLog(`Speed set to ${data.speed} RPM`)
    } else {
      addLog(`Register error: ${data.error}`)
    }
    fetchStatus()
  }

  const resetPLC = async () => {
    const t = token || await getToken()
    await fetch(`${BASE}/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` }
    })
    addLog('PLC state reset')
    fetchStatus()
  }

  const motorColor = status ? STATE_COLORS[status.motorState] : '#718096'

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 800, margin: '0 auto', padding: 24, background: '#1a1a2e', minHeight: '100vh', color: '#e2e8f0' }}>

      <h1 style={{ color: '#63b3ed', marginBottom: 4 }}>openclaw-ot-qa</h1>
      <p style={{ color: '#718096', marginBottom: 32 }}>OT Cybersecurity QA Dashboard</p>

      {error && <div style={{ background: '#742a2a', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {/* Motor state */}
      <div style={{ background: '#2d3748', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <h2 style={{ color: '#a0aec0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Motor State</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: motorColor, boxShadow: `0 0 12px ${motorColor}` }} />
          <span style={{ fontSize: 32, fontWeight: 'bold', color: motorColor }}>
            {status?.motorState ?? '—'}
          </span>
        </div>
      </div>

      {/* Register map */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Coil 0', value: status?.coil ? 'ON' : 'OFF', color: status?.coil ? '#38A169' : '#718096' },
          { label: 'Speed (RPM)', value: status?.speed ?? '—', color: '#63b3ed' },
          { label: 'Temp (°C)', value: status?.temp ?? '—', color: '#F6AD55' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#2d3748', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ color: '#718096', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color }}>{String(value)}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background: '#2d3748', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <h2 style={{ color: '#a0aec0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Controls</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            data-testid="coil-toggle"
            onClick={toggleCoil}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, background: status?.coil ? '#E53E3E' : '#38A169', color: 'white' }}
          >
            {status?.coil ? 'STOP MOTOR' : 'START MOTOR'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={speedInput}
                onChange={e => { setSpeed(e.target.value); setSpeedErr('') }}
                placeholder="0–100 RPM"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #4a5568', background: '#1a202c', color: '#e2e8f0', fontFamily: 'monospace', width: 120 }}
              />
              <button
                onClick={setRegister}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, background: '#3182ce', color: 'white' }}
              >
                SET SPEED
              </button>
            </div>
            {speedError && <div style={{ color: '#FC8181', fontSize: 12 }}>{speedError}</div>}
          </div>

          <button
            onClick={resetPLC}
            style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #4a5568', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14, background: 'transparent', color: '#a0aec0' }}
          >
            RESET
          </button>
        </div>
      </div>

      {/* Activity log */}
      <div style={{ background: '#2d3748', borderRadius: 12, padding: 24 }}>
        <h2 style={{ color: '#a0aec0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Activity Log</h2>
        <div style={{ height: 160, overflowY: 'auto' }}>
          {log.length === 0
            ? <div style={{ color: '#4a5568' }}>No activity yet</div>
            : log.map((entry, i) => (
                <div key={i} style={{ color: '#68d391', fontSize: 13, marginBottom: 4 }}>{entry}</div>
              ))
          }
        </div>
      </div>

    </div>
  )
}