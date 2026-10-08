// Money is calculated unrounded and rounded once, to the penny, when a figure
// is stored. Annual figures are the unrounded monthly figure × 12, so a price
// with pence is never rounded before it is annualised (3 × £8.50 is £25.50 a
// month and £306 a year, not £26 and £312).
export const pence = (n: number) => Math.round(n * 100) / 100
export const sumPence = (xs: number[]) => pence(xs.reduce((a, b) => a + b, 0))
