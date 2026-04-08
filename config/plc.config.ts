export const PLC_CONFIG = {
  modbus: {
    host: 'localhost',
    port: Number(process.env.MODBUS_PORT) || 5020,
    unitId: 1,
  },
  rest: {
    port: Number(process.env.REST_PORT) || 3000,
  },
  registers: {
    coil: { motor: 0 },
    holding: { speed: 0 },
    input: { temperature: 0 },
    speedMin: 0,
    speedMax: 100,
  },
  stateMachine: {
    transitionMs: 500,
    watchdogMs: 60000,
  },
  thermal: {
    heatRatePerMs: 1 / 2000,
    coolRatePerMs: 0.5 / 2000,
    initialTemp: 20,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  testMode: process.env.TEST_MODE === 'true',
  yubikey: {
    slot: Number(process.env.YUBIKEY_SLOT) || 2,
  },
} as const
