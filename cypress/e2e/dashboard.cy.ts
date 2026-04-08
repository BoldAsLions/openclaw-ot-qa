describe('Module 5 — Cypress E2E', () => {

  beforeEach(() => {
    cy.request('POST', 'http://localhost:3000/api/plc/token').then(res => {
      const token = res.body.token
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/api/plc/reset',
        headers: { Authorization: `Bearer ${token}` }
      })
    })
    cy.visit('/')
    cy.contains('STOPPED', { timeout: 5000 }).should('be.visible')
  })

  it('CY1: Dashboard loads and displays motor state', () => {
    cy.contains(/motor state/i).should('be.visible')
    cy.contains(/coil 0/i).should('be.visible')
    cy.contains(/speed/i).should('be.visible')
    cy.contains(/temp/i).should('be.visible')
  })

  it('CY2: Toggle motor on via UI', () => {
    cy.get('[data-testid="coil-toggle"]').click()
    cy.contains(/STARTING|RUNNING/, { timeout: 2000 }).should('be.visible')
  })

  it('CY3: Motor button label flips after start', () => {
    cy.get('[data-testid="coil-toggle"]').click()
    cy.get('[data-testid="coil-toggle"]', { timeout: 3000 }).should('contain', 'STOP MOTOR')
  })

  it('CY4: Set speed to 50 via UI', () => {
    cy.get('input[type=number]').type('50')
    cy.contains('button', /set speed/i).click()
    cy.contains(/speed set to 50/i, { timeout: 3000 }).should('be.visible')
  })

  it('CY5: Speed input rejects values over 100', () => {
    cy.get('input[type=number]').type('150')
    cy.contains('button', /set speed/i).click()
    cy.contains(/speed must be 0.100/i).should('be.visible')
  })

  it('CY6: Reset clears activity log entry', () => {
    cy.contains('button', /reset/i).click()
    cy.contains(/plc state reset/i, { timeout: 3000 }).should('be.visible')
  })

  it('CY7: Activity log records actions', () => {
    cy.get('[data-testid="coil-toggle"]').click()
    cy.contains(/motor on/i, { timeout: 3000 }).should('be.visible')
  })

})