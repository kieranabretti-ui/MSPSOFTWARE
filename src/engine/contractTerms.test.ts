import { describe, expect, it } from 'vitest'
import { clauseCitation, extractClauses, segmentContract, statedValue } from './contractTerms'

const TEXT = [
  'MANAGED SERVICES AGREEMENT',
  '1. Services',
  '1.2 The monthly charge is based on 35 supported users and 42 supported devices.',
  '2. Service hours',
  '2.1 Support is available between 08:30 and 17:30, Monday to Friday. Work requested outside these hours is chargeable at 1.5 times the standard hourly rate.',
].join('\n\n')

describe('segmentContract', () => {
  it('keeps the section number each sentence sits under', () => {
    const segs = segmentContract(TEXT)
    expect(segs.find((s) => s.sentence.startsWith('The monthly charge'))).toMatchObject({ section: '1.2', page: null })
    // The second sentence of 2.1 inherits its number.
    expect(segs.find((s) => s.sentence.startsWith('Work requested'))).toMatchObject({ section: '2.1' })
  })

  it('counts pages from form feeds', () => {
    const segs = segmentContract('1.1 First page text is here.\f2.3 Second page sentence is here.')
    expect(segs.map((s) => [s.section, s.page])).toEqual([
      ['1.1', 1],
      ['2.3', 2],
    ])
  })

  it('does not read a quantity at the start of a line as a section number', () => {
    expect(segmentContract('10 hours of support are included each month.')[0].section).toBeNull()
  })

  it('understands "Clause" and "Section" numbering', () => {
    expect(segmentContract('Clause 4.2 Onsite visits are chargeable at the standard rate.')[0]).toMatchObject({ section: '4.2' })
  })
})

describe('extractClauses', () => {
  const clauses = extractClauses(TEXT, { id: 'c1', title: 'MSA' })

  it('tags every clause with its contract', () => {
    expect(clauses.every((c) => c.contract_id === 'c1' && c.contract_title === 'MSA')).toBe(true)
  })

  it('reads contracted quantities and the out-of-hours multiplier', () => {
    expect(statedValue(clauses, 'contracted_users')).toMatchObject({ value: 35 })
    expect(statedValue(clauses, 'contracted_devices')).toMatchObject({ value: 42 })
    expect(statedValue(clauses, 'out_of_hours_multiplier')).toMatchObject({ value: 1.5 })
    expect(clauseCitation(statedValue(clauses, 'contracted_users')!.clause)).toBe('MSA, section 1.2')
  })

  it('takes nothing from an agreement that states two different rates', () => {
    const two = extractClauses('4.1 Remote work is £60 per hour.\n\n4.2 Onsite work is £90 per hour.')
    expect(statedValue(two, 'hourly_rate')).toBeNull()
  })

  it('ignores numbers of users with no commercial context', () => {
    expect(statedValue(extractClauses('5.1 If 10 users report an outage we will respond within one hour.'), 'contracted_users')).toBeNull()
  })
})
