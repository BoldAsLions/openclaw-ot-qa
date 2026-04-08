# openclaw-ot-qa

OT Cybersecurity QA Automation Suite — Modbus TCP mock PLC, Vitest API tests, k6 load tests, React dashboard, Cypress E2E, YubiKey human-in-the-loop authorization.

![CI](https://github.com/BoldAsLions/openclaw-ot-qa/actions/workflows/qa.yml/badge.svg)

---

## What is this

A TypeScript QA automation suite that tests a simulated OT/industrial API mimicking a PLC-connected system managing motor controls. Demonstrates protocol-level security awareness, structured automation testing, and hardware-enforced human authorization via YubiKey.

**Operational Technology (OT)** refers to hardware and software that directly monitors and controls physical devices — industrial machinery, sensors, and SCADA systems. Unlike IT, OT controls physical processes. A breach doesn't leak data — it destroys equipment or endangers lives.

---

## What is Modbus

Modbus is a serial communication protocol from 1979. It has no authentication, no encryption, and no message integrity verification. Any device on the network can read or write to a PLC with zero credentials. This project tests that attack surface systematically.

### Register map

| Address | Type | Access | Description | Valid Range |
|---------|------|--------|-------------|-------------|
| Coil 0 | Coil | R/W | Motor run command | 0 or 1 |
| Holding Register 0 | Holding | R/W | Motor speed setpoint (RPM) | 0–100 |
| Input Register 0 | Input | Read only | Temperature sensor | Auto-managed |

---

## Stack

| Tool | Role |
|------|------|
| TypeScript / Node.js | Language and runtime |
| jsmodbus | Modbus TCP server and client |
| Express | REST wrapper |
| Vitest | API and OT simulation tests |
| k6 | Load testing — SCADA polling simulation |
| React + Vite | Live browser dashboard |
| Cypress | E2E tests |
| YubiKey 5C HMAC-SHA1 | Physical human-in-the-loop for all writes |
| GitHub Actions | CI — full suite on every push |

---

## Modules

| Module | Description | Status |
|--------|-------------|--------|
| 1 — Mock PLC | Modbus TCP :5020, REST :3000, state machine, thermal model, watchdog | ✅ |
| 2 — API Tests | 11 REST cases + adversarial Modbus protocol tests | ✅ 11/11 |
| 3 — Load Tests | Baseline, spike (50 VUs), write storm (20 VUs concurrent) | ✅ all green |
| 4 — OT Simulation | State machine, thermal model, watchdog, race condition | ✅ 7/7 |
| 5 — UI + Cypress | React dashboard, live register map, 7 E2E tests | ✅ 7/7 |
| 6 — Reporting | JSON + HTML report, exit code gates CI | ✅ PASS |

---

## Quick start

```bash
npm install
cp .env.example .env
TEST_MODE=true npm run plc
npm test
npm run load
npm run dev
npm run cy:run
npm run report
```

---

## YubiKey human-in-the-loop

All write operations require physical YubiKey touch in production mode. The middleware sends an HMAC-SHA1 challenge to slot 2. The key blinks and waits for touch. No touch, no write.

```bash
TEST_MODE=false npm run plc   # real YubiKey touch required
TEST_MODE=true npm run plc    # mocked — for CI and testing
```

---

## Load test results

| Scenario | VUs | p95 | Error rate |
|----------|-----|-----|------------|
| Baseline | 10 | 5ms | 0.00% |
| Spike | 50 | 4ms | 0.00% |
| Write storm | 20 | 3ms | 0.00% |

---

## OT security context

- **Stuxnet (2010)** — Manipulated PLC speed registers to destroy centrifuges while reporting normal operation
- **Ukraine power grid (2015)** — SCADA access used to open circuit breakers, cutting power to 230,000 customers
- **Oldsmar water treatment (2021)** — Attacker attempted to increase sodium hydroxide to dangerous levels via remote access

---

## License

MIT